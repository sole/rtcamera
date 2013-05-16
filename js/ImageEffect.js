ImageEffect = function(params) {
	
	params = params || {};

	var self = this;
	this.vertexShaderFile = params.vertexShader;
	this.fragmentShaderFile = params.fragmentShader;
	this.shaderProgram = null;
	this.uniforms = params.uniforms || {};
	this.attributes = params.attributes || {};

	// ~~~
	
	function initShader(gl, type, filename, script) {
		if( gl.shadersCache[ filename ] === undefined ) {

			var shader = gl.createShader( type );
			gl.shaderSource( shader, script );
			gl.compileShader( shader );

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error('Shader <strong>' + filename + '</strong> could not be compiled\n' + gl.getShaderInfoLog(shader));
			}

			gl.shadersCache[ filename ] = shader;

			return shader;

		}

		return gl.shadersCache[ filename ];

	}

	function initUniforms(gl, program, keys) {
		keys.forEach(function(k) {
			self.uniforms[k] = {};
			self.uniforms[k].id = gl.getUniformLocation(program, k);
		});
	}

	function initAttributes(gl, program, keys) {
		keys.forEach(function(k) {
			self.attributes[k] = {};
			self.attributes[k].id = gl.getAttribLocation(program, k);
		});
	}

	// ~~~

	this.initialise = function(gl, vertexScript, fragmentScript) {

		var vertexShader, fragmentShader;
		var shaderProgram = gl.createProgram();

		vertexShader = initShader(gl, gl.VERTEX_SHADER, this.vertexShaderFile, vertexScript);
		fragmentShader = initShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderFile, fragmentScript);

		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			throw new Error('Shaders could not be linked');
		}

		gl.useProgram(shaderProgram);

		initUniforms(gl, shaderProgram, ['projectionMatrix', 'modelViewMatrix', 'map']);
		initAttributes(gl, shaderProgram, ['uv', 'position']);

		this.shaderProgram = shaderProgram;

	};


	this.enable = function(gl) {
		// TODO: from this.attributes
		gl.useProgram(this.shaderProgram);
		gl.enableVertexAttribArray(this.attributes.uv.id);
		gl.enableVertexAttribArray(this.attributes.position.id);
	};

	this.disable = function(gl) {
		// TODO: from this.attributes
		gl.enableVertexAttribArray(this.attributes.uv.id);
		gl.enableVertexAttribArray(this.attributes.position.id);
	};
};
