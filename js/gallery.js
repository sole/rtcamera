(function() {

    var IMGUR_KEY = '49c42af902d1fd4';

    var backButton = document.getElementById('menuButton');
    var galleryContainer = document.getElementById('galleryContainer');
    var galleryDetails = document.getElementById('galleryDetails');
    var galleryPictures = {};
    
    backButton.style.opacity = '1';
    backButton.style.display = 'block';

    galleryContainer.addEventListener('click', function(ev) {
        var target = ev.target;
        if(target && target.nodeName === 'IMG') {
            showDetails(target.dataset['id']);
        } else {
            closeDetails();
        }
    }, false);

    Picture.fixList(updateGallery);

    // ~~~
    
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

    function getPictureById(pictureId) {
        console.log('get pic by id', pictureId);
        return galleryPictures[pictureId];
    }

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
            urlDiv.innerHTML = 'Share: <input type="text" value="' + imgur + '"> <a href="' + imgur + '" target="_blank">(open)</a>';
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
        if(picture.previousPicture === null) {
            return;
        } else {
            showDetails(picture.previousPicture.id);
        }

    }


    function showNextPicture(currentId) {

        var picture = getPictureById(currentId);
        if(picture.nextPicture === null) {
            return;
        } else {
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


    function uploadPicture(pictureId, picture) {
        
        var image = picture.imageData.replace(/^data:image\/(png|gif);base64,/, "");

        var fd = new FormData();
        fd.append("image", image);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.imgur.com/3/upload.json');
        xhr.setRequestHeader('Authorization', 'Client-ID ' + IMGUR_KEY);
        xhr.onload = function() {
            console.log(xhr.responseText);
            try {
                var response = JSON.parse(xhr.responseText);
                if(response.success) {
                    var url = response.data.link;

                    console.log(response);
                    console.log(url);

                    picture.imgurURL = url;

                    picture.save(function() {
                        console.log('pic saved!');
                    });
                } else {
                    console.log('error uploading :-/');
                    console.log(response);
                }
                
            } catch(err) {
                console.error(err);
            }
        };

        // TODO error handling
        xhr.send(fd);

    }

})();
