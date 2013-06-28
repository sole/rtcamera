// do the require.js dance
define(['hammer', 'Renderer', 'gumHelper'], function(Hammer, Renderer, gumHelper) {
    
    'use strict';

    var App = function(errorCallback, readyCallback) {

        this.activePage = null;

        this.initUI();

        var that = this;

        this.initRenderer(errorCallback, function() {

            var canvas = that.renderer.domElement;
            Hammer(canvas)
                .on('swipeleft', that.renderer.previousEffect)
                .on('swiperight', that.renderer.nextEffect);
            readyCallback();

        });

    };

    /**
     * Find UI elements and attach events to them
     */
    App.prototype.initUI = function() {

        var that = this;

        this.deck = document.querySelector('x-deck');
        
        var pages = {};
        ['gallery', 'detail', 'camera', 'pickFile'].forEach(function(id) {
            var page = document.getElementById(id);
            pages[id] = page;
        });
        this.pages = pages;


        var btnGallery = document.getElementById('btnGallery');
        btnGallery.addEventListener('click', that.gotoGallery.bind(that));
        this.btnGallery = btnGallery;


        var btnCamera = document.getElementById('btnCamera');
        btnCamera.addEventListener('click', that.gotoCamera.bind(that), false);

        // Hide the camera button is there's likely no support for WebRTC
        if(!navigator.getMedia) {
            btnCamera.style.display = 'none';
        }


        document.getElementById('btnPicker').addEventListener('click', that.gotoStatic.bind(that), false);

    };

    /**
     * Initialise Renderer
     */
    App.prototype.initRenderer = function(errorCallback, readyCallback) {
        this.renderer = new Renderer(errorCallback, readyCallback);
    };

    App.prototype.showPage = function(id) {

        if(id !== 'gallery') {
            this.btnGallery.classList.remove('hidden');
        } else {
            this.btnGallery.classList.add('hidden');
        }

        this.activePage = id;

        this.pages[id].show();
    };

    App.prototype.gotoGallery = function() {
        this.showPage('gallery');
    };

    App.prototype.gotoDetail = function() {
        this.showPage('detail');
    };

    App.prototype.gotoCamera = function() {
        this.attachRendererCanvasToPage('camera');
        this.showPage('camera');
    };

    App.prototype.gotoStatic = function() {
        this.attachRendererCanvasToPage('pickFile');
        this.showPage('pickFile');
    };

    App.prototype.attachRendererCanvasToPage = function(pageId) {
        var canvas = this.renderer.domElement;
        if(canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
        this.pages[pageId].querySelector('.canvasContainer').appendChild(canvas);
        // TODO clear canvas
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
