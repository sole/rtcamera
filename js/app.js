// do the require.js dance
define(['libs/Hammer', 'Renderer'], function(Hammer, Renderer) {
    
    'use strict';

    var App = function(errorCallback, readyCallback) {

        this.activePage = null; // XXX

        this.initUI();
        this.initMedia(errorCallback, readyCallback);

    };

    /**
     * Find UI elements and attach events to them
     */
    App.prototype.initUI = function() {

        var self = this;

        this.deck = document.querySelector('x-deck');
        /*Hammer(this.deck)
            .on('swipeleft', self.previousEffect.bind(self))
            .on('swiperight', self.nextEffect.bind(self));*/

        var pages = {};
        ['gallery', 'detail', 'camera', 'pickFile'].forEach(function(id) {
            var page = document.getElementById(id);
            pages[id] = page;
        });
        this.pages = pages;

        var btnGallery = document.getElementById('btnGallery');
        btnGallery.addEventListener('click', self.gotoGallery.bind(self));
        this.btnGallery = btnGallery;

        var btnCamera = document.getElementById('btnCamera');
        btnCamera.addEventListener('click', self.gotoCamera.bind(self), false);

        document.getElementById('btnPicker').addEventListener('click', self.gotoStatic.bind(self), false);

    };

    /**
     * Initialise WebGL and WebRTC related stuff
     */
    App.prototype.initMedia = function(errorCallback, readyCallback) {
        this.renderer = new Renderer(errorCallback, readyCallback);
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

    // TODO maybe this.renderer.isPaused()
    App.prototype.isUsingTheRenderer = function() {
        return this.activePage === 'camera' || this.activePage === 'pickFile';
    };

    App.prototype.previousEffect = function() {
        if(this.isUsingTheRenderer()) {
            this.renderer.previousEffect();
        }
    };

    App.prototype.nextEffect = function() {
        if(this.isUsingTheRenderer()) {
            this.renderer.nextEffect();
        }
    };


    return App;
});
