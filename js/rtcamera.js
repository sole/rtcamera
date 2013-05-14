
(function() {
	window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

	navigator.getMedia = ( navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia);

	// ---

	var video;
	var gl;

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
			console.log(error);
		});

	} else {
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
			gl.clearColor(1.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
			gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
			gl.depthFunc(gl.LEQUAL);                                // Near things obscure far things
			gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);      // Clear the color as well as the depth buffer.
		}

		document.body.appendChild(video);

	}

	function initWebGL(canvas) {

		var gl = null;

		try {
			gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
		} catch(e) {}

		// If we don't have a GL context, give up now
		if (!gl) {
			alert("Unable to initialize WebGL. Your browser may not support it.");
		}

		return gl;

	}

})();
