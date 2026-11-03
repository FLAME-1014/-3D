/*
 * 荔枝湾 · 西关水岸 · 风格化水岸模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：荔枝湾涌龙津桥—文塔段 + 西关大屋 + 大戏台 + 两岸荔枝/画舫。
 * 不是整条 700m 河涌的 1:1 复原。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 120;
const SITE_D = 80;
const BASE_Y = 0.9;
const GROUND_Y = 2.6;
const WATER_Y = 1.9;
const CANAL_HALF = 9;

let seed = 2010;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function range(a, b) {
  return a + (b - a) * random();
}
function canalZ(x) {
  return 2.0 * Math.sin((x + 60) / 120 * Math.PI * 2);
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
  grad.addColorStop(0.55, "#4f7f86");
  grad.addColorStop(1, "#3f6f78");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 100; i++) {
    ctx.strokeStyle = "rgba(225,245,240," + range(0.04, 0.13).toFixed(3) + ")";
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
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(x, y + bh - 5, bw - 4, 2);
    }
  }
  return colorTexture(c, 1, 1);
}

function makeRoof(green) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = green ? "#2f6b4f" : "#5a6260";
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

function makeSign(text) {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2b1a12";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#b08d57";
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
  const mat = new THREE.MeshStandardMaterial({
    map: makeSign(text),
    roughness: 0.72,
    metalness: 0.04
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(x, y, z);
  if (normal < 0) plane.rotation.y = Math.PI;
  parent.add(plane);
  addBox(parent, width + 0.12, height + 0.12, 0.08, MATS.woodDark, x, y, z - normal * 0.06, false, false);
}

/* ---------- 水岸几何 ---------- */

function buildWater() {
  const N = 80;
  const positions = [];
  const uvs = [];
  for (let i = 0; i < N; i++) {
    const x0 = -58 + (116 * i) / N;
    const x1 = -58 + (116 * (i + 1)) / N;
    const z0 = canalZ(x0);
    const z1 = canalZ(x1);
    positions.push(
      x0, WATER_Y, z0 - CANAL_HALF,
      x1, WATER_Y, z1 - CANAL_HALF,
      x0, WATER_Y, z0 + CANAL_HALF,
      x1, WATER_Y, z1 - CANAL_HALF,
      x1, WATER_Y, z1 + CANAL_HALF,
      x0, WATER_Y, z0 + CANAL_HALF
    );
    uvs.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const tex = makeWater();
  tex.repeat.set(8, 1);
  const mesh = new THREE.Mesh(geo, std({ map: tex, roughness: 0.28, metalness: 0.12, transparent: true, opacity: 0.94, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildBank(sign) {
  const N = 60;
  const top = [];
  const topUv = [];
  const wall = [];
  const wallUv = [];
  const inner = [];
  for (let i = 0; i < N; i++) {
    const x0 = -58 + (116 * i) / N;
    const x1 = -58 + (116 * (i + 1)) / N;
    const zi0 = canalZ(x0) + sign * CANAL_HALF;
    const zi1 = canalZ(x1) + sign * CANAL_HALF;
    const zo0 = sign * (SITE_D / 2);
    const zo1 = sign * (SITE_D / 2);
    top.push(
      x0, GROUND_Y, zi0,
      x1, GROUND_Y, zi1,
      x0, GROUND_Y, zo0,
      x1, GROUND_Y, zi1,
      x1, GROUND_Y, zo1,
      x0, GROUND_Y, zo0
    );
    topUv.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
    wall.push(
      x0, WATER_Y, zi0,
      x1, WATER_Y, zi1,
      x0, GROUND_Y, zi0,
      x1, WATER_Y, zi1,
      x1, GROUND_Y, zi1,
      x0, GROUND_Y, zi0
    );
    wallUv.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
    inner.push([x0, zi0]);
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute("position", new THREE.Float32BufferAttribute(top, 3));
  topGeo.setAttribute("uv", new THREE.Float32BufferAttribute(topUv, 2));
  topGeo.computeVertexNormals();
  const topTex = makeStone("#b8b09f", "60,52,42");
  topTex.repeat.set(8, 4);
  const topMesh = new THREE.Mesh(topGeo, std({ map: topTex, roughness: 0.98 }));
  topMesh.receiveShadow = true;

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wall, 3));
  wallGeo.setAttribute("uv", new THREE.Float32BufferAttribute(wallUv, 2));
  wallGeo.computeVertexNormals();
  const wallTex = makeStone("#9a9080", "50,44,36");
  wallTex.repeat.set(12, 1);
  const wallMesh = new THREE.Mesh(wallGeo, std({ map: wallTex, roughness: 0.98, side: THREE.DoubleSide }));
  wallMesh.receiveShadow = true;

  // 岸线压边 + 麻石步道
  const curb = [];
  const walk = [];
  const walkUv = [];
  for (let i = 0; i < N; i++) {
    const x0 = -58 + (116 * i) / N;
    const x1 = -58 + (116 * (i + 1)) / N;
    const z0 = canalZ(x0) + sign * CANAL_HALF;
    const z1 = canalZ(x1) + sign * CANAL_HALF;
    const s0 = canalZ(x0) + sign * (CANAL_HALF + 4.6);
    const s1 = canalZ(x1) + sign * (CANAL_HALF + 4.6);
    curb.push(
      x0, GROUND_Y + 0.05, z0,
      x1, GROUND_Y + 0.05, z1,
      x0, GROUND_Y + 0.05, z0 + sign * 0.5,
      x1, GROUND_Y + 0.05, z1,
      x1, GROUND_Y + 0.05, z1 + sign * 0.5,
      x0, GROUND_Y + 0.05, z0 + sign * 0.5
    );
    walk.push(
      x0, GROUND_Y + 0.04, z0 + sign * 0.5,
      x1, GROUND_Y + 0.04, z1 + sign * 0.5,
      x0, GROUND_Y + 0.04, s0,
      x1, GROUND_Y + 0.04, z1 + sign * 0.5,
      x1, GROUND_Y + 0.04, s1,
      x0, GROUND_Y + 0.04, s0
    );
    walkUv.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
  }
  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute("position", new THREE.Float32BufferAttribute(curb, 3));
  curbGeo.computeVertexNormals();
  const curbMesh = new THREE.Mesh(curbGeo, MATS.curb);
  curbMesh.receiveShadow = true;

  const walkGeo = new THREE.BufferGeometry();
  walkGeo.setAttribute("position", new THREE.Float32BufferAttribute(walk, 3));
  walkGeo.setAttribute("uv", new THREE.Float32BufferAttribute(walkUv, 2));
  walkGeo.computeVertexNormals();
  const walkTex = makePaving();
  walkTex.repeat.set(16, 2);
  const walkMesh = new THREE.Mesh(walkGeo, std({ map: walkTex, roughness: 0.98 }));
  walkMesh.receiveShadow = true;

  const g = new THREE.Group();
  g.add(topMesh, wallMesh, curbMesh, walkMesh);
  return g;
}

function buildBaseSkirt() {
  const g = new THREE.Group();
  addBox(g, SITE_W, GROUND_Y - BASE_Y, 0.5, MATS.retaining, 0, (GROUND_Y + BASE_Y) / 2, SITE_D / 2, false);
  addBox(g, SITE_W, GROUND_Y - BASE_Y, 0.5, MATS.retaining, 0, (GROUND_Y + BASE_Y) / 2, -SITE_D / 2, false);
  addBox(g, 0.5, GROUND_Y - BASE_Y, SITE_D, MATS.retaining, SITE_W / 2, (GROUND_Y + BASE_Y) / 2, 0, false);
  addBox(g, 0.5, GROUND_Y - BASE_Y, SITE_D, MATS.retaining, -SITE_W / 2, (GROUND_Y + BASE_Y) / 2, 0, false);
  return g;
}

/* ---------- 栏杆/灯 ---------- */

function addRailing(parent, sign) {
  const postGeo = new THREE.BoxGeometry(0.22, 1.0, 0.22);
  const count = 34;
  const posts = new THREE.InstancedMesh(postGeo, MATS.curb, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x = -56 + i * (112 / (count - 1));
    dummy.position.set(x, GROUND_Y + 0.55, canalZ(x) + sign * (CANAL_HALF + 0.2));
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  }
  posts.castShadow = true;
  parent.add(posts);

  for (let i = 0; i < count - 1; i++) {
    const x0 = -56 + i * (112 / (count - 1));
    const x1 = -56 + (i + 1) * (112 / (count - 1));
    const z0 = canalZ(x0) + sign * (CANAL_HALF + 0.2);
    const z1 = canalZ(x1) + sign * (CANAL_HALF + 0.2);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rail = addBox(parent, len + 0.1, 0.12, 0.16, MATS.curb, (x0 + x1) / 2, GROUND_Y + 1.05, (z0 + z1) / 2, false);
    rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  }
}

function addLamps(parent) {
  [-48, -30, -12, 20, 38, 50].forEach(function (x) {
    [1, -1].forEach(function (sign) {
      if (x === -30 && sign === -1) return;
      const z = canalZ(x) + sign * (CANAL_HALF + 3.6);
      addCylinder(parent, 0.08, 0.1, 3.2, 6, MATS.iron, x, GROUND_Y + 1.6, z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), MATS.lamp);
      lamp.position.set(x, GROUND_Y + 3.25, z);
      parent.add(lamp);
    });
  });
}

/* ---------- 树 ---------- */

function addTrees(parent) {
  const xs = [-52, -42, -32, -22, -12, 0, 10, 20, 30, 40, 50];
  const entries = [];
  xs.forEach(function (x) {
    [1, -1].forEach(function (sign) {
      if (sign === 1 && (x === 20 || x === 30)) return;
      if (sign === -1 && (x === -32 || x === -22)) return;
      entries.push({ x: x + range(-1, 1), z: canalZ(x) + sign * 12.5, s: range(0.85, 1.05), sign: sign });
    });
  });
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 1, 6);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, MATS.trunk, entries.length);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
  const canopyA = [];
  const canopyB = [];
  const fruit = [];
  const dummy = new THREE.Object3D();
  entries.forEach(function (e, i) {
    const h = 5.4 * e.s;
    const y = GROUND_Y;
    dummy.position.set(e.x, y + h / 2, e.z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(e.s, h, e.s);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    const r = 2.7 * e.s;
    const cy = y + h + r * 0.3;
    (i % 2 ? canopyB : canopyA).push({ x: e.x, y: cy, z: e.z, r: r });
    for (let k = 0; k < 5; k++) {
      fruit.push({
        x: e.x + range(-r * 0.75, r * 0.75),
        y: cy + range(-r * 0.2, r * 0.4),
        z: e.z + range(-r * 0.65, r * 0.65)
      });
    }
  });
  trunkMesh.castShadow = true;
  parent.add(trunkMesh);

  [
    { list: canopyA, mat: MATS.foliage },
    { list: canopyB, mat: MATS.foliage2 }
  ].forEach(function (group) {
    const mesh = new THREE.InstancedMesh(canopyGeo, group.mat, group.list.length);
    group.list.forEach(function (p, i) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(random() * 0.3, random() * Math.PI * 2, random() * 0.3);
      dummy.scale.set(p.r, p.r * 0.8, p.r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true;
    parent.add(mesh);
  });

  const fruitMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 5), MATS.lychee, fruit.length);
  fruit.forEach(function (p, i) {
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    fruitMesh.setMatrixAt(i, dummy.matrix);
  });
  parent.add(fruitMesh);
}

/* ---------- 桥 ---------- */

function addBridge(parent) {
  const g = new THREE.Group();
  g.name = "longjin-bridge";
  const cx = 8;
  const cz = canalZ(cx);
  g.position.set(cx, GROUND_Y, cz);

  // 桥面（相对水面 -0.7，桥面 1.7）
  addBox(g, 4.2, 0.45, 25, MATS.stone, 0, 1.7, 0);
  addBox(g, 4.6, 0.2, 25.4, MATS.curb, 0, 1.98, 0, false);

  // 三拱桥面（带拱洞的侧墙）
  const face = new THREE.Shape();
  face.moveTo(-12.5, 0);
  face.lineTo(12.5, 0);
  face.lineTo(12.5, 2.4);
  face.lineTo(-12.5, 2.4);
  face.closePath();
  [
    { z: -6.2, r: 1.9 },
    { z: 0, r: 2.3 },
    { z: 6.2, r: 1.9 }
  ].forEach(function (a) {
    const hole = new THREE.Path();
    hole.moveTo(a.z - a.r, 0.05);
    hole.lineTo(a.z + a.r, 0.05);
    hole.absarc(a.z, 0.05, a.r, 0, Math.PI, false);
    hole.closePath();
    face.holes.push(hole);
  });
  const faceGeo = new THREE.ShapeGeometry(face);
  [2.11, -2.11].forEach(function (x) {
    const panel = new THREE.Mesh(faceGeo, MATS.bridgeFace);
    panel.rotation.y = Math.PI / 2;
    panel.position.set(x, -0.7, 0);
    panel.castShadow = true;
    g.add(panel);
  });

  // 桥墩
  [-9.3, -3.1, 3.1, 9.3].forEach(function (z) {
    addBox(g, 4.0, 2.2, 1.1, MATS.stone, 0, 0.4, z);
  });

  // 两端台阶
  [-1, 1].forEach(function (sx) {
    for (let i = 0; i < 5; i++) {
      addBox(g, 4.2, 0.3, 1.1, MATS.curb, 0, 1.5 - i * 0.3, sx * (12.6 + i * 1.0));
    }
  });

  // 栏杆
  [-1, 1].forEach(function (sx) {
    for (let i = 0; i < 9; i++) {
      addBox(g, 0.18, 1.0, 0.18, MATS.curb, sx * 1.85, 2.35, -9 + i * 2.25);
    }
    addBox(g, 0.16, 0.12, 18.5, MATS.curb, sx * 1.85, 2.85, 0, false);
  });

  addSign(g, "龙津桥", 0, 0.9, 17.1, 1, 2.6, 0.65);
  parent.add(g);
}

/* ---------- 文塔 ---------- */

function addWenta(parent) {
  const g = new THREE.Group();
  g.name = "wenta";
  const x = 24;
  const z = -15;
  g.position.set(x, GROUND_Y, z);

  addBox(g, 6, 1.0, 6, MATS.stone, 0, 0.5, 0, false, true);
  addCylinder(g, 2.8, 3.0, 6.0, 6, MATS.brickWall, 0, 4.0, 0);
  addBox(g, 1.4, 2.2, 0.2, MATS.redDark, 0, 1.6, 2.95, false);
  [-1.4, 1.4].forEach(function (wx) {
    addBox(g, 0.9, 1.1, 0.16, MATS.woodDark, wx, 4.5, 2.95, false);
  });
  addCylinder(g, 3.05, 3.05, 0.3, 6, MATS.cream, 0, 6.65, 0);
  addCylinder(g, 2.4, 3.7, 0.9, 6, MATS.roof, 0, 7.25, 0);
  addCylinder(g, 2.3, 2.5, 4.4, 6, MATS.brickWall, 0, 9.2, 0);
  addCylinder(g, 1.2, 3.2, 0.8, 6, MATS.roof, 0, 11.4, 0);
  const topRoof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 2.2, 6), MATS.roof);
  topRoof.position.set(0, 12.9, 0);
  topRoof.castShadow = true;
  g.add(topRoof);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tip = addBox(g, 0.9, 0.28, 0.32, MATS.roof, Math.sin(a) * 2.7, 12.15, Math.cos(a) * 2.7, false);
    tip.rotation.y = -a;
    tip.rotation.z = 0.3;
  }
  addCylinder(g, 0.1, 0.1, 1.4, 6, MATS.gold, 0, 14.3, 0);
  addSign(g, "文塔", 0, 5.6, 2.95, 1, 2.0, 0.55);
  parent.add(g);
}

/* ---------- 西关大屋 ---------- */

function addGableRoofX(parent, w, d, h, baseY, z, mat) {
  const halfD = d / 2;
  const slope = Math.sqrt(halfD * halfD + h * h);
  const angle = Math.atan2(h, halfD);
  const thick = 0.28;
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
  [-1, 1].forEach(function (sx) {
    const gable = new THREE.Mesh(geo, MATS.brickWall);
    gable.rotation.y = sx * Math.PI / 2;
    gable.position.set(sx * w / 2, baseY, z);
    gable.castShadow = true;
    parent.add(gable);
  });
  addBox(parent, w + 0.2, 0.22, 0.42, mat, 0, baseY + h, z, false);
}

function addXiguanHouse(parent, x, z, rot, opts) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  g.rotation.y = rot || 0;
  const w = 11;
  const d = 9;
  const h = 5.4;

  addBox(g, w + 0.6, 0.5, d + 0.6, MATS.stone, 0, 0.25, 0, false, true);
  addBox(g, w, 1.2, d, MATS.curb, 0, 1.2, 0, false);
  addBox(g, w, h - 1.2, d, MATS.brickWall, 0, 1.2 + (h - 1.2) / 2, 0);
  addBox(g, w + 0.3, 0.24, d + 0.3, MATS.trim, 0, h, 0, false);

  // 趟栊门
  addBox(g, 3.0, 3.2, 0.25, MATS.woodDark, 0, 1.6, d / 2 + 0.05, false);
  for (let i = 0; i < 5; i++) {
    addBox(g, 2.6, 0.12, 0.32, MATS.wood, 0, 0.9 + i * 0.5, d / 2 + 0.12, false);
  }
  addBox(g, 3.8, 0.3, 0.4, MATS.curb, 0, 3.55, d / 2 + 0.12, false);
  [-1, 1].forEach(function (sx) {
    addBox(g, 0.35, 3.3, 0.45, MATS.curb, sx * 1.75, 1.7, d / 2 + 0.12, false);
  });
  if (opts && opts.sign) {
    addSign(g, "西关大屋", 0, 4.15, d / 2 + 0.18, 1, 2.4, 0.5);
  }

  // 满洲窗
  [-3.5, 3.5].forEach(function (wx) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.0), MATS.mansard);
    glass.position.set(wx, 3.4, d / 2 + 0.08);
    g.add(glass);
    addBox(g, 1.5, 2.2, 0.12, MATS.trim, wx, 3.4, d / 2 + 0.02, false);
  });

  addGableRoofX(g, w + 0.6, d + 0.6, 1.8, h + 0.2, 0, MATS.roofGrey);

  if (opts && opts.wall) {
    addBox(g, 8.5, 1.6, 0.3, MATS.brickWall, 0, 0.8, d / 2 + 3.2, false);
    addBox(g, 8.8, 0.2, 0.5, MATS.roofGrey, 0, 1.65, d / 2 + 3.2, false);
  }
  parent.add(g);
}

/* ---------- 戏台 ---------- */

function addOperaStage(parent) {
  const g = new THREE.Group();
  g.name = "opera-stage";
  const x = -30;
  const z = -15;
  g.position.set(x, GROUND_Y, z);

  addBox(g, 16, 1.0, 10, MATS.stone, 0, 0.5, 0, false, true);
  addBox(g, 15, 0.4, 9, MATS.wood, 0, 1.2, 0);
  [-6.5, -2.2, 2.2, 6.5].forEach(function (px) {
    addCylinder(g, 0.28, 0.32, 4.6, 8, MATS.redDark, px, 3.5, 3.6);
  });
  addBox(g, 15, 4.2, 0.4, MATS.brickWall, 0, 3.4, -4.6);
  addBox(g, 17, 0.2, 11, MATS.trim, 0, 5.5, 0, false);
  addGableRoofX(g, 17, 11, 2.4, 5.6, 0, MATS.roof);
  addSign(g, "荔枝湾大戏台", 0, 4.6, 4.1, 1, 5.2, 0.9);
  addBox(g, 4.0, 0.12, 1.2, MATS.woodDark, 0, 2.6, 4.2, false);
  [-1, 1].forEach(function (sx) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), MATS.lantern);
    lantern.position.set(sx * 6.2, 4.0, 3.9);
    g.add(lantern);
  });
  parent.add(g);
}

/* ---------- 画舫 ---------- */

function addBoat(parent, x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, WATER_Y + 0.28, z);
  g.rotation.y = rot || 0;
  addBox(g, 6.2, 0.5, 2.2, MATS.woodDark, 0, 0, 0);
  addBox(g, 4.4, 0.15, 1.8, MATS.wood, 0, 0.35, 0);
  [-1, 1].forEach(function (sx) {
    addCylinder(g, 0.08, 0.08, 1.4, 6, MATS.redDark, sx * 1.8, 1.0, 0.6);
    addCylinder(g, 0.08, 0.08, 1.4, 6, MATS.redDark, sx * 1.8, 1.0, -0.6);
  });
  addBox(g, 4.6, 0.18, 2.0, MATS.redDark, 0, 1.75, 0, false);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), MATS.lantern);
  lamp.position.set(0, 1.35, 1.1);
  g.add(lamp);
  parent.add(g);
}

/* ---------- 骑楼/商铺 ---------- */

function addShop(parent, x, z, signText) {
  const g = new THREE.Group();
  g.position.set(x, GROUND_Y, z);
  addBox(g, 12, 0.4, 9, MATS.stone, 0, 0.2, 0, false, true);
  addBox(g, 11, 6.0, 8, MATS.cream, 0, 3.2, 0);
  addBox(g, 11.4, 0.35, 8.4, MATS.roofGrey, 0, 6.4, 0, false);
  for (let i = 0; i < 4; i++) {
    addBox(g, 0.4, 3.2, 0.4, MATS.trim, -4.5 + i * 3, 1.8, 4.4, false);
  }
  addBox(g, 11, 0.35, 4.6, MATS.trim, 0, 3.5, 2.2, false);
  addSign(g, signText, 0, 5.0, 4.15, 1, 3.6, 0.8);
  parent.add(g);
}

/* ---------- 材质/实例 ---------- */

let MATS = null;

function createMaterials(textures) {
  return {
    stone: std({ map: textures.stone, color: 0xc7bcaa, roughness: 0.95 }),
    bridgeFace: std({ map: textures.stone, color: 0xc7bcaa, roughness: 0.95, side: THREE.DoubleSide }),
    curb: std({ color: 0xd6cdbb, roughness: 0.95 }),
    retaining: std({ map: textures.stone, color: 0x9f9584, roughness: 1 }),
    brickWall: std({ map: textures.brick, roughness: 0.95 }),
    sandstone: std({ map: textures.sandstone, roughness: 0.94 }),
    cream: std({ color: 0xe0d3bd, roughness: 0.92 }),
    trim: std({ color: 0xe8dcc5, roughness: 0.92 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    wood: std({ color: 0x6b4a32, roughness: 0.86 }),
    redDark: std({ color: 0x7d2e22, roughness: 0.85 }),
    roof: std({ map: textures.roofGreen, roughness: 0.8 }),
    roofGrey: std({ map: textures.roofGrey, roughness: 0.88 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    iron: std({ color: 0x24282a, roughness: 0.6, metalness: 0.4 }),
    lamp: std({ color: 0xfff2c9, emissive: 0x9a6a1e, emissiveIntensity: 0.5, roughness: 0.4 }),
    lantern: std({ color: 0x8f1a10, emissive: 0x3a0704, emissiveIntensity: 0.25, roughness: 0.72 }),
    foliage: std({ color: 0x3f5f3a, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x55744a, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x5a4432, roughness: 0.95 }),
    lychee: std({ color: 0xb23a2e, roughness: 0.7 })
  };
}

/* ---------- 入口 ---------- */

export function create() {
  seed = 2010;

  const textures = {
    stone: makeStone("#b8b09f", "60,52,42"),
    brick: makeBrick("#8a8f88", "#b3b7ad"),
    sandstone: makeBrick("#9a503c", "#b57a62"),
    roofGreen: makeRoof(true),
    roofGrey: makeRoof(false)
  };
  MATS = createMaterials(textures);
  MATS.mansard = std({ map: makeMansard(), roughness: 0.5, metalness: 0.05 });

  const root = new THREE.Group();
  root.name = "lizhiwan-model";

  // 展柜底座
  addBox(root, SITE_W, BASE_Y, SITE_D, MATS.stone, 0, BASE_Y / 2, 0, false, true);
  root.add(buildBaseSkirt());
  root.add(buildWater());
  root.add(buildBank(1));
  root.add(buildBank(-1));

  // 端头封口
  [-1, 1].forEach(function (sx) {
    addBox(root, 0.6, GROUND_Y - WATER_Y, CANAL_HALF * 2, MATS.retaining, sx * 58.3, (GROUND_Y + WATER_Y) / 2, canalZ(sx * 58), false);
  });

  addBridge(root);
  addWenta(root);
  addOperaStage(root);

  // 南岸西关大屋
  addXiguanHouse(root, -38, 18, Math.PI, { wall: true });
  addXiguanHouse(root, -22, 18, Math.PI, { sign: true });
  addXiguanHouse(root, -6, 18, Math.PI, { wall: true });
  addXiguanHouse(root, 22, 18, Math.PI, {});

  // 北岸骑楼/商铺
  addShop(root, -10, -18, "荔湾");
  addShop(root, 12, -18, "泮塘");
  addShop(root, 34, -18, "西关");

  addTrees(root);
  addRailing(root, 1);
  addRailing(root, -1);
  addLamps(root);

  addBoat(root, -50, canalZ(-50), 0);
  addBoat(root, 34, canalZ(34), Math.PI);

  const anchors = {
    canal: new THREE.Vector3(0, WATER_Y + 0.8, 0),
    bridge: new THREE.Vector3(8, GROUND_Y + 2.2, canalZ(8)),
    tower: new THREE.Vector3(24, GROUND_Y + 9, -15),
    house: new THREE.Vector3(-22, GROUND_Y + 3.5, 18),
    opera: new THREE.Vector3(-30, GROUND_Y + 3.5, -15),
    detail: new THREE.Vector3(24, GROUND_Y + 11.5, -15)
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
