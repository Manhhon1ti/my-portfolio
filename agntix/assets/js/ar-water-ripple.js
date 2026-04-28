/**
 * ar-water-ripple.js
 * Mouse-following water displacement effect on project images.
 * Similar to fromanother.love "featured work" hover effect.
 */
(function () {
    'use strict';

    const VS = `
        attribute vec2 a_position;
        attribute vec2 a_uv;
        varying vec2 vUv;
        void main() {
            vUv = a_uv;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const FS = `
        precision highp float;
        uniform sampler2D uTexture;
        uniform vec2 uMouse;
        uniform vec2 uVelocity;
        uniform float uIntensity;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            // WebGL textures load top-to-bottom, so flip Y
            uv.y = 1.0 - uv.y;

            // Distance from cursor in UV space (in flipped UV space)
            vec2 mouseFlipped = vec2(uMouse.x, 1.0 - uMouse.y);
            vec2 diff = uv - mouseFlipped;
            float dist = length(diff);

            // Wider falloff zone (0.55 radius) for bigger splash area
            float falloff = 1.0 - smoothstep(0.0, 0.55, dist);
            falloff = falloff * falloff;

            // Stronger lens warp
            vec2 displacement = diff * (-0.38) * falloff * uIntensity;

            // Stronger velocity streak for liquid drag feel
            vec2 streak = uVelocity * 0.28 * falloff * uIntensity;

            gl_FragColor = texture2D(uTexture, uv + displacement + streak);
        }
    `;

    function compileShader(gl, type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    }

    function initRipple(container) {
        var img = container.querySelector('img');
        if (!img) return;

        /* ─── Canvas overlay ─── */
        var canvas = document.createElement('canvas');
        canvas.style.cssText = [
            'position:absolute', 'top:0', 'left:0',
            'width:100%', 'height:100%',
            'pointer-events:none',
            'z-index:3',
            'opacity:0',
            'transition:opacity 0.5s ease'
        ].join(';');
        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        container.appendChild(canvas);

        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return;

        /* ─── Program ─── */
        var prog = gl.createProgram();
        gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        gl.useProgram(prog);

        /* ─── Full-screen quad ─── */
        var quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
        var uvs  = new Float32Array([ 0, 0, 1, 0,  0,1, 1,1]);

        var pb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, pb);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        var posLoc = gl.getAttribLocation(prog, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        var ub = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ub);
        gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
        var uvLoc = gl.getAttribLocation(prog, 'a_uv');
        gl.enableVertexAttribArray(uvLoc);
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

        /* ─── Texture ─── */
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // Placeholder 1x1 until image loads
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([0, 0, 0, 255]));

        var loaded = false;
        var srcImg = new Image();
        srcImg.onload = function () {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcImg);
            loaded = true;
        };
        // Try same-origin first; add crossOrigin for CORS servers
        srcImg.src = img.src;

        /* ─── Uniforms ─── */
        gl.uniform1i(gl.getUniformLocation(prog, 'uTexture'), 0);
        var uMouse     = gl.getUniformLocation(prog, 'uMouse');
        var uVelocity  = gl.getUniformLocation(prog, 'uVelocity');
        var uIntensity = gl.getUniformLocation(prog, 'uIntensity');

        /* ─── State ─── */
        var mouse     = [0.5, 0.5];
        var smoothMx  = 0.5, smoothMy = 0.5;
        var lastMx    = 0.5, lastMy   = 0.5;
        var velX = 0, velY = 0;
        var intensity = 0;
        var targetIntensity = 0;
        var raf;

        /* ─── Resize ─── */
        function resize() {
            var r = container.getBoundingClientRect();
            canvas.width  = r.width;
            canvas.height = r.height;
            gl.viewport(0, 0, r.width, r.height);
        }
        resize();
        window.addEventListener('resize', resize);

        /* ─── Render loop ─── */
        function render() {
            raf = requestAnimationFrame(render);

            // Smooth mouse — faster lag for snappier feel
            smoothMx += (mouse[0] - smoothMx) * 0.12;
            smoothMy += (mouse[1] - smoothMy) * 0.12;

            // Velocity — stronger multiplier, slower decay for trailing drag
            velX = (smoothMx - lastMx) * 12;
            velY = (smoothMy - lastMy) * 12;
            velX *= 0.82;
            velY *= 0.82;
            lastMx = smoothMx;
            lastMy = smoothMy;

            // Fade intensity
            intensity += (targetIntensity - intensity) * 0.07;

            if (!loaded) return;

            gl.uniform2f(uMouse, smoothMx, smoothMy);
            gl.uniform2f(uVelocity, velX, velY);
            gl.uniform1f(uIntensity, intensity);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        /* ─── Events ─── */
        container.addEventListener('mouseenter', function () {
            targetIntensity = 1.0;
            canvas.style.opacity = '1';
            if (!raf) render();
        });

        container.addEventListener('mouseleave', function () {
            targetIntensity = 0.0;
            setTimeout(function () {
                if (targetIntensity === 0) canvas.style.opacity = '0';
            }, 500);
        });

        container.addEventListener('mousemove', function (e) {
            var r = container.getBoundingClientRect();
            mouse[0] = (e.clientX - r.left) / r.width;
            mouse[1] = 1.0 - (e.clientY - r.top) / r.height;
        });

        render();
    }

    /* ─── Init all targets ─── */
    function init() {
        document.querySelectorAll('.ar-ripple-effect').forEach(function (el) {
            initRipple(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
