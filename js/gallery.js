(function() {
    
    var backButton = document.getElementById('menuButton');
    var galleryContainer = document.getElementById('galleryContainer');
    var galleryDetails = document.getElementById('galleryDetails');

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

            pictures.forEach(function(pic) {
                var img = document.createElement('img');
                img.src = pic.imageData;
                img.dataset['id'] = pic.id;
                galleryContainer.appendChild(img);
            });
        });

    }

    function showDetails(pictureId) {

        galleryDetails.innerHTML = 'Loading...';

        Picture.getById(pictureId, function(picture) {
            var img = document.createElement('img');
            img.src = picture.imageData;

            var actions = [
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

            galleryDetails.innerHTML = '';
            galleryDetails.appendChild(img);
            galleryDetails.appendChild(actionsDiv);

            galleryDetails.removeAttribute('hidden');
        });

    }

    function closeDetails() {
        galleryDetails.innerHTML = '';
        galleryDetails.setAttribute('hidden');
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

})();
