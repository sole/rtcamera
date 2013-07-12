uniform sampler2D map;

varying vec2 vUv;

void main() {
    vec3 finalRGB;
    float mosaicSegments = 50.0;
    vec2 uv = vUv;

    uv = floor(uv * mosaicSegments) / mosaicSegments;

    vec3 rgb = texture2D(map, uv).rgb;

    gl_FragColor = vec4(rgb, 1.0);
}

