var Renderer = function(canvas) {
    var gl;
    var effects = [];
    var activeEffect = null;
    var shaderProgram;
    var vertexPositionBuffer;
    var uvBuffer;
    var mvMatrix;
    var pMatrix;
    var texture;

    gl = initWebGL(canvas);
    initWebGLBuffers();
    initTexture();
    initEffects(gl);

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
        // texture.image = video;

    }

    function getShader(glContext, id) {

        var shaderScript = document.getElementById(id);

        if (!shaderScript) {
            throw new Error('Shader with id = ' + id + ' could not be found');
        }

        var str = '';
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType === 3) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader;

        if (shaderScript.type === 'x-shader/x-fragment') {

            shader = glContext.createShader(gl.FRAGMENT_SHADER);

        } else if (shaderScript.type === 'x-shader/x-vertex') {

            shader = glContext.createShader(gl.VERTEX_SHADER);

        } else {

            throw new Error('Unrecognised shader type, id = ' + id);

        }

        glContext.shaderSource(shader, str);
        glContext.compileShader(shader);

        if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {

            throw new Error('Shader <strong>' + id + '</strong> could not be compiled\n' + glContext.getShaderInfoLog(shader));

        }

        return shader;

    }

    function initEffects(gl) {

        var effectDefs = {
            'dithering': { vertex: 'vs', fragment: 'fs' },
            'posterize': { vertex: 'vs', fragment: 'fs_bw' }
        };

        var vertexCommonScript = document.getElementById('vs_common').textContent;
        var fragmentCommonScript = document.getElementById('fs_common').textContent;

        for(var k in effectDefs) {

            var def = effectDefs[k];
            var vertexScript = document.getElementById( def.vertex ).textContent;
            var fragmentScript = document.getElementById( def.fragment ).textContent;

            vertexScript = vertexCommonScript + vertexScript;
            fragmentScript = fragmentCommonScript + fragmentScript;

            var effect = new ImageEffect({
                vertexShader: vertexScript,
                fragmentShader: fragmentScript,
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

    }

    function render() {

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

    this.updateTexture = function(/*texture,*/ video) {

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
