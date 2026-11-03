/*
 * 越秀公园 · 五羊石像 · 风格化山脊模型（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：五羊石像 + 明城墙（榕根段）+ 镇海楼 + 简化五羊仙庭牌坊。
 * 不含三湖、体育场内部、博物馆展陈；真实约 300m 间距压缩到 110m。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const BASE_Y = 0.9;
const SITE_W = 110;
const SITE_D = 80;
const WALL_Z = -17;
const WALL_TOP = 13.6;
const TOWER_BASE = 14.4;

let seed = 1960;
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

function makeBrick(base, mortar, bw, bh) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, 512, 512);
  bw = bw || 64;
  bh = bh || 24;
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

function makeStone(base, speck) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = "rgba(" + speck + "," + range(0.03, 0.12).toFixed(3) + ")";
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

function makeRoof() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1f4a37";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 16) {
    ctx.fillStyle = "rgba(8,28,20,0.4)";
    ctx.fillRect(0, y, 512, 4);
    ctx.fillStyle = "rgba(100,150,115,0.12)";
    ctx.fillRect(0, y + 4, 512, 2);
  }
  return colorTexture(c, 1, 1);
}

function makeRedWall() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#93361f";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = "rgba(70,20,12," + range(0.02, 0.08).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(2, 5), range(2, 7));
  }
  return colorTexture(c, 1, 1);
}

function makeLattice() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e8dcc5";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#25433b";
  ctx.fillRect(14, 14, 228, 228);
  ctx.strokeStyle = "#cfc4ad";
  ctx.lineWidth = 7;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(14 + i * 57, 14);
    ctx.lineTo(14 + i * 57, 242);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, 14 + i * 57);
    ctx.lineTo(242, 14 + i * 57);
    ctx.stroke();
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

/* ---------- 地形 ---------- */

function heightAt(x, z) {
  const ridge = 9.0 * Math.exp(-Math.pow((z + 17) / 12, 2)) * (0.72 + 0.28 * Math.cos((x + 10) / 26));
  const knoll = 4.6 * Math.exp(-(Math.pow((x + 30) / 14, 2) + Math.pow((z - 11) / 12, 2)));
  const plateau = 2.6 * Math.exp(-(Math.pow((x - 24) / 16, 2) + Math.pow((z + 7) / 9, 2)));
  const south = 0.45 * Math.exp(-(Math.pow(x / 38, 2) + Math.pow((z - 24) / 16, 2)));
  return ridge + knoll + plateau + south;
}

function buildTerrain() {
  const geo = new THREE.PlaneGeometry(SITE_W, SITE_D, 56, 40);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const grass = new THREE.Color(0x35502a);
  const grass2 = new THREE.Color(0x243d20);
  const rock = new THREE.Color(0x7a6e5a);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const n = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    const c = (n > 0.72 ? grass2 : grass).clone().lerp(rock, Math.min(0.38, Math.max(0, (y - 4.4) / 9)));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, flatShading: true })
  );
  mesh.position.y = BASE_Y;
  mesh.receiveShadow = true;
  return mesh;
}

function buildSkirt() {
  const positions = [];
  const colors = [];
  const top = new THREE.Color(0x5f7f45);
  const bottom = new THREE.Color(0x6b5a46);
  const edges = [
    [-SITE_W / 2, -SITE_D / 2, SITE_W / 2, -SITE_D / 2],
    [SITE_W / 2, -SITE_D / 2, SITE_W / 2, SITE_D / 2],
    [SITE_W / 2, SITE_D / 2, -SITE_W / 2, SITE_D / 2],
    [-SITE_W / 2, SITE_D / 2, -SITE_W / 2, -SITE_D / 2]
  ];
  edges.forEach(function (e) {
    const x0 = e[0];
    const z0 = e[1];
    const x1 = e[2];
    const z1 = e[3];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(2, Math.ceil(len / 2));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const ax = x0 + (x1 - x0) * t0;
      const az = z0 + (z1 - z0) * t0;
      const bx = x0 + (x1 - x0) * t1;
      const bz = z0 + (z1 - z0) * t1;
      const ay = heightAt(ax, az);
      const by = heightAt(bx, bz);
      positions.push(ax, ay, az, bx, by, bz, ax, 0, az);
      positions.push(bx, by, bz, bx, 0, bz, ax, 0, az);
      for (let k = 0; k < 6; k++) {
        const isTop = k === 0 || k === 1 || k === 3;
        const c = isTop ? top : bottom;
        colors.push(c.r, c.g, c.b);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, flatShading: true, side: THREE.DoubleSide })
  );
  mesh.position.y = BASE_Y;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------- 路径 ---------- */

function addPath(parent, points, width) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const y = BASE_Y + heightAt(mx, mz) + 0.07;
    const mesh = addBox(parent, len + 0.4, 0.12, width, MATS.path, mx, y, mz, false, true);
    mesh.rotation.y = -Math.atan2(dz, dx);
  }
}

/* ---------- 树 ---------- */

function addTreeInstances(parent) {
  const trees = [
    [-48, 20, 1.05], [-42, 31, 0.95], [-40, 28, 1.0], [-11, 31, 0.9],
    [8, 28, 1.0], [27, 31, 0.95], [42, 23, 1.0], [47, 8, 0.9],
    [-47, -4, 0.9], [-34, -4, 0.85], [-2, -5, 0.9], [12, -4, 0.8],
    [7, 13, 0.95], [20, 4, 0.9], [-8, 18, 0.85], [37, -3, 0.8]
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 1, 6);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, MATS.trunk, trees.length);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
  const canopyA = [];
  const canopyB = [];
  const dummy = new THREE.Object3D();
  trees.forEach(function (t, i) {
    const x = t[0];
    const z = t[1];
    const s = t[2];
    const h = 6.5 * s;
    const y = BASE_Y + heightAt(x, z);
    dummy.position.set(x, y + h / 2, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(s, h, s);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    const r = 3.4 * s;
    const cy = y + h + r * 0.35;
    const entry = { x: x, y: cy, z: z, r: r };
    (i % 2 ? canopyB : canopyA).push(entry);
    (i % 3 === 0 ? canopyB : canopyA).push({ x: x + r * 0.55, y: cy - r * 0.15, z: z + r * 0.25, r: r * 0.7 });
  });
  trunkMesh.castShadow = true;
  parent.add(trunkMesh);

  [
    { list: canopyA, mat: MATS.foliage },
    { list: canopyB, mat: MATS.foliage2 }
  ].forEach(function (group) {
    if (!group.list.length) return;
    const mesh = new THREE.InstancedMesh(canopyGeo, group.mat, group.list.length);
    group.list.forEach(function (p, i) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(random() * 0.3, random() * Math.PI * 2, random() * 0.3);
      dummy.scale.set(p.r, p.r * 0.82, p.r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true;
    parent.add(mesh);
  });
}

function addOutcrops(parent) {
  const points = [
    [-42, -10, 2.2], [-28, -9, 1.8], [-18, -8, 2.4], [-4, -10, 1.6],
    [14, -9, 2.0], [32, -8, 2.2], [44, -11, 1.8], [8, -13, 1.5],
    [-36, -2, 1.4], [38, -2, 1.3]
  ];
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(geo, MATS.rock, points.length);
  const dummy = new THREE.Object3D();
  points.forEach(function (p, i) {
    const s = p[2];
    dummy.position.set(p[0], BASE_Y + heightAt(p[0], p[1]) + s * 0.3, p[1]);
    dummy.rotation.set(random(), random() * 3, random());
    dummy.scale.set(s, s * 0.6, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

/* ---------- 五羊 ---------- */

function addSheep(parent, opts) {
  const g = new THREE.Group();
  g.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
  g.rotation.y = opts.rot || 0;
  const s = opts.s || 1;
  g.scale.setScalar(s);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), MATS.granite);
  body.position.set(0, 1.15, 0);
  body.scale.set(1.35, 0.8, 0.72);
  body.castShadow = true;
  g.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.9, 8), MATS.granite);
  neck.position.set(0, 1.55, 0.62);
  neck.rotation.x = 0.65;
  neck.castShadow = true;
  g.add(neck);

  const headY = opts.headDown ? 0.95 : 2.2;
  const headZ = opts.headDown ? 1.45 : 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.62, 0.95), MATS.granite);
  head.position.set(0, headY, headZ);
  head.rotation.x = opts.headDown ? 0.7 : 0.1;
  head.castShadow = true;
  g.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.5), MATS.granite);
  snout.position.set(0, headY - 0.06, headZ + 0.54);
  snout.rotation.x = opts.headDown ? 0.6 : 0.05;
  snout.castShadow = true;
  g.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.12), MATS.graniteDark);
  nose.position.set(0, headY - 0.1, headZ + 0.8);
  g.add(nose);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 5), MATS.graniteDark);
  beard.position.set(0, headY - 0.4, headZ + 0.34);
  beard.rotation.x = 0.18;
  g.add(beard);

  [-1, 1].forEach(function (side) {
    const horn = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 8, 16, Math.PI * 1.7), MATS.graniteDark);
    horn.position.set(side * 0.46, headY + 0.18, headZ - 0.02);
    horn.rotation.set(0, 0, side * 0.25);
    horn.castShadow = true;
    g.add(horn);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 4), MATS.granite);
    ear.position.set(side * 0.56, headY + 0.06, headZ - 0.06);
    ear.rotation.z = side * 1.35;
    g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), MATS.eye);
    eye.position.set(side * 0.17, headY + 0.1, headZ + 0.47);
    g.add(eye);
    [-0.5, 0.44].forEach(function (z) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.0, 6), MATS.granite);
      leg.position.set(side * 0.55, 0.5, z);
      leg.castShadow = true;
      g.add(leg);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.24), MATS.graniteDark);
      hoof.position.set(side * 0.55, 0.08, z + 0.04);
      g.add(hoof);
    });
  });

  const wool = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), MATS.granite);
  wool.position.set(0, 1.5, -0.1);
  wool.scale.set(1.12, 0.55, 0.72);
  wool.castShadow = true;
  g.add(wool);

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), MATS.graniteDark);
  tail.position.set(0, 1.25, -1.35);
  g.add(tail);
  parent.add(g);
  return g;
}

function addWuyang(parent) {
  const g = new THREE.Group();
  g.name = "wuyang-statue";
  const x = -32;
  const z = 11;
  g.position.set(x, BASE_Y + heightAt(x, z), z);

  const rocks = [
    { x: 0, y: 2.2, z: 0, sx: 5.6, sy: 2.6, sz: 4.6 },
    { x: -3.6, y: 1.1, z: 1.4, sx: 3.0, sy: 1.5, sz: 3.0 },
    { x: 3.8, y: 1.5, z: -1.2, sx: 3.4, sy: 1.8, sz: 3.1 },
    { x: 0.8, y: 3.3, z: -1.8, sx: 2.4, sy: 1.2, sz: 2.0 }
  ];
  rocks.forEach(function (r) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), MATS.rock);
    rock.position.set(r.x, r.y, r.z);
    rock.scale.set(r.sx, r.sy, r.sz);
    rock.rotation.set(random(), random() * 3, random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
  });

  // 主羊：站在岩座最高处，昂首
  addSheep(g, { x: 0, y: 4.7, z: -0.2, s: 2.3, rot: -0.15 });

  // 四羊环绕
  addSheep(g, { x: -4.0, y: 2.1, z: 2.0, s: 1.0, rot: 1.2 });
  addSheep(g, { x: 3.9, y: 2.6, z: 0.6, s: 1.05, rot: -1.0 });
  addSheep(g, { x: 1.0, y: 1.4, z: 3.0, s: 0.82, rot: 2.3 });
  addSheep(g, { x: -2.2, y: 1.3, z: -2.7, s: 0.78, rot: -2.2, headDown: true });

  // 花坛/平台
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.35, 32), MATS.rock);
  base.scale.set(7.4, 1, 6.2);
  base.position.y = 0.18;
  base.receiveShadow = true;
  g.add(base);

  const signZ = 6.6;
  addSign(g, "五羊石像", -1.5, 1.1, signZ, 1, 2.6, 0.62, false);
  parent.add(g);
}

/* ---------- 明城墙 ---------- */

function addWall(parent) {
  const g = new THREE.Group();
  g.name = "ming-wall";

  // 台基/挡土墙
  addBox(g, 98, 3.2, 8, MATS.stone, 0, 6.4, WALL_Z, false, true);
  addBox(g, 98, 0.4, 8, MATS.path, 0, 8.0, WALL_Z, false, true);

  // 红砂岩基 + 青砖墙
  addBox(g, 94, 1.2, 5.4, MATS.sandstone, 0, 8.6, WALL_Z);
  addBox(g, 94, 4.4, 5.0, MATS.brickWall, 0, 11.4, WALL_Z);
  addBox(g, 94, 0.5, 5.2, MATS.stone, 0, 13.85, WALL_Z, false);

  // 雉堞
  const merlonGeo = new THREE.BoxGeometry(2.0, 1.4, 0.6);
  const merlonMesh = new THREE.InstancedMesh(merlonGeo, MATS.brickWall, 60);
  const dummy = new THREE.Object3D();
  let idx = 0;
  [-19.4, -14.6].forEach(function (z) {
    for (let x = -44; x <= 44; x += 3.2) {
      dummy.position.set(x, 14.7, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      merlonMesh.setMatrixAt(idx++, dummy.matrix);
    }
  });
  merlonMesh.count = idx;
  merlonMesh.castShadow = true;
  g.add(merlonMesh);

  // 榕根：从墙顶垂到墙脚
  for (let i = 0; i < 9; i++) {
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 8.4, 5), MATS.root);
    root.position.set(-8 + i * 0.62, 9.6, -14.2 + i * 0.11);
    root.rotation.set(0.12 + i * 0.01, 0, 0.05 + i * 0.012);
    root.castShadow = true;
    g.add(root);
  }

  // 墙顶榕树
  addCylinder(g, 0.6, 0.9, 5.0, 7, MATS.trunk, -8, 16.8, -18);
  [
    { x: -8, y: 20.2, z: -18, r: 4.2, mat: MATS.foliage },
    { x: -11.5, y: 19.0, z: -16.8, r: 3.0, mat: MATS.foliage2 },
    { x: -4.8, y: 19.4, z: -19.2, r: 2.8, mat: MATS.foliage2 }
  ].forEach(function (c) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), c.mat);
    mesh.position.set(c.x, c.y, c.z);
    mesh.scale.set(c.r, c.r * 0.8, c.r);
    mesh.castShadow = true;
    g.add(mesh);
  });

  // 镇海楼前石阶（从南侧平台到城墙顶）
  const startY = BASE_Y + heightAt(24, -1) + 0.1;
  const steps = 20;
  const run = 6.0 / steps;
  const rise = (TOWER_BASE + 0.8 - startY) / steps;
  const stepGeo = new THREE.BoxGeometry(22, rise + 0.04, run + 0.02);
  const stepMesh = new THREE.InstancedMesh(stepGeo, MATS.stone, steps);
  for (let i = 0; i < steps; i++) {
    dummy.position.set(24, startY + (i + 0.5) * rise, -1 - (i + 0.5) * run);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    stepMesh.setMatrixAt(i, dummy.matrix);
  }
  stepMesh.castShadow = true;
  stepMesh.receiveShadow = true;
  g.add(stepMesh);

  // 台阶两侧石墙与平台栏杆
  [-11.6, 11.6].forEach(function (sx) {
    addBox(g, 1.2, 7.6, 6.4, MATS.stone, 24 + sx, (startY + TOWER_BASE + 0.8) / 2, -4, false);
  });
  addBox(g, 33, 0.2, 0.22, MATS.stone, 24, 16.25, -6.8, false);
  for (let x = 8; x <= 40; x += 4) {
    addBox(g, 0.26, 1.0, 0.26, MATS.stone, x, 15.75, -6.8, false);
  }

  parent.add(g);
}

/* ---------- 镇海楼 ---------- */

function addEave(g, w, d, y) {
  const t = 0.18;
  const over = 1.5;
  const slope = 0.3;
  const front = addBox(g, w + over * 2, t, 1.9, MATS.roof, 0, y + 0.1, d / 2 + over * 0.45, false);
  front.rotation.x = slope;
  const back = addBox(g, w + over * 2, t, 1.9, MATS.roof, 0, y + 0.1, -d / 2 - over * 0.45, false);
  back.rotation.x = -slope;
  const right = addBox(g, 1.9, t, d + over * 2, MATS.roof, w / 2 + over * 0.45, y + 0.1, 0, false);
  right.rotation.z = -slope;
  const left = addBox(g, 1.9, t, d + over * 2, MATS.roof, -w / 2 - over * 0.45, y + 0.1, 0, false);
  left.rotation.z = slope;
  addBox(g, w + 2.2, 0.14, d + 2.2, MATS.trim, 0, y - 0.08, 0, false);
}

function addZhenhaiTower(parent) {
  const g = new THREE.Group();
  g.name = "zhenhai-tower";
  g.position.set(24, TOWER_BASE, WALL_Z);

  addBox(g, 36, 0.8, 20, MATS.stone, 0, 0.4, 0, false, true);
  // 前缘石台基（支撑挑出的楼板）
  addBox(g, 36, 7.2, 0.8, MATS.stone, 0, -2.8, 9.6, false);

  const widths = [31, 30, 29, 27.7, 26.4];
  const depths = [15.77, 15.2, 14.7, 14.2, 13.67];
  const floorH = 4.4;
  const gap = 0.3;
  let y = 0.8;

  for (let i = 0; i < 5; i++) {
    const w = widths[i];
    const d = depths[i];
    addBox(g, w, floorH, d, MATS.redWall, 0, y + floorH / 2, 0);
    addBox(g, w + 0.3, 0.5, d + 0.3, MATS.trim, 0, y + 0.25, 0, false);
    addBox(g, w + 0.2, 0.22, d + 0.2, MATS.trim, 0, y + floorH - 0.1, 0, false);

    // 四角红柱
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sz) {
        addBox(g, 0.5, floorH, 0.5, MATS.redDark, sx * (w / 2), y + floorH / 2, sz * (d / 2), false);
      });
    });
    // 面阔方向的红色壁柱
    [-1, 1].forEach(function (sz) {
      [-1, 1].forEach(function (sx) {
        addBox(g, 0.35, floorH, 0.22, MATS.redDark, sx * (w / 6.8), y + floorH / 2, sz * (d / 2 + 0.04), false);
      });
    });

    // 绿色檐口（四面坡檐）
    addEave(g, w, d, y + floorH + 0.18);

    // 窗（实例化）
    for (let bay = -1; bay <= 1; bay++) {
      windowInstances.push({
        x: 24 + bay * (w / 3.4),
        y: TOWER_BASE + y + floorH * 0.55,
        z: WALL_Z + d / 2 + 0.07,
        rot: 0
      });
      windowInstances.push({
        x: 24 + bay * (w / 3.4),
        y: TOWER_BASE + y + floorH * 0.55,
        z: WALL_Z - d / 2 - 0.07,
        rot: Math.PI
      });
    }
    [-1, 1].forEach(function (side) {
      for (let bay = -1; bay <= 1; bay++) {
        windowInstances.push({
          x: 24 + side * (w / 2 + 0.07),
          y: TOWER_BASE + y + floorH * 0.55,
          z: WALL_Z + bay * (d / 3.6),
          rot: side > 0 ? -Math.PI / 2 : Math.PI / 2
        });
      }
    });

    // 檐下红灯笼
    for (let bay = -2; bay <= 2; bay++) {
      lanternInstances.push({
        x: 24 + bay * (w / 5.4),
        y: TOWER_BASE + y + floorH + 0.75,
        z: WALL_Z + d / 2 + 0.6
      });
    }

    y += floorH + gap;
  }

  // 顶层金/绿屋顶
  const topW = widths[4];
  const topD = depths[4];
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 3.2, 4), MATS.roof);
  roof.position.set(0, y + 1.6, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(topW * 0.72, 1, topD * 0.72);
  roof.castShadow = true;
  g.add(roof);
  const roof2 = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 4), MATS.roofDark);
  roof2.position.set(0, y + 3.55, 0);
  roof2.rotation.y = Math.PI / 4;
  roof2.scale.set(topW * 0.38, 1, topD * 0.38);
  roof2.castShadow = true;
  g.add(roof2);
  addCylinder(g, 0.12, 0.12, 1.8, 6, MATS.gold, 0, y + 5.0, 0);
  // 正脊
  addBox(g, topW * 0.5, 0.4, 0.5, MATS.roofDark, 0, y + 4.2, 0, false);

  // 匾额
  addSign(g, "镇海楼", 0, y - 2.1, topD / 2 + 0.12, 1, 3.8, 1.0, false);

  // 石狮（台阶下两侧）
  [-13.5, 13.5].forEach(function (sx) {
    const ly = BASE_Y + heightAt(24 + sx, -0.4) - TOWER_BASE;
    addBox(g, 1.2, 1.1, 1.2, MATS.stone, sx, ly + 0.55, 16.4, false);
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), MATS.stone);
    body.position.set(sx, ly + 1.4, 16.4);
    body.scale.set(1, 0.9, 1.2);
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), MATS.stone);
    head.position.set(sx, ly + 1.95, 16.8);
    head.castShadow = true;
    g.add(head);
  });

  // 成排古炮（不写数量，放在楼前平台）
  [-14, -4.7, 4.7, 14].forEach(function (sx) {
    const cy = 1.55;
    addBox(g, 1.2, 0.5, 0.8, MATS.woodDark, sx, cy, -5.6, false);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.0, 8), MATS.iron);
    barrel.position.set(sx, cy + 0.3, -5.6);
    barrel.rotation.x = Math.PI / 2;
    barrel.castShadow = true;
    g.add(barrel);
  });

  parent.add(g);
}

/* ---------- 五羊仙庭牌坊 ---------- */

function addPaifang(parent) {
  const g = new THREE.Group();
  g.name = "wuyang-paifang";
  const x = -40;
  const z = 28;
  g.position.set(x, BASE_Y + heightAt(x, z), z);

  addBox(g, 14, 0.35, 3.2, MATS.stone, 0, 0.17, 0, false, true);
  [-5.6, -1.9, 1.9, 5.6].forEach(function (px) {
    addBox(g, 0.55, 5.4, 0.55, MATS.stone, px, 2.9, 0, false);
  });
  addBox(g, 12.4, 0.55, 0.9, MATS.stone, 0, 5.2, 0, false);
  addBox(g, 12.4, 0.4, 0.8, MATS.stone, 0, 4.0, 0, false);
  addBox(g, 13.0, 0.3, 2.0, MATS.roof, 0, 5.7, 0, false);
  [-6.3, 6.3].forEach(function (px) {
    const tip = addBox(g, 1.1, 0.35, 2.0, MATS.roof, px, 5.95, 0, false);
    tip.rotation.z = px > 0 ? -0.22 : 0.22;
  });
  addSign(g, "五羊仙庭", 0, 4.6, 0.5, 1, 3.4, 0.8, false);
  parent.add(g);
}

/* ---------- 路灯/石凳 ---------- */

function addFurniture(parent) {
  [
    [-2, 30], [-14, 18], [-26, 13], [12, 10], [22, 1]
  ].forEach(function (p) {
    const y = BASE_Y + heightAt(p[0], p[1]);
    addCylinder(parent, 0.08, 0.1, 3.2, 6, MATS.iron, p[0], y + 1.6, p[1]);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), MATS.lamp);
    lamp.position.set(p[0], y + 3.25, p[1]);
    parent.add(lamp);
  });
}

/* ---------- 材质/实例 ---------- */

let MATS = null;
let windowInstances = [];
let lanternInstances = [];

function createMaterials(textures) {
  return {
    stone: std({ map: textures.stone, color: 0xb0a794, roughness: 0.95 }),
    path: std({ map: textures.paving, color: 0xc0b6a4, roughness: 0.98 }),
    granite: std({ color: 0x9a8f7a, roughness: 0.95, flatShading: true }),
    graniteDark: std({ color: 0x6f6454, roughness: 0.95, flatShading: true }),
    rock: std({ color: 0x3f382e, roughness: 0.96, flatShading: true }),
    eye: std({ color: 0x2a1f18, roughness: 0.7 }),
    brickWall: std({ map: textures.brickWall, roughness: 0.94 }),
    sandstone: std({ map: textures.sandstone, roughness: 0.94 }),
    redWall: std({ map: textures.redWall, roughness: 0.9 }),
    redDark: std({ color: 0x6f241b, roughness: 0.85 }),
    trim: std({ color: 0xd6c8ae, roughness: 0.92 }),
    roof: std({ map: textures.roof, roughness: 0.8 }),
    roofDark: std({ color: 0x183527, roughness: 0.82 }),
    woodDark: std({ color: 0x3a241a, roughness: 0.82 }),
    iron: std({ color: 0x24282a, roughness: 0.6, metalness: 0.4 }),
    gold: std({ color: 0xb08d57, roughness: 0.35, metalness: 0.55 }),
    lamp: std({ color: 0xfff2c9, emissive: 0x9a6a1e, emissiveIntensity: 0.5, roughness: 0.4 }),
    foliage: std({ color: 0x1f3a1c, roughness: 0.95, flatShading: true }),
    foliage2: std({ color: 0x2f4a26, roughness: 0.95, flatShading: true }),
    trunk: std({ color: 0x4e3a2b, roughness: 0.95 }),
    root: std({ color: 0x4f3f2e, roughness: 0.98 })
  };
}

function buildInstances(parent) {
  if (windowInstances.length) {
    const geo = new THREE.BoxGeometry(2.6, 2.4, 0.14);
    const mesh = new THREE.InstancedMesh(geo, MATS.window || MATS.trim, windowInstances.length);
    const dummy = new THREE.Object3D();
    windowInstances.forEach(function (p, i) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rot || 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    parent.add(mesh);
  }
  if (lanternInstances.length) {
    const geo = new THREE.SphereGeometry(0.34, 8, 6);
    const mesh = new THREE.InstancedMesh(geo, MATS.lantern, lanternInstances.length);
    const dummy = new THREE.Object3D();
    lanternInstances.forEach(function (p, i) {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(1, 1.2, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  }
}

/* ---------- 入口 ---------- */

export function create() {
  seed = 1960;
  windowInstances = [];
  lanternInstances = [];

  const textures = {
    stone: makeStone("#9a8f7c", "60,52,42"),
    paving: makePaving(),
    brickWall: makeBrick("#3f4f4b", "#65736d", 58, 22),
    sandstone: makeBrick("#8a4434", "#a86a54", 70, 26),
    redWall: makeRedWall(),
    roof: makeRoof(),
    window: makeLattice()
  };
  MATS = createMaterials(textures);
  MATS.window = std({ map: textures.window, roughness: 0.55 });
  MATS.lantern = std({ color: 0x8f1a10, emissive: 0x3a0704, emissiveIntensity: 0.25, roughness: 0.72 });

  const root = new THREE.Group();
  root.name = "yuexiu-park-model";

  // 展柜底座
  addBox(root, SITE_W, BASE_Y, SITE_D, MATS.stone, 0, BASE_Y / 2, 0, false, true);

  // 山体
  root.add(buildTerrain());
  root.add(buildSkirt());

  // 路径
  addPath(root, [[2, 38], [3, 30], [-4, 22], [-16, 16], [-27, 12]], 5.5);
  addPath(root, [[3, 30], [10, 20], [16, 10], [21, 2], [24, -2]], 5.5);
  addPath(root, [[-40, 34], [-38, 29], [-31, 20], [-24, 14]], 4.5);

  addWuyang(root);
  addPaifang(root);
  addWall(root);
  addZhenhaiTower(root);
  addTreeInstances(root);
  addOutcrops(root);
  addFurniture(root);
  buildInstances(root);

  const anchors = {
    wuyang: new THREE.Vector3(-32, BASE_Y + heightAt(-32, 11) + 9.0, 11),
    wall: new THREE.Vector3(-8, 17.5, -16),
    zhenhai: new THREE.Vector3(24, 30.5, WALL_Z),
    park: new THREE.Vector3(0, BASE_Y + 4.5, 18),
    detail: new THREE.Vector3(-32, BASE_Y + heightAt(-32, 11) + 8.2, 11)
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
