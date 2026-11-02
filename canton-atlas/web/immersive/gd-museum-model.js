/* 广东省博物馆近景 · 盒体、表皮、入口广场与城市关系 */
(function () {
  "use strict";

  var HALF = 56.75;
  var Y0 = 9;
  var Y1 = 44.5;
  var CORE = 33.75;
  var SKY_HALF = 20;
  var SKY_Y = 38;
  var COLS = 76;
  var ROWS = 24;
  var CELL_W = (HALF * 2) / COLS;
  var CELL_H = (Y1 - Y0) / ROWS;

  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  function Bucket() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.i = [];
  }
  Bucket.prototype.face = function (corners, normal, uvs) {
    var a = corners[0], b = corners[1], c = corners[2], d = corners[3];
    var ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    var ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    var cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    var dot = cr[0] * normal[0] + cr[1] * normal[1] + cr[2] * normal[2];
    var pts = corners.slice();
    var tex = uvs.slice();
    if (dot < 0) {
      pts = [a, d, c, b];
      tex = [uvs[0], uvs[3], uvs[2], uvs[1]];
    }
    var base = this.p.length / 3;
    for (var k = 0; k < 4; k++) {
      this.p.push(pts[k][0], pts[k][1], pts[k][2]);
      this.n.push(normal[0], normal[1], normal[2]);
      this.uv.push(tex[k][0], tex[k][1]);
    }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  Bucket.prototype.box = function (x0, y0, z0, x1, y1, z1, scale) {
    var s = scale || 1.5;
    var u = function (x, y, z) { return [(x + z) / s, y / s]; };
    this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [u(x0, y0, z1), u(x1, y0, z1), u(x1, y1, z1), u(x0, y1, z1)]);
    this.face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [u(x1, y0, z0), u(x0, y0, z0), u(x0, y1, z0), u(x1, y1, z0)]);
    this.face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [u(x1, y0, z1), u(x1, y0, z0), u(x1, y1, z0), u(x1, y1, z1)]);
    this.face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [u(x0, y0, z0), u(x0, y0, z1), u(x0, y1, z1), u(x0, y1, z0)]);
    this.face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [u(x0, y1, z1), u(x1, y1, z1), u(x1, y1, z0), u(x0, y1, z0)]);
    this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [u(x0, y0, z0), u(x1, y0, z0), u(x1, y0, z1), u(x0, y0, z1)]);
  };
  Bucket.prototype.mesh = function (mat, shadows) {
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    var m = new THREE.Mesh(g, mat);
    m.castShadow = !!shadows;
    m.receiveShadow = !!shadows;
    return m;
  };
  Bucket.prototype.triangles = function () { return this.i.length / 3; };

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  var SIDES = [
    { id: "west", axis: "x", plane: -HALF, out: [-1, 0, 0], index: 0 },
    { id: "east", axis: "x", plane: HALF, out: [1, 0, 0], index: 1 },
    { id: "south", axis: "z", plane: HALF, out: [0, 0, 1], index: 2 },
    { id: "north", axis: "z", plane: -HALF, out: [0, 0, -1], index: 3 }
  ];

  function sidePoint(side, u, y, depth) {
    var inward = [-side.out[0], -side.out[1], -side.out[2]];
    var p = side.axis === "x" ? side.plane + inward[0] * depth : side.plane + inward[2] * depth;
    return side.axis === "x" ? [p, y, u] : [u, y, p];
  }

  function wallUv(side, u, y) {
    return [(u + HALF) / 1.4934, (y - Y0) / 1.4792];
  }

  function buildFacade(side, cuts, wallB, redB, redBackB, darkB, glassB, mullionB, low) {
    var occ = new Uint8Array(COLS * ROWS);
    var kw = CELL_W;
    var kh = CELL_H;
    var idx = function (c, r) { return r * COLS + c; };

    function isFree(c0, c1, r0, r1) {
      if (c0 < 0 || c1 > COLS || r0 < 0 || r1 > ROWS) return false;
      for (var r = r0; r < r1; r++) {
        for (var c = c0; c < c1; c++) {
          if (occ[idx(c, r)]) return false;
        }
      }
      return true;
    }
    function mark(c0, c1, r0, r1) {
      for (var r = r0; r < r1; r++) {
        for (var c = c0; c < c1; c++) occ[idx(c, r)] = 1;
      }
    }
    function isSignZone(c0, c1, r0, r1) {
      if (side.id !== "west") return false;
      return c1 > 34 && c0 < 54 && r1 > 6 && r0 < 13;
    }
    function addCut(c0, c1, r0, r1, type, depth, top) {
      c0 = Math.max(0, Math.min(COLS - 1, c0));
      c1 = Math.max(c0 + 1, Math.min(COLS, c1));
      r0 = Math.max(0, Math.min(ROWS - 1, r0));
      r1 = Math.max(r0 + 1, Math.min(ROWS, r1));
      if (!isFree(c0, c1, r0, r1)) return false;
      mark(c0, c1, r0, r1);
      var u0 = -HALF + c0 * kw;
      var u1 = -HALF + c1 * kw;
      var yb = Y0 + r0 * kh;
      var yt = Y0 + r1 * kh;
      cuts.push({ c0: c0, c1: c1, r0: r0, r1: r1, u0: u0, u1: u1, y0: yb, y1: yt, type: type, depth: depth, top: !!top });
      return true;
    }

    var rnd = rng(1000 + side.index * 37);
    if (side.id === "west") {
      addCut(28, 48, 0, 5, "glass", 2.6, false);
      addCut(50, 57, 2, 6, "glass", 0.7, false);
      addCut(58, 62, 4, 11, "red", 1.6, false);
      addCut(35, 42, 14, 18, "glass", 0.8, false);
      addCut(43, 49, 16, 20, "red", 1.4, false);
    }
    var topSpots = [
      [4, 8, 21, 24], [20, 24, 22, 24], [33, 38, 20, 24],
      [50, 55, 22, 24], [64, 69, 21, 24]
    ];
    for (var t = 0; t < topSpots.length; t++) {
      var sp = topSpots[t];
      addCut(sp[0], sp[1], sp[2], sp[3], "red", 0.9 + rnd() * 0.9, true);
    }
    var target = low ? 20 : 26;
    var made = 0;
    var attempts = 0;
    while (made < target && attempts < 900) {
      attempts++;
      var w = 2 + Math.floor(rnd() * 6);
      var h = 2 + Math.floor(rnd() * 4);
      var c0 = 2 + Math.floor(rnd() * (COLS - w - 4));
      var r0 = 1 + Math.floor(rnd() * (ROWS - h - 3));
      var c1 = c0 + w;
      var r1 = r0 + h;
      if (isSignZone(c0, c1, r0, r1)) continue;
      if (side.id === "west" && r0 < 6 && c1 > 24 && c0 < 52) continue;
      var roll = rnd();
      var type = roll < 0.4 ? "glass" : roll < 0.85 ? "red" : "dark";
      var depth = type === "glass" ? 0.55 + rnd() * 0.45 : type === "red" ? 0.9 + rnd() * 1.3 : 1.5 + rnd() * 1.1;
      if (addCut(c0, c1, r0, r1, type, depth, false)) made++;
    }

    for (var i = 0; i < COLS; i++) {
      for (var j = 0; j < ROWS; j++) {
        if (occ[idx(i, j)]) continue;
        var a = -HALF + i * kw;
        var b = a + kw;
        var yb = Y0 + j * kh;
        var yt = yb + kh;
        var pts = side.axis === "x"
          ? [[side.plane, yb, a], [side.plane, yb, b], [side.plane, yt, b], [side.plane, yt, a]]
          : [[a, yb, side.plane], [b, yb, side.plane], [b, yt, side.plane], [a, yt, side.plane]];
        wallB.face(pts, side.out, [wallUv(side, a, yb), wallUv(side, b, yb), wallUv(side, b, yt), wallUv(side, a, yt)]);
      }
    }

    cuts.forEach(function (cut) {
      var backB = cut.type === "red" ? redBackB : cut.type === "glass" ? glassB : darkB;
      var backUv = function (u, y) { return [(u + HALF) / 1.5, (y - Y0) / 1.5]; };
      var depth = cut.depth;
      var bp = [
        sidePoint(side, cut.u0, cut.y0, depth),
        sidePoint(side, cut.u1, cut.y0, depth),
        sidePoint(side, cut.u1, cut.y1, depth),
        sidePoint(side, cut.u0, cut.y1, depth)
      ];
      backB.face(bp, side.out, [backUv(cut.u0, cut.y0), backUv(cut.u1, cut.y0), backUv(cut.u1, cut.y1), backUv(cut.u0, cut.y1)]);
      var reveal = cut.type === "dark" ? darkB : redB;
      var revealUv = function (u, y) { return [u / 1.5, y / 1.5]; };
      var nU = side.axis === "x" ? [0, 0, 1] : [1, 0, 0];
      var innerDepth = Math.min(cut.depth, 2.6);
      reveal.face([
        sidePoint(side, cut.u0, cut.y0, 0), sidePoint(side, cut.u0, cut.y0, innerDepth),
        sidePoint(side, cut.u0, cut.y1, innerDepth), sidePoint(side, cut.u0, cut.y1, 0)
      ], nU, [revealUv(0, cut.y0), revealUv(innerDepth, cut.y0), revealUv(innerDepth, cut.y1), revealUv(0, cut.y1)]);
      reveal.face([
        sidePoint(side, cut.u1, cut.y0, 0), sidePoint(side, cut.u1, cut.y0, innerDepth),
        sidePoint(side, cut.u1, cut.y1, innerDepth), sidePoint(side, cut.u1, cut.y1, 0)
      ], [-nU[0], 0, -nU[2]], [revealUv(0, cut.y0), revealUv(innerDepth, cut.y0), revealUv(innerDepth, cut.y1), revealUv(0, cut.y1)]);
      reveal.face([
        sidePoint(side, cut.u0, cut.y1, 0), sidePoint(side, cut.u1, cut.y1, 0),
        sidePoint(side, cut.u1, cut.y1, innerDepth), sidePoint(side, cut.u0, cut.y1, innerDepth)
      ], [0, -1, 0], [revealUv(cut.u0, 0), revealUv(cut.u1, 0), revealUv(cut.u1, innerDepth), revealUv(cut.u0, innerDepth)]);
      reveal.face([
        sidePoint(side, cut.u0, cut.y0, 0), sidePoint(side, cut.u1, cut.y0, 0),
        sidePoint(side, cut.u1, cut.y0, innerDepth), sidePoint(side, cut.u0, cut.y0, innerDepth)
      ], [0, 1, 0], [revealUv(cut.u0, 0), revealUv(cut.u1, 0), revealUv(cut.u1, innerDepth), revealUv(cut.u0, innerDepth)]);

      if (cut.type === "glass" && !low) {
        var d0 = Math.max(0.05, cut.depth - 0.3);
        var d1 = cut.depth - 0.05;
        var gw = cut.u1 - cut.u0;
        var gh = cut.y1 - cut.y0;
        var midY = (cut.y0 + cut.y1) / 2;
        var halfY = gh / 2 - 0.2;
        var midU = (cut.u0 + cut.u1) / 2;
        var halfU = gw / 2 - 0.2;
        var mBox = function (uc, yc, hu, hy) {
          var pa = sidePoint(side, uc - hu, yc - hy, d0);
          var pb = sidePoint(side, uc + hu, yc + hy, d1);
          mullionB.box(
            Math.min(pa[0], pb[0]), Math.min(pa[1], pb[1]), Math.min(pa[2], pb[2]),
            Math.max(pa[0], pb[0]), Math.max(pa[1], pb[1]), Math.max(pa[2], pb[2]), 1.5
          );
        };
        var bars = gw > 6 ? Math.min(12, Math.round(gw / 3.2) - 1) : 0;
        for (var mb = 0; mb < bars; mb++) {
          var uc = cut.u0 + gw * (mb + 1) / (bars + 1);
          mBox(uc, midY, 0.055, halfY);
        }
        var rows = gh > 4.6 ? Math.min(4, Math.round(gh / 3.6) - 1) : 0;
        for (var mr = 0; mr < rows; mr++) {
          var yc = cut.y0 + gh * (mr + 1) / (rows + 1);
          mBox(midU, yc, halfU, 0.055);
        }
      }
    });

    return cuts;
  }

  function buildTrees(root, T, low) {
    var trunkMat = new THREE.MeshStandardMaterial({ color: lin(0x6b5744), roughness: 0.95, metalness: 0 });
    var leafMat = new THREE.MeshStandardMaterial({ color: lin(0x5f7b4a), roughness: 0.9, metalness: 0, flatShading: true });
    var bushMat = new THREE.MeshStandardMaterial({ color: lin(0x4f6a3f), roughness: 1, metalness: 0, flatShading: true });
    var palmLeafMat = new THREE.MeshStandardMaterial({ color: lin(0x597a45), roughness: 0.9, metalness: 0, side: THREE.DoubleSide, flatShading: true });

    var spots = [];
    var rnd = rng(2026);
    var viewGuards = [[-92, 100], [-135, 135], [-145, 55], [-126, 24], [-100, 34], [-120, 16], [-128, 55]];
    function guarded(x, z) {
      for (var gi = 0; gi < viewGuards.length; gi++) {
        if (Math.hypot(x - viewGuards[gi][0], z - viewGuards[gi][1]) < 30) return true;
      }
      return false;
    }
    function tryAdd(x, z, s) {
      if (guarded(x, z)) return;
      var lines = [
        [[-135, 8], [-20, 8]],
        [[-92, 100], [-8, 18]],
        [[-128, 55], [-8, 8]],
        [[-72, 6], [-30, 2]],
        [[-135, 8], [-92, 100]]
      ];
      for (var i = 0; i < lines.length; i++) {
        var a = lines[i][0], b = lines[i][1];
        var dx = b[0] - a[0], dz = b[1] - a[1];
        var L = dx * dx + dz * dz;
        var u = ((x - a[0]) * dx + (z - a[1]) * dz) / L;
        u = Math.max(0, Math.min(1, u));
        var px = a[0] + dx * u, pz = a[1] + dz * u;
        if (Math.hypot(x - px, z - pz) < 17) return;
      }
      spots.push([x, z, s]);
    }

    var count = low ? 24 : 30;
    var westTrees = [[-148, -58], [-132, -62], [-118, -50], [-150, 44], [-136, 58], [-122, 66], [-146, 76]];
    westTrees.forEach(function (p) { tryAdd(p[0], p[1], 0.85 + rnd() * 0.35); });
    var southTrees = [[-78, 108], [-52, 122], [-18, 132], [12, 118], [42, 126], [66, 108], [24, 96], [-8, 104], [54, 92], [76, 118]];
    southTrees.forEach(function (p) { tryAdd(p[0], p[1], 0.85 + rnd() * 0.4); });
    var eastTrees = [[95, -70], [100, -40], [96, 0], [104, 34], [98, 68], [92, 92]];
    eastTrees.forEach(function (p) { tryAdd(p[0], p[1], 0.8 + rnd() * 0.3); });
    var northTrees = [[-62, -96], [-28, -104], [8, -98], [44, -104], [78, -94], [-90, -116], [104, -120]];
    northTrees.forEach(function (p) { tryAdd(p[0], p[1], 0.8 + rnd() * 0.35); });
    while (spots.length < count) {
      var x = -170 + rnd() * 320;
      var z = -140 + rnd() * 300;
      if (Math.abs(x) < 150 && Math.abs(z) < 150) continue;
      tryAdd(x, z, 0.75 + rnd() * 0.4);
    }

    var trunkGeo = new THREE.CylinderGeometry(0.24, 0.34, 1, 5);
    trunkGeo.translate(0, 0.5, 0);
    var leafGeo = new THREE.IcosahedronGeometry(1, 0);
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    var leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion();
    var col = new THREE.Color();
    spots.forEach(function (p, i) {
      var h = 4.2 + (p[2] - 0.75) * 6;
      m.compose(new THREE.Vector3(p[0], 0, p[1]), q, new THREE.Vector3(1, h, 1));
      trunks.setMatrixAt(i, m);
      var cr = 3.0 + p[2] * 1.8;
      q.setFromEuler(new THREE.Euler(0, (i * 1.7) % 6.28, 0));
      m.compose(new THREE.Vector3(p[0], h + cr * 0.52, p[1]), q, new THREE.Vector3(cr, cr * 0.8, cr));
      leaves.setMatrixAt(i, m);
      col.setHSL(0.24 + (i % 5) * 0.006, 0.28 + (i % 3) * 0.04, 0.26 + (i % 4) * 0.02);
      leaves.setColorAt(i, col);
      q.identity();
    });
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    trunks.castShadow = leaves.castShadow = !low;
    trunks.receiveShadow = leaves.receiveShadow = !low;
    root.add(trunks, leaves);

    var palmSpots = [[-140, 100], [-155, 84], [-126, 118], [-166, 64], [-118, 140], [96, 104]].filter(function (p) { return !guarded(p[0], p[1]); });
    var pTrunkGeo = new THREE.CylinderGeometry(0.26, 0.4, 1, 6);
    pTrunkGeo.translate(0, 0.5, 0);
    var frondB = new Bucket();
    for (var f = 0; f < 8; f++) {
      var ang = f / 8 * Math.PI * 2;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var p0 = [ca * 0.2, 0, sa * 0.2];
      var p1 = [ca * 1.4, -0.4, sa * 1.4];
      var p2 = [ca * 3.2, -1.14, sa * 3.2];
      var p3 = [ca * 4.0, -1.5, sa * 4.0];
      var wide = 0.55;
      frondB.face([
        [p0[0], p0[1], p0[2] + wide], [p1[0], p1[1], p1[2] + wide * 0.7],
        [p2[0], p2[1], p2[2] + wide * 0.3], [p3[0], p3[1], p3[2]]
      ], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      frondB.face([
        [p3[0], p3[1], p3[2]], [p2[0], p2[1], p2[2] - wide * 0.3],
        [p1[0], p1[1], p1[2] - wide * 0.7], [p0[0], p0[1], p0[2] - wide]
      ], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    var frondGeo = new THREE.BufferGeometry();
    frondGeo.setAttribute("position", new THREE.Float32BufferAttribute(frondB.p, 3));
    frondGeo.setAttribute("normal", new THREE.Float32BufferAttribute(frondB.n, 3));
    frondGeo.setAttribute("uv", new THREE.Float32BufferAttribute(frondB.uv, 2));
    frondGeo.setIndex(frondB.i);
    var pts = new THREE.InstancedMesh(pTrunkGeo, trunkMat, palmSpots.length);
    var frs = new THREE.InstancedMesh(frondGeo, palmLeafMat, palmSpots.length);
    palmSpots.forEach(function (p, i) {
      var h = 8.5 + (i % 3) * 1.2;
      m.compose(new THREE.Vector3(p[0], 0, p[1]), q, new THREE.Vector3(1, h, 1));
      pts.setMatrixAt(i, m);
      q.setFromEuler(new THREE.Euler(0, i * 1.1, 0));
      m.compose(new THREE.Vector3(p[0], h, p[1]), q, new THREE.Vector3(1, 1, 1));
      frs.setMatrixAt(i, m);
      q.identity();
    });
    pts.instanceMatrix.needsUpdate = true;
    frs.instanceMatrix.needsUpdate = true;
    pts.castShadow = !low;
    frs.castShadow = !low;
    root.add(pts, frs);

    var bushSpots = [];
    var bGeo = new THREE.IcosahedronGeometry(1, 0);
    for (var bi = 0; bi < (low ? 18 : 28); bi++) {
      var bx = -150 + rnd() * 290;
      var bz = -120 + rnd() * 260;
      if (Math.abs(bx) < 80 && Math.abs(bz) < 85) continue;
      bushSpots.push([bx, bz, 0.8 + rnd() * 1.4]);
    }
    var bushes = new THREE.InstancedMesh(bGeo, bushMat, bushSpots.length);
    bushSpots.forEach(function (p, i) {
      m.compose(new THREE.Vector3(p[0], p[2] * 0.5, p[1]), q, new THREE.Vector3(p[2], p[2] * 0.62, p[2]));
      bushes.setMatrixAt(i, m);
    });
    bushes.instanceMatrix.needsUpdate = true;
    root.add(bushes);
  }

  function buildCity(root, T, low) {
    var cityMat = new THREE.MeshStandardMaterial({
      map: T.city, color: lin(0xb9bec1), roughness: 0.72, metalness: 0.12,
      emissive: lin(0xffffff), emissiveMap: T.city, emissiveIntensity: 0
    });
    var cityB = new Bucket();
    var spineB = new Bucket();
    var rnd = rng(777);

    function tower(x, z, w, d, h) {
      cityB.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 34);
    }

    tower(180, -620, 62, 62, 530);
    tower(-150, -600, 56, 56, 438.6);
    tower(-60, -520, 50, 50, 330);
    spineB.box(-62.5, 330, -522.5, -57.5, 391, -517.5, 20);
    tower(-300, -560, 46, 46, 250);
    tower(-380, -500, 40, 40, 210);
    tower(60, -700, 54, 54, 290);
    tower(300, -720, 60, 60, 340);
    tower(-240, -720, 48, 48, 190);

    for (var i = 0; i < (low ? 6 : 10); i++) {
      var x = 260 + rnd() * 240;
      var z = -180 + rnd() * 320;
      var w = 26 + rnd() * 26;
      var h = 70 + rnd() * 150;
      tower(x, z, w, w * (0.7 + rnd() * 0.5), h);
    }

    var libMat = new THREE.MeshStandardMaterial({
      color: lin(0xd9dcd9), roughness: 0.55, metalness: 0.14,
      emissive: lin(0xffd9a8), emissiveIntensity: 0
    });
    var libBody = new THREE.Mesh(new THREE.BoxGeometry(100, 50, 55), libMat);
    libBody.position.set(20, 25, -210);
    root.add(libBody);
    var finB = new Bucket();
    for (var f = 0; f < 22; f++) {
      var fx = -28 + f * 4.4;
      finB.box(fx - 0.5, 0, -182.4, fx + 0.5, 50, -181.4, 2);
    }
    var finMat = new THREE.MeshStandardMaterial({ color: lin(0xb8bcb8), roughness: 0.65, metalness: 0.1 });
    var fins = finB.mesh(finMat, false);
    root.add(fins);
    var libRoof = new THREE.Mesh(new THREE.BoxGeometry(104, 1.2, 59), finMat);
    libRoof.position.set(20, 50.6, -210);
    root.add(libRoof);

    var opDarkMat = new THREE.MeshStandardMaterial({ color: lin(0x555b5c), roughness: 0.5, metalness: 0.25, flatShading: true });
    var opLightMat = new THREE.MeshStandardMaterial({ color: lin(0xdedbd2), roughness: 0.55, metalness: 0.1, flatShading: true });
    var opBig = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), opDarkMat);
    opBig.position.set(-255, 29, 18);
    opBig.scale.set(68, 30, 46);
    root.add(opBig);
    var opSmall = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), opLightMat);
    opSmall.position.set(-215, 23, 56);
    opSmall.scale.set(36, 20, 30);
    root.add(opSmall);
    var opBase = new THREE.Mesh(new THREE.BoxGeometry(130, 8, 90), new THREE.MeshStandardMaterial({ color: lin(0x8f918d), roughness: 0.85 }));
    opBase.position.set(-240, 4, 40);
    root.add(opBase);

    var youth = new THREE.Mesh(new THREE.BoxGeometry(70, 35, 35), libMat);
    youth.position.set(-250, 17.5, -120);
    root.add(youth);

    var gzPts = [];
    var profile = [[0, 0], [40, 0], [34, 55], [24, 140], [14, 260], [11, 320], [17, 390], [25, 450], [18, 500], [8, 540], [3, 600]];
    for (var p = 0; p < profile.length; p++) gzPts.push(new THREE.Vector2(profile[p][0], profile[p][1]));
    var gzGeo = new THREE.LatheGeometry(gzPts, 12);
    var gzMat = new THREE.MeshStandardMaterial({ color: lin(0x5e686c), roughness: 0.6, metalness: 0.3, emissive: lin(0x8fa2aa), emissiveIntensity: 0 });
    var gz = new THREE.Mesh(gzGeo, gzMat);
    gz.position.set(-100, 0, 900);
    root.add(gz);
    var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 70, 6), gzMat);
    antenna.position.set(-100, 635, 900);
    root.add(antenna);
    var bands = [];
    [[310, 7], [392, 8], [452, 7]].forEach(function (b, i) {
      var bandMat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0x8fd8ff : i === 1 ? 0xffd27a : 0xd0a8ff, transparent: true, opacity: 0 });
      var ring = new THREE.Mesh(new THREE.CylinderGeometry(13 + i * 2.5, 13 + i * 2.5, b[1], 16, 1, true), bandMat);
      ring.position.set(-100, b[0], 900);
      root.add(ring);
      bands.push(ring);
    });

    var islandMat = new THREE.MeshStandardMaterial({ color: lin(0x4f6046), roughness: 0.95 });
    var island = new THREE.Mesh(new THREE.BoxGeometry(300, 1.2, 110), islandMat);
    island.position.set(0, 0.4, 650);
    root.add(island);
    var riverMat = new THREE.MeshStandardMaterial({ map: T.water, color: lin(0x9fb0b4), roughness: 0.18, metalness: 0.1, emissive: lin(0x1a2c3a), emissiveIntensity: 0.1 });
    var river = new THREE.Mesh(new THREE.PlaneGeometry(1600, 380), riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, -0.15, 650);
    root.add(river);
    var roadMat = new THREE.MeshStandardMaterial({ color: lin(0x4c5052), roughness: 0.95 });
    var road = new THREE.Mesh(new THREE.PlaneGeometry(1200, 34), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, 250);
    root.add(road);
    var roadE = new THREE.Mesh(new THREE.PlaneGeometry(30, 360), roadMat);
    roadE.rotation.x = -Math.PI / 2;
    roadE.position.set(84, 0.02, 60);
    root.add(roadE);

    for (var s = 0; s < 5; s++) {
      tower(-420 + s * 180, 1110 + (s % 2) * 90, 50 + (s % 3) * 16, 50, 90 + (s % 4) * 45);
    }

    var city = cityB.mesh(cityMat, false);
    var cityUv = city.geometry.attributes.uv;
    for (var ci = 1; ci < cityUv.array.length; ci += 2) cityUv.array[ci] *= 3;
    cityUv.needsUpdate = true;
    root.add(city);
    var spines = spineB.mesh(new THREE.MeshStandardMaterial({ color: lin(0xb0b5b8), roughness: 0.6 }), false);
    root.add(spines);

    var glowMat = new THREE.SpriteMaterial({ map: T.glow, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var glows = [];
    [[-60, 5, 70], [-85, 5, 40], [-100, 5, 0], [-92, 5, -40], [-70, 5, -70], [70, 5, 65], [90, 5, 10]].forEach(function (p) {
      var sp = new THREE.Sprite(glowMat.clone());
      sp.position.set(p[0], p[1], p[2]);
      sp.scale.set(10, 10, 1);
      root.add(sp);
      glows.push(sp);
    });

    return {
      cityMat: cityMat,
      libMat: libMat,
      gzMat: gzMat,
      bands: bands,
      riverMat: riverMat,
      islandMat: islandMat,
      glowMat: glowMat,
      glows: glows,
      cityMesh: city
    };
  }

  function build(opts) {
    var T = opts.textures;
    var low = !!opts.low;
    var root = new THREE.Group();
    var materials = {};
    var hotspots = [];

    var metalMat = new THREE.MeshStandardMaterial({ map: T.metal, color: lin(0xffffff), roughness: 0.52, metalness: 0.32 });
    var redMat = new THREE.MeshStandardMaterial({ map: T.red, color: lin(0xffffff), roughness: 0.62, metalness: 0.08, emissive: lin(0xff3126), emissiveIntensity: 0.03 });
    var redBackMat = new THREE.MeshStandardMaterial({ map: T.red, color: lin(0x8f6060), roughness: 0.85, metalness: 0.04, emissive: lin(0xff3126), emissiveIntensity: 0.02 });
    var darkMat = new THREE.MeshStandardMaterial({ color: lin(0x14181a), roughness: 0.85, metalness: 0.15 });
    var glassWarmMat = new THREE.MeshStandardMaterial({ map: T.glass, color: lin(0xffffff), roughness: 0.25, metalness: 0.3, emissive: lin(0xffc07a), emissiveIntensity: 0 });
    var glassCoolMat = new THREE.MeshStandardMaterial({ map: T.glass, color: lin(0xffffff), roughness: 0.22, metalness: 0.3, emissive: lin(0x9cc4dc), emissiveIntensity: 0 });
    var glassDarkMat = new THREE.MeshStandardMaterial({ map: T.glass, color: lin(0xb9c0c2), roughness: 0.3, metalness: 0.28, emissive: lin(0x0c1115), emissiveIntensity: 0 });
    var mullionMat = new THREE.MeshStandardMaterial({ color: lin(0x474d4f), roughness: 0.7, metalness: 0.22 });
    var soffitMat = new THREE.MeshStandardMaterial({ color: lin(0x111315), roughness: 0.9, metalness: 0.1 });
    var lobbyGlassMat = new THREE.MeshStandardMaterial({ map: T.glass, color: lin(0x9fb0b7), roughness: 0.18, metalness: 0.2, emissive: lin(0xffc27a), emissiveIntensity: 0.05, side: THREE.DoubleSide });
    var lobbyGlowMat = new THREE.MeshBasicMaterial({ color: lin(0x171a1b) });
    var pavingMat = new THREE.MeshStandardMaterial({ map: T.paving, color: lin(0xffffff), roughness: 0.9, metalness: 0.02 });
    var grassMat = new THREE.MeshStandardMaterial({ map: T.grass, color: lin(0xffffff), roughness: 1, metalness: 0 });
    var stoneMat = new THREE.MeshStandardMaterial({ map: T.paving, color: lin(0xd6d2c8), roughness: 0.88, metalness: 0.02 });
    var walkMat = new THREE.MeshStandardMaterial({ map: T.paving, color: lin(0xe0dccf), roughness: 0.9, metalness: 0.02 });
    var roofMat = new THREE.MeshStandardMaterial({ map: T.roof, color: lin(0xc3c4bf), roughness: 0.92, metalness: 0.06 });
    var crownMat = new THREE.MeshStandardMaterial({ map: T.metal, color: lin(0xffffff), roughness: 0.5, metalness: 0.34 });
    var signMat = new THREE.MeshStandardMaterial({ map: T.sign, color: lin(0xffffff), roughness: 0.6, metalness: 0, emissive: lin(0xffffff), emissiveIntensity: 0, transparent: true, alphaTest: 0.2 });
    var lampMat = new THREE.MeshStandardMaterial({ color: lin(0x5a5f5f), roughness: 0.6, metalness: 0.5 });
    var lampHeadMat = new THREE.MeshBasicMaterial({ color: lin(0xffd9a0) });
    var skyMat = new THREE.MeshStandardMaterial({ map: T.skylight, color: lin(0xf0f6f5), roughness: 0.3, metalness: 0.04, side: THREE.DoubleSide });
    var wellMat = new THREE.MeshStandardMaterial({ map: T.metal, color: lin(0x6a6f70), roughness: 0.72, metalness: 0.12 });
    var finMat = redMat.clone();

    materials.metal = metalMat;
    materials.red = redMat;
    materials.redBack = redBackMat;
    materials.dark = darkMat;
    materials.glassWarm = glassWarmMat;
    materials.glassCool = glassCoolMat;
    materials.glassDark = glassDarkMat;
    materials.mullion = mullionMat;
    materials.lobbyGlass = lobbyGlassMat;
    materials.lobbyGlow = lobbyGlowMat;
    materials.paving = pavingMat;
    materials.grass = grassMat;
    materials.stone = stoneMat;
    materials.walk = walkMat;
    materials.roof = roofMat;
    materials.crown = crownMat;
    materials.sign = signMat;
    materials.lampHead = lampHeadMat;
    materials.skylight = skyMat;
    materials.fin = finMat;

    var wallB = new Bucket();
    var redB = new Bucket();
    var redBackB = new Bucket();
    var darkB = new Bucket();
    var glassWarmB = new Bucket();
    var glassCoolB = new Bucket();
    var glassDarkB = new Bucket();
    var mullionB = new Bucket();
    var allCuts = [];
    var glassCats = [glassWarmB, glassCoolB, glassDarkB];
    var glassPick = 0;

    SIDES.forEach(function (side) {
      var cuts = [];
      var fakeGlass = {
        face: function (corners, normal, uvs) {
          var b = glassCats[glassPick % 3];
          glassPick++;
          b.face(corners, normal, uvs);
        }
      };
      buildFacade(side, cuts, wallB, redB, redBackB, darkB, fakeGlass, mullionB, low);
      allCuts = allCuts.concat(cuts);
    });

    var wallMesh = wallB.mesh(metalMat, true);
    wallMesh.name = "facade-metal";
    var redMesh = redB.mesh(redMat, false);
    redMesh.name = "facade-red";
    var redBackMesh = redBackB.mesh(redBackMat, false);
    redBackMesh.name = "facade-red-back";
    var darkMesh = darkB.mesh(darkMat, false);
    var gwm = glassWarmB.mesh(glassWarmMat, false);
    var gcm = glassCoolB.mesh(glassCoolMat, false);
    var gdm = glassDarkB.mesh(glassDarkMat, false);
    var mullionMesh = mullionB.mesh(mullionMat, false);
    root.add(wallMesh, redMesh, redBackMesh, darkMesh, gwm, gcm, gdm, mullionMesh);

    var signB = new Bucket();
    signB.face(
      [[-HALF - 0.16, 21.4, 2], [-HALF - 0.16, 21.4, 18], [-HALF - 0.16, 24.6, 18], [-HALF - 0.16, 24.6, 2]],
      [-1, 0, 0],
      [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
    var signMesh = signB.mesh(signMat, false);
    root.add(signMesh);

    var roofB = new Bucket();
    roofB.box(-HALF, Y1 - 0.6, -HALF, HALF, Y1, -SKY_HALF, 6);
    roofB.box(-HALF, Y1 - 0.6, SKY_HALF, HALF, Y1, HALF, 6);
    roofB.box(-HALF, Y1 - 0.6, -SKY_HALF, -SKY_HALF, Y1, SKY_HALF, 6);
    roofB.box(SKY_HALF, Y1 - 0.6, -SKY_HALF, HALF, Y1, SKY_HALF, 6);
    var roofMesh = roofB.mesh(roofMat, true);
    root.add(roofMesh);

    var wellB = new Bucket();
    var wellUv = function (u, y) { return [u / 1.5, y / 1.5]; };
    wellB.face([[-SKY_HALF, SKY_Y, -SKY_HALF], [-SKY_HALF, SKY_Y, SKY_HALF], [-SKY_HALF, Y1, SKY_HALF], [-SKY_HALF, Y1, -SKY_HALF]], [1, 0, 0], [wellUv(-20, SKY_Y), wellUv(20, SKY_Y), wellUv(20, Y1), wellUv(-20, Y1)]);
    wellB.face([[SKY_HALF, SKY_Y, SKY_HALF], [SKY_HALF, SKY_Y, -SKY_HALF], [SKY_HALF, Y1, -SKY_HALF], [SKY_HALF, Y1, SKY_HALF]], [-1, 0, 0], [wellUv(20, SKY_Y), wellUv(-20, SKY_Y), wellUv(-20, Y1), wellUv(20, Y1)]);
    wellB.face([[SKY_HALF, SKY_Y, -SKY_HALF], [-SKY_HALF, SKY_Y, -SKY_HALF], [-SKY_HALF, Y1, -SKY_HALF], [SKY_HALF, Y1, -SKY_HALF]], [0, 0, 1], [wellUv(20, SKY_Y), wellUv(-20, SKY_Y), wellUv(-20, Y1), wellUv(20, Y1)]);
    wellB.face([[-SKY_HALF, SKY_Y, SKY_HALF], [SKY_HALF, SKY_Y, SKY_HALF], [SKY_HALF, Y1, SKY_HALF], [-SKY_HALF, Y1, SKY_HALF]], [0, 0, -1], [wellUv(-20, SKY_Y), wellUv(20, SKY_Y), wellUv(20, Y1), wellUv(-20, Y1)]);
    var wellMesh = wellB.mesh(wellMat, false);
    root.add(wellMesh);

    var skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), skyMat);
    skyPlane.rotation.x = -Math.PI / 2;
    skyPlane.position.set(0, SKY_Y, 0);
    root.add(skyPlane);

    var finB = new Bucket();
    var crownB = new Bucket();
    crownB.box(-20.4, SKY_Y, -20.4, 20.4, SKY_Y + 0.35, -19.6, 2);
    crownB.box(-20.4, SKY_Y, 19.6, 20.4, SKY_Y + 0.35, 20.4, 2);
    crownB.box(-20.4, SKY_Y, -19.6, -19.6, SKY_Y + 0.35, 19.6, 2);
    crownB.box(19.6, SKY_Y, -19.6, 20.4, SKY_Y + 0.35, 19.6, 2);
    var crownRnd = rng(909);
    SIDES.forEach(function (side) {
      for (var k = 0; k < 6; k++) {
        var u = -44 + k * 17 + crownRnd() * 3;
        var w = 5 + crownRnd() * 6;
        if (side.axis === "x") {
          var x0 = side.plane > 0 ? side.plane - 0.5 : side.plane;
          var x1 = x0 + 0.5;
          crownB.box(x0, Y1, u, x1, Y1 + 1.4 + crownRnd() * 2.4, u + w, 2);
          if (k % 2 === 0) finB.box(x0 - 0.05, Y1, u + 1, x1 + 0.05, Y1 + 1.5, u + 1.35, 2);
        } else {
          var z0 = side.plane > 0 ? side.plane - 0.5 : side.plane;
          var z1 = z0 + 0.5;
          crownB.box(u, Y1, z0, u + w, Y1 + 1.4 + crownRnd() * 2.4, z1, 2);
          if (k % 2 === 0) finB.box(u + 1, Y1, z0 - 0.05, u + 1.35, Y1 + 1.5, z1 + 0.05, 2);
        }
      }
    });
    crownB.box(-38, Y1, -44, -26, Y1 + 2.2, -37, 3);
    crownB.box(18, Y1, -46, 30, Y1 + 1.6, -39, 3);
    crownB.box(-44, Y1, 30, -36, Y1 + 1.2, 38, 3);
    var crownMesh = crownB.mesh(crownMat, false);
    root.add(crownMesh);
    var finMesh = finB.mesh(finMat, false);
    root.add(finMesh);

    var soffitB = new Bucket();
    soffitB.face([[-HALF, Y0 - 0.04, -HALF], [HALF, Y0 - 0.04, -HALF], [HALF, Y0 - 0.04, HALF], [-HALF, Y0 - 0.04, HALF]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    var soffitMesh = soffitB.mesh(soffitMat, false);
    root.add(soffitMesh);

    var lobbyGlassB = new Bucket();
    var lobbyMullB = new Bucket();
    var doorHalf = 9;
    var doorTop = 8.4;
    function lobbyWall(axis, sign) {
      var plane = sign * CORE;
      var n = axis === "x" ? [sign, 0, 0] : [0, 0, sign];
      var uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      if (axis === "x" && sign < 0) {
        lobbyGlassB.face([[plane, 3, -CORE], [plane, 3, -doorHalf], [plane, 9, -doorHalf], [plane, 9, -CORE]], n, uvs);
        lobbyGlassB.face([[plane, 3, doorHalf], [plane, 3, CORE], [plane, 9, CORE], [plane, 9, doorHalf]], n, uvs);
        lobbyGlassB.face([[plane, doorTop, -doorHalf], [plane, doorTop, doorHalf], [plane, 9, doorHalf], [plane, 9, -doorHalf]], n, uvs);
        for (var s = -CORE + 3; s < CORE; s += 3) {
          if (Math.abs(s) < doorHalf) continue;
          lobbyMullB.box(plane - 0.08, 3, s - 0.09, plane + 0.08, 9, s + 0.09, 2);
        }
        lobbyMullB.box(plane - 0.12, doorTop, -doorHalf, plane + 0.12, doorTop + 0.22, doorHalf, 2);
        lobbyMullB.box(plane - 0.12, doorTop, -doorHalf - 0.22, plane + 0.12, 9, -doorHalf, 2);
        lobbyMullB.box(plane - 0.12, doorTop, doorHalf, plane + 0.12, 9, doorHalf + 0.22, 2);
      } else if (axis === "x") {
        lobbyGlassB.face([[plane, 3, -CORE], [plane, 3, CORE], [plane, 9, CORE], [plane, 9, -CORE]], n, uvs);
        for (var t = -CORE + 3; t < CORE; t += 3) {
          lobbyMullB.box(plane - 0.08, 3, t - 0.09, plane + 0.08, 9, t + 0.09, 2);
        }
      } else {
        lobbyGlassB.face([[-CORE, 3, plane], [CORE, 3, plane], [CORE, 9, plane], [-CORE, 9, plane]], n, uvs);
        for (var q = -CORE + 3; q < CORE; q += 3) {
          lobbyMullB.box(q - 0.09, 3, plane - 0.08, q + 0.09, 9, plane + 0.08, 2);
        }
      }
    }
    lobbyWall("x", -1);
    lobbyWall("x", 1);
    lobbyWall("z", -1);
    lobbyWall("z", 1);
    var lobbyGlassMesh = lobbyGlassB.mesh(lobbyGlassMat, false);
    var lobbyMullMesh = lobbyMullB.mesh(mullionMat, false);
    root.add(lobbyGlassMesh, lobbyMullMesh);

    var glowB = new Bucket();
    glowB.face([[-CORE + 0.5, 3.2, -CORE + 0.5], [CORE - 0.5, 3.2, -CORE + 0.5], [CORE - 0.5, 9.2, -CORE + 0.5], [-CORE + 0.5, 9.2, -CORE + 0.5]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    glowB.face([[CORE - 0.5, 3.2, CORE - 0.5], [-CORE + 0.5, 3.2, CORE - 0.5], [-CORE + 0.5, 9.2, CORE - 0.5], [CORE - 0.5, 9.2, CORE - 0.5]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    glowB.face([[-CORE + 0.5, 3.2, CORE - 0.5], [-CORE + 0.5, 3.2, -CORE + 0.5], [-CORE + 0.5, 8.8, -CORE + 0.5], [-CORE + 0.5, 8.8, CORE - 0.5]], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    glowB.face([[CORE - 0.5, 3.2, -CORE + 0.5], [CORE - 0.5, 3.2, CORE - 0.5], [CORE - 0.5, 8.8, CORE - 0.5], [CORE - 0.5, 8.8, -CORE + 0.5]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    glowB.face([[-CORE + 0.5, 3.21, -CORE + 0.5], [CORE - 0.5, 3.21, -CORE + 0.5], [CORE - 0.5, 3.21, CORE - 0.5], [-CORE + 0.5, 3.21, CORE - 0.5]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    var glowMesh = glowB.mesh(lobbyGlowMat, false);
    glowMesh.renderOrder = 2;
    root.add(glowMesh);

    var groundB = new Bucket();
    groundB.face([[-350, 0, -350], [350, 0, -350], [350, 0, 350], [-350, 0, 350]], [0, 1, 0], [[0, 0], [116, 0], [116, 116], [0, 116]]);
    var ground = groundB.mesh(pavingMat, true);
    ground.receiveShadow = true;
    root.add(ground);

    var farGroundB = new Bucket();
    farGroundB.face([[-2200, -0.2, -2200], [2200, -0.2, -2200], [2200, -0.2, 2200], [-2200, -0.2, 2200]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    var farGround = farGroundB.mesh(new THREE.MeshStandardMaterial({ color: lin(0x6f756d), roughness: 0.98, metalness: 0 }), false);
    root.add(farGround);

    var lawnB = new Bucket();
    function lawn(x0, z0, x1, z1) {
      lawnB.face([[x0, 0.03, z1], [x1, 0.03, z1], [x1, 0.03, z0], [x0, 0.03, z0]], [0, 1, 0], [[x0 / 6, z1 / 6], [x1 / 6, z1 / 6], [x1 / 6, z0 / 6], [x0 / 6, z0 / 6]]);
    }
    lawn(-168, -84, -88, -28);
    lawn(-168, 28, -88, 84);
    lawn(-86, 82, -30, 150);
    lawn(-28, 72, 84, 160);
    lawn(88, -110, 150, -40);
    lawn(-110, -150, 110, -98);
    var lawnMesh = lawnB.mesh(grassMat, true);
    lawnMesh.receiveShadow = true;
    root.add(lawnMesh);

    var stoneB = new Bucket();
    var platformX0 = -72, platformX1 = -CORE;
    stoneB.box(platformX0, 0, -24, platformX1, 3, 24, 6);
    for (var st = 0; st < 12; st++) {
      var sx0 = -86.4 + st * 1.2;
      var sx1 = sx0 + 1.2;
      var sh = (st + 1) * 0.25;
      stoneB.box(sx0, 0, -22, sx1, sh, -6, 6);
      stoneB.box(sx0, 0, 6, sx1, sh, 22, 6);
    }
    var stoneMesh = stoneB.mesh(stoneMat, true);
    stoneMesh.receiveShadow = true;
    root.add(stoneMesh);

    var walkB = new Bucket();
    walkB.face([[platformX0, 3.01, -24], [platformX1, 3.01, -24], [platformX1, 3.01, 24], [platformX0, 3.01, 24]], [0, 1, 0], [[0, 0], [6, 0], [6, 8], [0, 8]]);
    var rampLen = Math.hypot(14.4, 3);
    var ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.35, 12), walkMat);
    ramp.position.set(-79.2, 1.42, 0);
    ramp.rotation.z = Math.atan2(3, 14.4);
    ramp.receiveShadow = true;
    root.add(ramp);
    var gslopeL = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.5, 8), grassMat);
    gslopeL.position.set(-79.2, 1.35, -26);
    gslopeL.rotation.z = Math.atan2(3, 14.4);
    root.add(gslopeL);
    var gslopeR = gslopeL.clone();
    gslopeR.position.z = 26;
    root.add(gslopeR);
    [[-6.4], [6.4]].forEach(function (z) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.06, 0.06), lampMat);
      rail.position.set(-79.2, 2.35, z[0]);
      rail.rotation.z = Math.atan2(3, 14.4);
      root.add(rail);
    });
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-142, 0.05, 92),
      new THREE.Vector3(-104, 0.05, 104),
      new THREE.Vector3(-58, 0.05, 92),
      new THREE.Vector3(-14, 0.05, 72),
      new THREE.Vector3(36, 0.05, 84),
      new THREE.Vector3(82, 0.05, 66)
    ]);
    var ribbonB = new Bucket();
    var seg = 60, width = 2.6;
    for (var ri = 0; ri < seg; ri++) {
      var t0 = ri / seg, t1 = (ri + 1) / seg;
      var a = curve.getPoint(t0), b = curve.getPoint(t1);
      var ta = curve.getTangent(t0);
      var na = new THREE.Vector3(-ta.z, 0, ta.x).normalize().multiplyScalar(width);
      ribbonB.face([
        [a.x + na.x, a.y, a.z + na.z], [b.x + na.x, b.y, b.z + na.z],
        [b.x - na.x, b.y, b.z - na.z], [a.x - na.x, a.y, a.z - na.z]
      ], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    var ribbonMesh = ribbonB.mesh(walkMat, false);
    root.add(ribbonMesh);

    var lampB = new Bucket();
    var headB = new Bucket();
    [[-118, 22], [-108, -18], [-96, 44], [-130, -60], [-60, 60], [54, 48], [64, -42]].forEach(function (p) {
      lampB.box(p[0] - 0.12, 0, p[1] - 0.12, p[0] + 0.12, 5.4, p[1] + 0.12, 2);
      headB.box(p[0] - 0.28, 5.4, p[1] - 0.28, p[0] + 0.28, 5.9, p[1] + 0.28, 2);
    });
    var lampMesh = lampB.mesh(lampMat, false);
    var headMesh = headB.mesh(lampHeadMat, false);
    root.add(lampMesh, headMesh);

    buildTrees(root, T, low);

    var city = buildCity(root, T, low);

    materials.city = city.cityMat;
    materials.library = city.libMat;
    materials.gz = city.gzMat;
    materials.river = city.riverMat;
    materials.island = city.islandMat;
    materials.lampHalo = city.glowMat;
    materials.bands = city.bands;
    materials.glows = city.glows;

    function applyTime(p, name) {
      metalMat.color.copy(lin(p.metal));
      crownMat.color.copy(lin(p.metal));
      redMat.color.copy(lin(p.red));
      redMat.emissive.copy(lin(p.redGlow));
      redMat.emissiveIntensity = p.redGlowIntensity;
      redBackMat.emissive.copy(lin(p.redGlow));
      redBackMat.emissiveIntensity = p.redGlowIntensity * 0.55;
      finMat.color.copy(lin(p.red));
      finMat.emissive.copy(lin(p.redGlow));
      finMat.emissiveIntensity = p.finGlow;
      glassWarmMat.emissiveIntensity = p.glassWarm;
      glassCoolMat.emissiveIntensity = p.glassCool;
      glassDarkMat.emissiveIntensity = p.glassDark;
      glassWarmMat.color.copy(lin(p.glassTint));
      glassCoolMat.color.copy(lin(p.glassTint));
      glassDarkMat.color.copy(lin(p.glassTint));
      lobbyGlassMat.emissiveIntensity = p.lobbyEmissive;
      lobbyGlowMat.color.copy(lin(p.lobbyInner));
      signMat.emissiveIntensity = p.sign;
      city.cityMat.emissiveIntensity = p.city;
      city.libMat.emissiveIntensity = p.city * 0.12;
      city.gzMat.emissiveIntensity = p.city * 0.12;
      city.riverMat.emissiveIntensity = p.riverGlow;
      city.riverMat.color.copy(lin(p.water));
      city.islandMat.color.copy(lin(p.island));
      city.bands.forEach(function (b, i) { b.material.opacity = p.towerBands * (i === 0 ? 0.85 : i === 1 ? 0.7 : 0.55); });
      city.glows.forEach(function (g) { g.material.opacity = p.lamp; });
      pavingMat.color.copy(lin(p.paving));
      grassMat.color.copy(lin(p.grass));
      stoneMat.color.copy(lin(p.stone));
      walkMat.color.copy(lin(p.walk));
      roofMat.color.copy(lin(p.roof));
      mullionMat.color.copy(lin(p.mullion));
      darkMat.color.copy(lin(p.dark));
      wellMat.color.copy(lin(p.well));
      skyMat.color.copy(lin(p.skylight));
    }

    hotspots.push(
      {
        id: "box", no: "01", name: "113.5 m 见方的宝盒", view: "west",
        views: ["west", "southwest", "axis", "night"],
        pos: new THREE.Vector3(-57.0, 31, 12),
        lede: "平面约 113.5 m 见方、高约 44.5 m 的方形“回”字盒体，67.5 m 核心筒外四边各悬挑 23 m——宝盒看起来漂浮在绿化广场上。",
        facts: [["平面", "约 113.5 m 见方"], ["核心 + 悬挑", "67.5 + 2 × 23 m"], ["高", "约 44.5 m"]],
        detail: "113.5 m 由 67.5 m 核心加两端各 23 m 悬挑推算，非测绘；总建筑面积约 66,980 ㎡（约 6.7 万㎡），地上 5 层、地下 1 层；常见媒体口径也写 44.8 m。"
      },
      {
        id: "cut", no: "02", name: "像素化切口与红内壁", view: "southwest",
        views: ["west", "southwest", "skin", "night"],
        pos: new THREE.Vector3(-57.0, 30, -26),
        lede: "四面不是“各切一刀”，而是上百个大小不一的矩形洞口、凹龛与窗洞；深灰铝板与鲜红内壁形成漆器般的红黑对比，顶边被切成锯齿。",
        facts: [["洞口", "约 100–120 个（估算）"], ["内壁", "鲜红 / 深红"], ["表皮", "铝板 + 玻璃 + 花岗石"]],
        detail: "洞口宽度约 3–15 m、高约 3–9 m，内凹 0.6–2.4 m；约四成为带竖向格栅的玻璃窗，四成为红内壁凹龛，其余为深洞。数量与分格为按照片的确定性设计，不是官方数据；外墙是铝板，不是铜板。"
      },
      {
        id: "cantilever", no: "03", name: "四边 23 m 悬挑", view: "southwest",
        views: ["southwest", "entry", "roof"],
        pos: new THREE.Vector3(-48, 10.5, 56.8),
        lede: "67.5 m × 67.5 m 核心筒承载 8 榀 67.5 m 跨空间桁架，两端各悬挑 23 m；盒体底面与地面之间形成深阴影，大堂退在玻璃盒里。",
        facts: [["核心筒", "67.5 × 67.5 m"], ["悬挑", "四边各 23 m"], ["屋面桁架", "8,700 t"]],
        detail: "屋面钢桁架整体滑移总重约 8,700 t、累计推移约 117 m；展厅悬挂半空，117 m 长展厅内无柱。本场景不做内部结构，只用体量、悬挑与热点说明。"
      },
      {
        id: "facade", no: "04", name: "铝板 + 玻璃 + 花岗石", view: "skin",
        views: ["west", "skin", "southwest"],
        pos: new THREE.Vector3(-57.0, 38, 30),
        lede: "深灰金属板约 1.5 m 模数，拉丝与穿孔铝板结合玻璃、花岗石；红黑取自传统漆器，肌理提炼自象牙雕、砖雕、木雕的透雕层次。",
        facts: [["模数", "约 1.5 m（示意）"], ["材料", "铝板 / 玻璃 / 花岗石"], ["母题", "象牙球 / 透雕 / 漆器"]],
        detail: "本场景用程序化板缝与洞口族近似，不逐块建模；1.5 m 分格、24 排、76 列与洞口位置均为照片估算。空间组织借鉴象牙球层层镂空，本版只做外观。"
      },
      {
        id: "atrium", no: "05", name: "中央天窗与回字屋面", view: "roof",
        views: ["roof", "axis"],
        pos: new THREE.Vector3(0, 39.5, 0),
        lede: "外圈 44.5 m 屋面围合中央约 40 m 见方的玻璃天窗，天窗顶约 38 m、低于外圈；从上往下看，方形环与中央井构成“回”字。",
        facts: [["天窗", "约 40 × 40 m"], ["天窗顶", "约 38 m"], ["屋面", "44.5 m"]],
        detail: "中央天窗与中庭顶标高为按照片/资料估算；本场景只做屋顶玻璃与井壁，不做中庭内部、展厅与回廊。屋顶设备与红色鳍片为示意简化。"
      },
      {
        id: "entry", no: "06", name: "西门 · 月光宝盒下的丝绸", view: "entry",
        views: ["west", "entry", "southwest"],
        pos: new THREE.Vector3(-45, 6, 0),
        lede: "散客从西门进馆，宽台阶与缓坡把广场抬到二层入口；两侧草坡、波浪石径与树阵，是“月光宝盒下的丝绸”景观，不是立面材料。",
        facts: [["入口", "西门 / 二层"], ["抬升", "约 3 m（示意）"], ["景观", "草坡 + 波浪石径"]],
        detail: "自驾从东门入场停车；预约观众从西门核验入馆。台阶/坡道宽度与抬升为按照片的估算，不把入口做成下沉广场；东门与地下车库内部不做。"
      },
      {
        id: "night", no: "07", name: "月光宝盒夜景", view: "night",
        views: ["night", "west"],
        pos: new THREE.Vector3(-58.6, 27.2, 10),
        lede: "夜里外壳近乎黑色，红光从切口与凹龛内壁透出，底层大堂暖黄，少量窗光偏冷——“黑盒 + 红色裂缝 + 暖色底座”的月光宝盒。",
        facts: [["红内壁", "高饱和红（示意）"], ["大堂", "暖白 2700–3000 K 示意"], ["窗光", "少量冷白（示意）"]],
        detail: "夜景照明设计单位与色温、灯具无公开一手数据；本场景用 emissive + 少量点光做示意，不做整面泛光、激光或每日灯光秀。"
      }
    );

    var facadeStats = {
      cols: COLS, rows: ROWS,
      cuts: allCuts.length,
      glazed: allCuts.filter(function (c) { return c.type === "glass"; }).length,
      redRecess: allCuts.filter(function (c) { return c.type === "red"; }).length,
      open: allCuts.filter(function (c) { return c.type === "open"; }).length,
      topNotches: allCuts.filter(function (c) { return c.top; }).length,
      drawCalls: 9,
      triangles: wallB.triangles() + redB.triangles() + redBackB.triangles() + darkB.triangles() +
        glassWarmB.triangles() + glassCoolB.triangles() + glassDarkB.triangles() + mullionB.triangles()
    };

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      applyTime: applyTime,
      occluders: [wallMesh, roofMesh],
      facade: { stats: facadeStats },
      bounds: new THREE.Box3(new THREE.Vector3(-600, 0, -800), new THREE.Vector3(600, 700, 1200)),
      lightsInfo: { nightPoints: 2, maxLights: 5 }
    };
  }

  window.GdMuseumModel = { build: build };
})();
