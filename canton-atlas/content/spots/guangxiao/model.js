/*
 * 光孝寺 · 岭南第一古刹 · 风格化中轴模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：山门—天王殿—大雄宝殿—瘗发塔—六祖殿 + 菩提树/东西铁塔 + 廊庑。
 * 不是整座寺院 1:1。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 120;
const SITE_D = 90;
const GROUND_Y = 1.0;

let seed = 502;
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
  ctx.fillStyle = "#4f5f58";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = "rgba(18,28,24,0.34)";
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(220,235,225,0.07)";
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
  ctx.font = 'bold 66px "Songti SC", "SimSun", serif';
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

  // 前檐红柱
  const cols = Math.max(4, Math.round(w / 5));
  for (let i = 0; i <= cols; i++) {
    const px = -w / 2 + (i / cols) * w;
    addCylinder(g, 0.26, 0.3, h - 1.2, 8, MATS.redDark, px, 1.0 + (h - 1.2) / 2, d / 2 + 0.9);
  }
  // 门/窗
  addBox(g, 4.2, 5.0, 0.3, MATS.door, 0, 3.4, d / 2 + 0.1, false);
  [-w * 0.3, w * 0.3].forEach(function (px) {
    addBox(g, 2.0, 2.8, 0.2, MATS.window, px, 3.6, d / 2 + 0.12, false);
  });

  addHipRoof(g, w + 2, d + 2, 3.2, 1.0 + h, MATS.roof);
  addBox(g, w + 3, 0.35, d + 3, MATS.trim, 0, 1.0 + h + 0.12, 0, false);
  addBox(g, w * 0.4, 0.35, 0.5, MATS.roofDark, 0, 1.0 + h + 3.2, 0, false);
  // 檐角起翘
  [-1, 1].forEach(function (sx) {
    [-1, 1].forEach(function (sz) {
      const tip = addBox(g, 2.2, 0.28, 0.9, MATS.roof, sx * (w / 2 + 1.0), 1.0 + h + 0.4, sz * (d / 2 + 1.0), false);
      tip.rotation.z = sx * 0.35;
      tip.rotation.x = sz * 0.35;
    });
  });
  // 重檐：用一道下层檐口暗示，不再堆叠第二座屋顶
  if (opts.double) {
    addBox(g, w + 4, 0.4, d + 4, MATS.roof, 0, 1.0 + h + 0.55, 0, false);
  }
  if (opts.sign) addSign(g, opts.sign, 0, 1.0 + h - 1.0, d / 2 + 1.0, 1, 5.2, 0.9);
  parent.add(g);
}

/* ---------- 塔 ---------- */

function addPagoda(parent) {
  const g = new THREE.Group();
  g.name = "yifa-pagoda";
  g.position.set(26, GROUND_Y, 16);
  addBox(g, 6, 0.8, 6, MATS.stone, 0, 0.4, 0, false, true);
  let y = 0.8;
  for (let i = 0; i < 7; i++) {
    const r = 2.4 - i * 0.2;
    const h = 0.75;
    addCylinder(g, r - 0.15, r, h, 8, MATS.brickWall, 0, y + h / 2, 0);
    addCylinder(g, r + 0.35, r + 0.35, 0.16, 8, MATS.roof, 0, y + h + 0.08, 0);
    y += h + 0.2;
  }
  addCylinder(g, 0.08, 0.08, 1.2, 6, MATS.gold, 0, y + 0.6, 0);
  addSign(g, "瘗发塔", 0, 2.8, 2.6, 1, 2.2, 0.55);
  parent.add(g);
}

function addIronPagoda(parent, x, z, s) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  g.scale.setScalar(s);
  addBox(g, 4, 0.5, 4, MATS.stone, 0, 0.25, 0, false, true);
  let y = 0.5;
  for (let i = 0; i < 5; i++) {
    const r = 1.5 - i * 0.22;
    const h = 0.6;
    addCylinder(g, r - 0.12, r, h, 8, MATS.iron, 0, y + h / 2, 0);
    addCylinder(g, r + 0.2, r + 0.2, 0.12, 8, MATS.iron, 0, y + h + 0.06, 0);
    y += h + 0.15;
  }
  addCylinder(g, 0.06, 0.06, 0.8, 6, MATS.iron, 0, y + 0.4, 0);
  parent.add(g);
}

/* ---------- 门/钟鼓楼/廊 ---------- */

function addGate(parent) {
  const g = new THREE.Group();
  g.name = "temple-gate";
  g.position.set(0, GROUND_Y, 40);
  addBox(g, 18, 0.8, 9, MATS.stone, 0, 0.4, 0, false, true);
  addBox(g, 16, 6.2, 7, MATS.wall, 0, 3.5, 0);
  addBox(g, 16.4, 0.4, 7.4, MATS.trim, 0, 6.8, 0, false);
  addHipRoof(g, 18, 9, 2.6, 7.0, MATS.roof);
  addBox(g, 4.6, 5.0, 0.4, MATS.door, 0, 3.2, 3.6, false);
  addSign(g, "光孝寺", 0, 6.0, 3.75, 1, 4.2, 0.85);
  [-1, 1].forEach(function (sx) {
    addBox(g, 2.2, 2.8, 0.2, MATS.window, sx * 5.4, 3.6, 3.62, false);
  });
  parent.add(g);
}

function addBellTower(parent, x, z) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  addBox(g, 7, 0.6, 7, MATS.stone, 0, 0.3, 0, false, true);
  addBox(g, 6, 4.5, 6, MATS.wall, 0, 2.85, 0);
  addBox(g, 6.4, 0.35, 6.4, MATS.trim, 0, 5.2, 0, false);
  addHipRoof(g, 7, 7, 1.8, 5.4, MATS.roof);
  addBox(g, 3.0, 2.2, 0.2, MATS.window, 0, 3.4, 3.1, false);
  parent.add(g);
}

function addCorridor(parent, x, z, w, d) {
  addBox(parent, w, 0.3, d, MATS.stone, x, GROUND_Y + 0.15, z, false, true);
  addBox(parent, w + 1, 0.3, d + 1, MATS.roof, x, GROUND_Y + 4.2, z, false);
  const along = w > d;
  const len = along ? w : d;
  const count = Math.max(3, Math.round(len / 4));
  for (let i = 0; i <= count; i++) {
    const t = -len / 2 + (i / count) * len;
    addCylinder(
      parent,
      0.2,
      0.22,
      4.0,
      8,
      MATS.redDark,
      along ? x + t : x - w / 2 + 0.3,
      GROUND_Y + 2.0,
      along ? z + d / 2 - 0.3 : z + t
    );
  }
}

/* ---------- 植物/香炉 ---------- */

function addBodhi(parent) {
  const g = new THREE.Group();
  g.name = "bodhi-tree";
  g.position.set(-22, GROUND_Y, -2);
  addBox(g, 6, 0.5, 6, MATS.stone, 0, 0.25, 0, false, true);
  addCylinder(g, 0.7, 1.0, 7.0, 7, MATS.trunk, 0, 3.5, 0);
  [
    { x: 0, y: 9.0, z: 0, r: 5.6 },
    { x: 4.2, y: 8.2, z: 1.4, r: 3.6 },
    { x: -4.0, y: 8.6, z: -1.2, r: 3.8 },
    { x: 1.2, y: 11.2, z: -0.6, r: 3.2 }
  ].forEach(function (c) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r, 1), MATS.foliage);
    mesh.position.set(c.x, c.y, c.z);
    mesh.scale.set(1, 0.7, 1);
    mesh.castShadow = true;
    g.add(mesh);
  });
  // 石栏
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    addBox(g, 0.18, 0.9, 0.18, MATS.curb, Math.sin(a) * 3.4, 0.7, Math.cos(a) * 3.4, false);
  }
  addSign(g, "菩提树", 0, 2.4, 3.3, 1, 2.0, 0.5);
  parent.add(g);
}

function addTree(parent, x, z, s) {
  addCylinder(parent, 0.45 * s, 0.6 * s, 4.5 * s, 7, MATS.trunk, x, GROUND_Y + 2.2 * s, z);
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0 * s, 1), MATS.foliage2);
  c.position.set(x, GROUND_Y + 6.0 * s, z);
  c.scale.set(1.2, 0.8, 1.1);
  c.castShadow = true;
  parent.add(c);
}

function addIncense(parent) {
  const g = new THREE.Group();
  g.position.set(22, GROUND_Y, 22);
  addBox(g, 3.0, 0.6, 3.0, MATS.stone, 0, 0.3, 0, false, true);
  addCylinder(g, 0.9, 1.2, 1.4, 8, MATS.bronze, 0, 1.3, 0);
  [-0.6, 0.6].forEach(function (sx) {
    addCylinder(g, 0.12, 0.16, 0.9, 6, MATS.bronze, sx, 0.6, 0);
  });
  addCylinder(g, 0.12, 0.12, 0.8, 6, MATS.bronze, 0, 2.3, 0);
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
    roofDark: std({ color: 0x3f4a45, roughness: 0.85 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    iron: std({ color: 0x2b2f30, roughness: 0.55, metalness: 0.55 }),
    bronze: std({ color: 0x6b5a32, roughness: 0.45, metalness: 0.5 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 })
  };
}

export function create() {
  seed = 502;

  const textures = {
    stone: makeStone("#b8b09f", "60,52,42"),
    brick: makeBrick("#8a8f88", "#b3b7ad"),
    wall: makePlaster("#a8442f", "60,20,12"),
    roof: makeRoof()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "guangxiao-model";

  addBox(root, SITE_W, GROUND_Y, SITE_D, MATS.stone, 0, GROUND_Y / 2, 0, false, true);
  addBox(root, 96, 0.06, 74, MATS.paving || MATS.stone, 0, GROUND_Y + 0.03, 0, false, true);

  addGate(root);
  addHall(root, { x: 0, z: 29, w: 18, d: 10, h: 7, sign: "天王殿" });
  addHall(root, { x: 0, z: 10, w: 36, d: 18, h: 11, double: true, sign: "大雄宝殿" });
  addPagoda(root);
  addHall(root, { x: 0, z: -16, w: 24, d: 12, h: 8, sign: "六祖殿" });

  addIronPagoda(root, -22, -14, 1.0);
  addIronPagoda(root, 22, -14, 0.8);
  addBellTower(root, -30, 20);
  addBellTower(root, 38, 20);
  addCorridor(root, -38, 4, 4, 54);
  addCorridor(root, 38, 4, 4, 54);
  addBodhi(root);
  addTree(root, -34, 30, 1.0);
  addTree(root, 44, 32, 1.0);
  addTree(root, -30, -28, 0.9);
  addTree(root, 30, -28, 0.9);
  addIncense(root);

  const anchors = {
    gate: new THREE.Vector3(0, GROUND_Y + 5, 40),
    hall: new THREE.Vector3(0, GROUND_Y + 8, 10),
    pagoda: new THREE.Vector3(26, GROUND_Y + 4, 16),
    bodhi: new THREE.Vector3(-22, GROUND_Y + 10, -2),
    irontower: new THREE.Vector3(22, GROUND_Y + 4, -14),
    detail: new THREE.Vector3(-22, GROUND_Y + 10, -2)
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
