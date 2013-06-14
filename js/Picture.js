// This class will be used to store and retrieve taken pictures and some
// associated metadata, using IndexedDB
var Picture = (function() {

    var PICTURES_INDEX_KEY = 'pictures_index';
    var PICTURE_PREFIX = 'picture_';

    function loadPicturesIndex(callback) {
        var index;

        asyncStorage.getItem(PICTURES_INDEX_KEY, function(dbIndex) {
            console.log('this is what the pic ind is', dbIndex);
            if(!dbIndex) {
                dbIndex = [];
            }

            callback(dbIndex);
        });
    }

    function savePicturesIndex(updatedIndex) {
        asyncStorage.setItem(PICTURES_INDEX_KEY, updatedIndex);
    }

    function addToIndex(pictureId) {
        loadPicturesIndex(function(index) {
            // No duplicates! (for when updating)
            if(index.indexOf(pictureId) === -1) {
                index.push(pictureId);
                savePicturesIndex(index);
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
        var animated = null;

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
                self.id = getTimestamp();
            }

            if(self.imageIsAnimated === null) {
                self.imageIsAnimated = guessIsImageAnimated(this.imageData);
            }

            // Saving stuff
            asyncStorage.setItem(PICTURE_PREFIX + self.id, {
                imageData: this.imageData,
                imageIsAnimated: this.imageIsAnimated
            }, function() {
                addToIndex(self.id);
                callback();
            });
        };

    };

    Pic.getAll = function() {
        console.log('get all');
    };

    return Pic;
})();
