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
            Hammer(canvas)
                .on('swipeleft', renderer.previousEffect)
                .on('swiperight', renderer.nextEffect);
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
            btnGallery.addEventListener('click', that.gotoGallery, false);

            btnCamera = document.getElementById('btnCamera');
            btnCamera.addEventListener('click', that.gotoCamera, false);

            // Hide the camera button is there's likely no support for WebRTC
            if(!navigator.getMedia) {
                hideCameraButton();
            }


            document.getElementById('btnPicker').addEventListener('click', that.gotoStatic, false);

        }

        function onResize() {

            var w = window.innerWidth;
            var h = window.innerHeight;
            var canvasWidth = inputWidth;
            var canvasHeight = inputHeight;

            /*// constrain canvas size to be <= window size, and maintain proportions
            while(canvasWidth > w || canvasHeight > h) {

                canvasWidth /= 2;
                canvasHeight /= 2;

            }*/
            var scaleX = w / canvasWidth;
            var scaleY = h / canvasHeight;
            var scaleToFit = Math.min(scaleX, scaleY);

            console.log(scaleToFit, scaleToFit | 0);

            canvasWidth = (canvasWidth * scaleToFit) | 0 ;
            canvasHeight = (canvasHeight * scaleToFit) | 0;

            if(renderer) {
                renderer.setSize(canvasWidth, canvasHeight);
            }

            // make canvas dimensions fit the screen
            // set renderer size to new canvas dimensions
            // when recording video -> resize down if larger than x,y

            // And then reescale it up with CSS style
            /*var scaleX = w / canvasWidth;
            var scaleY = h / canvasHeight;
            var scaleToFit = Math.min(scaleX, scaleY);

            scaleToFit |= 0;

            if(canvas) {

                canvas.width = canvasWidth;
                canvas.height = canvasHeight;

                canvas.style.width = (canvasWidth * scaleToFit) + 'px';
                canvas.style.height = (canvasHeight * scaleToFit) + 'px';

            }*/

        }


        function showPage(id) {

            if(id !== 'gallery') {
                btnGallery.classList.remove('hidden');
            } else {
                btnGallery.classList.add('hidden');
            }

            if(id !== 'camera') {
                disableCamera();
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


        function attachRendererCanvasToPage(pageId) {
            // TODO canvas behind pages?
            var container = pages[pageId].querySelector('.canvasContainer');
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


        // 'Public' methods

        this.gotoGallery = function() {
            showPage('gallery');
        };


        this.gotoDetail = function() {
            showPage('detail');
        };


        this.gotoCamera = function() {
            attachRendererCanvasToPage('camera');
            enableCamera();
            showPage('camera');
        };


        this.gotoStatic = function() {
            attachRendererCanvasToPage('pickFile');
            showPage('pickFile');
        };


    };

    return App;
});
