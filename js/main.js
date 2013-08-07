
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

);
