
(function() {
	window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

	navigator.getMedia = ( navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia);

	// ---

	var video = null, videoWidth, videoHeight, webcamStream = null;
	var canvas;
	var gl;
	var effects = [],
		activeEffect = null;
	var shaderProgram;
	var vertexPositionBuffer, uvBuffer, mvMatrix, pMatrix;
	var texture;
	var animatedGIF, gifDelay = 100, gifLength = 0, gifMaxLength = 2000, gifRecordStart, recordGIFTimeout = null;

	if (navigator.getMedia) {

		video = document.createElement( 'video' );
		video.autoplay = true;

		var attempts = 0;

		video.addEventListener('loadeddata', function readyListener( event ) {
			findVideoSize();

			function findVideoSize() {
				
				if(video.videoWidth > 0 && video.videoHeight > 0) {

					video.removeEventListener('loadeddata', readyListener);
					init(video.videoWidth, video.videoHeight);

				} else {
					
					if(attempts < 10) {
						attempts++;
						setTimeout(findVideoSize, 500);
					} else {
						init(640, 480);
					}

				}
			}
		});

		navigator.getMedia({ video: true }, function (stream) {
			if(video.mozSrcObject !== undefined) {
				video.mozSrcObject = stream;
			} else {
				video.src = window.URL.createObjectURL(stream);
			}
			webcamStream = stream;
			video.play();
		}, function (error) {
			reportError(error);
		});

	} else {
		reportError('Native device media streaming (getUserMedia) not supported in this browser.');
	}

	function reportError(message) {

		var error = document.createElement('div');
		error.className = 'modal error';
		error.innerHTML = message.replace(/\n/g, '<br />');
		document.body.appendChild(error);

		if(webcamStream !== null) {
			webcamStream.stop();
		}

		if(video !== null) {
			video.pause();
			video.src = null;
		}

	}

	function init(width, height) {

		videoWidth = width;
		videoHeight = height;
		
		video.style.width = width + 'px';
		video.style.height = height + 'px';

		canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		
		Swipable.call(canvas);
		canvas.onSwipeRight(nextEffect);
		canvas.onSwipeLeft(prevEffect);

		document.getElementById('wrapper').appendChild(canvas);

		//window.addEventListener('resize', onResize, false);
		//onResize();
		
		try {

			gl = initWebGL(canvas);
			initWebGLBuffers();
			initTexture();
			initEffects(gl);
			initUI();
		
			render();

		} catch(e) {
			reportError(e.message);
		}
		
	}

	function onResize() {
		var w = window.innerWidth,
			h = window.innerHeight,
			newW,
			newH;

		if(videoWidth === undefined || videoHeight === undefined) {
			return;
		}

		newW = w;
		newH = newW * videoHeight / videoWidth;

		if(newH > h) {
			newH = h;
			newW = newH * videoWidth / videoHeight;
		}

		newW = Math.floor(newW);
		newH = Math.floor(newH);

		canvas.width = newW;
		canvas.height = newH;
		canvas.style.width = newW + 'px';
		canvas.style.height = newH + 'px';

		if( gl ) {
			gl.viewportWidth = newW;
			gl.viewportHeight = newH;
		}
	}

	function initWebGL(canvas) {

		var gl = null;
		var options = { preserveDrawingBuffer: true };

		gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;

		gl.shadersCache = {};

		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);

		return gl;

	}

	function initWebGLBuffers() {
		vertexPositionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
		var vertices = [
			1.0,  1.0,  0.0,
			-1.0,  1.0,  0.0,
			1.0, -1.0,  0.0,
			-1.0, -1.0,  0.0
		];
		
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		vertexPositionBuffer.itemSize = 3;
		vertexPositionBuffer.numItems = 4;

		uvBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

		var uvs = [
			1.0, 1.0,
			0.0, 1.0,
			1.0, 0.0,
			0.0, 0.0
		];

		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
		uvBuffer.itemSize = 2;
		uvBuffer.numItems = 4;

		mvMatrix = mat4.create();
		pMatrix = mat4.create();
	}

	function initTexture() {
		texture = gl.createTexture();
		texture.image = video;
	}

	function getShader(glContext, id) {
		var shaderScript = document.getElementById(id);
		if (!shaderScript) {
			throw new Error('Shader with id = ' + id + ' could not be found');
		}

		var str = "";
		var k = shaderScript.firstChild;
		while (k) {
			if (k.nodeType == 3) {
				str += k.textContent;
			}
			k = k.nextSibling;
		}

		var shader;
		if (shaderScript.type == "x-shader/x-fragment") {
			shader = glContext.createShader(gl.FRAGMENT_SHADER);
		} else if (shaderScript.type == "x-shader/x-vertex") {
			shader = glContext.createShader(gl.VERTEX_SHADER);
		} else {
			throw new Error('Unrecognised shader type, id = ' + id);
		}

		glContext.shaderSource(shader, str);
		glContext.compileShader(shader);

		if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
			throw new Error('Shader <strong>' + id + '</strong> could not be compiled\n' + glContext.getShaderInfoLog(shader));
		}

		return shader;
	}

	function initEffects(gl) {

		var effectDefs = {
			'dithering': { vertex: 'vs', fragment: 'fs' },
			'posterize': { vertex: 'vs', fragment: 'fs_bw' }
		};

		var vertexCommonScript = document.getElementById('vs_common').textContent,
			fragmentCommonScript = document.getElementById('fs_common').textContent;

		for(var k in effectDefs) {
			var def = effectDefs[k];
			
			var vertexScript = document.getElementById( def.vertex ).textContent,
				fragmentScript = document.getElementById( def.fragment ).textContent;

			vertexScript = vertexCommonScript + vertexScript;
			fragmentScript = fragmentCommonScript + fragmentScript;

			var effect = new ImageEffect({
				vertexShader: vertexScript,
				fragmentShader: fragmentScript,
				attributes: {
					uv: {},
					position: {}
				},
				uniforms: {
					projectionMatrix: {},
					modelViewMatrix: {},
					map: {}
				}
			});

			effects.push(effect);
			effect.initialise(gl);

		}

		activeEffect = effects[0];

	}

	function initUI() {
        document.getElementById('controls').style.opacity = '1';
		document.getElementById('btn_save').addEventListener('click', saveImage, false);
		document.getElementById('btn_record').addEventListener('click', recordVideo, false);
	}
	
	function prevEffect() {
		var index = effects.indexOf(activeEffect);
		var newIndex = --index < 0 ? effects.length - 1 : index;
		activeEffect = effects[newIndex];
	}

	function nextEffect() {
		var index = effects.indexOf(activeEffect);
		var newIndex = ++index % effects.length;
		activeEffect = effects[newIndex];
	}

	function pad(v) {
		var s = String(v);

		if(s.length < 2) {
			s = '0' + s;
		}

		return s;
	}

	function getTimestamp() {
		var now = new Date();
		var parts = [
			now.getFullYear(),
			pad(now.getMonth()),
			pad(now.getDate()),
			'_',
			pad(now.getHours()),
			pad(now.getMinutes()),
			pad(now.getSeconds())
				];

		var timestamp = parts.join('');

		return timestamp;
	}

	function saveImage() {
		canvas.toBlob(function(blob) {
			saveAs(blob, getTimestamp() + '.png');
		});
	}

	function recordVideo() {
		var btn = this;
	
		btn.disabled = true;
		gifRecordStart = Date.now();
        gifLength = 0;

		animatedGIF = new Animated_GIF({ workerPath: 'js/libs/Animated_GIF/quantizer.js' });
		animatedGIF.setSize(videoWidth, videoHeight);
		animatedGIF.setDelay(gifDelay);
		animatedGIF.setRepeat(1);
		addFrameToGIF();
	}

	function addFrameToGIF() {
        console.log('add frame');
		animatedGIF.addFrame(canvas);
        gifLength += gifDelay;

		if(gifLength < gifMaxLength) {
			recordGIFTimeout = setTimeout(addFrameToGIF, gifDelay);
		} else {
			stopRecording();
		}
	
	}
    

	function stopRecording() {
		clearTimeout(recordGIFTimeout);

        var btnRecord = document.getElementById('btn_record');

        animatedGIF.onRenderProgress(function(progress) {
            if(progress < 1) {
                btnRecord.value = 'Rendering ' + Math.floor(progress * 100) + '%';
            } else {
                btnRecord.value = progress;
            }
            console.log(progress);
        });
		
        animatedGIF.getBase64GIF(function(gifData) {

            var a = document.createElement('a');
            a.setAttribute('href', gifData);
            a.setAttribute('download', getTimestamp() + '.gif');

            // Apparently the download won't start unless the anchor element
            // is in the DOM tree
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            btnRecord.disabled = false;
            btnRecord.value = 'Record';

        });
	}

	function updateTexture(texture, video) {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	function render() {
		requestAnimationFrame( render );

		if( video.readyState === video.HAVE_ENOUGH_DATA ) {
			updateTexture(texture, video);
		}

		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.clearColor(1.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		mat4.ortho(pMatrix, -1, 1, -1, 1, 0.1, 1000);
		
        mat4.identity(mvMatrix);
		mat4.translate(mvMatrix, mvMatrix, [0.0, 0.0, -1.0]);

		// For TESTING only 
		// activeEffect = effects[ Math.floor(effects.length * Math.random()) ];
		activeEffect.enable(gl);
		
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);

		gl.uniform1i(activeEffect.uniforms.map.id, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
		gl.vertexAttribPointer(activeEffect.attributes.uv.id, uvBuffer.itemSize, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
		gl.vertexAttribPointer(activeEffect.attributes.position.id, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		
		gl.uniformMatrix4fv(activeEffect.uniforms.projectionMatrix.id, false, pMatrix);
		gl.uniformMatrix4fv(activeEffect.uniforms.modelViewMatrix.id, false, mvMatrix);
        
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexPositionBuffer.numItems);

		activeEffect.disable(gl);
		
	}
	
})();
