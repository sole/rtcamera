// Heavily inspired by http://wowmotty.blogspot.com/2011/10/adding-swipe-support.html
// but not using jQuery
var Swipable = function() {

	var proto = Swipable.prototype;

    this.startX = 0;
    this.startTime = 0;
    
	this.onSwipeLeftCb = function() {};
	this.onSwipeRightCb = function() {};

	this.onSwipeLeft = proto.onSwipeLeft;
	this.onSwipeRight = proto.onSwipeRight;

	this.addEventListener(proto.START_EVENT, proto.onStartCallback.bind(this));
	this.addEventListener(proto.END_EVENT, proto.onEndCallback.bind(this));
	this.addEventListener(proto.MOVE_EVENT, proto.onMoveCallback.bind(this));
};

Swipable.prototype.maxTime = 1000;
Swipable.prototype.maxDistance = 50;

Swipable.prototype.touch = document.ontouchend !== undefined;

Swipable.prototype.START_EVENT = Swipable.prototype.touch ? 'touchstart' : 'mousedown';
Swipable.prototype.MOVE_EVENT = Swipable.prototype.touch ? 'touchmove' : 'mousemove';
Swipable.prototype.END_EVENT = Swipable.prototype.touch ? 'touchend' : 'mouseup';

Swipable.prototype.onStartCallback = function(e) {
	e.preventDefault();
	this.startTime = e.timeStamp;
	this.startX = e.touches ? e.touches[0].pageX : e.pageX;
};

Swipable.prototype.onEndCallback = function(e) {
	this.startTime = 0;
	this.startX = 0;
};

Swipable.prototype.onMoveCallback = function(e) {

	e.preventDefault();
	
	var currentX = e.touches ? e.touches[0].pageX : e.pageX,
		currentDistance = (this.startX === 0) ? 0 : Math.abs(currentX - this.startX),
		currentTime = e.timeStamp;

	if (
			this.startTime !== 0 && 
			currentTime - this.startTime < Swipable.prototype.maxTime && 
			currentDistance > Swipable.prototype.maxDistance
	) {
		if (currentX < this.startX) {
			this.onSwipeLeftCb();
		} else if (currentX > this.startX) {
			this.onSwipeRightCb();
		}
		this.startTime = 0;
		this.startX = 0;
	}

};

Swipable.prototype.onSwipeLeft = function(callback) {
	this.onSwipeLeftCb = callback;
};

Swipable.prototype.onSwipeRight = function(callback) {
	this.onSwipeRightCb = callback;
};
