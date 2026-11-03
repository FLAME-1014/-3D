/*
 * 上下九 · 骑楼街 · 风格化街段模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：120m 上下九骑楼街 + 连续券廊 + 陶陶居/莲香楼/广州酒家/皇上皇 + 牌坊 + 霓虹。
 * 不是整条 1237m 的 1:1 复原。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 120;
const SITE_D = 70;
const GROUND_Y = 1.0;
const STREET_HALF = 7.5;
const ARCADE_OUT = 11.6;
const ROW_CENTER = 17.6;

let seed = 1995;
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

function makePaving() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c9c2b4";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 128) {
      const off = (y / 64) % 2 ? 64 : 0;
      const v = 190 + Math.floor(random() * 18);
      ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 12) + ")";
      ctx.fillRect(x + off + 2, y + 2, 124, 60);
    }
  }
  return colorTexture(c, 2, 2);
}

function makePlaster(base, tint) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = "rgba(" + tint + "," + range(0.02, 0.07).toFixed(3) + ")";
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
  ctx.fillStyle = "#2f6b4f";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = "rgba(18,30,26,0.34)";
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(230,240,235,0.08)";
    ctx.fillRect(0, y + 3, 512, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeMansard() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e8dcc5";
  ctx.fillRect(0, 0, 256, 256);
  const cols = ["#3f7a8a", "#4f8a5a", "#b08d3a", "#8a3b2c", "#3f5f9a"];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = cols[(row + col) % cols.length];
      ctx.fillRect(12 + col * 60, 12 + row * 60, 52, 52);
      ctx.strokeStyle = "#e8dcc5";
      ctx.lineWidth = 6;
      ctx.strokeRect(12 + col * 60, 12 + row * 60, 52, 52);
    }
  }
  return colorTexture(c, 1, 1);
}

function makeSign(text, vertical, bg, fg) {
  const c = vertical ? makeCanvas(256, 512) : makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg || "#2b1a12";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = fg || "#d9b46a";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
  ctx.fillStyle = fg || "#d9b46a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (vertical) {
    const chars = Array.from(text);
    const step = (c.height - 40) / Math.max(1, chars.length);
    ctx.font = 'bold 62px "Songti SC", "SimSun", serif';
    chars.forEach(function (ch, i) {
      ctx.fillText(ch, c.width / 2, 30 + step * (i + 0.5));
    });
  } else {
    ctx.font = 'bold 66px "Songti SC", "SimSun", serif';
    ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  }
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

function addSign(parent, text, x, y, z, normal, width, height, vertical, bg, fg) {
  const mat = new THREE.MeshStandardMaterial({
    map: makeSign(text, !!vertical, bg, fg),
    roughness: 0.7,
    metalness: 0.04
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(x, y, z);
  if (normal < 0) plane.rotation.y = Math.PI;
  parent.add(plane);
  addBox(parent, width + 0.12, height + 0.12, 0.08, MATS.woodDark, x, y, z - normal * 0.06, false, false);
}

function addNeon(parent, text, x, y, z, normal, width, height, vertical, color) {
  const mat = new THREE.MeshBasicMaterial({ map: makeSign(text, !!vertical, "#14100d", color) });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(x, y, z);
  if (normal < 0) plane.rotation.y = Math.PI;
  parent.add(plane);
  addBox(parent, width + 0.1, height + 0.1, 0.1, MATS.neonFrame, x, y, z - normal * 0.07, false, false);
}

/* ---------- 骑楼街 ---------- */

const BLOCKS = [
  { x: -52, h: 16, color: "ochre", sign: "冰室", neon: "#7fe6ff" },
  { x: -38, h: 15, color: "cream", sign: "糖水", neon: "#ff8fbf" },
  { x: -24, h: 18, color: "taotao", sign: "陶陶居", neon: "#ffd36a", roofSign: true },
  { x: -10, h: 15, color: "mint", sign: "老西关", neon: "#8dffc4" },
  { x: 4, h: 17, color: "lianxiang", sign: "莲香楼", neon: "#ff8a6a", roofSign: true },
  { x: 18, h: 14, color: "cream", sign: "平安", neon: "#ffb36a" },
  { x: 32, h: 17, color: "guangzhou", sign: "广州酒家", neon: "#8dffc4", roofSign: true },
  { x: 46, h: 16, color: "red", sign: "皇上皇", neon: "#ff6a5a", roofSign: true }
];

function addParapetGable(parent, w, z, y, mat, normal) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, 0.5);
  shape.quadraticCurveTo(w * 0.25, 2.4, 0, 2.6);
  shape.quadraticCurveTo(-w * 0.25, 2.4, -w / 2, 0.5);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
  mesh.position.set(0, y, z);
  if (normal < 0) mesh.rotation.y = Math.PI;
  parent.add(mesh);
}

function addBlock(parent, block, side) {
  const g = new THREE.Group();
  g.position.set(block.x, GROUND_Y, side * ROW_CENTER);
  const w = 13.5;
  const d = 12;
  const h = block.h;
  const front = side < 0 ? 6 : -6;
  const normal = side < 0 ? 1 : -1;
  const bodyMat = MATS[block.color] || MATS.cream;

  addBox(g, w, h, d, bodyMat, 0, h / 2, 0);
  addBox(g, w + 0.2, 0.24, d + 0.2, MATS.trim, 0, h + 0.2, 0, false);

  // 首层店面（退在骑楼廊后）
  addBox(g, w - 1.2, 3.2, 0.3, MATS.shop, 0, 1.8, front + normal * 0.14, false);
  addBox(g, w - 2.4, 2.4, 0.2, MATS.shopGlass, 0, 1.7, front + normal * 0.2, false);
  addBox(g, 2.0, 2.6, 0.3, MATS.woodDark, w * 0.3, 1.5, front + normal * 0.24, false);
  addBox(g, w - 0.6, 0.35, 0.7, MATS.trim, 0, 3.6, front + normal * 0.2, false);
  addSign(
    g,
    block.sign,
    0,
    3.25,
    front + normal * 0.28,
    normal,
    5.2,
    0.78,
    false,
    "#24140e",
    "#e0b86a"
  );

  // 上层窗（满洲窗）
  const floors = Math.max(2, Math.floor((h - 4) / 3.2));
  for (let f = 0; f < floors; f++) {
    for (let col = -1; col <= 1; col++) {
      windowInstances.push({
        x: block.x + col * (w / 3.6),
        y: GROUND_Y + 5.2 + f * 3.2,
        z: side * ROW_CENTER + front + normal * 0.1,
        rot: normal < 0 ? Math.PI : 0
      });
    }
  }

  // 女儿墙
  addBox(g, w, 0.7, 0.4, MATS.trim, 0, h + 0.65, front, false);

  // 山花
  if (block.color === "taotao" || block.color === "lianxiang" || block.color === "guangzhou") {
    addParapetGable(g, w, front + normal * 0.02, h + 0.1, MATS.trim, normal);
  }

  // 老字号竖向招牌
  addSign(
    g,
    block.sign,
    -w / 2 + 1.0,
    6.4,
    front + normal * 0.22,
    normal,
    1.05,
    4.4,
    true,
    "#24140e",
    "#e0b86a"
  );

  // 霓虹：挑出骑楼檐口，街上看得到
  addNeon(
    g,
    block.sign,
    w / 2 - 1.0,
    3.6,
    -side * 10.4,
    -side,
    0.9,
    2.2,
    true,
    block.neon
  );
  addBox(g, 0.08, 1.2, 0.08, MATS.neonFrame, w / 2 - 1.0, 4.8, -side * 10.4, false);

  // 陶陶居的薄荷绿横梁 + 金线
  if (block.color === "taotao") {
    [5.2, 8.4, 11.6].forEach(function (yy) {
      addBox(g, w + 0.1, 0.35, 0.3, MATS.mint, 0, yy, front + normal * 0.16, false);
    });
    addBox(g, w + 0.1, 0.22, 0.3, MATS.gold, 0, 4.9, front + normal * 0.18, false);
  }
  if (block.color === "lianxiang" || block.color === "guangzhou") {
    addBox(g, w + 0.1, 0.3, 0.3, MATS.gold, 0, 4.9, front + normal * 0.18, false);
  }

  if (block.roofSign) {
    addSign(g, block.sign, 0, h + 1.1, front + normal * 0.3, normal, 6.4, 1.15, false, "#24140e", "#e0b86a");
    [-2.6, 2.6].forEach(function (px) {
      addBox(g, 0.08, 1.2, 0.08, MATS.neonFrame, px, h + 0.6, front + normal * 0.3, false);
    });
  }

  parent.add(g);
}

function addTaotaoPavilion(parent) {
  const block = BLOCKS[2];
  const side = -1;
  const g = new THREE.Group();
  g.position.set(block.x, GROUND_Y + block.h + 1.1, side * ROW_CENTER);
  addCylinder(g, 3.2, 3.2, 0.5, 6, MATS.trim, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addCylinder(g, 0.2, 0.22, 3.0, 6, MATS.mint, Math.sin(a) * 2.6, 1.6, Math.cos(a) * 2.6);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.0, 6), MATS.roof);
  roof.position.set(0, 4.2, 0);
  roof.castShadow = true;
  g.add(roof);
  addCylinder(g, 0.1, 0.1, 1.2, 6, MATS.gold, 0, 5.6, 0);
  addSign(g, "陶陶居", 0, 3.4, 2.7, 1, 3.0, 0.8, false, "#24140e", "#e0b86a");
  parent.add(g);
}

function addArchway(parent) {
  const g = new THREE.Group();
  g.name = "shangxiajiu-paifang";
  g.position.set(-56, GROUND_Y, 0);

  addBox(g, 3, 0.4, 18, MATS.stone, 0, 0.2, 0, false, true);
  [-8, -2.8, 2.8, 8].forEach(function (z) {
    addBox(g, 0.6, 7.0, 0.6, MATS.redDark, 0, 3.5, z);
  });
  addBox(g, 1.0, 0.6, 17, MATS.trim, 0, 6.6, 0);
  addBox(g, 1.0, 0.5, 17, MATS.redDark, 0, 5.2, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 19), MATS.roof);
  roof.position.set(0, 7.4, 0);
  roof.castShadow = true;
  g.add(roof);
  [-1, 1].forEach(function (sz) {
    const tip = addBox(g, 3.2, 0.3, 1.8, MATS.roof, 0, 7.6, sz * 9.2, false);
    tip.rotation.x = sz * 0.25;
  });

  // 面向街内（+X）的匾额
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(9.0, 1.2),
    new THREE.MeshStandardMaterial({ map: makeSign("上下九步行街", false, "#24140e", "#e0b86a"), roughness: 0.7 })
  );
  plaque.position.set(0.56, 6.0, 0);
  plaque.rotation.y = Math.PI / 2;
  g.add(plaque);
  addBox(g, 0.08, 1.4, 9.2, MATS.woodDark, 0.5, 6.0, 0, false);

  parent.add(g);
}

function addStreetFurniture(parent) {
  // 骑楼柱（连续券廊）
  const colGeo = new THREE.BoxGeometry(0.34, 4.2, 0.34);
  const count = 37 * 2;
  const cols = new THREE.InstancedMesh(colGeo, MATS.trim, count);
  const dummy = new THREE.Object3D();
  let idx = 0;
  [-1, 1].forEach(function (side) {
    for (let i = 0; i < 37; i++) {
      dummy.position.set(-58 + i * 3.2, GROUND_Y + 2.1, side * STREET_HALF);
      dummy.updateMatrix();
      cols.setMatrixAt(idx++, dummy.matrix);
    }
  });
  cols.castShadow = true;
  parent.add(cols);

  // 连续雨棚
  [-1, 1].forEach(function (side) {
    addBox(parent, 120, 0.35, 4.3, MATS.trim, 0, GROUND_Y + 4.3, side * 9.55, false);
    addBox(parent, 120, 0.55, 0.35, MATS.trim, 0, GROUND_Y + 3.95, side * (STREET_HALF - 0.05), false);
  });

  // 骑楼地台
  [-1, 1].forEach(function (side) {
    addBox(parent, 120, 0.16, 4.0, MATS.paving, 0, GROUND_Y + 0.08, side * 9.5, false, true);
  });

  // 街面中央排水线
  addBox(parent, 120, 0.02, 0.25, MATS.drain, 0, GROUND_Y + 0.02, 0, false, true);

  // 长凳
  [-30, -6, 26].forEach(function (x) {
    addBox(parent, 4, 0.18, 0.7, MATS.woodDark, x, GROUND_Y + 0.55, 6.2, false);
    addBox(parent, 0.3, 0.5, 0.6, MATS.iron, x - 1.6, GROUND_Y + 0.3, 6.2, false);
    addBox(parent, 0.3, 0.5, 0.6, MATS.iron, x + 1.6, GROUND_Y + 0.3, 6.2, false);
  });
}

/* ---------- 材质/实例 ---------- */

let MATS = null;
let windowInstances = [];

function createMaterials(textures) {
  return {
    paving: std({ map: textures.paving, roughness: 0.98 }),
    stone: std({ map: textures.stone, roughness: 0.95 }),
    cream: std({ map: textures.cream, roughness: 0.92 }),
    mint: std({ map: textures.mint, roughness: 0.92 }),
    ochre: std({ map: textures.ochre, roughness: 0.92 }),
    red: std({ map: textures.red, roughness: 0.94 }),
    taotao: std({ map: textures.taotao, roughness: 0.9 }),
    lianxiang: std({ map: textures.lianxiang, roughness: 0.9 }),
    guangzhou: std({ map: textures.guangzhou, roughness: 0.9 }),
    trim: std({ color: 0xe8dcc5, roughness: 0.92 }),
    redDark: std({ color: 0x7d2e22, roughness: 0.85 }),
    shop: std({ color: 0x3a3028, roughness: 0.7, metalness: 0.1 }),
    shopGlass: new THREE.MeshBasicMaterial({ color: 0x3a2418 }),
    roof: std({ map: textures.roof, roughness: 0.8 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    neonFrame: std({ color: 0x1a1410, roughness: 0.7 }),
    drain: std({ color: 0x8a8172, roughness: 0.9 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    iron: std({ color: 0x24282a, roughness: 0.6, metalness: 0.4 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 })
  };
}

function buildInstances(parent) {
  if (!windowInstances.length) return;
  const geo = new THREE.BoxGeometry(1.5, 2.2, 0.14);
  const mesh = new THREE.InstancedMesh(geo, MATS.window, windowInstances.length);
  const dummy = new THREE.Object3D();
  windowInstances.forEach(function (p, i) {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rot || 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  parent.add(mesh);
}

/* ---------- 入口 ---------- */

export function create() {
  seed = 1995;
  windowInstances = [];

  const textures = {
    paving: makePaving(),
    stone: makePlaster("#b8b09f", "60,52,42"),
    cream: makePlaster("#e8dcc5", "120,100,70"),
    mint: makePlaster("#b9d4c4", "60,100,80"),
    ochre: makePlaster("#d8b98a", "120,80,50"),
    red: makeBrick("#9a5a48", "#b98a76"),
    taotao: makePlaster("#f0e9dc", "120,110,90"),
    lianxiang: makePlaster("#d8b6a0", "120,70,50"),
    guangzhou: makePlaster("#cbd8c4", "70,100,70"),
    roof: makeRoof()
  };
  MATS = createMaterials(textures);
  MATS.window = std({ map: makeMansard(), roughness: 0.5 });

  const root = new THREE.Group();
  root.name = "shangxiajiu-model";

  addBox(root, SITE_W, GROUND_Y, SITE_D, MATS.stone, 0, GROUND_Y / 2, 0, false, true);
  addBox(root, SITE_W, 0.1, 15, MATS.paving, 0, GROUND_Y + 0.05, 0, false, true);

  BLOCKS.forEach(function (block) {
    addBlock(root, block, -1);
    addBlock(root, block, 1);
  });

  addTaotaoPavilion(root);
  addArchway(root);
  addStreetFurniture(root);
  buildInstances(root);

  const anchors = {
    qilou: new THREE.Vector3(-20, GROUND_Y + 3.0, -7.2),
    taotao: new THREE.Vector3(-24, GROUND_Y + 12, -11),
    lianxiang: new THREE.Vector3(4, GROUND_Y + 10, -11),
    paifang: new THREE.Vector3(-56, GROUND_Y + 6, 0),
    neon: new THREE.Vector3(32, GROUND_Y + 7, 7),
    detail: new THREE.Vector3(-24, GROUND_Y + 15, -11)
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
