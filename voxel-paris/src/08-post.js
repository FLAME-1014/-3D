// ---------- post: SSAO, bloom, haze, ACES ----------
const RW = Math.round(W * SS), RH = Math.round(H * SS);
const rtScene = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
rtScene.depthTexture = new THREE.DepthTexture(RW, RH);
rtScene.depthTexture.minFilter = rtScene.depthTexture.magFilter = THREE.NearestFilter;
const mkRT = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
const rtAO = mkRT(W, H);
const bloomRT = [];
for (let i = 0, w = W / 2, h = H / 2; i < 4; i++, w /= 2, h /= 2) bloomRT.push([mkRT(w | 0, h | 0), mkRT(w | 0, h | 0)]);

const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsScene = new THREE.Scene();
const fsTri = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)));
fsTri.frustumCulled = false; fsScene.add(fsTri);
const VS = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const mkPass = (uniforms, fragmentShader) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader, depthTest: false, depthWrite: false });
function runPass(mat, target) { fsTri.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }

const DEPTH_FN = `
  uniform sampler2D tDepth; uniform mat4 projInv; uniform mat4 proj;
  vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 p = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }`;

const aoMat = mkPass({ tDepth: { value: rtScene.depthTexture }, projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2(W, H) } }, `
  varying vec2 vUv; uniform vec2 res; ${DEPTH_FN}
  void main(){
    float d0 = texture2D(tDepth, vUv).x;
    if (d0 >= 0.9999) { gl_FragColor = vec4(1.0); return; }
    vec3 p = viewPos(vUv);
    vec2 px = 1.0 / res;
    vec3 px1 = viewPos(vUv + vec2(px.x, 0.0)), px0 = viewPos(vUv - vec2(px.x, 0.0));
    vec3 py1 = viewPos(vUv + vec2(0.0, px.y)), py0 = viewPos(vUv - vec2(0.0, px.y));
    vec3 dx = abs(px1.z - p.z) < abs(p.z - px0.z) ? px1 - p : p - px0;
    vec3 dy = abs(py1.z - p.z) < abs(p.z - py0.z) ? py1 - p : p - py0;
    vec3 n = normalize(cross(dx, dy));
    vec2 f = floor(mod(gl_FragCoord.xy, 4.0));
    float ang = (f.x * 4.0 + f.y) / 16.0 * 6.2831853 + f.x * 1.3;
    vec3 rv = vec3(cos(ang), sin(ang), 0.0);
    vec3 t = normalize(rv - n * dot(rv, n)); vec3 b = cross(n, t);
    float occ = 0.0;
    const int N = 14;
    for (int i = 0; i < N; i++) {
      float fi = (float(i) + 0.5) / float(N);
      float a = float(i) * 2.39996;
      float r = sqrt(fi);
      vec3 h = vec3(cos(a) * r, sin(a) * r, sqrt(1.0 - fi * 0.85));
      float rad = 2.6 * mix(0.25, 1.0, fi * fi);
      vec3 sp = p + (t * h.x + b * h.y + n * h.z) * rad;
      vec4 c = proj * vec4(sp, 1.0); vec2 suv = c.xy / c.w * 0.5 + 0.5;
      float sz = viewPos(suv).z;
      float range = smoothstep(0.0, 1.0, 2.6 / (abs(p.z - sz) + 0.001));
      occ += step(sp.z + 0.12, sz) * range;
    }
    gl_FragColor = vec4(vec3(1.0 - occ / float(N)), 1.0);
  }`);

const brightMat = mkPass({ tex: { value: rtScene.texture } }, `
  varying vec2 vUv; uniform sampler2D tex;
  void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(1.5, 3.0, l), 1.0); }`);
const blurMat = mkPass({ tex: { value: null }, dir: { value: new THREE.Vector2() } }, `
  varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir;
  void main(){ vec3 c = texture2D(tex, vUv).rgb * 0.227027;
    c += (texture2D(tex, vUv + dir * 1.3846).rgb + texture2D(tex, vUv - dir * 1.3846).rgb) * 0.316216;
    c += (texture2D(tex, vUv + dir * 3.2308).rgb + texture2D(tex, vUv - dir * 3.2308).rgb) * 0.070270;
    gl_FragColor = vec4(c, 1.0); }`);
const copyMat = mkPass({ tex: { value: null } }, 'varying vec2 vUv; uniform sampler2D tex; void main(){ gl_FragColor = texture2D(tex, vUv); }');

const finalMat = mkPass({
  tScene: { value: rtScene.texture }, tAO: { value: rtAO.texture }, tDepth: { value: rtScene.depthTexture },
  b0: { value: bloomRT[0][0].texture }, b1: { value: bloomRT[1][0].texture }, b2: { value: bloomRT[2][0].texture }, b3: { value: bloomRT[3][0].texture },
  projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2(W, H) }
}, `
  varying vec2 vUv; uniform sampler2D tScene, tAO, b0, b1, b2, b3; uniform vec2 res; ${DEPTH_FN}
  vec3 aces(vec3 x){
    const mat3 m1 = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
    const mat3 m2 = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
    vec3 v = m1 * x; vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return clamp(m2 * (a / b), 0.0, 1.0);
  }
  void main(){
    vec3 c = texture2D(tScene, vUv).rgb;
    float d = texture2D(tDepth, vUv).x;
    float ao = 0.0; vec2 px = 1.0 / res;
    for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) ao += texture2D(tAO, vUv + (vec2(float(i), float(j)) - 1.5) * px).r;
    ao /= 16.0;
    if (d < 0.9999) {
      float lum = max(c.r, max(c.g, c.b));
      c *= mix(vec3(1.0), mix(vec3(0.30,0.24,0.30), vec3(1.0), ao), 1.0 - smoothstep(1.5, 3.0, lum));
      float z = -viewPos(vUv).z;
      float haze = 1.0 - exp(-max(z - 150.0, 0.0) * 0.0042);
      c = mix(c, vec3(0.98,0.72,0.52) * 0.95, haze * 0.55);
    }
    vec3 bl = texture2D(b0, vUv).rgb * 0.9 + texture2D(b1, vUv).rgb * 0.8 + texture2D(b2, vUv).rgb * 0.7 + texture2D(b3, vUv).rgb * 0.6;
    c += bl * 0.42;
    vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.38;
    c = aces(c * 0.95);
    c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    gl_FragColor = vec4(c, 1.0);
  }`);

function renderPost() {
  renderer.setRenderTarget(rtScene);
  renderer.render(scene, camera);
  aoMat.uniforms.proj.value.copy(camera.projectionMatrix); aoMat.uniforms.projInv.value.copy(camera.projectionMatrixInverse);
  finalMat.uniforms.proj.value.copy(camera.projectionMatrix); finalMat.uniforms.projInv.value.copy(camera.projectionMatrixInverse);
  runPass(aoMat, rtAO);
  brightMat.uniforms.tex.value = rtScene.texture;
  runPass(brightMat, bloomRT[0][0]);
  for (let i = 0; i < bloomRT.length; i++) {
    const [a, b] = bloomRT[i];
    if (i > 0) { copyMat.uniforms.tex.value = bloomRT[i - 1][0].texture; runPass(copyMat, a); }
    blurMat.uniforms.tex.value = a.texture; blurMat.uniforms.dir.value.set(1 / a.width, 0); runPass(blurMat, b);
    blurMat.uniforms.tex.value = b.texture; blurMat.uniforms.dir.value.set(0, 1 / a.height); runPass(blurMat, a);
  }
  runPass(finalMat, null);
}
