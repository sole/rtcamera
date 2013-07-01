// do the require.js dance
define(['hammer', 'Renderer', 'gumHelper'], function(Hammer, Renderer, gumHelper) {
    
    'use strict';

    var App = function(errorCallback, readyCallback) {

        var that = this;
        var pages = {};
        var activePage = null;
        var btnGallery;
        var btnCamera;
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

            var canvas = renderer.domElement;
            Hammer(document)
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

            btnGallery = document.getElementById('btnGallery');
            btnGallery.addEventListener('click', gotoGallery, false);

            btnCamera = document.getElementById('btnCamera');
            btnCamera.addEventListener('click', gotoCamera, false);

            // Hide the camera button is there's likely no support for WebRTC
            if(!navigator.getMedia) {
                hideCameraButton();
            }


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
