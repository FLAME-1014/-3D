/* 广州大剧院近景 · 场景模型（纯程序化几何） */
(function () {
  "use strict";

  var PLATFORM_Y = 5;

  var LARGE = {
    id: "large",
    cx: -35, cz: -55, rx: 57, rz: 41.5, h: 43.1,
    rot: -0.62, rings: 6, seg: 14, seed: 7,
    apexX: 0, apexZ: 0, driftX: 4.0, driftZ: -2.0, frontKeep: 1.0,
    // [u, 高度比, 平面 X 收缩, 平面 Z 收缩]：南面近垂直、长顶脊、北面收坡
    prof: [[0, 0, 1, 1], [0.22, 0.32, 1.03, 1.0], [0.48, 0.62, 1.02, 0.98],
      [0.68, 0.80, 0.98, 0.90], [0.86, 0.94, 0.72, 0.55], [1, 1.0, 0.45, 0.05]],
    // 强烈不规则多边形：口部面 + 东北凹口 + 西南尖角
    plan: [[0, 0.98], [35, 1.06], [60, 1.07], [85, 1.02], [115, 0.82], [150, 0.90],
      [190, 0.99], [225, 1.08], [260, 1.0], [300, 0.86], [335, 0.98]],
    mouth: { r0: 1, r1: 3, s0: 1, s1: 4, inset: 1.6 },
    stone: "dark"
  };
  var SMALL = {
    id: "small",
    cx: 35, cz: -62, rx: 31, rz: 22, h: 28,
    rot: -0.55, rings: 5, seg: 12, seed: 13,
    apexX: 1, apexZ: 0, driftX: 2.0, driftZ: 1.0, frontKeep: 0.9,
    prof: [[0, 0, 1, 1], [0.30, 0.46, 1.02, 1.0], [0.58, 0.72, 0.99, 0.92],
      [0.80, 0.90, 0.80, 0.60], [1, 1.0, 0.44, 0.05]],
    plan: [[0, 0.86], [30, 1.04], [65, 1.09], [95, 0.98], [125, 0.82], [160, 0.92],
      [200, 0.98], [240, 0.86], [275, 1.02], [310, 0.94], [340, 0.82]],
    mouth: { r0: 1, r1: 2, s0: 2, s1: 4, inset: 1.2 },
    stone: "light"
  };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rotXZ(x, z, rot) {
    var c = Math.cos(rot), s = Math.sin(rot);
    return [x * c + z * s, -x * s + z * c];
  }

  /* 合并非索引几何（position / normal / uv） */
  function mergeGeometries(list) {
    var pos = [], nrm = [], uv = [];
    list.forEach(function (g) {
      if (!g.attributes.normal) g.computeVertexNormals();
      var geo = g.index ? g.toNonIndexed() : g;
      var p = geo.attributes.position.array;
      var n = geo.attributes.normal.array;
      var u = geo.attributes.uv ? geo.attributes.uv.array : null;
      for (var i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nrm.push(n[i], n[i + 1], n[i + 2]);
      }
      var count = p.length / 3;
      for (var k = 0; k < count; k++) {
        if (u) uv.push(u[k * 2], u[k * 2 + 1]);
        else uv.push(0, 0);
      }
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return out;
  }

  function GeoBuilder(withColor) { this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.withColor = !!withColor; }
  GeoBuilder.prototype.tri = function (a, b, c, ua, ub, uc, color) {
    var ab = new THREE.Vector3().subVectors(b, a);
    var ac = new THREE.Vector3().subVectors(c, a);
    var n = ab.cross(ac).normalize();
    var verts = [a, b, c];
    var uvs = [ua, ub, uc];
    for (var i = 0; i < 3; i++) {
      this.pos.push(verts[i].x, verts[i].y, verts[i].z);
      this.nrm.push(n.x, n.y, n.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
      if (this.withColor) {
        var cc = color || { r: 1, g: 1, b: 1 };
        this.col.push(cc.r, cc.g, cc.b);
      }
    }
  };
  GeoBuilder.prototype.quad = function (a, b, c, d, ua, ub, uc, ud, color) {
    this.tri(a, b, c, ua, ub, uc, color);
    this.tri(a, c, d, ua, uc, ud, color);
  };
  GeoBuilder.prototype.box = function (x, y, z, sx, sy, sz, uvScale) {
    var s = uvScale || 1;
    var x0 = x - sx / 2, x1 = x + sx / 2, y0 = y - sy / 2, y1 = y + sy / 2, z0 = z - sz / 2, z1 = z + sz / 2;
    var p = function (a, b, c) { return new THREE.Vector3(a, b, c); };
    this.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), [0, 0], [sx / s, 0], [sx / s, sy / s], [0, sy / s]);
    this.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), [0, 0], [sx / s, 0], [sx / s, sy / s], [0, sy / s]);
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), [0, 0], [sz / s, 0], [sz / s, sy / s], [0, sy / s]);
    this.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), [0, 0], [sz / s, 0], [sz / s, sy / s], [0, sy / s]);
    this.quad(p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), [0, 0], [sx / s, 0], [sx / s, sz / s], [0, sz / s]);
    this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), [0, 0], [sx / s, 0], [sx / s, sz / s], [0, sz / s]);
  };
  GeoBuilder.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.withColor) g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  };

  function gridGeometry(x0, x1, z0, z1, nx, nz, heightFn, uvScale) {
    var pos = [], uv = [], idx = [];
    for (var j = 0; j <= nz; j++) {
      for (var i = 0; i <= nx; i++) {
        var x = x0 + (x1 - x0) * (i / nx);
        var z = z0 + (z1 - z0) * (j / nz);
        pos.push(x, heightFn(x, z), z);
        uv.push(x / (uvScale || 10), z / (uvScale || 10));
      }
    }
    for (var j2 = 0; j2 < nz; j2++) {
      for (var i2 = 0; i2 < nx; i2++) {
        var a = j2 * (nx + 1) + i2, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ---------------- 双砾折面壳 ---------------- */

  function profileAt(prof, u) {
    for (var i = 1; i < prof.length; i++) {
      if (u <= prof[i][0]) {
        var a = prof[i - 1], b = prof[i];
        var k = (u - a[0]) / Math.max(1e-5, b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
      }
    }
    return [prof[prof.length - 1][1], prof[prof.length - 1][2], prof[prof.length - 1][3]];
  }
  function planRadius(plan, ang) {
    var deg = ((ang * 180 / Math.PI) % 360 + 360) % 360;
    for (var i = 0; i < plan.length; i++) {
      var a = plan[i], b = plan[(i + 1) % plan.length];
      var a0 = a[0], b0 = b[0] + (b[0] <= a0 ? 360 : 0);
      var d = deg < a0 ? deg + 360 : deg;
      if (d >= a0 && d <= b0) {
        var k = (d - a0) / Math.max(1e-5, b0 - a0);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return 1;
  }
  function shellGrid(cfg, low) {
    var rings = low ? Math.max(4, cfg.rings - 2) : cfg.rings;
    var seg = low ? Math.max(12, cfg.seg - 4) : cfg.seg;
    var grid = [];
    var centers = [];
    var apexY = 0;
    for (var r2 = 0; r2 < rings; r2++) {
      var u = r2 / (rings - 1);
      var pr = profileAt(cfg.prof, u);
      var y = cfg.h * pr[0];
      var dx = cfg.driftX * Math.pow(u, 1.6);
      var dz = cfg.driftZ * Math.pow(u, 1.5);
      var cxr = cfg.cx + dx, czr = cfg.cz + dz;
      centers.push(new THREE.Vector3(cxr, 0, czr));
      var row = [];
      var phase = (r2 % 2) * 0.5 * (Math.PI / seg) * 0.6;
      for (var s = 0; s < seg; s++) {
        var ang = (s / seg) * Math.PI * 2 + phase;
        var planar = planRadius(cfg.plan, ang);
        var localX = Math.cos(ang) * cfg.rx * pr[1] * planar;
        var zKeep = cfg.frontKeep ? cfg.frontKeep * (1 - pr[2]) * cfg.rz : 0;
        var localZ = Math.sin(ang) * cfg.rz * pr[2] * planar + zKeep;
        var rp = rotXZ(localX, localZ, cfg.rot);
        var yy = y + cfg.h * 0.012 * Math.cos(2 * ang + 0.5) * u;
        yy += cfg.h * 0.055 * Math.cos(ang) * Math.pow(u, 2.3);
        yy += cfg.h * 0.012 * Math.sin(ang) * Math.pow(u, 3.0);
        yy = Math.min(yy, cfg.h - 0.35);
        if (u < 0.1) yy = Math.max(yy, 0);
        row.push(new THREE.Vector3(cxr + rp[0], yy, czr + rp[1]));
      }
      grid.push(row);
      if (r2 === rings - 1) {
        for (var q = 0; q < row.length; q++) apexY += row[q].y;
        apexY /= row.length;
      }
    }
    var apex = new THREE.Vector3(cfg.cx + cfg.apexX, cfg.h, cfg.cz + cfg.apexZ);
    return { grid: grid, centers: centers, rings: rings, seg: seg, apex: apex };
  }

  function insetPoint(p, center, amount) {
    var dx = center.x - p.x, dz = center.z - p.z;
    var len = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(p.x + (dx / len) * amount, p.y, p.z + (dz / len) * amount);
  }

  function buildPebble(cfg, shellMat, revealMat, glassMat, diagMat, low, backMat) {
    var sh = shellGrid(cfg, low);
    var grid = sh.grid, rings = sh.rings, seg = sh.seg;
    var mouth = cfg.mouth;
    var mouthScale = low ? 0.85 : 1;
    var r0 = Math.min(mouth.r0, rings - 2);
    var r1 = Math.min(mouth.r1, rings - 1);
    var s0 = mouth.s0;
    var s1 = mouth.s1;
    var stone = new GeoBuilder(true);
    var tintRand = mulberry32(cfg.seed * 31 + 5);
    var uRepeat = cfg.id === "large" ? 14 : 9;
    var vRepeat = cfg.id === "large" ? 4 : 3.2;
    var inMouth = {};
    for (var rr = r0; rr < r1; rr++) {
      for (var ss = s0; ss < s1; ss++) inMouth[rr + ":" + (ss % seg)] = true;
    }
    for (var r = 0; r < rings - 1; r++) {
      for (var s = 0; s < seg; s++) {
        if (inMouth[r + ":" + s]) continue;
        var a = grid[r][s];
        var b = grid[r][(s + 1) % seg];
        var c = grid[r + 1][s];
        var d = grid[r + 1][(s + 1) % seg];
        var u0 = (s / seg) * uRepeat + (r / (rings - 1)) * 1.3;
        var u1 = ((s + 1) / seg) * uRepeat + (r / (rings - 1)) * 1.3;
        var v0 = (r / (rings - 1)) * vRepeat, v1 = ((r + 1) / (rings - 1)) * vRepeat;
        var sh1 = 0.84 + tintRand() * 0.26;
        var sh2 = 0.84 + tintRand() * 0.26;
        stone.tri(a, c, b, [u0, v0], [u0, v1], [u1, v0], { r: sh1, g: sh1 * 0.995, b: sh1 * 0.972 });
        stone.tri(b, c, d, [u1, v0], [u0, v1], [u1, v1], { r: sh2, g: sh2 * 0.995, b: sh2 * 0.972 });
      }
    }
    // 顶部收口
    var topRow = grid[rings - 1];
    for (var s2 = 0; s2 < seg; s2++) {
      var p1 = topRow[s2], p2 = topRow[(s2 + 1) % seg];
      var sh3 = 0.84 + tintRand() * 0.26;
      stone.tri(p1, sh.apex, p2, [(s2 / seg) * uRepeat, vRepeat + 0.2], [uRepeat * 0.5, vRepeat + 0.5], [((s2 + 1) / seg) * uRepeat, vRepeat + 0.2],
        { r: sh3, g: sh3 * 0.995, b: sh3 * 0.972 });
    }

    // 口部网格：外圈原始点 + 内凹玻璃点
    var outer = [], inner = [];
    for (var mr = r0; mr <= r1; mr++) {
      var rowO = [], rowI = [];
      for (var ms = s0; ms <= s1; ms++) {
        var p = grid[mr][ms % seg];
        rowO.push(p);
        rowI.push(insetPoint(p, sh.centers[mr], mouth.inset));
      }
      outer.push(rowO);
      inner.push(rowI);
    }
    var nr = outer.length - 1, ns = outer[0].length - 1;
    // 口部侧壁（石）
    var revealCol = { r: 0.7, g: 0.7, b: 0.68 };
    for (var i = 0; i < ns; i++) {
      stone.quad(outer[0][i], outer[0][i + 1], inner[0][i + 1], inner[0][i], [0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2], revealCol);
      stone.quad(outer[nr][i + 1], outer[nr][i], inner[nr][i], inner[nr][i + 1], [0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2], revealCol);
    }
    for (var j = 0; j < nr; j++) {
      stone.quad(outer[j + 1][0], outer[j][0], inner[j][0], inner[j + 1][0], [0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2], revealCol);
      stone.quad(outer[j][ns], outer[j + 1][ns], inner[j + 1][ns], inner[j][ns], [0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2], revealCol);
    }

    var stoneMesh = new THREE.Mesh(stone.geometry(), shellMat);
    stoneMesh.name = cfg.id + "-shell";
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;

    // 大玻璃折面：每个口部只留 2×3（大）/ 2×2（小）块大面板
    var sampleInner = function (u, v) {
      var fx = clamp(u, 0, 0.9999) * ns, fy = clamp(v, 0, 0.9999) * nr;
      var ix = Math.floor(fx), iy = Math.floor(fy);
      var tx = fx - ix, ty = fy - iy;
      var p00 = inner[iy][ix], p10 = inner[iy][ix + 1];
      var p01 = inner[iy + 1][ix], p11 = inner[iy + 1][ix + 1];
      var top = new THREE.Vector3().lerpVectors(p00, p10, tx);
      var bot = new THREE.Vector3().lerpVectors(p01, p11, tx);
      return new THREE.Vector3().lerpVectors(top, bot, ty);
    };
    var gCols = Math.min(cfg.id === "large" ? 3 : 2, ns);
    var gRows = Math.min(2, nr);
    var gb = new GeoBuilder();
    for (var gyy = 0; gyy < gRows; gyy++) {
      for (var gxx = 0; gxx < gCols; gxx++) {
        var u0 = gxx / gCols, u1 = (gxx + 1) / gCols, v0 = gyy / gRows, v1 = (gyy + 1) / gRows;
        var pA = sampleInner(u0, v0), pB = sampleInner(u0, v1);
        var pC = sampleInner(u1, v0), pD = sampleInner(u1, v1);
        gb.quad(pA, pB, pC, pD, [u0, 1 - v0], [u0, 1 - v1], [u1, 1 - v0], [u1, 1 - v1]);
      }
    }
    var glassMesh = new THREE.Mesh(gb.geometry(), glassMat);
    glassMesh.name = cfg.id + "-glass";
    glassMesh.renderOrder = 4;

    // 小砾石玻璃带后加一层深色反射背板，避免白天透出空洞
    var backing = null;
    if (backMat) {
      var bb = new GeoBuilder();
      for (var br = 0; br < nr; br++) {
        for (var bs = 0; bs < ns; bs++) {
          var ha = insetPoint(inner[br][bs], sh.centers[Math.min(br + 2, rings - 1)], 1.0);
          var hb = insetPoint(inner[br][bs + 1], sh.centers[Math.min(br + 2, rings - 1)], 1.0);
          var hc = insetPoint(inner[br + 1][bs], sh.centers[Math.min(br + 3, rings - 1)], 1.0);
          var hd = insetPoint(inner[br + 1][bs + 1], sh.centers[Math.min(br + 3, rings - 1)], 1.0);
          bb.quad(ha, hc, hb, hd, [0, 0], [0, 1], [1, 0], [1, 1]);
        }
      }
      backing = new THREE.Mesh(bb.geometry(), backMat);
      backing.name = cfg.id + "-glass-back";
    }

    // 斜网格杆件
    var bars = null;
    var barCount = 0;
    if (!low || cfg.id === "large") {
      var segs = [];
      var pushSeg = function (u1, v1, u2, v2, thick) {
        segs.push({ a: sampleInner(u1, v1), b: sampleInner(u2, v2), t: thick });
      };
      var edge = cfg.id === "large" ? 0.4 : 0.3;
      for (var i3 = 0; i3 <= gCols; i3++) {
        pushSeg(i3 / gCols, 0, i3 / gCols, 1, edge);
      }
      for (var j3 = 0; j3 <= gRows; j3++) {
        pushSeg(0, j3 / gRows, 1, j3 / gRows, edge);
      }
      for (var gx3 = 0; gx3 < gCols; gx3++) {
        for (var gy3 = 0; gy3 < gRows; gy3++) {
          if ((gx3 + gy3) % 2 === 0) pushSeg(gx3 / gCols, gy3 / gRows, (gx3 + 1) / gCols, (gy3 + 1) / gRows, 0);
          else pushSeg((gx3 + 1) / gCols, gy3 / gRows, gx3 / gCols, (gy3 + 1) / gRows, 0);
        }
      }
      var barMat = diagMat;
      var geo = new THREE.BoxGeometry(1, 1, 1);
      bars = new THREE.InstancedMesh(geo, barMat, segs.length);
      bars.name = cfg.id + "-diagrid";
      bars.renderOrder = 6;
      var up = new THREE.Vector3(0, 1, 0);
      var q = new THREE.Quaternion();
      var m = new THREE.Matrix4();
      var mid = new THREE.Vector3();
      var dir = new THREE.Vector3();
      var center = new THREE.Vector3(cfg.cx, 0, cfg.cz);
      segs.forEach(function (s4, i5) {
        dir.subVectors(s4.b, s4.a);
        var len = dir.length();
        var t = s4.t || 0.17;
        var outward = new THREE.Vector3().subVectors(s4.a, center);
        outward.y = 0;
        outward.normalize().multiplyScalar(0.22);
        mid.addVectors(s4.a, s4.b).multiplyScalar(0.5).add(outward);
        q.setFromUnitVectors(up, dir.clone().normalize());
        m.compose(mid, q, new THREE.Vector3(t, len + t * 0.6, t));
        bars.setMatrixAt(i5, m);
      });
      bars.instanceMatrix.needsUpdate = true;
      bars.castShadow = false;
      barCount = segs.length;
    }

    // 包围盒 / 测量
    var box = new THREE.Box3();
    grid.forEach(function (row) { row.forEach(function (p) { box.expandByPoint(p); }); });
    box.expandByPoint(sh.apex);
    var base = grid[0];
    var minLX = Infinity, maxLX = -Infinity, minLZ = Infinity, maxLZ = -Infinity;
    base.forEach(function (p) {
      var lp = rotXZ(p.x - cfg.cx, p.z - cfg.cz, -cfg.rot);
      minLX = Math.min(minLX, lp[0]); maxLX = Math.max(maxLX, lp[0]);
      minLZ = Math.min(minLZ, lp[1]); maxLZ = Math.max(maxLZ, lp[1]);
    });
    var extX = maxLX - minLX, extZ = maxLZ - minLZ;
    var size = box.getSize(new THREE.Vector3());
    var result = {
      id: cfg.id,
      mesh: stoneMesh,
      glass: glassMesh,
      backing: backing,
      bars: bars,
      barCount: barCount,
      grid: grid,
      rings: rings,
      seg: seg,
      mouthOuter: outer,
      mouthInner: inner,
      box: box,
      cfg: cfg,
      measured: {
        height: +size.y.toFixed(1),
        length: +Math.max(extX, extZ).toFixed(1),
        width: +Math.min(extX, extZ).toFixed(1),
        sizeX: +size.x.toFixed(1),
        sizeZ: +size.z.toFixed(1),
        apexY: +sh.apex.y.toFixed(1)
      }
    };
    return result;
  }

  function measureGap(a, b) {
    var best = Infinity;
    a.forEach(function (row) {
      row.forEach(function (p) {
        b.forEach(function (row2) {
          row2.forEach(function (q) {
            var d = Math.hypot(p.x - q.x, p.z - q.z);
            if (d < best) best = d;
          });
        });
      });
    });
    return best;
  }

  /* ---------------- 时间 uniform ---------------- */
  var glassUniforms = {
    uTime: { value: 0 },
    uMode: { value: 0 },
    uInterior: { value: 0.15 },
    uSky: { value: new THREE.Color(0x9fb9c4).convertSRGBToLinear() },
    uWarm: { value: new THREE.Color(0xffd09a).convertSRGBToLinear() },
    uGridTex: { value: null },
    uOpacity: { value: 0.42 },
    uFogColor: { value: new THREE.Color(0xa9bdc6).convertSRGBToLinear() },
    uFogDensity: { value: 0.00055 }
  };
  var waterUniforms = {
    uTime: { value: 0 },
    uMode: { value: 0 },
    uDeep: { value: new THREE.Color(0x1f3538).convertSRGBToLinear() },
    uSky: { value: new THREE.Color(0x9fc2d2).convertSRGBToLinear() },
    uWarm: { value: new THREE.Color(0xffcf96).convertSRGBToLinear() },
    uRippleTex: { value: null },
    uFogColor: { value: new THREE.Color(0xa9bdc6).convertSRGBToLinear() },
    uFogDensity: { value: 0.00055 }
  };

  function build(opts) {
    var T = opts.textures;
    var low = !!opts.low;
    glassUniforms.uGridTex.value = T.glassMouth;
    waterUniforms.uRippleTex.value = T.water;

    var root = new THREE.Group();
    root.name = "operahouse";
    var materials = {};
    var hotspots = [];

    /* -------- 材质 -------- */
    var stoneDarkMat = new THREE.MeshStandardMaterial({
      map: T.stoneDark, bumpMap: T.stoneBump, bumpScale: 0.32,
      color: 0xffffff, roughness: 0.86, metalness: 0.06, side: THREE.DoubleSide,
      vertexColors: true
    });
    var stoneLightMat = new THREE.MeshStandardMaterial({
      map: T.stoneLight, bumpMap: T.stoneBump, bumpScale: 0.24,
      color: 0xffffff, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide,
      vertexColors: true
    });
    var glassMat = new THREE.ShaderMaterial({
      uniforms: glassUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: [
        "varying vec3 vWorld;",
        "varying vec3 vNormalW;",
        "varying vec2 vUvG;",
        "varying float vDist;",
        "void main() {",
        "  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;",
        "  vNormalW = normalize(mat3(modelMatrix) * normal);",
        "  vUvG = uv;",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  vDist = -mv.z;",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform float uMode;",
        "uniform float uInterior;",
        "uniform vec3 uSky;",
        "uniform vec3 uWarm;",
        "uniform sampler2D uGridTex;",
        "uniform float uOpacity;",
        "uniform vec3 uFogColor;",
        "uniform float uFogDensity;",
        "varying vec3 vWorld;",
        "varying vec3 vNormalW;",
        "varying vec2 vUvG;",
        "varying float vDist;",
        "void main() {",
        "  vec3 N = normalize(vNormalW);",
        "  vec3 V = normalize(cameraPosition - vWorld);",
        "  float f = pow(1.0 - abs(dot(N, V)), 2.4);",
        "  float vgrad = smoothstep(0.0, 1.0, vUvG.y);",
        "  vec3 skyRef = uSky * (0.32 + 0.68 * vgrad);",
        "  vec3 col = mix(vec3(0.030, 0.050, 0.060), skyRef, 0.30 + 0.45 * f);",
        "  float gl = texture2D(uGridTex, vUvG * vec2(4.0, 2.4)).g;",
        "  col += vec3(gl) * 0.045;",
        "  col *= 0.86 + 0.14 * smoothstep(0.0, 0.35, vUvG.y);",
        "  col += skyRef * 0.12 * smoothstep(0.15, 0.95, vUvG.y);",
        "  float warmBand = smoothstep(0.0, 0.85, 1.0 - vUvG.y) * 0.6 + 0.25;",
        "  vec3 warm = uWarm * warmBand;",
        "  col = mix(col, warm, clamp(uInterior * 0.62, 0.0, 0.88));",
        "  float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);",
        "  col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));",
        "  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.4545)), uOpacity);",
        "}"
      ].join("\n")
    });
    var diagMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x14191a).convertSRGBToLinear(), transparent: true, opacity: 1 });
    var slitMat = new THREE.MeshStandardMaterial({
      color: 0x384b53, roughness: 0.14, metalness: 0.5, side: THREE.DoubleSide
    });

    /* -------- 双砾 -------- */
    var large = buildPebble(LARGE, stoneDarkMat, stoneDarkMat, glassMat, diagMat, low, null);
    var small = buildPebble(SMALL, stoneLightMat, stoneLightMat, glassMat, diagMat, low, slitMat);
    root.add(large.mesh, large.glass, small.mesh, small.glass);
    if (small.backing) root.add(small.backing);
    if (large.bars) root.add(large.bars);
    if (small.bars) root.add(small.bars);

    // 西侧/顶部狭长玻璃缝（贴面，不开口）
    var slitB = new GeoBuilder();
    function addSlit(localTheta, t, w, h, push, plane) {
      var cfg = LARGE;
      var rings = large.rings, seg = large.seg;
      var rr = 2 + Math.floor(t * (rings - 3));
      var idx = Math.round((localTheta / (Math.PI * 2)) * seg) % seg;
      var p = large.grid[rr][idx];
      var center = new THREE.Vector3(cfg.cx, 0, cfg.cz);
      var n = new THREE.Vector3(p.x - center.x, 0, p.z - center.z).normalize();
      var up = new THREE.Vector3(0, 1, 0);
      var side = new THREE.Vector3().crossVectors(up, n).normalize();
      var base = p.clone().add(n.clone().multiplyScalar(push));
      var a = base.clone().add(side.clone().multiplyScalar(-w / 2)).add(up.clone().multiplyScalar(-h / 2));
      var b = base.clone().add(side.clone().multiplyScalar(w / 2)).add(up.clone().multiplyScalar(-h / 2));
      var c = base.clone().add(side.clone().multiplyScalar(w / 2)).add(up.clone().multiplyScalar(h / 2));
      var d = base.clone().add(side.clone().multiplyScalar(-w / 2)).add(up.clone().multiplyScalar(h / 2));
      slitB.quad(a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1]);
    }
    addSlit(Math.PI * 1.02, 0.62, 14, 2.4, 0.45, "double");
    addSlit(Math.PI * 1.12, 0.52, 9, 1.8, 0.45, "double");
    addSlit(Math.PI * 1.25, 0.7, 7, 1.4, 0.45, "double");
    var slits = new THREE.Mesh(slitB.geometry(), slitMat);
    slits.name = "west-slits";
    root.add(slits);

    // 屋顶长条天窗
    var roofSlitGeo = new THREE.PlaneGeometry(16, 3.2);
    var roofSlit = new THREE.Mesh(roofSlitGeo, slitMat);
    roofSlit.position.set(-24, 43.9, -48);
    roofSlit.rotation.set(-Math.PI / 2 + 0.28, 0.4, 0.18);
    root.add(roofSlit);

    /* -------- 浅层 lobby 剪影 -------- */
    var lobbyMats = {};
    lobbyMats.glow = new THREE.MeshBasicMaterial({
      map: T.lobby, color: 0xffffff, transparent: true, opacity: 0.0,
      depthWrite: false, side: THREE.DoubleSide
    });
    lobbyMats.floor = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffcf96).convertSRGBToLinear(), transparent: true, opacity: 0.0, depthWrite: false
    });
    function buildLobby(cfg, w, h, d, backOffset, floorOffset) {
      var group = new THREE.Group();
      var wallMat = new THREE.MeshBasicMaterial({ color: 0x0b0907, side: THREE.BackSide });
      var bw = w * 0.7, bh = h * 0.6, bd = d * 0.75;
      var box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
      box.position.set(cfg.cx, bh / 2 + 1.5, cfg.cz + 2);
      group.add(box);
      var back = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.78), lobbyMats.glow);
      back.position.set(cfg.cx, 6 + h * 0.36, cfg.cz + backOffset);
      group.add(back);
      var floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, d * 0.45), lobbyMats.floor);
      floorGlow.rotation.x = -Math.PI / 2;
      floorGlow.position.set(cfg.cx, 6.3, cfg.cz + floorOffset);
      group.add(floorGlow);
      var colB = new GeoBuilder();
      for (var i = 0; i < 4; i++) {
        var cx = cfg.cx - w * 0.28 + i * (w * 0.19);
        colB.box(cx, h * 0.34, cfg.cz + 9, 1.1, h * 0.58, 1.1, 4);
      }
      var cols = new THREE.Mesh(colB.geometry(), new THREE.MeshStandardMaterial({
        color: 0x1a1a19, roughness: 0.6, metalness: 0.4
      }));
      group.add(cols);
      return group;
    }
    root.add(buildLobby(LARGE, 80, 40, 46, 20, 32));
    var smallLobby = buildLobby({ cx: SMALL.cx, cz: SMALL.cz }, 38, 18, 24, 16, 24);
    root.add(smallLobby);

    /* -------- 石面基座光（夜间自发光裙边） -------- */
    var baseUniforms = { uIntensity: { value: 0 }, uColor: { value: new THREE.Color(0xffc78e).convertSRGBToLinear() }, uFade: { value: 11.0 } };
    var baseMat = new THREE.ShaderMaterial({
      uniforms: baseUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        "varying float vY;",
        "void main() {",
        "  vec4 wp = modelMatrix * vec4(position, 1.0);",
        "  vY = wp.y;",
        "  gl_Position = projectionMatrix * viewMatrix * wp;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uIntensity;",
        "uniform vec3 uColor;",
        "uniform float uFade;",
        "varying float vY;",
        "void main() {",
        "  float a = uIntensity * exp(-max(vY - 5.0, 0.0) / uFade);",
        "  gl_FragColor = vec4(pow(uColor, vec3(0.4545)), a * 0.85);",
        "}"
      ].join("\n")
    });
    function buildSkirt(pebble, cfg) {
      var b = new GeoBuilder();
      var rows = Math.min(5, pebble.grid.length - 2);
      var seg = pebble.seg;
      for (var r = 0; r < rows; r++) {
        for (var s = 0; s < seg; s++) {
          var a = pebble.grid[r][s], bb = pebble.grid[r][(s + 1) % seg];
          var c = pebble.grid[r + 1][s], d = pebble.grid[r + 1][(s + 1) % seg];
          var cen = new THREE.Vector3(cfg.cx, 0, cfg.cz);
          var push = function (p) {
            var v = new THREE.Vector3(p.x - cen.x, 0, p.z - cen.z);
            var len = v.length() || 1;
            v.multiplyScalar(0.35 / len);
            return p.clone().add(v);
          };
          b.tri(push(a), push(c), push(bb), [0, 0], [0, 1], [1, 0]);
          b.tri(push(bb), push(c), push(d), [1, 0], [0, 1], [1, 1]);
        }
      }
      var mesh = new THREE.Mesh(b.geometry(), baseMat);
      mesh.name = cfg.id + "-baseglow";
      return mesh;
    }
    root.add(buildSkirt(large, LARGE));
    root.add(buildSkirt(small, SMALL));

    /* -------- 5 m 平台 / 坡道 / 栏板 -------- */
    var terracePts = [
      [-104, -130], [-110, -70], [-106, -10], [-96, 2], [-74, 7], [-46, 3],
      [-28, 7], [0, 9], [10, 9], [14, 7], [30, 8], [56, 3], [76, -6],
      [92, -22], [98, -52], [92, -86], [66, -110], [30, -124], [-20, -130], [-70, -132]
    ];
    var terraceWall = new GeoBuilder();
    for (var ti = 0; ti < terracePts.length; ti++) {
      var pa = terracePts[ti], pb = terracePts[(ti + 1) % terracePts.length];
      var A = new THREE.Vector3(pa[0], 0, pa[1]);
      var B = new THREE.Vector3(pb[0], 0, pb[1]);
      var C = new THREE.Vector3(pb[0], PLATFORM_Y, pb[1]);
      var D = new THREE.Vector3(pa[0], PLATFORM_Y, pa[1]);
      var len = A.distanceTo(B);
      terraceWall.quad(A, B, C, D, [0, 0], [len / 9, 0], [len / 9, 0.62], [0, 0.62]);
    }
    var terraceWallMat = new THREE.MeshStandardMaterial({
      map: T.paving,
      color: 0xd7d1c4, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide
    });
    var terraceWallMesh = new THREE.Mesh(terraceWall.geometry(), terraceWallMat);
    terraceWallMesh.receiveShadow = true;
    root.add(terraceWallMesh);

    var coping = new GeoBuilder();
    var cen2 = new THREE.Vector2(-15, -55);
    for (var ci2 = 0; ci2 < terracePts.length; ci2++) {
      var ca = terracePts[ci2], cb = terracePts[(ci2 + 1) % terracePts.length];
      var mx = (ca[0] + cb[0]) / 2, mz = (ca[1] + cb[1]) / 2;
      var ox = mx - cen2.x, oz = mz - cen2.y;
      var olen = Math.hypot(ox, oz) || 1;
      ox /= olen; oz /= olen;
      var A5 = new THREE.Vector3(ca[0] + ox * 0.02, 5.0, ca[1] + oz * 0.02);
      var B5 = new THREE.Vector3(cb[0] + ox * 0.02, 5.0, cb[1] + oz * 0.02);
      var A6 = new THREE.Vector3(ca[0] + ox * 0.85, 5.0, ca[1] + oz * 0.85);
      var B6 = new THREE.Vector3(cb[0] + ox * 0.85, 5.0, cb[1] + oz * 0.85);
      var A7 = new THREE.Vector3(ca[0] + ox * 0.85, 4.72, ca[1] + oz * 0.85);
      var B7 = new THREE.Vector3(cb[0] + ox * 0.85, 4.72, cb[1] + oz * 0.85);
      coping.quad(A5, B5, B6, A6, [0, 0], [1, 0], [1, 1], [0, 1]);
      coping.quad(A7, B7, B6, A6, [0, 0], [1, 0], [1, 1], [0, 1]);
    }
    var copingMesh = new THREE.Mesh(coping.geometry(), new THREE.MeshStandardMaterial({
      color: 0xd3ccbe, roughness: 0.82, metalness: 0.04
    }));
    root.add(copingMesh);

    var shape = new THREE.Shape();
    terracePts.forEach(function (pt, i) {
      if (i === 0) shape.moveTo(pt[0], -pt[1]);
      else shape.lineTo(pt[0], -pt[1]);
    });
    shape.closePath();
    var topGeo = new THREE.ShapeGeometry(shape);
    topGeo.rotateX(-Math.PI / 2);
    (function () {
      var pos = topGeo.attributes.position;
      var uv = topGeo.attributes.uv;
      for (var i = 0; i < pos.count; i++) {
        uv.setXY(i, pos.getX(i) / 7, pos.getZ(i) / 7);
      }
      uv.needsUpdate = true;
    })();
    var terraceTopMat = new THREE.MeshStandardMaterial({ map: T.pavingWarm, roughness: 0.9, metalness: 0.02 });
    var terraceTop = new THREE.Mesh(topGeo, terraceTopMat);
    terraceTop.position.y = PLATFORM_Y;
    terraceTop.receiveShadow = true;
    root.add(terraceTop);

    // 入口坡道：平台南缘 x 10..22 → 广场 z=57
    var ramp = new GeoBuilder();
    var rTop = PLATFORM_Y, rX0 = 10, rX1 = 22, rZ0 = 9, rZ1 = 57;
    var rampA = new THREE.Vector3(rX0, rTop, rZ0), rampB = new THREE.Vector3(rX1, rTop, rZ0);
    var rampC = new THREE.Vector3(rX1, 0, rZ1), rampD = new THREE.Vector3(rX0, 0, rZ1);
    var rlen = Math.hypot(rZ1 - rZ0, rTop);
    ramp.quad(rampA, rampB, rampC, rampD, [0, 0], [2, 0], [2, rlen / 8], [0, rlen / 8]);
    // 侧壁
    ramp.quad(new THREE.Vector3(rX0, 0, rZ0), rampA, rampD, new THREE.Vector3(rX0, 0, rZ1), [0, 0], [0, 1], [1, 0], [1, 1]);
    ramp.quad(new THREE.Vector3(rX1, 0, rZ1), rampC, rampB, new THREE.Vector3(rX1, 0, rZ0), [0, 0], [0, 1], [1, 0], [1, 1]);
    var rampMesh = new THREE.Mesh(ramp.geometry(), terraceTopMat);
    rampMesh.material = terraceTopMat;
    rampMesh.receiveShadow = true;
    root.add(rampMesh);

    // 坡道栏杆 + 平台栏板
    var railB = new GeoBuilder();
    var railPosts = [];
    function railRun(ax, az, ay, bx, bz, by, step) {
      var dx = bx - ax, dz = bz - az, dy = by - ay;
      var len = Math.hypot(dx, dz);
      var n = Math.max(2, Math.round(len / (step || 2.4)));
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        railPosts.push([ax + dx * t, ay + dy * t, az + dz * t]);
      }
      var a = new THREE.Vector3(ax, ay + 1.05, az), b = new THREE.Vector3(bx, by + 1.05, bz);
      var c = new THREE.Vector3(bx, by + 0.88, bz), d = new THREE.Vector3(ax, ay + 0.88, az);
      railB.quad(a, b, c, d, [0, 0], [len / 2, 0], [len / 2, 0.2], [0, 0.2]);
    }
    railRun(rX0 + 0.3, rZ0, rTop, rX0 + 0.3, rZ1, 0, 2.2);
    railRun(rX1 - 0.3, rZ0, rTop, rX1 - 0.3, rZ1, 0, 2.2);
    var railMesh = new THREE.Mesh(railB.geometry(), new THREE.MeshStandardMaterial({
      color: 0x8d9294, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide
    }));
    root.add(railMesh);
    var postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.05, 4);
    postGeo.translate(0, 0.525, 0);
    var postMesh = new THREE.InstancedMesh(postGeo, railMesh.material, railPosts.length);
    var pm = new THREE.Matrix4();
    railPosts.forEach(function (p, i) {
      pm.makeTranslation(p[0], p[1], p[2]);
      postMesh.setMatrixAt(i, pm);
    });
    root.add(postMesh);

    /* -------- 水池 -------- */
    var poolA = { x0: -74, x1: -2, z0: 8, z1: 64 };
    var poolB = { x0: 30, x1: 72, z0: 36, z1: 52 };
    var waterMat = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      vertexShader: [
        "varying vec3 vWorld;",
        "varying float vDist;",
        "void main() {",
        "  vec4 wp = modelMatrix * vec4(position, 1.0);",
        "  vWorld = wp.xyz;",
        "  vec4 mv = viewMatrix * wp;",
        "  vDist = -mv.z;",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform float uMode;",
        "uniform vec3 uDeep;",
        "uniform vec3 uSky;",
        "uniform vec3 uWarm;",
        "uniform sampler2D uRippleTex;",
        "uniform vec3 uFogColor;",
        "uniform float uFogDensity;",
        "varying vec3 vWorld;",
        "varying float vDist;",
        "void main() {",
        "  vec2 p = vWorld.xz;",
        "  float w = sin(p.x * 0.21 + uTime * 0.32) + sin(p.y * 0.29 - uTime * 0.24);",
        "  float rip = texture2D(uRippleTex, p * 0.02 + vec2(w * 0.004, uTime * 0.004)).r;",
        "  float smear = texture2D(uRippleTex, vec2(p.x * 0.05 + 0.4, p.y * 0.09 - uTime * 0.015)).r;",
        "  float fine = texture2D(uRippleTex, vec2(p.x * 0.16 + 0.1, p.y * 0.21 + uTime * 0.01)).r;",
        "  float ripA = texture2D(uRippleTex, vec2(p.x * 0.55, p.y * 0.22 - uTime * 0.02)).r;",
        "  float ripB = texture2D(uRippleTex, vec2(p.x * 0.18 + 0.3, p.y * 0.60 + uTime * 0.03)).r;",
        "  float wv1 = sin(p.y * 1.05 - uTime * 0.72 + sin(p.x * 0.16) * 1.2);",
        "  float wv2 = sin(p.x * 0.42 + p.y * 0.33 + uTime * 0.48);",
        "  float wv3 = sin(p.y * 2.35 + p.x * 0.14 - uTime * 1.15);",
        "  float wave = 0.5 + 0.22 * wv1 + 0.12 * wv2 + 0.08 * wv3 + (ripA - 0.45) * 0.18;",
        "  float waveHi = smoothstep(0.60, 0.95, wave);",
        "  vec3 V = normalize(cameraPosition - vWorld);",
        "  float fres = pow(1.0 - max(V.y, 0.0), 3.0);",
        "  vec3 col = mix(uDeep, uSky, 0.08 + 0.38 * fres);",
        "  col += (rip - 0.5) * 0.05 + (wave - 0.5) * 0.035;",
        "  float shade = smoothstep(8.0, 34.0, p.y);",
        "  col = mix(col * 0.4, col, shade);",
        "  vec3 Rf = reflect(-V, vec3(0.0, 1.0, 0.0));",
        "  vec3 ocL = (vWorld - vec3(-35.0, 21.5, -55.0)) / vec3(60.0, 21.5, 44.0);",
        "  vec3 rdL = Rf / vec3(60.0, 21.5, 44.0);",
        "  float aL = dot(rdL, rdL);",
        "  float bL = 2.0 * dot(ocL, rdL);",
        "  float cL = dot(ocL, ocL) - 1.0;",
        "  float dL = bL * bL - 4.0 * aL * cL;",
        "  float tL = (-bL - sqrt(max(dL, 0.0))) / (2.0 * aL);",
        "  float hitL = step(0.0, dL) * step(0.0, tL);",
        "  vec3 QL = vWorld + Rf * tL;",
        "  float rough = 0.55 + 0.45 * fine;",
        "  col = mix(col, uDeep * 0.4 + uWarm * 0.015, hitL * 0.8 * rough);",
        "  float mouthMask = smoothstep(-82.0, -72.0, QL.x) * (1.0 - smoothstep(-30.0, -18.0, QL.x));",
        "  mouthMask *= smoothstep(3.0, 7.0, QL.y) * (1.0 - smoothstep(33.0, 38.0, QL.y));",
        "  mouthMask *= smoothstep(-42.0, -36.0, QL.z) * (1.0 - smoothstep(-14.0, -6.0, QL.z));",
        "  col += uWarm * uMode * hitL * mouthMask * (0.10 + 0.22 * smear) * (0.30 + 0.95 * waveHi);",
        "  float qx = (p.x + 45.0) / 20.0;",
        "  float sx = exp(-qx * qx);",
        "  float sz = smoothstep(3.0, 10.0, p.y) * (1.0 - smoothstep(26.0, 54.0, p.y));",
        "  col += uWarm * uMode * sx * sz * (0.05 + 0.30 * smear) * (0.35 + 1.2 * waveHi);",
        "  col += vec3(1.0, 0.93, 0.82) * uMode * pow(waveHi, 2.0) * sx * sz * 0.16;",
        "  col += uWarm * uMode * 0.05 * exp(-(p.y - 9.0) * 0.12) * (0.5 + 0.5 * wave);",
        "  float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);",
        "  col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));",
        "  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.4545)), 1.0);",
        "}"
      ].join("\n")
    });
    function addPool(p) {
      var geo = new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0);
      geo.rotateX(-Math.PI / 2);
      var m = new THREE.Mesh(geo, waterMat);
      m.position.set((p.x0 + p.x1) / 2, 0.3, (p.z0 + p.z1) / 2);
      root.add(m);
    }
    addPool(poolA);
    addPool(poolB);

    var curb = new GeoBuilder();
    function curbRing(p) {
      var h = 0.62, w = 0.62;
      curb.box((p.x0 + p.x1) / 2, h / 2, p.z0 - w / 2, p.x1 - p.x0 + w * 2, h, w, 6);
      curb.box((p.x0 + p.x1) / 2, h / 2, p.z1 + w / 2, p.x1 - p.x0 + w * 2, h, w, 6);
      curb.box(p.x0 - w / 2, h / 2, (p.z0 + p.z1) / 2, w, h, p.z1 - p.z0, 6);
      curb.box(p.x1 + w / 2, h / 2, (p.z0 + p.z1) / 2, w, h, p.z1 - p.z0, 6);
    }
    curbRing(poolA);
    curbRing(poolB);
    var curbMesh = new THREE.Mesh(curb.geometry(), new THREE.MeshStandardMaterial({
      map: T.stoneLight, color: 0xd9d3c6, roughness: 0.8, metalness: 0.04
    }));
    curbMesh.receiveShadow = true;
    root.add(curbMesh);

    // 水上步道（pool 视点站立处）
    var walkB = new GeoBuilder();
    walkB.box(-15, 0.28, 35, 8, 0.56, 58, 6);
    walkB.box(-18.6, 0.62, 35, 0.8, 0.12, 58, 6);
    walkB.box(-11.4, 0.62, 35, 0.8, 0.12, 58, 6);
    var walkMat = new THREE.MeshStandardMaterial({
      map: T.pavingWarm, color: 0xc9c2b4, roughness: 0.88, metalness: 0.03
    });
    var walkMesh = new THREE.Mesh(walkB.geometry(), walkMat);
    walkMesh.receiveShadow = true;
    root.add(walkMesh);

    /* -------- 草坡 -------- */
    function hillHeight(x, z) {
      var t = clamp((31 - z) / 34, 0, 1);
      var s = t * t * (3 - 2 * t);
      var n = Math.sin(x * 0.21 + 1.2) * 0.28 + Math.cos(z * 0.17) * 0.22;
      var ex = clamp((x - 26) / 9, 0, 1) * clamp((98 - x) / 9, 0, 1);
      var sx = ex * ex * (3 - 2 * ex);
      return sx * s * (5 + n) * 0.98;
    }
    var grassMat = new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1.0, metalness: 0.0 });
    var hillEast = new THREE.Mesh(gridGeometry(26, 98, -6, 31, low ? 14 : 26, low ? 9 : 15, hillHeight, 9), grassMat);
    hillEast.receiveShadow = true;
    root.add(hillEast);
    function hillWest(x, z) {
      var t = clamp((31 - z) / 30, 0, 1);
      var s = t * t * (3 - 2 * t);
      var ex = clamp((x + 104) / 8, 0, 1) * clamp((-77 - x) / 8, 0, 1);
      var sx = ex * ex * (3 - 2 * ex);
      return sx * s * 5 * (0.92 + Math.sin(x * 0.25) * 0.05);
    }
    var hillWestMesh = new THREE.Mesh(gridGeometry(-104, -77, 4, 31, low ? 8 : 14, low ? 7 : 12, hillWest, 9), grassMat);
    hillWestMesh.receiveShadow = true;
    root.add(hillWestMesh);

    // 挡墙
    var walls = new GeoBuilder();
    walls.box(62, 0.42, 31.4, 72, 0.84, 0.8, 5);
    walls.box(-90.5, 0.42, 31.4, 27, 0.84, 0.8, 5);
    walls.box(26.4, 0.9, 12, 0.7, 1.8, 38, 5);
    var wallsMesh = new THREE.Mesh(walls.geometry(), new THREE.MeshStandardMaterial({
      map: T.stoneLight, color: 0xd8d2c4, roughness: 0.86, metalness: 0.03
    }));
    root.add(wallsMesh);

    // 草簇
    var tuftGeo = new THREE.PlaneGeometry(2.4, 1.35);
    tuftGeo.translate(0, 0.65, 0);
    var tuftMat = new THREE.MeshStandardMaterial({
      map: T.tallGrass, transparent: true, alphaTest: 0.42, side: THREE.DoubleSide,
      roughness: 1, metalness: 0, color: 0xd6dbc8
    });
    var tuftCount = low ? 90 : 220;
    var tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    var trand = mulberry32(99);
    var tmat = new THREE.Matrix4();
    var tquat = new THREE.Quaternion();
    var tscale = new THREE.Vector3();
    for (var ti2 = 0; ti2 < tuftCount; ti2++) {
      var tx = 30 + trand() * 62;
      var tz = -2 + trand() * 30;
      var ty = hillHeight(tx, tz);
      tquat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), trand() * Math.PI);
      var sc = 0.7 + trand() * 0.9;
      tscale.set(sc, sc, sc);
      tmat.compose(new THREE.Vector3(tx, ty, tz), tquat, tscale);
      tufts.setMatrixAt(ti2, tmat);
    }
    root.add(tufts);

    /* -------- 广场铺装 / 道路 -------- */
    var plazaGeo = new THREE.PlaneGeometry(620, 460, 1, 1);
    plazaGeo.rotateX(-Math.PI / 2);
    (function () {
      var pos = plazaGeo.attributes.position, uv = plazaGeo.attributes.uv;
      for (var i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 10) / 7, (pos.getZ(i) + 60) / 7);
      uv.needsUpdate = true;
    })();
    var plazaMat = new THREE.MeshStandardMaterial({ map: T.paving, roughness: 0.92, metalness: 0.02 });
    var plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, 0, 70);
    plaza.receiveShadow = true;
    root.add(plaza);

    function addLawn(x0, x1, z0, z1) {
      var g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      g.rotateX(-Math.PI / 2);
      var p = g.attributes.position, u = g.attributes.uv;
      for (var i = 0; i < p.count; i++) u.setXY(i, (p.getX(i) + (x0 + x1) / 2) / 9, (p.getZ(i) + (z0 + z1) / 2) / 9);
      var m = new THREE.Mesh(g, grassMat);
      m.position.set((x0 + x1) / 2, 0.035, (z0 + z1) / 2);
      m.receiveShadow = true;
      root.add(m);
    }
    addLawn(112, 310, -92, 132);
    addLawn(-310, -148, -40, 132);
    addLawn(-70, 70, 132, 190);
    addLawn(-92, 92, 190, 640);
    var axisPath = new THREE.Mesh(new THREE.PlaneGeometry(20, 450).rotateX(-Math.PI / 2), plazaMat);
    axisPath.position.set(0, 0.06, 415);
    root.add(axisPath);

    var asphaltMat = new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: 0.95, metalness: 0.02 });
    var roadB = new GeoBuilder();
    roadB.box(-139, 0.03, 40, 14, 0.06, 360, 1);
    roadB.box(0, 0.03, 138, 620, 0.06, 16, 1);
    roadB.box(180, 0.03, 60, 14, 0.06, 260, 1);
    var road = new THREE.Mesh(roadB.geometry(), asphaltMat);
    root.add(road);

    var curbLine = new GeoBuilder();
    curbLine.box(-131.5, 0.12, 40, 0.9, 0.24, 360, 1);
    curbLine.box(0, 0.12, 129.5, 620, 0.24, 0.9, 1);
    var curbLineMesh = new THREE.Mesh(curbLine.geometry(), new THREE.MeshStandardMaterial({ color: 0xb7b2a6, roughness: 0.9 }));
    root.add(curbLineMesh);

    // 广场铺装分格带（给出人的尺度）
    var bandB = new GeoBuilder();
    bandB.box(-58, 0.025, 66, 0.9, 0.04, 74, 1);
    bandB.box(58, 0.025, 66, 0.9, 0.04, 74, 1);
    bandB.box(0, 0.025, 88, 232, 0.04, 1.5, 1);
    bandB.box(0, 0.025, 100, 232, 0.04, 1.5, 1);
    bandB.box(0, 0.025, 54, 232, 0.04, 1.2, 1);
    var bandMesh = new THREE.Mesh(bandB.geometry(), new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 0.95 }));
    root.add(bandMesh);

    /* -------- 树 / 灯 / 护栏 / 签名墙 -------- */
    var trunkGeo = new THREE.CylinderGeometry(0.17, 0.3, 6.4, 6);
    trunkGeo.translate(0, 3.2, 0);
    var crownParts = [];
    var crownSpec = [
      [0, 6.0, 0, 1.9],
      [1.1, 5.6, 0.5, 1.45],
      [-1.0, 5.8, -0.4, 1.5],
      [0.4, 6.7, -0.7, 1.2],
      [-0.5, 6.4, 0.7, 1.25]
    ];
    crownSpec.forEach(function (c) {
      var ico = new THREE.IcosahedronGeometry(c[3], 0);
      ico.scale(1.12, 0.82, 1.08);
      ico.translate(c[0], c[1], c[2]);
      crownParts.push(ico);
    });
    var crownGeo = mergeGeometries(crownParts);
    var trunkMat = new THREE.MeshStandardMaterial({ map: T.trunk, roughness: 0.95 });
    var crownMat = new THREE.MeshStandardMaterial({ map: T.leaf, roughness: 0.95, color: 0xffffff, flatShading: true });

    var treeSpots = [];
    var tr2 = mulberry32(2026);
    function treeRow(x0, z0, x1, z1, n, jitter) {
      for (var i = 0; i < n; i++) {
        var t = n === 1 ? 0 : i / (n - 1);
        treeSpots.push([
          x0 + (x1 - x0) * t + (tr2() - 0.5) * (jitter || 3),
          z0 + (z1 - z0) * t + (tr2() - 0.5) * (jitter || 3),
          0.72 + tr2() * 0.42,
          tr2() * Math.PI * 2
        ]);
      }
    }
    treeRow(-118, 106, 128, 106, low ? 12 : 18, 5);
    treeRow(-118, 118, 128, 118, low ? 10 : 16, 6);
    treeRow(-120, -130, -120, 130, low ? 12 : 18, 5);
    treeRow(-152, -80, -152, 110, low ? 8 : 12, 8);
    treeRow(112, -100, 112, 90, low ? 9 : 14, 5);
    treeRow(140, -60, 140, 80, low ? 8 : 12, 6);
    treeRow(-132, 20, -132, 84, low ? 5 : 8, 5);
    treeRow(132, 18, 132, 88, low ? 5 : 8, 5);
    treeRow(-96, 44, -96, 70, 4, 3);
    treeRow(86, 46, 86, 78, 4, 3);
    for (var lw = 0; lw < (low ? 14 : 30); lw++) {
      var lx = 126 + tr2() * 170;
      var lz = -76 + tr2() * 190;
      treeSpots.push([lx, lz, 0.62 + tr2() * 0.34, tr2() * Math.PI * 2]);
    }
    for (var lw2 = 0; lw2 < (low ? 9 : 18); lw2++) {
      var lx2 = -300 + tr2() * 140;
      var lz2 = -26 + tr2() * 145;
      treeSpots.push([lx2, lz2, 0.6 + tr2() * 0.34, tr2() * Math.PI * 2]);
    }
    for (var az = 170; az <= 620; az += (low ? 44 : 30)) {
      treeSpots.push([-54 + (tr2() - 0.5) * 4, az + (tr2() - 0.5) * 6, 0.58 + tr2() * 0.26, tr2() * Math.PI * 2]);
      treeSpots.push([54 + (tr2() - 0.5) * 4, az + (tr2() - 0.5) * 6, 0.58 + tr2() * 0.26, tr2() * Math.PI * 2]);
    }
    treeSpots = treeSpots.filter(function (sp) {
      if (sp[0] < -140 && sp[1] > -100 && sp[1] < 22) return false;
      if (Math.hypot(sp[0] - 115, sp[1] - 10) < 26) return false;
      return true;
    });
    var broadleafCount = treeSpots.length;
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, broadleafCount);
    var crowns = new THREE.InstancedMesh(crownGeo, crownMat, broadleafCount);
    var colony = [new THREE.Color(0x51663e), new THREE.Color(0x5f7445), new THREE.Color(0x445a38)];
    var tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), ts = new THREE.Vector3();
    treeSpots.forEach(function (sp, i) {
      tq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp[3]);
      ts.set(sp[2], sp[2] * (0.92 + tr2() * 0.3), sp[2]);
      tm.compose(new THREE.Vector3(sp[0], 0, sp[1]), tq, ts);
      trunks.setMatrixAt(i, tm);
      crowns.setMatrixAt(i, tm);
      crowns.setColorAt(i, colony[i % colony.length]);
    });
    trunks.castShadow = !low;
    crowns.castShadow = !low;
    root.add(trunks, crowns);

    // 灯柱
    var lampSpots = [
      [-62, 52], [-20, 52], [26, 52], [62, 52], [96, 44], [-96, 52],
      [-124, 60], [-124, 100], [90, 100], [120, 40], [-40, 100], [30, 100]
    ];
    var poleGeo = new THREE.CylinderGeometry(0.1, 0.16, 6, 5);
    poleGeo.translate(0, 3, 0);
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x4b5052, roughness: 0.6, metalness: 0.5 });
    var poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
    var headMat = new THREE.MeshBasicMaterial({ color: 0x594a37 });
    var headGeo = new THREE.SphereGeometry(0.34, 8, 6);
    headGeo.translate(0, 6.1, 0);
    var heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
    lampSpots.forEach(function (sp, i) {
      tm.makeTranslation(sp[0], 0, sp[1]);
      poles.setMatrixAt(i, tm);
      heads.setMatrixAt(i, tm);
    });
    root.add(poles, heads);

    var haloGeo = new THREE.BufferGeometry();
    var haloPos = [];
    lampSpots.forEach(function (sp) { haloPos.push(sp[0], 6.15, sp[1]); });
    haloGeo.setAttribute("position", new THREE.Float32BufferAttribute(haloPos, 3));
    var lampHalo = new THREE.Points(haloGeo, new THREE.PointsMaterial({
      map: T.glow, color: new THREE.Color(0xffd6a0).convertSRGBToLinear(),
      size: 11, sizeAttenuation: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    root.add(lampHalo);

    // 西侧白色护栏
    var fencePostGeo = new THREE.BoxGeometry(0.09, 1.05, 0.09);
    fencePostGeo.translate(0, 0.525, 0);
    var fencePosts = [];
    for (var fz = -118; fz <= 132; fz += 2.2) fencePosts.push([-126.4, fz]);
    var fenceMat = new THREE.MeshStandardMaterial({ color: 0xe3e2dc, roughness: 0.55, metalness: 0.25 });
    var fenceMesh = new THREE.InstancedMesh(fencePostGeo, fenceMat, fencePosts.length);
    fencePosts.forEach(function (p, i) {
      tm.makeTranslation(p[0], 0, p[1]);
      fenceMesh.setMatrixAt(i, tm);
    });
    var fenceRails = new GeoBuilder();
    fenceRails.box(-126.4, 1.02, 7, 0.06, 0.06, 250, 1);
    fenceRails.box(-126.4, 0.62, 7, 0.05, 0.05, 250, 1);
    var fenceRailMesh = new THREE.Mesh(fenceRails.geometry(), fenceMat);
    root.add(fenceMesh, fenceRailMesh);

    // 签名墙
    var signGroup = new THREE.Group();
    var signBody = new THREE.Mesh(new THREE.BoxGeometry(22, 3.6, 0.6), new THREE.MeshStandardMaterial({
      color: 0x4a4d4e, roughness: 0.5, metalness: 0.5
    }));
    signGroup.add(signBody);
    var signFace = new THREE.Mesh(new THREE.PlaneGeometry(21.4, 3.0), new THREE.MeshStandardMaterial({
      map: T.sign, roughness: 0.45, metalness: 0.35,
      emissive: new THREE.Color(0x3a2c1c).convertSRGBToLinear(), emissiveIntensity: 0.0
    }));
    signFace.position.set(0, 0.1, 0.32);
    signGroup.add(signFace);
    signGroup.position.set(-112, 1.8, 58);
    signGroup.rotation.y = 0.42;
    root.add(signGroup);

    /* -------- 城市 / 文化轴 -------- */
    function compress(x, z) {
      var r = Math.hypot(x, z);
      if (r <= 300) return [x, z];
      var k = (300 + (r - 300) * 0.66) / r;
      return [x * k, z * k];
    }
    var cityGround = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({
      color: 0x2b3530, roughness: 1, metalness: 0
    }));
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.set(0, -0.06, 0);
    root.add(cityGround);

    var cityWinMat = new THREE.MeshStandardMaterial({
      map: T.facade, emissiveMap: T.cityWindow,
      emissive: new THREE.Color(0xffd8a8).convertSRGBToLinear(), emissiveIntensity: 0,
      color: 0xffffff, roughness: 0.78, metalness: 0.18
    });

    // 省博（月光宝盒）与图书馆
    var museumPos = compress(210, 26);
    var museumB = new GeoBuilder();
    museumB.box(museumPos[0], 22, museumPos[1], 92, 44, 68, 18);
    museumB.box(museumPos[0] + 26, 38, museumPos[1] - 10, 34, 20, 34, 18);
    museumB.box(museumPos[0] - 34, 12, museumPos[1] + 16, 22, 24, 22, 18);
    var museum = new THREE.Mesh(museumB.geometry(), new THREE.MeshStandardMaterial({
      map: T.facade, color: 0x847a6d, roughness: 0.7, metalness: 0.28,
      emissive: new THREE.Color(0xffb066).convertSRGBToLinear(), emissiveIntensity: 0, emissiveMap: T.cityWindow
    }));
    root.add(museum);

    var libPos = compress(198, -128);
    var libB = new GeoBuilder();
    libB.box(libPos[0], 28, libPos[1], 58, 56, 30, 16);
    libB.box(libPos[0] + 6, 24, libPos[1] - 34, 44, 48, 26, 16);
    var library = new THREE.Mesh(libB.geometry(), new THREE.MeshStandardMaterial({
      map: T.facade, color: 0xc9c2b4, roughness: 0.68, metalness: 0.22,
      emissive: new THREE.Color(0xffcf9a).convertSRGBToLinear(), emissiveIntensity: 0, emissiveMap: T.cityWindow
    }));
    root.add(library);

    // 城市块（实例化）
    var blockGeo = new THREE.BoxGeometry(1, 1, 1);
    blockGeo.translate(0, 0.5, 0);
    var blockData = [];
    var brand = mulberry32(404);
    for (var bi2 = 0; bi2 < (low ? 26 : 44); bi2++) {
      var ang = brand() * Math.PI * 2;
      var rad = 820 + brand() * 1000;
      var bx = Math.cos(ang) * rad;
      var bz = Math.sin(ang) * rad - 60;
      if (bz > 240) continue;
      if (Math.hypot(bx, bz + 40) < 470) continue;
      var bp = compress(bx, bz);
      var bh = 22 + brand() * 82;
      var bw = 26 + brand() * 46;
      blockData.push([bp[0], bp[1], bw, bh, bw * (0.7 + brand() * 0.8), brand() * Math.PI]);
    }
    var blocks = new THREE.InstancedMesh(blockGeo, cityWinMat, blockData.length);
    var bcol = [new THREE.Color(0x969ea2), new THREE.Color(0xa39d92), new THREE.Color(0x8a9297)];
    blockData.forEach(function (b, i) {
      tq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b[5]);
      tm.compose(new THREE.Vector3(b[0], 0, b[1]), tq, new THREE.Vector3(b[2], b[3], b[4]));
      blocks.setMatrixAt(i, tm);
      blocks.setColorAt(i, bcol[i % bcol.length]);
    });
    root.add(blocks);

    // 双塔 / 中信
    function towerBlock(x, z, w, h, d, color) {
      var p = compress(x, z);
      var g = new THREE.CylinderGeometry(w * 0.38, w * 0.52, h, 10, 1, false);
      g.translate(0, h / 2, 0);
      var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        map: T.facade, color: color, roughness: 0.6, metalness: 0.3,
        emissive: new THREE.Color(0xffe0b8).convertSRGBToLinear(), emissiveIntensity: 0, emissiveMap: T.cityWindow
      }));
      m.position.set(p[0], 0, p[1]);
      root.add(m);
      return m;
    }
    var ifc = towerBlock(-80, -1280, 66, 286, 66, 0xa3abb0);
    var eastTower = towerBlock(900, -1040, 72, 344, 72, 0x9aa2a7);
    var citic = towerBlock(-300, -1480, 60, 254, 60, 0x9aa0a3);
    var citicSpire = new THREE.Mesh(new THREE.ConeGeometry(3, 60, 6), new THREE.MeshStandardMaterial({
      color: 0x8f979a, roughness: 0.5, metalness: 0.5
    }));
    var citicPos = compress(-300, -1480);
    citicSpire.position.set(citicPos[0], 274, citicPos[1]);
    root.add(citicSpire);

    // 广州塔（南岸，压缩）
    var gzPos = compress(-35, 1120);
    var gz = new THREE.Group();
    var gzLines = [];
    function gzPoint(t, ang) {
      var r = 44 - 28 * t;
      var twist = t * 1.1;
      return new THREE.Vector3(Math.cos(ang + twist) * r, t * 454, Math.sin(ang + twist) * r);
    }
    var gzSegments = low ? 8 : 12;
    for (var gi = 0; gi < 24; gi++) {
      var a0 = (gi / 24) * Math.PI * 2;
      for (var gj = 0; gj < gzSegments; gj++) {
        var p1 = gzPoint(gj / gzSegments, a0);
        var p2 = gzPoint((gj + 1) / gzSegments, a0);
        gzLines.push(p1, p2);
        var a1 = a0 + (1 / 24) * Math.PI * 2;
        gzLines.push(p1, gzPoint((gj + 1) / gzSegments, a1));
      }
    }
    var gzTop = gzPoint(1, 0);
    gzLines.push(new THREE.Vector3(0, 454, 0), new THREE.Vector3(0, 600, 0));
    var gzGeo = new THREE.BufferGeometry().setFromPoints(gzLines);
    var gzMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0xcfdde8).convertSRGBToLinear(), transparent: true, opacity: 0.55
    });
    var gzLattice = new THREE.LineSegments(gzGeo, gzMat);
    gz.add(gzLattice);
    var gzCabin = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 14, 8), new THREE.MeshStandardMaterial({
      color: 0xb9c3c9, roughness: 0.5, metalness: 0.4,
      emissive: new THREE.Color(0x9fd8ff).convertSRGBToLinear(), emissiveIntensity: 0
    }));
    gzCabin.position.y = 448;
    gz.add(gzCabin);
    var gzMast = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 146, 6), new THREE.MeshStandardMaterial({
      color: 0xb7c0c4, roughness: 0.5, metalness: 0.5
    }));
    gzMast.position.y = 527;
    gz.add(gzMast);
    gz.position.set(gzPos[0], 0, gzPos[1]);
    root.add(gz);

    // 珠江 / 海心沙 / 南岸
    var river = new THREE.Mesh(new THREE.PlaneGeometry(2000, 150), new THREE.MeshStandardMaterial({
      color: 0x1c3036, roughness: 0.18, metalness: 0.35, map: T.water
    }));
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.08, 700);
    root.add(river);
    var island = new THREE.Mesh(new THREE.BoxGeometry(210, 2.4, 70), new THREE.MeshStandardMaterial({
      color: 0x33413a, roughness: 0.9
    }));
    island.position.set(-10, 0.1, 700);
    root.add(island);
    var southBank = new GeoBuilder();
    for (var sb = 0; sb < 10; sb++) {
      var sbh = 60 + (sb % 5) * 46;
      southBank.box(-420 + sb * 96, sbh / 2, 880 + (sb % 3) * 34, 52 + (sb % 4) * 18, sbh, 46, 20);
    }
    var southBankMesh = new THREE.Mesh(southBank.geometry(), cityWinMat);
    root.add(southBankMesh);

    // 光带
    var ribbonB = new GeoBuilder();
    function ribbonStrip(points, y, height) {
      for (var i = 0; i < points.length - 1; i++) {
        var a = new THREE.Vector3(points[i][0], y, points[i][1]);
        var b = new THREE.Vector3(points[i + 1][0], y, points[i + 1][1]);
        var c = new THREE.Vector3(points[i + 1][0], y + height, points[i + 1][1]);
        var d = new THREE.Vector3(points[i][0], y + height, points[i][1]);
        ribbonB.quad(a, b, c, d, [i * 0.5, 0], [i * 0.5 + 0.5, 0], [i * 0.5 + 0.5, 1], [i * 0.5, 1]);
      }
    }
    ribbonStrip([[-74, 31.2], [-30, 32.2], [26, 31.2], [62, 30.6], [96, 29]], 0.72, 0.68);
    ribbonStrip([[-104, 31.2], [-90.5, 31.2], [-77, 31]], 0.72, 0.68);
    ribbonStrip([[-28, 9.2], [0, 9.4], [10, 9.4]], 4.52, 0.8);
    ribbonStrip([[-74, 7.6], [-46, 3.6], [-28, 7.6], [0, 9.4]], 4.52, 0.8);
    ribbonStrip([[-2, 8], [-2, 64]], 0.7, 0.6);
    ribbonStrip([[-18.9, 8], [-18.9, 64]], 0.7, 0.35);
    var ribbonMat = new THREE.MeshBasicMaterial({
      map: T.ribbon, color: 0xffe2b8, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    var ribbonMesh = new THREE.Mesh(ribbonB.geometry(), ribbonMat);
    ribbonMesh.name = "ribbons";
    root.add(ribbonMesh);

    /* -------- 热点 -------- */
    hotspots = [
      {
        id: "twin", no: "01", name: "一大一小，一黑一白", view: "plaza",
        views: ["plaza", "pool", "small", "axis", "night"],
        pos: new THREE.Vector3(22, 30, -52),
        lede: "大砾石在西、深灰近黑；小砾石在东、暖白浅灰。两块非几何折面体量最近处约 3 m，一大一小构成“圆润双砾”。",
        facts: [["大砾石", "43.1 m"], ["小砾石", "约 28 m"], ["最近", "约 3 m"]],
        detail: "大砾石是 1,804 座歌剧厅（1,687 固定 + 117 乐池）的外壳；小砾石是实验剧场/多功能厅（常见约 400 座，官方 2026 写 350 座）。两体间距为课程分析口径，未测绘。"
      },
      {
        id: "shell", no: "02", name: "64 面 / 104 棱线", view: "axis",
        views: ["plaza", "axis", "west"],
        pos: new THREE.Vector3(-26, 47.5, -46),
        lede: "三向斜交折板式单层网壳：大砾石 64 个空间折面、104 条空间棱线、41 个空间角点；小砾石 37 面 / 54 棱线 / 18 角点。",
        facts: [["折面", "64 / 37"], ["棱线", "104 / 54"], ["用钢", "约 12,000 t"]],
        detail: "屋盖与幕墙一体化，外壳与内部楼盖脱离，独立支撑。相邻平面夹角约 79°–177.5°；另有 47 转角口径。本场景用低模折面 + 三角板缝纹理近似，不逐面复刻。"
      },
      {
        id: "mouth", no: "03", name: "三角形的玻璃口部", view: "mouth",
        views: ["plaza", "mouth", "pool", "night"],
        pos: new THREE.Vector3(-20, 22, 2),
        lede: "南/东南面的大三角玻璃口部凹在石折檐下，内部钢斜网格清晰可见；白天反射天空，夜间透出暖光，是建筑最亮的“眼睛”。",
        facts: [["玻璃", "约 5,000+ 块"], ["石材", "约 75,000 块"], ["平台", "+5 m"]],
        detail: "三角形点支玻璃 + 多向可调不锈钢铸件；观众从南侧缓坡上到 5 m 入口平台。精确数量另有 5,200 片玻璃 / 75,422 块石材口径；本场景不逐块建模。"
      },
      {
        id: "stage", no: "04", name: "1,804 座与品字形舞台", view: "plaza",
        views: ["plaza", "mouth", "pool"],
        pos: new THREE.Vector3(-46, 17, -6),
        lede: "歌剧厅 1,804 个总坐席 = 1,687 个固定座席 + 117 个乐池坐席；舞台为“品”字形，舞台轴线宽 74 m、深 46 m，台口宽 18 m、高 12 m。",
        facts: [["总坐席", "1,804"], ["固定 + 乐池", "1,687 + 117"], ["台口", "18 × 12 m"]],
        detail: "官方 2026 写“1,687 座歌剧厅”（不含乐池）。观众厅三层“双手环抱”、满天星天花 4,000+ LED——本场景只做外观，内部/舞台/后台/座位均不做。"
      },
      {
        id: "small", no: "05", name: "小砾石 · 实验剧场", view: "small",
        views: ["plaza", "small", "axis", "night"],
        pos: new THREE.Vector3(48, 19, -35),
        lede: "小砾石是白/浅灰石材的实验剧场与多功能厅，屋顶更低更圆润；南/东面是一条较低、较长的玻璃带，与草坡相连。",
        facts: [["常见", "约 400 座"], ["官方 2026", "350 座"], ["石材", "白 / 浅灰"]],
        detail: "常见口径约 400 座，官方 2026 写 350 座实验剧场；可作室内乐、小型话剧、发布会、黑匣子实验剧场。草坡下配套咖啡/售票/研究空间不做室内。"
      },
      {
        id: "water", no: "06", name: "水映双砾", view: "night",
        views: ["plaza", "pool", "night"],
        pos: new THREE.Vector3(-26, 3.4, 19),
        lede: "建筑照明由北京光景照明设计，主题“水映双砾”：双砾从根部施以淡淡的均匀投光，像水面反光；平台栏板与草坡挡墙做暖白“水纹”间接光带。",
        facts: [["基座", "2700–3000 K 示意"], ["玻璃内透", "3500–4000 K 示意"], ["方式", "暖白 / 不做 RGB"]],
        detail: "光带通过出入口延伸到室内；大堂三角形钢结构照明也属于室外照明的一部分。色温/亮度为参考图观察与示意，不是官方值；不做 RGB 灯光秀、激光或每日节目单。"
      },
      {
        id: "axis", no: "07", name: "文化轴 · 从双砾到广州塔", view: "axis",
        views: ["plaza", "axis"],
        pos: new THREE.Vector3(188, 46, 26),
        lede: "大剧院位于花城广场西南角、新中轴起点西侧；东接广东省博物馆与广州图书馆，北靠广州国际金融中心，南望珠江、海心沙与广州塔。",
        facts: [["广州塔", "直线约 1.0–1.3 km"], ["省博", "东侧"], ["IFC", "北侧"]],
        detail: "广州塔直线约 1.0–1.3 km（坐标估算），本场景周边城市按约 0.6–0.7× 压缩距离 + 雾，并保持轴线关系；航拍视点为示意，非步行可达。"
      }
    ];

    /* -------- 汇总 -------- */
    var gap = measureGap(large.grid, small.grid);
    var shellStats = {
      pebbles: 2,
      large: {
        length: large.measured.length, height: large.measured.height, width: large.measured.width,
        faces: 64, ridges: 104, corners: 41,
        meshFaces: large.rings * large.seg, glass: 5200, stone: 75422
      },
      small: {
        length: small.measured.length, height: small.measured.height, width: small.measured.width,
        faces: 37, ridges: 54, corners: 18,
        meshFaces: small.rings * small.seg
      },
      gap: +gap.toFixed(1),
      glass: 5200,
      stone: 75422,
      diagrid: large.barCount + (small.barCount || 0),
      measure: {
        large: large.measured,
        small: small.measured
      }
    };

    materials.stoneDark = stoneDarkMat;
    materials.stoneLight = stoneLightMat;
    materials.terraceWall = terraceWallMat;
    materials.terraceTop = terraceTopMat;
    materials.paving = plazaMat;
    materials.grass = grassMat;
    materials.crown = crownMat;
    materials.trunk = trunkMat;
    materials.rail = railMesh.material;
    materials.curb = curbMesh.material;
    materials.walk = walkMat;
    materials.museum = museum.material;
    materials.library = library.material;
    materials.city = cityWinMat;
    materials.diagrid = diagMat;
    materials.slit = slitMat;
    materials.lampHead = headMat;
    materials.lampHalo = lampHalo.material;
    materials.sign = signFace.material;
    materials.ifc = ifc.material;
    materials.eastTower = eastTower.material;
    materials.citic = citic.material;
    materials.gz = gzMat;
    materials.gzCabin = gzCabin.material;
    materials.southBank = cityWinMat;

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      glassUniforms: glassUniforms,
      waterUniforms: waterUniforms,
      baseUniforms: baseUniforms,
      lobbyMats: lobbyMats,
      ribbonMat: ribbonMat,
      shell: { stats: shellStats, large: large, small: small },
      waterMeshes: [],
      bounds: new THREE.Box3(new THREE.Vector3(-600, 0, -900), new THREE.Vector3(600, 300, 1000)),
      lightsInfo: { nightPoints: 2, maxLights: 5 }
    };
  }

  window.OperaHouseModel = { build: build };
})();
