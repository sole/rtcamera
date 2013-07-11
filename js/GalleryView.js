define([], function() {

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
        
        this.domElement = root;


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

    return GalleryView;
});
