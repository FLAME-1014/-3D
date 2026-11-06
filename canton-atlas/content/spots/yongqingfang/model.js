/*
 * 永庆坊 · 恩宁路骑楼街 · 风格化单体模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 只负责几何/材质/锚点；相机、灯光、UI 由 web/js/diorama.js 负责。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");
const PAL = window.CantonPalette;
if (!PAL) throw new Error("Canton palette is not loaded");

const BASE_H = 0.8;
const GROUND_Y = 0.92;
const ROW_CENTER = 15;
const ROW_DEPTH = 12;
const STREET_EDGE = 6;

let seed = 520;
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
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.fillRect(x, y, bw - 4, 2);
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(x, y + bh - 5, bw - 4, 2);
    }
  }
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = "rgba(25,30,28," + range(0.02, 0.07).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, 2, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeStone() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#cbc2b2";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) {
      const v = 196 + Math.floor(random() * 14);
      ctx.fillStyle = "rgb(" + v + "," + (v - 5) + "," + (v - 16) + ")";
      ctx.fillRect(x + 2, y + 2, 60, 60);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + 2, y + 2, 60, 2);
    }
  }
  return colorTexture(c, 1, 1);
}

function makePaving() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#a9a396";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 128) {
      const off = (y / 64) % 2 ? 64 : 0;
      const v = 170 + Math.floor(random() * 18);
      ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 12) + ")";
      ctx.fillRect(x + off + 2, y + 2, 124, 60);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(x + off + 2, y + 2, 124, 2);
    }
  }
  return colorTexture(c, 2, 2);
}

function makeRoof() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3f4849";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = "rgba(18,22,23,0.32)";
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(0, y + 3, 512, 2);
  }
  for (let x = 0; x < 512; x += 28) {
    ctx.fillStyle = "rgba(18,22,23,0.2)";
    ctx.fillRect(x, 0, 2, 512);
  }
  return colorTexture(c, 1, 1);
}

function makeWood() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4a2f22";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = "rgba(20,10,6," + range(0.08, 0.24).toFixed(3) + ")";
    ctx.fillRect(random() * 256, 0, range(1, 3), 256);
  }
  return colorTexture(c, 1, 1);
}

function makeWindow() {
  const c = makeCanvas(256, 192);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3a241a";
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = "#2a1a12";
  ctx.fillRect(8, 8, 240, 176);
  const colors = ["#2f6b8a", "#3f7a5a", "#b07a1e", "#9a3b2e", "#6b4f8a", "#4f7a8a"];
  const cols = 5;
  const rows = 4;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = 14 + col * 46;
      const y = 14 + row * 42;
      ctx.fillStyle = colors[(row * cols + col) % colors.length];
      ctx.fillRect(x, y, 42, 34);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.moveTo(x, y + 34);
      ctx.lineTo(x + 42, y);
      ctx.lineTo(x + 42, y + 9);
      ctx.lineTo(x + 9, y + 34);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(20,10,6,0.75)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 42, 34);
    }
  }
  ctx.strokeStyle = "#5a3a2a";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 184);
  return colorTexture(c, 1, 1);
}

function makeShopGlass() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#335c5d");
  grad.addColorStop(0.5, "#224445");
  grad.addColorStop(1, "#183233");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = "rgba(200,230,220," + range(0.04, 0.1).toFixed(3) + ")";
    ctx.fillRect(20 + i * 42, 0, 8, 256);
  }
  ctx.strokeStyle = "rgba(10,20,20,0.6)";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 244);
  return colorTexture(c, 1, 1);
}

function makeDoor() {
  const c = makeCanvas(256, 384);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2f1d14";
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = "rgba(176,141,87,0.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 236, 364);
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 ? "#4a2f22" : "#3a241a";
    ctx.fillRect(22, 26 + i * 26, 212, 18);
  }
  ctx.fillStyle = "#b08d57";
  ctx.fillRect(120, 0, 16, 384);
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
    ctx.font = 'bold 64px "Songti SC", "SimSun", serif';
    chars.forEach(function (ch, i) {
      ctx.fillText(ch, c.width / 2, 30 + step * (i + 0.5));
    });
  } else {
    ctx.font = 'bold 72px "Songti SC", "SimSun", serif';
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
  const thick = 0.34;
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
  const right = new THREE.Mesh(geo, MATS.plaster);
  right.rotation.y = Math.PI / 2;
  right.position.set(w / 2, baseY, z);
  right.castShadow = true;
  parent.add(right);
  const left = new THREE.Mesh(geo, MATS.plaster);
  left.rotation.y = -Math.PI / 2;
  left.position.set(-w / 2, baseY, z);
  left.castShadow = true;
  parent.add(left);
  addBox(parent, w + 0.3, 0.18, 0.5, mat, 0, baseY + 0.02, z + halfD, false, false);
  addBox(parent, w + 0.3, 0.18, 0.5, mat, 0, baseY + 0.02, z - halfD, false, false);
}

function addGableTriangle(parent, width, height, z, y, mat, normal) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
  mesh.position.set(0, y, z);
  if (normal < 0) mesh.rotation.y = Math.PI;
  mesh.castShadow = true;
  parent.add(mesh);
}

function addLantern(parent, x, y, z, s, full) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s || 1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), MATS.lantern);
  body.scale.set(1, 1.25, 1);
  body.castShadow = true;
  g.add(body);
  addCylinder(g, 0.18, 0.18, 0.12, 8, MATS.gold, 0, 0.48, 0);
  if (full) {
    addCylinder(g, 0.18, 0.18, 0.12, 8, MATS.gold, 0, -0.48, 0);
    addCylinder(g, 0.04, 0.04, 0.5, 6, MATS.iron, 0, -0.78, 0);
  }
  parent.add(g);
}

function addTree(parent, x, z, s) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  g.scale.setScalar(s || 1);
  addCylinder(g, 0.28, 0.42, 3.6, 6, MATS.trunk, 0, 2.0, 0);
  const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), MATS.foliage);
  f1.position.set(0, 4.7, 0);
  f1.scale.set(1, 0.92, 1);
  f1.castShadow = true;
  g.add(f1);
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 1), MATS.foliage2);
  f2.position.set(1.0, 5.3, 0.35);
  f2.castShadow = true;
  g.add(f2);
  const f3 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), MATS.foliage);
  f3.position.set(-1.0, 5.1, -0.35);
  f3.castShadow = true;
  g.add(f3);
  addCylinder(g, 1.3, 1.45, 0.55, 10, MATS.stone, 0, 0.27, 0);
  parent.add(g);
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

function addPlaqueX(parent, text, x, y, z, width, height, normal) {
  const mat = new THREE.MeshStandardMaterial({
    map: makeSign(text, false),
    roughness: 0.65,
    metalness: 0.08
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(x, y, z);
  plane.rotation.y = normal > 0 ? Math.PI / 2 : -Math.PI / 2;
  parent.add(plane);
  addBox(parent, 0.1, height + 0.12, width + 0.12, MATS.woodDark, x - normal * 0.06, y, z, false, false);
}

let MATS = null;
let windowInstances = [];
let columnInstances = [];

function createMaterials(textures) {
  return {
    brickGrey: std({ map: textures.brickGrey, roughness: 0.96 }),
    brickRed: std({ map: textures.brickRed, roughness: 0.94 }),
    stone: std({ map: textures.stone, roughness: 0.95 }),
    paving: std({ map: textures.paving, color: PAL.colors.paving, roughness: 0.98 }),
    roof: std({ map: textures.roof, roughness: 0.9 }),
    wood: std({ map: textures.wood, roughness: 0.8 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    column: std({ color: 0x7a7264, roughness: 0.9 }),
    canopy: std({ color: 0x9c907c, roughness: 0.95 }),
    roofDeck: std({ color: 0x4a5253, roughness: 0.95 }),
    window: std({ map: textures.window, roughness: 0.55, metalness: 0.05 }),
    shopGlass: std({ map: textures.shopGlass, roughness: 0.28, metalness: 0.2 }),
    shopGlassWarm: std({ map: textures.shopGlass, color: 0xffd9a0, roughness: 0.3, metalness: 0.15 }),
    door: std({ map: textures.door, roughness: 0.8 }),
    plaster: std({ color: 0xd9d0bf, roughness: 0.95 }),
    metal: std({ color: 0x2b2b2b, roughness: 0.35, metalness: 0.6 }),
    red: std({ color: 0x7a1f1a, roughness: 0.7 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    iron: std({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.5 }),
    lantern: std({ color: 0xb33a2e, emissive: 0x4a0e08, emissiveIntensity: 0.7, roughness: 0.6 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x4a3528, roughness: 0.95 })
  };
}

function addShopHouse(parent, seg, side) {
  const g = new THREE.Group();
  g.position.set(seg.x, GROUND_Y, side * ROW_CENTER);
  const w = seg.w;
  const h = seg.h;
  const frontNormal = side < 0 ? 1 : -1;
  const fz = frontNormal * (ROW_DEPTH / 2);
  const outerZ = frontNormal * (ROW_DEPTH / 2 + 3);
  const brick = seg.red ? MATS.brickRed : MATS.brickGrey;

  addBox(g, w + 0.6, 0.5, ROW_DEPTH + 0.6, MATS.stone, 0, 0.25, 0);
  addBox(g, w, h, ROW_DEPTH, brick, 0, 0.5 + h / 2, 0);

  if (seg.pitched) {
    addGableRoofX(g, w + 0.6, ROW_DEPTH + 0.6, 2.4, 0.5 + h + 0.5, 0, MATS.roof);
  } else {
    addBox(g, w + 0.4, 0.5, ROW_DEPTH + 0.4, MATS.roof, 0, 0.5 + h + 0.25, 0, false);
    addBox(g, w + 0.4, 0.9, 0.4, brick, 0, 0.5 + h + 0.45, frontNormal * (ROW_DEPTH / 2), false);
    addGableTriangle(g, w * 0.52, 2.0, frontNormal * (ROW_DEPTH / 2 + 0.03), 0.5 + h + 0.5, brick, frontNormal);
  }

  // 首层店面
  addBox(g, w - 1.0, 3.8, 0.22, seg.modern ? MATS.metal : MATS.woodDark, 0, 0.5 + 1.9, fz, false);
  addBox(g, w - 1.8, 3.2, 0.28, seg.modern ? MATS.shopGlass : (seg.warm ? MATS.shopGlassWarm : MATS.shopGlass), 0, 0.5 + 1.8, fz + frontNormal * 0.05, false);
  addBox(g, 2.2, 3.2, 0.32, MATS.door, w * 0.18, 0.5 + 1.6, fz + frontNormal * 0.12, false);
  addBox(g, w, 0.18, 0.3, MATS.plaster, 0, 0.5 + 4.2, fz, false);

  // 上层窗（实例化）
  const rows = h >= 14 ? 3 : 2;
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col <= 1; col++) {
      windowInstances.push({
        x: seg.x + col * (w / 3.8),
        y: GROUND_Y + 0.5 + 5.6 + row * 3.0,
        z: side * ROW_CENTER + fz + frontNormal * 0.08
      });
    }
    addBox(g, w, 0.16, 0.25, MATS.plaster, 0, 0.5 + 4.8 + row * 3.0, fz, false);
  }

  // 骑楼柱（实例化）+ 顶棚
  const count = Math.max(2, Math.round(w / 3));
  for (let i = 0; i <= count; i++) {
    const cx = -w / 2 + (i / count) * w;
    columnInstances.push({
      x: seg.x + cx,
      y: GROUND_Y + 0.5 + 2.1,
      z: side * ROW_CENTER + outerZ
    });
  }
  addBox(g, w, 0.38, 3.0, MATS.canopy, 0, 0.5 + 4.2, frontNormal * (ROW_DEPTH / 2 + 1.5));
  addBox(g, w, 0.3, 0.4, MATS.woodDark, 0, 0.5 + 4.0, outerZ, false);
  addBox(g, w, 0.3, 0.4, MATS.woodDark, 0, 0.5 + 4.0, fz, false);

  addLantern(g, 0, 3.5, outerZ + frontNormal * 0.85, 0.75, false);

  if (seg.sign) {
    addSign(g, seg.sign, -w / 2 + 1.25, 6.6, fz + frontNormal * 0.2, frontNormal, 0.9, 3.0, true);
  }

  parent.add(g);
}

function addStreet(parent) {
  addBox(parent, 90, BASE_H, 70, MATS.stone, 0, BASE_H / 2, 0, false, true);
  addBox(parent, 84, 0.1, 12, MATS.paving, 0, 0.85, 0, false, true);
  addBox(parent, 84, 0.1, 3, MATS.stone, 0, 0.85, -7.5, false, true);
  addBox(parent, 84, 0.1, 3, MATS.stone, 0, 0.85, 7.5, false, true);
  addBox(parent, 4, 0.1, 12, MATS.paving, 0, 0.86, -15, false, true);
}

function addGate(parent) {
  const g = new THREE.Group();
  g.name = "gate";
  g.position.set(-44, GROUND_Y, 0);
  addBox(g, 5, 0.6, 14, MATS.stone, 0, 0.3, 0);
  addBox(g, 1.2, 6, 1.2, MATS.stone, 0, 3, -6.5);
  addBox(g, 1.2, 6, 1.2, MATS.stone, 0, 3, 6.5);
  addBox(g, 1.0, 6, 4.5, MATS.brickGrey, 0, 3, -4.25);
  addBox(g, 1.0, 6, 4.5, MATS.brickGrey, 0, 3, 4.25);
  addBox(g, 0.2, 4.8, 3.8, MATS.woodDark, -0.55, 2.4, 0, false);
  addBox(g, 1.2, 0.2, 4.0, MATS.stone, 0, 0.1, 0, false, true);
  addBox(g, 3.2, 1.2, 13, MATS.woodDark, 0, 6.2, 0);
  const roof = new THREE.Group();
  roof.position.set(0, 6.8, 0);
  roof.rotation.y = Math.PI / 2;
  addGableRoofX(roof, 14, 6, 2.2, 0, 0, MATS.roof);
  g.add(roof);
  addPlaqueX(g, "永庆坊", 1.65, 6.2, 0, 4.2, 1.2, 1);
  addLantern(g, 2.0, 5.5, -4.2, 0.85, true);
  addLantern(g, 2.0, 5.5, 4.2, 0.85, true);
  addBox(g, 0.8, 3.2, 2.5, MATS.brickGrey, 0, 1.6, -8.5, false);
  addBox(g, 0.8, 3.2, 2.5, MATS.brickGrey, 0, 1.6, 8.5, false);
  parent.add(g);
}

function addBruceLeeHouse(parent) {
  const g = new THREE.Group();
  g.name = "bruce-lee-house";
  g.position.set(0, GROUND_Y, -27);
  addBox(g, 10, 0.5, 13, MATS.stone, 0, 0.25, 0);
  addBox(g, 8.5, 8.5, 12, MATS.brickGrey, 0, 0.5 + 4.25, 0);
  addGableRoofX(g, 9.5, 13, 2.6, 0.5 + 8.5 + 0.5, 0, MATS.roof);
  addBox(g, 2.4, 3.4, 0.3, MATS.woodDark, 0, 2.2, 6.04, false);
  addBox(g, 2.0, 3.0, 0.34, MATS.door, 0, 2.1, 6.15, false);
  addBox(g, 1.8, 1.4, 0.15, MATS.window, -2.4, 5.5, 6.08, false);
  addBox(g, 1.8, 1.4, 0.15, MATS.window, 2.4, 5.5, 6.08, false);
  addSign(g, "李小龙祖居", 0, 4.9, 6.28, 1, 1.0, 2.6, true);
  addBox(g, 0.6, 2.2, 0.6, MATS.stone, -4.2, 1.1, 7.0, false);
  addBox(g, 0.6, 2.2, 0.6, MATS.stone, 4.2, 1.1, 7.0, false);
  parent.add(g);

  // 巷口门架
  const a = new THREE.Group();
  a.name = "bruce-lee-alley";
  a.position.set(0, GROUND_Y, -9.2);
  addBox(a, 0.5, 4.2, 0.5, MATS.stone, -2.2, 2.1, 0);
  addBox(a, 0.5, 4.2, 0.5, MATS.stone, 2.2, 2.1, 0);
  addBox(a, 5.2, 0.5, 0.6, MATS.woodDark, 0, 4.1, 0);
  addSign(a, "李小龙祖居", 0, 3.5, 0.35, 1, 3.4, 0.9, false);
  parent.add(a);
}

function addOperaStage(parent) {
  const g = new THREE.Group();
  g.name = "opera-stage";
  g.position.set(35, GROUND_Y, ROW_CENTER);
  addBox(g, 12, 0.8, 13, MATS.stone, 0, 0.4, 0);
  addBox(g, 10, 8, 0.6, MATS.brickRed, 0, 4.8, 6);
  addBox(g, 0.6, 8, 12, MATS.brickRed, -5, 4.8, 0);
  addBox(g, 0.6, 8, 12, MATS.brickRed, 5, 4.8, 0);
  addGableRoofX(g, 12.5, 14, 3.2, 8.8, 0, MATS.roof);
  for (let i = -4; i <= 4; i += 2) {
    addCylinder(g, 0.3, 0.35, 8, 8, MATS.red, i, 4.0, -6);
  }
  addBox(g, 10, 0.8, 0.3, MATS.woodDark, 0, 1.2, -6.2, false);
  addBox(g, 8, 0.3, 1.2, MATS.stone, 0, 0.15, -6.9, false, true);
  addSign(g, "广福台", 0, 7.35, -6.35, -1, 3.6, 1.1, false);
  addLantern(g, -3.2, 6.1, -5.6, 0.8, false);
  addLantern(g, 3.2, 6.1, -5.6, 0.8, false);
  parent.add(g);
}

function addTrees(parent) {
  addTree(parent, -22, -4.3, 0.8);
  addTree(parent, 8, 4.6, 0.6);
}

function addDetails(parent) {
  addBox(parent, 3.0, 0.2, 0.8, MATS.woodDark, -10, 1.35, 4.6, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stone, -11.2, 1.0, 4.6, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stone, -8.8, 1.0, 4.6, false, true);
  addBox(parent, 3.0, 0.2, 0.8, MATS.woodDark, 10, 1.35, -4.6, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stone, 11.2, 1.0, -4.6, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stone, 8.8, 1.0, -4.6, false, true);
  for (let i = 0; i < 4; i++) {
    addCylinder(parent, 0.18, 0.24, 1.0, 6, MATS.stone, -40 + i * 1.2, 1.3, 5.4);
  }
  addBox(parent, 0.8, 2.4, 0.2, MATS.metal, 4.0, 5.0, -9.1, false);
  addSign(parent, "恩宁路", 4.0, 6.6, -9.18, 1, 0.8, 2.2, true);
}

function buildInstances(parent) {
  if (windowInstances.length) {
    const geo = new THREE.BoxGeometry(2.0, 1.5, 0.15);
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
    mesh.receiveShadow = false;
    parent.add(mesh);
  }
  if (columnInstances.length) {
    const geo = new THREE.CylinderGeometry(0.28, 0.32, 4.2, 8);
    const mesh = new THREE.InstancedMesh(geo, MATS.column, columnInstances.length);
    const dummy = new THREE.Object3D();
    columnInstances.forEach(function (p, i) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

export function create() {
  seed = 520;
  windowInstances = [];
  columnInstances = [];

  const textures = {
    brickGrey: makeBrick("#6f7a76", "#9aa19b"),
    brickRed: makeBrick("#9a5a48", "#b98a76"),
    stone: makeStone(),
    paving: makePaving(),
    roof: makeRoof(),
    wood: makeWood(),
    window: makeWindow(),
    shopGlass: makeShopGlass(),
    door: makeDoor()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "yongqingfang-model";

  addStreet(root);
  addGate(root);

  const north = [
    { x: -36, w: 12, h: 12.5, red: false, sign: "恩宁路" },
    { x: -22, w: 12, h: 14.0, red: false, pitched: true },
    { x: -8, w: 12, h: 12.0, red: true, modern: true, sign: "永庆坊" },
    { x: 8, w: 12, h: 15.0, red: false },
    { x: 22, w: 12, h: 13.0, red: false, warm: true, sign: "山野鲜果" },
    { x: 36, w: 12, h: 12.0, red: true, pitched: true }
  ];
  north.forEach(function (seg) { addShopHouse(root, seg, -1); });

  const south = [
    { x: -36, w: 12, h: 13.0, red: false },
    { x: -22, w: 12, h: 12.5, red: true, sign: "骑楼" },
    { x: -8, w: 12, h: 14.5, red: false, pitched: true },
    { x: 8, w: 12, h: 12.0, red: false, warm: true },
    { x: 22, w: 8, h: 13.0, red: false, modern: true }
  ];
  south.forEach(function (seg) { addShopHouse(root, seg, 1); });

  addBruceLeeHouse(root);
  addOperaStage(root);
  addTrees(root);
  addDetails(root);
  buildInstances(root);

  const anchors = {
    gate: new THREE.Vector3(-44, GROUND_Y + 7.35, 0),
    street: new THREE.Vector3(0, GROUND_Y + 2, 0),
    arcade: new THREE.Vector3(-20, 2.5, -7.5),
    detail: new THREE.Vector3(-35, GROUND_Y + 6.5, -8.8),
    alley_view: new THREE.Vector3(0, GROUND_Y + 3, -13),
    bruce_lee: new THREE.Vector3(0, GROUND_Y + 4.2, -10),
    stage: new THREE.Vector3(35, GROUND_Y + 6.5, 9)
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
