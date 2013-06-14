(function() {

    Picture.getAll(function(pictures) {
        
        var galleryContainer = document.getElementById('galleryContainer');

        galleryContainer.innerHTML = '';

        pictures.forEach(function(pic) {
            var img = document.createElement('img');
            img.src = pic.imageData;
            console.log(pic);
            galleryContainer.appendChild(img);
        });
    });

})();
