(function() {

    'use strict';

    var video = null;
    var videoWidth;
    var videoHeight;
    var cameraStream = null;
    var canvas;
    var ghostCanvas;
    var ghostBitmap;
    var flasher;
    var filePicker;
    var shiftBox;
    var btnMenu;
    var aside;
    var videoControls;
    var videoProgressBar;
    var videoProgressDiv;
    var videoProgressSpan;
    var btnVideoCancel;
    var btnVideoDone;
    var modeToggle;
    var btnVideo;
    var btnStatic;
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
    var liveStreamPossible = false;
    var liveStreaming = false;
    var outputImageNeedsUpdating = false;
    var inputElement;
    var animationFrameId = null;

    init();

    // ---

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

        gumHelper.stopVideoStreaming();

    }


    function init() {

        initUI();

        try {
        
            renderer = new Renderer(canvas, reportError, function() {

                setMode(MODE_STATIC);

                gumHelper.startVideoStreaming(function(error) {

                    // No getUserMedia support, so using "basic" experience

                    disableLiveStreamingOptions();
                    showUI();
                    showNoLiveStreamInfoScreen();

                }, function(stream, videoElement, width, height) {

                    // getUserMedia, yay!

                    video = videoElement;
                    liveStreamPossible = true;
                    liveStreaming = true;
                    changeInputTo(videoElement, width, height);
                    render();
                    showUI();

                });

            });

        } catch(e) {

            reportError(e.message);

        }

    }


    function initUI() {

        videoControls = document.getElementById('video_controls');
        videoProgressBar = document.querySelector('progress');
        videoProgressDiv = document.getElementById('progress_label');
        videoProgressSpan = videoProgressDiv.querySelector('span');
        btnVideoCancel = document.getElementById('btn_cancel');
        btnVideoDone = document.getElementById('btn_done');
        flasher = document.getElementById('flasher');
        filePicker = document.getElementById('filePicker');
        ghostCanvas = document.createElement('canvas');
        modeToggle = document.getElementById('mode_toggle');
        btnVideo = document.getElementById('btnVideo');
        btnStatic = document.getElementById('btnStatic');
        btnMenu = document.getElementById('menuButton');
        shiftBox = document.querySelector('x-shiftbox');
        aside = document.querySelector('aside');


        window.addEventListener('resize', onResize, false);

        canvas = document.createElement('canvas');
        canvas.classList.add('modal');
        document.getElementById('canvasContainer').appendChild(canvas);


        function onFlasherAnimationEnd() {

            flasher.classList.remove('on_animation');
            animateGhostPicture(ghostBitmap);

        }

        flasher.addEventListener('animationend', onFlasherAnimationEnd, false);
        flasher.addEventListener('webkitAnimationEnd', onFlasherAnimationEnd, false);


        var filePickerMenuOption = document.getElementById('pickImageOption');
        filePickerMenuOption.addEventListener('click', function() {
            openFilePicker();
        }, false);

        var filePickerInput = filePicker.querySelector('input');
        filePickerInput.addEventListener('change', onFilePicked, false);


        var ghostCanvasContainer = document.getElementById('ghostCanvasContainer');
        ghostCanvasContainer.appendChild(ghostCanvas);
        ghostCanvasContainer.addEventListener('transitionend', function() {
            ghostCanvas.getContext('2d').clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
            ghostCanvasContainer.classList.remove('faded_out');
        }, false);


        btnVideoCancel.addEventListener('click', cancelVideoRecording, false);
        btnVideoDone.addEventListener('click', finishVideoRecording, false);

        modeToggle.addEventListener('change', function(ev) {

            setMode( this.checked ? MODE_VIDEO : MODE_STATIC );

        }, false); 

        btnVideo.addEventListener('click', function() {

            modeToggle.checked = true;
            setMode(MODE_VIDEO);

        }, false);

        btnStatic.addEventListener('click', function() {

            modeToggle.checked = false;
            setMode(MODE_STATIC);

        }, false);


        // Set up 'gestures' using Hammer touch library (HA HA)
        Hammer(canvas, { hold_timeout: 300 })
            .on('release', onRelease)
            .on('hold', onHold)
            .on('swipeleft', prevEffect)
            .on('swiperight', nextEffect);
        
        // Set up the app menu
        btnMenu.addEventListener('click', function() {
            if(shiftBox.hasAttribute('open')) {
                shiftBox.removeAttribute('open');
            } else {
                shiftBox.setAttribute('open');
            }
        }, false);

        aside.addEventListener('click', function(ev) {
            var target = ev.target;
            if(target && target.nodeName === 'LI') {
                var a = target.querySelector('a');
                a.click();
            } else {
                shiftBox.removeAttribute('open');
            }
        }, false);

    }


    function showNoLiveStreamInfoScreen() {
    }


    function disableLiveStreamingOptions() {
    }


    function showUI() {

        var controls = Array.prototype.slice.call(document.querySelectorAll('.controls'));
        var instructions = document.getElementById('instructions');

        controls.forEach(show);
        show(instructions);

        setTimeout(function() {

            show(btnMenu);
            hide(instructions);

        }, 3000);

    }


    function changeInputTo(newInputElement, width, height) {

        inputElement = newInputElement;

        videoWidth = width;
        videoHeight = height;

        onResize();

    }


    function onResize() {

        var w = window.innerWidth;
        var h = window.innerHeight;
        var canvasWidth = videoWidth; // TODO videoWidth -> inputWidth, etc
        var canvasHeight = videoHeight;

        // constrain canvas size to be <= window size, and maintain proportions
        while(canvasWidth > w || canvasHeight > h) {

            canvasWidth /= 2;
            canvasHeight /= 2;

        }


        if(renderer) {

            renderer.setSize(canvasWidth, canvasHeight);

        }

        // And then reescale it up with CSS style
        var scaleX = w / canvasWidth;
        var scaleY = h / canvasHeight;
        var scaleToFit = Math.min(scaleX, scaleY);

        scaleToFit |= 0;

        if(canvas) {

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            canvas.style.width = (canvasWidth * scaleToFit) + 'px';
            canvas.style.height = (canvasHeight * scaleToFit) + 'px';

        }

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


    function openFilePicker() {

        filePicker.removeAttribute('hidden');

    }


    function onFilePicked(ev) {

        filePicker.setAttribute('hidden');

        gumHelper.stopVideoStreaming();

        var files = this.files;

        if(files.length > 0 && files[0].type.indexOf('image/') === 0) {
            
            // get data from picked file
            // put that into an element
            var file = files[0];
            var img = document.createElement('img');

            img.src = window.URL.createObjectURL(file);
            img.onload = function() {
                window.URL.revokeObjectURL(this.src); // TODO maybe too early?

                changeInputTo(img, img.width, img.height);

                outputImageNeedsUpdating = true;
                render();
            };

        }

    }


    function prevEffect() {

        outputImageNeedsUpdating = true;
        renderer.prevEffect();
        requestAnimation();

    }

    function nextEffect() {

        outputImageNeedsUpdating = true;
        renderer.nextEffect();
        requestAnimation();

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
            toggle.checked = false;

        } else {

            toggle.checked = true;

        }

        mode = newMode;

    }

  
    // data == base64 dataURL 
    function saveLocalPicture(data, isAnimated) {
        
        var picture = new Picture();
        picture.imageData = data;
        picture.imageIsAnimated = isAnimated;

        picture.save(function() {

            flasher.classList.add('on_animation');

        });
        
    }

    
    // Save static image
    function takePicture() {

        var bitmapData = canvas.toDataURL();

        ghostBitmap = document.createElement('img');
        ghostBitmap.src = bitmapData;

        saveLocalPicture(bitmapData, false);

    }


    // Makes a copy of img onto the ghost canvas, and sets it to fade out
    // and translate to the right, using a CSS transition
    function animateGhostPicture(img) {
        
        ghostCanvas.width = canvas.width;
        ghostCanvas.height = canvas.height;
        ghostCanvas.classList.add('modal');

        var ctx = ghostCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        setTimeout(function() {
            ghostCanvasContainer.classList.add('faded_out');
        }, 10);

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
        modeToggle.disabled = true;
        btnVideo.disabled = true;
        btnStatic.disabled = true;

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
            modeToggle.disabled = false;
            btnVideo.disabled = false;
            btnStatic.disabled = false;

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


    function requestAnimation() {

        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);

    }


    function render() {

        if(liveStreaming) {

            if(!rendering) {

                requestAnimation();

            }

            if(video.readyState === video.HAVE_ENOUGH_DATA) {

                outputImageNeedsUpdating = true;

            }
        }

        if(outputImageNeedsUpdating) {

            renderer.updateTexture(inputElement);

            outputImageNeedsUpdating = false;

        }

    }

})();
