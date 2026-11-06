/*
 * 广州塔 · 小蛮腰 · 风格化场地 diorama（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：塔基裙摆/玻璃大厅—24 柱 × 46 环 × 1104 斜撑塔身—450 m 平台/摩天轮—488 m 平台/桅杆—南广场映塔水池—北侧滨水大台阶—珠江/海心桥—压缩 CBD 剪影。
 * 不是 600 m 塔身全内部，也不是测绘级总平面；北岸 CBD 与海心桥为压缩示意。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");
const PAL = window.CantonPalette;
if (!PAL) throw new Error("Canton palette is not loaded");

const SITE_W = 220;
const SITE_D = 380;
const BASE_Y = 0.9;
const GROUND_Y = 1.02;

const N = 24;
const BODY_H = 454;
const RING_GROUPS = 46;
const RING_LEVELS = 47;
const MAST_TOP = 600;

const BASE_ELL = { a: 40, b: 30, rot: Math.PI * 135 / 180 };
const TOP_ELL = { a: 27, b: 20.25, rot: Math.PI };
const TOP_CENTER = new THREE.Vector3(10, 0, 0);
const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

let seed = 771026;
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

function makePaving() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d8d3c8";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      const v = 198 + Math.floor(random() * 24);
      ctx.fillStyle = "rgb(" + v + "," + (v - 3) + "," + (v - 10) + ")";
      ctx.fillRect(x + 2, y + 2, 124, 124);
    }
  }
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = "rgba(74,70,62," + range(0.02, 0.08).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(1, 3), range(1, 3));
  }
  return colorTexture(c, 6, 8);
}

function makeRipple() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#cfcabf";
  ctx.fillRect(0, 0, 512, 512);
  for (let r = 20; r < 380; r += 22) {
    ctx.strokeStyle = "rgba(120,112,100,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = "rgba(80,76,68," + range(0.02, 0.07).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(1, 4), range(1, 3));
  }
  return colorTexture(c, 3, 3);
}

function makeWater() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#6e96a1";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = "rgba(230,242,244," + range(0.04, 0.14).toFixed(3) + ")";
    ctx.fillRect(random() * 256, random() * 256, range(2, 16), 1);
  }
  return colorTexture(c, 4, 4);
}

function makeCity() {
  const c = makeCanvas(128, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#9baeb3";
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 14) {
    for (let x = 6; x < 122; x += 12) {
      if (random() > 0.44) {
        ctx.fillStyle = random() > 0.8 ? "rgba(240,222,176,0.5)" : "rgba(204,222,224,0.32)";
        ctx.fillRect(x, y, 7, 8);
      }
    }
  }
  return colorTexture(c, 1, 4);
}

function makeTextCanvas(text, opts) {
  const o = opts || {};
  const w = o.w || 512;
  const h = o.h || 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, w, h);
  }
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = o.borderWidth || 10;
    ctx.strokeRect(ctx.lineWidth / 2 + 4, ctx.lineWidth / 2 + 4, w - ctx.lineWidth - 8, h - ctx.lineWidth - 8);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = (o.weight || "700") + " " + (o.size || 72) + 'px ' + (o.font || '"Songti SC","SimSun","STSong",serif');
  ctx.fillStyle = o.color || "#ead9a8";
  ctx.fillText(text, w / 2, h / 2 + 2);
  return c;
}

/* ---------------- 材质 ---------------- */

let MATS = null;

function std(opts) {
  const o = Object.assign({}, opts);
  if (!("fog" in o)) o.fog = false;
  return new THREE.MeshStandardMaterial(o);
}

function createMaterials(textures) {
  return {
    base: std({ map: textures.paving, color: PAL.colors.earth, roughness: 0.96 }),
    plaza: std({ map: textures.paving, color: 0xc6c0b4, roughness: 0.95 }),
    ripple: std({ map: textures.ripple, color: 0xc0baae, roughness: 0.94 }),
    stone: std({ color: 0xb4b0a5, roughness: 0.9 }),
    white: std({ color: 0xd4cfc4, roughness: 0.7, metalness: 0.04 }),
    whiteDim: std({ color: 0xbdb8ae, roughness: 0.8 }),
    steel: std({ color: 0x3f515a, roughness: 0.72, metalness: 0.12 }),
    steelDark: std({ color: 0x5d676d, roughness: 0.55, metalness: 0.3 }),
    core: std({ color: 0x414c54, roughness: 0.72, metalness: 0.16 }),
    glass: std({ color: 0x7fa9b5, roughness: 0.14, metalness: 0.12, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    glassLobby: std({ color: 0x8fb3bd, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }),
    water: std({ map: textures.water, color: 0x628a97, roughness: 0.22, metalness: 0.08 }),
    pool: std({ map: textures.water, color: 0x92b5bd, roughness: 0.18, metalness: 0.06 }),
    red: std({ color: 0xc33a2b, roughness: 0.64 }),
    amber: std({ color: 0xd78a3c, roughness: 0.6 }),
    capsule: std({ color: 0xffffff, roughness: 0.52, metalness: 0.06 }),
    trunk: std({ color: 0x66513d, roughness: 0.96 }),
    foliage: std({ color: 0x3d5a33, roughness: 0.96, flatShading: true }),
    foliage2: std({ color: 0x2c4526, roughness: 0.96, flatShading: true }),
    city: std({ map: textures.city, color: 0xffffff, roughness: 0.58, metalness: 0.12 }),
    cityCap: std({ color: 0xb6c0c2, roughness: 0.7 }),
    bridge: std({ color: 0xf0eee7, roughness: 0.62, metalness: 0.04 }),
    lamp: std({ color: 0xfff0c2, emissive: 0x9a6a1e, emissiveIntensity: 0.6, roughness: 0.4 }),
    dark: std({ color: 0x3d464a, roughness: 0.8 })
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

function addBeam(parent, a, b, radius, mat, seg) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.01) return null;
  const geo = new THREE.CylinderGeometry(radius, radius, 1, seg || 5, 1, true);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(1, len, 1);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, points, radius, mat, segments, radial) {
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.45);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments || 48, radius, radial || 4, true), mat);
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
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
    map: tex,
    transparent: !o.bg,
    depthWrite: Boolean(o.bg),
    fog: false,
    roughness: 0.75,
    metalness: 0.04,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.width || 2, o.height || 0.5), mat);
  mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.rotationY) mesh.rotation.y = o.rotationY;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

/* ---------------- 几何工具 ---------------- */

function mergeGeos(geos) {
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  let hasUV = true;
  geos.forEach(function (g) {
    if (!g.attributes.uv) hasUV = false;
  });
  geos.forEach(function (g) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    const ix = g.index;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i));
      else nor.push(0, 1, 0);
      if (hasUV && u) uv.push(u.getX(i), u.getY(i));
    }
    if (ix) {
      for (let j = 0; j < ix.count; j++) idx.push(ix.getX(j) + off);
    } else {
      for (let k = 0; k < p.count; k++) idx.push(k + off);
    }
    off += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  if (hasUV && uv.length) out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

function flatEllipseRing(rx, rz, innerRatio, segs) {
  const g = new THREE.RingGeometry(innerRatio, 1, segs || 48);
  g.rotateX(-Math.PI / 2);
  g.scale(rx, 1, rz);
  return g;
}

function ellipsePoints(rx, rz, count, y) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * rx, y || 0, Math.sin(a) * rz));
  }
  return pts;
}

/* ---------------- 塔身数学 ---------------- */

function ellipsePoint(e, t, y, c) {
  const x = e.b * Math.cos(t) * Math.cos(e.rot) - e.a * Math.sin(t) * Math.sin(e.rot);
  const z = e.b * Math.cos(t) * Math.sin(e.rot) + e.a * Math.sin(t) * Math.cos(e.rot);
  return new THREE.Vector3(c.x + x, y, c.z + z);
}

function bottomPoint(i) {
  return ellipsePoint(BASE_ELL, (90 + i * 15) * Math.PI / 180, 0, ZERO);
}

function topPoint(i) {
  return ellipsePoint(TOP_ELL, (180 + i * 15) * Math.PI / 180, BODY_H, TOP_CENTER);
}

function pointAt(i, y) {
  const t = y / BODY_H;
  return bottomPoint(i).lerp(topPoint(i), t);
}

function ringYs() {
  const ys = [];
  for (let i = 0; i < RING_LEVELS; i++) ys.push(i * BODY_H / (RING_LEVELS - 1));
  return ys;
}

function bodyExtents(y) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < N; i++) {
    const p = pointAt(i, y);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    rx: (maxX - minX) / 2,
    rz: (maxZ - minZ) / 2
  };
}

/* ---------------- 场地 ---------------- */

function addBase(root) {
  // 南侧主台座（z -55 .. 190），北侧江岸低台（z -190 .. -130）
  addBox(root, SITE_W, BASE_Y, 245, MATS.base, 0, BASE_Y / 2, 67.5, false, true);
  addBox(root, SITE_W, 0.16, 60, MATS.base, 0, 0.08, -160, false, true);
  addBox(root, SITE_W - 1.4, 0.1, 243, MATS.plaza, 0, BASE_Y + 0.05, 67.5, false, true);
  addBox(root, 150, 0.12, 75, MATS.plaza, 0, GROUND_Y + 0.01, -92.5, false, true);
  addBox(root, SITE_W - 1.4, 0.08, 58, MATS.stone, 0, 0.2, -160, false, true);

  // 南侧台座边缘的铭牌
  addBox(root, 14.4, 1.25, 0.22, MATS.dark, 0, 0.62, 190.03, false, false);
  addTextPlane(root, "广州塔 · 小蛮腰", {
    w: 1024, h: 150, bg: "#2b3538", border: "#c9b06a", borderWidth: 8,
    color: "#efe0b5", size: 76, width: 13.4, height: 1.0,
    x: 0, y: 0.64, z: 190.16
  });

  // 南广场铺装 + 映塔水池
  addBox(root, 168, 0.06, 122, MATS.ripple, 0, GROUND_Y + 0.03, 99, false, true);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 64), MATS.pool);
  pool.rotation.x = -Math.PI / 2;
  pool.scale.set(30, 20, 1);
  pool.position.set(0, GROUND_Y + 0.07, 86);
  root.add(pool);
  const coping = new THREE.Mesh(flatEllipseRing(34, 24, 0.88, 64), MATS.white);
  coping.position.set(0, GROUND_Y + 0.09, 86);
  root.add(coping);
  [26, 21, 16].forEach(function (r, i) {
    const ring = new THREE.Mesh(flatEllipseRing(r + 2.4, r * 0.68 + 1.7, 0.985, 48), MATS.whiteDim);
    ring.position.set(0, GROUND_Y + 0.085 + i * 0.004, 86);
    root.add(ring);
  });
  // 水池四角花池
  [[-34, 62], [34, 62], [-34, 110], [34, 110]].forEach(function (p) {
    addBox(root, 7.5, 1.1, 7.5, MATS.stone, p[0], GROUND_Y + 0.55, p[1], true, true);
    addBox(root, 6.6, 0.9, 6.6, MATS.foliage, p[0], GROUND_Y + 1.45, p[1], true, true);
  });
  // 两翼商业体量（只做外壳）
  [-1, 1].forEach(function (side) {
    addBox(root, 22, 10, 44, MATS.whiteDim, side * 73, GROUND_Y + 5, 118, true, true);
    addBox(root, 22.4, 4.6, 40, MATS.glass, side * 73, GROUND_Y + 9.2, 118, false, true);
  });
}

function addWaterfront(root) {
  // 北侧滨水大台阶：12 级，从主台面落到江岸
  const steps = 12;
  const z0 = -55;
  const z1 = -128;
  const depth = (z0 - z1) / steps;
  const stepEntries = [];
  for (let i = 0; i < steps; i++) {
    const top = GROUND_Y - (i + 1) * 0.052;
    stepEntries.push({
      z: z0 - (i + 0.5) * depth,
      top: top,
      h: top - 0.28
    });
  }
  addInstances(root, new THREE.BoxGeometry(1, 1, 1), MATS.whiteDim, stepEntries, function (d, e) {
    d.position.set(0, 0.28 + e.h / 2, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(150, e.h, depth + 0.06);
  }, false);

  // 台阶两侧白色弧形挡墙 + 栏杆
  [-1, 1].forEach(function (side) {
    addBox(root, 1.4, 2.4, 76, MATS.white, side * 76, GROUND_Y + 0.6, -91, true, true);
    const posts = [];
    for (let i = 0; i < 12; i++) {
      posts.push({ x: side * 76, z: z0 - (i + 0.5) * depth, y: GROUND_Y - (i + 1) * 0.052 });
    }
    addInstances(root, new THREE.BoxGeometry(0.12, 1.15, 0.12), MATS.white, posts, function (d, e) {
      d.position.set(e.x, e.y + 0.58, e.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    }, false);
    const rail = addBox(root, 0.1, 0.1, 76, MATS.white, side * 76, GROUND_Y + 1.35, -91, false, false);
    rail.rotation.x = Math.atan2(0.62, 73);
  });

  // 二层平台边缘的白色悬挑遮阳
  addBox(root, 66, 0.8, 10, MATS.white, -4, GROUND_Y + 8.2, -74, true, true);
  [-26, 8].forEach(function (x) {
    addCylinder(root, 0.35, 0.45, 7.4, 6, MATS.white, x, GROUND_Y + 4.0, -74);
  });

  // 江岸矮墙、滨水步道、栏杆
  addBox(root, SITE_W, 0.9, 1.2, MATS.stone, 0, 0.7, -130, true, true);
  addBox(root, SITE_W, 0.1, 10, MATS.plaza, 0, 0.28, -135, false, true);
  const promPosts = [];
  for (let x = -104; x <= 104; x += 6) promPosts.push({ x: x, z: -139.4 });
  addInstances(root, new THREE.CylinderGeometry(0.05, 0.05, 1.7, 4), MATS.white, promPosts, function (d, e) {
    d.position.set(e.x, 1.15, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
  addBox(root, 210, 0.08, 0.08, MATS.white, 0, 2.0, -139.4, false, false);
  addBox(root, 210, 0.07, 0.07, MATS.white, 0, 1.45, -139.4, false, false);

  // 珠江水面（压缩示意）
  const river = new THREE.Mesh(new THREE.PlaneGeometry(220, 36), MATS.water);
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, 0.36, -153);
  root.add(river);

  // 北岸步道与栏杆
  addBox(root, 220, 0.12, 20, MATS.plaza, 0, 0.36, -177, false, true);
  addBox(root, 220, 0.8, 0.9, MATS.stone, 0, 0.7, -168, true, true);
  const northPosts = [];
  for (let x = -104; x <= 104; x += 7) northPosts.push({ x: x });
  addInstances(root, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4), MATS.white, northPosts, function (d, e) {
    d.position.set(e.x, 1.15, -168.4);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
  addBox(root, 210, 0.08, 0.08, MATS.white, 0, 1.85, -168.4, false, false);

  // 海心桥（压缩示意，塔西约 90 m）
  addBridge(root);
}

function addBridge(root) {
  const X = -92;
  const z0 = -62;
  const z1 = -176;
  const deckY = 7.5;
  const halfW = 4.6;

  // 两端坡道
  const rampS = addBox(root, halfW * 2, 0.7, 23, MATS.bridge, X, 4.2, -72, true, true);
  rampS.rotation.x = -Math.atan2(deckY - GROUND_Y, 22);
  const rampN = addBox(root, halfW * 2, 0.7, 22, MATS.bridge, X, 4.2, -166, true, true);
  rampN.rotation.x = Math.atan2(deckY - 0.36, 21);

  // 桥面
  addBox(root, halfW * 2, 0.55, 86, MATS.bridge, X, deckY, -119, true, true);
  [-halfW, halfW].forEach(function (dx) {
    addBox(root, 0.1, 0.1, 86, MATS.white, X + dx, deckY + 1.45, -119, false, false);
    addBox(root, 0.07, 0.07, 86, MATS.white, X + dx, deckY + 0.85, -119, false, false);
  });
  const posts = [];
  for (let i = 0; i < 15; i++) {
    const z = z0 - 5 - i * 5.6;
    posts.push({ x: X - halfW, z: z });
    posts.push({ x: X + halfW, z: z });
  }
  addInstances(root, new THREE.CylinderGeometry(0.06, 0.06, 1.45, 4), MATS.white, posts, function (d, e) {
    d.position.set(e.x, deckY + 0.72, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);

  // 主拱与吊杆
  const archPts = [];
  const archZ0 = -84;
  const archZ1 = -154;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    archPts.push(new THREE.Vector3(
      X + Math.sin(t * Math.PI) * 2.2,
      deckY + Math.sin(t * Math.PI) * 34,
      archZ0 + (archZ1 - archZ0) * t
    ));
  }
  const archCurve = new THREE.CatmullRomCurve3(archPts, false, "catmullrom", 0.5);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 48, 1.35, 6, false), MATS.bridge);
  arch.castShadow = false;
  root.add(arch);
  for (let i = 2; i < 23; i += 2) {
    const t = i / 24;
    const az = archZ0 + (archZ1 - archZ0) * t;
    const ay = deckY + Math.sin(t * Math.PI) * 34;
    addBeam(root, new THREE.Vector3(X, ay, az), new THREE.Vector3(X, deckY + 0.3, az), 0.055, MATS.white, 4);
  }
  [-1, 1].forEach(function (side) {
    addCylinder(root, 1.2, 1.6, 12, 8, MATS.bridge, X + side * 12, 6, -96);
    addCylinder(root, 1.2, 1.6, 12, 8, MATS.bridge, X + side * 12, 6, -144);
  });
}

function addCity(root) {
  // 北岸 CBD：压缩高度，只做剪影；不放真实 530/438 m，以免压过主塔
  const entries = [];
  const caps = [];
  function block(x, z, w, d, h, color) {
    entries.push({ x: x, z: z, w: w, d: d, h: h, color: color });
    caps.push({ x: x, z: z, w: w + 0.4, d: d + 0.4, y: 0.36 + h + 0.2 });
  }
  const cols = [0xbfc9cb, 0xaebbbf, 0xcdd4d3, 0x9fadb2];
  for (let i = 0; i < 22; i++) {
    const x = -102 + i * 9.7 + range(-2, 2);
    const z = -181 + range(-3, 3);
    const h = range(8, 34) * (1 - Math.abs(x) / 240);
    block(x, z, range(5, 8), range(5, 8), h, cols[i % cols.length]);
  }
  // 东塔 / 西塔 / 中信的压缩剪影
  block(-42, -184, 9, 9, 48, 0xb7c4c8);
  block(48, -184, 9, 9, 42, 0xb1bfc3);
  block(86, -185, 8, 8, 36, 0xaab8bc);

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  const bodies = new THREE.InstancedMesh(unit, MATS.city, entries.length);
  entries.forEach(function (e, i) {
    dummy.position.set(e.x, 0.36 + e.h / 2, e.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(e.w, e.h, e.d);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    bodies.setColorAt(i, new THREE.Color(e.color));
  });
  bodies.castShadow = false;
  bodies.receiveShadow = false;
  root.add(bodies);

  const capMesh = new THREE.InstancedMesh(unit.clone(), MATS.cityCap, caps.length);
  caps.forEach(function (e, i) {
    dummy.position.set(e.x, e.y, e.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(e.w, 0.4, e.d);
    dummy.updateMatrix();
    capMesh.setMatrixAt(i, dummy.matrix);
  });
  capMesh.castShadow = false;
  root.add(capMesh);

  // 城市薄雾
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0xf2efe7, transparent: true, opacity: 0.34,
    depthWrite: false, side: THREE.DoubleSide, fog: false
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(210, 70), hazeMat);
  haze.position.set(0, 26, -179.5);
  root.add(haze);
}

function addTrees(root) {
  const trunks = [];
  const crowns = [];
  function plant(x, z, y, s) {
    if (Math.abs(x) < 20 && z > 20 && z < 120) return;
    if (Math.abs(x) < 12 && z < -50) return;
    trunks.push({ x: x, z: z, y: y, s: s });
    crowns.push({ x: x, z: z, y: y + 2.3 * s, s: s });
  }
  // 南广场两列
  for (let i = 0; i < 7; i++) {
    plant(-62, 48 + i * 16, GROUND_Y, range(0.9, 1.25));
    plant(62, 48 + i * 16, GROUND_Y, range(0.9, 1.25));
  }
  // 水池外侧
  [[-50, 86], [50, 86], [-50, 116], [50, 116]].forEach(function (p) {
    plant(p[0], p[1], GROUND_Y, range(0.8, 1.0));
  });
  // 北岸
  for (let i = 0; i < 11; i++) {
    plant(-92 + i * 18.4, -174, 0.36, range(0.6, 0.85));
  }
  addInstances(root, new THREE.CylinderGeometry(0.26, 0.4, 2.6, 5), MATS.trunk, trunks, function (d, e) {
    d.position.set(e.x, e.y + 1.3 * e.s, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(e.s, e.s, e.s);
  }, true);
  addInstances(root, new THREE.IcosahedronGeometry(1.7, 0), MATS.foliage, crowns, function (d, e) {
    d.position.set(e.x, e.y + 4.0 * e.s, e.z);
    d.rotation.set(0, e.x * 0.2, 0);
    d.scale.set(e.s * 1.15, e.s * 0.95, e.s * 1.15);
  }, true);

  const shrubs = [];
  for (let i = 0; i < 18; i++) {
    shrubs.push({ x: range(-95, 95), z: range(-176, -170), y: 0.36, s: range(0.5, 0.9) });
  }
  addInstances(root, new THREE.IcosahedronGeometry(0.7, 0), MATS.foliage2, shrubs, function (d, e) {
    d.position.set(e.x, e.y + 0.45, e.z);
    d.rotation.set(0, e.x * 0.4, 0);
    d.scale.set(e.s, e.s * 0.7, e.s);
  }, false);
}

function addLamps(root) {
  const poles = [];
  const heads = [];
  [[-74, 40], [74, 40], [-74, 150], [74, 150], [-40, 34], [40, 34], [-40, 158], [40, 158]].forEach(function (p) {
    poles.push({ x: p[0], z: p[1], y: GROUND_Y });
    heads.push({ x: p[0], z: p[1], y: GROUND_Y + 5.2 });
  });
  addInstances(root, new THREE.CylinderGeometry(0.1, 0.16, 5.2, 6), MATS.steelDark, poles, function (d, e) {
    d.position.set(e.x, e.y + 2.6, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
  addInstances(root, new THREE.SphereGeometry(0.3, 8, 6), MATS.lamp, heads, function (d, e) {
    d.position.set(e.x, e.y, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
}

/* ---------------- 塔基 ---------------- */

function addTowerBase(tower) {
  // 玻璃大厅
  const lobby = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 30, 36, 1, true), MATS.glassLobby);
  lobby.scale.set(42, 1, 32);
  lobby.position.y = 15;
  lobby.castShadow = false;
  lobby.receiveShadow = true;
  tower.add(lobby);

  // 白色屋面环
  const roof = new THREE.Mesh(flatEllipseRing(45, 35, 0.7, 64), MATS.white);
  roof.position.y = 30;
  tower.add(roof);
  addTube(tower, ellipsePoints(45, 35, 64, 30), 0.45, MATS.white, 64, 4);

  // 24 根外张裙摆肋
  const ribs = [];
  for (let i = 0; i < N; i++) {
    const base = bottomPoint(i);
    const foot = new THREE.Vector3(base.x * 1.62, 0, base.z * 1.62);
    const top = base.clone();
    top.y = 27;
    ribs.push({ a: foot, b: top });
  }
  const ribGeo = new THREE.CylinderGeometry(0.5, 0.7, 1, 5, 1, true);
  const ribMesh = new THREE.InstancedMesh(ribGeo, MATS.white, ribs.length);
  const dummy = new THREE.Object3D();
  ribs.forEach(function (e, i) {
    const dir = new THREE.Vector3().subVectors(e.b, e.a);
    dummy.position.copy(e.a).add(e.b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    dummy.scale.set(1, dir.length(), 1);
    dummy.updateMatrix();
    ribMesh.setMatrixAt(i, dummy.matrix);
  });
  ribMesh.instanceMatrix.needsUpdate = true;
  ribMesh.castShadow = false;
  ribMesh.receiveShadow = true;
  tower.add(ribMesh);

  addTube(tower, ellipsePoints(40, 30, N, 0), 0.5, MATS.white, N, 4);
  addTube(tower, ellipsePoints(40, 30, N, 27), 0.55, MATS.white, N, 4);
}

/* ---------------- 塔身 ---------------- */

function addLattice(tower) {
  const ys = ringYs();
  const dummy = new THREE.Object3D();

  // 24 根直斜柱
  const colGeo = new THREE.CylinderGeometry(0.6, 1.0, 1, 8, 1, true);
  const columns = new THREE.InstancedMesh(colGeo, MATS.steel, N);
  for (let i = 0; i < N; i++) {
    const a = bottomPoint(i);
    const b = topPoint(i);
    const dir = new THREE.Vector3().subVectors(b, a);
    dummy.position.copy(a).add(b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    dummy.scale.set(1, dir.length(), 1);
    dummy.updateMatrix();
    columns.setMatrixAt(i, dummy.matrix);
  }
  columns.instanceMatrix.needsUpdate = true;
  columns.castShadow = false;
  columns.receiveShadow = true;
  tower.add(columns);

  // 47 道环梁
  const ringGeos = [];
  ys.forEach(function (y) {
    const pts = [];
    for (let k = 0; k < N; k++) pts.push(pointAt(k, y));
    const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.45);
    ringGeos.push(new THREE.TubeGeometry(curve, 48, 0.38, 4, true));
  });
  const rings = new THREE.Mesh(mergeGeos(ringGeos), MATS.steel);
  rings.castShadow = false;
  rings.receiveShadow = true;
  tower.add(rings);
  ringGeos.forEach(function (g) { g.dispose(); });

  // 1104 根斜撑
  const diagGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 4, 1, true);
  const diagonals = new THREE.InstancedMesh(diagGeo, MATS.steel, RING_GROUPS * N);
  let di = 0;
  for (let j = 0; j < RING_LEVELS - 1; j++) {
    const sign = (j % 2 === 0) ? 1 : -1;
    for (let c = 0; c < N; c++) {
      const p0 = pointAt(c, ys[j]);
      const p1 = pointAt((c + sign + N) % N, ys[j + 1]);
      dummy.position.copy(p0).add(p1).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(UP, new THREE.Vector3().subVectors(p1, p0).normalize());
      dummy.scale.set(1, p0.distanceTo(p1), 1);
      dummy.updateMatrix();
      diagonals.setMatrixAt(di++, dummy.matrix);
    }
  }
  diagonals.count = di;
  diagonals.instanceMatrix.needsUpdate = true;
  diagonals.castShadow = false;
  diagonals.receiveShadow = true;
  tower.add(diagonals);

  // 节点
  const nodeGeo = new THREE.OctahedronGeometry(0.5, 0);
  const nodeItems = [];
  ys.forEach(function (y) {
    const ext = bodyExtents(y);
    const r = Math.max(0.3, Math.min(0.62, 0.18 + (ext.rx + ext.rz) * 0.012));
    for (let k = 0; k < N; k++) nodeItems.push({ p: pointAt(k, y), s: r / 0.5 });
  });
  addInstances(tower, nodeGeo, MATS.steel, nodeItems, function (d, e) {
    d.position.copy(e.p);
    d.rotation.set(0, 0, 0);
    d.scale.set(e.s, e.s, e.s);
  }, false);

  // 核心筒
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, BODY_H, 32, 1, true), MATS.core);
  core.scale.set(9.7, 1, 8.1);
  core.position.y = BODY_H / 2;
  core.castShadow = false;
  core.receiveShadow = true;
  tower.add(core);

  // 楼层环
  const floorGeos = [];
  [84, 116, 147, 168, 334, 355, 428, 433, 450].forEach(function (y) {
    const ext = bodyExtents(y);
    const g = flatEllipseRing(Math.max(1.2, ext.rx - 1.6), Math.max(1, ext.rz - 1.4), 0.93, 36);
    g.translate(ext.cx, y, ext.cz);
    floorGeos.push(g);
  });
  const floors = new THREE.Mesh(mergeGeos(floorGeos), MATS.steelDark);
  floors.castShadow = false;
  floors.receiveShadow = true;
  tower.add(floors);
  floorGeos.forEach(function (g) { g.dispose(); });

  // 玻璃功能带
  const bandGeos = [];
  [[84, 116], [147, 168], [300, 320], [355, 372], [420, 436]].forEach(function (b) {
    const y0 = b[0], y1 = b[1];
    const ym = (y0 + y1) / 2;
    const ext = bodyExtents(ym);
    const g = new THREE.CylinderGeometry(1, 1, y1 - y0, 36, 1, true);
    g.scale(ext.rx + 0.35, 1, ext.rz + 0.35);
    g.translate(ext.cx, ym, ext.cz);
    bandGeos.push(g);
  });
  const bands = new THREE.Mesh(mergeGeos(bandGeos), MATS.glass);
  bands.castShadow = false;
  bands.receiveShadow = false;
  tower.add(bands);
  bandGeos.forEach(function (g) { g.dispose(); });

  return { columns: N, rings: RING_GROUPS, diagonals: di };
}

/* ---------------- 450 m 平台 / 摩天轮 / 桅杆 ---------------- */

function addCrown(tower) {
  const dummy = new THREE.Object3D();

  // 450 m 观景平台（环形外挑）
  const deck = new THREE.Mesh(flatEllipseRing(38, 30, 0.56, 64), MATS.white);
  deck.position.y = 450.5;
  deck.castShadow = false;
  deck.receiveShadow = true;
  tower.add(deck);
  const deckDark = new THREE.Mesh(flatEllipseRing(37, 29, 0.97, 64), MATS.steelDark);
  deckDark.position.y = 450.9;
  tower.add(deckDark);
  addTube(tower, ellipsePoints(38, 30, 64, 450.7), 0.7, MATS.white, 64, 4);

  // 平台玻璃栏杆
  const posts = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    posts.push({ x: Math.cos(a) * 37.2, z: Math.sin(a) * 29.2 });
  }
  addInstances(tower, new THREE.CylinderGeometry(0.08, 0.08, 2.6, 4), MATS.white, posts, function (d, e) {
    d.position.set(e.x, 452.6, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
  addTube(tower, ellipsePoints(37.2, 29.2, 64, 453.8), 0.09, MATS.white, 64, 4);

  // 摩天轮轨道
  const track = addTube(tower, ellipsePoints(33, 27, 64, 452.2), 0.5, MATS.steel, 64, 5);
  track.castShadow = false;
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    arms.push({ x: Math.cos(a) * 20, z: Math.sin(a) * 16, x2: Math.cos(a) * 33, z2: Math.sin(a) * 27 });
  }
  addInstances(tower, new THREE.BoxGeometry(1, 0.18, 0.18), MATS.steel, arms, function (d, e) {
    const a = new THREE.Vector3(e.x, 452.2, e.z);
    const b = new THREE.Vector3(e.x2, 452.2, e.z2);
    d.position.copy(a).add(b).multiplyScalar(0.5);
    d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().subVectors(b, a).normalize());
    d.scale.set(1, 1, a.distanceTo(b));
  }, false);

  // 16 个球舱
  const capsuleGeo = (function () {
    const cy = new THREE.CylinderGeometry(1, 1, 2.2, 8, 1, false);
    const s1 = new THREE.SphereGeometry(1, 8, 6);
    s1.translate(0, 1.1, 0);
    const s2 = new THREE.SphereGeometry(1, 8, 6);
    s2.translate(0, -1.1, 0);
    const g = mergeGeos([cy, s1, s2]);
    cy.dispose(); s1.dispose(); s2.dispose();
    return g;
  })();
  const capsules = [];
  const capColors = [0xdb6a3a, 0xf1eee6, 0x4f8fa8];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    capsules.push({
      x: Math.cos(a) * 33,
      z: Math.sin(a) * 27,
      color: capColors[i % capColors.length]
    });
  }
  const capsuleMesh = new THREE.InstancedMesh(capsuleGeo, MATS.capsule, 16);
  capsules.forEach(function (e, i) {
    dummy.position.set(e.x, 451.4, e.z);
    dummy.rotation.set(0, Math.atan2(e.x, e.z), 0);
    dummy.scale.set(0.95, 0.75, 0.95);
    dummy.updateMatrix();
    capsuleMesh.setMatrixAt(i, dummy.matrix);
    capsuleMesh.setColorAt(i, new THREE.Color(e.color));
  });
  capsuleMesh.instanceMatrix.needsUpdate = true;
  capsuleMesh.castShadow = false;
  tower.add(capsuleMesh);

  // 454 m 塔冠
  const crown = new THREE.Mesh(flatEllipseRing(28.5, 21.5, 0.7, 48), MATS.white);
  crown.position.y = 454.2;
  tower.add(crown);
  addTube(tower, ellipsePoints(28.5, 21.5, 48, 454.4), 0.45, MATS.white, 48, 4);

  // 桅杆下段白色格构（454–550）
  const mastRibs = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mastRibs.push({
      a: new THREE.Vector3(Math.cos(a) * 5.2, 454, Math.sin(a) * 5.2),
      b: new THREE.Vector3(Math.cos(a) * 1.5, 550, Math.sin(a) * 1.5)
    });
  }
  const mastRibMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 4, 1, true), MATS.white, 8);
  mastRibs.forEach(function (e, i) {
    const dir = new THREE.Vector3().subVectors(e.b, e.a);
    dummy.position.copy(e.a).add(e.b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    dummy.scale.set(1, dir.length(), 1);
    dummy.updateMatrix();
    mastRibMesh.setMatrixAt(i, dummy.matrix);
  });
  mastRibMesh.instanceMatrix.needsUpdate = true;
  tower.add(mastRibMesh);
  [470, 488, 510, 530, 550].forEach(function (y) {
    const r = 5.2 - (y - 454) / 96 * 3.7;
    addTube(tower, ellipsePoints(r, r, 24, y), 0.1, MATS.white, 24, 3);
  });

  // 488 m 平台
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 1.4, 8), MATS.white);
  platform.position.y = 488;
  platform.rotation.y = Math.PI / 8;
  platform.castShadow = false;
  tower.add(platform);
  const platformPosts = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    platformPosts.push({ x: Math.cos(a) * 8.6, z: Math.sin(a) * 8.6 });
  }
  addInstances(tower, new THREE.CylinderGeometry(0.06, 0.06, 2.0, 4), MATS.white, platformPosts, function (d, e) {
    d.position.set(e.x, 489.9, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
  addTube(tower, ellipsePoints(8.6, 8.6, 32, 490.9), 0.06, MATS.white, 32, 3);

  // 桅杆上段（550–600）与红白航空色
  addCylinder(tower, 0.9, 1.5, 44, 8, MATS.white, 0, 572, 0);
  [560, 574, 588].forEach(function (y) {
    addCylinder(tower, 1.25, 1.25, 2.2, 8, MATS.red, 0, y, 0);
  });
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.45, 8, 6), MATS.white);
  spire.position.y = 598;
  tower.add(spire);
  addCylinder(tower, 0.06, 0.12, 5, 5, MATS.steelDark, 0, 600, 0);

  // 极速云霄轨道与轿厢（455–485 m）
  addBox(tower, 0.6, 32, 0.6, MATS.steelDark, 0, 470, 6.2, false, false);
  addBox(tower, 4.2, 3.4, 4.2, MATS.red, 0, 472, 6.2, true, false);
  addBox(tower, 4.4, 0.6, 4.4, MATS.white, 0, 473.9, 6.2, false, false);
}

/* ---------------- 组装 ---------------- */

export function create() {
  seed = 771026;
  const textures = {
    paving: makePaving(),
    ripple: makeRipple(),
    water: makeWater(),
    city: makeCity()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "canton-tower-model";

  addBase(root);
  addWaterfront(root);
  addCity(root);
  addTrees(root);
  addLamps(root);

  const tower = new THREE.Group();
  tower.name = "canton-tower";
  tower.position.set(0, GROUND_Y, 0);
  root.add(tower);
  addTowerBase(tower);
  const latticeStats = addLattice(tower);
  addCrown(tower);

  const anchors = {
    overview: new THREE.Vector3(0, 300, 0),
    base: new THREE.Vector3(0, 18, 20),
    lattice: new THREE.Vector3(0, 220, 0),
    deck: new THREE.Vector3(0, 452, 0),
    mast: new THREE.Vector3(0, 505, 0),
    steps: new THREE.Vector3(0, 7, -82),
    bridge: new THREE.Vector3(-92, 20, -112),
    detail: new THREE.Vector3(0, 21, 46)
  };

  return {
    group: root,
    anchors: anchors,
    stats: latticeStats,
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