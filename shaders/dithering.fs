uniform sampler2D map;

varying vec2 vUv;
float scale = 1.0;


void main() {

    vec3 lum = vec3(0.299, 0.587, 0.114);
    vec3 rgb = texture2D(map, vUv).rgb;
    float grayscale = dot(rgb, lum);

    vec2 xy = gl_FragCoord.xy * scale;
    int x = int(mod(xy.x, 4.0));
    int y = int(mod(xy.y, 4.0));

    vec3 finalRGB;

    finalRGB.r = find_closest(x, y, rgb.r);
    finalRGB.g = find_closest(x, y, rgb.g);
    finalRGB.b = find_closest(x, y, rgb.b);

    gl_FragColor = vec4(finalRGB, 1.0);

}

