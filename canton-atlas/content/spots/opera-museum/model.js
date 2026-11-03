/*
 * 粤剧艺术博物馆 · 广福台 · 风格化岭南园林模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：水院 + 广福台 + 主馆 + 侧厅 + 廊桥/满洲窗/镬耳墙 + 门楼。
 * 不是整个馆区的 1:1。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 120;
const SITE_D = 80;
const GROUND_Y = 2.2;
const WATER_Y = 2.24;

let seed = 2016;
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

function makeWater() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#5f8f96");
  grad.addColorStop(0.5, "#3f6f78");
  grad.addColorStop(1, "#2f5f68");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 110; i++) {
    ctx.strokeStyle = "rgba(220,245,240," + range(0.04, 0.12).toFixed(3) + ")";
    ctx.lineWidth = range(1, 2);
    ctx.beginPath();
    const y = random() * 512;
    ctx.moveTo(random() * 512, y);
    ctx.lineTo(random() * 512, y + range(-2, 2));
    ctx.stroke();
  }
  return colorTexture(c, 1, 1);
}

function makeStone(base, speck) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = "rgba(" + speck + "," + range(0.03, 0.11).toFixed(3) + ")";
    const s = range(1, 3);
    ctx.fillRect(random() * 512, random() * 512, s, s);
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

function makeSign(text, vertical) {
  const c = vertical ? makeCanvas(256, 512) : makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2b1a12";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#d9b46a";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
  ctx.fillStyle = "#d9b46a";
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

function addSign(parent, text, x, y, z, normal, width, height, vertical) {
  const mat = new THREE.MeshStandardMaterial({
    map: makeSign(text, !!vertical),
    roughness: 0.72,
    metalness: 0.04
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(x, y, z);
  if (normal < 0) plane.rotation.y = Math.PI;
  parent.add(plane);
  addBox(parent, width + 0.12, height + 0.12, 0.08, MATS.woodDark, x, y, z - normal * 0.06, false, false);
}

/* ---------- 园林构件 ---------- */

function addHipRoof(parent, w, d, h, y, mat) {
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, h, 4), mat);
  roof.position.set(0, y + h / 2, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w * 0.72, 1, d * 0.72);
  roof.castShadow = true;
  parent.add(roof);
  addCylinder(parent, 0.1, 0.1, 1.2, 6, MATS.gold, 0, y + h + 0.5, 0);
}

function addWokEar(parent, w, h, x, z, rotY) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(-w / 2, h);
  shape.quadraticCurveTo(-w * 0.24, h + 2.4, 0, h + 2.8);
  shape.quadraticCurveTo(w * 0.24, h + 2.4, w / 2, h);
  shape.lineTo(w / 2, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, MATS.brickWall);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotY || 0;
  mesh.castShadow = true;
  parent.add(mesh);
}

function addMansardWindow(parent, x, y, z, normal, w, h) {
  const mat = new THREE.MeshStandardMaterial({ map: MATS.mansardTex, roughness: 0.5, metalness: 0.05 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.position.set(x, y, z);
  if (normal < 0) plane.rotation.y = Math.PI;
  parent.add(plane);
  addBox(parent, w + 0.18, h + 0.18, 0.1, MATS.trim, x, y, z - normal * 0.04, false);
}

/* ---------- 水院 ---------- */

function addPond(parent) {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 64), MATS.pondBed);
  bed.rotation.x = -Math.PI / 2;
  bed.scale.set(20.5, 10.5, 1);
  bed.position.y = WATER_Y - 0.04;
  g.add(bed);

  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64), MATS.water);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(20, 10, 1);
  water.position.y = WATER_Y;
  g.add(water);

  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.09, 64), MATS.curb);
  rim.rotation.x = -Math.PI / 2;
  rim.scale.set(20, 10, 1);
  rim.position.y = WATER_Y + 0.03;
  rim.receiveShadow = true;
  g.add(rim);

  // 荷叶
  const padGeo = new THREE.CircleGeometry(1, 12);
  for (let i = 0; i < 14; i++) {
    const pad = new THREE.Mesh(padGeo, i % 3 ? MATS.lotus : MATS.foliage2);
    pad.rotation.x = -Math.PI / 2;
    pad.scale.setScalar(range(0.5, 1.2));
    const a = random() * Math.PI * 2;
    pad.position.set(Math.cos(a) * range(3, 17), WATER_Y + 0.02, Math.sin(a) * range(2, 8));
    g.add(pad);
  }
  parent.add(g);
}

/* ---------- 广福台 ---------- */

function addStage(parent) {
  const g = new THREE.Group();
  g.name = "guangfu-stage";
  g.position.set(0, GROUND_Y, -17);

  addBox(g, 18, 1.2, 10, MATS.stone, 0, 0.6, 0, false, true);
  addBox(g, 16, 0.4, 8, MATS.woodDark, 0, 1.4, 0);
  [-7.2, -3.2, 3.2, 7.2].forEach(function (px) {
    addCylinder(g, 0.28, 0.32, 5.2, 8, MATS.redDark, px, 3.4, 3.6);
  });
  addBox(g, 15, 3.6, 0.4, MATS.woodDark, 0, 3.2, -3.8);
  // 金漆木雕屏
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 4.6), MATS.goldScreen);
  screen.position.set(0, 3.4, -3.55);
  g.add(screen);
  addSign(g, "广福台", 0, 5.2, 3.85, 1, 4.2, 0.9);
  addBox(g, 16, 0.5, 9, MATS.trim, 0, 6.4, 0, false);
  addHipRoof(g, 17, 10, 2.8, 6.6, MATS.roof);
  [-1, 1].forEach(function (sx) {
    const tip = addBox(g, 2.2, 0.3, 1.6, MATS.roof, sx * 8.4, 7.1, 4.1, false);
    tip.rotation.z = sx * -0.3;
  });

  // 台阶
  for (let i = 0; i < 3; i++) {
    addBox(g, 8, 0.3, 1.0, MATS.curb, 0, 1.15 - i * 0.3, 5.2 + i * 0.9, false);
  }
  parent.add(g);
}

/* ---------- 主馆/侧厅 ---------- */

function addMainHall(parent) {
  const g = new THREE.Group();
  g.name = "main-hall";
  g.position.set(-38, GROUND_Y, -2);
  addBox(g, 26, 0.8, 18, MATS.stone, 0, 0.4, 0, false, true);
  addBox(g, 24, 11, 16, MATS.cream, 0, 5.9, 0);
  addBox(g, 24.4, 0.5, 16.4, MATS.roofGrey, 0, 11.4, 0, false);
  // 深色玻璃竖带
  for (let i = -3; i <= 3; i++) {
    addBox(g, 1.6, 7.6, 0.3, MATS.glass, i * 3.0, 5.4, 8.12, false);
  }
  addBox(g, 24, 1.0, 0.5, MATS.trim, 0, 2.2, 8.15, false);
  addSign(g, "粤剧艺术博物馆", 0, 9.2, 8.2, 1, 7.0, 1.0);
  addWokEar(g, 16, 11, 12, 0, Math.PI / 2);
  addHipRoof(g, 26, 18, 2.4, 11.6, MATS.roofGrey);
  parent.add(g);
}

function addSideHall(parent) {
  const g = new THREE.Group();
  g.name = "side-hall";
  g.position.set(40, GROUND_Y, -2);
  addBox(g, 18, 0.7, 14, MATS.stone, 0, 0.35, 0, false, true);
  addBox(g, 16, 7.5, 12, MATS.brickWall, 0, 4.1, 0);
  addBox(g, 16.4, 0.4, 12.4, MATS.roofGrey, 0, 8.0, 0, false);
  addWokEar(g, 12, 7.5, -8, 0, Math.PI / 2);
  addWokEar(g, 12, 7.5, 8, 0, Math.PI / 2);
  addHipRoof(g, 17, 13, 2.2, 8.2, MATS.roofGrey);
  addSign(g, "粤剧展厅", 0, 5.2, 6.15, 1, 4.0, 0.8);
  parent.add(g);
}

function addGate(parent) {
  const g = new THREE.Group();
  g.name = "garden-gate";
  g.position.set(0, GROUND_Y, 30);
  addBox(g, 16, 0.7, 8, MATS.stone, 0, 0.35, 0, false, true);
  [-5.8, -2.0, 2.0, 5.8].forEach(function (px) {
    addCylinder(g, 0.28, 0.32, 5.2, 8, MATS.redDark, px, 3.3, 0);
  });
  addBox(g, 14, 0.6, 1.0, MATS.trim, 0, 6.1, 0);
  addBox(g, 14, 0.5, 0.9, MATS.redDark, 0, 4.9, 0);
  addHipRoof(g, 16, 8, 2.2, 6.4, MATS.roof);
  addSign(g, "粤剧艺术博物馆", 0, 4.2, 5.1, 1, 6.0, 0.9);
  [-1, 1].forEach(function (sx) {
    addBox(g, 1.2, 3.6, 0.5, MATS.brickWall, sx * 7.2, 1.8, 0, false);
    addMansardWindow(g, sx * 7.2, 4.6, 0.3, 1, 1.2, 1.6);
  });
  parent.add(g);
}

/* ---------- 廊 ---------- */

function addCorridors(parent) {
  // 南廊
  addBox(parent, 40, 0.3, 4, MATS.curb, 0, GROUND_Y + 0.15, 16, false, true);
  addBox(parent, 40, 0.3, 5, MATS.roof, 0, GROUND_Y + 4.4, 16, false);
  for (let x = -18; x <= 18; x += 4) {
    addCylinder(parent, 0.22, 0.25, 4.2, 8, MATS.redDark, x, GROUND_Y + 2.2, 18.1);
  }
  addBox(parent, 40, 2.6, 0.4, MATS.brickWall, 0, GROUND_Y + 1.6, 18.2);
  for (let x = -16; x <= 16; x += 8) {
    addMansardWindow(parent, x, GROUND_Y + 1.8, 18.42, 1, 2.2, 1.7);
  }

  // 东廊
  addBox(parent, 4, 0.3, 26, MATS.curb, 26, GROUND_Y + 0.15, 2, false, true);
  addBox(parent, 5, 0.3, 26, MATS.roof, 26, GROUND_Y + 4.4, 2, false);
  for (let z = -10; z <= 14; z += 4) {
    addCylinder(parent, 0.22, 0.25, 4.2, 8, MATS.redDark, 24.1, GROUND_Y + 2.2, z);
  }
  addBox(parent, 0.4, 2.6, 26, MATS.brickWall, 28.2, GROUND_Y + 1.6, 2);
  for (let z = -8; z <= 12; z += 8) {
    addMansardWindow(parent, 28.42, GROUND_Y + 1.8, z, -1, 2.2, 1.7);
  }
}

/* ---------- 石桥 ---------- */

function addBridge(parent) {
  const g = new THREE.Group();
  g.position.set(12, GROUND_Y, 0);
  addBox(g, 3.2, 0.5, 22, MATS.stone, 0, 0.8, 0);
  addBox(g, 3.6, 0.2, 22.4, MATS.curb, 0, 1.1, 0, false);
  for (let z = -10; z <= 10; z += 2.5) {
    addBox(g, 0.2, 0.9, 0.2, MATS.curb, -1.6, 1.5, z, false);
    addBox(g, 0.2, 0.9, 0.2, MATS.curb, 1.6, 1.5, z, false);
  }
  addBox(g, 0.18, 0.12, 21, MATS.curb, -1.6, 1.95, 0, false);
  addBox(g, 0.18, 0.12, 21, MATS.curb, 1.6, 1.95, 0, false);
  parent.add(g);
}

/* ---------- 植物 ---------- */

function addTree(parent, x, z, s) {
  const y = GROUND_Y;
  addCylinder(parent, 0.5 * s, 0.7 * s, 4.5 * s, 7, MATS.trunk, x, y + 2.2 * s, z);
  const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4 * s, 1), MATS.foliage);
  f1.position.set(x, y + 6.2 * s, z);
  f1.scale.set(1.2, 0.8, 1.1);
  f1.castShadow = true;
  parent.add(f1);
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 * s, 1), MATS.foliage2);
  f2.position.set(x + 2.0 * s, y + 6.8 * s, z + 0.8 * s);
  f2.castShadow = true;
  parent.add(f2);
}

function addBamboo(parent, x, z) {
  for (let i = 0; i < 7; i++) {
    const h = range(4, 7);
    addCylinder(parent, 0.06, 0.08, h, 5, MATS.bamboo, x + range(-1.2, 1.2), GROUND_Y + h / 2, z + range(-1.2, 1.2));
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), MATS.foliage2);
  crown.position.set(x, GROUND_Y + 6.0, z);
  crown.scale.set(1.3, 0.7, 1.2);
  parent.add(crown);
}

function addPlants(parent) {
  addTree(parent, -30, 18, 1.1);
  addTree(parent, 32, 22, 1.0);
  addBamboo(parent, 22, 16);
  addBamboo(parent, -16, 20);
  // 芭蕉
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.2, 4), MATS.banana);
    leaf.position.set(-9 + range(-1.5, 1.5), GROUND_Y + 2.2, -10 + range(-1.5, 1.5));
    leaf.rotation.z = range(-0.5, 0.5);
    leaf.rotation.y = random() * Math.PI;
    parent.add(leaf);
  }
}

/* ---------- 材质/入口 ---------- */

let MATS = null;

function createMaterials(textures) {
  return {
    stone: std({ map: textures.stone, color: 0xc7bcaa, roughness: 0.95 }),
    curb: std({ color: 0xd6cdbb, roughness: 0.95 }),
    brickWall: std({ map: textures.brick, roughness: 0.95 }),
    cream: std({ map: textures.cream, roughness: 0.92 }),
    trim: std({ color: 0xe8dcc5, roughness: 0.92 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    redDark: std({ color: 0x7d2e22, roughness: 0.85 }),
    glass: std({ color: 0x2f4f52, roughness: 0.3, metalness: 0.2 }),
    roof: std({ map: textures.roof, roughness: 0.8 }),
    roofGrey: std({ color: 0x6f7774, roughness: 0.88 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    goldScreen: std({ map: textures.goldScreen, roughness: 0.55, metalness: 0.2 }),
    pondBed: std({ color: 0x243c40, roughness: 1 }),
    water: std({ map: textures.water, roughness: 0.25, metalness: 0.12, transparent: true, opacity: 0.94 }),
    lotus: std({ color: 0x4f7a4a, roughness: 0.9 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 }),
    bamboo: std({ color: 0x4f6f3a, roughness: 0.9 }),
    banana: std({ color: 0x5f8a4a, roughness: 0.9, flatShading: true })
  };
}

export function create() {
  seed = 2016;

  const gold = makeCanvas(512, 512);
  const gx = gold.getContext("2d");
  gx.fillStyle = "#3a2414";
  gx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    for (let x = 0; x < 512; x += 32) {
      gx.strokeStyle = "rgba(217,180,106,0.7)";
      gx.lineWidth = 3;
      gx.strokeRect(x + 4, y + 4, 24, 24);
      gx.beginPath();
      gx.arc(x + 16, y + 16, 8, 0, Math.PI * 2);
      gx.stroke();
    }
  }

  const textures = {
    stone: makeStone("#b8b09f", "60,52,42"),
    brick: makeBrick("#8a8f88", "#b3b7ad"),
    cream: makeStone("#d8cfbd", "80,70,55"),
    roof: makeRoof(),
    water: makeWater(),
    goldScreen: colorTexture(gold, 1, 1)
  };
  MATS = createMaterials(textures);
  MATS.mansardTex = makeMansard();

  const root = new THREE.Group();
  root.name = "opera-museum-model";

  addBox(root, SITE_W, GROUND_Y, SITE_D, MATS.stone, 0, GROUND_Y / 2, 0, false, true);
  addPond(root);
  addStage(root);
  addMainHall(root);
  addSideHall(root);
  addGate(root);
  addCorridors(root);
  addBridge(root);
  addPlants(root);

  const anchors = {
    gate: new THREE.Vector3(0, GROUND_Y + 4, 30),
    stage: new THREE.Vector3(0, GROUND_Y + 5, -17),
    courtyard: new THREE.Vector3(0, WATER_Y + 1, 0),
    museum: new THREE.Vector3(-38, GROUND_Y + 7, -2),
    detail: new THREE.Vector3(0, GROUND_Y + 5, -17)
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
