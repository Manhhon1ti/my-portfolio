import { Renderer, Program, Mesh, Vec2, Texture, Flowmap, Plane } from './distortion-img-depend.js';

(function ($) {
    'use strict';

    const items = document.querySelectorAll('.tp-image-distortion');
    if (!items.length) return;

    items.forEach(container => {
        const bgUrl = container.getAttribute('data-background');
        if (!bgUrl) return;

        const renderer = new Renderer();
        const gl = renderer.gl;
        container.appendChild(gl.canvas);

        const mouse = new Vec2(0.5);
        const smoothedMouse = new Vec2(0.5);
        const velocity = new Vec2();
        let aspect = 1;

        function resize() {
            const rect = container.getBoundingClientRect();
            aspect = rect.width / rect.height;
            renderer.setSize(rect.width, rect.height);
        }

        window.addEventListener('resize', resize, false);
        resize();

        const flowmap = new Flowmap(gl, {
            falloff: 0.3,
            dissipation: 0.95,
            size: 1024,
        });

        const geometry = new Plane(gl);
        const texture = new Texture(gl);
        const img = new Image();
        // Remove crossOrigin as it can break local file loading
        img.onload = () => {
            texture.image = img;
            texture.minFilter = gl.LINEAR;
            texture.magFilter = gl.LINEAR;
            texture.wrapS = gl.CLAMP_TO_EDGE;
            texture.wrapT = gl.CLAMP_TO_EDGE;
            texture.needsUpdate = true;
        };
        img.src = bgUrl;

        const program = new Program(gl, {
            vertex: `
                attribute vec2 uv;
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    // Scale plane to cover the viewport (original uses 0.45 for a slight overscale)
                    gl_Position = vec4(position, 0.0, 0.45);
                }
            `,
            fragment: `
                precision highp float;
                uniform sampler2D tImage;
                uniform sampler2D tFlow;
                varying vec2 vUv;
                void main() {
                    vec3 flow = texture2D(tFlow, vUv).rgb;
                    vec2 uv = vUv;
                    // Using 0.1 intensity for a more controlled ripple, or 50.0 if flow values are tiny
                    uv += (flow.rg * flow.b * 50.0); 
                    vec3 tex = texture2D(tImage, uv).rgb;
                    gl_FragColor.rgb = tex;
                    gl_FragColor.a = 1.0;
                }
            `,
            uniforms: {
                tImage: { value: texture },
                tFlow: flowmap.uniform,
            },
        });

        const mesh = new Mesh(gl, {
            geometry,
            program,
        });

        function onMove(e) {
            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = 1.0 - (e.clientY - rect.top) / rect.height;
            mouse.set(x, y);
        }

        container.addEventListener('mousemove', onMove, false);
        container.addEventListener('touchstart', e => {
            if (e.touches.length > 0) onMove(e.touches[0]);
        }, { passive: true });
        container.addEventListener('touchmove', e => {
            if (e.touches.length > 0) onMove(e.touches[0]);
        }, { passive: true });

        function update() {
            // Original smoothing logic
            const deltaMouse = new Vec2().sub(mouse, smoothedMouse).multiply(0.04);
            velocity.add(deltaMouse).multiply(0.8);
            smoothedMouse.add(velocity);

            flowmap.mouse.copy(smoothedMouse);
            flowmap.velocity.copy(velocity);
            flowmap.aspect = aspect;
            flowmap.update();

            renderer.render({ scene: mesh });
            requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    });

})(jQuery);