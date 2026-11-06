/*
 * 广州大剧院 · 圆润双砾 · 风格化场地 diorama（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：220 × 220 m 场地段。大砾石（西、深色）外壳最大长度约 120 m、宽约 85 m、高 43.1 m；
 * 小砾石（东、白色）约 65 × 45 × 28 m（高度/平面为照片与卫星比例估算，示意）。
 * 包含：两块无直角三角折面砾石、大砾石南/东南三角玻璃口部 + 内部斜网格、
 * 小砾石南/东低长玻璃带、5 m 入口平台、南侧缓坡、水池、草坡/山丘、树阵与铺装；
 * 北/东侧省博、图书馆与西塔只做压缩剪影，不遮挡双砾。
 * 不含剧场/舞台/后台内部、地下车库/落客区、RGB 灯光秀；夜景“水映双砾”只写进数据卡。
 * 尺寸口径：42,000 ㎡ 占地、73,000 ㎡ 建筑面积、43.1 m 高、约 120 m 外壳最大长度为公开口径；
 * 小砾石 65×45×28、约 3 m 间距、水池/坡道/草坡尺寸与三角分片密度均为估算/示意，不是测绘。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");
const PAL = window.CantonPalette;
if (!PAL) throw new Error("Canton palette is not loaded");

const SITE = 220;
const HALF = SITE / 2;
const GROUND = 0.0;
const PLATFORM_Y = 5.0;

/* ---------------- 小工具 ---------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function range(rng, a, b) { return a + (b - a) * rng(); }
function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

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

/* ---------------- 程序化贴图 ---------------- */

function makeStoneMap() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2f0ea";
  ctx.fillRect(0, 0, 512, 512);
  // 三角分片：斜向交错的浅缝，只做低对比，避免远看变成方格
  ctx.strokeStyle = "rgba(92,88,80,0.22)";
  ctx.lineWidth = 1.5;
  for (let i = -512; i < 1024; i += 96) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 512, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + 512, 0); ctx.lineTo(i, 512); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(120,114,104,0.08)";
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }
  // 雨痕/风化：竖向浅色与深色细条，两端淡出
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 360;
    const h = 20 + Math.random() * 130;
    const w = 0.6 + Math.random() * 2.2;
    const dark = Math.random() > 0.48;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, dark ? "rgba(58,56,52,0)" : "rgba(255,255,255,0)");
    grad.addColorStop(0.35, dark ? "rgba(58,56,52,0.075)" : "rgba(255,255,255,0.13)");
    grad.addColorStop(1, dark ? "rgba(58,56,52,0)" : "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(80,76,68,0.05)" : "rgba(255,255,255,0.06)";
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  return colorTexture(c, 1, 1);
}

function makeGlassMap() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, "#b9d0d6");
  g.addColorStop(0.38, "#6f8b95");
  g.addColorStop(0.7, "#3d5863");
  g.addColorStop(1, "#243b45");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(235,246,247,0.2)";
  ctx.beginPath();
  ctx.moveTo(0, 186); ctx.lineTo(256, 72); ctx.lineTo(256, 108); ctx.lineTo(0, 220);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(10,20,24,0.22)";
  ctx.fillRect(0, 232, 256, 24);
  return colorTexture(c, 1, 1);
}

function makePavingMap() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ded7c8";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      const v = 210 + Math.floor(Math.random() * 20);
      ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 15) + ")";
      ctx.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  ctx.strokeStyle = "rgba(120,112,98,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = "rgba(92,84,70," + (0.02 + Math.random() * 0.06).toFixed(3) + ")";
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  return colorTexture(c, 1, 1);
}

function makeGrassMap() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5a7340";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3600; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.54
      ? "rgba(126,152,88," + (0.05 + Math.random() * 0.15).toFixed(3) + ")"
      : "rgba(38,54,28," + (0.05 + Math.random() * 0.16).toFixed(3) + ")";
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 2 + Math.random() * 5);
  }
  return colorTexture(c, 1, 1);
}

function makeWaterMap() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5f8286";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(220,238,238,0.12)" : "rgba(26,48,52,0.12)";
    ctx.fillRect(Math.random() * 180, y, 40 + Math.random() * 80, 1 + Math.random() * 2);
  }
  return colorTexture(c, 1, 1);
}

function makeTextCanvas(text, opts) {
  const o = opts || {};
  const w = o.w || 1024;
  const h = o.h || 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h); }
  else ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = (o.weight || "600") + " " + (o.size || 76) + 'px ' + (o.font || '"Songti SC","SimSun","STSong","Noto Serif SC",serif');
  ctx.fillStyle = o.color || "#f4f2ec";
  ctx.fillText(text, w / 2, h / 2 + 2);
  return c;
}

/* ---------------- 合并几何 ---------------- */

function Bucket(useColor) {
  this.p = [];
  this.n = [];
  this.uv = [];
  this.c = [];
  this.useColor = useColor === true;
}
Bucket.prototype.tri = function (a, b, c, ua, ub, uc, color) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const n = new THREE.Vector3().crossVectors(ab, ac);
  const len = n.length();
  if (len < 1e-8) return;
  n.multiplyScalar(1 / len);
  this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  this.n.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
  this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  if (this.useColor) {
    const col = color || { r: 1, g: 1, b: 1 };
    this.c.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
  }
};
Bucket.prototype.quadRef = function (a, b, c, d, ua, ub, uc, ud, ref, color) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const n = new THREE.Vector3().crossVectors(ab, ac);
  if (n.dot(ref) < 0) {
    const tb = b; b = d; d = tb;
    const tu = ub; ub = ud; ud = tu;
  }
  this.tri(a, b, c, ua, ub, uc, color);
  this.tri(a, c, d, ua, uc, ud, color);
};
Bucket.prototype.quad = function (a, b, c, d, ua, ub, uc, ud, color) {
  this.tri(a, b, c, ua, ub, uc, color);
  this.tri(a, c, d, ua, uc, ud, color);
};
Bucket.prototype.box = function (x0, y0, z0, x1, y1, z1, scale, color) {
  const s = scale || 2;
  const u = function (x, y, z) { return [(x + z) / s, y / s]; };
  this.quadRef(v3(x0, y0, z1), v3(x1, y0, z1), v3(x1, y1, z1), v3(x0, y1, z1), u(x0, y0, z1), u(x1, y0, z1), u(x1, y1, z1), u(x0, y1, z1), v3(0, 0, 1), color);
  this.quadRef(v3(x1, y0, z0), v3(x0, y0, z0), v3(x0, y1, z0), v3(x1, y1, z0), u(x1, y0, z0), u(x0, y0, z0), u(x0, y1, z0), u(x1, y1, z0), v3(0, 0, -1), color);
  this.quadRef(v3(x1, y0, z1), v3(x1, y0, z0), v3(x1, y1, z0), v3(x1, y1, z1), u(x1, y0, z1), u(x1, y0, z0), u(x1, y1, z0), u(x1, y1, z1), v3(1, 0, 0), color);
  this.quadRef(v3(x0, y0, z0), v3(x0, y0, z1), v3(x0, y1, z1), v3(x0, y1, z0), u(x0, y0, z0), u(x0, y0, z1), u(x0, y1, z1), u(x0, y1, z0), v3(-1, 0, 0), color);
  this.quadRef(v3(x0, y1, z1), v3(x1, y1, z1), v3(x1, y1, z0), v3(x0, y1, z0), u(x0, y1, z1), u(x1, y1, z1), u(x1, y1, z0), u(x0, y1, z0), v3(0, 1, 0), color);
  this.quadRef(v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y0, z1), v3(x0, y0, z1), u(x0, y0, z0), u(x1, y0, z0), u(x1, y0, z1), u(x0, y0, z1), v3(0, -1, 0), color);
};
Bucket.prototype.geometry = function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
  if (this.useColor) g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
  g.computeBoundingSphere();
  return g;
};
Bucket.prototype.mesh = function (mat, cast, receive) {
  const m = new THREE.Mesh(this.geometry(), mat);
  m.castShadow = cast === true;
  m.receiveShadow = receive !== false;
  return m;
};

function EdgeBucket() { this.p = []; this.seen = new Set(); }
EdgeBucket.prototype.edge = function (a, b) {
  const k1 = [Math.round(a.x * 10), Math.round(a.y * 10), Math.round(a.z * 10)].join(",");
  const k2 = [Math.round(b.x * 10), Math.round(b.y * 10), Math.round(b.z * 10)].join(",");
  const key = k1 < k2 ? k1 + "|" + k2 : k2 + "|" + k1;
  if (this.seen.has(key)) return;
  this.seen.add(key);
  this.p.push(a.x, a.y, a.z, b.x, b.y, b.z);
};
EdgeBucket.prototype.mesh = function (mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
  const l = new THREE.LineSegments(g, mat);
  l.frustumCulled = false;
  return l;
};

function beam(bucket, a, b, thickness, color) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 0.02) return;
  d.multiplyScalar(1 / len);
  const ref = Math.abs(d.y) > 0.92 ? v3(1, 0, 0) : v3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(d, ref).normalize();
  const w = new THREE.Vector3().crossVectors(d, u).normalize();
  const h = thickness / 2;
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const A = corners.map(function (q) { return a.clone().addScaledVector(u, q[0] * h).addScaledVector(w, q[1] * h); });
  const B = corners.map(function (q) { return b.clone().addScaledVector(u, q[0] * h).addScaledVector(w, q[1] * h); });
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const m = A[i].clone().add(A[j]).add(B[i]).add(B[j]).multiplyScalar(0.25);
    bucket.quadRef(A[i], A[j], B[j], B[i], uv[i], uv[j], uv[j], uv[i], m.clone().sub(mid), color);
  }
  bucket.quadRef(A[0], A[1], A[2], A[3], uv[0], uv[1], uv[2], uv[3], d.clone().negate(), color);
  bucket.quadRef(B[3], B[2], B[1], B[0], uv[3], uv[2], uv[1], uv[0], d, color);
}

/* ---------------- 双砾折面壳 ---------------- */

function samplePlan(plan, ang) {
  const n = plan.length;
  const f = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * n;
  const i = Math.floor(f);
  const t = f - i;
  return plan[i] * (1 - t) + plan[(i + 1) % n] * t;
}

function buildPebble(cfg) {
  const rng = mulberry32(cfg.seed);
  const cosR = Math.cos(cfg.rot);
  const sinR = Math.sin(cfg.rot);
  const seg = cfg.seg;
  const rings = cfg.profile.length;
  const grid = [];
  const centers = [];

  for (let r = 0; r < rings; r++) {
    const pr = cfg.profile[r];
    const u = pr[0];
    const y = cfg.h * pr[1];
    const driftX = cfg.driftX * Math.pow(u, 1.45);
    const driftZ = cfg.driftZ * Math.pow(u, 1.45);
    const cx = cfg.cx + driftX;
    const cz = cfg.cz + driftZ;
    centers.push(v3(cx, 0, cz));
    const row = [];
    for (let s = 0; s < seg; s++) {
      const phase = (r % 2) * (Math.PI / seg) * 0.6;
      const ang = (s / seg) * Math.PI * 2 + phase;
      const plan = samplePlan(cfg.plan, ang) * (1 + (rng() - 0.5) * 0.05);
      const lx = Math.cos(ang) * cfg.a * pr[2] * plan;
      const lz = Math.sin(ang) * cfg.b * pr[3] * plan;
      const x = cx + lx * cosR - lz * sinR;
      const z = cz + lx * sinR + lz * cosR;
      let yy = y + (rng() - 0.5) * cfg.h * 0.032 * smoothstep(0.08, 0.9, u)
        + Math.sin(ang * 3 + r * 0.7) * cfg.h * 0.006 * u;
      yy = clamp(yy, 0, cfg.h - 0.05);
      row.push(v3(x, yy, z));
    }
    grid.push(row);
  }

  const stone = new Bucket(true);
  const reveal = new Bucket(true);
  const glass = new Bucket(false);
  const steel = new Bucket(false);
  const dark = new Bucket(false);
  const warm = new Bucket(false);
  const edges = new EdgeBucket();

  const mouth = cfg.mouth;
  const r0 = mouth.r0;
  const r1 = Math.min(mouth.r1, rings - 1);
  const s0 = mouth.s0;
  const s1 = mouth.s1;

  function inMouth(r, s) { return r >= r0 && r < r1 && s >= s0 && s < s1; }

  function uvOf(p) { return [(p.x + p.z) / 17, p.y / 13]; }
  function shadeFor(p, rngLocal) {
    const base = 0.80 + rngLocal() * 0.34;
    const weather = 0.9 + 0.1 * smoothstep(0, cfg.h * 0.3, p.y);
    const sh = clamp(base * weather, 0.7, 1.16);
    return { r: sh, g: sh * 0.995, b: sh * 0.972 };
  }

  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < seg; s++) {
      if (inMouth(r, s)) continue;
      const s2 = (s + 1) % seg;
      const a = grid[r][s];
      const b = grid[r][s2];
      const c = grid[r + 1][s2];
      const d = grid[r + 1][s];
      const mid = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
      const ref = v3(mid.x - centers[r].x, 0, mid.z - centers[r].z);
      stone.quadRef(a, b, c, d, uvOf(a), uvOf(b), uvOf(c), uvOf(d), ref, shadeFor(mid, rng));
      edges.edge(a, b); edges.edge(b, c); edges.edge(c, d); edges.edge(d, a);
    }
  }

  // 顶部收成一条略斜的长脊，而不是正圆穹顶
  const top = grid[rings - 1];
  const ridgeHalf = cfg.a * 0.46;
  const ridgeA = v3(cfg.cx + cosR * ridgeHalf + cfg.driftX, cfg.h, cfg.cz + sinR * ridgeHalf + cfg.driftZ);
  const ridgeB = v3(cfg.cx - cosR * ridgeHalf + cfg.driftX, cfg.h - cfg.h * 0.05, cfg.cz - sinR * ridgeHalf + cfg.driftZ);
  const ridgeDir = new THREE.Vector3().subVectors(ridgeB, ridgeA);
  const ridgeLen2 = ridgeDir.lengthSq();
  function ridgePoint(p) {
    const t = clamp(new THREE.Vector3().subVectors(p, ridgeA).dot(ridgeDir) / ridgeLen2, 0, 1);
    return ridgeA.clone().addScaledVector(ridgeDir, t);
  }
  const ridgePts = top.map(ridgePoint);
  for (let s = 0; s < seg; s++) {
    const s2 = (s + 1) % seg;
    const p = top[s];
    const q = top[s2];
    const rp = ridgePts[s];
    const rq = ridgePts[s2];
    const mids = p.clone().add(q).add(rp).multiplyScalar(1 / 3);
    stone.tri(p, rp, q, uvOf(p), uvOf(rp), uvOf(q), shadeFor(mids, rng));
    stone.tri(q, rp, rq, uvOf(q), uvOf(rp), uvOf(rq), shadeFor(mids, rng));
    edges.edge(p, q); edges.edge(p, rp); edges.edge(rp, rq);
  }
  edges.edge(ridgeA, ridgeB);

  // 口部内凹点：朝所在环的中心收进
  const outer = [];
  const inner = [];
  for (let r = r0; r <= r1; r++) {
    const rowO = [];
    const rowI = [];
    for (let s = s0; s <= s1; s++) {
      const p = grid[r][s % seg].clone();
      rowO.push(p);
      const cen = centers[r];
      const dx = cen.x - p.x;
      const dz = cen.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const inn = v3(p.x + (dx / len) * mouth.inset, p.y - 0.22, p.z + (dz / len) * mouth.inset);
      rowI.push(inn);
    }
    outer.push(rowO);
    inner.push(rowI);
  }
  const nr = outer.length - 1;
  const ns = outer[0].length - 1;
  const mouthCenter = new THREE.Vector3();
  outer.forEach(function (row) { row.forEach(function (p) { mouthCenter.add(p); }); });
  mouthCenter.multiplyScalar(1 / ((nr + 1) * (ns + 1)));

  // 口部四周石质侧壁
  for (let s = 0; s < ns; s++) {
    reveal.quad(outer[0][s], outer[0][s + 1], inner[0][s + 1], inner[0][s], [0, 0], [1, 0], [1, 1], [0, 1], { r: 0.72, g: 0.72, b: 0.7 });
    reveal.quad(outer[nr][s + 1], outer[nr][s], inner[nr][s], inner[nr][s + 1], [0, 0], [1, 0], [1, 1], [0, 1], { r: 0.7, g: 0.7, b: 0.68 });
  }
  for (let r = 0; r < nr; r++) {
    reveal.quad(outer[r + 1][0], outer[r][0], inner[r][0], inner[r + 1][0], [0, 0], [1, 0], [1, 1], [0, 1], { r: 0.68, g: 0.68, b: 0.66 });
    reveal.quad(outer[r][ns], outer[r + 1][ns], inner[r + 1][ns], inner[r][ns], [0, 0], [1, 0], [1, 1], [0, 1], { r: 0.68, g: 0.68, b: 0.66 });
  }

  // 玻璃面（按格合并，一整块材质，一个 draw call）
  for (let r = 0; r < nr; r++) {
    for (let s = 0; s < ns; s++) {
      const a = inner[r][s];
      const b = inner[r][s + 1];
      const c = inner[r + 1][s + 1];
      const d = inner[r + 1][s];
      const u0 = s / ns, u1 = (s + 1) / ns;
      const v0 = r / nr, v1 = (r + 1) / nr;
      glass.quad(a, b, c, d, [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
    }
  }

  // 玻璃后方的暗色大堂 + 暖光带 + 水平钢构件
  const backing = [];
  for (let r = 0; r <= nr; r++) {
    const row = [];
    const cen = centers[Math.min(r + r0, rings - 1)];
    for (let s = 0; s <= ns; s++) {
      const p = inner[r][s];
      const dx = cen.x - p.x;
      const dz = cen.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const depth = cfg.id === "large" ? 7.5 : 4.5;
      row.push(v3(p.x + (dx / len) * depth, p.y, p.z + (dz / len) * depth));
    }
    backing.push(row);
  }
  for (let r = 0; r < nr; r++) {
    for (let s = 0; s < ns; s++) {
      dark.quad(backing[r][s], backing[r][s + 1], backing[r + 1][s + 1], backing[r + 1][s], [0, 0], [1, 0], [1, 1], [0, 1]);
    }
  }

  // 内部三角斜网格：斜撑 + 竖杆 + 周边框
  for (let r = 0; r < nr; r++) {
    for (let s = 0; s < ns; s++) {
      const a = inner[r][s];
      const b = inner[r][s + 1];
      const c = inner[r + 1][s + 1];
      const d = inner[r + 1][s];
      beam(steel, a, c, 0.17);
      beam(steel, b, d, 0.17);
      if (r % 2 === 0) beam(steel, a, d, 0.11);
    }
  }
  for (let r = 0; r <= nr; r++) {
    for (let s = 0; s < ns; s++) {
      beam(steel, inner[r][s], inner[r][s + 1], 0.2);
    }
  }
  for (let s = 0; s <= ns; s++) {
    for (let r = 0; r < nr; r++) {
      beam(steel, inner[r][s], inner[r + 1][s], 0.16);
    }
  }

  // 大堂暖光：横向灯带（背板前 5 m 左右）
  for (let k = 1; k <= (cfg.id === "large" ? 3 : 2); k++) {
    const rr = Math.min(nr - 1, Math.round((k / 4) * nr));
    const a = backing[rr][0].clone();
    const b = backing[rr][ns].clone();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const shrink = 0.2;
    const aa = a.clone().lerp(mid, shrink);
    const bb = b.clone().lerp(mid, shrink);
    beam(warm, aa, bb, 0.16);
  }

  return {
    id: cfg.id,
    stone: stone,
    reveal: reveal,
    glass: glass,
    steel: steel,
    dark: dark,
    warm: warm,
    edges: edges,
    mouthCenter: mouthCenter,
    ridge: { a: ridgeA, b: ridgeB }
  };
}

const LARGE = {
  id: "large",
  cx: -34, cz: -38, a: 60, b: 42.5, h: 43.1,
  rot: 0.62, seg: 16, seed: 20261105,
  driftX: 2.4, driftZ: -1.6,
  profile: [
    [0.00, 0.00, 1.000, 1.000],
    [0.16, 0.30, 1.030, 1.000],
    [0.32, 0.52, 1.020, 0.970],
    [0.48, 0.71, 0.990, 0.900],
    [0.63, 0.84, 0.920, 0.760],
    [0.76, 0.92, 0.800, 0.560],
    [0.87, 0.970, 0.600, 0.340],
    [0.95, 0.995, 0.340, 0.150],
    [1.00, 1.000, 0.150, 0.070]
  ],
  plan: [1.00, 1.10, 0.94, 1.06, 1.12, 0.92, 1.04, 1.09, 0.93, 1.01, 1.07, 0.95, 1.04, 0.98],
  mouth: { r0: 0, r1: 3, s0: 1, s1: 3, inset: 3.0 }
};

const SMALL = {
  id: "small",
  cx: 55, cz: -15, a: 32.5, b: 22.5, h: 28,
  rot: 0.62, seg: 12, seed: 20261106,
  driftX: 1.6, driftZ: 1.1,
  profile: [
    [0.00, 0.00, 1.000, 1.000],
    [0.20, 0.34, 1.020, 1.000],
    [0.40, 0.58, 1.010, 0.970],
    [0.58, 0.75, 0.980, 0.900],
    [0.74, 0.88, 0.900, 0.720],
    [0.86, 0.950, 0.720, 0.450],
    [0.95, 0.990, 0.400, 0.190],
    [1.00, 1.000, 0.180, 0.090]
  ],
  plan: [1.00, 1.12, 0.94, 1.07, 1.00, 0.91, 1.08, 0.96, 1.05, 0.93, 1.09, 0.98],
  mouth: { r0: 0, r1: 2, s0: 0, s1: 3, inset: 2.0 }
};

/* ---------------- 场地 ---------------- */

function terrainHeight(x, z) {
  let h = 0;
  // 东侧草坡/山丘：从南广场向 5 m 平台抬起
  const ex = (x - 76) / 38;
  const ez = (z - 8) / 25;
  const e = 1 - clamp(ex * ex + ez * ez, 0, 1);
  h += 5.0 * Math.pow(e, 1.35) * smoothstep(44, 32, z);
  // 西侧低草坡，压住大砾石根部
  const wx = (x + 94) / 27;
  const wz = (z - 0) / 20;
  const w = 1 - clamp(wx * wx + wz * wz, 0, 1);
  h += 3.4 * Math.pow(w, 1.4) * smoothstep(24, 16, z);
  // 北侧轻微台地，只作背景
  const nx = (x + 30) / 82;
  const nz = (z + 100) / 26;
  const n = 1 - clamp(nx * nx + nz * nz, 0, 1);
  h += 1.6 * Math.pow(n, 1.2);
  return h;
}

function buildTerrain(grassMat) {
  const n = 62;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = -HALF + (i / n) * SITE;
      const z = -HALF + (j / n) * SITE;
      pos.push(x, terrainHeight(x, z), z);
      uv.push((x + HALF) / 9, (z + HALF) / 9);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      const b = a + 1;
      const c = a + n + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, grassMat);
  mesh.name = "site-terrain";
  mesh.receiveShadow = true;
  return mesh;
}

function buildPaving(pavingMat) {
  const b = new Bucket(false);
  function slab(x0, z0, x1, z1) {
    const y = 0.055;
    b.quad(v3(x0, y, z1), v3(x1, y, z1), v3(x1, y, z0), v3(x0, y, z0),
      [x0 / 7, z1 / 7], [x1 / 7, z1 / 7], [x1 / 7, z0 / 7], [x0 / 7, z0 / 7]);
  }
  slab(-104, 56, 104, 104);
  slab(-104, -20, -92, 56);
  slab(88, 24, 104, 56);
  slab(-40, 104, 40, 108);
  const mesh = b.mesh(pavingMat, false, true);
  mesh.name = "site-paving";
  return mesh;
}

function buildPool(mats) {
  const group = new THREE.Group();
  group.name = "pool";

  const waterB = new Bucket(false);
  const waterY = 0.15;
  function water(x0, z0, x1, z1) {
    waterB.quad(v3(x0, waterY, z1), v3(x1, waterY, z1), v3(x1, waterY, z0), v3(x0, waterY, z0),
      [x0 / 22, z1 / 22], [x1 / 22, z1 / 22], [x1 / 22, z0 / 22], [x0 / 22, z0 / 22]);
  }
  water(-92, 18, 4, 56);
  water(4, 42, 68, 56);
  const waterMesh = waterB.mesh(mats.water, false, true);
  waterMesh.name = "pool-water";
  group.add(waterMesh);

  const bottomB = new Bucket(false);
  function bottom(x0, z0, x1, z1) {
    bottomB.quad(v3(x0, 0.03, z0), v3(x1, 0.03, z0), v3(x1, 0.03, z1), v3(x0, 0.03, z1),
      [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  bottom(-92, 18, 4, 56);
  bottom(4, 42, 68, 56);
  const bottomMesh = bottomB.mesh(mats.poolBottom, false, true);
  bottomMesh.name = "pool-bottom";
  group.add(bottomMesh);

  // 池沿
  const rimB = new Bucket(false);
  const rimH = 0.22;
  function rim(x0, z0, x1, z1) {
    rimB.box(x0, 0, z0, x1, rimH, z1, 2.5);
  }
  rim(-93, 17, 5, 18.4);
  rim(-93, 55.6, 5, 57);
  rim(-93, 17, -92, 57);
  rim(4, 55.6, 69, 57);
  rim(68.4, 42, 69.2, 56);
  rim(4, 41.4, 69, 42.2);
  rim(3.2, 18, 4.4, 42);
  const rimMesh = rimB.mesh(mats.poolRim, false, true);
  rimMesh.name = "pool-rim";
  group.add(rimMesh);

  return group;
}

function addDeck(parent, points, mats) {
  const top = PLATFORM_Y;
  const bot = PLATFORM_Y - 0.95;
  const cx = points.reduce(function (s, p) { return s + p[0]; }, 0) / points.length;
  const cz = points.reduce(function (s, p) { return s + p[1]; }, 0) / points.length;
  const c = v3(cx, top, cz);
  const topB = new Bucket(false);
  const sideB = new Bucket(false);
  const uv = function (p) { return [(p.x - cx) / 8 + 0.5, (p.z - cz) / 8 + 0.5]; };
  const n = points.length;
  // 顶面用扇形三角，按朝上统一排序
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const a = v3(p[0], top, p[1]);
    const b = v3(q[0], top, q[1]);
    const ab = new THREE.Vector3().subVectors(a, c);
    const ac = new THREE.Vector3().subVectors(b, c);
    if (new THREE.Vector3().crossVectors(ab, ac).y < 0) topB.tri(c, b, a, uv(c), uv(b), uv(a));
    else topB.tri(c, a, b, uv(c), uv(a), uv(b));
  }

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const a = v3(p[0], top, p[1]);
    const b = v3(q[0], top, q[1]);
    const ad = v3(p[0], bot, p[1]);
    const bd = v3(q[0], bot, q[1]);
    const mid = a.clone().add(b).multiplyScalar(0.5).sub(c);
    sideB.quadRef(ad, bd, b, a, [0, 0], [1, 0], [1, 1], [0, 1], v3(mid.x, 0, mid.z));
  }

  const deck = new THREE.Group();
  deck.name = "entrance-platform";
  const topMesh = topB.mesh(mats.platform, false, true);
  topMesh.name = "platform-deck";
  deck.add(topMesh);
  const sideMesh = sideB.mesh(mats.platformEdge, true, true);
  sideMesh.name = "platform-fascia";
  deck.add(sideMesh);

  // 平台边缘的暗色狭缝 + 暖白“水纹”光带
  const slotB = new Bucket(false);
  const glowB = new Bucket(false);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2;
    const mz = (p[1] + q[1]) / 2;
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;
    const nx = -dz / len, nz = dx / len;
    slotB.box(mx - dx * 0.5, top - 0.18, mz - dz * 0.5, mx + dx * 0.5, top - 0.02, mz + dz * 0.5, 2);
    glowB.box(mx - dx * 0.46, bot + 0.28, mz - dz * 0.46, mx + dx * 0.46, bot + 0.4, mz + dz * 0.46, 2);
    void nx; void nz;
  }
  const slot = slotB.mesh(mats.slot, false, false);
  slot.name = "platform-slit";
  deck.add(slot);
  const glow = glowB.mesh(mats.warmStrip, false, false);
  glow.name = "platform-water-light";
  deck.add(glow);

  // 平台支撑柱，落进水池/地面
  const colB = new Bucket(false);
  const cols = [[-18, 12], [-4, 25], [16, 18], [38, 18], [58, 24]];
  cols.forEach(function (p) {
    colB.box(p[0] - 0.55, 0, p[1] - 0.55, p[0] + 0.55, bot, p[1] + 0.55, 2.2);
  });
  const columns = colB.mesh(mats.platformEdge, true, true);
  columns.name = "platform-columns";
  deck.add(columns);

  parent.add(deck);
  return deck;
}

function addRamp(parent, mats) {
  const ax = 66, az = 28, ay = PLATFORM_Y;
  const bx = 92, bz = 54, by = 0.08;
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const px = -dz / len, pz = dx / len;
  const w = 3.2;
  const b = new Bucket(false);
  const A1 = v3(ax + px * w, ay, az + pz * w);
  const A2 = v3(ax - px * w, ay, az - pz * w);
  const B1 = v3(bx + px * w, by, bz + pz * w);
  const B2 = v3(bx - px * w, by, bz - pz * w);
  const up = v3(0, 1, 0);
  b.quadRef(A1, B1, B2, A2, [0, 0], [1, 0], [1, 1], [0, 1], up);
  b.quadRef(A1, A2, v3(A2.x, 0.05, A2.z), v3(A1.x, 0.05, A1.z), [0, 0], [1, 0], [1, 1], [0, 1], v3(px, 0, pz));
  b.quadRef(A2, B2, v3(B2.x, 0.05, B2.z), v3(A2.x, 0.05, A2.z), [0, 0], [1, 0], [1, 1], [0, 1], v3(-px, 0, -pz));
  const ramp = b.mesh(mats.ramp, true, true);
  ramp.name = "south-ramp";
  parent.add(ramp);

  const railB = new Bucket(false);
  [[A1, B1, 1], [A2, B2, -1]].forEach(function (q) {
    const a = q[0].clone(); a.y += 1.0;
    const c = q[1].clone(); c.y += 1.0;
    beam(railB, a, c, 0.09);
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const p = a.clone().lerp(c, t);
      beam(railB, v3(p.x, p.y - 1.0, p.z), p, 0.07);
    }
  });
  const rail = railB.mesh(mats.rail, false, false);
  rail.name = "ramp-rails";
  parent.add(rail);
}

function addTrees(parent, mats) {
  const spots = [
    [-102, 70], [-86, 78], [-68, 88], [-48, 92], [-34, 100],
    [70, 88], [92, 78], [101, 62],
    [-103, 38], [-103, 14], [-101, -10], [-99, -34], [-94, -56],
    [96, 30], [102, 10], [100, -18], [94, -40],
    [48, 52], [64, 50], [80, 46]
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.4, 1, 6).translate(0, 0.5, 0);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.trunk, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, mats.leaf, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(function (p, i) {
    const y = terrainHeight(p[0], p[1]);
    const h = 4.0 + (i % 4) * 0.55;
    const r = 2.3 + (i % 3) * 0.35;
    dummy.position.set(p[0], y, p[1]);
    dummy.rotation.set(0, i * 0.8, 0);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p[0], y + h + r * 0.4, p[1]);
    dummy.rotation.set(0, i * 1.1, 0);
    dummy.scale.set(r, r * 0.82, r);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  leaves.castShadow = true;
  trunks.receiveShadow = true;
  leaves.receiveShadow = true;
  trunks.name = "tree-trunks";
  leaves.name = "tree-canopies";
  parent.add(trunks);
  parent.add(leaves);

  const bushGeo = new THREE.IcosahedronGeometry(1, 0);
  const bushes = [
    [-104, 52, 1.5], [-102, 28, 1.2], [-98, -2, 1.4], [88, 38, 1.5],
    [76, 56, 1.2], [38, 58, 1.1], [-16, 58, 1.2]
  ];
  const bushMesh = new THREE.InstancedMesh(bushGeo, mats.bush, bushes.length);
  bushes.forEach(function (p, i) {
    const y = terrainHeight(p[0], p[1]);
    dummy.position.set(p[0], y + p[2] * 0.45, p[1]);
    dummy.rotation.set(0, i, 0);
    dummy.scale.set(p[2], p[2] * 0.62, p[2]);
    dummy.updateMatrix();
    bushMesh.setMatrixAt(i, dummy.matrix);
  });
  bushMesh.instanceMatrix.needsUpdate = true;
  bushMesh.name = "shrub-row";
  parent.add(bushMesh);
}

function addLamps(parent, mats) {
  const pts = [[-84, 60], [-52, 60], [-20, 60], [12, 60], [44, 60], [76, 60]];
  const b = new Bucket(false);
  pts.forEach(function (p) {
    const y = terrainHeight(p[0], p[1]);
    b.box(p[0] - 0.1, y, p[1] - 0.1, p[0] + 0.1, y + 4.6, p[1] + 0.1, 2);
    b.box(p[0] - 0.26, y + 4.6, p[1] - 0.26, p[0] + 0.26, y + 5.05, p[1] + 0.26, 2);
  });
  const poles = b.mesh(mats.lamp, false, false);
  poles.name = "plaza-lamps";
  parent.add(poles);
}

function addContext(parent, mats) {
  const b = new Bucket(false);
  // 广东省博物馆（东/东北侧，压缩剪影）
  b.box(82, 0, -74, 108, 27, -50, 8);
  b.box(84, 27, -72, 106, 29, -52, 8);
  // 广州图书馆（北侧，压缩）
  b.box(2, 0, -108, 50, 24, -88, 8);
  // 广州国际金融中心/西塔（西北侧，压缩）
  b.box(-106, 0, -92, -88, 82, -74, 8);
  const context = b.mesh(mats.context, false, true);
  context.name = "context-compressed";
  parent.add(context);

  const darkB = new Bucket(false);
  darkB.box(82, 20, -74.1, 108, 22, -73.9, 8);
  darkB.box(-106, 70, -92.1, -88, 72, -91.9, 8);
  const bands = darkB.mesh(mats.contextDark, false, false);
  bands.name = "context-cornices";
  parent.add(bands);
}

function addSign(parent, mats, upward) {
  const group = new THREE.Group();
  group.name = "site-sign";
  const x = -6, z = 32.2, y = PLATFORM_Y + 0.1;
  const canvas = makeTextCanvas("广州大剧院", { w: 1024, h: 112, color: "#f2eee2", size: 74, weight: "700" });
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 1.0), mat);
  mesh.position.set(x, y + 1.08, z);
  group.add(mesh);
  const canvas2 = makeTextCanvas("GUANGZHOU OPERA HOUSE", { w: 1024, h: 80, color: "#ece7da", size: 38, weight: "600" });
  const tex2 = new THREE.CanvasTexture(canvas2);
  tex2.anisotropy = 4;
  if ("colorSpace" in tex2 && THREE.SRGBColorSpace) tex2.colorSpace = THREE.SRGBColorSpace;
  const mat2 = new THREE.MeshBasicMaterial({ map: tex2, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const mesh2 = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 0.55), mat2);
  mesh2.position.set(x, y + 0.42, z);
  group.add(mesh2);
  const back = new Bucket(false);
  back.box(x - 5.4, y, z - 0.25, x + 5.4, y + 1.62, z - 0.05, 3);
  const backMesh = back.mesh(mats.signBase, false, false);
  group.add(backMesh);
  parent.add(group);
  void upward;
}

/* ---------------- 材质 ---------------- */

function createMaterials(T) {
  function std(opts) { return new THREE.MeshStandardMaterial(opts); }
  return {
    stoneDark: std({ map: T.stone, color: 0x232625, roughness: 0.95, metalness: 0.03, vertexColors: true }),
    stoneLight: std({ map: T.stone, color: 0xe2dccd, roughness: 0.94, metalness: 0.03, vertexColors: true }),
    stoneReveal: std({ map: T.stone, color: 0x5c5b56, roughness: 0.95, metalness: 0.03, vertexColors: true, side: THREE.DoubleSide }),
    edgeDark: new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.62 }),
    edgeLight: new THREE.LineBasicMaterial({ color: 0x4f4c45, transparent: true, opacity: 0.5 }),
    glass: std({ map: T.glass, color: 0xa8bcc1, roughness: 0.16, metalness: 0.55, transparent: true, opacity: 0.8, emissive: 0x1b2b30, emissiveIntensity: 0.32, side: THREE.DoubleSide }),
    glassSmall: std({ map: T.glass, color: 0xbfd0d3, roughness: 0.2, metalness: 0.45, transparent: true, opacity: 0.72, emissive: 0x22333a, emissiveIntensity: 0.25, side: THREE.DoubleSide }),
    steel: std({ color: 0x2a2e2d, roughness: 0.56, metalness: 0.62 }),
    lobby: std({ color: 0x1b1d1c, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide }),
    warm: std({ color: 0xe6c59a, roughness: 0.6, emissive: 0xffb35f, emissiveIntensity: 0.8 }),
    platform: std({ map: T.paving, color: PAL.colors.stoneLight, roughness: 0.9 }),
    platformEdge: std({ color: 0x8f8b80, roughness: 0.92 }),
    ramp: std({ map: T.paving, color: 0xd8d2c5, roughness: 0.92 }),
    slot: std({ color: 0x141616, roughness: 0.88 }),
    warmStrip: std({ color: 0xf0d2a4, roughness: 0.5, emissive: 0xffc06a, emissiveIntensity: 0.55 }),
    poolWater: std({ map: T.water, color: 0x7d999b, roughness: 0.08, metalness: 0.78, transparent: true, opacity: 0.88 }),
    poolBottom: std({ color: 0x2d4144, roughness: 0.85 }),
    poolRim: std({ map: T.paving, color: 0xcfc8b9, roughness: 0.9 }),
    grass: std({ map: T.grass, color: 0xffffff, roughness: 1 }),
    trunk: std({ color: 0x5b4936, roughness: 0.97 }),
    leaf: std({ color: 0x3e5b31, roughness: 0.95, flatShading: true }),
    bush: std({ color: 0x354c2a, roughness: 0.98, flatShading: true }),
    lamp: std({ color: 0x4a4f4d, roughness: 0.62, metalness: 0.45 }),
    rail: std({ color: 0x9a978d, roughness: 0.55, metalness: 0.4 }),
    signBase: std({ color: 0x2e3230, roughness: 0.8 }),
    context: std({ color: 0xc9c6bc, roughness: 0.9 }),
    contextDark: std({ color: 0x8c918f, roughness: 0.85 }),
    base: std({ color: PAL.colors.earth, roughness: 0.97 })
  };
}

/* ---------------- 组装 ---------------- */

export function create() {
  const textures = {
    stone: makeStoneMap(),
    glass: makeGlassMap(),
    paving: makePavingMap(),
    grass: makeGrassMap(),
    water: makeWaterMap()
  };
  const mats = createMaterials(textures);
  // 池水材质名在 buildPool 里用 mats.water
  mats.water = mats.poolWater;

  const root = new THREE.Group();
  root.name = "opera-house-model";

  // 展台底座
  const baseB = new Bucket(false);
  baseB.box(-HALF, -0.9, -HALF, HALF, 0, HALF, 12);
  const base = baseB.mesh(mats.base, false, true);
  base.name = "site-base";
  root.add(base);

  root.add(buildTerrain(mats.grass));
  root.add(buildPaving(mats.paving));
  root.add(buildPool(mats));

  const large = buildPebble(LARGE);
  const small = buildPebble(SMALL);

  const largeStone = large.stone.mesh(mats.stoneDark, true, true);
  largeStone.name = "large-boulder-stone";
  const largeReveal = large.reveal.mesh(mats.stoneReveal, true, true);
  largeReveal.name = "large-boulder-reveal";
  const largeGlass = large.glass.mesh(mats.glass, false, true);
  largeGlass.name = "large-boulder-glass";
  largeGlass.renderOrder = 3;
  const largeSteel = large.steel.mesh(mats.steel, false, false);
  largeSteel.name = "large-mouth-grid";
  const largeDark = large.dark.mesh(mats.lobby, false, false);
  largeDark.name = "large-lobby-back";
  const largeWarm = large.warm.mesh(mats.warm, false, false);
  largeWarm.name = "large-lobby-warm";
  const largeEdges = large.edges.mesh(mats.edgeDark);
  largeEdges.name = "large-panel-seams";

  const smallStone = small.stone.mesh(mats.stoneLight, true, true);
  smallStone.name = "small-boulder-stone";
  const smallReveal = small.reveal.mesh(mats.stoneReveal, true, true);
  smallReveal.name = "small-boulder-reveal";
  const smallGlass = small.glass.mesh(mats.glassSmall, false, true);
  smallGlass.name = "small-boulder-glass";
  smallGlass.renderOrder = 3;
  const smallSteel = small.steel.mesh(mats.steel, false, false);
  smallSteel.name = "small-glass-band-grid";
  const smallDark = small.dark.mesh(mats.lobby, false, false);
  smallDark.name = "small-glass-back";
  const smallWarm = small.warm.mesh(mats.warm, false, false);
  smallWarm.name = "small-glass-warm";
  const smallEdges = small.edges.mesh(mats.edgeLight);
  smallEdges.name = "small-panel-seams";

  root.add(largeStone, largeReveal, largeGlass, largeSteel, largeDark, largeWarm, largeEdges);
  root.add(smallStone, smallReveal, smallGlass, smallSteel, smallDark, smallWarm, smallEdges);

  addDeck(root, [
    [-28, 12], [-14, 3], [8, -1], [34, 0], [54, 6], [72, 16],
    [66, 28], [34, 32], [-2, 30], [-24, 22]
  ], mats);
  addRamp(root, mats);

  addTrees(root, mats);
  addLamps(root, mats);
  addContext(root, mats);
  addSign(root, mats);

  const anchors = {
    overview: v3(0, 17, -18),
    facade: v3(-8, 21, 4),
    pool: v3(-26, 8, 20),
    mouth: v3(large.mouthCenter.x, 20, large.mouthCenter.z),
    detail: v3(-44, 31, 6),
    twin: v3(26, 38, -4),
    shell: v3(-48, 43, -54),
    small: v3(small.mouthCenter.x + 4, 20, small.mouthCenter.z + 2),
    entry: v3(18, 5, 30),
    water: v3(-38, 2, 40)
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