/*
 * 北京路 · 千年古道 · 风格化街段模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：80m 北京路步行街 + 千年古道玻璃罩 + 两侧骑楼 + 大佛寺金顶/山门。
 * 不是整条 1252m 的 1:1 复原。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const GROUND_Y = 1.0;
const ROW_CENTER = 18;
const ROW_DEPTH = 12;
const STREET_EDGE = 8;

let seed = 1252;
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
    }
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
  const c = makeCanvas(256, 320);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e8dcc5";
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = "#2d3f45";
  ctx.fillRect(24, 24, 208, 272);
  ctx.fillStyle = "#6b8f96";
  ctx.fillRect(34, 34, 188, 252);
  ctx.strokeStyle = "#e8dcc5";
  ctx.lineWidth = 10;
  ctx.strokeRect(34, 34, 188, 252);
  ctx.beginPath();
  ctx.moveTo(128, 34);
  ctx.lineTo(128, 286);
  ctx.moveTo(34, 160);
  ctx.lineTo(222, 160);
  ctx.stroke();
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
    ctx.fillStyle = "rgba(220,240,235," + range(0.04, 0.1).toFixed(3) + ")";
    ctx.fillRect(20 + i * 42, 0, 8, 256);
  }
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
  addCylinder(g, 0.42, 0.6, 4.2, 7, MATS.trunk, 0, 2.1, 0);
  const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), MATS.foliage);
  f1.position.set(0, 5.2, 0);
  f1.scale.set(1.15, 0.85, 1.15);
  f1.castShadow = true;
  g.add(f1);
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), MATS.foliage2);
  f2.position.set(1.5, 5.8, 0.5);
  f2.castShadow = true;
  g.add(f2);
  parent.add(g);
}

function addArcadeBlock(parent, seg, side) {
  const g = new THREE.Group();
  g.position.set(seg.x, GROUND_Y, side * ROW_CENTER);
  const w = seg.w;
  const h = seg.h;
  const frontNormal = side < 0 ? 1 : -1;
  const fz = frontNormal * 6;
  const outerZ = frontNormal * 10;
  const bodyMat = seg.red ? MATS.brickRed : (seg.yellow ? MATS.yellow : MATS.cream);

  addBox(g, w + 0.6, 0.4, ROW_DEPTH + 0.6, MATS.stone, 0, 0.2, 0);
  addBox(g, w, h, ROW_DEPTH, bodyMat, 0, 0.4 + h / 2, 0);

  if (seg.pitched) {
    addGableRoofX(g, w + 0.6, ROW_DEPTH + 0.6, 2.4, 0.4 + h + 0.4, 0, MATS.roof);
  } else {
    addBox(g, w + 0.4, 0.5, ROW_DEPTH + 0.4, MATS.roof, 0, 0.4 + h + 0.25, 0, false);
    addBox(g, w + 0.5, 0.9, 0.45, MATS.plaster, 0, 0.4 + h + 0.45, frontNormal * (ROW_DEPTH / 2), false);
  }

  addBox(g, w + 0.2, 0.2, 0.4, MATS.plaster, 0, 0.4 + 4.3, fz, false);
  addBox(g, w + 0.2, 0.2, 0.4, MATS.plaster, 0, 0.4 + 7.5, fz, false);

  const count = Math.max(2, Math.round(w / 3.6));
  for (let i = 0; i <= count; i++) {
    const cx = -w / 2 + (i / count) * w;
    columnInstances.push({
      x: seg.x + cx,
      y: GROUND_Y + 0.4 + 2.1,
      z: side * ROW_CENTER + outerZ
    });
  }
  addBox(g, w, 0.38, 4.0, MATS.plaster, 0, 0.4 + 4.1, frontNormal * 8);
  addBox(g, w, 0.28, 0.35, MATS.woodDark, 0, 0.4 + 3.9, outerZ, false);
  addBox(g, w, 0.28, 0.35, MATS.woodDark, 0, 0.4 + 3.9, fz, false);

  addBox(g, w - 2.0, 3.2, 0.3, MATS.shopGlass, 0, 0.4 + 1.8, fz + frontNormal * 0.06, false);
  addBox(g, 2.4, 3.2, 0.34, MATS.woodDark, -w * 0.3, 0.4 + 1.8, fz + frontNormal * 0.12, false);

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

  if (seg.sign) {
    addSign(g, seg.sign, -w / 2 + 1.2, 6.8, fz + frontNormal * 0.2, frontNormal, 0.95, 3.2, true);
  }

  addBox(g, 1.8, 0.12, 1.8, MATS.woodDark, 0, 3.9, frontNormal * 8.5, false);
  addLantern(g, 0, 3.4, frontNormal * 8.6, 0.7);
  parent.add(g);
}

function addLantern(parent, x, y, z, s) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s || 1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), MATS.lantern);
  body.scale.set(1, 1.2, 1);
  body.castShadow = true;
  g.add(body);
  addCylinder(g, 0.16, 0.16, 0.1, 8, MATS.gold, 0, 0.45, 0);
  parent.add(g);
}

function addGlassSite(parent) {
  const g = new THREE.Group();
  g.name = "ancient-road";
  // 抬升的低矮展柜：让 11 层路面在总览里也能看清
  addBox(g, 46.5, 0.18, 5.6, MATS.pit, 0, 0.99, 0, false, true);
  const layers = [
    "#2e241a", "#3a2d21", "#463628", "#523e2e", "#5e4634", "#6a4e3a",
    "#765741", "#826049", "#8e6a51", "#9a7459", "#a67f62"
  ];
  // 每层向两侧收进，形成可读的 11 级地层剖面
  for (let i = 0; i < 11; i++) {
    const depth = 3.8 - i * 0.16;
    addBox(
      g,
      44,
      0.09,
      depth,
      new THREE.MeshStandardMaterial({ color: layers[i], roughness: 0.95 }),
      0,
      1.10 + i * 0.09,
      0,
      false,
      true
    );
  }
  // 低矮边框（只做压边，不遮住地层侧面）
  addBox(g, 46.5, 0.16, 0.9, MATS.iron, 0, 1.02, 2.35, false);
  addBox(g, 46.5, 0.16, 0.9, MATS.iron, 0, 1.02, -2.35, false);
  addBox(g, 0.9, 0.16, 3.8, MATS.iron, 22.45, 1.02, 0, false);
  // 西端不封边框，露出 11 层地层剖面
  // 玻璃罩支撑柱
  for (let x = -18; x <= 22; x += 8) {
    addBox(g, 0.08, 0.98, 0.08, MATS.iron, x, 1.58, 1.88, false);
    addBox(g, 0.08, 0.98, 0.08, MATS.iron, x, 1.58, -1.88, false);
  }
  // 玻璃罩 + 金属分格
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(44, 0.03, 3.8),
    new THREE.MeshBasicMaterial({
      color: 0xcfe6e6,
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    })
  );
  glass.position.set(0, 2.07, 0);
  g.add(glass);
  for (let x = -22; x <= 22; x += 4) {
    addBox(g, 0.08, 0.04, 3.8, MATS.iron, x, 2.09, 0, false);
  }
  addBox(g, 44, 0.04, 0.08, MATS.iron, 0, 2.09, 1.9, false);
  addBox(g, 44, 0.04, 0.08, MATS.iron, 0, 2.09, -1.9, false);
  // 两侧栏杆
  [-3.1, 3.1].forEach(function (z) {
    addBox(g, 44, 0.1, 0.12, MATS.iron, 0, 2.2, z, false);
    for (let x = -21; x <= 21; x += 6) {
      addBox(g, 0.12, 1.2, 0.12, MATS.iron, x, 1.62, z, false);
    }
  });
  addSign(g, "千年古道", -23.4, 2.7, 0.0, 1, 2.2, 0.65, false);
  addSign(g, "千年古道", 23.4, 2.7, 0.0, -1, 2.2, 0.65, false);
  // 端头立牌：沿街视角也能读到“千年古道”
  [
    { x: -22.05, rot: -Math.PI / 2 },
    { x: 22.05, rot: Math.PI / 2 }
  ].forEach(function (s) {
    const mat = new THREE.MeshStandardMaterial({
      map: makeSign("千年古道", false),
      roughness: 0.72,
      metalness: 0.04
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), mat);
    plane.position.set(s.x, 2.35, 0);
    plane.rotation.y = s.rot;
    g.add(plane);
    addBox(g, 0.12, 1.05, 0.12, MATS.iron, s.x + (s.x < 0 ? 1.1 : -1.1), 1.55, 0, false);
  });
  parent.add(g);
}

function addTemple(parent) {
  const g = new THREE.Group();
  g.name = "dafo-temple";
  g.position.set(30, GROUND_Y, ROW_CENTER);

  // 山门（面向北京路）
  addBox(g, 13, 0.6, 7, MATS.stone, 0, 0.3, -6);
  addBox(g, 11, 6.4, 5, MATS.templeWall, 0, 3.8, -6);
  addGableRoofX(g, 12.6, 6.6, 2.4, 7.0, -6, MATS.templeRoof);
  addBox(g, 4.4, 4.4, 0.3, MATS.templeDoor, 0, 2.8, -3.45, false);
  addBox(g, 5.2, 0.3, 0.4, MATS.gold, 0, 5.3, -3.4, false);
  addSign(g, "大佛寺", 0, 5.3, -3.25, 1, 2.6, 0.75, false);
  [-5.2, 5.2].forEach(function (x) {
    addCylinder(g, 0.28, 0.32, 3.4, 8, MATS.templeDoor, x, 1.7, -3.0);
  });

  // 普觉楼：7 层、逐层收分、金顶
  const tower = new THREE.Group();
  tower.position.set(0, 0, 4);
  addBox(tower, 16, 0.8, 16, MATS.stone, 0, 0.4, 0);
  addBox(tower, 15, 0.5, 15, MATS.stone, 0, 1.05, 0, false);
  let y = 1.3;
  for (let i = 0; i < 7; i++) {
    const w = 12 - i * 0.95;
    const fh = 3.0 - i * 0.08;
    addBox(tower, w, fh, w, MATS.templeWall, 0, y + fh / 2, 0);
    // 四面窗带
    addBox(tower, w * 0.52, fh * 0.42, 0.12, MATS.templeWindow, 0, y + fh * 0.55, w / 2 + 0.06, false);
    addBox(tower, w * 0.52, fh * 0.42, 0.12, MATS.templeWindow, 0, y + fh * 0.55, -w / 2 - 0.06, false);
    addBox(tower, 0.12, fh * 0.42, w * 0.52, MATS.templeWindow, w / 2 + 0.06, y + fh * 0.55, 0, false);
    addBox(tower, 0.12, fh * 0.42, w * 0.52, MATS.templeWindow, -w / 2 - 0.06, y + fh * 0.55, 0, false);
    // 檐口 + 金色滴水线
    addBox(tower, w + 2.4, 0.45, w + 2.4, MATS.templeRoof, 0, y + fh + 0.225, 0, false);
    addBox(tower, w + 2.6, 0.16, w + 2.6, MATS.gold, 0, y + fh + 0.5, 0, false);
    y += fh + 0.55;
  }
  // 金顶
  addBox(tower, 7.2, 1.2, 7.2, MATS.goldRoof, 0, y + 0.8, 0, false);
  addBox(tower, 5.6, 1.0, 5.6, MATS.goldRoof, 0, y + 1.8, 0, false);
  addCylinder(tower, 0.12, 0.12, 2.6, 6, MATS.gold, 0, y + 3.4, 0);
  g.add(tower);
  parent.add(g);
}

function addTrees(parent) {
  [
    [-30, -6, 0.9], [-24, 6, 0.85], [6, -6, 0.9], [20, 6, 0.85]
  ].forEach(function (p) { addBanyan(parent, p[0], p[1], p[2]); });
}

function addDetails(parent) {
  for (let x = -32; x <= 32; x += 8) {
    addCylinder(parent, 0.08, 0.1, 3.6, 6, MATS.iron, x, 2.8, 6.8);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), MATS.lamp);
    lamp.position.set(x, 4.6, 6.8);
    parent.add(lamp);
  }
  // 跨街红灯笼
  for (let x = -30; x <= 30; x += 10) {
    addBox(parent, 0.08, 0.08, 16, MATS.iron, x, 7.0, 0, false);
    for (let z = -5; z <= 5; z += 5) {
      addLantern(parent, x, 6.2, z, 0.65);
    }
  }
}

let MATS = null;
let windowInstances = [];
let columnInstances = [];

function createMaterials(textures) {
  return {
    stone: std({ map: textures.stone, roughness: 0.95 }),
    paving: std({ map: textures.paving, roughness: 0.98 }),
    roof: std({ map: textures.roof, roughness: 0.9 }),
    brickRed: std({ map: textures.brickRed, roughness: 0.94 }),
    cream: std({ color: 0xded0b8, roughness: 0.92 }),
    yellow: std({ color: 0xdcc79a, roughness: 0.92 }),
    plaster: std({ color: 0xe6ddcb, roughness: 0.92 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    window: std({ map: textures.window, roughness: 0.5, metalness: 0.05 }),
    shopGlass: std({ map: textures.shopGlass, roughness: 0.3, metalness: 0.15 }),
    pit: std({ color: 0x2b2620, roughness: 0.95 }),
    iron: std({ color: 0x24282a, roughness: 0.6, metalness: 0.4 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    templeWall: std({ color: 0xd8b768, roughness: 0.9 }),
    templeWindow: std({ color: 0x5a2a1e, roughness: 0.72 }),
    templeRoof: std({ color: 0x8a6a2f, roughness: 0.6, metalness: 0.25 }),
    goldRoof: std({ color: 0xc9a04a, roughness: 0.45, metalness: 0.45 }),
    templeDoor: std({ color: 0x8f2420, roughness: 0.7 }),
    lantern: std({ color: 0x8f1a10, emissive: 0x3a0704, emissiveIntensity: 0.25, roughness: 0.72 }),
    lamp: std({ color: 0xfff2c9, emissive: 0x9a6a1e, emissiveIntensity: 0.5, roughness: 0.4 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x4a3528, roughness: 0.95 })
  };
}

function buildInstances(parent) {
  if (windowInstances.length) {
    const geo = new THREE.BoxGeometry(1.5, 2.3, 0.15);
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
    const geo = new THREE.CylinderGeometry(0.24, 0.28, 4.2, 8);
    const mesh = new THREE.InstancedMesh(geo, MATS.plaster, columnInstances.length);
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
  seed = 1252;
  windowInstances = [];
  columnInstances = [];

  const textures = {
    stone: makeStone(),
    paving: makePaving(),
    roof: makeRoof(),
    brickRed: makeBrick("#9a5a48", "#b98a76"),
    window: makeWindow(),
    shopGlass: makeShopGlass()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "beijinglu-model";

  addBox(root, 96, 0.8, 70, MATS.stone, 0, 0.4, 0, false, true);
  addBox(root, 84, 0.12, 16, MATS.paving, 0, 0.96, 0, false, true);
  addBox(root, 84, 0.1, 2.5, MATS.stone, 0, 0.96, -9.25, false, true);
  addBox(root, 84, 0.1, 2.5, MATS.stone, 0, 0.96, 9.25, false, true);

  addGlassSite(root);

  const north = [
    { x: -32, w: 13, h: 15, red: true, pitched: true, sign: "太平馆" },
    { x: -16, w: 13, h: 14, yellow: true },
    { x: 0, w: 13, h: 16, cream: true, pitched: true, sign: "科技书店" },
    { x: 16, w: 13, h: 14, yellow: true },
    { x: 32, w: 13, h: 15, cream: true, sign: "古籍书店" }
  ];
  north.forEach(function (seg) { addArcadeBlock(root, seg, -1); });

  const south = [
    { x: -32, w: 13, h: 14, yellow: true, pitched: true },
    { x: -16, w: 13, h: 15, cream: true, sign: "广州百货" },
    { x: 0, w: 13, h: 14, red: true },
    { x: 16, w: 13, h: 16, yellow: true, pitched: true }
  ];
  south.forEach(function (seg) { addArcadeBlock(root, seg, 1); });

  addTemple(root);
  addTrees(root);
  addDetails(root);
  buildInstances(root);

  const anchors = {
    street: new THREE.Vector3(0, GROUND_Y + 2.5, 0),
    ancient: new THREE.Vector3(0, GROUND_Y + 1.2, 0),
    temple: new THREE.Vector3(30, GROUND_Y + 15, ROW_CENTER),
    detail: new THREE.Vector3(-21.3, GROUND_Y + 5.5, -12)
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
