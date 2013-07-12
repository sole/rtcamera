uniform sampler2D map;

varying vec2 vUv;

void main() {
    vec3 finalRGB;
    vec3 rgb = texture2D(map, vUv).rgb;
    float noise = length(rand(vec2(rgb.r, rgb.b))) / 2.0;
    
    float avg = (length(rgb) / 3.0) * 0.75 + noise * 0.25;
    
    if(avg > 0.25) {
        avg = 1.0;
    } else {
        avg = 0.0;
    }

    gl_FragColor = vec4(avg, avg, avg, 1.0);
}

