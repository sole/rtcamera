uniform sampler2D map;

varying vec2 vUv;

void main() {
    vec3 finalRGB;
    vec3 rgb = texture2D(map, vUv).rgb;
    float avg = length(rgb) / 3.0;

    gl_FragColor = vec4(avg, avg, avg, 1.0);
}

