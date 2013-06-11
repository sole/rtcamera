uniform sampler2D map;

varying vec2 vUv;

void main() {
    vec3 finalRGB;
    vec3 rgb = texture2D(map, vUv).rgb;
    float numLevels = 4.0;

    rgb = rgb * numLevels;
    rgb = floor(rgb) / numLevels;


    gl_FragColor = vec4(rgb, 1.0);
}

