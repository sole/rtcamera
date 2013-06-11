var Renderer = function(canvas, errorCallback, readyCallback) {
    'use strict';

    var gl;
    var effects = [];
    var effectDefinitions = {
        'Dithering': { vertex: 'plane.vs', fragment: 'dithering.fs' },
        'Posterize': { vertex: 'plane.vs', fragment: 'posterize.fs' }
    };
    var activeEffect = null;
    var shadersReady = false;
    var shaderProgram;
    var vertexPositionBuffer;
    var uvBuffer;
    var mvMatrix;
    var pMatrix;
    var texture;
    var onErrorCallback = errorCallback || function() {};
    var onReadyCallback = readyCallback || function() {};

    gl = initWebGL(canvas);
    initWebGLBuffers();
    initTexture();
    loadEffects();

    function initWebGL(canvas) {

        var gl = null;
        var options = { preserveDrawingBuffer: true };

        gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;

        gl.shadersCache = {};

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        return gl;

    }

    function initWebGLBuffers() {

        vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
        var vertices = [
            1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
            1.0, -1.0,  0.0,
            -1.0, -1.0,  0.0
        ];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        vertexPositionBuffer.itemSize = 3;
        vertexPositionBuffer.numItems = 4;

        uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

        var uvs = [
            1.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            0.0, 0.0
        ];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
        uvBuffer.itemSize = 2;
        uvBuffer.numItems = 4;

        mvMatrix = mat4.create();
        pMatrix = mat4.create();

    }

    function initTexture() {

        texture = gl.createTexture();

    }

    function loadEffects() {
        // We always need to load some common shader code, so add those to the
        // list to start with
        var files = ['common.vs', 'common.fs'];

        // then collect all file names from the effect definitions
        for(var k in effectDefinitions) {
            
            var def = effectDefinitions[k];
            files.push(def.vertex);
            files.push(def.fragment);

        }

        // And load each shader file. When done, we can initialise the effects.
        loadShaders(files, onErrorCallback, function(shaders) {
            initialiseEffects(shaders);
        });

    }

    // We will be loading shader files sequentially
    function loadShaders(files, errorCallback, doneCallback) {
        var directory = 'shaders/';
        var loaded = {};
        var filesToLoad = files.slice(0);

        loadNextShader();
        
        //
        
        function loadNextShader() {

            if(filesToLoad.length > 0) {
                setTimeout(function() {
                    loadShader(filesToLoad.shift());
                }, 1);
            } else {
                doneCallback(loaded);
            }

        }

        function loadShader(filename) {
            
            // Don't load shaders twice
            if(loaded.hasOwnProperty(filename)) {
                loadNextShader(filename);
            } else {
                var fullpath = directory + filename;
                var request = new XMLHttpRequest();

                request.open('GET', fullpath, true);
                request.responseType = 'text';
                request.onload = function() {
                    if(request.status === 404) {
                        errorCallback('Shader file not found: ' + filename);
                    } else {
                        loaded[filename] = request.response;
                        loadNextShader();
                    }
                };

                request.send();
            }
        }

    }

    function initialiseEffects(shadersData) {
        
        var vertexCommonShader = shadersData['common.vs'];
        var fragmentCommonShader = shadersData['common.fs'];

        for(var k in effectDefinitions) {

            var def = effectDefinitions[k];
            var vertexShader = shadersData[def.vertex];
            var fragmentShader = shadersData[def.fragment];

            vertexShader = vertexCommonShader + vertexShader;
            fragmentShader = fragmentCommonShader + fragmentShader;

            var effect = new ImageEffect({
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                attributes: {
                    uv: {},
                    position: {}
                },
                uniforms: {
                    projectionMatrix: {},
                    modelViewMatrix: {},
                    map: {}
                }
            });

            effects.push(effect);
            effect.initialise(gl);

        }

        activeEffect = effects[0];
        setTimeout(onEffectsInitialised, 1);

    }

    function onEffectsInitialised() {

        shadersReady = true;
        onReadyCallback();

    }
    
    function render() {

        if(!shadersReady) {
            return;
        }

        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clearColor(1.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        mat4.ortho(pMatrix, -1, 1, -1, 1, 0.1, 1000);

        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, mvMatrix, [0.0, 0.0, -1.0]);

        activeEffect.enable(gl);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.uniform1i(activeEffect.uniforms.map.id, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.vertexAttribPointer(activeEffect.attributes.uv.id, uvBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
        gl.vertexAttribPointer(activeEffect.attributes.position.id, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(activeEffect.uniforms.projectionMatrix.id, false, pMatrix);
        gl.uniformMatrix4fv(activeEffect.uniforms.modelViewMatrix.id, false, mvMatrix);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexPositionBuffer.numItems);

        activeEffect.disable(gl);

    }

    this.setSize = function(w, h) {

        gl.viewportWidth = w;
        gl.viewportHeight = h;

    };

    this.prevEffect = function() {

        var index = effects.indexOf(activeEffect);
        var newIndex = --index < 0 ? effects.length - 1 : index;
        
        activeEffect = effects[newIndex];

    };

    this.nextEffect = function() {

        var index = effects.indexOf(activeEffect);
        var newIndex = ++index % effects.length;
        
        activeEffect = effects[newIndex];

    };

    this.updateTexture = function(video) {

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        render();
    };

};
