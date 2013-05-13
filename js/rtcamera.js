
window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

navigator.getMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);

// ---


if (navigator.getMedia) {

	// Call the getUserMedia method here
	var video = document.createElement( 'video' );
	video.autoplay = true;

	video.addEventListener('loadedmetadata', function ( event ) {
		document.body.appendChild(video);
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


