
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

        function reportError(e) {
            console.log('aaah the drama!', e);
        }

    }

);
