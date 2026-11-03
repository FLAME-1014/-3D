/*
 * 陈家祠 · 风格化单体模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 只负责几何/材质/锚点；相机、灯光、UI 由 web/js/diorama.js 负责。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const BASE_H = 0.8;
const GROUND_Y = 0.92;

const RIDGE_COLORS = [
  0xb5432f, 0x2f6b5f, 0xb07a1e, 0x6b4f8a, 0x3f5f7a, 0xd9c9a3, 0x8a3b2e, 0x4f7a5a
];

let seed = 1894;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function range(a, b) {
  return a + (b - a) * random();
}
function pick(list) {
  return list[Math.floor(random() * list.length)];
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

function makeBrick() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#8a918c";
  ctx.fillRect(0, 0, 512, 512);
  const bw = 64;
  const bh = 24;
  for (let row = 0; row < 512 / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 9; col++) {
      const x = col * bw + off + 2;
      const y = row * bh + 2;
      const v = 92 + Math.floor(random() * 16);
      ctx.fillStyle = "rgb(" + v + "," + (v + 4) + "," + (v + 2) + ")";
      ctx.fillRect(x, y, bw - 4, bh - 4);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x, y, bw - 4, 2);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(x, y + bh - 5, bw - 4, 2);
    }
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = "rgba(30,36,34," + range(0.02, 0.08).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, 2, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeRoof() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3e4648";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 14) {
    ctx.fillStyle = "rgba(20,24,25,0.32)";
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(0, y + 3, 512, 2);
  }
  for (let col = 0; col < 512; col += 28) {
    for (let y = 0; y < 512; y += 28) {
      ctx.fillStyle = "rgba(20,24,25,0.2)";
      ctx.fillRect(col + (y % 56 === 0 ? 0 : 14), y, 2, 26);
    }
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = "rgba(180,190,185," + range(0.02, 0.06).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, 1, 3);
  }
  return colorTexture(c, 1, 1);
}

function makeStone() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#cfc6b6";
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
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = "rgba(80,70,58," + range(0.01, 0.05).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, 2, 2);
  }
  return colorTexture(c, 1, 1);
}

function makePath() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ded4c2";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 128) {
      const off = y % 128 === 0 ? 0 : 64;
      const v = 210 + Math.floor(random() * 14);
      ctx.fillStyle = "rgb(" + v + "," + (v - 6) + "," + (v - 18) + ")";
      ctx.fillRect(x + off + 2, y + 2, 124, 60);
    }
  }
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = "rgba(90,78,62," + range(0.01, 0.04).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, 2, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeWood() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4a2f22";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = random() * 256;
    ctx.fillStyle = "rgba(20,10,6," + range(0.08, 0.25).toFixed(3) + ")";
    ctx.fillRect(x, 0, range(1, 3), 256);
  }
  for (let i = 0; i < 6; i++) {
    const x = random() * 256;
    const y = random() * 256;
    ctx.strokeStyle = "rgba(25,12,8,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, range(3, 8), range(8, 18), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  return colorTexture(c, 1, 1);
}

function makeScreen() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3a241a";
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 12) {
    ctx.fillStyle = "rgba(15,8,5,0.55)";
    ctx.fillRect(x, 0, 4, 256);
    ctx.fillStyle = "rgba(120,82,52,0.25)";
    ctx.fillRect(x + 4, 0, 1, 256);
  }
  ctx.strokeStyle = "rgba(176,141,87,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 240, 240);
  ctx.strokeStyle = "rgba(176,141,87,0.28)";
  ctx.beginPath();
  ctx.moveTo(8, 128);
  ctx.lineTo(248, 128);
  ctx.stroke();
  return colorTexture(c, 1, 1);
}

function makeDoor() {
  const c = makeCanvas(256, 384);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, "#a8322a");
  grad.addColorStop(0.5, "#8f2420");
  grad.addColorStop(1, "#6f1a18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = "rgba(40,10,8,0.8)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 378);
  ctx.strokeStyle = "rgba(176,141,87,0.8)";
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 224, 352);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 52 + col * 76;
      const y = 58 + row * 80;
      ctx.fillStyle = "#b08d57";
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,240,190,0.55)";
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "rgba(30,8,6,0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 384);
  ctx.stroke();
  ctx.strokeStyle = "#b08d57";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 240, 18, 0, Math.PI * 2);
  ctx.stroke();
  return colorTexture(c, 1, 1);
}

function makePlaque() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#171514";
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "#b08d57";
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, 476, 220);
  ctx.strokeStyle = "rgba(176,141,87,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, 444, 188);
  ctx.fillStyle = "#d9b46a";
  ctx.font = 'bold 96px "Songti SC", "SimSun", "Noto Serif SC", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("陈氏书院", 256, 128);
  ctx.font = '20px "Songti SC", "SimSun", serif';
  ctx.fillStyle = "rgba(217,180,106,0.75)";
  ctx.fillText("CHEN CLAN ANCESTRAL HALL", 256, 206);
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
  const gableGeo = new THREE.ShapeGeometry(shape);
  const right = new THREE.Mesh(gableGeo, MATS.plaster);
  right.rotation.y = Math.PI / 2;
  right.position.set(w / 2, baseY, z);
  right.castShadow = true;
  parent.add(right);
  const left = new THREE.Mesh(gableGeo, MATS.plaster);
  left.rotation.y = -Math.PI / 2;
  left.position.set(-w / 2, baseY, z);
  left.castShadow = true;
  parent.add(left);

  addBox(parent, w + 0.3, 0.18, 0.5, mat, 0, baseY + 0.02, z + halfD, false, false);
  addBox(parent, w + 0.3, 0.18, 0.5, mat, 0, baseY + 0.02, z - halfD, false, false);
}

function addRidgeFigures(parent, width, y, z, count) {
  const geo = new THREE.IcosahedronGeometry(0.3, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const end = i === 0 || i === count - 1;
    const x = -width / 2 + t * width + range(-0.16, 0.16);
    dummy.position.set(x, y + range(0, 0.24), z + range(-0.2, 0.2));
    dummy.rotation.set(range(0, Math.PI), range(0, Math.PI), range(0, Math.PI));
    const s = end ? range(1.5, 2.0) : range(0.72, 1.2);
    dummy.scale.set(s, s * range(0.9, 1.3), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(pick(RIDGE_COLORS));
    mesh.setColorAt(i, color);
  }
  mesh.castShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  parent.add(mesh);
}

function addRidgeEnds(parent, width, y, z) {
  const geo = new THREE.ConeGeometry(0.28, 1.5, 4);
  const left = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.4, metalness: 0.4 }));
  left.position.set(-width / 2 - 0.18, y + 0.55, z);
  left.rotation.z = 0.55;
  left.castShadow = true;
  parent.add(left);
  const right = new THREE.Mesh(geo, left.material);
  right.position.set(width / 2 + 0.18, y + 0.55, z);
  right.rotation.z = -0.55;
  right.castShadow = true;
  parent.add(right);
}

function addColumn(parent, x, z, height, baseY) {
  addCylinder(parent, 0.27, 0.32, height, 8, MATS.wood, x, baseY + height / 2, z);
  addCylinder(parent, 0.45, 0.5, 0.28, 8, MATS.stoneLight, x, baseY + 0.14, z);
}

function addLantern(parent, x, y, z, s) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s || 1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), MATS.lantern);
  body.scale.set(1, 1.25, 1);
  body.castShadow = true;
  g.add(body);
  addCylinder(g, 0.18, 0.18, 0.12, 8, MATS.gold, 0, 0.48, 0);
  addCylinder(g, 0.18, 0.18, 0.12, 8, MATS.gold, 0, -0.48, 0);
  addCylinder(g, 0.04, 0.04, 0.5, 6, MATS.iron, 0, -0.78, 0);
  parent.add(g);
}

function addLion(parent, x, z, s) {
  const g = new THREE.Group();
  g.position.set(x, 0.5, z);
  g.scale.setScalar(s || 1);
  addBox(g, 1.7, 0.45, 1.7, MATS.stoneLight, 0, 0.22, 0, false, true);
  addBox(g, 0.95, 1.0, 0.9, MATS.stoneLight, 0, 0.95, 0, false, false);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(0.66, 10, 8), MATS.stoneLight);
  mane.position.set(0, 1.55, -0.1);
  mane.scale.set(1, 0.95, 0.8);
  mane.castShadow = true;
  g.add(mane);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), MATS.stoneLight);
  head.position.set(0, 1.66, 0.14);
  head.castShadow = true;
  g.add(head);
  const earGeo = new THREE.ConeGeometry(0.15, 0.34, 5);
  [-0.3, 0.3].forEach(function (dx) {
    const ear = new THREE.Mesh(earGeo, MATS.stoneLight);
    ear.position.set(dx, 2.02, 0.1);
    ear.rotation.z = dx > 0 ? -0.35 : 0.35;
    g.add(ear);
  });
  addBox(g, 0.28, 0.5, 0.5, MATS.stoneLight, -0.3, 0.55, 0.45, false, false);
  addBox(g, 0.28, 0.5, 0.5, MATS.stoneLight, 0.3, 0.55, 0.45, false, false);
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
  addCylinder(g, 1.3, 1.45, 0.55, 10, MATS.stoneLight, 0, 0.27, 0);
  parent.add(g);
}

function addFacade(parent, h) {
  const zf = h.d / 2 + 0.12;
  const count = h.w >= 30 ? 5 : 4;
  const panelW = Math.min(3.2, (h.w - 4) / count - 0.9);
  const gap = 0.8;
  const total = count * panelW + (count - 1) * gap;
  const start = -total / 2 + panelW / 2;
  for (let i = 0; i < count; i++) {
    const x = start + i * (panelW + gap);
    addBox(parent, panelW, 4.9, 0.18, MATS.woodDark, x, 2.85, zf, false, false);
    addBox(parent, panelW - 0.36, 4.25, 0.2, MATS.screen, x, 2.85, zf + 0.12, false, false);
  }
  addBox(parent, h.w, 0.45, 0.55, MATS.woodDark, 0, 5.5, zf + 0.1, false, false);
  const colH = h.h * 0.78;
  addColumn(parent, -h.w / 2 + 1.2, zf + 0.28, colH, 0.5);
  addColumn(parent, h.w / 2 - 1.2, zf + 0.28, colH, 0.5);
  for (let i = 1; i < count; i++) {
    const x = start + i * (panelW + gap) - (panelW + gap) / 2;
    addColumn(parent, x, zf + 0.28, colH, 0.5);
  }
  if (h.plaque) {
    addBox(parent, 6.4, 2.1, 0.14, MATS.gold, 0, 6.95, zf + 0.18, false, false);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.8), MATS.plaque);
    plaque.position.set(0, 6.95, zf + 0.27);
    parent.add(plaque);
  }
  addLantern(parent, -h.w * 0.3, 8.0, zf + 0.45, 0.8);
  addLantern(parent, h.w * 0.3, 8.0, zf + 0.45, 0.8);
}

function addSideWindows(parent, h) {
  [-h.d * 0.22, h.d * 0.22].forEach(function (zoff) {
    addBox(parent, 0.16, 2.8, 1.5, MATS.screen, h.w / 2 + 0.06, 3.2, zoff, false, false);
    addBox(parent, 0.16, 2.8, 1.5, MATS.screen, -h.w / 2 - 0.06, 3.2, zoff, false, false);
  });
}

function addHall(parent, h) {
  const g = new THREE.Group();
  g.name = h.name || "hall";
  g.position.set(h.x, GROUND_Y, h.z);
  addBox(g, h.w + 2, 0.5, h.d + 2, MATS.stoneLight, 0, 0.25, 0);
  addBox(g, h.w, h.h, h.d, MATS.brick, 0, 0.5 + h.h / 2, 0);
  addGableRoofX(g, h.w + 2.4, h.d + 2.4, h.roof, 0.5 + h.h, 0, MATS.roof);
  addBox(g, h.w + 2.8, 0.38, 0.7, MATS.ridgeBand, 0, 0.5 + h.h + h.roof + 0.08, 0, false, false);
  addRidgeFigures(g, h.w, 0.5 + h.h + h.roof + 0.35, 0, Math.max(6, Math.round(h.w / 2.6)));
  addRidgeEnds(g, h.w + 2.8, 0.5 + h.h + h.roof + 0.1, 0);
  addFacade(g, h);
  addSideWindows(g, h);
  parent.add(g);
}

function addGate(parent) {
  const g = new THREE.Group();
  g.name = "gate";
  g.position.set(0, GROUND_Y, 27.5);
  addBox(g, 18, 0.5, 8, MATS.stoneLight, 0, 0.25, 0);
  addBox(g, 18, 8, 8, MATS.brick, 0, 4.5, 0);
  addGableRoofX(g, 20, 9.6, 3.6, 8.5, 0, MATS.roof);
  addBox(g, 20.4, 0.38, 0.7, MATS.ridgeBand, 0, 12.18, 0, false, false);
  addRidgeFigures(g, 20, 12.45, 0, 8);
  addRidgeEnds(g, 20.4, 12.2, 0);
  addBox(g, 8.2, 5.8, 0.18, MATS.gold, 0, 3.4, 3.96, false, false);
  addBox(g, 3.6, 5.4, 0.22, MATS.door, -1.9, 3.2, 4.06, false, false);
  addBox(g, 3.6, 5.4, 0.22, MATS.door, 1.9, 3.2, 4.06, false, false);
  addBox(g, 6.4, 2.1, 0.14, MATS.gold, 0, 7.35, 4.12, false, false);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.8), MATS.plaque);
  plaque.position.set(0, 7.35, 4.22);
  g.add(plaque);
  addLantern(g, -5.2, 7.6, 4.35, 0.9);
  addLantern(g, 5.2, 7.6, 4.35, 0.9);
  addLion(g, -6.8, 5.2, 0.9);
  addLion(g, 6.8, 5.2, 0.9);
  addBox(g, 14, 0.28, 2.2, MATS.stoneLight, 0, 0.14, 5.4, false, true);
  addBox(g, 16, 0.18, 1.2, MATS.stoneLight, 0, 0.09, 6.2, false, true);
  parent.add(g);
}

function addWalls(parent) {
  function wall(x, z, w, d, h) {
    addBox(parent, w, h, d, MATS.brick, x, GROUND_Y + h / 2, z);
    addBox(parent, w + 0.5, 0.3, d + 0.5, MATS.roofDark, x, GROUND_Y + h + 0.15, z, false, false);
  }
  wall(-24.5, 30, 31, 1.2, 4.8);
  wall(24.5, 30, 31, 1.2, 4.8);
  wall(0, -30, 80, 1.2, 4.8);
  wall(-40, 0, 1.2, 60, 4.8);
  wall(40, 0, 1.2, 60, 4.8);
}

function addSideHalls(parent) {
  const defs = [
    { x: -24, z: 15, w: 9, d: 12, h: 7.2, roof: 3.2 },
    { x: -24, z: -2, w: 9, d: 14, h: 7.6, roof: 3.4 },
    { x: -24, z: -20, w: 9, d: 12, h: 7.2, roof: 3.2 },
    { x: 24, z: 15, w: 9, d: 12, h: 7.2, roof: 3.2 },
    { x: 24, z: -2, w: 9, d: 14, h: 7.6, roof: 3.4 },
    { x: 24, z: -20, w: 9, d: 12, h: 7.2, roof: 3.2 }
  ];
  defs.forEach(function (h) {
    const g = new THREE.Group();
    g.position.set(h.x, GROUND_Y, h.z);
    addBox(g, h.w + 1.6, 0.5, h.d + 1.6, MATS.stoneLight, 0, 0.25, 0);
    addBox(g, h.w, h.h, h.d, MATS.brick, 0, 0.5 + h.h / 2, 0);
    addGableRoofX(g, h.w + 1.8, h.d + 1.8, h.roof, 0.5 + h.h, 0, MATS.roof);
    addBox(g, h.w + 2.2, 0.34, 0.6, MATS.ridgeBand, 0, 0.5 + h.h + h.roof + 0.06, 0, false, false);
    addRidgeFigures(g, h.w, 0.5 + h.h + h.roof + 0.3, 0, 6);
    const inner = h.x < 0 ? 1 : -1;
    for (let i = -1; i <= 1; i++) {
      addBox(g, 0.18, 3.0, 1.7, MATS.woodDark, inner * (h.w / 2 + 0.02), 3.2, i * 3.2, false, false);
      addBox(g, 0.16, 2.8, 1.5, MATS.screen, inner * (h.w / 2 + 0.05), 3.2, i * 3.2, false, false);
    }
    parent.add(g);
  });
}

function addPaving(parent) {
  addBox(parent, 78, 0.1, 62, MATS.path, 0, 0.85, 0, false, true);
  addBox(parent, 6, 0.05, 58, MATS.stone, 0, 0.925, 0, false, true);
  addBox(parent, 46, 0.05, 3.2, MATS.stone, 0, 0.925, 8, false, true);
  addBox(parent, 46, 0.05, 3.2, MATS.stone, 0, 0.925, -11, false, true);
  addBox(parent, 0.22, 0.12, 58, MATS.stoneLight, -3.1, 0.95, 0, false, false);
  addBox(parent, 0.22, 0.12, 58, MATS.stoneLight, 3.1, 0.95, 0, false, false);
}

function addAlleys(parent) {
  [-16.5, 16.5].forEach(function (x) {
    addBox(parent, 5.2, 0.05, 44, MATS.path, x, 0.925, -4, false, true);
    addBox(parent, 0.2, 0.12, 44, MATS.stoneLight, x - 2.6, 0.95, -4, false, false);
    addBox(parent, 0.2, 0.12, 44, MATS.stoneLight, x + 2.6, 0.95, -4, false, false);
  });
}

function addTrees(parent) {
  [
    [-14, 8.5, 0.9], [14, 8.5, 0.9],
    [-14, -11, 0.85], [14, -11, 0.85],
    [-34, 18, 1.0], [34, 18, 1.0],
    [-34, -20, 1.0], [34, -20, 1.0]
  ].forEach(function (t) { addTree(parent, t[0], t[1], t[2]); });
}

function addDetails(parent) {
  addBox(parent, 3.0, 0.18, 0.8, MATS.woodDark, -10, 1.35, 8, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stoneLight, -11.2, 1.0, 8, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stoneLight, -8.8, 1.0, 8, false, true);
  addBox(parent, 3.0, 0.18, 0.8, MATS.woodDark, 10, 1.35, 8, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stoneLight, 11.2, 1.0, 8, false, true);
  addBox(parent, 0.2, 0.5, 0.6, MATS.stoneLight, 8.8, 1.0, 8, false, true);
  const burner = addCylinder(parent, 0.8, 1.0, 0.8, 10, MATS.stoneLight, 0, 1.3, 8);
  burner.castShadow = true;
  addCylinder(parent, 0.45, 0.55, 0.5, 10, MATS.iron, 0, 1.9, 8);
}

function createMaterials(textures) {
  const mats = {
    brick: std({ map: textures.brick, roughness: 0.96 }),
    stone: std({ map: textures.stone, roughness: 0.95 }),
    stoneLight: std({ color: 0xd8d0c0, roughness: 0.95 }),
    path: std({ map: textures.path, roughness: 0.95 }),
    roof: std({ map: textures.roof, roughness: 0.9 }),
    roofDark: std({ color: 0x2f3436, roughness: 0.9 }),
    ridgeBand: std({ color: 0x5a3a30, roughness: 0.82 }),
    plaster: std({ color: 0xd9d0bf, roughness: 0.95 }),
    wood: std({ map: textures.wood, roughness: 0.8 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    screen: std({ map: textures.screen, roughness: 0.8 }),
    door: std({ map: textures.door, roughness: 0.72 }),
    plaque: std({ map: textures.plaque, roughness: 0.6, metalness: 0.1 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    lantern: std({ color: 0xb33a2e, emissive: 0x4a0e08, emissiveIntensity: 0.7, roughness: 0.6 }),
    trunk: std({ color: 0x4a3528, roughness: 0.95 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    iron: std({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.5 })
  };
  return mats;
}

let MATS = null;

export function create() {
  seed = 1894;

  const textures = {
    brick: makeBrick(),
    roof: makeRoof(),
    stone: makeStone(),
    path: makePath(),
    wood: makeWood(),
    screen: makeScreen(),
    door: makeDoor(),
    plaque: makePlaque()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "chenjiaci-model";

  addBox(root, 84, BASE_H, 68, MATS.stone, 0, BASE_H / 2, 0, false, true);
  addBox(root, 84.6, 0.12, 68.6, MATS.stoneLight, 0, BASE_H - 0.06, 0, false, true);
  addPaving(root);
  addWalls(root);
  addGate(root);

  addHall(root, { name: "front-hall", x: 0, z: 15, w: 28, d: 12, h: 9.4, roof: 4.2, plaque: true });
  addHall(root, { name: "middle-hall", x: 0, z: -2, w: 32, d: 14, h: 10.4, roof: 4.6, plaque: false });
  addHall(root, { name: "rear-hall", x: 0, z: -20, w: 28, d: 12, h: 9.4, roof: 4.2, plaque: false });

  addSideHalls(root);
  addAlleys(root);
  addTrees(root);
  addDetails(root);

  const anchors = {
    roof_figures: new THREE.Vector3(0, GROUND_Y + 15.9, -2),
    wood_screens: new THREE.Vector3(0, GROUND_Y + 3.0, 21.4),
    courtyard: new THREE.Vector3(0, 1.25, 8),
    alley: new THREE.Vector3(16.5, 1.3, 22),
    alley_view: new THREE.Vector3(16.5, 1.3, 6),
    gate: new THREE.Vector3(0, GROUND_Y + 7.4, 31.8),
    side_hall: new THREE.Vector3(-24, GROUND_Y + 8.0, 15)
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
