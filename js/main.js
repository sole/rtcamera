//window.addEventListener('DOMComponentsLoaded', function() {
    console.log('loaded');
    require(
        ['app'],
        function(App) {

            var app = new App();
            //app.initUI();

            // TODO url parse and switch to according 'page'
            app.gotoGallery();
        }
    );
//});
