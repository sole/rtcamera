// A wrapper around antimatter15's jsgif library
// by sole / http://soledadpenades.com
// See it live at http://lab.soledadpenades.com/js/animated_gif/
var Animated_GIF = Animated_GIF || function() {
	var width = 160, height = 120, canvas = null, ctx = null, encoder, repeat = null, delay = 250;

	this.setSize = function(w, h) {
		width = w;
		height = h;
		canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		ctx = canvas.getContext('2d');
	};
	
	this.setDelay = function(d) {
		delay = d;
	};

	this.setRepeat = function(r) {
		repeat = r;
	};

	this.addFrameImage = function(img) {
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		encoder.addFrame(ctx);
	};

	this.addFrameContext = function(ctx) {
		encoder.addFrame(ctx);
	};

	this.reset = function() {
		encoder = new GIFEncoder();
		if(repeat !== null) {
			encoder.setRepeat(repeat);
		}
		encoder.setDelay(delay);
		encoder.start();
	};

	this.getGIF = function() {
		encoder.finish();
		return encoder.stream().getData();
	};

	this.getB64GIF = function() {
		return 'data:image/gif;base64,' + btoa(this.getGIF());
	};

	this.setSize(100, 100);
	this.reset();
};

