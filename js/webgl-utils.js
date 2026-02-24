// WebGL Utilities
// This file contains WebGL setup and shader programs for transitions

class WebGLUtils {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.textures = [];
        
        this.initGL();
    }

    initGL() {
        // Get WebGL context
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        console.log('WebGL context initialized');
        
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Set clear color
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    createProgram(vertexShaderSource, fragmentShaderSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        if (!vertexShader || !fragmentShader) {
            return null;
        }
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }

    createTexture(image) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        // Upload image to texture
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            image
        );
        
        return texture;
    }

    // Basic vertex shader for full-screen quad
    getBasicVertexShader() {
        return `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
    }

    // Fade transition shader
    getFadeFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform float u_direction;
            varying vec2 v_texCoord;
            
            void main() {
                vec4 color1 = texture2D(u_texture1, v_texCoord);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                gl_FragColor = mix(color1, color2, u_progress);
            }
        `;
    }

    // Slide transition shader
    getSlideFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform float u_direction;
            varying vec2 v_texCoord;
            
            void main() {
                vec2 coord1 = v_texCoord + vec2(-u_progress * u_direction, 0.0);
                vec2 coord2 = v_texCoord + vec2((1.0 - u_progress) * u_direction, 0.0);
                
                if (u_direction > 0.0) {
                    // Forward
                    if (v_texCoord.x < u_progress) {
                        gl_FragColor = texture2D(u_texture2, coord2);
                    } else {
                        gl_FragColor = texture2D(u_texture1, coord1);
                    }
                } else {
                    // Backward
                    if (v_texCoord.x > 1.0 - u_progress) {
                        gl_FragColor = texture2D(u_texture2, coord2);
                    } else {
                        gl_FragColor = texture2D(u_texture1, coord1);
                    }
                }
            }
        `;
    }

    // Zoom transition shader
    getZoomFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_progress;
            uniform float u_direction;
            varying vec2 v_texCoord;
            
            void main() {
                vec2 center = vec2(0.5, 0.5);
                float scale = 1.0 + u_progress * 0.5 * u_direction;
                vec2 coord1 = center + (v_texCoord - center) * scale;
                
                vec4 color1 = texture2D(u_texture1, coord1);
                vec4 color2 = texture2D(u_texture2, v_texCoord);
                
                float alpha = smoothstep(0.5, 1.0, u_progress);
                gl_FragColor = mix(color1, color2, alpha);
            }
        `;
    }

    // TODO: Add more transition shaders (cube, wave, etc.)

    setupGeometry() {
        // Create full-screen quad
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);

        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0
        ]);

        // Position buffer
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Texture coordinate buffer
        const texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

        const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.gl.enableVertexAttribArray(texCoordLocation);
        this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    getFragmentShaderForTransition(transitionType) {
        switch (transitionType) {
            case 'fade':
                return this.getFadeFragmentShader();
            case 'slide':
                return this.getSlideFragmentShader();
            case 'zoom':
                return this.getZoomFragmentShader();
            default:
                return this.getFadeFragmentShader();
        }
    }

    performTransition(fromImage, toImage, transitionType, duration, direction = 1) {
        return new Promise((resolve) => {
            // Create shader program for this transition
            const fragmentShader = this.getFragmentShaderForTransition(transitionType);
            this.program = this.createProgram(this.getBasicVertexShader(), fragmentShader);
            
            if (!this.program) {
                console.error('Failed to create shader program');
                resolve();
                return;
            }

            this.gl.useProgram(this.program);

            // Setup geometry
            this.setupGeometry();

            // Create textures
            const texture1 = this.createTexture(fromImage);
            const texture2 = this.createTexture(toImage);

            // Get uniform locations
            const texture1Location = this.gl.getUniformLocation(this.program, 'u_texture1');
            const texture2Location = this.gl.getUniformLocation(this.program, 'u_texture2');
            const progressLocation = this.gl.getUniformLocation(this.program, 'u_progress');
            const directionLocation = this.gl.getUniformLocation(this.program, 'u_direction');

            // Bind textures
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture1);
            this.gl.uniform1i(texture1Location, 0);

            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture2);
            this.gl.uniform1i(texture2Location, 1);

            // Set direction uniform
            if (directionLocation) {
                this.gl.uniform1f(directionLocation, direction);
            }

            // Animation loop
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1.0);

                // Update progress uniform
                this.gl.uniform1f(progressLocation, progress);

                // Clear and draw
                this.gl.clear(this.gl.COLOR_BUFFER_BIT);
                this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

                if (progress < 1.0) {
                    requestAnimationFrame(animate);
                } else {
                    // Cleanup
                    this.gl.deleteTexture(texture1);
                    this.gl.deleteTexture(texture2);
                    resolve();
                }
            };

            animate();
        });
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
}
