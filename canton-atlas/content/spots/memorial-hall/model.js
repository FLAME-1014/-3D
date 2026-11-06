/*
 * 中山纪念堂 · 蓝顶会堂 · 风格化场地模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：正门楼—草坪/华表—铜像—纪念堂 + 木棉王 + 北侧中轴提示。
 * 不是整个 6.1 万㎡ 场地 1:1。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");
const PAL = window.CantonPalette;
if (!PAL) throw new Error("Canton palette is not loaded");

const SITE_W = 140;
const SITE_D = 140;
const GROUND_Y = 1.0;

let seed = 1931;
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

function makeBlueRoof() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2f5f9a";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = "rgba(15,30,60,0.34)";
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(160,200,255,0.12)";
    ctx.fillRect(0, y + 3, 512, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeSign(text) {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1f2f4a";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#d9b46a";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = "#e8dcc5";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'bold 64px "Songti SC", "SimSun", serif';
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

function addOctaRoof(parent, r, h, y, mat) {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, h, 8), mat);
  roof.position.set(0, y + h / 2, 0);
  roof.scale.set(r, 1, r);
  roof.castShadow = true;
  parent.add(roof);
}

/* ---------- 纪念堂 ---------- */

function addHall(parent) {
  const g = new THREE.Group();
  g.name = "memorial-hall";
  g.position.set(0, GROUND_Y, -10);

  // 白花岗岩台基 + 台阶
  addBox(g, 82, 2.0, 72, MATS.granite, 0, 1.0, 0, false, true);
  addBox(g, 76, 0.6, 66, MATS.granite, 0, 2.3, 0, false, true);
  for (let i = 0; i < 5; i++) {
    addBox(g, 26, 0.35, 1.4, MATS.granite, 0, 0.2 + i * 0.35, 44 + i * 1.4, false);
  }

  // 八角主体
  addCylinder(g, 33, 34, 20, 8, MATS.wall, 0, 12.5, 0);
  addCylinder(g, 34.5, 34.5, 0.8, 8, MATS.trim, 0, 22.8, 0);
  // 周边红柱
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    addCylinder(g, 0.55, 0.65, 18, 8, MATS.redDark, Math.sin(a) * 33.0, 11.2, Math.cos(a) * 33.0);
  }
  // 正面门/窗
  addBox(g, 12, 10, 0.5, MATS.door, 0, 8.0, 34.2, false);
  [-9, 9].forEach(function (px) {
    addBox(g, 4.2, 7.0, 0.4, MATS.window, px, 8.0, 33.6, false);
  });

  // 四出抱厦（前/后/左/右）
  [
    { x: 0, z: 36, w: 26, d: 10, rot: 0 },
    { x: 0, z: -36, w: 26, d: 10, rot: Math.PI },
    { x: 36, z: 0, w: 10, d: 26, rot: 0 },
    { x: -36, z: 0, w: 10, d: 26, rot: 0 }
  ].forEach(function (p) {
    const pg = new THREE.Group();
    pg.position.set(p.x, 0, p.z);
    addBox(pg, p.w, 9, p.d, MATS.wall, 0, 7.0, 0);
    addBox(pg, p.w + 1, 0.5, p.d + 1, MATS.blueRoof, 0, 11.8, 0, false);
    addOctaRoof(pg, p.w * 0.62, 3.0, 12.0, MATS.blueRoof);
    g.add(pg);
  });

  // 中央八角攒尖顶：三层蓝瓦 + 金宝顶
  addOctaRoof(g, 34, 9.0, 23.0, MATS.blueRoof);
  addOctaRoof(g, 27, 8.0, 30.5, MATS.blueRoof);
  addOctaRoof(g, 19, 7.0, 37.5, MATS.blueRoof);
  addCylinder(g, 2.4, 3.2, 3.0, 8, MATS.gold, 0, 46.2, 0);
  addCylinder(g, 0.4, 0.4, 2.4, 8, MATS.gold, 0, 48.5, 0);
  // “天下为公”匾
  addSign(g, "天下为公", 0, 17.0, 34.5, 1, 12.0, 1.6);
  parent.add(g);
}

/* ---------- 门楼 ---------- */

function addGate(parent) {
  const g = new THREE.Group();
  g.name = "memorial-gate";
  g.position.set(0, GROUND_Y, 62);
  addBox(g, 38, 1.0, 14, MATS.granite, 0, 0.5, 0, false, true);
  addBox(g, 34, 12, 10, MATS.wall, 0, 6.5, 0);
  // 三拱
  addBox(g, 8.5, 9.0, 0.6, MATS.door, 0, 4.5, 5.05, false);
  [-11, 11].forEach(function (px) {
    addBox(g, 5.0, 7.0, 0.6, MATS.door, px, 3.5, 5.05, false);
  });
  // 中央歇山 + 两侧庑殿（简化为蓝瓦顶）
  addBox(g, 16, 0.6, 12, MATS.blueRoof, 0, 13.0, 0, false);
  addOctaRoof(g, 8.5, 3.0, 13.2, MATS.blueRoof);
  [-11, 11].forEach(function (px) {
    addBox(g, 11, 0.5, 11, MATS.blueRoof, px, 12.6, 0, false);
    addOctaRoof(g, 6.0, 2.4, 12.8, MATS.blueRoof);
  });
  addSign(g, "中山纪念堂", 0, 9.8, 5.2, 1, 8.0, 1.1);
  parent.add(g);
}

/* ---------- 铜像/华表 ---------- */

function addStatue(parent) {
  const g = new THREE.Group();
  g.name = "sun-statue";
  g.position.set(0, GROUND_Y, 46);
  addBox(g, 6, 6, 6, MATS.granite, 0, 3.0, 0, false, true);
  addBox(g, 4.6, 0.5, 4.6, MATS.trim, 0, 6.2, 0, false);
  // 简化铜像：腿、身、头、手杖
  addCylinder(g, 0.35, 0.45, 2.2, 8, MATS.bronze, -0.45, 7.4, 0);
  addCylinder(g, 0.35, 0.45, 2.2, 8, MATS.bronze, 0.45, 7.4, 0);
  addBox(g, 1.9, 2.6, 1.1, MATS.bronze, 0, 9.6, 0);
  addCylinder(g, 0.55, 0.6, 0.9, 8, MATS.bronze, 0, 11.4, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), MATS.bronze);
  head.position.set(0, 12.3, 0);
  head.castShadow = true;
  g.add(head);
  addCylinder(g, 0.18, 0.18, 5.0, 6, MATS.bronze, 1.15, 10.3, 0.5);
  addBox(g, 0.8, 0.3, 0.8, MATS.bronze, 1.15, 12.9, 0.5, false);
  addSign(g, "孙中山铜像", 0, 3.2, 3.15, 1, 3.0, 0.6);
  parent.add(g);
}

function addHuabiao(parent, x) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, 52);
  addBox(g, 3.0, 1.6, 3.0, MATS.granite, 0, 0.8, 0, false, true);
  addCylinder(g, 0.8, 0.95, 10.0, 8, MATS.granite, 0, 6.6, 0);
  addBox(g, 3.4, 0.5, 1.2, MATS.granite, 0, 11.5, 0, false);
  addBox(g, 1.0, 0.4, 0.6, MATS.granite, 0, 12.6, 0, false);
  addCylinder(g, 0.3, 0.3, 1.0, 8, MATS.granite, 0, 12.2, 0);
  parent.add(g);
}

/* ---------- 植物 ---------- */

function addKapok(parent) {
  const g = new THREE.Group();
  g.name = "kapok-king";
  g.position.set(42, GROUND_Y, -40);
  addCylinder(g, 1.8, 2.4, 14, 8, MATS.trunk, 0, 7, 0);
  [
    { x: 0, y: 23, z: 0, r: 12 },
    { x: 10, y: 20, z: 3, r: 8 },
    { x: -9, y: 21, z: -2, r: 9 },
    { x: 3, y: 27, z: -4, r: 7 }
  ].forEach(function (c) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r, 1), MATS.foliage);
    mesh.position.set(c.x, c.y, c.z);
    mesh.scale.set(1, 0.7, 1);
    mesh.castShadow = true;
    g.add(mesh);
  });
  // 红棉
  for (let i = 0; i < 30; i++) {
    const a = random() * Math.PI * 2;
    const rad = range(4, 12);
    const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), MATS.kapokFlower);
    blossom.position.set(Math.sin(a) * rad, 20 + range(-3, 6), Math.cos(a) * rad);
    g.add(blossom);
  }
  addSign(g, "木棉王", 0, 2.0, 3.2, 1, 2.6, 0.55);
  parent.add(g);
}

function addTree(parent, x, z, s, mat) {
  addCylinder(parent, 0.5 * s, 0.7 * s, 5.0 * s, 7, MATS.trunk, x, GROUND_Y + 2.5 * s, z);
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0 * s, 1), mat || MATS.foliage2);
  c.position.set(x, GROUND_Y + 6.5 * s, z);
  c.scale.set(1.2, 0.8, 1.2);
  c.castShadow = true;
  parent.add(c);
}

/* ---------- 材质/入口 ---------- */

let MATS = null;

function createMaterials(textures) {
  return {
    granite: std({ map: textures.stone, color: 0xded8ca, roughness: 0.95 }),
    wall: std({ map: textures.wall, roughness: 0.9 }),
    trim: std({ color: 0xf0e9dc, roughness: 0.92 }),
    redDark: std({ color: 0x8f2f22, roughness: 0.82 }),
    door: std({ color: 0x3a241a, roughness: 0.72 }),
    window: std({ color: 0x2d3f45, roughness: 0.55 }),
    blueRoof: std({ map: textures.blueRoof, roughness: 0.75 }),
    gold: std({ color: 0xc9a04a, roughness: 0.35, metalness: 0.55 }),
    bronze: std({ color: 0x5d4a32, roughness: 0.45, metalness: 0.5 }),
    woodDark: std({ color: 0x2b1a12, roughness: 0.82 }),
    lawn: std({ color: PAL.colors.foliage, roughness: 0.95 }),
    path: std({ map: textures.stone, color: 0xd8d0c0, roughness: 0.98 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 }),
    kapokFlower: std({ color: 0xc23a2a, roughness: 0.7 })
  };
}

export function create() {
  seed = 1931;

  const textures = {
    stone: makeStone("#c9c2b4", "60,52,42"),
    wall: makePlaster("#e8dcc5", "120,95,60"),
    blueRoof: makeBlueRoof()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "memorial-hall-model";

  addBox(root, SITE_W, GROUND_Y, SITE_D, MATS.granite, 0, GROUND_Y / 2, 0, false, true);
  // 草坪
  addBox(root, 120, 0.08, 110, MATS.lawn, 0, GROUND_Y + 0.04, -6, false, true);
  // 中轴石板路
  addBox(root, 10, 0.1, 26, MATS.path, 0, GROUND_Y + 0.09, 56, false, true);
  addBox(root, 8, 0.1, 22, MATS.path, 0, GROUND_Y + 0.09, 43, false, true);

  addHall(root);
  addGate(root);
  addStatue(root);
  addHuabiao(root, -28);
  addHuabiao(root, 28);
  addKapok(root);
  addTree(root, -38, 24, 1.0);
  addTree(root, 38, 24, 1.0);
  addTree(root, -48, -12, 0.9);
  addTree(root, 48, -12, 0.9);
  addTree(root, -20, 44, 0.7, MATS.foliage);
  addTree(root, 20, 44, 0.7, MATS.foliage);

  // 北侧中轴提示：低山 + 纪念碑远景
  addBox(root, 90, 4, 16, MATS.lawn, 0, GROUND_Y + 2, -62, false, true);
  addBox(root, 8, 22, 6, MATS.granite, 0, GROUND_Y + 15, -62, false);

  const anchors = {
    gate: new THREE.Vector3(0, GROUND_Y + 8, 62),
    hall: new THREE.Vector3(0, GROUND_Y + 24, -10),
    statue: new THREE.Vector3(0, GROUND_Y + 8, 46),
    huabiao: new THREE.Vector3(28, GROUND_Y + 7, 52),
    kapok: new THREE.Vector3(42, GROUND_Y + 15, -40),
    detail: new THREE.Vector3(0, GROUND_Y + 8, 46)
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


