uniform sampler2D map;

varying vec2 vUv;

void main() {
    vec3 finalRGB;
    float numLevels = 2.0;

    vec3 rgb = texture2D(map, pixellateCoords(vUv, 200.0)).rgb;

    float avg = length(rgb) / 3.0;

    avg = floor(avg * numLevels * 3.0) / numLevels ;

    gl_FragColor = vec4(0.0, avg, 0.0, 1.0);
}


