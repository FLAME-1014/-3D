/* 中山纪念堂近景 · 1:1 主体建模
   坐标：1 单位 = 1 米；广场 y=0；+Z 南（门楼/东风中路），-Z 北（越秀山方向）。
   依据：公开资料与实景照片做示意复原；北侧山体/中轴为低权重示意，不做测绘级。 */
(function () {
  "use strict";

  var root = null;
  var textures = null;
  var materials = null;
  var hotspots = [];
  var lampLights = [];
  var glowMats = [];
  var windowMats = [];
  var low = false;

  var GATE_Z = 120;
  var HALL_Z = -30;
  var PLATFORM_Y = 1.6;
  var HALL_R = 23.5;
  var HALL_FACE = HALL_R * Math.cos(Math.PI / 8);

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function sstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  /* ---------------- 基础几何 ---------------- */

  function addBox(parent, w, h, d, mat, x, y, z, ry) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addCyl(parent, rt, rb, h, seg, mat, x, y, z) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addOct(parent, r, h, mat, y, ry) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8, 1, false), mat);
    mesh.position.set(0, y, 0);
    mesh.rotation.y = ry == null ? Math.PI / 8 : ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addBeam(parent, ax, ay, az, bx, by, bz, radius, mat, seg) {
    var a = new THREE.Vector3(ax, ay, az);
    var b = new THREE.Vector3(bx, by, bz);
    var dir = b.clone().sub(a);
    var len = dir.length();
    if (len < 0.001) return null;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, seg || 5), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addPlane(parent, w, h, mat, x, y, z, rx, ry) {
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    if (rx) mesh.rotation.x = rx;
    if (ry) mesh.rotation.y = ry;
    parent.add(mesh);
    return mesh;
  }

  /* ---------------- 材质 ---------------- */

  function makeMaterials() {
    var m = {};
    m.granite = new THREE.MeshStandardMaterial({ map: textures.granite, roughness: 0.9, metalness: 0.02, color: 0xffffff });
    m.graniteLight = new THREE.MeshStandardMaterial({ map: textures.graniteLight, roughness: 0.86, metalness: 0.02, color: 0xffffff });
    m.paving = new THREE.MeshStandardMaterial({ map: textures.paving, roughness: 0.92, metalness: 0.02, color: 0xffffff });
    m.grass = new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 1, metalness: 0, color: 0xffffff });
    m.ochre = new THREE.MeshStandardMaterial({ map: textures.ochreWall, roughness: 0.92, metalness: 0.01, color: 0xffffff });
    m.brick = new THREE.MeshStandardMaterial({ map: textures.brick, roughness: 0.94, metalness: 0.01, color: 0xffffff });
    m.blueTile = new THREE.MeshStandardMaterial({ map: textures.blueTile, roughness: 0.52, metalness: 0.12, color: 0xffffff });
    m.blueDark = new THREE.MeshStandardMaterial({ color: 0x13253d, roughness: 0.5, metalness: 0.12 });
    m.eaveTile = new THREE.MeshStandardMaterial({ color: 0x2a4055, roughness: 0.62, metalness: 0.1 });
    m.soffit = new THREE.MeshStandardMaterial({ color: 0x1b3034, roughness: 0.86, metalness: 0.05 });
    m.red = new THREE.MeshStandardMaterial({ map: textures.redLacquer, roughness: 0.6, metalness: 0.04, color: 0xffffff });
    m.redDark = new THREE.MeshStandardMaterial({ color: 0x5b211d, roughness: 0.65, metalness: 0.04 });
    m.painted = new THREE.MeshStandardMaterial({ map: textures.paintedBeam, roughness: 0.74, metalness: 0.02, color: 0xffffff });
    m.gold = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.34, metalness: 0.68 });
    m.bronze = new THREE.MeshStandardMaterial({ color: 0x352b22, roughness: 0.5, metalness: 0.32 });
    m.bronzeLight = new THREE.MeshStandardMaterial({ color: 0x4c3b2b, roughness: 0.46, metalness: 0.36 });
    m.bronzeDark = new THREE.MeshStandardMaterial({ color: 0x17110d, roughness: 0.62, metalness: 0.28 });
    m.bronzeCoat = new THREE.MeshStandardMaterial({ color: 0x2b231c, roughness: 0.56, metalness: 0.3, side: THREE.DoubleSide, flatShading: true });
    m.iron = new THREE.MeshStandardMaterial({ color: 0x2b3235, roughness: 0.5, metalness: 0.45 });
    m.dark = new THREE.MeshStandardMaterial({ color: 0x1a2328, roughness: 0.6, metalness: 0.15 });
    m.glass = new THREE.MeshStandardMaterial({ color: 0x2b3b46, roughness: 0.22, metalness: 0.28, emissive: 0xffb66a, emissiveIntensity: 0 });
    m.window = new THREE.MeshStandardMaterial({
      map: textures.window, emissive: 0xffb66a, emissiveMap: textures.window,
      emissiveIntensity: 0, roughness: 0.78, metalness: 0.0
    });
    m.door = new THREE.MeshStandardMaterial({ map: textures.door, roughness: 0.72, metalness: 0.05 });
    m.gateBars = new THREE.MeshStandardMaterial({
      map: textures.gateBars, transparent: true, alphaTest: 0.35,
      side: THREE.DoubleSide, roughness: 0.56, metalness: 0.3
    });
    m.gatePanel = new THREE.MeshStandardMaterial({ color: 0x4a1f1c, transparent: true, opacity: 0.62, roughness: 0.72, metalness: 0.05 });
    m.waterDark = new THREE.MeshStandardMaterial({ color: 0x243138, roughness: 0.4, metalness: 0.2 });
    m.trunk = new THREE.MeshStandardMaterial({ map: textures.trunk, roughness: 1, metalness: 0, color: 0xffffff });
    m.leaf = new THREE.MeshStandardMaterial({ map: textures.leaf, roughness: 1, metalness: 0, color: 0xffffff, flatShading: true });
    m.leafDark = new THREE.MeshStandardMaterial({ map: textures.leafDark, roughness: 1, metalness: 0, color: 0xffffff, flatShading: true });
    m.leafLight = new THREE.MeshStandardMaterial({ color: 0x5f7e4b, roughness: 1, metalness: 0, flatShading: true });
    m.flowerRed = new THREE.MeshStandardMaterial({ color: 0xd23a2a, roughness: 0.8, metalness: 0, emissive: 0x250402, emissiveIntensity: 0.15 });
    m.flowerWhite = new THREE.MeshStandardMaterial({ color: 0xf2eee0, roughness: 0.82, metalness: 0 });
    m.asphalt = new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: 0.96, metalness: 0.02, color: 0xffffff });
    m.city = new THREE.MeshStandardMaterial({ map: textures.cityWindow, roughness: 0.8, metalness: 0.04, color: 0xffffff });
    m.fence = new THREE.MeshStandardMaterial({ map: textures.fence, transparent: true, alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.35, color: 0xffffff });
    m.soil = new THREE.MeshStandardMaterial({ color: 0x4b3a28, roughness: 1 });
    windowMats.push(m.glass);
    windowMats.push(m.window);
    return m;
  }

  /* ---------------- 屋顶 ---------------- */

  function dressHipRoof(g, W, D, L, h) {
    var i, t, n;
    var dummy = new THREE.Object3D();
    var detailRadius = Math.sqrt(W * W + D * D) * 0.55 + h;

    var fasciaGeo = new THREE.BoxGeometry(1, 1, 1);
    fasciaGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), detailRadius);
    var fascia = new THREE.InstancedMesh(fasciaGeo, materials.blueDark, 4);
    var fasciaBoxes = [
      [W + 0.3, 0.26, 0.2, 0, -0.11, D / 2 + 0.02],
      [W + 0.3, 0.26, 0.2, 0, -0.11, -D / 2 - 0.02],
      [0.2, 0.26, D + 0.3, W / 2 + 0.02, -0.11, 0],
      [0.2, 0.26, D + 0.3, -W / 2 - 0.02, -0.11, 0]
    ];
    for (i = 0; i < fasciaBoxes.length; i++) {
      var fb = fasciaBoxes[i];
      dummy.position.set(fb[3], fb[4], fb[5]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(fb[0], fb[1], fb[2]);
      dummy.updateMatrix();
      fascia.setMatrixAt(i, dummy.matrix);
    }
    fascia.instanceMatrix.needsUpdate = true;
    g.add(fascia);

    var endMats = [];
    var pushEnd = function (x, y, z, axis) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(axis === "z" ? Math.PI / 2 : 0, 0, axis === "x" ? Math.PI / 2 : 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      endMats.push(dummy.matrix.clone());
    };
    n = Math.max(6, Math.round(W / 0.9));
    for (i = 0; i <= n; i++) {
      var ex = -W / 2 + (W * i) / n;
      pushEnd(ex, -0.055, D / 2 + 0.055, "z");
      pushEnd(ex, -0.055, -D / 2 - 0.055, "z");
    }
    n = Math.max(5, Math.round(D / 0.9));
    for (i = 0; i <= n; i++) {
      var ez = -D / 2 + (D * i) / n;
      pushEnd(W / 2 + 0.055, -0.055, ez, "x");
      pushEnd(-W / 2 - 0.055, -0.055, ez, "x");
    }
    var endsGeo = new THREE.CylinderGeometry(0.07, 0.085, 0.14, 5);
    endsGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), detailRadius);
    var ends = new THREE.InstancedMesh(endsGeo, materials.eaveTile, endMats.length);
    for (i = 0; i < endMats.length; i++) ends.setMatrixAt(i, endMats[i]);
    ends.instanceMatrix.needsUpdate = true;
    g.add(ends);

    var rafterMats = [];
    var pushRafter = function (x, y, z, ry) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry || 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      rafterMats.push(dummy.matrix.clone());
    };
    n = Math.max(6, Math.round(W / 1.7));
    for (i = 0; i <= n; i++) {
      var rx = -W / 2 + 0.6 + ((W - 1.2) * i) / n;
      pushRafter(rx, -0.19, D / 2 - 0.38, 0);
      pushRafter(rx, -0.19, -D / 2 + 0.38, 0);
    }
    n = Math.max(5, Math.round(D / 1.7));
    for (i = 0; i <= n; i++) {
      var rz = -D / 2 + 0.6 + ((D - 1.2) * i) / n;
      pushRafter(W / 2 - 0.38, -0.19, rz, Math.PI / 2);
      pushRafter(-W / 2 + 0.38, -0.19, rz, Math.PI / 2);
    }
    var rafterGeo = new THREE.BoxGeometry(0.09, 0.12, 0.95);
    rafterGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), detailRadius);
    var rafters = new THREE.InstancedMesh(rafterGeo, materials.blueDark, rafterMats.length);
    for (i = 0; i < rafterMats.length; i++) rafters.setMatrixAt(i, rafterMats[i]);
    rafters.instanceMatrix.needsUpdate = true;
    g.add(rafters);

    var slopeMats = [];
    var axisZ = new THREE.Vector3(0, 0, 1);
    var pushSlope = function (a, b) {
      var dir = b.clone().sub(a);
      var len = dir.length();
      if (len < 0.1) return;
      var mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 0.04;
      var q = new THREE.Quaternion().setFromUnitVectors(axisZ, dir.normalize());
      slopeMats.push(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, len)));
    };
    n = Math.max(8, Math.round(W / 1.6));
    for (i = 0; i <= n; i++) {
      t = i / n;
      var bx = -W / 2 + t * W;
      var tx = -L / 2 + t * L;
      pushSlope(new THREE.Vector3(bx, 0.1, D / 2 - 0.08), new THREE.Vector3(tx, h - 0.15, 0.08));
      pushSlope(new THREE.Vector3(bx, 0.1, -D / 2 + 0.08), new THREE.Vector3(tx, h - 0.15, -0.08));
    }
    n = Math.max(6, Math.round(D / 1.6));
    for (i = 0; i <= n; i++) {
      t = i / n;
      var bz = -D / 2 + t * D;
      pushSlope(new THREE.Vector3(W / 2 - 0.08, 0.1, bz), new THREE.Vector3(L / 2 - 0.08, h - 0.15, 0));
      pushSlope(new THREE.Vector3(-W / 2 + 0.08, 0.1, bz), new THREE.Vector3(-L / 2 + 0.08, h - 0.15, 0));
    }
    var slopeGeo = new THREE.BoxGeometry(0.07, 0.05, 1);
    slopeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), detailRadius);
    var slopes = new THREE.InstancedMesh(slopeGeo, materials.blueDark, slopeMats.length);
    for (i = 0; i < slopeMats.length; i++) slopes.setMatrixAt(i, slopeMats[i]);
    slopes.instanceMatrix.needsUpdate = true;
    g.add(slopes);
  }

  function makeHipRoof(w, d, h, overhang, roofMat, dress) {
    var W = w + overhang * 2;
    var D = d + overhang * 2;
    var L = Math.max(0.6, W - D);
    var roofMaterial = roofMat || materials.blueTile;
    var positions = [];
    var uvs = [];

    function tri(a, b, c) {
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      var uv = function (p) { return [(p[0] + W / 2) / 7, (p[2] + D / 2) / 7]; };
      var ua = uv(a), ub = uv(b), uc = uv(c);
      uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    }

    var bl = [-W / 2, 0, D / 2];
    var br = [W / 2, 0, D / 2];
    var fr = [W / 2, 0, -D / 2];
    var fl = [-W / 2, 0, -D / 2];
    var rl = [-L / 2, h, 0];
    var rr = [L / 2, h, 0];

    tri(bl, br, rr);
    tri(bl, rr, rl);
    tri(fr, fl, rl);
    tri(fr, rl, rr);
    tri(br, fr, rr);
    tri(fl, bl, rl);

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    var g = new THREE.Group();
    var roof = new THREE.Mesh(geo, roofMaterial);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);

    addBeam(g, -L / 2, h + 0.12, 0, L / 2, h + 0.12, 0, 0.16, materials.blueDark, 6);

    [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(function (c) {
      if (c[1] < 0) return;
      var bell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), materials.gold);
      bell.position.set(c[0] * (W / 2 + 0.05), 0.24, c[1] * (D / 2 + 0.05));
      g.add(bell);
    });

    if (dress === true) dressHipRoof(g, W, D, L, h);
    return g;
  }

  function makeOctagonRoof(baseY) {
    var g = new THREE.Group();
    g.position.y = baseY;

    var cone = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 27, 15.5, 8, 1, true), materials.blueTile);
    cone.position.y = 7.75;
    cone.rotation.y = Math.PI / 8;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);

    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(26, 29.2, 2.6, 8, 1, true), materials.blueTile);
    skirt.position.y = 1.3;
    skirt.rotation.y = Math.PI / 8;
    skirt.castShadow = true;
    g.add(skirt);

    var mid = new THREE.Mesh(new THREE.CylinderGeometry(17.8, 21.2, 2.0, 8, 1, true), materials.blueTile);
    mid.position.y = 7.4;
    mid.rotation.y = Math.PI / 8;
    mid.castShadow = true;
    g.add(mid);

    var ring = new THREE.Mesh(new THREE.CylinderGeometry(29.3, 29.3, 0.32, 8, 1, true), materials.blueDark);
    ring.position.y = 0.16;
    ring.rotation.y = Math.PI / 8;
    g.add(ring);
    addOct(g, 27.2, 0.18, materials.soffit, 0.08);
    addOct(g, 21.2, 0.16, materials.soffit, 7.3);

    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      addBeam(g, Math.sin(a) * 26.7, 0.25, Math.cos(a) * 26.7, 0, 15.5, 0, 0.13, materials.blueDark, 5);
      var bell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), materials.gold);
      bell.position.set(Math.sin(a) * 29.8, 0.25, Math.cos(a) * 29.8);
      g.add(bell);
    }

    var lotus = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.8, 0.7, 12), materials.gold);
    lotus.position.y = 15.95;
    g.add(lotus);
    var ball = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), materials.gold);
    ball.position.y = 17.2;
    g.add(ball);
    var spire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.6, 3.2, 8), materials.gold);
    spire.position.y = 19.0;
    g.add(spire);
    var pearl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), materials.gold);
    pearl.position.y = 20.7;
    g.add(pearl);

    return g;
  }

  /* ---------------- 场地 ---------------- */

  function buildGround() {
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 430), materials.paving);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 10);
    ground.receiveShadow = true;
    root.add(ground);

    var outer = new THREE.Mesh(new THREE.PlaneGeometry(460, 260), new THREE.MeshStandardMaterial({ color: 0x59615c, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(0, -0.05, 210);
    root.add(outer);
  }

  function buildStreet() {
    var asphalt = new THREE.Mesh(new THREE.PlaneGeometry(300, 14), materials.asphalt);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0.025, 138);
    asphalt.receiveShadow = true;
    root.add(asphalt);

    var sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(300, 7), materials.paving);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(0, 0.045, 127.5);
    sidewalk.receiveShadow = true;
    root.add(sidewalk);

    addBox(root, 300, 0.24, 0.45, materials.granite, 0, 0.12, 131.3);
    addBox(root, 300, 0.24, 0.45, materials.granite, 0, 0.12, 144.7);

    for (var i = 0; i < 18; i++) {
      addBox(root, 3.4, 0.02, 0.28, materials.graniteLight, -126 + i * 14, 0.03, 138);
    }

    [-110, -78, -46, 46, 78, 110].forEach(function (x) {
      addBox(root, 3.6, 0.3, 3.6, materials.soil, x, 0.15, 127.5);
      makeSimpleTree(x, 127.5, 0, 9, 4.5, false, false);
    });

    [-112, -76, -40, 40, 76, 112].forEach(function (x, i) {
      var h = 13 + ((i * 7) % 13);
      var g = new THREE.Group();
      g.position.set(x, 0, 169);
      addBox(g, 26, h, 20, materials.city, 0, h / 2, 0);
      addBox(g, 27, 1.0, 21, materials.dark, 0, h + 0.5, 0);
      addBox(g, 20, h * 0.35, 1.0, materials.graniteLight, 0, h * 0.62, 10.2);
      root.add(g);
    });
  }

  function buildFence() {
    var southL = new THREE.Mesh(new THREE.PlaneGeometry(103, 2.3), materials.fence);
    southL.position.set(-68.5, 1.15, GATE_Z);
    root.add(southL);
    var southR = new THREE.Mesh(new THREE.PlaneGeometry(103, 2.3), materials.fence);
    southR.position.set(68.5, 1.15, GATE_Z);
    root.add(southR);

    var west = new THREE.Mesh(new THREE.PlaneGeometry(210, 2.3), materials.fence);
    west.position.set(-120, 1.15, 15);
    west.rotation.y = Math.PI / 2;
    root.add(west);
    var east = new THREE.Mesh(new THREE.PlaneGeometry(210, 2.3), materials.fence);
    east.position.set(120, 1.15, 15);
    east.rotation.y = Math.PI / 2;
    root.add(east);

    [-120, -100, -80, -60, -40, -20, 20, 40, 60, 80, 100, 120].forEach(function (x) {
      addBox(root, 0.6, 2.8, 0.6, materials.granite, x, 1.4, GATE_Z);
    });
    addBox(root, 240, 0.35, 0.4, materials.granite, 0, 0.18, GATE_Z);
  }

  function buildLawn() {
    [-1, 1].forEach(function (side) {
      var lawn = new THREE.Mesh(new THREE.PlaneGeometry(56, 52), materials.grass);
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(side * 34, 0.07, 86);
      lawn.receiveShadow = true;
      root.add(lawn);

      addBox(root, 56.6, 0.22, 0.35, materials.granite, side * 34, 0.11, 112);
      addBox(root, 56.6, 0.22, 0.35, materials.granite, side * 34, 0.11, 60);
      addBox(root, 0.35, 0.22, 52.4, materials.granite, side * 62, 0.11, 86);
      addBox(root, 0.35, 0.22, 52.4, materials.granite, side * 6, 0.11, 86);

      for (var i = 0; i < 3; i++) {
        addBox(root, 0.7, 0.8, 8.5, materials.leafDark, side * 61, 0.42, 68 + i * 14);
      }
    });

    var path = new THREE.Mesh(new THREE.PlaneGeometry(12, 88), materials.paving);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.06, 74);
    path.receiveShadow = true;
    root.add(path);

    var plaza = new THREE.Mesh(new THREE.PlaneGeometry(120, 32), materials.paving);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.055, 44);
    plaza.receiveShadow = true;
    root.add(plaza);

    [-1, 1].forEach(function (side) {
      var bed = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), materials.soil);
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(side * 18, 0.08, 69);
      root.add(bed);
      for (var i = 0; i < 22; i++) {
        var flower = new THREE.Mesh(new THREE.SphereGeometry(0.26, 5, 4), i % 3 === 0 ? materials.flowerWhite : materials.flowerRed);
        flower.position.set(side * 18 + (Math.random() - 0.5) * 8, 0.3, 69 + (Math.random() - 0.5) * 4);
        root.add(flower);
      }
    });

    [-8, 8].forEach(function (x) {
      [68, 102].forEach(function (z) {
        addCyl(root, 0.09, 0.13, 3.4, 6, materials.iron, x, 1.7, z);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.25 }));
        bulb.position.set(x, 3.5, z);
        root.add(bulb);
        glowMats.push(bulb.material);
        var light = new THREE.PointLight(0xffc786, 0, 16, 2);
        light.position.set(x, 3.4, z);
        root.add(light);
        lampLights.push(light);
      });
    });
  }

  /* ---------------- 门楼 ---------------- */

  function archShape(w, h, r) {
    var s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h - r);
    s.absarc(0, h - r, r, 0, Math.PI, false);
    s.lineTo(-w / 2, 0);
    return s;
  }

  function addArch(parent, x, w, h, r) {
    var shape = archShape(w, h, r);
    var geo = new THREE.ShapeGeometry(shape, 20);
    var mesh = new THREE.Mesh(geo, materials.dark);
    mesh.position.set(x, 0.6, 4.02);
    parent.add(mesh);

    var surround = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 7, 24, Math.PI), materials.graniteLight);
    surround.position.set(x, 0.6 + h - r, 4.1);
    parent.add(surround);
    [-1, 1].forEach(function (side) {
      addBox(parent, 0.55, h - r, 0.65, materials.graniteLight, x + side * r, 0.6 + (h - r) / 2, 4.1);
    });

    var bars = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, h - r - 0.4), materials.gateBars);
    bars.position.set(x, 0.6 + (h - r) / 2, 4.2);
    parent.add(bars);
    var panel = new THREE.Mesh(new THREE.ShapeGeometry(shape, 20), materials.gatePanel);
    panel.position.set(x, 0.6, 4.06);
    parent.add(panel);
  }

  function buildGate() {
    var g = new THREE.Group();
    g.position.set(0, 0, GATE_Z);

    addBox(g, 35, 0.6, 9, materials.granite, 0, 0.3, 0);
    addBox(g, 35, 0.35, 8.4, materials.graniteLight, 0, 0.62, 0);

    [-14.9, -5.7, 5.7, 14.9].forEach(function (x, i) {
      var w = i === 0 || i === 3 ? 4.2 : 3.0;
      addBox(g, w, 9.0, 8, materials.brick, x, 4.5, 0);
    });
    addBox(g, 34, 1.55, 8, materials.brick, 0, 9.78, 0);
    addBox(g, 35.2, 0.42, 9.2, materials.granite, 0, 10.75, 0);

    addArch(g, 0, 8.4, 9.0, 4.2);
    addArch(g, -10, 5.6, 7.2, 2.8);
    addArch(g, 10, 5.6, 7.2, 2.8);

    var centralRoof = makeHipRoof(14, 10, 5.4, 1.1);
    centralRoof.position.set(0, 10.75, 0);
    g.add(centralRoof);
    addBox(g, 15.2, 0.16, 10.8, materials.soffit, 0, 10.65, 0);
    addBox(g, 0.4, 0.4, 0.4, materials.gold, 0, 16.35, 0);
    [-12.8, 12.8].forEach(function (x) {
      var sideRoof = makeHipRoof(9, 9, 2.8, 1.0);
      sideRoof.position.set(x, 10.35, 0);
      g.add(sideRoof);
      addBox(g, 10, 0.16, 9.6, materials.soffit, x, 10.25, 0);
    });

    addBox(g, 34, 0.95, 0.45, materials.painted, 0, 10.35, 4.15);
    addBox(g, 34, 0.95, 0.45, materials.painted, 0, 10.35, -4.15);

    addBox(g, 6.4, 1.7, 0.24, materials.redDark, 0, 9.85, 4.28);
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.45), new THREE.MeshBasicMaterial({
      map: window.MemorialTextures.makePlaque("中山纪念堂", 768, 184), transparent: true
    }));
    plaque.position.set(0, 9.85, 4.55);
    g.add(plaque);

    addBox(g, 8, 0.28, 3.2, materials.graniteLight, 0, 0.3, 5.7);
    addBox(g, 8, 0.28, 1.2, materials.graniteLight, 0, 0.16, 6.5);

    root.add(g);
  }

  /* ---------------- 云鹤华表 ---------------- */

  function buildHuabiao(x) {
    var g = new THREE.Group();
    g.position.set(x, 0, 85);
    addOct(g, 2.5, 1.0, materials.granite, 0.5);
    addOct(g, 2.0, 0.7, materials.graniteLight, 1.35);
    addBox(g, 1.1, 8.8, 1.1, materials.graniteLight, 0, 6.1, 0);
    [2.0, 4.0, 6.0, 8.0].forEach(function (y) {
      addBox(g, 1.45, 0.18, 1.45, materials.granite, 0, y, 0);
    });
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.78, 10, 8), materials.graniteLight);
    head.position.y = 10.9;
    head.scale.set(1.0, 0.85, 1.0);
    g.add(head);
    var cloud = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 0.8), materials.graniteLight);
    cloud.position.y = 11.55;
    cloud.rotation.z = 0.12;
    g.add(cloud);
    var crane = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 5), materials.graniteLight);
    crane.position.y = 12.25;
    crane.rotation.z = -0.22;
    g.add(crane);

    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      addBox(g, 0.16, 0.9, 0.16, materials.red, Math.sin(a) * 3.2, 0.45, Math.cos(a) * 3.2);
    }
    for (var j = 0; j < 8; j++) {
      var a1 = j * Math.PI / 4;
      var a2 = (j + 1) * Math.PI / 4;
      addBeam(g, Math.sin(a1) * 3.2, 0.86, Math.cos(a1) * 3.2, Math.sin(a2) * 3.2, 0.86, Math.cos(a2) * 3.2, 0.09, materials.red, 4);
    }
    root.add(g);
  }

  /* ---------------- 孙中山铜像 ---------------- */

  function buildStatue() {
    var z = 50;
    var g = new THREE.Group();
    g.position.set(0, 0, z);

    addBox(g, 8.2, 0.5, 8.2, materials.granite, 0, 0.25, 0);
    addBox(g, 6.8, 0.5, 6.8, materials.graniteLight, 0, 0.75, 0);
    addBox(g, 5.2, 0.35, 5.2, materials.granite, 0, 1.17, 0);
    addBox(g, 4.0, 4.8, 4.0, materials.graniteLight, 0, 3.75, 0);
    addBox(g, 4.7, 0.35, 4.7, materials.granite, 0, 6.32, 0);

    addBox(g, 2.6, 3.3, 0.08, materials.granite, 0, 3.9, 2.18);
    var inscription = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.95), new THREE.MeshBasicMaterial({
      map: window.MemorialTextures.makeInscription(), transparent: false
    }));
    inscription.position.set(0, 3.9, 2.23);
    g.add(inscription);

    for (var i = 0; i < 4; i++) {
      var sx = i < 2 ? -1 : 1;
      var sz = i % 2 === 0 ? -1 : 1;
      addBox(g, 0.22, 0.85, 0.22, materials.graniteLight, sx * 4.0, 0.42, sz * 4.0);
      addBeam(g, sx * 4.0, 0.82, sz * 4.0, sx * 4.0, 0.82, sz * 0.6, 0.08, materials.graniteLight, 4);
    }

    addBox(g, 3.6, 0.14, 3.6, materials.graniteLight, 0, 6.49, 0);

    var s = new THREE.Group();
    s.position.set(0, 6.55, 0);

    [-1, 1].forEach(function (side) {
      addBox(s, 0.38, 0.2, 0.68, materials.bronzeDark, side * 0.3, 0.1, 0.17);
      addBox(s, 0.34, 0.06, 0.14, materials.bronze, side * 0.3, 0.26, 0.44);
    });

    [-1, 1].forEach(function (side) {
      var lx = side * 0.3;
      var lz = side < 0 ? 0.1 : -0.06;
      addCyl(s, 0.16, 0.13, 1.2, 7, materials.bronzeDark, lx, 1.85, lz);
      addCyl(s, 0.12, 0.09, 1.05, 7, materials.bronzeDark, lx, 0.72, lz + 0.03);
      var knee = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), materials.bronzeDark);
      knee.position.set(lx, 1.25, lz);
      s.add(knee);
    });

    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 1.85, 12, 1, true, 0.55, Math.PI * 2 - 1.1), materials.bronzeCoat);
    skirt.position.set(0, 1.93, 0);
    skirt.scale.z = 0.62;
    skirt.castShadow = true;
    s.add(skirt);
    var hem = new THREE.Mesh(new THREE.CylinderGeometry(1.29, 1.32, 0.12, 12, 1, true, 0.55, Math.PI * 2 - 1.1), materials.bronzeDark);
    hem.position.set(0, 1.03, 0);
    hem.scale.z = 0.62;
    s.add(hem);
    addBeam(s, -0.42, 2.84, 0.43, -0.68, 1.02, 0.70, 0.035, materials.bronzeLight, 4);
    addBeam(s, 0.42, 2.84, 0.43, 0.68, 1.02, 0.70, 0.035, materials.bronzeLight, 4);
    addBox(s, 0.07, 0.9, 0.04, materials.bronzeDark, 0, 1.5, -0.82);

    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.78, 1.4, 8), materials.bronze);
    torso.position.set(0, 3.5, 0);
    torso.scale.z = 0.6;
    torso.castShadow = true;
    s.add(torso);
    addBox(s, 1.88, 0.2, 0.82, materials.bronze, 0, 4.14, 0);
    [-1, 1].forEach(function (side) {
      var shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), materials.bronze);
      shoulder.position.set(side * 0.9, 4.08, 0);
      shoulder.scale.set(1.15, 0.72, 0.9);
      s.add(shoulder);
    });

    var shirtShape = new THREE.Shape();
    shirtShape.moveTo(-0.26, 0.42);
    shirtShape.lineTo(0.26, 0.42);
    shirtShape.lineTo(0, -0.32);
    shirtShape.closePath();
    var shirt = new THREE.Mesh(new THREE.ShapeGeometry(shirtShape), materials.bronzeLight);
    shirt.position.set(0, 3.78, 0.575);
    s.add(shirt);
    [-1, 1].forEach(function (side) {
      var lapel = addBox(s, 0.16, 0.92, 0.055, materials.bronzeLight, side * 0.27, 3.68, 0.575);
      lapel.rotation.z = side * -0.2;
    });
    addBox(s, 0.09, 0.48, 0.04, materials.bronzeDark, 0, 3.66, 0.61);
    [3.34, 3.08, 2.82].forEach(function (by) {
      var btn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), materials.bronzeDark);
      btn.position.set(0.16, by, 0.53);
      s.add(btn);
    });
    addBox(s, 0.58, 0.13, 0.38, materials.bronzeDark, 0, 4.32, 0.02);

    addCyl(s, 0.15, 0.17, 0.42, 8, materials.bronze, 0, 4.48, 0);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), materials.bronze);
    head.position.set(0, 5.09, 0.02);
    head.scale.set(0.88, 1.03, 0.92);
    s.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.405, 10, 8), materials.bronzeDark);
    hair.position.set(0, 5.16, -0.03);
    hair.scale.set(0.94, 0.86, 0.96);
    s.add(hair);
    [-1, 1].forEach(function (side) {
      var ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), materials.bronze);
      ear.position.set(side * 0.36, 5.06, 0.03);
      s.add(ear);
    });

    addBeam(s, -0.88, 4.06, 0.02, -1.14, 3.38, 0.12, 0.16, materials.bronze, 6);
    addBeam(s, -1.14, 3.38, 0.12, -1.06, 2.88, 0.3, 0.13, materials.bronze, 6);
    var elbowR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), materials.bronze);
    elbowR.position.set(-1.14, 3.38, 0.12);
    s.add(elbowR);
    addBeam(s, 0.88, 4.06, 0.02, 1.22, 3.42, 0.08, 0.16, materials.bronze, 6);
    addBeam(s, 1.22, 3.42, 0.08, 0.66, 3.03, 0.52, 0.13, materials.bronze, 6);
    var elbowL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), materials.bronze);
    elbowL.position.set(1.22, 3.42, 0.08);
    s.add(elbowL);

    var handR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.16), materials.bronzeLight);
    handR.position.set(-1.06, 2.78, 0.4);
    handR.rotation.z = -0.12;
    s.add(handR);
    var handL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.17), materials.bronzeLight);
    handL.position.set(0.63, 3.0, 0.56);
    handL.rotation.z = 0.2;
    s.add(handL);

    addCyl(s, 0.06, 0.06, 2.78, 6, materials.bronzeDark, -1.06, 1.45, 0.4);
    addBeam(s, -1.06, 2.84, 0.28, -1.06, 2.84, 0.54, 0.055, materials.bronzeDark, 5);
    addBeam(s, -1.06, 2.84, 0.54, -1.0, 2.76, 0.59, 0.05, materials.bronzeDark, 5);

    g.add(s);

    [-4.6, 4.6].forEach(function (x) {
      var shrub = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 6), materials.leafDark);
      shrub.position.set(x, 1.1, 1.0);
      g.add(shrub);
    });

    root.add(g);
  }

  /* ---------------- 平台 ---------------- */

  function buildPlatform() {
    addBox(root, 104, PLATFORM_Y, 120, materials.granite, 0, PLATFORM_Y / 2, HALL_Z);
    addBox(root, 103.2, 0.08, 119.2, materials.paving, 0, PLATFORM_Y + 0.04, HALL_Z);

    for (var i = 0; i < 5; i++) {
      var y = PLATFORM_Y - i * 0.32 - 0.16;
      addBox(root, 30, 0.32, 1.2, materials.graniteLight, 0, y, 30 + i * 1.2 + 0.6);
    }
    [-16, 16].forEach(function (x) {
      addBox(root, 0.8, 1.0, 6.0, materials.granite, x, 0.9, 32.4);
    });

    [-1, 1].forEach(function (side) {
      for (var j = 0; j < 4; j++) {
        addBox(root, 1.2, 0.32, 14, materials.graniteLight, side * (52 + j * 1.2 + 0.6), PLATFORM_Y - j * 0.32 - 0.16, HALL_Z);
      }
      addBox(root, 0.5, 0.48, 118, materials.graniteLight, side * 51.7, PLATFORM_Y + 0.24, HALL_Z);
      addBox(root, 30, 0.48, 0.5, materials.graniteLight, side * 36, PLATFORM_Y + 0.24, 29.7);
    });
    addBox(root, 104, 0.48, 0.5, materials.graniteLight, 0, PLATFORM_Y + 0.24, -89.7);
  }

  /* ---------------- 主体 ---------------- */

  function buildPorch(width, depth, south) {
    var p = new THREE.Group();
    var back = 0.3;

    addBox(p, width, 0.5, depth, materials.graniteLight, 0, 0.35, depth / 2);
    addBox(p, width, 0.7, 0.7, materials.ochre, 0, 5.8, back);
    addBox(p, width, 9.3, 0.55, materials.ochre, 0, 5.25, back);
    [-1, 1].forEach(function (side) {
      addBox(p, 0.55, 1.1, depth, materials.graniteLight, side * (width / 2 - 0.35), 0.85, depth / 2);
    });

    var doorW = Math.min(4.2, (width - 4) / 5);
    for (var i = 0; i < 5; i++) {
      var x = -width / 2 + 2.2 + i * (width - 4.4) / 4;
      var door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, 6.6), materials.door);
      door.position.set(x, 3.75, back + 0.5);
      p.add(door);
    }

    var colCount = south ? 8 : 6;
    for (var c = 0; c < colCount; c++) {
      var cx = -width / 2 + 1.6 + c * (width - 3.2) / (colCount - 1);
      addBox(p, 1.3, 0.55, 1.3, materials.graniteLight, cx, 0.75, depth - 0.7);
      addCyl(p, 0.5, 0.56, 10.6, 12, materials.red, cx, 6.0, depth - 0.7);
      addBox(p, 1.25, 0.32, 1.25, materials.gold, cx, 11.3, depth - 0.7);
    }

    addBox(p, width, 1.35, 0.55, materials.painted, 0, 11.55, depth - 0.45);
    addBox(p, 0.55, 1.35, depth - 0.8, materials.painted, -width / 2 + 0.3, 11.55, depth / 2);
    addBox(p, 0.55, 1.35, depth - 0.8, materials.painted, width / 2 - 0.3, 11.55, depth / 2);
    addBox(p, width, 0.55, 0.45, materials.blueDark, 0, 12.25, depth - 0.2);

    var lower = makeHipRoof(width + 1, depth + 2.5, 5.2, 1.0, materials.blueTile, south);
    lower.position.set(0, 12.45, depth / 2 + 0.2);
    p.add(lower);
    addBox(p, width + 0.8, 0.16, depth + 2.2, materials.soffit, 0, 12.35, depth / 2 + 0.2);

    var upper = makeHipRoof(width - 4, depth + 0.5, 4.0, 0.9, materials.blueTile, south);
    upper.position.set(0, 16.65, depth / 2);
    p.add(upper);
    addBox(p, width - 4.2, 0.16, depth + 0.4, materials.soffit, 0, 16.55, depth / 2);

    addBox(p, width - 2.5, 0.5, 0.4, materials.blueDark, 0, 16.45, depth / 2 + 0.8);

    if (south) {
      addBox(p, 6.6, 1.8, 0.24, materials.redDark, 0, 15.35, depth + 0.35);
      var plaque = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 1.5), new THREE.MeshBasicMaterial({
        map: window.MemorialTextures.makePlaque("天下为公", 768, 224), transparent: true
      }));
      plaque.position.set(0, 15.35, depth + 0.5);
      p.add(plaque);
    }

    addBox(p, width - 2.0, 0.28, 1.4, materials.granite, 0, 0.22, depth + 0.8);
    return p;
  }

  function buildDrumWindows(g) {
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      var sx = Math.sin(a), cz = Math.cos(a);
      var tx = Math.cos(a), tz = -Math.sin(a);
      for (var i = -1; i <= 1; i++) {
        var x = sx * (HALL_R - 0.1) + tx * i * 3.4;
        var z = cz * (HALL_R - 0.1) + tz * i * 3.4;
        var win = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.0), materials.window);
        win.position.set(x, 22.6, z);
        win.rotation.y = a;
        g.add(win);
      }
    }
    addOct(g, HALL_R + 0.8, 0.35, materials.blueDark, 19.0);

    addOct(g, HALL_R + 0.75, 1.2, materials.painted, 12.0);
    for (var n = 0; n < 8; n++) {
      var b = n * Math.PI / 4;
      var bx = Math.sin(b), bz = Math.cos(b);
      var ux = Math.cos(b), uz = -Math.sin(b);
      for (var j = -1; j <= 1; j += 2) {
        var wx = bx * (HALL_R - 0.1) + ux * j * 4.6;
        var wz = bz * (HALL_R - 0.1) + uz * j * 4.6;
        var win2 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 6.2), materials.window);
        win2.position.set(wx, 7.7, wz);
        win2.rotation.y = b;
        g.add(win2);
      }
    }
  }

  function buildHall() {
    var g = new THREE.Group();
    g.position.set(0, PLATFORM_Y, HALL_Z);

    addOct(g, 24.3, 0.8, materials.graniteLight, 0.4);
    addOct(g, HALL_R + 0.45, 25.4, materials.ochre, 13.3);
    addOct(g, HALL_R + 0.75, 1.0, materials.ochre, 1.1);

    for (var k = 0; k < 8; k++) {
      var a = Math.PI / 8 + k * Math.PI / 4;
      addBox(g, 0.9, 24.0, 0.9, materials.red, Math.sin(a) * (HALL_R + 0.3), 13.2, Math.cos(a) * (HALL_R + 0.3), a);
    }

    buildDrumWindows(g);

    var south = buildPorch(30, 13.7, true);
    south.position.set(0, 0, HALL_FACE);
    g.add(south);

    var north = buildPorch(30, 13.7, false);
    north.position.set(0, 0, -HALL_FACE);
    north.rotation.y = Math.PI;
    g.add(north);

    var east = buildPorch(26, 9.5, false);
    east.position.set(HALL_FACE, 0, 0);
    east.rotation.y = Math.PI / 2;
    g.add(east);

    var west = buildPorch(26, 9.5, false);
    west.position.set(-HALL_FACE, 0, 0);
    west.rotation.y = -Math.PI / 2;
    g.add(west);

    var roof = makeOctagonRoof(26.0);
    g.add(roof);

    root.add(g);
  }

  /* ---------------- 附楼 ---------------- */

  function buildAnnexes() {
    [-1, 1].forEach(function (side) {
      var g = new THREE.Group();
      g.position.set(side * 50, PLATFORM_Y, -30);
      addBox(g, 14, 6.2, 10, materials.brick, 0, 3.1, 0);
      addBox(g, 15, 0.45, 11, materials.granite, 0, 0.22, 0);
      var roof = makeHipRoof(15, 11, 2.0, 0.8, materials.dark, false);
      roof.position.y = 6.2;
      g.add(roof);
      for (var i = 0; i < 3; i++) {
        addBox(g, 1.8, 2.6, 0.2, materials.glass, -4.0 + i * 4.0, 4.0, 5.1);
        addBox(g, 2.0, 0.22, 0.35, materials.graniteLight, -4.0 + i * 4.0, 2.6, 5.25);
      }
      root.add(g);
    });
  }

  /* ---------------- 树 ---------------- */

  function makeSimpleTree(x, z, baseY, h, crownR, flower, dark) {
    var g = new THREE.Group();
    g.position.set(x, baseY, z);
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.045, h * 0.07, h * 0.58, 5), materials.trunk);
    trunk.position.y = h * 0.29;
    trunk.castShadow = true;
    g.add(trunk);
    var seed = Math.abs(Math.floor(x * 13 + z * 7));
    var rand = mulberry32(seed || 7);
    var count = 4;
    for (var i = 0; i < count; i++) {
      var a = rand() * Math.PI * 2;
      var rr = crownR * (0.28 + rand() * 0.25);
      var cy = h * (0.62 + rand() * 0.25);
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(crownR * (0.32 + rand() * 0.16), 0), dark ? materials.leafDark : materials.leaf);
      crown.position.set(Math.cos(a) * rr, cy, Math.sin(a) * rr);
      crown.scale.y = 0.82 + rand() * 0.2;
      crown.castShadow = !low;
      crown.receiveShadow = true;
      g.add(crown);
    }
    if (flower) {
      var blossoms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 5, 4), materials.flowerRed, low ? 30 : 70);
      var dummy = new THREE.Object3D();
      for (var j = 0; j < blossoms.count; j++) {
        var a2 = rand() * Math.PI * 2;
        var r2 = crownR * (0.2 + rand() * 0.55);
        dummy.position.set(Math.cos(a2) * r2, h * (0.65 + rand() * 0.3), Math.sin(a2) * r2);
        dummy.scale.setScalar(0.7 + rand() * 0.6);
        dummy.updateMatrix();
        blossoms.setMatrixAt(j, dummy.matrix);
      }
      g.add(blossoms);
    }
    root.add(g);
    return g;
  }

  function makeHeroKapok() {
    var x = 38, z = -58, baseY = PLATFORM_Y;
    var g = new THREE.Group();
    g.position.set(x, baseY, z);
    var pit = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.25, 24), materials.soil);
    pit.position.y = 0.12;
    g.add(pit);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.18, 6, 28), materials.granite);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.25;
    g.add(rim);

    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.45, 15.0, 7), materials.trunk);
    trunk.position.y = 7.5;
    trunk.castShadow = true;
    g.add(trunk);

    var rand = mulberry32(1669);
    for (var b = 0; b < 5; b++) {
      var a = b * Math.PI * 2 / 5 + rand() * 0.5;
      addBeam(g, 0, 11.5, 0, Math.sin(a) * 9.0, 20.5 + rand() * 2.0, Math.cos(a) * 9.0, 0.55, materials.trunk, 6);
    }

    for (var i = 0; i < 7; i++) {
      var a2 = rand() * Math.PI * 2;
      var r2 = 4 + rand() * 11;
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5 + rand() * 3.0, 0), i % 2 ? materials.leaf : materials.leafDark);
      crown.position.set(Math.cos(a2) * r2, 21.5 + rand() * 5.0, Math.sin(a2) * r2);
      crown.scale.y = 0.7 + rand() * 0.2;
      crown.castShadow = !low;
      g.add(crown);
    }

    var blossoms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 5, 4), materials.flowerRed, low ? 50 : 120);
    var dummy = new THREE.Object3D();
    for (var j = 0; j < blossoms.count; j++) {
      var a3 = rand() * Math.PI * 2;
      var r3 = 6 + rand() * 13;
      dummy.position.set(Math.cos(a3) * r3, 21 + rand() * 7, Math.sin(a3) * r3);
      dummy.scale.setScalar(0.65 + rand() * 0.7);
      dummy.updateMatrix();
      blossoms.setMatrixAt(j, dummy.matrix);
    }
    g.add(blossoms);

    var stone = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.8), materials.granite);
    stone.position.set(-4.0, 1.2, 3.8);
    stone.rotation.y = -0.25;
    g.add(stone);

    root.add(g);
  }

  function makeMagnolia(x, z) {
    var g = new THREE.Group();
    g.position.set(x, PLATFORM_Y, z);
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 8.0, 6), materials.trunk);
    trunk.position.y = 4.0;
    g.add(trunk);
    var rand = mulberry32(x > 0 ? 31 : 17);
    for (var i = 0; i < 4; i++) {
      var a = rand() * Math.PI * 2;
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4 + rand() * 1.2, 0), materials.leaf);
      crown.position.set(Math.cos(a) * 2.6, 9.5 + rand() * 2.5, Math.sin(a) * 2.6);
      crown.castShadow = !low;
      g.add(crown);
    }
    var flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 5, 4), materials.flowerWhite, low ? 20 : 45);
    var dummy = new THREE.Object3D();
    for (var j = 0; j < flowers.count; j++) {
      var a2 = rand() * Math.PI * 2;
      var r = 2.0 + rand() * 3.2;
      dummy.position.set(Math.cos(a2) * r, 8.5 + rand() * 4.0, Math.sin(a2) * r);
      dummy.updateMatrix();
      flowers.setMatrixAt(j, dummy.matrix);
    }
    g.add(flowers);
    root.add(g);
  }

  function buildTrees() {
    makeHeroKapok();
    makeMagnolia(-20, 14);
    makeMagnolia(20, 14);

    [[-64, 108], [64, 108], [-80, 76], [80, 76]].forEach(function (p) {
      makeSimpleTree(p[0], p[1], 0, 19 + (p[0] > 0 ? 2 : 0), 11, true, false);
    });
    [[-75, 40], [75, 40], [-78, -20], [78, -20], [-70, -80]].forEach(function (p) {
      makeSimpleTree(p[0], p[1], 0, 17, 10, false, true);
    });

    var rand = mulberry32(20261031);
    var total = low ? 55 : 110;
    var trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 4.0, 5);
    trunkGeo.translate(0, 2.0, 0);
    var crownGeo = new THREE.IcosahedronGeometry(2.8, 0);
    var trunks = new THREE.InstancedMesh(trunkGeo, materials.trunk, total);
    var crowns = new THREE.InstancedMesh(crownGeo, materials.leafDark, total);
    var dummy = new THREE.Object3D();
    var n = 0, guard = 0;
    while (n < total && guard < total * 12) {
      guard++;
      var x = rand() * 236 - 118;
      var z = rand() * 270 - 150;
      if (Math.abs(x) < 64 && z > -86 && z < 118) continue;
      if (z < -86) continue;
      if (Math.abs(x) < 10) continue;
      if (z > 130) continue;
      var s = 0.7 + rand() * 0.9;
      dummy.position.set(x, 0, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(n, dummy.matrix);
      var crown = new THREE.Object3D();
      crown.position.set(x, (4.0 + 2.4) * s, z);
      crown.scale.set(s * (0.85 + rand() * 0.3), s * (0.7 + rand() * 0.3), s * (0.85 + rand() * 0.3));
      crown.rotation.y = rand() * Math.PI * 2;
      crown.updateMatrix();
      crowns.setMatrixAt(n, crown.matrix);
      n++;
    }
    trunks.count = crowns.count = n;
    trunks.castShadow = false;
    crowns.castShadow = false;
    crowns.receiveShadow = true;
    root.add(trunks);
    root.add(crowns);
  }

  /* ---------------- 北侧山体 ---------------- */

  function hillY(x, z) {
    return Math.max(0, 17 * sstep(-92, -155, z) + 1.2 * Math.sin(x * 0.07 + z * 0.03));
  }

  function buildNorthHill() {
    var geo = new THREE.PlaneGeometry(280, 110, low ? 22 : 40, low ? 10 : 16);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i) - 145;
      pos.setY(i, hillY(x, z));
    }
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: textures.grass, color: 0x8fa37b, roughness: 1 }));
    mesh.position.z = -145;
    mesh.receiveShadow = true;
    root.add(mesh);

    for (var s = 0; s < 22; s++) {
      var y = 0.4 + s * 0.42;
      addBox(root, 7, 0.42, 1.4, materials.graniteLight, 0, y, -95 - s * 1.35);
    }
    [-100, -112, -124].forEach(function (z) {
      var stepY = 0.4 + ((-95 - z) / 1.35) * 0.42;
      addCyl(root, 0.08, 0.12, 2.6, 6, materials.iron, 0, stepY + 1.3, z);
      addBox(root, 0.55, 0.75, 0.55, materials.red, 0, stepY + 2.4, z);
    });

    var rand = mulberry32(1929);
    var total = low ? 28 : 55;
    var trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 4.4, 5);
    trunkGeo.translate(0, 2.2, 0);
    var crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.1, 0), materials.leafDark, total);
    var trunks = new THREE.InstancedMesh(trunkGeo, materials.trunk, total);
    var dummy = new THREE.Object3D();
    var n = 0, guard = 0;
    while (n < total && guard < total * 14) {
      guard++;
      var x = rand() * 250 - 125;
      var z = -92 - rand() * 58;
      if (Math.abs(x) < 9) continue;
      var gy = hillY(x, z);
      if (gy < 0.8) continue;
      var sc = 0.65 + rand() * 0.9;
      dummy.position.set(x, gy, z);
      dummy.scale.set(sc, sc, sc);
      dummy.rotation.y = rand() * 6.3;
      dummy.updateMatrix();
      trunks.setMatrixAt(n, dummy.matrix);
      var crown = new THREE.Object3D();
      crown.position.set(x, gy + 5.6 * sc, z);
      crown.scale.set(sc * (0.9 + rand() * 0.35), sc * (0.7 + rand() * 0.3), sc * (0.9 + rand() * 0.35));
      crown.rotation.y = rand() * 6.3;
      crown.updateMatrix();
      crowns.setMatrixAt(n, crown.matrix);
      n++;
    }
    trunks.count = crowns.count = n;
    root.add(trunks);
    root.add(crowns);
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "gate", craft: "gate", no: "01", name: "门楼",
        pos: new THREE.Vector3(-12.5, 10.0, GATE_Z + 4.2),
        view: { pos: new THREE.Vector3(0, 7.5, 154), target: new THREE.Vector3(0, 8.5, GATE_Z) },
        lede: "三孔拱券、蓝瓦赭黄砖的门楼，是中山纪念堂南端的中轴起点。",
        facts: [["建成", "1931"], ["拱门", "三孔"], ["匾额", "中山纪念堂"]],
        detail: "门楼面阔三间、进深一间，正中歇山、两侧庑殿，铺蓝色琉璃瓦，檐下施彩绘斗拱。旧资料有“重檐叠阁”的文学描述；现场复核前按单檐保守做法，未确认的重檐不硬加。"
      },
      {
        id: "huabiao", craft: "huabiao", no: "02", name: "云鹤华表",
        pos: new THREE.Vector3(58, 8.2, 85),
        view: { pos: new THREE.Vector3(76, 6.8, 102), target: new THREE.Vector3(58, 6.8, 85) },
        lede: "前大草坪东西两侧的一对云鹤华表，1931 年建，柱头刻祥云与仙鹤。",
        facts: [["年代", "1931"], ["高", "12–13 m 示意"], ["位置", "草坪东西两侧"]],
        detail: "华表为花岗岩，八角形底座超过一人高，柱身有浮雕，周围有红色护栏。游记口径高 12.83 米；精确高度未测绘，场景按 12–13 米示意。"
      },
      {
        id: "statue", craft: "statue", no: "03", name: "孙中山铜像",
        pos: new THREE.Vector3(3.8, 4.0, 50),
        view: { pos: new THREE.Vector3(0, 5.2, 72), target: new THREE.Vector3(0, 8.0, 50) },
        lede: "孙中山先生站立像，面向南；像高 5.5 米，重 3.9 吨。",
        facts: [["像高", "5.5 m"], ["重", "3.9 t"], ["年代", "1956 / 1998"]],
        detail: "1956 年由尹积昌等人创作，原为水泥像表面镀铜；1998 年大修时换为全铜像。白色花岗岩基座为 1931 年建，座上刻《建国大纲》。"
      },
      {
        id: "roof", craft: "roof", no: "04", name: "八角蓝顶",
        pos: new THREE.Vector3(9, 34, HALL_Z),
        view: { pos: new THREE.Vector3(46, 26, 22), target: new THREE.Vector3(0, 30, HALL_Z) },
        lede: "中央八角攒尖顶 + 四面重檐歇山抱厦，四层宝蓝琉璃瓦檐口，金色宝顶。",
        facts: [["堂高", "48.63 m"], ["屋顶", "八角攒尖 + 四抱厦"], ["瓦", "宝蓝琉璃"]],
        detail: "堂高 48.63 米，南北 72.65 米、东西 63.32 米。1963 年从佛山石湾定制宝蓝色琉璃瓦重铺；2024 年屋面修缮。抱厦与脊线为低模示意，不做逐瓦复刻。"
      },
      {
        id: "structure", craft: "structure", no: "05", name: "无柱大厅",
        pos: new THREE.Vector3(-5.5, 13.4, 4),
        view: { pos: new THREE.Vector3(0, 7.0, 31), target: new THREE.Vector3(0, 13.0, 3) },
        lede: "外观是传统屋顶，里面是钢桁架 + 钢筋混凝土的无柱大会堂。",
        facts: [["净跨", "71 m"], ["桁架", "约 30 m"], ["座位", "4729"]],
        detail: "观众厅内无柱：8 根柱隐藏在四周墙内，单榀钢桁架跨度约 30 米，八角大厅净跨约 71 米；上下两层 4729 座、11 个出入口（《中国大百科全书》；旧资料作 5000 座）。本场景只做外观与图文热点，不做内部/舞台。"
      },
      {
        id: "kapok", craft: "kapok", no: "06", name: "木棉王",
        pos: new THREE.Vector3(38, 18, -58),
        view: { pos: new THREE.Vector3(58, 11, -18), target: new THREE.Vector3(38, 15, -58) },
        lede: "东北角的木棉王，树龄 350 多年；它比纪念堂早约 260 年。",
        facts: [["树龄", "350+ 年"], ["高", "约 27 m"], ["冠幅", "约 33 m"]],
        detail: "2026 年约 357 岁，植于 1669 年前后；高约 27 米、胸围约 6 米、平均冠幅约 33 米，2018 年获评“中国最美木棉”。树池、支撑与花季为示意。"
      },
      {
        id: "axis", craft: "axis", no: "07", name: "老城中轴",
        pos: new THREE.Vector3(0, 5.2, -74),
        view: { pos: new THREE.Vector3(0, 9.0, -70), target: new THREE.Vector3(0, 7.0, -132) },
        lede: "门楼—草坪—铜像—纪念堂—越秀山，落在广州近代传统中轴上。",
        facts: [["中轴", "约 3.3 km"], ["格局", "前堂后碑"], ["北侧", "越秀山/百步梯 示意"]],
        detail: "镇海楼—中山纪念碑—中山纪念堂—市府—人民公园—起义路—海珠广场—海珠桥。北侧山体与百步梯只做低权重示意，不重建完整城市中轴；完整中轴请看越秀近景的顶层南望。"
      }
    ];
  }

  /* ---------------- 组装 ---------------- */

  function build(opts) {
    textures = opts.textures;
    low = !!opts.low;
    root = new THREE.Group();
    root.name = "memorial-hall";
    materials = makeMaterials();
    hotspots = [];
    lampLights = [];
    glowMats = [];
    windowMats = [];

    buildGround();
    buildStreet();
    buildFence();
    buildLawn();
    buildPlatform();
    buildHall();
    buildGate();
    buildHuabiao(-58);
    buildHuabiao(58);
    buildStatue();
    buildAnnexes();
    buildTrees();
    buildNorthHill();
    buildHotspots();

    root.updateMatrixWorld(true);
    root.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh) return;
      var box = new THREE.Box3().setFromObject(o);
      var size = box.getSize(new THREE.Vector3());
      var max = Math.max(size.x, size.y, size.z);
      o.castShadow = max > 8.5 && size.y > 2.0;
    });

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      lampLights: lampLights,
      glowMats: glowMats,
      windowMats: windowMats,
      bounds: new THREE.Box3(new THREE.Vector3(-160, 0, -190), new THREE.Vector3(160, 60, 190))
    };
  }

  window.MemorialModel = { build: build };
})();
