
(function() {
	window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

	navigator.getMedia = ( navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia);

	// ---

	var video;
	var gl;
	var shaderProgram;
	var vertexPositionBuffer, uvBuffer, mvMatrix, pMatrix;
	var texture;

	if (navigator.getMedia) {

		// Call the getUserMedia method here
		video = document.createElement( 'video' );
		video.autoplay = true;

		var attempts = 0;

		video.addEventListener('loadeddata', function readyListener( event ) {
			
			check();

			function check() {

				if(video.videoWidth > 0 && video.videoHeight > 0) {
					init(video.videoWidth, video.videoHeight);
				} else {
					
					if(attempts < 10) {
						attempts++;
						setTimeout(check, 500);
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
			video.play();
		}, function (error) {
			// TODO handle
			console.log(error);
		});

	} else {
		// TODO handle
		console.log('Native device media streaming (getUserMedia) not supported in this browser.');
	}

	function init(width, height) {

		video.style.width = width + 'px';
		video.style.height = height + 'px';

		var canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		document.body.appendChild(canvas);

		gl = initWebGL(canvas);

		if (gl) {
			initWebGLBuffers();
			initTexture();
			initShaders();
			render();
		}
		
		document.body.appendChild(video);

	}

	function initWebGL(canvas) {

		var gl = null;

		try {
			gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
			gl.viewportWidth = canvas.width;
			gl.viewportHeight = canvas.height;
			
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);

		} catch(e) {}

		// If we don't have a GL context, give up now
		if (!gl) {
			alert("Unable to initialize WebGL. Your browser may not support it.");
		}

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
			return null;
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
			return null;
		}

		glContext.shaderSource(shader, str);
		glContext.compileShader(shader);

		if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
			alert(glContext.getShaderInfoLog(shader));
			return null;
		}

		return shader;
	}

	function initShaders() {

		var fragmentShader = getShader(gl, 'fs');
		var vertexShader = getShader(gl, 'vs');

		shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			alert('Could not initialise shaders');
		}

		gl.useProgram(shaderProgram);

		shaderProgram.projectionMatrixUniform = gl.getUniformLocation(shaderProgram, 'projectionMatrix');
		shaderProgram.modelViewMatrixUniform = gl.getUniformLocation(shaderProgram, 'modelViewMatrix');
		shaderProgram.mapUniform = gl.getUniformLocation(shaderProgram, 'map');
		shaderProgram.uvAttribute = gl.getAttribLocation(shaderProgram, 'uv');
		shaderProgram.positionAttribute = gl.getAttribLocation(shaderProgram, 'position');
		
		gl.enableVertexAttribArray(shaderProgram.uvAttribute);
		gl.enableVertexAttribArray(shaderProgram.positionAttribute);
	}

	function updateTexture(texture, video) {
		
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	function render() {

		if( video.readyState === video.HAVE_ENOUGH_DATA ) {
			updateTexture(texture, video);
		}

		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.clearColor(1.0, 0.0, 0.0, 1.0);
		
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		mat4.ortho(pMatrix, -1, 1, -1, 1, 0.1, 1000);
		
        mat4.identity(mvMatrix);

		mat4.translate(mvMatrix, mvMatrix, [0.0, 0.0, -1.0]);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(shaderProgram.mapUniform, 0);
	
		gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
		gl.vertexAttribPointer(shaderProgram.uvAttribute, uvBuffer.itemSize, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
		gl.vertexAttribPointer(shaderProgram.positionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		
		gl.uniformMatrix4fv(shaderProgram.projectionMatrixUniform, false, pMatrix);
		gl.uniformMatrix4fv(shaderProgram.modelViewMatrixUniform, false, mvMatrix);

        
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexPositionBuffer.numItems);
	}

})();
