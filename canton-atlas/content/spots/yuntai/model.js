/*
 * 云台花园 · 花城明珠 · 风格化欧式花园段（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：南门—中轴喷泉/阶梯瀑布—罗马柱廊 + 西侧玻璃温室 + 东侧玫瑰园 + 白云山低山背景。
 * 不是 12 万㎡ 全园 1:1，也不重建白云山 382m 主峰。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 120;
const SITE_D = 80;
const BASE_Y = 0.9;
const GROUND_Y = 1.02;
const FOUNTAIN_Z = 6.5;
const TERRACE_1 = 2.1;
const TERRACE_2 = 3.3;
const TERRACE_3 = 4.5;

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

function makeLawn() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5a7f3a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const v = random() > 0.5 ? "rgba(36,66,28,0.22)" : "rgba(140,170,96,0.15)";
    ctx.fillStyle = v;
    ctx.fillRect(random() * 256, random() * 256, range(1, 3), range(1, 4));
  }
  return colorTexture(c, 12, 8);
}

function makeGravel() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d6cdbb";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = "rgba(120,108,88," + range(0.12, 0.3).toFixed(3) + ")";
    const s = range(1, 2.5);
    ctx.fillRect(random() * 256, random() * 256, s, s);
  }
  return colorTexture(c, 6, 5);
}

function makeWater() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#7fb0b5");
  grad.addColorStop(0.55, "#4f8a92");
  grad.addColorStop(1, "#3f7a8a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = "rgba(230,246,242," + range(0.05, 0.16).toFixed(3) + ")";
    ctx.lineWidth = range(1, 2);
    ctx.beginPath();
    const y = random() * 256;
    ctx.moveTo(random() * 256, y);
    ctx.lineTo(random() * 256, y + range(-2, 2));
    ctx.stroke();
  }
  return colorTexture(c, 1, 1);
}

function makeSign(text) {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2e3f34";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#d9c08a";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = "#f0e9dc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'bold 62px "Songti SC", "SimSun", serif';
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

function addInstances(parent, geometry, material, entries, place, cast) {
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const dummy = new THREE.Object3D();
  entries.forEach(function (entry, i) {
    place(dummy, entry, i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = cast !== false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBedFrame(parent, cx, cz, w, d, h, t, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2);
  shape.lineTo(w / 2, -d / 2);
  shape.lineTo(w / 2, d / 2);
  shape.lineTo(-w / 2, d / 2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + t, -d / 2 + t);
  hole.lineTo(-w / 2 + t, d / 2 - t);
  hole.lineTo(w / 2 - t, d / 2 - t);
  hole.lineTo(w / 2 - t, -d / 2 + t);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, 0.1, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/* ---------- 底座与铺装 ---------- */

function addBase(root) {
  addBox(root, SITE_W, BASE_Y, SITE_D, MATS.base, 0, BASE_Y / 2, 0, false, true);
  addBox(root, SITE_W - 2, 0.12, SITE_D - 2, MATS.lawn, 0, BASE_Y + 0.06, 0, false, true);
  const rimY = BASE_Y + 0.06;
  addBox(root, SITE_W, 0.12, 1.0, MATS.terrace, 0, rimY, SITE_D / 2 - 0.5, false, true);
  addBox(root, SITE_W, 0.12, 1.0, MATS.terrace, 0, rimY, -SITE_D / 2 + 0.5, false, true);
  addBox(root, 1.0, 0.12, SITE_D, MATS.terrace, SITE_W / 2 - 0.5, rimY, 0, false, true);
  addBox(root, 1.0, 0.12, SITE_D, MATS.terrace, -SITE_W / 2 + 0.5, rimY, 0, false, true);
}

function addPaths(root) {
  addBox(root, 34, 0.1, 14, MATS.paving, 0, GROUND_Y + 0.05, 26, false, true);
  addBox(root, 30, 0.1, 6, MATS.paving, 0, GROUND_Y + 0.05, 36, false, true);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.1, 48), MATS.paving);
  plaza.position.set(0, GROUND_Y + 0.05, FOUNTAIN_Z);
  plaza.receiveShadow = true;
  root.add(plaza);
  addBox(root, 12, 0.1, 4, MATS.paving, 0, GROUND_Y + 0.05, 18, false, true);
  addBox(root, 28, 0.08, 4, MATS.paving, -27, GROUND_Y + 0.04, 22, false, true);
  addBox(root, 4, 0.08, 20, MATS.paving, -41, GROUND_Y + 0.04, 12, false, true);
  addBox(root, 16, 0.08, 4, MATS.paving, 20, GROUND_Y + 0.04, 22, false, true);
}

/* ---------- 南门 ---------- */

function addGate(root) {
  const g = new THREE.Group();
  g.name = "yuntai-gate";
  g.position.set(0, GROUND_Y, 33);

  [-17, 17].forEach(function (x) {
    addBox(g, 14, 2.8, 0.9, MATS.cream, x, 1.4, 0);
    addBox(g, 14.4, 0.22, 1.2, MATS.whiteBright, x, 2.91, 0, false);
  });
  [-10, 10].forEach(function (x) {
    addBox(g, 1.6, 3.6, 1.6, MATS.white, x, 1.8, 0);
    addBox(g, 1.85, 0.28, 1.85, MATS.whiteBright, x, 3.74, 0, false);
  });
  [-5.4, 5.4].forEach(function (x) {
    addBox(g, 1.55, 5.6, 1.55, MATS.white, x, 2.8, 0);
    addBox(g, 1.8, 0.3, 1.8, MATS.whiteBright, x, 5.75, 0, false);
  });

  addBox(g, 12.6, 0.9, 1.5, MATS.white, 0, 6.05, 0);
  addBox(g, 13.4, 0.3, 1.9, MATS.whiteBright, 0, 6.65, 0, false);

  const shape = new THREE.Shape();
  shape.moveTo(-6.7, 0);
  shape.lineTo(6.7, 0);
  shape.lineTo(0, 2.2);
  shape.closePath();
  const pediment = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false }),
    MATS.white
  );
  pediment.position.set(0, 6.8, -0.6);
  pediment.castShadow = true;
  g.add(pediment);

  addSign(g, "云台花园", 0, 6.05, 0.84, 1, 6.4, 1.2);

  [-17, 17].forEach(function (x) {
    addBox(g, 13, 0.55, 1.1, MATS.hedge, x, 0.275, -1.0);
  });
  [-20, 20].forEach(function (x) {
    addCylinder(g, 0.45, 0.62, 0.8, 8, MATS.pottery, x, 3.2, 0.9);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), MATS.foliage2);
    ball.position.set(x, 3.95, 0.9);
    ball.castShadow = true;
    g.add(ball);
  });
  [-27, 27].forEach(function (x) {
    addCylinder(g, 0.09, 0.14, 3.0, 6, MATS.iron, x, 1.5, 1.8);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), MATS.lamp);
    globe.position.set(x, 3.1, 1.8);
    g.add(globe);
  });

  root.add(g);
}

/* ---------- 喷泉与阶梯瀑布 ---------- */

function addFountain(root) {
  const g = new THREE.Group();
  g.name = "fountain";
  g.position.set(0, GROUND_Y, FOUNTAIN_Z);

  addCylinder(g, 6.9, 6.9, 0.22, 40, MATS.terrace, 0, 0.11, 0);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.8, 40, 1, true), MATS.whiteRim);
  rim.position.y = 0.5;
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.15, 0.18, 8, 40), MATS.whiteBright);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.9;
  g.add(ring);

  const water = new THREE.Mesh(new THREE.CircleGeometry(6.0, 40), MATS.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.72;
  g.add(water);

  addCylinder(g, 1.5, 2.0, 1.1, 16, MATS.white, 0, 1.25, 0);
  addCylinder(g, 0.68, 0.9, 1.2, 12, MATS.white, 0, 2.25, 0);

  const bowl1 = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 1.25, 0.7, 24, 1, true), MATS.whiteRim);
  bowl1.position.y = 3.15;
  bowl1.castShadow = true;
  g.add(bowl1);
  const water1 = new THREE.Mesh(new THREE.CircleGeometry(2.72, 24), MATS.water);
  water1.rotation.x = -Math.PI / 2;
  water1.position.y = 3.42;
  g.add(water1);

  addCylinder(g, 0.42, 0.55, 1.4, 10, MATS.white, 0, 4.1, 0);
  const bowl2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.72, 0.55, 20, 1, true), MATS.whiteRim);
  bowl2.position.y = 5.0;
  bowl2.castShadow = true;
  g.add(bowl2);
  const water2 = new THREE.Mesh(new THREE.CircleGeometry(1.55, 20), MATS.water);
  water2.rotation.x = -Math.PI / 2;
  water2.position.y = 5.2;
  g.add(water2);

  addCylinder(g, 0.16, 0.28, 1.0, 8, MATS.white, 0, 5.8, 0);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), MATS.gold);
  finial.position.set(0, 6.45, 0);
  finial.castShadow = true;
  g.add(finial);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.0, 5), MATS.waterfall);
    jet.position.set(Math.sin(a) * 1.85, 3.95, Math.cos(a) * 1.85);
    g.add(jet);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, 0.8, 5), MATS.waterfall);
    jet.position.set(Math.sin(a) * 1.0, 5.55, Math.cos(a) * 1.0);
    g.add(jet);
  }

  root.add(g);
}

function addCascade(root) {
  const g = new THREE.Group();
  g.name = "cascade";

  const levels = [
    { z: -3, depth: 4, top: TERRACE_1 },
    { z: -7, depth: 4, top: TERRACE_2 },
    { z: -11, depth: 4, top: TERRACE_3 }
  ];
  levels.forEach(function (level) {
    addBox(g, 44, level.top - GROUND_Y, level.depth, MATS.terrace, 0, (GROUND_Y + level.top) / 2, level.z, false, true);
    addBox(g, 44.4, 0.16, 0.24, MATS.whiteBright, 0, level.top - 0.08, level.z + level.depth / 2 + 0.12, false);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 3.2), MATS.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, level.top + 0.04, level.z);
    g.add(water);
    [-5.3, 5.3].forEach(function (x) {
      addBox(g, 0.5, 0.55, 4.3, MATS.white, x, level.top + 0.275, level.z);
    });
  });

  const falls = [
    { topZ: -1, topY: TERRACE_1, bottomZ: 0.8, bottomY: GROUND_Y + 0.1, steps: [1.34, 1.72] },
    { topZ: -5, topY: TERRACE_2, bottomZ: -3.2, bottomY: TERRACE_1, steps: [2.5, 2.9] },
    { topZ: -9, topY: TERRACE_3, bottomZ: -7.2, bottomY: TERRACE_2, steps: [3.7, 4.1] }
  ];
  falls.forEach(function (fall) {
    const run = fall.bottomZ - fall.topZ;
    const rise = fall.topY - fall.bottomY;
    const len = Math.hypot(run, rise);
    const theta = Math.atan2(rise, run);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(9.2, len), MATS.waterfall);
    sheet.rotation.x = -Math.PI / 2 + theta;
    sheet.position.set(0, (fall.topY + fall.bottomY) / 2, (fall.topZ + fall.bottomZ) / 2);
    g.add(sheet);
    fall.steps.forEach(function (top, i) {
      const z = fall.bottomZ + (fall.topZ - fall.bottomZ) * ((i + 1) / 3);
      addBox(g, 10, top - fall.bottomY, run / 3 + 0.04, MATS.white, 0, (top + fall.bottomY) / 2, z, false);
    });
  });

  root.add(g);
}

/* ---------- 罗马柱廊 ---------- */

function addColonnade(root) {
  const g = new THREE.Group();
  g.name = "colonnade";
  g.position.set(0, 0, -20);

  addBox(g, 44, TERRACE_3 - GROUND_Y, 14, MATS.terrace, 0, (GROUND_Y + TERRACE_3) / 2, 0, false, true);
  addBox(g, 43.6, 0.1, 13.6, MATS.paving, 0, TERRACE_3 + 0.05, 0, false, true);

  const columns = [];
  for (let i = 0; i < 12; i++) columns.push(-16.5 + i * 3.0);
  addInstances(g, new THREE.CylinderGeometry(0.44, 0.54, 7.0, 10), MATS.white, columns, function (d, x) {
    d.position.set(x, 8.4, 0);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });
  addInstances(g, new THREE.BoxGeometry(1.3, 0.35, 1.3), MATS.whiteBright, columns, function (d, x) {
    d.position.set(x, 4.72, 0);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });
  addInstances(g, new THREE.BoxGeometry(1.2, 0.35, 1.2), MATS.whiteBright, columns, function (d, x) {
    d.position.set(x, 12.07, 0);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });

  addBox(g, 38, 0.8, 3, MATS.white, 0, 12.65, 0);
  addBox(g, 39, 0.3, 3.5, MATS.whiteBright, 0, 13.2, 0, false);

  const shape = new THREE.Shape();
  shape.moveTo(-6.7, 0);
  shape.lineTo(6.7, 0);
  shape.lineTo(0, 2.4);
  shape.closePath();
  const pediment = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false }),
    MATS.white
  );
  pediment.position.set(0, 13.35, -0.9);
  pediment.castShadow = true;
  g.add(pediment);
  const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.14, 24), MATS.gold);
  medallion.rotation.x = Math.PI / 2;
  medallion.position.set(0, 14.2, 0.95);
  g.add(medallion);

  addBox(g, 40, 1.1, 0.8, MATS.cream, 0, 5.15, -6.2);
  addBox(g, 40.6, 0.18, 1.0, MATS.whiteBright, 0, 5.79, -6.2, false);

  [-20, 20].forEach(function (x) {
    addCylinder(g, 0.5, 0.7, 0.8, 8, MATS.pottery, x, 4.9, 6.2);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), MATS.foliage2);
    ball.position.set(x, 5.75, 6.2);
    ball.castShadow = true;
    g.add(ball);
  });

  root.add(g);
}

/* ---------- 玻璃温室 ---------- */

function addGreenhouse(root) {
  const g = new THREE.Group();
  g.name = "greenhouse";
  g.position.set(-40, GROUND_Y, -6);

  addBox(g, 27.2, 0.5, 17.2, MATS.terrace, 0, 0.25, 0, false, true);
  addBox(g, 26, 0.35, 16, MATS.cream, 0, 0.675, 0, false, true);

  const wallH = 3.75;
  const wallY = 2.725;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(25.2, wallH), MATS.glass);
  front.position.set(0, wallY, 7.9);
  g.add(front);
  const back = front.clone();
  back.position.z = -7.9;
  back.rotation.y = Math.PI;
  g.add(back);
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(15.2, wallH), MATS.glass);
  sideL.rotation.y = Math.PI / 2;
  sideL.position.set(12.9, wallY, 0);
  g.add(sideL);
  const sideR = sideL.clone();
  sideR.position.x = -12.9;
  sideR.rotation.y = -Math.PI / 2;
  g.add(sideR);

  const halfD = 7.9;
  const rise = 4.0;
  const slope = Math.hypot(halfD, rise);
  const angle = Math.atan2(rise, halfD);
  const roofSouth = addBox(g, 25.6, 0.1, slope, MATS.glass, 0, 6.6, halfD / 2, false);
  roofSouth.rotation.x = angle;
  const roofNorth = addBox(g, 25.6, 0.1, slope, MATS.glass, 0, 6.6, -halfD / 2, false);
  roofNorth.rotation.x = -angle;
  addBox(g, 26, 0.18, 0.3, MATS.whiteBright, 0, 8.6, 0, false);
  addBox(g, 26, 0.25, 0.35, MATS.whiteBright, 0, 4.6, 7.9, false);
  addBox(g, 26, 0.25, 0.35, MATS.whiteBright, 0, 4.6, -7.9, false);
  addBox(g, 0.35, 0.25, 15.8, MATS.whiteBright, 12.9, 4.6, 0, false);
  addBox(g, 0.35, 0.25, 15.8, MATS.whiteBright, -12.9, 4.6, 0, false);

  const mullions = [];
  for (let i = 0; i < 12; i++) {
    const x = -11.5 + (23 / 11) * i;
    mullions.push({ x: x, z: 7.95, rot: 0 });
    mullions.push({ x: x, z: -7.95, rot: 0 });
  }
  for (let i = 0; i < 7; i++) {
    const z = -6 + 2 * i;
    mullions.push({ x: 12.95, z: z, rot: Math.PI / 2 });
    mullions.push({ x: -12.95, z: z, rot: Math.PI / 2 });
  }
  addInstances(g, new THREE.BoxGeometry(0.14, wallH, 0.14), MATS.whiteBright, mullions, function (d, e) {
    d.position.set(e.x, wallY, e.z);
    d.rotation.set(0, e.rot, 0);
    d.scale.set(1, 1, 1);
  });

  [7.95, -7.95].forEach(function (z) {
    addBox(g, 25.6, 0.12, 0.18, MATS.whiteBright, 0, wallY, z, false);
  });
  [12.95, -12.95].forEach(function (x) {
    addBox(g, 0.18, 0.12, 15.4, MATS.whiteBright, x, wallY, 0, false);
  });

  const rafters = [];
  for (let i = 0; i < 10; i++) {
    const x = -11.5 + (23 / 9) * i;
    rafters.push({ x: x, z: halfD / 2, rot: angle });
    rafters.push({ x: x, z: -halfD / 2, rot: -angle });
  }
  addInstances(g, new THREE.BoxGeometry(0.1, 0.1, slope), MATS.whiteBright, rafters, function (d, e) {
    d.position.set(e.x, 6.6, e.z);
    d.rotation.set(e.rot, 0, 0);
    d.scale.set(1, 1, 1);
  });

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfD, 0);
  gableShape.lineTo(halfD, 0);
  gableShape.lineTo(0, rise);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);
  [12.95, -12.95].forEach(function (x, i) {
    const gable = new THREE.Mesh(gableGeo, MATS.glass);
    gable.rotation.y = i === 0 ? Math.PI / 2 : -Math.PI / 2;
    gable.position.set(x, 4.6, 0);
    g.add(gable);
    addBox(g, 0.12, rise, 0.12, MATS.whiteBright, x, 6.6, 0, false);
  });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.6, 8, 1, true), MATS.glass);
  drum.position.y = 9.4;
  g.add(drum);
  const dome = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.5, 8, 1, true), MATS.glass);
  dome.position.y = 10.95;
  g.add(dome);
  addCylinder(g, 2.16, 2.16, 0.12, 8, MATS.whiteBright, 0, 8.62, 0);
  addCylinder(g, 2.42, 2.42, 0.12, 8, MATS.whiteBright, 0, 10.2, 0);
  const ribs = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ribs.push({ x: Math.sin(a) * 2.12, z: Math.cos(a) * 2.12 });
  }
  addInstances(g, new THREE.BoxGeometry(0.1, 1.6, 0.1), MATS.whiteBright, ribs, function (d, e) {
    d.position.set(e.x, 9.4, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });
  addCylinder(g, 0.08, 0.12, 0.8, 6, MATS.gold, 0, 12.0, 0);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), MATS.gold);
  finial.position.set(0, 12.45, 0);
  g.add(finial);

  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), MATS.doorGlass);
  doorGlass.position.set(0, 2.45, 8.02);
  g.add(doorGlass);
  [-2.3, 2.3].forEach(function (x) {
    addBox(g, 0.24, 3.35, 0.3, MATS.whiteBright, x, 2.45, 8.05, false);
  });
  addBox(g, 4.85, 0.26, 0.3, MATS.whiteBright, 0, 4.08, 8.05, false);
  addBox(g, 5.4, 0.16, 1.5, MATS.whiteBright, 0, 4.55, 8.65, false);
  addSign(g, "玻璃温室", 0, 4.38, 8.09, 1, 3.4, 0.7);

  const plants = [
    { x: -8, z: 1, h: 4.6, r: 1.9 },
    { x: -3, z: -2.5, h: 5.2, r: 2.1 },
    { x: 1.5, z: 1.8, h: 4.2, r: 1.7 },
    { x: 6.5, z: -1.5, h: 5.0, r: 2.0 },
    { x: 9.5, z: 2.2, h: 3.8, r: 1.5 }
  ];
  addInstances(g, new THREE.CylinderGeometry(0.14, 0.22, 1, 6), MATS.trunk, plants, function (d, e) {
    d.position.set(e.x, e.h / 2, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, e.h, 1);
  });
  addInstances(g, new THREE.IcosahedronGeometry(1, 1), MATS.foliage, plants, function (d, e) {
    d.position.set(e.x, e.h * 0.9, e.z);
    d.rotation.set(random() * 0.3, random() * Math.PI * 2, random() * 0.3);
    d.scale.set(e.r, e.r * 0.75, e.r);
  }, false);

  root.add(g);
}

/* ---------- 玫瑰园 ---------- */

function addRoseGarden(root) {
  const g = new THREE.Group();
  g.name = "rose-garden";
  g.position.set(28, GROUND_Y, 7);

  addBox(g, 34, 0.1, 26, MATS.gravel, 0, 0.05, 0, false, true);
  addBox(g, 32, 0.55, 0.9, MATS.hedge, 0, 0.275, 12);
  addBox(g, 32, 0.55, 0.9, MATS.hedge, 0, 0.275, -12);
  addBox(g, 0.9, 0.55, 24, MATS.hedge, 16, 0.275, 0);
  addBox(g, 0.9, 0.55, 24, MATS.hedge, -16, 0.275, 0);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.38, 6, 28), MATS.hedge);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.45;
  g.add(ring);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(3.5, 28), MATS.soil);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.3;
  g.add(soil);

  const beds = [
    { x: -9.5, z: -6.5, w: 9, d: 5.2 },
    { x: 9.5, z: -6.5, w: 9, d: 5.2 },
    { x: -9.5, z: 6.5, w: 9, d: 5.2 },
    { x: 9.5, z: 6.5, w: 9, d: 5.2 }
  ];
  beds.forEach(function (b) {
    addBedFrame(g, b.x, b.z, b.w, b.d, 0.5, 0.5, MATS.hedge);
    addBox(g, b.w - 0.8, 0.3, b.d - 0.8, MATS.soil, b.x, 0.28, b.z, false, true);
  });

  const bushes = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rad = range(0.8, 2.8);
    bushes.push({ x: Math.sin(a) * rad, z: Math.cos(a) * rad, s: range(0.8, 1.15) });
  }
  beds.forEach(function (b) {
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz += 2) {
        bushes.push({
          x: b.x + ix * 2.7 + range(-0.35, 0.35),
          z: b.z + iz * 1.05 + range(-0.25, 0.25),
          s: range(0.8, 1.15)
        });
      }
    }
  });

  addInstances(g, new THREE.IcosahedronGeometry(1, 1), MATS.foliage, bushes, function (d, e) {
    d.position.set(e.x, 0.65, e.z);
    d.rotation.set(random() * 0.25, random() * Math.PI * 2, random() * 0.25);
    d.scale.set(0.9 * e.s, 0.62 * e.s, 0.9 * e.s);
  });

  const flowers = [[], [], [], [], []];
  bushes.forEach(function (b, i) {
    for (let k = 0; k < 5; k++) {
      flowers[(i + k) % 5].push({
        x: b.x + range(-0.65, 0.65) * b.s,
        y: 0.92 + range(0, 0.3) * b.s,
        z: b.z + range(-0.65, 0.65) * b.s,
        s: range(0.75, 1.2)
      });
    }
  });
  [MATS.roseRed, MATS.rosePink, MATS.roseYellow, MATS.roseWhite, MATS.rosePurple].forEach(function (mat, i) {
    if (!flowers[i].length) return;
    addInstances(g, new THREE.SphereGeometry(0.15, 5, 4), mat, flowers[i], function (d, e) {
      d.position.set(e.x, e.y, e.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(e.s, e.s, e.s);
    }, false);
  });

  addCylinder(g, 0.55, 0.7, 1.1, 10, MATS.white, 0, 0.85, 0);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.4, 12), MATS.whiteBright);
  bowl.position.y = 1.55;
  bowl.castShadow = true;
  g.add(bowl);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), MATS.gold);
  globe.position.set(0, 1.95, 0);
  g.add(globe);

  [-0.9, 0.9].forEach(function (x) {
    addBox(g, 0.14, 1.8, 0.14, MATS.woodDark, x, 0.9, 13.2, false);
  });
  addSign(g, "玫瑰园", 0, 2.0, 13.2, 1, 2.6, 0.62);

  root.add(g);
}

/* ---------- 白云山低山背景 ---------- */

function addMountain(root) {
  const g = new THREE.Group();
  g.name = "baiyun-backdrop";
  const hillGeo = new THREE.IcosahedronGeometry(1, 1);
  const far = [
    { x: -46, z: -32, sx: 15, sy: 8, sz: 7 },
    { x: -28, z: -33, sx: 18, sy: 10, sz: 7 },
    { x: -6, z: -32, sx: 22, sy: 12, sz: 7 },
    { x: 18, z: -33, sx: 18, sy: 10, sz: 7 },
    { x: 38, z: -32, sx: 14, sy: 8, sz: 6 },
    { x: 52, z: -33, sx: 10, sy: 6, sz: 5 }
  ];
  const near = [
    { x: -38, z: -28, sx: 11, sy: 5, sz: 5 },
    { x: -16, z: -29, sx: 13, sy: 6, sz: 6 },
    { x: 6, z: -28, sx: 12, sy: 5, sz: 5 },
    { x: 28, z: -29, sx: 12, sy: 6, sz: 6 },
    { x: 47, z: -28, sx: 9, sy: 4, sz: 4 }
  ];
  far.forEach(function (p) {
    const m = new THREE.Mesh(hillGeo, MATS.mountainFar);
    m.position.set(p.x, GROUND_Y + p.sy * 0.25, p.z);
    m.scale.set(p.sx, p.sy, p.sz);
    m.rotation.y = random() * Math.PI * 2;
    m.castShadow = true;
    g.add(m);
  });
  near.forEach(function (p) {
    const m = new THREE.Mesh(hillGeo, MATS.mountainNear);
    m.position.set(p.x, GROUND_Y + p.sy * 0.25, p.z);
    m.scale.set(p.sx, p.sy, p.sz);
    m.rotation.y = random() * Math.PI * 2;
    m.castShadow = true;
    g.add(m);
  });

  const cones = [];
  for (let x = -54; x <= 54; x += 3.5) {
    cones.push({ x: x, z: -27.8 + range(-0.6, 0.6), h: range(4.8, 7.4), r: range(0.9, 1.5) });
  }
  addInstances(g, new THREE.ConeGeometry(1, 1, 6), MATS.cypress, cones, function (d, e) {
    d.position.set(e.x, GROUND_Y + e.h / 2, e.z);
    d.rotation.set(0, random() * Math.PI * 2, 0);
    d.scale.set(e.r, e.h, e.r);
  });

  const canopies = [];
  for (let x = -50; x <= 50; x += 6.5) {
    canopies.push({ x: x + range(-1, 1), z: -27.4 + range(-0.8, 0.8), r: range(2.2, 3.6) });
  }
  addInstances(g, new THREE.IcosahedronGeometry(1, 1), MATS.foliage2, canopies, function (d, e) {
    d.position.set(e.x, GROUND_Y + e.r * 1.3, e.z);
    d.rotation.set(random() * 0.2, random() * Math.PI * 2, random() * 0.2);
    d.scale.set(e.r, e.r * 0.8, e.r);
  });

  root.add(g);
}

/* ---------- 树、花坛、灯与座椅 ---------- */

function addTrees(root) {
  const cypresses = [
    [-11.5, 18, 1.0], [-11.5, 15.2, 1.0], [-11.5, 12.4, 1.0], [-11.5, 9.6, 0.9],
    [11.5, 18, 1.0], [11.5, 15.2, 1.0], [11.5, 12.4, 1.0], [11.5, 9.6, 0.9],
    [-24.5, -16, 0.95], [24.5, -16, 0.95], [-24.5, -23, 0.95], [24.5, -23, 0.95],
    [-27, 29, 1.0], [27, 29, 1.0]
  ];
  addInstances(root, new THREE.ConeGeometry(1, 1, 7), MATS.cypress, cypresses, function (d, e) {
    d.position.set(e[0], GROUND_Y + 3.5 * e[2], e[1]);
    d.rotation.set(0, random() * Math.PI * 2, 0);
    d.scale.set(1.3 * e[2], 7.0 * e[2], 1.3 * e[2]);
  });

  const trees = [
    [-54, 24, 1.1], [-55, 12, 0.95], [-54, -22, 1.05], [-53, -34, 0.9],
    [53, 26, 1.1], [54, 14, 0.95], [53, 2, 0.9], [52, -16, 1.0], [49, -32, 1.0],
    [-36, 34, 1.0], [36, 34, 1.0], [-48, 33, 0.9], [48, 33, 0.9]
  ];
  const trunks = [];
  const canopyA = [];
  const canopyB = [];
  trees.forEach(function (t, i) {
    const h = 5.6 * t[2];
    trunks.push({ x: t[0], z: t[1], h: h, s: t[2] });
    const r = 3.2 * t[2];
    const entry = { x: t[0], y: GROUND_Y + h + r * 0.25, z: t[1], r: r };
    (i % 2 ? canopyA : canopyB).push(entry);
    (i % 3 === 0 ? canopyB : canopyA).push({ x: t[0] + r * 0.55, y: entry.y - r * 0.12, z: t[1] + r * 0.2, r: r * 0.7 });
  });
  addInstances(root, new THREE.CylinderGeometry(0.32, 0.5, 1, 6), MATS.trunk, trunks, function (d, e) {
    d.position.set(e.x, GROUND_Y + e.h / 2, e.z);
    d.rotation.set(0, random() * Math.PI * 2, 0);
    d.scale.set(e.s, e.h, e.s);
  });
  [[canopyA, MATS.foliage], [canopyB, MATS.foliage2]].forEach(function (group) {
    addInstances(root, new THREE.IcosahedronGeometry(1, 1), group[1], group[0], function (d, e) {
      d.position.set(e.x, e.y, e.z);
      d.rotation.set(random() * 0.25, random() * Math.PI * 2, random() * 0.25);
      d.scale.set(e.r, e.r * 0.82, e.r);
    });
  });

  const topiary = [[-22, 22], [22, 22], [-22, 14], [22, 14]];
  addInstances(root, new THREE.IcosahedronGeometry(1, 1), MATS.foliage2, topiary, function (d, e) {
    d.position.set(e[0], GROUND_Y + 1.15, e[1]);
    d.rotation.set(0, random() * Math.PI * 2, 0);
    d.scale.set(1.35, 1.15, 1.35);
  });
}

function addFlowerBeds(root) {
  const beds = [
    { x: -18.5, z: 25.5, w: 3.5, d: 10 },
    { x: 18.5, z: 25.5, w: 3.5, d: 10 },
    { x: -13.5, z: 11, w: 6, d: 3.5 },
    { x: 13.5, z: 11, w: 6, d: 3.5 },
    { x: -13.5, z: 2, w: 6, d: 3.5 },
    { x: 13.5, z: 2, w: 6, d: 3.5 }
  ];
  const flowers = [[], [], [], []];
  beds.forEach(function (bed) {
    addBox(root, bed.w, 0.35, bed.d, MATS.hedge, bed.x, GROUND_Y + 0.175, bed.z, false, true);
    addBox(root, bed.w - 0.4, 0.1, bed.d - 0.4, MATS.soil, bed.x, GROUND_Y + 0.4, bed.z, false, true);
    const count = Math.round(bed.w * bed.d * 0.7);
    for (let i = 0; i < count; i++) {
      flowers[i % 4].push({
        x: bed.x + range(-bed.w / 2 + 0.45, bed.w / 2 - 0.45),
        y: GROUND_Y + 0.55,
        z: bed.z + range(-bed.d / 2 + 0.45, bed.d / 2 - 0.45),
        s: range(0.7, 1.15)
      });
    }
  });
  [MATS.roseRed, MATS.rosePink, MATS.roseYellow, MATS.roseWhite].forEach(function (mat, i) {
    if (!flowers[i].length) return;
    addInstances(root, new THREE.SphereGeometry(0.13, 5, 4), mat, flowers[i], function (d, e) {
      d.position.set(e.x, e.y, e.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(e.s, e.s, e.s);
    }, false);
  });
}

function addLamps(root) {
  const spots = [
    [-8.8, 20.5], [8.8, 20.5], [-8.8, 16.5], [8.8, 16.5],
    [-9.8, 0.5], [9.8, 0.5], [-14, 24], [14, 24]
  ];
  addInstances(root, new THREE.CylinderGeometry(0.09, 0.13, 3.2, 6), MATS.iron, spots, function (d, e) {
    d.position.set(e[0], GROUND_Y + 1.6, e[1]);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });
  addInstances(root, new THREE.SphereGeometry(0.24, 8, 6), MATS.lamp, spots, function (d, e) {
    d.position.set(e[0], GROUND_Y + 3.32, e[1]);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
}

function addBench(parent, x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  g.rotation.y = rot;
  addBox(g, 2.4, 0.12, 0.7, MATS.wood, 0, 0.52, 0);
  addBox(g, 2.4, 0.62, 0.1, MATS.wood, 0, 0.9, -0.3);
  [-0.95, 0.95].forEach(function (bx) {
    addBox(g, 0.14, 0.5, 0.62, MATS.iron, bx, 0.25, 0);
  });
  parent.add(g);
}

function addBenches(root) {
  addBench(root, -20, 22, Math.PI / 2);
  addBench(root, 20, 22, -Math.PI / 2);
  addBench(root, 28, -7.8, Math.PI);
  addBench(root, 28, 21.8, 0);
}

/* ---------- 材质 / 入口 ---------- */

let MATS = null;

function createMaterials(textures) {
  return {
    base: std({ map: textures.stone, color: 0x837666, roughness: 0.96 }),
    terrace: std({ map: textures.stone, color: 0x988771, roughness: 0.95 }),
    paving: std({ map: textures.paving, color: 0x9f927d, roughness: 0.96 }),
    gravel: std({ map: textures.gravel, color: 0xa18f75, roughness: 1 }),
    lawn: std({ map: textures.lawn, roughness: 0.98 }),
    white: std({ color: 0xb4a488, roughness: 0.9 }),
    whiteRim: std({ color: 0xb4a488, roughness: 0.9, side: THREE.DoubleSide }),
    whiteBright: std({ color: 0xc9b99d, roughness: 0.85 }),
    cream: std({ color: 0x9f8a6d, roughness: 0.92 }),
    hedge: std({ color: 0x243a14, roughness: 0.95, flatShading: true }),
    foliage: std({ color: 0x2f481b, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x223615, roughness: 0.95, flatShading: true }),
    cypress: std({ color: 0x19290d, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 }),
    water: std({ map: textures.water, color: 0xa8d4d8, roughness: 0.24, metalness: 0.06, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    waterfall: std({ color: 0x9ccbd0, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    glass: std({ color: 0x9fc2c2, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    doorGlass: std({ color: 0x43605e, roughness: 0.2, metalness: 0.15, transparent: true, opacity: 0.75 }),
    iron: std({ color: 0x2f3a36, roughness: 0.6, metalness: 0.4 }),
    gold: std({ color: 0xa9814c, roughness: 0.35, metalness: 0.55 }),
    soil: std({ color: 0x4d3a28, roughness: 1 }),
    mountainFar: std({ color: 0x5b7259, roughness: 1, flatShading: true }),
    mountainNear: std({ color: 0x4b6148, roughness: 1, flatShading: true }),
    roseRed: std({ color: 0x9d2618, roughness: 0.75 }),
    rosePink: std({ color: 0xb54b60, roughness: 0.75 }),
    roseYellow: std({ color: 0xc99724, roughness: 0.75 }),
    roseWhite: std({ color: 0xe6d6bd, roughness: 0.75 }),
    rosePurple: std({ color: 0x634477, roughness: 0.75 }),
    lamp: std({ color: 0xfff2c9, emissive: 0x9a6a1e, emissiveIntensity: 0.5, roughness: 0.4 }),
    pottery: std({ color: 0xa96542, roughness: 0.9 }),
    wood: std({ color: 0x5e4029, roughness: 0.9 }),
    woodDark: std({ color: 0x2b1a12, roughness: 0.82 })
  };
}

export function create() {
  seed = 1995;

  const textures = {
    stone: makeStone("#c4bcae", "60,52,42"),
    paving: makePaving(),
    lawn: makeLawn(),
    gravel: makeGravel(),
    water: makeWater()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "yuntai-model";

  addBase(root);
  addPaths(root);
  addMountain(root);
  addColonnade(root);
  addCascade(root);
  addFountain(root);
  addGate(root);
  addGreenhouse(root);
  addRoseGarden(root);
  addTrees(root);
  addFlowerBeds(root);
  addLamps(root);
  addBenches(root);

  const anchors = {
    gate: new THREE.Vector3(0, GROUND_Y + 7.8, 33),
    fountain: new THREE.Vector3(0, GROUND_Y + 3.4, FOUNTAIN_Z),
    colonnade: new THREE.Vector3(0, GROUND_Y + 9.4, -20),
    greenhouse: new THREE.Vector3(-40, GROUND_Y + 6.6, -6),
    rose: new THREE.Vector3(28, GROUND_Y + 1.6, 7),
    detail: new THREE.Vector3(0, GROUND_Y + 2.4, FOUNTAIN_Z)
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
