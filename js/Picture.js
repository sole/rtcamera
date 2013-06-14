// This class will be used to store and retrieve taken pictures and some
// associated metadata, using IndexedDB
var Picture = (function() {

    var PICTURES_LIST_KEY = 'pictures_list';
    var PICTURE_PREFIX = 'picture_';

    function getPicturesList(callback) {
        var list;

        asyncStorage.getItem(PICTURES_LIST_KEY, function(list) {
            if(!list) {
                list = [];
            }

            callback(list);
        });
    }

    function savePicturesList(updatedList) {
        asyncStorage.setItem(PICTURES_LIST_KEY, updatedList);
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

        this.save = function(callback) {
            
            if(self.id === null) {
                self.id = PICTURE_PREFIX + getTimestamp();
            }

            if(self.imageIsAnimated === null) {
                self.imageIsAnimated = guessIsImageAnimated(this.imageData);
            }

            // Saving stuff
            asyncStorage.setItem(self.id, {
                imageData: this.imageData,
                imageIsAnimated: this.imageIsAnimated
            }, function() {
                addToPicturesList(self.id);
                callback();
            });
        };

    };

    Pic.getAll = function(callback/* numItemsPerPage, page */) {

        getPicturesList(function(list) {
 
            var pictures = [];
            var position = 0; // (page - 1) * numItemsPerPage
            
            loadPicture(position);

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
            var picture = new Pic();
            picture.id = id;
            picture.imageData = value.imageData || null;
            picture.imageIsAnimated = value.imageIsAnimated || null;

            callback(picture);
        });
    };

    return Pic;
})();
