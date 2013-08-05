// do the require.js dance
define(
    ['hammer', 'Renderer', 'gumHelper', 'GalleryView', 'Picture', 'Toast', 'Animated_GIF', 'MiniRouter', 'libs/asyncStorage'],
    function(Hammer, Renderer, gumHelper, GalleryView, Picture, Toast, Animated_GIF, MiniRouter) {
    
    'use strict';

    var App = function(errorCallback, readyCallback) {

        var that = this;
        var pages = {};
        var activePage = null;

        // Preview UI
        var additionalControls;
        var btnPrevFilter;
        var btnNextFilter;
        var flasher;
        var ghostBitmap;
        var ghostCanvas;

        // Gallery UI
        var btnGallery;
        var galleryContainer;
        var galleryCoachMarks;
        var galleryView;
        var btnCamera;
        var galleryDetails;
        var galleryDetailsFooter;
                
        // Camera UI
        var videoControls;
        var btnVideoCancel;
        var btnVideoDone;
        var videoProgressBar;
        var videoProgressSpan;
        var cameraCoachMarks;
        var cameraCoachMarksShown = false;
        var switchVideo;

        // Static file processing UI
        var filePicker;

        // Renderer and stuff
        var pictureCount;
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
        var animatedGIF;
        var gifDelay = 100;
        var gifLength = 0;
        var gifMaxLength = 2000;
        var gifRecordStart;
        var recordGIFTimeout = null;

        var IMGUR_KEY = '49c42af902d1fd4';
        var TRANSITION_LENGTH = 500;

        var router = new MiniRouter();
        // TODO ideally going to gallery should be 'root' and erase previous state entries
        router.add('gallery', '#', gotoGallery);
        router.add('details', '#picture/:id', gotoDetails);
        router.add('static', '#static', gotoStatic);
        router.add('camera', '#camera', gotoCamera);
        router.attachTo(window);

        initUI();

        renderer = new Renderer(errorCallback, function() {

            Hammer(document, { swipevelocity: 0.1 })
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

            additionalControls = document.getElementById('additionalControls');
            btnPrevFilter = document.getElementById('prevFilter');
            
            btnPrevFilter.addEventListener('click', function() {
                console.log('prev');
                previousEffect();
            }, false);
            btnNextFilter = document.getElementById('nextFilter');
            btnNextFilter.addEventListener('click', function() {
                console.log('next');
                nextEffect();
            }, false);


            // Gallery ---

            galleryContainer = document.getElementById('galleryContainer');
            galleryCoachMarks = document.getElementById('galleryCoachMarks');

            galleryView = new GalleryView();
            galleryView.onPictureClicked(function(id) {

                if(activePage === 'gallery') {
                    navigateToDetails(id);
                }

            });
            galleryContainer.appendChild(galleryView.domElement);

            btnGallery = document.getElementById('btnGallery');
            btnGallery.addEventListener('click', navigateToGallery, false);

            btnCamera = document.getElementById('btnCamera');
            btnCamera.addEventListener('click', navigateToCamera, false);


            // The camera button is initially hidden. We'll show it and the references to the camera in the coachmarks if there's likely support for WebRTC
            if(navigator.getMedia) {
                showCameraButton();
            }

            document.getElementById('btnPicker').addEventListener('click', navigateToStatic, false);

            // Picture details ---

            galleryDetails = document.querySelector('#details > div');
            galleryDetailsFooter = document.querySelector('#details > footer');


            // Camera ---

            videoControls = document.getElementById('videoControls');
            videoProgressBar = document.getElementById('videoProgressBar');
            cameraCoachMarks = document.getElementById('cameraCoachMarks');
            btnVideoCancel = document.getElementById('btnVideoCancel');
            btnVideoDone = document.getElementById('btnVideoDone');
            videoProgressSpan = document.querySelector('#progressLabel span');
            switchVideo = document.getElementById('switchVideo');

            btnVideoCancel.addEventListener('click', cancelVideoRecording, false);
            btnVideoDone.addEventListener('click', finishVideoRecording, false);


            // Static file

            filePicker = document.getElementById('filePicker');
            filePicker.addEventListener('modalhide', onFilePickerCanceled, false);

            filePicker.querySelector('input').addEventListener('change', onFilePicked, false);
            filePicker.querySelector('button').addEventListener('click', onFilePickerCanceled, false);
            document.getElementById('btnFilePicker').addEventListener('click', openFilePicker, false); 

            window.addEventListener('resize', onResize, false);

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

            galleryView.resize();

            outputImageNeedsUpdating = true;

        }


        function onHold(ev) {

            if(!usingTheRenderer()) {
                return;
            }

            if(rendering) {
                return;
            }

            if(switchVideo.checked) {
                startVideoRecording();
            } else {
                takePicture();
            }

        }


        function onRelease(ev) {

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

        
        function showCameraButton() {

            btnCamera.style.display = 'inline';
            
            document.getElementById('galleryCoachMessage').innerHTML = 'Take a photo with the camera or pick an image file.';

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

            galleryDetails.innerHTML = 'Loading...';

            var picture = getPictureById(pictureId);

            var countDiv = document.createElement('div');
            countDiv.innerHTML = picture.position + ' of ' + pictureCount;

            var img = document.createElement('img');
            img.src = picture.imageData;

            Hammer(img, { drag: false })
                .on('dragstart', function(ev) {
                    // This is for avoiding the drag behaviour where a 'ghost' image
                    // is dragged
                    ev.preventDefault();
                })
                .on('swiperight', function(ev) {
                    ev.gesture.preventDefault();
                    showPrevPicture(pictureId);
                })
                .on('swipeleft', function(ev) {
                    ev.gesture.preventDefault();
                    showNextPicture(pictureId);
                });

            var actions = [
                { text: 'Share with imgur', action: uploadPicture },
                { text: 'Download', action: downloadPicture },
                { text: 'Delete', action: deletePicture }
            ];

            galleryDetailsFooter.innerHTML = '';

            actions.forEach(function(action) {
                var button = document.createElement('button');
                button.innerHTML = action.text;
                button.addEventListener('click', function(ev) {
                    action.action(pictureId, picture);
                }, false);
                galleryDetailsFooter.appendChild(button);
            });

            /*var urlDiv = document.createElement('div');

            if(picture.imgurURL) {
                var imgur = picture.imgurURL;
                urlDiv.innerHTML = 'Share: <a href="' + imgur + '" target="_blank">' + imgur + '</a>';
            }*/

            galleryDetails.innerHTML = '';
            galleryDetails.appendChild(countDiv);
            galleryDetails.appendChild(img);
            //actionsDiv.appendChild(urlDiv);

            galleryDetails.removeAttribute('hidden');

        }


        function showPrevPicture(currentId) {

            var picture = getPictureById(currentId);
            if(picture.previousPicture) {
                navigateToDetails(picture.previousPicture.id);
            }

        }


        function showNextPicture(currentId) {

            var picture = getPictureById(currentId);
            if(picture.nextPicture) {
                navigateToDetails(picture.nextPicture.id);
            }

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


        function downloadPicture(pictureId, picture) {

            var a = document.createElement('a');
            a.setAttribute('href', picture.imageData);
            a.setAttribute('download', pictureId + picture.getExtension());

            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        }


        function deletePicture(pictureId) {

            var res = window.confirm('Are you sure you want to delete that?');

            if(res) {
                Picture.deleteById(pictureId, function() {
                    navigateToGallery();
                });
            }

        }


        function showCameraCoachMarks() {

            asyncStorage.getItem('firstTimeUser', function(firstTimeUser) {

                if(firstTimeUser === null) {
                    firstTimeUser = true;
                }

                if(firstTimeUser || !cameraCoachMarksShown) {
                    show(cameraCoachMarks);

                    if(firstTimeUser) {
                        cameraCoachMarks.addEventListener('click', function() {
                            hide(cameraCoachMarks);
                            asyncStorage.setItem('firstTimeUser', false);
                            cameraCoachMarksShown = true;
                        }, false);
                    } else {
                        setTimeout(function() {
                            cameraCoachMarksShown = true;
                            hide(cameraCoachMarks);
                        }, 3000);
                    }
                }

            });

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
                switchVideo.style.opacity = 1;
                showCameraCoachMarks();
                render();
            });

        }


        function disableCamera() {

            gumHelper.stopVideoStreaming();
            switchVideo.style.opacity = 0;

        }


        function changeInputTo(element, width, height) {

            inputElement = element;

            inputWidth = width;
            inputHeight = height;

            onResize();

        }


        function clearRenderer() {

            // To delete the last image from the renderer, we set an empty
            // canvas as input element.
            var emptyCanvas = document.createElement('canvas');
            changeInputTo(emptyCanvas, inputWidth, inputHeight);
            outputImageNeedsUpdating = true;

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
                outputImageNeedsUpdating = true;
                renderer.previousEffect();
            }

        }


        function nextEffect() {

            if(usingTheRenderer()) {
                outputImageNeedsUpdating = true;
                renderer.nextEffect();
            }

        }


        // Save static image
        function takePicture() {

            var bitmapData = renderer.domElement.toDataURL();
            saveLocalPicture(bitmapData, false);

        }


        function startVideoRecording() {

            // We might already have a half-way recorded video
            if(!animatedGIF) {

                gifRecordStart = Date.now();
                gifLength = 0;

                videoControls.classList.remove('rendering');
                videoProgressBar.value = 0;

                show(videoControls);

                animatedGIF = new Animated_GIF({ workerPath: 'js/libs/Animated_GIF/quantizer.js' });
                // TODO cap max size here
                var canvas = renderer.domElement;
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

            animatedGIF.addFrame(renderer.domElement);
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
            switchVideo.disabled = true;

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
                switchVideo.disabled = false;

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


        // data is a base64 encoded dataURL 
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


        function openFilePicker() {

            // Can we use an input type=file? Some early releases of Firefox OS
            // cannot! So detect that out by checking the actual type of the input
            // When a browser doesn't implement a type, it's reset to 'text'
            // instead of the type we expected
            var input = filePicker.querySelector('input');

            if(input.type !== 'file') {

                // Not supported, so let's use a Web activity instead
                var activity = new MozActivity({
                    name: 'pick',
                    data: {
                        type: 'image/jpeg'
                    }
                });

                activity.onsuccess = function() {
                    var picture = this.result;
                    loadImageFromBlob(picture.blob);
                };

                activity.onerror = function() {
                    navigateToGallery();
                };

            } else {

                input.value = '';
                filePicker.removeAttribute('hidden');

            }

        }


        function onFilePicked() {

            var files = this.files;

            filePicker.setAttribute('hidden');

            if(files.length > 0 && files[0].type.indexOf('image/') === 0) {

                // get data from picked file
                // put that into an element
                var file = files[0];
                loadImageFromBlob(file);

            }

        }


        function loadImageFromBlob(blob) {
            var img = document.createElement('img');

            img.src = window.URL.createObjectURL(blob);
            img.onload = function() {
                //window.URL.revokeObjectURL(this.src); // TODO maybe too early?

                changeInputTo(img, img.width, img.height);

                outputImageNeedsUpdating = true;
                render();
            };

        }


        function onFilePickerTransitionEnd() {

            filePicker.removeEventListener('webkitTransitionEnd', onFilePickerTransitionEnd, false);
            filePicker.removeEventListener('transitionend', onFilePickerTransitionEnd, false);
            navigateToGallery();

        }


        function onFilePickerCanceled() {

            filePicker.addEventListener('webkitTransitionEnd', onFilePickerTransitionEnd, false);
            filePicker.addEventListener('transitionend', onFilePickerTransitionEnd, false);
            filePicker.setAttribute('hidden', '');

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


        function gotoGallery() {

            detachRendererCanvas();
            disableCamera();

            galleryView.showLoading();
            showPage('gallery');

            Picture.getAll(function(pictures) {

                // Show most recent pictures first
                pictures.reverse();

                galleryPictures = {};
                pictureCount = pictures.length;

                if(pictureCount) {

                    hide(galleryCoachMarks);

                    pictures.forEach(function(pic, position) {

                        pic.position = position + 1; // Humans are not 0-based!
                        pic.previousPicture = position > 0 ? pictures[position - 1] : null;
                        pic.nextPicture = position < pictureCount - 1 ? pictures[position + 1] : null;
                        galleryPictures[pic.id] = pic;

                    });

                } else {

                    show(galleryCoachMarks);

                }

                galleryView.setPictures(galleryPictures);

            });

        }


        function gotoDetails(args) {
            
            detachRendererCanvas();
            showPage('details');
            showDetails(args.id);

        }


        function gotoCamera() {

            enableCamera();
            clearRenderer();
            attachRendererCanvas();
            showPage('camera');

        }


        function gotoStatic() {

            clearRenderer();
            attachRendererCanvas();
            showPage('pickFile');
            openFilePicker();

        }

        //

        function navigateToGallery() {
            router.navigate('gallery');
        }


        function navigateToDetails(id) {
            router.navigate('details', { id: id });
        }


        function navigateToCamera() {
            router.navigate('camera');
        }


        function navigateToStatic() {
            router.navigate('static');
        }


        function restoreLast() {
            // TODO
        }


        // 'Public' methods

        this.openGallery = navigateToGallery;
        this.openCamera = navigateToCamera;
        this.openStatic = navigateToStatic;

        this.restoreLast = restoreLast;

    };

    return App;

});
