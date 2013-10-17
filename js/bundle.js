;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// do the require.js dance
//define(
//    ['hammer', 'Renderer', 'gumHelper', 'GalleryView', 'Picture', 'Toast', 'Animated_GIF', 'MiniRouter', 'libs/IndexedDBShim', 'libs/asyncStorage'],
//    function(Hammer, Renderer, gumHelper, GalleryView, Picture, Toast, Animated_GIF, MiniRouter) {

//    'use strict';

var Hammer = require('./libs/Hammer');
var Renderer = require('./Renderer');
var gumHelper = require('./gumHelper');
var GalleryView = require('./GalleryView');
var Picture = require('./Picture');
var Toast = require('./Toast');
var Animated_GIF = require('./libs/Animated_GIF/Animated_GIF');
var MiniRouter = require('./MiniRouter');

    function App(errorCallback, readyCallback) {

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
        var btnCameraCapture;
        var switchVideo;

        // Static file processing UI
        var filePicker;
        var btnStaticCapture;

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

            btnPrevFilter.addEventListener('click', previousEffect, false);
            btnNextFilter = document.getElementById('nextFilter');
            btnNextFilter.addEventListener('click', nextEffect, false);


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
            btnCameraCapture = document.querySelector('#camera footer .btnCapture');
            switchVideo = document.getElementById('switchVideo');

            Hammer(btnCameraCapture)
                .on('click', onHold)
                .on('release', onRelease);

            btnVideoCancel.addEventListener('click', cancelVideoRecording, false);
            btnVideoDone.addEventListener('click', finishVideoRecording, false);


            // Static file ---

            filePicker = document.getElementById('filePicker');
            filePicker.addEventListener('modalhide', onFilePickerCanceled, false);

            filePicker.querySelector('input').addEventListener('change', onFilePicked, false);
            filePicker.querySelector('button').addEventListener('click', onFilePickerCanceled, false);
            document.getElementById('btnFilePicker').addEventListener('click', openFilePicker, false);

            btnStaticCapture = document.querySelector('#pickFile .btnCapture');
            btnStaticCapture.addEventListener('click', onHold, false);

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
                show(btnGallery);
            } else {
                hide(btnGallery);
            }

            activePage = id;

            pages[id].show();

        }


        function showCameraButton() {

            btnCamera.classList.remove('hidden');

            document.getElementById('galleryCoachMessage').innerHTML = 'You can add photos by tapping <img src="img/icons/icn-camera@2x.png" id="galleryCoachMarksCamera"> or <img src="img/icons/icn-filepicker@2x.png" id="galleryCoachMarksFilePicker">';

        }


        function enableAdditionalControls() {
            additionalControls.classList.add('active');
        }


        function disableAdditionalControls() {
            additionalControls.classList.remove('active');
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

            // If the picture has already been uploaded to imgur we'll just show the
            // existing imgur URL
            var uploadAction = picture.imgurURL ? showImgurPicture : uploadPicture;

            var actions = [];

            if(window.MozActivity) {
                actions.push({ text: 'Share', action: shareAction, id: 'share' });
            } else {
                actions.push({ text: 'Share with imgur', action: uploadAction, id: 'share' });
                actions.push({ text: 'Download', action: downloadPicture, id: 'download' });
            }

            actions.push({ text: 'Delete', action: deletePicture, id: 'delete' });

            galleryDetailsFooter.innerHTML = '';

            actions.forEach(function(action) {
                var elem = document.createElement('button');
                elem.type = 'image';
                elem.id = 'btn_' + action.id;
                elem.title = action.text;

                elem.addEventListener('click', function(ev) {
                    action.action(pictureId, picture);
                }, false);
                galleryDetailsFooter.appendChild(elem);
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


        function showImgurPicture(pictureId, picture) {

            var existingModal = document.getElementById('showImgur');
            if(existingModal) {
                existingModal.parentNode.removeChild(existingModal);
            }

            var modal = document.createElement('x-modal');
            modal.innerHTML = 'imgur: <a href="' + picture.imgurURL + '" target="_blank">' + picture.imgurURL + '</a>';
            modal.setAttribute('overlay');
            modal.setAttribute('esc-hide');
            modal.id = 'showImgur';

            modal.addEventListener('modalhide', function() {
                galleryDetails.removeChild(modal);
            }, false);

            galleryDetails.appendChild(modal);

        }

        function b64ToBlob(b64Data, contentType, sliceSize) {

            contentType = contentType || '';
            sliceSize = sliceSize || 1024;

            function charCodeFromCharacter(c) {
                return c.charCodeAt(0);
            }

            var byteCharacters = atob(b64Data);
            var byteArrays = [];

            for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                var slice = byteCharacters.slice(offset, offset + sliceSize);
                var byteNumbers = Array.prototype.map.call(slice, charCodeFromCharacter);
                var byteArray = new Uint8Array(byteNumbers);

                byteArrays.push(byteArray);
            }

            var blob = new Blob(byteArrays, {type: contentType});
            return blob;

        }

        /**
         * Share picture using a native Activity
         */
        function shareAction(pictureId, picture) {

            var blob = b64ToBlob(picture.imageData.replace('data:image/png;base64,', ''), 'image/png');
            var filename = pictureId + '.png';

            var activity = new MozActivity({
                name: 'share',
                data: {
                    type: 'image/*',
                    number: 1,
                    blobs: [ blob ],
                    filenames: [ filename ]
                }
            });

            activity.onerror = function(e) {
                if(activity.error.name === 'NO_PROVIDER') {
                    alert('no provider');
                } else {
                    alert('Sorry-error when sharing', activity.error.name);
                    console.log('the error', activity.error);
                }
            };

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


        function enableCamera() {

            gumHelper.startVideoStreaming(function() {

                // Error!
                errorCallback("Oops! Can't access the camera :-(");

            }, function(stream, videoElement, width, height) {

                video = videoElement;
                liveStreaming = true;
                changeInputTo(videoElement, width, height);
                switchVideo.style.opacity = 1;
                enableAdditionalControls();
                btnCameraCapture.classList.remove('hidden');
                showCameraCoachMarks();
                render();

            });

        }


        function disableCamera() {

            gumHelper.stopVideoStreaming();
            switchVideo.style.opacity = 0;
            btnCameraCapture.classList.add('hidden');

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

            enableAdditionalControls();
            btnStaticCapture.classList.remove('hidden');


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

            disableAdditionalControls();
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

            disableAdditionalControls();
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
            btnStaticCapture.classList.add('hidden');
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

    //return App;

// });
//
module.exports = App;

},{"./GalleryView":2,"./MiniRouter":4,"./Picture":5,"./Renderer":6,"./Toast":7,"./gumHelper":8,"./libs/Animated_GIF/Animated_GIF":9,"./libs/Hammer":10}],2:[function(require,module,exports){
//define([], function() {

    function GalleryView() {

        var root = document.createElement('div');
        var pictures = {};
        var viewportHeight = 0;
        var scrollTop = 0;
        var onPictureClickedCb = function() {};

        root.addEventListener('click', onClick, false);

        onScroll();


        function onScroll() {
            root.removeEventListener('scroll', onScroll, false);

            scrollTop = root.scrollTop;

            updateVisible();

            setTimeout(function() {
                root.addEventListener('scroll', onScroll, false);
            }, 100);
        }


        function onClick(ev) {

            var target = ev.target;

            if(target && target.nodeName === 'DIV') {
                var pictureId = target.dataset.id;
                if(pictureId) {
                    onPictureClickedCb(pictureId);
                }
            }

        }


        function makeElement(picture) {
            var el = document.createElement('div');
            el.style.backgroundImage = 'url(' + picture.imageData + ')';
            el.dataset.id = picture.id;
            return el;
        }


        // Hide/show items that are invisible/visible according to scroll position
        function updateVisible() {

            var children = root.childNodes;
            var num = children.length;
            var margin = 50;
            var viewportEnd = scrollTop + viewportHeight;

            for(var i = 0; i < num; i++) {
                var child = children[i];
                var childHeight = child.clientHeight;
                var childTop = child.offsetTop;
                var childStyle = child.style;

                if(childTop + childHeight + margin < scrollTop || childTop - margin > viewportEnd) {
                    childStyle.visibility = 'hidden';
                } else {
                    childStyle.visibility = 'visible';
                }
            }

        }
        

        // ~~~

        
        this.domElement = root;


        // Used when we want to display a loading indicator while we retrieve data
        this.showLoading = function() {
            root.innerHTML = '<p class="loading">Loading</p>';
        };


        this.setPictures = function(pictures) {

            root.innerHTML = '';

            for(var k in pictures) {
                var picture = pictures[k];
                var elem = makeElement(picture);
                root.appendChild(elem);
            }

            this.resize();

            updateVisible();

        };


        this.resize = function() {

            viewportHeight = root.clientHeight;
            updateVisible();

        };


        // Sets picture clicked callback
        this.onPictureClicked = function(callback) {

            onPictureClickedCb = callback;

        };

    }

//    return GalleryView;
//} );
//
module.exports = GalleryView;

},{}],3:[function(require,module,exports){
function ImageEffect(params) {
	
	params = params || {};

	var self = this;
	this.vertexShaderScript = params.vertexShader;
	this.fragmentShaderScript = params.fragmentShader;
	this.shaderProgram = null;
	this.uniforms = params.uniforms || {};
	this.attributes = params.attributes || {};

	// ~~~
	
	function initShader(gl, type, script) {
		if( gl.shadersCache[ script ] === undefined ) {

			var shader = gl.createShader( type );
			gl.shaderSource( shader, script );
			gl.compileShader( shader );

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error('Shader <strong>' + script + '</strong> could not be compiled\n' + gl.getShaderInfoLog(shader));
			}

			gl.shadersCache[ script ] = shader;

			return shader;

		}

		return gl.shadersCache[ script ];

	}

	function initUniforms(gl, program, pairs) {
		for(var k in pairs) {
			pairs[k].id = gl.getUniformLocation(program, k);
		}
	}

	function initAttributes(gl, program, pairs) {
		for(var k in pairs) {
			pairs[k].id = gl.getAttribLocation(program, k);
		}
	}

	// ~~~

	this.initialise = function(gl) {

		var vertexShader, fragmentShader;
		var shaderProgram = gl.createProgram();

		vertexShader = initShader(gl, gl.VERTEX_SHADER, this.vertexShaderScript);
		fragmentShader = initShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderScript);

		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			throw new Error('Shaders could not be linked');
		}

		gl.useProgram(shaderProgram);

		initUniforms(gl, shaderProgram, this.uniforms);
		initAttributes(gl, shaderProgram, this.attributes);

		this.shaderProgram = shaderProgram;

	};


	this.enable = function(gl) {
		// TODO: from this.attributes
		gl.useProgram(this.shaderProgram);
		gl.enableVertexAttribArray(this.attributes.uv.id);
		gl.enableVertexAttribArray(this.attributes.position.id);
	};

	this.disable = function(gl) {
		// TODO: from this.attributes
		gl.enableVertexAttribArray(this.attributes.uv.id);
		gl.enableVertexAttribArray(this.attributes.position.id);
	};
}

/*define([], function() {
    return ImageEffect;
});*/

module.exports = ImageEffect;

},{}],4:[function(require,module,exports){
function MiniRouter() {

    var that = this,
        routes = {},
        windowObject = null;


    this.reset = function() {

        routes = {};

    };


    this.add = function(name, path, callback) {

        routes[name] = {
            path: path,
            callback: callback

        };
    };


    this.navigate = function(name, args) {

        if(routes[name]) {

            var route = routes[name];
            var path = route.path;

            if(windowObject) {

                for(var k in args) {
                    path = path.replace(':' + k, args[k]);
                }
                windowObject.history.pushState({ name: name, args: args }, '', path);

            }

            route.callback(args);

        } else {

            console.error('Unknown route', name);

        }

    };


    this.attachTo = function(win) {

        windowObject = win;

        windowObject.addEventListener('popstate', function(e) {

            var state = e.state;

            if(state && state.name) {

                that.navigate(state.name, state.args);

            }

        }, false);

    };

}


/*if(define) {

    define([], function() {
        return MiniRouter;
    });

}*/

module.exports = MiniRouter;

},{}],5:[function(require,module,exports){
// This class will be used to store and retrieve taken pictures and some
// associated metadata, using IndexedDB
//define(['libs/asyncStorage'], function(notUsed) {

var asyncStorage = require('./libs/asyncStorage');

    var PICTURES_LIST_KEY = 'pictures_list';
    var PICTURE_PREFIX = 'picture_';

    function getPicturesList(callback) {

        asyncStorage.getItem(PICTURES_LIST_KEY, function(list) {
            
            if(!list) {
                list = [];
            }

            callback(list);

        });
    }


    function savePicturesList(updatedList, callback) {
        asyncStorage.setItem(PICTURES_LIST_KEY, updatedList, callback);
    }


    function addToPicturesList(pictureId) {
        
        getPicturesList(function(list) {

            // No duplicates! (for when updating pictures)
            if(list.indexOf(pictureId) === -1) {
                list.push(pictureId);
                savePicturesList(list);
            }

        });

    }


    function removeFromPicturesList(pictureId, callback) {

        getPicturesList(function(list) {

            var pos = list.indexOf(pictureId);

            if(pos !== -1) {
                list.splice(pos, 1);
                savePicturesList(list, callback);
            }

        });
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


    function guessIsImageAnimated(data) {
    
        var animated = false;

        if(data) {
            animated = data.indexOf('image/gif') !== -1;
        }

        return animated;

    }


    var Pic = function() {

        var self = this;

        this.id = null;
        this.imageData = null;
        this.imageIsAnimated = null;
        this.imgurURL = null;

        this.save = function(callback) {
            if(!self.id) {
                self.id = PICTURE_PREFIX + getTimestamp();
            }

            if(!self.imageIsAnimated) {
                self.imageIsAnimated = guessIsImageAnimated(this.imageData);
            }

            // Saving stuff
            asyncStorage.setItem(self.id, {

                imageData: this.imageData,
                imageIsAnimated: this.imageIsAnimated,
                imgurURL: this.imgurURL

            }, function() {

                addToPicturesList(self.id);
                callback();

            });
        };

        this.getExtension = function() {

            if(self.imageIsAnimated) {
                return '.gif';
            } else {
                return '.png';
            }

        };

    };


    Pic.getAll = function(callback/* numItemsPerPage, page */) {
        
        getPicturesList(function(list) {
 
            var pictures = [];
            var position = 0; // (page - 1) * numItemsPerPage
            
            if(list.length > 0) {
                loadPicture(position);
            } else {
                callback(pictures);
            }

            function onPictureLoaded(picture, loadedPosition) {

                var nextPosition = loadedPosition + 1;

                pictures.push(picture);

                if(nextPosition >= list.length) {
                    callback(pictures);
                } else {
                    loadPicture(nextPosition);
                }

            }

            function loadPicture(position, callback) {

                Pic.getById(list[position], function(picture) {
                    onPictureLoaded(picture, position);
                });

            }

        });

    };


    Pic.getById = function(id, callback) {

        asyncStorage.getItem(id, function(value) {

            if(!value) {
                callback(false);
                return;
            }

            var picture = new Pic();
            picture.id = id;
            picture.imageData = value.imageData || null;
            picture.imageIsAnimated = value.imageIsAnimated || null;
            picture.imgurURL = value.imgurURL || null;

            callback(picture);

        });
    };


    Pic.deleteById = function(id, callback) {

        asyncStorage.removeItem(id, function() {

            removeFromPicturesList(id, function() {
                setTimeout(callback, 10);
            });

        });

    };


    Pic.getList = function(callback) {

        getPicturesList(callback);

    };


    Pic.fixList = function(callback) {

        getPicturesList(function(list) {

            var outputList = [];
            var invalidList = [];

            if(list.length === 0) {

                callback();

            } else {

                list.forEach(function(index) {

                    Pic.getById(index, function(picture) {

                        if(picture) {
                            outputList.push(index);
                        } else {
                            invalidList.push(index);
                        }

                        if(outputList.length + invalidList.length === list.length) {
                            savePicturesList(outputList, callback);
                        }

                    });

                });

            }

        });

    };

module.exports = Pic;

//});

},{"./libs/asyncStorage":11}],6:[function(require,module,exports){
/**
 * The Renderer is the part of the app that accepts unprocessed images as input
 * and processes them to produce different visual "effects", using WebGL shaders.
 * Finally the result is output into a Canvas that we provide when creating the
 * renderer instance.
 *
 * Each effect requires a vertex and a fragment shader. These are little pieces of
 * code that are compiled and sent to the graphics card, and are executed by it,
 * instead of your CPU.
 *
 * All WebGL related code in the application is here and in ImageEffect.js
 *
 * Visit http://webgl.org if you want to learn more about WebGL.
 */
// do the require.js dance
//define(['ImageEffect', 'libs/glmatrix.min'], function(ImageEffect, glMatrix) {

var ImageEffect = require('./ImageEffect');
var glMatrix = require('./libs/glmatrix.min');

function Renderer(errorCallback, readyCallback) {
        'use strict';

        var canvas = document.createElement('canvas');
        var gl;
        var effects = [];
        var effectDefinitions = {
            'Mosaic': { vertex: 'plane.vs', fragment: 'mosaic.fs' },
            'Dithering': { vertex: 'plane.vs', fragment: 'dithering.fs' },
            'Posterize': { vertex: 'plane.vs', fragment: 'posterize.fs' },
            'Negative': { vertex: 'plane.vs', fragment: 'negative.fs' },
            'Green Monster': { vertex: 'plane.vs', fragment: 'greenmonster.fs' },
            'Black & White': { vertex: 'plane.vs', fragment: 'bw.fs' },
            'Bad photocopy': { vertex: 'plane.vs', fragment: 'badphotocopy.fs' },
            'Back to 1980': { vertex: 'plane.vs', fragment: 'backto1980.fs' }
        };
        var activeEffect = null;
        var shadersReady = false;
        var shaderProgram;
        var vertexPositionBuffer;
        var uvBuffer;
        var mvMatrix;
        var pMatrix;
        var texture;
        var onErrorCallback = errorCallback || function() {};
        var onReadyCallback = readyCallback || function() {};

        this.domElement = canvas;

        gl = initWebGL(canvas);

        if(gl === null) {
            errorCallback('Looks like WebGL is not available in this browser');
            return;
        }

        initWebGLBuffers();
        initTexture();
        loadEffects();

        /**
         * Here we just obtain a webgl context from the canvas we get passed
         * The context is then used for calling its provided gl functions
         */
        function initWebGL(canvas) {

            var gl = null;
            var options = { preserveDrawingBuffer: true };

            gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);

            if(gl) {
                gl.viewportWidth = canvas.width;
                gl.viewportHeight = canvas.height;

                gl.shadersCache = {};
            }

            return gl;

        }


        /**
         * Before we can draw anything with WebGL we need to set up what to draw.
         * WebGL uses the concept of buffers, which are similar to arrays. These are
         * very GPU friendly and allow WebGL to run very fast, but are a bit more
         * inconvenient to setup than plain JavaScript arrays.
         *
         * We will need a buffer for the vertices, and another for the texture UVs
         * (this is a way of specifying which part of the texture is drawn on the
         * output plane).
         *
         * As we just want to draw a somewhat rectangular output, we just need to
         * define four vertices on each buffer.
         * Note how the buffers have no notion of x, y or z coordinates --it's just
         * float values for them.
         *
         * We also create a couple of 4x4 matrices that are used to transform the
         * abstract 3D vertices into 2D.
         *
         * When you use a 3D framework like three.js, this kind of things are
         * abstracted away via the Camera and Scene classes.
         */
        function initWebGLBuffers() {

            vertexPositionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
            var vertices = [
                 1.0,  1.0,  0.0,
                -1.0,  1.0,  0.0,
                 1.0, -1.0,  0.0,
                -1.0, -1.0,  0.0
            ];

            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
            vertexPositionBuffer.itemSize = 3;
            vertexPositionBuffer.numItems = 4;

            uvBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

            var uvs = [
                1.0, 1.0,
                0.0, 1.0,
                1.0, 0.0,
                0.0, 0.0
            ];

            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
            uvBuffer.itemSize = 2;
            uvBuffer.numItems = 4;

            mvMatrix = glMatrix.mat4.create();
            pMatrix = glMatrix.mat4.create();

        }


        /**
         * Since we will just be processing one source of images, we will only
         * need to upload to the graphics card an image each time. The "target" of these
         * uploads is the texture we create here
         */
        function initTexture() {

            texture = gl.createTexture();

        }


        /**
         * Here we'll load first each effect's vertex and fragment shader's source
         * from their separate files, and when we have all files loaded we'll create
         * the actual effects, and call the onReadyCallback function to signify we are
         * ready to process images.
         *
         * The vertex shader works over vertices, so it can transform and move them in
         * 3D space; the fragment shader works over each pixel, and it's responsible for
         * determining which colour to use (or whether to draw a given pixel at all!)
         *
         * For this particular app, the vertex shader is very simple, as it just ensures
         * that we draw a 2D plane--that's why all of the effects use the same vertex shader.
         * The fragment shader is what is really interesting here, and also differs between
         * each effect.
         */
        function loadEffects() {
            // We always need to load some common shader code, so add those to the
            // list to start with
            var files = ['common.vs', 'common.fs'];

            // then collect all file names from the effect definitions
            for(var k in effectDefinitions) {
                
                var def = effectDefinitions[k];
                files.push(def.vertex);
                files.push(def.fragment);

            }

            // And load each shader file. When done, we can initialise the effects.
            loadShaders(files, onErrorCallback, function(shaders) {
                initialiseEffects(shaders);
            });

        }


        /**
         * We will be loading shader files sequentially. If any of the shaders
         * is not found, we'll just cancel the whole thing and report an error
         * via errorCallback
         */
        function loadShaders(files, errorCallback, doneCallback) {

            var directory = 'shaders/';
            var loaded = {};
            var filesToLoad = files.slice(0);

            loadNextShader();

            //

            function loadNextShader() {

                if(filesToLoad.length > 0) {
                    setTimeout(function() {
                        loadShader(filesToLoad.shift());
                    }, 1);
                } else {
                    doneCallback(loaded);
                }

            }

            function loadShader(filename) {

                // Don't load shaders twice
                if(loaded.hasOwnProperty(filename)) {
                    loadNextShader(filename);
                } else {
                    var fullpath = directory + filename;
                    var request = new XMLHttpRequest();

                    request.open('GET', fullpath, true);
                    request.responseType = 'text';
                    request.onload = function() {
                        if(request.status === 404) {
                            errorCallback('Shader file not found: ' + filename);
                        } else {
                            loaded[filename] = request.response;
                            loadNextShader();
                        }
                    };

                    request.send();
                }

            }

        }


        /**
         * We have taken out the parts common to all shaders onto
         * common.vs (for the vertex shaders) and common.fs (ditto, but for the fragment
         * shaders).
         */
        function initialiseEffects(shadersData) {

            var vertexCommonShader = shadersData['common.vs'];
            var fragmentCommonShader = shadersData['common.fs'];

            for(var k in effectDefinitions) {

                var def = effectDefinitions[k];
                var vertexShader = shadersData[def.vertex];
                var fragmentShader = shadersData[def.fragment];

                vertexShader = vertexCommonShader + vertexShader;
                fragmentShader = fragmentCommonShader + fragmentShader;

                var effect = new ImageEffect({
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    attributes: {
                        uv: {},
                        position: {}
                    },
                    uniforms: {
                        projectionMatrix: {},
                        modelViewMatrix: {},
                        map: {}
                    }
                });

                effects.push(effect);
                effect.initialise(gl);

            }

            activeEffect = effects[0];
            setTimeout(onEffectsInitialised, 1);

        }


        /**
         * Called when all effects are loaded and ready
         */
        function onEffectsInitialised() {

            shadersReady = true;
            onReadyCallback();

        }


        /**
         * Each time this function is called it will clear everything on our output canvas
         * and draw a processed image on it, using the currently active effect.
         *
         * This involves a bit of matrix math for positioning our plane in front of the
         * 'camera', and some amount of "state setting". What this means is that WebGL
         * works by making very simple calls for enabling and disabling 'things',
         * instead of calling complex functions that take many parameters.
         *
         * For example, instead of invoking a function called "drawTextureWithEffect"
         * that takes a list of vertices, a texture, a list of texture coordinates and a
         * position, we do the following:
         * - calculate the positions with the mat4 matrix library,
         * - activate a texture unit or "slot" (texture0),
         * - enable the particular texture we want to use, with bindTexture,
         * - then enable the effect, which involves telling WebGL to use the shaders
         *   associated to the effect
         * - tell WebGL to use the matrices we calculated before
         * - tell WebGL to draw a series of triangles, by reading its positions from the
         *   vertexPositionBuffer we initialised early on.
         * - and finally disable the effect
         *
         * Again, 3D frameworks abstract all this for you by providing some 'syntatic sugar'.
         */
        function render() {

            if(!shadersReady) {
                return;
            }

            gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            glMatrix.mat4.ortho(pMatrix, -1, 1, -1, 1, 0.1, 1000);

            glMatrix.mat4.identity(mvMatrix);
            glMatrix.mat4.translate(mvMatrix, mvMatrix, [0.0, 0.0, -1.0]);

            activeEffect.enable(gl);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);

            gl.uniform1i(activeEffect.uniforms.map.id, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
            gl.vertexAttribPointer(activeEffect.attributes.uv.id, uvBuffer.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
            gl.vertexAttribPointer(activeEffect.attributes.position.id, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

            gl.uniformMatrix4fv(activeEffect.uniforms.projectionMatrix.id, false, pMatrix);
            gl.uniformMatrix4fv(activeEffect.uniforms.modelViewMatrix.id, false, mvMatrix);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexPositionBuffer.numItems);

            activeEffect.disable(gl);

        }


        this.setSize = function(w, h) {

            gl.viewportWidth = w;
            gl.viewportHeight = h;

            canvas.width = w;
            canvas.height = h;

        };


        this.previousEffect = function() {

            var index = effects.indexOf(activeEffect);
            var newIndex = --index < 0 ? effects.length - 1 : index;

            activeEffect = effects[newIndex];

        };


        this.nextEffect = function() {

            var index = effects.indexOf(activeEffect);
            var newIndex = ++index % effects.length;

            activeEffect = effects[newIndex];

        };


        /**
         * This is used to upload a copy of the current appearance of the video element
         * onto our WebGL texture.
         *
         * As it happens on the render method, we need to make a lot of small, simple
         * function calls to get the image in WebGL-land, and then disable the texture
         * (passing 'null' as texture parameter).
         *
         */
        this.updateTexture = function(video) {

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.bindTexture(gl.TEXTURE_2D, null);

            render();
        };

    };

module.exports = Renderer;
//});

},{"./ImageEffect":3,"./libs/glmatrix.min":12}],7:[function(require,module,exports){
/**
 * This class is used to display short-lived messages on the screen,
 * Android-toasts style
 */
//define([], function() {

function Toast(text) {

        var div;


        function hide() {
            div.classList.add('hidden');
        }


        function onTransitionEnd() {
            document.body.removeChild(div);
        }


        this.show = function(duration) {

            duration = duration || 1500;

            div = document.createElement('div');
            div.innerHTML = '<span>' + text + '</span>';
            div.className = 'toast';

            div.addEventListener('transitionend', onTransitionEnd, false);
            div.addEventListener('webkitTransitionEnd', onTransitionEnd, false);

            document.body.appendChild(div);

            setTimeout(hide, duration);

        };

    }

module.exports = Toast;


},{}],8:[function(require,module,exports){
'use strict';

// A couple of shims for having a common interface

window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

navigator.getMedia = ( navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
);


//

var video;
var cameraStream;
var noGUMSupportTimeout;


/**
 * Requests permission for using the user's camera,
 * starts reading video from the selected camera, and calls
 * `okCallback` when the video dimensions are known (with a fallback
 * for when the dimensions are not reported on time),
 * or calls `errorCallback` if something goes wrong
 */
function startStreaming(errorCallback, onStreaming, okCallback) {

    var videoElement;
    var cameraStream;
    var attempts = 0;
    var readyListener = function(event) {

        findVideoSize();

    };
    var findVideoSize = function() {

        if(videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {

            videoElement.removeEventListener('loadeddata', readyListener);
            onDimensionsReady(videoElement.videoWidth, videoElement.videoHeight);

        } else {

            if(attempts < 10) {

                attempts++;
                setTimeout(findVideoSize, 200);

            } else {

                onDimensionsReady(640, 480);

            }

        }

    };
    var onDimensionsReady = function(width, height) {
        okCallback(cameraStream, videoElement, width, height);
    };
    
    videoElement = document.createElement('video');
    videoElement.autoplay = true;

    videoElement.addEventListener('loadeddata', readyListener);

    navigator.getMedia({ video: true }, function (stream) {

        onStreaming();

        if(videoElement.mozSrcObject) {
            videoElement.mozSrcObject = stream;
        } else {
            videoElement.src = window.URL.createObjectURL(stream);
        }

        cameraStream = stream;
        videoElement.play();

    }, errorCallback);

}

/**
 * Try to initiate video streaming, and transparently handle cases
 * where that is not possible (includes 'deceptive' browsers, see inline
 * comment for more info)
 */
function startVideoStreaming(errorCallback, okCallback) {
    
    if(navigator.getMedia) {

        // Some browsers apparently have support for video streaming because of the
        // presence of the getUserMedia function, but then do not answer our
        // calls for streaming.
        // So we'll set up this timeout and if nothing happens after a while, we'll
        // conclude that there's no actual getUserMedia support.
        noGUMSupportTimeout = setTimeout(onNoGUMSupport, 10000);

        startStreaming(errorCallback, function() {
                
                // The streaming started somehow, so we can assume /there is/
                // gUM support
                clearTimeout(noGUMSupportTimeout);

            }, function(stream, videoElement, width, height) {


                // Keep references, for stopping the stream later on.
                cameraStream = stream;
                video = videoElement;

                okCallback(stream, videoElement, width, height);

            }
        );

    } else {

        onNoGUMSupport();
    }

    function onNoGUMSupport() {
        errorCallback('Native device media streaming (getUserMedia) not supported in this browser.');
    }
}


function stopVideoStreaming() {
    
    if(cameraStream) {

        cameraStream.stop();

    }

    if(video) {

        video.pause();
        // TODO free src url object
        video.src = null;
        video = null;

    }

}

var GumHelper = {
    startVideoStreaming: startVideoStreaming,
    stopVideoStreaming: stopVideoStreaming
};

// Make it compatible for require.js/AMD loader(s)
if(typeof define === 'function' && define.amd) {
    define(function() { return GumHelper; });
} else if(module !== undefined && module.exports) {
    // And for npm/node.js
    module.exports = GumHelper;
}



},{}],9:[function(require,module,exports){
// A library/utility for generating GIF files
// Uses Dean McNamee's omggif library
// and Anthony Dekker's NeuQuant quantizer (JS 0.3 version with many fixes)
//
// @author sole / http://soledadpenades.com
function Animated_GIF(options) {

    'use strict';

    var width = 160, height = 120, canvas = null, ctx = null, repeat = 0, delay = 250;
    var frames = [];
    var numRenderedFrames = 0;
    var onRenderCompleteCallback = function() {};
    var onRenderProgressCallback = function() {};
    var workers = [], availableWorkers = [], numWorkers, workerPath;
    var generatingGIF = false;

    options = options || {};
    numWorkers = options.numWorkers || 2;
    workerPath = options.workerPath || 'src/quantizer.js'; // XXX hardcoded path

    for(var i = 0; i < numWorkers; i++) {
        var w = new Worker(workerPath);
        workers.push(w);
        availableWorkers.push(w);
    }

    // ---


    // Return a worker for processing a frame
    function getWorker() {
        if(availableWorkers.length === 0) {
            throw ('No workers left!');
        }

        return availableWorkers.pop();
    }


    // Restore a worker to the pool
    function freeWorker(worker) {

        availableWorkers.push(worker);

    }


    // Faster/closurized bufferToString function
    // (caching the String.fromCharCode values)
    var bufferToString = (function() {
        var byteMap = [];
        for(var i = 0; i < 256; i++) {
            byteMap[i] = String.fromCharCode(i);
        }

        return (function(buffer) {
            var numberValues = buffer.length;
            var str = '';

            for(var i = 0; i < numberValues; i++) {
                str += byteMap[ buffer[i] ];
            }

            return str;
        });
    })();


    function startRendering(completeCallback) {
        var numFrames = frames.length;

        onRenderCompleteCallback = completeCallback;

        for(var i = 0; i < numWorkers && i < frames.length; i++) {
            processFrame(i);
        }
    }


    function processFrame(position) {

        var frame;
        var worker;

        frame = frames[position];

        if(frame.beingProcessed || frame.done) {
            console.error('Frame already being processed or done!', frame.position);
            onFrameFinished();
            return;
        }

        frame.beingProcessed = true;

        worker = getWorker();

        worker.onmessage = function(ev) {

            var data = ev.data;

            // Delete original data, and free memory
            delete(frame.data);

            // TODO grrr... HACK for object -> Array
            frame.pixels = Array.prototype.slice.call(data.pixels);
            frame.palette = Array.prototype.slice.call(data.palette);
            frame.done = true;
            frame.beingProcessed = false;

            freeWorker(worker);

            onFrameFinished();

        };

        
        // TODO maybe look into transfer objects
        // for further efficiency
        var frameData = frame.data;
        //worker.postMessage(frameData, [frameData]);
        worker.postMessage(frameData);
    }


    function processNextFrame() {

        var position = -1;

        for(var i = 0; i < frames.length; i++) {
            var frame = frames[i];
            if(!frame.done && !frame.beingProcessed) {
                position = i;
                break;
            }
        }
        
        if(position >= 0) {
            processFrame(position);
        }
    }


    function onFrameFinished() { // ~~~ taskFinished

        // The GIF is not written until we're done with all the frames
        // because they might not be processed in the same order
        var allDone = frames.every(function(frame) {
            return !frame.beingProcessed && frame.done;
        });

        numRenderedFrames++;
        onRenderProgressCallback(numRenderedFrames * 0.75 / frames.length);

        if(allDone) {
            if(!generatingGIF) {
                generateGIF(frames, onRenderCompleteCallback);
            }
        } else {
            setTimeout(processNextFrame, 1);
        }
        
    }


    // Takes the already processed data in frames and feeds it to a new
    // GifWriter instance in order to get the binary GIF file
    function generateGIF(frames, callback) {

        // TODO: Weird: using a simple JS array instead of a typed array,
        // the files are WAY smaller o_o. Patches/explanations welcome!
        var buffer = []; // new Uint8Array(width * height * frames.length * 5);
        var gifWriter = new GifWriter(buffer, width, height, { loop: repeat });

        generatingGIF = true;

        frames.forEach(function(frame) {
            onRenderProgressCallback(0.75 + 0.25 * frame.position * 1.0 / frames.length);
            gifWriter.addFrame(0, 0, width, height, frame.pixels, {
                palette: frame.palette, 
                delay: delay 
            });
        });

        gifWriter.end();
        onRenderProgressCallback(1.0);
        
        frames = [];
        generatingGIF = false;

        callback(buffer);

    }


    // ---


    this.setSize = function(w, h) {
        width = w;
        height = h;
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext('2d');
    };


    // Internally, GIF uses tenths of seconds to store the delay
    this.setDelay = function(seconds) {

        delay = seconds * 0.1;

    };


    // From GIF: 0 = loop forever, null = not looping, n > 0 = loop n times and stop
    this.setRepeat = function(r) {

        repeat = r;

    };


    this.addFrame = function(element) {

        if(ctx === null) {
            this.setSize(width, height);
        }

        ctx.drawImage(element, 0, 0, width, height);
        var data = ctx.getImageData(0, 0, width, height);
        
        this.addFrameImageData(data.data);
    };


    this.addFrameImageData = function(imageData) {

        var dataLength = imageData.length,
            imageDataArray = new Uint8Array(imageData);

        frames.push({ data: imageDataArray, done: false, beingProcessed: false, position: frames.length });
    };


    this.onRenderProgress = function(callback) {

        onRenderProgressCallback = callback;

    };


    this.isRendering = function() {

        return generatingGIF;

    };


    this.getBase64GIF = function(completeCallback) {

        var onRenderComplete = function(buffer) {
            var str = bufferToString(buffer);
            var gif = 'data:image/gif;base64,' + btoa(str);
            completeCallback(gif);
        };

        startRendering(onRenderComplete);

    };

}

/*if(define) {
    define([], function() {
        return Animated_GIF;
    });
}*/

module.exports = Animated_GIF;

},{}],10:[function(require,module,exports){
/*! Hammer.JS - v1.0.6dev - 2013-04-10
 * http://eightmedia.github.com/hammer.js
 *
 * Copyright (c) 2013 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function(window, undefined) {
    'use strict';

/**
 * Hammer
 * use this to create instances
 * @param   {HTMLElement}   element
 * @param   {Object}        options
 * @returns {Hammer.Instance}
 * @constructor
 */
var Hammer = function(element, options) {
    return new Hammer.Instance(element, options || {});
};

// default settings
Hammer.defaults = {
    // add styles and attributes to the element to prevent the browser from doing
    // its native behavior. this doesnt prevent the scrolling, but cancels
    // the contextmenu, tap highlighting etc
    // set to false to disable this
    stop_browser_behavior: {
		// this also triggers onselectstart=false for IE
        userSelect: 'none',
		// this makes the element blocking in IE10 >, you could experiment with the value
		// see for more options this issue; https://github.com/EightMedia/hammer.js/issues/241
        touchAction: 'none',
		touchCallout: 'none',
        contentZooming: 'none',
        userDrag: 'none',
        tapHighlightColor: 'rgba(0,0,0,0)'
    }

    // more settings are defined per gesture at gestures.js
};

// detect touchevents
Hammer.HAS_POINTEREVENTS = navigator.pointerEnabled || navigator.msPointerEnabled;
Hammer.HAS_TOUCHEVENTS = ('ontouchstart' in window);

// dont use mouseevents on mobile devices
Hammer.MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;
Hammer.NO_MOUSEEVENTS = Hammer.HAS_TOUCHEVENTS && navigator.userAgent.match(Hammer.MOBILE_REGEX);

// eventtypes per touchevent (start, move, end)
// are filled by Hammer.event.determineEventTypes on setup
Hammer.EVENT_TYPES = {};

// direction defines
Hammer.DIRECTION_DOWN = 'down';
Hammer.DIRECTION_LEFT = 'left';
Hammer.DIRECTION_UP = 'up';
Hammer.DIRECTION_RIGHT = 'right';

// pointer type
Hammer.POINTER_MOUSE = 'mouse';
Hammer.POINTER_TOUCH = 'touch';
Hammer.POINTER_PEN = 'pen';

// touch event defines
Hammer.EVENT_START = 'start';
Hammer.EVENT_MOVE = 'move';
Hammer.EVENT_END = 'end';

// hammer document where the base events are added at
Hammer.DOCUMENT = document;

// plugins namespace
Hammer.plugins = {};

// if the window events are set...
Hammer.READY = false;

/**
 * setup events to detect gestures on the document
 */
function setup() {
    if(Hammer.READY) {
        return;
    }

    // find what eventtypes we add listeners to
    Hammer.event.determineEventTypes();

    // Register all gestures inside Hammer.gestures
    for(var name in Hammer.gestures) {
        if(Hammer.gestures.hasOwnProperty(name)) {
            Hammer.detection.register(Hammer.gestures[name]);
        }
    }

    // Add touch events on the document
    Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_MOVE, Hammer.detection.detect);
    Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_END, Hammer.detection.detect);

    // Hammer is ready...!
    Hammer.READY = true;
}

/**
 * create new hammer instance
 * all methods should return the instance itself, so it is chainable.
 * @param   {HTMLElement}       element
 * @param   {Object}            [options={}]
 * @returns {Hammer.Instance}
 * @constructor
 */
Hammer.Instance = function(element, options) {
    var self = this;

    // setup HammerJS window events and register all gestures
    // this also sets up the default options
    setup();

    this.element = element;

    // start/stop detection option
    this.enabled = true;

    // merge options
    this.options = Hammer.utils.extend(
        Hammer.utils.extend({}, Hammer.defaults),
        options || {});

    // add some css to the element to prevent the browser from doing its native behavoir
    if(this.options.stop_browser_behavior) {
        Hammer.utils.stopDefaultBrowserBehavior(this.element, this.options.stop_browser_behavior);
    }

    // start detection on touchstart
    Hammer.event.onTouch(element, Hammer.EVENT_START, function(ev) {
        if(self.enabled) {
            Hammer.detection.startDetect(self, ev);
        }
    });

    // return instance
    return this;
};


Hammer.Instance.prototype = {
    /**
     * bind events to the instance
     * @param   {String}      gesture
     * @param   {Function}    handler
     * @returns {Hammer.Instance}
     */
    on: function onEvent(gesture, handler){
        var gestures = gesture.split(' ');
        for(var t=0; t<gestures.length; t++) {
            this.element.addEventListener(gestures[t], handler, false);
        }
        return this;
    },


    /**
     * unbind events to the instance
     * @param   {String}      gesture
     * @param   {Function}    handler
     * @returns {Hammer.Instance}
     */
    off: function offEvent(gesture, handler){
        var gestures = gesture.split(' ');
        for(var t=0; t<gestures.length; t++) {
            this.element.removeEventListener(gestures[t], handler, false);
        }
        return this;
    },


    /**
     * trigger gesture event
     * @param   {String}      gesture
     * @param   {Object}      eventData
     * @returns {Hammer.Instance}
     */
    trigger: function triggerEvent(gesture, eventData){
        // create DOM event
        var event = Hammer.DOCUMENT.createEvent('Event');
		event.initEvent(gesture, true, true);
		event.gesture = eventData;

        // trigger on the target if it is in the instance element,
        // this is for event delegation tricks
        var element = this.element;
        if(Hammer.utils.hasParent(eventData.target, element)) {
            element = eventData.target;
        }

        element.dispatchEvent(event);
        return this;
    },


    /**
     * enable of disable hammer.js detection
     * @param   {Boolean}   state
     * @returns {Hammer.Instance}
     */
    enable: function enable(state) {
        this.enabled = state;
        return this;
    }
};

/**
 * this holds the last move event,
 * used to fix empty touchend issue
 * see the onTouch event for an explanation
 * @type {Object}
 */
var last_move_event = null;


/**
 * when the mouse is hold down, this is true
 * @type {Boolean}
 */
var enable_detect = false;


/**
 * when touch events have been fired, this is true
 * @type {Boolean}
 */
var touch_triggered = false;


Hammer.event = {
    /**
     * simple addEventListener
     * @param   {HTMLElement}   element
     * @param   {String}        type
     * @param   {Function}      handler
     */
    bindDom: function(element, type, handler) {
        var types = type.split(' ');
        for(var t=0; t<types.length; t++) {
            element.addEventListener(types[t], handler, false);
        }
    },


    /**
     * touch events with mouse fallback
     * @param   {HTMLElement}   element
     * @param   {String}        eventType        like Hammer.EVENT_MOVE
     * @param   {Function}      handler
     */
    onTouch: function onTouch(element, eventType, handler) {
		var self = this;

        this.bindDom(element, Hammer.EVENT_TYPES[eventType], function bindDomOnTouch(ev) {
            var sourceEventType = ev.type.toLowerCase();

            // onmouseup, but when touchend has been fired we do nothing.
            // this is for touchdevices which also fire a mouseup on touchend
            if(sourceEventType.match(/mouse/) && touch_triggered) {
                return;
            }

            // mousebutton must be down or a touch event
            else if( sourceEventType.match(/touch/) ||   // touch events are always on screen
                sourceEventType.match(/pointerdown/) || // pointerevents touch
                (sourceEventType.match(/mouse/) && ev.which === 1)   // mouse is pressed
            ){
                enable_detect = true;
            }

            // mouse isn't pressed
            else if(sourceEventType.match(/mouse/) && ev.which !== 1) {
                enable_detect = false;
            }


            // we are in a touch event, set the touch triggered bool to true,
            // this for the conflicts that may occur on ios and android
            if(sourceEventType.match(/touch|pointer/)) {
                touch_triggered = true;
            }

            // count the total touches on the screen
            var count_touches = 0;

            // when touch has been triggered in this detection session
            // and we are now handling a mouse event, we stop that to prevent conflicts
            if(enable_detect) {
                // update pointerevent
                if(Hammer.HAS_POINTEREVENTS && eventType != Hammer.EVENT_END) {
                    count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                }
                // touch
                else if(sourceEventType.match(/touch/)) {
                    count_touches = ev.touches.length;
                }
                // mouse
                else if(!touch_triggered) {
                    count_touches = sourceEventType.match(/up/) ? 0 : 1;
                }

                // if we are in a end event, but when we remove one touch and
                // we still have enough, set eventType to move
                if(count_touches > 0 && eventType == Hammer.EVENT_END) {
                    eventType = Hammer.EVENT_MOVE;
                }
                // no touches, force the end event
                else if(!count_touches) {
                    eventType = Hammer.EVENT_END;
                }

                // because touchend has no touches, and we often want to use these in our gestures,
                // we send the last move event as our eventData in touchend
                if(!count_touches && last_move_event !== null) {
                    ev = last_move_event;
                }
                // store the last move event
                else {
                    last_move_event = ev;
                }

                // trigger the handler
                handler.call(Hammer.detection, self.collectEventData(element, eventType, ev));

                // remove pointerevent from list
                if(Hammer.HAS_POINTEREVENTS && eventType == Hammer.EVENT_END) {
                    count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                }
            }

            //debug(sourceEventType +" "+ eventType);

            // on the end we reset everything
            if(!count_touches) {
                last_move_event = null;
                enable_detect = false;
                touch_triggered = false;
                Hammer.PointerEvent.reset();
            }
        });
    },


    /**
     * we have different events for each device/browser
     * determine what we need and set them in the Hammer.EVENT_TYPES constant
     */
    determineEventTypes: function determineEventTypes() {
        // determine the eventtype we want to set
        var types;

        // pointerEvents magic
        if(Hammer.HAS_POINTEREVENTS) {
            types = Hammer.PointerEvent.getEvents();
        }
        // on Android, iOS, blackberry, windows mobile we dont want any mouseevents
        else if(Hammer.NO_MOUSEEVENTS) {
            types = [
                'touchstart',
                'touchmove',
                'touchend touchcancel'];
        }
        // for non pointer events browsers and mixed browsers,
        // like chrome on windows8 touch laptop
        else {
            types = [
                'touchstart mousedown',
                'touchmove mousemove',
                'touchend touchcancel mouseup'];
        }

        Hammer.EVENT_TYPES[Hammer.EVENT_START]  = types[0];
        Hammer.EVENT_TYPES[Hammer.EVENT_MOVE]   = types[1];
        Hammer.EVENT_TYPES[Hammer.EVENT_END]    = types[2];
    },


    /**
     * create touchlist depending on the event
     * @param   {Object}    ev
     * @param   {String}    eventType   used by the fakemultitouch plugin
     */
    getTouchList: function getTouchList(ev/*, eventType*/) {
        // get the fake pointerEvent touchlist
        if(Hammer.HAS_POINTEREVENTS) {
            return Hammer.PointerEvent.getTouchList();
        }
        // get the touchlist
        else if(ev.touches) {
            return ev.touches;
        }
        // make fake touchlist from mouse position
        else {
            return [{
                identifier: 1,
                pageX: ev.pageX,
                pageY: ev.pageY,
                target: ev.target
            }];
        }
    },


    /**
     * collect event data for Hammer js
     * @param   {HTMLElement}   element
     * @param   {String}        eventType        like Hammer.EVENT_MOVE
     * @param   {Object}        eventData
     */
    collectEventData: function collectEventData(element, eventType, ev) {
        var touches = this.getTouchList(ev, eventType);

        // find out pointerType
        var pointerType = Hammer.POINTER_TOUCH;
        if(ev.type.match(/mouse/) || Hammer.PointerEvent.matchType(Hammer.POINTER_MOUSE, ev)) {
            pointerType = Hammer.POINTER_MOUSE;
        }

        return {
            center      : Hammer.utils.getCenter(touches),
            timeStamp   : new Date().getTime(),
            target      : ev.target,
            touches     : touches,
            eventType   : eventType,
            pointerType : pointerType,
            srcEvent    : ev,

            /**
             * prevent the browser default actions
             * mostly used to disable scrolling of the browser
             */
            preventDefault: function() {
                if(this.srcEvent.preventManipulation) {
                    this.srcEvent.preventManipulation();
                }

                if(this.srcEvent.preventDefault) {
                    this.srcEvent.preventDefault();
                }
            },

            /**
             * stop bubbling the event up to its parents
             */
            stopPropagation: function() {
                this.srcEvent.stopPropagation();
            },

            /**
             * immediately stop gesture detection
             * might be useful after a swipe was detected
             * @return {*}
             */
            stopDetect: function() {
                return Hammer.detection.stopDetect();
            }
        };
    }
};

Hammer.PointerEvent = {
    /**
     * holds all pointers
     * @type {Object}
     */
    pointers: {},

    /**
     * get a list of pointers
     * @returns {Array}     touchlist
     */
    getTouchList: function() {
        var self = this;
        var touchlist = [];

        // we can use forEach since pointerEvents only is in IE10
        Object.keys(self.pointers).sort().forEach(function(id) {
            touchlist.push(self.pointers[id]);
        });
        return touchlist;
    },

    /**
     * update the position of a pointer
     * @param   {String}   type             Hammer.EVENT_END
     * @param   {Object}   pointerEvent
     */
    updatePointer: function(type, pointerEvent) {
        if(type == Hammer.EVENT_END) {
            this.pointers = {};
        }
        else {
            pointerEvent.identifier = pointerEvent.pointerId;
            this.pointers[pointerEvent.pointerId] = pointerEvent;
        }

        return Object.keys(this.pointers).length;
    },

    /**
     * check if ev matches pointertype
     * @param   {String}        pointerType     Hammer.POINTER_MOUSE
     * @param   {PointerEvent}  ev
     */
    matchType: function(pointerType, ev) {
        if(!ev.pointerType) {
            return false;
        }

        var types = {};
        types[Hammer.POINTER_MOUSE] = (ev.pointerType == ev.MSPOINTER_TYPE_MOUSE || ev.pointerType == Hammer.POINTER_MOUSE);
        types[Hammer.POINTER_TOUCH] = (ev.pointerType == ev.MSPOINTER_TYPE_TOUCH || ev.pointerType == Hammer.POINTER_TOUCH);
        types[Hammer.POINTER_PEN] = (ev.pointerType == ev.MSPOINTER_TYPE_PEN || ev.pointerType == Hammer.POINTER_PEN);
        return types[pointerType];
    },


    /**
     * get events
     */
    getEvents: function() {
        return [
            'pointerdown MSPointerDown',
            'pointermove MSPointerMove',
            'pointerup pointercancel MSPointerUp MSPointerCancel'
        ];
    },

    /**
     * reset the list
     */
    reset: function() {
        this.pointers = {};
    }
};


Hammer.utils = {
    /**
     * extend method,
     * also used for cloning when dest is an empty object
     * @param   {Object}    dest
     * @param   {Object}    src
	 * @parm	{Boolean}	merge		do a merge
     * @returns {Object}    dest
     */
    extend: function extend(dest, src, merge) {
        for (var key in src) {
			if(dest[key] !== undefined && merge) {
				continue;
			}
            dest[key] = src[key];
        }
        return dest;
    },


    /**
     * find if a node is in the given parent
     * used for event delegation tricks
     * @param   {HTMLElement}   node
     * @param   {HTMLElement}   parent
     * @returns {boolean}       has_parent
     */
    hasParent: function(node, parent) {
        while(node){
            if(node == parent) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    },


    /**
     * get the center of all the touches
     * @param   {Array}     touches
     * @returns {Object}    center
     */
    getCenter: function getCenter(touches) {
        var valuesX = [], valuesY = [];

        for(var t= 0,len=touches.length; t<len; t++) {
            valuesX.push(touches[t].pageX);
            valuesY.push(touches[t].pageY);
        }

        return {
            pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
            pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
        };
    },


    /**
     * calculate the velocity between two points
     * @param   {Number}    delta_time
     * @param   {Number}    delta_x
     * @param   {Number}    delta_y
     * @returns {Object}    velocity
     */
    getVelocity: function getVelocity(delta_time, delta_x, delta_y) {
        return {
            x: Math.abs(delta_x / delta_time) || 0,
            y: Math.abs(delta_y / delta_time) || 0
        };
    },


    /**
     * calculate the angle between two coordinates
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {Number}    angle
     */
    getAngle: function getAngle(touch1, touch2) {
        var y = touch2.pageY - touch1.pageY,
            x = touch2.pageX - touch1.pageX;
        return Math.atan2(y, x) * 180 / Math.PI;
    },


    /**
     * angle to direction define
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {String}    direction constant, like Hammer.DIRECTION_LEFT
     */
    getDirection: function getDirection(touch1, touch2) {
        var x = Math.abs(touch1.pageX - touch2.pageX),
            y = Math.abs(touch1.pageY - touch2.pageY);

        if(x >= y) {
            return touch1.pageX - touch2.pageX > 0 ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
        }
        else {
            return touch1.pageY - touch2.pageY > 0 ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
        }
    },


    /**
     * calculate the distance between two touches
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {Number}    distance
     */
    getDistance: function getDistance(touch1, touch2) {
        var x = touch2.pageX - touch1.pageX,
            y = touch2.pageY - touch1.pageY;
        return Math.sqrt((x*x) + (y*y));
    },


    /**
     * calculate the scale factor between two touchLists (fingers)
     * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
     * @param   {Array}     start
     * @param   {Array}     end
     * @returns {Number}    scale
     */
    getScale: function getScale(start, end) {
        // need two fingers...
        if(start.length >= 2 && end.length >= 2) {
            return this.getDistance(end[0], end[1]) /
                this.getDistance(start[0], start[1]);
        }
        return 1;
    },


    /**
     * calculate the rotation degrees between two touchLists (fingers)
     * @param   {Array}     start
     * @param   {Array}     end
     * @returns {Number}    rotation
     */
    getRotation: function getRotation(start, end) {
        // need two fingers
        if(start.length >= 2 && end.length >= 2) {
            return this.getAngle(end[1], end[0]) -
                this.getAngle(start[1], start[0]);
        }
        return 0;
    },


    /**
     * boolean if the direction is vertical
     * @param    {String}    direction
     * @returns  {Boolean}   is_vertical
     */
    isVertical: function isVertical(direction) {
        return (direction == Hammer.DIRECTION_UP || direction == Hammer.DIRECTION_DOWN);
    },


    /**
     * stop browser default behavior with css props
     * @param   {HtmlElement}   element
     * @param   {Object}        css_props
     */
    stopDefaultBrowserBehavior: function stopDefaultBrowserBehavior(element, css_props) {
        var prop,
            vendors = ['webkit','khtml','moz','ms','o',''];

        if(!css_props || !element.style) {
            return;
        }

        // with css properties for modern browsers
        for(var i = 0; i < vendors.length; i++) {
            for(var p in css_props) {
                if(css_props.hasOwnProperty(p)) {
                    prop = p;

                    // vender prefix at the property
                    if(vendors[i]) {
                        prop = vendors[i] + prop.substring(0, 1).toUpperCase() + prop.substring(1);
                    }

                    // set the style
                    element.style[prop] = css_props[p];
                }
            }
        }

        // also the disable onselectstart
        if(css_props.userSelect == 'none') {
            element.onselectstart = function() {
                return false;
            };
        }
    }
};

Hammer.detection = {
    // contains all registred Hammer.gestures in the correct order
    gestures: [],

    // data of the current Hammer.gesture detection session
    current: null,

    // the previous Hammer.gesture session data
    // is a full clone of the previous gesture.current object
    previous: null,

    // when this becomes true, no gestures are fired
    stopped: false,


    /**
     * start Hammer.gesture detection
     * @param   {Hammer.Instance}   inst
     * @param   {Object}            eventData
     */
    startDetect: function startDetect(inst, eventData) {
        // already busy with a Hammer.gesture detection on an element
        if(this.current) {
            return;
        }

        this.stopped = false;

        this.current = {
            inst        : inst, // reference to HammerInstance we're working for
            startEvent  : Hammer.utils.extend({}, eventData), // start eventData for distances, timing etc
            lastEvent   : false, // last eventData
            name        : '' // current gesture we're in/detected, can be 'tap', 'hold' etc
        };

        this.detect(eventData);
    },


    /**
     * Hammer.gesture detection
     * @param   {Object}    eventData
     * @param   {Object}    eventData
     */
    detect: function detect(eventData) {
        if(!this.current || this.stopped) {
            return;
        }

        // extend event data with calculations about scale, distance etc
        eventData = this.extendEventData(eventData);

        // instance options
        var inst_options = this.current.inst.options;

        // call Hammer.gesture handlers
        for(var g=0,len=this.gestures.length; g<len; g++) {
            var gesture = this.gestures[g];

            // only when the instance options have enabled this gesture
            if(!this.stopped && inst_options[gesture.name] !== false) {
                // if a handler returns false, we stop with the detection
                if(gesture.handler.call(gesture, eventData, this.current.inst) === false) {
                    this.stopDetect();
                    break;
                }
            }
        }

        // store as previous event event
        if(this.current) {
            this.current.lastEvent = eventData;
        }

        // endevent, but not the last touch, so dont stop
        if(eventData.eventType == Hammer.EVENT_END && !eventData.touches.length-1) {
            this.stopDetect();
        }

        return eventData;
    },


    /**
     * clear the Hammer.gesture vars
     * this is called on endDetect, but can also be used when a final Hammer.gesture has been detected
     * to stop other Hammer.gestures from being fired
     */
    stopDetect: function stopDetect() {
        // clone current data to the store as the previous gesture
        // used for the double tap gesture, since this is an other gesture detect session
        this.previous = Hammer.utils.extend({}, this.current);

        // reset the current
        this.current = null;

        // stopped!
        this.stopped = true;
    },


    /**
     * extend eventData for Hammer.gestures
     * @param   {Object}   ev
     * @returns {Object}   ev
     */
    extendEventData: function extendEventData(ev) {
        var startEv = this.current.startEvent;

        // if the touches change, set the new touches over the startEvent touches
        // this because touchevents don't have all the touches on touchstart, or the
        // user must place his fingers at the EXACT same time on the screen, which is not realistic
        // but, sometimes it happens that both fingers are touching at the EXACT same time
        if(startEv && (ev.touches.length != startEv.touches.length || ev.touches === startEv.touches)) {
            // extend 1 level deep to get the touchlist with the touch objects
            startEv.touches = [];
            for(var i=0,len=ev.touches.length; i<len; i++) {
                startEv.touches.push(Hammer.utils.extend({}, ev.touches[i]));
            }
        }

        var delta_time = ev.timeStamp - startEv.timeStamp,
            delta_x = ev.center.pageX - startEv.center.pageX,
            delta_y = ev.center.pageY - startEv.center.pageY,
            velocity = Hammer.utils.getVelocity(delta_time, delta_x, delta_y);

        Hammer.utils.extend(ev, {
            deltaTime   : delta_time,

            deltaX      : delta_x,
            deltaY      : delta_y,

            velocityX   : velocity.x,
            velocityY   : velocity.y,

            distance    : Hammer.utils.getDistance(startEv.center, ev.center),
            angle       : Hammer.utils.getAngle(startEv.center, ev.center),
            direction   : Hammer.utils.getDirection(startEv.center, ev.center),

            scale       : Hammer.utils.getScale(startEv.touches, ev.touches),
            rotation    : Hammer.utils.getRotation(startEv.touches, ev.touches),

            startEvent  : startEv
        });

        return ev;
    },


    /**
     * register new gesture
     * @param   {Object}    gesture object, see gestures.js for documentation
     * @returns {Array}     gestures
     */
    register: function register(gesture) {
        // add an enable gesture options if there is no given
        var options = gesture.defaults || {};
        if(options[gesture.name] === undefined) {
            options[gesture.name] = true;
        }

        // extend Hammer default options with the Hammer.gesture options
        Hammer.utils.extend(Hammer.defaults, options, true);

        // set its index
        gesture.index = gesture.index || 1000;

        // add Hammer.gesture to the list
        this.gestures.push(gesture);

        // sort the list by index
        this.gestures.sort(function(a, b) {
            if (a.index < b.index) {
                return -1;
            }
            if (a.index > b.index) {
                return 1;
            }
            return 0;
        });

        return this.gestures;
    }
};


Hammer.gestures = Hammer.gestures || {};

/**
 * Custom gestures
 * ==============================
 *
 * Gesture object
 * --------------------
 * The object structure of a gesture:
 *
 * { name: 'mygesture',
 *   index: 1337,
 *   defaults: {
 *     mygesture_option: true
 *   }
 *   handler: function(type, ev, inst) {
 *     // trigger gesture event
 *     inst.trigger(this.name, ev);
 *   }
 * }

 * @param   {String}    name
 * this should be the name of the gesture, lowercase
 * it is also being used to disable/enable the gesture per instance config.
 *
 * @param   {Number}    [index=1000]
 * the index of the gesture, where it is going to be in the stack of gestures detection
 * like when you build an gesture that depends on the drag gesture, it is a good
 * idea to place it after the index of the drag gesture.
 *
 * @param   {Object}    [defaults={}]
 * the default settings of the gesture. these are added to the instance settings,
 * and can be overruled per instance. you can also add the name of the gesture,
 * but this is also added by default (and set to true).
 *
 * @param   {Function}  handler
 * this handles the gesture detection of your custom gesture and receives the
 * following arguments:
 *
 *      @param  {Object}    eventData
 *      event data containing the following properties:
 *          timeStamp   {Number}        time the event occurred
 *          target      {HTMLElement}   target element
 *          touches     {Array}         touches (fingers, pointers, mouse) on the screen
 *          pointerType {String}        kind of pointer that was used. matches Hammer.POINTER_MOUSE|TOUCH
 *          center      {Object}        center position of the touches. contains pageX and pageY
 *          deltaTime   {Number}        the total time of the touches in the screen
 *          deltaX      {Number}        the delta on x axis we haved moved
 *          deltaY      {Number}        the delta on y axis we haved moved
 *          velocityX   {Number}        the velocity on the x
 *          velocityY   {Number}        the velocity on y
 *          angle       {Number}        the angle we are moving
 *          direction   {String}        the direction we are moving. matches Hammer.DIRECTION_UP|DOWN|LEFT|RIGHT
 *          distance    {Number}        the distance we haved moved
 *          scale       {Number}        scaling of the touches, needs 2 touches
 *          rotation    {Number}        rotation of the touches, needs 2 touches *
 *          eventType   {String}        matches Hammer.EVENT_START|MOVE|END
 *          srcEvent    {Object}        the source event, like TouchStart or MouseDown *
 *          startEvent  {Object}        contains the same properties as above,
 *                                      but from the first touch. this is used to calculate
 *                                      distances, deltaTime, scaling etc
 *
 *      @param  {Hammer.Instance}    inst
 *      the instance we are doing the detection for. you can get the options from
 *      the inst.options object and trigger the gesture event by calling inst.trigger
 *
 *
 * Handle gestures
 * --------------------
 * inside the handler you can get/set Hammer.detection.current. This is the current
 * detection session. It has the following properties
 *      @param  {String}    name
 *      contains the name of the gesture we have detected. it has not a real function,
 *      only to check in other gestures if something is detected.
 *      like in the drag gesture we set it to 'drag' and in the swipe gesture we can
 *      check if the current gesture is 'drag' by accessing Hammer.detection.current.name
 *
 *      @readonly
 *      @param  {Hammer.Instance}    inst
 *      the instance we do the detection for
 *
 *      @readonly
 *      @param  {Object}    startEvent
 *      contains the properties of the first gesture detection in this session.
 *      Used for calculations about timing, distance, etc.
 *
 *      @readonly
 *      @param  {Object}    lastEvent
 *      contains all the properties of the last gesture detect in this session.
 *
 * after the gesture detection session has been completed (user has released the screen)
 * the Hammer.detection.current object is copied into Hammer.detection.previous,
 * this is usefull for gestures like doubletap, where you need to know if the
 * previous gesture was a tap
 *
 * options that have been set by the instance can be received by calling inst.options
 *
 * You can trigger a gesture event by calling inst.trigger("mygesture", event).
 * The first param is the name of your gesture, the second the event argument
 *
 *
 * Register gestures
 * --------------------
 * When an gesture is added to the Hammer.gestures object, it is auto registered
 * at the setup of the first Hammer instance. You can also call Hammer.detection.register
 * manually and pass your gesture object as a param
 *
 */

/**
 * Hold
 * Touch stays at the same place for x time
 * @events  hold
 */
Hammer.gestures.Hold = {
    name: 'hold',
    index: 10,
    defaults: {
        hold_timeout	: 500,
        hold_threshold	: 1
    },
    timer: null,
    handler: function holdGesture(ev, inst) {
        switch(ev.eventType) {
            case Hammer.EVENT_START:
                // clear any running timers
                clearTimeout(this.timer);

                // set the gesture so we can check in the timeout if it still is
                Hammer.detection.current.name = this.name;

                // set timer and if after the timeout it still is hold,
                // we trigger the hold event
                this.timer = setTimeout(function() {
                    if(Hammer.detection.current.name == 'hold') {
                        inst.trigger('hold', ev);
                    }
                }, inst.options.hold_timeout);
                break;

            // when you move or end we clear the timer
            case Hammer.EVENT_MOVE:
                if(ev.distance > inst.options.hold_threshold) {
                    clearTimeout(this.timer);
                }
                break;

            case Hammer.EVENT_END:
                clearTimeout(this.timer);
                break;
        }
    }
};


/**
 * Tap/DoubleTap
 * Quick touch at a place or double at the same place
 * @events  tap, doubletap
 */
Hammer.gestures.Tap = {
    name: 'tap',
    index: 100,
    defaults: {
        tap_max_touchtime	: 250,
        tap_max_distance	: 10,
		tap_always			: true,
        doubletap_distance	: 20,
        doubletap_interval	: 300
    },
    handler: function tapGesture(ev, inst) {
        if(ev.eventType == Hammer.EVENT_END) {
            // previous gesture, for the double tap since these are two different gesture detections
            var prev = Hammer.detection.previous,
				did_doubletap = false;

            // when the touchtime is higher then the max touch time
            // or when the moving distance is too much
            if(ev.deltaTime > inst.options.tap_max_touchtime ||
                ev.distance > inst.options.tap_max_distance) {
                return;
            }

            // check if double tap
            if(prev && prev.name == 'tap' &&
                (ev.timeStamp - prev.lastEvent.timeStamp) < inst.options.doubletap_interval &&
                ev.distance < inst.options.doubletap_distance) {
				inst.trigger('doubletap', ev);
				did_doubletap = true;
            }

			// do a single tap
			if(!did_doubletap || inst.options.tap_always) {
				Hammer.detection.current.name = 'tap';
				inst.trigger(Hammer.detection.current.name, ev);
			}
        }
    }
};


/**
 * Swipe
 * triggers swipe events when the end velocity is above the threshold
 * @events  swipe, swipeleft, swiperight, swipeup, swipedown
 */
Hammer.gestures.Swipe = {
    name: 'swipe',
    index: 40,
    defaults: {
        // set 0 for unlimited, but this can conflict with transform
        swipe_max_touches  : 1,
        swipe_velocity     : 0.7
    },
    handler: function swipeGesture(ev, inst) {
        if(ev.eventType == Hammer.EVENT_END) {
            // max touches
            if(inst.options.swipe_max_touches > 0 &&
                ev.touches.length > inst.options.swipe_max_touches) {
                return;
            }

            // when the distance we moved is too small we skip this gesture
            // or we can be already in dragging
            if(ev.velocityX > inst.options.swipe_velocity ||
                ev.velocityY > inst.options.swipe_velocity) {
                // trigger swipe events
                inst.trigger(this.name, ev);
                inst.trigger(this.name + ev.direction, ev);
            }
        }
    }
};


/**
 * Drag
 * Move with x fingers (default 1) around on the page. Blocking the scrolling when
 * moving left and right is a good practice. When all the drag events are blocking
 * you disable scrolling on that area.
 * @events  drag, drapleft, dragright, dragup, dragdown
 */
Hammer.gestures.Drag = {
    name: 'drag',
    index: 50,
    defaults: {
        drag_min_distance : 10,
        // set 0 for unlimited, but this can conflict with transform
        drag_max_touches  : 1,
        // prevent default browser behavior when dragging occurs
        // be careful with it, it makes the element a blocking element
        // when you are using the drag gesture, it is a good practice to set this true
        drag_block_horizontal   : false,
        drag_block_vertical     : false,
        // drag_lock_to_axis keeps the drag gesture on the axis that it started on,
        // It disallows vertical directions if the initial direction was horizontal, and vice versa.
        drag_lock_to_axis       : false,
        // drag lock only kicks in when distance > drag_lock_min_distance
        // This way, locking occurs only when the distance has become large enough to reliably determine the direction
        drag_lock_min_distance : 25
    },
    triggered: false,
    handler: function dragGesture(ev, inst) {
        // current gesture isnt drag, but dragged is true
        // this means an other gesture is busy. now call dragend
        if(Hammer.detection.current.name != this.name && this.triggered) {
            inst.trigger(this.name +'end', ev);
            this.triggered = false;
            return;
        }

        // max touches
        if(inst.options.drag_max_touches > 0 &&
            ev.touches.length > inst.options.drag_max_touches) {
            return;
        }

        switch(ev.eventType) {
            case Hammer.EVENT_START:
                this.triggered = false;
                break;

            case Hammer.EVENT_MOVE:
                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(ev.distance < inst.options.drag_min_distance &&
                    Hammer.detection.current.name != this.name) {
                    return;
                }

                // we are dragging!
                Hammer.detection.current.name = this.name;

                // lock drag to axis?
                if(Hammer.detection.current.lastEvent.drag_locked_to_axis || (inst.options.drag_lock_to_axis && inst.options.drag_lock_min_distance<=ev.distance)) {
                    ev.drag_locked_to_axis = true;
                }
                var last_direction = Hammer.detection.current.lastEvent.direction;
                if(ev.drag_locked_to_axis && last_direction !== ev.direction) {
                    // keep direction on the axis that the drag gesture started on
                    if(Hammer.utils.isVertical(last_direction)) {
                        ev.direction = (ev.deltaY < 0) ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
                    }
                    else {
                        ev.direction = (ev.deltaX < 0) ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
                    }
                }

                // first time, trigger dragstart event
                if(!this.triggered) {
                    inst.trigger(this.name +'start', ev);
                    this.triggered = true;
                }

                // trigger normal event
                inst.trigger(this.name, ev);

                // direction event, like dragdown
                inst.trigger(this.name + ev.direction, ev);

                // block the browser events
                if( (inst.options.drag_block_vertical && Hammer.utils.isVertical(ev.direction)) ||
                    (inst.options.drag_block_horizontal && !Hammer.utils.isVertical(ev.direction))) {
                    ev.preventDefault();
                }
                break;

            case Hammer.EVENT_END:
                // trigger dragend
                if(this.triggered) {
                    inst.trigger(this.name +'end', ev);
                }

                this.triggered = false;
                break;
        }
    }
};


/**
 * Transform
 * User want to scale or rotate with 2 fingers
 * @events  transform, pinch, pinchin, pinchout, rotate
 */
Hammer.gestures.Transform = {
    name: 'transform',
    index: 45,
    defaults: {
        // factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
        transform_min_scale     : 0.01,
        // rotation in degrees
        transform_min_rotation  : 1,
        // prevent default browser behavior when two touches are on the screen
        // but it makes the element a blocking element
        // when you are using the transform gesture, it is a good practice to set this true
        transform_always_block  : false
    },
    triggered: false,
    handler: function transformGesture(ev, inst) {
        // current gesture isnt drag, but dragged is true
        // this means an other gesture is busy. now call dragend
        if(Hammer.detection.current.name != this.name && this.triggered) {
            inst.trigger(this.name +'end', ev);
            this.triggered = false;
            return;
        }

        // atleast multitouch
        if(ev.touches.length < 2) {
            return;
        }

        // prevent default when two fingers are on the screen
        if(inst.options.transform_always_block) {
            ev.preventDefault();
        }

        switch(ev.eventType) {
            case Hammer.EVENT_START:
                this.triggered = false;
                break;

            case Hammer.EVENT_MOVE:
                var scale_threshold = Math.abs(1-ev.scale);
                var rotation_threshold = Math.abs(ev.rotation);

                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(scale_threshold < inst.options.transform_min_scale &&
                    rotation_threshold < inst.options.transform_min_rotation) {
                    return;
                }

                // we are transforming!
                Hammer.detection.current.name = this.name;

                // first time, trigger dragstart event
                if(!this.triggered) {
                    inst.trigger(this.name +'start', ev);
                    this.triggered = true;
                }

                inst.trigger(this.name, ev); // basic transform event

                // trigger rotate event
                if(rotation_threshold > inst.options.transform_min_rotation) {
                    inst.trigger('rotate', ev);
                }

                // trigger pinch event
                if(scale_threshold > inst.options.transform_min_scale) {
                    inst.trigger('pinch', ev);
                    inst.trigger('pinch'+ ((ev.scale < 1) ? 'in' : 'out'), ev);
                }
                break;

            case Hammer.EVENT_END:
                // trigger dragend
                if(this.triggered) {
                    inst.trigger(this.name +'end', ev);
                }

                this.triggered = false;
                break;
        }
    }
};


/**
 * Touch
 * Called as first, tells the user has touched the screen
 * @events  touch
 */
Hammer.gestures.Touch = {
    name: 'touch',
    index: -Infinity,
    defaults: {
        // call preventDefault at touchstart, and makes the element blocking by
        // disabling the scrolling of the page, but it improves gestures like
        // transforming and dragging.
        // be careful with using this, it can be very annoying for users to be stuck
        // on the page
        prevent_default: false,

        // disable mouse events, so only touch (or pen!) input triggers events
        prevent_mouseevents: false
    },
    handler: function touchGesture(ev, inst) {
        if(inst.options.prevent_mouseevents && ev.pointerType == Hammer.POINTER_MOUSE) {
            ev.stopDetect();
            return;
        }

        if(inst.options.prevent_default) {
            ev.preventDefault();
        }

        if(ev.eventType ==  Hammer.EVENT_START) {
            inst.trigger(this.name, ev);
        }
    }
};


/**
 * Release
 * Called as last, tells the user has released the screen
 * @events  release
 */
Hammer.gestures.Release = {
    name: 'release',
    index: Infinity,
    handler: function releaseGesture(ev, inst) {
        if(ev.eventType ==  Hammer.EVENT_END) {
            inst.trigger(this.name, ev);
        }
    }
};

// node export
if(typeof module === 'object' && typeof module.exports === 'object'){
    module.exports = Hammer;
}
// just window export
else {
    window.Hammer = Hammer;

    // requireJS module definition
    if(typeof window.define === 'function' && window.define.amd) {
        window.define('hammer', [], function() {
            return Hammer;
        });
    }
}
})(this);

},{}],11:[function(require,module,exports){
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

//'use strict';

/**
 * This file defines an asynchronous version of the localStorage API, backed by
 * an IndexedDB database.  It creates a global asyncStorage object that has
 * methods like the localStorage object.
 *
 * To store a value use setItem:
 *
 *   asyncStorage.setItem('key', 'value');
 *
 * If you want confirmation that the value has been stored, pass a callback
 * function as the third argument:
 *
 *  asyncStorage.setItem('key', 'newvalue', function() {
 *    console.log('new value stored');
 *  });
 *
 * To read a value, call getItem(), but note that you must supply a callback
 * function that the value will be passed to asynchronously:
 *
 *  asyncStorage.getItem('key', function(value) {
 *    console.log('The value of key is:', value);
 *  });
 *
 * Note that unlike localStorage, asyncStorage does not allow you to store and
 * retrieve values by setting and querying properties directly. You cannot just
 * write asyncStorage.key; you have to explicitly call setItem() or getItem().
 *
 * removeItem(), clear(), length(), and key() are like the same-named methods of
 * localStorage, but, like getItem() and setItem() they take a callback
 * argument.
 *
 * The asynchronous nature of getItem() makes it tricky to retrieve multiple
 * values. But unlike localStorage, asyncStorage does not require the values you
 * store to be strings.  So if you need to save multiple values and want to
 * retrieve them together, in a single asynchronous operation, just group the
 * values into a single object. The properties of this object may not include
 * DOM elements, but they may include things like Blobs and typed arrays.
 *
 * Unit tests are in apps/gallery/test/unit/asyncStorage_test.js
 */

//this.asyncStorage = (function() {
var asyncStorage = (function() {

  var DBNAME = 'asyncStorage';
  var DBVERSION = 1;
  var STORENAME = 'keyvaluepairs';
  var db = null;

  function withStore(type, f) {
    if (db) {
      f(db.transaction(STORENAME, type).objectStore(STORENAME));
    } else {
      var openreq = indexedDB.open(DBNAME, DBVERSION);
      openreq.onerror = function withStoreOnError() {
        console.error("asyncStorage: can't open database:", openreq.error.name);
      };
      openreq.onupgradeneeded = function withStoreOnUpgradeNeeded() {
        // First time setup: create an empty object store
        openreq.result.createObjectStore(STORENAME);
      };
      openreq.onsuccess = function withStoreOnSuccess() {
        db = openreq.result;
        f(db.transaction(STORENAME, type).objectStore(STORENAME));
      };
    }
  }

  function getItem(key, callback) {
    withStore('readonly', function getItemBody(store) {
      var req = store.get(key);
      req.onsuccess = function getItemOnSuccess() {
        var value = req.result;
        if (value === undefined)
          value = null;
        callback(value);
      };
      req.onerror = function getItemOnError() {
        console.error('Error in asyncStorage.getItem(): ', req.error.name);
      };
    });
  }

  function setItem(key, value, callback) {
    withStore('readwrite', function setItemBody(store) {
      var req = store.put(value, key);
      if (callback) {
        req.onsuccess = function setItemOnSuccess() {
          callback();
        };
      }
      req.onerror = function setItemOnError() {
        console.error('Error in asyncStorage.setItem(): ', req.error.name);
      };
    });
  }

  function removeItem(key, callback) {
    withStore('readwrite', function removeItemBody(store) {
      var req = store.delete(key);
      if (callback) {
        req.onsuccess = function removeItemOnSuccess() {
          callback();
        };
      }
      req.onerror = function removeItemOnError() {
        console.error('Error in asyncStorage.removeItem(): ', req.error.name);
      };
    });
  }

  function clear(callback) {
    withStore('readwrite', function clearBody(store) {
      var req = store.clear();
      if (callback) {
        req.onsuccess = function clearOnSuccess() {
          callback();
        };
      }
      req.onerror = function clearOnError() {
        console.error('Error in asyncStorage.clear(): ', req.error.name);
      };
    });
  }

  function length(callback) {
    withStore('readonly', function lengthBody(store) {
      var req = store.count();
      req.onsuccess = function lengthOnSuccess() {
        callback(req.result);
      };
      req.onerror = function lengthOnError() {
        console.error('Error in asyncStorage.length(): ', req.error.name);
      };
    });
  }

  function key(n, callback) {
    if (n < 0) {
      callback(null);
      return;
    }

    withStore('readonly', function keyBody(store) {
      var advanced = false;
      var req = store.openCursor();
      req.onsuccess = function keyOnSuccess() {
        var cursor = req.result;
        if (!cursor) {
          // this means there weren't enough keys
          callback(null);
          return;
        }
        if (n === 0) {
          // We have the first key, return it if that's what they wanted
          callback(cursor.key);
        } else {
          if (!advanced) {
            // Otherwise, ask the cursor to skip ahead n records
            advanced = true;
            cursor.advance(n);
          } else {
            // When we get here, we've got the nth key.
            callback(cursor.key);
          }
        }
      };
      req.onerror = function keyOnError() {
        console.error('Error in asyncStorage.key(): ', req.error.name);
      };
    });
  }

  return {
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    clear: clear,
    length: length,
    key: key
  };
}());


window.asyncStorage = asyncStorage;

module.exports = asyncStorage;

},{}],12:[function(require,module,exports){
/**
 * @fileoverview gl-matrix - High performance matrix and vector operations
 * @author Brandon Jones
 * @author Colin MacKenzie IV
 * @version 2.2.0
 */
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
(function(e){"use strict";var t={};typeof exports=="undefined"?typeof define=="function"&&typeof define.amd=="object"&&define.amd?(t.exports={},define(function(){return t.exports})):t.exports=typeof window!="undefined"?window:e:t.exports=exports,function(e){if(!t)var t=1e-6;if(!n)var n=typeof Float32Array!="undefined"?Float32Array:Array;if(!r)var r=Math.random;var i={};i.setMatrixArrayType=function(e){n=e},typeof e!="undefined"&&(e.glMatrix=i);var s={};s.create=function(){var e=new n(2);return e[0]=0,e[1]=0,e},s.clone=function(e){var t=new n(2);return t[0]=e[0],t[1]=e[1],t},s.fromValues=function(e,t){var r=new n(2);return r[0]=e,r[1]=t,r},s.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e},s.set=function(e,t,n){return e[0]=t,e[1]=n,e},s.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e},s.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e},s.sub=s.subtract,s.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e},s.mul=s.multiply,s.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e},s.div=s.divide,s.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e},s.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e},s.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e},s.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e},s.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1];return Math.sqrt(n*n+r*r)},s.dist=s.distance,s.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1];return n*n+r*r},s.sqrDist=s.squaredDistance,s.length=function(e){var t=e[0],n=e[1];return Math.sqrt(t*t+n*n)},s.len=s.length,s.squaredLength=function(e){var t=e[0],n=e[1];return t*t+n*n},s.sqrLen=s.squaredLength,s.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e},s.normalize=function(e,t){var n=t[0],r=t[1],i=n*n+r*r;return i>0&&(i=1/Math.sqrt(i),e[0]=t[0]*i,e[1]=t[1]*i),e},s.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]},s.cross=function(e,t,n){var r=t[0]*n[1]-t[1]*n[0];return e[0]=e[1]=0,e[2]=r,e},s.lerp=function(e,t,n,r){var i=t[0],s=t[1];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e},s.random=function(e,t){t=t||1;var n=r()*2*Math.PI;return e[0]=Math.cos(n)*t,e[1]=Math.sin(n)*t,e},s.transformMat2=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i,e[1]=n[1]*r+n[3]*i,e},s.transformMat2d=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i+n[4],e[1]=n[1]*r+n[3]*i+n[5],e},s.transformMat3=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[3]*i+n[6],e[1]=n[1]*r+n[4]*i+n[7],e},s.transformMat4=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[4]*i+n[12],e[1]=n[1]*r+n[5]*i+n[13],e},s.forEach=function(){var e=s.create();return function(t,n,r,i,s,o){var u,a;n||(n=2),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],s(e,e,o),t[u]=e[0],t[u+1]=e[1];return t}}(),s.str=function(e){return"vec2("+e[0]+", "+e[1]+")"},typeof e!="undefined"&&(e.vec2=s);var o={};o.create=function(){var e=new n(3);return e[0]=0,e[1]=0,e[2]=0,e},o.clone=function(e){var t=new n(3);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t},o.fromValues=function(e,t,r){var i=new n(3);return i[0]=e,i[1]=t,i[2]=r,i},o.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e},o.set=function(e,t,n,r){return e[0]=t,e[1]=n,e[2]=r,e},o.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e},o.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e},o.sub=o.subtract,o.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e[2]=t[2]*n[2],e},o.mul=o.multiply,o.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e[2]=t[2]/n[2],e},o.div=o.divide,o.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e[2]=Math.min(t[2],n[2]),e},o.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e[2]=Math.max(t[2],n[2]),e},o.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e},o.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e[2]=t[2]+n[2]*r,e},o.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return Math.sqrt(n*n+r*r+i*i)},o.dist=o.distance,o.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return n*n+r*r+i*i},o.sqrDist=o.squaredDistance,o.length=function(e){var t=e[0],n=e[1],r=e[2];return Math.sqrt(t*t+n*n+r*r)},o.len=o.length,o.squaredLength=function(e){var t=e[0],n=e[1],r=e[2];return t*t+n*n+r*r},o.sqrLen=o.squaredLength,o.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e},o.normalize=function(e,t){var n=t[0],r=t[1],i=t[2],s=n*n+r*r+i*i;return s>0&&(s=1/Math.sqrt(s),e[0]=t[0]*s,e[1]=t[1]*s,e[2]=t[2]*s),e},o.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]},o.cross=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2];return e[0]=i*a-s*u,e[1]=s*o-r*a,e[2]=r*u-i*o,e},o.lerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e[2]=o+r*(n[2]-o),e},o.random=function(e,t){t=t||1;var n=r()*2*Math.PI,i=r()*2-1,s=Math.sqrt(1-i*i)*t;return e[0]=Math.cos(n)*s,e[1]=Math.sin(n)*s,e[2]=i*t,e},o.transformMat4=function(e,t,n){var r=t[0],i=t[1],s=t[2];return e[0]=n[0]*r+n[4]*i+n[8]*s+n[12],e[1]=n[1]*r+n[5]*i+n[9]*s+n[13],e[2]=n[2]*r+n[6]*i+n[10]*s+n[14],e},o.transformMat3=function(e,t,n){var r=t[0],i=t[1],s=t[2];return e[0]=r*n[0]+i*n[3]+s*n[6],e[1]=r*n[1]+i*n[4]+s*n[7],e[2]=r*n[2]+i*n[5]+s*n[8],e},o.transformQuat=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2],f=n[3],l=f*r+u*s-a*i,c=f*i+a*r-o*s,h=f*s+o*i-u*r,p=-o*r-u*i-a*s;return e[0]=l*f+p*-o+c*-a-h*-u,e[1]=c*f+p*-u+h*-o-l*-a,e[2]=h*f+p*-a+l*-u-c*-o,e},o.forEach=function(){var e=o.create();return function(t,n,r,i,s,o){var u,a;n||(n=3),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],e[2]=t[u+2],s(e,e,o),t[u]=e[0],t[u+1]=e[1],t[u+2]=e[2];return t}}(),o.str=function(e){return"vec3("+e[0]+", "+e[1]+", "+e[2]+")"},typeof e!="undefined"&&(e.vec3=o);var u={};u.create=function(){var e=new n(4);return e[0]=0,e[1]=0,e[2]=0,e[3]=0,e},u.clone=function(e){var t=new n(4);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t},u.fromValues=function(e,t,r,i){var s=new n(4);return s[0]=e,s[1]=t,s[2]=r,s[3]=i,s},u.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e},u.set=function(e,t,n,r,i){return e[0]=t,e[1]=n,e[2]=r,e[3]=i,e},u.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e[3]=t[3]+n[3],e},u.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e[3]=t[3]-n[3],e},u.sub=u.subtract,u.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e[2]=t[2]*n[2],e[3]=t[3]*n[3],e},u.mul=u.multiply,u.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e[2]=t[2]/n[2],e[3]=t[3]/n[3],e},u.div=u.divide,u.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e[2]=Math.min(t[2],n[2]),e[3]=Math.min(t[3],n[3]),e},u.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e[2]=Math.max(t[2],n[2]),e[3]=Math.max(t[3],n[3]),e},u.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e[3]=t[3]*n,e},u.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e[2]=t[2]+n[2]*r,e[3]=t[3]+n[3]*r,e},u.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2],s=t[3]-e[3];return Math.sqrt(n*n+r*r+i*i+s*s)},u.dist=u.distance,u.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2],s=t[3]-e[3];return n*n+r*r+i*i+s*s},u.sqrDist=u.squaredDistance,u.length=function(e){var t=e[0],n=e[1],r=e[2],i=e[3];return Math.sqrt(t*t+n*n+r*r+i*i)},u.len=u.length,u.squaredLength=function(e){var t=e[0],n=e[1],r=e[2],i=e[3];return t*t+n*n+r*r+i*i},u.sqrLen=u.squaredLength,u.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e[3]=-t[3],e},u.normalize=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*n+r*r+i*i+s*s;return o>0&&(o=1/Math.sqrt(o),e[0]=t[0]*o,e[1]=t[1]*o,e[2]=t[2]*o,e[3]=t[3]*o),e},u.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]+e[3]*t[3]},u.lerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2],u=t[3];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e[2]=o+r*(n[2]-o),e[3]=u+r*(n[3]-u),e},u.random=function(e,t){return t=t||1,e[0]=r(),e[1]=r(),e[2]=r(),e[3]=r(),u.normalize(e,e),u.scale(e,e,t),e},u.transformMat4=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3];return e[0]=n[0]*r+n[4]*i+n[8]*s+n[12]*o,e[1]=n[1]*r+n[5]*i+n[9]*s+n[13]*o,e[2]=n[2]*r+n[6]*i+n[10]*s+n[14]*o,e[3]=n[3]*r+n[7]*i+n[11]*s+n[15]*o,e},u.transformQuat=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2],f=n[3],l=f*r+u*s-a*i,c=f*i+a*r-o*s,h=f*s+o*i-u*r,p=-o*r-u*i-a*s;return e[0]=l*f+p*-o+c*-a-h*-u,e[1]=c*f+p*-u+h*-o-l*-a,e[2]=h*f+p*-a+l*-u-c*-o,e},u.forEach=function(){var e=u.create();return function(t,n,r,i,s,o){var u,a;n||(n=4),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],e[2]=t[u+2],e[3]=t[u+3],s(e,e,o),t[u]=e[0],t[u+1]=e[1],t[u+2]=e[2],t[u+3]=e[3];return t}}(),u.str=function(e){return"vec4("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.vec4=u);var a={};a.create=function(){var e=new n(4);return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e},a.clone=function(e){var t=new n(4);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t},a.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e},a.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e},a.transpose=function(e,t){if(e===t){var n=t[1];e[1]=t[2],e[2]=n}else e[0]=t[0],e[1]=t[2],e[2]=t[1],e[3]=t[3];return e},a.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*s-i*r;return o?(o=1/o,e[0]=s*o,e[1]=-r*o,e[2]=-i*o,e[3]=n*o,e):null},a.adjoint=function(e,t){var n=t[0];return e[0]=t[3],e[1]=-t[1],e[2]=-t[2],e[3]=n,e},a.determinant=function(e){return e[0]*e[3]-e[2]*e[1]},a.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1],f=n[2],l=n[3];return e[0]=r*u+i*f,e[1]=r*a+i*l,e[2]=s*u+o*f,e[3]=s*a+o*l,e},a.mul=a.multiply,a.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+i*u,e[1]=r*-u+i*a,e[2]=s*a+o*u,e[3]=s*-u+o*a,e},a.scale=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1];return e[0]=r*u,e[1]=i*a,e[2]=s*u,e[3]=o*a,e},a.str=function(e){return"mat2("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.mat2=a);var f={};f.create=function(){var e=new n(6);return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e[4]=0,e[5]=0,e},f.clone=function(e){var t=new n(6);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t},f.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e},f.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e[4]=0,e[5]=0,e},f.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=n*s-r*i;return a?(a=1/a,e[0]=s*a,e[1]=-r*a,e[2]=-i*a,e[3]=n*a,e[4]=(i*u-s*o)*a,e[5]=(r*o-n*u)*a,e):null},f.determinant=function(e){return e[0]*e[3]-e[1]*e[2]},f.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=n[0],l=n[1],c=n[2],h=n[3],p=n[4],d=n[5];return e[0]=r*f+i*c,e[1]=r*l+i*h,e[2]=s*f+o*c,e[3]=s*l+o*h,e[4]=f*u+c*a+p,e[5]=l*u+h*a+d,e},f.mul=f.multiply,f.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=Math.sin(n),l=Math.cos(n);return e[0]=r*l+i*f,e[1]=-r*f+i*l,e[2]=s*l+o*f,e[3]=-s*f+l*o,e[4]=l*u+f*a,e[5]=l*a-f*u,e},f.scale=function(e,t,n){var r=n[0],i=n[1];return e[0]=t[0]*r,e[1]=t[1]*i,e[2]=t[2]*r,e[3]=t[3]*i,e[4]=t[4]*r,e[5]=t[5]*i,e},f.translate=function(e,t,n){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4]+n[0],e[5]=t[5]+n[1],e},f.str=function(e){return"mat2d("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+")"},typeof e!="undefined"&&(e.mat2d=f);var l={};l.create=function(){var e=new n(9);return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=1,e[5]=0,e[6]=0,e[7]=0,e[8]=1,e},l.fromMat4=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[4],e[4]=t[5],e[5]=t[6],e[6]=t[8],e[7]=t[9],e[8]=t[10],e},l.clone=function(e){var t=new n(9);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t[6]=e[6],t[7]=e[7],t[8]=e[8],t},l.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e},l.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=1,e[5]=0,e[6]=0,e[7]=0,e[8]=1,e},l.transpose=function(e,t){if(e===t){var n=t[1],r=t[2],i=t[5];e[1]=t[3],e[2]=t[6],e[3]=n,e[5]=t[7],e[6]=r,e[7]=i}else e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8];return e},l.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=l*o-u*f,h=-l*s+u*a,p=f*s-o*a,d=n*c+r*h+i*p;return d?(d=1/d,e[0]=c*d,e[1]=(-l*r+i*f)*d,e[2]=(u*r-i*o)*d,e[3]=h*d,e[4]=(l*n-i*a)*d,e[5]=(-u*n+i*s)*d,e[6]=p*d,e[7]=(-f*n+r*a)*d,e[8]=(o*n-r*s)*d,e):null},l.adjoint=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8];return e[0]=o*l-u*f,e[1]=i*f-r*l,e[2]=r*u-i*o,e[3]=u*a-s*l,e[4]=n*l-i*a,e[5]=i*s-n*u,e[6]=s*f-o*a,e[7]=r*a-n*f,e[8]=n*o-r*s,e},l.determinant=function(e){var t=e[0],n=e[1],r=e[2],i=e[3],s=e[4],o=e[5],u=e[6],a=e[7],f=e[8];return t*(f*s-o*a)+n*(-f*i+o*u)+r*(a*i-s*u)},l.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=n[0],p=n[1],d=n[2],v=n[3],m=n[4],g=n[5],y=n[6],b=n[7],w=n[8];return e[0]=h*r+p*o+d*f,e[1]=h*i+p*u+d*l,e[2]=h*s+p*a+d*c,e[3]=v*r+m*o+g*f,e[4]=v*i+m*u+g*l,e[5]=v*s+m*a+g*c,e[6]=y*r+b*o+w*f,e[7]=y*i+b*u+w*l,e[8]=y*s+b*a+w*c,e},l.mul=l.multiply,l.translate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=n[0],p=n[1];return e[0]=r,e[1]=i,e[2]=s,e[3]=o,e[4]=u,e[5]=a,e[6]=h*r+p*o+f,e[7]=h*i+p*u+l,e[8]=h*s+p*a+c,e},l.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=Math.sin(n),p=Math.cos(n);return e[0]=p*r+h*o,e[1]=p*i+h*u,e[2]=p*s+h*a,e[3]=p*o-h*r,e[4]=p*u-h*i,e[5]=p*a-h*s,e[6]=f,e[7]=l,e[8]=c,e},l.scale=function(e,t,n){var r=n[0],i=n[1];return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=i*t[3],e[4]=i*t[4],e[5]=i*t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e},l.fromMat2d=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=0,e[3]=t[2],e[4]=t[3],e[5]=0,e[6]=t[4],e[7]=t[5],e[8]=1,e},l.fromQuat=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n+n,u=r+r,a=i+i,f=n*o,l=n*u,c=n*a,h=r*u,p=r*a,d=i*a,v=s*o,m=s*u,g=s*a;return e[0]=1-(h+d),e[3]=l+g,e[6]=c-m,e[1]=l-g,e[4]=1-(f+d),e[7]=p+v,e[2]=c+m,e[5]=p-v,e[8]=1-(f+h),e},l.normalFromMat4=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15],y=n*u-r*o,b=n*a-i*o,w=n*f-s*o,E=r*a-i*u,S=r*f-s*u,x=i*f-s*a,T=l*v-c*d,N=l*m-h*d,C=l*g-p*d,k=c*m-h*v,L=c*g-p*v,A=h*g-p*m,O=y*A-b*L+w*k+E*C-S*N+x*T;return O?(O=1/O,e[0]=(u*A-a*L+f*k)*O,e[1]=(a*C-o*A-f*N)*O,e[2]=(o*L-u*C+f*T)*O,e[3]=(i*L-r*A-s*k)*O,e[4]=(n*A-i*C+s*N)*O,e[5]=(r*C-n*L-s*T)*O,e[6]=(v*x-m*S+g*E)*O,e[7]=(m*w-d*x-g*b)*O,e[8]=(d*S-v*w+g*y)*O,e):null},l.str=function(e){return"mat3("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+", "+e[6]+", "+e[7]+", "+e[8]+")"},typeof e!="undefined"&&(e.mat3=l);var c={};c.create=function(){var e=new n(16);return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.clone=function(e){var t=new n(16);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t[6]=e[6],t[7]=e[7],t[8]=e[8],t[9]=e[9],t[10]=e[10],t[11]=e[11],t[12]=e[12],t[13]=e[13],t[14]=e[14],t[15]=e[15],t},c.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e[9]=t[9],e[10]=t[10],e[11]=t[11],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15],e},c.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.transpose=function(e,t){if(e===t){var n=t[1],r=t[2],i=t[3],s=t[6],o=t[7],u=t[11];e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=n,e[6]=t[9],e[7]=t[13],e[8]=r,e[9]=s,e[11]=t[14],e[12]=i,e[13]=o,e[14]=u}else e[0]=t[0],e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=t[1],e[5]=t[5],e[6]=t[9],e[7]=t[13],e[8]=t[2],e[9]=t[6],e[10]=t[10],e[11]=t[14],e[12]=t[3],e[13]=t[7],e[14]=t[11],e[15]=t[15];return e},c.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15],y=n*u-r*o,b=n*a-i*o,w=n*f-s*o,E=r*a-i*u,S=r*f-s*u,x=i*f-s*a,T=l*v-c*d,N=l*m-h*d,C=l*g-p*d,k=c*m-h*v,L=c*g-p*v,A=h*g-p*m,O=y*A-b*L+w*k+E*C-S*N+x*T;return O?(O=1/O,e[0]=(u*A-a*L+f*k)*O,e[1]=(i*L-r*A-s*k)*O,e[2]=(v*x-m*S+g*E)*O,e[3]=(h*S-c*x-p*E)*O,e[4]=(a*C-o*A-f*N)*O,e[5]=(n*A-i*C+s*N)*O,e[6]=(m*w-d*x-g*b)*O,e[7]=(l*x-h*w+p*b)*O,e[8]=(o*L-u*C+f*T)*O,e[9]=(r*C-n*L-s*T)*O,e[10]=(d*S-v*w+g*y)*O,e[11]=(c*w-l*S-p*y)*O,e[12]=(u*N-o*k-a*T)*O,e[13]=(n*k-r*N+i*T)*O,e[14]=(v*b-d*E-m*y)*O,e[15]=(l*E-c*b+h*y)*O,e):null},c.adjoint=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15];return e[0]=u*(h*g-p*m)-c*(a*g-f*m)+v*(a*p-f*h),e[1]=-(r*(h*g-p*m)-c*(i*g-s*m)+v*(i*p-s*h)),e[2]=r*(a*g-f*m)-u*(i*g-s*m)+v*(i*f-s*a),e[3]=-(r*(a*p-f*h)-u*(i*p-s*h)+c*(i*f-s*a)),e[4]=-(o*(h*g-p*m)-l*(a*g-f*m)+d*(a*p-f*h)),e[5]=n*(h*g-p*m)-l*(i*g-s*m)+d*(i*p-s*h),e[6]=-(n*(a*g-f*m)-o*(i*g-s*m)+d*(i*f-s*a)),e[7]=n*(a*p-f*h)-o*(i*p-s*h)+l*(i*f-s*a),e[8]=o*(c*g-p*v)-l*(u*g-f*v)+d*(u*p-f*c),e[9]=-(n*(c*g-p*v)-l*(r*g-s*v)+d*(r*p-s*c)),e[10]=n*(u*g-f*v)-o*(r*g-s*v)+d*(r*f-s*u),e[11]=-(n*(u*p-f*c)-o*(r*p-s*c)+l*(r*f-s*u)),e[12]=-(o*(c*m-h*v)-l*(u*m-a*v)+d*(u*h-a*c)),e[13]=n*(c*m-h*v)-l*(r*m-i*v)+d*(r*h-i*c),e[14]=-(n*(u*m-a*v)-o*(r*m-i*v)+d*(r*a-i*u)),e[15]=n*(u*h-a*c)-o*(r*h-i*c)+l*(r*a-i*u),e},c.determinant=function(e){var t=e[0],n=e[1],r=e[2],i=e[3],s=e[4],o=e[5],u=e[6],a=e[7],f=e[8],l=e[9],c=e[10],h=e[11],p=e[12],d=e[13],v=e[14],m=e[15],g=t*o-n*s,y=t*u-r*s,b=t*a-i*s,w=n*u-r*o,E=n*a-i*o,S=r*a-i*u,x=f*d-l*p,T=f*v-c*p,N=f*m-h*p,C=l*v-c*d,k=l*m-h*d,L=c*m-h*v;return g*L-y*k+b*C+w*N-E*T+S*x},c.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=t[9],p=t[10],d=t[11],v=t[12],m=t[13],g=t[14],y=t[15],b=n[0],w=n[1],E=n[2],S=n[3];return e[0]=b*r+w*u+E*c+S*v,e[1]=b*i+w*a+E*h+S*m,e[2]=b*s+w*f+E*p+S*g,e[3]=b*o+w*l+E*d+S*y,b=n[4],w=n[5],E=n[6],S=n[7],e[4]=b*r+w*u+E*c+S*v,e[5]=b*i+w*a+E*h+S*m,e[6]=b*s+w*f+E*p+S*g,e[7]=b*o+w*l+E*d+S*y,b=n[8],w=n[9],E=n[10],S=n[11],e[8]=b*r+w*u+E*c+S*v,e[9]=b*i+w*a+E*h+S*m,e[10]=b*s+w*f+E*p+S*g,e[11]=b*o+w*l+E*d+S*y,b=n[12],w=n[13],E=n[14],S=n[15],e[12]=b*r+w*u+E*c+S*v,e[13]=b*i+w*a+E*h+S*m,e[14]=b*s+w*f+E*p+S*g,e[15]=b*o+w*l+E*d+S*y,e},c.mul=c.multiply,c.translate=function(e,t,n){var r=n[0],i=n[1],s=n[2],o,u,a,f,l,c,h,p,d,v,m,g;return t===e?(e[12]=t[0]*r+t[4]*i+t[8]*s+t[12],e[13]=t[1]*r+t[5]*i+t[9]*s+t[13],e[14]=t[2]*r+t[6]*i+t[10]*s+t[14],e[15]=t[3]*r+t[7]*i+t[11]*s+t[15]):(o=t[0],u=t[1],a=t[2],f=t[3],l=t[4],c=t[5],h=t[6],p=t[7],d=t[8],v=t[9],m=t[10],g=t[11],e[0]=o,e[1]=u,e[2]=a,e[3]=f,e[4]=l,e[5]=c,e[6]=h,e[7]=p,e[8]=d,e[9]=v,e[10]=m,e[11]=g,e[12]=o*r+l*i+d*s+t[12],e[13]=u*r+c*i+v*s+t[13],e[14]=a*r+h*i+m*s+t[14],e[15]=f*r+p*i+g*s+t[15]),e},c.scale=function(e,t,n){var r=n[0],i=n[1],s=n[2];return e[0]=t[0]*r,e[1]=t[1]*r,e[2]=t[2]*r,e[3]=t[3]*r,e[4]=t[4]*i,e[5]=t[5]*i,e[6]=t[6]*i,e[7]=t[7]*i,e[8]=t[8]*s,e[9]=t[9]*s,e[10]=t[10]*s,e[11]=t[11]*s,e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15],e},c.rotate=function(e,n,r,i){var s=i[0],o=i[1],u=i[2],a=Math.sqrt(s*s+o*o+u*u),f,l,c,h,p,d,v,m,g,y,b,w,E,S,x,T,N,C,k,L,A,O,M,_;return Math.abs(a)<t?null:(a=1/a,s*=a,o*=a,u*=a,f=Math.sin(r),l=Math.cos(r),c=1-l,h=n[0],p=n[1],d=n[2],v=n[3],m=n[4],g=n[5],y=n[6],b=n[7],w=n[8],E=n[9],S=n[10],x=n[11],T=s*s*c+l,N=o*s*c+u*f,C=u*s*c-o*f,k=s*o*c-u*f,L=o*o*c+l,A=u*o*c+s*f,O=s*u*c+o*f,M=o*u*c-s*f,_=u*u*c+l,e[0]=h*T+m*N+w*C,e[1]=p*T+g*N+E*C,e[2]=d*T+y*N+S*C,e[3]=v*T+b*N+x*C,e[4]=h*k+m*L+w*A,e[5]=p*k+g*L+E*A,e[6]=d*k+y*L+S*A,e[7]=v*k+b*L+x*A,e[8]=h*O+m*M+w*_,e[9]=p*O+g*M+E*_,e[10]=d*O+y*M+S*_,e[11]=v*O+b*M+x*_,n!==e&&(e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15]),e)},c.rotateX=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[4],o=t[5],u=t[6],a=t[7],f=t[8],l=t[9],c=t[10],h=t[11];return t!==e&&(e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[4]=s*i+f*r,e[5]=o*i+l*r,e[6]=u*i+c*r,e[7]=a*i+h*r,e[8]=f*i-s*r,e[9]=l*i-o*r,e[10]=c*i-u*r,e[11]=h*i-a*r,e},c.rotateY=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[0],o=t[1],u=t[2],a=t[3],f=t[8],l=t[9],c=t[10],h=t[11];return t!==e&&(e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=s*i-f*r,e[1]=o*i-l*r,e[2]=u*i-c*r,e[3]=a*i-h*r,e[8]=s*r+f*i,e[9]=o*r+l*i,e[10]=u*r+c*i,e[11]=a*r+h*i,e},c.rotateZ=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[0],o=t[1],u=t[2],a=t[3],f=t[4],l=t[5],c=t[6],h=t[7];return t!==e&&(e[8]=t[8],e[9]=t[9],e[10]=t[10],e[11]=t[11],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=s*i+f*r,e[1]=o*i+l*r,e[2]=u*i+c*r,e[3]=a*i+h*r,e[4]=f*i-s*r,e[5]=l*i-o*r,e[6]=c*i-u*r,e[7]=h*i-a*r,e},c.fromRotationTranslation=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=r+r,a=i+i,f=s+s,l=r*u,c=r*a,h=r*f,p=i*a,d=i*f,v=s*f,m=o*u,g=o*a,y=o*f;return e[0]=1-(p+v),e[1]=c+y,e[2]=h-g,e[3]=0,e[4]=c-y,e[5]=1-(l+v),e[6]=d+m,e[7]=0,e[8]=h+g,e[9]=d-m,e[10]=1-(l+p),e[11]=0,e[12]=n[0],e[13]=n[1],e[14]=n[2],e[15]=1,e},c.fromQuat=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n+n,u=r+r,a=i+i,f=n*o,l=n*u,c=n*a,h=r*u,p=r*a,d=i*a,v=s*o,m=s*u,g=s*a;return e[0]=1-(h+d),e[1]=l+g,e[2]=c-m,e[3]=0,e[4]=l-g,e[5]=1-(f+d),e[6]=p+v,e[7]=0,e[8]=c+m,e[9]=p-v,e[10]=1-(f+h),e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.frustum=function(e,t,n,r,i,s,o){var u=1/(n-t),a=1/(i-r),f=1/(s-o);return e[0]=s*2*u,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s*2*a,e[6]=0,e[7]=0,e[8]=(n+t)*u,e[9]=(i+r)*a,e[10]=(o+s)*f,e[11]=-1,e[12]=0,e[13]=0,e[14]=o*s*2*f,e[15]=0,e},c.perspective=function(e,t,n,r,i){var s=1/Math.tan(t/2),o=1/(r-i);return e[0]=s/n,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=(i+r)*o,e[11]=-1,e[12]=0,e[13]=0,e[14]=2*i*r*o,e[15]=0,e},c.ortho=function(e,t,n,r,i,s,o){var u=1/(t-n),a=1/(r-i),f=1/(s-o);return e[0]=-2*u,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=-2*a,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=2*f,e[11]=0,e[12]=(t+n)*u,e[13]=(i+r)*a,e[14]=(o+s)*f,e[15]=1,e},c.lookAt=function(e,n,r,i){var s,o,u,a,f,l,h,p,d,v,m=n[0],g=n[1],y=n[2],b=i[0],w=i[1],E=i[2],S=r[0],x=r[1],T=r[2];return Math.abs(m-S)<t&&Math.abs(g-x)<t&&Math.abs(y-T)<t?c.identity(e):(h=m-S,p=g-x,d=y-T,v=1/Math.sqrt(h*h+p*p+d*d),h*=v,p*=v,d*=v,s=w*d-E*p,o=E*h-b*d,u=b*p-w*h,v=Math.sqrt(s*s+o*o+u*u),v?(v=1/v,s*=v,o*=v,u*=v):(s=0,o=0,u=0),a=p*u-d*o,f=d*s-h*u,l=h*o-p*s,v=Math.sqrt(a*a+f*f+l*l),v?(v=1/v,a*=v,f*=v,l*=v):(a=0,f=0,l=0),e[0]=s,e[1]=a,e[2]=h,e[3]=0,e[4]=o,e[5]=f,e[6]=p,e[7]=0,e[8]=u,e[9]=l,e[10]=d,e[11]=0,e[12]=-(s*m+o*g+u*y),e[13]=-(a*m+f*g+l*y),e[14]=-(h*m+p*g+d*y),e[15]=1,e)},c.str=function(e){return"mat4("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+", "+e[6]+", "+e[7]+", "+e[8]+", "+e[9]+", "+e[10]+", "+e[11]+", "+e[12]+", "+e[13]+", "+e[14]+", "+e[15]+")"},typeof e!="undefined"&&(e.mat4=c);var h={};h.create=function(){var e=new n(4);return e[0]=0,e[1]=0,e[2]=0,e[3]=1,e},h.rotationTo=function(){var e=o.create(),t=o.fromValues(1,0,0),n=o.fromValues(0,1,0);return function(r,i,s){var u=o.dot(i,s);return u<-0.999999?(o.cross(e,t,i),o.length(e)<1e-6&&o.cross(e,n,i),o.normalize(e,e),h.setAxisAngle(r,e,Math.PI),r):u>.999999?(r[0]=0,r[1]=0,r[2]=0,r[3]=1,r):(o.cross(e,i,s),r[0]=e[0],r[1]=e[1],r[2]=e[2],r[3]=1+u,h.normalize(r,r))}}(),h.setAxes=function(){var e=l.create();return function(t,n,r,i){return e[0]=r[0],e[3]=r[1],e[6]=r[2],e[1]=i[0],e[4]=i[1],e[7]=i[2],e[2]=n[0],e[5]=n[1],e[8]=n[2],h.normalize(t,h.fromMat3(t,e))}}(),h.clone=u.clone,h.fromValues=u.fromValues,h.copy=u.copy,h.set=u.set,h.identity=function(e){return e[0]=0,e[1]=0,e[2]=0,e[3]=1,e},h.setAxisAngle=function(e,t,n){n*=.5;var r=Math.sin(n);return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=Math.cos(n),e},h.add=u.add,h.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1],f=n[2],l=n[3];return e[0]=r*l+o*u+i*f-s*a,e[1]=i*l+o*a+s*u-r*f,e[2]=s*l+o*f+r*a-i*u,e[3]=o*l-r*u-i*a-s*f,e},h.mul=h.multiply,h.scale=u.scale,h.rotateX=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+o*u,e[1]=i*a+s*u,e[2]=s*a-i*u,e[3]=o*a-r*u,e},h.rotateY=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a-s*u,e[1]=i*a+o*u,e[2]=s*a+r*u,e[3]=o*a-i*u,e},h.rotateZ=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+i*u,e[1]=i*a-r*u,e[2]=s*a+o*u,e[3]=o*a-s*u,e},h.calculateW=function(e,t){var n=t[0],r=t[1],i=t[2];return e[0]=n,e[1]=r,e[2]=i,e[3]=-Math.sqrt(Math.abs(1-n*n-r*r-i*i)),e},h.dot=u.dot,h.lerp=u.lerp,h.slerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2],u=t[3],a=n[0],f=n[1],l=n[2],c=n[3],h,p,d,v,m;return p=i*a+s*f+o*l+u*c,p<0&&(p=-p,a=-a,f=-f,l=-l,c=-c),1-p>1e-6?(h=Math.acos(p),d=Math.sin(h),v=Math.sin((1-r)*h)/d,m=Math.sin(r*h)/d):(v=1-r,m=r),e[0]=v*i+m*a,e[1]=v*s+m*f,e[2]=v*o+m*l,e[3]=v*u+m*c,e},h.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*n+r*r+i*i+s*s,u=o?1/o:0;return e[0]=-n*u,e[1]=-r*u,e[2]=-i*u,e[3]=s*u,e},h.conjugate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e[3]=t[3],e},h.length=u.length,h.len=h.length,h.squaredLength=u.squaredLength,h.sqrLen=h.squaredLength,h.normalize=u.normalize,h.fromMat3=function(){var e=typeof Int8Array!="undefined"?new Int8Array([1,2,0]):[1,2,0];return function(t,n){var r=n[0]+n[4]+n[8],i;if(r>0)i=Math.sqrt(r+1),t[3]=.5*i,i=.5/i,t[0]=(n[7]-n[5])*i,t[1]=(n[2]-n[6])*i,t[2]=(n[3]-n[1])*i;else{var s=0;n[4]>n[0]&&(s=1),n[8]>n[s*3+s]&&(s=2);var o=e[s],u=e[o];i=Math.sqrt(n[s*3+s]-n[o*3+o]-n[u*3+u]+1),t[s]=.5*i,i=.5/i,t[3]=(n[u*3+o]-n[o*3+u])*i,t[o]=(n[o*3+s]+n[s*3+o])*i,t[u]=(n[u*3+s]+n[s*3+u])*i}return t}}(),h.str=function(e){return"quat("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.quat=h)}(t.exports)})(this);

},{}],13:[function(require,module,exports){
/*
requirejs.config({
    paths: {
        'hammer': 'libs/Hammer',
        'Animated_GIF': 'libs/Animated_GIF/Animated_GIF',
        'GifWriter': 'libs/Animated_GIF/omggif'
    },
    shim: {
        'hammer': [],
        'Animated_GIF': ['GifWriter'],
    }
});


require(
    ['app'],
    function(App) {
        
        var app = new App(reportError, function() {
            
            app.openGallery();

        });


        // ~~~

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

        }

    }

);*/


window.addEventListener('DOMComponentsLoaded', function() {
    console.log('hey folks');
    var App = require('./App');

    var app = new App(reportError, function() {
        
        app.openGallery();

    });


    // ~~~

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

    }


});

},{"./App":1}]},{},[13])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvbWNvbWFkcmFuL2RhdGEvcnRjYW1lcmEvanMvQXBwLmpzIiwiL1VzZXJzL21jb21hZHJhbi9kYXRhL3J0Y2FtZXJhL2pzL0dhbGxlcnlWaWV3LmpzIiwiL1VzZXJzL21jb21hZHJhbi9kYXRhL3J0Y2FtZXJhL2pzL0ltYWdlRWZmZWN0LmpzIiwiL1VzZXJzL21jb21hZHJhbi9kYXRhL3J0Y2FtZXJhL2pzL01pbmlSb3V0ZXIuanMiLCIvVXNlcnMvbWNvbWFkcmFuL2RhdGEvcnRjYW1lcmEvanMvUGljdHVyZS5qcyIsIi9Vc2Vycy9tY29tYWRyYW4vZGF0YS9ydGNhbWVyYS9qcy9SZW5kZXJlci5qcyIsIi9Vc2Vycy9tY29tYWRyYW4vZGF0YS9ydGNhbWVyYS9qcy9Ub2FzdC5qcyIsIi9Vc2Vycy9tY29tYWRyYW4vZGF0YS9ydGNhbWVyYS9qcy9ndW1IZWxwZXIuanMiLCIvVXNlcnMvbWNvbWFkcmFuL2RhdGEvcnRjYW1lcmEvanMvbGlicy9BbmltYXRlZF9HSUYvQW5pbWF0ZWRfR0lGLmpzIiwiL1VzZXJzL21jb21hZHJhbi9kYXRhL3J0Y2FtZXJhL2pzL2xpYnMvSGFtbWVyLmpzIiwiL1VzZXJzL21jb21hZHJhbi9kYXRhL3J0Y2FtZXJhL2pzL2xpYnMvYXN5bmNTdG9yYWdlLmpzIiwiL1VzZXJzL21jb21hZHJhbi9kYXRhL3J0Y2FtZXJhL2pzL2xpYnMvZ2xtYXRyaXgubWluLmpzIiwiL1VzZXJzL21jb21hZHJhbi9kYXRhL3J0Y2FtZXJhL2pzL21haW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbm1DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbjVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBkbyB0aGUgcmVxdWlyZS5qcyBkYW5jZVxuLy9kZWZpbmUoXG4vLyAgICBbJ2hhbW1lcicsICdSZW5kZXJlcicsICdndW1IZWxwZXInLCAnR2FsbGVyeVZpZXcnLCAnUGljdHVyZScsICdUb2FzdCcsICdBbmltYXRlZF9HSUYnLCAnTWluaVJvdXRlcicsICdsaWJzL0luZGV4ZWREQlNoaW0nLCAnbGlicy9hc3luY1N0b3JhZ2UnXSxcbi8vICAgIGZ1bmN0aW9uKEhhbW1lciwgUmVuZGVyZXIsIGd1bUhlbHBlciwgR2FsbGVyeVZpZXcsIFBpY3R1cmUsIFRvYXN0LCBBbmltYXRlZF9HSUYsIE1pbmlSb3V0ZXIpIHtcblxuLy8gICAgJ3VzZSBzdHJpY3QnO1xuXG52YXIgSGFtbWVyID0gcmVxdWlyZSgnLi9saWJzL0hhbW1lcicpO1xudmFyIFJlbmRlcmVyID0gcmVxdWlyZSgnLi9SZW5kZXJlcicpO1xudmFyIGd1bUhlbHBlciA9IHJlcXVpcmUoJy4vZ3VtSGVscGVyJyk7XG52YXIgR2FsbGVyeVZpZXcgPSByZXF1aXJlKCcuL0dhbGxlcnlWaWV3Jyk7XG52YXIgUGljdHVyZSA9IHJlcXVpcmUoJy4vUGljdHVyZScpO1xudmFyIFRvYXN0ID0gcmVxdWlyZSgnLi9Ub2FzdCcpO1xudmFyIEFuaW1hdGVkX0dJRiA9IHJlcXVpcmUoJy4vbGlicy9BbmltYXRlZF9HSUYvQW5pbWF0ZWRfR0lGJyk7XG52YXIgTWluaVJvdXRlciA9IHJlcXVpcmUoJy4vTWluaVJvdXRlcicpO1xuXG4gICAgZnVuY3Rpb24gQXBwKGVycm9yQ2FsbGJhY2ssIHJlYWR5Q2FsbGJhY2spIHtcblxuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIHZhciBwYWdlcyA9IHt9O1xuICAgICAgICB2YXIgYWN0aXZlUGFnZSA9IG51bGw7XG5cbiAgICAgICAgLy8gUHJldmlldyBVSVxuICAgICAgICB2YXIgYWRkaXRpb25hbENvbnRyb2xzO1xuICAgICAgICB2YXIgYnRuUHJldkZpbHRlcjtcbiAgICAgICAgdmFyIGJ0bk5leHRGaWx0ZXI7XG4gICAgICAgIHZhciBmbGFzaGVyO1xuICAgICAgICB2YXIgZ2hvc3RCaXRtYXA7XG4gICAgICAgIHZhciBnaG9zdENhbnZhcztcblxuICAgICAgICAvLyBHYWxsZXJ5IFVJXG4gICAgICAgIHZhciBidG5HYWxsZXJ5O1xuICAgICAgICB2YXIgZ2FsbGVyeUNvbnRhaW5lcjtcbiAgICAgICAgdmFyIGdhbGxlcnlDb2FjaE1hcmtzO1xuICAgICAgICB2YXIgZ2FsbGVyeVZpZXc7XG4gICAgICAgIHZhciBidG5DYW1lcmE7XG4gICAgICAgIHZhciBnYWxsZXJ5RGV0YWlscztcbiAgICAgICAgdmFyIGdhbGxlcnlEZXRhaWxzRm9vdGVyO1xuXG4gICAgICAgIC8vIENhbWVyYSBVSVxuICAgICAgICB2YXIgdmlkZW9Db250cm9scztcbiAgICAgICAgdmFyIGJ0blZpZGVvQ2FuY2VsO1xuICAgICAgICB2YXIgYnRuVmlkZW9Eb25lO1xuICAgICAgICB2YXIgdmlkZW9Qcm9ncmVzc0JhcjtcbiAgICAgICAgdmFyIHZpZGVvUHJvZ3Jlc3NTcGFuO1xuICAgICAgICB2YXIgY2FtZXJhQ29hY2hNYXJrcztcbiAgICAgICAgdmFyIGNhbWVyYUNvYWNoTWFya3NTaG93biA9IGZhbHNlO1xuICAgICAgICB2YXIgYnRuQ2FtZXJhQ2FwdHVyZTtcbiAgICAgICAgdmFyIHN3aXRjaFZpZGVvO1xuXG4gICAgICAgIC8vIFN0YXRpYyBmaWxlIHByb2Nlc3NpbmcgVUlcbiAgICAgICAgdmFyIGZpbGVQaWNrZXI7XG4gICAgICAgIHZhciBidG5TdGF0aWNDYXB0dXJlO1xuXG4gICAgICAgIC8vIFJlbmRlcmVyIGFuZCBzdHVmZlxuICAgICAgICB2YXIgcGljdHVyZUNvdW50O1xuICAgICAgICB2YXIgZ2FsbGVyeVBpY3R1cmVzID0ge307XG4gICAgICAgIHZhciByZW5kZXJlcjtcbiAgICAgICAgdmFyIGFuaW1hdGlvbkZyYW1lSWQgPSBudWxsO1xuICAgICAgICB2YXIgaW5wdXRFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgdmFyIGlucHV0V2lkdGggPSAzMjA7XG4gICAgICAgIHZhciBpbnB1dEhlaWdodCA9IDI0MDtcbiAgICAgICAgdmFyIGxpdmVTdHJlYW1pbmcgPSBmYWxzZTtcbiAgICAgICAgdmFyIHJlbmRlcmluZyA9IGZhbHNlO1xuICAgICAgICB2YXIgb3V0cHV0SW1hZ2VOZWVkc1VwZGF0aW5nID0gZmFsc2U7XG4gICAgICAgIHZhciB2aWRlbyA9IG51bGw7XG4gICAgICAgIHZhciBhbmltYXRlZEdJRjtcbiAgICAgICAgdmFyIGdpZkRlbGF5ID0gMTAwO1xuICAgICAgICB2YXIgZ2lmTGVuZ3RoID0gMDtcbiAgICAgICAgdmFyIGdpZk1heExlbmd0aCA9IDIwMDA7XG4gICAgICAgIHZhciBnaWZSZWNvcmRTdGFydDtcbiAgICAgICAgdmFyIHJlY29yZEdJRlRpbWVvdXQgPSBudWxsO1xuXG4gICAgICAgIHZhciBJTUdVUl9LRVkgPSAnNDljNDJhZjkwMmQxZmQ0JztcbiAgICAgICAgdmFyIFRSQU5TSVRJT05fTEVOR1RIID0gNTAwO1xuXG4gICAgICAgIHZhciByb3V0ZXIgPSBuZXcgTWluaVJvdXRlcigpO1xuICAgICAgICAvLyBUT0RPIGlkZWFsbHkgZ29pbmcgdG8gZ2FsbGVyeSBzaG91bGQgYmUgJ3Jvb3QnIGFuZCBlcmFzZSBwcmV2aW91cyBzdGF0ZSBlbnRyaWVzXG4gICAgICAgIHJvdXRlci5hZGQoJ2dhbGxlcnknLCAnIycsIGdvdG9HYWxsZXJ5KTtcbiAgICAgICAgcm91dGVyLmFkZCgnZGV0YWlscycsICcjcGljdHVyZS86aWQnLCBnb3RvRGV0YWlscyk7XG4gICAgICAgIHJvdXRlci5hZGQoJ3N0YXRpYycsICcjc3RhdGljJywgZ290b1N0YXRpYyk7XG4gICAgICAgIHJvdXRlci5hZGQoJ2NhbWVyYScsICcjY2FtZXJhJywgZ290b0NhbWVyYSk7XG4gICAgICAgIHJvdXRlci5hdHRhY2hUbyh3aW5kb3cpO1xuXG4gICAgICAgIGluaXRVSSgpO1xuXG4gICAgICAgIHJlbmRlcmVyID0gbmV3IFJlbmRlcmVyKGVycm9yQ2FsbGJhY2ssIGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICBIYW1tZXIoZG9jdW1lbnQsIHsgc3dpcGV2ZWxvY2l0eTogMC4xIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdob2xkJywgb25Ib2xkKVxuICAgICAgICAgICAgICAgIC5vbigncmVsZWFzZScsIG9uUmVsZWFzZSlcbiAgICAgICAgICAgICAgICAub24oJ3N3aXBlbGVmdCcsIHByZXZpb3VzRWZmZWN0KVxuICAgICAgICAgICAgICAgIC5vbignc3dpcGVyaWdodCcsIG5leHRFZmZlY3QpO1xuICAgICAgICAgICAgcmVhZHlDYWxsYmFjaygpO1xuXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZpbmQgVUkgZWxlbWVudHMgYW5kIGF0dGFjaCBldmVudHMgdG8gdGhlbVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gaW5pdFVJKCkge1xuXG4gICAgICAgICAgICBwYWdlcyA9IHt9O1xuICAgICAgICAgICAgWydnYWxsZXJ5JywgJ2RldGFpbHMnLCAnY2FtZXJhJywgJ3BpY2tGaWxlJ10uZm9yRWFjaChmdW5jdGlvbihpZCkge1xuICAgICAgICAgICAgICAgIHZhciBwYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuICAgICAgICAgICAgICAgIHBhZ2VzW2lkXSA9IHBhZ2U7XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICBmbGFzaGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZsYXNoZXInKTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gb25GbGFzaGVyQW5pbWF0aW9uRW5kKCkge1xuXG4gICAgICAgICAgICAgICAgZmxhc2hlci5jbGFzc0xpc3QucmVtb3ZlKCdvbl9hbmltYXRpb24nKTtcblxuICAgICAgICAgICAgICAgIHZhciBjYW52YXMgPSByZW5kZXJlci5kb21FbGVtZW50O1xuICAgICAgICAgICAgICAgIGdob3N0Q2FudmFzLndpZHRoID0gY2FudmFzLndpZHRoO1xuICAgICAgICAgICAgICAgIGdob3N0Q2FudmFzLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XG5cbiAgICAgICAgICAgICAgICB2YXIgY3R4ID0gZ2hvc3RDYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgICAgICAgICAgICBjdHguZHJhd0ltYWdlKGdob3N0Qml0bWFwLCAwLCAwKTtcblxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGdob3N0Q2FudmFzQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2ZhZGVkX291dCcpO1xuICAgICAgICAgICAgICAgIH0sIDEwKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDYW52YXMgZm9yIHRoZSBwcmV2aWV3LCBmbGFzaGVyLCBnaG9zdCBjYW52YXMgLS0tXG5cbiAgICAgICAgICAgIGZsYXNoZXIuYWRkRXZlbnRMaXN0ZW5lcignYW5pbWF0aW9uZW5kJywgb25GbGFzaGVyQW5pbWF0aW9uRW5kLCBmYWxzZSk7XG4gICAgICAgICAgICBmbGFzaGVyLmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdEFuaW1hdGlvbkVuZCcsIG9uRmxhc2hlckFuaW1hdGlvbkVuZCwgZmFsc2UpO1xuXG4gICAgICAgICAgICBnaG9zdENhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXG4gICAgICAgICAgICB2YXIgZ2hvc3RDYW52YXNDb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2hvc3RDYW52YXNDb250YWluZXInKTtcbiAgICAgICAgICAgIGdob3N0Q2FudmFzQ29udGFpbmVyLmFwcGVuZENoaWxkKGdob3N0Q2FudmFzKTtcbiAgICAgICAgICAgIGdob3N0Q2FudmFzQ29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBnaG9zdENhbnZhcy5nZXRDb250ZXh0KCcyZCcpLmNsZWFyUmVjdCgwLCAwLCBnaG9zdENhbnZhcy53aWR0aCwgZ2hvc3RDYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICBnaG9zdENhbnZhc0NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdmYWRlZF9vdXQnKTtcbiAgICAgICAgICAgIH0sIGZhbHNlKTtcblxuICAgICAgICAgICAgYWRkaXRpb25hbENvbnRyb2xzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FkZGl0aW9uYWxDb250cm9scycpO1xuICAgICAgICAgICAgYnRuUHJldkZpbHRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmV2RmlsdGVyJyk7XG5cbiAgICAgICAgICAgIGJ0blByZXZGaWx0ZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBwcmV2aW91c0VmZmVjdCwgZmFsc2UpO1xuICAgICAgICAgICAgYnRuTmV4dEZpbHRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCduZXh0RmlsdGVyJyk7XG4gICAgICAgICAgICBidG5OZXh0RmlsdGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbmV4dEVmZmVjdCwgZmFsc2UpO1xuXG5cbiAgICAgICAgICAgIC8vIEdhbGxlcnkgLS0tXG5cbiAgICAgICAgICAgIGdhbGxlcnlDb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FsbGVyeUNvbnRhaW5lcicpO1xuICAgICAgICAgICAgZ2FsbGVyeUNvYWNoTWFya3MgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FsbGVyeUNvYWNoTWFya3MnKTtcblxuICAgICAgICAgICAgZ2FsbGVyeVZpZXcgPSBuZXcgR2FsbGVyeVZpZXcoKTtcbiAgICAgICAgICAgIGdhbGxlcnlWaWV3Lm9uUGljdHVyZUNsaWNrZWQoZnVuY3Rpb24oaWQpIHtcblxuICAgICAgICAgICAgICAgIGlmKGFjdGl2ZVBhZ2UgPT09ICdnYWxsZXJ5Jykge1xuICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0ZVRvRGV0YWlscyhpZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGdhbGxlcnlDb250YWluZXIuYXBwZW5kQ2hpbGQoZ2FsbGVyeVZpZXcuZG9tRWxlbWVudCk7XG5cbiAgICAgICAgICAgIGJ0bkdhbGxlcnkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuR2FsbGVyeScpO1xuICAgICAgICAgICAgYnRuR2FsbGVyeS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG5hdmlnYXRlVG9HYWxsZXJ5LCBmYWxzZSk7XG5cbiAgICAgICAgICAgIGJ0bkNhbWVyYSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5DYW1lcmEnKTtcbiAgICAgICAgICAgIGJ0bkNhbWVyYS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG5hdmlnYXRlVG9DYW1lcmEsIGZhbHNlKTtcblxuXG4gICAgICAgICAgICAvLyBUaGUgY2FtZXJhIGJ1dHRvbiBpcyBpbml0aWFsbHkgaGlkZGVuLiBXZSdsbCBzaG93IGl0IGFuZCB0aGUgcmVmZXJlbmNlcyB0byB0aGUgY2FtZXJhIGluIHRoZSBjb2FjaG1hcmtzIGlmIHRoZXJlJ3MgbGlrZWx5IHN1cHBvcnQgZm9yIFdlYlJUQ1xuICAgICAgICAgICAgaWYobmF2aWdhdG9yLmdldE1lZGlhKSB7XG4gICAgICAgICAgICAgICAgc2hvd0NhbWVyYUJ1dHRvbigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuUGlja2VyJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBuYXZpZ2F0ZVRvU3RhdGljLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIC8vIFBpY3R1cmUgZGV0YWlscyAtLS1cblxuICAgICAgICAgICAgZ2FsbGVyeURldGFpbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZGV0YWlscyA+IGRpdicpO1xuICAgICAgICAgICAgZ2FsbGVyeURldGFpbHNGb290ZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZGV0YWlscyA+IGZvb3RlcicpO1xuXG5cbiAgICAgICAgICAgIC8vIENhbWVyYSAtLS1cblxuICAgICAgICAgICAgdmlkZW9Db250cm9scyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2aWRlb0NvbnRyb2xzJyk7XG4gICAgICAgICAgICB2aWRlb1Byb2dyZXNzQmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvUHJvZ3Jlc3NCYXInKTtcbiAgICAgICAgICAgIGNhbWVyYUNvYWNoTWFya3MgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FtZXJhQ29hY2hNYXJrcycpO1xuICAgICAgICAgICAgYnRuVmlkZW9DYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuVmlkZW9DYW5jZWwnKTtcbiAgICAgICAgICAgIGJ0blZpZGVvRG9uZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5WaWRlb0RvbmUnKTtcbiAgICAgICAgICAgIHZpZGVvUHJvZ3Jlc3NTcGFuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3Byb2dyZXNzTGFiZWwgc3BhbicpO1xuICAgICAgICAgICAgYnRuQ2FtZXJhQ2FwdHVyZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjYW1lcmEgZm9vdGVyIC5idG5DYXB0dXJlJyk7XG4gICAgICAgICAgICBzd2l0Y2hWaWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzd2l0Y2hWaWRlbycpO1xuXG4gICAgICAgICAgICBIYW1tZXIoYnRuQ2FtZXJhQ2FwdHVyZSlcbiAgICAgICAgICAgICAgICAub24oJ2NsaWNrJywgb25Ib2xkKVxuICAgICAgICAgICAgICAgIC5vbigncmVsZWFzZScsIG9uUmVsZWFzZSk7XG5cbiAgICAgICAgICAgIGJ0blZpZGVvQ2FuY2VsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2FuY2VsVmlkZW9SZWNvcmRpbmcsIGZhbHNlKTtcbiAgICAgICAgICAgIGJ0blZpZGVvRG9uZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZpbmlzaFZpZGVvUmVjb3JkaW5nLCBmYWxzZSk7XG5cblxuICAgICAgICAgICAgLy8gU3RhdGljIGZpbGUgLS0tXG5cbiAgICAgICAgICAgIGZpbGVQaWNrZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmlsZVBpY2tlcicpO1xuICAgICAgICAgICAgZmlsZVBpY2tlci5hZGRFdmVudExpc3RlbmVyKCdtb2RhbGhpZGUnLCBvbkZpbGVQaWNrZXJDYW5jZWxlZCwgZmFsc2UpO1xuXG4gICAgICAgICAgICBmaWxlUGlja2VyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0JykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgb25GaWxlUGlja2VkLCBmYWxzZSk7XG4gICAgICAgICAgICBmaWxlUGlja2VyLnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25GaWxlUGlja2VyQ2FuY2VsZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5GaWxlUGlja2VyJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvcGVuRmlsZVBpY2tlciwgZmFsc2UpO1xuXG4gICAgICAgICAgICBidG5TdGF0aWNDYXB0dXJlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BpY2tGaWxlIC5idG5DYXB0dXJlJyk7XG4gICAgICAgICAgICBidG5TdGF0aWNDYXB0dXJlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25Ib2xkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBvblJlc2l6ZSwgZmFsc2UpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvblJlc2l6ZSgpIHtcblxuICAgICAgICAgICAgdmFyIHcgPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgICAgIHZhciBoID0gd2luZG93LmlubmVySGVpZ2h0O1xuICAgICAgICAgICAgdmFyIGNhbnZhc1dpZHRoID0gaW5wdXRXaWR0aDtcbiAgICAgICAgICAgIHZhciBjYW52YXNIZWlnaHQgPSBpbnB1dEhlaWdodDtcblxuICAgICAgICAgICAgdmFyIHNjYWxlWCA9IHcgLyBjYW52YXNXaWR0aDtcbiAgICAgICAgICAgIHZhciBzY2FsZVkgPSBoIC8gY2FudmFzSGVpZ2h0O1xuICAgICAgICAgICAgdmFyIHNjYWxlVG9GaXQgPSBNYXRoLm1pbihzY2FsZVgsIHNjYWxlWSk7XG5cbiAgICAgICAgICAgIGNhbnZhc1dpZHRoID0gKGNhbnZhc1dpZHRoICogc2NhbGVUb0ZpdCkgfCAwIDtcbiAgICAgICAgICAgIGNhbnZhc0hlaWdodCA9IChjYW52YXNIZWlnaHQgKiBzY2FsZVRvRml0KSB8IDA7XG5cbiAgICAgICAgICAgIGlmKHJlbmRlcmVyKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXIuc2V0U2l6ZShjYW52YXNXaWR0aCwgY2FudmFzSGVpZ2h0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZ2FsbGVyeVZpZXcucmVzaXplKCk7XG5cbiAgICAgICAgICAgIG91dHB1dEltYWdlTmVlZHNVcGRhdGluZyA9IHRydWU7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gb25Ib2xkKGV2KSB7XG5cbiAgICAgICAgICAgIGlmKCF1c2luZ1RoZVJlbmRlcmVyKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHJlbmRlcmluZykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoc3dpdGNoVmlkZW8uY2hlY2tlZCkge1xuICAgICAgICAgICAgICAgIHN0YXJ0VmlkZW9SZWNvcmRpbmcoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGFrZVBpY3R1cmUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBvblJlbGVhc2UoZXYpIHtcblxuICAgICAgICAgICAgaWYoc3dpdGNoVmlkZW8uY2hlY2tlZCkge1xuICAgICAgICAgICAgICAgIHBhdXNlVmlkZW9SZWNvcmRpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gc2hvd1BhZ2UoaWQpIHtcblxuICAgICAgICAgICAgaWYoaWQgIT09ICdnYWxsZXJ5Jykge1xuICAgICAgICAgICAgICAgIHNob3coYnRuR2FsbGVyeSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGhpZGUoYnRuR2FsbGVyeSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFjdGl2ZVBhZ2UgPSBpZDtcblxuICAgICAgICAgICAgcGFnZXNbaWRdLnNob3coKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBzaG93Q2FtZXJhQnV0dG9uKCkge1xuXG4gICAgICAgICAgICBidG5DYW1lcmEuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG5cbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYWxsZXJ5Q29hY2hNZXNzYWdlJykuaW5uZXJIVE1MID0gJ1lvdSBjYW4gYWRkIHBob3RvcyBieSB0YXBwaW5nIDxpbWcgc3JjPVwiaW1nL2ljb25zL2ljbi1jYW1lcmFAMngucG5nXCIgaWQ9XCJnYWxsZXJ5Q29hY2hNYXJrc0NhbWVyYVwiPiBvciA8aW1nIHNyYz1cImltZy9pY29ucy9pY24tZmlsZXBpY2tlckAyeC5wbmdcIiBpZD1cImdhbGxlcnlDb2FjaE1hcmtzRmlsZVBpY2tlclwiPic7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gZW5hYmxlQWRkaXRpb25hbENvbnRyb2xzKCkge1xuICAgICAgICAgICAgYWRkaXRpb25hbENvbnRyb2xzLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBkaXNhYmxlQWRkaXRpb25hbENvbnRyb2xzKCkge1xuICAgICAgICAgICAgYWRkaXRpb25hbENvbnRyb2xzLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuICAgICAgICB9XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhIHBpY3R1cmUgZnJvbSB0aGUgZ2FsbGVyeVBpY3R1cmVzIGhhc2guIHVwZGF0ZUdhbGxlcnkgbXVzdCBiZSBjYWxsZWQgYXRcbiAgICAgICAgICogbGVhc3Qgb25jZSBiZWZvcmUgY2FsbGluZyB0aGlzIG9uZSBmb3IgdGhlIGdhbGxlcnlQaWN0dXJlcyBvYmplY3QgdG8gYmUgZmlsbGVkIGluXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBnZXRQaWN0dXJlQnlJZChwaWN0dXJlSWQpIHtcblxuICAgICAgICAgICAgcmV0dXJuIGdhbGxlcnlQaWN0dXJlc1twaWN0dXJlSWRdO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwbGF5IHRoZSBzZWxlY3RlZCBwaWN0dXJlIGFuZCBhbGxvdyB0byBwZXJmb3JtIGFjdGlvbnMgb3ZlciBpdCB0b29cbiAgICAgICAgICogSWYgdGhlIHBpY3R1cmUgaGFzIGFscmVhZHkgYmVlbiBzaGFyZWQgdG8gaW1ndXIsIGl0IHdpbGwgc2hvdyB0aGUgdXJsIG9mIHRoZVxuICAgICAgICAgKiBwaWN0dXJlIGluIGltZ3VyXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBzaG93RGV0YWlscyhwaWN0dXJlSWQpIHtcblxuICAgICAgICAgICAgZ2FsbGVyeURldGFpbHMuaW5uZXJIVE1MID0gJ0xvYWRpbmcuLi4nO1xuXG4gICAgICAgICAgICB2YXIgcGljdHVyZSA9IGdldFBpY3R1cmVCeUlkKHBpY3R1cmVJZCk7XG5cbiAgICAgICAgICAgIHZhciBjb3VudERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgY291bnREaXYuaW5uZXJIVE1MID0gcGljdHVyZS5wb3NpdGlvbiArICcgb2YgJyArIHBpY3R1cmVDb3VudDtcblxuICAgICAgICAgICAgdmFyIGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgICAgICAgaW1nLnNyYyA9IHBpY3R1cmUuaW1hZ2VEYXRhO1xuXG4gICAgICAgICAgICBIYW1tZXIoaW1nLCB7IGRyYWc6IGZhbHNlIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihldikge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIGZvciBhdm9pZGluZyB0aGUgZHJhZyBiZWhhdmlvdXIgd2hlcmUgYSAnZ2hvc3QnIGltYWdlXG4gICAgICAgICAgICAgICAgICAgIC8vIGlzIGRyYWdnZWRcbiAgICAgICAgICAgICAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5vbignc3dpcGVyaWdodCcsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICAgICAgICAgICAgICAgIGV2Lmdlc3R1cmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1ByZXZQaWN0dXJlKHBpY3R1cmVJZCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ3N3aXBlbGVmdCcsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICAgICAgICAgICAgICAgIGV2Lmdlc3R1cmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgc2hvd05leHRQaWN0dXJlKHBpY3R1cmVJZCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBwaWN0dXJlIGhhcyBhbHJlYWR5IGJlZW4gdXBsb2FkZWQgdG8gaW1ndXIgd2UnbGwganVzdCBzaG93IHRoZVxuICAgICAgICAgICAgLy8gZXhpc3RpbmcgaW1ndXIgVVJMXG4gICAgICAgICAgICB2YXIgdXBsb2FkQWN0aW9uID0gcGljdHVyZS5pbWd1clVSTCA/IHNob3dJbWd1clBpY3R1cmUgOiB1cGxvYWRQaWN0dXJlO1xuXG4gICAgICAgICAgICB2YXIgYWN0aW9ucyA9IFtdO1xuXG4gICAgICAgICAgICBpZih3aW5kb3cuTW96QWN0aXZpdHkpIHtcbiAgICAgICAgICAgICAgICBhY3Rpb25zLnB1c2goeyB0ZXh0OiAnU2hhcmUnLCBhY3Rpb246IHNoYXJlQWN0aW9uLCBpZDogJ3NoYXJlJyB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKHsgdGV4dDogJ1NoYXJlIHdpdGggaW1ndXInLCBhY3Rpb246IHVwbG9hZEFjdGlvbiwgaWQ6ICdzaGFyZScgfSk7XG4gICAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKHsgdGV4dDogJ0Rvd25sb2FkJywgYWN0aW9uOiBkb3dubG9hZFBpY3R1cmUsIGlkOiAnZG93bmxvYWQnIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhY3Rpb25zLnB1c2goeyB0ZXh0OiAnRGVsZXRlJywgYWN0aW9uOiBkZWxldGVQaWN0dXJlLCBpZDogJ2RlbGV0ZScgfSk7XG5cbiAgICAgICAgICAgIGdhbGxlcnlEZXRhaWxzRm9vdGVyLmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgICAgICBhY3Rpb25zLmZvckVhY2goZnVuY3Rpb24oYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgICAgICAgICAgICBlbGVtLnR5cGUgPSAnaW1hZ2UnO1xuICAgICAgICAgICAgICAgIGVsZW0uaWQgPSAnYnRuXycgKyBhY3Rpb24uaWQ7XG4gICAgICAgICAgICAgICAgZWxlbS50aXRsZSA9IGFjdGlvbi50ZXh0O1xuXG4gICAgICAgICAgICAgICAgZWxlbS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbi5hY3Rpb24ocGljdHVyZUlkLCBwaWN0dXJlKTtcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgZ2FsbGVyeURldGFpbHNGb290ZXIuYXBwZW5kQ2hpbGQoZWxlbSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLyp2YXIgdXJsRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cbiAgICAgICAgICAgIGlmKHBpY3R1cmUuaW1ndXJVUkwpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW1ndXIgPSBwaWN0dXJlLmltZ3VyVVJMO1xuICAgICAgICAgICAgICAgIHVybERpdi5pbm5lckhUTUwgPSAnU2hhcmU6IDxhIGhyZWY9XCInICsgaW1ndXIgKyAnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+JyArIGltZ3VyICsgJzwvYT4nO1xuICAgICAgICAgICAgfSovXG5cbiAgICAgICAgICAgIGdhbGxlcnlEZXRhaWxzLmlubmVySFRNTCA9ICcnO1xuICAgICAgICAgICAgZ2FsbGVyeURldGFpbHMuYXBwZW5kQ2hpbGQoY291bnREaXYpO1xuICAgICAgICAgICAgZ2FsbGVyeURldGFpbHMuYXBwZW5kQ2hpbGQoaW1nKTtcbiAgICAgICAgICAgIC8vYWN0aW9uc0Rpdi5hcHBlbmRDaGlsZCh1cmxEaXYpO1xuXG4gICAgICAgICAgICBnYWxsZXJ5RGV0YWlscy5yZW1vdmVBdHRyaWJ1dGUoJ2hpZGRlbicpO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIHNob3dQcmV2UGljdHVyZShjdXJyZW50SWQpIHtcblxuICAgICAgICAgICAgdmFyIHBpY3R1cmUgPSBnZXRQaWN0dXJlQnlJZChjdXJyZW50SWQpO1xuICAgICAgICAgICAgaWYocGljdHVyZS5wcmV2aW91c1BpY3R1cmUpIHtcbiAgICAgICAgICAgICAgICBuYXZpZ2F0ZVRvRGV0YWlscyhwaWN0dXJlLnByZXZpb3VzUGljdHVyZS5pZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gc2hvd05leHRQaWN0dXJlKGN1cnJlbnRJZCkge1xuXG4gICAgICAgICAgICB2YXIgcGljdHVyZSA9IGdldFBpY3R1cmVCeUlkKGN1cnJlbnRJZCk7XG4gICAgICAgICAgICBpZihwaWN0dXJlLm5leHRQaWN0dXJlKSB7XG4gICAgICAgICAgICAgICAgbmF2aWdhdGVUb0RldGFpbHMocGljdHVyZS5uZXh0UGljdHVyZS5pZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwbG9hZCBwaWN0dXJlIHRvIGltZ3VyIGltYWdlIHNoYXJpbmcgc2VydmljZSwgd2hpY2ggYWxsb3dzIGZvciBjcm9zcyBkb21haW5cbiAgICAgICAgICogcmVxdWVzdHMgYW5kIGhlbmNlIGlzIHZlcnkgSlMgZnJpZW5kbHkhXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiB1cGxvYWRQaWN0dXJlKHBpY3R1cmVJZCwgcGljdHVyZSkge1xuXG4gICAgICAgICAgICB2YXIgaW1hZ2UgPSBwaWN0dXJlLmltYWdlRGF0YS5yZXBsYWNlKC9eZGF0YTppbWFnZVxcLyhwbmd8Z2lmKTtiYXNlNjQsLywgXCJcIik7XG5cbiAgICAgICAgICAgIHZhciBmZCA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgICAgICAgZmQuYXBwZW5kKFwiaW1hZ2VcIiwgaW1hZ2UpO1xuXG4gICAgICAgICAgICB2YXIgbW9kYWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd4LW1vZGFsJyk7XG4gICAgICAgICAgICBtb2RhbC5pbm5lckhUTUwgPSAnVXBsb2FkaW5nLi4uJztcbiAgICAgICAgICAgIG1vZGFsLmlkID0gJ2dhbGxlcnlVcGxvYWRpbmcnO1xuICAgICAgICAgICAgbW9kYWwuc2V0QXR0cmlidXRlKCdvdmVybGF5Jyk7XG4gICAgICAgICAgICBtb2RhbC5zZXRBdHRyaWJ1dGUoJ2VzYy1oaWRlJyk7XG4gICAgICAgICAgICAvLyBUT0RPIGNhbmNlbCBidXR0b25cblxuXG4gICAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICB4aHIub3BlbignUE9TVCcsICdodHRwczovL2FwaS5pbWd1ci5jb20vMy91cGxvYWQuanNvbicpO1xuICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCAnQ2xpZW50LUlEICcgKyBJTUdVUl9LRVkpO1xuXG4gICAgICAgICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICBnYWxsZXJ5RGV0YWlscy5yZW1vdmVDaGlsZChtb2RhbCk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICBpZihyZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdXJsID0gcmVzcG9uc2UuZGF0YS5saW5rO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGljdHVyZS5pbWd1clVSTCA9IHVybDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBpY3R1cmUuc2F2ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgVG9hc3QoJ1Bvc3RlZCB0byBpbWd1cicpLnNob3coKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93RGV0YWlscyhwaWN0dXJlSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGxvYWRQaWN0dXJlRXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwbG9hZFBpY3R1cmVFcnJvcigpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgIGdhbGxlcnlEZXRhaWxzLnJlbW92ZUNoaWxkKG1vZGFsKTtcbiAgICAgICAgICAgICAgICB1cGxvYWRQaWN0dXJlRXJyb3IoKTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgeGhyLnNlbmQoZmQpO1xuXG4gICAgICAgICAgICBtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdtb2RhbGhpZGUnLCBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgIGlmKHhocikge1xuICAgICAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZ2FsbGVyeURldGFpbHMucmVtb3ZlQ2hpbGQobW9kYWwpO1xuXG4gICAgICAgICAgICB9LCBmYWxzZSk7XG5cbiAgICAgICAgICAgIGdhbGxlcnlEZXRhaWxzLmFwcGVuZENoaWxkKG1vZGFsKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiB1cGxvYWRQaWN0dXJlRXJyb3IoKSB7XG5cbiAgICAgICAgICAgIG5ldyBUb2FzdCgnRXJyb3IgcG9zdGluZyBwaWN0dXJlIDotLycpLnNob3coKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBzaG93SW1ndXJQaWN0dXJlKHBpY3R1cmVJZCwgcGljdHVyZSkge1xuXG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdNb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaG93SW1ndXInKTtcbiAgICAgICAgICAgIGlmKGV4aXN0aW5nTW9kYWwpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ01vZGFsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZXhpc3RpbmdNb2RhbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBtb2RhbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3gtbW9kYWwnKTtcbiAgICAgICAgICAgIG1vZGFsLmlubmVySFRNTCA9ICdpbWd1cjogPGEgaHJlZj1cIicgKyBwaWN0dXJlLmltZ3VyVVJMICsgJ1wiIHRhcmdldD1cIl9ibGFua1wiPicgKyBwaWN0dXJlLmltZ3VyVVJMICsgJzwvYT4nO1xuICAgICAgICAgICAgbW9kYWwuc2V0QXR0cmlidXRlKCdvdmVybGF5Jyk7XG4gICAgICAgICAgICBtb2RhbC5zZXRBdHRyaWJ1dGUoJ2VzYy1oaWRlJyk7XG4gICAgICAgICAgICBtb2RhbC5pZCA9ICdzaG93SW1ndXInO1xuXG4gICAgICAgICAgICBtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdtb2RhbGhpZGUnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBnYWxsZXJ5RGV0YWlscy5yZW1vdmVDaGlsZChtb2RhbCk7XG4gICAgICAgICAgICB9LCBmYWxzZSk7XG5cbiAgICAgICAgICAgIGdhbGxlcnlEZXRhaWxzLmFwcGVuZENoaWxkKG1vZGFsKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gYjY0VG9CbG9iKGI2NERhdGEsIGNvbnRlbnRUeXBlLCBzbGljZVNpemUpIHtcblxuICAgICAgICAgICAgY29udGVudFR5cGUgPSBjb250ZW50VHlwZSB8fCAnJztcbiAgICAgICAgICAgIHNsaWNlU2l6ZSA9IHNsaWNlU2l6ZSB8fCAxMDI0O1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBjaGFyQ29kZUZyb21DaGFyYWN0ZXIoYykge1xuICAgICAgICAgICAgICAgIHJldHVybiBjLmNoYXJDb2RlQXQoMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBieXRlQ2hhcmFjdGVycyA9IGF0b2IoYjY0RGF0YSk7XG4gICAgICAgICAgICB2YXIgYnl0ZUFycmF5cyA9IFtdO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBvZmZzZXQgPSAwOyBvZmZzZXQgPCBieXRlQ2hhcmFjdGVycy5sZW5ndGg7IG9mZnNldCArPSBzbGljZVNpemUpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2xpY2UgPSBieXRlQ2hhcmFjdGVycy5zbGljZShvZmZzZXQsIG9mZnNldCArIHNsaWNlU2l6ZSk7XG4gICAgICAgICAgICAgICAgdmFyIGJ5dGVOdW1iZXJzID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHNsaWNlLCBjaGFyQ29kZUZyb21DaGFyYWN0ZXIpO1xuICAgICAgICAgICAgICAgIHZhciBieXRlQXJyYXkgPSBuZXcgVWludDhBcnJheShieXRlTnVtYmVycyk7XG5cbiAgICAgICAgICAgICAgICBieXRlQXJyYXlzLnB1c2goYnl0ZUFycmF5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihieXRlQXJyYXlzLCB7dHlwZTogY29udGVudFR5cGV9KTtcbiAgICAgICAgICAgIHJldHVybiBibG9iO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2hhcmUgcGljdHVyZSB1c2luZyBhIG5hdGl2ZSBBY3Rpdml0eVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gc2hhcmVBY3Rpb24ocGljdHVyZUlkLCBwaWN0dXJlKSB7XG5cbiAgICAgICAgICAgIHZhciBibG9iID0gYjY0VG9CbG9iKHBpY3R1cmUuaW1hZ2VEYXRhLnJlcGxhY2UoJ2RhdGE6aW1hZ2UvcG5nO2Jhc2U2NCwnLCAnJyksICdpbWFnZS9wbmcnKTtcbiAgICAgICAgICAgIHZhciBmaWxlbmFtZSA9IHBpY3R1cmVJZCArICcucG5nJztcblxuICAgICAgICAgICAgdmFyIGFjdGl2aXR5ID0gbmV3IE1vekFjdGl2aXR5KHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmUnLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlLyonLFxuICAgICAgICAgICAgICAgICAgICBudW1iZXI6IDEsXG4gICAgICAgICAgICAgICAgICAgIGJsb2JzOiBbIGJsb2IgXSxcbiAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWVzOiBbIGZpbGVuYW1lIF1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgYWN0aXZpdHkub25lcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpZihhY3Rpdml0eS5lcnJvci5uYW1lID09PSAnTk9fUFJPVklERVInKSB7XG4gICAgICAgICAgICAgICAgICAgIGFsZXJ0KCdubyBwcm92aWRlcicpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGFsZXJ0KCdTb3JyeS1lcnJvciB3aGVuIHNoYXJpbmcnLCBhY3Rpdml0eS5lcnJvci5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RoZSBlcnJvcicsIGFjdGl2aXR5LmVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIGRvd25sb2FkUGljdHVyZShwaWN0dXJlSWQsIHBpY3R1cmUpIHtcblxuICAgICAgICAgICAgdmFyIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgICAgICBhLnNldEF0dHJpYnV0ZSgnaHJlZicsIHBpY3R1cmUuaW1hZ2VEYXRhKTtcbiAgICAgICAgICAgIGEuc2V0QXR0cmlidXRlKCdkb3dubG9hZCcsIHBpY3R1cmVJZCArIHBpY3R1cmUuZ2V0RXh0ZW5zaW9uKCkpO1xuXG4gICAgICAgICAgICBhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGEpO1xuICAgICAgICAgICAgYS5jbGljaygpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChhKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBkZWxldGVQaWN0dXJlKHBpY3R1cmVJZCkge1xuXG4gICAgICAgICAgICB2YXIgcmVzID0gd2luZG93LmNvbmZpcm0oJ0FyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgdGhhdD8nKTtcblxuICAgICAgICAgICAgaWYocmVzKSB7XG4gICAgICAgICAgICAgICAgUGljdHVyZS5kZWxldGVCeUlkKHBpY3R1cmVJZCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIG5hdmlnYXRlVG9HYWxsZXJ5KCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gc2hvd0NhbWVyYUNvYWNoTWFya3MoKSB7XG5cbiAgICAgICAgICAgIGFzeW5jU3RvcmFnZS5nZXRJdGVtKCdmaXJzdFRpbWVVc2VyJywgZnVuY3Rpb24oZmlyc3RUaW1lVXNlcikge1xuXG4gICAgICAgICAgICAgICAgaWYoZmlyc3RUaW1lVXNlciA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBmaXJzdFRpbWVVc2VyID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZihmaXJzdFRpbWVVc2VyIHx8ICFjYW1lcmFDb2FjaE1hcmtzU2hvd24pIHtcbiAgICAgICAgICAgICAgICAgICAgc2hvdyhjYW1lcmFDb2FjaE1hcmtzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZihmaXJzdFRpbWVVc2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFDb2FjaE1hcmtzLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZShjYW1lcmFDb2FjaE1hcmtzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3luY1N0b3JhZ2Uuc2V0SXRlbSgnZmlyc3RUaW1lVXNlcicsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFDb2FjaE1hcmtzU2hvd24gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFDb2FjaE1hcmtzU2hvd24gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGUoY2FtZXJhQ29hY2hNYXJrcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gZW5hYmxlQ2FtZXJhKCkge1xuXG4gICAgICAgICAgICBndW1IZWxwZXIuc3RhcnRWaWRlb1N0cmVhbWluZyhmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgIC8vIEVycm9yIVxuICAgICAgICAgICAgICAgIGVycm9yQ2FsbGJhY2soXCJPb3BzISBDYW4ndCBhY2Nlc3MgdGhlIGNhbWVyYSA6LShcIik7XG5cbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKHN0cmVhbSwgdmlkZW9FbGVtZW50LCB3aWR0aCwgaGVpZ2h0KSB7XG5cbiAgICAgICAgICAgICAgICB2aWRlbyA9IHZpZGVvRWxlbWVudDtcbiAgICAgICAgICAgICAgICBsaXZlU3RyZWFtaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjaGFuZ2VJbnB1dFRvKHZpZGVvRWxlbWVudCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgc3dpdGNoVmlkZW8uc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgICAgICAgICAgICAgZW5hYmxlQWRkaXRpb25hbENvbnRyb2xzKCk7XG4gICAgICAgICAgICAgICAgYnRuQ2FtZXJhQ2FwdHVyZS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcbiAgICAgICAgICAgICAgICBzaG93Q2FtZXJhQ29hY2hNYXJrcygpO1xuICAgICAgICAgICAgICAgIHJlbmRlcigpO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBkaXNhYmxlQ2FtZXJhKCkge1xuXG4gICAgICAgICAgICBndW1IZWxwZXIuc3RvcFZpZGVvU3RyZWFtaW5nKCk7XG4gICAgICAgICAgICBzd2l0Y2hWaWRlby5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgICAgIGJ0bkNhbWVyYUNhcHR1cmUuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gY2hhbmdlSW5wdXRUbyhlbGVtZW50LCB3aWR0aCwgaGVpZ2h0KSB7XG5cbiAgICAgICAgICAgIGlucHV0RWxlbWVudCA9IGVsZW1lbnQ7XG5cbiAgICAgICAgICAgIGlucHV0V2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgIGlucHV0SGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgICAgICAgICBvblJlc2l6ZSgpO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIGNsZWFyUmVuZGVyZXIoKSB7XG5cbiAgICAgICAgICAgIC8vIFRvIGRlbGV0ZSB0aGUgbGFzdCBpbWFnZSBmcm9tIHRoZSByZW5kZXJlciwgd2Ugc2V0IGFuIGVtcHR5XG4gICAgICAgICAgICAvLyBjYW52YXMgYXMgaW5wdXQgZWxlbWVudC5cbiAgICAgICAgICAgIHZhciBlbXB0eUNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICAgICAgY2hhbmdlSW5wdXRUbyhlbXB0eUNhbnZhcywgaW5wdXRXaWR0aCwgaW5wdXRIZWlnaHQpO1xuICAgICAgICAgICAgb3V0cHV0SW1hZ2VOZWVkc1VwZGF0aW5nID0gdHJ1ZTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBkZXRhY2hSZW5kZXJlckNhbnZhcygpIHtcblxuICAgICAgICAgICAgdmFyIGNhbnZhcyA9IHJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cbiAgICAgICAgICAgIGlmKGNhbnZhcy5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgY2FudmFzLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoY2FudmFzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBhdHRhY2hSZW5kZXJlckNhbnZhcygpIHtcblxuICAgICAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW52YXNDb250YWluZXInKTtcbiAgICAgICAgICAgIHZhciBjYW52YXMgPSByZW5kZXJlci5kb21FbGVtZW50O1xuXG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY2FudmFzKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICAvLyBUT0RPIG1heWJlIHRoaXMucmVuZGVyZXIuaXNQYXVzZWQoKVxuICAgICAgICBmdW5jdGlvbiB1c2luZ1RoZVJlbmRlcmVyKCkge1xuXG4gICAgICAgICAgICByZXR1cm4gYWN0aXZlUGFnZSA9PT0gJ2NhbWVyYScgfHwgYWN0aXZlUGFnZSA9PT0gJ3BpY2tGaWxlJztcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBwcmV2aW91c0VmZmVjdCgpIHtcblxuICAgICAgICAgICAgaWYodXNpbmdUaGVSZW5kZXJlcigpKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0SW1hZ2VOZWVkc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZW5kZXJlci5wcmV2aW91c0VmZmVjdCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIG5leHRFZmZlY3QoKSB7XG5cbiAgICAgICAgICAgIGlmKHVzaW5nVGhlUmVuZGVyZXIoKSkge1xuICAgICAgICAgICAgICAgIG91dHB1dEltYWdlTmVlZHNVcGRhdGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXIubmV4dEVmZmVjdCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vIFNhdmUgc3RhdGljIGltYWdlXG4gICAgICAgIGZ1bmN0aW9uIHRha2VQaWN0dXJlKCkge1xuXG4gICAgICAgICAgICB2YXIgYml0bWFwRGF0YSA9IHJlbmRlcmVyLmRvbUVsZW1lbnQudG9EYXRhVVJMKCk7XG4gICAgICAgICAgICBzYXZlTG9jYWxQaWN0dXJlKGJpdG1hcERhdGEsIGZhbHNlKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBzdGFydFZpZGVvUmVjb3JkaW5nKCkge1xuXG4gICAgICAgICAgICAvLyBXZSBtaWdodCBhbHJlYWR5IGhhdmUgYSBoYWxmLXdheSByZWNvcmRlZCB2aWRlb1xuICAgICAgICAgICAgaWYoIWFuaW1hdGVkR0lGKSB7XG5cbiAgICAgICAgICAgICAgICBnaWZSZWNvcmRTdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgZ2lmTGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgICAgIHZpZGVvQ29udHJvbHMuY2xhc3NMaXN0LnJlbW92ZSgncmVuZGVyaW5nJyk7XG4gICAgICAgICAgICAgICAgdmlkZW9Qcm9ncmVzc0Jhci52YWx1ZSA9IDA7XG5cbiAgICAgICAgICAgICAgICBzaG93KHZpZGVvQ29udHJvbHMpO1xuXG4gICAgICAgICAgICAgICAgYW5pbWF0ZWRHSUYgPSBuZXcgQW5pbWF0ZWRfR0lGKHsgd29ya2VyUGF0aDogJ2pzL2xpYnMvQW5pbWF0ZWRfR0lGL3F1YW50aXplci5qcycgfSk7XG4gICAgICAgICAgICAgICAgLy8gVE9ETyBjYXAgbWF4IHNpemUgaGVyZVxuICAgICAgICAgICAgICAgIHZhciBjYW52YXMgPSByZW5kZXJlci5kb21FbGVtZW50O1xuICAgICAgICAgICAgICAgIGFuaW1hdGVkR0lGLnNldFNpemUoY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICBhbmltYXRlZEdJRi5zZXREZWxheShnaWZEZWxheSk7XG4gICAgICAgICAgICAgICAgYW5pbWF0ZWRHSUYuc2V0UmVwZWF0KDApO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFkZEZyYW1lVG9HSUYoKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBwYXVzZVZpZGVvUmVjb3JkaW5nKCkge1xuXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQocmVjb3JkR0lGVGltZW91dCk7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gYWRkRnJhbWVUb0dJRigpIHtcblxuICAgICAgICAgICAgYW5pbWF0ZWRHSUYuYWRkRnJhbWUocmVuZGVyZXIuZG9tRWxlbWVudCk7XG4gICAgICAgICAgICBnaWZMZW5ndGggKz0gZ2lmRGVsYXk7XG5cbiAgICAgICAgICAgIGlmKGdpZkxlbmd0aCA8IGdpZk1heExlbmd0aCAmJiAhYW5pbWF0ZWRHSUYuaXNSZW5kZXJpbmcoKSkge1xuXG4gICAgICAgICAgICAgICAgdmFyIHJlY29yZFByb2dyZXNzID0gZ2lmTGVuZ3RoICogMS4wIC8gZ2lmTWF4TGVuZ3RoO1xuICAgICAgICAgICAgICAgIHZpZGVvUHJvZ3Jlc3NCYXIudmFsdWUgPSByZWNvcmRQcm9ncmVzcztcbiAgICAgICAgICAgICAgICB2aWRlb1Byb2dyZXNzU3Bhbi5pbm5lckhUTUwgPSBNYXRoLmZsb29yKGdpZkxlbmd0aCAvIDEwKSAvIDEwMCArICdzJztcblxuICAgICAgICAgICAgICAgIHJlY29yZEdJRlRpbWVvdXQgPSBzZXRUaW1lb3V0KGFkZEZyYW1lVG9HSUYsIGdpZkRlbGF5KTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGZpbmlzaFZpZGVvUmVjb3JkaW5nKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBmaW5pc2hWaWRlb1JlY29yZGluZygpIHtcblxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHJlY29yZEdJRlRpbWVvdXQpO1xuXG4gICAgICAgICAgICB2aWRlb0NvbnRyb2xzLmNsYXNzTGlzdC5hZGQoJ3JlbmRlcmluZycpO1xuICAgICAgICAgICAgcmVuZGVyaW5nID0gdHJ1ZTtcblxuICAgICAgICAgICAgYnRuVmlkZW9DYW5jZWwuZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgYnRuVmlkZW9Eb25lLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHN3aXRjaFZpZGVvLmRpc2FibGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgYW5pbWF0ZWRHSUYub25SZW5kZXJQcm9ncmVzcyhmdW5jdGlvbihwcm9ncmVzcykge1xuXG4gICAgICAgICAgICAgICAgdmlkZW9Qcm9ncmVzc1NwYW4uaW5uZXJIVE1MID0gJ3JlbmRlcmluZyAnICsgTWF0aC5mbG9vcihwcm9ncmVzcyAqIDEwMCkgKyAnJSc7XG4gICAgICAgICAgICAgICAgdmlkZW9Qcm9ncmVzc0Jhci52YWx1ZSA9IHByb2dyZXNzO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgYW5pbWF0ZWRHSUYuZ2V0QmFzZTY0R0lGKGZ1bmN0aW9uKGdpZkRhdGEpIHtcblxuICAgICAgICAgICAgICAgIHNhdmVMb2NhbFBpY3R1cmUoZ2lmRGF0YSwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICB2aWRlb1Byb2dyZXNzU3Bhbi5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgICAgICAgICBoaWRlKHZpZGVvQ29udHJvbHMpO1xuXG4gICAgICAgICAgICAgICAgYnRuVmlkZW9DYW5jZWwuZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBidG5WaWRlb0RvbmUuZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzd2l0Y2hWaWRlby5kaXNhYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgcmVuZGVyaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmVuZGVyKCk7XG5cbiAgICAgICAgICAgICAgICAvLyB3ZSdyZSBkb25lIHdpdGggdGhpcyBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGFuaW1hdGVkR0lGID0gbnVsbDtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gY2FuY2VsVmlkZW9SZWNvcmRpbmcoKSB7XG5cbiAgICAgICAgICAgIGNsZWFyVGltZW91dChyZWNvcmRHSUZUaW1lb3V0KTtcbiAgICAgICAgICAgIC8vIFRPRE8gYW5pbWF0ZWRHSUYucmVzZXQoKTtcbiAgICAgICAgICAgIGhpZGUodmlkZW9Db250cm9scyk7XG4gICAgICAgICAgICB2aWRlb1Byb2dyZXNzQmFyLnZhbHVlID0gMDtcbiAgICAgICAgICAgIGFuaW1hdGVkR0lGID0gbnVsbDtcblxuICAgICAgICB9XG5cblxuICAgICAgICAvLyBkYXRhIGlzIGEgYmFzZTY0IGVuY29kZWQgZGF0YVVSTFxuICAgICAgICBmdW5jdGlvbiBzYXZlTG9jYWxQaWN0dXJlKGRhdGEsIGlzQW5pbWF0ZWQpIHtcblxuICAgICAgICAgICAgdmFyIHBpY3R1cmUgPSBuZXcgUGljdHVyZSgpO1xuICAgICAgICAgICAgcGljdHVyZS5pbWFnZURhdGEgPSBkYXRhO1xuICAgICAgICAgICAgcGljdHVyZS5pbWFnZUlzQW5pbWF0ZWQgPSBpc0FuaW1hdGVkO1xuXG4gICAgICAgICAgICBwaWN0dXJlLnNhdmUoZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICBnaG9zdEJpdG1hcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgICAgICAgICAgIGdob3N0Qml0bWFwLnNyYyA9IGRhdGE7XG5cbiAgICAgICAgICAgICAgICBmbGFzaGVyLmNsYXNzTGlzdC5hZGQoJ29uX2FuaW1hdGlvbicpO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiByZXF1ZXN0QW5pbWF0aW9uKCkge1xuXG4gICAgICAgICAgICBjYW5jZWxBbmltYXRpb25GcmFtZShhbmltYXRpb25GcmFtZUlkKTtcbiAgICAgICAgICAgIGFuaW1hdGlvbkZyYW1lSWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVuZGVyKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiByZW5kZXIoKSB7XG5cbiAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb24oKTtcblxuICAgICAgICAgICAgaWYobGl2ZVN0cmVhbWluZykge1xuICAgICAgICAgICAgICAgIGlmKCFyZW5kZXJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmKHZpZGVvLnJlYWR5U3RhdGUgPT09IHZpZGVvLkhBVkVfRU5PVUdIX0RBVEEpIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0SW1hZ2VOZWVkc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKG91dHB1dEltYWdlTmVlZHNVcGRhdGluZykge1xuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnVwZGF0ZVRleHR1cmUoaW5wdXRFbGVtZW50KTtcbiAgICAgICAgICAgICAgICBvdXRwdXRJbWFnZU5lZWRzVXBkYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBvcGVuRmlsZVBpY2tlcigpIHtcblxuICAgICAgICAgICAgLy8gQ2FuIHdlIHVzZSBhbiBpbnB1dCB0eXBlPWZpbGU/IFNvbWUgZWFybHkgcmVsZWFzZXMgb2YgRmlyZWZveCBPU1xuICAgICAgICAgICAgLy8gY2Fubm90ISBTbyBkZXRlY3QgdGhhdCBvdXQgYnkgY2hlY2tpbmcgdGhlIGFjdHVhbCB0eXBlIG9mIHRoZSBpbnB1dFxuICAgICAgICAgICAgLy8gV2hlbiBhIGJyb3dzZXIgZG9lc24ndCBpbXBsZW1lbnQgYSB0eXBlLCBpdCdzIHJlc2V0IHRvICd0ZXh0J1xuICAgICAgICAgICAgLy8gaW5zdGVhZCBvZiB0aGUgdHlwZSB3ZSBleHBlY3RlZFxuICAgICAgICAgICAgdmFyIGlucHV0ID0gZmlsZVBpY2tlci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpO1xuXG4gICAgICAgICAgICBpZihpbnB1dC50eXBlICE9PSAnZmlsZScpIHtcblxuICAgICAgICAgICAgICAgIC8vIE5vdCBzdXBwb3J0ZWQsIHNvIGxldCdzIHVzZSBhIFdlYiBhY3Rpdml0eSBpbnN0ZWFkXG4gICAgICAgICAgICAgICAgdmFyIGFjdGl2aXR5ID0gbmV3IE1vekFjdGl2aXR5KHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ3BpY2snLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvanBlZydcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgYWN0aXZpdHkub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwaWN0dXJlID0gdGhpcy5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRJbWFnZUZyb21CbG9iKHBpY3R1cmUuYmxvYik7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGFjdGl2aXR5Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgbmF2aWdhdGVUb0dhbGxlcnkoKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgaW5wdXQudmFsdWUgPSAnJztcbiAgICAgICAgICAgICAgICBmaWxlUGlja2VyLnJlbW92ZUF0dHJpYnV0ZSgnaGlkZGVuJyk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBvbkZpbGVQaWNrZWQoKSB7XG5cbiAgICAgICAgICAgIHZhciBmaWxlcyA9IHRoaXMuZmlsZXM7XG5cbiAgICAgICAgICAgIGZpbGVQaWNrZXIuc2V0QXR0cmlidXRlKCdoaWRkZW4nKTtcblxuICAgICAgICAgICAgaWYoZmlsZXMubGVuZ3RoID4gMCAmJiBmaWxlc1swXS50eXBlLmluZGV4T2YoJ2ltYWdlLycpID09PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBnZXQgZGF0YSBmcm9tIHBpY2tlZCBmaWxlXG4gICAgICAgICAgICAgICAgLy8gcHV0IHRoYXQgaW50byBhbiBlbGVtZW50XG4gICAgICAgICAgICAgICAgdmFyIGZpbGUgPSBmaWxlc1swXTtcbiAgICAgICAgICAgICAgICBsb2FkSW1hZ2VGcm9tQmxvYihmaWxlKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIGxvYWRJbWFnZUZyb21CbG9iKGJsb2IpIHtcblxuICAgICAgICAgICAgdmFyIGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuXG4gICAgICAgICAgICBlbmFibGVBZGRpdGlvbmFsQ29udHJvbHMoKTtcbiAgICAgICAgICAgIGJ0blN0YXRpY0NhcHR1cmUuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG5cblxuICAgICAgICAgICAgaW1nLnNyYyA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICAgICAgICAgICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIC8vd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodGhpcy5zcmMpOyAvLyBUT0RPIG1heWJlIHRvbyBlYXJseT9cblxuICAgICAgICAgICAgICAgIGNoYW5nZUlucHV0VG8oaW1nLCBpbWcud2lkdGgsIGltZy5oZWlnaHQpO1xuXG4gICAgICAgICAgICAgICAgb3V0cHV0SW1hZ2VOZWVkc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZW5kZXIoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gb25GaWxlUGlja2VyVHJhbnNpdGlvbkVuZCgpIHtcblxuICAgICAgICAgICAgZmlsZVBpY2tlci5yZW1vdmVFdmVudExpc3RlbmVyKCd3ZWJraXRUcmFuc2l0aW9uRW5kJywgb25GaWxlUGlja2VyVHJhbnNpdGlvbkVuZCwgZmFsc2UpO1xuICAgICAgICAgICAgZmlsZVBpY2tlci5yZW1vdmVFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJywgb25GaWxlUGlja2VyVHJhbnNpdGlvbkVuZCwgZmFsc2UpO1xuICAgICAgICAgICAgbmF2aWdhdGVUb0dhbGxlcnkoKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBvbkZpbGVQaWNrZXJDYW5jZWxlZCgpIHtcblxuICAgICAgICAgICAgZmlsZVBpY2tlci5hZGRFdmVudExpc3RlbmVyKCd3ZWJraXRUcmFuc2l0aW9uRW5kJywgb25GaWxlUGlja2VyVHJhbnNpdGlvbkVuZCwgZmFsc2UpO1xuICAgICAgICAgICAgZmlsZVBpY2tlci5hZGRFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJywgb25GaWxlUGlja2VyVHJhbnNpdGlvbkVuZCwgZmFsc2UpO1xuICAgICAgICAgICAgZmlsZVBpY2tlci5zZXRBdHRyaWJ1dGUoJ2hpZGRlbicsICcnKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBoaWRlKGVsZW1lbnQsIHRyYW5zaXRpb25MZW5ndGgpIHtcblxuICAgICAgICAgICAgdHJhbnNpdGlvbkxlbmd0aCA9IHRyYW5zaXRpb25MZW5ndGggfHwgVFJBTlNJVElPTl9MRU5HVEg7XG4gICAgICAgICAgICBlbGVtZW50LnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICB9LCB0cmFuc2l0aW9uTGVuZ3RoKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBzaG93KGVsZW1lbnQpIHtcblxuICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgICAgICAgICAgIH0sIDEpO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIGdvdG9HYWxsZXJ5KCkge1xuXG4gICAgICAgICAgICBkaXNhYmxlQWRkaXRpb25hbENvbnRyb2xzKCk7XG4gICAgICAgICAgICBkZXRhY2hSZW5kZXJlckNhbnZhcygpO1xuICAgICAgICAgICAgZGlzYWJsZUNhbWVyYSgpO1xuXG4gICAgICAgICAgICBnYWxsZXJ5Vmlldy5zaG93TG9hZGluZygpO1xuICAgICAgICAgICAgc2hvd1BhZ2UoJ2dhbGxlcnknKTtcblxuICAgICAgICAgICAgUGljdHVyZS5nZXRBbGwoZnVuY3Rpb24ocGljdHVyZXMpIHtcblxuICAgICAgICAgICAgICAgIC8vIFNob3cgbW9zdCByZWNlbnQgcGljdHVyZXMgZmlyc3RcbiAgICAgICAgICAgICAgICBwaWN0dXJlcy5yZXZlcnNlKCk7XG5cbiAgICAgICAgICAgICAgICBnYWxsZXJ5UGljdHVyZXMgPSB7fTtcbiAgICAgICAgICAgICAgICBwaWN0dXJlQ291bnQgPSBwaWN0dXJlcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBpZihwaWN0dXJlQ291bnQpIHtcblxuICAgICAgICAgICAgICAgICAgICBoaWRlKGdhbGxlcnlDb2FjaE1hcmtzKTtcblxuICAgICAgICAgICAgICAgICAgICBwaWN0dXJlcy5mb3JFYWNoKGZ1bmN0aW9uKHBpYywgcG9zaXRpb24pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcGljLnBvc2l0aW9uID0gcG9zaXRpb24gKyAxOyAvLyBIdW1hbnMgYXJlIG5vdCAwLWJhc2VkIVxuICAgICAgICAgICAgICAgICAgICAgICAgcGljLnByZXZpb3VzUGljdHVyZSA9IHBvc2l0aW9uID4gMCA/IHBpY3R1cmVzW3Bvc2l0aW9uIC0gMV0gOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGljLm5leHRQaWN0dXJlID0gcG9zaXRpb24gPCBwaWN0dXJlQ291bnQgLSAxID8gcGljdHVyZXNbcG9zaXRpb24gKyAxXSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBnYWxsZXJ5UGljdHVyZXNbcGljLmlkXSA9IHBpYztcblxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgc2hvdyhnYWxsZXJ5Q29hY2hNYXJrcyk7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBnYWxsZXJ5Vmlldy5zZXRQaWN0dXJlcyhnYWxsZXJ5UGljdHVyZXMpO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBnb3RvRGV0YWlscyhhcmdzKSB7XG5cbiAgICAgICAgICAgIGRpc2FibGVBZGRpdGlvbmFsQ29udHJvbHMoKTtcbiAgICAgICAgICAgIGRldGFjaFJlbmRlcmVyQ2FudmFzKCk7XG4gICAgICAgICAgICBzaG93UGFnZSgnZGV0YWlscycpO1xuICAgICAgICAgICAgc2hvd0RldGFpbHMoYXJncy5pZCk7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gZ290b0NhbWVyYSgpIHtcblxuICAgICAgICAgICAgZW5hYmxlQ2FtZXJhKCk7XG4gICAgICAgICAgICBjbGVhclJlbmRlcmVyKCk7XG4gICAgICAgICAgICBhdHRhY2hSZW5kZXJlckNhbnZhcygpO1xuICAgICAgICAgICAgc2hvd1BhZ2UoJ2NhbWVyYScpO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIGdvdG9TdGF0aWMoKSB7XG5cbiAgICAgICAgICAgIGNsZWFyUmVuZGVyZXIoKTtcbiAgICAgICAgICAgIGF0dGFjaFJlbmRlcmVyQ2FudmFzKCk7XG4gICAgICAgICAgICBzaG93UGFnZSgncGlja0ZpbGUnKTtcbiAgICAgICAgICAgIGJ0blN0YXRpY0NhcHR1cmUuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG4gICAgICAgICAgICBvcGVuRmlsZVBpY2tlcigpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvL1xuXG4gICAgICAgIGZ1bmN0aW9uIG5hdmlnYXRlVG9HYWxsZXJ5KCkge1xuICAgICAgICAgICAgcm91dGVyLm5hdmlnYXRlKCdnYWxsZXJ5Jyk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIG5hdmlnYXRlVG9EZXRhaWxzKGlkKSB7XG4gICAgICAgICAgICByb3V0ZXIubmF2aWdhdGUoJ2RldGFpbHMnLCB7IGlkOiBpZCB9KTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gbmF2aWdhdGVUb0NhbWVyYSgpIHtcbiAgICAgICAgICAgIHJvdXRlci5uYXZpZ2F0ZSgnY2FtZXJhJyk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIG5hdmlnYXRlVG9TdGF0aWMoKSB7XG4gICAgICAgICAgICByb3V0ZXIubmF2aWdhdGUoJ3N0YXRpYycpO1xuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiByZXN0b3JlTGFzdCgpIHtcbiAgICAgICAgICAgIC8vIFRPRE9cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8gJ1B1YmxpYycgbWV0aG9kc1xuXG4gICAgICAgIHRoaXMub3BlbkdhbGxlcnkgPSBuYXZpZ2F0ZVRvR2FsbGVyeTtcbiAgICAgICAgdGhpcy5vcGVuQ2FtZXJhID0gbmF2aWdhdGVUb0NhbWVyYTtcbiAgICAgICAgdGhpcy5vcGVuU3RhdGljID0gbmF2aWdhdGVUb1N0YXRpYztcblxuICAgICAgICB0aGlzLnJlc3RvcmVMYXN0ID0gcmVzdG9yZUxhc3Q7XG5cbiAgICB9O1xuXG4gICAgLy9yZXR1cm4gQXBwO1xuXG4vLyB9KTtcbi8vXG5tb2R1bGUuZXhwb3J0cyA9IEFwcDtcbiIsIi8vZGVmaW5lKFtdLCBmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIEdhbGxlcnlWaWV3KCkge1xuXG4gICAgICAgIHZhciByb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHZhciBwaWN0dXJlcyA9IHt9O1xuICAgICAgICB2YXIgdmlld3BvcnRIZWlnaHQgPSAwO1xuICAgICAgICB2YXIgc2Nyb2xsVG9wID0gMDtcbiAgICAgICAgdmFyIG9uUGljdHVyZUNsaWNrZWRDYiA9IGZ1bmN0aW9uKCkge307XG5cbiAgICAgICAgcm9vdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uQ2xpY2ssIGZhbHNlKTtcblxuICAgICAgICBvblNjcm9sbCgpO1xuXG5cbiAgICAgICAgZnVuY3Rpb24gb25TY3JvbGwoKSB7XG4gICAgICAgICAgICByb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIG9uU2Nyb2xsLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIHNjcm9sbFRvcCA9IHJvb3Quc2Nyb2xsVG9wO1xuXG4gICAgICAgICAgICB1cGRhdGVWaXNpYmxlKCk7XG5cbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcm9vdC5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCBvblNjcm9sbCwgZmFsc2UpO1xuICAgICAgICAgICAgfSwgMTAwKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gb25DbGljayhldikge1xuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xuXG4gICAgICAgICAgICBpZih0YXJnZXQgJiYgdGFyZ2V0Lm5vZGVOYW1lID09PSAnRElWJykge1xuICAgICAgICAgICAgICAgIHZhciBwaWN0dXJlSWQgPSB0YXJnZXQuZGF0YXNldC5pZDtcbiAgICAgICAgICAgICAgICBpZihwaWN0dXJlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgb25QaWN0dXJlQ2xpY2tlZENiKHBpY3R1cmVJZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIG1ha2VFbGVtZW50KHBpY3R1cmUpIHtcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ3VybCgnICsgcGljdHVyZS5pbWFnZURhdGEgKyAnKSc7XG4gICAgICAgICAgICBlbC5kYXRhc2V0LmlkID0gcGljdHVyZS5pZDtcbiAgICAgICAgICAgIHJldHVybiBlbDtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8gSGlkZS9zaG93IGl0ZW1zIHRoYXQgYXJlIGludmlzaWJsZS92aXNpYmxlIGFjY29yZGluZyB0byBzY3JvbGwgcG9zaXRpb25cbiAgICAgICAgZnVuY3Rpb24gdXBkYXRlVmlzaWJsZSgpIHtcblxuICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gcm9vdC5jaGlsZE5vZGVzO1xuICAgICAgICAgICAgdmFyIG51bSA9IGNoaWxkcmVuLmxlbmd0aDtcbiAgICAgICAgICAgIHZhciBtYXJnaW4gPSA1MDtcbiAgICAgICAgICAgIHZhciB2aWV3cG9ydEVuZCA9IHNjcm9sbFRvcCArIHZpZXdwb3J0SGVpZ2h0O1xuXG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbnVtOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGRIZWlnaHQgPSBjaGlsZC5jbGllbnRIZWlnaHQ7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkVG9wID0gY2hpbGQub2Zmc2V0VG9wO1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZFN0eWxlID0gY2hpbGQuc3R5bGU7XG5cbiAgICAgICAgICAgICAgICBpZihjaGlsZFRvcCArIGNoaWxkSGVpZ2h0ICsgbWFyZ2luIDwgc2Nyb2xsVG9wIHx8IGNoaWxkVG9wIC0gbWFyZ2luID4gdmlld3BvcnRFbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRTdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRTdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIFxuXG4gICAgICAgIC8vIH5+flxuXG4gICAgICAgIFxuICAgICAgICB0aGlzLmRvbUVsZW1lbnQgPSByb290O1xuXG5cbiAgICAgICAgLy8gVXNlZCB3aGVuIHdlIHdhbnQgdG8gZGlzcGxheSBhIGxvYWRpbmcgaW5kaWNhdG9yIHdoaWxlIHdlIHJldHJpZXZlIGRhdGFcbiAgICAgICAgdGhpcy5zaG93TG9hZGluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcm9vdC5pbm5lckhUTUwgPSAnPHAgY2xhc3M9XCJsb2FkaW5nXCI+TG9hZGluZzwvcD4nO1xuICAgICAgICB9O1xuXG5cbiAgICAgICAgdGhpcy5zZXRQaWN0dXJlcyA9IGZ1bmN0aW9uKHBpY3R1cmVzKSB7XG5cbiAgICAgICAgICAgIHJvb3QuaW5uZXJIVE1MID0gJyc7XG5cbiAgICAgICAgICAgIGZvcih2YXIgayBpbiBwaWN0dXJlcykge1xuICAgICAgICAgICAgICAgIHZhciBwaWN0dXJlID0gcGljdHVyZXNba107XG4gICAgICAgICAgICAgICAgdmFyIGVsZW0gPSBtYWtlRWxlbWVudChwaWN0dXJlKTtcbiAgICAgICAgICAgICAgICByb290LmFwcGVuZENoaWxkKGVsZW0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJlc2l6ZSgpO1xuXG4gICAgICAgICAgICB1cGRhdGVWaXNpYmxlKCk7XG5cbiAgICAgICAgfTtcblxuXG4gICAgICAgIHRoaXMucmVzaXplID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgIHZpZXdwb3J0SGVpZ2h0ID0gcm9vdC5jbGllbnRIZWlnaHQ7XG4gICAgICAgICAgICB1cGRhdGVWaXNpYmxlKCk7XG5cbiAgICAgICAgfTtcblxuXG4gICAgICAgIC8vIFNldHMgcGljdHVyZSBjbGlja2VkIGNhbGxiYWNrXG4gICAgICAgIHRoaXMub25QaWN0dXJlQ2xpY2tlZCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cbiAgICAgICAgICAgIG9uUGljdHVyZUNsaWNrZWRDYiA9IGNhbGxiYWNrO1xuXG4gICAgICAgIH07XG5cbiAgICB9XG5cbi8vICAgIHJldHVybiBHYWxsZXJ5Vmlldztcbi8vfSApO1xuLy9cbm1vZHVsZS5leHBvcnRzID0gR2FsbGVyeVZpZXc7XG4iLCJmdW5jdGlvbiBJbWFnZUVmZmVjdChwYXJhbXMpIHtcblx0XG5cdHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHRoaXMudmVydGV4U2hhZGVyU2NyaXB0ID0gcGFyYW1zLnZlcnRleFNoYWRlcjtcblx0dGhpcy5mcmFnbWVudFNoYWRlclNjcmlwdCA9IHBhcmFtcy5mcmFnbWVudFNoYWRlcjtcblx0dGhpcy5zaGFkZXJQcm9ncmFtID0gbnVsbDtcblx0dGhpcy51bmlmb3JtcyA9IHBhcmFtcy51bmlmb3JtcyB8fCB7fTtcblx0dGhpcy5hdHRyaWJ1dGVzID0gcGFyYW1zLmF0dHJpYnV0ZXMgfHwge307XG5cblx0Ly8gfn5+XG5cdFxuXHRmdW5jdGlvbiBpbml0U2hhZGVyKGdsLCB0eXBlLCBzY3JpcHQpIHtcblx0XHRpZiggZ2wuc2hhZGVyc0NhY2hlWyBzY3JpcHQgXSA9PT0gdW5kZWZpbmVkICkge1xuXG5cdFx0XHR2YXIgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKCB0eXBlICk7XG5cdFx0XHRnbC5zaGFkZXJTb3VyY2UoIHNoYWRlciwgc2NyaXB0ICk7XG5cdFx0XHRnbC5jb21waWxlU2hhZGVyKCBzaGFkZXIgKTtcblxuXHRcdFx0aWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdTaGFkZXIgPHN0cm9uZz4nICsgc2NyaXB0ICsgJzwvc3Ryb25nPiBjb3VsZCBub3QgYmUgY29tcGlsZWRcXG4nICsgZ2wuZ2V0U2hhZGVySW5mb0xvZyhzaGFkZXIpKTtcblx0XHRcdH1cblxuXHRcdFx0Z2wuc2hhZGVyc0NhY2hlWyBzY3JpcHQgXSA9IHNoYWRlcjtcblxuXHRcdFx0cmV0dXJuIHNoYWRlcjtcblxuXHRcdH1cblxuXHRcdHJldHVybiBnbC5zaGFkZXJzQ2FjaGVbIHNjcmlwdCBdO1xuXG5cdH1cblxuXHRmdW5jdGlvbiBpbml0VW5pZm9ybXMoZ2wsIHByb2dyYW0sIHBhaXJzKSB7XG5cdFx0Zm9yKHZhciBrIGluIHBhaXJzKSB7XG5cdFx0XHRwYWlyc1trXS5pZCA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBrKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBpbml0QXR0cmlidXRlcyhnbCwgcHJvZ3JhbSwgcGFpcnMpIHtcblx0XHRmb3IodmFyIGsgaW4gcGFpcnMpIHtcblx0XHRcdHBhaXJzW2tdLmlkID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgayk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gfn5+XG5cblx0dGhpcy5pbml0aWFsaXNlID0gZnVuY3Rpb24oZ2wpIHtcblxuXHRcdHZhciB2ZXJ0ZXhTaGFkZXIsIGZyYWdtZW50U2hhZGVyO1xuXHRcdHZhciBzaGFkZXJQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuXG5cdFx0dmVydGV4U2hhZGVyID0gaW5pdFNoYWRlcihnbCwgZ2wuVkVSVEVYX1NIQURFUiwgdGhpcy52ZXJ0ZXhTaGFkZXJTY3JpcHQpO1xuXHRcdGZyYWdtZW50U2hhZGVyID0gaW5pdFNoYWRlcihnbCwgZ2wuRlJBR01FTlRfU0hBREVSLCB0aGlzLmZyYWdtZW50U2hhZGVyU2NyaXB0KTtcblxuXHRcdGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuXHRcdGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCBmcmFnbWVudFNoYWRlcik7XG5cdFx0Z2wubGlua1Byb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cblx0XHRpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIoc2hhZGVyUHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1NoYWRlcnMgY291bGQgbm90IGJlIGxpbmtlZCcpO1xuXHRcdH1cblxuXHRcdGdsLnVzZVByb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cblx0XHRpbml0VW5pZm9ybXMoZ2wsIHNoYWRlclByb2dyYW0sIHRoaXMudW5pZm9ybXMpO1xuXHRcdGluaXRBdHRyaWJ1dGVzKGdsLCBzaGFkZXJQcm9ncmFtLCB0aGlzLmF0dHJpYnV0ZXMpO1xuXG5cdFx0dGhpcy5zaGFkZXJQcm9ncmFtID0gc2hhZGVyUHJvZ3JhbTtcblxuXHR9O1xuXG5cblx0dGhpcy5lbmFibGUgPSBmdW5jdGlvbihnbCkge1xuXHRcdC8vIFRPRE86IGZyb20gdGhpcy5hdHRyaWJ1dGVzXG5cdFx0Z2wudXNlUHJvZ3JhbSh0aGlzLnNoYWRlclByb2dyYW0pO1xuXHRcdGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHRoaXMuYXR0cmlidXRlcy51di5pZCk7XG5cdFx0Z2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkodGhpcy5hdHRyaWJ1dGVzLnBvc2l0aW9uLmlkKTtcblx0fTtcblxuXHR0aGlzLmRpc2FibGUgPSBmdW5jdGlvbihnbCkge1xuXHRcdC8vIFRPRE86IGZyb20gdGhpcy5hdHRyaWJ1dGVzXG5cdFx0Z2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkodGhpcy5hdHRyaWJ1dGVzLnV2LmlkKTtcblx0XHRnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheSh0aGlzLmF0dHJpYnV0ZXMucG9zaXRpb24uaWQpO1xuXHR9O1xufVxuXG4vKmRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIEltYWdlRWZmZWN0O1xufSk7Ki9cblxubW9kdWxlLmV4cG9ydHMgPSBJbWFnZUVmZmVjdDtcbiIsImZ1bmN0aW9uIE1pbmlSb3V0ZXIoKSB7XG5cbiAgICB2YXIgdGhhdCA9IHRoaXMsXG4gICAgICAgIHJvdXRlcyA9IHt9LFxuICAgICAgICB3aW5kb3dPYmplY3QgPSBudWxsO1xuXG5cbiAgICB0aGlzLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgcm91dGVzID0ge307XG5cbiAgICB9O1xuXG5cbiAgICB0aGlzLmFkZCA9IGZ1bmN0aW9uKG5hbWUsIHBhdGgsIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgcm91dGVzW25hbWVdID0ge1xuICAgICAgICAgICAgcGF0aDogcGF0aCxcbiAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFja1xuXG4gICAgICAgIH07XG4gICAgfTtcblxuXG4gICAgdGhpcy5uYXZpZ2F0ZSA9IGZ1bmN0aW9uKG5hbWUsIGFyZ3MpIHtcblxuICAgICAgICBpZihyb3V0ZXNbbmFtZV0pIHtcblxuICAgICAgICAgICAgdmFyIHJvdXRlID0gcm91dGVzW25hbWVdO1xuICAgICAgICAgICAgdmFyIHBhdGggPSByb3V0ZS5wYXRoO1xuXG4gICAgICAgICAgICBpZih3aW5kb3dPYmplY3QpIHtcblxuICAgICAgICAgICAgICAgIGZvcih2YXIgayBpbiBhcmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoJzonICsgaywgYXJnc1trXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdpbmRvd09iamVjdC5oaXN0b3J5LnB1c2hTdGF0ZSh7IG5hbWU6IG5hbWUsIGFyZ3M6IGFyZ3MgfSwgJycsIHBhdGgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJvdXRlLmNhbGxiYWNrKGFyZ3MpO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gcm91dGUnLCBuYW1lKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG5cbiAgICB0aGlzLmF0dGFjaFRvID0gZnVuY3Rpb24od2luKSB7XG5cbiAgICAgICAgd2luZG93T2JqZWN0ID0gd2luO1xuXG4gICAgICAgIHdpbmRvd09iamVjdC5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICAgICAgdmFyIHN0YXRlID0gZS5zdGF0ZTtcblxuICAgICAgICAgICAgaWYoc3RhdGUgJiYgc3RhdGUubmFtZSkge1xuXG4gICAgICAgICAgICAgICAgdGhhdC5uYXZpZ2F0ZShzdGF0ZS5uYW1lLCBzdGF0ZS5hcmdzKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0sIGZhbHNlKTtcblxuICAgIH07XG5cbn1cblxuXG4vKmlmKGRlZmluZSkge1xuXG4gICAgZGVmaW5lKFtdLCBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIE1pbmlSb3V0ZXI7XG4gICAgfSk7XG5cbn0qL1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1pbmlSb3V0ZXI7XG4iLCIvLyBUaGlzIGNsYXNzIHdpbGwgYmUgdXNlZCB0byBzdG9yZSBhbmQgcmV0cmlldmUgdGFrZW4gcGljdHVyZXMgYW5kIHNvbWVcbi8vIGFzc29jaWF0ZWQgbWV0YWRhdGEsIHVzaW5nIEluZGV4ZWREQlxuLy9kZWZpbmUoWydsaWJzL2FzeW5jU3RvcmFnZSddLCBmdW5jdGlvbihub3RVc2VkKSB7XG5cbnZhciBhc3luY1N0b3JhZ2UgPSByZXF1aXJlKCcuL2xpYnMvYXN5bmNTdG9yYWdlJyk7XG5cbiAgICB2YXIgUElDVFVSRVNfTElTVF9LRVkgPSAncGljdHVyZXNfbGlzdCc7XG4gICAgdmFyIFBJQ1RVUkVfUFJFRklYID0gJ3BpY3R1cmVfJztcblxuICAgIGZ1bmN0aW9uIGdldFBpY3R1cmVzTGlzdChjYWxsYmFjaykge1xuXG4gICAgICAgIGFzeW5jU3RvcmFnZS5nZXRJdGVtKFBJQ1RVUkVTX0xJU1RfS0VZLCBmdW5jdGlvbihsaXN0KSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmKCFsaXN0KSB7XG4gICAgICAgICAgICAgICAgbGlzdCA9IFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYWxsYmFjayhsaXN0KTtcblxuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIHNhdmVQaWN0dXJlc0xpc3QodXBkYXRlZExpc3QsIGNhbGxiYWNrKSB7XG4gICAgICAgIGFzeW5jU3RvcmFnZS5zZXRJdGVtKFBJQ1RVUkVTX0xJU1RfS0VZLCB1cGRhdGVkTGlzdCwgY2FsbGJhY2spO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gYWRkVG9QaWN0dXJlc0xpc3QocGljdHVyZUlkKSB7XG4gICAgICAgIFxuICAgICAgICBnZXRQaWN0dXJlc0xpc3QoZnVuY3Rpb24obGlzdCkge1xuXG4gICAgICAgICAgICAvLyBObyBkdXBsaWNhdGVzISAoZm9yIHdoZW4gdXBkYXRpbmcgcGljdHVyZXMpXG4gICAgICAgICAgICBpZihsaXN0LmluZGV4T2YocGljdHVyZUlkKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsaXN0LnB1c2gocGljdHVyZUlkKTtcbiAgICAgICAgICAgICAgICBzYXZlUGljdHVyZXNMaXN0KGxpc3QpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiByZW1vdmVGcm9tUGljdHVyZXNMaXN0KHBpY3R1cmVJZCwgY2FsbGJhY2spIHtcblxuICAgICAgICBnZXRQaWN0dXJlc0xpc3QoZnVuY3Rpb24obGlzdCkge1xuXG4gICAgICAgICAgICB2YXIgcG9zID0gbGlzdC5pbmRleE9mKHBpY3R1cmVJZCk7XG5cbiAgICAgICAgICAgIGlmKHBvcyAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsaXN0LnNwbGljZShwb3MsIDEpO1xuICAgICAgICAgICAgICAgIHNhdmVQaWN0dXJlc0xpc3QobGlzdCwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gcGFkKHYpIHtcblxuICAgICAgICB2YXIgcyA9IFN0cmluZyh2KTtcblxuICAgICAgICBpZihzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHMgPSAnMCcgKyBzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHM7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBnZXRUaW1lc3RhbXAoKSB7XG5cbiAgICAgICAgdmFyIG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgICAgIHZhciBwYXJ0cyA9IFtcbiAgICAgICAgICAgIG5vdy5nZXRGdWxsWWVhcigpLFxuICAgICAgICAgICAgcGFkKG5vdy5nZXRNb250aCgpICsgMSksIC8vIG1vbnRocyBhcmUgMCBiYXNlZCFcbiAgICAgICAgICAgIHBhZChub3cuZ2V0RGF0ZSgpKSxcbiAgICAgICAgICAgICdfJyxcbiAgICAgICAgICAgIHBhZChub3cuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICBwYWQobm93LmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICBwYWQobm93LmdldFNlY29uZHMoKSlcbiAgICAgICAgXTtcbiAgICAgICAgdmFyIHRpbWVzdGFtcCA9IHBhcnRzLmpvaW4oJycpO1xuXG4gICAgICAgIHJldHVybiB0aW1lc3RhbXA7XG5cbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGd1ZXNzSXNJbWFnZUFuaW1hdGVkKGRhdGEpIHtcbiAgICBcbiAgICAgICAgdmFyIGFuaW1hdGVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgICAgYW5pbWF0ZWQgPSBkYXRhLmluZGV4T2YoJ2ltYWdlL2dpZicpICE9PSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhbmltYXRlZDtcblxuICAgIH1cblxuXG4gICAgdmFyIFBpYyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbWFnZURhdGEgPSBudWxsO1xuICAgICAgICB0aGlzLmltYWdlSXNBbmltYXRlZCA9IG51bGw7XG4gICAgICAgIHRoaXMuaW1ndXJVUkwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2F2ZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZighc2VsZi5pZCkge1xuICAgICAgICAgICAgICAgIHNlbGYuaWQgPSBQSUNUVVJFX1BSRUZJWCArIGdldFRpbWVzdGFtcCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZighc2VsZi5pbWFnZUlzQW5pbWF0ZWQpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmltYWdlSXNBbmltYXRlZCA9IGd1ZXNzSXNJbWFnZUFuaW1hdGVkKHRoaXMuaW1hZ2VEYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2F2aW5nIHN0dWZmXG4gICAgICAgICAgICBhc3luY1N0b3JhZ2Uuc2V0SXRlbShzZWxmLmlkLCB7XG5cbiAgICAgICAgICAgICAgICBpbWFnZURhdGE6IHRoaXMuaW1hZ2VEYXRhLFxuICAgICAgICAgICAgICAgIGltYWdlSXNBbmltYXRlZDogdGhpcy5pbWFnZUlzQW5pbWF0ZWQsXG4gICAgICAgICAgICAgICAgaW1ndXJVUkw6IHRoaXMuaW1ndXJVUkxcblxuICAgICAgICAgICAgfSwgZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICBhZGRUb1BpY3R1cmVzTGlzdChzZWxmLmlkKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldEV4dGVuc2lvbiA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICBpZihzZWxmLmltYWdlSXNBbmltYXRlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnLmdpZic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnLnBuZyc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcblxuICAgIH07XG5cblxuICAgIFBpYy5nZXRBbGwgPSBmdW5jdGlvbihjYWxsYmFjay8qIG51bUl0ZW1zUGVyUGFnZSwgcGFnZSAqLykge1xuICAgICAgICBcbiAgICAgICAgZ2V0UGljdHVyZXNMaXN0KGZ1bmN0aW9uKGxpc3QpIHtcbiBcbiAgICAgICAgICAgIHZhciBwaWN0dXJlcyA9IFtdO1xuICAgICAgICAgICAgdmFyIHBvc2l0aW9uID0gMDsgLy8gKHBhZ2UgLSAxKSAqIG51bUl0ZW1zUGVyUGFnZVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZihsaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBsb2FkUGljdHVyZShwb3NpdGlvbik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKHBpY3R1cmVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gb25QaWN0dXJlTG9hZGVkKHBpY3R1cmUsIGxvYWRlZFBvc2l0aW9uKSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgbmV4dFBvc2l0aW9uID0gbG9hZGVkUG9zaXRpb24gKyAxO1xuXG4gICAgICAgICAgICAgICAgcGljdHVyZXMucHVzaChwaWN0dXJlKTtcblxuICAgICAgICAgICAgICAgIGlmKG5leHRQb3NpdGlvbiA+PSBsaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhwaWN0dXJlcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9hZFBpY3R1cmUobmV4dFBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gbG9hZFBpY3R1cmUocG9zaXRpb24sIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgICAgICAgICBQaWMuZ2V0QnlJZChsaXN0W3Bvc2l0aW9uXSwgZnVuY3Rpb24ocGljdHVyZSkge1xuICAgICAgICAgICAgICAgICAgICBvblBpY3R1cmVMb2FkZWQocGljdHVyZSwgcG9zaXRpb24pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG5cbiAgICBQaWMuZ2V0QnlJZCA9IGZ1bmN0aW9uKGlkLCBjYWxsYmFjaykge1xuXG4gICAgICAgIGFzeW5jU3RvcmFnZS5nZXRJdGVtKGlkLCBmdW5jdGlvbih2YWx1ZSkge1xuXG4gICAgICAgICAgICBpZighdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhmYWxzZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcGljdHVyZSA9IG5ldyBQaWMoKTtcbiAgICAgICAgICAgIHBpY3R1cmUuaWQgPSBpZDtcbiAgICAgICAgICAgIHBpY3R1cmUuaW1hZ2VEYXRhID0gdmFsdWUuaW1hZ2VEYXRhIHx8IG51bGw7XG4gICAgICAgICAgICBwaWN0dXJlLmltYWdlSXNBbmltYXRlZCA9IHZhbHVlLmltYWdlSXNBbmltYXRlZCB8fCBudWxsO1xuICAgICAgICAgICAgcGljdHVyZS5pbWd1clVSTCA9IHZhbHVlLmltZ3VyVVJMIHx8IG51bGw7XG5cbiAgICAgICAgICAgIGNhbGxiYWNrKHBpY3R1cmUpO1xuXG4gICAgICAgIH0pO1xuICAgIH07XG5cblxuICAgIFBpYy5kZWxldGVCeUlkID0gZnVuY3Rpb24oaWQsIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgYXN5bmNTdG9yYWdlLnJlbW92ZUl0ZW0oaWQsIGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICByZW1vdmVGcm9tUGljdHVyZXNMaXN0KGlkLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAxMCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9KTtcblxuICAgIH07XG5cblxuICAgIFBpYy5nZXRMaXN0ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblxuICAgICAgICBnZXRQaWN0dXJlc0xpc3QoY2FsbGJhY2spO1xuXG4gICAgfTtcblxuXG4gICAgUGljLmZpeExpc3QgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXG4gICAgICAgIGdldFBpY3R1cmVzTGlzdChmdW5jdGlvbihsaXN0KSB7XG5cbiAgICAgICAgICAgIHZhciBvdXRwdXRMaXN0ID0gW107XG4gICAgICAgICAgICB2YXIgaW52YWxpZExpc3QgPSBbXTtcblxuICAgICAgICAgICAgaWYobGlzdC5sZW5ndGggPT09IDApIHtcblxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBsaXN0LmZvckVhY2goZnVuY3Rpb24oaW5kZXgpIHtcblxuICAgICAgICAgICAgICAgICAgICBQaWMuZ2V0QnlJZChpbmRleCwgZnVuY3Rpb24ocGljdHVyZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihwaWN0dXJlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0TGlzdC5wdXNoKGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZExpc3QucHVzaChpbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKG91dHB1dExpc3QubGVuZ3RoICsgaW52YWxpZExpc3QubGVuZ3RoID09PSBsaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhdmVQaWN0dXJlc0xpc3Qob3V0cHV0TGlzdCwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgIH07XG5cbm1vZHVsZS5leHBvcnRzID0gUGljO1xuXG4vL30pO1xuIiwiLyoqXG4gKiBUaGUgUmVuZGVyZXIgaXMgdGhlIHBhcnQgb2YgdGhlIGFwcCB0aGF0IGFjY2VwdHMgdW5wcm9jZXNzZWQgaW1hZ2VzIGFzIGlucHV0XG4gKiBhbmQgcHJvY2Vzc2VzIHRoZW0gdG8gcHJvZHVjZSBkaWZmZXJlbnQgdmlzdWFsIFwiZWZmZWN0c1wiLCB1c2luZyBXZWJHTCBzaGFkZXJzLlxuICogRmluYWxseSB0aGUgcmVzdWx0IGlzIG91dHB1dCBpbnRvIGEgQ2FudmFzIHRoYXQgd2UgcHJvdmlkZSB3aGVuIGNyZWF0aW5nIHRoZVxuICogcmVuZGVyZXIgaW5zdGFuY2UuXG4gKlxuICogRWFjaCBlZmZlY3QgcmVxdWlyZXMgYSB2ZXJ0ZXggYW5kIGEgZnJhZ21lbnQgc2hhZGVyLiBUaGVzZSBhcmUgbGl0dGxlIHBpZWNlcyBvZlxuICogY29kZSB0aGF0IGFyZSBjb21waWxlZCBhbmQgc2VudCB0byB0aGUgZ3JhcGhpY3MgY2FyZCwgYW5kIGFyZSBleGVjdXRlZCBieSBpdCxcbiAqIGluc3RlYWQgb2YgeW91ciBDUFUuXG4gKlxuICogQWxsIFdlYkdMIHJlbGF0ZWQgY29kZSBpbiB0aGUgYXBwbGljYXRpb24gaXMgaGVyZSBhbmQgaW4gSW1hZ2VFZmZlY3QuanNcbiAqXG4gKiBWaXNpdCBodHRwOi8vd2ViZ2wub3JnIGlmIHlvdSB3YW50IHRvIGxlYXJuIG1vcmUgYWJvdXQgV2ViR0wuXG4gKi9cbi8vIGRvIHRoZSByZXF1aXJlLmpzIGRhbmNlXG4vL2RlZmluZShbJ0ltYWdlRWZmZWN0JywgJ2xpYnMvZ2xtYXRyaXgubWluJ10sIGZ1bmN0aW9uKEltYWdlRWZmZWN0LCBnbE1hdHJpeCkge1xuXG52YXIgSW1hZ2VFZmZlY3QgPSByZXF1aXJlKCcuL0ltYWdlRWZmZWN0Jyk7XG52YXIgZ2xNYXRyaXggPSByZXF1aXJlKCcuL2xpYnMvZ2xtYXRyaXgubWluJyk7XG5cbmZ1bmN0aW9uIFJlbmRlcmVyKGVycm9yQ2FsbGJhY2ssIHJlYWR5Q2FsbGJhY2spIHtcbiAgICAgICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdmFyIGdsO1xuICAgICAgICB2YXIgZWZmZWN0cyA9IFtdO1xuICAgICAgICB2YXIgZWZmZWN0RGVmaW5pdGlvbnMgPSB7XG4gICAgICAgICAgICAnTW9zYWljJzogeyB2ZXJ0ZXg6ICdwbGFuZS52cycsIGZyYWdtZW50OiAnbW9zYWljLmZzJyB9LFxuICAgICAgICAgICAgJ0RpdGhlcmluZyc6IHsgdmVydGV4OiAncGxhbmUudnMnLCBmcmFnbWVudDogJ2RpdGhlcmluZy5mcycgfSxcbiAgICAgICAgICAgICdQb3N0ZXJpemUnOiB7IHZlcnRleDogJ3BsYW5lLnZzJywgZnJhZ21lbnQ6ICdwb3N0ZXJpemUuZnMnIH0sXG4gICAgICAgICAgICAnTmVnYXRpdmUnOiB7IHZlcnRleDogJ3BsYW5lLnZzJywgZnJhZ21lbnQ6ICduZWdhdGl2ZS5mcycgfSxcbiAgICAgICAgICAgICdHcmVlbiBNb25zdGVyJzogeyB2ZXJ0ZXg6ICdwbGFuZS52cycsIGZyYWdtZW50OiAnZ3JlZW5tb25zdGVyLmZzJyB9LFxuICAgICAgICAgICAgJ0JsYWNrICYgV2hpdGUnOiB7IHZlcnRleDogJ3BsYW5lLnZzJywgZnJhZ21lbnQ6ICdidy5mcycgfSxcbiAgICAgICAgICAgICdCYWQgcGhvdG9jb3B5JzogeyB2ZXJ0ZXg6ICdwbGFuZS52cycsIGZyYWdtZW50OiAnYmFkcGhvdG9jb3B5LmZzJyB9LFxuICAgICAgICAgICAgJ0JhY2sgdG8gMTk4MCc6IHsgdmVydGV4OiAncGxhbmUudnMnLCBmcmFnbWVudDogJ2JhY2t0bzE5ODAuZnMnIH1cbiAgICAgICAgfTtcbiAgICAgICAgdmFyIGFjdGl2ZUVmZmVjdCA9IG51bGw7XG4gICAgICAgIHZhciBzaGFkZXJzUmVhZHkgPSBmYWxzZTtcbiAgICAgICAgdmFyIHNoYWRlclByb2dyYW07XG4gICAgICAgIHZhciB2ZXJ0ZXhQb3NpdGlvbkJ1ZmZlcjtcbiAgICAgICAgdmFyIHV2QnVmZmVyO1xuICAgICAgICB2YXIgbXZNYXRyaXg7XG4gICAgICAgIHZhciBwTWF0cml4O1xuICAgICAgICB2YXIgdGV4dHVyZTtcbiAgICAgICAgdmFyIG9uRXJyb3JDYWxsYmFjayA9IGVycm9yQ2FsbGJhY2sgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgdmFyIG9uUmVhZHlDYWxsYmFjayA9IHJlYWR5Q2FsbGJhY2sgfHwgZnVuY3Rpb24oKSB7fTtcblxuICAgICAgICB0aGlzLmRvbUVsZW1lbnQgPSBjYW52YXM7XG5cbiAgICAgICAgZ2wgPSBpbml0V2ViR0woY2FudmFzKTtcblxuICAgICAgICBpZihnbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3JDYWxsYmFjaygnTG9va3MgbGlrZSBXZWJHTCBpcyBub3QgYXZhaWxhYmxlIGluIHRoaXMgYnJvd3NlcicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5pdFdlYkdMQnVmZmVycygpO1xuICAgICAgICBpbml0VGV4dHVyZSgpO1xuICAgICAgICBsb2FkRWZmZWN0cygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIZXJlIHdlIGp1c3Qgb2J0YWluIGEgd2ViZ2wgY29udGV4dCBmcm9tIHRoZSBjYW52YXMgd2UgZ2V0IHBhc3NlZFxuICAgICAgICAgKiBUaGUgY29udGV4dCBpcyB0aGVuIHVzZWQgZm9yIGNhbGxpbmcgaXRzIHByb3ZpZGVkIGdsIGZ1bmN0aW9uc1xuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gaW5pdFdlYkdMKGNhbnZhcykge1xuXG4gICAgICAgICAgICB2YXIgZ2wgPSBudWxsO1xuICAgICAgICAgICAgdmFyIG9wdGlvbnMgPSB7IHByZXNlcnZlRHJhd2luZ0J1ZmZlcjogdHJ1ZSB9O1xuXG4gICAgICAgICAgICBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KFwid2ViZ2xcIiwgb3B0aW9ucykgfHwgY2FudmFzLmdldENvbnRleHQoXCJleHBlcmltZW50YWwtd2ViZ2xcIiwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgIGlmKGdsKSB7XG4gICAgICAgICAgICAgICAgZ2wudmlld3BvcnRXaWR0aCA9IGNhbnZhcy53aWR0aDtcbiAgICAgICAgICAgICAgICBnbC52aWV3cG9ydEhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XG5cbiAgICAgICAgICAgICAgICBnbC5zaGFkZXJzQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGdsO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCZWZvcmUgd2UgY2FuIGRyYXcgYW55dGhpbmcgd2l0aCBXZWJHTCB3ZSBuZWVkIHRvIHNldCB1cCB3aGF0IHRvIGRyYXcuXG4gICAgICAgICAqIFdlYkdMIHVzZXMgdGhlIGNvbmNlcHQgb2YgYnVmZmVycywgd2hpY2ggYXJlIHNpbWlsYXIgdG8gYXJyYXlzLiBUaGVzZSBhcmVcbiAgICAgICAgICogdmVyeSBHUFUgZnJpZW5kbHkgYW5kIGFsbG93IFdlYkdMIHRvIHJ1biB2ZXJ5IGZhc3QsIGJ1dCBhcmUgYSBiaXQgbW9yZVxuICAgICAgICAgKiBpbmNvbnZlbmllbnQgdG8gc2V0dXAgdGhhbiBwbGFpbiBKYXZhU2NyaXB0IGFycmF5cy5cbiAgICAgICAgICpcbiAgICAgICAgICogV2Ugd2lsbCBuZWVkIGEgYnVmZmVyIGZvciB0aGUgdmVydGljZXMsIGFuZCBhbm90aGVyIGZvciB0aGUgdGV4dHVyZSBVVnNcbiAgICAgICAgICogKHRoaXMgaXMgYSB3YXkgb2Ygc3BlY2lmeWluZyB3aGljaCBwYXJ0IG9mIHRoZSB0ZXh0dXJlIGlzIGRyYXduIG9uIHRoZVxuICAgICAgICAgKiBvdXRwdXQgcGxhbmUpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBBcyB3ZSBqdXN0IHdhbnQgdG8gZHJhdyBhIHNvbWV3aGF0IHJlY3Rhbmd1bGFyIG91dHB1dCwgd2UganVzdCBuZWVkIHRvXG4gICAgICAgICAqIGRlZmluZSBmb3VyIHZlcnRpY2VzIG9uIGVhY2ggYnVmZmVyLlxuICAgICAgICAgKiBOb3RlIGhvdyB0aGUgYnVmZmVycyBoYXZlIG5vIG5vdGlvbiBvZiB4LCB5IG9yIHogY29vcmRpbmF0ZXMgLS1pdCdzIGp1c3RcbiAgICAgICAgICogZmxvYXQgdmFsdWVzIGZvciB0aGVtLlxuICAgICAgICAgKlxuICAgICAgICAgKiBXZSBhbHNvIGNyZWF0ZSBhIGNvdXBsZSBvZiA0eDQgbWF0cmljZXMgdGhhdCBhcmUgdXNlZCB0byB0cmFuc2Zvcm0gdGhlXG4gICAgICAgICAqIGFic3RyYWN0IDNEIHZlcnRpY2VzIGludG8gMkQuXG4gICAgICAgICAqXG4gICAgICAgICAqIFdoZW4geW91IHVzZSBhIDNEIGZyYW1ld29yayBsaWtlIHRocmVlLmpzLCB0aGlzIGtpbmQgb2YgdGhpbmdzIGFyZVxuICAgICAgICAgKiBhYnN0cmFjdGVkIGF3YXkgdmlhIHRoZSBDYW1lcmEgYW5kIFNjZW5lIGNsYXNzZXMuXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBpbml0V2ViR0xCdWZmZXJzKCkge1xuXG4gICAgICAgICAgICB2ZXJ0ZXhQb3NpdGlvbkJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRleFBvc2l0aW9uQnVmZmVyKTtcbiAgICAgICAgICAgIHZhciB2ZXJ0aWNlcyA9IFtcbiAgICAgICAgICAgICAgICAgMS4wLCAgMS4wLCAgMC4wLFxuICAgICAgICAgICAgICAgIC0xLjAsICAxLjAsICAwLjAsXG4gICAgICAgICAgICAgICAgIDEuMCwgLTEuMCwgIDAuMCxcbiAgICAgICAgICAgICAgICAtMS4wLCAtMS4wLCAgMC4wXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgbmV3IEZsb2F0MzJBcnJheSh2ZXJ0aWNlcyksIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgICAgIHZlcnRleFBvc2l0aW9uQnVmZmVyLml0ZW1TaXplID0gMztcbiAgICAgICAgICAgIHZlcnRleFBvc2l0aW9uQnVmZmVyLm51bUl0ZW1zID0gNDtcblxuICAgICAgICAgICAgdXZCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB1dkJ1ZmZlcik7XG5cbiAgICAgICAgICAgIHZhciB1dnMgPSBbXG4gICAgICAgICAgICAgICAgMS4wLCAxLjAsXG4gICAgICAgICAgICAgICAgMC4wLCAxLjAsXG4gICAgICAgICAgICAgICAgMS4wLCAwLjAsXG4gICAgICAgICAgICAgICAgMC4wLCAwLjBcbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KHV2cyksIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgICAgIHV2QnVmZmVyLml0ZW1TaXplID0gMjtcbiAgICAgICAgICAgIHV2QnVmZmVyLm51bUl0ZW1zID0gNDtcblxuICAgICAgICAgICAgbXZNYXRyaXggPSBnbE1hdHJpeC5tYXQ0LmNyZWF0ZSgpO1xuICAgICAgICAgICAgcE1hdHJpeCA9IGdsTWF0cml4Lm1hdDQuY3JlYXRlKCk7XG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpbmNlIHdlIHdpbGwganVzdCBiZSBwcm9jZXNzaW5nIG9uZSBzb3VyY2Ugb2YgaW1hZ2VzLCB3ZSB3aWxsIG9ubHlcbiAgICAgICAgICogbmVlZCB0byB1cGxvYWQgdG8gdGhlIGdyYXBoaWNzIGNhcmQgYW4gaW1hZ2UgZWFjaCB0aW1lLiBUaGUgXCJ0YXJnZXRcIiBvZiB0aGVzZVxuICAgICAgICAgKiB1cGxvYWRzIGlzIHRoZSB0ZXh0dXJlIHdlIGNyZWF0ZSBoZXJlXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBpbml0VGV4dHVyZSgpIHtcblxuICAgICAgICAgICAgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogSGVyZSB3ZSdsbCBsb2FkIGZpcnN0IGVhY2ggZWZmZWN0J3MgdmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXIncyBzb3VyY2VcbiAgICAgICAgICogZnJvbSB0aGVpciBzZXBhcmF0ZSBmaWxlcywgYW5kIHdoZW4gd2UgaGF2ZSBhbGwgZmlsZXMgbG9hZGVkIHdlJ2xsIGNyZWF0ZVxuICAgICAgICAgKiB0aGUgYWN0dWFsIGVmZmVjdHMsIGFuZCBjYWxsIHRoZSBvblJlYWR5Q2FsbGJhY2sgZnVuY3Rpb24gdG8gc2lnbmlmeSB3ZSBhcmVcbiAgICAgICAgICogcmVhZHkgdG8gcHJvY2VzcyBpbWFnZXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoZSB2ZXJ0ZXggc2hhZGVyIHdvcmtzIG92ZXIgdmVydGljZXMsIHNvIGl0IGNhbiB0cmFuc2Zvcm0gYW5kIG1vdmUgdGhlbSBpblxuICAgICAgICAgKiAzRCBzcGFjZTsgdGhlIGZyYWdtZW50IHNoYWRlciB3b3JrcyBvdmVyIGVhY2ggcGl4ZWwsIGFuZCBpdCdzIHJlc3BvbnNpYmxlIGZvclxuICAgICAgICAgKiBkZXRlcm1pbmluZyB3aGljaCBjb2xvdXIgdG8gdXNlIChvciB3aGV0aGVyIHRvIGRyYXcgYSBnaXZlbiBwaXhlbCBhdCBhbGwhKVxuICAgICAgICAgKlxuICAgICAgICAgKiBGb3IgdGhpcyBwYXJ0aWN1bGFyIGFwcCwgdGhlIHZlcnRleCBzaGFkZXIgaXMgdmVyeSBzaW1wbGUsIGFzIGl0IGp1c3QgZW5zdXJlc1xuICAgICAgICAgKiB0aGF0IHdlIGRyYXcgYSAyRCBwbGFuZS0tdGhhdCdzIHdoeSBhbGwgb2YgdGhlIGVmZmVjdHMgdXNlIHRoZSBzYW1lIHZlcnRleCBzaGFkZXIuXG4gICAgICAgICAqIFRoZSBmcmFnbWVudCBzaGFkZXIgaXMgd2hhdCBpcyByZWFsbHkgaW50ZXJlc3RpbmcgaGVyZSwgYW5kIGFsc28gZGlmZmVycyBiZXR3ZWVuXG4gICAgICAgICAqIGVhY2ggZWZmZWN0LlxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gbG9hZEVmZmVjdHMoKSB7XG4gICAgICAgICAgICAvLyBXZSBhbHdheXMgbmVlZCB0byBsb2FkIHNvbWUgY29tbW9uIHNoYWRlciBjb2RlLCBzbyBhZGQgdGhvc2UgdG8gdGhlXG4gICAgICAgICAgICAvLyBsaXN0IHRvIHN0YXJ0IHdpdGhcbiAgICAgICAgICAgIHZhciBmaWxlcyA9IFsnY29tbW9uLnZzJywgJ2NvbW1vbi5mcyddO1xuXG4gICAgICAgICAgICAvLyB0aGVuIGNvbGxlY3QgYWxsIGZpbGUgbmFtZXMgZnJvbSB0aGUgZWZmZWN0IGRlZmluaXRpb25zXG4gICAgICAgICAgICBmb3IodmFyIGsgaW4gZWZmZWN0RGVmaW5pdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgZGVmID0gZWZmZWN0RGVmaW5pdGlvbnNba107XG4gICAgICAgICAgICAgICAgZmlsZXMucHVzaChkZWYudmVydGV4KTtcbiAgICAgICAgICAgICAgICBmaWxlcy5wdXNoKGRlZi5mcmFnbWVudCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQW5kIGxvYWQgZWFjaCBzaGFkZXIgZmlsZS4gV2hlbiBkb25lLCB3ZSBjYW4gaW5pdGlhbGlzZSB0aGUgZWZmZWN0cy5cbiAgICAgICAgICAgIGxvYWRTaGFkZXJzKGZpbGVzLCBvbkVycm9yQ2FsbGJhY2ssIGZ1bmN0aW9uKHNoYWRlcnMpIHtcbiAgICAgICAgICAgICAgICBpbml0aWFsaXNlRWZmZWN0cyhzaGFkZXJzKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXZSB3aWxsIGJlIGxvYWRpbmcgc2hhZGVyIGZpbGVzIHNlcXVlbnRpYWxseS4gSWYgYW55IG9mIHRoZSBzaGFkZXJzXG4gICAgICAgICAqIGlzIG5vdCBmb3VuZCwgd2UnbGwganVzdCBjYW5jZWwgdGhlIHdob2xlIHRoaW5nIGFuZCByZXBvcnQgYW4gZXJyb3JcbiAgICAgICAgICogdmlhIGVycm9yQ2FsbGJhY2tcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIGxvYWRTaGFkZXJzKGZpbGVzLCBlcnJvckNhbGxiYWNrLCBkb25lQ2FsbGJhY2spIHtcblxuICAgICAgICAgICAgdmFyIGRpcmVjdG9yeSA9ICdzaGFkZXJzLyc7XG4gICAgICAgICAgICB2YXIgbG9hZGVkID0ge307XG4gICAgICAgICAgICB2YXIgZmlsZXNUb0xvYWQgPSBmaWxlcy5zbGljZSgwKTtcblxuICAgICAgICAgICAgbG9hZE5leHRTaGFkZXIoKTtcblxuICAgICAgICAgICAgLy9cblxuICAgICAgICAgICAgZnVuY3Rpb24gbG9hZE5leHRTaGFkZXIoKSB7XG5cbiAgICAgICAgICAgICAgICBpZihmaWxlc1RvTG9hZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkU2hhZGVyKGZpbGVzVG9Mb2FkLnNoaWZ0KCkpO1xuICAgICAgICAgICAgICAgICAgICB9LCAxKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkb25lQ2FsbGJhY2sobG9hZGVkKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gbG9hZFNoYWRlcihmaWxlbmFtZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgbG9hZCBzaGFkZXJzIHR3aWNlXG4gICAgICAgICAgICAgICAgaWYobG9hZGVkLmhhc093blByb3BlcnR5KGZpbGVuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2FkTmV4dFNoYWRlcihmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZ1bGxwYXRoID0gZGlyZWN0b3J5ICsgZmlsZW5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBmdWxscGF0aCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ3RleHQnO1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYocmVxdWVzdC5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yQ2FsbGJhY2soJ1NoYWRlciBmaWxlIG5vdCBmb3VuZDogJyArIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZGVkW2ZpbGVuYW1lXSA9IHJlcXVlc3QucmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZE5leHRTaGFkZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LnNlbmQoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogV2UgaGF2ZSB0YWtlbiBvdXQgdGhlIHBhcnRzIGNvbW1vbiB0byBhbGwgc2hhZGVycyBvbnRvXG4gICAgICAgICAqIGNvbW1vbi52cyAoZm9yIHRoZSB2ZXJ0ZXggc2hhZGVycykgYW5kIGNvbW1vbi5mcyAoZGl0dG8sIGJ1dCBmb3IgdGhlIGZyYWdtZW50XG4gICAgICAgICAqIHNoYWRlcnMpLlxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gaW5pdGlhbGlzZUVmZmVjdHMoc2hhZGVyc0RhdGEpIHtcblxuICAgICAgICAgICAgdmFyIHZlcnRleENvbW1vblNoYWRlciA9IHNoYWRlcnNEYXRhWydjb21tb24udnMnXTtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudENvbW1vblNoYWRlciA9IHNoYWRlcnNEYXRhWydjb21tb24uZnMnXTtcblxuICAgICAgICAgICAgZm9yKHZhciBrIGluIGVmZmVjdERlZmluaXRpb25zKSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZGVmID0gZWZmZWN0RGVmaW5pdGlvbnNba107XG4gICAgICAgICAgICAgICAgdmFyIHZlcnRleFNoYWRlciA9IHNoYWRlcnNEYXRhW2RlZi52ZXJ0ZXhdO1xuICAgICAgICAgICAgICAgIHZhciBmcmFnbWVudFNoYWRlciA9IHNoYWRlcnNEYXRhW2RlZi5mcmFnbWVudF07XG5cbiAgICAgICAgICAgICAgICB2ZXJ0ZXhTaGFkZXIgPSB2ZXJ0ZXhDb21tb25TaGFkZXIgKyB2ZXJ0ZXhTaGFkZXI7XG4gICAgICAgICAgICAgICAgZnJhZ21lbnRTaGFkZXIgPSBmcmFnbWVudENvbW1vblNoYWRlciArIGZyYWdtZW50U2hhZGVyO1xuXG4gICAgICAgICAgICAgICAgdmFyIGVmZmVjdCA9IG5ldyBJbWFnZUVmZmVjdCh7XG4gICAgICAgICAgICAgICAgICAgIHZlcnRleFNoYWRlcjogdmVydGV4U2hhZGVyLFxuICAgICAgICAgICAgICAgICAgICBmcmFnbWVudFNoYWRlcjogZnJhZ21lbnRTaGFkZXIsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV2OiB7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiB7fVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB1bmlmb3Jtczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvamVjdGlvbk1hdHJpeDoge30sXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbFZpZXdNYXRyaXg6IHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwOiB7fVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBlZmZlY3RzLnB1c2goZWZmZWN0KTtcbiAgICAgICAgICAgICAgICBlZmZlY3QuaW5pdGlhbGlzZShnbCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYWN0aXZlRWZmZWN0ID0gZWZmZWN0c1swXTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQob25FZmZlY3RzSW5pdGlhbGlzZWQsIDEpO1xuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsZWQgd2hlbiBhbGwgZWZmZWN0cyBhcmUgbG9hZGVkIGFuZCByZWFkeVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gb25FZmZlY3RzSW5pdGlhbGlzZWQoKSB7XG5cbiAgICAgICAgICAgIHNoYWRlcnNSZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBvblJlYWR5Q2FsbGJhY2soKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogRWFjaCB0aW1lIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGl0IHdpbGwgY2xlYXIgZXZlcnl0aGluZyBvbiBvdXIgb3V0cHV0IGNhbnZhc1xuICAgICAgICAgKiBhbmQgZHJhdyBhIHByb2Nlc3NlZCBpbWFnZSBvbiBpdCwgdXNpbmcgdGhlIGN1cnJlbnRseSBhY3RpdmUgZWZmZWN0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIGludm9sdmVzIGEgYml0IG9mIG1hdHJpeCBtYXRoIGZvciBwb3NpdGlvbmluZyBvdXIgcGxhbmUgaW4gZnJvbnQgb2YgdGhlXG4gICAgICAgICAqICdjYW1lcmEnLCBhbmQgc29tZSBhbW91bnQgb2YgXCJzdGF0ZSBzZXR0aW5nXCIuIFdoYXQgdGhpcyBtZWFucyBpcyB0aGF0IFdlYkdMXG4gICAgICAgICAqIHdvcmtzIGJ5IG1ha2luZyB2ZXJ5IHNpbXBsZSBjYWxscyBmb3IgZW5hYmxpbmcgYW5kIGRpc2FibGluZyAndGhpbmdzJyxcbiAgICAgICAgICogaW5zdGVhZCBvZiBjYWxsaW5nIGNvbXBsZXggZnVuY3Rpb25zIHRoYXQgdGFrZSBtYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEZvciBleGFtcGxlLCBpbnN0ZWFkIG9mIGludm9raW5nIGEgZnVuY3Rpb24gY2FsbGVkIFwiZHJhd1RleHR1cmVXaXRoRWZmZWN0XCJcbiAgICAgICAgICogdGhhdCB0YWtlcyBhIGxpc3Qgb2YgdmVydGljZXMsIGEgdGV4dHVyZSwgYSBsaXN0IG9mIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kIGFcbiAgICAgICAgICogcG9zaXRpb24sIHdlIGRvIHRoZSBmb2xsb3dpbmc6XG4gICAgICAgICAqIC0gY2FsY3VsYXRlIHRoZSBwb3NpdGlvbnMgd2l0aCB0aGUgbWF0NCBtYXRyaXggbGlicmFyeSxcbiAgICAgICAgICogLSBhY3RpdmF0ZSBhIHRleHR1cmUgdW5pdCBvciBcInNsb3RcIiAodGV4dHVyZTApLFxuICAgICAgICAgKiAtIGVuYWJsZSB0aGUgcGFydGljdWxhciB0ZXh0dXJlIHdlIHdhbnQgdG8gdXNlLCB3aXRoIGJpbmRUZXh0dXJlLFxuICAgICAgICAgKiAtIHRoZW4gZW5hYmxlIHRoZSBlZmZlY3QsIHdoaWNoIGludm9sdmVzIHRlbGxpbmcgV2ViR0wgdG8gdXNlIHRoZSBzaGFkZXJzXG4gICAgICAgICAqICAgYXNzb2NpYXRlZCB0byB0aGUgZWZmZWN0XG4gICAgICAgICAqIC0gdGVsbCBXZWJHTCB0byB1c2UgdGhlIG1hdHJpY2VzIHdlIGNhbGN1bGF0ZWQgYmVmb3JlXG4gICAgICAgICAqIC0gdGVsbCBXZWJHTCB0byBkcmF3IGEgc2VyaWVzIG9mIHRyaWFuZ2xlcywgYnkgcmVhZGluZyBpdHMgcG9zaXRpb25zIGZyb20gdGhlXG4gICAgICAgICAqICAgdmVydGV4UG9zaXRpb25CdWZmZXIgd2UgaW5pdGlhbGlzZWQgZWFybHkgb24uXG4gICAgICAgICAqIC0gYW5kIGZpbmFsbHkgZGlzYWJsZSB0aGUgZWZmZWN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEFnYWluLCAzRCBmcmFtZXdvcmtzIGFic3RyYWN0IGFsbCB0aGlzIGZvciB5b3UgYnkgcHJvdmlkaW5nIHNvbWUgJ3N5bnRhdGljIHN1Z2FyJy5cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIHJlbmRlcigpIHtcblxuICAgICAgICAgICAgaWYoIXNoYWRlcnNSZWFkeSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZ2wudmlld3BvcnQoMCwgMCwgZ2wudmlld3BvcnRXaWR0aCwgZ2wudmlld3BvcnRIZWlnaHQpO1xuICAgICAgICAgICAgZ2wuY2xlYXJDb2xvcigwLjAsIDAuMCwgMC4wLCAxLjApO1xuICAgICAgICAgICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQpO1xuXG4gICAgICAgICAgICBnbE1hdHJpeC5tYXQ0Lm9ydGhvKHBNYXRyaXgsIC0xLCAxLCAtMSwgMSwgMC4xLCAxMDAwKTtcblxuICAgICAgICAgICAgZ2xNYXRyaXgubWF0NC5pZGVudGl0eShtdk1hdHJpeCk7XG4gICAgICAgICAgICBnbE1hdHJpeC5tYXQ0LnRyYW5zbGF0ZShtdk1hdHJpeCwgbXZNYXRyaXgsIFswLjAsIDAuMCwgLTEuMF0pO1xuXG4gICAgICAgICAgICBhY3RpdmVFZmZlY3QuZW5hYmxlKGdsKTtcblxuICAgICAgICAgICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcblxuICAgICAgICAgICAgZ2wudW5pZm9ybTFpKGFjdGl2ZUVmZmVjdC51bmlmb3Jtcy5tYXAuaWQsIDApO1xuXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdXZCdWZmZXIpO1xuICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihhY3RpdmVFZmZlY3QuYXR0cmlidXRlcy51di5pZCwgdXZCdWZmZXIuaXRlbVNpemUsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2ZXJ0ZXhQb3NpdGlvbkJ1ZmZlcik7XG4gICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGFjdGl2ZUVmZmVjdC5hdHRyaWJ1dGVzLnBvc2l0aW9uLmlkLCB2ZXJ0ZXhQb3NpdGlvbkJ1ZmZlci5pdGVtU2l6ZSwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdihhY3RpdmVFZmZlY3QudW5pZm9ybXMucHJvamVjdGlvbk1hdHJpeC5pZCwgZmFsc2UsIHBNYXRyaXgpO1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdihhY3RpdmVFZmZlY3QudW5pZm9ybXMubW9kZWxWaWV3TWF0cml4LmlkLCBmYWxzZSwgbXZNYXRyaXgpO1xuXG4gICAgICAgICAgICBnbC5kcmF3QXJyYXlzKGdsLlRSSUFOR0xFX1NUUklQLCAwLCB2ZXJ0ZXhQb3NpdGlvbkJ1ZmZlci5udW1JdGVtcyk7XG5cbiAgICAgICAgICAgIGFjdGl2ZUVmZmVjdC5kaXNhYmxlKGdsKTtcblxuICAgICAgICB9XG5cblxuICAgICAgICB0aGlzLnNldFNpemUgPSBmdW5jdGlvbih3LCBoKSB7XG5cbiAgICAgICAgICAgIGdsLnZpZXdwb3J0V2lkdGggPSB3O1xuICAgICAgICAgICAgZ2wudmlld3BvcnRIZWlnaHQgPSBoO1xuXG4gICAgICAgICAgICBjYW52YXMud2lkdGggPSB3O1xuICAgICAgICAgICAgY2FudmFzLmhlaWdodCA9IGg7XG5cbiAgICAgICAgfTtcblxuXG4gICAgICAgIHRoaXMucHJldmlvdXNFZmZlY3QgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgdmFyIGluZGV4ID0gZWZmZWN0cy5pbmRleE9mKGFjdGl2ZUVmZmVjdCk7XG4gICAgICAgICAgICB2YXIgbmV3SW5kZXggPSAtLWluZGV4IDwgMCA/IGVmZmVjdHMubGVuZ3RoIC0gMSA6IGluZGV4O1xuXG4gICAgICAgICAgICBhY3RpdmVFZmZlY3QgPSBlZmZlY3RzW25ld0luZGV4XTtcblxuICAgICAgICB9O1xuXG5cbiAgICAgICAgdGhpcy5uZXh0RWZmZWN0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgIHZhciBpbmRleCA9IGVmZmVjdHMuaW5kZXhPZihhY3RpdmVFZmZlY3QpO1xuICAgICAgICAgICAgdmFyIG5ld0luZGV4ID0gKytpbmRleCAlIGVmZmVjdHMubGVuZ3RoO1xuXG4gICAgICAgICAgICBhY3RpdmVFZmZlY3QgPSBlZmZlY3RzW25ld0luZGV4XTtcblxuICAgICAgICB9O1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoaXMgaXMgdXNlZCB0byB1cGxvYWQgYSBjb3B5IG9mIHRoZSBjdXJyZW50IGFwcGVhcmFuY2Ugb2YgdGhlIHZpZGVvIGVsZW1lbnRcbiAgICAgICAgICogb250byBvdXIgV2ViR0wgdGV4dHVyZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQXMgaXQgaGFwcGVucyBvbiB0aGUgcmVuZGVyIG1ldGhvZCwgd2UgbmVlZCB0byBtYWtlIGEgbG90IG9mIHNtYWxsLCBzaW1wbGVcbiAgICAgICAgICogZnVuY3Rpb24gY2FsbHMgdG8gZ2V0IHRoZSBpbWFnZSBpbiBXZWJHTC1sYW5kLCBhbmQgdGhlbiBkaXNhYmxlIHRoZSB0ZXh0dXJlXG4gICAgICAgICAqIChwYXNzaW5nICdudWxsJyBhcyB0ZXh0dXJlIHBhcmFtZXRlcikuXG4gICAgICAgICAqXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnVwZGF0ZVRleHR1cmUgPSBmdW5jdGlvbih2aWRlbykge1xuXG4gICAgICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICAgICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIHRydWUpO1xuICAgICAgICAgICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCB2aWRlbyk7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgICAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG5cbiAgICAgICAgICAgIHJlbmRlcigpO1xuICAgICAgICB9O1xuXG4gICAgfTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZW5kZXJlcjtcbi8vfSk7XG4iLCIvKipcbiAqIFRoaXMgY2xhc3MgaXMgdXNlZCB0byBkaXNwbGF5IHNob3J0LWxpdmVkIG1lc3NhZ2VzIG9uIHRoZSBzY3JlZW4sXG4gKiBBbmRyb2lkLXRvYXN0cyBzdHlsZVxuICovXG4vL2RlZmluZShbXSwgZnVuY3Rpb24oKSB7XG5cbmZ1bmN0aW9uIFRvYXN0KHRleHQpIHtcblxuICAgICAgICB2YXIgZGl2O1xuXG5cbiAgICAgICAgZnVuY3Rpb24gaGlkZSgpIHtcbiAgICAgICAgICAgIGRpdi5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gb25UcmFuc2l0aW9uRW5kKCkge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaXYpO1xuICAgICAgICB9XG5cblxuICAgICAgICB0aGlzLnNob3cgPSBmdW5jdGlvbihkdXJhdGlvbikge1xuXG4gICAgICAgICAgICBkdXJhdGlvbiA9IGR1cmF0aW9uIHx8IDE1MDA7XG5cbiAgICAgICAgICAgIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgZGl2LmlubmVySFRNTCA9ICc8c3Bhbj4nICsgdGV4dCArICc8L3NwYW4+JztcbiAgICAgICAgICAgIGRpdi5jbGFzc05hbWUgPSAndG9hc3QnO1xuXG4gICAgICAgICAgICBkaXYuYWRkRXZlbnRMaXN0ZW5lcigndHJhbnNpdGlvbmVuZCcsIG9uVHJhbnNpdGlvbkVuZCwgZmFsc2UpO1xuICAgICAgICAgICAgZGl2LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdFRyYW5zaXRpb25FbmQnLCBvblRyYW5zaXRpb25FbmQsIGZhbHNlKTtcblxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaXYpO1xuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGhpZGUsIGR1cmF0aW9uKTtcblxuICAgICAgICB9O1xuXG4gICAgfVxuXG5tb2R1bGUuZXhwb3J0cyA9IFRvYXN0O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIEEgY291cGxlIG9mIHNoaW1zIGZvciBoYXZpbmcgYSBjb21tb24gaW50ZXJmYWNlXG5cbndpbmRvdy5VUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG5cbm5hdmlnYXRvci5nZXRNZWRpYSA9ICggbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhXG4pO1xuXG5cbi8vXG5cbnZhciB2aWRlbztcbnZhciBjYW1lcmFTdHJlYW07XG52YXIgbm9HVU1TdXBwb3J0VGltZW91dDtcblxuXG4vKipcbiAqIFJlcXVlc3RzIHBlcm1pc3Npb24gZm9yIHVzaW5nIHRoZSB1c2VyJ3MgY2FtZXJhLFxuICogc3RhcnRzIHJlYWRpbmcgdmlkZW8gZnJvbSB0aGUgc2VsZWN0ZWQgY2FtZXJhLCBhbmQgY2FsbHNcbiAqIGBva0NhbGxiYWNrYCB3aGVuIHRoZSB2aWRlbyBkaW1lbnNpb25zIGFyZSBrbm93biAod2l0aCBhIGZhbGxiYWNrXG4gKiBmb3Igd2hlbiB0aGUgZGltZW5zaW9ucyBhcmUgbm90IHJlcG9ydGVkIG9uIHRpbWUpLFxuICogb3IgY2FsbHMgYGVycm9yQ2FsbGJhY2tgIGlmIHNvbWV0aGluZyBnb2VzIHdyb25nXG4gKi9cbmZ1bmN0aW9uIHN0YXJ0U3RyZWFtaW5nKGVycm9yQ2FsbGJhY2ssIG9uU3RyZWFtaW5nLCBva0NhbGxiYWNrKSB7XG5cbiAgICB2YXIgdmlkZW9FbGVtZW50O1xuICAgIHZhciBjYW1lcmFTdHJlYW07XG4gICAgdmFyIGF0dGVtcHRzID0gMDtcbiAgICB2YXIgcmVhZHlMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cbiAgICAgICAgZmluZFZpZGVvU2l6ZSgpO1xuXG4gICAgfTtcbiAgICB2YXIgZmluZFZpZGVvU2l6ZSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIGlmKHZpZGVvRWxlbWVudC52aWRlb1dpZHRoID4gMCAmJiB2aWRlb0VsZW1lbnQudmlkZW9IZWlnaHQgPiAwKSB7XG5cbiAgICAgICAgICAgIHZpZGVvRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRkYXRhJywgcmVhZHlMaXN0ZW5lcik7XG4gICAgICAgICAgICBvbkRpbWVuc2lvbnNSZWFkeSh2aWRlb0VsZW1lbnQudmlkZW9XaWR0aCwgdmlkZW9FbGVtZW50LnZpZGVvSGVpZ2h0KTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBpZihhdHRlbXB0cyA8IDEwKSB7XG5cbiAgICAgICAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZmluZFZpZGVvU2l6ZSwgMjAwKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIG9uRGltZW5zaW9uc1JlYWR5KDY0MCwgNDgwKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgIH07XG4gICAgdmFyIG9uRGltZW5zaW9uc1JlYWR5ID0gZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuICAgICAgICBva0NhbGxiYWNrKGNhbWVyYVN0cmVhbSwgdmlkZW9FbGVtZW50LCB3aWR0aCwgaGVpZ2h0KTtcbiAgICB9O1xuICAgIFxuICAgIHZpZGVvRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ZpZGVvJyk7XG4gICAgdmlkZW9FbGVtZW50LmF1dG9wbGF5ID0gdHJ1ZTtcblxuICAgIHZpZGVvRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRkYXRhJywgcmVhZHlMaXN0ZW5lcik7XG5cbiAgICBuYXZpZ2F0b3IuZ2V0TWVkaWEoeyB2aWRlbzogdHJ1ZSB9LCBmdW5jdGlvbiAoc3RyZWFtKSB7XG5cbiAgICAgICAgb25TdHJlYW1pbmcoKTtcblxuICAgICAgICBpZih2aWRlb0VsZW1lbnQubW96U3JjT2JqZWN0KSB7XG4gICAgICAgICAgICB2aWRlb0VsZW1lbnQubW96U3JjT2JqZWN0ID0gc3RyZWFtO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmlkZW9FbGVtZW50LnNyYyA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKHN0cmVhbSk7XG4gICAgICAgIH1cblxuICAgICAgICBjYW1lcmFTdHJlYW0gPSBzdHJlYW07XG4gICAgICAgIHZpZGVvRWxlbWVudC5wbGF5KCk7XG5cbiAgICB9LCBlcnJvckNhbGxiYWNrKTtcblxufVxuXG4vKipcbiAqIFRyeSB0byBpbml0aWF0ZSB2aWRlbyBzdHJlYW1pbmcsIGFuZCB0cmFuc3BhcmVudGx5IGhhbmRsZSBjYXNlc1xuICogd2hlcmUgdGhhdCBpcyBub3QgcG9zc2libGUgKGluY2x1ZGVzICdkZWNlcHRpdmUnIGJyb3dzZXJzLCBzZWUgaW5saW5lXG4gKiBjb21tZW50IGZvciBtb3JlIGluZm8pXG4gKi9cbmZ1bmN0aW9uIHN0YXJ0VmlkZW9TdHJlYW1pbmcoZXJyb3JDYWxsYmFjaywgb2tDYWxsYmFjaykge1xuICAgIFxuICAgIGlmKG5hdmlnYXRvci5nZXRNZWRpYSkge1xuXG4gICAgICAgIC8vIFNvbWUgYnJvd3NlcnMgYXBwYXJlbnRseSBoYXZlIHN1cHBvcnQgZm9yIHZpZGVvIHN0cmVhbWluZyBiZWNhdXNlIG9mIHRoZVxuICAgICAgICAvLyBwcmVzZW5jZSBvZiB0aGUgZ2V0VXNlck1lZGlhIGZ1bmN0aW9uLCBidXQgdGhlbiBkbyBub3QgYW5zd2VyIG91clxuICAgICAgICAvLyBjYWxscyBmb3Igc3RyZWFtaW5nLlxuICAgICAgICAvLyBTbyB3ZSdsbCBzZXQgdXAgdGhpcyB0aW1lb3V0IGFuZCBpZiBub3RoaW5nIGhhcHBlbnMgYWZ0ZXIgYSB3aGlsZSwgd2UnbGxcbiAgICAgICAgLy8gY29uY2x1ZGUgdGhhdCB0aGVyZSdzIG5vIGFjdHVhbCBnZXRVc2VyTWVkaWEgc3VwcG9ydC5cbiAgICAgICAgbm9HVU1TdXBwb3J0VGltZW91dCA9IHNldFRpbWVvdXQob25Ob0dVTVN1cHBvcnQsIDEwMDAwKTtcblxuICAgICAgICBzdGFydFN0cmVhbWluZyhlcnJvckNhbGxiYWNrLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBUaGUgc3RyZWFtaW5nIHN0YXJ0ZWQgc29tZWhvdywgc28gd2UgY2FuIGFzc3VtZSAvdGhlcmUgaXMvXG4gICAgICAgICAgICAgICAgLy8gZ1VNIHN1cHBvcnRcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQobm9HVU1TdXBwb3J0VGltZW91dCk7XG5cbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKHN0cmVhbSwgdmlkZW9FbGVtZW50LCB3aWR0aCwgaGVpZ2h0KSB7XG5cblxuICAgICAgICAgICAgICAgIC8vIEtlZXAgcmVmZXJlbmNlcywgZm9yIHN0b3BwaW5nIHRoZSBzdHJlYW0gbGF0ZXIgb24uXG4gICAgICAgICAgICAgICAgY2FtZXJhU3RyZWFtID0gc3RyZWFtO1xuICAgICAgICAgICAgICAgIHZpZGVvID0gdmlkZW9FbGVtZW50O1xuXG4gICAgICAgICAgICAgICAgb2tDYWxsYmFjayhzdHJlYW0sIHZpZGVvRWxlbWVudCwgd2lkdGgsIGhlaWdodCk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgb25Ob0dVTVN1cHBvcnQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk5vR1VNU3VwcG9ydCgpIHtcbiAgICAgICAgZXJyb3JDYWxsYmFjaygnTmF0aXZlIGRldmljZSBtZWRpYSBzdHJlYW1pbmcgKGdldFVzZXJNZWRpYSkgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXIuJyk7XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIHN0b3BWaWRlb1N0cmVhbWluZygpIHtcbiAgICBcbiAgICBpZihjYW1lcmFTdHJlYW0pIHtcblxuICAgICAgICBjYW1lcmFTdHJlYW0uc3RvcCgpO1xuXG4gICAgfVxuXG4gICAgaWYodmlkZW8pIHtcblxuICAgICAgICB2aWRlby5wYXVzZSgpO1xuICAgICAgICAvLyBUT0RPIGZyZWUgc3JjIHVybCBvYmplY3RcbiAgICAgICAgdmlkZW8uc3JjID0gbnVsbDtcbiAgICAgICAgdmlkZW8gPSBudWxsO1xuXG4gICAgfVxuXG59XG5cbnZhciBHdW1IZWxwZXIgPSB7XG4gICAgc3RhcnRWaWRlb1N0cmVhbWluZzogc3RhcnRWaWRlb1N0cmVhbWluZyxcbiAgICBzdG9wVmlkZW9TdHJlYW1pbmc6IHN0b3BWaWRlb1N0cmVhbWluZ1xufTtcblxuLy8gTWFrZSBpdCBjb21wYXRpYmxlIGZvciByZXF1aXJlLmpzL0FNRCBsb2FkZXIocylcbmlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIEd1bUhlbHBlcjsgfSk7XG59IGVsc2UgaWYobW9kdWxlICE9PSB1bmRlZmluZWQgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAvLyBBbmQgZm9yIG5wbS9ub2RlLmpzXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBHdW1IZWxwZXI7XG59XG5cblxuIiwiLy8gQSBsaWJyYXJ5L3V0aWxpdHkgZm9yIGdlbmVyYXRpbmcgR0lGIGZpbGVzXG4vLyBVc2VzIERlYW4gTWNOYW1lZSdzIG9tZ2dpZiBsaWJyYXJ5XG4vLyBhbmQgQW50aG9ueSBEZWtrZXIncyBOZXVRdWFudCBxdWFudGl6ZXIgKEpTIDAuMyB2ZXJzaW9uIHdpdGggbWFueSBmaXhlcylcbi8vXG4vLyBAYXV0aG9yIHNvbGUgLyBodHRwOi8vc29sZWRhZHBlbmFkZXMuY29tXG5mdW5jdGlvbiBBbmltYXRlZF9HSUYob3B0aW9ucykge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHdpZHRoID0gMTYwLCBoZWlnaHQgPSAxMjAsIGNhbnZhcyA9IG51bGwsIGN0eCA9IG51bGwsIHJlcGVhdCA9IDAsIGRlbGF5ID0gMjUwO1xuICAgIHZhciBmcmFtZXMgPSBbXTtcbiAgICB2YXIgbnVtUmVuZGVyZWRGcmFtZXMgPSAwO1xuICAgIHZhciBvblJlbmRlckNvbXBsZXRlQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHt9O1xuICAgIHZhciBvblJlbmRlclByb2dyZXNzQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHt9O1xuICAgIHZhciB3b3JrZXJzID0gW10sIGF2YWlsYWJsZVdvcmtlcnMgPSBbXSwgbnVtV29ya2Vycywgd29ya2VyUGF0aDtcbiAgICB2YXIgZ2VuZXJhdGluZ0dJRiA9IGZhbHNlO1xuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgbnVtV29ya2VycyA9IG9wdGlvbnMubnVtV29ya2VycyB8fCAyO1xuICAgIHdvcmtlclBhdGggPSBvcHRpb25zLndvcmtlclBhdGggfHwgJ3NyYy9xdWFudGl6ZXIuanMnOyAvLyBYWFggaGFyZGNvZGVkIHBhdGhcblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBudW1Xb3JrZXJzOyBpKyspIHtcbiAgICAgICAgdmFyIHcgPSBuZXcgV29ya2VyKHdvcmtlclBhdGgpO1xuICAgICAgICB3b3JrZXJzLnB1c2godyk7XG4gICAgICAgIGF2YWlsYWJsZVdvcmtlcnMucHVzaCh3KTtcbiAgICB9XG5cbiAgICAvLyAtLS1cblxuXG4gICAgLy8gUmV0dXJuIGEgd29ya2VyIGZvciBwcm9jZXNzaW5nIGEgZnJhbWVcbiAgICBmdW5jdGlvbiBnZXRXb3JrZXIoKSB7XG4gICAgICAgIGlmKGF2YWlsYWJsZVdvcmtlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyAoJ05vIHdvcmtlcnMgbGVmdCEnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhdmFpbGFibGVXb3JrZXJzLnBvcCgpO1xuICAgIH1cblxuXG4gICAgLy8gUmVzdG9yZSBhIHdvcmtlciB0byB0aGUgcG9vbFxuICAgIGZ1bmN0aW9uIGZyZWVXb3JrZXIod29ya2VyKSB7XG5cbiAgICAgICAgYXZhaWxhYmxlV29ya2Vycy5wdXNoKHdvcmtlcik7XG5cbiAgICB9XG5cblxuICAgIC8vIEZhc3Rlci9jbG9zdXJpemVkIGJ1ZmZlclRvU3RyaW5nIGZ1bmN0aW9uXG4gICAgLy8gKGNhY2hpbmcgdGhlIFN0cmluZy5mcm9tQ2hhckNvZGUgdmFsdWVzKVxuICAgIHZhciBidWZmZXJUb1N0cmluZyA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGJ5dGVNYXAgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gICAgICAgICAgICBieXRlTWFwW2ldID0gU3RyaW5nLmZyb21DaGFyQ29kZShpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAoZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgICAgICAgICB2YXIgbnVtYmVyVmFsdWVzID0gYnVmZmVyLmxlbmd0aDtcbiAgICAgICAgICAgIHZhciBzdHIgPSAnJztcblxuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IG51bWJlclZhbHVlczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgc3RyICs9IGJ5dGVNYXBbIGJ1ZmZlcltpXSBdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICB9KTtcbiAgICB9KSgpO1xuXG5cbiAgICBmdW5jdGlvbiBzdGFydFJlbmRlcmluZyhjb21wbGV0ZUNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBudW1GcmFtZXMgPSBmcmFtZXMubGVuZ3RoO1xuXG4gICAgICAgIG9uUmVuZGVyQ29tcGxldGVDYWxsYmFjayA9IGNvbXBsZXRlQ2FsbGJhY2s7XG5cbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IG51bVdvcmtlcnMgJiYgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcHJvY2Vzc0ZyYW1lKGkpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzRnJhbWUocG9zaXRpb24pIHtcblxuICAgICAgICB2YXIgZnJhbWU7XG4gICAgICAgIHZhciB3b3JrZXI7XG5cbiAgICAgICAgZnJhbWUgPSBmcmFtZXNbcG9zaXRpb25dO1xuXG4gICAgICAgIGlmKGZyYW1lLmJlaW5nUHJvY2Vzc2VkIHx8IGZyYW1lLmRvbmUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZyYW1lIGFscmVhZHkgYmVpbmcgcHJvY2Vzc2VkIG9yIGRvbmUhJywgZnJhbWUucG9zaXRpb24pO1xuICAgICAgICAgICAgb25GcmFtZUZpbmlzaGVkKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmcmFtZS5iZWluZ1Byb2Nlc3NlZCA9IHRydWU7XG5cbiAgICAgICAgd29ya2VyID0gZ2V0V29ya2VyKCk7XG5cbiAgICAgICAgd29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2KSB7XG5cbiAgICAgICAgICAgIHZhciBkYXRhID0gZXYuZGF0YTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9yaWdpbmFsIGRhdGEsIGFuZCBmcmVlIG1lbW9yeVxuICAgICAgICAgICAgZGVsZXRlKGZyYW1lLmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBUT0RPIGdycnIuLi4gSEFDSyBmb3Igb2JqZWN0IC0+IEFycmF5XG4gICAgICAgICAgICBmcmFtZS5waXhlbHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkYXRhLnBpeGVscyk7XG4gICAgICAgICAgICBmcmFtZS5wYWxldHRlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YS5wYWxldHRlKTtcbiAgICAgICAgICAgIGZyYW1lLmRvbmUgPSB0cnVlO1xuICAgICAgICAgICAgZnJhbWUuYmVpbmdQcm9jZXNzZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgZnJlZVdvcmtlcih3b3JrZXIpO1xuXG4gICAgICAgICAgICBvbkZyYW1lRmluaXNoZWQoKTtcblxuICAgICAgICB9O1xuXG4gICAgICAgIFxuICAgICAgICAvLyBUT0RPIG1heWJlIGxvb2sgaW50byB0cmFuc2ZlciBvYmplY3RzXG4gICAgICAgIC8vIGZvciBmdXJ0aGVyIGVmZmljaWVuY3lcbiAgICAgICAgdmFyIGZyYW1lRGF0YSA9IGZyYW1lLmRhdGE7XG4gICAgICAgIC8vd29ya2VyLnBvc3RNZXNzYWdlKGZyYW1lRGF0YSwgW2ZyYW1lRGF0YV0pO1xuICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UoZnJhbWVEYXRhKTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIHByb2Nlc3NOZXh0RnJhbWUoKSB7XG5cbiAgICAgICAgdmFyIHBvc2l0aW9uID0gLTE7XG5cbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGZyYW1lID0gZnJhbWVzW2ldO1xuICAgICAgICAgICAgaWYoIWZyYW1lLmRvbmUgJiYgIWZyYW1lLmJlaW5nUHJvY2Vzc2VkKSB7XG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZihwb3NpdGlvbiA+PSAwKSB7XG4gICAgICAgICAgICBwcm9jZXNzRnJhbWUocG9zaXRpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBvbkZyYW1lRmluaXNoZWQoKSB7IC8vIH5+fiB0YXNrRmluaXNoZWRcblxuICAgICAgICAvLyBUaGUgR0lGIGlzIG5vdCB3cml0dGVuIHVudGlsIHdlJ3JlIGRvbmUgd2l0aCBhbGwgdGhlIGZyYW1lc1xuICAgICAgICAvLyBiZWNhdXNlIHRoZXkgbWlnaHQgbm90IGJlIHByb2Nlc3NlZCBpbiB0aGUgc2FtZSBvcmRlclxuICAgICAgICB2YXIgYWxsRG9uZSA9IGZyYW1lcy5ldmVyeShmdW5jdGlvbihmcmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuICFmcmFtZS5iZWluZ1Byb2Nlc3NlZCAmJiBmcmFtZS5kb25lO1xuICAgICAgICB9KTtcblxuICAgICAgICBudW1SZW5kZXJlZEZyYW1lcysrO1xuICAgICAgICBvblJlbmRlclByb2dyZXNzQ2FsbGJhY2sobnVtUmVuZGVyZWRGcmFtZXMgKiAwLjc1IC8gZnJhbWVzLmxlbmd0aCk7XG5cbiAgICAgICAgaWYoYWxsRG9uZSkge1xuICAgICAgICAgICAgaWYoIWdlbmVyYXRpbmdHSUYpIHtcbiAgICAgICAgICAgICAgICBnZW5lcmF0ZUdJRihmcmFtZXMsIG9uUmVuZGVyQ29tcGxldGVDYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KHByb2Nlc3NOZXh0RnJhbWUsIDEpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgIH1cblxuXG4gICAgLy8gVGFrZXMgdGhlIGFscmVhZHkgcHJvY2Vzc2VkIGRhdGEgaW4gZnJhbWVzIGFuZCBmZWVkcyBpdCB0byBhIG5ld1xuICAgIC8vIEdpZldyaXRlciBpbnN0YW5jZSBpbiBvcmRlciB0byBnZXQgdGhlIGJpbmFyeSBHSUYgZmlsZVxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlR0lGKGZyYW1lcywgY2FsbGJhY2spIHtcblxuICAgICAgICAvLyBUT0RPOiBXZWlyZDogdXNpbmcgYSBzaW1wbGUgSlMgYXJyYXkgaW5zdGVhZCBvZiBhIHR5cGVkIGFycmF5LFxuICAgICAgICAvLyB0aGUgZmlsZXMgYXJlIFdBWSBzbWFsbGVyIG9fby4gUGF0Y2hlcy9leHBsYW5hdGlvbnMgd2VsY29tZSFcbiAgICAgICAgdmFyIGJ1ZmZlciA9IFtdOyAvLyBuZXcgVWludDhBcnJheSh3aWR0aCAqIGhlaWdodCAqIGZyYW1lcy5sZW5ndGggKiA1KTtcbiAgICAgICAgdmFyIGdpZldyaXRlciA9IG5ldyBHaWZXcml0ZXIoYnVmZmVyLCB3aWR0aCwgaGVpZ2h0LCB7IGxvb3A6IHJlcGVhdCB9KTtcblxuICAgICAgICBnZW5lcmF0aW5nR0lGID0gdHJ1ZTtcblxuICAgICAgICBmcmFtZXMuZm9yRWFjaChmdW5jdGlvbihmcmFtZSkge1xuICAgICAgICAgICAgb25SZW5kZXJQcm9ncmVzc0NhbGxiYWNrKDAuNzUgKyAwLjI1ICogZnJhbWUucG9zaXRpb24gKiAxLjAgLyBmcmFtZXMubGVuZ3RoKTtcbiAgICAgICAgICAgIGdpZldyaXRlci5hZGRGcmFtZSgwLCAwLCB3aWR0aCwgaGVpZ2h0LCBmcmFtZS5waXhlbHMsIHtcbiAgICAgICAgICAgICAgICBwYWxldHRlOiBmcmFtZS5wYWxldHRlLCBcbiAgICAgICAgICAgICAgICBkZWxheTogZGVsYXkgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZ2lmV3JpdGVyLmVuZCgpO1xuICAgICAgICBvblJlbmRlclByb2dyZXNzQ2FsbGJhY2soMS4wKTtcbiAgICAgICAgXG4gICAgICAgIGZyYW1lcyA9IFtdO1xuICAgICAgICBnZW5lcmF0aW5nR0lGID0gZmFsc2U7XG5cbiAgICAgICAgY2FsbGJhY2soYnVmZmVyKTtcblxuICAgIH1cblxuXG4gICAgLy8gLS0tXG5cblxuICAgIHRoaXMuc2V0U2l6ZSA9IGZ1bmN0aW9uKHcsIGgpIHtcbiAgICAgICAgd2lkdGggPSB3O1xuICAgICAgICBoZWlnaHQgPSBoO1xuICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgY2FudmFzLndpZHRoID0gdztcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGg7XG4gICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIH07XG5cblxuICAgIC8vIEludGVybmFsbHksIEdJRiB1c2VzIHRlbnRocyBvZiBzZWNvbmRzIHRvIHN0b3JlIHRoZSBkZWxheVxuICAgIHRoaXMuc2V0RGVsYXkgPSBmdW5jdGlvbihzZWNvbmRzKSB7XG5cbiAgICAgICAgZGVsYXkgPSBzZWNvbmRzICogMC4xO1xuXG4gICAgfTtcblxuXG4gICAgLy8gRnJvbSBHSUY6IDAgPSBsb29wIGZvcmV2ZXIsIG51bGwgPSBub3QgbG9vcGluZywgbiA+IDAgPSBsb29wIG4gdGltZXMgYW5kIHN0b3BcbiAgICB0aGlzLnNldFJlcGVhdCA9IGZ1bmN0aW9uKHIpIHtcblxuICAgICAgICByZXBlYXQgPSByO1xuXG4gICAgfTtcblxuXG4gICAgdGhpcy5hZGRGcmFtZSA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblxuICAgICAgICBpZihjdHggPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0U2l6ZSh3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoZWxlbWVudCwgMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIHZhciBkYXRhID0gY3R4LmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuYWRkRnJhbWVJbWFnZURhdGEoZGF0YS5kYXRhKTtcbiAgICB9O1xuXG5cbiAgICB0aGlzLmFkZEZyYW1lSW1hZ2VEYXRhID0gZnVuY3Rpb24oaW1hZ2VEYXRhKSB7XG5cbiAgICAgICAgdmFyIGRhdGFMZW5ndGggPSBpbWFnZURhdGEubGVuZ3RoLFxuICAgICAgICAgICAgaW1hZ2VEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShpbWFnZURhdGEpO1xuXG4gICAgICAgIGZyYW1lcy5wdXNoKHsgZGF0YTogaW1hZ2VEYXRhQXJyYXksIGRvbmU6IGZhbHNlLCBiZWluZ1Byb2Nlc3NlZDogZmFsc2UsIHBvc2l0aW9uOiBmcmFtZXMubGVuZ3RoIH0pO1xuICAgIH07XG5cblxuICAgIHRoaXMub25SZW5kZXJQcm9ncmVzcyA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cbiAgICAgICAgb25SZW5kZXJQcm9ncmVzc0NhbGxiYWNrID0gY2FsbGJhY2s7XG5cbiAgICB9O1xuXG5cbiAgICB0aGlzLmlzUmVuZGVyaW5nID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgcmV0dXJuIGdlbmVyYXRpbmdHSUY7XG5cbiAgICB9O1xuXG5cbiAgICB0aGlzLmdldEJhc2U2NEdJRiA9IGZ1bmN0aW9uKGNvbXBsZXRlQ2FsbGJhY2spIHtcblxuICAgICAgICB2YXIgb25SZW5kZXJDb21wbGV0ZSA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgICAgICAgICAgdmFyIHN0ciA9IGJ1ZmZlclRvU3RyaW5nKGJ1ZmZlcik7XG4gICAgICAgICAgICB2YXIgZ2lmID0gJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCwnICsgYnRvYShzdHIpO1xuICAgICAgICAgICAgY29tcGxldGVDYWxsYmFjayhnaWYpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHN0YXJ0UmVuZGVyaW5nKG9uUmVuZGVyQ29tcGxldGUpO1xuXG4gICAgfTtcblxufVxuXG4vKmlmKGRlZmluZSkge1xuICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBBbmltYXRlZF9HSUY7XG4gICAgfSk7XG59Ki9cblxubW9kdWxlLmV4cG9ydHMgPSBBbmltYXRlZF9HSUY7XG4iLCIvKiEgSGFtbWVyLkpTIC0gdjEuMC42ZGV2IC0gMjAxMy0wNC0xMFxuICogaHR0cDovL2VpZ2h0bWVkaWEuZ2l0aHViLmNvbS9oYW1tZXIuanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgSm9yaWsgVGFuZ2VsZGVyIDxqLnRhbmdlbGRlckBnbWFpbC5jb20+O1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlICovXG5cbihmdW5jdGlvbih3aW5kb3csIHVuZGVmaW5lZCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBIYW1tZXJcbiAqIHVzZSB0aGlzIHRvIGNyZWF0ZSBpbnN0YW5jZXNcbiAqIEBwYXJhbSAgIHtIVE1MRWxlbWVudH0gICBlbGVtZW50XG4gKiBAcGFyYW0gICB7T2JqZWN0fSAgICAgICAgb3B0aW9uc1xuICogQHJldHVybnMge0hhbW1lci5JbnN0YW5jZX1cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgSGFtbWVyID0gZnVuY3Rpb24oZWxlbWVudCwgb3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgSGFtbWVyLkluc3RhbmNlKGVsZW1lbnQsIG9wdGlvbnMgfHwge30pO1xufTtcblxuLy8gZGVmYXVsdCBzZXR0aW5nc1xuSGFtbWVyLmRlZmF1bHRzID0ge1xuICAgIC8vIGFkZCBzdHlsZXMgYW5kIGF0dHJpYnV0ZXMgdG8gdGhlIGVsZW1lbnQgdG8gcHJldmVudCB0aGUgYnJvd3NlciBmcm9tIGRvaW5nXG4gICAgLy8gaXRzIG5hdGl2ZSBiZWhhdmlvci4gdGhpcyBkb2VzbnQgcHJldmVudCB0aGUgc2Nyb2xsaW5nLCBidXQgY2FuY2Vsc1xuICAgIC8vIHRoZSBjb250ZXh0bWVudSwgdGFwIGhpZ2hsaWdodGluZyBldGNcbiAgICAvLyBzZXQgdG8gZmFsc2UgdG8gZGlzYWJsZSB0aGlzXG4gICAgc3RvcF9icm93c2VyX2JlaGF2aW9yOiB7XG5cdFx0Ly8gdGhpcyBhbHNvIHRyaWdnZXJzIG9uc2VsZWN0c3RhcnQ9ZmFsc2UgZm9yIElFXG4gICAgICAgIHVzZXJTZWxlY3Q6ICdub25lJyxcblx0XHQvLyB0aGlzIG1ha2VzIHRoZSBlbGVtZW50IGJsb2NraW5nIGluIElFMTAgPiwgeW91IGNvdWxkIGV4cGVyaW1lbnQgd2l0aCB0aGUgdmFsdWVcblx0XHQvLyBzZWUgZm9yIG1vcmUgb3B0aW9ucyB0aGlzIGlzc3VlOyBodHRwczovL2dpdGh1Yi5jb20vRWlnaHRNZWRpYS9oYW1tZXIuanMvaXNzdWVzLzI0MVxuICAgICAgICB0b3VjaEFjdGlvbjogJ25vbmUnLFxuXHRcdHRvdWNoQ2FsbG91dDogJ25vbmUnLFxuICAgICAgICBjb250ZW50Wm9vbWluZzogJ25vbmUnLFxuICAgICAgICB1c2VyRHJhZzogJ25vbmUnLFxuICAgICAgICB0YXBIaWdobGlnaHRDb2xvcjogJ3JnYmEoMCwwLDAsMCknXG4gICAgfVxuXG4gICAgLy8gbW9yZSBzZXR0aW5ncyBhcmUgZGVmaW5lZCBwZXIgZ2VzdHVyZSBhdCBnZXN0dXJlcy5qc1xufTtcblxuLy8gZGV0ZWN0IHRvdWNoZXZlbnRzXG5IYW1tZXIuSEFTX1BPSU5URVJFVkVOVFMgPSBuYXZpZ2F0b3IucG9pbnRlckVuYWJsZWQgfHwgbmF2aWdhdG9yLm1zUG9pbnRlckVuYWJsZWQ7XG5IYW1tZXIuSEFTX1RPVUNIRVZFTlRTID0gKCdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdyk7XG5cbi8vIGRvbnQgdXNlIG1vdXNlZXZlbnRzIG9uIG1vYmlsZSBkZXZpY2VzXG5IYW1tZXIuTU9CSUxFX1JFR0VYID0gL21vYmlsZXx0YWJsZXR8aXAoYWR8aG9uZXxvZCl8YW5kcm9pZC9pO1xuSGFtbWVyLk5PX01PVVNFRVZFTlRTID0gSGFtbWVyLkhBU19UT1VDSEVWRU5UUyAmJiBuYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKEhhbW1lci5NT0JJTEVfUkVHRVgpO1xuXG4vLyBldmVudHR5cGVzIHBlciB0b3VjaGV2ZW50IChzdGFydCwgbW92ZSwgZW5kKVxuLy8gYXJlIGZpbGxlZCBieSBIYW1tZXIuZXZlbnQuZGV0ZXJtaW5lRXZlbnRUeXBlcyBvbiBzZXR1cFxuSGFtbWVyLkVWRU5UX1RZUEVTID0ge307XG5cbi8vIGRpcmVjdGlvbiBkZWZpbmVzXG5IYW1tZXIuRElSRUNUSU9OX0RPV04gPSAnZG93bic7XG5IYW1tZXIuRElSRUNUSU9OX0xFRlQgPSAnbGVmdCc7XG5IYW1tZXIuRElSRUNUSU9OX1VQID0gJ3VwJztcbkhhbW1lci5ESVJFQ1RJT05fUklHSFQgPSAncmlnaHQnO1xuXG4vLyBwb2ludGVyIHR5cGVcbkhhbW1lci5QT0lOVEVSX01PVVNFID0gJ21vdXNlJztcbkhhbW1lci5QT0lOVEVSX1RPVUNIID0gJ3RvdWNoJztcbkhhbW1lci5QT0lOVEVSX1BFTiA9ICdwZW4nO1xuXG4vLyB0b3VjaCBldmVudCBkZWZpbmVzXG5IYW1tZXIuRVZFTlRfU1RBUlQgPSAnc3RhcnQnO1xuSGFtbWVyLkVWRU5UX01PVkUgPSAnbW92ZSc7XG5IYW1tZXIuRVZFTlRfRU5EID0gJ2VuZCc7XG5cbi8vIGhhbW1lciBkb2N1bWVudCB3aGVyZSB0aGUgYmFzZSBldmVudHMgYXJlIGFkZGVkIGF0XG5IYW1tZXIuRE9DVU1FTlQgPSBkb2N1bWVudDtcblxuLy8gcGx1Z2lucyBuYW1lc3BhY2VcbkhhbW1lci5wbHVnaW5zID0ge307XG5cbi8vIGlmIHRoZSB3aW5kb3cgZXZlbnRzIGFyZSBzZXQuLi5cbkhhbW1lci5SRUFEWSA9IGZhbHNlO1xuXG4vKipcbiAqIHNldHVwIGV2ZW50cyB0byBkZXRlY3QgZ2VzdHVyZXMgb24gdGhlIGRvY3VtZW50XG4gKi9cbmZ1bmN0aW9uIHNldHVwKCkge1xuICAgIGlmKEhhbW1lci5SRUFEWSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gZmluZCB3aGF0IGV2ZW50dHlwZXMgd2UgYWRkIGxpc3RlbmVycyB0b1xuICAgIEhhbW1lci5ldmVudC5kZXRlcm1pbmVFdmVudFR5cGVzKCk7XG5cbiAgICAvLyBSZWdpc3RlciBhbGwgZ2VzdHVyZXMgaW5zaWRlIEhhbW1lci5nZXN0dXJlc1xuICAgIGZvcih2YXIgbmFtZSBpbiBIYW1tZXIuZ2VzdHVyZXMpIHtcbiAgICAgICAgaWYoSGFtbWVyLmdlc3R1cmVzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICBIYW1tZXIuZGV0ZWN0aW9uLnJlZ2lzdGVyKEhhbW1lci5nZXN0dXJlc1tuYW1lXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgdG91Y2ggZXZlbnRzIG9uIHRoZSBkb2N1bWVudFxuICAgIEhhbW1lci5ldmVudC5vblRvdWNoKEhhbW1lci5ET0NVTUVOVCwgSGFtbWVyLkVWRU5UX01PVkUsIEhhbW1lci5kZXRlY3Rpb24uZGV0ZWN0KTtcbiAgICBIYW1tZXIuZXZlbnQub25Ub3VjaChIYW1tZXIuRE9DVU1FTlQsIEhhbW1lci5FVkVOVF9FTkQsIEhhbW1lci5kZXRlY3Rpb24uZGV0ZWN0KTtcblxuICAgIC8vIEhhbW1lciBpcyByZWFkeS4uLiFcbiAgICBIYW1tZXIuUkVBRFkgPSB0cnVlO1xufVxuXG4vKipcbiAqIGNyZWF0ZSBuZXcgaGFtbWVyIGluc3RhbmNlXG4gKiBhbGwgbWV0aG9kcyBzaG91bGQgcmV0dXJuIHRoZSBpbnN0YW5jZSBpdHNlbGYsIHNvIGl0IGlzIGNoYWluYWJsZS5cbiAqIEBwYXJhbSAgIHtIVE1MRWxlbWVudH0gICAgICAgZWxlbWVudFxuICogQHBhcmFtICAge09iamVjdH0gICAgICAgICAgICBbb3B0aW9ucz17fV1cbiAqIEByZXR1cm5zIHtIYW1tZXIuSW5zdGFuY2V9XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuSGFtbWVyLkluc3RhbmNlID0gZnVuY3Rpb24oZWxlbWVudCwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIHNldHVwIEhhbW1lckpTIHdpbmRvdyBldmVudHMgYW5kIHJlZ2lzdGVyIGFsbCBnZXN0dXJlc1xuICAgIC8vIHRoaXMgYWxzbyBzZXRzIHVwIHRoZSBkZWZhdWx0IG9wdGlvbnNcbiAgICBzZXR1cCgpO1xuXG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcblxuICAgIC8vIHN0YXJ0L3N0b3AgZGV0ZWN0aW9uIG9wdGlvblxuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICAvLyBtZXJnZSBvcHRpb25zXG4gICAgdGhpcy5vcHRpb25zID0gSGFtbWVyLnV0aWxzLmV4dGVuZChcbiAgICAgICAgSGFtbWVyLnV0aWxzLmV4dGVuZCh7fSwgSGFtbWVyLmRlZmF1bHRzKSxcbiAgICAgICAgb3B0aW9ucyB8fCB7fSk7XG5cbiAgICAvLyBhZGQgc29tZSBjc3MgdG8gdGhlIGVsZW1lbnQgdG8gcHJldmVudCB0aGUgYnJvd3NlciBmcm9tIGRvaW5nIGl0cyBuYXRpdmUgYmVoYXZvaXJcbiAgICBpZih0aGlzLm9wdGlvbnMuc3RvcF9icm93c2VyX2JlaGF2aW9yKSB7XG4gICAgICAgIEhhbW1lci51dGlscy5zdG9wRGVmYXVsdEJyb3dzZXJCZWhhdmlvcih0aGlzLmVsZW1lbnQsIHRoaXMub3B0aW9ucy5zdG9wX2Jyb3dzZXJfYmVoYXZpb3IpO1xuICAgIH1cblxuICAgIC8vIHN0YXJ0IGRldGVjdGlvbiBvbiB0b3VjaHN0YXJ0XG4gICAgSGFtbWVyLmV2ZW50Lm9uVG91Y2goZWxlbWVudCwgSGFtbWVyLkVWRU5UX1NUQVJULCBmdW5jdGlvbihldikge1xuICAgICAgICBpZihzZWxmLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIEhhbW1lci5kZXRlY3Rpb24uc3RhcnREZXRlY3Qoc2VsZiwgZXYpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyByZXR1cm4gaW5zdGFuY2VcbiAgICByZXR1cm4gdGhpcztcbn07XG5cblxuSGFtbWVyLkluc3RhbmNlLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBiaW5kIGV2ZW50cyB0byB0aGUgaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0gICB7U3RyaW5nfSAgICAgIGdlc3R1cmVcbiAgICAgKiBAcGFyYW0gICB7RnVuY3Rpb259ICAgIGhhbmRsZXJcbiAgICAgKiBAcmV0dXJucyB7SGFtbWVyLkluc3RhbmNlfVxuICAgICAqL1xuICAgIG9uOiBmdW5jdGlvbiBvbkV2ZW50KGdlc3R1cmUsIGhhbmRsZXIpe1xuICAgICAgICB2YXIgZ2VzdHVyZXMgPSBnZXN0dXJlLnNwbGl0KCcgJyk7XG4gICAgICAgIGZvcih2YXIgdD0wOyB0PGdlc3R1cmVzLmxlbmd0aDsgdCsrKSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihnZXN0dXJlc1t0XSwgaGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIHVuYmluZCBldmVudHMgdG8gdGhlIGluc3RhbmNlXG4gICAgICogQHBhcmFtICAge1N0cmluZ30gICAgICBnZXN0dXJlXG4gICAgICogQHBhcmFtICAge0Z1bmN0aW9ufSAgICBoYW5kbGVyXG4gICAgICogQHJldHVybnMge0hhbW1lci5JbnN0YW5jZX1cbiAgICAgKi9cbiAgICBvZmY6IGZ1bmN0aW9uIG9mZkV2ZW50KGdlc3R1cmUsIGhhbmRsZXIpe1xuICAgICAgICB2YXIgZ2VzdHVyZXMgPSBnZXN0dXJlLnNwbGl0KCcgJyk7XG4gICAgICAgIGZvcih2YXIgdD0wOyB0PGdlc3R1cmVzLmxlbmd0aDsgdCsrKSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihnZXN0dXJlc1t0XSwgaGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIHRyaWdnZXIgZ2VzdHVyZSBldmVudFxuICAgICAqIEBwYXJhbSAgIHtTdHJpbmd9ICAgICAgZ2VzdHVyZVxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9ICAgICAgZXZlbnREYXRhXG4gICAgICogQHJldHVybnMge0hhbW1lci5JbnN0YW5jZX1cbiAgICAgKi9cbiAgICB0cmlnZ2VyOiBmdW5jdGlvbiB0cmlnZ2VyRXZlbnQoZ2VzdHVyZSwgZXZlbnREYXRhKXtcbiAgICAgICAgLy8gY3JlYXRlIERPTSBldmVudFxuICAgICAgICB2YXIgZXZlbnQgPSBIYW1tZXIuRE9DVU1FTlQuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XG5cdFx0ZXZlbnQuaW5pdEV2ZW50KGdlc3R1cmUsIHRydWUsIHRydWUpO1xuXHRcdGV2ZW50Lmdlc3R1cmUgPSBldmVudERhdGE7XG5cbiAgICAgICAgLy8gdHJpZ2dlciBvbiB0aGUgdGFyZ2V0IGlmIGl0IGlzIGluIHRoZSBpbnN0YW5jZSBlbGVtZW50LFxuICAgICAgICAvLyB0aGlzIGlzIGZvciBldmVudCBkZWxlZ2F0aW9uIHRyaWNrc1xuICAgICAgICB2YXIgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICAgICAgaWYoSGFtbWVyLnV0aWxzLmhhc1BhcmVudChldmVudERhdGEudGFyZ2V0LCBlbGVtZW50KSkge1xuICAgICAgICAgICAgZWxlbWVudCA9IGV2ZW50RGF0YS50YXJnZXQ7XG4gICAgICAgIH1cblxuICAgICAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBlbmFibGUgb2YgZGlzYWJsZSBoYW1tZXIuanMgZGV0ZWN0aW9uXG4gICAgICogQHBhcmFtICAge0Jvb2xlYW59ICAgc3RhdGVcbiAgICAgKiBAcmV0dXJucyB7SGFtbWVyLkluc3RhbmNlfVxuICAgICAqL1xuICAgIGVuYWJsZTogZnVuY3Rpb24gZW5hYmxlKHN0YXRlKSB7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IHN0YXRlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG4vKipcbiAqIHRoaXMgaG9sZHMgdGhlIGxhc3QgbW92ZSBldmVudCxcbiAqIHVzZWQgdG8gZml4IGVtcHR5IHRvdWNoZW5kIGlzc3VlXG4gKiBzZWUgdGhlIG9uVG91Y2ggZXZlbnQgZm9yIGFuIGV4cGxhbmF0aW9uXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgbGFzdF9tb3ZlX2V2ZW50ID0gbnVsbDtcblxuXG4vKipcbiAqIHdoZW4gdGhlIG1vdXNlIGlzIGhvbGQgZG93biwgdGhpcyBpcyB0cnVlXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xudmFyIGVuYWJsZV9kZXRlY3QgPSBmYWxzZTtcblxuXG4vKipcbiAqIHdoZW4gdG91Y2ggZXZlbnRzIGhhdmUgYmVlbiBmaXJlZCwgdGhpcyBpcyB0cnVlXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xudmFyIHRvdWNoX3RyaWdnZXJlZCA9IGZhbHNlO1xuXG5cbkhhbW1lci5ldmVudCA9IHtcbiAgICAvKipcbiAgICAgKiBzaW1wbGUgYWRkRXZlbnRMaXN0ZW5lclxuICAgICAqIEBwYXJhbSAgIHtIVE1MRWxlbWVudH0gICBlbGVtZW50XG4gICAgICogQHBhcmFtICAge1N0cmluZ30gICAgICAgIHR5cGVcbiAgICAgKiBAcGFyYW0gICB7RnVuY3Rpb259ICAgICAgaGFuZGxlclxuICAgICAqL1xuICAgIGJpbmREb206IGZ1bmN0aW9uKGVsZW1lbnQsIHR5cGUsIGhhbmRsZXIpIHtcbiAgICAgICAgdmFyIHR5cGVzID0gdHlwZS5zcGxpdCgnICcpO1xuICAgICAgICBmb3IodmFyIHQ9MDsgdDx0eXBlcy5sZW5ndGg7IHQrKykge1xuICAgICAgICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKHR5cGVzW3RdLCBoYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiB0b3VjaCBldmVudHMgd2l0aCBtb3VzZSBmYWxsYmFja1xuICAgICAqIEBwYXJhbSAgIHtIVE1MRWxlbWVudH0gICBlbGVtZW50XG4gICAgICogQHBhcmFtICAge1N0cmluZ30gICAgICAgIGV2ZW50VHlwZSAgICAgICAgbGlrZSBIYW1tZXIuRVZFTlRfTU9WRVxuICAgICAqIEBwYXJhbSAgIHtGdW5jdGlvbn0gICAgICBoYW5kbGVyXG4gICAgICovXG4gICAgb25Ub3VjaDogZnVuY3Rpb24gb25Ub3VjaChlbGVtZW50LCBldmVudFR5cGUsIGhhbmRsZXIpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5iaW5kRG9tKGVsZW1lbnQsIEhhbW1lci5FVkVOVF9UWVBFU1tldmVudFR5cGVdLCBmdW5jdGlvbiBiaW5kRG9tT25Ub3VjaChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZUV2ZW50VHlwZSA9IGV2LnR5cGUudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICAgICAgLy8gb25tb3VzZXVwLCBidXQgd2hlbiB0b3VjaGVuZCBoYXMgYmVlbiBmaXJlZCB3ZSBkbyBub3RoaW5nLlxuICAgICAgICAgICAgLy8gdGhpcyBpcyBmb3IgdG91Y2hkZXZpY2VzIHdoaWNoIGFsc28gZmlyZSBhIG1vdXNldXAgb24gdG91Y2hlbmRcbiAgICAgICAgICAgIGlmKHNvdXJjZUV2ZW50VHlwZS5tYXRjaCgvbW91c2UvKSAmJiB0b3VjaF90cmlnZ2VyZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG1vdXNlYnV0dG9uIG11c3QgYmUgZG93biBvciBhIHRvdWNoIGV2ZW50XG4gICAgICAgICAgICBlbHNlIGlmKCBzb3VyY2VFdmVudFR5cGUubWF0Y2goL3RvdWNoLykgfHwgICAvLyB0b3VjaCBldmVudHMgYXJlIGFsd2F5cyBvbiBzY3JlZW5cbiAgICAgICAgICAgICAgICBzb3VyY2VFdmVudFR5cGUubWF0Y2goL3BvaW50ZXJkb3duLykgfHwgLy8gcG9pbnRlcmV2ZW50cyB0b3VjaFxuICAgICAgICAgICAgICAgIChzb3VyY2VFdmVudFR5cGUubWF0Y2goL21vdXNlLykgJiYgZXYud2hpY2ggPT09IDEpICAgLy8gbW91c2UgaXMgcHJlc3NlZFxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICBlbmFibGVfZGV0ZWN0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbW91c2UgaXNuJ3QgcHJlc3NlZFxuICAgICAgICAgICAgZWxzZSBpZihzb3VyY2VFdmVudFR5cGUubWF0Y2goL21vdXNlLykgJiYgZXYud2hpY2ggIT09IDEpIHtcbiAgICAgICAgICAgICAgICBlbmFibGVfZGV0ZWN0ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgLy8gd2UgYXJlIGluIGEgdG91Y2ggZXZlbnQsIHNldCB0aGUgdG91Y2ggdHJpZ2dlcmVkIGJvb2wgdG8gdHJ1ZSxcbiAgICAgICAgICAgIC8vIHRoaXMgZm9yIHRoZSBjb25mbGljdHMgdGhhdCBtYXkgb2NjdXIgb24gaW9zIGFuZCBhbmRyb2lkXG4gICAgICAgICAgICBpZihzb3VyY2VFdmVudFR5cGUubWF0Y2goL3RvdWNofHBvaW50ZXIvKSkge1xuICAgICAgICAgICAgICAgIHRvdWNoX3RyaWdnZXJlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvdW50IHRoZSB0b3RhbCB0b3VjaGVzIG9uIHRoZSBzY3JlZW5cbiAgICAgICAgICAgIHZhciBjb3VudF90b3VjaGVzID0gMDtcblxuICAgICAgICAgICAgLy8gd2hlbiB0b3VjaCBoYXMgYmVlbiB0cmlnZ2VyZWQgaW4gdGhpcyBkZXRlY3Rpb24gc2Vzc2lvblxuICAgICAgICAgICAgLy8gYW5kIHdlIGFyZSBub3cgaGFuZGxpbmcgYSBtb3VzZSBldmVudCwgd2Ugc3RvcCB0aGF0IHRvIHByZXZlbnQgY29uZmxpY3RzXG4gICAgICAgICAgICBpZihlbmFibGVfZGV0ZWN0KSB7XG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIHBvaW50ZXJldmVudFxuICAgICAgICAgICAgICAgIGlmKEhhbW1lci5IQVNfUE9JTlRFUkVWRU5UUyAmJiBldmVudFR5cGUgIT0gSGFtbWVyLkVWRU5UX0VORCkge1xuICAgICAgICAgICAgICAgICAgICBjb3VudF90b3VjaGVzID0gSGFtbWVyLlBvaW50ZXJFdmVudC51cGRhdGVQb2ludGVyKGV2ZW50VHlwZSwgZXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyB0b3VjaFxuICAgICAgICAgICAgICAgIGVsc2UgaWYoc291cmNlRXZlbnRUeXBlLm1hdGNoKC90b3VjaC8pKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50X3RvdWNoZXMgPSBldi50b3VjaGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gbW91c2VcbiAgICAgICAgICAgICAgICBlbHNlIGlmKCF0b3VjaF90cmlnZ2VyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY291bnRfdG91Y2hlcyA9IHNvdXJjZUV2ZW50VHlwZS5tYXRjaCgvdXAvKSA/IDAgOiAxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGlmIHdlIGFyZSBpbiBhIGVuZCBldmVudCwgYnV0IHdoZW4gd2UgcmVtb3ZlIG9uZSB0b3VjaCBhbmRcbiAgICAgICAgICAgICAgICAvLyB3ZSBzdGlsbCBoYXZlIGVub3VnaCwgc2V0IGV2ZW50VHlwZSB0byBtb3ZlXG4gICAgICAgICAgICAgICAgaWYoY291bnRfdG91Y2hlcyA+IDAgJiYgZXZlbnRUeXBlID09IEhhbW1lci5FVkVOVF9FTkQpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRUeXBlID0gSGFtbWVyLkVWRU5UX01PVkU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIG5vIHRvdWNoZXMsIGZvcmNlIHRoZSBlbmQgZXZlbnRcbiAgICAgICAgICAgICAgICBlbHNlIGlmKCFjb3VudF90b3VjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50VHlwZSA9IEhhbW1lci5FVkVOVF9FTkQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYmVjYXVzZSB0b3VjaGVuZCBoYXMgbm8gdG91Y2hlcywgYW5kIHdlIG9mdGVuIHdhbnQgdG8gdXNlIHRoZXNlIGluIG91ciBnZXN0dXJlcyxcbiAgICAgICAgICAgICAgICAvLyB3ZSBzZW5kIHRoZSBsYXN0IG1vdmUgZXZlbnQgYXMgb3VyIGV2ZW50RGF0YSBpbiB0b3VjaGVuZFxuICAgICAgICAgICAgICAgIGlmKCFjb3VudF90b3VjaGVzICYmIGxhc3RfbW92ZV9ldmVudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBldiA9IGxhc3RfbW92ZV9ldmVudDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gc3RvcmUgdGhlIGxhc3QgbW92ZSBldmVudFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsYXN0X21vdmVfZXZlbnQgPSBldjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB0cmlnZ2VyIHRoZSBoYW5kbGVyXG4gICAgICAgICAgICAgICAgaGFuZGxlci5jYWxsKEhhbW1lci5kZXRlY3Rpb24sIHNlbGYuY29sbGVjdEV2ZW50RGF0YShlbGVtZW50LCBldmVudFR5cGUsIGV2KSk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW1vdmUgcG9pbnRlcmV2ZW50IGZyb20gbGlzdFxuICAgICAgICAgICAgICAgIGlmKEhhbW1lci5IQVNfUE9JTlRFUkVWRU5UUyAmJiBldmVudFR5cGUgPT0gSGFtbWVyLkVWRU5UX0VORCkge1xuICAgICAgICAgICAgICAgICAgICBjb3VudF90b3VjaGVzID0gSGFtbWVyLlBvaW50ZXJFdmVudC51cGRhdGVQb2ludGVyKGV2ZW50VHlwZSwgZXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9kZWJ1Zyhzb3VyY2VFdmVudFR5cGUgK1wiIFwiKyBldmVudFR5cGUpO1xuXG4gICAgICAgICAgICAvLyBvbiB0aGUgZW5kIHdlIHJlc2V0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgIGlmKCFjb3VudF90b3VjaGVzKSB7XG4gICAgICAgICAgICAgICAgbGFzdF9tb3ZlX2V2ZW50ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBlbmFibGVfZGV0ZWN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdG91Y2hfdHJpZ2dlcmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgSGFtbWVyLlBvaW50ZXJFdmVudC5yZXNldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiB3ZSBoYXZlIGRpZmZlcmVudCBldmVudHMgZm9yIGVhY2ggZGV2aWNlL2Jyb3dzZXJcbiAgICAgKiBkZXRlcm1pbmUgd2hhdCB3ZSBuZWVkIGFuZCBzZXQgdGhlbSBpbiB0aGUgSGFtbWVyLkVWRU5UX1RZUEVTIGNvbnN0YW50XG4gICAgICovXG4gICAgZGV0ZXJtaW5lRXZlbnRUeXBlczogZnVuY3Rpb24gZGV0ZXJtaW5lRXZlbnRUeXBlcygpIHtcbiAgICAgICAgLy8gZGV0ZXJtaW5lIHRoZSBldmVudHR5cGUgd2Ugd2FudCB0byBzZXRcbiAgICAgICAgdmFyIHR5cGVzO1xuXG4gICAgICAgIC8vIHBvaW50ZXJFdmVudHMgbWFnaWNcbiAgICAgICAgaWYoSGFtbWVyLkhBU19QT0lOVEVSRVZFTlRTKSB7XG4gICAgICAgICAgICB0eXBlcyA9IEhhbW1lci5Qb2ludGVyRXZlbnQuZ2V0RXZlbnRzKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gb24gQW5kcm9pZCwgaU9TLCBibGFja2JlcnJ5LCB3aW5kb3dzIG1vYmlsZSB3ZSBkb250IHdhbnQgYW55IG1vdXNlZXZlbnRzXG4gICAgICAgIGVsc2UgaWYoSGFtbWVyLk5PX01PVVNFRVZFTlRTKSB7XG4gICAgICAgICAgICB0eXBlcyA9IFtcbiAgICAgICAgICAgICAgICAndG91Y2hzdGFydCcsXG4gICAgICAgICAgICAgICAgJ3RvdWNobW92ZScsXG4gICAgICAgICAgICAgICAgJ3RvdWNoZW5kIHRvdWNoY2FuY2VsJ107XG4gICAgICAgIH1cbiAgICAgICAgLy8gZm9yIG5vbiBwb2ludGVyIGV2ZW50cyBicm93c2VycyBhbmQgbWl4ZWQgYnJvd3NlcnMsXG4gICAgICAgIC8vIGxpa2UgY2hyb21lIG9uIHdpbmRvd3M4IHRvdWNoIGxhcHRvcFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHR5cGVzID0gW1xuICAgICAgICAgICAgICAgICd0b3VjaHN0YXJ0IG1vdXNlZG93bicsXG4gICAgICAgICAgICAgICAgJ3RvdWNobW92ZSBtb3VzZW1vdmUnLFxuICAgICAgICAgICAgICAgICd0b3VjaGVuZCB0b3VjaGNhbmNlbCBtb3VzZXVwJ107XG4gICAgICAgIH1cblxuICAgICAgICBIYW1tZXIuRVZFTlRfVFlQRVNbSGFtbWVyLkVWRU5UX1NUQVJUXSAgPSB0eXBlc1swXTtcbiAgICAgICAgSGFtbWVyLkVWRU5UX1RZUEVTW0hhbW1lci5FVkVOVF9NT1ZFXSAgID0gdHlwZXNbMV07XG4gICAgICAgIEhhbW1lci5FVkVOVF9UWVBFU1tIYW1tZXIuRVZFTlRfRU5EXSAgICA9IHR5cGVzWzJdO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIGNyZWF0ZSB0b3VjaGxpc3QgZGVwZW5kaW5nIG9uIHRoZSBldmVudFxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9ICAgIGV2XG4gICAgICogQHBhcmFtICAge1N0cmluZ30gICAgZXZlbnRUeXBlICAgdXNlZCBieSB0aGUgZmFrZW11bHRpdG91Y2ggcGx1Z2luXG4gICAgICovXG4gICAgZ2V0VG91Y2hMaXN0OiBmdW5jdGlvbiBnZXRUb3VjaExpc3QoZXYvKiwgZXZlbnRUeXBlKi8pIHtcbiAgICAgICAgLy8gZ2V0IHRoZSBmYWtlIHBvaW50ZXJFdmVudCB0b3VjaGxpc3RcbiAgICAgICAgaWYoSGFtbWVyLkhBU19QT0lOVEVSRVZFTlRTKSB7XG4gICAgICAgICAgICByZXR1cm4gSGFtbWVyLlBvaW50ZXJFdmVudC5nZXRUb3VjaExpc3QoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBnZXQgdGhlIHRvdWNobGlzdFxuICAgICAgICBlbHNlIGlmKGV2LnRvdWNoZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBldi50b3VjaGVzO1xuICAgICAgICB9XG4gICAgICAgIC8vIG1ha2UgZmFrZSB0b3VjaGxpc3QgZnJvbSBtb3VzZSBwb3NpdGlvblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgICAgIGlkZW50aWZpZXI6IDEsXG4gICAgICAgICAgICAgICAgcGFnZVg6IGV2LnBhZ2VYLFxuICAgICAgICAgICAgICAgIHBhZ2VZOiBldi5wYWdlWSxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGV2LnRhcmdldFxuICAgICAgICAgICAgfV07XG4gICAgICAgIH1cbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBjb2xsZWN0IGV2ZW50IGRhdGEgZm9yIEhhbW1lciBqc1xuICAgICAqIEBwYXJhbSAgIHtIVE1MRWxlbWVudH0gICBlbGVtZW50XG4gICAgICogQHBhcmFtICAge1N0cmluZ30gICAgICAgIGV2ZW50VHlwZSAgICAgICAgbGlrZSBIYW1tZXIuRVZFTlRfTU9WRVxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9ICAgICAgICBldmVudERhdGFcbiAgICAgKi9cbiAgICBjb2xsZWN0RXZlbnREYXRhOiBmdW5jdGlvbiBjb2xsZWN0RXZlbnREYXRhKGVsZW1lbnQsIGV2ZW50VHlwZSwgZXYpIHtcbiAgICAgICAgdmFyIHRvdWNoZXMgPSB0aGlzLmdldFRvdWNoTGlzdChldiwgZXZlbnRUeXBlKTtcblxuICAgICAgICAvLyBmaW5kIG91dCBwb2ludGVyVHlwZVxuICAgICAgICB2YXIgcG9pbnRlclR5cGUgPSBIYW1tZXIuUE9JTlRFUl9UT1VDSDtcbiAgICAgICAgaWYoZXYudHlwZS5tYXRjaCgvbW91c2UvKSB8fCBIYW1tZXIuUG9pbnRlckV2ZW50Lm1hdGNoVHlwZShIYW1tZXIuUE9JTlRFUl9NT1VTRSwgZXYpKSB7XG4gICAgICAgICAgICBwb2ludGVyVHlwZSA9IEhhbW1lci5QT0lOVEVSX01PVVNFO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNlbnRlciAgICAgIDogSGFtbWVyLnV0aWxzLmdldENlbnRlcih0b3VjaGVzKSxcbiAgICAgICAgICAgIHRpbWVTdGFtcCAgIDogbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgICAgICAgICB0YXJnZXQgICAgICA6IGV2LnRhcmdldCxcbiAgICAgICAgICAgIHRvdWNoZXMgICAgIDogdG91Y2hlcyxcbiAgICAgICAgICAgIGV2ZW50VHlwZSAgIDogZXZlbnRUeXBlLFxuICAgICAgICAgICAgcG9pbnRlclR5cGUgOiBwb2ludGVyVHlwZSxcbiAgICAgICAgICAgIHNyY0V2ZW50ICAgIDogZXYsXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogcHJldmVudCB0aGUgYnJvd3NlciBkZWZhdWx0IGFjdGlvbnNcbiAgICAgICAgICAgICAqIG1vc3RseSB1c2VkIHRvIGRpc2FibGUgc2Nyb2xsaW5nIG9mIHRoZSBicm93c2VyXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHByZXZlbnREZWZhdWx0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnNyY0V2ZW50LnByZXZlbnRNYW5pcHVsYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zcmNFdmVudC5wcmV2ZW50TWFuaXB1bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYodGhpcy5zcmNFdmVudC5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNyY0V2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBzdG9wIGJ1YmJsaW5nIHRoZSBldmVudCB1cCB0byBpdHMgcGFyZW50c1xuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBzdG9wUHJvcGFnYXRpb246IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3JjRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIGltbWVkaWF0ZWx5IHN0b3AgZ2VzdHVyZSBkZXRlY3Rpb25cbiAgICAgICAgICAgICAqIG1pZ2h0IGJlIHVzZWZ1bCBhZnRlciBhIHN3aXBlIHdhcyBkZXRlY3RlZFxuICAgICAgICAgICAgICogQHJldHVybiB7Kn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgc3RvcERldGVjdDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhhbW1lci5kZXRlY3Rpb24uc3RvcERldGVjdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbn07XG5cbkhhbW1lci5Qb2ludGVyRXZlbnQgPSB7XG4gICAgLyoqXG4gICAgICogaG9sZHMgYWxsIHBvaW50ZXJzXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICBwb2ludGVyczoge30sXG5cbiAgICAvKipcbiAgICAgKiBnZXQgYSBsaXN0IG9mIHBvaW50ZXJzXG4gICAgICogQHJldHVybnMge0FycmF5fSAgICAgdG91Y2hsaXN0XG4gICAgICovXG4gICAgZ2V0VG91Y2hMaXN0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgdG91Y2hsaXN0ID0gW107XG5cbiAgICAgICAgLy8gd2UgY2FuIHVzZSBmb3JFYWNoIHNpbmNlIHBvaW50ZXJFdmVudHMgb25seSBpcyBpbiBJRTEwXG4gICAgICAgIE9iamVjdC5rZXlzKHNlbGYucG9pbnRlcnMpLnNvcnQoKS5mb3JFYWNoKGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgICB0b3VjaGxpc3QucHVzaChzZWxmLnBvaW50ZXJzW2lkXSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdG91Y2hsaXN0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiB1cGRhdGUgdGhlIHBvc2l0aW9uIG9mIGEgcG9pbnRlclxuICAgICAqIEBwYXJhbSAgIHtTdHJpbmd9ICAgdHlwZSAgICAgICAgICAgICBIYW1tZXIuRVZFTlRfRU5EXG4gICAgICogQHBhcmFtICAge09iamVjdH0gICBwb2ludGVyRXZlbnRcbiAgICAgKi9cbiAgICB1cGRhdGVQb2ludGVyOiBmdW5jdGlvbih0eXBlLCBwb2ludGVyRXZlbnQpIHtcbiAgICAgICAgaWYodHlwZSA9PSBIYW1tZXIuRVZFTlRfRU5EKSB7XG4gICAgICAgICAgICB0aGlzLnBvaW50ZXJzID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwb2ludGVyRXZlbnQuaWRlbnRpZmllciA9IHBvaW50ZXJFdmVudC5wb2ludGVySWQ7XG4gICAgICAgICAgICB0aGlzLnBvaW50ZXJzW3BvaW50ZXJFdmVudC5wb2ludGVySWRdID0gcG9pbnRlckV2ZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMucG9pbnRlcnMpLmxlbmd0aDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogY2hlY2sgaWYgZXYgbWF0Y2hlcyBwb2ludGVydHlwZVxuICAgICAqIEBwYXJhbSAgIHtTdHJpbmd9ICAgICAgICBwb2ludGVyVHlwZSAgICAgSGFtbWVyLlBPSU5URVJfTU9VU0VcbiAgICAgKiBAcGFyYW0gICB7UG9pbnRlckV2ZW50fSAgZXZcbiAgICAgKi9cbiAgICBtYXRjaFR5cGU6IGZ1bmN0aW9uKHBvaW50ZXJUeXBlLCBldikge1xuICAgICAgICBpZighZXYucG9pbnRlclR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB0eXBlcyA9IHt9O1xuICAgICAgICB0eXBlc1tIYW1tZXIuUE9JTlRFUl9NT1VTRV0gPSAoZXYucG9pbnRlclR5cGUgPT0gZXYuTVNQT0lOVEVSX1RZUEVfTU9VU0UgfHwgZXYucG9pbnRlclR5cGUgPT0gSGFtbWVyLlBPSU5URVJfTU9VU0UpO1xuICAgICAgICB0eXBlc1tIYW1tZXIuUE9JTlRFUl9UT1VDSF0gPSAoZXYucG9pbnRlclR5cGUgPT0gZXYuTVNQT0lOVEVSX1RZUEVfVE9VQ0ggfHwgZXYucG9pbnRlclR5cGUgPT0gSGFtbWVyLlBPSU5URVJfVE9VQ0gpO1xuICAgICAgICB0eXBlc1tIYW1tZXIuUE9JTlRFUl9QRU5dID0gKGV2LnBvaW50ZXJUeXBlID09IGV2Lk1TUE9JTlRFUl9UWVBFX1BFTiB8fCBldi5wb2ludGVyVHlwZSA9PSBIYW1tZXIuUE9JTlRFUl9QRU4pO1xuICAgICAgICByZXR1cm4gdHlwZXNbcG9pbnRlclR5cGVdO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIGdldCBldmVudHNcbiAgICAgKi9cbiAgICBnZXRFdmVudHM6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgJ3BvaW50ZXJkb3duIE1TUG9pbnRlckRvd24nLFxuICAgICAgICAgICAgJ3BvaW50ZXJtb3ZlIE1TUG9pbnRlck1vdmUnLFxuICAgICAgICAgICAgJ3BvaW50ZXJ1cCBwb2ludGVyY2FuY2VsIE1TUG9pbnRlclVwIE1TUG9pbnRlckNhbmNlbCdcbiAgICAgICAgXTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogcmVzZXQgdGhlIGxpc3RcbiAgICAgKi9cbiAgICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMucG9pbnRlcnMgPSB7fTtcbiAgICB9XG59O1xuXG5cbkhhbW1lci51dGlscyA9IHtcbiAgICAvKipcbiAgICAgKiBleHRlbmQgbWV0aG9kLFxuICAgICAqIGFsc28gdXNlZCBmb3IgY2xvbmluZyB3aGVuIGRlc3QgaXMgYW4gZW1wdHkgb2JqZWN0XG4gICAgICogQHBhcmFtICAge09iamVjdH0gICAgZGVzdFxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9ICAgIHNyY1xuXHQgKiBAcGFybVx0e0Jvb2xlYW59XHRtZXJnZVx0XHRkbyBhIG1lcmdlXG4gICAgICogQHJldHVybnMge09iamVjdH0gICAgZGVzdFxuICAgICAqL1xuICAgIGV4dGVuZDogZnVuY3Rpb24gZXh0ZW5kKGRlc3QsIHNyYywgbWVyZ2UpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIHNyYykge1xuXHRcdFx0aWYoZGVzdFtrZXldICE9PSB1bmRlZmluZWQgJiYgbWVyZ2UpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG4gICAgICAgICAgICBkZXN0W2tleV0gPSBzcmNba2V5XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVzdDtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBmaW5kIGlmIGEgbm9kZSBpcyBpbiB0aGUgZ2l2ZW4gcGFyZW50XG4gICAgICogdXNlZCBmb3IgZXZlbnQgZGVsZWdhdGlvbiB0cmlja3NcbiAgICAgKiBAcGFyYW0gICB7SFRNTEVsZW1lbnR9ICAgbm9kZVxuICAgICAqIEBwYXJhbSAgIHtIVE1MRWxlbWVudH0gICBwYXJlbnRcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gICAgICAgaGFzX3BhcmVudFxuICAgICAqL1xuICAgIGhhc1BhcmVudDogZnVuY3Rpb24obm9kZSwgcGFyZW50KSB7XG4gICAgICAgIHdoaWxlKG5vZGUpe1xuICAgICAgICAgICAgaWYobm9kZSA9PSBwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIGdldCB0aGUgY2VudGVyIG9mIGFsbCB0aGUgdG91Y2hlc1xuICAgICAqIEBwYXJhbSAgIHtBcnJheX0gICAgIHRvdWNoZXNcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSAgICBjZW50ZXJcbiAgICAgKi9cbiAgICBnZXRDZW50ZXI6IGZ1bmN0aW9uIGdldENlbnRlcih0b3VjaGVzKSB7XG4gICAgICAgIHZhciB2YWx1ZXNYID0gW10sIHZhbHVlc1kgPSBbXTtcblxuICAgICAgICBmb3IodmFyIHQ9IDAsbGVuPXRvdWNoZXMubGVuZ3RoOyB0PGxlbjsgdCsrKSB7XG4gICAgICAgICAgICB2YWx1ZXNYLnB1c2godG91Y2hlc1t0XS5wYWdlWCk7XG4gICAgICAgICAgICB2YWx1ZXNZLnB1c2godG91Y2hlc1t0XS5wYWdlWSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGFnZVg6ICgoTWF0aC5taW4uYXBwbHkoTWF0aCwgdmFsdWVzWCkgKyBNYXRoLm1heC5hcHBseShNYXRoLCB2YWx1ZXNYKSkgLyAyKSxcbiAgICAgICAgICAgIHBhZ2VZOiAoKE1hdGgubWluLmFwcGx5KE1hdGgsIHZhbHVlc1kpICsgTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWVzWSkpIC8gMilcbiAgICAgICAgfTtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBjYWxjdWxhdGUgdGhlIHZlbG9jaXR5IGJldHdlZW4gdHdvIHBvaW50c1xuICAgICAqIEBwYXJhbSAgIHtOdW1iZXJ9ICAgIGRlbHRhX3RpbWVcbiAgICAgKiBAcGFyYW0gICB7TnVtYmVyfSAgICBkZWx0YV94XG4gICAgICogQHBhcmFtICAge051bWJlcn0gICAgZGVsdGFfeVxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9ICAgIHZlbG9jaXR5XG4gICAgICovXG4gICAgZ2V0VmVsb2NpdHk6IGZ1bmN0aW9uIGdldFZlbG9jaXR5KGRlbHRhX3RpbWUsIGRlbHRhX3gsIGRlbHRhX3kpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IE1hdGguYWJzKGRlbHRhX3ggLyBkZWx0YV90aW1lKSB8fCAwLFxuICAgICAgICAgICAgeTogTWF0aC5hYnMoZGVsdGFfeSAvIGRlbHRhX3RpbWUpIHx8IDBcbiAgICAgICAgfTtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBjYWxjdWxhdGUgdGhlIGFuZ2xlIGJldHdlZW4gdHdvIGNvb3JkaW5hdGVzXG4gICAgICogQHBhcmFtICAge1RvdWNofSAgICAgdG91Y2gxXG4gICAgICogQHBhcmFtICAge1RvdWNofSAgICAgdG91Y2gyXG4gICAgICogQHJldHVybnMge051bWJlcn0gICAgYW5nbGVcbiAgICAgKi9cbiAgICBnZXRBbmdsZTogZnVuY3Rpb24gZ2V0QW5nbGUodG91Y2gxLCB0b3VjaDIpIHtcbiAgICAgICAgdmFyIHkgPSB0b3VjaDIucGFnZVkgLSB0b3VjaDEucGFnZVksXG4gICAgICAgICAgICB4ID0gdG91Y2gyLnBhZ2VYIC0gdG91Y2gxLnBhZ2VYO1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMih5LCB4KSAqIDE4MCAvIE1hdGguUEk7XG4gICAgfSxcblxuXG4gICAgLyoqXG4gICAgICogYW5nbGUgdG8gZGlyZWN0aW9uIGRlZmluZVxuICAgICAqIEBwYXJhbSAgIHtUb3VjaH0gICAgIHRvdWNoMVxuICAgICAqIEBwYXJhbSAgIHtUb3VjaH0gICAgIHRvdWNoMlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9ICAgIGRpcmVjdGlvbiBjb25zdGFudCwgbGlrZSBIYW1tZXIuRElSRUNUSU9OX0xFRlRcbiAgICAgKi9cbiAgICBnZXREaXJlY3Rpb246IGZ1bmN0aW9uIGdldERpcmVjdGlvbih0b3VjaDEsIHRvdWNoMikge1xuICAgICAgICB2YXIgeCA9IE1hdGguYWJzKHRvdWNoMS5wYWdlWCAtIHRvdWNoMi5wYWdlWCksXG4gICAgICAgICAgICB5ID0gTWF0aC5hYnModG91Y2gxLnBhZ2VZIC0gdG91Y2gyLnBhZ2VZKTtcblxuICAgICAgICBpZih4ID49IHkpIHtcbiAgICAgICAgICAgIHJldHVybiB0b3VjaDEucGFnZVggLSB0b3VjaDIucGFnZVggPiAwID8gSGFtbWVyLkRJUkVDVElPTl9MRUZUIDogSGFtbWVyLkRJUkVDVElPTl9SSUdIVDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0b3VjaDEucGFnZVkgLSB0b3VjaDIucGFnZVkgPiAwID8gSGFtbWVyLkRJUkVDVElPTl9VUCA6IEhhbW1lci5ESVJFQ1RJT05fRE9XTjtcbiAgICAgICAgfVxuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIGNhbGN1bGF0ZSB0aGUgZGlzdGFuY2UgYmV0d2VlbiB0d28gdG91Y2hlc1xuICAgICAqIEBwYXJhbSAgIHtUb3VjaH0gICAgIHRvdWNoMVxuICAgICAqIEBwYXJhbSAgIHtUb3VjaH0gICAgIHRvdWNoMlxuICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9ICAgIGRpc3RhbmNlXG4gICAgICovXG4gICAgZ2V0RGlzdGFuY2U6IGZ1bmN0aW9uIGdldERpc3RhbmNlKHRvdWNoMSwgdG91Y2gyKSB7XG4gICAgICAgIHZhciB4ID0gdG91Y2gyLnBhZ2VYIC0gdG91Y2gxLnBhZ2VYLFxuICAgICAgICAgICAgeSA9IHRvdWNoMi5wYWdlWSAtIHRvdWNoMS5wYWdlWTtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCgoeCp4KSArICh5KnkpKTtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBjYWxjdWxhdGUgdGhlIHNjYWxlIGZhY3RvciBiZXR3ZWVuIHR3byB0b3VjaExpc3RzIChmaW5nZXJzKVxuICAgICAqIG5vIHNjYWxlIGlzIDEsIGFuZCBnb2VzIGRvd24gdG8gMCB3aGVuIHBpbmNoZWQgdG9nZXRoZXIsIGFuZCBiaWdnZXIgd2hlbiBwaW5jaGVkIG91dFxuICAgICAqIEBwYXJhbSAgIHtBcnJheX0gICAgIHN0YXJ0XG4gICAgICogQHBhcmFtICAge0FycmF5fSAgICAgZW5kXG4gICAgICogQHJldHVybnMge051bWJlcn0gICAgc2NhbGVcbiAgICAgKi9cbiAgICBnZXRTY2FsZTogZnVuY3Rpb24gZ2V0U2NhbGUoc3RhcnQsIGVuZCkge1xuICAgICAgICAvLyBuZWVkIHR3byBmaW5nZXJzLi4uXG4gICAgICAgIGlmKHN0YXJ0Lmxlbmd0aCA+PSAyICYmIGVuZC5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0RGlzdGFuY2UoZW5kWzBdLCBlbmRbMV0pIC9cbiAgICAgICAgICAgICAgICB0aGlzLmdldERpc3RhbmNlKHN0YXJ0WzBdLCBzdGFydFsxXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfSxcblxuXG4gICAgLyoqXG4gICAgICogY2FsY3VsYXRlIHRoZSByb3RhdGlvbiBkZWdyZWVzIGJldHdlZW4gdHdvIHRvdWNoTGlzdHMgKGZpbmdlcnMpXG4gICAgICogQHBhcmFtICAge0FycmF5fSAgICAgc3RhcnRcbiAgICAgKiBAcGFyYW0gICB7QXJyYXl9ICAgICBlbmRcbiAgICAgKiBAcmV0dXJucyB7TnVtYmVyfSAgICByb3RhdGlvblxuICAgICAqL1xuICAgIGdldFJvdGF0aW9uOiBmdW5jdGlvbiBnZXRSb3RhdGlvbihzdGFydCwgZW5kKSB7XG4gICAgICAgIC8vIG5lZWQgdHdvIGZpbmdlcnNcbiAgICAgICAgaWYoc3RhcnQubGVuZ3RoID49IDIgJiYgZW5kLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRBbmdsZShlbmRbMV0sIGVuZFswXSkgLVxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0QW5nbGUoc3RhcnRbMV0sIHN0YXJ0WzBdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMDtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBib29sZWFuIGlmIHRoZSBkaXJlY3Rpb24gaXMgdmVydGljYWxcbiAgICAgKiBAcGFyYW0gICAge1N0cmluZ30gICAgZGlyZWN0aW9uXG4gICAgICogQHJldHVybnMgIHtCb29sZWFufSAgIGlzX3ZlcnRpY2FsXG4gICAgICovXG4gICAgaXNWZXJ0aWNhbDogZnVuY3Rpb24gaXNWZXJ0aWNhbChkaXJlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIChkaXJlY3Rpb24gPT0gSGFtbWVyLkRJUkVDVElPTl9VUCB8fCBkaXJlY3Rpb24gPT0gSGFtbWVyLkRJUkVDVElPTl9ET1dOKTtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBzdG9wIGJyb3dzZXIgZGVmYXVsdCBiZWhhdmlvciB3aXRoIGNzcyBwcm9wc1xuICAgICAqIEBwYXJhbSAgIHtIdG1sRWxlbWVudH0gICBlbGVtZW50XG4gICAgICogQHBhcmFtICAge09iamVjdH0gICAgICAgIGNzc19wcm9wc1xuICAgICAqL1xuICAgIHN0b3BEZWZhdWx0QnJvd3NlckJlaGF2aW9yOiBmdW5jdGlvbiBzdG9wRGVmYXVsdEJyb3dzZXJCZWhhdmlvcihlbGVtZW50LCBjc3NfcHJvcHMpIHtcbiAgICAgICAgdmFyIHByb3AsXG4gICAgICAgICAgICB2ZW5kb3JzID0gWyd3ZWJraXQnLCdraHRtbCcsJ21veicsJ21zJywnbycsJyddO1xuXG4gICAgICAgIGlmKCFjc3NfcHJvcHMgfHwgIWVsZW1lbnQuc3R5bGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdpdGggY3NzIHByb3BlcnRpZXMgZm9yIG1vZGVybiBicm93c2Vyc1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgdmVuZG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZm9yKHZhciBwIGluIGNzc19wcm9wcykge1xuICAgICAgICAgICAgICAgIGlmKGNzc19wcm9wcy5oYXNPd25Qcm9wZXJ0eShwKSkge1xuICAgICAgICAgICAgICAgICAgICBwcm9wID0gcDtcblxuICAgICAgICAgICAgICAgICAgICAvLyB2ZW5kZXIgcHJlZml4IGF0IHRoZSBwcm9wZXJ0eVxuICAgICAgICAgICAgICAgICAgICBpZih2ZW5kb3JzW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wID0gdmVuZG9yc1tpXSArIHByb3Auc3Vic3RyaW5nKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyBwcm9wLnN1YnN0cmluZygxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgc3R5bGVcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZVtwcm9wXSA9IGNzc19wcm9wc1twXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbHNvIHRoZSBkaXNhYmxlIG9uc2VsZWN0c3RhcnRcbiAgICAgICAgaWYoY3NzX3Byb3BzLnVzZXJTZWxlY3QgPT0gJ25vbmUnKSB7XG4gICAgICAgICAgICBlbGVtZW50Lm9uc2VsZWN0c3RhcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxufTtcblxuSGFtbWVyLmRldGVjdGlvbiA9IHtcbiAgICAvLyBjb250YWlucyBhbGwgcmVnaXN0cmVkIEhhbW1lci5nZXN0dXJlcyBpbiB0aGUgY29ycmVjdCBvcmRlclxuICAgIGdlc3R1cmVzOiBbXSxcblxuICAgIC8vIGRhdGEgb2YgdGhlIGN1cnJlbnQgSGFtbWVyLmdlc3R1cmUgZGV0ZWN0aW9uIHNlc3Npb25cbiAgICBjdXJyZW50OiBudWxsLFxuXG4gICAgLy8gdGhlIHByZXZpb3VzIEhhbW1lci5nZXN0dXJlIHNlc3Npb24gZGF0YVxuICAgIC8vIGlzIGEgZnVsbCBjbG9uZSBvZiB0aGUgcHJldmlvdXMgZ2VzdHVyZS5jdXJyZW50IG9iamVjdFxuICAgIHByZXZpb3VzOiBudWxsLFxuXG4gICAgLy8gd2hlbiB0aGlzIGJlY29tZXMgdHJ1ZSwgbm8gZ2VzdHVyZXMgYXJlIGZpcmVkXG4gICAgc3RvcHBlZDogZmFsc2UsXG5cblxuICAgIC8qKlxuICAgICAqIHN0YXJ0IEhhbW1lci5nZXN0dXJlIGRldGVjdGlvblxuICAgICAqIEBwYXJhbSAgIHtIYW1tZXIuSW5zdGFuY2V9ICAgaW5zdFxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9ICAgICAgICAgICAgZXZlbnREYXRhXG4gICAgICovXG4gICAgc3RhcnREZXRlY3Q6IGZ1bmN0aW9uIHN0YXJ0RGV0ZWN0KGluc3QsIGV2ZW50RGF0YSkge1xuICAgICAgICAvLyBhbHJlYWR5IGJ1c3kgd2l0aCBhIEhhbW1lci5nZXN0dXJlIGRldGVjdGlvbiBvbiBhbiBlbGVtZW50XG4gICAgICAgIGlmKHRoaXMuY3VycmVudCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdG9wcGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5jdXJyZW50ID0ge1xuICAgICAgICAgICAgaW5zdCAgICAgICAgOiBpbnN0LCAvLyByZWZlcmVuY2UgdG8gSGFtbWVySW5zdGFuY2Ugd2UncmUgd29ya2luZyBmb3JcbiAgICAgICAgICAgIHN0YXJ0RXZlbnQgIDogSGFtbWVyLnV0aWxzLmV4dGVuZCh7fSwgZXZlbnREYXRhKSwgLy8gc3RhcnQgZXZlbnREYXRhIGZvciBkaXN0YW5jZXMsIHRpbWluZyBldGNcbiAgICAgICAgICAgIGxhc3RFdmVudCAgIDogZmFsc2UsIC8vIGxhc3QgZXZlbnREYXRhXG4gICAgICAgICAgICBuYW1lICAgICAgICA6ICcnIC8vIGN1cnJlbnQgZ2VzdHVyZSB3ZSdyZSBpbi9kZXRlY3RlZCwgY2FuIGJlICd0YXAnLCAnaG9sZCcgZXRjXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kZXRlY3QoZXZlbnREYXRhKTtcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBIYW1tZXIuZ2VzdHVyZSBkZXRlY3Rpb25cbiAgICAgKiBAcGFyYW0gICB7T2JqZWN0fSAgICBldmVudERhdGFcbiAgICAgKiBAcGFyYW0gICB7T2JqZWN0fSAgICBldmVudERhdGFcbiAgICAgKi9cbiAgICBkZXRlY3Q6IGZ1bmN0aW9uIGRldGVjdChldmVudERhdGEpIHtcbiAgICAgICAgaWYoIXRoaXMuY3VycmVudCB8fCB0aGlzLnN0b3BwZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4dGVuZCBldmVudCBkYXRhIHdpdGggY2FsY3VsYXRpb25zIGFib3V0IHNjYWxlLCBkaXN0YW5jZSBldGNcbiAgICAgICAgZXZlbnREYXRhID0gdGhpcy5leHRlbmRFdmVudERhdGEoZXZlbnREYXRhKTtcblxuICAgICAgICAvLyBpbnN0YW5jZSBvcHRpb25zXG4gICAgICAgIHZhciBpbnN0X29wdGlvbnMgPSB0aGlzLmN1cnJlbnQuaW5zdC5vcHRpb25zO1xuXG4gICAgICAgIC8vIGNhbGwgSGFtbWVyLmdlc3R1cmUgaGFuZGxlcnNcbiAgICAgICAgZm9yKHZhciBnPTAsbGVuPXRoaXMuZ2VzdHVyZXMubGVuZ3RoOyBnPGxlbjsgZysrKSB7XG4gICAgICAgICAgICB2YXIgZ2VzdHVyZSA9IHRoaXMuZ2VzdHVyZXNbZ107XG5cbiAgICAgICAgICAgIC8vIG9ubHkgd2hlbiB0aGUgaW5zdGFuY2Ugb3B0aW9ucyBoYXZlIGVuYWJsZWQgdGhpcyBnZXN0dXJlXG4gICAgICAgICAgICBpZighdGhpcy5zdG9wcGVkICYmIGluc3Rfb3B0aW9uc1tnZXN0dXJlLm5hbWVdICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIGEgaGFuZGxlciByZXR1cm5zIGZhbHNlLCB3ZSBzdG9wIHdpdGggdGhlIGRldGVjdGlvblxuICAgICAgICAgICAgICAgIGlmKGdlc3R1cmUuaGFuZGxlci5jYWxsKGdlc3R1cmUsIGV2ZW50RGF0YSwgdGhpcy5jdXJyZW50Lmluc3QpID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0b3BEZXRlY3QoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgYXMgcHJldmlvdXMgZXZlbnQgZXZlbnRcbiAgICAgICAgaWYodGhpcy5jdXJyZW50KSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnQubGFzdEV2ZW50ID0gZXZlbnREYXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW5kZXZlbnQsIGJ1dCBub3QgdGhlIGxhc3QgdG91Y2gsIHNvIGRvbnQgc3RvcFxuICAgICAgICBpZihldmVudERhdGEuZXZlbnRUeXBlID09IEhhbW1lci5FVkVOVF9FTkQgJiYgIWV2ZW50RGF0YS50b3VjaGVzLmxlbmd0aC0xKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3BEZXRlY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBldmVudERhdGE7XG4gICAgfSxcblxuXG4gICAgLyoqXG4gICAgICogY2xlYXIgdGhlIEhhbW1lci5nZXN0dXJlIHZhcnNcbiAgICAgKiB0aGlzIGlzIGNhbGxlZCBvbiBlbmREZXRlY3QsIGJ1dCBjYW4gYWxzbyBiZSB1c2VkIHdoZW4gYSBmaW5hbCBIYW1tZXIuZ2VzdHVyZSBoYXMgYmVlbiBkZXRlY3RlZFxuICAgICAqIHRvIHN0b3Agb3RoZXIgSGFtbWVyLmdlc3R1cmVzIGZyb20gYmVpbmcgZmlyZWRcbiAgICAgKi9cbiAgICBzdG9wRGV0ZWN0OiBmdW5jdGlvbiBzdG9wRGV0ZWN0KCkge1xuICAgICAgICAvLyBjbG9uZSBjdXJyZW50IGRhdGEgdG8gdGhlIHN0b3JlIGFzIHRoZSBwcmV2aW91cyBnZXN0dXJlXG4gICAgICAgIC8vIHVzZWQgZm9yIHRoZSBkb3VibGUgdGFwIGdlc3R1cmUsIHNpbmNlIHRoaXMgaXMgYW4gb3RoZXIgZ2VzdHVyZSBkZXRlY3Qgc2Vzc2lvblxuICAgICAgICB0aGlzLnByZXZpb3VzID0gSGFtbWVyLnV0aWxzLmV4dGVuZCh7fSwgdGhpcy5jdXJyZW50KTtcblxuICAgICAgICAvLyByZXNldCB0aGUgY3VycmVudFxuICAgICAgICB0aGlzLmN1cnJlbnQgPSBudWxsO1xuXG4gICAgICAgIC8vIHN0b3BwZWQhXG4gICAgICAgIHRoaXMuc3RvcHBlZCA9IHRydWU7XG4gICAgfSxcblxuXG4gICAgLyoqXG4gICAgICogZXh0ZW5kIGV2ZW50RGF0YSBmb3IgSGFtbWVyLmdlc3R1cmVzXG4gICAgICogQHBhcmFtICAge09iamVjdH0gICBldlxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9ICAgZXZcbiAgICAgKi9cbiAgICBleHRlbmRFdmVudERhdGE6IGZ1bmN0aW9uIGV4dGVuZEV2ZW50RGF0YShldikge1xuICAgICAgICB2YXIgc3RhcnRFdiA9IHRoaXMuY3VycmVudC5zdGFydEV2ZW50O1xuXG4gICAgICAgIC8vIGlmIHRoZSB0b3VjaGVzIGNoYW5nZSwgc2V0IHRoZSBuZXcgdG91Y2hlcyBvdmVyIHRoZSBzdGFydEV2ZW50IHRvdWNoZXNcbiAgICAgICAgLy8gdGhpcyBiZWNhdXNlIHRvdWNoZXZlbnRzIGRvbid0IGhhdmUgYWxsIHRoZSB0b3VjaGVzIG9uIHRvdWNoc3RhcnQsIG9yIHRoZVxuICAgICAgICAvLyB1c2VyIG11c3QgcGxhY2UgaGlzIGZpbmdlcnMgYXQgdGhlIEVYQUNUIHNhbWUgdGltZSBvbiB0aGUgc2NyZWVuLCB3aGljaCBpcyBub3QgcmVhbGlzdGljXG4gICAgICAgIC8vIGJ1dCwgc29tZXRpbWVzIGl0IGhhcHBlbnMgdGhhdCBib3RoIGZpbmdlcnMgYXJlIHRvdWNoaW5nIGF0IHRoZSBFWEFDVCBzYW1lIHRpbWVcbiAgICAgICAgaWYoc3RhcnRFdiAmJiAoZXYudG91Y2hlcy5sZW5ndGggIT0gc3RhcnRFdi50b3VjaGVzLmxlbmd0aCB8fCBldi50b3VjaGVzID09PSBzdGFydEV2LnRvdWNoZXMpKSB7XG4gICAgICAgICAgICAvLyBleHRlbmQgMSBsZXZlbCBkZWVwIHRvIGdldCB0aGUgdG91Y2hsaXN0IHdpdGggdGhlIHRvdWNoIG9iamVjdHNcbiAgICAgICAgICAgIHN0YXJ0RXYudG91Y2hlcyA9IFtdO1xuICAgICAgICAgICAgZm9yKHZhciBpPTAsbGVuPWV2LnRvdWNoZXMubGVuZ3RoOyBpPGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRFdi50b3VjaGVzLnB1c2goSGFtbWVyLnV0aWxzLmV4dGVuZCh7fSwgZXYudG91Y2hlc1tpXSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRlbHRhX3RpbWUgPSBldi50aW1lU3RhbXAgLSBzdGFydEV2LnRpbWVTdGFtcCxcbiAgICAgICAgICAgIGRlbHRhX3ggPSBldi5jZW50ZXIucGFnZVggLSBzdGFydEV2LmNlbnRlci5wYWdlWCxcbiAgICAgICAgICAgIGRlbHRhX3kgPSBldi5jZW50ZXIucGFnZVkgLSBzdGFydEV2LmNlbnRlci5wYWdlWSxcbiAgICAgICAgICAgIHZlbG9jaXR5ID0gSGFtbWVyLnV0aWxzLmdldFZlbG9jaXR5KGRlbHRhX3RpbWUsIGRlbHRhX3gsIGRlbHRhX3kpO1xuXG4gICAgICAgIEhhbW1lci51dGlscy5leHRlbmQoZXYsIHtcbiAgICAgICAgICAgIGRlbHRhVGltZSAgIDogZGVsdGFfdGltZSxcblxuICAgICAgICAgICAgZGVsdGFYICAgICAgOiBkZWx0YV94LFxuICAgICAgICAgICAgZGVsdGFZICAgICAgOiBkZWx0YV95LFxuXG4gICAgICAgICAgICB2ZWxvY2l0eVggICA6IHZlbG9jaXR5LngsXG4gICAgICAgICAgICB2ZWxvY2l0eVkgICA6IHZlbG9jaXR5LnksXG5cbiAgICAgICAgICAgIGRpc3RhbmNlICAgIDogSGFtbWVyLnV0aWxzLmdldERpc3RhbmNlKHN0YXJ0RXYuY2VudGVyLCBldi5jZW50ZXIpLFxuICAgICAgICAgICAgYW5nbGUgICAgICAgOiBIYW1tZXIudXRpbHMuZ2V0QW5nbGUoc3RhcnRFdi5jZW50ZXIsIGV2LmNlbnRlciksXG4gICAgICAgICAgICBkaXJlY3Rpb24gICA6IEhhbW1lci51dGlscy5nZXREaXJlY3Rpb24oc3RhcnRFdi5jZW50ZXIsIGV2LmNlbnRlciksXG5cbiAgICAgICAgICAgIHNjYWxlICAgICAgIDogSGFtbWVyLnV0aWxzLmdldFNjYWxlKHN0YXJ0RXYudG91Y2hlcywgZXYudG91Y2hlcyksXG4gICAgICAgICAgICByb3RhdGlvbiAgICA6IEhhbW1lci51dGlscy5nZXRSb3RhdGlvbihzdGFydEV2LnRvdWNoZXMsIGV2LnRvdWNoZXMpLFxuXG4gICAgICAgICAgICBzdGFydEV2ZW50ICA6IHN0YXJ0RXZcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGV2O1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIHJlZ2lzdGVyIG5ldyBnZXN0dXJlXG4gICAgICogQHBhcmFtICAge09iamVjdH0gICAgZ2VzdHVyZSBvYmplY3QsIHNlZSBnZXN0dXJlcy5qcyBmb3IgZG9jdW1lbnRhdGlvblxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gICAgIGdlc3R1cmVzXG4gICAgICovXG4gICAgcmVnaXN0ZXI6IGZ1bmN0aW9uIHJlZ2lzdGVyKGdlc3R1cmUpIHtcbiAgICAgICAgLy8gYWRkIGFuIGVuYWJsZSBnZXN0dXJlIG9wdGlvbnMgaWYgdGhlcmUgaXMgbm8gZ2l2ZW5cbiAgICAgICAgdmFyIG9wdGlvbnMgPSBnZXN0dXJlLmRlZmF1bHRzIHx8IHt9O1xuICAgICAgICBpZihvcHRpb25zW2dlc3R1cmUubmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9uc1tnZXN0dXJlLm5hbWVdID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4dGVuZCBIYW1tZXIgZGVmYXVsdCBvcHRpb25zIHdpdGggdGhlIEhhbW1lci5nZXN0dXJlIG9wdGlvbnNcbiAgICAgICAgSGFtbWVyLnV0aWxzLmV4dGVuZChIYW1tZXIuZGVmYXVsdHMsIG9wdGlvbnMsIHRydWUpO1xuXG4gICAgICAgIC8vIHNldCBpdHMgaW5kZXhcbiAgICAgICAgZ2VzdHVyZS5pbmRleCA9IGdlc3R1cmUuaW5kZXggfHwgMTAwMDtcblxuICAgICAgICAvLyBhZGQgSGFtbWVyLmdlc3R1cmUgdG8gdGhlIGxpc3RcbiAgICAgICAgdGhpcy5nZXN0dXJlcy5wdXNoKGdlc3R1cmUpO1xuXG4gICAgICAgIC8vIHNvcnQgdGhlIGxpc3QgYnkgaW5kZXhcbiAgICAgICAgdGhpcy5nZXN0dXJlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIGlmIChhLmluZGV4IDwgYi5pbmRleCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhLmluZGV4ID4gYi5pbmRleCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLmdlc3R1cmVzO1xuICAgIH1cbn07XG5cblxuSGFtbWVyLmdlc3R1cmVzID0gSGFtbWVyLmdlc3R1cmVzIHx8IHt9O1xuXG4vKipcbiAqIEN1c3RvbSBnZXN0dXJlc1xuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKlxuICogR2VzdHVyZSBvYmplY3RcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBUaGUgb2JqZWN0IHN0cnVjdHVyZSBvZiBhIGdlc3R1cmU6XG4gKlxuICogeyBuYW1lOiAnbXlnZXN0dXJlJyxcbiAqICAgaW5kZXg6IDEzMzcsXG4gKiAgIGRlZmF1bHRzOiB7XG4gKiAgICAgbXlnZXN0dXJlX29wdGlvbjogdHJ1ZVxuICogICB9XG4gKiAgIGhhbmRsZXI6IGZ1bmN0aW9uKHR5cGUsIGV2LCBpbnN0KSB7XG4gKiAgICAgLy8gdHJpZ2dlciBnZXN0dXJlIGV2ZW50XG4gKiAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSwgZXYpO1xuICogICB9XG4gKiB9XG5cbiAqIEBwYXJhbSAgIHtTdHJpbmd9ICAgIG5hbWVcbiAqIHRoaXMgc2hvdWxkIGJlIHRoZSBuYW1lIG9mIHRoZSBnZXN0dXJlLCBsb3dlcmNhc2VcbiAqIGl0IGlzIGFsc28gYmVpbmcgdXNlZCB0byBkaXNhYmxlL2VuYWJsZSB0aGUgZ2VzdHVyZSBwZXIgaW5zdGFuY2UgY29uZmlnLlxuICpcbiAqIEBwYXJhbSAgIHtOdW1iZXJ9ICAgIFtpbmRleD0xMDAwXVxuICogdGhlIGluZGV4IG9mIHRoZSBnZXN0dXJlLCB3aGVyZSBpdCBpcyBnb2luZyB0byBiZSBpbiB0aGUgc3RhY2sgb2YgZ2VzdHVyZXMgZGV0ZWN0aW9uXG4gKiBsaWtlIHdoZW4geW91IGJ1aWxkIGFuIGdlc3R1cmUgdGhhdCBkZXBlbmRzIG9uIHRoZSBkcmFnIGdlc3R1cmUsIGl0IGlzIGEgZ29vZFxuICogaWRlYSB0byBwbGFjZSBpdCBhZnRlciB0aGUgaW5kZXggb2YgdGhlIGRyYWcgZ2VzdHVyZS5cbiAqXG4gKiBAcGFyYW0gICB7T2JqZWN0fSAgICBbZGVmYXVsdHM9e31dXG4gKiB0aGUgZGVmYXVsdCBzZXR0aW5ncyBvZiB0aGUgZ2VzdHVyZS4gdGhlc2UgYXJlIGFkZGVkIHRvIHRoZSBpbnN0YW5jZSBzZXR0aW5ncyxcbiAqIGFuZCBjYW4gYmUgb3ZlcnJ1bGVkIHBlciBpbnN0YW5jZS4geW91IGNhbiBhbHNvIGFkZCB0aGUgbmFtZSBvZiB0aGUgZ2VzdHVyZSxcbiAqIGJ1dCB0aGlzIGlzIGFsc28gYWRkZWQgYnkgZGVmYXVsdCAoYW5kIHNldCB0byB0cnVlKS5cbiAqXG4gKiBAcGFyYW0gICB7RnVuY3Rpb259ICBoYW5kbGVyXG4gKiB0aGlzIGhhbmRsZXMgdGhlIGdlc3R1cmUgZGV0ZWN0aW9uIG9mIHlvdXIgY3VzdG9tIGdlc3R1cmUgYW5kIHJlY2VpdmVzIHRoZVxuICogZm9sbG93aW5nIGFyZ3VtZW50czpcbiAqXG4gKiAgICAgIEBwYXJhbSAge09iamVjdH0gICAgZXZlbnREYXRhXG4gKiAgICAgIGV2ZW50IGRhdGEgY29udGFpbmluZyB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gKiAgICAgICAgICB0aW1lU3RhbXAgICB7TnVtYmVyfSAgICAgICAgdGltZSB0aGUgZXZlbnQgb2NjdXJyZWRcbiAqICAgICAgICAgIHRhcmdldCAgICAgIHtIVE1MRWxlbWVudH0gICB0YXJnZXQgZWxlbWVudFxuICogICAgICAgICAgdG91Y2hlcyAgICAge0FycmF5fSAgICAgICAgIHRvdWNoZXMgKGZpbmdlcnMsIHBvaW50ZXJzLCBtb3VzZSkgb24gdGhlIHNjcmVlblxuICogICAgICAgICAgcG9pbnRlclR5cGUge1N0cmluZ30gICAgICAgIGtpbmQgb2YgcG9pbnRlciB0aGF0IHdhcyB1c2VkLiBtYXRjaGVzIEhhbW1lci5QT0lOVEVSX01PVVNFfFRPVUNIXG4gKiAgICAgICAgICBjZW50ZXIgICAgICB7T2JqZWN0fSAgICAgICAgY2VudGVyIHBvc2l0aW9uIG9mIHRoZSB0b3VjaGVzLiBjb250YWlucyBwYWdlWCBhbmQgcGFnZVlcbiAqICAgICAgICAgIGRlbHRhVGltZSAgIHtOdW1iZXJ9ICAgICAgICB0aGUgdG90YWwgdGltZSBvZiB0aGUgdG91Y2hlcyBpbiB0aGUgc2NyZWVuXG4gKiAgICAgICAgICBkZWx0YVggICAgICB7TnVtYmVyfSAgICAgICAgdGhlIGRlbHRhIG9uIHggYXhpcyB3ZSBoYXZlZCBtb3ZlZFxuICogICAgICAgICAgZGVsdGFZICAgICAge051bWJlcn0gICAgICAgIHRoZSBkZWx0YSBvbiB5IGF4aXMgd2UgaGF2ZWQgbW92ZWRcbiAqICAgICAgICAgIHZlbG9jaXR5WCAgIHtOdW1iZXJ9ICAgICAgICB0aGUgdmVsb2NpdHkgb24gdGhlIHhcbiAqICAgICAgICAgIHZlbG9jaXR5WSAgIHtOdW1iZXJ9ICAgICAgICB0aGUgdmVsb2NpdHkgb24geVxuICogICAgICAgICAgYW5nbGUgICAgICAge051bWJlcn0gICAgICAgIHRoZSBhbmdsZSB3ZSBhcmUgbW92aW5nXG4gKiAgICAgICAgICBkaXJlY3Rpb24gICB7U3RyaW5nfSAgICAgICAgdGhlIGRpcmVjdGlvbiB3ZSBhcmUgbW92aW5nLiBtYXRjaGVzIEhhbW1lci5ESVJFQ1RJT05fVVB8RE9XTnxMRUZUfFJJR0hUXG4gKiAgICAgICAgICBkaXN0YW5jZSAgICB7TnVtYmVyfSAgICAgICAgdGhlIGRpc3RhbmNlIHdlIGhhdmVkIG1vdmVkXG4gKiAgICAgICAgICBzY2FsZSAgICAgICB7TnVtYmVyfSAgICAgICAgc2NhbGluZyBvZiB0aGUgdG91Y2hlcywgbmVlZHMgMiB0b3VjaGVzXG4gKiAgICAgICAgICByb3RhdGlvbiAgICB7TnVtYmVyfSAgICAgICAgcm90YXRpb24gb2YgdGhlIHRvdWNoZXMsIG5lZWRzIDIgdG91Y2hlcyAqXG4gKiAgICAgICAgICBldmVudFR5cGUgICB7U3RyaW5nfSAgICAgICAgbWF0Y2hlcyBIYW1tZXIuRVZFTlRfU1RBUlR8TU9WRXxFTkRcbiAqICAgICAgICAgIHNyY0V2ZW50ICAgIHtPYmplY3R9ICAgICAgICB0aGUgc291cmNlIGV2ZW50LCBsaWtlIFRvdWNoU3RhcnQgb3IgTW91c2VEb3duICpcbiAqICAgICAgICAgIHN0YXJ0RXZlbnQgIHtPYmplY3R9ICAgICAgICBjb250YWlucyB0aGUgc2FtZSBwcm9wZXJ0aWVzIGFzIGFib3ZlLFxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1dCBmcm9tIHRoZSBmaXJzdCB0b3VjaC4gdGhpcyBpcyB1c2VkIHRvIGNhbGN1bGF0ZVxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc3RhbmNlcywgZGVsdGFUaW1lLCBzY2FsaW5nIGV0Y1xuICpcbiAqICAgICAgQHBhcmFtICB7SGFtbWVyLkluc3RhbmNlfSAgICBpbnN0XG4gKiAgICAgIHRoZSBpbnN0YW5jZSB3ZSBhcmUgZG9pbmcgdGhlIGRldGVjdGlvbiBmb3IuIHlvdSBjYW4gZ2V0IHRoZSBvcHRpb25zIGZyb21cbiAqICAgICAgdGhlIGluc3Qub3B0aW9ucyBvYmplY3QgYW5kIHRyaWdnZXIgdGhlIGdlc3R1cmUgZXZlbnQgYnkgY2FsbGluZyBpbnN0LnRyaWdnZXJcbiAqXG4gKlxuICogSGFuZGxlIGdlc3R1cmVzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogaW5zaWRlIHRoZSBoYW5kbGVyIHlvdSBjYW4gZ2V0L3NldCBIYW1tZXIuZGV0ZWN0aW9uLmN1cnJlbnQuIFRoaXMgaXMgdGhlIGN1cnJlbnRcbiAqIGRldGVjdGlvbiBzZXNzaW9uLiBJdCBoYXMgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzXG4gKiAgICAgIEBwYXJhbSAge1N0cmluZ30gICAgbmFtZVxuICogICAgICBjb250YWlucyB0aGUgbmFtZSBvZiB0aGUgZ2VzdHVyZSB3ZSBoYXZlIGRldGVjdGVkLiBpdCBoYXMgbm90IGEgcmVhbCBmdW5jdGlvbixcbiAqICAgICAgb25seSB0byBjaGVjayBpbiBvdGhlciBnZXN0dXJlcyBpZiBzb21ldGhpbmcgaXMgZGV0ZWN0ZWQuXG4gKiAgICAgIGxpa2UgaW4gdGhlIGRyYWcgZ2VzdHVyZSB3ZSBzZXQgaXQgdG8gJ2RyYWcnIGFuZCBpbiB0aGUgc3dpcGUgZ2VzdHVyZSB3ZSBjYW5cbiAqICAgICAgY2hlY2sgaWYgdGhlIGN1cnJlbnQgZ2VzdHVyZSBpcyAnZHJhZycgYnkgYWNjZXNzaW5nIEhhbW1lci5kZXRlY3Rpb24uY3VycmVudC5uYW1lXG4gKlxuICogICAgICBAcmVhZG9ubHlcbiAqICAgICAgQHBhcmFtICB7SGFtbWVyLkluc3RhbmNlfSAgICBpbnN0XG4gKiAgICAgIHRoZSBpbnN0YW5jZSB3ZSBkbyB0aGUgZGV0ZWN0aW9uIGZvclxuICpcbiAqICAgICAgQHJlYWRvbmx5XG4gKiAgICAgIEBwYXJhbSAge09iamVjdH0gICAgc3RhcnRFdmVudFxuICogICAgICBjb250YWlucyB0aGUgcHJvcGVydGllcyBvZiB0aGUgZmlyc3QgZ2VzdHVyZSBkZXRlY3Rpb24gaW4gdGhpcyBzZXNzaW9uLlxuICogICAgICBVc2VkIGZvciBjYWxjdWxhdGlvbnMgYWJvdXQgdGltaW5nLCBkaXN0YW5jZSwgZXRjLlxuICpcbiAqICAgICAgQHJlYWRvbmx5XG4gKiAgICAgIEBwYXJhbSAge09iamVjdH0gICAgbGFzdEV2ZW50XG4gKiAgICAgIGNvbnRhaW5zIGFsbCB0aGUgcHJvcGVydGllcyBvZiB0aGUgbGFzdCBnZXN0dXJlIGRldGVjdCBpbiB0aGlzIHNlc3Npb24uXG4gKlxuICogYWZ0ZXIgdGhlIGdlc3R1cmUgZGV0ZWN0aW9uIHNlc3Npb24gaGFzIGJlZW4gY29tcGxldGVkICh1c2VyIGhhcyByZWxlYXNlZCB0aGUgc2NyZWVuKVxuICogdGhlIEhhbW1lci5kZXRlY3Rpb24uY3VycmVudCBvYmplY3QgaXMgY29waWVkIGludG8gSGFtbWVyLmRldGVjdGlvbi5wcmV2aW91cyxcbiAqIHRoaXMgaXMgdXNlZnVsbCBmb3IgZ2VzdHVyZXMgbGlrZSBkb3VibGV0YXAsIHdoZXJlIHlvdSBuZWVkIHRvIGtub3cgaWYgdGhlXG4gKiBwcmV2aW91cyBnZXN0dXJlIHdhcyBhIHRhcFxuICpcbiAqIG9wdGlvbnMgdGhhdCBoYXZlIGJlZW4gc2V0IGJ5IHRoZSBpbnN0YW5jZSBjYW4gYmUgcmVjZWl2ZWQgYnkgY2FsbGluZyBpbnN0Lm9wdGlvbnNcbiAqXG4gKiBZb3UgY2FuIHRyaWdnZXIgYSBnZXN0dXJlIGV2ZW50IGJ5IGNhbGxpbmcgaW5zdC50cmlnZ2VyKFwibXlnZXN0dXJlXCIsIGV2ZW50KS5cbiAqIFRoZSBmaXJzdCBwYXJhbSBpcyB0aGUgbmFtZSBvZiB5b3VyIGdlc3R1cmUsIHRoZSBzZWNvbmQgdGhlIGV2ZW50IGFyZ3VtZW50XG4gKlxuICpcbiAqIFJlZ2lzdGVyIGdlc3R1cmVzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogV2hlbiBhbiBnZXN0dXJlIGlzIGFkZGVkIHRvIHRoZSBIYW1tZXIuZ2VzdHVyZXMgb2JqZWN0LCBpdCBpcyBhdXRvIHJlZ2lzdGVyZWRcbiAqIGF0IHRoZSBzZXR1cCBvZiB0aGUgZmlyc3QgSGFtbWVyIGluc3RhbmNlLiBZb3UgY2FuIGFsc28gY2FsbCBIYW1tZXIuZGV0ZWN0aW9uLnJlZ2lzdGVyXG4gKiBtYW51YWxseSBhbmQgcGFzcyB5b3VyIGdlc3R1cmUgb2JqZWN0IGFzIGEgcGFyYW1cbiAqXG4gKi9cblxuLyoqXG4gKiBIb2xkXG4gKiBUb3VjaCBzdGF5cyBhdCB0aGUgc2FtZSBwbGFjZSBmb3IgeCB0aW1lXG4gKiBAZXZlbnRzICBob2xkXG4gKi9cbkhhbW1lci5nZXN0dXJlcy5Ib2xkID0ge1xuICAgIG5hbWU6ICdob2xkJyxcbiAgICBpbmRleDogMTAsXG4gICAgZGVmYXVsdHM6IHtcbiAgICAgICAgaG9sZF90aW1lb3V0XHQ6IDUwMCxcbiAgICAgICAgaG9sZF90aHJlc2hvbGRcdDogMVxuICAgIH0sXG4gICAgdGltZXI6IG51bGwsXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gaG9sZEdlc3R1cmUoZXYsIGluc3QpIHtcbiAgICAgICAgc3dpdGNoKGV2LmV2ZW50VHlwZSkge1xuICAgICAgICAgICAgY2FzZSBIYW1tZXIuRVZFTlRfU1RBUlQ6XG4gICAgICAgICAgICAgICAgLy8gY2xlYXIgYW55IHJ1bm5pbmcgdGltZXJzXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZXIpO1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHRoZSBnZXN0dXJlIHNvIHdlIGNhbiBjaGVjayBpbiB0aGUgdGltZW91dCBpZiBpdCBzdGlsbCBpc1xuICAgICAgICAgICAgICAgIEhhbW1lci5kZXRlY3Rpb24uY3VycmVudC5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHRpbWVyIGFuZCBpZiBhZnRlciB0aGUgdGltZW91dCBpdCBzdGlsbCBpcyBob2xkLFxuICAgICAgICAgICAgICAgIC8vIHdlIHRyaWdnZXIgdGhlIGhvbGQgZXZlbnRcbiAgICAgICAgICAgICAgICB0aGlzLnRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYoSGFtbWVyLmRldGVjdGlvbi5jdXJyZW50Lm5hbWUgPT0gJ2hvbGQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0LnRyaWdnZXIoJ2hvbGQnLCBldik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LCBpbnN0Lm9wdGlvbnMuaG9sZF90aW1lb3V0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgLy8gd2hlbiB5b3UgbW92ZSBvciBlbmQgd2UgY2xlYXIgdGhlIHRpbWVyXG4gICAgICAgICAgICBjYXNlIEhhbW1lci5FVkVOVF9NT1ZFOlxuICAgICAgICAgICAgICAgIGlmKGV2LmRpc3RhbmNlID4gaW5zdC5vcHRpb25zLmhvbGRfdGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgSGFtbWVyLkVWRU5UX0VORDpcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lcik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbi8qKlxuICogVGFwL0RvdWJsZVRhcFxuICogUXVpY2sgdG91Y2ggYXQgYSBwbGFjZSBvciBkb3VibGUgYXQgdGhlIHNhbWUgcGxhY2VcbiAqIEBldmVudHMgIHRhcCwgZG91YmxldGFwXG4gKi9cbkhhbW1lci5nZXN0dXJlcy5UYXAgPSB7XG4gICAgbmFtZTogJ3RhcCcsXG4gICAgaW5kZXg6IDEwMCxcbiAgICBkZWZhdWx0czoge1xuICAgICAgICB0YXBfbWF4X3RvdWNodGltZVx0OiAyNTAsXG4gICAgICAgIHRhcF9tYXhfZGlzdGFuY2VcdDogMTAsXG5cdFx0dGFwX2Fsd2F5c1x0XHRcdDogdHJ1ZSxcbiAgICAgICAgZG91YmxldGFwX2Rpc3RhbmNlXHQ6IDIwLFxuICAgICAgICBkb3VibGV0YXBfaW50ZXJ2YWxcdDogMzAwXG4gICAgfSxcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiB0YXBHZXN0dXJlKGV2LCBpbnN0KSB7XG4gICAgICAgIGlmKGV2LmV2ZW50VHlwZSA9PSBIYW1tZXIuRVZFTlRfRU5EKSB7XG4gICAgICAgICAgICAvLyBwcmV2aW91cyBnZXN0dXJlLCBmb3IgdGhlIGRvdWJsZSB0YXAgc2luY2UgdGhlc2UgYXJlIHR3byBkaWZmZXJlbnQgZ2VzdHVyZSBkZXRlY3Rpb25zXG4gICAgICAgICAgICB2YXIgcHJldiA9IEhhbW1lci5kZXRlY3Rpb24ucHJldmlvdXMsXG5cdFx0XHRcdGRpZF9kb3VibGV0YXAgPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gd2hlbiB0aGUgdG91Y2h0aW1lIGlzIGhpZ2hlciB0aGVuIHRoZSBtYXggdG91Y2ggdGltZVxuICAgICAgICAgICAgLy8gb3Igd2hlbiB0aGUgbW92aW5nIGRpc3RhbmNlIGlzIHRvbyBtdWNoXG4gICAgICAgICAgICBpZihldi5kZWx0YVRpbWUgPiBpbnN0Lm9wdGlvbnMudGFwX21heF90b3VjaHRpbWUgfHxcbiAgICAgICAgICAgICAgICBldi5kaXN0YW5jZSA+IGluc3Qub3B0aW9ucy50YXBfbWF4X2Rpc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBkb3VibGUgdGFwXG4gICAgICAgICAgICBpZihwcmV2ICYmIHByZXYubmFtZSA9PSAndGFwJyAmJlxuICAgICAgICAgICAgICAgIChldi50aW1lU3RhbXAgLSBwcmV2Lmxhc3RFdmVudC50aW1lU3RhbXApIDwgaW5zdC5vcHRpb25zLmRvdWJsZXRhcF9pbnRlcnZhbCAmJlxuICAgICAgICAgICAgICAgIGV2LmRpc3RhbmNlIDwgaW5zdC5vcHRpb25zLmRvdWJsZXRhcF9kaXN0YW5jZSkge1xuXHRcdFx0XHRpbnN0LnRyaWdnZXIoJ2RvdWJsZXRhcCcsIGV2KTtcblx0XHRcdFx0ZGlkX2RvdWJsZXRhcCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cblx0XHRcdC8vIGRvIGEgc2luZ2xlIHRhcFxuXHRcdFx0aWYoIWRpZF9kb3VibGV0YXAgfHwgaW5zdC5vcHRpb25zLnRhcF9hbHdheXMpIHtcblx0XHRcdFx0SGFtbWVyLmRldGVjdGlvbi5jdXJyZW50Lm5hbWUgPSAndGFwJztcblx0XHRcdFx0aW5zdC50cmlnZ2VyKEhhbW1lci5kZXRlY3Rpb24uY3VycmVudC5uYW1lLCBldik7XG5cdFx0XHR9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbi8qKlxuICogU3dpcGVcbiAqIHRyaWdnZXJzIHN3aXBlIGV2ZW50cyB3aGVuIHRoZSBlbmQgdmVsb2NpdHkgaXMgYWJvdmUgdGhlIHRocmVzaG9sZFxuICogQGV2ZW50cyAgc3dpcGUsIHN3aXBlbGVmdCwgc3dpcGVyaWdodCwgc3dpcGV1cCwgc3dpcGVkb3duXG4gKi9cbkhhbW1lci5nZXN0dXJlcy5Td2lwZSA9IHtcbiAgICBuYW1lOiAnc3dpcGUnLFxuICAgIGluZGV4OiA0MCxcbiAgICBkZWZhdWx0czoge1xuICAgICAgICAvLyBzZXQgMCBmb3IgdW5saW1pdGVkLCBidXQgdGhpcyBjYW4gY29uZmxpY3Qgd2l0aCB0cmFuc2Zvcm1cbiAgICAgICAgc3dpcGVfbWF4X3RvdWNoZXMgIDogMSxcbiAgICAgICAgc3dpcGVfdmVsb2NpdHkgICAgIDogMC43XG4gICAgfSxcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBzd2lwZUdlc3R1cmUoZXYsIGluc3QpIHtcbiAgICAgICAgaWYoZXYuZXZlbnRUeXBlID09IEhhbW1lci5FVkVOVF9FTkQpIHtcbiAgICAgICAgICAgIC8vIG1heCB0b3VjaGVzXG4gICAgICAgICAgICBpZihpbnN0Lm9wdGlvbnMuc3dpcGVfbWF4X3RvdWNoZXMgPiAwICYmXG4gICAgICAgICAgICAgICAgZXYudG91Y2hlcy5sZW5ndGggPiBpbnN0Lm9wdGlvbnMuc3dpcGVfbWF4X3RvdWNoZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHdoZW4gdGhlIGRpc3RhbmNlIHdlIG1vdmVkIGlzIHRvbyBzbWFsbCB3ZSBza2lwIHRoaXMgZ2VzdHVyZVxuICAgICAgICAgICAgLy8gb3Igd2UgY2FuIGJlIGFscmVhZHkgaW4gZHJhZ2dpbmdcbiAgICAgICAgICAgIGlmKGV2LnZlbG9jaXR5WCA+IGluc3Qub3B0aW9ucy5zd2lwZV92ZWxvY2l0eSB8fFxuICAgICAgICAgICAgICAgIGV2LnZlbG9jaXR5WSA+IGluc3Qub3B0aW9ucy5zd2lwZV92ZWxvY2l0eSkge1xuICAgICAgICAgICAgICAgIC8vIHRyaWdnZXIgc3dpcGUgZXZlbnRzXG4gICAgICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSwgZXYpO1xuICAgICAgICAgICAgICAgIGluc3QudHJpZ2dlcih0aGlzLm5hbWUgKyBldi5kaXJlY3Rpb24sIGV2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxuLyoqXG4gKiBEcmFnXG4gKiBNb3ZlIHdpdGggeCBmaW5nZXJzIChkZWZhdWx0IDEpIGFyb3VuZCBvbiB0aGUgcGFnZS4gQmxvY2tpbmcgdGhlIHNjcm9sbGluZyB3aGVuXG4gKiBtb3ZpbmcgbGVmdCBhbmQgcmlnaHQgaXMgYSBnb29kIHByYWN0aWNlLiBXaGVuIGFsbCB0aGUgZHJhZyBldmVudHMgYXJlIGJsb2NraW5nXG4gKiB5b3UgZGlzYWJsZSBzY3JvbGxpbmcgb24gdGhhdCBhcmVhLlxuICogQGV2ZW50cyAgZHJhZywgZHJhcGxlZnQsIGRyYWdyaWdodCwgZHJhZ3VwLCBkcmFnZG93blxuICovXG5IYW1tZXIuZ2VzdHVyZXMuRHJhZyA9IHtcbiAgICBuYW1lOiAnZHJhZycsXG4gICAgaW5kZXg6IDUwLFxuICAgIGRlZmF1bHRzOiB7XG4gICAgICAgIGRyYWdfbWluX2Rpc3RhbmNlIDogMTAsXG4gICAgICAgIC8vIHNldCAwIGZvciB1bmxpbWl0ZWQsIGJ1dCB0aGlzIGNhbiBjb25mbGljdCB3aXRoIHRyYW5zZm9ybVxuICAgICAgICBkcmFnX21heF90b3VjaGVzICA6IDEsXG4gICAgICAgIC8vIHByZXZlbnQgZGVmYXVsdCBicm93c2VyIGJlaGF2aW9yIHdoZW4gZHJhZ2dpbmcgb2NjdXJzXG4gICAgICAgIC8vIGJlIGNhcmVmdWwgd2l0aCBpdCwgaXQgbWFrZXMgdGhlIGVsZW1lbnQgYSBibG9ja2luZyBlbGVtZW50XG4gICAgICAgIC8vIHdoZW4geW91IGFyZSB1c2luZyB0aGUgZHJhZyBnZXN0dXJlLCBpdCBpcyBhIGdvb2QgcHJhY3RpY2UgdG8gc2V0IHRoaXMgdHJ1ZVxuICAgICAgICBkcmFnX2Jsb2NrX2hvcml6b250YWwgICA6IGZhbHNlLFxuICAgICAgICBkcmFnX2Jsb2NrX3ZlcnRpY2FsICAgICA6IGZhbHNlLFxuICAgICAgICAvLyBkcmFnX2xvY2tfdG9fYXhpcyBrZWVwcyB0aGUgZHJhZyBnZXN0dXJlIG9uIHRoZSBheGlzIHRoYXQgaXQgc3RhcnRlZCBvbixcbiAgICAgICAgLy8gSXQgZGlzYWxsb3dzIHZlcnRpY2FsIGRpcmVjdGlvbnMgaWYgdGhlIGluaXRpYWwgZGlyZWN0aW9uIHdhcyBob3Jpem9udGFsLCBhbmQgdmljZSB2ZXJzYS5cbiAgICAgICAgZHJhZ19sb2NrX3RvX2F4aXMgICAgICAgOiBmYWxzZSxcbiAgICAgICAgLy8gZHJhZyBsb2NrIG9ubHkga2lja3MgaW4gd2hlbiBkaXN0YW5jZSA+IGRyYWdfbG9ja19taW5fZGlzdGFuY2VcbiAgICAgICAgLy8gVGhpcyB3YXksIGxvY2tpbmcgb2NjdXJzIG9ubHkgd2hlbiB0aGUgZGlzdGFuY2UgaGFzIGJlY29tZSBsYXJnZSBlbm91Z2ggdG8gcmVsaWFibHkgZGV0ZXJtaW5lIHRoZSBkaXJlY3Rpb25cbiAgICAgICAgZHJhZ19sb2NrX21pbl9kaXN0YW5jZSA6IDI1XG4gICAgfSxcbiAgICB0cmlnZ2VyZWQ6IGZhbHNlLFxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIGRyYWdHZXN0dXJlKGV2LCBpbnN0KSB7XG4gICAgICAgIC8vIGN1cnJlbnQgZ2VzdHVyZSBpc250IGRyYWcsIGJ1dCBkcmFnZ2VkIGlzIHRydWVcbiAgICAgICAgLy8gdGhpcyBtZWFucyBhbiBvdGhlciBnZXN0dXJlIGlzIGJ1c3kuIG5vdyBjYWxsIGRyYWdlbmRcbiAgICAgICAgaWYoSGFtbWVyLmRldGVjdGlvbi5jdXJyZW50Lm5hbWUgIT0gdGhpcy5uYW1lICYmIHRoaXMudHJpZ2dlcmVkKSB7XG4gICAgICAgICAgICBpbnN0LnRyaWdnZXIodGhpcy5uYW1lICsnZW5kJywgZXYpO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1heCB0b3VjaGVzXG4gICAgICAgIGlmKGluc3Qub3B0aW9ucy5kcmFnX21heF90b3VjaGVzID4gMCAmJlxuICAgICAgICAgICAgZXYudG91Y2hlcy5sZW5ndGggPiBpbnN0Lm9wdGlvbnMuZHJhZ19tYXhfdG91Y2hlcykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3dpdGNoKGV2LmV2ZW50VHlwZSkge1xuICAgICAgICAgICAgY2FzZSBIYW1tZXIuRVZFTlRfU1RBUlQ6XG4gICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBIYW1tZXIuRVZFTlRfTU9WRTpcbiAgICAgICAgICAgICAgICAvLyB3aGVuIHRoZSBkaXN0YW5jZSB3ZSBtb3ZlZCBpcyB0b28gc21hbGwgd2Ugc2tpcCB0aGlzIGdlc3R1cmVcbiAgICAgICAgICAgICAgICAvLyBvciB3ZSBjYW4gYmUgYWxyZWFkeSBpbiBkcmFnZ2luZ1xuICAgICAgICAgICAgICAgIGlmKGV2LmRpc3RhbmNlIDwgaW5zdC5vcHRpb25zLmRyYWdfbWluX2Rpc3RhbmNlICYmXG4gICAgICAgICAgICAgICAgICAgIEhhbW1lci5kZXRlY3Rpb24uY3VycmVudC5uYW1lICE9IHRoaXMubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gd2UgYXJlIGRyYWdnaW5nIVxuICAgICAgICAgICAgICAgIEhhbW1lci5kZXRlY3Rpb24uY3VycmVudC5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgICAgICAgICAgLy8gbG9jayBkcmFnIHRvIGF4aXM/XG4gICAgICAgICAgICAgICAgaWYoSGFtbWVyLmRldGVjdGlvbi5jdXJyZW50Lmxhc3RFdmVudC5kcmFnX2xvY2tlZF90b19heGlzIHx8IChpbnN0Lm9wdGlvbnMuZHJhZ19sb2NrX3RvX2F4aXMgJiYgaW5zdC5vcHRpb25zLmRyYWdfbG9ja19taW5fZGlzdGFuY2U8PWV2LmRpc3RhbmNlKSkge1xuICAgICAgICAgICAgICAgICAgICBldi5kcmFnX2xvY2tlZF90b19heGlzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGxhc3RfZGlyZWN0aW9uID0gSGFtbWVyLmRldGVjdGlvbi5jdXJyZW50Lmxhc3RFdmVudC5kaXJlY3Rpb247XG4gICAgICAgICAgICAgICAgaWYoZXYuZHJhZ19sb2NrZWRfdG9fYXhpcyAmJiBsYXN0X2RpcmVjdGlvbiAhPT0gZXYuZGlyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGtlZXAgZGlyZWN0aW9uIG9uIHRoZSBheGlzIHRoYXQgdGhlIGRyYWcgZ2VzdHVyZSBzdGFydGVkIG9uXG4gICAgICAgICAgICAgICAgICAgIGlmKEhhbW1lci51dGlscy5pc1ZlcnRpY2FsKGxhc3RfZGlyZWN0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXYuZGlyZWN0aW9uID0gKGV2LmRlbHRhWSA8IDApID8gSGFtbWVyLkRJUkVDVElPTl9VUCA6IEhhbW1lci5ESVJFQ1RJT05fRE9XTjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2LmRpcmVjdGlvbiA9IChldi5kZWx0YVggPCAwKSA/IEhhbW1lci5ESVJFQ1RJT05fTEVGVCA6IEhhbW1lci5ESVJFQ1RJT05fUklHSFQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJzdCB0aW1lLCB0cmlnZ2VyIGRyYWdzdGFydCBldmVudFxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLnRyaWdnZXJlZCkge1xuICAgICAgICAgICAgICAgICAgICBpbnN0LnRyaWdnZXIodGhpcy5uYW1lICsnc3RhcnQnLCBldik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlcmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB0cmlnZ2VyIG5vcm1hbCBldmVudFxuICAgICAgICAgICAgICAgIGluc3QudHJpZ2dlcih0aGlzLm5hbWUsIGV2KTtcblxuICAgICAgICAgICAgICAgIC8vIGRpcmVjdGlvbiBldmVudCwgbGlrZSBkcmFnZG93blxuICAgICAgICAgICAgICAgIGluc3QudHJpZ2dlcih0aGlzLm5hbWUgKyBldi5kaXJlY3Rpb24sIGV2KTtcblxuICAgICAgICAgICAgICAgIC8vIGJsb2NrIHRoZSBicm93c2VyIGV2ZW50c1xuICAgICAgICAgICAgICAgIGlmKCAoaW5zdC5vcHRpb25zLmRyYWdfYmxvY2tfdmVydGljYWwgJiYgSGFtbWVyLnV0aWxzLmlzVmVydGljYWwoZXYuZGlyZWN0aW9uKSkgfHxcbiAgICAgICAgICAgICAgICAgICAgKGluc3Qub3B0aW9ucy5kcmFnX2Jsb2NrX2hvcml6b250YWwgJiYgIUhhbW1lci51dGlscy5pc1ZlcnRpY2FsKGV2LmRpcmVjdGlvbikpKSB7XG4gICAgICAgICAgICAgICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIEhhbW1lci5FVkVOVF9FTkQ6XG4gICAgICAgICAgICAgICAgLy8gdHJpZ2dlciBkcmFnZW5kXG4gICAgICAgICAgICAgICAgaWYodGhpcy50cmlnZ2VyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSArJ2VuZCcsIGV2KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG4vKipcbiAqIFRyYW5zZm9ybVxuICogVXNlciB3YW50IHRvIHNjYWxlIG9yIHJvdGF0ZSB3aXRoIDIgZmluZ2Vyc1xuICogQGV2ZW50cyAgdHJhbnNmb3JtLCBwaW5jaCwgcGluY2hpbiwgcGluY2hvdXQsIHJvdGF0ZVxuICovXG5IYW1tZXIuZ2VzdHVyZXMuVHJhbnNmb3JtID0ge1xuICAgIG5hbWU6ICd0cmFuc2Zvcm0nLFxuICAgIGluZGV4OiA0NSxcbiAgICBkZWZhdWx0czoge1xuICAgICAgICAvLyBmYWN0b3IsIG5vIHNjYWxlIGlzIDEsIHpvb21pbiBpcyB0byAwIGFuZCB6b29tb3V0IHVudGlsIGhpZ2hlciB0aGVuIDFcbiAgICAgICAgdHJhbnNmb3JtX21pbl9zY2FsZSAgICAgOiAwLjAxLFxuICAgICAgICAvLyByb3RhdGlvbiBpbiBkZWdyZWVzXG4gICAgICAgIHRyYW5zZm9ybV9taW5fcm90YXRpb24gIDogMSxcbiAgICAgICAgLy8gcHJldmVudCBkZWZhdWx0IGJyb3dzZXIgYmVoYXZpb3Igd2hlbiB0d28gdG91Y2hlcyBhcmUgb24gdGhlIHNjcmVlblxuICAgICAgICAvLyBidXQgaXQgbWFrZXMgdGhlIGVsZW1lbnQgYSBibG9ja2luZyBlbGVtZW50XG4gICAgICAgIC8vIHdoZW4geW91IGFyZSB1c2luZyB0aGUgdHJhbnNmb3JtIGdlc3R1cmUsIGl0IGlzIGEgZ29vZCBwcmFjdGljZSB0byBzZXQgdGhpcyB0cnVlXG4gICAgICAgIHRyYW5zZm9ybV9hbHdheXNfYmxvY2sgIDogZmFsc2VcbiAgICB9LFxuICAgIHRyaWdnZXJlZDogZmFsc2UsXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gdHJhbnNmb3JtR2VzdHVyZShldiwgaW5zdCkge1xuICAgICAgICAvLyBjdXJyZW50IGdlc3R1cmUgaXNudCBkcmFnLCBidXQgZHJhZ2dlZCBpcyB0cnVlXG4gICAgICAgIC8vIHRoaXMgbWVhbnMgYW4gb3RoZXIgZ2VzdHVyZSBpcyBidXN5LiBub3cgY2FsbCBkcmFnZW5kXG4gICAgICAgIGlmKEhhbW1lci5kZXRlY3Rpb24uY3VycmVudC5uYW1lICE9IHRoaXMubmFtZSAmJiB0aGlzLnRyaWdnZXJlZCkge1xuICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSArJ2VuZCcsIGV2KTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcmVkID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhdGxlYXN0IG11bHRpdG91Y2hcbiAgICAgICAgaWYoZXYudG91Y2hlcy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcmV2ZW50IGRlZmF1bHQgd2hlbiB0d28gZmluZ2VycyBhcmUgb24gdGhlIHNjcmVlblxuICAgICAgICBpZihpbnN0Lm9wdGlvbnMudHJhbnNmb3JtX2Fsd2F5c19ibG9jaykge1xuICAgICAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaChldi5ldmVudFR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgSGFtbWVyLkVWRU5UX1NUQVJUOlxuICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlcmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgSGFtbWVyLkVWRU5UX01PVkU6XG4gICAgICAgICAgICAgICAgdmFyIHNjYWxlX3RocmVzaG9sZCA9IE1hdGguYWJzKDEtZXYuc2NhbGUpO1xuICAgICAgICAgICAgICAgIHZhciByb3RhdGlvbl90aHJlc2hvbGQgPSBNYXRoLmFicyhldi5yb3RhdGlvbik7XG5cbiAgICAgICAgICAgICAgICAvLyB3aGVuIHRoZSBkaXN0YW5jZSB3ZSBtb3ZlZCBpcyB0b28gc21hbGwgd2Ugc2tpcCB0aGlzIGdlc3R1cmVcbiAgICAgICAgICAgICAgICAvLyBvciB3ZSBjYW4gYmUgYWxyZWFkeSBpbiBkcmFnZ2luZ1xuICAgICAgICAgICAgICAgIGlmKHNjYWxlX3RocmVzaG9sZCA8IGluc3Qub3B0aW9ucy50cmFuc2Zvcm1fbWluX3NjYWxlICYmXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uX3RocmVzaG9sZCA8IGluc3Qub3B0aW9ucy50cmFuc2Zvcm1fbWluX3JvdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB3ZSBhcmUgdHJhbnNmb3JtaW5nIVxuICAgICAgICAgICAgICAgIEhhbW1lci5kZXRlY3Rpb24uY3VycmVudC5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgICAgICAgICAgLy8gZmlyc3QgdGltZSwgdHJpZ2dlciBkcmFnc3RhcnQgZXZlbnRcbiAgICAgICAgICAgICAgICBpZighdGhpcy50cmlnZ2VyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSArJ3N0YXJ0JywgZXYpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSwgZXYpOyAvLyBiYXNpYyB0cmFuc2Zvcm0gZXZlbnRcblxuICAgICAgICAgICAgICAgIC8vIHRyaWdnZXIgcm90YXRlIGV2ZW50XG4gICAgICAgICAgICAgICAgaWYocm90YXRpb25fdGhyZXNob2xkID4gaW5zdC5vcHRpb25zLnRyYW5zZm9ybV9taW5fcm90YXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdC50cmlnZ2VyKCdyb3RhdGUnLCBldik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdHJpZ2dlciBwaW5jaCBldmVudFxuICAgICAgICAgICAgICAgIGlmKHNjYWxlX3RocmVzaG9sZCA+IGluc3Qub3B0aW9ucy50cmFuc2Zvcm1fbWluX3NjYWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIGluc3QudHJpZ2dlcigncGluY2gnLCBldik7XG4gICAgICAgICAgICAgICAgICAgIGluc3QudHJpZ2dlcigncGluY2gnKyAoKGV2LnNjYWxlIDwgMSkgPyAnaW4nIDogJ291dCcpLCBldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIEhhbW1lci5FVkVOVF9FTkQ6XG4gICAgICAgICAgICAgICAgLy8gdHJpZ2dlciBkcmFnZW5kXG4gICAgICAgICAgICAgICAgaWYodGhpcy50cmlnZ2VyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSArJ2VuZCcsIGV2KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG4vKipcbiAqIFRvdWNoXG4gKiBDYWxsZWQgYXMgZmlyc3QsIHRlbGxzIHRoZSB1c2VyIGhhcyB0b3VjaGVkIHRoZSBzY3JlZW5cbiAqIEBldmVudHMgIHRvdWNoXG4gKi9cbkhhbW1lci5nZXN0dXJlcy5Ub3VjaCA9IHtcbiAgICBuYW1lOiAndG91Y2gnLFxuICAgIGluZGV4OiAtSW5maW5pdHksXG4gICAgZGVmYXVsdHM6IHtcbiAgICAgICAgLy8gY2FsbCBwcmV2ZW50RGVmYXVsdCBhdCB0b3VjaHN0YXJ0LCBhbmQgbWFrZXMgdGhlIGVsZW1lbnQgYmxvY2tpbmcgYnlcbiAgICAgICAgLy8gZGlzYWJsaW5nIHRoZSBzY3JvbGxpbmcgb2YgdGhlIHBhZ2UsIGJ1dCBpdCBpbXByb3ZlcyBnZXN0dXJlcyBsaWtlXG4gICAgICAgIC8vIHRyYW5zZm9ybWluZyBhbmQgZHJhZ2dpbmcuXG4gICAgICAgIC8vIGJlIGNhcmVmdWwgd2l0aCB1c2luZyB0aGlzLCBpdCBjYW4gYmUgdmVyeSBhbm5veWluZyBmb3IgdXNlcnMgdG8gYmUgc3R1Y2tcbiAgICAgICAgLy8gb24gdGhlIHBhZ2VcbiAgICAgICAgcHJldmVudF9kZWZhdWx0OiBmYWxzZSxcblxuICAgICAgICAvLyBkaXNhYmxlIG1vdXNlIGV2ZW50cywgc28gb25seSB0b3VjaCAob3IgcGVuISkgaW5wdXQgdHJpZ2dlcnMgZXZlbnRzXG4gICAgICAgIHByZXZlbnRfbW91c2VldmVudHM6IGZhbHNlXG4gICAgfSxcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiB0b3VjaEdlc3R1cmUoZXYsIGluc3QpIHtcbiAgICAgICAgaWYoaW5zdC5vcHRpb25zLnByZXZlbnRfbW91c2VldmVudHMgJiYgZXYucG9pbnRlclR5cGUgPT0gSGFtbWVyLlBPSU5URVJfTU9VU0UpIHtcbiAgICAgICAgICAgIGV2LnN0b3BEZXRlY3QoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGluc3Qub3B0aW9ucy5wcmV2ZW50X2RlZmF1bHQpIHtcbiAgICAgICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihldi5ldmVudFR5cGUgPT0gIEhhbW1lci5FVkVOVF9TVEFSVCkge1xuICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSwgZXYpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG4vKipcbiAqIFJlbGVhc2VcbiAqIENhbGxlZCBhcyBsYXN0LCB0ZWxscyB0aGUgdXNlciBoYXMgcmVsZWFzZWQgdGhlIHNjcmVlblxuICogQGV2ZW50cyAgcmVsZWFzZVxuICovXG5IYW1tZXIuZ2VzdHVyZXMuUmVsZWFzZSA9IHtcbiAgICBuYW1lOiAncmVsZWFzZScsXG4gICAgaW5kZXg6IEluZmluaXR5LFxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIHJlbGVhc2VHZXN0dXJlKGV2LCBpbnN0KSB7XG4gICAgICAgIGlmKGV2LmV2ZW50VHlwZSA9PSAgSGFtbWVyLkVWRU5UX0VORCkge1xuICAgICAgICAgICAgaW5zdC50cmlnZ2VyKHRoaXMubmFtZSwgZXYpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLy8gbm9kZSBleHBvcnRcbmlmKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gJ29iamVjdCcpe1xuICAgIG1vZHVsZS5leHBvcnRzID0gSGFtbWVyO1xufVxuLy8ganVzdCB3aW5kb3cgZXhwb3J0XG5lbHNlIHtcbiAgICB3aW5kb3cuSGFtbWVyID0gSGFtbWVyO1xuXG4gICAgLy8gcmVxdWlyZUpTIG1vZHVsZSBkZWZpbml0aW9uXG4gICAgaWYodHlwZW9mIHdpbmRvdy5kZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgd2luZG93LmRlZmluZS5hbWQpIHtcbiAgICAgICAgd2luZG93LmRlZmluZSgnaGFtbWVyJywgW10sIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhhbW1lcjtcbiAgICAgICAgfSk7XG4gICAgfVxufVxufSkodGhpcyk7XG4iLCIvKiAtKi0gTW9kZTogSmF2YTsgdGFiLXdpZHRoOiAyOyBpbmRlbnQtdGFicy1tb2RlOiBuaWw7IGMtYmFzaWMtb2Zmc2V0OiAyIC0qLSAvXG4vKiB2aW06IHNldCBzaGlmdHdpZHRoPTIgdGFic3RvcD0yIGF1dG9pbmRlbnQgY2luZGVudCBleHBhbmR0YWI6ICovXG5cbi8vJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFRoaXMgZmlsZSBkZWZpbmVzIGFuIGFzeW5jaHJvbm91cyB2ZXJzaW9uIG9mIHRoZSBsb2NhbFN0b3JhZ2UgQVBJLCBiYWNrZWQgYnlcbiAqIGFuIEluZGV4ZWREQiBkYXRhYmFzZS4gIEl0IGNyZWF0ZXMgYSBnbG9iYWwgYXN5bmNTdG9yYWdlIG9iamVjdCB0aGF0IGhhc1xuICogbWV0aG9kcyBsaWtlIHRoZSBsb2NhbFN0b3JhZ2Ugb2JqZWN0LlxuICpcbiAqIFRvIHN0b3JlIGEgdmFsdWUgdXNlIHNldEl0ZW06XG4gKlxuICogICBhc3luY1N0b3JhZ2Uuc2V0SXRlbSgna2V5JywgJ3ZhbHVlJyk7XG4gKlxuICogSWYgeW91IHdhbnQgY29uZmlybWF0aW9uIHRoYXQgdGhlIHZhbHVlIGhhcyBiZWVuIHN0b3JlZCwgcGFzcyBhIGNhbGxiYWNrXG4gKiBmdW5jdGlvbiBhcyB0aGUgdGhpcmQgYXJndW1lbnQ6XG4gKlxuICogIGFzeW5jU3RvcmFnZS5zZXRJdGVtKCdrZXknLCAnbmV3dmFsdWUnLCBmdW5jdGlvbigpIHtcbiAqICAgIGNvbnNvbGUubG9nKCduZXcgdmFsdWUgc3RvcmVkJyk7XG4gKiAgfSk7XG4gKlxuICogVG8gcmVhZCBhIHZhbHVlLCBjYWxsIGdldEl0ZW0oKSwgYnV0IG5vdGUgdGhhdCB5b3UgbXVzdCBzdXBwbHkgYSBjYWxsYmFja1xuICogZnVuY3Rpb24gdGhhdCB0aGUgdmFsdWUgd2lsbCBiZSBwYXNzZWQgdG8gYXN5bmNocm9ub3VzbHk6XG4gKlxuICogIGFzeW5jU3RvcmFnZS5nZXRJdGVtKCdrZXknLCBmdW5jdGlvbih2YWx1ZSkge1xuICogICAgY29uc29sZS5sb2coJ1RoZSB2YWx1ZSBvZiBrZXkgaXM6JywgdmFsdWUpO1xuICogIH0pO1xuICpcbiAqIE5vdGUgdGhhdCB1bmxpa2UgbG9jYWxTdG9yYWdlLCBhc3luY1N0b3JhZ2UgZG9lcyBub3QgYWxsb3cgeW91IHRvIHN0b3JlIGFuZFxuICogcmV0cmlldmUgdmFsdWVzIGJ5IHNldHRpbmcgYW5kIHF1ZXJ5aW5nIHByb3BlcnRpZXMgZGlyZWN0bHkuIFlvdSBjYW5ub3QganVzdFxuICogd3JpdGUgYXN5bmNTdG9yYWdlLmtleTsgeW91IGhhdmUgdG8gZXhwbGljaXRseSBjYWxsIHNldEl0ZW0oKSBvciBnZXRJdGVtKCkuXG4gKlxuICogcmVtb3ZlSXRlbSgpLCBjbGVhcigpLCBsZW5ndGgoKSwgYW5kIGtleSgpIGFyZSBsaWtlIHRoZSBzYW1lLW5hbWVkIG1ldGhvZHMgb2ZcbiAqIGxvY2FsU3RvcmFnZSwgYnV0LCBsaWtlIGdldEl0ZW0oKSBhbmQgc2V0SXRlbSgpIHRoZXkgdGFrZSBhIGNhbGxiYWNrXG4gKiBhcmd1bWVudC5cbiAqXG4gKiBUaGUgYXN5bmNocm9ub3VzIG5hdHVyZSBvZiBnZXRJdGVtKCkgbWFrZXMgaXQgdHJpY2t5IHRvIHJldHJpZXZlIG11bHRpcGxlXG4gKiB2YWx1ZXMuIEJ1dCB1bmxpa2UgbG9jYWxTdG9yYWdlLCBhc3luY1N0b3JhZ2UgZG9lcyBub3QgcmVxdWlyZSB0aGUgdmFsdWVzIHlvdVxuICogc3RvcmUgdG8gYmUgc3RyaW5ncy4gIFNvIGlmIHlvdSBuZWVkIHRvIHNhdmUgbXVsdGlwbGUgdmFsdWVzIGFuZCB3YW50IHRvXG4gKiByZXRyaWV2ZSB0aGVtIHRvZ2V0aGVyLCBpbiBhIHNpbmdsZSBhc3luY2hyb25vdXMgb3BlcmF0aW9uLCBqdXN0IGdyb3VwIHRoZVxuICogdmFsdWVzIGludG8gYSBzaW5nbGUgb2JqZWN0LiBUaGUgcHJvcGVydGllcyBvZiB0aGlzIG9iamVjdCBtYXkgbm90IGluY2x1ZGVcbiAqIERPTSBlbGVtZW50cywgYnV0IHRoZXkgbWF5IGluY2x1ZGUgdGhpbmdzIGxpa2UgQmxvYnMgYW5kIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBVbml0IHRlc3RzIGFyZSBpbiBhcHBzL2dhbGxlcnkvdGVzdC91bml0L2FzeW5jU3RvcmFnZV90ZXN0LmpzXG4gKi9cblxuLy90aGlzLmFzeW5jU3RvcmFnZSA9IChmdW5jdGlvbigpIHtcbnZhciBhc3luY1N0b3JhZ2UgPSAoZnVuY3Rpb24oKSB7XG5cbiAgdmFyIERCTkFNRSA9ICdhc3luY1N0b3JhZ2UnO1xuICB2YXIgREJWRVJTSU9OID0gMTtcbiAgdmFyIFNUT1JFTkFNRSA9ICdrZXl2YWx1ZXBhaXJzJztcbiAgdmFyIGRiID0gbnVsbDtcblxuICBmdW5jdGlvbiB3aXRoU3RvcmUodHlwZSwgZikge1xuICAgIGlmIChkYikge1xuICAgICAgZihkYi50cmFuc2FjdGlvbihTVE9SRU5BTUUsIHR5cGUpLm9iamVjdFN0b3JlKFNUT1JFTkFNRSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgb3BlbnJlcSA9IGluZGV4ZWREQi5vcGVuKERCTkFNRSwgREJWRVJTSU9OKTtcbiAgICAgIG9wZW5yZXEub25lcnJvciA9IGZ1bmN0aW9uIHdpdGhTdG9yZU9uRXJyb3IoKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJhc3luY1N0b3JhZ2U6IGNhbid0IG9wZW4gZGF0YWJhc2U6XCIsIG9wZW5yZXEuZXJyb3IubmFtZSk7XG4gICAgICB9O1xuICAgICAgb3BlbnJlcS5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbiB3aXRoU3RvcmVPblVwZ3JhZGVOZWVkZWQoKSB7XG4gICAgICAgIC8vIEZpcnN0IHRpbWUgc2V0dXA6IGNyZWF0ZSBhbiBlbXB0eSBvYmplY3Qgc3RvcmVcbiAgICAgICAgb3BlbnJlcS5yZXN1bHQuY3JlYXRlT2JqZWN0U3RvcmUoU1RPUkVOQU1FKTtcbiAgICAgIH07XG4gICAgICBvcGVucmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIHdpdGhTdG9yZU9uU3VjY2VzcygpIHtcbiAgICAgICAgZGIgPSBvcGVucmVxLnJlc3VsdDtcbiAgICAgICAgZihkYi50cmFuc2FjdGlvbihTVE9SRU5BTUUsIHR5cGUpLm9iamVjdFN0b3JlKFNUT1JFTkFNRSkpO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRJdGVtKGtleSwgY2FsbGJhY2spIHtcbiAgICB3aXRoU3RvcmUoJ3JlYWRvbmx5JywgZnVuY3Rpb24gZ2V0SXRlbUJvZHkoc3RvcmUpIHtcbiAgICAgIHZhciByZXEgPSBzdG9yZS5nZXQoa2V5KTtcbiAgICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiBnZXRJdGVtT25TdWNjZXNzKCkge1xuICAgICAgICB2YXIgdmFsdWUgPSByZXEucmVzdWx0O1xuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIGNhbGxiYWNrKHZhbHVlKTtcbiAgICAgIH07XG4gICAgICByZXEub25lcnJvciA9IGZ1bmN0aW9uIGdldEl0ZW1PbkVycm9yKCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbiBhc3luY1N0b3JhZ2UuZ2V0SXRlbSgpOiAnLCByZXEuZXJyb3IubmFtZSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0SXRlbShrZXksIHZhbHVlLCBjYWxsYmFjaykge1xuICAgIHdpdGhTdG9yZSgncmVhZHdyaXRlJywgZnVuY3Rpb24gc2V0SXRlbUJvZHkoc3RvcmUpIHtcbiAgICAgIHZhciByZXEgPSBzdG9yZS5wdXQodmFsdWUsIGtleSk7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIHNldEl0ZW1PblN1Y2Nlc3MoKSB7XG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gc2V0SXRlbU9uRXJyb3IoKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluIGFzeW5jU3RvcmFnZS5zZXRJdGVtKCk6ICcsIHJlcS5lcnJvci5uYW1lKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVJdGVtKGtleSwgY2FsbGJhY2spIHtcbiAgICB3aXRoU3RvcmUoJ3JlYWR3cml0ZScsIGZ1bmN0aW9uIHJlbW92ZUl0ZW1Cb2R5KHN0b3JlKSB7XG4gICAgICB2YXIgcmVxID0gc3RvcmUuZGVsZXRlKGtleSk7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIHJlbW92ZUl0ZW1PblN1Y2Nlc3MoKSB7XG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gcmVtb3ZlSXRlbU9uRXJyb3IoKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluIGFzeW5jU3RvcmFnZS5yZW1vdmVJdGVtKCk6ICcsIHJlcS5lcnJvci5uYW1lKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhcihjYWxsYmFjaykge1xuICAgIHdpdGhTdG9yZSgncmVhZHdyaXRlJywgZnVuY3Rpb24gY2xlYXJCb2R5KHN0b3JlKSB7XG4gICAgICB2YXIgcmVxID0gc3RvcmUuY2xlYXIoKTtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24gY2xlYXJPblN1Y2Nlc3MoKSB7XG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gY2xlYXJPbkVycm9yKCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbiBhc3luY1N0b3JhZ2UuY2xlYXIoKTogJywgcmVxLmVycm9yLm5hbWUpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxlbmd0aChjYWxsYmFjaykge1xuICAgIHdpdGhTdG9yZSgncmVhZG9ubHknLCBmdW5jdGlvbiBsZW5ndGhCb2R5KHN0b3JlKSB7XG4gICAgICB2YXIgcmVxID0gc3RvcmUuY291bnQoKTtcbiAgICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbiBsZW5ndGhPblN1Y2Nlc3MoKSB7XG4gICAgICAgIGNhbGxiYWNrKHJlcS5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24gbGVuZ3RoT25FcnJvcigpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgaW4gYXN5bmNTdG9yYWdlLmxlbmd0aCgpOiAnLCByZXEuZXJyb3IubmFtZSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5KG4sIGNhbGxiYWNrKSB7XG4gICAgaWYgKG4gPCAwKSB7XG4gICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB3aXRoU3RvcmUoJ3JlYWRvbmx5JywgZnVuY3Rpb24ga2V5Qm9keShzdG9yZSkge1xuICAgICAgdmFyIGFkdmFuY2VkID0gZmFsc2U7XG4gICAgICB2YXIgcmVxID0gc3RvcmUub3BlbkN1cnNvcigpO1xuICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uIGtleU9uU3VjY2VzcygpIHtcbiAgICAgICAgdmFyIGN1cnNvciA9IHJlcS5yZXN1bHQ7XG4gICAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgICAgLy8gdGhpcyBtZWFucyB0aGVyZSB3ZXJlbid0IGVub3VnaCBrZXlzXG4gICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuID09PSAwKSB7XG4gICAgICAgICAgLy8gV2UgaGF2ZSB0aGUgZmlyc3Qga2V5LCByZXR1cm4gaXQgaWYgdGhhdCdzIHdoYXQgdGhleSB3YW50ZWRcbiAgICAgICAgICBjYWxsYmFjayhjdXJzb3Iua2V5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoIWFkdmFuY2VkKSB7XG4gICAgICAgICAgICAvLyBPdGhlcndpc2UsIGFzayB0aGUgY3Vyc29yIHRvIHNraXAgYWhlYWQgbiByZWNvcmRzXG4gICAgICAgICAgICBhZHZhbmNlZCA9IHRydWU7XG4gICAgICAgICAgICBjdXJzb3IuYWR2YW5jZShuKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBnZXQgaGVyZSwgd2UndmUgZ290IHRoZSBudGgga2V5LlxuICAgICAgICAgICAgY2FsbGJhY2soY3Vyc29yLmtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbiBrZXlPbkVycm9yKCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbiBhc3luY1N0b3JhZ2Uua2V5KCk6ICcsIHJlcS5lcnJvci5uYW1lKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldEl0ZW06IGdldEl0ZW0sXG4gICAgc2V0SXRlbTogc2V0SXRlbSxcbiAgICByZW1vdmVJdGVtOiByZW1vdmVJdGVtLFxuICAgIGNsZWFyOiBjbGVhcixcbiAgICBsZW5ndGg6IGxlbmd0aCxcbiAgICBrZXk6IGtleVxuICB9O1xufSgpKTtcblxuXG53aW5kb3cuYXN5bmNTdG9yYWdlID0gYXN5bmNTdG9yYWdlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFzeW5jU3RvcmFnZTtcbiIsIi8qKlxuICogQGZpbGVvdmVydmlldyBnbC1tYXRyaXggLSBIaWdoIHBlcmZvcm1hbmNlIG1hdHJpeCBhbmQgdmVjdG9yIG9wZXJhdGlvbnNcbiAqIEBhdXRob3IgQnJhbmRvbiBKb25lc1xuICogQGF1dGhvciBDb2xpbiBNYWNLZW56aWUgSVZcbiAqIEB2ZXJzaW9uIDIuMi4wXG4gKi9cbi8qIENvcHlyaWdodCAoYykgMjAxMywgQnJhbmRvbiBKb25lcywgQ29saW4gTWFjS2VuemllIElWLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG5SZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLFxuYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLCB0aGlzXG4gICAgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gXG4gICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cblRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlMgXCJBUyBJU1wiIEFORFxuQU5ZIEVYUFJFU1MgT1IgSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbldBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgXG5ESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUIEhPTERFUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUlxuQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTXG4oSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7XG5MT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT05cbkFOWSBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4oSU5DTFVESU5HIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJU1xuU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuICovXG4oZnVuY3Rpb24oZSl7XCJ1c2Ugc3RyaWN0XCI7dmFyIHQ9e307dHlwZW9mIGV4cG9ydHM9PVwidW5kZWZpbmVkXCI/dHlwZW9mIGRlZmluZT09XCJmdW5jdGlvblwiJiZ0eXBlb2YgZGVmaW5lLmFtZD09XCJvYmplY3RcIiYmZGVmaW5lLmFtZD8odC5leHBvcnRzPXt9LGRlZmluZShmdW5jdGlvbigpe3JldHVybiB0LmV4cG9ydHN9KSk6dC5leHBvcnRzPXR5cGVvZiB3aW5kb3chPVwidW5kZWZpbmVkXCI/d2luZG93OmU6dC5leHBvcnRzPWV4cG9ydHMsZnVuY3Rpb24oZSl7aWYoIXQpdmFyIHQ9MWUtNjtpZighbil2YXIgbj10eXBlb2YgRmxvYXQzMkFycmF5IT1cInVuZGVmaW5lZFwiP0Zsb2F0MzJBcnJheTpBcnJheTtpZighcil2YXIgcj1NYXRoLnJhbmRvbTt2YXIgaT17fTtpLnNldE1hdHJpeEFycmF5VHlwZT1mdW5jdGlvbihlKXtuPWV9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5nbE1hdHJpeD1pKTt2YXIgcz17fTtzLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDIpO3JldHVybiBlWzBdPTAsZVsxXT0wLGV9LHMuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oMik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdH0scy5mcm9tVmFsdWVzPWZ1bmN0aW9uKGUsdCl7dmFyIHI9bmV3IG4oMik7cmV0dXJuIHJbMF09ZSxyWzFdPXQscn0scy5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZX0scy5zZXQ9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXQsZVsxXT1uLGV9LHMuYWRkPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdK25bMF0sZVsxXT10WzFdK25bMV0sZX0scy5zdWJ0cmFjdD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS1uWzBdLGVbMV09dFsxXS1uWzFdLGV9LHMuc3ViPXMuc3VidHJhY3Qscy5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuWzBdLGVbMV09dFsxXSpuWzFdLGV9LHMubXVsPXMubXVsdGlwbHkscy5kaXZpZGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0vblswXSxlWzFdPXRbMV0vblsxXSxlfSxzLmRpdj1zLmRpdmlkZSxzLm1pbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5taW4odFswXSxuWzBdKSxlWzFdPU1hdGgubWluKHRbMV0sblsxXSksZX0scy5tYXg9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWF4KHRbMF0sblswXSksZVsxXT1NYXRoLm1heCh0WzFdLG5bMV0pLGV9LHMuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qbixlWzFdPXRbMV0qbixlfSxzLnNjYWxlQW5kQWRkPWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXRbMF0rblswXSpyLGVbMV09dFsxXStuWzFdKnIsZX0scy5kaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXTtyZXR1cm4gTWF0aC5zcXJ0KG4qbityKnIpfSxzLmRpc3Q9cy5kaXN0YW5jZSxzLnNxdWFyZWREaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXTtyZXR1cm4gbipuK3Iqcn0scy5zcXJEaXN0PXMuc3F1YXJlZERpc3RhbmNlLHMubGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdO3JldHVybiBNYXRoLnNxcnQodCp0K24qbil9LHMubGVuPXMubGVuZ3RoLHMuc3F1YXJlZExlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXTtyZXR1cm4gdCp0K24qbn0scy5zcXJMZW49cy5zcXVhcmVkTGVuZ3RoLHMubmVnYXRlPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09LXRbMF0sZVsxXT0tdFsxXSxlfSxzLm5vcm1hbGl6ZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9bipuK3IqcjtyZXR1cm4gaT4wJiYoaT0xL01hdGguc3FydChpKSxlWzBdPXRbMF0qaSxlWzFdPXRbMV0qaSksZX0scy5kb3Q9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXSp0WzBdK2VbMV0qdFsxXX0scy5jcm9zcz1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSpuWzFdLXRbMV0qblswXTtyZXR1cm4gZVswXT1lWzFdPTAsZVsyXT1yLGV9LHMubGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXTtyZXR1cm4gZVswXT1pK3IqKG5bMF0taSksZVsxXT1zK3IqKG5bMV0tcyksZX0scy5yYW5kb209ZnVuY3Rpb24oZSx0KXt0PXR8fDE7dmFyIG49cigpKjIqTWF0aC5QSTtyZXR1cm4gZVswXT1NYXRoLmNvcyhuKSp0LGVbMV09TWF0aC5zaW4obikqdCxlfSxzLnRyYW5zZm9ybU1hdDI9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzJdKmksZVsxXT1uWzFdKnIrblszXSppLGV9LHMudHJhbnNmb3JtTWF0MmQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzJdKmkrbls0XSxlWzFdPW5bMV0qcituWzNdKmkrbls1XSxlfSxzLnRyYW5zZm9ybU1hdDM9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzNdKmkrbls2XSxlWzFdPW5bMV0qcituWzRdKmkrbls3XSxlfSxzLnRyYW5zZm9ybU1hdDQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzRdKmkrblsxMl0sZVsxXT1uWzFdKnIrbls1XSppK25bMTNdLGV9LHMuZm9yRWFjaD1mdW5jdGlvbigpe3ZhciBlPXMuY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkscyxvKXt2YXIgdSxhO258fChuPTIpLHJ8fChyPTApLGk/YT1NYXRoLm1pbihpKm4rcix0Lmxlbmd0aCk6YT10Lmxlbmd0aDtmb3IodT1yO3U8YTt1Kz1uKWVbMF09dFt1XSxlWzFdPXRbdSsxXSxzKGUsZSxvKSx0W3VdPWVbMF0sdFt1KzFdPWVbMV07cmV0dXJuIHR9fSgpLHMuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwidmVjMihcIitlWzBdK1wiLCBcIitlWzFdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUudmVjMj1zKTt2YXIgbz17fTtvLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDMpO3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlfSxvLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDMpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0fSxvLmZyb21WYWx1ZXM9ZnVuY3Rpb24oZSx0LHIpe3ZhciBpPW5ldyBuKDMpO3JldHVybiBpWzBdPWUsaVsxXT10LGlbMl09cixpfSxvLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZX0sby5zZXQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dCxlWzFdPW4sZVsyXT1yLGV9LG8uYWRkPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdK25bMF0sZVsxXT10WzFdK25bMV0sZVsyXT10WzJdK25bMl0sZX0sby5zdWJ0cmFjdD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS1uWzBdLGVbMV09dFsxXS1uWzFdLGVbMl09dFsyXS1uWzJdLGV9LG8uc3ViPW8uc3VidHJhY3Qsby5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuWzBdLGVbMV09dFsxXSpuWzFdLGVbMl09dFsyXSpuWzJdLGV9LG8ubXVsPW8ubXVsdGlwbHksby5kaXZpZGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0vblswXSxlWzFdPXRbMV0vblsxXSxlWzJdPXRbMl0vblsyXSxlfSxvLmRpdj1vLmRpdmlkZSxvLm1pbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5taW4odFswXSxuWzBdKSxlWzFdPU1hdGgubWluKHRbMV0sblsxXSksZVsyXT1NYXRoLm1pbih0WzJdLG5bMl0pLGV9LG8ubWF4PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1heCh0WzBdLG5bMF0pLGVbMV09TWF0aC5tYXgodFsxXSxuWzFdKSxlWzJdPU1hdGgubWF4KHRbMl0sblsyXSksZX0sby5zY2FsZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuLGVbMV09dFsxXSpuLGVbMl09dFsyXSpuLGV9LG8uc2NhbGVBbmRBZGQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dFswXStuWzBdKnIsZVsxXT10WzFdK25bMV0qcixlWzJdPXRbMl0rblsyXSpyLGV9LG8uZGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV0saT10WzJdLWVbMl07cmV0dXJuIE1hdGguc3FydChuKm4rcipyK2kqaSl9LG8uZGlzdD1vLmRpc3RhbmNlLG8uc3F1YXJlZERpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdO3JldHVybiBuKm4rcipyK2kqaX0sby5zcXJEaXN0PW8uc3F1YXJlZERpc3RhbmNlLG8ubGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXTtyZXR1cm4gTWF0aC5zcXJ0KHQqdCtuKm4rcipyKX0sby5sZW49by5sZW5ndGgsby5zcXVhcmVkTGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXTtyZXR1cm4gdCp0K24qbityKnJ9LG8uc3FyTGVuPW8uc3F1YXJlZExlbmd0aCxvLm5lZ2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZVsyXT0tdFsyXSxlfSxvLm5vcm1hbGl6ZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPW4qbityKnIraSppO3JldHVybiBzPjAmJihzPTEvTWF0aC5zcXJ0KHMpLGVbMF09dFswXSpzLGVbMV09dFsxXSpzLGVbMl09dFsyXSpzKSxlfSxvLmRvdD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdKnRbMF0rZVsxXSp0WzFdK2VbMl0qdFsyXX0sby5jcm9zcz1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89blswXSx1PW5bMV0sYT1uWzJdO3JldHVybiBlWzBdPWkqYS1zKnUsZVsxXT1zKm8tciphLGVbMl09cip1LWkqbyxlfSxvLmxlcnA9ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9dFswXSxzPXRbMV0sbz10WzJdO3JldHVybiBlWzBdPWkrciooblswXS1pKSxlWzFdPXMrciooblsxXS1zKSxlWzJdPW8rciooblsyXS1vKSxlfSxvLnJhbmRvbT1mdW5jdGlvbihlLHQpe3Q9dHx8MTt2YXIgbj1yKCkqMipNYXRoLlBJLGk9cigpKjItMSxzPU1hdGguc3FydCgxLWkqaSkqdDtyZXR1cm4gZVswXT1NYXRoLmNvcyhuKSpzLGVbMV09TWF0aC5zaW4obikqcyxlWzJdPWkqdCxlfSxvLnRyYW5zZm9ybU1hdDQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXTtyZXR1cm4gZVswXT1uWzBdKnIrbls0XSppK25bOF0qcytuWzEyXSxlWzFdPW5bMV0qcituWzVdKmkrbls5XSpzK25bMTNdLGVbMl09blsyXSpyK25bNl0qaStuWzEwXSpzK25bMTRdLGV9LG8udHJhbnNmb3JtTWF0Mz1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdO3JldHVybiBlWzBdPXIqblswXStpKm5bM10rcypuWzZdLGVbMV09cipuWzFdK2kqbls0XStzKm5bN10sZVsyXT1yKm5bMl0raSpuWzVdK3Mqbls4XSxlfSxvLnRyYW5zZm9ybVF1YXQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPW5bMF0sdT1uWzFdLGE9blsyXSxmPW5bM10sbD1mKnIrdSpzLWEqaSxjPWYqaSthKnItbypzLGg9ZipzK28qaS11KnIscD0tbypyLXUqaS1hKnM7cmV0dXJuIGVbMF09bCpmK3AqLW8rYyotYS1oKi11LGVbMV09YypmK3AqLXUraCotby1sKi1hLGVbMl09aCpmK3AqLWErbCotdS1jKi1vLGV9LG8uZm9yRWFjaD1mdW5jdGlvbigpe3ZhciBlPW8uY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkscyxvKXt2YXIgdSxhO258fChuPTMpLHJ8fChyPTApLGk/YT1NYXRoLm1pbihpKm4rcix0Lmxlbmd0aCk6YT10Lmxlbmd0aDtmb3IodT1yO3U8YTt1Kz1uKWVbMF09dFt1XSxlWzFdPXRbdSsxXSxlWzJdPXRbdSsyXSxzKGUsZSxvKSx0W3VdPWVbMF0sdFt1KzFdPWVbMV0sdFt1KzJdPWVbMl07cmV0dXJuIHR9fSgpLG8uc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwidmVjMyhcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUudmVjMz1vKTt2YXIgdT17fTt1LmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDQpO3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlWzNdPTAsZX0sdS5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbig0KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHR9LHUuZnJvbVZhbHVlcz1mdW5jdGlvbihlLHQscixpKXt2YXIgcz1uZXcgbig0KTtyZXR1cm4gc1swXT1lLHNbMV09dCxzWzJdPXIsc1szXT1pLHN9LHUuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZX0sdS5zZXQ9ZnVuY3Rpb24oZSx0LG4scixpKXtyZXR1cm4gZVswXT10LGVbMV09bixlWzJdPXIsZVszXT1pLGV9LHUuYWRkPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdK25bMF0sZVsxXT10WzFdK25bMV0sZVsyXT10WzJdK25bMl0sZVszXT10WzNdK25bM10sZX0sdS5zdWJ0cmFjdD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS1uWzBdLGVbMV09dFsxXS1uWzFdLGVbMl09dFsyXS1uWzJdLGVbM109dFszXS1uWzNdLGV9LHUuc3ViPXUuc3VidHJhY3QsdS5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuWzBdLGVbMV09dFsxXSpuWzFdLGVbMl09dFsyXSpuWzJdLGVbM109dFszXSpuWzNdLGV9LHUubXVsPXUubXVsdGlwbHksdS5kaXZpZGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0vblswXSxlWzFdPXRbMV0vblsxXSxlWzJdPXRbMl0vblsyXSxlWzNdPXRbM10vblszXSxlfSx1LmRpdj11LmRpdmlkZSx1Lm1pbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5taW4odFswXSxuWzBdKSxlWzFdPU1hdGgubWluKHRbMV0sblsxXSksZVsyXT1NYXRoLm1pbih0WzJdLG5bMl0pLGVbM109TWF0aC5taW4odFszXSxuWzNdKSxlfSx1Lm1heD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5tYXgodFswXSxuWzBdKSxlWzFdPU1hdGgubWF4KHRbMV0sblsxXSksZVsyXT1NYXRoLm1heCh0WzJdLG5bMl0pLGVbM109TWF0aC5tYXgodFszXSxuWzNdKSxlfSx1LnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm4sZVsxXT10WzFdKm4sZVsyXT10WzJdKm4sZVszXT10WzNdKm4sZX0sdS5zY2FsZUFuZEFkZD1mdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gZVswXT10WzBdK25bMF0qcixlWzFdPXRbMV0rblsxXSpyLGVbMl09dFsyXStuWzJdKnIsZVszXT10WzNdK25bM10qcixlfSx1LmRpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdLHM9dFszXS1lWzNdO3JldHVybiBNYXRoLnNxcnQobipuK3IqcitpKmkrcypzKX0sdS5kaXN0PXUuZGlzdGFuY2UsdS5zcXVhcmVkRGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV0saT10WzJdLWVbMl0scz10WzNdLWVbM107cmV0dXJuIG4qbityKnIraSppK3Mqc30sdS5zcXJEaXN0PXUuc3F1YXJlZERpc3RhbmNlLHUubGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM107cmV0dXJuIE1hdGguc3FydCh0KnQrbipuK3IqcitpKmkpfSx1Lmxlbj11Lmxlbmd0aCx1LnNxdWFyZWRMZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV0scj1lWzJdLGk9ZVszXTtyZXR1cm4gdCp0K24qbityKnIraSppfSx1LnNxckxlbj11LnNxdWFyZWRMZW5ndGgsdS5uZWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT0tdFszXSxlfSx1Lm5vcm1hbGl6ZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uKm4rcipyK2kqaStzKnM7cmV0dXJuIG8+MCYmKG89MS9NYXRoLnNxcnQobyksZVswXT10WzBdKm8sZVsxXT10WzFdKm8sZVsyXT10WzJdKm8sZVszXT10WzNdKm8pLGV9LHUuZG90PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF0qdFswXStlWzFdKnRbMV0rZVsyXSp0WzJdK2VbM10qdFszXX0sdS5sZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdLG89dFsyXSx1PXRbM107cmV0dXJuIGVbMF09aStyKihuWzBdLWkpLGVbMV09cytyKihuWzFdLXMpLGVbMl09bytyKihuWzJdLW8pLGVbM109dStyKihuWzNdLXUpLGV9LHUucmFuZG9tPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHQ9dHx8MSxlWzBdPXIoKSxlWzFdPXIoKSxlWzJdPXIoKSxlWzNdPXIoKSx1Lm5vcm1hbGl6ZShlLGUpLHUuc2NhbGUoZSxlLHQpLGV9LHUudHJhbnNmb3JtTWF0ND1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXTtyZXR1cm4gZVswXT1uWzBdKnIrbls0XSppK25bOF0qcytuWzEyXSpvLGVbMV09blsxXSpyK25bNV0qaStuWzldKnMrblsxM10qbyxlWzJdPW5bMl0qcituWzZdKmkrblsxMF0qcytuWzE0XSpvLGVbM109blszXSpyK25bN10qaStuWzExXSpzK25bMTVdKm8sZX0sdS50cmFuc2Zvcm1RdWF0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz1uWzBdLHU9blsxXSxhPW5bMl0sZj1uWzNdLGw9ZipyK3Uqcy1hKmksYz1mKmkrYSpyLW8qcyxoPWYqcytvKmktdSpyLHA9LW8qci11KmktYSpzO3JldHVybiBlWzBdPWwqZitwKi1vK2MqLWEtaCotdSxlWzFdPWMqZitwKi11K2gqLW8tbCotYSxlWzJdPWgqZitwKi1hK2wqLXUtYyotbyxlfSx1LmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT11LmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj00KSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0sZVsyXT10W3UrMl0sZVszXT10W3UrM10scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdLHRbdSsyXT1lWzJdLHRbdSszXT1lWzNdO3JldHVybiB0fX0oKSx1LnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzQ9dSk7dmFyIGE9e307YS5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGEuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNCk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0fSxhLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGV9LGEuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlfSxhLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdO2VbMV09dFsyXSxlWzJdPW59ZWxzZSBlWzBdPXRbMF0sZVsxXT10WzJdLGVbMl09dFsxXSxlWzNdPXRbM107cmV0dXJuIGV9LGEuaW52ZXJ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4qcy1pKnI7cmV0dXJuIG8/KG89MS9vLGVbMF09cypvLGVbMV09LXIqbyxlWzJdPS1pKm8sZVszXT1uKm8sZSk6bnVsbH0sYS5hZGpvaW50PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXTtyZXR1cm4gZVswXT10WzNdLGVbMV09LXRbMV0sZVsyXT0tdFsyXSxlWzNdPW4sZX0sYS5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXtyZXR1cm4gZVswXSplWzNdLWVbMl0qZVsxXX0sYS5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PW5bMF0sYT1uWzFdLGY9blsyXSxsPW5bM107cmV0dXJuIGVbMF09cip1K2kqZixlWzFdPXIqYStpKmwsZVsyXT1zKnUrbypmLGVbM109cyphK28qbCxlfSxhLm11bD1hLm11bHRpcGx5LGEucm90YXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmEraSp1LGVbMV09ciotdStpKmEsZVsyXT1zKmErbyp1LGVbM109cyotdStvKmEsZX0sYS5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PW5bMF0sYT1uWzFdO3JldHVybiBlWzBdPXIqdSxlWzFdPWkqYSxlWzJdPXMqdSxlWzNdPW8qYSxlfSxhLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDIoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDI9YSk7dmFyIGY9e307Zi5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig2KTtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0xLGVbNF09MCxlWzVdPTAsZX0sZi5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbig2KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHRbNF09ZVs0XSx0WzVdPWVbNV0sdH0sZi5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzRdPXRbNF0sZVs1XT10WzVdLGV9LGYuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlWzRdPTAsZVs1XT0wLGV9LGYuaW52ZXJ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9bipzLXIqaTtyZXR1cm4gYT8oYT0xL2EsZVswXT1zKmEsZVsxXT0tciphLGVbMl09LWkqYSxlWzNdPW4qYSxlWzRdPShpKnUtcypvKSphLGVbNV09KHIqby1uKnUpKmEsZSk6bnVsbH0sZi5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXtyZXR1cm4gZVswXSplWzNdLWVbMV0qZVsyXX0sZi5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9blswXSxsPW5bMV0sYz1uWzJdLGg9blszXSxwPW5bNF0sZD1uWzVdO3JldHVybiBlWzBdPXIqZitpKmMsZVsxXT1yKmwraSpoLGVbMl09cypmK28qYyxlWzNdPXMqbCtvKmgsZVs0XT1mKnUrYyphK3AsZVs1XT1sKnUraCphK2QsZX0sZi5tdWw9Zi5tdWx0aXBseSxmLnJvdGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9TWF0aC5zaW4obiksbD1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmwraSpmLGVbMV09LXIqZitpKmwsZVsyXT1zKmwrbypmLGVbM109LXMqZitsKm8sZVs0XT1sKnUrZiphLGVbNV09bCphLWYqdSxlfSxmLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1uWzBdLGk9blsxXTtyZXR1cm4gZVswXT10WzBdKnIsZVsxXT10WzFdKmksZVsyXT10WzJdKnIsZVszXT10WzNdKmksZVs0XT10WzRdKnIsZVs1XT10WzVdKmksZX0sZi50cmFuc2xhdGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdK25bMF0sZVs1XT10WzVdK25bMV0sZX0sZi5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQyZChcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiLCBcIitlWzRdK1wiLCBcIitlWzVdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUubWF0MmQ9Zik7dmFyIGw9e307bC5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig5KTtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MSxlWzVdPTAsZVs2XT0wLGVbN109MCxlWzhdPTEsZX0sbC5mcm9tTWF0ND1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbNF0sZVs0XT10WzVdLGVbNV09dFs2XSxlWzZdPXRbOF0sZVs3XT10WzldLGVbOF09dFsxMF0sZX0sbC5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbig5KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHRbNF09ZVs0XSx0WzVdPWVbNV0sdFs2XT1lWzZdLHRbN109ZVs3XSx0WzhdPWVbOF0sdH0sbC5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzRdPXRbNF0sZVs1XT10WzVdLGVbNl09dFs2XSxlWzddPXRbN10sZVs4XT10WzhdLGV9LGwuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTEsZVs1XT0wLGVbNl09MCxlWzddPTAsZVs4XT0xLGV9LGwudHJhbnNwb3NlPWZ1bmN0aW9uKGUsdCl7aWYoZT09PXQpe3ZhciBuPXRbMV0scj10WzJdLGk9dFs1XTtlWzFdPXRbM10sZVsyXT10WzZdLGVbM109bixlWzVdPXRbN10sZVs2XT1yLGVbN109aX1lbHNlIGVbMF09dFswXSxlWzFdPXRbM10sZVsyXT10WzZdLGVbM109dFsxXSxlWzRdPXRbNF0sZVs1XT10WzddLGVbNl09dFsyXSxlWzddPXRbNV0sZVs4XT10WzhdO3JldHVybiBlfSxsLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPWwqby11KmYsaD0tbCpzK3UqYSxwPWYqcy1vKmEsZD1uKmMrcipoK2kqcDtyZXR1cm4gZD8oZD0xL2QsZVswXT1jKmQsZVsxXT0oLWwqcitpKmYpKmQsZVsyXT0odSpyLWkqbykqZCxlWzNdPWgqZCxlWzRdPShsKm4taSphKSpkLGVbNV09KC11Km4raSpzKSpkLGVbNl09cCpkLGVbN109KC1mKm4rciphKSpkLGVbOF09KG8qbi1yKnMpKmQsZSk6bnVsbH0sbC5hZGpvaW50PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdO3JldHVybiBlWzBdPW8qbC11KmYsZVsxXT1pKmYtcipsLGVbMl09cip1LWkqbyxlWzNdPXUqYS1zKmwsZVs0XT1uKmwtaSphLGVbNV09aSpzLW4qdSxlWzZdPXMqZi1vKmEsZVs3XT1yKmEtbipmLGVbOF09bipvLXIqcyxlfSxsLmRldGVybWluYW50PWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM10scz1lWzRdLG89ZVs1XSx1PWVbNl0sYT1lWzddLGY9ZVs4XTtyZXR1cm4gdCooZipzLW8qYSkrbiooLWYqaStvKnUpK3IqKGEqaS1zKnUpfSxsLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD1uWzBdLHA9blsxXSxkPW5bMl0sdj1uWzNdLG09bls0XSxnPW5bNV0seT1uWzZdLGI9bls3XSx3PW5bOF07cmV0dXJuIGVbMF09aCpyK3AqbytkKmYsZVsxXT1oKmkrcCp1K2QqbCxlWzJdPWgqcytwKmErZCpjLGVbM109dipyK20qbytnKmYsZVs0XT12KmkrbSp1K2cqbCxlWzVdPXYqcyttKmErZypjLGVbNl09eSpyK2Iqbyt3KmYsZVs3XT15KmkrYip1K3cqbCxlWzhdPXkqcytiKmErdypjLGV9LGwubXVsPWwubXVsdGlwbHksbC50cmFuc2xhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPXRbNl0sbD10WzddLGM9dFs4XSxoPW5bMF0scD1uWzFdO3JldHVybiBlWzBdPXIsZVsxXT1pLGVbMl09cyxlWzNdPW8sZVs0XT11LGVbNV09YSxlWzZdPWgqcitwKm8rZixlWzddPWgqaStwKnUrbCxlWzhdPWgqcytwKmErYyxlfSxsLnJvdGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9TWF0aC5zaW4obikscD1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1wKnIraCpvLGVbMV09cCppK2gqdSxlWzJdPXAqcytoKmEsZVszXT1wKm8taCpyLGVbNF09cCp1LWgqaSxlWzVdPXAqYS1oKnMsZVs2XT1mLGVbN109bCxlWzhdPWMsZX0sbC5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV07cmV0dXJuIGVbMF09cip0WzBdLGVbMV09cip0WzFdLGVbMl09cip0WzJdLGVbM109aSp0WzNdLGVbNF09aSp0WzRdLGVbNV09aSp0WzVdLGVbNl09dFs2XSxlWzddPXRbN10sZVs4XT10WzhdLGV9LGwuZnJvbU1hdDJkPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT0wLGVbM109dFsyXSxlWzRdPXRbM10sZVs1XT0wLGVbNl09dFs0XSxlWzddPXRbNV0sZVs4XT0xLGV9LGwuZnJvbVF1YXQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bituLHU9cityLGE9aStpLGY9bipvLGw9bip1LGM9biphLGg9cip1LHA9ciphLGQ9aSphLHY9cypvLG09cyp1LGc9cyphO3JldHVybiBlWzBdPTEtKGgrZCksZVszXT1sK2csZVs2XT1jLW0sZVsxXT1sLWcsZVs0XT0xLShmK2QpLGVbN109cCt2LGVbMl09YyttLGVbNV09cC12LGVbOF09MS0oZitoKSxlfSxsLm5vcm1hbEZyb21NYXQ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdLGM9dFs5XSxoPXRbMTBdLHA9dFsxMV0sZD10WzEyXSx2PXRbMTNdLG09dFsxNF0sZz10WzE1XSx5PW4qdS1yKm8sYj1uKmEtaSpvLHc9bipmLXMqbyxFPXIqYS1pKnUsUz1yKmYtcyp1LHg9aSpmLXMqYSxUPWwqdi1jKmQsTj1sKm0taCpkLEM9bCpnLXAqZCxrPWMqbS1oKnYsTD1jKmctcCp2LEE9aCpnLXAqbSxPPXkqQS1iKkwrdyprK0UqQy1TKk4reCpUO3JldHVybiBPPyhPPTEvTyxlWzBdPSh1KkEtYSpMK2YqaykqTyxlWzFdPShhKkMtbypBLWYqTikqTyxlWzJdPShvKkwtdSpDK2YqVCkqTyxlWzNdPShpKkwtcipBLXMqaykqTyxlWzRdPShuKkEtaSpDK3MqTikqTyxlWzVdPShyKkMtbipMLXMqVCkqTyxlWzZdPSh2KngtbSpTK2cqRSkqTyxlWzddPShtKnctZCp4LWcqYikqTyxlWzhdPShkKlMtdip3K2cqeSkqTyxlKTpudWxsfSxsLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDMoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIiwgXCIrZVs2XStcIiwgXCIrZVs3XStcIiwgXCIrZVs4XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDM9bCk7dmFyIGM9e307Yy5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigxNik7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0xLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0xLGVbMTFdPTAsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTAsZVsxNV09MSxlfSxjLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDE2KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHRbNF09ZVs0XSx0WzVdPWVbNV0sdFs2XT1lWzZdLHRbN109ZVs3XSx0WzhdPWVbOF0sdFs5XT1lWzldLHRbMTBdPWVbMTBdLHRbMTFdPWVbMTFdLHRbMTJdPWVbMTJdLHRbMTNdPWVbMTNdLHRbMTRdPWVbMTRdLHRbMTVdPWVbMTVdLHR9LGMuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlWzldPXRbOV0sZVsxMF09dFsxMF0sZVsxMV09dFsxMV0sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0sZX0sYy5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPTEsZVs2XT0wLGVbN109MCxlWzhdPTAsZVs5XT0wLGVbMTBdPTEsZVsxMV09MCxlWzEyXT0wLGVbMTNdPTAsZVsxNF09MCxlWzE1XT0xLGV9LGMudHJhbnNwb3NlPWZ1bmN0aW9uKGUsdCl7aWYoZT09PXQpe3ZhciBuPXRbMV0scj10WzJdLGk9dFszXSxzPXRbNl0sbz10WzddLHU9dFsxMV07ZVsxXT10WzRdLGVbMl09dFs4XSxlWzNdPXRbMTJdLGVbNF09bixlWzZdPXRbOV0sZVs3XT10WzEzXSxlWzhdPXIsZVs5XT1zLGVbMTFdPXRbMTRdLGVbMTJdPWksZVsxM109byxlWzE0XT11fWVsc2UgZVswXT10WzBdLGVbMV09dFs0XSxlWzJdPXRbOF0sZVszXT10WzEyXSxlWzRdPXRbMV0sZVs1XT10WzVdLGVbNl09dFs5XSxlWzddPXRbMTNdLGVbOF09dFsyXSxlWzldPXRbNl0sZVsxMF09dFsxMF0sZVsxMV09dFsxNF0sZVsxMl09dFszXSxlWzEzXT10WzddLGVbMTRdPXRbMTFdLGVbMTVdPXRbMTVdO3JldHVybiBlfSxjLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV0seT1uKnUtcipvLGI9biphLWkqbyx3PW4qZi1zKm8sRT1yKmEtaSp1LFM9cipmLXMqdSx4PWkqZi1zKmEsVD1sKnYtYypkLE49bCptLWgqZCxDPWwqZy1wKmQsaz1jKm0taCp2LEw9YypnLXAqdixBPWgqZy1wKm0sTz15KkEtYipMK3cqaytFKkMtUypOK3gqVDtyZXR1cm4gTz8oTz0xL08sZVswXT0odSpBLWEqTCtmKmspKk8sZVsxXT0oaSpMLXIqQS1zKmspKk8sZVsyXT0odip4LW0qUytnKkUpKk8sZVszXT0oaCpTLWMqeC1wKkUpKk8sZVs0XT0oYSpDLW8qQS1mKk4pKk8sZVs1XT0obipBLWkqQytzKk4pKk8sZVs2XT0obSp3LWQqeC1nKmIpKk8sZVs3XT0obCp4LWgqdytwKmIpKk8sZVs4XT0obypMLXUqQytmKlQpKk8sZVs5XT0ocipDLW4qTC1zKlQpKk8sZVsxMF09KGQqUy12KncrZyp5KSpPLGVbMTFdPShjKnctbCpTLXAqeSkqTyxlWzEyXT0odSpOLW8qay1hKlQpKk8sZVsxM109KG4qay1yKk4raSpUKSpPLGVbMTRdPSh2KmItZCpFLW0qeSkqTyxlWzE1XT0obCpFLWMqYitoKnkpKk8sZSk6bnVsbH0sYy5hZGpvaW50PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdLGM9dFs5XSxoPXRbMTBdLHA9dFsxMV0sZD10WzEyXSx2PXRbMTNdLG09dFsxNF0sZz10WzE1XTtyZXR1cm4gZVswXT11KihoKmctcCptKS1jKihhKmctZiptKSt2KihhKnAtZipoKSxlWzFdPS0ociooaCpnLXAqbSktYyooaSpnLXMqbSkrdiooaSpwLXMqaCkpLGVbMl09ciooYSpnLWYqbSktdSooaSpnLXMqbSkrdiooaSpmLXMqYSksZVszXT0tKHIqKGEqcC1mKmgpLXUqKGkqcC1zKmgpK2MqKGkqZi1zKmEpKSxlWzRdPS0obyooaCpnLXAqbSktbCooYSpnLWYqbSkrZCooYSpwLWYqaCkpLGVbNV09biooaCpnLXAqbSktbCooaSpnLXMqbSkrZCooaSpwLXMqaCksZVs2XT0tKG4qKGEqZy1mKm0pLW8qKGkqZy1zKm0pK2QqKGkqZi1zKmEpKSxlWzddPW4qKGEqcC1mKmgpLW8qKGkqcC1zKmgpK2wqKGkqZi1zKmEpLGVbOF09byooYypnLXAqdiktbCoodSpnLWYqdikrZCoodSpwLWYqYyksZVs5XT0tKG4qKGMqZy1wKnYpLWwqKHIqZy1zKnYpK2QqKHIqcC1zKmMpKSxlWzEwXT1uKih1KmctZip2KS1vKihyKmctcyp2KStkKihyKmYtcyp1KSxlWzExXT0tKG4qKHUqcC1mKmMpLW8qKHIqcC1zKmMpK2wqKHIqZi1zKnUpKSxlWzEyXT0tKG8qKGMqbS1oKnYpLWwqKHUqbS1hKnYpK2QqKHUqaC1hKmMpKSxlWzEzXT1uKihjKm0taCp2KS1sKihyKm0taSp2KStkKihyKmgtaSpjKSxlWzE0XT0tKG4qKHUqbS1hKnYpLW8qKHIqbS1pKnYpK2QqKHIqYS1pKnUpKSxlWzE1XT1uKih1KmgtYSpjKS1vKihyKmgtaSpjKStsKihyKmEtaSp1KSxlfSxjLmRldGVybWluYW50PWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM10scz1lWzRdLG89ZVs1XSx1PWVbNl0sYT1lWzddLGY9ZVs4XSxsPWVbOV0sYz1lWzEwXSxoPWVbMTFdLHA9ZVsxMl0sZD1lWzEzXSx2PWVbMTRdLG09ZVsxNV0sZz10Km8tbipzLHk9dCp1LXIqcyxiPXQqYS1pKnMsdz1uKnUtcipvLEU9biphLWkqbyxTPXIqYS1pKnUseD1mKmQtbCpwLFQ9Zip2LWMqcCxOPWYqbS1oKnAsQz1sKnYtYypkLGs9bCptLWgqZCxMPWMqbS1oKnY7cmV0dXJuIGcqTC15KmsrYipDK3cqTi1FKlQrUyp4fSxjLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD10WzldLHA9dFsxMF0sZD10WzExXSx2PXRbMTJdLG09dFsxM10sZz10WzE0XSx5PXRbMTVdLGI9blswXSx3PW5bMV0sRT1uWzJdLFM9blszXTtyZXR1cm4gZVswXT1iKnIrdyp1K0UqYytTKnYsZVsxXT1iKmkrdyphK0UqaCtTKm0sZVsyXT1iKnMrdypmK0UqcCtTKmcsZVszXT1iKm8rdypsK0UqZCtTKnksYj1uWzRdLHc9bls1XSxFPW5bNl0sUz1uWzddLGVbNF09YipyK3cqdStFKmMrUyp2LGVbNV09YippK3cqYStFKmgrUyptLGVbNl09YipzK3cqZitFKnArUypnLGVbN109YipvK3cqbCtFKmQrUyp5LGI9bls4XSx3PW5bOV0sRT1uWzEwXSxTPW5bMTFdLGVbOF09YipyK3cqdStFKmMrUyp2LGVbOV09YippK3cqYStFKmgrUyptLGVbMTBdPWIqcyt3KmYrRSpwK1MqZyxlWzExXT1iKm8rdypsK0UqZCtTKnksYj1uWzEyXSx3PW5bMTNdLEU9blsxNF0sUz1uWzE1XSxlWzEyXT1iKnIrdyp1K0UqYytTKnYsZVsxM109YippK3cqYStFKmgrUyptLGVbMTRdPWIqcyt3KmYrRSpwK1MqZyxlWzE1XT1iKm8rdypsK0UqZCtTKnksZX0sYy5tdWw9Yy5tdWx0aXBseSxjLnRyYW5zbGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV0scz1uWzJdLG8sdSxhLGYsbCxjLGgscCxkLHYsbSxnO3JldHVybiB0PT09ZT8oZVsxMl09dFswXSpyK3RbNF0qaSt0WzhdKnMrdFsxMl0sZVsxM109dFsxXSpyK3RbNV0qaSt0WzldKnMrdFsxM10sZVsxNF09dFsyXSpyK3RbNl0qaSt0WzEwXSpzK3RbMTRdLGVbMTVdPXRbM10qcit0WzddKmkrdFsxMV0qcyt0WzE1XSk6KG89dFswXSx1PXRbMV0sYT10WzJdLGY9dFszXSxsPXRbNF0sYz10WzVdLGg9dFs2XSxwPXRbN10sZD10WzhdLHY9dFs5XSxtPXRbMTBdLGc9dFsxMV0sZVswXT1vLGVbMV09dSxlWzJdPWEsZVszXT1mLGVbNF09bCxlWzVdPWMsZVs2XT1oLGVbN109cCxlWzhdPWQsZVs5XT12LGVbMTBdPW0sZVsxMV09ZyxlWzEyXT1vKnIrbCppK2Qqcyt0WzEyXSxlWzEzXT11KnIrYyppK3Yqcyt0WzEzXSxlWzE0XT1hKnIraCppK20qcyt0WzE0XSxlWzE1XT1mKnIrcCppK2cqcyt0WzE1XSksZX0sYy5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV0scz1uWzJdO3JldHVybiBlWzBdPXRbMF0qcixlWzFdPXRbMV0qcixlWzJdPXRbMl0qcixlWzNdPXRbM10qcixlWzRdPXRbNF0qaSxlWzVdPXRbNV0qaSxlWzZdPXRbNl0qaSxlWzddPXRbN10qaSxlWzhdPXRbOF0qcyxlWzldPXRbOV0qcyxlWzEwXT10WzEwXSpzLGVbMTFdPXRbMTFdKnMsZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0sZX0sYy5yb3RhdGU9ZnVuY3Rpb24oZSxuLHIsaSl7dmFyIHM9aVswXSxvPWlbMV0sdT1pWzJdLGE9TWF0aC5zcXJ0KHMqcytvKm8rdSp1KSxmLGwsYyxoLHAsZCx2LG0sZyx5LGIsdyxFLFMseCxULE4sQyxrLEwsQSxPLE0sXztyZXR1cm4gTWF0aC5hYnMoYSk8dD9udWxsOihhPTEvYSxzKj1hLG8qPWEsdSo9YSxmPU1hdGguc2luKHIpLGw9TWF0aC5jb3MociksYz0xLWwsaD1uWzBdLHA9blsxXSxkPW5bMl0sdj1uWzNdLG09bls0XSxnPW5bNV0seT1uWzZdLGI9bls3XSx3PW5bOF0sRT1uWzldLFM9blsxMF0seD1uWzExXSxUPXMqcypjK2wsTj1vKnMqYyt1KmYsQz11KnMqYy1vKmYsaz1zKm8qYy11KmYsTD1vKm8qYytsLEE9dSpvKmMrcypmLE89cyp1KmMrbypmLE09byp1KmMtcypmLF89dSp1KmMrbCxlWzBdPWgqVCttKk4rdypDLGVbMV09cCpUK2cqTitFKkMsZVsyXT1kKlQreSpOK1MqQyxlWzNdPXYqVCtiKk4reCpDLGVbNF09aCprK20qTCt3KkEsZVs1XT1wKmsrZypMK0UqQSxlWzZdPWQqayt5KkwrUypBLGVbN109diprK2IqTCt4KkEsZVs4XT1oKk8rbSpNK3cqXyxlWzldPXAqTytnKk0rRSpfLGVbMTBdPWQqTyt5Kk0rUypfLGVbMTFdPXYqTytiKk0reCpfLG4hPT1lJiYoZVsxMl09blsxMl0sZVsxM109blsxM10sZVsxNF09blsxNF0sZVsxNV09blsxNV0pLGUpfSxjLnJvdGF0ZVg9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPU1hdGguc2luKG4pLGk9TWF0aC5jb3Mobikscz10WzRdLG89dFs1XSx1PXRbNl0sYT10WzddLGY9dFs4XSxsPXRbOV0sYz10WzEwXSxoPXRbMTFdO3JldHVybiB0IT09ZSYmKGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSksZVs0XT1zKmkrZipyLGVbNV09byppK2wqcixlWzZdPXUqaStjKnIsZVs3XT1hKmkraCpyLGVbOF09ZippLXMqcixlWzldPWwqaS1vKnIsZVsxMF09YyppLXUqcixlWzExXT1oKmktYSpyLGV9LGMucm90YXRlWT1mdW5jdGlvbihlLHQsbil7dmFyIHI9TWF0aC5zaW4obiksaT1NYXRoLmNvcyhuKSxzPXRbMF0sbz10WzFdLHU9dFsyXSxhPXRbM10sZj10WzhdLGw9dFs5XSxjPXRbMTBdLGg9dFsxMV07cmV0dXJuIHQhPT1lJiYoZVs0XT10WzRdLGVbNV09dFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdKSxlWzBdPXMqaS1mKnIsZVsxXT1vKmktbCpyLGVbMl09dSppLWMqcixlWzNdPWEqaS1oKnIsZVs4XT1zKnIrZippLGVbOV09bypyK2wqaSxlWzEwXT11KnIrYyppLGVbMTFdPWEqcitoKmksZX0sYy5yb3RhdGVaPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1NYXRoLnNpbihuKSxpPU1hdGguY29zKG4pLHM9dFswXSxvPXRbMV0sdT10WzJdLGE9dFszXSxmPXRbNF0sbD10WzVdLGM9dFs2XSxoPXRbN107cmV0dXJuIHQhPT1lJiYoZVs4XT10WzhdLGVbOV09dFs5XSxlWzEwXT10WzEwXSxlWzExXT10WzExXSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSksZVswXT1zKmkrZipyLGVbMV09byppK2wqcixlWzJdPXUqaStjKnIsZVszXT1hKmkraCpyLGVbNF09ZippLXMqcixlWzVdPWwqaS1vKnIsZVs2XT1jKmktdSpyLGVbN109aCppLWEqcixlfSxjLmZyb21Sb3RhdGlvblRyYW5zbGF0aW9uPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9cityLGE9aStpLGY9cytzLGw9cip1LGM9ciphLGg9cipmLHA9aSphLGQ9aSpmLHY9cypmLG09byp1LGc9byphLHk9bypmO3JldHVybiBlWzBdPTEtKHArdiksZVsxXT1jK3ksZVsyXT1oLWcsZVszXT0wLGVbNF09Yy15LGVbNV09MS0obCt2KSxlWzZdPWQrbSxlWzddPTAsZVs4XT1oK2csZVs5XT1kLW0sZVsxMF09MS0obCtwKSxlWzExXT0wLGVbMTJdPW5bMF0sZVsxM109blsxXSxlWzE0XT1uWzJdLGVbMTVdPTEsZX0sYy5mcm9tUXVhdD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uK24sdT1yK3IsYT1pK2ksZj1uKm8sbD1uKnUsYz1uKmEsaD1yKnUscD1yKmEsZD1pKmEsdj1zKm8sbT1zKnUsZz1zKmE7cmV0dXJuIGVbMF09MS0oaCtkKSxlWzFdPWwrZyxlWzJdPWMtbSxlWzNdPTAsZVs0XT1sLWcsZVs1XT0xLShmK2QpLGVbNl09cCt2LGVbN109MCxlWzhdPWMrbSxlWzldPXAtdixlWzEwXT0xLShmK2gpLGVbMTFdPTAsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTAsZVsxNV09MSxlfSxjLmZydXN0dW09ZnVuY3Rpb24oZSx0LG4scixpLHMsbyl7dmFyIHU9MS8obi10KSxhPTEvKGktciksZj0xLyhzLW8pO3JldHVybiBlWzBdPXMqMip1LGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPXMqMiphLGVbNl09MCxlWzddPTAsZVs4XT0obit0KSp1LGVbOV09KGkrcikqYSxlWzEwXT0obytzKSpmLGVbMTFdPS0xLGVbMTJdPTAsZVsxM109MCxlWzE0XT1vKnMqMipmLGVbMTVdPTAsZX0sYy5wZXJzcGVjdGl2ZT1mdW5jdGlvbihlLHQsbixyLGkpe3ZhciBzPTEvTWF0aC50YW4odC8yKSxvPTEvKHItaSk7cmV0dXJuIGVbMF09cy9uLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPXMsZVs2XT0wLGVbN109MCxlWzhdPTAsZVs5XT0wLGVbMTBdPShpK3IpKm8sZVsxMV09LTEsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTIqaSpyKm8sZVsxNV09MCxlfSxjLm9ydGhvPWZ1bmN0aW9uKGUsdCxuLHIsaSxzLG8pe3ZhciB1PTEvKHQtbiksYT0xLyhyLWkpLGY9MS8ocy1vKTtyZXR1cm4gZVswXT0tMip1LGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPS0yKmEsZVs2XT0wLGVbN109MCxlWzhdPTAsZVs5XT0wLGVbMTBdPTIqZixlWzExXT0wLGVbMTJdPSh0K24pKnUsZVsxM109KGkrcikqYSxlWzE0XT0obytzKSpmLGVbMTVdPTEsZX0sYy5sb29rQXQ9ZnVuY3Rpb24oZSxuLHIsaSl7dmFyIHMsbyx1LGEsZixsLGgscCxkLHYsbT1uWzBdLGc9blsxXSx5PW5bMl0sYj1pWzBdLHc9aVsxXSxFPWlbMl0sUz1yWzBdLHg9clsxXSxUPXJbMl07cmV0dXJuIE1hdGguYWJzKG0tUyk8dCYmTWF0aC5hYnMoZy14KTx0JiZNYXRoLmFicyh5LVQpPHQ/Yy5pZGVudGl0eShlKTooaD1tLVMscD1nLXgsZD15LVQsdj0xL01hdGguc3FydChoKmgrcCpwK2QqZCksaCo9dixwKj12LGQqPXYscz13KmQtRSpwLG89RSpoLWIqZCx1PWIqcC13Kmgsdj1NYXRoLnNxcnQocypzK28qbyt1KnUpLHY/KHY9MS92LHMqPXYsbyo9dix1Kj12KToocz0wLG89MCx1PTApLGE9cCp1LWQqbyxmPWQqcy1oKnUsbD1oKm8tcCpzLHY9TWF0aC5zcXJ0KGEqYStmKmYrbCpsKSx2Pyh2PTEvdixhKj12LGYqPXYsbCo9dik6KGE9MCxmPTAsbD0wKSxlWzBdPXMsZVsxXT1hLGVbMl09aCxlWzNdPTAsZVs0XT1vLGVbNV09ZixlWzZdPXAsZVs3XT0wLGVbOF09dSxlWzldPWwsZVsxMF09ZCxlWzExXT0wLGVbMTJdPS0ocyptK28qZyt1KnkpLGVbMTNdPS0oYSptK2YqZytsKnkpLGVbMTRdPS0oaCptK3AqZytkKnkpLGVbMTVdPTEsZSl9LGMuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwibWF0NChcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiLCBcIitlWzRdK1wiLCBcIitlWzVdK1wiLCBcIitlWzZdK1wiLCBcIitlWzddK1wiLCBcIitlWzhdK1wiLCBcIitlWzldK1wiLCBcIitlWzEwXStcIiwgXCIrZVsxMV0rXCIsIFwiK2VbMTJdK1wiLCBcIitlWzEzXStcIiwgXCIrZVsxNF0rXCIsIFwiK2VbMTVdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUubWF0ND1jKTt2YXIgaD17fTtoLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDQpO3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0saC5yb3RhdGlvblRvPWZ1bmN0aW9uKCl7dmFyIGU9by5jcmVhdGUoKSx0PW8uZnJvbVZhbHVlcygxLDAsMCksbj1vLmZyb21WYWx1ZXMoMCwxLDApO3JldHVybiBmdW5jdGlvbihyLGkscyl7dmFyIHU9by5kb3QoaSxzKTtyZXR1cm4gdTwtMC45OTk5OTk/KG8uY3Jvc3MoZSx0LGkpLG8ubGVuZ3RoKGUpPDFlLTYmJm8uY3Jvc3MoZSxuLGkpLG8ubm9ybWFsaXplKGUsZSksaC5zZXRBeGlzQW5nbGUocixlLE1hdGguUEkpLHIpOnU+Ljk5OTk5OT8oclswXT0wLHJbMV09MCxyWzJdPTAsclszXT0xLHIpOihvLmNyb3NzKGUsaSxzKSxyWzBdPWVbMF0sclsxXT1lWzFdLHJbMl09ZVsyXSxyWzNdPTErdSxoLm5vcm1hbGl6ZShyLHIpKX19KCksaC5zZXRBeGVzPWZ1bmN0aW9uKCl7dmFyIGU9bC5jcmVhdGUoKTtyZXR1cm4gZnVuY3Rpb24odCxuLHIsaSl7cmV0dXJuIGVbMF09clswXSxlWzNdPXJbMV0sZVs2XT1yWzJdLGVbMV09aVswXSxlWzRdPWlbMV0sZVs3XT1pWzJdLGVbMl09blswXSxlWzVdPW5bMV0sZVs4XT1uWzJdLGgubm9ybWFsaXplKHQsaC5mcm9tTWF0Myh0LGUpKX19KCksaC5jbG9uZT11LmNsb25lLGguZnJvbVZhbHVlcz11LmZyb21WYWx1ZXMsaC5jb3B5PXUuY29weSxoLnNldD11LnNldCxoLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0saC5zZXRBeGlzQW5nbGU9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPU1hdGguc2luKG4pO3JldHVybiBlWzBdPXIqdFswXSxlWzFdPXIqdFsxXSxlWzJdPXIqdFsyXSxlWzNdPU1hdGguY29zKG4pLGV9LGguYWRkPXUuYWRkLGgubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXSxmPW5bMl0sbD1uWzNdO3JldHVybiBlWzBdPXIqbCtvKnUraSpmLXMqYSxlWzFdPWkqbCtvKmErcyp1LXIqZixlWzJdPXMqbCtvKmYrciphLWkqdSxlWzNdPW8qbC1yKnUtaSphLXMqZixlfSxoLm11bD1oLm11bHRpcGx5LGguc2NhbGU9dS5zY2FsZSxoLnJvdGF0ZVg9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1NYXRoLnNpbihuKSxhPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqYStvKnUsZVsxXT1pKmErcyp1LGVbMl09cyphLWkqdSxlWzNdPW8qYS1yKnUsZX0saC5yb3RhdGVZPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmEtcyp1LGVbMV09aSphK28qdSxlWzJdPXMqYStyKnUsZVszXT1vKmEtaSp1LGV9LGgucm90YXRlWj1mdW5jdGlvbihlLHQsbil7bio9LjU7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphK2kqdSxlWzFdPWkqYS1yKnUsZVsyXT1zKmErbyp1LGVbM109byphLXMqdSxlfSxoLmNhbGN1bGF0ZVc9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl07cmV0dXJuIGVbMF09bixlWzFdPXIsZVsyXT1pLGVbM109LU1hdGguc3FydChNYXRoLmFicygxLW4qbi1yKnItaSppKSksZX0saC5kb3Q9dS5kb3QsaC5sZXJwPXUubGVycCxoLnNsZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdLG89dFsyXSx1PXRbM10sYT1uWzBdLGY9blsxXSxsPW5bMl0sYz1uWzNdLGgscCxkLHYsbTtyZXR1cm4gcD1pKmErcypmK28qbCt1KmMscDwwJiYocD0tcCxhPS1hLGY9LWYsbD0tbCxjPS1jKSwxLXA+MWUtNj8oaD1NYXRoLmFjb3MocCksZD1NYXRoLnNpbihoKSx2PU1hdGguc2luKCgxLXIpKmgpL2QsbT1NYXRoLnNpbihyKmgpL2QpOih2PTEtcixtPXIpLGVbMF09dippK20qYSxlWzFdPXYqcyttKmYsZVsyXT12Km8rbSpsLGVbM109dip1K20qYyxlfSxoLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uKm4rcipyK2kqaStzKnMsdT1vPzEvbzowO3JldHVybiBlWzBdPS1uKnUsZVsxXT0tcip1LGVbMl09LWkqdSxlWzNdPXMqdSxlfSxoLmNvbmp1Z2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZVsyXT0tdFsyXSxlWzNdPXRbM10sZX0saC5sZW5ndGg9dS5sZW5ndGgsaC5sZW49aC5sZW5ndGgsaC5zcXVhcmVkTGVuZ3RoPXUuc3F1YXJlZExlbmd0aCxoLnNxckxlbj1oLnNxdWFyZWRMZW5ndGgsaC5ub3JtYWxpemU9dS5ub3JtYWxpemUsaC5mcm9tTWF0Mz1mdW5jdGlvbigpe3ZhciBlPXR5cGVvZiBJbnQ4QXJyYXkhPVwidW5kZWZpbmVkXCI/bmV3IEludDhBcnJheShbMSwyLDBdKTpbMSwyLDBdO3JldHVybiBmdW5jdGlvbih0LG4pe3ZhciByPW5bMF0rbls0XStuWzhdLGk7aWYocj4wKWk9TWF0aC5zcXJ0KHIrMSksdFszXT0uNSppLGk9LjUvaSx0WzBdPShuWzddLW5bNV0pKmksdFsxXT0oblsyXS1uWzZdKSppLHRbMl09KG5bM10tblsxXSkqaTtlbHNle3ZhciBzPTA7bls0XT5uWzBdJiYocz0xKSxuWzhdPm5bcyozK3NdJiYocz0yKTt2YXIgbz1lW3NdLHU9ZVtvXTtpPU1hdGguc3FydChuW3MqMytzXS1uW28qMytvXS1uW3UqMyt1XSsxKSx0W3NdPS41KmksaT0uNS9pLHRbM109KG5bdSozK29dLW5bbyozK3VdKSppLHRbb109KG5bbyozK3NdK25bcyozK29dKSppLHRbdV09KG5bdSozK3NdK25bcyozK3VdKSppfXJldHVybiB0fX0oKSxoLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInF1YXQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnF1YXQ9aCl9KHQuZXhwb3J0cyl9KSh0aGlzKTtcbiIsIi8qXG5yZXF1aXJlanMuY29uZmlnKHtcbiAgICBwYXRoczoge1xuICAgICAgICAnaGFtbWVyJzogJ2xpYnMvSGFtbWVyJyxcbiAgICAgICAgJ0FuaW1hdGVkX0dJRic6ICdsaWJzL0FuaW1hdGVkX0dJRi9BbmltYXRlZF9HSUYnLFxuICAgICAgICAnR2lmV3JpdGVyJzogJ2xpYnMvQW5pbWF0ZWRfR0lGL29tZ2dpZidcbiAgICB9LFxuICAgIHNoaW06IHtcbiAgICAgICAgJ2hhbW1lcic6IFtdLFxuICAgICAgICAnQW5pbWF0ZWRfR0lGJzogWydHaWZXcml0ZXInXSxcbiAgICB9XG59KTtcblxuXG5yZXF1aXJlKFxuICAgIFsnYXBwJ10sXG4gICAgZnVuY3Rpb24oQXBwKSB7XG4gICAgICAgIFxuICAgICAgICB2YXIgYXBwID0gbmV3IEFwcChyZXBvcnRFcnJvciwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGFwcC5vcGVuR2FsbGVyeSgpO1xuXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy8gfn5+XG5cbiAgICAgICAgZnVuY3Rpb24gcmVwb3J0RXJyb3IobWVzc2FnZSkge1xuXG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIGVycm9yLmNsYXNzTmFtZSA9ICdtb2RhbCBlcnJvcic7XG5cbiAgICAgICAgICAgIGlmKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGVycm9yLmlubmVySFRNTCA9IG1lc3NhZ2UucmVwbGFjZSgvXFxuL2csICc8YnIgLz4nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHR4dCA9ICdFcnJvciB0cnlpbmcgdG8gYWNjZXNzIHRoZSBjYW1lcmEuPGJyIC8+PGJyIC8+QXJlIHlvdSB0cnlpbmcgdG8gcnVuIHRoaXMgbG9jYWxseT8nO1xuICAgICAgICAgICAgICAgIGlmKG1lc3NhZ2UuY29kZSkge1xuICAgICAgICAgICAgICAgICAgICB0eHQgKz0gJzxiciAvPjxiciAvPihFcnJvciBjb2RlID0gJyArIG1lc3NhZ2UuY29kZSArICcpJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZXJyb3IuaW5uZXJIVE1MID0gdHh0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVycm9yKTtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbik7Ki9cblxuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29tcG9uZW50c0xvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICAgIGNvbnNvbGUubG9nKCdoZXkgZm9sa3MnKTtcbiAgICB2YXIgQXBwID0gcmVxdWlyZSgnLi9BcHAnKTtcblxuICAgIHZhciBhcHAgPSBuZXcgQXBwKHJlcG9ydEVycm9yLCBmdW5jdGlvbigpIHtcbiAgICAgICAgXG4gICAgICAgIGFwcC5vcGVuR2FsbGVyeSgpO1xuXG4gICAgfSk7XG5cblxuICAgIC8vIH5+flxuXG4gICAgZnVuY3Rpb24gcmVwb3J0RXJyb3IobWVzc2FnZSkge1xuXG4gICAgICAgIHZhciBlcnJvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBlcnJvci5jbGFzc05hbWUgPSAnbW9kYWwgZXJyb3InO1xuXG4gICAgICAgIGlmKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgZXJyb3IuaW5uZXJIVE1MID0gbWVzc2FnZS5yZXBsYWNlKC9cXG4vZywgJzxiciAvPicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHR4dCA9ICdFcnJvciB0cnlpbmcgdG8gYWNjZXNzIHRoZSBjYW1lcmEuPGJyIC8+PGJyIC8+QXJlIHlvdSB0cnlpbmcgdG8gcnVuIHRoaXMgbG9jYWxseT8nO1xuICAgICAgICAgICAgaWYobWVzc2FnZS5jb2RlKSB7XG4gICAgICAgICAgICAgICAgdHh0ICs9ICc8YnIgLz48YnIgLz4oRXJyb3IgY29kZSA9ICcgKyBtZXNzYWdlLmNvZGUgKyAnKSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGVycm9yLmlubmVySFRNTCA9IHR4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZXJyb3IpO1xuXG4gICAgfVxuXG5cbn0pO1xuIl19
;