/*
 * 石室圣心大教堂 · 一德路的双塔 · 风格化场地 diorama（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：正立面双尖塔—三座透视门—玫瑰窗—中殿/侧廊/飞扶壁—耳堂—后殿—一德路街景与庭院。
 * 不是 2,754 ㎡ 建筑内部 1:1，也不是整片一德路街区；石材/彩窗为程序化示意。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");

const SITE_W = 100;
const SITE_D = 140;
const BASE_Y = 0.9;
const GROUND_Y = 1.02;

const FRONT_Z = 39.345;
const BACK_Z = -39.345;
const TOWER_X = 13.5;
const TOWER_W = 8;
const TOWER_Z = FRONT_Z - TOWER_W / 2;
const TOWER_BODY_TOP = 40;
const TOWER_TOP = 58.5;
const NAVE_OUTER_X = 12;
const COL_X = 5.3;
const ARCADE_TOP = 10.6;
const WALL_TOP = 22;
const ROOF_RIDGE = 30;
const NAVE_START_Z = 33;
const NAVE_END_Z = -24;
const APSE_START_Z = -24;
const APSE_TIP_Z = BACK_Z;

let seed = 1863;
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

/* ---------------- 贴图 ---------------- */

function makeGranite() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#cfc7b8";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = random();
    ctx.fillStyle = v > 0.5
      ? "rgba(88,82,72," + range(0.03, 0.12).toFixed(3) + ")"
      : "rgba(246,242,232," + range(0.04, 0.12).toFixed(3) + ")";
    const s = range(1, 4);
    ctx.fillRect(random() * 512, random() * 512, s, s);
  }
  // 花岗岩砌块缝
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = "rgba(84,80,70,0.28)";
    ctx.fillRect(0, y, 512, 2);
    const off = (y / 64) % 2 ? 52 : 0;
    for (let x = off; x < 512; x += 104) {
      ctx.fillStyle = "rgba(84,80,70,0.22)";
      ctx.fillRect(x, y, 2, 64);
    }
  }
  return colorTexture(c, 2, 2);
}

function makePaving() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c9c3b7";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      const v = 188 + Math.floor(random() * 26);
      ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 12) + ")";
      ctx.fillRect(x + 2, y + 2, 124, 124);
    }
  }
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = "rgba(76,70,60," + range(0.02, 0.07).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(1, 3), range(1, 3));
  }
  return colorTexture(c, 6, 8);
}

function makeAsphalt() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#666964";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = "rgba(230,230,222," + range(0.02, 0.09).toFixed(3) + ")";
    ctx.fillRect(random() * 256, random() * 256, range(1, 3), range(1, 3));
  }
  return colorTexture(c, 4, 1);
}

function makeRoof() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5a5e57";
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = "rgba(30,32,28,0.22)";
    ctx.fillRect(x, 0, 2, 256);
  }
  return colorTexture(c, 5, 6);
}

function makeRose() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, 512, 512);
  const colors = ["#a6322e", "#2e5a8a", "#c9a24a", "#3f7a5a", "#7b3a52", "#2f6f83"];
  const cx = 256, cy = 256;
  for (let ring = 0; ring < 3; ring++) {
    const rOuter = 235 - ring * 58;
    const rInner = 190 - ring * 58;
    const n = 12 - ring * 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + ring * 0.18;
      const a1 = ((i + 1) / n) * Math.PI * 2 + ring * 0.18;
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, a0, a1);
      ctx.arc(cx, cy, rInner, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = colors[(i + ring * 2) % colors.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(20,22,22,0.72)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#c9a24a";
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,22,22,0.8)";
  ctx.lineWidth = 6;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 35, cy + Math.sin(a) * 35);
    ctx.lineTo(cx + Math.cos(a) * 238, cy + Math.sin(a) * 238);
    ctx.stroke();
  }
  return colorTexture(c, 1, 1);
}

function makeGothicWindow(variant) {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#b9b1a2";
  ctx.fillRect(0, 0, 256, 512);
  // 尖券玻璃区域
  ctx.beginPath();
  ctx.moveTo(22, 490);
  ctx.lineTo(22, 190);
  ctx.quadraticCurveTo(22, 70, 128, 18);
  ctx.quadraticCurveTo(234, 70, 234, 190);
  ctx.lineTo(234, 490);
  ctx.closePath();
  ctx.fillStyle = "#111722";
  ctx.fill();
  ctx.save();
  ctx.clip();
  const palettes = [
    ["#a6322e", "#2e5a8a", "#c9a24a", "#3f7a5a"],
    ["#2e5a8a", "#7b3a52", "#c9a24a", "#2f6f83"],
    ["#3f7a5a", "#a6322e", "#c9a24a", "#2e5a8a"]
  ];
  const p = palettes[variant % palettes.length];
  const cols = 4, rows = 8;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      ctx.fillStyle = p[(r + k + variant) % p.length];
      ctx.fillRect(22 + k * 53, 24 + r * 58, 50, 55);
    }
  }
  ctx.strokeStyle = "rgba(15,18,22,0.78)";
  ctx.lineWidth = 5;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(22, 24 + r * 58);
    ctx.lineTo(234, 24 + r * 58);
    ctx.stroke();
  }
  for (let k = 0; k <= cols; k++) {
    ctx.beginPath();
    ctx.moveTo(22 + k * 53, 18);
    ctx.lineTo(22 + k * 53, 490);
    ctx.stroke();
  }
  // 中柱
  ctx.fillStyle = "#b9b1a2";
  ctx.fillRect(124, 18, 8, 472);
  ctx.strokeStyle = "rgba(50,46,38,0.6)";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 18, 212, 472);
  ctx.restore();
  // 外石框
  ctx.strokeStyle = "#d8d0c0";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(22, 490);
  ctx.lineTo(22, 190);
  ctx.quadraticCurveTo(22, 70, 128, 18);
  ctx.quadraticCurveTo(234, 70, 234, 190);
  ctx.lineTo(234, 490);
  ctx.stroke();
  return colorTexture(c, 1, 1);
}

function makeClock() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e9e4d8";
  ctx.beginPath();
  ctx.arc(128, 128, 116, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3d4042";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = "#2e3133";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillRect(128 + Math.cos(a) * 92 - 3, 128 + Math.sin(a) * 92 - 3, 6, 6);
  }
  ctx.strokeStyle = "#26292b";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128, 68);
  ctx.moveTo(128, 128);
  ctx.lineTo(178, 148);
  ctx.stroke();
  return colorTexture(c, 1, 1);
}

function makeTextCanvas(text, opts) {
  const o = opts || {};
  const w = o.w || 1024;
  const h = o.h || 150;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = o.bg || "#2b3538";
  ctx.fillRect(0, 0, w, h);
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = o.borderWidth || 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = (o.weight || "700") + " " + (o.size || 76) + 'px ' + (o.font || '"Songti SC","SimSun","STSong",serif');
  ctx.fillStyle = o.color || "#efe0b5";
  ctx.fillText(text, w / 2, h / 2 + 2);
  return c;
}

/* ---------------- 材质 ---------------- */

let MATS = null;

function std(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

function glassMat(tex, strength) {
  return new THREE.MeshStandardMaterial({
    color: 0x14181c,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: strength,
    roughness: 0.7,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
}

function createMaterials(textures) {
  return {
    base: std({ map: textures.paving, color: 0x8a857a, roughness: 0.97 }),
    paving: std({ map: textures.paving, color: 0xd4cec1, roughness: 0.95 }),
    granite: std({ map: textures.granite, color: 0xd8d1c2, roughness: 0.95 }),
    graniteDark: std({ map: textures.granite, color: 0xb5ad9e, roughness: 0.96 }),
    trim: std({ color: 0xe2dbcc, roughness: 0.88 }),
    stoneDark: std({ color: 0x736e64, roughness: 0.95 }),
    roof: std({ map: textures.roof, color: 0x8d918b, roughness: 0.92, side: THREE.DoubleSide }),
    roofDark: std({ color: 0x3d423d, roughness: 0.93, side: THREE.DoubleSide }),
    glassRose: glassMat(textures.rose, 0.85),
    glassTall: [
      glassMat(textures.win0, 0.62),
      glassMat(textures.win1, 0.62),
      glassMat(textures.win2, 0.62)
    ],
    glassSide: [
      glassMat(textures.win1, 0.55),
      glassMat(textures.win2, 0.55)
    ],
    door: std({ color: 0x3a2b1e, roughness: 0.84 }),
    metal: std({ color: 0x4b4e50, roughness: 0.45, metalness: 0.6 }),
    asphalt: std({ map: textures.asphalt, color: 0x747770, roughness: 0.98 }),
    grass: std({ color: 0x5d7245, roughness: 0.98 }),
    hedge: std({ color: 0x3d552f, roughness: 0.96, flatShading: true }),
    trunk: std({ color: 0x5a4632, roughness: 0.96 }),
    foliage: std({ color: 0x4b673b, roughness: 0.96, flatShading: true }),
    shophouse: std({ map: textures.granite, color: 0xc2b9a7, roughness: 0.94 }),
    awning: std({ color: 0x8f4a3d, roughness: 0.86 }),
    lamp: std({ color: 0xfff1c8, emissive: 0x9a6a1e, emissiveIntensity: 0.5, roughness: 0.4 })
  };
}

/* ---------------- 基础几何 ---------------- */

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

function addPlane(parent, w, h, mat, x, y, z, rotY) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  if (rotY) mesh.rotation.y = rotY;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBeam(parent, a, b, radius, mat, seg) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.01) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, seg || 6, 1, true), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.scale.set(1, len, 1);
  mesh.castShadow = false;
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
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = cast === true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTextPlane(parent, text, opts) {
  const o = opts || {};
  const canvas = makeTextCanvas(text, o);
  const tex = colorTexture(canvas, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: false, roughness: 0.75, metalness: 0.04, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.width || 2, o.height || 0.5), mat);
  mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.rotationY) mesh.rotation.y = o.rotationY;
  mesh.castShadow = false;
  parent.add(mesh);
  return mesh;
}

/* ---------------- 尖券 ---------------- */

function archOutline(w, h, spring) {
  const s = new THREE.Shape();
  const half = w / 2;
  s.moveTo(-half, 0);
  s.lineTo(half, 0);
  s.lineTo(half, spring);
  s.quadraticCurveTo(half, h * 0.82, 0, h);
  s.quadraticCurveTo(-half, h * 0.82, -half, spring);
  s.lineTo(-half, 0);
  return s;
}

function archHolePath(cx, base, w, h, spring) {
  const p = new THREE.Path();
  const half = w / 2;
  p.moveTo(cx - half, base);
  p.lineTo(cx - half, base + spring);
  p.quadraticCurveTo(cx - half, base + h * 0.82, cx, base + h);
  p.quadraticCurveTo(cx + half, base + h * 0.82, cx + half, base + spring);
  p.lineTo(cx + half, base);
  p.closePath();
  return p;
}

function extrudeShape(shape, depth, mat) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, curveSegments: 14 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function archRing(outerW, outerH, innerW, innerH, depth, mat, outerSpring, innerSpring) {
  const shape = archOutline(outerW, outerH, outerSpring || outerH * 0.56);
  shape.holes.push(archHolePath(0, 0, innerW, innerH, innerSpring || innerH * 0.56));
  return extrudeShape(shape, depth, mat);
}

function addGothicWindow(parent, x, y, z, w, h, rotY, glass, frame, depth) {
  const plane = addPlane(parent, w, h, glass, x, y, z, rotY);
  plane.scale.set(1, 1, 1);
  const ring = archRing(w + 1.0, h + 0.9, w, h, 0.22, frame, h * 0.5, h * 0.48);
  ring.position.set(x, y - h / 2, z);
  ring.rotation.y = rotY;
  ring.translateZ(0.16);
  parent.add(ring);
  return plane;
}

/* ---------------- 塔尖 / 小尖饰 ---------------- */

let pinnacles = [];

function addPinnacle(parent, x, y, z, r, h) {
  pinnacles.push({ x: x, y: y, z: z, r: r, h: h });
}

function flushPinnacles(parent) {
  if (!pinnacles.length) return;
  const geo = new THREE.ConeGeometry(1, 1, 8);
  addInstances(parent, geo, MATS.trim, pinnacles, function (d, e) {
    d.position.set(e.x, e.y + e.h / 2, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(e.r, e.h, e.r);
  }, true);
}

/* ---------------- 场地 / 街景 ---------------- */

function addBase(root) {
  addBox(root, SITE_W, BASE_Y, SITE_D, MATS.base, 0, BASE_Y / 2, 0, false, true);
  addBox(root, SITE_W - 1.4, 0.12, SITE_D - 1.4, MATS.paving, 0, BASE_Y + 0.06, 0, false, true);

  // 前庭
  addBox(root, 66, 0.06, 20, MATS.paving, 0, GROUND_Y + 0.03, 49, false, true);
  // 一德路：人行道 + 车行道
  addBox(root, 98, 0.05, 4, MATS.paving, 0, GROUND_Y + 0.03, 59, false, true);
  addBox(root, 98, 0.05, 7, MATS.asphalt, 0, GROUND_Y + 0.03, 64.5, false, true);
  addBox(root, 98, 0.05, 3, MATS.paving, 0, GROUND_Y + 0.03, 69.5, false, true);

  // 前庭台阶与栏杆
  addBox(root, 30, 0.22, 2.0, MATS.graniteDark, 0, GROUND_Y + 0.11, 40.0, false, true);
  addBox(root, 30, 0.4, 1.2, MATS.graniteDark, 0, GROUND_Y + 0.2, 41.0, false, true);
  [-20.5, 20.5].forEach(function (x) {
    addBox(root, 0.4, 1.1, 18, MATS.graniteDark, x, GROUND_Y + 0.55, 49, true, true);
    const posts = [];
    for (let i = 0; i < 9; i++) posts.push({ z: 41 + i * 2.1 });
    addInstances(root, new THREE.BoxGeometry(0.1, 1.0, 0.1), MATS.metal, posts, function (d, e) {
      d.position.set(x, GROUND_Y + 1.35, e.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    }, false);
    addBox(root, 0.1, 0.1, 18, MATS.metal, x, GROUND_Y + 1.85, 49, false, false);
  });

  // 侧院 / 北院草地
  [-1, 1].forEach(function (side) {
    addBox(root, 22, 0.06, 68, MATS.grass, side * 35, GROUND_Y + 0.03, 4, false, true);
    addBox(root, 20, 0.5, 0.5, MATS.hedge, side * 35, GROUND_Y + 0.3, -28, true, true);
  });
  addBox(root, 56, 0.06, 18, MATS.grass, 0, GROUND_Y + 0.03, -49, false, true);

  // 南缘铭牌
  addBox(root, 15.4, 1.25, 0.22, MATS.stoneDark, 0, 0.62, 70.03, false, false);
  addTextPlane(root, "石室圣心大教堂", {
    w: 1024, h: 150, bg: "#2b3538", border: "#c9b06a", borderWidth: 8,
    color: "#efe0b5", size: 74, width: 14.2, height: 1.0,
    x: 0, y: 0.64, z: 70.16
  });
}

function addStreet(root) {
  // 一德路两侧低层骑楼/商铺，只做外壳，中央留出教堂轴线
  const blocks = [-42, -30, 30, 42];
  blocks.forEach(function (x, i) {
    const w = 11;
    addBox(root, w, 4.6, 5.0, MATS.shophouse, x, GROUND_Y + 2.3, 67.0, true, true);
    addBox(root, w + 0.5, 0.34, 5.4, MATS.trim, x, GROUND_Y + 4.67, 67.0, false, false);
    addBox(root, w - 1.2, 0.28, 1.3, MATS.awning, x, GROUND_Y + 3.0, 64.8, false, true);
    [-1, 1].forEach(function (s) {
      addBox(root, 0.26, 2.8, 0.26, MATS.graniteDark, x + s * (w / 2 - 0.8), GROUND_Y + 1.4, 64.6, true, true);
    });
    // 简单窗洞
    const wins = [];
    for (let k = -1; k <= 1; k++) wins.push({ x: x + k * (w / 3), y: GROUND_Y + 3.7 });
    addInstances(root, new THREE.BoxGeometry(1.2, 1.4, 0.1), MATS.stoneDark, wins, function (d, e) {
      d.position.set(e.x, e.y, 64.46);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    }, false);
  });
}

function addTrees(root) {
  const entries = [
    [-34, 44], [34, 44], [-36, 12], [36, 12], [-34, -20], [34, -20], [-18, 50], [18, 50]
  ];
  addInstances(root, new THREE.CylinderGeometry(0.28, 0.4, 3.0, 5), MATS.trunk, entries, function (d, e) {
    d.position.set(e[0], GROUND_Y + 1.5, e[1]);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, true);
  addInstances(root, new THREE.IcosahedronGeometry(1.9, 0), MATS.foliage, entries, function (d, e) {
    d.position.set(e[0], GROUND_Y + 4.3, e[1]);
    d.rotation.set(0, e[0] * 0.2, 0);
    d.scale.set(1.15, 0.95, 1.15);
  }, true);
}

/* ---------------- 正立面 ---------------- */

function addFacade(church) {
  const wallH = 25.4;
  const wallW = 19;
  const shape = new THREE.Shape();
  shape.moveTo(-wallW / 2, 0);
  shape.lineTo(wallW / 2, 0);
  shape.lineTo(wallW / 2, wallH);
  shape.lineTo(-wallW / 2, wallH);
  shape.lineTo(-wallW / 2, 0);
  shape.holes.push(archHolePath(0, 0, 5.6, 8.8, 4.6));
  shape.holes.push(archHolePath(-6.6, 0, 3.6, 6.9, 3.5));
  shape.holes.push(archHolePath(6.6, 0, 3.6, 6.9, 3.5));

  const wall = extrudeShape(shape, 1.5, MATS.granite);
  wall.position.set(0, 0, FRONT_Z - 1.5);
  church.add(wall);

  // 中央山墙
  const gable = new THREE.Shape();
  gable.moveTo(-9.5, 25.4);
  gable.lineTo(0, 36.2);
  gable.lineTo(9.5, 25.4);
  gable.lineTo(-9.5, 25.4);
  const gableMesh = extrudeShape(gable, 1.5, MATS.granite);
  gableMesh.position.set(0, 0, FRONT_Z - 1.5);
  church.add(gableMesh);
  addBeam(church, new THREE.Vector3(-9.5, 25.4, FRONT_Z + 0.02), new THREE.Vector3(0, 36.2, FRONT_Z + 0.02), 0.14, MATS.trim, 4);
  addBeam(church, new THREE.Vector3(9.5, 25.4, FRONT_Z + 0.02), new THREE.Vector3(0, 36.2, FRONT_Z + 0.02), 0.14, MATS.trim, 4);

  // 山墙小圆窗
  addPlane(church, 2.1, 2.1, MATS.glassRose, 0, 29.6, FRONT_Z + 0.06, 0);
  const oculus = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.13, 8, 32), MATS.trim);
  oculus.position.set(0, 29.6, FRONT_Z + 0.08);
  church.add(oculus);
  addBox(church, 0.13, 1.8, 0.13, MATS.metal, 0, 37.0, FRONT_Z - 1.3, false, false);
  addBox(church, 0.9, 0.13, 0.13, MATS.metal, 0, 37.45, FRONT_Z - 1.3, false, false);

  // 三座透视门
  [
    { cx: 0, w: 5.6, h: 8.8, spring: 4.6, layers: 4 },
    { cx: -6.6, w: 3.6, h: 6.9, spring: 3.5, layers: 3 },
    { cx: 6.6, w: 3.6, h: 6.9, spring: 3.5, layers: 3 }
  ].forEach(function (p) {
    for (let i = 0; i < p.layers; i++) {
      const ring = archRing(p.w + 1.8 - i * 0.32, p.h + 1.5 - i * 0.26, p.w, p.h, 0.22, MATS.trim, p.spring + 0.6, p.spring);
      ring.position.set(p.cx, 0, FRONT_Z + 0.08 + i * 0.2);
      church.add(ring);
    }
    addPlane(church, p.w - 0.25, p.h * 0.62, MATS.door, p.cx, p.h * 0.31, FRONT_Z - 0.9, 0);
    addBox(church, 0.14, p.h * 0.62, 0.16, MATS.stoneDark, p.cx, p.h * 0.31, FRONT_Z - 0.82, false, false);
    addBox(church, p.w, 0.22, 0.35, MATS.trim, p.cx, p.spring + 0.25, FRONT_Z + 0.05, false, false);
  });

  // 玫瑰窗
  const rose = new THREE.Mesh(new THREE.CircleGeometry(3.5, 64), MATS.glassRose);
  rose.position.set(0, 18.2, FRONT_Z + 0.07);
  church.add(rose);
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(3.95, 0.14, 8, 64), MATS.trim);
  roseRing.position.set(0, 18.2, FRONT_Z + 0.18);
  church.add(roseRing);
  const roseRing2 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.16, 8, 64), MATS.graniteDark);
  roseRing2.position.set(0, 18.2, FRONT_Z + 0.1);
  church.add(roseRing2);
  const spokes = [];
  for (let i = 0; i < 12; i++) spokes.push({ a: (i / 12) * Math.PI * 2 });
  addInstances(church, new THREE.BoxGeometry(0.12, 3.3, 0.12), MATS.trim, spokes, function (d, e) {
    d.position.set(Math.cos(e.a) * 1.9, 18.2 + Math.sin(e.a) * 1.9, FRONT_Z + 0.22);
    d.rotation.set(0, 0, e.a - Math.PI / 2);
    d.scale.set(1, 1, 1);
  }, false);

  // 玫瑰窗两侧高窗
  [-7.7, 7.7].forEach(function (x, i) {
    addGothicWindow(church, x, 10.2, FRONT_Z + 0.01, 2.0, 7.2, 0, MATS.glassTall[i % 3], MATS.trim);
  });

  // 立面扶壁
  [-9.4, 9.4].forEach(function (x) {
    addBox(church, 1.1, 25.4, 1.2, MATS.graniteDark, x, 12.7, FRONT_Z + 0.1, true, true);
    addPinnacle(church, x, 25.4, FRONT_Z + 0.1, 0.9, 4.4);
  });
}

/* ---------------- 双尖塔 ---------------- */

function addTowers(church) {
  [-1, 1].forEach(function (side) {
    const x = side * TOWER_X;
    addBox(church, 8, 14, 8, MATS.granite, x, 7, TOWER_Z, true, true);
    addBox(church, 7.6, 12, 7.6, MATS.granite, x, 20, TOWER_Z, true, true);
    addBox(church, 7.2, 10, 7.2, MATS.graniteDark, x, 31, TOWER_Z, true, true);
    addBox(church, 8.3, 2.6, 8.3, MATS.trim, x, 37.3, TOWER_Z, true, true);
    addBox(church, 7.8, 1.8, 7.8, MATS.granite, x, 39.5, TOWER_Z, true, true);

    // 角部扶壁
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sz) {
        addBox(church, 0.8, 29, 0.8, MATS.graniteDark, x + sx * 3.8, 15, TOWER_Z + sz * 3.8, true, true);
      });
    });

    // 钟楼层高窗
    addGothicWindow(church, x, 28.5, FRONT_Z + 0.02, 1.9, 6.0, 0, MATS.glassTall[side < 0 ? 1 : 2], MATS.trim);

    // 下部尖券窗
    addGothicWindow(church, x, 18.2, FRONT_Z + 0.02, 1.5, 5.0, 0, MATS.glassSide[side < 0 ? 1 : 0], MATS.trim);

    // 西塔时钟
    if (side === -1) {
      addBox(church, 3.0, 3.0, 0.18, MATS.trim, x, 32.8, FRONT_Z + 0.02, false, false);
      const clockMat = new THREE.MeshStandardMaterial({ map: texturesClock, roughness: 0.6, transparent: true });
      const clock = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), clockMat);
      clock.position.set(x, 32.8, FRONT_Z + 0.14);
      church.add(clock);
      const clockRing = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.12, 8, 48), MATS.trim);
      clockRing.position.set(x, 32.8, FRONT_Z + 0.1);
      church.add(clockRing);
    }

    // 空八角尖塔
    const spire = new THREE.Mesh(new THREE.ConeGeometry(4.45, TOWER_TOP - TOWER_BODY_TOP, 8), MATS.granite);
    spire.position.set(x, TOWER_BODY_TOP + (TOWER_TOP - TOWER_BODY_TOP) / 2, TOWER_Z);
    spire.castShadow = true;
    spire.receiveShadow = true;
    church.add(spire);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      addBeam(church,
        new THREE.Vector3(x + Math.cos(a) * 4.5, TOWER_BODY_TOP, TOWER_Z + Math.sin(a) * 4.5),
        new THREE.Vector3(x, TOWER_TOP, TOWER_Z), 0.16, MATS.trim, 5);
    }
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.16, 6, 20), MATS.trim);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.set(x, TOWER_BODY_TOP + 0.2, TOWER_Z);
    church.add(baseRing);
    for (let k = 0; k < 4; k++) {
      const ak = (k / 4) * Math.PI * 2 + Math.PI / 4;
      addPinnacle(church, x + Math.cos(ak) * 4.0, 40.1, TOWER_Z + Math.sin(ak) * 4.0, 0.5, 3.2);
    }
    [44.3, 48.6, 52.4].forEach(function (ry) {
      const rr = 4.45 * (1 - (ry - TOWER_BODY_TOP) / (TOWER_TOP - TOWER_BODY_TOP));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.04, 0.09, 5, 20), MATS.trim);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, ry, TOWER_Z);
      church.add(ring);
    });
    // 塔顶十字
    addBox(church, 0.16, 2.0, 0.16, MATS.metal, x, TOWER_TOP + 1.0, TOWER_Z, false, false);
    addBox(church, 1.05, 0.16, 0.16, MATS.metal, x, TOWER_TOP + 1.5, TOWER_Z, false, false);
    [8, 14, 20, 26, 32, 36, 38.2].forEach(function (y) {
      addBox(church, 8.5, 0.3, 8.5, MATS.trim, x, y, TOWER_Z, false, false);
    });
  });
}

/* ---------------- 中殿 / 侧廊 / 飞扶壁 ---------------- */

function addNave(church) {
  const length = NAVE_START_Z - NAVE_END_Z;
  const centerZ = (NAVE_START_Z + NAVE_END_Z) / 2;

  // 外侧廊墙
  [-1, 1].forEach(function (side) {
    addBox(church, 1.2, 9.5, length, MATS.granite, side * NAVE_OUTER_X, 4.75, centerZ, true, true);
    addBox(church, 1.1, 12.5, length, MATS.granite, side * COL_X, 15.75, centerZ, true, true);
  });

  // 侧廊单坡屋顶
  [-1, 1].forEach(function (side) {
    addQuad(church,
      new THREE.Vector3(side * NAVE_OUTER_X, 9.8, NAVE_START_Z),
      new THREE.Vector3(side * NAVE_OUTER_X, 9.8, NAVE_END_Z),
      new THREE.Vector3(side * 5.15, 12.2, NAVE_END_Z),
      new THREE.Vector3(side * 5.15, 12.2, NAVE_START_Z), MATS.roof);
  });

  // 中央殿屋顶
  [-1, 1].forEach(function (side) {
    addQuad(church,
      new THREE.Vector3(0, ROOF_RIDGE, NAVE_START_Z),
      new THREE.Vector3(0, ROOF_RIDGE, NAVE_END_Z),
      new THREE.Vector3(side * 6.6, WALL_TOP, NAVE_END_Z),
      new THREE.Vector3(side * 6.6, WALL_TOP, NAVE_START_Z), MATS.roof);
  });
  addBox(church, 0.55, 0.4, length, MATS.roofDark, 0, ROOF_RIDGE + 0.1, centerZ, false, false);

  // 侧廊窗 / 高侧窗
  const aisleZ = [29, 23, 17, 11, 5, -1, -7, -13, -19];
  aisleZ.forEach(function (z, index) {
    [-1, 1].forEach(function (side) {
      addGothicWindow(church, side * (NAVE_OUTER_X + 0.66), 5.1, z, 2.7, 5.8, side * Math.PI / 2, MATS.glassSide[index % 2], MATS.trim);
    });
  });
  const bayZ = [30, 24, 18, 12, 6, 0, -6, -12, -18];
  bayZ.forEach(function (z, index) {
    [-1, 1].forEach(function (side) {
      addGothicWindow(church, side * (COL_X + 0.6), 16.3, z, 2.5, 6.4, side * Math.PI / 2, MATS.glassTall[index % 3], MATS.trim);
    });
  });

  // 扶壁 + 飞拱
  bayZ.forEach(function (z) {
    [-1, 1].forEach(function (side) {
      addBox(church, 1.5, 11.5, 2.0, MATS.graniteDark, side * (NAVE_OUTER_X + 0.9), 5.75, z, true, true);
      addBox(church, 1.2, 0.5, 1.7, MATS.trim, side * (NAVE_OUTER_X + 0.9), 11.6, z, false, false);
      addPinnacle(church, side * (NAVE_OUTER_X + 0.9), 11.95, z, 0.6, 3.6);
      if (z > -18) {
        addBeam(church,
          new THREE.Vector3(side * (NAVE_OUTER_X + 0.9), 10.6, z),
          new THREE.Vector3(side * 9.4, 15.2, z), 0.34, MATS.graniteDark, 6);
        addBeam(church,
          new THREE.Vector3(side * 9.4, 15.2, z),
          new THREE.Vector3(side * (COL_X + 0.55), 18.2, z), 0.3, MATS.graniteDark, 6);
        addBeam(church,
          new THREE.Vector3(side * (NAVE_OUTER_X + 0.9), 9.2, z),
          new THREE.Vector3(side * 10.2, 13.6, z), 0.18, MATS.trim, 5);
      }
    });
  });

  addTransept(church);
}

function addTransept(church) {
  const z0 = -23;
  const z1 = -13;
  [-1, 1].forEach(function (side) {
    addBox(church, 5.5, 22, 10, MATS.granite, side * 14.75, 11, -18, true, true);
    addGothicWindow(church, side * 17.51, 12.3, -18, 3.2, 9.2, side * Math.PI / 2, MATS.glassTall[side > 0 ? 1 : 0], MATS.trim);
    addPlane(church, 4.0, 10.2, MATS.graniteDark, side * 17.45, 12.3, -18, side * Math.PI / 2);
    // 耳堂屋顶（外侧）
    addQuad(church,
      new THREE.Vector3(side * 12, 26.4, z0),
      new THREE.Vector3(side * 12, 26.4, z1),
      new THREE.Vector3(side * 17.5, 22, z1),
      new THREE.Vector3(side * 17.5, 22, z0), MATS.roof);
    addQuad(church,
      new THREE.Vector3(side * 6.6, WALL_TOP, z0),
      new THREE.Vector3(side * 6.6, WALL_TOP, z1),
      new THREE.Vector3(side * 12, 26.4, z1),
      new THREE.Vector3(side * 12, 26.4, z0), MATS.roof);
    addBox(church, 0.5, 0.45, 10, MATS.trim, side * 12, 26.5, -18, false, false);
    addPinnacle(church, side * 17.5, 22, z0, 0.7, 4.0);
    addPinnacle(church, side * 17.5, 22, z1, 0.7, 4.0);
    addBox(church, 0.14, 1.5, 0.14, MATS.metal, side * 17.45, 22.8, -18.12, false, false);
    addBox(church, 0.82, 0.14, 0.14, MATS.metal, side * 17.45, 23.22, -18.12, false, false);
  });
}

/* ---------------- 后殿 ---------------- */

function addApse(church) {
  const pts = [
    [-12, APSE_START_Z], [-10.6, -30.0], [-6.6, -36.0], [-3.2, APSE_TIP_Z],
    [3.2, APSE_TIP_Z], [6.6, -36.0], [10.6, -30.0], [12, APSE_START_Z]
  ];
  const walls = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector2(pts[i][0], pts[i][1]);
    const b = new THREE.Vector2(pts[i + 1][0], pts[i + 1][1]);
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const len = Math.hypot(dx, dz);
    const mesh = addBox(church, len, 22, 1.0, MATS.granite, (a.x + b.x) / 2, 11, (a.y + b.y) / 2, true, true);
    mesh.rotation.y = Math.atan2(-dz, dx);
    walls.push({ a: a, b: b, len: len });
    // 外侧高窗（只做北侧 5 段）
    if (i >= 1 && i <= 5) {
      const mx = (a.x + b.x) / 2;
      const mz = (a.y + b.y) / 2;
      const nx = mx;
      const nz = mz - APSE_START_Z;
      const nl = Math.hypot(nx, nz) || 1;
      const rotY = Math.atan2(nx / nl, nz / nl);
      addGothicWindow(church, mx + (nx / nl) * 0.62, 12, mz + (nz / nl) * 0.62, 2.2, 8, rotY, MATS.glassTall[i % 3], MATS.trim);
    }
  }
  // 后殿屋顶（多边形锥体的简化）
  const apseRoof = new THREE.Mesh(new THREE.ConeGeometry(11.2, 4.5, 8), MATS.roof);
  apseRoof.position.set(0, 24.25, -30.5);
  apseRoof.rotation.y = Math.PI / 8;
  apseRoof.scale.set(1, 1, 1.12);
  apseRoof.castShadow = true;
  apseRoof.receiveShadow = true;
  church.add(apseRoof);
  // 后殿扶壁
  [-1, 1].forEach(function (side) {
    [0, 1, 2].forEach(function (k) {
      const z = -26 - k * 5.2;
      addBox(church, 1.1, 10, 1.6, MATS.graniteDark, side * (11.6 - k * 1.3), 5, z, true, true);
    });
  });
}

/* ---------------- 组装 ---------------- */

export function create() {
  seed = 1863;
  pinnacles = [];
  texturesRose = makeRose();
  texturesClock = makeClock();
  const textures = {
    granite: makeGranite(),
    paving: makePaving(),
    asphalt: makeAsphalt(),
    roof: makeRoof(),
    rose: texturesRose,
    win0: makeGothicWindow(0),
    win1: makeGothicWindow(1),
    win2: makeGothicWindow(2)
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "sacred-heart-model";

  addBase(root);
  addStreet(root);
  addTrees(root);

  const church = new THREE.Group();
  church.name = "sacred-heart-church";
  church.position.set(0, GROUND_Y, 0);
  root.add(church);
  addFacade(church);
  addTowers(church);
  addNave(church);
  addApse(church);
  flushPinnacles(church);

  const anchors = {
    overview: new THREE.Vector3(0, 24, 0),
    facade: new THREE.Vector3(0, 27, FRONT_Z),
    rose: new THREE.Vector3(0, 18.2, FRONT_Z + 0.4),
    portal: new THREE.Vector3(0, 5.2, FRONT_Z + 0.5),
    tower: new THREE.Vector3(-TOWER_X, 44, FRONT_Z + 0.4),
    buttress: new THREE.Vector3(13.2, 12, 6),
    apse: new THREE.Vector3(0, 13, -36),
    granite: new THREE.Vector3(-5.5, 7, FRONT_Z + 0.5),
    detail: new THREE.Vector3(-5.5, 7, FRONT_Z + 0.5)
  };

  return {
    group: root,
    anchors: anchors,
    dispose: function () { dispose(root); }
  };
}

let texturesRose = null;
let texturesClock = null;

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