/*
 * 南越王博物院 · 王墓展区 · 风格化遗址博物馆场地（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：解放北路石阙正立面—综合陈列楼—象岗山台地/44 级蹬道—覆斗形墓室光棚—主体陈列楼/玉圭门阙。
 * 不是 9,668㎡ 王墓展区 1:1，也不是王宫展区。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 120;
const SITE_D = 80;
const BASE_Y = 0.9;
const GROUND_Y = 1.02;
const TERRACE_1 = 5.0;   // 入口台地 / 综合陈列楼
const TERRACE_2 = 9.5;   // 山腰台地 / 蹬道休息平台
const TERRACE_3 = 14.0;  // 岗顶墓室台地
const FACADE_X = 37.0;   // 石阙正立面（朝 +X / 解放北路）
const FACADE_W = 36.0;   // 总宽约 35m
const FACADE_H = 13.0;   // 石壁高约 12m，另加压顶
const HILL_EAST = 8.0;   // 下层台地西缘
const HILL_MID = -2.0;   // 中层台地西缘
const HILL_WEST = -50.0;
const TOMB_X = -28.0;
const TOMB_Z = 0.0;
const HALL_X = -28.0;
const HALL_Z = -28.0;
const GRAND_STAIR_Z = 24.0;
const STAIR_TOP_X = -10.0;

let seed = 1983;
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

function makeSandstone() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#6a2f23";
  ctx.fillRect(0, 0, 512, 512);
  // 每块石头略有色差，避免整面读成一块塑料板
  for (let y = 0; y < 512; y += 96) {
    const off = (y / 96) % 2 ? 96 : 0;
    for (let x = off; x < 512 + off; x += 192) {
      ctx.fillStyle = "rgba(" + Math.floor(range(84, 128)) + "," + Math.floor(range(40, 62)) + "," + Math.floor(range(28, 44)) + ",0.18)";
      ctx.fillRect(x - 190, y + 1, 188, 94);
    }
  }
  // 砂岩颗粒与渗色
  for (let i = 0; i < 2200; i++) {
    const v = random() > 0.48 ? "rgba(38,15,11,0.2)" : "rgba(198,132,92,0.13)";
    ctx.fillStyle = v;
    ctx.fillRect(random() * 512, random() * 512, range(1, 5), range(1, 4));
  }
  // 水平石缝 + 错缝竖缝
  for (let y = 0; y < 512; y += 96) {
    ctx.fillStyle = "rgba(28,10,8,0.62)";
    ctx.fillRect(0, y, 512, 4);
    ctx.fillStyle = "rgba(214,148,108,0.22)";
    ctx.fillRect(0, y + 4, 512, 1);
    const off = (y / 96) % 2 ? 96 : 0;
    for (let x = off; x < 512; x += 192) {
      ctx.fillStyle = "rgba(28,10,8,0.52)";
      ctx.fillRect(x, y, 3, 96);
    }
  }
  // 水渍/风化，避免整面墙太新
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = "rgba(30,12,9," + range(0.03, 0.09).toFixed(3) + ")";
    const x = random() * 512;
    const y = random() * 512;
    ctx.fillRect(x, y, range(18, 70), range(2, 8));
  }
  return colorTexture(c, 1, 1);
}

function makePaving() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#a89b88";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 128) {
      const off = (y / 64) % 2 ? 64 : 0;
      const v = 158 + Math.floor(random() * 22);
      ctx.fillStyle = "rgb(" + v + "," + (v - 5) + "," + (v - 16) + ")";
      ctx.fillRect(x + off + 2, y + 2, 124, 60);
    }
  }
  return colorTexture(c, 2, 2);
}

function makeLawn() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3f5a2e";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const v = random() > 0.5 ? "rgba(24,42,18,0.24)" : "rgba(116,146,82,0.17)";
    ctx.fillStyle = v;
    ctx.fillRect(random() * 256, random() * 256, range(1, 3), range(1, 4));
  }
  return colorTexture(c, 8, 6);
}

function makeSlotGlass() {
  const c = makeCanvas(160, 640);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 640);
  grad.addColorStop(0, "#1b3433");
  grad.addColorStop(0.45, "#2b5550");
  grad.addColorStop(1, "#17302e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 160, 640);
  // 玻璃反射：树影和天光，保持暗绿而不是薄荷绿
  ctx.fillStyle = "rgba(94,132,110,0.18)";
  ctx.fillRect(18, 90, 30, 300);
  ctx.fillRect(92, 60, 18, 380);
  ctx.fillStyle = "rgba(12,26,25,0.42)";
  ctx.beginPath();
  ctx.ellipse(52, 410, 54, 120, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(128, 450, 42, 90, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(176,198,178,0.09)";
  ctx.fillRect(0, 0, 160, 70);
  return colorTexture(c, 1, 1);
}

function makeMuseumName() {
  const c = makeCanvas(1024, 192);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 1024, 192);
  ctx.font = '700 132px "STKaiti","KaiTi","SimSun","Noto Serif SC",serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(236,198,148,0.3)";
  ctx.fillText("南越王博物院", 512, 104);
  ctx.fillStyle = "#2a1710";
  ctx.fillText("南越王博物院", 512, 100);
  return colorTexture(c, 1, 1);
}

function makeShipFrieze() {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#743123";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "rgba(222,190,146,0.66)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  // 船身
  ctx.beginPath();
  ctx.moveTo(86, 78);
  ctx.quadraticCurveTo(250, 126, 420, 74);
  ctx.lineTo(392, 96);
  ctx.quadraticCurveTo(250, 120, 112, 96);
  ctx.closePath();
  ctx.stroke();
  // 桅杆与帆
  ctx.beginPath();
  ctx.moveTo(252, 80);
  ctx.lineTo(252, 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(258, 28);
  ctx.quadraticCurveTo(330, 46, 348, 76);
  ctx.lineTo(258, 76);
  ctx.closePath();
  ctx.stroke();
  // 水纹
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(24, 104 + i * 6);
    ctx.bezierCurveTo(120, 94 + i * 6, 190, 114 + i * 6, 276, 102 + i * 6);
    ctx.bezierCurveTo(350, 92 + i * 6, 430, 110 + i * 6, 494, 100 + i * 6);
    ctx.stroke();
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

function addBeam(parent, a, b, t, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.01) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addQuad(parent, a, b, c, d, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
    a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z
  ]), 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addTri(parent, a, b, c, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z
  ]), 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, points, radius, mat, segments) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments || 16, radius, 6, false), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function terrainY(x, z) {
  // 44 级蹬道所在的山坳：z 19–29 为连续的坡道，其余台地保持水平
  if (z > 19 && z < 29) {
    if (x >= HILL_EAST) return TERRACE_1;
    if (x >= 0) return TERRACE_1 + (HILL_EAST - x) / HILL_EAST * (TERRACE_2 - TERRACE_1);
    if (x >= HILL_MID) return TERRACE_2;
    if (x >= STAIR_TOP_X) return TERRACE_2 + (HILL_MID - x) / (HILL_MID - STAIR_TOP_X) * (TERRACE_3 - TERRACE_2);
    return TERRACE_3;
  }
  if (x >= HILL_EAST) return TERRACE_1;
  if (x >= HILL_MID) return TERRACE_2;
  return TERRACE_3;
}

function heightAt(x, z) {
  if (x >= 47) return GROUND_Y;
  return terrainY(x, typeof z === "number" ? z : 0);
}

/* ---------- 底座、街道 ---------- */

function addBase(root) {
  addBox(root, SITE_W, BASE_Y - 0.16, SITE_D, MATS.base, 0, (BASE_Y - 0.16) / 2, 0, false, true);
  addBox(root, SITE_W - 0.6, 0.16, SITE_D - 0.6, MATS.earth, 0, BASE_Y - 0.08, 0, false, true);
  addBox(root, SITE_W - 1.6, 0.1, SITE_D - 1.6, MATS.lawn, 0, BASE_Y + 0.02, 0, false, true);
  const rimY = BASE_Y + 0.03;
  addBox(root, SITE_W, 0.14, 1.0, MATS.cream, 0, rimY, SITE_D / 2 - 0.5, false, true);
  addBox(root, SITE_W, 0.14, 1.0, MATS.cream, 0, rimY, -SITE_D / 2 + 0.5, false, true);
  addBox(root, 1.0, 0.14, SITE_D, MATS.cream, SITE_W / 2 - 0.5, rimY, 0, false, true);
  addBox(root, 1.0, 0.14, SITE_D, MATS.cream, -SITE_W / 2 + 0.5, rimY, 0, false, true);
}

function addStreet(root) {
  // 解放北路在 +X 一侧；人行道、路缘、车行道
  addBox(root, 6, 0.08, SITE_D - 2, MATS.asphalt, 57, GROUND_Y + 0.04, 0, false, true);
  addBox(root, 7, 0.1, SITE_D - 2, MATS.paving, 50.5, GROUND_Y + 0.05, 0, false, true);
  addBox(root, 0.5, 0.24, SITE_D - 2, MATS.cream, 54, GROUND_Y + 0.12, 0, false, true);
  const dashes = [];
  for (let z = -34; z <= 34; z += 8) dashes.push(z);
  addInstances(root, new THREE.BoxGeometry(0.18, 0.02, 2.6), MATS.lane, dashes, function (d, z) {
    d.position.set(57, GROUND_Y + 0.1, z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
  // 斑马线，给临街机位一点城市尺度
  const zebra = [];
  for (let z = -8; z <= 8; z += 2.6) zebra.push({ z: z });
  addInstances(root, new THREE.BoxGeometry(5.4, 0.02, 1.1), MATS.lane, zebra, function (d, e) {
    d.position.set(57, GROUND_Y + 0.105, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
}

/* ---------- 象岗山台地 ---------- */

function addTerraces(root) {
  const geo = new THREE.PlaneGeometry(97, 76, 64, 44);
  geo.rotateX(-Math.PI / 2);
  geo.translate((HILL_WEST + 47) / 2, 0, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainY(pos.getX(i), pos.getZ(i)));
  }
  // 入口凹槽：把台地表面在入口台阶/侧梯处挖下去，避免草皮盖住台阶
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (x > 41.2 && z > -6.4 && z < 11.7) pos.setY(i, GROUND_Y);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const hill = new THREE.Mesh(geo, MATS.hill);
  hill.receiveShadow = true;
  hill.castShadow = false;
  root.add(hill);

  // 台地边缘挡墙：x=8 与 x=-2，避开支沟
  [
    { x: HILL_EAST, top: TERRACE_2, bottom: TERRACE_1 },
    { x: HILL_MID, top: TERRACE_3, bottom: TERRACE_2 }
  ].forEach(function (wall) {
    [
      { z0: -38, z1: 19 },
      { z0: 29, z1: 38 }
    ].forEach(function (seg) {
      const len = seg.z1 - seg.z0;
      const zc = (seg.z0 + seg.z1) / 2;
      addBox(root, 1.5, wall.top - wall.bottom + 0.6, len, MATS.terraceStone, wall.x, (wall.top + wall.bottom) / 2, zc);
      addBox(root, 2.0, 0.3, len, MATS.sandstoneDark, wall.x, wall.top + 0.15, zc, false);
      // 墙脚阴影
      addBox(root, 0.12, 0.7, len - 0.4, MATS.groove, wall.x + 0.78, wall.bottom + 0.35, zc, false, false);
    });
  });

  // 山体周边裙墙：让台地读成被切开的岗地，而不是漂浮的草坪
  [
    { z: 38, x0: HILL_WEST, x1: 47, top: function (x) { return terrainY(x, 38); } },
    { z: -38, x0: HILL_WEST, x1: 47, top: function (x) { return terrainY(x, -38); } }
  ].forEach(function (edge) {
    const segs = [
      { x0: HILL_WEST, x1: HILL_MID, top: TERRACE_3 },
      { x0: HILL_MID, x1: HILL_EAST, top: TERRACE_2 },
      { x0: HILL_EAST, x1: 47, top: TERRACE_1 }
    ];
    segs.forEach(function (s) {
      const len = s.x1 - s.x0;
      const xc = (s.x0 + s.x1) / 2;
      const h = s.top - BASE_Y + 0.5;
      addBox(root, len, h, 1.4, MATS.terraceStone, xc, BASE_Y - 0.5 + h / 2, edge.z, false, true);
      addBox(root, len, 0.26, 1.8, MATS.sandstoneDark, xc, s.top + 0.12, edge.z, false, true);
    });
  });
  // 西侧切面
  addBox(root, 1.4, TERRACE_3 - BASE_Y + 0.5, 76, MATS.terraceStone, HILL_WEST, BASE_Y - 0.5 + (TERRACE_3 - BASE_Y + 0.5) / 2, 0, false, true);
  addBox(root, 1.8, 0.26, 76, MATS.sandstoneDark, HILL_WEST, TERRACE_3 + 0.12, 0, false, true);

  // 裙墙上的浅扶壁，避免整面像挡土板
  [-30, -16, 12, 28, 40].forEach(function (x) {
    const top = terrainY(x, 38);
    addBox(root, 0.7, top - BASE_Y, 1.7, MATS.sandstoneDark, x, BASE_Y + (top - BASE_Y) / 2, 38, false, true);
  });

  // 建筑南侧上山步道：从入口台地绕到 44 级蹬道
  addBox(root, 29, 0.12, 6, MATS.paving, 22.5, TERRACE_1 + 0.05, 24, false, true);
  // 岗顶步道：蹬道顶 → 墓室南入口
  addBox(root, 20, 0.12, 4.2, MATS.paving, -18, TERRACE_3 + 0.05, 24, false, true);
  addBox(root, 4.2, 0.12, 8, MATS.paving, -28, TERRACE_3 + 0.05, 20, false, true);
  addBanks(root);
}

function addStair(root, x0, x1, width, topY, bottomY, steps, z) {
  const rise = (topY - bottomY) / steps;
  const run = Math.abs(x1 - x0) / steps;
  const dir = x1 > x0 ? 1 : -1;
  for (let i = 0; i < steps; i++) {
    const x = x0 + dir * (i * run + run / 2);
    const y = bottomY + (i + 1) * rise;
    addBox(root, run + 0.06, rise, width, MATS.paving, x, y - rise / 2 + 0.02, z, false, true);
  }
  [1, -1].forEach(function (side) {
    addBox(root, Math.abs(x1 - x0) + 0.4, 0.55, 0.55, MATS.sandstoneDark, (x0 + x1) / 2, topY + 0.2, z + side * (width / 2 + 0.2), false);
  });
}

function addGrandStair(root, x0, x1, width, topY, bottomY, steps, z) {
  const rise = (topY - bottomY) / steps;
  const run = Math.abs(x1 - x0) / steps;
  const dir = x1 > x0 ? 1 : -1;
  const entries = [];
  for (let i = 0; i < steps; i++) {
    entries.push({
      x: x0 + dir * (i * run + run / 2),
      y: bottomY + (i + 1) * rise
    });
  }
  addInstances(root, new THREE.BoxGeometry(run + 0.06, rise + 0.02, width), MATS.paving, entries, function (d, e) {
    d.position.set(e.x, e.y - rise / 2, z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });

  const runLen = Math.abs(x1 - x0);
  const slope = Math.atan2(topY - bottomY, x1 - x0);
  const len = Math.sqrt(runLen * runLen + (topY - bottomY) * (topY - bottomY));
  [1, -1].forEach(function (side) {
    const zz = z + side * (width / 2 + 0.45);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 1.35, 0.9), MATS.sandstone);
    wall.position.set((x0 + x1) / 2, (topY + bottomY) / 2 + 0.6, zz);
    wall.rotation.z = slope;
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.5, 0.2, 1.05), MATS.sandstoneDark);
    cap.position.set((x0 + x1) / 2, (topY + bottomY) / 2 + 1.34, zz);
    cap.rotation.z = slope;
    cap.castShadow = true;
    root.add(cap);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), MATS.metal);
    rail.position.set((x0 + x1) / 2, (topY + bottomY) / 2 + 1.58, zz);
    rail.rotation.z = slope;
    rail.castShadow = true;
    root.add(rail);
  });
  // 台阶下的实体斜撑，避免侧面看空
  [1, -1].forEach(function (side) {
    const zz = z + side * (width / 2 + 0.9);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.6), MATS.terraceStone);
    fill.position.set((x0 + x1) / 2, (topY + bottomY) / 2 - 0.55, zz);
    fill.rotation.z = slope;
    fill.receiveShadow = true;
    root.add(fill);
  });
}

function addBanks(root) {
  // 南侧草坡压住挡土墙，避免临街/总览读成一圈红砂岩城墙
  [
    { x0: -50, x1: -2, top: TERRACE_3, run: 7.0 },
    { x0: -2, x1: 8, top: TERRACE_2, run: 5.0 },
    { x0: 8, x1: 47, top: TERRACE_1, run: 3.5 }
  ].forEach(function (s) {
    const base = BASE_Y + 0.12;
    const depth = Math.sqrt(s.run * s.run + (s.top - base) * (s.top - base));
    const angle = Math.atan2(s.top - base, s.run);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0 + 0.8, 0.5, depth), MATS.lawn);
    bank.position.set((s.x0 + s.x1) / 2, (base + s.top) / 2, 39.3 - s.run / 2);
    bank.rotation.x = angle;
    bank.castShadow = false;
    bank.receiveShadow = true;
    root.add(bank);
  });
}

function addHillStair(root) {
  // 44 级蹬道：两段各 22 级，中间 2m 休息平台
  addGrandStair(root, HILL_EAST, 0, 9.0, TERRACE_2, TERRACE_1, 22, GRAND_STAIR_Z);
  addGrandStair(root, HILL_MID, STAIR_TOP_X, 9.0, TERRACE_3, TERRACE_2, 22, GRAND_STAIR_Z);
  addBox(root, 2.2, 0.14, 10.2, MATS.paving, -1, TERRACE_2 + 0.07, GRAND_STAIR_Z, false, true);
  // 蹬道两侧的休息平台/观景台
  [1, -1].forEach(function (side) {
    addBox(root, 4.4, 0.14, 4.2, MATS.paving, 0.2, TERRACE_2 + 0.07, GRAND_STAIR_Z + side * 7.6, false, true);
    addBox(root, 4.8, 0.3, 0.5, MATS.sandstoneDark, 0.2, TERRACE_2 + 0.22, GRAND_STAIR_Z + side * 9.6, false);
  });
}

/* ---------- 石阙正立面 / 综合陈列楼 ---------- */

function addFacade(root) {
  const g = new THREE.Group();
  g.name = "nanyue-gate";
  g.position.set(0, TERRACE_1, 0);

  // 综合陈列楼主体（石阙后面的三层体量，略低于石壁，避免屋顶压过正立面）
  const BODY_H = 11.5;
  addBox(g, 11.8, BODY_H, FACADE_W, MATS.bodyStone, 28.8, BODY_H / 2, 0);
  addBox(g, 14.2, 0.5, FACADE_W + 1.2, MATS.sandstoneDark, 30.2, BODY_H + 0.25, 0, false);
  addBox(g, 11.2, 0.08, FACADE_W - 0.6, MATS.dark, 28.8, BODY_H + 0.05, 0, false, false);

  // 屋顶天窗带：低平，不再从石壁上方冒出半圆拱
  addBox(g, 7.0, 0.16, 18.0, MATS.glassDark, 27.8, BODY_H + 0.16, 0, false, false);
  addBox(g, 0.16, 0.2, 18.2, MATS.metal, 31.2, BODY_H + 0.22, 0, false, false);
  addBox(g, 0.16, 0.2, 18.2, MATS.metal, 24.4, BODY_H + 0.22, 0, false, false);

  // 石阙正立面：36m 宽 × 13m 高，中间开 2.6m 一线缝 + 半圆拱
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-FACADE_W / 2, 0);
  wallShape.lineTo(FACADE_W / 2, 0);
  wallShape.lineTo(FACADE_W / 2, FACADE_H);
  wallShape.lineTo(-FACADE_W / 2, FACADE_H);
  wallShape.closePath();
  const slotHalf = 1.3;
  const archSpring = 10.9;
  const hole = new THREE.Path();
  hole.moveTo(-slotHalf, 0);
  hole.lineTo(-slotHalf, archSpring);
  hole.absarc(0, archSpring, slotHalf, Math.PI, 0, true);
  hole.lineTo(slotHalf, 0);
  hole.closePath();
  wallShape.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 2.4, bevelEnabled: false, curveSegments: 16 });
  const wall = new THREE.Mesh(wallGeo, MATS.facadeStone);
  wall.position.set(34.6, 0, 0);
  wall.rotation.y = Math.PI / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);

  // 真实石缝：横向 courses + 错缝竖缝，补足贴图在远景里读不出的砌块感
  const jointMat = MATS.groove;
  const courseH = 0.62;
  const hEntries = [];
  for (let y = 0.58; y < FACADE_H - 0.2; y += courseH) {
    hEntries.push({ y: y, z0: -FACADE_W / 2, z1: -1.65 });
    hEntries.push({ y: y, z0: 1.65, z1: FACADE_W / 2 });
  }
  addInstances(g, new THREE.BoxGeometry(0.05, 0.028, 1), jointMat, hEntries, function (d, e) {
    d.position.set(37.02, e.y, (e.z0 + e.z1) / 2);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, e.z1 - e.z0);
  }, false);
  const vEntries = [];
  for (let row = 0; row * courseH < FACADE_H - courseH; row++) {
    const y0 = 0.58 + row * courseH;
    const off = row % 2 ? 0.55 : 0;
    for (let z = -FACADE_W / 2 + off; z < FACADE_W / 2; z += 1.1) {
      if (Math.abs(z) < 1.8) continue;
      vEntries.push({ y: y0 + courseH / 2, z: z });
    }
  }
  addInstances(g, new THREE.BoxGeometry(0.05, courseH - 0.07, 0.035), jointMat, vEntries, function (d, e) {
    d.position.set(37.02, e.y, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);

  // 墙脚与两侧收边
  addBox(g, 0.5, 0.55, FACADE_W + 0.3, MATS.sandstoneDark, 36.95, 0.27, 0, false);

  // 石阙前的入口台地：临街 x=47，中央凹槽内收 5.5m 放台阶和门额
  // 北翼、南翼与中央门额墙背后的实体都从 x=34.7 延伸到 x=47
  addBox(g, 12.3, 4.0, 7.5, MATS.terraceStone, 40.85, -2.0, 15.25, false, true);
  addBox(g, 12.3, 4.0, 13.0, MATS.terraceStone, 40.85, -2.0, -12.5, false, true);
  addBox(g, 6.8, 4.0, 12.0, MATS.terraceStone, 38.1, -2.0, 0, false, true);

  // 台地铺装
  addBox(g, 12.0, 0.1, 7.3, MATS.paving, 40.85, 0.05, 15.25, false, true);
  addBox(g, 12.0, 0.1, 12.8, MATS.paving, 40.85, 0.05, -12.5, false, true);
  addBox(g, 6.6, 0.1, 11.8, MATS.paving, 38.1, 0.05, 0, false, true);

  // 中央入口：8 级大台阶 → 2.3m 平台 → 门额墙
  const entranceSteps = 8;
  const landY = 2.3;
  const stepRise = (landY - GROUND_Y) / entranceSteps;
  const stepRun = 4.0 / entranceSteps;
  const stepEntries = [];
  for (let i = 0; i < entranceSteps; i++) {
    const top = GROUND_Y + (i + 1) * stepRise;
    stepEntries.push({ x: 47 - i * stepRun - stepRun / 2, h: top - GROUND_Y });
  }
  addInstances(g, new THREE.BoxGeometry(stepRun + 0.08, 1, 11.6), MATS.paving, stepEntries, function (d, e) {
    d.position.set(e.x, GROUND_Y + e.h / 2, 0);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, e.h, 1);
  }, false);
  // 中央台阶两侧的低矮石栏与金属扶手
  const stairAngle = Math.atan2(landY - GROUND_Y, 4.0);
  const stairLen = Math.sqrt(16 + (landY - GROUND_Y) * (landY - GROUND_Y));
  [-5.65, 5.65].forEach(function (z) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(stairLen, 0.8, 0.32), MATS.sandstone);
    cheek.position.set(45, (GROUND_Y + landY) / 2 + 0.32, z);
    cheek.rotation.z = -stairAngle;
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    g.add(cheek);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(stairLen, 0.08, 0.08), MATS.metal);
    rail.position.set(45, (GROUND_Y + landY) / 2 + 1.02, z);
    rail.rotation.z = -stairAngle;
    rail.castShadow = true;
    g.add(rail);
  });
  // 2.3m 平台与支撑
  addBox(g, 1.6, 0.14, 11.6, MATS.paving, 42.25, 2.23, 0, false, true);
  addBox(g, 1.6, 1.28, 11.6, MATS.terraceStone, 42.25, 1.66, 0, false, true);

  // 门额：“南越王博物院”，刻在凹槽尽端的红砂岩墙上
  const namePlane = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 1.34), MATS.museumName);
  namePlane.position.set(41.57, 3.68, 0);
  namePlane.rotation.y = Math.PI / 2;
  namePlane.castShadow = false;
  namePlane.receiveShadow = false;
  g.add(namePlane);
  [-5.7, 5.7].forEach(function (z) {
    addBox(g, 0.35, 2.7, 0.5, MATS.sandstoneDark, 41.55, 3.65, z, false);
  });

  // 底层入口：深门洞、玻璃门、门框、雨棚
  addBox(g, 1.1, 3.7, 4.4, MATS.dark, 36.6, 1.85, 0, false, false);
  addBox(g, 0.16, 3.5, 3.8, MATS.entranceGlass, 37.18, 1.8, 0, false, false);
  [-2.3, 2.3].forEach(function (z) {
    addBox(g, 0.5, 3.9, 0.28, MATS.sandstoneDark, 37.08, 1.85, z, false);
  });
  addBox(g, 0.5, 0.3, 4.9, MATS.sandstoneDark, 37.08, 3.85, 0, false);
  addBox(g, 1.8, 0.16, 5.2, MATS.metal, 37.9, 3.98, 0, false, false);

  // 一线天玻璃：深色茶玻璃 + 竖向/横向金属分格
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-slotHalf + 0.05, 0.1);
  glassShape.lineTo(-slotHalf + 0.05, archSpring);
  glassShape.absarc(0, archSpring, slotHalf - 0.05, Math.PI, 0, true);
  glassShape.lineTo(slotHalf - 0.05, 0.1);
  glassShape.closePath();
  const glassGeo = new THREE.ShapeGeometry(glassShape, 18);
  const glass = new THREE.Mesh(glassGeo, MATS.slotGlass);
  glass.position.set(36.25, 0.1, 0);
  glass.rotation.y = Math.PI / 2;
  glass.castShadow = false;
  g.add(glass);
  // 玻璃后面的深色背板
  addBox(g, 0.4, 13.2, 2.8, MATS.dark, 34.9, 6.6, 0, false, false);
  // 横向分格
  const mullions = [];
  for (let y = 2.2; y < 11.6; y += 2.2) mullions.push({ y: y });
  addInstances(g, new THREE.BoxGeometry(0.16, 0.13, 2.62), MATS.metal, mullions, function (d, m) {
    d.position.set(36.08, m.y, 0);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
  addBox(g, 0.18, 12.2, 0.14, MATS.metal, 36.08, 6.1, 0, false, false);
  // 拱顶铜饰：圆环 + 蟠龙
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.13, 8, 28), MATS.bronze);
  ring.position.set(36.55, archSpring, 0);
  ring.rotation.y = Math.PI / 2;
  ring.castShadow = true;
  g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 28), MATS.bronzeDark);
  disc.position.set(36.52, archSpring, 0);
  disc.rotation.y = Math.PI / 2;
  g.add(disc);
  addTube(g, [
    new THREE.Vector3(36.66, archSpring + 0.55, -0.55),
    new THREE.Vector3(36.7, archSpring + 0.1, 0.1),
    new THREE.Vector3(36.66, archSpring - 0.5, 0.35),
    new THREE.Vector3(36.68, archSpring - 0.15, -0.35),
    new THREE.Vector3(36.66, archSpring + 0.35, -0.2)
  ], 0.09, MATS.bronze, 24);
  const dragonHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), MATS.bronze);
  dragonHead.position.set(36.66, archSpring + 0.55, -0.55);
  g.add(dragonHead);
  // 拱券石边
  const arch = new THREE.Mesh(new THREE.TorusGeometry(slotHalf + 0.22, 0.18, 8, 24, Math.PI), MATS.sandstoneLight);
  arch.position.set(36.95, archSpring, 0);
  arch.rotation.y = Math.PI / 2;
  arch.castShadow = true;
  g.add(arch);
  // 缝两侧竖石框
  [-1.55, 1.55].forEach(function (z) {
    addBox(g, 0.42, 11.6, 0.32, MATS.sandstoneLight, 36.94, 5.8, z, false);
  });

  // 男女越人浮雕：直接雕在石壁上，不做画框（面朝街道时男像在左/南侧，女像在右/北侧）
  addRelief(g, 9.15, 0);
  addRelief(g, -9.15, 1);

  root.add(g);
}

/* ---------- 8m 越人浅浮雕（3D 低浮雕） ---------- */

function addRelief(parent, zc, variant) {
  const host = parent;
  parent = new THREE.Group();
  parent.position.y = -4.0;
  host.add(parent);
  const x0 = 37.02;
  const stone = MATS.reliefStone;
  const dark = MATS.reliefDark;

  function rb(w, h, d, x, y, z, rx, ry, rz, mat) {
    const ww = w * 1.9;
    const m = addBox(parent, ww, h, d, mat || stone, x + ww * 0.38, y, z, true, false);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    return m;
  }

  // 头顶日月：男像日轮，女像月牙
  if (variant === 0) {
    const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.22, 24), stone);
    sun.position.set(x0 + 0.32, 11.55, zc);
    sun.rotation.z = Math.PI / 2;
    sun.castShadow = true;
    parent.add(sun);
    const sunCore = new THREE.Mesh(new THREE.CircleGeometry(0.44, 20), dark);
    sunCore.position.set(x0 + 0.44, 11.55, zc);
    sunCore.rotation.y = Math.PI / 2;
    parent.add(sunCore);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const ray = rb(0.1, 0.62, 0.1, x0 + 0.06, 11.55 + Math.sin(a) * 1.18, zc + Math.cos(a) * 1.18, a, 0, 0);
      ray.castShadow = true;
    }
    // 日中三足乌的简化刻纹
    rb(0.08, 0.24, 0.58, x0 + 0.5, 11.55, zc, 0, 0, 0, dark);
  } else {
    const moon = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.22, 7, 20, Math.PI * 1.25), stone);
    moon.position.set(x0 + 0.18, 11.5, zc);
    moon.rotation.y = Math.PI / 2;
    moon.rotation.z = -0.7;
    moon.castShadow = true;
    parent.add(moon);
    // 星
    rb(0.1, 0.34, 0.1, x0 + 0.07, 12.45, zc + 1.0, 0, 0, 0.4);
    rb(0.1, 0.34, 0.1, x0 + 0.07, 12.45, zc + 1.0, 0, 0, -0.4);
    // 云纹
    [zc - 1.5, zc + 1.6].forEach(function (z) {
      const cloud = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 6, 14, Math.PI * 1.5), stone);
      cloud.position.set(x0 + 0.05, 11.15, z);
      cloud.rotation.y = Math.PI / 2;
      parent.add(cloud);
    });
  }

  // 头、颈、冠
  const neck = addCylinder(parent, 0.26, 0.32, 0.45, 8, stone, x0 + 0.2, 9.55, zc);
  neck.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 9, 7), stone);
  head.position.set(x0 + 0.22, 9.95, zc);
  head.scale.set(0.95, 1.08, 0.92);
  head.castShadow = true;
  parent.add(head);
  // 面部：浅刻鼻、眼、口
  rb(0.14, 0.26, 0.16, x0 + 0.5, 9.9, zc);
  [-0.16, 0.16].forEach(function (dz) {
    rb(0.06, 0.07, 0.12, x0 + 0.5, 10.03, zc + dz, 0, 0, 0, dark);
  });
  rb(0.06, 0.06, 0.2, x0 + 0.47, 9.76, zc, 0, 0, 0, dark);
  // 羽冠/发髻
  [-0.26, 0, 0.26].forEach(function (dz, i) {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55 + (i === 1 ? 0.18 : 0), 5), stone);
    feather.position.set(x0 + 0.08, 10.55 + (i === 1 ? 0.08 : 0), zc + dz);
    feather.rotation.z = -0.08;
    feather.castShadow = true;
    parent.add(feather);
  });
  rb(0.16, 0.1, 1.0, x0 + 0.08, 10.38, zc);

  // 长袍：上窄下宽，正面刻衣纹
  const robe = new THREE.Shape();
  robe.moveTo(-0.58, 0);
  robe.lineTo(0.58, 0);
  robe.lineTo(0.92, -3.0);
  robe.lineTo(-0.92, -3.0);
  robe.closePath();
  const robeGeo = new THREE.ExtrudeGeometry(robe, { depth: 0.42, bevelEnabled: false });
  const robeMesh = new THREE.Mesh(robeGeo, stone);
  robeMesh.position.set(x0 + 0.12, 9.35, zc);
  robeMesh.rotation.y = Math.PI / 2;
  robeMesh.castShadow = true;
  robeMesh.receiveShadow = true;
  parent.add(robeMesh);
  // 肩部：把头部、双臂和长袍连成完整人形
  rb(0.22, 0.42, 2.0, x0 + 0.2, 9.32, zc);
  rb(0.12, 0.18, 1.75, x0 + 0.24, 8.55, zc, 0, 0, 0, dark);
  [7.9, 7.35, 6.85].forEach(function (y, i) {
    rb(0.1, 0.07, 1.55 - i * 0.08, x0 + 0.24, y, zc, 0, 0, 0, stone);
  });
  // 双足踏蛇
  [-0.34, 0.34].forEach(function (dz) {
    rb(0.5, 0.2, 0.38, x0 + 0.16, 6.3, zc + dz);
  });

  // 双臂：一只持杖/持器，另一只下垂
  [-1, 1].forEach(function (side) {
    const arm = rb(0.26, 2.05, 0.28, x0 + 0.14, 8.35, zc + side * 0.78, side * 0.38, 0, 0);
    arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), stone);
    hand.position.set(x0 + 0.16, 7.4, zc + side * 1.16);
    hand.castShadow = true;
    parent.add(hand);
  });
  if (variant === 0) {
    // 男像持长杖/矛
    const staff = addCylinder(parent, 0.07, 0.08, 4.4, 6, stone, x0 + 0.18, 8.25, zc + 1.3);
    staff.castShadow = true;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 5), stone);
    tip.position.set(x0 + 0.18, 10.55, zc + 1.3);
    tip.castShadow = true;
    parent.add(tip);
  } else {
    // 女像捧器
    const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.55, 10), stone);
    vessel.position.set(x0 + 0.18, 7.25, zc - 1.05);
    vessel.castShadow = true;
    parent.add(vessel);
    // 飘带
    addTube(parent, [
      new THREE.Vector3(x0 + 0.2, 8.9, zc - 0.5),
      new THREE.Vector3(x0 + 0.24, 8.2, zc - 1.45),
      new THREE.Vector3(x0 + 0.2, 6.8, zc - 1.2),
      new THREE.Vector3(x0 + 0.16, 6.4, zc - 0.6)
    ], 0.08, stone, 12);
  }

  // 赤足下的蛇：横贯整幅浮雕
  addTube(parent, [
    new THREE.Vector3(x0 + 0.12, 5.95, zc - 3.7),
    new THREE.Vector3(x0 + 0.16, 5.78, zc - 2.3),
    new THREE.Vector3(x0 + 0.12, 6.12, zc - 0.9),
    new THREE.Vector3(x0 + 0.18, 5.82, zc + 0.6),
    new THREE.Vector3(x0 + 0.14, 6.08, zc + 2.2),
    new THREE.Vector3(x0 + 0.1, 5.88, zc + 3.5)
  ], 0.22, stone, 24);
  const snakeHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), stone);
  snakeHead.position.set(x0 + 0.2, 5.9, zc + 3.62);
  snakeHead.scale.set(1.1, 0.85, 1.0);
  snakeHead.castShadow = true;
  parent.add(snakeHead);
  [-0.12, 0.12].forEach(function (dz) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), dark);
    eye.position.set(x0 + 0.3, 5.98, zc + 3.62 + dz);
    parent.add(eye);
  });
  rb(0.06, 0.05, 0.5, x0 + 0.1, 5.82, zc + 3.95, 0, 0, 0, dark);

  // 底部水波纹，填满下缘但不做相框
  [5.55, 5.38].forEach(function (y) {
    addTube(parent, [
      new THREE.Vector3(x0 + 0.08, y, zc - 3.8),
      new THREE.Vector3(x0 + 0.12, y + 0.12, zc - 2.4),
      new THREE.Vector3(x0 + 0.08, y - 0.05, zc - 0.9),
      new THREE.Vector3(x0 + 0.12, y + 0.1, zc + 0.8),
      new THREE.Vector3(x0 + 0.08, y - 0.02, zc + 2.4),
      new THREE.Vector3(x0 + 0.1, y + 0.08, zc + 3.8)
    ], 0.06, stone, 20);
  });
}

/* ---------- 圆雕石虎 ---------- */

function addTiger(parent, x, z, baseY, scale) {
  const g = new THREE.Group();
  g.position.set(x, typeof baseY === "number" ? baseY : GROUND_Y, z);
  if (typeof scale === "number") g.scale.setScalar(scale);

  // 低矮基座
  addBox(g, 5.2, 0.55, 2.7, MATS.sandstoneDark, 0, 0.28, 0, false, true);
  addBox(g, 4.8, 0.16, 2.35, MATS.tigerStone, 0, 0.63, 0, false, true);

  // 伏卧的躯干：长轴沿 X，面向 +X
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), MATS.tigerStone);
  body.position.set(-0.35, 1.32, 0);
  body.scale.set(1.55, 0.82, 0.92);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.86, 9, 7), MATS.tigerStone);
  haunch.position.set(-1.45, 1.25, 0);
  haunch.scale.set(0.95, 1.0, 1.0);
  haunch.castShadow = true;
  g.add(haunch);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.7, 9, 7), MATS.tigerStone);
  chest.position.set(0.85, 1.42, 0);
  chest.scale.set(0.9, 1.05, 1.05);
  chest.castShadow = true;
  g.add(chest);

  // 前肢前伸，爪子抓地
  [0.45, -0.45].forEach(function (zz) {
    addBox(g, 1.1, 0.4, 0.42, MATS.tigerStone, 1.55, 0.95, zz, false);
    addBox(g, 0.62, 0.28, 0.52, MATS.tigerStone, 2.18, 0.78, zz, false);
    [0.4, 0.2, 0].forEach(function (dz) {
      addBox(g, 0.16, 0.1, 0.12, MATS.tigerDark, 2.48, 0.67, zz + dz - 0.2, false, false);
    });
  });
  // 后肢
  [0.55, -0.55].forEach(function (zz) {
    addBox(g, 0.8, 0.55, 0.45, MATS.tigerStone, -1.55, 0.9, zz, false);
  });

  // 大头颅：加宽额头和双颊，避免读成猪/狗
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), MATS.tigerStone);
  head.position.set(1.55, 2.1, 0);
  head.scale.set(1.05, 1.0, 1.08);
  head.castShadow = true;
  g.add(head);
  const muzzle = addBox(g, 0.72, 0.5, 0.82, MATS.tigerStone, 2.1, 1.92, 0, false);
  muzzle.rotation.z = -0.06;
  addBox(g, 0.26, 0.2, 0.34, MATS.tigerDark, 2.48, 2.02, 0, false, false);
  // 张开的嘴与獠牙
  addBox(g, 0.42, 0.2, 0.62, MATS.tigerDark, 2.28, 1.66, 0, false, false);
  addBox(g, 0.62, 0.22, 0.68, MATS.tigerStone, 2.18, 1.52, 0, false, false);
  [-0.22, 0.22].forEach(function (zz) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), MATS.cream);
    fang.position.set(2.44, 1.77, zz);
    fang.rotation.x = Math.PI;
    g.add(fang);
  });
  // 眼、眉、耳
  [-0.3, 0.3].forEach(function (zz) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), MATS.tigerDark);
    eye.position.set(2.08, 2.24, zz);
    g.add(eye);
    addBox(g, 0.28, 0.12, 0.18, MATS.tigerDark, 2.02, 2.4, zz, false, false);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 5), MATS.tigerStone);
    ear.position.set(1.4, 2.68, zz * 1.3);
    ear.rotation.z = -0.18;
    ear.castShadow = true;
    g.add(ear);
  });
  // 颊毛
  [-0.62, 0.62].forEach(function (zz) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 5), MATS.tigerStone);
    tuft.position.set(1.45, 1.9, zz);
    tuft.rotation.x = zz > 0 ? 0.5 : -0.5;
    g.add(tuft);
  });
  // 背部虎斑：浅刻凹槽
  [-1.2, -0.7, -0.2, 0.3].forEach(function (sx, i) {
    addBox(g, 0.1, 0.26 - (i % 2) * 0.05, 1.55, MATS.tigerDark, sx, 1.95, 0, false, false);
  });

  // 上卷的虎尾
  addTube(g, [
    new THREE.Vector3(-1.95, 1.2, 0.4),
    new THREE.Vector3(-2.35, 1.45, 0.85),
    new THREE.Vector3(-2.55, 2.1, 0.5),
    new THREE.Vector3(-2.2, 2.5, 0.0)
  ], 0.13, MATS.tigerStone, 16);
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 5), MATS.tigerDark);
  tuft.position.set(-2.2, 2.52, 0.0);
  g.add(tuft);

  parent.add(g);
}

/* ---------- 墓室保护区 ---------- */

function addTomb(root) {
  const g = new THREE.Group();
  g.name = "nanyue-tomb";
  g.position.set(TOMB_X, TERRACE_3, TOMB_Z);

  // 山顶庭院
  addBox(g, 44, 0.2, 44, MATS.paving, 0, 0.1, 0, false, true);
  addBox(g, 40, 0.1, 40, MATS.lawn, 0, 0.22, 0, false, true);
  addBox(g, 38, 0.12, 38, MATS.paving, 0, 0.3, 0, false, true);

  // 回廊：外 34、内 22；红砂岩柱列 + 深色平檐
  const roofY = 5.0;
  addBox(g, 34, 0.38, 1.5, MATS.sandstoneDark, 0, roofY, -16.25);
  addBox(g, 34, 0.38, 1.5, MATS.sandstoneDark, 0, roofY, 16.25);
  addBox(g, 1.5, 0.38, 34, MATS.sandstoneDark, 16.25, roofY, 0);
  addBox(g, 1.5, 0.38, 34, MATS.sandstoneDark, -16.25, roofY, 0);
  addBox(g, 24, 0.3, 0.9, MATS.sandstoneLight, 0, roofY - 0.26, -11);
  addBox(g, 24, 0.3, 0.9, MATS.sandstoneLight, 0, roofY - 0.26, 11);
  addBox(g, 0.9, 0.3, 24, MATS.sandstoneLight, -11, roofY - 0.26, 0);
  addBox(g, 0.9, 0.3, 24, MATS.sandstoneLight, 11, roofY - 0.26, 0);
  // 外檐压顶
  addBox(g, 35, 0.16, 1.8, MATS.sandstoneLight, 0, roofY + 0.27, -16.2);
  addBox(g, 35, 0.16, 1.8, MATS.sandstoneLight, 0, roofY + 0.27, 16.2);
  addBox(g, 1.8, 0.16, 35, MATS.sandstoneLight, 16.2, roofY + 0.27, 0);
  addBox(g, 1.8, 0.16, 35, MATS.sandstoneLight, -16.2, roofY + 0.27, 0);

  const columns = [];
  for (let v = -16; v <= 16; v += 8) {
    columns.push({ x: 16, z: v }, { x: -16, z: v }, { x: v, z: 16 }, { x: v, z: -16 });
  }
  for (let v = -11; v <= 11; v += 11) {
    columns.push({ x: 11, z: v }, { x: -11, z: v }, { x: v, z: 11 }, { x: v, z: -11 });
  }
  // 东侧入口留空，接岗顶步道
  const entryColumns = columns.filter(function (c) {
    return !(c.x > 0 && Math.abs(c.z) < 3.2);
  });
  addInstances(g, new THREE.CylinderGeometry(0.34, 0.42, 4.4, 8), MATS.sandstone, entryColumns, function (d, c) {
    d.position.set(c.x, 2.2, c.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  });

  // 外圈矮墙（南侧、东侧留入口）
  [[-12, 17], [12, 17], [0, -17]].forEach(function (p) {
    addBox(g, 12, 0.9, 0.6, MATS.sandstoneDark, p[0], 0.75, p[1], false);
  });
  addBox(g, 0.6, 0.9, 13, MATS.sandstoneDark, 17, 0.75, -10.5, false);
  addBox(g, 0.6, 0.9, 13, MATS.sandstoneDark, 17, 0.75, 10.5, false);
  addBox(g, 0.6, 0.9, 34, MATS.sandstoneDark, -17, 0.75, 0, false);
  addBox(g, 2.6, 0.14, 6.0, MATS.paving, 17.2, 0.4, 0, false, true);

  // 覆斗形玻璃光棚：压低的覆斗，深色茶玻璃 + 密钢框
  addBox(g, 24, 0.9, 24, MATS.sandstone, 0, 0.75, 0);
  addBox(g, 22, 0.25, 22, MATS.sandstoneDark, 0, 1.3, 0, false);
  const b = 10.5;
  const t = 8.2;
  const y0 = 1.65;
  const y1 = 6.6;
  const p = [
    new THREE.Vector3(-b, y0, b), new THREE.Vector3(b, y0, b), new THREE.Vector3(t, y1, t), new THREE.Vector3(-t, y1, t),
    new THREE.Vector3(b, y0, b), new THREE.Vector3(b, y0, -b), new THREE.Vector3(t, y1, -t), new THREE.Vector3(t, y1, t),
    new THREE.Vector3(b, y0, -b), new THREE.Vector3(-b, y0, -b), new THREE.Vector3(-t, y1, -t), new THREE.Vector3(t, y1, -t),
    new THREE.Vector3(-b, y0, -b), new THREE.Vector3(-b, y0, b), new THREE.Vector3(-t, y1, t), new THREE.Vector3(-t, y1, -t)
  ];
  for (let i = 0; i < 16; i += 4) {
    addQuad(g, p[i], p[i + 1], p[i + 2], p[i + 3], MATS.canopyGlass);
  }
  const frame = [
    [new THREE.Vector3(-b, y0, b), new THREE.Vector3(b, y0, b)],
    [new THREE.Vector3(b, y0, b), new THREE.Vector3(b, y0, -b)],
    [new THREE.Vector3(b, y0, -b), new THREE.Vector3(-b, y0, -b)],
    [new THREE.Vector3(-b, y0, -b), new THREE.Vector3(-b, y0, b)],
    [new THREE.Vector3(-t, y1, t), new THREE.Vector3(t, y1, t)],
    [new THREE.Vector3(t, y1, t), new THREE.Vector3(t, y1, -t)],
    [new THREE.Vector3(t, y1, -t), new THREE.Vector3(-t, y1, -t)],
    [new THREE.Vector3(-t, y1, -t), new THREE.Vector3(-t, y1, t)],
    [new THREE.Vector3(-b, y0, b), new THREE.Vector3(-t, y1, t)],
    [new THREE.Vector3(b, y0, b), new THREE.Vector3(t, y1, t)],
    [new THREE.Vector3(b, y0, -b), new THREE.Vector3(t, y1, -t)],
    [new THREE.Vector3(-b, y0, -b), new THREE.Vector3(-t, y1, -t)]
  ];
  frame.forEach(function (pair) { addBeam(g, pair[0], pair[1], 0.24, MATS.metal); });
  // 每个斜面两根中间肋
  [
    [-b, b, -t, t],
    [b, b, t, t],
    [b, -b, t, -t],
    [-b, -b, -t, -t]
  ].forEach(function (f) {
    const a = new THREE.Vector3(f[0], y0, f[1]);
    const c = new THREE.Vector3(f[2], y1, f[3]);
    [0.33, 0.66].forEach(function (u) {
      addBeam(g, a.clone().lerp(c, u), a.clone().lerp(c, u).add(new THREE.Vector3(0, 0, 0)), 0.1, MATS.metal);
    });
  });
  addBox(g, 2 * t, 0.1, 2 * t, MATS.canopyTop, 0, y1, 0, false, false);

  // 光棚下墓室示意：士字七室 + 金印/玉衣
  addBox(g, 18, 0.12, 18, MATS.dark, 0, 1.4, 0, false, false);
  addBox(g, 16, 0.08, 16, MATS.warmFloor, 0, 1.46, 0, false, false);
  addBox(g, 8, 1.0, 4.0, MATS.sandstoneDark, 0, 1.95, 5.0, false);
  addBox(g, 6, 1.0, 4.4, MATS.sandstoneDark, 0, 1.95, 0.5, false);
  addBox(g, 4.4, 1.0, 3.2, MATS.sandstoneDark, 0, 1.95, -4.0, false);
  [-5.1, 5.1].forEach(function (x) {
    addBox(g, 2.6, 1.0, 3.0, MATS.sandstoneDark, x, 1.95, 5.0, false);
    addBox(g, 2.6, 1.0, 3.6, MATS.sandstoneDark, x, 1.95, 0.5, false);
  });
  const seal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.8), MATS.gold);
  seal.position.set(0, 1.95, 0.5);
  seal.castShadow = true;
  g.add(seal);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), MATS.gold);
  knob.position.set(0, 2.25, 0.5);
  g.add(knob);
  const jadeSuit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.35), MATS.jade);
  jadeSuit.position.set(1.4, 2.13, 0.5);
  jadeSuit.rotation.z = Math.PI / 2;
  g.add(jadeSuit);

  // 南侧墓道入口
  addBox(g, 7, 0.12, 7, MATS.dark, 0, 0.4, 14.5, false, false);
  [-3.8, 3.8].forEach(function (x) {
    addBox(g, 0.8, 1.8, 7, MATS.sandstone, x, 1.0, 14.5);
  });
  for (let i = 0; i < 5; i++) {
    addBox(g, 6, 0.24, 0.8, MATS.sandstoneDark, 0, 0.3 - i * 0.22, 11.4 + i * 1.1, false);
  }

  root.add(g);
}

/* ---------- 主体陈列楼 / 玉圭门阙 ---------- */

function addMainHall(root) {
  const g = new THREE.Group();
  g.name = "nanyue-main-hall";
  g.position.set(HALL_X, TERRACE_3, HALL_Z);

  addBox(g, 36, 0.6, 16, MATS.sandstone, 0, 0.3, 0, false, true);
  addBox(g, 34, 10, 14, MATS.sandstone, 0, 5.3, 0);
  addBox(g, 36, 0.7, 16, MATS.sandstoneDark, 0, 10.55, 0, false);
  addBox(g, 34.6, 0.28, 14.6, MATS.sandstoneLight, 0, 10.95, 0, false);

  // 两道深色楼层凹线，替代原来的白色横带
  [3.4, 6.8].forEach(function (y) {
    addBox(g, 34.2, 0.14, 14.2, MATS.sandstoneDark, 0, y, 0, false, false);
  });

  // 南侧玻璃幕墙，面向墓室
  addBox(g, 16, 6.4, 0.2, MATS.window, 0, 5.4, 7.06, false);
  const mullions = [];
  for (let x = -7.2; x <= 7.2; x += 2.4) mullions.push({ x: x });
  addInstances(g, new THREE.BoxGeometry(0.14, 6.4, 0.26), MATS.metal, mullions, function (d, m) {
    d.position.set(m.x, 5.4, 7.18);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);

  // 南侧入口
  addBox(g, 6, 4.4, 0.5, MATS.dark, 0, 2.5, 7.1, false);
  addBox(g, 5.2, 3.8, 0.2, MATS.entranceGlass, 0, 2.4, 7.25, false);
  addBox(g, 10, 0.3, 2.2, MATS.paving, 0, 0.6, 8.2, false, true);

  // 北侧墙面开窗/玻璃带，避免玉圭门阙贴在一块平砖墙上
  const northWindows = [];
  [-13, -9, 9, 13].forEach(function (x) {
    northWindows.push({ x: x, y: 5.0 });
    northWindows.push({ x: x, y: 8.2 });
  });
  addInstances(g, new THREE.BoxGeometry(1.4, 2.2, 0.18), MATS.window, northWindows, function (d, w) {
    d.position.set(w.x, w.y, -7.08);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);

  // 平屋顶与低矮天窗带：真正的金字塔光棚在地下一层，不在屋顶
  addBox(g, 30, 0.28, 10, MATS.dark, 0, 10.32, 0, false, false);
  addBox(g, 13, 0.12, 4.2, MATS.glassDark, 0, 10.43, 0, false, false);
  [-5.2, 0, 5.2].forEach(function (x) {
    addBox(g, 0.16, 0.18, 4.4, MATS.metal, x, 10.48, 0, false, false);
  });

  // 北侧玉圭形门阙：两片宽大的玉圭板 + 深门洞 + 石过梁
  addBox(g, 14, 0.6, 5.5, MATS.sandstone, 0, 0.3, -8.6, false, true);
  addBox(g, 7.0, 8.0, 0.8, MATS.dark, 0, 4.4, -7.0, false);
  // 门洞内的暗玻璃
  addBox(g, 5.6, 7.0, 0.2, MATS.entranceGlass, 0, 4.2, -6.7, false, false);

  function guiShape(width, height) {
    const s = new THREE.Shape();
    const half = width / 2;
    s.moveTo(-half, 0);
    s.lineTo(half, 0);
    s.lineTo(half, height - 2.0);
    s.lineTo(half * 0.5, height - 0.8);
    s.lineTo(0, height);
    s.lineTo(-half * 0.5, height - 0.8);
    s.lineTo(-half, height - 2.0);
    s.closePath();
    return s;
  }
  const guiGeo = new THREE.ExtrudeGeometry(guiShape(3.2, 13.0), { depth: 0.8, bevelEnabled: false });
  const guiFrameGeo = new THREE.ExtrudeGeometry(guiShape(3.7, 13.6), { depth: 0.55, bevelEnabled: false });
  [-3.4, 3.4].forEach(function (x) {
    const frame = new THREE.Mesh(guiFrameGeo, MATS.cream);
    frame.position.set(x, 0.5, -7.9);
    frame.castShadow = true;
    frame.receiveShadow = true;
    g.add(frame);
    const gui = new THREE.Mesh(guiGeo, MATS.jade);
    gui.position.set(x, 0.5, -8.35);
    gui.castShadow = true;
    gui.receiveShadow = true;
    g.add(gui);
    // 圭形板面保持整块深绿玉石，不再加中线
  });
  // 石过梁与压顶
  addBox(g, 10.6, 0.8, 1.6, MATS.cream, 0, 13.35, -8.0, false);
  addBox(g, 11.2, 0.3, 2.2, MATS.sandstoneDark, 0, 13.9, -8.0, false);
  addBox(g, 2.0, 0.65, 0.18, MATS.gold, 0, 13.35, -9.3, false, false);
  // 门阙前小广场
  addBox(g, 16, 0.14, 6, MATS.paving, 0, 0.37, -11.0, false, true);

  // 东西两侧船纹浮雕
  [1, -1].forEach(function (side) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 2.4), MATS.frieze);
    plane.position.set(side * 17.06, 5.4, 0);
    plane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    plane.castShadow = false;
    g.add(plane);
  });

  root.add(g);
}

/* ---------- 植物、花坛与街道家具 ---------- */

function blocked(x, z) {
  if (x > 21 && x < 39 && Math.abs(z) < 20) return true;
  if (x > 36 && x < 48 && Math.abs(z) < 22) return true;
  if (x > -49 && x < -7 && Math.abs(z) < 21) return true;
  if (x > -47 && x < -9 && z > -41 && z < -23) return true;
  if (x > -13 && x < 10 && z > 17 && z < 31) return true;
  if (x > 5 && x < 48 && z > 20 && z < 29) return true;
  if (x > -30 && x < -25 && z > 16 && z < 31) return true;
  if (x > 44) return true;
  return false;
}

function addBigTree(root, x, z, s, baseY) {
  const base = typeof baseY === "number" ? baseY : GROUND_Y;
  const trunk = addCylinder(root, 0.35 * s, 0.55 * s, 4.6 * s, 7, MATS.trunk, x, base + 2.3 * s, z);
  trunk.castShadow = true;
  // 两根分枝
  addTube(root, [
    new THREE.Vector3(x, base + 4.0 * s, z),
    new THREE.Vector3(x + 1.0 * s, base + 5.8 * s, z + 0.8 * s),
    new THREE.Vector3(x + 1.8 * s, base + 7.2 * s, z + 1.1 * s)
  ], 0.2 * s, MATS.trunk, 8);
  addTube(root, [
    new THREE.Vector3(x, base + 4.2 * s, z),
    new THREE.Vector3(x - 1.2 * s, base + 5.8 * s, z - 0.9 * s),
    new THREE.Vector3(x - 2.0 * s, base + 7.0 * s, z - 1.2 * s)
  ], 0.18 * s, MATS.trunk, 8);
  const blobs = [
    { dx: 0, dy: 7.4, dz: 0, r: 3.4, mat: MATS.foliage },
    { dx: 2.3, dy: 6.6, dz: 0.9, r: 2.5, mat: MATS.foliage2 },
    { dx: -2.1, dy: 6.8, dz: -0.8, r: 2.6, mat: MATS.foliage2 },
    { dx: 0.4, dy: 6.0, dz: -2.0, r: 2.2, mat: MATS.foliage },
    { dx: -0.5, dy: 6.2, dz: 2.1, r: 2.3, mat: MATS.foliage }
  ];
  blobs.forEach(function (b) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r * s, 1), b.mat);
    m.position.set(x + b.dx * s, base + b.dy * s, z + b.dz * s);
    m.scale.set(1.1, 0.9, 1.1);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  });
}

function addTrees(root) {
  // 石阙两侧的大街树，树冠压住石壁边缘
  addBigTree(root, 45.5, 33.0, 1.25, TERRACE_1);
  addBigTree(root, 45.5, -33.0, 1.2, TERRACE_1);

  const trees = [];
  for (let i = 0; i < 34; i++) {
    const x = range(-48, 7);
    const z = range(-33, 33);
    if (!blocked(x, z)) trees.push({ x: x, z: z, s: range(0.6, 1.15) });
  }
  // 岗顶墓室周边补几棵
  [[-45, 14], [-45, -14], [-10, 12], [-10, -14], [-44, 28], [-12, 30]].forEach(function (p) {
    if (!blocked(p[0], p[1])) trees.push({ x: p[0], z: p[1], s: range(0.7, 1.0) });
  });
  addInstances(root, new THREE.CylinderGeometry(0.38, 0.55, 3.4, 6), MATS.trunk, trees, function (d, t) {
    const y = terrainY(t.x, t.z);
    d.position.set(t.x, y + 1.7 * t.s, t.z);
    d.scale.set(t.s, t.s, t.s);
    d.rotation.set(0, 0, 0);
  });
  addInstances(root, new THREE.IcosahedronGeometry(2.5, 1), MATS.foliage, trees, function (d, t) {
    const y = terrainY(t.x, t.z);
    d.position.set(t.x, y + 4.4 * t.s, t.z);
    d.scale.set(1.15 * t.s, 0.85 * t.s, 1.1 * t.s);
    d.rotation.set(0, range(0, Math.PI), 0);
  });

  // 台地边缘灌木
  const shrubs = [];
  for (let i = 0; i < 30; i++) {
    const x = range(-49, 45);
    const z = range(-36, 36);
    if (!blocked(x, z)) shrubs.push({ x: x, z: z, s: range(0.55, 0.95) });
  }
  addInstances(root, new THREE.IcosahedronGeometry(0.95, 1), MATS.foliage2, shrubs, function (d, s) {
    const y = terrainY(s.x, s.z);
    d.position.set(s.x, y + 0.7 * s.s, s.z);
    d.scale.set(s.s, 0.65 * s.s, s.s);
    d.rotation.set(0, 0, 0);
  });

  // 入口台阶两侧花带
  [-1, 1].forEach(function (side) {
    const z0 = side * 7.4;
    const z1 = side * 12.0;
    addBox(root, 6.4, 0.35, Math.abs(z1 - z0), MATS.foliage2, 44.2, TERRACE_1 + 0.22, (z0 + z1) / 2, false, true);
    addBox(root, 6.6, 0.55, 0.3, MATS.sandstoneDark, 44.2, TERRACE_1 + 0.3, z1, false);
    const flowers = [];
    for (let i = 0; i < 10; i++) {
      flowers.push({ x: range(41.5, 46.6), z: range(Math.min(z0, z1) + 0.4, Math.max(z0, z1) - 0.4) });
    }
    addInstances(root, new THREE.IcosahedronGeometry(0.12, 0), MATS.flower, flowers, function (d, f) {
      d.position.set(f.x, TERRACE_1 + 0.52, f.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 0.8, 1);
    }, false);
  });
}

function addLamps(root) {
  const positions = [-15, 15];
  positions.forEach(function (z) {
    addCylinder(root, 0.1, 0.16, 3.0, 6, MATS.metal, 51.2, GROUND_Y + 1.5, z);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), MATS.lamp);
    globe.position.set(51.2, GROUND_Y + 3.2, z);
    root.add(globe);
  });
}

/* ---------- 材质/入口 ---------- */

let MATS = null;

function cloneTexture(tex, rx, ry) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function createMaterials(textures) {
  return {
    base: std({ color: 0xb9ad99, roughness: 0.95 }),
    earth: std({ color: 0x6b4a34, roughness: 0.98 }),
    sandstone: std({ map: textures.sandstone, color: 0xffffff, roughness: 0.95 }),
    facadeStone: std({ map: textures.facade, color: 0xffffff, roughness: 0.95 }),
    bodyStone: std({ map: textures.body, color: 0xe6c2ac, roughness: 0.95 }),
    terraceStone: std({ map: textures.terrace, color: 0xe6bfa4, roughness: 0.96 }),
    sandstoneLight: std({ map: textures.sandstone, color: 0xf0c0a2, roughness: 0.93 }),
    sandstoneDark: std({ color: 0x3a1712, roughness: 0.94 }),
    groove: std({ color: 0x24100b, roughness: 0.98 }),
    cream: std({ color: 0xd6bd9a, roughness: 0.92 }),
    paving: std({ map: textures.paving, color: 0xcbbba6, roughness: 0.96 }),
    lawn: std({ map: textures.lawn, color: 0xffffff, roughness: 0.98 }),
    hill: std({ map: textures.lawn, color: 0xffffff, roughness: 0.99 }),
    asphalt: std({ color: 0x242624, roughness: 0.98 }),
    lane: std({ color: 0xd8cbb2, roughness: 0.92 }),
    dark: std({ color: 0x1c1410, roughness: 0.92 }),
    window: std({ color: 0x101f1e, roughness: 0.3, metalness: 0.35 }),
    entranceGlass: std({ color: 0x1f3835, roughness: 0.3, metalness: 0.25 }),
    glassDark: std({ color: 0x2c4d48, roughness: 0.24, metalness: 0.25, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    slotGlass: new THREE.MeshStandardMaterial({ map: textures.slotGlass, color: 0xffffff, roughness: 0.18, metalness: 0.3 }),
    canopyGlass: std({ color: 0x081f1b, roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    canopyTop: new THREE.MeshStandardMaterial({ color: 0x163b36, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    metal: std({ color: 0x333834, roughness: 0.42, metalness: 0.6 }),
    bronze: std({ color: 0x96733a, roughness: 0.34, metalness: 0.72 }),
    bronzeDark: std({ color: 0x4a3518, roughness: 0.46, metalness: 0.62 }),
    jade: std({ color: 0x082218, roughness: 0.8, metalness: 0.0 }),
    gold: std({ color: 0xc9a04a, roughness: 0.3, metalness: 0.7 }),
    lamp: std({ color: 0xf3e5c8, roughness: 0.35, emissive: 0x6b5426, emissiveIntensity: 0.5 }),
    warmFloor: std({ color: 0x7a4a2e, roughness: 0.7, emissive: 0x3a1c0a, emissiveIntensity: 0.55 }),
    reliefStone: std({ map: textures.relief, color: 0xffd9b8, roughness: 0.92 }),
    reliefDark: std({ color: 0x6a3222, roughness: 0.96 }),
    tigerStone: std({ map: textures.tiger, color: 0xf0c4a0, roughness: 0.92 }),
    tigerDark: std({ color: 0x5a2a1e, roughness: 0.96 }),
    trunk: std({ color: 0x2a1d14, roughness: 0.98 }),
    foliage: std({ color: 0x081408, roughness: 0.98, flatShading: true }),
    foliage2: std({ color: 0x12220f, roughness: 0.98, flatShading: true }),
    flower: std({ color: 0xa33b2f, roughness: 0.9 }),
    museumName: new THREE.MeshStandardMaterial({ map: textures.museumName, transparent: true, alphaTest: 0.05, roughness: 0.86, color: 0xf0d8a8 }),
    frieze: new THREE.MeshStandardMaterial({ map: textures.frieze, roughness: 0.9 })
  };
}

export function create() {
  seed = 1983;

  const sandstone = makeSandstone();
  const textures = {
    sandstone: sandstone,
    facade: cloneTexture(sandstone, 12, 4.5),
    body: cloneTexture(sandstone, 7, 4.5),
    terrace: cloneTexture(sandstone, 9, 2.2),
    relief: cloneTexture(sandstone, 2, 2),
    tiger: cloneTexture(sandstone, 1, 1),
    paving: makePaving(),
    lawn: makeLawn(),
    slotGlass: makeSlotGlass(),
    museumName: makeMuseumName(),
    frieze: makeShipFrieze()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "nanyue-museum-model";

  addBase(root);
  addStreet(root);
  addTerraces(root);
  addHillStair(root);
  addFacade(root);

  // 临街一对圆雕石虎，伏卧在入口台阶两侧的台地矮墙上
  [1, -1].forEach(function (side) {
    addTiger(root, 40.5, side * 14.5, TERRACE_1, 1.0);
  });

  addTomb(root);
  addMainHall(root);
  addTrees(root);
  addLamps(root);

  const anchors = {
    gate: new THREE.Vector3(FACADE_X, TERRACE_1 + 8.5, 0),
    tomb: new THREE.Vector3(TOMB_X, TERRACE_3 + 10.6, TOMB_Z),
    chamber: new THREE.Vector3(TOMB_X, TERRACE_3 + 1.9, TOMB_Z + 14.5),
    jade: new THREE.Vector3(HALL_X, TERRACE_3 + 13.5, HALL_Z - 8.0),
    detail: new THREE.Vector3(FACADE_X + 0.3, TERRACE_1 + 5.9, 9.15),
    tiger: new THREE.Vector3(40.5, TERRACE_1 + 2.5, 14.5)
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
