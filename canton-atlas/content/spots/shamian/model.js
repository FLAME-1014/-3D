/*
 * 沙面 · 沙面岛 · 风格化岛段模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：沙面大街轴线 + 露德圣母堂 + 沙面公园/江岸 + 白天鹅塔楼剪影。
 * 不是全岛 862×287m 的 1:1 复原。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const GROUND_Y = 1.0;
const ROW_CENTER = 15;
const ROW_DEPTH = 12;

let seed = 862;
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
  grad.addColorStop(0, "#6f9fa6");
  grad.addColorStop(0.5, "#4f7f86");
  grad.addColorStop(1, "#3f6f78");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
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

function makeGrass() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5f7f4a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = "rgba(30,55,25," + range(0.04, 0.12).toFixed(3) + ")";
    ctx.fillRect(random() * 256, random() * 256, 2, 3);
  }
  return colorTexture(c, 1, 1);
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

function makeStone() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c4b9a8";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) {
      const v = 190 + Math.floor(random() * 16);
      ctx.fillStyle = "rgb(" + v + "," + (v - 6) + "," + (v - 16) + ")";
      ctx.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  return colorTexture(c, 1, 1);
}

function makeRoof() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5c4a3d";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = "rgba(30,20,15,0.28)";
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, y + 3, 512, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeWindow() {
  const c = makeCanvas(256, 320);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f0e9dc";
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = "#2d3f45";
  ctx.fillRect(22, 22, 212, 276);
  ctx.fillStyle = "#5f838a";
  ctx.fillRect(32, 32, 192, 256);
  ctx.strokeStyle = "#f0e9dc";
  ctx.lineWidth = 10;
  ctx.strokeRect(32, 32, 192, 256);
  ctx.beginPath();
  ctx.moveTo(128, 32);
  ctx.lineTo(128, 288);
  ctx.moveTo(32, 160);
  ctx.lineTo(224, 160);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.moveTo(38, 282);
  ctx.lineTo(120, 40);
  ctx.lineTo(150, 40);
  ctx.lineTo(64, 282);
  ctx.closePath();
  ctx.fill();
  return colorTexture(c, 1, 1);
}

function makeGothicWindow() {
  const c = makeCanvas(256, 384);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d9d0c0";
  ctx.fillRect(0, 0, 256, 384);
  ctx.fillStyle = "#26383e";
  ctx.beginPath();
  ctx.moveTo(48, 360);
  ctx.lineTo(48, 150);
  ctx.quadraticCurveTo(48, 40, 128, 20);
  ctx.quadraticCurveTo(208, 40, 208, 150);
  ctx.lineTo(208, 360);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a8175";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = "rgba(217,208,192,0.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 40);
  ctx.lineTo(128, 350);
  ctx.moveTo(60, 200);
  ctx.lineTo(196, 200);
  ctx.stroke();
  return colorTexture(c, 1, 1);
}

function makeRose() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d9d0c0";
  ctx.fillRect(0, 0, 256, 256);
  const colors = ["#2f6b8a", "#3f7a5a", "#b07a1e", "#9a3b2e", "#6b4f8a"];
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.arc(128, 128, 100, i * Math.PI / 6, (i + 1) * Math.PI / 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#d9d0c0";
  ctx.beginPath();
  ctx.arc(128, 128, 28, 0, Math.PI * 2);
  ctx.fill();
  return colorTexture(c, 1, 1);
}

function makeSign(text, vertical) {
  const c = vertical ? makeCanvas(256, 512) : makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2b1a12";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#b08d57";
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
    ctx.font = 'bold 70px "Songti SC", "SimSun", serif';
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

function addGableRoofX(parent, w, d, h, baseY, z, mat) {
  const halfD = d / 2;
  const slope = Math.sqrt(halfD * halfD + h * h);
  const angle = Math.atan2(h, halfD);
  const thick = 0.32;
  const front = addBox(parent, w, thick, slope, mat, 0, baseY + h / 2, z + halfD / 2);
  front.rotation.x = angle;
  const back = addBox(parent, w, thick, slope, mat, 0, baseY + h / 2, z - halfD / 2);
  back.rotation.x = -angle;
  const shape = new THREE.Shape();
  shape.moveTo(-halfD, 0);
  shape.lineTo(halfD, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const right = new THREE.Mesh(geo, MATS.stone);
  right.rotation.y = Math.PI / 2;
  right.position.set(w / 2, baseY, z);
  right.castShadow = true;
  parent.add(right);
  const left = new THREE.Mesh(geo, MATS.stone);
  left.rotation.y = -Math.PI / 2;
  left.position.set(-w / 2, baseY, z);
  left.castShadow = true;
  parent.add(left);
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

function addBanyan(parent, x, z, s) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  g.scale.setScalar(s || 1);
  addCylinder(g, 0.5, 0.7, 4.5, 7, MATS.trunk, 0, 2.2, 0);
  const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.8, 1), MATS.foliage);
  f1.position.set(0, 5.5, 0);
  f1.scale.set(1.2, 0.85, 1.2);
  f1.castShadow = true;
  g.add(f1);
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), MATS.foliage2);
  f2.position.set(1.8, 6.1, 0.6);
  f2.castShadow = true;
  g.add(f2);
  const f3 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), MATS.foliage);
  f3.position.set(-1.7, 5.9, -0.7);
  f3.castShadow = true;
  g.add(f3);
  parent.add(g);
}

function addColonialBlock(parent, seg, side) {
  const g = new THREE.Group();
  g.position.set(seg.x, GROUND_Y, side * ROW_CENTER);
  const w = seg.w;
  const h = seg.h;
  const frontNormal = side < 0 ? 1 : -1;
  const fz = frontNormal * 6;
  const outerZ = frontNormal * 9;
  const bodyMat = seg.red ? MATS.brickRed : (seg.yellow ? MATS.yellow : (seg.ochre ? MATS.ochre : MATS.cream));

  addBox(g, w + 0.6, 0.4, ROW_DEPTH + 0.6, MATS.stone, 0, 0.2, 0);
  addBox(g, w, h, ROW_DEPTH, bodyMat, 0, 0.4 + h / 2, 0);

  if (seg.pitched) {
    addGableRoofX(g, w + 0.6, ROW_DEPTH + 0.6, 2.6, 0.4 + h + 0.4, 0, MATS.roof);
    addBox(g, w + 0.4, 0.3, 0.4, MATS.trim, 0, 0.4 + h + 0.4, frontNormal * (ROW_DEPTH / 2), false);
  } else {
    addBox(g, w + 0.4, 0.5, ROW_DEPTH + 0.4, MATS.trim, 0, 0.4 + h + 0.25, 0, false);
    addBox(g, w + 0.5, 1.0, 0.45, MATS.trim, 0, 0.4 + h + 0.55, frontNormal * (ROW_DEPTH / 2), false);
  }

  // 白色线脚
  addBox(g, w + 0.2, 0.22, 0.4, MATS.trim, 0, 0.4 + 4.2, fz, false);
  addBox(g, w + 0.2, 0.22, 0.4, MATS.trim, 0, 0.4 + 7.4, fz, false);
  addBox(g, w + 0.2, 0.22, 0.4, MATS.trim, 0, 0.4 + 10.4, fz, false);

  // 券廊/柱廊
  const count = Math.max(2, Math.round(w / 3.2));
  for (let i = 0; i <= count; i++) {
    const cx = -w / 2 + (i / count) * w;
    columnInstances.push({
      x: seg.x + cx,
      y: GROUND_Y + 0.4 + 2.1,
      z: side * ROW_CENTER + outerZ
    });
  }
  addBox(g, w, 0.36, 3.0, MATS.trim, 0, 0.4 + 4.0, frontNormal * 7.5);
  addBox(g, w, 0.28, 0.38, MATS.trim, 0, 0.4 + 3.8, outerZ, false);
  addBox(g, w, 0.28, 0.38, MATS.trim, 0, 0.4 + 3.8, fz, false);

  // 首层门/窗
  addBox(g, w - 2.0, 3.0, 0.3, MATS.door, 0, 0.4 + 1.7, fz + frontNormal * 0.08, false);
  addBox(g, 2.4, 3.0, 0.34, MATS.door, -w * 0.3, 0.4 + 1.7, fz + frontNormal * 0.12, false);

  // 上层窗（实例化）
  const rows = h >= 14 ? 3 : 2;
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col <= 1; col++) {
      windowInstances.push({
        x: seg.x + col * (w / 3.8),
        y: GROUND_Y + 0.4 + 5.5 + row * 3.1,
        z: side * ROW_CENTER + fz + frontNormal * 0.08
      });
    }
  }

  // 白色隅石
  addBox(g, 0.5, h, 0.35, MATS.trim, -w / 2 + 0.25, 0.4 + h / 2, fz + frontNormal * 0.06, false);
  addBox(g, 0.5, h, 0.35, MATS.trim, w / 2 - 0.25, 0.4 + h / 2, fz + frontNormal * 0.06, false);

  if (seg.chimney) {
    addBox(g, 0.9, 2.2, 0.9, MATS.brickRed, w * 0.25, 0.4 + h + 1.1, 0, false);
  }

  parent.add(g);
}

function addChurch(parent) {
  const g = new THREE.Group();
  g.name = "lourdes-chapel";
  g.position.set(2, GROUND_Y, -ROW_CENTER);
  addBox(g, 11, 0.5, 13, MATS.stone, 0, 0.25, 0);
  addBox(g, 10, 9, 12, MATS.churchStone, 0, 0.5 + 4.5, 0);
  addGableRoofX(g, 11, 13, 3.0, 9.5, 0, MATS.churchRoof);

  // 前塔
  addBox(g, 4.2, 15, 4.2, MATS.churchStone, 0, 8.0, 5.8);
  addBox(g, 4.8, 0.6, 4.8, MATS.trim, 0, 15.5, 5.8);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7.5, 8), MATS.churchRoof);
  spire.position.set(0, 19.5, 5.8);
  spire.castShadow = true;
  g.add(spire);
  addBox(g, 0.18, 1.4, 0.18, MATS.gold, 0, 24.0, 5.8);
  addBox(g, 0.9, 0.18, 0.18, MATS.gold, 0, 23.8, 5.8);

  // 尖拱窗 + 玫瑰窗
  const gw = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.6), new THREE.MeshStandardMaterial({ map: makeGothicWindow(), roughness: 0.5 }));
  gw.position.set(0, 6.8, 7.95);
  g.add(gw);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshStandardMaterial({ map: makeRose(), roughness: 0.45 }));
  rose.position.set(0, 11.8, 7.98);
  g.add(rose);
  addSign(g, "露德圣母堂", 0, 4.6, 8.0, 1, 3.4, 0.9, false);
  parent.add(g);
}

function addWhiteSwan(parent) {
  const g = new THREE.Group();
  g.name = "white-swan";
  g.position.set(34, GROUND_Y, 20);
  addBox(g, 17, 1.0, 12, MATS.stone, 0, 0.5, 0);
  addBox(g, 16, 5, 11, MATS.hotelWhite, 0, 3.0, 0);
  addBox(g, 13, 28, 9, MATS.hotelWhite, 0, 19.5, 0);
  for (let y = 7; y <= 31; y += 2.2) {
    addBox(g, 13.4, 0.22, 9.4, MATS.hotelBand, 0, y, 0, false);
  }
  [-3.6, 0, 3.6].forEach(function (x) {
    addBox(g, 1.4, 24, 0.2, MATS.hotelGlass, x, 18, 4.6, false);
  });
  addBox(g, 13.2, 1.0, 9.2, MATS.hotelGlass, 0, 34.0, 0, false);
  addSign(g, "白天鹅", 0, 29.5, 4.6, 1, 4.6, 1.2, false);
  parent.add(g);
}

function addPark(parent) {
  const g = new THREE.Group();
  g.name = "shamian-park";
  g.position.set(-39, GROUND_Y, 0);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 32), MATS.grass);
  top.scale.set(7, 1, 9);
  top.position.y = 0.06;
  top.receiveShadow = true;
  g.add(top);
  addCylinder(g, 1.5, 1.7, 0.4, 10, MATS.stone, 0, 0.2, 0);
  addCylinder(g, 1.0, 1.1, 0.25, 10, MATS.stone, 0, 0.5, 0);
  parent.add(g);
}

function addTrees(parent) {
  const positions = [
    [-30, 0, 0.7], [-6, 0, 0.65], [18, 0, 0.7],
    [-30, 22, 1.0], [-18, 23, 0.95], [10, 23, 1.0], [24, 23, 0.9],
    [-40, 6, 0.8], [-40, -6, 0.8]
  ];
  positions.forEach(function (p) { addBanyan(parent, p[0], p[1], p[2]); });
}

function addBridges(parent) {
  [-20, 20].forEach(function (x) {
    const g = new THREE.Group();
    g.position.set(x, 0.2, -28.5);
    addBox(g, 5.0, 0.5, 9.0, MATS.stone, 0, 0.8, 0);
    addBox(g, 5.4, 0.7, 0.4, MATS.stone, 0, 1.2, -4.4);
    addBox(g, 5.4, 0.7, 0.4, MATS.stone, 0, 1.2, 4.4);
    addBox(g, 0.4, 1.2, 9.0, MATS.stone, -2.4, 1.0, 0);
    addBox(g, 0.4, 1.2, 9.0, MATS.stone, 2.4, 1.0, 0);
    parent.add(g);
  });
}

function addQuay(parent) {
  addBox(parent, 96, 0.8, 4, MATS.stone, 0, 0.4, -34, false, true);
  addBox(parent, 96, 0.3, 1.2, MATS.grass, 0, 0.8, -34, false, true);
  for (let x = -40; x <= 40; x += 10) {
    addBanyan(parent, x, -33, 0.45);
  }
  addBox(parent, 80, 0.16, 0.18, MATS.iron, 0, 1.6, 24.7, false);
  for (let x = -38; x <= 38; x += 8) {
    addBox(parent, 0.18, 1.2, 0.18, MATS.iron, x, 1.1, 24.7, false);
  }
}

function addStreetFurniture(parent) {
  for (let x = -28; x <= 32; x += 10) {
    addCylinder(parent, 0.08, 0.1, 3.4, 6, MATS.iron, x, 2.7, 8.4);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), MATS.lamp);
    lamp.position.set(x, 4.4, 8.4);
    parent.add(lamp);
  }
  addSign(parent, "沙面大街", -34, 3.4, 6.8, 1, 2.8, 0.8, false);
  addSign(parent, "沙面公园", -34, 3.4, -6.8, 1, 2.8, 0.8, false);
}

let MATS = null;
let windowInstances = [];
let columnInstances = [];

function createMaterials(textures) {
  return {
    water: std({ map: textures.water, roughness: 0.28, metalness: 0.15 }),
    grass: std({ map: textures.grass, roughness: 0.95 }),
    stone: std({ map: textures.stone, roughness: 0.95 }),
    paving: std({ map: textures.paving, roughness: 0.95 }),
    roof: std({ map: textures.roof, roughness: 0.9 }),
    trim: std({ color: 0xf0e9dc, roughness: 0.9 }),
    cream: std({ color: 0xe8dcc5, roughness: 0.92 }),
    ochre: std({ color: 0xd8b98a, roughness: 0.92 }),
    yellow: std({ color: 0xe6d3a3, roughness: 0.92 }),
    brickRed: std({ color: 0xa55a48, roughness: 0.92 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    window: std({ map: textures.window, roughness: 0.5, metalness: 0.05 }),
    door: std({ color: 0x4a2f22, roughness: 0.8 }),
    churchStone: std({ color: 0xd9d0c0, roughness: 0.92 }),
    churchRoof: std({ color: 0x4a4f52, roughness: 0.9 }),
    hotelWhite: std({ color: 0xf4f2ec, roughness: 0.75 }),
    hotelBand: std({ color: 0xffffff, roughness: 0.7 }),
    hotelGlass: std({ color: 0x3f5a60, roughness: 0.3, metalness: 0.2 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    iron: std({ color: 0x24282a, roughness: 0.6, metalness: 0.4 }),
    lamp: std({ color: 0xfff2c9, emissive: 0x9a6a1e, emissiveIntensity: 0.5, roughness: 0.4 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 })
  };
}

function buildInstances(parent) {
  if (windowInstances.length) {
    const geo = new THREE.BoxGeometry(1.6, 2.4, 0.15);
    const mesh = new THREE.InstancedMesh(geo, MATS.window, windowInstances.length);
    const dummy = new THREE.Object3D();
    windowInstances.forEach(function (p, i) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    parent.add(mesh);
  }
  if (columnInstances.length) {
    const geo = new THREE.CylinderGeometry(0.22, 0.26, 4.2, 8);
    const mesh = new THREE.InstancedMesh(geo, MATS.trim, columnInstances.length);
    const dummy = new THREE.Object3D();
    columnInstances.forEach(function (p, i) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    parent.add(mesh);
  }
}

export function create() {
  seed = 862;
  windowInstances = [];
  columnInstances = [];

  const textures = {
    water: makeWater(),
    grass: makeGrass(),
    paving: makePaving(),
    stone: makeStone(),
    roof: makeRoof(),
    window: makeWindow()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "shamian-island-model";

  // 水面
  addBox(root, 96, 0.06, 70, MATS.water, 0, 0.03, 0, false, false);
  // 岛体：石质驳岸 + 草地顶
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.85, 64), MATS.stone);
  base.scale.set(44, 1, 25);
  base.position.y = 0.45;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 64), MATS.grass);
  top.scale.set(43, 1, 24);
  top.position.y = 0.92;
  top.receiveShadow = true;
  root.add(top);

  // 主街 + 人行道 + 街心花园
  addBox(root, 80, 0.1, 12.9, MATS.paving, 0, 0.97, 0, false, true);
  addBox(root, 80, 0.1, 2.6, MATS.stone, 0, 0.97, -7.75, false, true);
  addBox(root, 80, 0.1, 2.6, MATS.stone, 0, 0.97, 7.75, false, true);
  [-28, -16, -4, 8, 20, 32].forEach(function (x) {
    addBox(root, 5, 0.18, 2.5, MATS.grass, x, 1.0, 0, false, true);
    addBox(root, 4.6, 0.12, 0.18, MATS.trim, x, 1.08, 1.2, false, false);
    addBox(root, 4.6, 0.12, 0.18, MATS.trim, x, 1.08, -1.2, false, false);
  });

  addPark(root);
  addQuay(root);
  addBridges(root);

  const north = [
    { x: -30, w: 14, h: 15, ochre: true, pitched: true, chimney: true },
    { x: -14, w: 14, h: 14, cream: true },
    { x: 18, w: 14, h: 16, yellow: true, pitched: true },
    { x: 34, w: 14, h: 13, red: true, chimney: true }
  ];
  north.forEach(function (seg) { addColonialBlock(root, seg, -1); });

  const south = [
    { x: -30, w: 14, h: 14, cream: true, pitched: true },
    { x: -14, w: 14, h: 15, yellow: true, chimney: true },
    { x: 2, w: 14, h: 13, ochre: true },
    { x: 18, w: 14, h: 16, cream: true, pitched: true }
  ];
  south.forEach(function (seg) { addColonialBlock(root, seg, 1); });

  addChurch(root);
  addWhiteSwan(root);
  addTrees(root);
  addStreetFurniture(root);
  buildInstances(root);

  const anchors = {
    avenue: new THREE.Vector3(0, GROUND_Y + 2.5, 0),
    church: new THREE.Vector3(2, GROUND_Y + 15, -ROW_CENTER),
    hotel: new THREE.Vector3(34, GROUND_Y + 20, 20),
    park: new THREE.Vector3(-39, GROUND_Y + 2.5, 0),
    detail: new THREE.Vector3(-30, GROUND_Y + 5.5, -9)
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
