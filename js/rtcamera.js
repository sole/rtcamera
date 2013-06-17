(function() {

    'use strict';

    window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    navigator.getMedia = ( navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia
    );

    // ---

    var video = null;
    var videoWidth;
    var videoHeight;
    var webcamStream = null;
    var canvas;
    var shiftBox;
    var btnMenu;
    var aside;
    var videoControls;
    var videoProgressBar;
    var videoProgressSpan;
    var btnVideoCancel;
    var btnVideoDone;
    var modeToggle;
    var renderer;
    var animatedGIF = null;
    var gifDelay = 100;
    var gifLength = 0;
    var gifMaxLength = 2000;
    var gifRecordStart;
    var recordGIFTimeout = null;
    var rendering = false;
    var MODE_STATIC = 'static';
    var MODE_VIDEO = 'video';
    var mode;
    var TRANSITION_LENGTH = 500;
    var attempts = 0;

    if (navigator.getMedia) {

        video = document.createElement('video');
        video.autoplay = true;

        video.addEventListener('loadeddata', function readyListener(event) {

            findVideoSize();

            function findVideoSize() {

                if(video.videoWidth > 0 && video.videoHeight > 0) {

                    video.removeEventListener('loadeddata', readyListener);
                    init(video.videoWidth, video.videoHeight);

                } else {

                    if(attempts < 10) {
                        attempts++;
                        setTimeout(findVideoSize, 200);
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
    //});

    function reportError(message) {

        var error = document.createElement('div');
        error.className = 'modal error';

        if(typeof message === 'string') {

            error.innerHTML = message.replace(/\n/g, '<br />');

        } else {

            var txt = 'Error trying to access the camera.<br /><br />Are you trying to run this locally?';
            if(message.code) {
                txt += '<br /><br />(Error code = ' + message.code + ')';
            }
            
            error.innerHTML = txt;

        }
        
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

        canvas = document.createElement('canvas');
        canvas.classList.add('modal');

        try {

            renderer = new Renderer(canvas, reportError, function() {
          
                // Display the UI after a while-as WebGL takes a bit to set up,
                // and it's weird to see interface elements over a black screen...
                setTimeout(initUI, 200);

                render();

            });
            
        } catch(e) {

            reportError(e.message);

        }

    }

    function initUI() {

        var controls = Array.prototype.slice.call(document.querySelectorAll('.controls'));
        controls.forEach(show);

        videoControls = document.getElementById('video_controls');
        videoProgressBar = document.querySelector('progress');
        videoProgressSpan = document.getElementById('progress_label');
        btnVideoCancel = document.getElementById('btn_cancel');
        btnVideoDone = document.getElementById('btn_done');
        modeToggle = document.getElementById('mode_toggle');
        btnMenu = document.getElementById('menu');
        shiftBox = document.querySelector('x-shiftbox');
        aside = document.querySelector('aside');


        // Set up listeners

        window.addEventListener('resize', onResize, false);
        onResize();

        // Adding the canvas once it's been resized first
        document.getElementById('canvasContainer').appendChild(canvas);

        btnVideoCancel.addEventListener('click', cancelVideoRecording, false);
        btnVideoDone.addEventListener('click', finishVideoRecording, false);

        modeToggle.addEventListener('change', function(ev) {

            console.log('change', ev, this.checked);
            setMode( this.checked ? MODE_STATIC : MODE_VIDEO );

        }, false); 


        // Set up 'gestures' using Hammer touch library (HA HA)
        Hammer(canvas, { hold_timeout: 300 })
            .on('release', onRelease)
            .on('hold', onHold)
            .on('swipeleft', prevEffect)
            .on('swiperight', nextEffect);

        setMode(MODE_STATIC); // TMP
        //setMode(MODE_VIDEO);

        // Set up the app menu
        btnMenu.addEventListener('click', function() {
            console.log('click');
            if(shiftBox.hasAttribute('open')) {
                shiftBox.removeAttribute('open');
            } else {
                shiftBox.setAttribute('open');
            }
        }, false);

        aside.addEventListener('click', function() {
            shiftBox.removeAttribute('open');
        }, false);

        // Show "swipe left or right to change effect" instructions text
        // TODO: maybe do it only once? on the first run?
        setTimeout(function() {

            show(document.getElementById('instructions'));

            setTimeout(function() {

                hide(instructions);
                show(btnMenu);

            }, 3000);

        }, TRANSITION_LENGTH);

    }

    function onResize() {

        var w = window.innerWidth;
        var h = window.innerHeight;
        var canvasWidth = videoWidth;
        var canvasHeight = videoHeight;

        // constrain canvas size to be <= window size, and maintain proportions
        while(canvasWidth > w || canvasHeight > h) {

            canvasWidth /= 2;
            canvasHeight /= 2;

        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        renderer.setSize(canvasWidth, canvasHeight);

        // And then reescale it up with CSS style
        var scaleX = w / canvasWidth;
        var scaleY = h / canvasHeight;
        var scaleToFit = Math.min(scaleX, scaleY);

        scaleToFit |= 0;

        canvas.style.width = (canvasWidth * scaleToFit) + 'px';
        canvas.style.height = (canvasHeight * scaleToFit) + 'px';

    }

    function hide(element, transitionLength) {

        transitionLength = transitionLength || TRANSITION_LENGTH;
        element.style.opacity = 0;

        setTimeout(function() {

            element.style.display = 'none';

        }, transitionLength);

    }

    function show(element) {

        element.style.display = 'block';

        setTimeout(function() {

            element.style.opacity = 1;

        }, 1);

    }

    function prevEffect() {

        renderer.prevEffect();

    }

    function nextEffect() {

        renderer.nextEffect();

    }

    function onHold() {

        if(rendering) {
            return;
        }

        if(mode === MODE_STATIC) {
            takePicture();
        } else {
            startVideoRecording();
        }

    }

    function onRelease() {

        if(mode === MODE_VIDEO) {
            pauseVideoRecording();
        }
    
    }

    function setMode(newMode) {

        var toggle = document.getElementById('mode_toggle');
        var videoControls = document.getElementById('video_controls');

        if(newMode === MODE_STATIC) {

            hide(videoControls);
            animatedGIF = null;
            toggle.checked = true;

        } else {

            toggle.checked = false;

        }

        mode = newMode;

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
            pad(now.getMonth() + 1), // months are 0 based!
            pad(now.getDate()),
            '_',
            pad(now.getHours()),
            pad(now.getMinutes()),
            pad(now.getSeconds())
        ];
        var timestamp = parts.join('');

        return timestamp;

    }


    // data == base64 dataURL 
    function saveLocalPicture(data, isAnimated) {
        
        var picture = new Picture();
        picture.imageData = data;
        picture.imageIsAnimated = isAnimated;

        picture.save(function() {

            // TODO: flash and translate to the right

            asyncStorage.length(function(value) {
                console.log('asyncstorage length?', value);
            });

        });
        
    }

    // Save static image
    function takePicture() {

        var bitmapData = canvas.toDataURL();

        saveLocalPicture(bitmapData, false);

    }

    // Starts capturing video
    function startVideoRecording() {

        // We might already have a half-way recorded video
        if(!animatedGIF) {

            gifRecordStart = Date.now();
            gifLength = 0;

            videoControls.classList.remove('rendering');
            videoProgressBar.value = 0;

            show(videoControls);

            animatedGIF = new Animated_GIF({ workerPath: 'js/libs/Animated_GIF/quantizer.js' });
            animatedGIF.setSize(canvas.width, canvas.height);
            animatedGIF.setDelay(gifDelay);
            animatedGIF.setRepeat(0);

        }

        addFrameToGIF();

    }

    function pauseVideoRecording() {

        clearTimeout(recordGIFTimeout);

    }

    function addFrameToGIF() {

        animatedGIF.addFrame(canvas);
        gifLength += gifDelay;

        if(gifLength < gifMaxLength && !animatedGIF.isRendering()) {

            var recordProgress = gifLength * 1.0 / gifMaxLength;
            videoProgressBar.value = recordProgress;
            videoProgressSpan.innerHTML = Math.floor(gifLength / 10) / 100 + 's';

            recordGIFTimeout = setTimeout(addFrameToGIF, gifDelay);

        } else {

            finishVideoRecording();

        }

    }

    function finishVideoRecording() {

        clearTimeout(recordGIFTimeout);

        videoControls.classList.add('rendering');
        rendering = true;

        btnVideoCancel.disabled = true;
        btnVideoDone.disabled = true;

        videoProgressSpan.innerHTML = '<img src="/img/icons/spinner.gif">';

        animatedGIF.onRenderProgress(function(progress) {

            videoProgressSpan.innerHTML = 'rendering ' + Math.floor(progress * 100) + '%';
            videoProgressBar.value = progress;

        });

        animatedGIF.getBase64GIF(function(gifData) {
            saveLocalPicture(gifData, true);

            videoProgressSpan.innerHTML = '';
            hide(videoControls);

            btnVideoCancel.disabled = false;
            btnVideoDone.disabled = false;

            rendering = false;
            render();

            // we're done with this instance
            animatedGIF = null;

        });

    }

    function cancelVideoRecording() {

        clearTimeout(recordGIFTimeout);
        // TODO animatedGIF.reset();
        hide(videoControls);
        videoProgressBar.value = 0;
        animatedGIF = null;

    }

    function render() {

        if(!rendering) {
            requestAnimationFrame(render);
        }

        if( video.readyState === video.HAVE_ENOUGH_DATA ) {
            renderer.updateTexture(video);
        }

    }

})();
