// do the require.js dance
define(['hammer', 'Renderer', 'gumHelper', 'Picture'], function(Hammer, Renderer, gumHelper, Picture) {
    
    'use strict';

    var App = function(errorCallback, readyCallback) {

        var that = this;
        var pages = {};
        var activePage = null;
        var btnGallery;
        var btnCamera;
        var switchVideo;
        var flasher;
        var ghostBitmap;
        var ghostCanvas;

        var galleryContainer;
        var galleryPictures = {};

        var renderer;
        var animationFrameId = null;
        var inputElement = null;
        var inputWidth = 320;
        var inputHeight = 240;
        var liveStreaming = false;
        var rendering = false;
        var outputImageNeedsUpdating = false;
        var video = null;

        initUI();

        renderer = new Renderer(errorCallback, function() {

            Hammer(document)
                .on('hold', onHold)
                .on('release', onRelease)
                .on('swipeleft', previousEffect)
                .on('swiperight', nextEffect);
            readyCallback();

        });


        /**
         * Find UI elements and attach events to them
         */
        function initUI() {

            pages = {};
            ['gallery', 'detail', 'camera', 'pickFile'].forEach(function(id) {
                var page = document.getElementById(id);
                pages[id] = page;
            });


            flasher = document.getElementById('flasher');
            
            function onFlasherAnimationEnd() {

                flasher.classList.remove('on_animation');
                
                var canvas = renderer.domElement;
                ghostCanvas.width = canvas.width;
                ghostCanvas.height = canvas.height;

                var ctx = ghostCanvas.getContext('2d');
                ctx.drawImage(ghostBitmap, 0, 0);

                setTimeout(function() {
                    ghostCanvasContainer.classList.add('faded_out');
                }, 10);

            }

            // Canvas for the preview, flasher, ghost canvas ---

            flasher.addEventListener('animationend', onFlasherAnimationEnd, false);
            flasher.addEventListener('webkitAnimationEnd', onFlasherAnimationEnd, false);

            ghostCanvas = document.createElement('canvas');
            
            var ghostCanvasContainer = document.getElementById('ghostCanvasContainer');
            ghostCanvasContainer.appendChild(ghostCanvas);
            ghostCanvasContainer.addEventListener('transitionend', function() {
                ghostCanvas.getContext('2d').clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
                ghostCanvasContainer.classList.remove('faded_out');
            }, false);


            // Gallery ---

            galleryContainer = document.querySelector('#gallery > div');
            // We'll be using 'event delegation' to avoid having to update listeners
            // if pictures are deleted
            galleryContainer.addEventListener('click', function(ev) {

                /* TODO var target = ev.target;
                if(target && target.nodeName === 'IMG') {
                    showDetails(target.dataset['id']);
                } else {
                    closeDetails();
                }*/

            }, false);


            btnGallery = document.getElementById('btnGallery');
            btnGallery.addEventListener('click', gotoGallery, false);


            btnCamera = document.getElementById('btnCamera');
            btnCamera.addEventListener('click', gotoCamera, false);


            // Hide the camera button is there's likely no support for WebRTC
            if(!navigator.getMedia) {
                hideCameraButton();
            }


            switchVideo = document.getElementById('switchVideo');


            document.getElementById('btnPicker').addEventListener('click', gotoStatic, false);

        }

        function onResize() {

            var w = window.innerWidth;
            var h = window.innerHeight;
            var canvasWidth = inputWidth;
            var canvasHeight = inputHeight;

            var scaleX = w / canvasWidth;
            var scaleY = h / canvasHeight;
            var scaleToFit = Math.min(scaleX, scaleY);

            canvasWidth = (canvasWidth * scaleToFit) | 0 ;
            canvasHeight = (canvasHeight * scaleToFit) | 0;

            if(renderer) {
                renderer.setSize(canvasWidth, canvasHeight);
            }

        }


        function onHold(ev) {
            
            if(rendering) {
                return;
            }

            console.log('hold');

            if(switchVideo.checked) {
                startVideoRecording();
            } else {
                takePicture();
            }

        }


        function onRelease(ev) {
            console.log('release', ev);
            
            if(switchVideo.checked) {
                pauseVideoRecording();
            }
        }



        function showPage(id) {

            if(id !== 'gallery') {
                btnGallery.classList.remove('hidden');
            } else {
                btnGallery.classList.add('hidden');
            }

            activePage = id;

            pages[id].show();

        }


        function hideCameraButton() {
            btnCamera.style.display = 'none';
        }


        function enableCamera(errorCallback, okCallback) {

            gumHelper.startVideoStreaming(function() {
                // Error!
                hideCameraButton();
                // TODO: show error, and on OK => gotoGallery

            }, function(stream, videoElement, width, height) {
                video = videoElement;
                liveStreaming = true;
                changeInputTo(videoElement, width, height);
                render();
            });

        }


        function disableCamera() {
            gumHelper.stopVideoStreaming();
        }


        function changeInputTo(element, width, height) {
            inputElement = element;

            inputWidth = width;
            inputHeight = height;

            onResize();
        }


        function detachRendererCanvas() {
            var canvas = renderer.domElement;
            if(canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }

        function attachRendererCanvas() {
            var container = document.getElementById('canvasContainer');
            var canvas = renderer.domElement;
            
            container.appendChild(canvas);
        }


        // TODO maybe this.renderer.isPaused()
        function usingTheRenderer() {
            return activePage === 'camera' || activePage === 'pickFile';
        }


        function previousEffect() {
            if(usingTheRenderer()) {
                renderer.previousEffect();
            }
        }


        function nextEffect() {
            if(usingTheRenderer()) {
                renderer.nextEffect();
            }
        }

        // Save static image
        function takePicture() {

            var bitmapData = renderer.domElement.toDataURL();

            saveLocalPicture(bitmapData, false);

        }

        function startVideoRecording() {
            console.log('start recording TODO');
        }

        function pauseVideoRecording() {
            console.log('pause TODO');
        }

        
        // data == base64 dataURL 
        function saveLocalPicture(data, isAnimated) {
            
            var picture = new Picture();
            picture.imageData = data;
            picture.imageIsAnimated = isAnimated;

            picture.save(function() {

                ghostBitmap = document.createElement('img');
                ghostBitmap.src = data;

                flasher.classList.add('on_animation');

            });
            
        }



        function requestAnimation() {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(render);
        }


        function render() {
            requestAnimation();

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


        function gotoGallery() {
            detachRendererCanvas();
            disableCamera();
            showPage('gallery');

            Picture.getAll(function(pictures) {
                galleryContainer.innerHTML = '';

                // Show most recent pictures first
                pictures.reverse();

                var numPictures = pictures.length;
                galleryPictures = {};

                console.log(numPictures);

                if(false && numPictures) {

                    galleryContainer.classList.remove('empty');

                    pictures.forEach(function(pic, position) {

                        pic.previousPicture = position > 0 ? pictures[position - 1] : null;
                        pic.nextPicture = position < numPictures - 1 ? pictures[position + 1] : null;
                        galleryPictures[pic.id] = pic;

                        var div = document.createElement('div');
                        div.style.backgroundImage = 'url(' + pic.imageData + ')';
                        galleryContainer.appendChild(div);

                    });

                } else {

                    galleryContainer.classList.add('empty');
                    galleryContainer.innerHTML = '<p>No pictures (yet)</p>';

                }

            });
        }


        function gotoDetail() {
            detachRendererCanvas();
            showPage('detail');
        }


        function gotoCamera() {
            enableCamera();
            attachRendererCanvas();
            showPage('camera');
        }


        function gotoStatic() {
            // To delete the last image from the renderer, we set an empty
            // canvas as input element.
            var emptyCanvas = document.createElement('canvas');
            changeInputTo(emptyCanvas, inputWidth, inputHeight);

            attachRendererCanvas();
            showPage('pickFile');
        }

        // 'Public' methods

        this.gotoGallery = gotoGallery;
        this.gotoDetail = gotoDetail;
        this.gotoCamera = gotoCamera;
        this.gotoStatic = gotoStatic;

    };

    return App;
});
