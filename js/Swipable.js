// Heavily inspired by http://wowmotty.blogspot.com/2011/10/adding-swipe-support.html
// but not using jQuery

/**
 * This function adds the "Swipable" behaviour to any DOM element
 * To use, just do Swipable.call(element).
 * This will set up the required listeners on the element, but nothing will actually
 * happen on swipes until you configure the left and/or right callbacks on the object.
 * For example:
 *
 * element.onSwipeLeft(function() {
 *      alert('swipe left');
 * });
 * element.onSwipeRight(function() {
 *      alert('swipe right');
 * });
 *
 */
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
Swipable.prototype.minDistance = 50;

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

/**
 * When moving, we'll have a look at the distance the finger/cursor travelled since the 
 * initial event happened (in onStartCallback).
 * If the distance is more than minDistance and occured in less than maxTime,
 * it's a swipe. We then need to find out which type of swipe: left or right.
 *
 * That is done by comparing the current pointer X position (currentX) with the initial 
 * pointer X position (startX).
 *
 * If currentX is less than startX, then the finger has moved left of the original point,
 * so it's a swipe left (the coordinate system goes from 0 to screen width in the X axis).
 *
 * Likewise, if currentX is more than startX, it's a swipe right.
 */
Swipable.prototype.onMoveCallback = function(e) {

    e.preventDefault();

    var currentX = e.touches ? e.touches[0].pageX : e.pageX,
        currentDistance = (this.startX === 0) ? 0 : Math.abs(currentX - this.startX),
        currentTime = e.timeStamp;

    if (
        this.startTime > 0 && 
        currentTime - this.startTime < Swipable.prototype.maxTime && 
        currentDistance > Swipable.prototype.minDistance
    ) {
        if (currentX < this.startX) {
            this.onSwipeLeftCb();
        } else {
            this.onSwipeRightCb();
        }
        this.startTime = 0;
        this.startX = 0;
    }

};

/**
 * Set the function to be called when a swipe left happens
 */
Swipable.prototype.onSwipeLeft = function(callback) {
    this.onSwipeLeftCb = callback;
};

/**
 * Set the function to be called when a swipe right happens
 */
Swipable.prototype.onSwipeRight = function(callback) {
    this.onSwipeRightCb = callback;
};
