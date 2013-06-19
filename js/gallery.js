/**
 * Displays the gallery and picture details page
 */
(function() {

    var IMGUR_KEY = '49c42af902d1fd4';

    var backButton = document.getElementById('menuButton');
    var galleryContainer = document.getElementById('galleryContainer');
    var galleryDetails = document.getElementById('galleryDetails');
    var galleryPictures = {};
    
    backButton.style.opacity = '1';
    backButton.style.display = 'block';

    // We'll be using 'event delegation' to avoid having to update listeners
    // if pictures are deleted
    galleryContainer.addEventListener('click', function(ev) {

        var target = ev.target;
        if(target && target.nodeName === 'IMG') {

            showDetails(target.dataset['id']);

        } else {

            closeDetails();

        }

    }, false);

    // Ensure the database & index are in good shape, then show the gallery
    Picture.fixList(updateGallery);


    // ~~~
    

    /**
     * This function grabs all the pictures in the database, iterates through
     * the array to build an "index" using the galleryPictures object, and also
     * sets the nextPicture and previousPicture properties of each picture to the
     * appropriate values, so that it's faster to navigate later on, without having
     * to run additionaly queries (as we already have all the required data).
     *
     * It also renders the gallery itself, which is basically a bunch of IMG elements.
     */
    function updateGallery() {
        
        Picture.getAll(function(pictures) {

            galleryContainer.innerHTML = '';

            var numPictures = pictures.length;
            galleryPictures = {};

            if(numPictures) {

                galleryContainer.classList.remove('empty');

                pictures.forEach(function(pic, position) {
                
                    pic.previousPicture = position > 0 ? pictures[position - 1] : null;
                    pic.nextPicture = position < numPictures - 1 ? pictures[position + 1] : null;
                    galleryPictures[pic.id] = pic;
                    
                    var img = document.createElement('img');
                    img.src = pic.imageData;
                    img.dataset['id'] = pic.id;
                    galleryContainer.appendChild(img);

                });

            } else {

                galleryContainer.classList.add('empty');
                galleryContainer.innerHTML = '<div class="modal">Boo, no pictures (yet!)</div>';

            }

        });

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

        showLoadingDetails();

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


        var actions = [
            { text: 'Share with imgur', action: uploadPicture },
            { text: 'Download', action: downloadPicture },
            { text: 'Delete', action: deletePicture }
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
        galleryDetails.appendChild(actionsDiv);
        actionsDiv.appendChild(urlDiv);

        galleryDetails.removeAttribute('hidden');

    }


    function showLoadingDetails() {
        
        galleryDetails.innerHTML = 'Loading...';

    }


    function closeDetails() {

        galleryDetails.innerHTML = '';
        galleryDetails.setAttribute('hidden');

    }


    function showPrevPicture(currentId) {

        var picture = getPictureById(currentId);
        if(picture.previousPicture) {
            showDetails(picture.previousPicture.id);
        }

    }


    function showNextPicture(currentId) {

        var picture = getPictureById(currentId);
        if(picture.nextPicture) {
            showDetails(picture.nextPicture.id);
        }

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
            closeDetails();
            Picture.deleteById(pictureId, updateGallery);
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

        var div = document.createElement('div');
        div.innerHTML = 'Uploading...';
        div.id = 'galleryUploading';
        div.classList.add('modal');
        galleryDetails.appendChild(div);


        var xhr = new XMLHttpRequest();
        
        xhr.open('POST', 'https://api.imgur.com/3/upload.json');
        xhr.setRequestHeader('Authorization', 'Client-ID ' + IMGUR_KEY);

        xhr.onload = function() {

            galleryDetails.removeChild(div);
            
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

        xhr.onerror = uploadPictureError;

        xhr.send(fd);

    }

    function uploadPictureError() {
        new Toast('Error posting picture :-/').show();
    }

})();
