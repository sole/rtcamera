// do the require.js dance
define(['hammer', 'Renderer', 'gumHelper', 'Picture', 'Toast'], function(Hammer, Renderer, gumHelper, Picture, Toast) {
    
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

        var galleryDetails;
        var IMGUR_KEY = '49c42af902d1fd4';

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
            ['gallery', 'details', 'camera', 'pickFile'].forEach(function(id) {
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

                var target = ev.target;
                if(target && target.nodeName === 'DIV') {
                    showDetails(target.dataset['id']);
                } else {
                    closeDetails();
                }

            }, false);


            btnGallery = document.getElementById('btnGallery');
            btnGallery.addEventListener('click', gotoGallery, false);


            btnCamera = document.getElementById('btnCamera');
            btnCamera.addEventListener('click', gotoCamera, false);


            // Hide the camera button is there's likely no support for WebRTC
            if(!navigator.getMedia) {
                hideCameraButton();
            }

            document.getElementById('btnPicker').addEventListener('click', gotoStatic, false);

            // Picture details ---

            galleryDetails = document.querySelector('#details > div');

            // Camera ---

            switchVideo = document.getElementById('switchVideo');


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

        /**
         * Returns a picture from the galleryPictures hash. updateGallery must be called at
         * least once before calling this one for the galleryPictures object to be filled in
         */
        function getPictureById(pictureId) {
            return galleryPictures[pictureId];
        }


        /**
         * Display the selected picture and allow to perform actions over it too
         * If the picture has already been shared to imgur, it will show the url of the
         * picture in imgur
         */
        function showDetails(pictureId) {

            // TODO store current url
            gotoDetails();

            galleryDetails.innerHTML = 'Loading...';

            var picture = getPictureById(pictureId);
            var img = document.createElement('img');
            img.src = picture.imageData;

            // TODO: this is somehow buggy on Firefox. Must investigate.
            Hammer(img)
                .on('swiperight', function(ev) {
                    ev.gesture.preventDefault();
                    showPrevPicture(pictureId);
                })
                .on('swipeleft', function(ev) {
                    ev.gesture.preventDefault();
                    showNextPicture(pictureId);
                });

            
            var idDiv = document.createElement('div');
            idDiv.innerHTML = pictureId;


            var actions = [
                { text: 'Share with imgur', action: uploadPicture },
                /*{ text: 'Download', action: downloadPicture },
                { text: 'Delete', action: deletePicture }*/
            ];

            var actionsDiv = document.createElement('div');
            actionsDiv.id = 'actions';

            actions.forEach(function(action) {
                var input = document.createElement('input');
                input.value = action.text;
                input.type = 'button';
                input.addEventListener('click', function(ev) {
                    action.action(pictureId, picture);
                }, false);
                actionsDiv.appendChild(input);
            });

            var urlDiv = document.createElement('div');

            if(picture.imgurURL) {
                var imgur = picture.imgurURL;
                urlDiv.innerHTML = 'Share: <input type="text" value="' + imgur + '"> ';
                urlDiv.innerHTML+= '<a href="' + imgur + '" target="_blank">(open)</a>';
            }

            galleryDetails.innerHTML = '';
            galleryDetails.appendChild(img);
            galleryDetails.appendChild(idDiv);
            galleryDetails.appendChild(actionsDiv);
            actionsDiv.appendChild(urlDiv);

            galleryDetails.removeAttribute('hidden');

        }


        /**
         * Upload picture to imgur image sharing service, which allows for cross domain
         * requests and hence is very JS friendly!
         */
        function uploadPicture(pictureId, picture) {

            var image = picture.imageData.replace(/^data:image\/(png|gif);base64,/, "");

            var fd = new FormData();
            fd.append("image", image);

            var modal = document.createElement('x-modal');
            modal.innerHTML = 'Uploading...';
            modal.id = 'galleryUploading';
            modal.setAttribute('overlay');
            modal.setAttribute('esc-hide');
            // TODO cancel button


            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://api.imgur.com/3/upload.json');
            xhr.setRequestHeader('Authorization', 'Client-ID ' + IMGUR_KEY);

            xhr.onload = function() {

                galleryDetails.removeChild(modal);

                try {
                    var response = JSON.parse(xhr.responseText);
                    if(response.success) {
                        var url = response.data.link;
                        picture.imgurURL = url;
                        picture.save(function() {
                            new Toast('Posted to imgur').show();
                            showDetails(pictureId);
                        });
                    } else {
                        uploadPictureError();
                    }
                } catch(err) {
                    uploadPictureError();
                }

            };

            xhr.onerror = function() {
                galleryDetails.removeChild(modal);
                uploadPictureError();
            };

            xhr.send(fd);

            modal.addEventListener('modalhide', function() {
                if(xhr) {
                    xhr.abort();
                }
                galleryDetails.removeChild(modal);
            }, false);

            galleryDetails.appendChild(modal);

        }

        function uploadPictureError() {
            new Toast('Error posting picture :-/').show();
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

                if(numPictures) {

                    galleryContainer.classList.remove('empty');

                    pictures.forEach(function(pic, position) {

                        pic.previousPicture = position > 0 ? pictures[position - 1] : null;
                        pic.nextPicture = position < numPictures - 1 ? pictures[position + 1] : null;
                        galleryPictures[pic.id] = pic;

                        var div = document.createElement('div');
                        div.style.backgroundImage = 'url(' + pic.imageData + ')';
                        div.dataset['id'] = pic.id;
                        galleryContainer.appendChild(div);

                    });

                } else {

                    galleryContainer.classList.add('empty');
                    galleryContainer.innerHTML = '<p>No pictures (yet)</p>';

                }

            });
        }


        function gotoDetails() {
            detachRendererCanvas();
            showPage('details');
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
        this.gotoDetails = gotoDetails;
        this.gotoCamera = gotoCamera;
        this.gotoStatic = gotoStatic;

    };

    return App;
});
