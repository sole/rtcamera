uniform sampler2D map;

varying vec2 vUv;

void main() {
    vec3 finalRGB;

    vec3 rgb = texture2D(map, pixellateCoords(vUv, 50.0)).rgb;

    gl_FragColor = vec4(rgb, 1.0);
}

