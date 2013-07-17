function MiniRouter() {

    var that = this,
        routes = {},
        windowObject = null;


    this.reset = function() {

        routes = {};

    };


    this.add = function(name, path, callback) {

        console.log('add', name, path);
        routes[name] = {
            path: path,
            callback: callback

        };
    };


    this.navigate = function(name, args) {

        console.log('navigate to', name, args);

        if(routes[name]) {

            var route = routes[name];
            var path = route.path;

            if(windowObject) {

                for(var k in args) {
                    path = path.replace(':' + k, args[k]);
                }
                windowObject.history.pushState({ name: name, args: args }, '', path);

            }

            route.callback(args);

        } else {

            console.error('Unknown route', name);

        }

    };


    this.attachTo = function(win) {

        console.log('attach to', win);
        
        windowObject = win;

        windowObject.addEventListener('popstate', function(e) {

            console.log('pop!', e);
            var state = e.state;

            if(state.name) {

                that.navigate(state.name, state.args);

            }

        }, false);

    };

}

if(define) {
    define([], function() {
        return MiniRouter;
    });
}
