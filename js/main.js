
requirejs.config({
    paths: {
        'hammer': 'libs/Hammer'
    },
    shim: {
        'hammer': []
    }
});

require(
    ['app'],
    function(App) {
        
        var app = new App(reportError, function() {
            
            // TODO url parse and switch to according 'page'
            app.gotoCamera();

        });


        // ~~~

        function reportError(e) {
            console.log('aaah the drama!', e);
        }

    }

);
