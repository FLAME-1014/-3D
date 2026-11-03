/*
 * 六榕寺 · 六榕花塔 · 风格化寺院模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：六榕花塔 + 大雄宝殿 + 山门/天王殿 + 六榕树 + 碑廊。
 * 不是整座寺院 1:1。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 100;
const SITE_D = 90;
const GROUND_Y = 1.0;

let seed = 537;
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

function makeStone(base, speck) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = "rgba(" + speck + "," + range(0.03, 0.1).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(1, 3), range(1, 3));
  }
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      ctx.strokeStyle = "rgba(60,52,42,0.12)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, 120, 120);
    }
  }
  return colorTexture(c, 1, 1);
}

function makePlaster(base, tint) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = "rgba(" + tint + "," + range(0.02, 0.06).toFixed(3) + ")";
    ctx.fillRect(random() * 256, random() * 256, range(1, 4), range(1, 4));
  }
  return colorTexture(c, 1, 1);
}

function makeBrick(base, mortar) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, 512, 512);
  const bw = 64;
  const bh = 24;
  for (let row = 0; row < 512 / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 9; col++) {
      const x = col * bw + off + 2;
      const y = row * bh + 2;
      ctx.fillStyle = base;
      ctx.fillRect(x, y, bw - 4, bh - 4);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(x, y, bw - 4, 2);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(x, y + bh - 5, bw - 4, 2);
    }
  }
  return colorTexture(c, 1, 1);
}

function makeRoof() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2f5f52";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = "rgba(15,30,26,0.34)";
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(220,240,230,0.08)";
    ctx.fillRect(0, y + 3, 512, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeSign(text) {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2b1a12";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#d9b46a";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = "#d9b46a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'bold 70px "Songti SC", "SimSun", serif';
  ctx.fillText(text, 256, 68);
  return colorTexture(c, 1, 1);
}

function std(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

function addBox(parent, w, h, d, mat, x, y, z, cast, receive) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast !== false;
  mesh.receiveShadow = receive !== false;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, rt, rb, h, seg, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSign(parent, text, x, y, z, normal, width, height) {
  const mat = new THREE.MeshStandardMaterial({ map: makeSign(text), roughness: 0.72, metalness: 0.04 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(x, y, z);
  if (normal < 0) plane.rotation.y = Math.PI;
  parent.add(plane);
  addBox(parent, width + 0.12, height + 0.12, 0.08, MATS.woodDark, x, y, z - normal * 0.06, false, false);
}

function addHipRoof(parent, w, d, h, y, mat, finial) {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, h, 4), mat);
  roof.position.set(0, y + h / 2, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w * 0.72, 1, d * 0.72);
  roof.castShadow = true;
  parent.add(roof);
  if (finial !== false) addCylinder(parent, 0.09, 0.09, 1.0, 6, MATS.gold, 0, y + h + 0.4, 0);
}

/* ---------- 花塔 ---------- */

function addPagoda(parent) {
  const g = new THREE.Group();
  g.name = "liurong-pagoda";
  g.position.set(0, GROUND_Y, 0);

  addBox(g, 10, 1.2, 10, MATS.stone, 0, 0.6, 0, false, true);
  addCylinder(g, 4.6, 4.8, 1.2, 8, MATS.brickWall, 0, 1.8, 0);

  let y = 2.4;
  for (let i = 0; i < 9; i++) {
    const r = 4.2 - i * 0.21;
    const h = 4.6;
    addCylinder(g, r - 0.25, r, h, 8, MATS.wall, 0, y + h / 2, 0);
    // 四面窗
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      addBox(g, 0.9, 1.6, 0.15, MATS.window, Math.sin(a) * r * 0.78, y + h * 0.52, Math.cos(a) * r * 0.78, false);
    }
    addCylinder(g, r + 0.9, r + 0.9, 0.35, 8, MATS.roof, 0, y + h + 0.17, 0);
    addCylinder(g, r + 0.65, r + 0.65, 0.2, 8, MATS.trim, 0, y + h + 0.42, 0);
    y += h + 0.45;
  }
  // 塔顶
  addCylinder(g, 2.4, 3.2, 0.5, 8, MATS.trim, 0, y + 0.25, 0);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.2, 8), MATS.roof);
  spire.position.set(0, y + 2.1, 0);
  spire.castShadow = true;
  g.add(spire);
  addCylinder(g, 0.12, 0.12, 4.2, 6, MATS.gold, 0, y + 5.4, 0);
  addCylinder(g, 0.5, 0.5, 0.25, 8, MATS.gold, 0, y + 6.2, 0);
  addSign(g, "六榕花塔", 0, 3.4, 4.95, 1, 3.2, 0.7);
  parent.add(g);
}

/* ---------- 殿 ---------- */

function addHall(parent, opts) {
  const g = new THREE.Group();
  g.position.set(opts.x || 0, GROUND_Y, opts.z || 0);
  const w = opts.w;
  const d = opts.d;
  const h = opts.h;

  addBox(g, w + 4, 1.0, d + 4, MATS.stone, 0, 0.5, 0, false, true);
  addBox(g, w, h, d, MATS.wall, 0, 1.0 + h / 2, 0);
  addBox(g, w + 0.4, 0.4, d + 0.4, MATS.trim, 0, 1.0 + h - 0.2, 0, false);

  const cols = Math.max(4, Math.round(w / 5));
  for (let i = 0; i <= cols; i++) {
    const px = -w / 2 + (i / cols) * w;
    addCylinder(g, 0.26, 0.3, h - 1.2, 8, MATS.redDark, px, 1.0 + (h - 1.2) / 2, d / 2 + 0.9);
  }
  addBox(g, 4.0, 4.6, 0.3, MATS.door, 0, 3.2, d / 2 + 0.1, false);
  [-w * 0.3, w * 0.3].forEach(function (px) {
    addBox(g, 1.8, 2.4, 0.2, MATS.window, px, 3.4, d / 2 + 0.12, false);
  });

  addHipRoof(g, w + 2, d + 2, 3.0, 1.0 + h, MATS.roof);
  addBox(g, w + 3, 0.3, d + 3, MATS.trim, 0, 1.0 + h + 0.1, 0, false);
  if (opts.double) {
    addBox(g, w * 0.55, 2.0, d * 0.55, MATS.wall, 0, 1.0 + h + 1.0, 0);
    addHipRoof(g, w * 0.6, d * 0.6, 2.3, 1.0 + h + 2.0, MATS.roof);
  }
  if (opts.sign) addSign(g, opts.sign, 0, 1.0 + h - 1.0, d / 2 + 1.0, 1, 4.8, 0.85);
  parent.add(g);
}

/* ---------- 山门/天王殿 ---------- */

function addGate(parent) {
  const g = new THREE.Group();
  g.name = "liurong-gate";
  g.position.set(0, GROUND_Y, 36);
  addBox(g, 16, 0.8, 8, MATS.stone, 0, 0.4, 0, false, true);
  addBox(g, 14, 6.2, 6.5, MATS.wall, 0, 3.5, 0);
  addBox(g, 14.4, 0.4, 6.9, MATS.trim, 0, 6.8, 0, false);
  addHipRoof(g, 16, 8, 2.4, 7.0, MATS.roof);
  addBox(g, 4.2, 5.0, 0.4, MATS.door, 0, 3.2, 3.3, false);
  addSign(g, "六榕", 0, 6.1, 3.5, 1, 3.2, 1.0);
  addSign(g, "六榕寺", 0, 4.2, 3.55, 1, 3.0, 0.65);
  [-1, 1].forEach(function (sx) {
    addBox(g, 2.0, 2.6, 0.2, MATS.window, sx * 4.8, 3.5, 3.32, false);
  });
  parent.add(g);
}

/* ---------- 碑廊 ---------- */

function addSteleCorridor(parent, x) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, 0);
  addBox(g, 3.4, 0.3, 40, MATS.stone, 0, 0.15, 0, false, true);
  addBox(g, 4.4, 0.3, 40, MATS.roof, 0, 4.2, 0, false);
  for (let z = -18; z <= 18; z += 6) {
    addCylinder(g, 0.18, 0.2, 4.0, 8, MATS.redDark, x > 0 ? -1.2 : 1.2, 2.0, z);
    addBox(g, 0.2, 2.4, 2.4, MATS.stele, 0, 1.5, z, false);
  }
  parent.add(g);
}

/* ---------- 六榕树 ---------- */

function addBanyan(parent, x, z, s) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  g.scale.setScalar(s);
  addCylinder(g, 0.8, 1.1, 6.0, 7, MATS.trunk, 0, 3.0, 0);
  [
    { x: 0, y: 9.0, z: 0, r: 5.2 },
    { x: 4.0, y: 8.2, z: 1.2, r: 3.4 },
    { x: -3.8, y: 8.6, z: -1.2, r: 3.6 }
  ].forEach(function (c) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r, 1), MATS.foliage);
    mesh.position.set(c.x, c.y, c.z);
    mesh.scale.set(1, 0.72, 1);
    mesh.castShadow = true;
    g.add(mesh);
  });
  parent.add(g);
}

function addBanyanCourt(parent) {
  addBanyan(parent, -18, 12, 1.0);
  addBanyan(parent, 18, 12, 1.0);
  addBanyan(parent, -18, -14, 0.9);
  addBanyan(parent, 18, -14, 0.9);
  addBanyan(parent, -32, 22, 0.8);
  addBanyan(parent, 32, 22, 0.8);
  addSign(parent, "六榕", 18, 2.4, 16.2, 1, 2.0, 0.6);
}

function addIncense(parent) {
  const g = new THREE.Group();
  g.position.set(0, GROUND_Y, 18);
  addBox(g, 3.2, 0.6, 3.2, MATS.stone, 0, 0.3, 0, false, true);
  addCylinder(g, 0.9, 1.2, 1.5, 8, MATS.bronze, 0, 1.35, 0);
  addCylinder(g, 0.12, 0.12, 0.9, 6, MATS.bronze, 0, 2.4, 0);
  parent.add(g);
}

/* ---------- 材质/入口 ---------- */

let MATS = null;

function createMaterials(textures) {
  return {
    stone: std({ map: textures.stone, color: 0xc7bcaa, roughness: 0.95 }),
    curb: std({ color: 0xd6cdbb, roughness: 0.95 }),
    brickWall: std({ map: textures.brick, roughness: 0.95 }),
    wall: std({ map: textures.wall, roughness: 0.92 }),
    trim: std({ color: 0xe8dcc5, roughness: 0.92 }),
    redDark: std({ color: 0x7d2e22, roughness: 0.85 }),
    door: std({ color: 0x5a2418, roughness: 0.75 }),
    window: std({ color: 0x2d3f45, roughness: 0.6 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    roof: std({ map: textures.roof, roughness: 0.85 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    bronze: std({ color: 0x6b5a32, roughness: 0.45, metalness: 0.5 }),
    stele: std({ color: 0x4a4f4c, roughness: 0.8 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 })
  };
}

export function create() {
  seed = 537;

  const textures = {
    stone: makeStone("#b8b09f", "60,52,42"),
    brick: makeBrick("#8a8f88", "#b3b7ad"),
    wall: makePlaster("#a8442f", "60,20,12"),
    roof: makeRoof()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "liurong-model";

  addBox(root, SITE_W, GROUND_Y, SITE_D, MATS.stone, 0, GROUND_Y / 2, 0, false, true);

  addGate(root);
  addHall(root, { x: 0, z: 26, w: 14, d: 10, h: 6.5, sign: "天王殿" });
  addPagoda(root);
  addHall(root, { x: -28, z: 0, w: 20, d: 14, h: 11, double: true, sign: "大雄宝殿" });
  addHall(root, { x: -24, z: -24, w: 16, d: 10, h: 7.5, sign: "观音殿" });
  addHall(root, { x: 24, z: -24, w: 14, d: 10, h: 7, sign: "六祖堂" });
  addSteleCorridor(root, -44);
  addSteleCorridor(root, 44);
  addBanyanCourt(root);
  addIncense(root);

  const anchors = {
    gate: new THREE.Vector3(0, GROUND_Y + 5, 36),
    pagoda: new THREE.Vector3(0, GROUND_Y + 26, 0),
    hall: new THREE.Vector3(-28, GROUND_Y + 7, 0),
    banyan: new THREE.Vector3(18, GROUND_Y + 8, 12),
    stele: new THREE.Vector3(38, GROUND_Y + 3, 0),
    detail: new THREE.Vector3(18, GROUND_Y + 8, 12)
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
