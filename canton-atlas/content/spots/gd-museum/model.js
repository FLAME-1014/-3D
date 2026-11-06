/*
 * 广东省博物馆（新馆）· 月光宝盒 · 风格化场地 diorama（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：约 113.5 × 113.5 m 的“回”字盒体（67.5 m 核心筒 + 四边各 23 m 悬挑）、
 * 中央约 40 m 天窗、深灰铝板 + 鲜红内壁 + 玻璃、顶边锯齿、底层退进玻璃大堂；
 * 西门二层入口、台阶/缓坡、草坡、波浪石径、树阵；北侧图书馆/西侧大剧院/东与南城市块为压缩示意。
 * 不含展厅内部、地下空间、西门大型水池与夜景灯光秀；洞口/模数为按照片的确定性示意，不是测绘。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");
const PAL = window.CantonPalette;
if (!PAL) throw new Error("Canton palette is not loaded");

const SITE = 200;
const BASE_Y = 0.9;
const GROUND_Y = 0.98;

const HALF = 56.75;
const Y0 = 9;
const Y1 = 44.5;
const CORE = 33.75;
const SKY_HALF = 20;
const SKY_Y = 38;

const COLS = 76;
const ROWS = 24;
const CELL_W = (HALF * 2) / COLS;
const CELL_H = (Y1 - Y0) / ROWS;

let seed = 20261031;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function range(a, b) {
  return a + (b - a) * random();
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function colorTexture(canvas, repeatX, repeatY) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX || 1, repeatY || 1);
  t.anisotropy = 4;
  if ("colorSpace" in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  else if ("encoding" in t && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return t;
}

/* ---------------- 贴图 ---------------- */

function makeMetal() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#43484b";
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 140; i++) {
    const v = random();
    ctx.fillStyle = v > 0.5
      ? "rgba(255,255,255," + range(0.008, 0.03).toFixed(3) + ")"
      : "rgba(0,0,0," + range(0.01, 0.04).toFixed(3) + ")";
    ctx.fillRect(random() * 64, random() * 64, range(1, 5), range(1, 4));
  }
  // 1.5 m 板缝：只留很轻的暗缝和上缘高光，避免远看变成砖墙
  ctx.fillStyle = "rgba(18,21,22,0.34)";
  ctx.fillRect(62, 0, 2, 64);
  ctx.fillRect(0, 62, 64, 2);
  ctx.fillStyle = "rgba(190,198,200,0.08)";
  ctx.fillRect(0, 0, 64, 1);
  ctx.fillRect(0, 0, 1, 64);
  return colorTexture(c, 1, 1);
}

function makeRed() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#a31f24";
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = random() > 0.5
      ? "rgba(255,120,96," + range(0.02, 0.08).toFixed(3) + ")"
      : "rgba(60,6,10," + range(0.03, 0.1).toFixed(3) + ")";
    ctx.fillRect(random() * 64, random() * 64, range(1, 3), range(1, 3));
  }
  ctx.strokeStyle = "rgba(72,8,12,0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 64, 64);
  return colorTexture(c, 1, 1);
}

function makeGlass() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#86a2ad");
  grad.addColorStop(0.45, "#40565f");
  grad.addColorStop(0.72, "#26373d");
  grad.addColorStop(1, "#16232a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(214,234,238,0.16)";
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(128, 38);
  ctx.lineTo(128, 58);
  ctx.lineTo(0, 116);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(12,18,20,0.28)";
  ctx.fillRect(0, 116, 128, 12);
  ctx.fillRect(0, 0, 128, 4);
  return colorTexture(c, 1, 1);
}

function makeSkylight() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#b9d0d2";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(70,90,92,0.55)";
  ctx.lineWidth = 3;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  return colorTexture(c, 1, 1);
}

function makePaving() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#cfc9bd";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      const v = 196 + Math.floor(random() * 22);
      ctx.fillStyle = "rgb(" + v + "," + (v - 3) + "," + (v - 11) + ")";
      ctx.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = "rgba(82,76,66," + range(0.02, 0.07).toFixed(3) + ")";
    ctx.fillRect(random() * 256, random() * 256, range(1, 3), range(1, 3));
  }
  return colorTexture(c, 1, 1);
}

function makeGrass() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#52673f";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const v = random();
    ctx.fillStyle = v > 0.55
      ? "rgba(112,138,80," + range(0.06, 0.16).toFixed(3) + ")"
      : "rgba(36,50,26," + range(0.05, 0.15).toFixed(3) + ")";
    ctx.fillRect(random() * 256, random() * 256, range(1, 3), range(2, 5));
  }
  return colorTexture(c, 1, 1);
}

function makeTextCanvas(text, opts) {
  const o = opts || {};
  const w = o.w || 1024;
  const h = o.h || 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = o.borderWidth || 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = (o.weight || "600") + " " + (o.size || 76) + 'px ' + (o.font || '"Songti SC","SimSun","STSong","Noto Serif SC",serif');
  ctx.fillStyle = o.color || "#f4f2ec";
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = o.letterSpacing || "0px";
  ctx.fillText(text, w / 2, h / 2 + 2);
  return c;
}

/* ---------------- 材质 ---------------- */

let MATS = null;

function std(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

function createMaterials(T) {
  return {
    base: std({ color: PAL.colors.earth, roughness: 0.97 }),
    metal: std({ map: T.metal, color: 0xffffff, roughness: 0.55, metalness: 0.3 }),
    metalDark: std({ map: T.metal, color: 0xd8dadb, roughness: 0.62, metalness: 0.24 }),
    red: std({ map: T.red, color: 0xffffff, roughness: 0.64, metalness: 0.06, emissive: 0x2a0507, emissiveIntensity: 0.05 }),
    redBack: std({ map: T.red, color: 0x8e6a6a, roughness: 0.88, metalness: 0.03 }),
    dark: std({ color: 0x14181a, roughness: 0.88, metalness: 0.14 }),
    glass: std({ map: T.glass, color: 0xb9c6ca, roughness: 0.3, metalness: 0.34, emissive: 0x142128, emissiveIntensity: 0.18 }),
    glassLobby: std({ map: T.glass, color: 0xa9b7ba, roughness: 0.22, metalness: 0.24, emissive: 0xffb877, emissiveIntensity: 0.18, side: THREE.DoubleSide }),
    skylight: std({ map: T.skylight, color: 0xd9eef0, roughness: 0.28, metalness: 0.08, emissive: 0x84a8ad, emissiveIntensity: 0.16, side: THREE.DoubleSide }),
    mullion: std({ color: 0x3d4345, roughness: 0.7, metalness: 0.26 }),
    soffit: std({ color: 0x101315, roughness: 0.92, metalness: 0.08 }),
    warm: std({ color: 0xe4c59a, roughness: 0.68, emissive: 0xffb264, emissiveIntensity: 0.45, side: THREE.DoubleSide }),
    paving: std({ map: T.paving, color: PAL.colors.paving, roughness: 0.95 }),
    stone: std({ map: T.paving, color: 0xc4bdae, roughness: 0.92 }),
    walk: std({ map: T.paving, color: 0xe4ded1, roughness: 0.93 }),
    grass: std({ map: T.grass, color: 0xffffff, roughness: 1 }),
    trunk: std({ color: 0x5d4a37, roughness: 0.97 }),
    leaf: std({ color: 0x3d5a30, roughness: 0.95, flatShading: true }),
    bush: std({ color: 0x334a28, roughness: 0.98, flatShading: true }),
    lamp: std({ color: 0x4e5454, roughness: 0.6, metalness: 0.5 }),
    lampHead: std({ color: 0xffe3b0, emissive: 0xd59a45, emissiveIntensity: 0.55, roughness: 0.4 }),
    context: std({ color: 0xd6d8d5, roughness: 0.86 }),
    contextDark: std({ color: 0x8e9698, roughness: 0.8 }),
    city: std({ color: 0xa9b0b3, roughness: 0.85 })
  };
}

/* ---------------- 基础几何 ---------------- */

function addBox(parent, w, h, d, mat, x, y, z, cast, receive) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast === true;
  mesh.receiveShadow = receive !== false;
  parent.add(mesh);
  return mesh;
}

function addPlane(parent, w, h, mat, x, y, z, rotY) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  if (rotY) mesh.rotation.y = rotY;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addInstances(parent, geometry, material, entries, place, cast) {
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const dummy = new THREE.Object3D();
  entries.forEach(function (entry, i) {
    place(dummy, entry, i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast === true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTextPlane(parent, text, opts) {
  const o = opts || {};
  const canvas = makeTextCanvas(text, o);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  else if ("encoding" in tex && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.width || 2, o.height || 0.5), mat);
  mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.rotationY) mesh.rotation.y = o.rotationY;
  mesh.castShadow = false;
  parent.add(mesh);
  return mesh;
}

/* ---------------- 合并几何 ---------------- */

function Bucket() {
  this.p = [];
  this.n = [];
  this.uv = [];
  this.i = [];
}
Bucket.prototype.face = function (corners, normal, uvs) {
  const a = corners[0], b = corners[1], c = corners[2], d = corners[3];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const dot = cr[0] * normal[0] + cr[1] * normal[1] + cr[2] * normal[2];
  let pts = corners.slice();
  let tex = uvs.slice();
  if (dot < 0) {
    pts = [a, d, c, b];
    tex = [uvs[0], uvs[3], uvs[2], uvs[1]];
  }
  const base = this.p.length / 3;
  for (let k = 0; k < 4; k++) {
    this.p.push(pts[k][0], pts[k][1], pts[k][2]);
    this.n.push(normal[0], normal[1], normal[2]);
    this.uv.push(tex[k][0], tex[k][1]);
  }
  this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
};
Bucket.prototype.box = function (x0, y0, z0, x1, y1, z1, scale) {
  const s = scale || 1.5;
  const u = function (x, y, z) { return [(x + z) / s, y / s]; };
  this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [u(x0, y0, z1), u(x1, y0, z1), u(x1, y1, z1), u(x0, y1, z1)]);
  this.face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [u(x1, y0, z0), u(x0, y0, z0), u(x0, y1, z0), u(x1, y1, z0)]);
  this.face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [u(x1, y0, z1), u(x1, y0, z0), u(x1, y1, z0), u(x1, y1, z1)]);
  this.face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [u(x0, y0, z0), u(x0, y0, z1), u(x0, y1, z1), u(x0, y1, z0)]);
  this.face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [u(x0, y1, z1), u(x1, y1, z1), u(x1, y1, z0), u(x0, y1, z0)]);
  this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [u(x0, y0, z0), u(x1, y0, z0), u(x1, y0, z1), u(x0, y0, z1)]);
};
Bucket.prototype.mesh = function (mat, shadows) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
  g.setIndex(this.i);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = shadows === true;
  m.receiveShadow = true;
  return m;
};
Bucket.prototype.triangles = function () { return this.i.length / 3; };

/* ---------------- 立面 ---------------- */

function rng(seedValue) {
  let s = seedValue >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SIDES = [
  { id: "west", axis: "x", plane: -HALF, out: [-1, 0, 0], index: 0 },
  { id: "east", axis: "x", plane: HALF, out: [1, 0, 0], index: 1 },
  { id: "south", axis: "z", plane: HALF, out: [0, 0, 1], index: 2 },
  { id: "north", axis: "z", plane: -HALF, out: [0, 0, -1], index: 3 }
];

function sidePoint(side, u, y, depth) {
  const inward = [-side.out[0], -side.out[1], -side.out[2]];
  const p = side.axis === "x" ? side.plane + inward[0] * depth : side.plane + inward[2] * depth;
  return side.axis === "x" ? [p, y, u] : [u, y, p];
}

function wallUv(side, u, y) {
  return [(u + HALF) / CELL_W, (y - Y0) / CELL_H];
}

function buildFacade(side, B, low) {
  const occ = new Uint8Array(COLS * ROWS);
  const cuts = [];
  const kw = CELL_W;
  const kh = CELL_H;
  const idx = function (c, r) { return r * COLS + c; };

  function isFree(c0, c1, r0, r1) {
    if (c0 < 0 || c1 > COLS || r0 < 0 || r1 > ROWS) return false;
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        if (occ[idx(c, r)]) return false;
      }
    }
    return true;
  }
  function mark(c0, c1, r0, r1) {
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) occ[idx(c, r)] = 1;
    }
  }
  function isSignZone(c0, c1, r0, r1) {
    if (side.id !== "west") return false;
    return c1 > 33 && c0 < 55 && r1 > 5 && r0 < 14;
  }
  function addCut(c0, c1, r0, r1, type, depth, top) {
    c0 = Math.max(0, Math.min(COLS - 1, c0));
    c1 = Math.max(c0 + 1, Math.min(COLS, c1));
    r0 = Math.max(0, Math.min(ROWS - 1, r0));
    r1 = Math.max(r0 + 1, Math.min(ROWS, r1));
    if (!isFree(c0, c1, r0, r1)) return false;
    mark(c0, c1, r0, r1);
    cuts.push({
      c0: c0, c1: c1, r0: r0, r1: r1,
      u0: -HALF + c0 * kw, u1: -HALF + c1 * kw,
      y0: Y0 + r0 * kh, y1: Y0 + r1 * kh,
      type: type, depth: depth, top: !!top
    });
    return true;
  }

  const rnd = rng(900 + side.index * 37);

  if (side.id === "west") {
    addCut(28, 46, 0, 5, "glass", 2.4, false);
    addCut(49, 56, 2, 6, "glass", 0.8, false);
    addCut(58, 62, 4, 11, "red", 1.7, false);
    addCut(35, 42, 14, 18, "glass", 0.9, false);
    addCut(43, 49, 16, 20, "red", 1.5, false);
  } else if (side.id === "east") {
    addCut(8, 16, 2, 7, "glass", 1.2, false);
    addCut(58, 66, 14, 19, "red", 1.4, false);
    addCut(30, 38, 18, 22, "dark", 1.9, false);
  } else if (side.id === "south") {
    addCut(30, 40, 2, 7, "glass", 1.6, false);
    addCut(52, 58, 16, 21, "red", 1.5, false);
  } else {
    addCut(22, 31, 3, 8, "red", 1.6, false);
    addCut(48, 56, 15, 20, "glass", 1.0, false);
  }

  const topSpots = [[5, 9, 21, 24], [21, 26, 22, 24], [34, 39, 20, 24], [51, 56, 21, 24], [65, 70, 22, 24]];
  for (let t = 0; t < topSpots.length; t++) {
    const sp = topSpots[t];
    addCut(sp[0] + side.index, sp[1] + side.index, sp[2], sp[3], t % 3 === 1 ? "dark" : "red", 0.9 + rnd() * 1.2, true);
  }

  const target = low ? 17 : 25;
  let made = 0;
  let attempts = 0;
  while (made < target && attempts < 900) {
    attempts++;
    const w = 2 + Math.floor(rnd() * 6);
    const h = 2 + Math.floor(rnd() * 4);
    const c0 = 2 + Math.floor(rnd() * (COLS - w - 4));
    const r0 = 1 + Math.floor(rnd() * (ROWS - h - 3));
    const c1 = c0 + w;
    const r1 = r0 + h;
    if (isSignZone(c0, c1, r0, r1)) continue;
    if (side.id === "west" && r0 < 7 && c1 > 24 && c0 < 52) continue;
    const roll = rnd();
    const type = roll < 0.4 ? "glass" : roll < 0.85 ? "red" : "dark";
    const depth = type === "glass" ? 0.55 + rnd() * 0.55 : type === "red" ? 0.9 + rnd() * 1.4 : 1.5 + rnd() * 1.2;
    if (addCut(c0, c1, r0, r1, type, depth, false)) made++;
  }

  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      if (occ[idx(i, j)]) continue;
      const a = -HALF + i * kw;
      const b = a + kw;
      const yb = Y0 + j * kh;
      const yt = yb + kh;
      const pts = side.axis === "x"
        ? [[side.plane, yb, a], [side.plane, yb, b], [side.plane, yt, b], [side.plane, yt, a]]
        : [[a, yb, side.plane], [b, yb, side.plane], [b, yt, side.plane], [a, yt, side.plane]];
      B.wall.face(pts, side.out, [wallUv(side, a, yb), wallUv(side, b, yb), wallUv(side, b, yt), wallUv(side, a, yt)]);
    }
  }

  cuts.forEach(function (cut) {
    const backB = cut.type === "red" ? B.redBack : cut.type === "glass" ? B.glass : B.dark;
    const backUv = function (u, y) { return [(u + HALF) / 1.5, (y - Y0) / 1.5]; };
    const depth = cut.depth;
    const bp = [
      sidePoint(side, cut.u0, cut.y0, depth),
      sidePoint(side, cut.u1, cut.y0, depth),
      sidePoint(side, cut.u1, cut.y1, depth),
      sidePoint(side, cut.u0, cut.y1, depth)
    ];
    backB.face(bp, side.out, [backUv(cut.u0, cut.y0), backUv(cut.u1, cut.y0), backUv(cut.u1, cut.y1), backUv(cut.u0, cut.y1)]);
    const reveal = cut.type === "dark" ? B.dark : B.red;
    const revealUv = function (u, y) { return [u / 1.5, y / 1.5]; };
    const nU = side.axis === "x" ? [0, 0, 1] : [1, 0, 0];
    const d = Math.min(cut.depth, 2.6);
    reveal.face([
      sidePoint(side, cut.u0, cut.y0, 0), sidePoint(side, cut.u0, cut.y0, d),
      sidePoint(side, cut.u0, cut.y1, d), sidePoint(side, cut.u0, cut.y1, 0)
    ], nU, [revealUv(0, cut.y0), revealUv(d, cut.y0), revealUv(d, cut.y1), revealUv(0, cut.y1)]);
    reveal.face([
      sidePoint(side, cut.u1, cut.y0, 0), sidePoint(side, cut.u1, cut.y0, d),
      sidePoint(side, cut.u1, cut.y1, d), sidePoint(side, cut.u1, cut.y1, 0)
    ], [-nU[0], 0, -nU[2]], [revealUv(0, cut.y0), revealUv(d, cut.y0), revealUv(d, cut.y1), revealUv(0, cut.y1)]);
    reveal.face([
      sidePoint(side, cut.u0, cut.y1, 0), sidePoint(side, cut.u1, cut.y1, 0),
      sidePoint(side, cut.u1, cut.y1, d), sidePoint(side, cut.u0, cut.y1, d)
    ], [0, -1, 0], [revealUv(cut.u0, 0), revealUv(cut.u1, 0), revealUv(cut.u1, d), revealUv(cut.u0, d)]);
    reveal.face([
      sidePoint(side, cut.u0, cut.y0, 0), sidePoint(side, cut.u1, cut.y0, 0),
      sidePoint(side, cut.u1, cut.y0, d), sidePoint(side, cut.u0, cut.y0, d)
    ], [0, 1, 0], [revealUv(cut.u0, 0), revealUv(cut.u1, 0), revealUv(cut.u1, d), revealUv(cut.u0, d)]);

    if (cut.type === "glass" && !low) {
      let d0 = Math.max(0.05, cut.depth - 0.32);
      let d1 = cut.depth - 0.06;
      const gw = cut.u1 - cut.u0;
      const gh = cut.y1 - cut.y0;
      const midY = (cut.y0 + cut.y1) / 2;
      const midU = (cut.u0 + cut.u1) / 2;
      const halfY = gh / 2 - 0.2;
      const halfU = gw / 2 - 0.2;
      function mBox(uc, yc, hu, hy) {
        const pa = sidePoint(side, uc - hu, yc - hy, d0);
        const pb = sidePoint(side, uc + hu, yc + hy, d1);
        B.mullion.box(
          Math.min(pa[0], pb[0]), Math.min(pa[1], pb[1]), Math.min(pa[2], pb[2]),
          Math.max(pa[0], pb[0]), Math.max(pa[1], pb[1]), Math.max(pa[2], pb[2]), 1.5
        );
      }
      const bars = gw > 6 ? Math.min(12, Math.round(gw / 3.2) - 1) : 0;
      for (let mb = 0; mb < bars; mb++) {
        const uc = cut.u0 + gw * (mb + 1) / (bars + 1);
        mBox(uc, midY, 0.055, halfY);
      }
      const rows = gh > 4.6 ? Math.min(3, Math.round(gh / 3.6) - 1) : 0;
      for (let mr = 0; mr < rows; mr++) {
        const yc = cut.y0 + gh * (mr + 1) / (rows + 1);
        mBox(midU, yc, halfU, 0.055);
      }
    }
  });

  return cuts;
}

/* ---------------- 屋顶 / 顶边 ---------------- */

function addCrown(parent) {
  const crownB = new Bucket();
  const finB = new Bucket();
  const rnd = rng(909);
  SIDES.forEach(function (side) {
    for (let k = 0; k < 6; k++) {
      const u = -44 + k * 17 + rnd() * 3;
      const w = 5 + rnd() * 6;
      const h = 0.8 + rnd() * 2.2;
      if (side.axis === "x") {
        const x0 = side.plane > 0 ? side.plane - 1.4 : side.plane;
        const x1 = side.plane > 0 ? side.plane : side.plane + 1.4;
        crownB.box(x0, Y1, u, x1, Y1 + h, u + w, 2.5);
        if (k % 2 === 0) finB.box(x0 - 0.06, Y1, u + 1, x1 + 0.06, Y1 + h * 0.82, u + 1.42, 2);
      } else {
        const z0 = side.plane > 0 ? side.plane - 1.4 : side.plane;
        const z1 = side.plane > 0 ? side.plane : side.plane + 1.4;
        crownB.box(u, Y1, z0, u + w, Y1 + h, z1, 2.5);
        if (k % 2 === 0) finB.box(u + 1, Y1, z0 - 0.06, u + 1.42, Y1 + h * 0.82, z1 + 0.06, 2);
      }
    }
  });
  crownB.box(-24, Y1, -40, -14, Y1 + 2.4, -32, 3);
  crownB.box(18, Y1, -42, 28, Y1 + 1.8, -34, 3);
  crownB.box(30, Y1, 26, 40, Y1 + 1.5, 34, 3);
  const crown = crownB.mesh(MATS.metalDark, true);
  crown.name = "roof-crown";
  parent.add(crown);
  const fins = finB.mesh(MATS.red, false);
  fins.name = "roof-red-fins";
  parent.add(fins);
}

function addRoof(parent) {
  const roofB = new Bucket();
  roofB.box(-HALF, Y1 - 0.7, -HALF, HALF, Y1, -SKY_HALF, 6);
  roofB.box(-HALF, Y1 - 0.7, SKY_HALF, HALF, Y1, HALF, 6);
  roofB.box(-HALF, Y1 - 0.7, -SKY_HALF, -SKY_HALF, Y1, SKY_HALF, 6);
  roofB.box(SKY_HALF, Y1 - 0.7, -SKY_HALF, HALF, Y1, SKY_HALF, 6);
  const roof = roofB.mesh(MATS.metalDark, true);
  roof.name = "roof-ring";
  parent.add(roof);

  const wellB = new Bucket();
  function wuv(u, y) { return [u / 1.5, y / 1.5]; }
  wellB.face([[-SKY_HALF, SKY_Y, -SKY_HALF], [-SKY_HALF, SKY_Y, SKY_HALF], [-SKY_HALF, Y1, SKY_HALF], [-SKY_HALF, Y1, -SKY_HALF]], [1, 0, 0],
    [wuv(-SKY_HALF, SKY_Y), wuv(SKY_HALF, SKY_Y), wuv(SKY_HALF, Y1), wuv(-SKY_HALF, Y1)]);
  wellB.face([[SKY_HALF, SKY_Y, SKY_HALF], [SKY_HALF, SKY_Y, -SKY_HALF], [SKY_HALF, Y1, -SKY_HALF], [SKY_HALF, Y1, SKY_HALF]], [-1, 0, 0],
    [wuv(SKY_HALF, SKY_Y), wuv(-SKY_HALF, SKY_Y), wuv(-SKY_HALF, Y1), wuv(SKY_HALF, Y1)]);
  wellB.face([[SKY_HALF, SKY_Y, -SKY_HALF], [-SKY_HALF, SKY_Y, -SKY_HALF], [-SKY_HALF, Y1, -SKY_HALF], [SKY_HALF, Y1, -SKY_HALF]], [0, 0, 1],
    [wuv(SKY_HALF, SKY_Y), wuv(-SKY_HALF, SKY_Y), wuv(-SKY_HALF, Y1), wuv(SKY_HALF, Y1)]);
  wellB.face([[-SKY_HALF, SKY_Y, SKY_HALF], [SKY_HALF, SKY_Y, SKY_HALF], [SKY_HALF, Y1, SKY_HALF], [-SKY_HALF, Y1, SKY_HALF]], [0, 0, -1],
    [wuv(-SKY_HALF, SKY_Y), wuv(SKY_HALF, SKY_Y), wuv(SKY_HALF, Y1), wuv(-SKY_HALF, Y1)]);
  const well = wellB.mesh(MATS.metal, false);
  well.name = "atrium-well";
  parent.add(well);

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(SKY_HALF * 2, SKY_HALF * 2), MATS.skylight);
  sky.rotation.x = -Math.PI / 2;
  sky.position.set(0, SKY_Y, 0);
  sky.name = "atrium-skylight";
  sky.receiveShadow = true;
  parent.add(sky);

  const bars = [];
  for (let i = 0; i < 9; i++) bars.push({ x: -16 + i * 4 });
  addInstances(parent, new THREE.BoxGeometry(0.16, 0.05, SKY_HALF * 2), MATS.mullion, bars, function (d, e) {
    d.position.set(e.x, SKY_Y + 0.06, 0);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);

  const soffitB = new Bucket();
  soffitB.face(
    [[-HALF, Y0 - 0.05, -HALF], [HALF, Y0 - 0.05, -HALF], [HALF, Y0 - 0.05, HALF], [-HALF, Y0 - 0.05, HALF]],
    [0, -1, 0],
    [[0, 0], [1, 0], [1, 1], [0, 1]]
  );
  const soffit = soffitB.mesh(MATS.soffit, false);
  soffit.name = "cantilever-soffit";
  parent.add(soffit);
}

/* ---------------- 底层玻璃大堂 ---------------- */

function addLobby(parent) {
  const glassB = new Bucket();
  const mullB = new Bucket();
  const warmB = new Bucket();
  const CEIL = 8.78;
  const DOOR = 9;
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];

  function wallX(sign) {
    const x = sign * CORE;
    const n = [sign, 0, 0];
    if (sign < 0) {
      glassB.face([[x, 3, -CORE], [x, 3, -DOOR], [x, CEIL, -DOOR], [x, CEIL, -CORE]], n, uvs);
      glassB.face([[x, 3, DOOR], [x, 3, CORE], [x, CEIL, CORE], [x, CEIL, DOOR]], n, uvs);
    } else {
      glassB.face([[x, 3, -CORE], [x, 3, CORE], [x, CEIL, CORE], [x, CEIL, -CORE]], n, uvs);
    }
    for (let z = -CORE + 3; z < CORE; z += 3) {
      if (sign < 0 && Math.abs(z) < DOOR) continue;
      mullB.box(x - 0.09, 3, z - 0.09, x + 0.09, CEIL, z + 0.09, 2);
    }
  }
  function wallZ(sign) {
    const z = sign * CORE;
    const n = [0, 0, sign];
    glassB.face([[-CORE, 3, z], [CORE, 3, z], [CORE, CEIL, z], [-CORE, CEIL, z]], n, uvs);
    for (let x = -CORE + 3; x < CORE; x += 3) {
      mullB.box(x - 0.09, 3, z - 0.09, x + 0.09, CEIL, z + 0.09, 2);
    }
  }
  wallX(-1);
  wallX(1);
  wallZ(-1);
  wallZ(1);

  mullB.box(-CORE - 0.12, CEIL - 0.12, -DOOR - 0.22, -CORE + 0.12, CEIL + 0.1, -DOOR, 2);
  mullB.box(-CORE - 0.12, CEIL - 0.12, DOOR, -CORE + 0.12, CEIL + 0.1, DOOR + 0.22, 2);
  mullB.box(-CORE - 0.12, CEIL - 0.16, -DOOR - 0.22, -CORE + 0.12, CEIL + 0.06, DOOR + 0.22, 2);

  warmB.face([[-CORE + 0.4, CEIL - 0.02, -CORE + 0.4], [CORE - 0.4, CEIL - 0.02, -CORE + 0.4], [CORE - 0.4, CEIL - 0.02, CORE - 0.4], [-CORE + 0.4, CEIL - 0.02, CORE - 0.4]], [0, -1, 0], uvs);
  warmB.face([[CORE - 0.55, 3.1, -CORE + 0.3], [CORE - 0.55, 3.1, CORE - 0.3], [CORE - 0.55, CEIL, CORE - 0.3], [CORE - 0.55, CEIL, -CORE + 0.3]], [-1, 0, 0], uvs);
  warmB.face([[-CORE + 0.3, 3.1, -CORE + 0.55], [CORE - 0.3, 3.1, -CORE + 0.55], [CORE - 0.3, CEIL, -CORE + 0.55], [-CORE + 0.3, CEIL, -CORE + 0.55]], [0, 1, 0], uvs);
  warmB.face([[-CORE + 0.3, 3.1, CORE - 0.55], [CORE - 0.3, 3.1, CORE - 0.55], [CORE - 0.3, CEIL, CORE - 0.55], [-CORE + 0.3, CEIL, CORE - 0.55]], [0, -1, 0], uvs);

  const glass = glassB.mesh(MATS.glassLobby, false);
  glass.name = "lobby-glass";
  parent.add(glass);
  const mull = mullB.mesh(MATS.mullion, false);
  mull.name = "lobby-mullions";
  parent.add(mull);
  const warm = warmB.mesh(MATS.warm, false);
  warm.name = "lobby-warm";
  parent.add(warm);

  addBox(parent, CORE * 2, 0.18, CORE * 2, MATS.stone, 0, 3.02, 0, false, true);
}

/* ---------------- 地面 / 入口 / 景观 ---------------- */

function addSite(root) {
  addBox(root, SITE, BASE_Y, SITE, MATS.base, 0, BASE_Y / 2, 0, false, true);
  const gy = BASE_Y + 0.04;

  const grassB = new Bucket();
  grassB.face(
    [[-SITE / 2, gy, SITE / 2], [SITE / 2, gy, SITE / 2], [SITE / 2, gy, -SITE / 2], [-SITE / 2, gy, -SITE / 2]],
    [0, 1, 0],
    [[-12.5, 12.5], [12.5, 12.5], [12.5, -12.5], [-12.5, -12.5]]
  );
  const grass = grassB.mesh(MATS.grass, false);
  grass.name = "site-lawn";
  grass.receiveShadow = true;
  root.add(grass);

  const pavingB = new Bucket();
  function slab(x0, z0, x1, z1, y) {
    pavingB.face(
      [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]],
      [0, 1, 0],
      [[x0 / 7, z1 / 7], [x1 / 7, z1 / 7], [x1 / 7, z0 / 7], [x0 / 7, z0 / 7]]
    );
  }
  const py = gy + 0.02;
  slab(-SITE / 2, -42, -86.4, 42, py);
  slab(-86.4, -70, -56.75, -58, py);
  slab(-86.4, 58, -56.75, 70, py);
  slab(-56.75, -66, 56.75, -58, py);
  slab(-56.75, 58, 56.75, 66, py);
  slab(58, -56.75, 66, 56.75, py);
  slab(-30, 66, 30, 78, py);
  const paving = pavingB.mesh(MATS.paving, false);
  paving.name = "site-paving";
  paving.receiveShadow = true;
  root.add(paving);

  const moundGeo = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const mounds = [
    { x: -95, z: -54, w: 26, h: 3.2, d: 17 },
    { x: -95, z: 54, w: 26, h: 3.2, d: 17 },
    { x: 90, z: 74, w: 22, h: 2.6, d: 16 }
  ];
  addInstances(root, moundGeo, MATS.grass, mounds, function (d, e) {
    d.position.set(e.x, gy + 0.01, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(e.w, e.h, e.d);
  }, false);

  addEntrance(root, gy);
  addTrees(root, gy);
  addLamps(root, gy);
}

function addEntrance(root) {
  const stoneB = new Bucket();
  const platformX0 = -74;
  stoneB.box(platformX0, 0, -24, -CORE, 3, 24, 6);
  stoneB.box(platformX0, 0, -24.6, -CORE, 3, -24, 6);
  stoneB.box(platformX0, 0, 24, -CORE, 3, 24.6, 6);
  for (let st = 0; st < 12; st++) {
    const x0 = -86.4 + st * 1.2;
    const x1 = x0 + 1.2;
    const h = (st + 1) * 0.25;
    stoneB.box(x0, 0, -22, x1, h, -6, 6);
    stoneB.box(x0, 0, 6, x1, h, 22, 6);
  }
  const stone = stoneB.mesh(MATS.stone, true);
  stone.name = "west-entrance-steps";
  root.add(stone);

  const rampLen = Math.hypot(14.4, 3);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.3, 12), MATS.walk);
  ramp.position.set(-79.2, 1.52, 0);
  ramp.rotation.z = Math.atan2(3, 14.4);
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  ramp.name = "west-entrance-ramp";
  root.add(ramp);

  const railB = new Bucket();
  [-6.4, 6.4].forEach(function (z) {
    railB.box(-86.4, 1.0, z - 0.04, -72, 1.08, z + 0.04, 2);
    railB.box(-86.4, 1.0, z - 0.04, -86.4, 1.9, z + 0.04, 2);
    railB.box(-72, 2.0, z - 0.04, -72, 3.9, z + 0.04, 2);
  });
  const rail = railB.mesh(MATS.lamp, false);
  rail.name = "entrance-rails";
  root.add(rail);

  const walkB = new Bucket();
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-94, 0, 76),
    new THREE.Vector3(-66, 0, 88),
    new THREE.Vector3(-30, 0, 82),
    new THREE.Vector3(4, 0, 92),
    new THREE.Vector3(38, 0, 80),
    new THREE.Vector3(72, 0, 88)
  ]);
  const seg = 64;
  const width = 2.8;
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg;
    const t1 = (i + 1) / seg;
    const a = path.getPoint(t0);
    const b = path.getPoint(t1);
    const ta = path.getTangent(t0);
    const na = new THREE.Vector3(-ta.z, 0, ta.x).normalize().multiplyScalar(width);
    const y = BASE_Y + 0.07;
    walkB.face([
      [a.x + na.x, y, a.z + na.z], [b.x + na.x, y, b.z + na.z],
      [b.x - na.x, y, b.z - na.z], [a.x - na.x, y, a.z - na.z]
    ], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  const walk = walkB.mesh(MATS.walk, false);
  walk.name = "wave-path";
  root.add(walk);
}

function addTrees(root, gy) {
  const entries = [
    [-100, -46], [-103, -26], [-103, 26], [-100, 46], [-96, -64], [-96, 64],
    [-58, 84], [-34, 89], [-10, 92], [14, 92], [38, 88], [58, 84], [72, 90],
    [-58, -78], [-34, -81], [-8, -83], [20, -81], [48, -78], [70, -72],
    [78, -40], [80, -14], [80, 14], [78, 40]
  ];
  addInstances(root, new THREE.CylinderGeometry(0.24, 0.38, 1, 5).translate(0, 0.5, 0), MATS.trunk, entries, function (d, e, i) {
    const h = 4.2 + (i % 4) * 0.5;
    d.position.set(e[0], gy, e[1]);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, h, 1);
  }, true);
  addInstances(root, new THREE.IcosahedronGeometry(1, 0), MATS.leaf, entries, function (d, e, i) {
    const h = 4.2 + (i % 4) * 0.5;
    const r = 2.4 + (i % 3) * 0.35;
    d.position.set(e[0], gy + h + r * 0.45, e[1]);
    d.rotation.set(0, i * 0.9, 0);
    d.scale.set(r, r * 0.82, r);
  }, true);

  const bushes = [
    [-92, -74, 1.6], [-90, -70, 1.2], [-92, 74, 1.5], [-88, 70, 1.1],
    [-64, 74, 1.3], [64, 74, 1.2], [84, -62, 1.4], [86, 62, 1.3]
  ];
  addInstances(root, new THREE.IcosahedronGeometry(1, 0), MATS.bush, bushes, function (d, e) {
    d.position.set(e[0], gy + e[2] * 0.5, e[1]);
    d.rotation.set(0, e[0] * 0.2, 0);
    d.scale.set(e[2], e[2] * 0.62, e[2]);
  }, false);
}

function addLamps(root, gy) {
  const spots = [
    [-98, -20], [-98, 0], [-98, 20], [-90, -40], [-90, 40],
    [-20, 66], [30, 66], [-20, -66], [30, -66]
  ];
  const poleB = new Bucket();
  const headB = new Bucket();
  spots.forEach(function (p) {
    poleB.box(p[0] - 0.12, 0, p[1] - 0.12, p[0] + 0.12, 5.2, p[1] + 0.12, 2);
    headB.box(p[0] - 0.3, 5.2, p[1] - 0.3, p[0] + 0.3, 5.7, p[1] + 0.3, 2);
  });
  const poles = poleB.mesh(MATS.lamp, false);
  poles.position.y = gy;
  root.add(poles);
  const heads = headB.mesh(MATS.lampHead, false);
  heads.position.y = gy;
  root.add(heads);
}

/* ---------------- 压缩周边 ---------------- */

function addContext(root) {
  // 广州图书馆（北侧，压缩）
  addBox(root, 76, 40, 16, MATS.context, 0, 20, -93, false, true);
  addBox(root, 78, 1.2, 18, MATS.contextDark, 0, 40.6, -93, false, false);
  const finB = new Bucket();
  for (let i = 0; i < 22; i++) {
    const x = -33 + i * 3.1;
    finB.box(x - 0.35, 0, -85.2, x + 0.35, 40, -84.2, 2);
  }
  const fins = finB.mesh(MATS.contextDark, false);
  fins.position.y = GROUND_Y;
  root.add(fins);

  // 西侧的广州大剧院/花城广场不单独建模，保持入口视线通透：以场地铺装、
  // 树阵与北侧图书馆交代文化街区关系；周边距离与体量均为压缩示意。

  // 东/南城市块（压缩）
  const blocks = [
    [92, -40, 14, 16, 38], [94, -14, 14, 16, 30], [94, 14, 14, 16, 44], [90, 40, 16, 16, 26]
  ];
  addInstances(root, new THREE.BoxGeometry(1, 1, 1), MATS.city, blocks, function (d, e) {
    d.position.set(e[0], GROUND_Y + e[4] / 2, e[1]);
    d.rotation.set(0, 0, 0);
    d.scale.set(e[2], e[4], e[3]);
  }, false);
}

/* ---------------- 组装 ---------------- */

export function create() {
  seed = 20261031;
  const textures = {
    metal: makeMetal(),
    red: makeRed(),
    glass: makeGlass(),
    skylight: makeSkylight(),
    paving: makePaving(),
    grass: makeGrass()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "gd-museum-model";

  addSite(root);
  addContext(root);

  const building = new THREE.Group();
  building.name = "gd-museum-box";
  building.position.set(0, GROUND_Y, 0);
  root.add(building);

  const B = {
    wall: new Bucket(),
    red: new Bucket(),
    redBack: new Bucket(),
    dark: new Bucket(),
    glass: new Bucket(),
    mullion: new Bucket()
  };
  SIDES.forEach(function (side) { buildFacade(side, B, false); });

  const wall = B.wall.mesh(MATS.metal, true);
  wall.name = "facade-metal";
  building.add(wall);
  const red = B.red.mesh(MATS.red, false);
  red.name = "facade-red-recess";
  building.add(red);
  const redBack = B.redBack.mesh(MATS.redBack, false);
  redBack.name = "facade-red-back";
  building.add(redBack);
  const dark = B.dark.mesh(MATS.dark, false);
  dark.name = "facade-openings";
  building.add(dark);
  const glass = B.glass.mesh(MATS.glass, false);
  glass.name = "facade-glass";
  building.add(glass);
  const mullions = B.mullion.mesh(MATS.mullion, false);
  mullions.name = "facade-mullions";
  building.add(mullions);

  addCrown(building);
  addRoof(building);
  addLobby(building);

  addTextPlane(building, "广东省博物馆", {
    w: 1024, h: 128, color: "#ffffff", size: 96, weight: "700",
    width: 25.5, height: 2.0, x: -HALF - 0.14, y: 23.6, z: 6.5,
    rotationY: -Math.PI / 2
  });
  addTextPlane(building, "GUANGDONG MUSEUM", {
    w: 1024, h: 96, color: "#f2f0ea", size: 50, weight: "600",
    width: 17.5, height: 1.05, x: -HALF - 0.14, y: 21.7, z: 6.5,
    rotationY: -Math.PI / 2
  });

  const anchors = {
    overview: new THREE.Vector3(0, 22, 0),
    facade: new THREE.Vector3(-HALF, 26, 3),
    box: new THREE.Vector3(-48, 26, -36),
    plaza: new THREE.Vector3(-74, 5, 2),
    detail: new THREE.Vector3(-HALF, 29, -15),
    skin: new THREE.Vector3(-HALF, 35, 34),
    atrium: new THREE.Vector3(0, 39.6, 0),
    cantilever: new THREE.Vector3(-46, 9.2, 54),
    entry: new THREE.Vector3(-44, 6, 0),
    grove: new THREE.Vector3(-86, 3.4, 30)
  };

  return {
    group: root,
    anchors: anchors,
    dispose: function () { dispose(root); }
  };
}

function dispose(root) {
  const geos = new Set();
  const mats = new Set();
  const texs = new Set();
  root.traverse(function (obj) {
    if (obj.geometry) geos.add(obj.geometry);
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach(function (m) {
        mats.add(m);
        Object.keys(m).forEach(function (k) {
          const v = m[k];
          if (v && v.isTexture) texs.add(v);
        });
      });
    }
  });
  geos.forEach(function (g) { g.dispose(); });
  mats.forEach(function (m) { m.dispose(); });
  texs.forEach(function (t) { t.dispose(); });
}