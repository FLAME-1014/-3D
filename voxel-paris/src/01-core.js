// ---------- core: constants, rng, renderer, batches, post ----------
const W = 1280, H = 720, DURATION = 14, FPS = 30;
const params = new URLSearchParams(location.search);
const SS = Math.max(1, Math.min(2, parseFloat(params.get('ss') || '2')));
const TAU = Math.PI * 2;

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(1888);
const rr = (a, b) => a + (b - a) * rnd();
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function hash2(x, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hash3(x, y, z) { return hash2(x + Math.imul(y | 0, 7919), z - Math.imul(y | 0, 104729)); }
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  let fx = x - xi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
const fbm = (x, z) => noise2(x, z) * 0.6 + noise2(x * 2.1 + 9, z * 2.1 - 4) * 0.3 + noise2(x * 4.3 - 7, z * 4.3 + 2) * 0.1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const fract = (v) => v - Math.floor(v);

const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(27, W / H, 30, 700);

// warm late-afternoon light
const SUN_DIR = new THREE.Vector3(-0.72, 0.5, 0.48).normalize();
const sun = new THREE.DirectionalLight(0xffc98a, 3.6);
sun.position.copy(SUN_DIR).multiplyScalar(200);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 60; sc.far = 360;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 3.5;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xa9c4ff, 0x8a5a3c, 1.25));
const fill = new THREE.DirectionalLight(0x9fb4ff, 0.45);
fill.position.set(120, 80, -90);
scene.add(fill);

// sky dome
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sunDir;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 top = vec3(0.30,0.46,0.74), mid = vec3(0.98,0.74,0.52), low = vec3(0.86,0.60,0.50);
        vec3 c = mix(mid, top, smoothstep(0.0, 0.55, h));
        c = mix(c, low, smoothstep(0.0, -0.5, h));
        float s = max(dot(d, normalize(vec3(sunDir.x, 0.12, sunDir.z))), 0.0);
        c += vec3(1.0,0.62,0.30) * (pow(s, 6.0) * 0.45 + pow(s, 40.0) * 0.6);
        gl_FragColor = vec4(c * 0.92, 1.0); }`
  }));
sky.renderOrder = -10; sky.frustumCulled = false;
scene.add(sky);

// rounded voxel geometry
function roundedBox(r) {
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
  const p = g.attributes.position, n = g.attributes.normal, k = 0.5 - r;
  for (let i = 0; i < p.count; i++) {
    const v = [p.getX(i), p.getY(i), p.getZ(i)], q = [0, 0, 0], d = [0, 0, 0];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(v[a]) < 0.4) v[a] = Math.sign(v[a]) * k;
      q[a] = clamp(v[a], -k, k); d[a] = v[a] - q[a];
    }
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    p.setXYZ(i, q[0] + d[0] / l * r, q[1] + d[1] / l * r, q[2] + d[2] / l * r);
    n.setXYZ(i, d[0] / l, d[1] / l, d[2] / l);
  }
  return g;
}
const GEO_ROUND = roundedBox(0.13);
const GEO_BOX = new THREE.BoxGeometry(1, 1, 1);

const _colCache = new Map(), _c = new THREE.Color();
function lin(hex) {
  let v = _colCache.get(hex);
  if (!v) { _c.setHex(hex, THREE.SRGBColorSpace); v = [_c.r, _c.g, _c.b]; _colCache.set(hex, v); }
  return v;
}
// shade a hex colour by factor f (deterministic variation)
function tint(hex, f) {
  const r = clamp(((hex >> 16) & 255) * f, 0, 255) | 0, g = clamp(((hex >> 8) & 255) * f, 0, 255) | 0, b = clamp((hex & 255) * f, 0, 255) | 0;
  return (r << 16) | (g << 8) | b;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0);

class Batch {
  constructor(geo, mat, opts = {}) {
    this.geo = geo; this.mat = mat; this.opts = opts;
    this.m = []; this.c = []; this.n = 0; this.mesh = null;
    if (opts.dynamic) {
      const cap = opts.dynamic;
      this.mesh = new THREE.InstancedMesh(geo, mat, cap);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      this.ma = this.mesh.instanceMatrix.array; this.ca = this.mesh.instanceColor.array; this.cap = cap;
      this._setup();
    }
  }
  _setup() {
    const o = this.opts;
    this.mesh.castShadow = o.cast !== false; this.mesh.receiveShadow = o.receive !== false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  _grow() {
    if (this.opts.dynamic) { if (this.n >= this.cap) return -1; return this.n++; }
    const i = this.n++;
    if (!this.ma || this.ma.length < this.n * 16) {
      const cap = Math.max(1024, (this.ma ? this.ma.length / 16 : 0) * 2);
      const ma = new Float32Array(cap * 16), ca = new Float32Array(cap * 3);
      if (this.ma) { ma.set(this.ma); ca.set(this.ca); }
      this.ma = ma; this.ca = ca;
    }
    return i;
  }
  // axis-aligned (optionally Y-rotated) box, centre position
  box(x, y, z, sx, sy, sz, col, ry = 0, gain = 1) {
    const i = this._grow(); if (i < 0) return;
    const a = this.ma, o = i * 16, c = Math.cos(ry), s = Math.sin(ry);
    a[o] = c * sx; a[o + 1] = 0; a[o + 2] = -s * sx; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0;
    a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    const l = lin(col), k = i * 3;
    this.ca[k] = l[0] * gain; this.ca[k + 1] = l[1] * gain; this.ca[k + 2] = l[2] * gain;
  }
  // beam between two points, square section th (tw optional second thickness)
  beam(x1, y1, z1, x2, y2, z2, th, col, tw) {
    const i = this._grow(); if (i < 0) return;
    _v1.set(x2 - x1, y2 - y1, z2 - z1);
    const len = _v1.length() || 1e-4;
    _q.setFromUnitVectors(X_AXIS, _v1.multiplyScalar(1 / len));
    _v2.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    _v3.set(len + th * 0.6, th, tw || th);
    _m.compose(_v2, _q, _v3);
    _m.toArray(this.ma, i * 16);
    const l = lin(col), k = i * 3;
    this.ca[k] = l[0]; this.ca[k + 1] = l[1]; this.ca[k + 2] = l[2];
  }
  begin() { this.n = 0; }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
  build() {
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.n);
    this.mesh.instanceMatrix.array.set(this.ma.subarray(0, this.n * 16));
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.ca.slice(0, this.n * 3), 3);
    this._setup();
    return this.mesh;
  }
}

const matVox = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.0 });
const matIron = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.25 });
const matGlow = new THREE.MeshBasicMaterial({ toneMapped: false });
const matSmoke = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });

const VOX = new Batch(GEO_ROUND, matVox);                 // static rounded voxels
const IRON = new Batch(GEO_BOX, matIron);                 // static lattice beams
const WOOD = new Batch(GEO_BOX, matVox);                  // static thin timber / details
const DYN = new Batch(GEO_BOX, matVox, { dynamic: 16000 }); // people, vehicles, moving parts
const GLOW = new Batch(GEO_BOX, matGlow, { dynamic: 1500, cast: false, receive: false }); // sparks
const SMOKE = new Batch(GEO_ROUND, matSmoke, { dynamic: 1500, receive: false });           // steam / smoke
