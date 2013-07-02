
requirejs.config({
    paths: {
        'hammer': 'libs/Hammer',
        'Animated_GIF': 'libs/Animated_GIF/Animated_GIF',
        'GifWriter': 'libs/Animated_GIF/omggif'
    },
    shim: {
        'hammer': [],
        'Animated_GIF': ['GifWriter']
    }
});

require(
    ['app'],
    function(App) {
        
        var app = new App(reportError, function() {
            
            // TODO url parse and switch to according 'page'
            app.gotoCamera();
            // app.gotoGallery();

        });


        // ~~~

        function reportError(e) {
            console.log('aaah the drama!', e);
        }

    }

);
