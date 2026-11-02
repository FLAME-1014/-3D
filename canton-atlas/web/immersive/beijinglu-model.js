/* 北京路 · 千年古道近景 · 1:1 主体建模
   坐标：1 单位 = 1 米；+X 东，-X 西，+Z 南，-Z 北；y = 0 为北京路路面；
   原点为北京路 × 中山五路交叉口中心。核心段 1:1，中山四路/财厅前连接段压缩。
   依据：docs/superpowers/research/2026-10-31-beijinglu-facts.md。 */
(function () {
  "use strict";

  var root = null;
  var textures = null;
  var materials = null;
  var hotspots = [];
  var nightMats = [];
  var lanternLights = [];
  var counts = { modules: 0, arcadeBuildings: 0, lanterns: 0, bollards: 0, trees: 0, people: 0, vehicles: 0 };
  var lowMode = false;
  var R = null;
  var lanternPos = [];
  var bollardPos = [];
  var signMatSeen = false;
  var led = null;
  var fountain = null;
  var instanced = {};

  function rnd() { return R(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 基础几何 ---------------- */

  function addBox(parent, w, h, d, mat, x, y, z, ry, cast) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = cast !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addCyl(parent, rt, rb, h, seg, mat, x, y, z, cast) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addBeam(parent, ax, ay, az, bx, by, bz, radius, mat, seg, cast) {
    var a = new THREE.Vector3(ax, ay, az);
    var b = new THREE.Vector3(bx, by, bz);
    var dir = b.clone().sub(a);
    var len = dir.length();
    if (len < 0.001) return null;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, seg || 5), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = cast === true;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function addPavedRect(parent, w, d, mat, x, z, y, tileW, tileH) {
    var geo = new THREE.PlaneGeometry(w, d);
    var uv = geo.attributes.uv;
    var sx = w / (tileW || 2), sy = d / (tileH || 2);
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
    geo.rotateX(-Math.PI / 2);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y === undefined ? 0.01 : y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addSignPlane(parent, key, w, h, x, y, z, ry, vertical) {
    var set = vertical ? textures.vertAtlas : textures.signsAtlas;
    var rect = set.rects[key];
    if (!rect) return null;
    var mat = vertical ? materials.vertSign : materials.sign;
    var geo = new THREE.PlaneGeometry(w, h);
    var uv = geo.attributes.uv;
    uv.setXY(0, rect[0], rect[3]);
    uv.setXY(1, rect[2], rect[3]);
    uv.setXY(2, rect[0], rect[1]);
    uv.setXY(3, rect[2], rect[1]);
    var g = new THREE.Group();
    g.position.set(x, y, z);
    if (ry) g.rotation.y = ry;
    var frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.07), materials.signFrame);
    frame.position.z = -0.025;
    g.add(frame);
    var plane = new THREE.Mesh(geo, mat);
    plane.position.z = 0.03;
    g.add(plane);
    parent.add(g);
    return g;
  }

  function addLantern(parent, x, y, z, s) {
    lanternPos.push([x, y, z, s || 1]);
    addBox(parent, 0.022, 0.55 * (s || 1), 0.022, materials.darkFrame, x, y + 0.42 * (s || 1), z, 0, false);
  }

  function addAC(parent, x, y, z, ry) {
    addBox(parent, 0.78, 0.52, 0.34, materials.metal, x, y, z, ry || 0, false);
    addBox(parent, 0.66, 0.4, 0.03, materials.greyMetal, x, y, z + 0.18, ry || 0, false);
  }

  function addPersonGeom() {
    var parts = [];
    function box(w, h, d, x, y, z) {
      var g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      parts.push(g);
    }
    box(0.4, 0.56, 0.22, 0, 1.03, 0);
    box(0.15, 0.72, 0.18, -0.11, 0.38, 0);
    box(0.15, 0.72, 0.18, 0.11, 0.38, 0);
    box(0.1, 0.46, 0.14, -0.26, 1.02, 0);
    box(0.1, 0.46, 0.14, 0.26, 1.02, 0);
    return mergeGeometries(parts);
  }

  function mergeGeometries(list) {
    var positions = [], normals = [], uvs = [], indices = [], offset = 0;
    list.forEach(function (g) {
      var p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
        uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      }
      if (g.index) {
        for (var j = 0; j < g.index.count; j++) indices.push(g.index.getX(j) + offset);
      } else {
        for (var k = 0; k < p.count; k++) indices.push(offset + k);
      }
      offset += p.count;
      g.dispose();
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  /* 中式坡屋面（四坡/歇山意向），脊线沿 X 轴 */
  function addRoof(parent, w, d, h, x, y, z, mat, ry, ridgeMat) {
    var hw = w / 2, hd = d / 2;
    var rx = Math.max(0.5, hw - hd * 0.62);
    var verts = [
      -hw, 0, hd, hw, 0, hd, rx, h, 0,
      -hw, 0, hd, rx, h, 0, -rx, h, 0,
      hw, 0, -hd, -hw, 0, -hd, -rx, h, 0,
      hw, 0, -hd, -rx, h, 0, rx, h, 0,
      -hw, 0, -hd, -hw, 0, hd, -rx, h, 0,
      hw, 0, hd, hw, 0, -hd, rx, h, 0
    ];
    var uvs = [];
    var perFace = 6;
    for (var f = 0; f < 6; f++) {
      uvs.push(0, 0, Math.max(1, w / 2.4), 0, Math.max(1, w / 2.4), Math.max(1, h / 1.2));
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (ridgeMat !== null) {
      var ridge = addBox(parent, rx * 2 + 1.2, 0.34, 0.42, ridgeMat || materials.roofDark, x, y + h + 0.1, z, ry, true);
      ridge.castShadow = true;
    }
    return mesh;
  }

  /* ---------------- 中式曲面屋顶 / 檐口 / 斗拱 ---------------- */

  function roofMeshGeometry(w, d, h, ridgeLen) {
    var hw = w / 2, hd = d / 2, rl = Math.max(0.8, ridgeLen || (w - d * 0.5));
    var midY = h * 0.55;
    var midW = hw * 0.42 + (rl / 2) * 0.58;
    var midD = hd * 0.44;
    var E0 = [-hw, 0, hd], E1 = [hw, 0, hd], E2 = [hw, 0, -hd], E3 = [-hw, 0, -hd];
    var M0 = [-midW, midY, midD], M1 = [midW, midY, midD], M2 = [midW, midY, -midD], M3 = [-midW, midY, -midD];
    var R0 = [-rl / 2, h, 0], R1 = [rl / 2, h, 0];
    var pos = [], uv = [];
    var S = 2.6;
    function tri(a, b, c, axisU) {
      var pts = [a, b, c];
      for (var i = 0; i < 3; i++) {
        var p = pts[i];
        pos.push(p[0], p[1], p[2]);
        uv.push((axisU === "x" ? p[0] : p[2]) / S, p[1] / S);
      }
    }
    function quad(a, b, c, d, axisU) {
      tri(a, b, c, axisU);
      tri(a, c, d, axisU);
    }
    quad(E0, E1, M1, M0, "x");
    quad(M0, M1, R1, R0, "x");
    quad(E3, E2, M2, M3, "x");
    quad(M3, M2, R1, R0, "x");
    quad(E3, E0, M0, M3, "z");
    tri(M3, M0, R0, "z");
    quad(E1, E2, M2, M1, "z");
    tri(M1, M2, R1, "z");
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }

  function addRoofHorn(parent, cx, cz, dx, dz, y, mat, len) {
    var g = new THREE.Group();
    g.position.set(cx, y, cz);
    g.rotation.y = Math.atan2(dx, dz);
    var L = len || 2.3;
    var beam = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, L), mat);
    beam.position.set(0, 0.12, L / 2);
    beam.rotation.x = -0.24;
    beam.castShadow = true;
    g.add(beam);
    var tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.72), mat);
    tip.position.set(0, 0.24 + Math.sin(0.24) * L * 0.92, Math.cos(0.24) * L * 0.92);
    tip.rotation.x = -0.6;
    g.add(tip);
    parent.add(g);
    return g;
  }

  function addTempleRoof(parent, o) {
    var w = o.w, d = o.d, h = o.h, x = o.x, y = o.y, z = o.z;
    var rl = o.ridgeLen !== undefined ? o.ridgeLen : Math.max(1.2, w - d * 0.55);
    var mat = o.mat || materials.templeTile;
    var mesh = new THREE.Mesh(roofMeshGeometry(w, d, h, rl), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    var fascia = o.fasciaMat || materials.eaveFascia;
    var trim = o.trimMat || materials.goldTrim;
    var hw = w / 2, hd = d / 2;
    [[0, hd, w + 0.24, 0], [0, -hd, w + 0.24, 0], [hw, 0, d + 0.24, Math.PI / 2], [-hw, 0, d + 0.24, Math.PI / 2]].forEach(function (f) {
      addBox(parent, f[2], 0.34, 0.18, fascia, x + f[0], y - 0.14, z + f[1], f[3], false);
      addBox(parent, f[2], 0.07, 0.07, trim, x + f[0], y - 0.33, z + f[1], f[3], false);
    });
    if (o.soffit !== false) {
      var soffitGeo = new THREE.PlaneGeometry(w - 0.1, d - 0.1);
      soffitGeo.rotateX(Math.PI / 2);
      var soffit = new THREE.Mesh(soffitGeo, materials.eaveSoffit);
      soffit.position.set(x, y + 0.06, z);
      parent.add(soffit);
    }
    var hornMat = o.hornMat || mat;
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (c) {
      addRoofHorn(parent, x + c[0] * (hw - 0.05), z + c[1] * (hd - 0.05), c[0], c[1], y + 0.08, hornMat, o.hornLen || 2.4);
    });
    var ridgeMat = o.ridgeMat || materials.ridgeDark;
    [[-1, 1, -rl / 2], [1, 1, rl / 2], [-1, -1, -rl / 2], [1, -1, rl / 2]].forEach(function (c) {
      addBeam(parent, x + c[0] * (hw - 0.12), y + 0.12, z + c[1] * (hd - 0.12), x + c[2], y + h, z, 0.11, ridgeMat, 5, true);
    });
    addBox(parent, rl + 0.7, 0.4, 0.36, ridgeMat, x, y + h + 0.12, z, 0, true);
    if (o.ridgeGold) {
      addBox(parent, rl + 0.9, 0.08, 0.4, materials.ridgeGold, x, y + h + 0.34, z, 0, false);
    }
    [-1, 1].forEach(function (s) {
      addBox(parent, 0.6, 0.8, 0.34, ridgeMat, x + s * (rl / 2 + 0.25), y + h + 0.5, z, 0, true);
      addBox(parent, 0.36, 0.22, 0.38, materials.ridgeGold, x + s * (rl / 2 + 0.25), y + h + 0.95, z, 0, false);
    });
    if (o.gable) {
      var gy0 = y + h * 0.16, gy1 = y + h;
      var gz = d * 0.2;
      [-1, 1].forEach(function (s) {
        var gx = x + s * (rl / 2 - 0.35);
        var verts = [gx, gy0, -gz, gx, gy0, gz, gx, gy1, 0];
        var ggeo = new THREE.BufferGeometry();
        ggeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        ggeo.computeVertexNormals();
        var gm = new THREE.Mesh(ggeo, materials.gableBoard);
        parent.add(gm);
        addBeam(parent, gx, gy0, -gz, gx, gy1, 0, 0.09, trim, 4, false);
        addBeam(parent, gx, gy0, gz, gx, gy1, 0, 0.09, trim, 4, false);
        addBox(parent, 0.12, 0.12, gz * 2, trim, gx, gy0, z, 0, false);
      });
    }
    return mesh;
  }

  function addEaveRing(parent, ow, od, iw, id, h, y, x, z, mat, opts) {
    var o = opts || {};
    var oh = ow / 2, od2 = od / 2, ih = iw / 2, id2 = id / 2;
    var pos = [], uv = [];
    var S = 2.6;
    function tri(a, b, c, axisU) {
      var pts = [a, b, c];
      for (var i = 0; i < 3; i++) {
        var p = pts[i];
        pos.push(p[0], p[1], p[2]);
        uv.push((axisU === "x" ? p[0] : p[2]) / S, p[1] / S);
      }
    }
    function quad(a, b, c, d, axisU) {
      tri(a, b, c, axisU);
      tri(a, c, d, axisU);
    }
    var O0 = [-oh, 0, od2], O1 = [oh, 0, od2], O2 = [oh, 0, -od2], O3 = [-oh, 0, -od2];
    var I0 = [-ih, h, id2], I1 = [ih, h, id2], I2 = [ih, h, -id2], I3 = [-ih, h, -id2];
    quad(O0, O1, I1, I0, "x");
    quad(O3, O2, I2, I3, "x");
    quad(O1, O2, I2, I1, "z");
    quad(O0, O3, I3, I0, "z");
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, mat || materials.templeGold);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    // 檐下暗带 + 金线
    [[0, od2, ow, 0], [0, -od2, ow, 0], [oh, 0, od, Math.PI / 2], [-oh, 0, od, Math.PI / 2]].forEach(function (f) {
      addBox(parent, f[2] + 0.1, 0.8, 0.2, materials.eaveFascia, x + f[0], y - 0.42, z + f[1], f[3], false);
      addBox(parent, f[2] + 0.14, 0.07, 0.08, materials.ridgeGold, x + f[0], y - 0.06, z + f[1], f[3], false);
    });
    var hornMat = o.hornMat || mat || materials.templeGold;
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (c) {
      addRoofHorn(parent, x + c[0] * (oh - 0.05), z + c[1] * (od2 - 0.05), c[0], c[1], y + 0.06, hornMat, o.hornLen || 2.6);
    });
    return mesh;
  }

  function addDougongBand(parent, w, d, x, y, z, spacing) {
    var sp = spacing || (lowMode ? 1.9 : 1.25);
    addBox(parent, w + 0.7, 0.42, 0.34, materials.redColumn, x, y - 0.2, z + d / 2 + 0.18, 0, true);
    addBox(parent, w + 0.7, 0.42, 0.34, materials.redColumn, x, y - 0.2, z - d / 2 - 0.18, 0, true);
    addBox(parent, 0.34, 0.42, d + 0.7, materials.redColumn, x + w / 2 + 0.18, y - 0.2, z, 0, true);
    addBox(parent, 0.34, 0.42, d + 0.7, materials.redColumn, x - w / 2 - 0.18, y - 0.2, z, 0, true);
    addBox(parent, w + 0.9, 0.07, 0.1, materials.goldTrim, x, y + 0.02, z + d / 2 + 0.22, 0, false);
    addBox(parent, w + 0.9, 0.07, 0.1, materials.goldTrim, x, y + 0.02, z - d / 2 - 0.22, 0, false);
    function bracketAt(bx, bz, ry) {
      var g = new THREE.Group();
      g.position.set(bx, y, bz);
      g.rotation.y = ry;
      function b(w2, h2, d2, x2, y2, z2, mat) {
        var mm = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), mat);
        mm.position.set(x2, y2, z2);
        g.add(mm);
      }
      b(0.32, 0.2, 0.3, 0, 0.18, 0, materials.dougongTeal);
      b(0.78, 0.11, 0.22, 0, 0.36, 0, materials.goldTrim);
      b(0.54, 0.1, 0.18, 0, 0.5, 0, materials.dougongTeal);
      b(0.12, 0.22, 0.12, 0, 0.34, 0.02, materials.dougongRed);
      parent.add(g);
    }
    var i;
    for (i = -w / 2 + 0.6; i <= w / 2 - 0.6; i += sp) {
      bracketAt(x + i, z + d / 2 + 0.18, 0);
      bracketAt(x + i, z - d / 2 - 0.18, Math.PI);
    }
    for (i = -d / 2 + sp * 0.6; i <= d / 2 - sp * 0.6; i += sp) {
      bracketAt(x + w / 2 + 0.18, z + i, Math.PI / 2);
      bracketAt(x - w / 2 - 0.18, z + i, -Math.PI / 2);
    }
  }

  function addBandPlane(parent, w, h, mat, x, y, z, ry, repeat) {
    var geo = new THREE.PlaneGeometry(w, h);
    var u = geo.attributes.uv;
    for (var i = 0; i < u.count; i++) u.setX(i, u.getX(i) * repeat);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry || 0;
    parent.add(mesh);
    return mesh;
  }

  function addLatticePanel(parent, w, h, x, y, z, ry, mat) {
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || materials.lattice);
    plane.position.set(x, y, z);
    plane.rotation.y = ry || 0;
    parent.add(plane);
    var fw = 0.18;
    var g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry || 0;
    var fm = materials.darkWood;
    var fb = new THREE.Mesh(new THREE.BoxGeometry(w + fw * 2, fw, 0.14), fm);
    fb.position.y = h / 2 + fw / 2;
    g.add(fb);
    var fb2 = fb.clone();
    fb2.position.y = -h / 2 - fw / 2;
    g.add(fb2);
    var fb3 = new THREE.Mesh(new THREE.BoxGeometry(fw, h, 0.14), fm);
    fb3.position.x = -w / 2 - fw / 2;
    g.add(fb3);
    var fb4 = fb3.clone();
    fb4.position.x = w / 2 + fw / 2;
    g.add(fb4);
    parent.add(g);
    return plane;
  }

  function addLightPools(parent, pools, mat) {
    var pos = [], uv = [], idx = [];
    pools.forEach(function (p) {
      var x = p[0], z = p[1], w = p[2], d = p[3];
      var y = 0.075;
      var base = pos.length / 3;
      pos.push(x - w / 2, y, z + d / 2, x + w / 2, y, z + d / 2, x + w / 2, y, z - d / 2, x - w / 2, y, z - d / 2);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, mat || materials.lightPool);
    mesh.renderOrder = 2;
    parent.add(mesh);
    return mesh;
  }

  /* ---------------- 材质 ---------------- */

  function makeMaterials() {
    var m = {};
    m.pavingLight = new THREE.MeshStandardMaterial({ map: textures.pavingLight, color: 0xc6c0b2, roughness: 0.92, metalness: 0.02 });
    m.pavingDark = new THREE.MeshStandardMaterial({ map: textures.pavingDark, color: 0x9a9a92, roughness: 0.9, metalness: 0.03 });
    m.pavingArcade = new THREE.MeshStandardMaterial({ map: textures.pavingArcade, color: 0xb0aa9e, roughness: 0.9, metalness: 0.02 });
    m.asphalt = new THREE.MeshStandardMaterial({ map: textures.asphalt, color: 0xffffff, roughness: 0.97, metalness: 0.01 });
    m.sidewalk = new THREE.MeshStandardMaterial({ map: textures.sidewalk, color: 0xb8b2a6, roughness: 0.94, metalness: 0.01 });
    m.whiteLine = new THREE.MeshStandardMaterial({ color: 0xcfcabb, roughness: 0.85 });
    m.yellowLine = new THREE.MeshStandardMaterial({ color: 0xb89b52, roughness: 0.85 });

    m.plasterCream = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xe6d9bd, roughness: 0.95, metalness: 0.01 });
    m.plasterBeige = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xd6c2a0, roughness: 0.95, metalness: 0.01 });
    m.plasterWhite = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xeae4d6, roughness: 0.95, metalness: 0.01 });
    m.plasterYellow = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xd9c892, roughness: 0.95, metalness: 0.01 });
    m.plasterGrey = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xc4c1b6, roughness: 0.96, metalness: 0.01 });
    m.pujueWall = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xc7a06a, roughness: 0.92, metalness: 0.02 });
    m.brickRed = new THREE.MeshStandardMaterial({ map: textures.brickRed, color: 0xb98a76, roughness: 0.95, metalness: 0.01 });
    m.brickGrey = new THREE.MeshStandardMaterial({ map: textures.brickGrey, color: 0xb4b2a8, roughness: 0.95, metalness: 0.01 });
    m.stone = new THREE.MeshStandardMaterial({ map: textures.stone, color: 0xb5a78d, roughness: 0.92, metalness: 0.02 });
    m.stoneDark = new THREE.MeshStandardMaterial({ map: textures.stone, color: 0x77746b, roughness: 0.9, metalness: 0.03 });
    m.whiteStone = new THREE.MeshStandardMaterial({ map: textures.whiteStone, color: 0xe4dece, roughness: 0.86, metalness: 0.02 });
    m.redStone = new THREE.MeshStandardMaterial({ map: textures.stone, color: 0x9c5a44, roughness: 0.9, metalness: 0.02 });
    m.roofGrey = new THREE.MeshStandardMaterial({ map: textures.roofGrey, color: 0xa8b0a4, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide });
    m.roofGreen = new THREE.MeshStandardMaterial({ map: textures.roofGreen, color: 0x9cb489, roughness: 0.84, metalness: 0.03, side: THREE.DoubleSide });
    m.roofGold = new THREE.MeshStandardMaterial({ map: textures.roofGold, color: 0xd8b47a, roughness: 0.5, metalness: 0.34, emissive: 0xa8742e, emissiveIntensity: 0, side: THREE.DoubleSide });
    m.roofGold.userData.glowBase = 0.34;
    m.roofDark = new THREE.MeshStandardMaterial({ color: 0x3c403a, roughness: 0.85 });
    m.wood = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x8a6145, roughness: 0.86, metalness: 0.02 });
    m.darkWood = new THREE.MeshStandardMaterial({ color: 0x2c2119, roughness: 0.84, metalness: 0.02 });
    m.redColumn = new THREE.MeshStandardMaterial({ color: 0x83302a, roughness: 0.72, metalness: 0.03 });
    m.signFrame = new THREE.MeshStandardMaterial({ color: 0x1c1813, roughness: 0.8, metalness: 0.1 });
    m.darkFrame = new THREE.MeshStandardMaterial({ color: 0x1b1d1c, roughness: 0.62, metalness: 0.3 });
    m.metal = new THREE.MeshStandardMaterial({ color: 0x3a3f3d, roughness: 0.48, metalness: 0.6 });
    m.greyMetal = new THREE.MeshStandardMaterial({ color: 0x8c918b, roughness: 0.45, metalness: 0.45 });
    m.steel = new THREE.MeshStandardMaterial({ color: 0xb8bdb8, roughness: 0.28, metalness: 0.75 });
    m.bronze = new THREE.MeshStandardMaterial({ color: 0x6f4e2a, roughness: 0.46, metalness: 0.6, emissive: 0x5a3c1c, emissiveIntensity: 0.06 });
    m.goldTrim = new THREE.MeshStandardMaterial({ color: 0xc9a35c, roughness: 0.45, metalness: 0.4, emissive: 0xa87a32, emissiveIntensity: 0 });
    m.goldGlow = new THREE.MeshStandardMaterial({ color: 0xd8b473, roughness: 0.42, metalness: 0.3, emissive: 0xffb44e, emissiveIntensity: 0, side: THREE.DoubleSide });
    m.goldGlow.userData.glowBase = 0.62;
    m.windowDark = new THREE.MeshStandardMaterial({ map: textures.windowDark, color: 0x6f8285, roughness: 0.24, metalness: 0.25 });
    m.windowLit = new THREE.MeshStandardMaterial({ map: textures.windowDark, color: 0x88908a, roughness: 0.3, metalness: 0.15, emissive: 0xffc47a, emissiveMap: textures.windowDark, emissiveIntensity: 0 });
    m.windowLit.userData.glowBase = 0.85;
    m.windowWarm = new THREE.MeshStandardMaterial({ color: 0x2b1d10, roughness: 0.4, metalness: 0.1, emissive: 0xffb765, emissiveIntensity: 0 });
    m.windowWarm.userData.glowBase = 1.25;
    m.shopfrontA = new THREE.MeshStandardMaterial({ map: textures.shopfrontA, color: 0xffffff, roughness: 0.55, metalness: 0.06, emissive: 0xffb36b, emissiveMap: textures.shopfrontA, emissiveIntensity: 0 });
    m.shopfrontB = new THREE.MeshStandardMaterial({ map: textures.shopfrontB, color: 0xffffff, roughness: 0.55, metalness: 0.06, emissive: 0xffb36b, emissiveMap: textures.shopfrontB, emissiveIntensity: 0 });
    m.shopfrontC = new THREE.MeshStandardMaterial({ map: textures.shopfrontC, color: 0xffffff, roughness: 0.55, metalness: 0.06, emissive: 0xffb36b, emissiveMap: textures.shopfrontC, emissiveIntensity: 0 });
    [m.windowLit, m.shopfrontA, m.shopfrontB, m.shopfrontC].forEach(function (x) {
      x.userData.glowBase = x.userData.glowBase || 0.9;
      nightMats.push(x);
    });
    m.soffitGlow = new THREE.MeshStandardMaterial({ color: 0x3a2f24, emissive: 0xffb469, emissiveIntensity: 0, roughness: 0.8 });
    m.soffitGlow.userData.glowBase = 1.05;
    m.soffit = new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.9, metalness: 0.02 });
    m.lanternRed = new THREE.MeshStandardMaterial({ color: 0xa82c1e, roughness: 0.58, emissive: 0xff3212, emissiveIntensity: 0.05 });
    m.lanternRed.userData.glowBase = 0.75;
    m.lanternGold = new THREE.MeshStandardMaterial({ color: 0xc8a458, roughness: 0.4, metalness: 0.45, emissive: 0x6a4a18, emissiveIntensity: 0 });
    m.leaf = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0xa9c08d, roughness: 1, metalness: 0 });
    m.leafDark = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x7f9c69, roughness: 1, metalness: 0 });
    m.bark = new THREE.MeshStandardMaterial({ map: textures.bark, color: 0x9a8068, roughness: 0.97, metalness: 0 });
    m.city = new THREE.MeshStandardMaterial({ map: textures.cityWindow, color: 0xc6ccca, roughness: 0.9, metalness: 0.03, emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0 });
    m.city.userData.glowBase = 0.6;
    m.shopdark = new THREE.MeshStandardMaterial({ color: 0x241c15, roughness: 0.9 });
    m.awningRed = new THREE.MeshStandardMaterial({ color: 0x8e3a2b, roughness: 0.85, side: THREE.DoubleSide });
    m.awningGreen = new THREE.MeshStandardMaterial({ color: 0x3e5d48, roughness: 0.85, side: THREE.DoubleSide });
    m.awningCream = new THREE.MeshStandardMaterial({ color: 0xcbbb98, roughness: 0.9, side: THREE.DoubleSide });
    m.poolWater = new THREE.MeshStandardMaterial({ color: 0x1d3334, roughness: 0.12, metalness: 0.35, emissive: 0x1d5a56, emissiveIntensity: 0.1 });
    m.poolWater.userData.glowBase = 0.25;
    m.waterJet = new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    m.led = new THREE.MeshBasicMaterial({ map: textures.led.texture, color: 0x555555, toneMapped: false });
    m.ledFrame = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.5, metalness: 0.4 });
    m.skin = new THREE.MeshStandardMaterial({ color: 0xb98b6c, roughness: 0.85 });
    m.hair = new THREE.MeshStandardMaterial({ color: 0x231a15, roughness: 0.9 });
    m.personBody = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    m.glass = new THREE.MeshStandardMaterial({
      color: 0xdfeae6, roughness: 0.16, metalness: 0.06, transparent: true, opacity: 0.08,
      side: THREE.DoubleSide, depthWrite: false, emissive: 0x9fb6ad, emissiveIntensity: 0.02
    });
    m.glass.userData.glowBase = 0.08;
    m.sign = new THREE.MeshStandardMaterial({
      map: textures.signsAtlas.texture, color: 0xffffff, roughness: 0.62, metalness: 0.04,
      emissive: 0xffffff, emissiveMap: textures.signsAtlas.texture, emissiveIntensity: 0,
      side: THREE.DoubleSide
    });
    m.sign.userData.glowBase = 0.95;
    m.vertSign = new THREE.MeshStandardMaterial({
      map: textures.vertAtlas.texture, color: 0xffffff, roughness: 0.62, metalness: 0.04,
      emissive: 0xffffff, emissiveMap: textures.vertAtlas.texture, emissiveIntensity: 0,
      side: THREE.DoubleSide
    });
    m.vertSign.userData.glowBase = 0.95;

    m.layerTang = new THREE.MeshStandardMaterial({ map: textures.layerTang, color: 0xb47454, roughness: 1, emissive: 0x7a4830, emissiveMap: textures.layerTang, emissiveIntensity: 0.44 });
    m.layerNanhan = new THREE.MeshStandardMaterial({ map: textures.layerNanhan, color: 0x9c866a, roughness: 1, emissive: 0x60503c, emissiveMap: textures.layerNanhan, emissiveIntensity: 0.4 });
    m.layerSong = new THREE.MeshStandardMaterial({ map: textures.layerSong, color: 0xb0a27c, roughness: 1, emissive: 0x70644a, emissiveMap: textures.layerSong, emissiveIntensity: 0.38 });
    m.layerMing = new THREE.MeshStandardMaterial({ map: textures.layerMing, color: 0xdcb878, roughness: 1, emissive: 0x8a6c3c, emissiveMap: textures.layerMing, emissiveIntensity: 0.38 });
    m.layerRepublic = new THREE.MeshStandardMaterial({ map: textures.layerRepublic, color: 0xe4e2d8, roughness: 1, emissive: 0x6c6c64, emissiveMap: textures.layerRepublic, emissiveIntensity: 0.28 });
    m.layerSoil = new THREE.MeshStandardMaterial({ map: textures.layerMing, color: 0x8a7860, roughness: 1, emissive: 0x4a3f30, emissiveMap: textures.layerMing, emissiveIntensity: 0.24 });
    m.layerTan = new THREE.MeshStandardMaterial({ map: textures.layerTang, color: 0x7a6450, roughness: 1, emissive: 0x463a2c, emissiveMap: textures.layerTang, emissiveIntensity: 0.28 });

    /* 寺院：瓦面、脊、彩画、格扇、黄铜立面、灯箱与地面光斑 */
    m.templeTile = new THREE.MeshStandardMaterial({ map: textures.templeTile, color: 0xd8ded6, roughness: 0.84, metalness: 0.04, side: THREE.DoubleSide });
    m.templeGold = new THREE.MeshStandardMaterial({ map: textures.templeGoldTile, color: 0xf2d8a2, roughness: 0.46, metalness: 0.36, emissive: 0xd2821f, emissiveIntensity: 0, side: THREE.DoubleSide });
    m.templeGold.userData.glowBase = 0.5;
    m.ridgeDark = new THREE.MeshStandardMaterial({ color: 0x333c35, roughness: 0.8, metalness: 0.05 });
    m.ridgeGold = new THREE.MeshStandardMaterial({ color: 0xcaa35f, roughness: 0.36, metalness: 0.5, emissive: 0x8a6224, emissiveIntensity: 0 });
    m.ridgeGold.userData.glowBase = 0.5;
    m.lattice = new THREE.MeshStandardMaterial({ map: textures.latticeDoor, color: 0xffffff, roughness: 0.7, metalness: 0.05, emissive: 0xffb46a, emissiveMap: textures.latticeDoor, emissiveIntensity: 0, side: THREE.DoubleSide });
    m.lattice.userData.glowBase = 0.8;
    m.latticeWin = new THREE.MeshStandardMaterial({ map: textures.latticeWindow, color: 0xffffff, roughness: 0.72, metalness: 0.04, emissive: 0xffb46a, emissiveMap: textures.latticeWindow, emissiveIntensity: 0, side: THREE.DoubleSide });
    m.latticeWin.userData.glowBase = 0.6;
    m.dougongTeal = new THREE.MeshStandardMaterial({ color: 0x2f4d47, roughness: 0.62, metalness: 0.08 });
    m.dougongRed = new THREE.MeshStandardMaterial({ color: 0x7c2f24, roughness: 0.7 });
    m.dougongBand = new THREE.MeshStandardMaterial({ map: textures.dougongBand, color: 0xffffff, roughness: 0.66, metalness: 0.05, emissive: 0x6a4a20, emissiveMap: textures.dougongBand, emissiveIntensity: 0, side: THREE.DoubleSide });
    m.dougongBand.userData.glowBase = 0.22;
    m.eaveFascia = new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.72 });
    m.gableBoard = new THREE.MeshStandardMaterial({ color: 0x54271c, roughness: 0.78, side: THREE.DoubleSide });
    m.eaveSoffit = new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.92 });
    m.eaveLight = new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xffb060, emissiveIntensity: 0 });
    m.eaveLight.userData.glowBase = 1.05;
    m.ochreWall = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xc39a62, roughness: 0.8, metalness: 0.03 });
    m.brassPier = new THREE.MeshStandardMaterial({ color: 0x9c7434, roughness: 0.42, metalness: 0.45, emissive: 0x6a4a18, emissiveIntensity: 0 });
    m.brassPier.userData.glowBase = 0.3;
    m.bronzeFrame = new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 0.45, metalness: 0.35 });
    m.menu = new THREE.MeshStandardMaterial({ map: textures.menuBoard, color: 0xffffff, roughness: 0.4, emissive: 0xffffff, emissiveMap: textures.menuBoard, emissiveIntensity: 0 });
    m.menu.userData.glowBase = 1.3;
    m.lightPool = new THREE.MeshStandardMaterial({
      map: textures.glow, color: 0x1e1208, emissive: 0xffa85c, emissiveMap: textures.glow, emissiveIntensity: 0,
      transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    m.lightPool.userData.glowBase = 1.15;
    m.plasticCream = new THREE.MeshStandardMaterial({ color: 0xece2ca, roughness: 0.58 });
    m.plasticWarm = new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.6 });
    m.tableWood = new THREE.MeshStandardMaterial({ color: 0x9a6b42, roughness: 0.78 });
    m.leaf.emissive = new THREE.Color(0x1d2a14);
    m.leaf.emissiveIntensity = 0;
    m.leaf.userData.glowBase = 0.26;
    m.leafDark.emissive = new THREE.Color(0x121a0b);
    m.leafDark.emissiveIntensity = 0;
    m.leafDark.userData.glowBase = 0.18;

    [m.roofGold, m.windowLit, m.shopfrontA, m.shopfrontB, m.shopfrontC, m.soffitGlow, m.lanternRed, m.goldTrim, m.city, m.sign, m.vertSign, m.glass, m.waterJet, m.poolWater,
      m.templeGold, m.ridgeGold, m.lattice, m.latticeWin, m.dougongBand, m.eaveLight, m.brassPier, m.menu, m.lightPool, m.leaf, m.leafDark, m.goldGlow, m.windowWarm].forEach(function (x) {
      if (nightMats.indexOf(x) < 0) nightMats.push(x);
    });
    return m;
  }

  /* ---------------- 地面 ---------------- */

  function buildGround() {
    // 基层沥青底板在古道/拱北楼两处开洞，避免顶面（-0.35）盖住层位
    addBox(root, 900, 0.3, 274.8, materials.asphalt, 0, -0.5, -92.6, 0, false);
    addBox(root, 900, 0.3, 106.6, materials.asphalt, 0, -0.5, 142.5, 0, false);
    addBox(root, 900, 0.3, 441.8, materials.asphalt, 0, -0.5, 449.1, 0, false);
    addBox(root, 447.8, 0.3, 44.4, materials.asphalt, 226.1, -0.5, 67, 0, false);
    addBox(root, 447.8, 0.3, 44.4, materials.asphalt, -226.1, -0.5, 67, 0, false);
    addBox(root, 447.35, 0.3, 32.4, materials.asphalt, 226.325, -0.5, 212, 0, false);
    addBox(root, 447.35, 0.3, 32.4, materials.asphalt, -226.325, -0.5, 212, 0, false);

    // 北京路：中央 16 m；古道/拱北楼段挖洞，分块铺装
    addPavedRect(root, 16, 134.6, materials.pavingLight, 0, -22.3, 0.02, 1.2, 0.6);
    addPavedRect(root, 5.7, 44.4, materials.pavingLight, -5.15, 66.8, 0.02, 1.2, 0.6);
    addPavedRect(root, 5.7, 44.4, materials.pavingLight, 5.15, 66.8, 0.02, 1.2, 0.6);
    addPavedRect(root, 16, 106.4, materials.pavingLight, 0, 142.2, 0.02, 1.2, 0.6);
    addPavedRect(root, 5.3, 32.4, materials.pavingLight, -5.35, 211.8, 0.02, 1.2, 0.6);
    addPavedRect(root, 5.3, 32.4, materials.pavingLight, 5.35, 211.8, 0.02, 1.2, 0.6);
    addPavedRect(root, 16, 206.5, materials.pavingLight, 0, 341.75, 0.02, 1.2, 0.6);
    addPavedRect(root, 16, 55, materials.pavingLight, 0, 472.5, 0.02, 1.2, 0.6);

    // 古道收边（深灰花岗岩）
    addPavedRect(root, 0.9, 46, materials.pavingDark, -2.35, 67, 0.028, 0.9, 0.9);
    addPavedRect(root, 0.9, 46, materials.pavingDark, 2.35, 67, 0.028, 0.9, 0.9);
    addPavedRect(root, 0.9, 34, materials.pavingDark, -2.8, 212, 0.028, 0.9, 0.9);
    addPavedRect(root, 0.9, 34, materials.pavingDark, 2.8, 212, 0.028, 0.9, 0.9);

    // 骑楼廊下地面
    addPavedRect(root, 3.6, 200, materials.pavingArcade, -9.4, 115, 0.03, 1.0, 1.0);
    addPavedRect(root, 3.6, 200, materials.pavingArcade, 9.4, 115, 0.03, 1.0, 1.0);
    addPavedRect(root, 3.6, 209, materials.pavingArcade, -9.4, 330.5, 0.03, 1.0, 1.0);
    addPavedRect(root, 3.6, 209, materials.pavingArcade, 9.4, 330.5, 0.03, 1.0, 1.0);
    addPavedRect(root, 3.6, 34, materials.pavingArcade, -9.4, -31, 0.03, 1.0, 1.0);
    addPavedRect(root, 3.6, 60, materials.pavingArcade, 9.4, -48, 0.03, 1.0, 1.0);

    // 中山五路/中山四路
    addPavedRect(root, 520, 30, materials.asphalt, -10, 0, 0.015, 4, 4);
    addPavedRect(root, 520, 3, materials.sidewalk, -10, 17.5, 0.03, 1.6, 1.6);
    addPavedRect(root, 520, 3, materials.sidewalk, -10, -17.5, 0.03, 1.6, 1.6);
    for (var cw = 0; cw < 11; cw++) {
      addPavedRect(root, 0.9, 28, materials.whiteLine, -7.2 + cw * 1.5, 0, 0.06, 1, 1);
    }
    addBox(root, 520, 0.03, 0.16, materials.yellowLine, -10, 0.05, -1.7, 0, false);
    addBox(root, 520, 0.03, 0.16, materials.yellowLine, -10, 0.05, 1.7, 0, false);

    // 西湖路
    addPavedRect(root, 150, 12, materials.asphalt, -6, 220, 0.016, 4, 4);
    addPavedRect(root, 150, 2.4, materials.sidewalk, -6, 228.6, 0.03, 1.6, 1.6);
    addPavedRect(root, 150, 2.4, materials.sidewalk, -6, 211.4, 0.03, 1.6, 1.6);
    for (var xw = 0; xw < 9; xw++) {
      addPavedRect(root, 1.0, 11, materials.whiteLine, -4 + xw * 1.6, 220, 0.06, 1, 1);
    }

    // 惠福东路（10 m，无高差）
    addPavedRect(root, 290, 10, materials.sidewalk, -125, 440, 0.025, 1.1, 1.1);
    addBox(root, 290, 0.02, 0.14, materials.whiteLine, -125, 0.05, 440, 0, false);

    // 大佛寺前院 / 巷道
    addPavedRect(root, 120, 95, materials.pavingArcade, -140, 385, 0.035, 1.1, 1.1);
    addPavedRect(root, 5.2, 30, materials.pavingDark, -140, 420, 0.04, 0.8, 0.8);

    // 忠佑大街 + 忠佑广场
    addPavedRect(root, 8, 46, materials.sidewalk, 180, -38, 0.035, 1, 1);
    addPavedRect(root, 28, 26, materials.pavingLight, 180, -30, 0.04, 1.2, 0.6);
    addBox(root, 28, 0.04, 0.5, materials.pavingDark, 180, 0.06, -17.7, 0, false);
    addBox(root, 0.5, 0.04, 26, materials.pavingDark, 172, 0.06, -30, 0, false);
    addBox(root, 0.5, 0.04, 26, materials.pavingDark, 188, 0.06, -30, 0, false);
    addPavedRect(root, 150, 14, materials.sidewalk, 96, 18.5, 0.03, 1.6, 1.6);
    addPavedRect(root, 150, 14, materials.sidewalk, 96, -18.5, 0.03, 1.6, 1.6);

    // 书院群 / 财厅前 / 南段地面
    addPavedRect(root, 110, 80, materials.pavingArcade, -110, 180, 0.01, 2, 2);
    addPavedRect(root, 90, 40, materials.pavingArcade, -20, -70, 0.01, 2, 2);
    addPavedRect(root, 24, 80, materials.pavingLight, -20, -80, 0.02, 1.4, 1.4);
  }

  /* ---------------- 骑楼 ---------------- */

  var widths = [8, 7, 8, 6, 7.5, 8, 5.5, 7, 8, 6.5, 7.5, 8, 6, 7];
  var facadeColors = ["cream", "beige", "white", "yellow", "grey", "cream", "white", "grey", "brick", "cream", "beige", "white", "greyBrick", "yellow"];
  var hSigns = ["广州老字号", "茶楼", "甜品", "凉茶", "云吞面", "糖水铺", "百货", "书店", "钟表", "金铺", "眼镜", "烧腊", "煲仔饭", "药房", "布匹", "咖啡", "牛杂", "肠粉", "粥粉面", "茶餐厅", "广州手信", "文创", "老字号一条街", "北京路步行街"];
  var vSigns = ["茶", "糖水", "凉茶", "烧腊", "粉面", "金铺", "书店", "咖啡", "药房", "眼镜", "钟表", "手信", "美食", "旅店"];

  function facadeMaterial(kind) {
    if (kind === "cream") return materials.plasterCream;
    if (kind === "beige") return materials.plasterBeige;
    if (kind === "yellow") return materials.plasterYellow;
    if (kind === "grey") return materials.plasterGrey;
    if (kind === "brick") return materials.brickRed;
    if (kind === "greyBrick") return materials.brickGrey;
    return materials.plasterWhite;
  }

  function buildArcadeModule(side, z0, z1, idx) {
    var w = z1 - z0;
    var zc = (z0 + z1) / 2;
    var xCol = side * 7.55;
    var xWall = side * 7.85;
    var xShop = side * 11.15;
    var faceRy = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    var kind = facadeColors[idx % facadeColors.length];
    var fm = facadeMaterial(kind);
    var floors = idx % 11 === 0 ? 4 : (idx % 3 === 0 ? 2 : 3);
    var top = 5.4 + floors * 3.35;
    if (idx % 17 === 5) top += 1.2;

    // 柱、柱础、柱头
    addBox(root, 0.78, 0.85, 0.78, materials.stoneDark, xCol, 0.43, z0 + 0.2, 0, false);
    addBox(root, 0.62, 4.35, 0.62, fm, xCol, 3.05, z0 + 0.2, 0, true);
    addBox(root, 0.76, 0.26, 0.76, materials.whiteStone, xCol, 5.12, z0 + 0.2, 0, false);
    addBox(root, 0.72, 0.22, 0.72, materials.stoneDark, xCol, 0.95, z0 + 0.2, 0, false);

    // 廊下梁、天花
    addBox(root, 0.55, 0.55, w, fm, xWall, 5.25, zc, 0, true);
    addBox(root, 3.35, 0.16, w, materials.soffit, side * 9.5, 5.1, zc, 0, false);
    addBox(root, 0.16, 0.07, w - 0.3, materials.soffitGlow, side * 9.2, 5.0, zc, 0, false);
    addBox(root, 0.18, 4.45, 0.32, materials.plasterGrey, xShop, 2.24, z0 + 0.16, 0, false);

    // 首层店面
    var shop = idx % 3 === 0 ? materials.shopfrontA : idx % 3 === 1 ? materials.shopfrontB : materials.shopfrontC;
    var shopGeo = new THREE.PlaneGeometry(w - 1.0, 4.2);
    var shopMesh = new THREE.Mesh(shopGeo, shop);
    shopMesh.position.set(xShop - side * 0.06, 2.35, zc);
    shopMesh.rotation.y = faceRy;
    shopMesh.receiveShadow = true;
    root.add(shopMesh);
    addBox(root, 0.22, 4.5, w, materials.darkWood, xShop, 2.3, zc, 0, false);
    addBox(root, 0.16, 0.35, w, materials.stoneDark, xShop - side * 0.02, 4.62, zc, 0, false);

    // 上层体量
    addBox(root, 13.6, top - 5.4, w - 0.04, fm, side * 14.6, 5.4 + (top - 5.4) / 2, zc, 0, true);

    // 楼层线脚、窗、窗台
    for (var f = 0; f < floors; f++) {
      var wy = 6.35 + f * 3.35;
      addBox(root, 0.3, 0.16, w + 0.12, materials.whiteStone, side * 7.62, 5.45 + f * 3.35, zc, 0, false);
      var winMat = (idx + f) % 4 === 0 ? materials.windowLit : materials.windowDark;
      var wz = [-w * 0.23, w * 0.23];
      if (w > 7.2) wz = [-w * 0.28, 0, w * 0.28];
      for (var wi = 0; wi < wz.length; wi++) {
        var ww = w > 7.2 ? 1.35 : 1.5;
        addBox(root, 0.12, 2.0, ww + 0.22, materials.whiteStone, side * 7.8, wy + 0.08, zc + wz[wi], 0, false);
        var winGeo = new THREE.PlaneGeometry(ww, 1.78);
        var win = new THREE.Mesh(winGeo, winMat);
        win.position.set(side * 7.72, wy, zc + wz[wi]);
        win.rotation.y = faceRy;
        root.add(win);
        addBox(root, 0.05, 1.8, 0.055, materials.whiteStone, side * 7.7, wy, zc + wz[wi], 0, false);
        addBox(root, 0.06, 0.055, ww, materials.whiteStone, side * 7.7, wy + 0.28, zc + wz[wi], 0, false);
        addBox(root, 0.22, 0.14, ww + 0.4, materials.whiteStone, side * 7.7, wy - 1.03, zc + wz[wi], 0, false);
        // 窗楣
        addBox(root, 0.2, 0.18, ww + 0.4, materials.whiteStone, side * 7.69, wy + 1.08, zc + wz[wi], 0, false);
      }
    }

    // 女儿墙 / 山花
    addBox(root, 0.5, 0.95, w, fm, xWall, top + 0.45, zc, 0, true);
    addBox(root, 0.62, 0.2, w + 0.14, materials.whiteStone, xWall, top + 0.95, zc, 0, false);
    if (idx % 6 === 2) {
      addBox(root, 0.55, 1.5, Math.min(3.2, w * 0.5), fm, xWall, top + 1.2, zc, 0, true);
      addBox(root, 0.6, 0.18, Math.min(3.4, w * 0.52), materials.whiteStone, xWall, top + 1.98, zc, 0, false);
    }

    // 横招 / 竖招
    var hw = Math.min(w - 1.1, 5.0);
    addSignPlane(root, hSigns[(idx * 3) % hSigns.length], hw, 0.82, side * 10.98, 4.62, zc, faceRy, false);
    if (idx % 2 !== 1) {
      addSignPlane(root, vSigns[(idx * 5) % vSigns.length], 0.66, 3.0, side * 7.62, 8.1, z0 + 0.75, faceRy, true);
    }
    if (idx % 3 === 0) {
      addSignPlane(root, hSigns[(idx * 7 + 5) % hSigns.length], Math.min(w - 1.2, 4.4), 0.92, side * 7.6, 11.4, zc, faceRy, false);
    }

    // 阳台 / 雨棚 / 空调 / 管线
    if (idx % 5 === 1) {
      addBox(root, 0.95, 0.14, w * 0.55, materials.whiteStone, side * 7.35, 8.15, zc, 0, true);
      for (var rp = 0; rp < 5; rp++) {
        addBox(root, 0.05, 0.9, 0.05, materials.metal, side * 7.0, 8.65, zc - w * 0.24 + rp * w * 0.12, 0, false);
      }
      addBox(root, 0.05, 0.06, w * 0.55, materials.metal, side * 7.0, 9.1, zc, 0, false);
    }
    if (idx % 4 === 1) {
      addBox(root, 1.15, 0.06, w - 1.6, idx % 8 === 1 ? materials.awningRed : materials.awningGreen, side * 10.4, 4.55, zc, 0, false);
    }
    if (idx % 3 === 1) addAC(root, side * 7.62, 9.0, zc + w * 0.2, faceRy);
    if (idx % 7 === 3) addAC(root, side * 7.62, 12.4, zc - w * 0.15, faceRy);
    if (idx % 8 === 2) {
      addCyl(root, 0.05, 0.05, top - 0.4, 5, materials.metal, side * 7.66, (top - 0.4) / 2 + 0.2, z0 + 0.4, false);
    }

    counts.modules++;
    counts.arcadeBuildings++;
  }

  function buildArcadeRow(side, z0, z1) {
    var z = z0;
    var i = 0;
    while (z < z1 - 2.5) {
      var w = widths[i % widths.length] * (0.94 + rnd() * 0.12);
      if (z + w > z1) w = z1 - z;
      buildArcadeModule(side, z, z + w, i + (side > 0 ? 0 : 37));
      z += w;
      i++;
    }
    if (z < z1) buildArcadeModule(side, z, z1, i);
  }

  function buildSimpleRow(side, z0, z1) {
    var colors = [materials.plasterCream, materials.plasterBeige, materials.plasterGrey, materials.brickGrey];
    var z = z0, i = 0;
    while (z < z1 - 2) {
      var w = 7 + rnd() * 4;
      if (z + w > z1) w = z1 - z;
      var h = 12 + rnd() * 5;
      addBox(root, 10, h, w - 0.2, colors[i % colors.length], side * 13, h / 2, z + w / 2, 0, true);
      var faceRy = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      var shopGeo = new THREE.PlaneGeometry(w - 1.4, 3.6);
      var sm = new THREE.Mesh(shopGeo, i % 2 ? materials.shopfrontA : materials.shopfrontC);
      sm.position.set(side * 7.95, 2.0, z + w / 2);
      sm.rotation.y = faceRy;
      root.add(sm);
      if (i % 2 === 0) addSignPlane(root, hSigns[(i * 3) % hSigns.length], Math.min(w - 1.6, 4.2), 0.7, side * 7.9, 4.1, z + w / 2, faceRy, false);
      counts.modules++;
      z += w;
      i++;
    }
  }

  /* ---------------- 千年古道 ---------------- */

  function buildGlassPit(xw, z0, z1, layers, labelKey) {
    var len = z1 - z0;
    var zc = (z0 + z1) / 2;
    var pitDepth = 1.9;
    // 坑壁与底
    addBox(root, 0.32, pitDepth, len, materials.stoneDark, -xw - 0.16, -pitDepth / 2, zc, 0, false);
    addBox(root, 0.32, pitDepth, len, materials.stoneDark, xw + 0.16, -pitDepth / 2, zc, 0, false);
    addBox(root, xw * 2 + 0.64, pitDepth, 0.32, materials.stoneDark, 0, -pitDepth / 2, z0 - 0.16, 0, false);
    addBox(root, xw * 2 + 0.64, pitDepth, 0.32, materials.stoneDark, 0, -pitDepth / 2, z1 + 0.16, 0, false);
    addBox(root, xw * 2, 0.2, len, materials.layerSoil, 0, -pitDepth - 0.1, zc, 0, false);

    // 层位：自顶向下，做成向北递降的探方台阶，使 11 层在玻璃下可读
    var top = -0.12;
    var step = layers.length > 6 ? 4.0 : 2.2;
    for (var i = 0; i < layers.length; i++) {
      var t = layers[i][0];
      var startZ = z0 + (layers.length - 1 - i) * step;
      var segLen = z1 - startZ;
      addBox(root, xw * 2 - 0.12, t, segLen - 0.1, layers[i][1], 0, top - t / 2, startZ + segLen / 2, 0, false);
      top -= t;
    }

    // 玻璃与分格黑框
    var glassGeo = new THREE.PlaneGeometry(xw * 2, len);
    glassGeo.rotateX(-Math.PI / 2);
    var glass = new THREE.Mesh(glassGeo, materials.glass);
    glass.name = "ancientGlass";
    glass.position.set(0, 0.035, zc);
    glass.renderOrder = 3;
    root.add(glass);
    addBox(root, 0.07, 0.05, len, materials.darkFrame, -xw + 0.03, 0.055, zc, 0, false);
    addBox(root, 0.07, 0.05, len, materials.darkFrame, xw - 0.03, 0.055, zc, 0, false);
    for (var gz = z0 + 0.75; gz < z1; gz += 1.5) {
      addBox(root, xw * 2, 0.045, 0.065, materials.darkFrame, 0, 0.055, gz, 0, false);
    }

    // 矮柱
    for (var bz = z0 + 1.5; bz <= z1 - 1.2; bz += 1.5) {
      bollardPos.push([-xw - 0.55, bz]);
      bollardPos.push([xw + 0.55, bz]);
    }

    // 说明碑
    addBox(root, 2.6, 0.12, 0.7, materials.stoneDark, 0, 0.06, z0 - 1.6, 0, false);
    addBox(root, 0.12, 2.05, 0.12, materials.metal, -1.2, 1.02, z0 - 1.6, 0, false);
    addBox(root, 0.12, 2.05, 0.12, materials.metal, 1.2, 1.02, z0 - 1.6, 0, false);
    addSignPlane(root, labelKey, 2.5, 1.05, 0, 1.55, z0 - 1.55, 0, false);
  }

  function buildAncientRoad() {
    buildGlassPit(1.9, 45, 89, [
      [0.12, materials.layerRepublic],
      [0.16, materials.layerMing],
      [0.13, materials.layerMing],
      [0.16, materials.layerSong],
      [0.12, materials.layerSong],
      [0.15, materials.layerNanhan],
      [0.11, materials.layerNanhan],
      [0.17, materials.layerTang],
      [0.13, materials.layerTang],
      [0.11, materials.layerTang],
      [0.22, materials.layerTan]
    ], "千年古道遗址");
    // 五个时期的小说明牌
    var periods = ["唐 · 路面", "南汉 · 路面", "宋元 · 路面", "明清 · 路面", "民国 · 路面"];
    for (var i = 0; i < 5; i++) {
      var z = 49 + i * 9.5;
      addBox(root, 0.1, 0.72, 0.1, materials.metal, 3.55, 0.36, z, 0, false);
      addBox(root, 0.14, 0.09, 0.62, materials.metal, 3.55, 0.68, z, 0, false);
      addSignPlane(root, periods[i], 1.35, 0.34, 3.55, 0.55, z + 0.08, -Math.PI / 2, false);
    }
    // 设备箱
    addBox(root, 1.4, 1.7, 0.9, materials.greyMetal, 5.2, 0.85, 42.4, 0, true);
    addBox(root, 1.2, 0.06, 0.7, materials.darkFrame, 5.2, 1.73, 42.4, 0, false);
    // 北端路牌
    addBox(root, 0.1, 3.0, 0.1, materials.metal, 8.9, 1.5, 18, 0, false);
    addSignPlane(root, "北京路", 1.7, 0.56, 8.9, 2.55, 18.06, 0, false);
    addSignPlane(root, "北京路步行街", 1.7, 0.5, 8.9, 2.0, 18.06, 0, false);
  }

  function buildGongbei() {
    buildGlassPit(2.35, 196, 228, [
      [0.14, materials.layerRepublic],
      [0.18, materials.layerMing],
      [0.16, materials.layerMing],
      [0.2, materials.layerSong],
      [0.24, materials.layerTan]
    ], "拱北楼遗址");

    // 牌坊（灰砖门式）
    addBox(root, 1.15, 7.0, 1.3, materials.brickGrey, -3.5, 3.5, 234, 0, true);
    addBox(root, 1.15, 7.0, 1.3, materials.brickGrey, 3.5, 3.5, 234, 0, true);
    addBox(root, 8.3, 1.7, 1.5, materials.brickGrey, 0, 7.2, 234, 0, true);
    addRoof(root, 9.4, 2.6, 1.4, 0, 8.05, 234, materials.roofGrey, 0, materials.roofDark);
    addSignPlane(root, "北京路牌坊", 2.9, 0.9, 0, 7.3, 234.78, 0, false);
    addSignPlane(root, "始于公元前 214 年", 3.6, 0.62, 0, 6.05, 234.78, 0, false);
    // 中央红色砂岩碑
    addBox(root, 3.6, 0.45, 1.4, materials.stoneDark, 0, 0.22, 236.1, 0, true);
    addBox(root, 3.4, 1.5, 0.4, materials.redStone, 0, 1.2, 236.1, 0, true);
    addSignPlane(root, "元代铜壶滴漏", 2.8, 0.72, 0, 1.25, 236.31, 0, false);
    addBox(root, 3.7, 0.28, 0.5, materials.roofDark, 0, 2.05, 236.1, 0, false);

    // 圆形水池 + 铜壶滴漏（避开牌坊门洞，偏西布置）
    var px = -3.4;
    addCyl(root, 3.5, 3.5, 0.32, 32, materials.stoneDark, px, 0.16, 241.5, false);
    addCyl(root, 3.3, 3.3, 0.14, 32, materials.stone, px, 0.36, 241.5, false);
    addCyl(root, 3.12, 3.12, 0.2, 32, materials.poolWater, px, 0.44, 241.5, false);
    addCyl(root, 3.35, 3.35, 0.16, 32, materials.stoneDark, px, 0.52, 241.5, false);
    addCyl(root, 3.12, 3.12, 0.2, 32, materials.poolWater, px, 0.56, 241.5, false);
    for (var zz = 0; zz < 12; zz++) {
      var a = (zz / 12) * Math.PI * 2;
      var hx = px + Math.cos(a) * 2.9, hz = Math.sin(a) * 2.9;
      addCyl(root, 0.17, 0.22, 0.26, 8, materials.bronze, hx, 0.74, 241.5 + hz, false);
      addBox(root, 0.16, 0.18, 0.2, materials.bronze, hx, 0.96, 241.5 + hz, a, false);
      addBox(root, 0.05, 0.1, 0.05, materials.bronze, hx, 1.1, 241.5 + hz, a, false);
    }
    addBox(root, 1.3, 0.4, 1.3, materials.redStone, px, 0.72, 241.5, 0, true);
    var pots = [[0.72, 0.7], [0.6, 0.6], [0.48, 0.5], [0.36, 0.42]];
    var py = 0.94;
    pots.forEach(function (p, pi) {
      addCyl(root, p[0] * 0.82, p[0], p[1], 14, materials.bronze, px, py + p[1] / 2, 241.5, true);
      addCyl(root, p[0] * 1.08, p[0] * 1.08, 0.06, 14, materials.bronze, px, py + p[1], 241.5, false);
      addCyl(root, p[0] * 0.72, p[0] * 0.72, 0.05, 14, materials.bronze, px, py + 0.03, 241.5, false);
      // 壶嘴
      var spoutA = pi * 1.4 - 0.6;
      addBeam(root, px + Math.cos(spoutA) * p[0] * 0.9, py + p[1] * 0.82, 241.5 + Math.sin(spoutA) * p[0] * 0.9,
        px + Math.cos(spoutA) * (p[0] + 0.35), py + p[1] * 0.55, 241.5 + Math.sin(spoutA) * (p[0] + 0.35),
        0.035, materials.bronze, 5, false);
      py += p[1];
    });
    addCyl(root, 0.06, 0.1, 0.5, 6, materials.bronze, px, py + 0.25, 241.5, false);

    // 广百（现代百货体量）
    addBox(root, 26, 30, 34, materials.plasterGrey, -21, 15, 215, 0, true);
    addBox(root, 26.4, 0.5, 34.4, materials.stoneDark, -21, 30.2, 215, 0, false);
    for (var gf = 0; gf < 7; gf++) {
      addBox(root, 0.25, 1.5, 30, materials.windowDark, -7.9, 4.6 + gf * 3.6, 215, 0, false);
    }
    addSignPlane(root, "百货", 6.4, 1.6, -7.86, 27.4, 215, Math.PI / 2, false);
    addSignPlane(root, "北京路步行街", 7.2, 1.0, -7.86, 24.9, 215, Math.PI / 2, false);

    // 西湖路路牌
    addBox(root, 0.1, 3.2, 0.1, materials.metal, 9.2, 1.6, 226.5, 0, false);
    addSignPlane(root, "西湖路", 1.8, 0.56, 9.2, 2.8, 226.56, 0, false);
  }

  /* ---------------- 灯笼 / 古榕 / 街具 ---------------- */

  function buildLanterns(banyanGap) {
    var step = lowMode ? 14 : 9;
    for (var z = 26; z < 432; z += step) {
      if (z > 210 && z < 230) continue;
      addBox(root, 14.2, 0.035, 0.035, materials.darkFrame, 0, 6.7, z, 0, false);
      var n = lowMode ? 6 : 9;
      for (var i = 0; i < n; i++) {
        var x = -6.4 + (i / (n - 1)) * 12.8;
        if (banyanGap && banyanGap.some(function (g) { return Math.abs(g[0] - x) < 1.3 && Math.abs(g[1] - z) < 2.4; })) continue;
        addLantern(root, x, 6.05, z, 1);
      }
    }
    // 惠福东路灯笼
    for (var hx = -20; hx > -240; hx -= (lowMode ? 26 : 16)) {
      addBox(root, 0.035, 0.035, 9.6, materials.darkFrame, hx, 7.2, 440, 0, false);
      for (var hi = 0; hi < (lowMode ? 3 : 5); hi++) {
        addLantern(root, hx, 6.7, 436.2 + hi * 1.9, 0.78);
      }
    }
    // 大佛寺 / 城隍庙灯笼
    [[-143, 6.35, 436.0], [-137, 6.35, 436.0], [-140, 5.0, 426], [-140, 5.0, 400], [-160, 4.6, 405], [-120, 4.6, 405],
      [-168, 3.4, 344], [-112, 3.4, 344], [-140, 4.4, 336], [176, 4.8, -22], [184, 4.8, -22],
      [170, 4.2, -40], [190, 4.2, -40], [180, 4.6, -36]].forEach(function (p) {
      addLantern(root, p[0], p[1], p[2], 1.15);
    });
  }

  function addTree(x, z, s, big, banyan, smallPit) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    var trunkH = (big ? 5.6 : 4.4) * s;
    addCyl(g, 0.3 * s, 0.55 * s, trunkH, 8, materials.bark, 0, trunkH / 2, 0, true);
    addCyl(g, 0.15 * s, 0.85 * s, 0.7 * s, 8, materials.bark, 0, 0.3 * s, 0, true);
    var branches = big ? 6 : 4;
    for (var b = 0; b < branches; b++) {
      var a = (b / branches) * Math.PI * 2 + rnd();
      var len = 1.8 * s + rnd() * 1.8 * s;
      addBeam(g, 0, trunkH * 0.7, 0, Math.cos(a) * len, trunkH + 1.6 * s, Math.sin(a) * len, 0.11 * s, materials.bark, 5, true);
    }
    var blobs = lowMode ? 6 : (big ? 11 : 8);
    for (var i = 0; i < blobs; i++) {
      var ang = (i / blobs) * Math.PI * 2 + rnd() * 0.8;
      var rad = (big ? 2.9 : 2.0) * s * (0.35 + rnd() * 0.85);
      var geo = new THREE.IcosahedronGeometry(1, 1);
      var canopy = new THREE.Mesh(geo, i % 3 === 0 ? materials.leafDark : materials.leaf);
      canopy.position.set(
        Math.cos(ang) * rad,
        trunkH + (2.0 + rnd() * 3.0) * s,
        Math.sin(ang) * rad
      );
      var cs = (big ? 2.5 : 1.9) * s * (0.55 + rnd() * 0.5);
      canopy.scale.set(cs, cs * 0.52, cs);
      canopy.rotation.set(rnd(), rnd() * 6.3, rnd());
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      g.add(canopy);
    }
    if (banyan) {
      var roots = lowMode ? 3 : 7;
      for (var r = 0; r < roots; r++) {
        var ra = (r / roots) * Math.PI * 2 + rnd();
        var rr = 1.3 * s + rnd() * 2.4 * s;
        addBeam(g, Math.cos(ra) * rr, trunkH * 0.92, Math.sin(ra) * rr, Math.cos(ra) * (rr + 0.5), 0, Math.sin(ra) * (rr + 0.5), 0.04 * s, materials.bark, 4, false);
      }
    }
    if (smallPit) {
      addBox(g, 1.5, 0.12, 1.5, materials.stoneDark, 0, 0.06, 0, 0, false);
      addBox(g, 1.25, 0.18, 1.25, materials.layerSoil, 0, 0.14, 0, 0, false);
    } else if (x > -260 && x < 260) {
      addBox(g, 3.0 * s, 0.14, 3.0 * s, materials.stoneDark, 0, 0.07, 0, 0, false);
      addBox(g, 2.7 * s, 0.2, 2.7 * s, materials.layerSoil, 0, 0.15, 0, 0, false);
    }
    counts.trees++;
    return g;
  }

  function buildTrees() {
    var spots = [
      [-6.4, 60, 1.25, true], [6.4, 74, 1.15, true], [-6.4, 112, 1.1, true],
      [6.4, 150, 1.0, true], [-6.4, 174, 0.92, false], [6.4, 272, 0.95, true],
      [-6.4, 296, 0.9, false], [6.4, 318, 0.9, false], [-6.4, 352, 1.0, false],
      [6.4, 388, 0.98, false], [-6.4, 414, 0.88, false], [6.4, 424, 0.94, false],
      [-6.4, 452, 0.9, false], [6.4, 486, 0.85, false]
    ];
    spots.forEach(function (s) { addTree(s[0], s[1], s[2], s[3], s[3]); });
    // 惠福东路：街道两侧榕树（冠幅压街，树池收小）
    [[-24, 436.2, 0.9, false], [-40, 443.6, 0.92, false],
      [-56, 436.2, 0.96, true], [-72, 443.7, 0.9, false],
      [-88, 436.2, 0.96, true], [-116, 443.9, 0.9, false],
      [-152, 443.6, 0.92, false],
      [-166, 436.2, 0.98, false], [-184, 443.7, 0.9, false],
      [-196, 436.2, 0.94, false], [-214, 443.6, 0.88, false],
      [-226, 436.3, 0.9, false]
    ].forEach(function (t) {
      addTree(t[0], t[1], t[2], t[3], t[3], true);
    });
    // 寺院与城隍庙
    addTree(-170, 348, 1.3, true, true);
    addTree(-110, 350, 1.15, true, true);
    addTree(-178, 420, 0.95, false, false);
    addTree(-104, 417, 0.88, false, false);
    addTree(168, -36, 0.9, false, false);
    addTree(192, -44, 0.8, false, false);
    // 南越王宫墙内树冠
    addTree(40, -32, 0.85, false, false);
    addTree(120, -30, 0.9, false, false);
    // 书院群/财厅背景
    addTree(-60, 180, 0.85, false, false);
    addTree(-45, -60, 0.9, false, false);
    addTree(-80, 150, 0.8, false, false);
  }

  function buildStreetFurniture() {
    // 导视牌
    [[9.0, 40, "北京路步行街"], [9.0, 190, "千年古道遗址"], [9.0, 250, "拱北楼遗址"], [-7.0, 436, "惠福东路"], [184, -18, "城隍庙"]].forEach(function (p) {
      addBox(root, 0.08, 2.6, 0.08, materials.metal, p[0], 1.3, p[1], 0, false);
      addSignPlane(root, p[2], 1.7, 0.52, p[0], 2.35, p[1] + 0.06, 0, false);
    });
    // 垃圾桶 / 长椅 / 花箱 / 单车
    var bins = [[5.6, 100], [-5.6, 132], [5.6, 176], [-5.6, 262], [5.6, 330], [-5.6, 396], [5.6, 428]];
    bins.forEach(function (b) {
      addBox(root, 0.62, 1.0, 0.62, materials.greyMetal, b[0], 0.5, b[1], 0, false);
      addBox(root, 0.72, 0.08, 0.72, materials.metal, b[0], 1.02, b[1], 0, false);
    });
    [[-5.9, 142], [5.9, 205], [-5.9, 314]].forEach(function (b) {
      addBox(root, 0.55, 0.08, 2.0, materials.wood, b[0], 0.48, b[1], 0, false);
      addBox(root, 0.1, 0.45, 0.1, materials.metal, b[0], 0.24, b[1] - 0.8, 0, false);
      addBox(root, 0.1, 0.45, 0.1, materials.metal, b[0], 0.24, b[1] + 0.8, 0, false);
    });
    [[-6.1, 92], [6.1, 166], [-6.1, 290], [6.1, 366]].forEach(function (p) {
      addBox(root, 1.1, 0.5, 1.1, materials.stone, p[0], 0.25, p[1], 0, false);
      addBox(root, 0.9, 0.32, 0.9, materials.leafDark, p[0], 0.62, p[1], 0, false);
    });
  }

  function buildPeople() {
    var palette = [0x5c6a66, 0x7a4e42, 0x45525c, 0x6f6650, 0x8a7c62, 0x8c4438, 0x35434c, 0x8a6a4e];
    var bodyGeo = addPersonGeom();
    var headGeo = new THREE.SphereGeometry(0.16, 7, 5);
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    var headMat = materials.skin;
    var people = lowMode ? 54 : 120;
    var body = new THREE.InstancedMesh(bodyGeo, bodyMat, people);
    var head = new THREE.InstancedMesh(headGeo, headMat, people);
    body.frustumCulled = false;
    head.frustumCulled = false;
    body.castShadow = false;
    head.castShadow = false;
    var dummy = new THREE.Object3D();
    var color = new THREE.Color();
    var n = 0, guard = 0;
    while (n < people && guard < people * 40) {
      guard++;
      var zone = rnd();
      var x, z;
      if (zone < 0.32) {
        x = -6.6 + rnd() * 13.2;
        z = 40 + rnd() * 220;
        if (Math.abs(x) < 2.9 && ((z > 42 && z < 92) || (z > 193 && z < 231))) continue;
        if (z > 208 && z < 232) continue;
      } else if (zone < 0.5) {
        x = -6.6 + rnd() * 13.2;
        z = 300 + rnd() * 126;
      } else if (zone < 0.58) {
        x = -6.6 + rnd() * 13.2;
        z = 16 + rnd() * 24;
      } else if (zone < 0.8) {
        x = -232 + rnd() * 208;
        z = 436 + rnd() * 8;
      } else if (zone < 0.93) {
        x = 168 + rnd() * 24;
        z = -42 + rnd() * 26;
      } else {
        x = -190 + rnd() * 100;
        z = rnd() < 0.5 ? 340 + rnd() * 15 : 385 + rnd() * 13;
      }
      dummy.position.set(x, 0, z);
      dummy.rotation.y = rnd() * Math.PI * 2;
      var s = 0.92 + rnd() * 0.16;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      body.setMatrixAt(n, dummy.matrix);
      head.position.set(x, 1.55 * s, z);
      head.rotation.y = dummy.rotation.y;
      head.scale.set(s, s, s);
      head.updateMatrix();
      head.setMatrixAt(n, dummy.matrix);
      color.setHex(palette[Math.floor(rnd() * palette.length)]);
      body.setColorAt(n, color);
      n++;
    }
    body.count = n;
    head.count = n;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    body.receiveShadow = true;
    root.add(body);
    root.add(head);
    counts.people = n;
    instanced.people = [body, head];
  }

  function buildVehicles() {
    var spots = [[-20, -8, 0], [36, 8.2, Math.PI], [82, -8, 0], [-120, 8, Math.PI], [140, -8, 0]];
    spots.forEach(function (s, i) {
      var g = new THREE.Group();
      g.position.set(s[0], 0, s[1]);
      g.rotation.y = s[2];
      root.add(g);
      if (i === 2) {
        addBox(g, 11, 3.0, 2.6, i % 2 ? materials.plasterWhite : materials.plasterGrey, 0, 1.65, 0, 0, true);
        addBox(g, 10.2, 1.0, 2.62, materials.windowDark, 0, 2.45, 0, 0, false);
        addBox(g, 10.2, 0.35, 2.64, materials.awningRed, 0, 1.0, 0, 0, false);
      } else {
        addBox(g, 4.3, 0.9, 1.8, i % 2 ? materials.plasterWhite : materials.darkWood, 0, 0.72, 0, 0, true);
        addBox(g, 2.2, 0.65, 1.7, materials.windowDark, -0.2, 1.4, 0, 0, false);
        addBox(g, 4.35, 0.3, 1.82, i % 2 ? materials.plasterCream : materials.plasterBeige, 0, 1.05, 0, 0, false);
      }
      for (var w = 0; w < 4; w++) {
        addCyl(g, 0.33, 0.33, 0.22, 10, materials.darkFrame, -1.4 + (w % 2) * 2.8, 0.35, -0.9 + Math.floor(w / 2) * 1.8, false);
      }
      counts.vehicles++;
    });
  }

  /* ---------------- 十字街 ---------------- */

  function buildCrossing() {
    // 新大新（西北角）+ 裸眼 3D 屏（示意，抽象画面）
    addBox(root, 40, 30, 30, materials.plasterGrey, -30, 15, -33, 0, true);
    addBox(root, 40.4, 0.6, 30.4, materials.stoneDark, -30, 30.4, -33, 0, false);
    for (var f = 0; f < 2; f++) {
      addBox(root, 36, 1.3, 0.3, materials.windowDark, -30, 2.6 + f * 2.6, -17.72, 0, false);
    }
    for (var f3 = 0; f3 < 2; f3++) {
      addBox(root, 36, 1.3, 0.3, materials.windowLit, -30, 26.2 + f3 * 2.6, -17.72, 0, false);
    }
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), materials.led);
    screen.position.set(-30, 17, -17.42);
    root.add(screen);
    var back = new THREE.Mesh(new THREE.PlaneGeometry(30.4, 15.4), materials.ledFrame);
    back.position.set(-30, 17, -17.5);
    root.add(back);
    addBox(root, 31, 0.5, 0.5, materials.metal, -30, 24.7, -17.55, 0, false);
    addBox(root, 31, 0.5, 0.5, materials.metal, -30, 9.3, -17.55, 0, false);
    addSignPlane(root, "百货", 5.6, 1.5, -18, 7.4, -17.6, 0, false);
    led = { screen: screen, mat: materials.led };

    // 东北角商业体量
    addBox(root, 26, 24, 26, materials.plasterWhite, 22, 12, -32, 0, true);
    addBox(root, 26.3, 0.5, 26.3, materials.stoneDark, 22, 24.2, -32, 0, false);
    for (var f2 = 0; f2 < 6; f2++) {
      addBox(root, 22, 1.3, 0.25, materials.windowLit, 22, 4.6 + f2 * 3.2, -18.9, 0, false);
    }
    addSignPlane(root, "北京路", 3.0, 0.9, 8.92, 8.4, -18.85, -Math.PI / 2, false);
    addBox(root, 0.1, 3.2, 0.1, materials.metal, 8.7, 1.6, 22, 0, false);
    addSignPlane(root, "北京路", 1.8, 0.56, 8.7, 2.9, 22.06, 0, false);

    // 旱喷 5 圆盘
    fountain = { group: new THREE.Group(), jets: [] };
    root.add(fountain.group);
    var discs = [[0, 14], [-2.6, 18], [2.6, 18], [-1.4, 22], [1.4, 22]];
    discs.forEach(function (d, di) {
      addCyl(fountain.group, 1.75, 1.75, 0.1, 20, materials.stoneDark, d[0], 0.05, d[1], false);
      addCyl(fountain.group, 1.55, 1.55, 0.04, 20, materials.poolWater, d[0], 0.115, d[1], false);
      for (var j = 0; j < 3; j++) {
        var jet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, 1, 5), materials.waterJet);
        jet.position.set(d[0] + (j - 1) * 0.5, 0.6, d[1] + (j - 1) * 0.4);
        jet.userData.baseY = 0.6;
        jet.userData.phase = di * 1.2 + j * 0.7;
        fountain.group.add(jet);
        fountain.jets.push(jet);
      }
    });
    addGlowSprite(root, 0, 1.2, 18, 9, 0x9fd8ff, 0.12);

    // 中山四路建筑沿街墙（躲开北京路东侧骑楼转角）
    addBox(root, 230, 18, 22, materials.plasterGrey, 152, 9, 28, 0, true);
    for (var sx = 42; sx < 258; sx += 16) {
      addBox(root, 12, 1.4, 0.25, materials.windowDark, sx, 6.2, 16.8, 0, false);
      addBox(root, 12, 1.4, 0.25, materials.windowLit, sx, 9.6, 16.8, 0, false);
    }
  }

  /* ---------------- 大佛寺 ---------------- */

  /* 大雄宝殿：面宽 36.32 m、进深 25.36 m、高约 18 m（重檐歇山意向） */
  function buildDaxiong(gx, dz) {
    var W = 36.32, D = 25.36;
    var podiumH = 1.5, wallTop = 11.4;
    var front = dz + D / 2, back = dz - D / 2;
    var bay = W / 7;

    addBox(root, W + 4.4, podiumH, D + 4.4, materials.whiteStone, gx, podiumH / 2, dz, 0, true);
    addBox(root, W + 5.0, 0.24, D + 5.0, materials.stoneDark, gx, 0.12, dz, 0, false);
    for (var st = 0; st < 3; st++) {
      addBox(root, 13.5 - st * 0.8, 1.2 - st * 0.36, 1.05, materials.whiteStone, gx, (1.2 - st * 0.36) / 2, front + 2.55 + st * 1.05, 0, false);
    }

    var wallH = wallTop - podiumH;
    addBox(root, W, wallH, 0.7, materials.brickGrey, gx, podiumH + wallH / 2, back + 0.35, 0, true);
    addBox(root, 0.7, wallH, D, materials.brickGrey, gx - W / 2 + 0.35, podiumH + wallH / 2, dz, 0, true);
    addBox(root, 0.7, wallH, D, materials.brickGrey, gx + W / 2 - 0.35, podiumH + wallH / 2, dz, 0, true);
    var frontSideW = W / 2 - bay / 2;
    addBox(root, frontSideW, wallH, 0.7, materials.brickGrey, gx - W / 4 - bay / 4, podiumH + wallH / 2, front - 0.35, 0, true);
    addBox(root, frontSideW, wallH, 0.7, materials.brickGrey, gx + W / 4 + bay / 4, podiumH + wallH / 2, front - 0.35, 0, true);
    var doorTopY = podiumH + 6.4;
    addBox(root, bay, wallTop - doorTopY, 0.7, materials.brickGrey, gx, (doorTopY + wallTop) / 2, front - 0.35, 0, true);
    addBox(root, W + 0.36, 1.0, D + 0.36, materials.stoneDark, gx, podiumH + 0.5, dz, 0, false);
    addBox(root, W + 0.28, 0.2, D + 0.28, materials.whiteStone, gx, 8.3, dz, 0, false);
    addBox(root, W + 0.3, 0.24, D + 0.3, materials.whiteStone, gx, wallTop - 1.55, dz, 0, false);

    for (var ci = 0; ci <= 7; ci++) {
      var cx = gx - W / 2 + bay * ci;
      [front + 0.42, back - 0.42].forEach(function (cz) {
        addBox(root, 0.56, wallTop - podiumH - 0.5, 0.56, materials.redColumn, cx, podiumH + (wallTop - podiumH - 0.5) / 2 + 0.25, cz, 0, true);
        addBox(root, 0.78, 0.3, 0.78, materials.stoneDark, cx, podiumH + 0.18, cz, 0, false);
        addBox(root, 0.66, 0.18, 0.66, materials.stone, cx, podiumH + 0.95, cz, 0, false);
      });
    }
    for (var sj = 0; sj <= 5; sj++) {
      var sz = dz - D / 2 + (D / 5) * sj;
      [gx - W / 2 - 0.42, gx + W / 2 + 0.42].forEach(function (cx2) {
        addBox(root, 0.56, wallTop - podiumH - 0.5, 0.56, materials.redColumn, cx2, podiumH + (wallTop - podiumH - 0.5) / 2 + 0.25, sz, 0, true);
      });
    }

    for (var b = -3; b <= 3; b++) {
      var bx = gx + b * bay;
      if (Math.abs(b) <= 1) {
        if (b === 0) {
          // 殿内佛龛：朱红背屏 + 三尊金身佛像 + 供桌（地坪在 +2.5 石台之上）
          addBox(root, 4.9, 5.2, 0.2, materials.redColumn, gx, 5.05, front - 4.0, 0, false);
          addBox(root, 4.9, 0.14, 0.24, materials.goldTrim, gx, 7.45, front - 3.95, 0, false);
          for (var bi = -1; bi <= 1; bi++) {
            var bs = bi === 0 ? 1.08 : 0.86;
            var bx0 = gx + bi * 1.55;
            var bz0 = front - 2.6;
            // 背光（夜间微亮）
            var halo = new THREE.Mesh(new THREE.CircleGeometry(0.86 * bs, 28), materials.goldGlow);
            halo.position.set(bx0, 4.62, bz0 - 0.46);
            halo.scale.set(1, 1.42, 1);
            root.add(halo);
            var haloRim = new THREE.Mesh(new THREE.RingGeometry(0.9 * bs, 1.02 * bs, 28), materials.goldTrim);
            haloRim.position.set(bx0, 4.62, bz0 - 0.45);
            haloRim.scale.set(1, 1.42, 1);
            root.add(haloRim);
            // 莲座（双层）
            addCyl(root, 0.7 * bs, 0.78 * bs, 0.16, 12, materials.goldTrim, bx0, 2.56, bz0, false);
            addCyl(root, 0.58 * bs, 0.7 * bs, 0.18, 12, materials.goldTrim, bx0, 2.73, bz0, false);
            // 袈裟：下摆外扩 + 上身
            addCyl(root, 0.36 * bs, 0.62 * bs, 1.42, 12, materials.goldTrim, bx0, 3.52, bz0, false);
            var shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.4 * bs, 12, 8), materials.goldTrim);
            shoulders.position.set(bx0, 4.28, bz0);
            shoulders.scale.set(1.12, 0.62, 0.86);
            root.add(shoulders);
            // 垂臂 + 腹前结印
            [-1, 1].forEach(function (sg) {
              addBeam(root, bx0 + sg * 0.34 * bs, 4.26, bz0, bx0 + sg * 0.3 * bs, 3.72, bz0 + 0.12, 0.085 * bs, materials.goldTrim, 8, false);
            });
            addBox(root, 0.42 * bs, 0.1, 0.2, materials.goldTrim, bx0, 3.66, bz0 + 0.24, 0, false);
            // 颈、头、肉髻
            addCyl(root, 0.11 * bs, 0.13 * bs, 0.2, 8, materials.goldTrim, bx0, 4.54, bz0, false);
            var head = new THREE.Mesh(new THREE.SphereGeometry(0.3 * bs, 14, 10), materials.goldTrim);
            head.position.set(bx0, 4.84, bz0);
            head.castShadow = true;
            root.add(head);
            var usnisa = new THREE.Mesh(new THREE.SphereGeometry(0.1 * bs, 8, 6), materials.goldTrim);
            usnisa.position.set(bx0, 5.12, bz0);
            root.add(usnisa);
          }
          addBox(root, 4.4, 0.5, 1.05, materials.darkWood, gx, 2.85, front - 1.35, 0, false);
          addBox(root, 4.5, 0.08, 1.15, materials.goldTrim, gx, 3.14, front - 1.35, 0, false);
          [[-1.7, 0], [-1.1, 0], [1.1, 0], [1.7, 0]].forEach(function (cp) {
            addCyl(root, 0.045, 0.065, 0.46, 6, materials.goldTrim, gx + cp[0], 3.38, front - 1.35, false);
            addBox(root, 0.07, 0.13, 0.07, materials.eaveLight, gx + cp[0], 3.68, front - 1.35, 0, false);
          });
          addCyl(root, 0.26, 0.34, 0.46, 8, materials.bronze, gx, 3.33, front - 1.35, false);
          addBox(root, 0.3, 6.6, 0.4, materials.redColumn, gx - bay / 2 + 0.18, podiumH + 3.3, front + 0.34, 0, true);
          addBox(root, 0.3, 6.6, 0.4, materials.redColumn, gx + bay / 2 - 0.18, podiumH + 3.3, front + 0.34, 0, true);
        } else {
          addLatticePanel(root, bay - 0.5, 6.4, bx, podiumH + 3.4, front + 0.16, 0, materials.lattice);
        }
        addLatticePanel(root, bay - 0.5, 1.15, bx, podiumH + 7.15, front + 0.16, 0, materials.latticeWin);
      } else {
        addBox(root, bay - 0.5, 1.6, 0.12, materials.brickGrey, bx, podiumH + 0.8, front + 0.1, 0, false);
        addLatticePanel(root, bay - 1.1, 2.7, bx, podiumH + 3.5, front + 0.16, 0, materials.latticeWin);
        addBox(root, bay - 0.6, 0.2, 0.24, materials.whiteStone, bx, podiumH + 2.05, front + 0.2, 0, false);
      }
    }
    addSignPlane(root, "大雄宝殿", 4.4, 1.1, gx, 9.62, front + 0.34, 0, false);

    addLatticePanel(root, bay * 3 - 1.2, 5.6, gx, podiumH + 3.2, back - 0.18, Math.PI, materials.lattice);
    [-1, 1].forEach(function (s) {
      var sx = gx + s * (W / 2);
      for (var k = -1; k <= 1; k++) {
        var wz = dz + k * 6.6;
        addBox(root, 0.22, 3.4, 3.8, materials.whiteStone, sx + s * 0.12, podiumH + 5.5, wz, 0, false);
        addLatticePanel(root, 3.1, 2.9, sx + s * 0.26, podiumH + 5.5, wz, s > 0 ? Math.PI / 2 : -Math.PI / 2, materials.latticeWin);
        addBox(root, 0.3, 0.22, 3.3, materials.stoneDark, sx + s * 0.2, podiumH + 3.95, wz, 0, false);
      }
      for (var pi = 0; pi < 4; pi++) {
        var pz2 = [358.9, 366.6, 373.3, 380.2][pi];
        addBox(root, 0.3, 8.5, 0.56, materials.stone, sx + s * 0.14, podiumH + 5.15, pz2, 0, false);
      }
    });

    addBox(root, W + 1.0, 0.62, D + 1.0, materials.redColumn, gx, 10.52, dz, 0, true);
    addBox(root, W + 1.12, 0.08, D + 1.12, materials.goldTrim, gx, 10.24, dz, 0, false);
    addDougongBand(root, W + 0.5, D + 0.5, gx, 11.12, dz, 1.25);

    addTempleRoof(root, {
      w: 42.4, d: 30.6, h: 3.3, x: gx, y: 11.6, z: dz, ridgeLen: 25.6,
      mat: materials.templeTile, ridgeGold: true, hornLen: 2.6
    });
    addBox(root, 41.8, 0.12, 0.16, materials.eaveLight, gx, 11.32, dz + 15.18, 0, false);
    addBox(root, 0.16, 0.12, 30.2, materials.eaveLight, gx + 21.08, 11.32, dz, 0, false);
    addBox(root, 0.16, 0.12, 30.2, materials.eaveLight, gx - 21.08, 11.32, dz, 0, false);

    addBox(root, 28, 3.9, 16, materials.brickGrey, gx, 13.95, dz, 0, true);
    for (var ub = -2; ub <= 2; ub++) {
      addLatticePanel(root, 4.1, 1.85, gx + ub * 5.3, 14.55, dz + 8.06, 0, materials.latticeWin);
      addLatticePanel(root, 4.1, 1.85, gx + ub * 5.3, 14.55, dz - 8.06, Math.PI, materials.latticeWin);
      addBox(root, 0.36, 3.4, 0.36, materials.redColumn, gx + ub * 5.3 - 2.65, 14.0, dz + 8.16, 0, true);
    }
    addBox(root, 0.36, 3.4, 0.36, materials.redColumn, gx + 2.65, 14.0, dz + 8.16, 0, true);
    addBox(root, 28.4, 0.3, 16.4, materials.redColumn, gx, 15.1, dz, 0, false);
    addDougongBand(root, 28.4, 16.4, gx, 15.42, dz, 1.4);
    addTempleRoof(root, {
      w: 34.6, d: 22, h: 3.0, x: gx, y: 15.85, z: dz, ridgeLen: 22,
      mat: materials.templeTile, ridgeGold: true, gable: true, hornLen: 2.4
    });
    addBox(root, 34.0, 0.1, 0.14, materials.eaveLight, gx, 15.6, dz + 10.9, 0, false);
    addBox(root, 0.14, 0.1, 21.8, materials.eaveLight, gx + 17.2, 15.6, dz, 0, false);
    addBox(root, 0.14, 0.1, 21.8, materials.eaveLight, gx - 17.2, 15.6, dz, 0, false);
  }

  /* 普觉楼：7F+2B、黄铜瓦五重檐、约 35–40 m（示意） */
  function buildPujue(gx, pz) {
    var W = 40, D = 36, top = 34;
    addBox(root, 56, 2.0, 52, materials.whiteStone, gx, 1.0, pz, 0, true);
    addBox(root, 57, 0.3, 53, materials.stoneDark, gx, 0.15, pz, 0, false);
    for (var st = 0; st < 4; st++) {
      var sh = 0.5 * (4 - st);
      addBox(root, 22, sh, 1.15, materials.whiteStone, gx, sh / 2, pz + 26.4 + st * 1.15, 0, false);
    }
    addBox(root, W, top - 2, D, materials.ochreWall, gx, (top + 2) / 2, pz, 0, true);
    addBox(root, W + 0.5, 1.2, D + 0.5, materials.stoneDark, gx, 2.6, pz, 0, false);
    for (var i = -4; i <= 4; i++) {
      var px = gx + i * 4.6;
      addBox(root, 0.72, top - 5.2, 0.62, materials.brassPier, px, (top + 4.2) / 2, pz + D / 2 + 0.3, 0, true);
      addBox(root, 0.72, top - 5.2, 0.62, materials.brassPier, px, (top + 4.2) / 2, pz - D / 2 - 0.3, 0, true);
      var pz2 = pz + i * 4.4;
      addBox(root, 0.62, top - 5.2, 0.72, materials.brassPier, gx + W / 2 + 0.3, (top + 4.2) / 2, pz2, 0, true);
      addBox(root, 0.62, top - 5.2, 0.72, materials.brassPier, gx - W / 2 - 0.3, (top + 4.2) / 2, pz2, 0, true);
    }
    var floorYs = [4.6, 8.0, 13.9, 20.4, 26.9, 32.6];
    floorYs.forEach(function (fy, f) {
      addBox(root, W + 0.7, 0.2, D + 0.7, materials.bronzeFrame, gx, fy - 1.7, pz, 0, false);
      for (var wb = -3.5; wb <= 3.5; wb += 1) {
        var wx = gx + wb * 4.6;
        var lit = ((f * 3 + Math.round(wb * 2) + 9) % 3 === 0);
        var wmat = lit ? materials.windowWarm : materials.windowDark;
        addBox(root, 3.5, 2.35, 0.2, wmat, wx, fy, pz + D / 2 + 0.13, 0, false);
        addBox(root, 3.5, 2.35, 0.2, wmat, wx, fy, pz - D / 2 - 0.13, 0, false);
        addBox(root, 0.12, 2.35, 0.22, materials.bronzeFrame, wx, fy, pz + D / 2 + 0.19, 0, false);
      }
      for (var wb2 = -3.5; wb2 <= 3.5; wb2 += 1) {
        var wz = pz + wb2 * 4.4;
        var lit2 = ((f * 5 + Math.round(wb2 * 2) + 3) % 4 === 0);
        var wmat2 = lit2 ? materials.windowWarm : materials.windowDark;
        addBox(root, 0.2, 2.25, 3.2, wmat2, gx + W / 2 + 0.13, fy, wz, 0, false);
        addBox(root, 0.2, 2.25, 3.2, wmat2, gx - W / 2 - 0.13, fy, wz, 0, false);
      }
    });
    var tiers = [
      { y: 9.6, ow: 49, od: 45 },
      { y: 16.1, ow: 47, od: 43 },
      { y: 22.6, ow: 45, od: 41 },
      { y: 29.1, ow: 43, od: 39 }
    ];
    tiers.forEach(function (t) {
      addEaveRing(root, t.ow, t.od, W + 0.4, D + 0.4, 2.1, t.y, gx, pz, materials.templeGold, { hornLen: 2.9 });
      addBandPlane(root, W + 1.0, 0.85, materials.dougongBand, gx, t.y - 1.25, pz + D / 2 + 0.4, 0, (W + 1.0) / 1.6);
      addBandPlane(root, W + 1.0, 0.85, materials.dougongBand, gx, t.y - 1.25, pz - D / 2 - 0.4, Math.PI, (W + 1.0) / 1.6);
      addBandPlane(root, D + 1.0, 0.85, materials.dougongBand, gx + W / 2 + 0.4, t.y - 1.25, pz, Math.PI / 2, (D + 1.0) / 1.6);
      addBandPlane(root, D + 1.0, 0.85, materials.dougongBand, gx - W / 2 - 0.4, t.y - 1.25, pz, -Math.PI / 2, (D + 1.0) / 1.6);
      addBox(root, t.ow - 1.6, 0.13, 0.16, materials.eaveLight, gx, t.y - 0.62, pz + t.od / 2 - 0.2, 0, false);
      addBox(root, 0.16, 0.13, t.od - 1.6, materials.eaveLight, gx + t.ow / 2 - 0.2, t.y - 0.62, pz, 0, false);
      addBox(root, 0.16, 0.13, t.od - 1.6, materials.eaveLight, gx - t.ow / 2 + 0.2, t.y - 0.62, pz, 0, false);
    });
    addTempleRoof(root, {
      w: 42, d: 38, h: 4.6, x: gx, y: top, z: pz, ridgeLen: 24,
      mat: materials.templeGold, ridgeGold: true, gable: true, hornLen: 3.0, hornMat: materials.templeGold
    });
    addCyl(root, 0.9, 1.15, 1.0, 10, materials.ridgeGold, gx, 39.2, pz, false);
    addCyl(root, 0.42, 0.62, 1.6, 8, materials.ridgeGold, gx, 40.3, pz, false);
    addSignPlane(root, "普觉楼", 5.0, 1.4, gx, 19.8, pz + D / 2 + 0.5, 0, false);
    addLantern(root, gx - 10, 6.4, pz + D / 2 + 1.2, 1.2);
    addLantern(root, gx + 10, 6.4, pz + D / 2 + 1.2, 1.2);
  }

  function buildDafo() {
    // 山门（惠福东路北侧）
    var gx = -140, gz = 434.4;
    addBox(root, 12, 0.5, 7, materials.stone, gx, 0.25, gz, 0, false);
    addBox(root, 11, 0.35, 6, materials.whiteStone, gx, 0.68, gz, 0, false);
    // 门楼放大（沿街可见）
    addBox(root, 2.6, 6.4, 3.6, materials.brickGrey, gx - 4.6, 3.7, gz, 0, true);
    addBox(root, 2.6, 6.4, 3.6, materials.brickGrey, gx + 4.6, 3.7, gz, 0, true);
    addBox(root, 11.8, 2.0, 3.8, materials.brickGrey, gx, 7.9, gz, 0, true);
    addBox(root, 6.6, 0.4, 0.5, materials.redColumn, gx, 6.7, gz + 1.7, 0, false);
    addBox(root, 6.6, 0.4, 0.5, materials.redColumn, gx, 0.95, gz + 1.7, 0, false);
    addBox(root, 0.55, 5.9, 0.26, materials.goldTrim, gx - 3.95, 3.4, gz + 1.88, 0, false);
    addBox(root, 0.55, 5.9, 0.26, materials.goldTrim, gx + 3.95, 3.4, gz + 1.88, 0, false);
    addBox(root, 15.0, 0.2, 0.3, materials.goldTrim, gx, 8.84, gz + 3.75, 0, false);
    addTempleRoof(root, {
      w: 15.8, d: 8.6, h: 2.9, x: gx, y: 8.85, z: gz, ridgeLen: 9.4,
      mat: materials.templeTile, ridgeGold: true, hornLen: 2.0, ridgeMat: materials.ridgeDark
    });
    addBox(root, 15.4, 0.11, 0.14, materials.eaveLight, gx, 8.63, gz + 4.22, 0, false);
    addSignPlane(root, "大佛古寺", 4.0, 1.25, gx, 7.8, gz + 1.94, 0, false);
    addSignPlane(root, "大佛古寺", 3.6, 1.0, gx + 5.93, 7.55, gz, Math.PI / 2, false);
    // 石狮
    [-4.8, 4.8].forEach(function (dx) {
      addBox(root, 1.1, 0.8, 1.2, materials.stoneDark, gx + dx, 0.9, gz + 2.6, 0, true);
      addBox(root, 0.7, 0.8, 0.7, materials.stoneDark, gx + dx, 1.7, gz + 2.45, 0, false);
      addCyl(root, 0.3, 0.3, 0.35, 8, materials.stoneDark, gx + dx, 2.25, gz + 2.4, false);
    });
    // 巷道墙、地面、灯笼
    addBox(root, 0.5, 4.4, 28, materials.brickGrey, gx - 2.6, 2.2, 421, 0, true);
    addBox(root, 0.5, 4.4, 28, materials.brickGrey, gx + 2.6, 2.2, 421, 0, true);
    addBox(root, 0.62, 0.5, 28, materials.roofGrey, gx - 2.6, 4.5, 421, 0, false);
    addBox(root, 0.62, 0.5, 28, materials.roofGrey, gx + 2.6, 4.5, 421, 0, false);
    addSignPlane(root, "大佛寺", 0.62, 2.5, gx - 2.32, 4.0, 424, Math.PI / 2, true);

    // 天王殿（门殿：中央通道，轴线可望大雄宝殿）
    addBox(root, 22, 0.6, 15, materials.whiteStone, gx, 0.3, 405, 0, true);
    addBox(root, 6.8, 9, 12, materials.brickGrey, gx - 6.6, 4.8, 405, 0, true);
    addBox(root, 6.8, 9, 12, materials.brickGrey, gx + 6.6, 4.8, 405, 0, true);
    addBox(root, 20, 3.2, 12, materials.brickGrey, gx, 7.7, 405, 0, true);
    addBox(root, 6.4, 0.25, 12, materials.darkWood, gx, 6.0, 405, 0, false);
    [-3.2, 3.2].forEach(function (dx) {
      addBox(root, 0.44, 5.9, 0.44, materials.redColumn, gx + dx, 3.35, 411.2, 0, true);
      addBox(root, 0.62, 0.26, 0.62, materials.stoneDark, gx + dx, 0.72, 411.2, 0, false);
    });
    addLatticePanel(root, 5.0, 1.2, gx, 5.35, 411.18, 0, materials.latticeWin);
    [-1, 1].forEach(function (sg) {
      addLatticePanel(root, 3.2, 2.6, gx + sg * 6.6, 4.2, 411.1, 0, materials.latticeWin);
      addBox(root, 0.4, 6.4, 0.4, materials.redColumn, gx + sg * 9.6, 3.8, 411.2, 0, true);
    });
    addSignPlane(root, "大佛古寺", 2.2, 0.7, gx, 4.9, 411.4, 0, false);
    addBandPlane(root, 21, 0.8, materials.dougongBand, gx, 8.5, 411.1, 0, 21 / 1.6);
    addTempleRoof(root, {
      w: 23.6, d: 15.6, h: 3.3, x: gx, y: 9.0, z: 405, ridgeLen: 14.5,
      mat: materials.templeTile, ridgeGold: true, hornLen: 2.2
    });
    addBox(root, 23.2, 0.11, 0.14, materials.eaveLight, gx, 8.78, 412.62, 0, false);
    // 钟鼓楼
    [-20, 20].forEach(function (dx) {
      addBox(root, 8, 0.5, 8, materials.whiteStone, gx + dx, 0.25, 405, 0, true);
      addBox(root, 7, 8, 7, materials.brickGrey, gx + dx, 4.5, 405, 0, true);
      [-1, 1].forEach(function (sg) {
        addBox(root, 0.42, 7.2, 0.42, materials.redColumn, gx + dx + sg * 3.1, 4.1, 408.1, 0, true);
      });
      addLatticePanel(root, 3.2, 2.4, gx + dx, 5.2, 408.6, 0, materials.latticeWin);
      addBox(root, 7.4, 0.26, 7.4, materials.goldTrim, gx + dx, 8.35, 405, 0, false);
      addTempleRoof(root, {
        w: 9.6, d: 9.6, h: 2.6, x: gx + dx, y: 8.4, z: 405, ridgeLen: 4.6,
        mat: materials.templeTile, ridgeGold: true, hornLen: 1.6
      });
    });
    // 侧殿（剪影）
    [-50, 50].forEach(function (dx) {
      addBox(root, 15, 0.5, 10, materials.whiteStone, gx + dx, 0.25, 382, 0, true);
      addBox(root, 14, 8, 9, materials.brickGrey, gx + dx, 4.5, 382, 0, true);
      for (var sc = -1; sc <= 1; sc++) {
        addBox(root, 0.4, 6.8, 0.4, materials.redColumn, gx + dx + sc * 5.6, 3.9, 386.1, 0, true);
      }
      addBox(root, 14.4, 0.28, 9.4, materials.goldTrim, gx + dx, 8.4, 382, 0, false);
      addTempleRoof(root, {
        w: 17.4, d: 12.4, h: 3.3, x: gx + dx, y: 8.45, z: 382, ridgeLen: 9.4,
        mat: materials.templeTile, ridgeGold: true, hornLen: 1.8
      });
    });

    // 大雄宝殿 / 普觉楼（精做段）
    buildDaxiong(gx, 370);
    buildPujue(gx, 310);

    // 前院香炉（天王殿与大雄宝殿之间）、后院石栏
    addBox(root, 2.2, 1.5, 2.2, materials.bronze, gx, 0.85, 392, 0, true);
    addBox(root, 1.6, 0.8, 1.6, materials.bronze, gx, 1.95, 392, 0, false);
    for (var i = 0; i < 4; i++) {
      addBox(root, 2.4, 0.06, 2.8, materials.roofDark, gx, 2.4 + i * 0.04, 392 - 1.6 * i, 0, false);
    }
    // 前院石道（轴线）+ 石灯
    addPavedRect(root, 4.4, 21.5, materials.pavingLight, gx, 394.3, 0.055, 1.2, 0.6);
    addPavedRect(root, 3.2, 20, materials.pavingDark, gx, 424, 0.05, 0.8, 0.8);
    [[-6.5, 414], [6.5, 414], [-6.5, 398], [6.5, 398]].forEach(function (p) {
      addBox(root, 0.7, 0.5, 0.7, materials.whiteStone, gx + p[0], 0.25, p[1], 0, true);
      addBox(root, 0.34, 1.1, 0.34, materials.stone, gx + p[0], 1.05, p[1], 0, true);
      addBox(root, 0.55, 0.32, 0.55, materials.stone, gx + p[0], 1.75, p[1], 0, true);
      addBox(root, 0.62, 0.08, 0.62, materials.goldTrim, gx + p[0], 1.95, p[1], 0, false);
    });
    for (var px = -22; px <= 22; px += 4) {
      addBox(root, 0.12, 1.0, 0.12, materials.whiteStone, gx + px, 0.5, 342, 0, false);
      addBox(root, 0.16, 0.14, 0.3, materials.whiteStone, gx + px, 1.05, 342, 0, false);
    }
    // 寺院围墙
    addBox(root, 0.6, 4.2, 150, materials.brickGrey, gx - 62, 2.1, 355, 0, true);
    addBox(root, 0.6, 4.2, 150, materials.brickGrey, gx + 62, 2.1, 355, 0, true);
    addBox(root, 124, 0.5, 0.7, materials.roofGrey, gx, 4.4, 355, 0, false);
    addBox(root, 124, 0.5, 0.7, materials.roofGrey, gx, 4.4, 280, 0, false);
    addBox(root, 124, 4.2, 0.6, materials.brickGrey, gx, 2.1, 280, 0, true);
  }

  /* ---------------- 城隍庙 ---------------- */

  function buildChenghuang() {
    var cx = 180;
    // 牌楼
    addBox(root, 0.55, 7.2, 0.55, materials.redColumn, cx - 4.6, 3.6, -19, 0, true);
    addBox(root, 0.55, 7.2, 0.55, materials.redColumn, cx + 4.6, 3.6, -19, 0, true);
    addBox(root, 0.45, 6.2, 0.45, materials.redColumn, cx - 1.6, 3.1, -19, 0, true);
    addBox(root, 0.45, 6.2, 0.45, materials.redColumn, cx + 1.6, 3.1, -19, 0, true);
    addBox(root, 9.6, 0.9, 0.7, materials.whiteStone, cx, 6.2, -19, 0, true);
    addRoof(root, 8.2, 3.2, 1.9, cx, 7.2, -19, materials.roofGreen, 0, materials.roofDark);
    addRoof(root, 3.6, 2.4, 1.3, cx, 7.15, -19, materials.roofGreen, 0, materials.roofDark);
    addSignPlane(root, "城隍庙", 2.4, 0.8, cx, 5.6, -18.6, 0, false);

    // 拜亭（绿琉璃）
    addBox(root, 11, 0.4, 8, materials.whiteStone, cx, 0.2, -30, 0, false);
    [[-4.2, -33.2], [4.2, -33.2], [-4.2, -26.8], [4.2, -26.8], [-4.2, -30], [4.2, -30]].forEach(function (p) {
      addBox(root, 0.4, 4.6, 0.4, materials.redColumn, cx + p[0], 2.5, p[1], 0, true);
    });
    addBox(root, 9.2, 0.5, 6.4, materials.darkWood, cx, 4.9, -30, 0, false);
    addRoof(root, 12.8, 9.6, 3.8, cx, 5.2, -30, materials.roofGreen, 0, materials.roofDark);
    addBox(root, 0.2, 0.8, 0.2, materials.goldTrim, cx, 8.1, -30, 0, false);

    // 大殿（净高约 12 m）
    addBox(root, 18, 1.3, 12, materials.whiteStone, cx, 0.65, -44, 0, false);
    addBox(root, 17, 8.6, 10.6, materials.brickGrey, cx, 5.6, -44, 0, true);
    addBox(root, 17.4, 0.5, 11, materials.darkWood, cx, 9.8, -44, 0, false);
    addRoof(root, 21, 14, 4.4, cx, 10, -44, materials.roofGreen, 0, materials.roofDark);
    addBox(root, 19, 0.5, 11.5, materials.roofDark, cx, 12.9, -44, 0, false);
    // 门与匾
    addBox(root, 7, 5.4, 0.25, materials.darkWood, cx, 3.6, -38.6, 0, false);
    addBox(root, 2.2, 5.4, 0.28, materials.redColumn, cx - 3.6, 3.6, -38.58, 0, false);
    addBox(root, 2.2, 5.4, 0.28, materials.redColumn, cx + 3.6, 3.6, -38.58, 0, false);
    addSignPlane(root, "城隍庙", 3.2, 0.95, cx, 7.9, -38.5, 0, false);
    for (var s = 0; s < 14; s++) {
      addBox(root, 0.35, 0.35, 0.08, materials.goldTrim, cx - 2.8 + (s % 7) * 0.94, 3.0 + Math.floor(s / 7) * 1.5, -38.44, 0, false);
    }
    // 围墙
    addBox(root, 0.6, 3.6, 38, materials.brickGrey, cx - 15, 1.8, -35, 0, true);
    addBox(root, 0.6, 3.6, 38, materials.brickGrey, cx + 15, 1.8, -35, 0, true);
    addBox(root, 30, 0.4, 2.4, materials.whiteStone, cx, 0.2, -17.6, 0, false);
    // 香炉 / 石狮
    addBox(root, 1.8, 1.4, 1.8, materials.bronze, cx, 0.8, -27, 0, true);
    addBox(root, 1.2, 0.6, 1.2, materials.bronze, cx, 1.75, -27, 0, false);
    [-5.6, 5.6].forEach(function (dx) {
      addBox(root, 0.9, 1.1, 1.0, materials.stoneDark, cx + dx, 0.75, -20.4, 0, true);
      addBox(root, 0.6, 0.8, 0.6, materials.stoneDark, cx + dx, 1.6, -20.5, 0, false);
    });
    // 周边高层（小庙被城市包围）
    var towers = [
      [140, -55, 20, 30, 20], [210, -62, 26, 28, 24], [214, -28, 18, 24, 18],
      [180, -104, 34, 32, 18], [146, -92, 18, 24, 16], [150, 31, 26, 22, 16], [212, 33, 22, 24, 16]
    ];
    towers.forEach(function (t, ti) {
      addBox(root, t[2], t[3], t[4], materials.plasterGrey, t[0], t[3] / 2, t[1], 0, true);
      addBox(root, t[2] + 0.3, 0.5, t[4] + 0.3, materials.stoneDark, t[0], t[3] + 0.25, t[1], 0, false);
      // 正面 / 侧面窗格
      var cols = Math.max(3, Math.floor(t[2] / 4));
      var rows = Math.max(4, Math.floor(t[3] / 4.2));
      for (var r = 0; r < rows; r++) {
        for (var c2 = 0; c2 < cols; c2++) {
          var wx = t[0] - t[2] * 0.4 + (c2 / Math.max(1, cols - 1)) * t[2] * 0.8;
          var wy = 3.0 + r * ((t[3] - 5) / rows);
          var wm = (r + c2 + ti) % 4 === 0 ? materials.windowLit : materials.windowDark;
          addBox(root, 1.5, 1.3, 0.26, wm, wx, wy, t[1] + t[4] / 2 + 0.14, 0, false);
          if (c2 % 2 === 0) addBox(root, 0.26, 1.3, 1.2, wm, t[0] + t[2] / 2 + 0.14, wy, t[1] - t[4] * 0.32 + (c2 / cols) * t[4] * 0.6, 0, false);
        }
      }
      addBox(root, t[2] * 0.7, 1.1, 0.3, materials.windowLit, t[0], t[3] - 2.4, t[1] + t[4] / 2 + 0.16, 0, false);
    });
    // 忠佑大街门牌
    addBox(root, 0.1, 3.0, 0.1, materials.metal, 175.5, 1.5, -16.5, 0, false);
    addSignPlane(root, "忠佑大街", 1.9, 0.58, 175.5, 2.65, -16.44, 0, false);
  }

  /* ---------------- 惠福东路 ---------------- */

  function addDiningSet(parent, tx, tz) {
    addBox(parent, 1.02, 0.06, 1.02, materials.plasticCream, tx, 0.72, tz, 0, false);
    addBox(parent, 0.92, 0.05, 0.92, materials.tableWood, tx, 0.665, tz, 0, false);
    [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(function (p) {
      addBox(parent, 0.065, 0.64, 0.065, materials.tableWood, tx + p[0], 0.32, tz + p[1], 0, false);
    });
    addBox(parent, 0.13, 0.16, 0.13, materials.eaveLight, tx, 0.87, tz, 0, false);
    addBox(parent, 0.19, 0.03, 0.19, materials.darkFrame, tx, 0.97, tz, 0, false);
    [[-0.85, 0], [0.85, 0], [0, -0.85], [0, 0.85]].forEach(function (p) {
      var sx = tx + p[0], sz = tz + p[1];
      addBox(parent, 0.42, 0.06, 0.42, materials.plasticCream, sx, 0.45, sz, 0, false);
      [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(function (q) {
        addBox(parent, 0.05, 0.44, 0.05, materials.tableWood, sx + q[0], 0.22, sz + q[1], 0, false);
      });
    });
  }

  function buildHuifu() {
    var foodSigns = ["烧腊", "煲仔饭", "云吞面", "糖水铺", "凉茶", "牛杂", "肠粉", "粥粉面", "茶餐厅", "甜品", "咖啡", "金铺", "药房", "广州手信",
      "烧鹅", "牛腩", "大排档", "海鲜", "鸡煲", "烧烤", "早茶", "面家", "炖品", "冰室", "小吃", "柠檬茶", "艇仔粥", "布拉肠", "糖水店", "煲汤"];
    var awningMats = [materials.awningRed, materials.awningGreen, materials.awningCream];
    var pools = [];
    var x = -24;
    var i = 0;
    while (x > -248) {
      var w = 8 + rnd() * 4;
      if (x - w < -248) w = x + 248;
      var cx = x - w / 2;
      var skip = (x > -148 && x - w < -132);
      if (!skip) {
        var h = 12 + rnd() * 4;
        if (x > -176 && x - w < -108) h = 8.2 + rnd() * 1.4;
        var mat = [materials.plasterCream, materials.plasterBeige, materials.plasterWhite, materials.brickRed, materials.brickGrey][i % 5];
        addBox(root, w - 0.15, h, 11, mat, cx, h / 2, 429.5, 0, true);
        addBox(root, w - 0.3, 3.4, 0.28, i % 2 ? materials.shopfrontA : materials.shopfrontC, cx, 1.75, 435.05, 0, false);
        addSignPlane(root, foodSigns[i % foodSigns.length], Math.min(w - 1.4, 4.8), 0.85, cx, 3.9, 435.15, 0, false);
        // 二层横招
        addSignPlane(root, foodSigns[(i * 3 + 4) % foodSigns.length], Math.min(w - 1.8, 3.9), 0.7, cx, 5.15, 435.14, 0, false);
        // 竖招（逐店）
        addSignPlane(root, foodSigns[(i * 5 + 2) % foodSigns.length], 0.64, 2.7, cx - w / 2 + 0.55, 6.35, 435.24, 0, true);
        // 侧挑灯箱（垂直街面）
        addSignPlane(root, foodSigns[(i * 7 + 6) % foodSigns.length], 1.15, 0.72, cx + w / 2 - 1.0, 4.55, 435.75, Math.PI / 2, false);
        // 菜单灯箱 + 檐下灯带
        if (i % 2 === 0) {
          addBox(root, 1.0, 1.5, 0.07, materials.signFrame, cx - w * 0.28, 1.65, 435.35, 0, false);
          var menuMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), materials.menu);
          menuMesh.position.set(cx - w * 0.28, 1.65, 435.4);
          root.add(menuMesh);
        }
        addBox(root, w - 0.5, 0.1, 0.12, materials.eaveLight, cx, 4.42, 435.24, 0, false);
        if (i % 3 === 0) addBox(root, w - 1.2, 0.05, 0.05, materials.darkFrame, cx, 4.6, 435.5, 0, false);
        if (i % 3 === 1) {
          addBox(root, w - 1.2, 0.06, 1.5, awningMats[i % 3], cx, 4.35, 435.6, 0, false);
          addBox(root, w - 1.2, 0.08, 0.12, materials.eaveLight, cx, 4.28, 436.3, 0, false);
        }
        if (i % 3 === 0) addLantern(root, cx + w * 0.2, 3.6, 435.55, 0.62);
        if (i % 2 === 0) {
          addBox(root, 0.8, 0.5, 0.35, materials.metal, cx + w * 0.2, 5.4, 435.25, 0, false);
        }
        for (var hf = 0; hf < 2; hf++) {
          var hwy = 6.4 + hf * 3.0;
          for (var hwi = 0; hwi < 2; hwi++) {
            var hwx = cx - w * 0.18 + hwi * w * 0.4;
            addBox(root, 1.5, 1.65, 0.24, (i + hf + hwi) % 3 === 0 ? materials.windowLit : materials.windowDark, hwx, hwy, 435.04, 0, false);
            addBox(root, 1.75, 0.14, 0.2, materials.whiteStone, hwx, hwy - 0.92, 435.06, 0, false);
          }
          if (i % 3 === hf) addBox(root, 0.75, 0.5, 0.32, materials.metal, cx - w * 0.38, hwy + 0.2, 435.2, 0, false);
        }
        if (i % 2 === 0) {
          addDiningSet(root, cx + 1.4, 437.35);
          addDiningSet(root, cx - 1.6, 438.55);
        }
        if (i % 4 === 1) addDiningSet(root, cx + 0.2, 439.7);
        pools.push([cx, 437.4, 6.2, 3.4]);
        pools.push([cx, 438.8, 4.2, 2.4]);
        counts.modules++;
      }
      x -= w;
      i++;
    }
    // 南侧
    x = -24; i = 0;
    while (x > -248) {
      var w2 = 9 + rnd() * 4;
      if (x - w2 < -248) w2 = x + 248;
      var cx2 = x - w2 / 2;
      var h2 = 11 + rnd() * 5;
      var mat2 = [materials.plasterGrey, materials.plasterWhite, materials.brickGrey, materials.plasterBeige][i % 4];
      addBox(root, w2 - 0.15, h2, 11, mat2, cx2, h2 / 2, 450.5, 0, true);
      addBox(root, w2 - 0.3, 3.4, 0.28, i % 2 ? materials.shopfrontB : materials.shopfrontA, cx2, 1.75, 444.95, 0, false);
      addSignPlane(root, foodSigns[(i + 5) % foodSigns.length], Math.min(w2 - 1.4, 4.4), 0.85, cx2, 3.9, 444.85, Math.PI, false);
      addSignPlane(root, foodSigns[(i * 3 + 8) % foodSigns.length], Math.min(w2 - 1.8, 3.8), 0.72, cx2, 5.7, 444.86, Math.PI, false);
      addSignPlane(root, foodSigns[(i * 5 + 11) % foodSigns.length], 0.6, 2.5, cx2 + w2 / 2 - 0.55, 6.2, 444.8, Math.PI, true);
      addSignPlane(root, foodSigns[(i * 7 + 3) % foodSigns.length], 1.1, 0.68, cx2 - w2 / 2 + 1.0, 4.5, 444.3, Math.PI / 2, false);
      addBox(root, w2 - 0.5, 0.1, 0.12, materials.eaveLight, cx2, 4.32, 444.7, 0, false);
      if (i % 2 === 0) {
        addBox(root, 1.0, 1.5, 0.07, materials.signFrame, cx2 + w2 * 0.24, 1.65, 444.88, 0, false);
        var menuMesh2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), materials.menu);
        menuMesh2.position.set(cx2 + w2 * 0.24, 1.65, 444.82);
        menuMesh2.rotation.y = Math.PI;
        root.add(menuMesh2);
      }
      for (var wnd = 0; wnd < 2; wnd++) {
        addBox(root, 1.4, 1.5, 0.24, (i + wnd) % 3 === 0 ? materials.windowLit : materials.windowDark, cx2 - w2 * 0.18 + wnd * w2 * 0.4, 6.2, 444.86, 0, false);
        addBox(root, 1.4, 1.5, 0.24, (i + wnd + 1) % 4 === 0 ? materials.windowLit : materials.windowDark, cx2 - w2 * 0.18 + wnd * w2 * 0.4, 9.2, 444.86, 0, false);
      }
      if (i % 2 === 0) addBox(root, 0.8, 0.5, 0.35, materials.metal, cx2 + w2 * 0.22, 7.4, 444.9, 0, false);
      if (i % 2 === 0) addDiningSet(root, cx2 - 0.6, 442.55);
      pools.push([cx2, 442.9, 6.0, 3.0]);
      counts.modules++;
      x -= w2;
      i++;
    }
    // 山门前地面光斑
    pools.push([-140, 437.4, 12, 4.6]);
    pools.push([-140, 429, 5, 4]);
    addLightPools(root, pools);
    // 电线
    for (var line = 0; line < 3; line++) {
      addBeam(root, -8, 7.4 + line * 0.5, 429.5, -240, 7.6 + line * 0.5, 429.5, 0.025, materials.darkFrame, 3, false);
    }
    // 惠福东路路牌
    addBox(root, 0.1, 3.2, 0.1, materials.metal, -7.2, 1.6, 436, 0, false);
    addSignPlane(root, "惠福东路", 1.9, 0.58, -7.2, 2.8, 436.06, 0, false);
    // 西端收口（压缩示意）
    addBox(root, 22, 12, 18, materials.plasterGrey, -258, 6, 424, 0, true);
    addBox(root, 22, 10, 18, materials.plasterBeige, -258, 5, 456, 0, true);
    addRoof(root, 24, 20, 3.2, -258, 12, 424, materials.roofGrey, 0, materials.roofDark);
    addSignPlane(root, "惠福美食花街", 5.2, 0.9, -246.6, 8.2, 440, Math.PI / 2, false);
  }

  /* ---------------- 南越王宫 / 背景 ---------------- */

  function buildNanyue() {
    addBox(root, 140, 3.6, 1.2, materials.brickGrey, 90, 1.8, -16.4, 0, true);
    addBox(root, 141, 0.5, 1.6, materials.roofGrey, 90, 3.85, -16.4, 0, false);
    // 入口门楼
    addBox(root, 12, 4.6, 3, materials.brickGrey, 80, 2.3, -17.5, 0, true);
    addRoof(root, 14, 6, 2.4, 80, 4.6, -17.5, materials.roofGrey, 0, materials.roofDark);
    addBox(root, 8, 2.6, 1.0, materials.darkWood, 80, 1.3, -16.2, 0, false);
    addBox(root, 10, 0.18, 2.4, materials.metal, 80, 4.2, -18.8, 0, false);
    // 墙内低层屋顶与树冠
    for (var i = 0; i < 7; i++) {
      addBox(root, 12, 5, 10, materials.brickGrey, 30 + i * 20, 2.5, -30, 0, false);
      addRoof(root, 14, 12, 2.8, 30 + i * 20, 5, -30, materials.roofGrey, 0, null);
    }
  }

  function buildBackdrop() {
    // 财厅（北端收口，古典立面 + 穹顶剪影）
    addBox(root, 40, 16, 18, materials.plasterGrey, -20, 8, -108, 0, true);
    addBox(root, 42, 1.0, 20, materials.whiteStone, -20, 16.4, -108, 0, false);
    for (var c = 0; c < 8; c++) {
      addBox(root, 0.8, 11, 0.8, materials.whiteStone, -36 + c * 4.6, 5.5, -99.2, 0, false);
    }
    addCyl(root, 6.5, 8.5, 5.2, 16, materials.roofGrey, -20, 19, -108, false);
    addCyl(root, 0.6, 1.4, 3.2, 12, materials.goldTrim, -20, 23.2, -108, false);
    addSignPlane(root, "北京路步行街", 8, 1.1, -20, 13.4, -98.9, 0, false);
    // 财厅前两侧低层骑楼背景（以骑楼行覆盖，避免重复体量）
    // 书院群屋顶（西侧背景）
    for (var i = 0; i < 8; i++) {
      var ax = -180 + (i % 4) * 26;
      var az = 150 + Math.floor(i / 4) * 34;
      addBox(root, 18, 6.5, 16, materials.brickGrey, ax, 3.25, az, 0, false);
      addRoof(root, 20, 18, 3.0, ax, 6.5, az, materials.roofGrey, 0, null);
    }
    // 北京路南段渐隐背景
    buildSimpleRow(-1, 456, 505);
    buildSimpleRow(1, 456, 505);

    // 远景城市体量
    var cityCount = lowMode ? 48 : 92;
    var inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.city, cityCount);
    var dummy = new THREE.Object3D();
    var n = 0, guard = 0;
    while (n < cityCount && guard < cityCount * 20) {
      guard++;
      var side = Math.floor(rnd() * 4);
      var x, z;
      if (side === 0) { x = -420 + rnd() * 160; z = -160 + rnd() * 760; }
      else if (side === 1) { x = 260 + rnd() * 160; z = -160 + rnd() * 760; }
      else if (side === 2) { x = -260 + rnd() * 520; z = 560 + rnd() * 140; }
      else { x = -260 + rnd() * 520; z = -260 + rnd() * 100; }
      var w = 14 + rnd() * 26;
      var d = 14 + rnd() * 26;
      var h = 14 + Math.pow(rnd(), 1.5) * 44;
      dummy.position.set(x, h / 2 - 0.4, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      n++;
    }
    inst.count = n;
    inst.castShadow = false;
    inst.receiveShadow = true;
    root.add(inst);
    instanced.city = inst;

    // 近景几栋高层剪影（不写实地标）
    addBox(root, 24, 46, 22, materials.plasterGrey, -70, 23, 60, 0, false);
    addBox(root, 26, 38, 24, materials.windowDark, 58, 19, 120, 0, false);
    addBox(root, 30, 42, 26, materials.plasterGrey, -230, 21, 60, 0, false);
    addBox(root, 26, 34, 24, materials.plasterWhite, 230, 17, 120, 0, false);
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "ancient", craft: "ancient", no: "01", name: "千年古道 · 11 层路面",
        pos: new THREE.Vector3(0, 0.9, 66),
        view: { pos: [4.2, 3.2, 94], target: [-0.8, -0.6, 58] },
        lede: "2002 年 6–7 月北京路整饰时发现，遗址总面积 420 m²。儿童书店前一段 11 层路面，从民国上溯到唐代，5 个时期叠压。",
        facts: [["遗址", "44 × 3.8 m"], ["层位", "11 层 / 5 期"], ["开放", "2003-01"]],
        detail: "唐、南汉、宋元、明清、民国五个时期自上而下叠压，距地表 3 m 以上；玻璃罩分格、黑色矮柱与说明碑为现状示意。2008-12 列为市保，2019-04 拱北楼段升省保。"
      },
      {
        id: "street", craft: "street", no: "02", name: "北京路 · 骑楼界面",
        pos: new THREE.Vector3(7.2, 8.6, 158),
        view: { pos: [5.8, 1.8, 150], target: [4.0, 2.4, 300] },
        lede: "中山五路—惠福东路约 440 m 步行核心，街宽 16 m。2020 年修复 376 栋骑楼，其中 67 栋保护建筑，主街立面 8840 m²。",
        facts: [["核心段", "440 m"], ["街宽", "16 m"], ["骑楼", "376 栋"]],
        detail: "北京路骑楼以 3–4 层为主，柱距约 4 m、廊深 3–4 m、廊下净高 5–5.5 m；浅色抹灰 + 方柱 + 玻璃橱窗，夹少量红砖/水刷石。两侧 20 多棵古榕，红灯笼为夜间/节庆示意；招牌为示意，不使用品牌 logo。"
      },
      {
        id: "gongbei", craft: "gongbei", no: "03", name: "拱北楼 · 铜壶滴漏",
        pos: new THREE.Vector3(0, 3.2, 234),
        view: { pos: [5.8, 2.8, 255], target: [-1.5, 1.5, 224] },
        lede: "西湖路口广百前 32 × 4.7 m 的 5 层城楼基址。拱北楼始于唐天祐三年（906）“象阙”，明洪武七年定名，1918 年拆城筑路。",
        facts: [["基址", "32 × 4.7 m"], ["层位", "5 层"], ["滴漏", "2.64 m"]],
        detail: "铜壶滴漏通高 2.64 m，为中国现存最大、最完整的古代计时器之一；牌坊、十二生肖铜首与水池按现状示意。2019-04 拱北楼段公布为广东省文物保护单位。"
      },
      {
        id: "daxiong", craft: "daxiong", no: "04", name: "大佛寺 · 大雄宝殿",
        pos: new THREE.Vector3(-140, 12, 378),
        view: { pos: [-104, 12.5, 398], target: [-146, 10, 373] },
        lede: "康熙二年（1663）平南王尚可喜自捐王俸，仿京师官庙制式、兼具岭南风格重建。面宽七间 36.32 m、进深五间 25.36 m、高约 18 m。",
        facts: [["面宽", "36.32 m"], ["进深", "25.36 m"], ["高", "约 18 m"]],
        detail: "建筑面积约 1277 m²，为广东现存建筑面积最大的佛殿之一；殿内三尊黄铜大佛各高 6 m、重 10 t，场景以门洞内金身与背光示意。省级文保（另有市级口径）。"
      },
      {
        id: "pujue", craft: "pujue", no: "05", name: "普觉楼 · 金顶",
        pos: new THREE.Vector3(-140, 26, 308),
        view: { pos: [-84, 21, 396], target: [-140, 24, 312] },
        lede: "大佛寺佛教文化弘法大楼，地上 7 层、地下 2 层，2016 年底落成；黄铜瓦五重檐歇山，是北京路夜空里最亮的一座金顶。",
        facts: [["层数", "7F + 2B"], ["占地", "2354.1 m²"], ["亮灯", "19:00–21:30"]],
        detail: "总建筑面积 18834 m²；高度按 7 层 + 五重檐推算约 35–40 m（示意，非实测）。19:00–21:30 亮灯为游记口径，场景灯光为照明示意。"
      },
      {
        id: "huifu", craft: "huifu", no: "06", name: "惠福东路 · 美食花街",
        pos: new THREE.Vector3(-70, 4.8, 437),
        view: { pos: [-30, 2.6, 440], target: [-170, 8, 396] },
        lede: "清代“寺前街”，因大佛寺得名；东起北京路、西至起义路，全长 511 m、宽约 10 m。两侧榕荫，无连续骑楼，是北京路 16 m 骑楼街的断面反差。",
        facts: [["全长", "511 m"], ["路宽", "10 m"], ["餐饮", "120+ 家"]],
        detail: "美食花街 2010-11 开街，2022 年入选首批“广东省粤菜美食街”，约 120 家店、60+ 粤菜。场景只做东端约 120 m 核心段，其余压缩；招牌/外摆为示意。"
      },
      {
        id: "chenghuang", craft: "chenghuang", no: "07", name: "城隍庙 · 忠佑广场",
        pos: new THREE.Vector3(180, 6, -34),
        view: { pos: [180, 13, 8], target: [180, 3, -44] },
        lede: "明洪武三年（1370）始建，清代广州府城隍升格管辖全省。现存仅大殿与拜亭，占地约 500 m²，大殿净高约 12 m，拜亭为绿琉璃歇山顶。",
        facts: [["占地", "约 500 m²"], ["大殿", "净高 12 m"], ["始建", "1370"]],
        detail: "1920 年拆庙建忠佑大街，2009 年全面修缮、2010-10 免费开放；庙前忠佑广场是广府庙会场地。周围 6–10 层住宅/办公楼为体量示意，不做大寺庙式中轴。"
      }
    ];
  }

  /* ---------------- 静态合批 ---------------- */

  function mergeOpaqueMeshes() {
    root.updateMatrixWorld(true);
    var groups = {};
    root.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh || o.isSprite) return;
      if (!o.geometry || !o.material || o.material.transparent || Array.isArray(o.material)) return;
      if (!o.geometry.attributes || !o.geometry.attributes.position) return;
      if (o.isSkinnedMesh) return;
      var key = o.material.uuid;
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    Object.keys(groups).forEach(function (key) {
      var list = groups[key];
      if (list.length < 2) return;
      var mat = list[0].material;
      var positions = [], normals = [], uvs = [], indices = [], offset = 0;
      list.forEach(function (m) {
        var g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        var p = g.attributes.position;
        var n = g.attributes.normal;
        var uv = g.attributes.uv;
        var count = p.count;
        for (var i = 0; i < count; i++) {
          positions.push(p.getX(i), p.getY(i), p.getZ(i));
          normals.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
          uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        }
        if (g.index) {
          for (var j = 0; j < g.index.count; j++) indices.push(g.index.getX(j) + offset);
        } else {
          for (var k = 0; k < count; k++) indices.push(offset + k);
        }
        offset += count;
        g.dispose();
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeBoundingSphere();
      var merged = new THREE.Mesh(geo, mat);
      merged.castShadow = true;
      merged.receiveShadow = true;
      merged.name = "merged-" + key;
      root.add(merged);
      list.forEach(function (m) { if (m.parent) m.parent.remove(m); });
    });
    root.updateMatrixWorld(true);
  }

  function buildInstances() {
    // 矮柱：黑色不锈钢 + 反光带
    var bodyGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8);
    var body = new THREE.InstancedMesh(bodyGeo, materials.darkFrame, bollardPos.length);
    var bandGeo = new THREE.CylinderGeometry(0.066, 0.066, 0.07, 8);
    var band = new THREE.InstancedMesh(bandGeo, materials.steel, bollardPos.length);
    var baseGeo = new THREE.BoxGeometry(0.24, 0.12, 0.24);
    var base = new THREE.InstancedMesh(baseGeo, materials.metal, bollardPos.length);
    var dummy = new THREE.Object3D();
    bollardPos.forEach(function (p, i) {
      dummy.position.set(p[0], 0.62, p[1]);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0], 0.86, p[1]);
      dummy.updateMatrix();
      band.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0], 0.06, p[1]);
      dummy.updateMatrix();
      base.setMatrixAt(i, dummy.matrix);
    });
    body.castShadow = false; band.castShadow = false; base.castShadow = false;
    body.receiveShadow = true;
    root.add(body); root.add(band); root.add(base);
    counts.bollards = bollardPos.length;
    instanced.bollards = [body, band, base];

    // 灯笼
    var lgeo = new THREE.SphereGeometry(0.32, 7, 5);
    lgeo.scale(1, 1.18, 1);
    var lanterns = new THREE.InstancedMesh(lgeo, materials.lanternRed, lanternPos.length);
    var caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 8), materials.lanternGold, lanternPos.length);
    lanternPos.forEach(function (p, i) {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.set(p[3], p[3], p[3]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      lanterns.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0], p[1] + 0.36 * p[3], p[2]);
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
    });
    lanterns.frustumCulled = false;
    caps.frustumCulled = false;
    lanterns.castShadow = false;
    caps.castShadow = false;
    root.add(lanterns);
    root.add(caps);
    counts.lanterns = lanternPos.length;
    instanced.lanterns = [lanterns, caps];
  }

  function addGlowSprite(parent, x, y, z, scale, color, opacity) {
    var mat = new THREE.SpriteMaterial({
      map: textures.glow, color: color || 0xffc98a,
      transparent: true, opacity: opacity === undefined ? 0.5 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var s = new THREE.Sprite(mat);
    s.position.set(x, y, z);
    s.scale.set(scale, scale, 1);
    parent.add(s);
    return s;
  }

  /* ---------------- 组装 ---------------- */

  function build(opts) {
    textures = opts.textures;
    lowMode = !!opts.low;
    R = mulberry32(20261031);
    root = new THREE.Group();
    root.name = "beijinglu";
    materials = makeMaterials();

    buildGround();
    buildArcadeRow(1, 16, 211);
    buildArcadeRow(1, 229, 432);
    buildArcadeRow(-1, 16, 196);
    buildArcadeRow(-1, 232, 432);
    buildArcadeRow(1, -90, -16);
    buildArcadeRow(-1, -90, -48);
    buildAncientRoad();
    buildGongbei();
    buildLanterns([[6.4, 74], [-6.4, 60]]);
    buildTrees();
    buildStreetFurniture();
    buildPeople();
    buildVehicles();
    buildCrossing();
    buildDafo();
    buildChenghuang();
    buildHuifu();
    buildNanyue();
    buildBackdrop();
    buildInstances();

    // 夜景点光源：只给关键节点，其余靠自发光（桌面/移动 3 盏）
    var lightDefs = [
      [-140, 26, 338, 58, 1.5, true],
      [0, 3.0, 72, 30, 2.6, true],
      [180, 5, -34, 32, 1.4, true]
    ];
    var useLights = lightDefs;
    useLights.forEach(function (d) {
      var l = new THREE.PointLight(0xffb36b, 0, d[3], 2);
      l.position.set(d[0], d[1], d[2]);
      l.userData.nightIntensity = d[4];
      root.add(l);
      lanternLights.push(l);
    });

    buildHotspots();
    mergeOpaqueMeshes();

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      nightMats: nightMats,
      lanternLights: lanternLights,
      led: led,
      fountain: fountain,
      instanced: instanced,
      counts: counts,
      animated: {
        ledScreen: led,
        fountain: fountain,
        lanternGlow: materials.lanternRed
      },
      bounds: new THREE.Box3(new THREE.Vector3(-320, -4, -160), new THREE.Vector3(320, 60, 560))
    };
  }

  window.BeijingluModel = { build: build };
})();
