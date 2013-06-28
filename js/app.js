var App = function() {
    this.initUI();
};

/**
 * Find UI elements and attach events to them
 */
App.prototype.initUI = function() {

    var self = this;

    this.deck = document.querySelector('x-deck');

    var pages = {};
    ['gallery', 'detail', 'camera', 'pickFile'].forEach(function(id) {
        var page = document.getElementById(id);
        pages[id] = page;
    });
    this.pages = pages;

    var btnGallery = document.getElementById('btnGallery');
    btnGallery.addEventListener('click', function() {
        self.gotoGallery();
    });
    this.btnGallery = btnGallery;

    var btnCamera = document.getElementById('btnCamera');
    btnCamera.addEventListener('click', self.gotoCamera.bind(self), false);

    document.getElementById('btnPicker').addEventListener('click', self.gotoStatic.bind(self), false);


};

App.prototype.showPage = function(id) {

    if(id !== 'gallery') {
        this.btnGallery.classList.remove('hidden');
    } else {
        this.btnGallery.classList.add('hidden');
    }

    this.pages[id].show();
};

App.prototype.gotoGallery = function() {
    this.showPage('gallery');
};

App.prototype.gotoDetail = function() {
    this.showPage('detail');
};

App.prototype.gotoCamera = function() {
    this.showPage('camera');
};

App.prototype.gotoStatic = function() {
    this.showPage('pickFile');
};


// do the require.js dance
define([], function() {
    return App;
});
