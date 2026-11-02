/* 沙面 · 大街一段近景 · 场景模型（1 unit = 1 m） */
(function () {
  "use strict";

  var textures = null;
  var materials = null;
  var root = null;
  var hotspots = [];
  var lampLights = [];
  var lampGlowMats = [];
  var lampGlowSprites = [];
  var warmWindowMats = [];
  var gardenLights = [];
  var canopyGroups = [];
  var canopyInst = { A: [], B: [], C: [] };
  var cityWinMats = [];
  var low = false;
  var rnd = mulberry32(20261031);

  var inst = {
    archCream: [],
    archYellow: [],
    archMint: [],
    archStone: [],
    columns: [],
    bases: [],
    capitals: [],
    winDark: [],
    winWarm: [],
    doors: [],
    shutters: []
  };

  var archGeo = null;
  var windowGeo = null;
  var doorGeo = null;
  var shutterGeo = null;
  var columnGeo = null;
  var baseGeo = null;
  var capitalGeo = null;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function addBox(parent, w, h, d, mat, x, y, z, ry, cast) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = cast !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addCyl(parent, rt, rb, h, seg, mat, x, y, z) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addBeam(parent, a, b, r, mat, seg) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length();
    if (len < 0.001) return null;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, len, seg || 5), mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function pushBeamMatrix(list, a, b, r, ox, oz) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length();
    if (len < 0.001) return;
    var mid = new THREE.Vector3().copy(a).addScaledVector(dir, 0.5);
    mid.x += ox || 0;
    mid.z += oz || 0;
    list.push(new THREE.Matrix4().compose(
      mid,
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
      new THREE.Vector3(r, len, r)
    ));
  }

  function makeArchGeometry(bayW, height, thickness) {
    var r = bayW / 2 - 0.2;
    var spring = height - r - 0.45;
    var shape = new THREE.Shape();
    shape.moveTo(-bayW / 2, 0);
    shape.lineTo(bayW / 2, 0);
    shape.lineTo(bayW / 2, height);
    shape.lineTo(-bayW / 2, height);
    shape.lineTo(-bayW / 2, 0);
    var hole = new THREE.Path();
    hole.moveTo(-r, 0);
    hole.lineTo(-r, spring);
    hole.absarc(0, spring, r, Math.PI, 0, true);
    hole.lineTo(r, 0);
    hole.lineTo(-r, 0);
    shape.holes.push(hole);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
    geo.translate(0, 0, -thickness / 2);
    return geo;
  }

  function makePointedArchGeometry(bayW, height, thickness) {
    var r = bayW / 2;
    var spring = height - r * 1.05;
    var shape = new THREE.Shape();
    shape.moveTo(-r, 0);
    shape.lineTo(r, 0);
    shape.lineTo(r, height);
    shape.lineTo(-r, height);
    shape.lineTo(-r, 0);
    var hole = new THREE.Path();
    hole.moveTo(-r, 0);
    hole.lineTo(-r, spring);
    hole.quadraticCurveTo(-r * 0.58, spring + (height - spring) * 0.66, 0, height);
    hole.quadraticCurveTo(r * 0.58, spring + (height - spring) * 0.66, r, spring);
    hole.lineTo(r, 0);
    hole.lineTo(-r, 0);
    shape.holes.push(hole);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 8 });
    geo.translate(0, 0, -thickness / 2);
    return geo;
  }

  function pointedDoorShape(halfW, spring, apex) {
    var shape = new THREE.Shape();
    shape.moveTo(-halfW, 0);
    shape.lineTo(halfW, 0);
    shape.lineTo(halfW, spring);
    shape.quadraticCurveTo(halfW * 0.58, spring + (apex - spring) * 0.66, 0, apex);
    shape.quadraticCurveTo(-halfW * 0.58, spring + (apex - spring) * 0.66, -halfW, spring);
    shape.lineTo(-halfW, 0);
    return shape;
  }

  function makeHipRoofGeometry(w, d, h, inset) {
    var hw = w / 2, hd = d / 2;
    var positions = new Float32Array([
      -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
      -hw + inset, h, 0, hw - inset, h, 0
    ]);
    var idx = [
      0, 5, 1, 0, 4, 5,
      3, 4, 5, 3, 5, 2,
      0, 3, 4,
      1, 5, 2
    ];
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function makeMaterials() {
    var m = {};
    m.ivory = new THREE.MeshStandardMaterial({ map: textures.plasterCream, color: 0xf4ecdc, roughness: 0.94, metalness: 0.01 });
    m.cream = new THREE.MeshStandardMaterial({ map: textures.plasterCream, color: 0xf0d7ab, roughness: 0.94, metalness: 0.01 });
    m.yellow = new THREE.MeshStandardMaterial({ map: textures.plasterYellow, color: 0xffedc4, roughness: 0.92, metalness: 0.01 });
    m.mint = new THREE.MeshStandardMaterial({ map: textures.plasterMint, color: 0xb9caa5, roughness: 0.94, metalness: 0.01 });
    m.grey = new THREE.MeshStandardMaterial({ map: textures.plasterGrey, roughness: 0.94, metalness: 0.01 });
    m.washStone = new THREE.MeshStandardMaterial({ map: textures.washStone, color: 0xf6dfb8, roughness: 0.96, metalness: 0.01 });
    m.brick = new THREE.MeshStandardMaterial({ map: textures.brick, roughness: 0.95, metalness: 0.01 });
    m.stone = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.92, metalness: 0.02 });
    m.stoneLight = new THREE.MeshStandardMaterial({ map: textures.stoneLight, roughness: 0.9, metalness: 0.02 });
    m.paving = new THREE.MeshStandardMaterial({ map: textures.paving, color: 0xb8b1a1, roughness: 0.95 });
    m.road = new THREE.MeshStandardMaterial({ map: textures.paving, color: 0x9d9789, roughness: 0.97 });
    m.sidewalk = new THREE.MeshStandardMaterial({ map: textures.sidewalk, color: 0xc4b39b, roughness: 0.95 });
    m.roof = new THREE.MeshStandardMaterial({ map: textures.roof, color: 0xa99780, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide });
    m.slate = new THREE.MeshStandardMaterial({ map: textures.slate, color: 0x7e888b, roughness: 0.8, metalness: 0.04, side: THREE.DoubleSide });
    m.slateDark = new THREE.MeshStandardMaterial({ color: 0x4d5153, roughness: 0.8, metalness: 0.05 });
    m.wood = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.82, metalness: 0.02 });
    m.iron = new THREE.MeshStandardMaterial({ color: 0x1b211f, roughness: 0.55, metalness: 0.42 });
    m.glass = new THREE.MeshStandardMaterial({ color: 0x22343a, roughness: 0.2, metalness: 0.5 });
    m.leafA = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x647d53, roughness: 1, flatShading: true });
    m.leafB = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x516d42, roughness: 1, flatShading: true });
    m.leafC = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x405c37, roughness: 1, flatShading: true });
    m.bark = new THREE.MeshStandardMaterial({ map: textures.bark, color: 0x9a8a76, roughness: 1 });
    m.barkDark = new THREE.MeshStandardMaterial({ map: textures.bark, color: 0x7d6f5d, roughness: 1 });
    m.grass = new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 1 });
    m.soil = new THREE.MeshStandardMaterial({ color: 0x584531, roughness: 1 });
    m.water = new THREE.MeshStandardMaterial({ map: textures.water, color: 0x9fb0b2, roughness: 0.28, metalness: 0.28 });
    m.city = new THREE.MeshStandardMaterial({ color: 0x5f645d, roughness: 0.96 });
    m.cityWin = new THREE.MeshStandardMaterial({ map: textures.cityWindow, color: 0x9b9d94, roughness: 0.9, emissive: 0xffc98a, emissiveMap: textures.cityWindow, emissiveIntensity: 0 });
    m.windowDark = new THREE.MeshStandardMaterial({ map: textures.window, transparent: true, alphaTest: 0.15, roughness: 0.55, metalness: 0.05 });
    m.windowWarm = new THREE.MeshStandardMaterial({ map: textures.window, transparent: true, alphaTest: 0.15, roughness: 0.5, emissive: 0xffc27a, emissiveMap: textures.window, emissiveIntensity: 0 });
    m.door = new THREE.MeshStandardMaterial({ map: textures.door, transparent: true, alphaTest: 0.1, roughness: 0.8 });
    m.rose = new THREE.MeshStandardMaterial({ map: textures.rose, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, emissive: 0xffc98a, emissiveMap: textures.rose, emissiveIntensity: 0 });
    m.pointed = new THREE.MeshStandardMaterial({ map: textures.pointed, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, emissive: 0xffc98a, emissiveMap: textures.pointed, emissiveIntensity: 0 });
    m.lamp = new THREE.MeshStandardMaterial({ color: 0xfff0cf, emissive: 0xffb86b, emissiveIntensity: 0.12, roughness: 0.35 });
    m.white = new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.9 });
    m.shutter = new THREE.MeshStandardMaterial({ map: textures.shutter, color: 0xe6f0de, roughness: 0.86 });
    m.belfry = new THREE.MeshStandardMaterial({ map: textures.belfry, roughness: 0.8 });
    m.gold = new THREE.MeshStandardMaterial({ color: 0xc9a258, roughness: 0.34, metalness: 0.65 });
    m.plasterCream = m.ivory;
    m.sign = new THREE.MeshStandardMaterial({ map: textures.streetSign, roughness: 0.85, side: THREE.DoubleSide });
    m.signEn = new THREE.MeshStandardMaterial({ map: textures.signEn, roughness: 0.85, side: THREE.DoubleSide });
    m.plaque14 = new THREE.MeshStandardMaterial({ map: textures.plaque14, roughness: 0.85 });
    m.plaque48 = new THREE.MeshStandardMaterial({ map: textures.plaque48, roughness: 0.85 });
    m.flowerPink = new THREE.MeshStandardMaterial({ color: 0xd98a9a, roughness: 0.9 });
    m.flowerWhite = new THREE.MeshStandardMaterial({ color: 0xeee6d4, roughness: 0.9 });
    m.grottoRock = new THREE.MeshStandardMaterial({ color: 0x242a27, roughness: 1, flatShading: true });
    m.statue = new THREE.MeshStandardMaterial({ color: 0xf4efe3, roughness: 0.86, emissive: 0xffe6c4, emissiveIntensity: 0.13 });
    m.dark = new THREE.MeshStandardMaterial({ color: 0x161510, roughness: 1 });
    m.hedge = new THREE.MeshStandardMaterial({ color: 0x3f5d3a, roughness: 1 });
    m.skin = new THREE.MeshStandardMaterial({ color: 0xc9a183, roughness: 0.9 });
    m.coatNavy = new THREE.MeshStandardMaterial({ color: 0x2f3b4a, roughness: 0.92 });
    m.coatOlive = new THREE.MeshStandardMaterial({ color: 0x4d5b3f, roughness: 0.92 });
    m.coatBrick = new THREE.MeshStandardMaterial({ color: 0x8c4a3c, roughness: 0.92 });
    return m;
  }

  function addInstance(list, base, lx, ly, lz, yaw, sx, sy, sz) {
    var local = new THREE.Matrix4().compose(
      new THREE.Vector3(lx, ly, lz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw || 0, 0)),
      new THREE.Vector3(sx || 1, sy || 1, sz || 1)
    );
    list.push(new THREE.Matrix4().multiplyMatrices(base, local));
  }

  function baseMatrix(x, z, yaw) {
    var m = new THREE.Matrix4().makeRotationY(yaw || 0);
    m.setPosition(x, 0, z);
    return m;
  }

  function flushInstanced(geo, mat, list, name) {
    if (!list.length) return;
    var mesh = new THREE.InstancedMesh(geo, mat, list.length);
    for (var i = 0; i < list.length; i++) mesh.setMatrixAt(i, list[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    root.add(mesh);
  }

  /* ---------------- 地面与街面 ---------------- */

  function buildGround() {
    var g = new THREE.Group();
    g.name = "street";
    var base = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ color: 0x57584d, roughness: 1 }));
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -0.55, 40);
    base.receiveShadow = true;
    g.add(base);

    var road = new THREE.Mesh(new THREE.PlaneGeometry(220, 12.9), materials.road);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, 0);
    road.receiveShadow = true;
    g.add(road);

    var walkGeo = new THREE.PlaneGeometry(220, 2.5);
    [-1, 1].forEach(function (side) {
      var walk = new THREE.Mesh(walkGeo, materials.sidewalk);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.06, side * 7.7);
      walk.receiveShadow = true;
      g.add(walk);
    });

    [-1, 1].forEach(function (side) {
      addBox(g, 220, 0.16, 0.24, materials.stoneLight, 0, 0.08, side * 6.48, 0, false);
    });

    /* 沙面大街与四街/一街示意交叉口 */
    [[-36, 7], [63, 7]].forEach(function (cross) {
      var lane = new THREE.Mesh(new THREE.PlaneGeometry(cross[1], 74), materials.sidewalk);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(cross[0], 0.045, 0);
      lane.receiveShadow = true;
      g.add(lane);
    });
    /* 教堂前的南北向支路/前庭：填住两排南侧立面之间的空场 */
    var forecourt = new THREE.Mesh(new THREE.PlaneGeometry(14.9, 33), materials.sidewalk);
    forecourt.rotation.x = -Math.PI / 2;
    forecourt.position.set(77, 0.048, 23);
    forecourt.receiveShadow = true;
    g.add(forecourt);

    /* 斑马线 */
    for (var i = 0; i < 8; i++) {
      addBox(g, 0.7, 0.02, 4.6, materials.white, 78 + i * 1.15, 0.045, 0, 0, false);
      addBox(g, 4.6, 0.02, 0.7, materials.white, -36, 0.045, -3 + i * 1.15, 0, false);
    }

    /* 排水沟盖 */
    [-4, 12, 28, 46, 64, 82, -20, -56, -72].forEach(function (x) {
      addBox(g, 0.55, 0.02, 1.2, materials.iron, x, 0.055, 6.3, 0, false);
      addBox(g, 0.55, 0.02, 1.2, materials.iron, x, 0.055, -6.3, 0, false);
    });

    root.add(g);
  }

  /* ---------------- 街心花园与路灯 ---------------- */

  function buildGardenNode(cx, cz, width) {
    var g = new THREE.Group();
    g.position.set(cx, 0, cz);
    var curb = addBox(g, width, 0.34, 3.6, materials.stoneLight, 0, 0.17, 0, 0, false);
    curb.receiveShadow = true;
    var soil = addBox(g, width - 0.6, 0.12, 3.2, materials.grass, 0, 0.38, 0, 0, false);
    soil.receiveShadow = true;

    var hedge = new THREE.MeshStandardMaterial({ color: 0x4f6c43, roughness: 1 });
    [-1.5, 1.5].forEach(function (z) {
      var h = addBox(g, width - 0.9, 0.52, 0.5, hedge, 0, 0.66, z, 0, false);
      h.receiveShadow = true;
    });
    addBox(g, 0.5, 0.52, 3.0, hedge, -width / 2 + 0.55, 0.66, 0, 0, false);
    addBox(g, 0.5, 0.52, 3.0, hedge, width / 2 - 0.55, 0.66, 0, 0, false);

    /* 黑铁围栏 */
    var postGeo = new THREE.BoxGeometry(0.08, 0.9, 0.08);
    for (var i = 0; i <= 4; i++) {
      var x = -width / 2 + 0.4 + i * (width - 0.8) / 4;
      [-1.92, 1.92].forEach(function (z) {
        var post = new THREE.Mesh(postGeo, materials.iron);
        post.position.set(x, 0.45, z);
        post.castShadow = false;
        g.add(post);
      });
    }
    [-1.92, 1.92].forEach(function (z) {
      addBox(g, width - 0.4, 0.06, 0.06, materials.iron, 0, 0.36, z, 0, false);
      addBox(g, width - 0.4, 0.06, 0.06, materials.iron, 0, 0.78, z, 0, false);
    });

    /* 长椅 */
    [-1, 1].forEach(function (side) {
      var bx = side * (width / 2 - 2.0);
      addBox(g, 1.7, 0.09, 0.55, materials.wood, bx, 0.55, 2.2, 0, false);
      addBox(g, 1.7, 0.08, 0.5, materials.wood, bx, 0.88, 2.48, -0.35, false);
      [-0.65, 0.65].forEach(function (lx) {
        addBox(g, 0.06, 0.5, 0.5, materials.iron, bx + lx, 0.28, 2.2, 0, false);
      });
    });

    root.add(g);
    return g;
  }

  function buildGardens() {
    buildGardenNode(52, 0, 14);
    buildGardenNode(10, 0, 14);
    buildGardenNode(-30, 0, 14);
  }

  function buildLamp(x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    addBox(g, 0.32, 0.24, 0.32, materials.iron, 0, 0.12, 0, 0, false);
    addCyl(g, 0.055, 0.09, 4.0, 7, materials.iron, 0, 2.1, 0);
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), materials.lamp);
    top.position.set(0, 4.42, 0);
    g.add(top);
    [-1, 1].forEach(function (side) {
      addBox(g, 0.62, 0.05, 0.05, materials.iron, side * 0.34, 3.9, 0, 0, false);
      var globe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 7), materials.lamp);
      globe.position.set(side * 0.62, 3.98, 0);
      g.add(globe);
    });
    addCyl(g, 0.22, 0.14, 0.18, 8, materials.iron, 0, 4.62, 0);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xffc27a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    glow.position.set(0, 4.2, 0);
    glow.scale.set(2.4, 2.4, 1);
    g.add(glow);
    lampGlowSprites.push(glow.material);
    root.add(g);
  }

  function buildLamps() {
    [-80, -40, 0, 40, 80].forEach(function (x) {
      buildLamp(x, -8.15);
      buildLamp(x, 8.15);
    });
    function lampSpot(x, z) {
      var spot = new THREE.SpotLight(0xffb86b, 0, 14, 0.95, 0.7, 2);
      spot.position.set(x, 4.25, z);
      spot.target.position.set(x, 0, z);
      root.add(spot);
      root.add(spot.target);
      lampLights.push(spot);
    }
    lampSpot(40, -8.15);
    lampSpot(80, 8.15);
  }

  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,235,185,1)");
    g.addColorStop(0.28, "rgba(255,190,110,0.55)");
    g.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  /* ---------------- 券廊建筑 ---------------- */

  function addFacade(base, opt) {
    var W = opt.width;
    var bays = Math.max(2, Math.round(W / 3.2));
    var bayW = W / bays;
    var levels = opt.levels || 1;
    var archKey = opt.archKey || "cream";
    var doorEvery = opt.doorEvery || 3;

    for (var level = 0; level < levels; level++) {
      var baseY = level * 4.2;
      for (var i = 0; i < bays; i++) {
        var lx = -W / 2 + bayW * (i + 0.5);
        addInstance(inst["arch" + archKey.charAt(0).toUpperCase() + archKey.slice(1)], base, lx, baseY, 0, 0, bayW / 3.2, 1, 1);
      }
      for (var c = 0; c <= bays; c++) {
        var cx = -W / 2 + bayW * c;
        addInstance(inst.columns, base, cx, baseY + 2.1, 0.08, 0);
        addInstance(inst.bases, base, cx, baseY + 0.13, 0.08, 0);
        addInstance(inst.capitals, base, cx, baseY + 4.05, 0.08, 0);
      }
    }

    /* 二层券廊的楼板与顶棚由建筑本体做，这里补窗与门 */
    var upperStart = levels === 2 ? 8.4 : 4.2;
    var upperRows = opt.floors > 2 ? 2 : 1;
    if (levels === 1) {
      for (var row = 0; row < upperRows; row++) {
        var wy = upperStart + 2.25 + row * 3.25;
        for (var w = 0; w < bays; w++) {
          var wx = -W / 2 + bayW * (w + 0.5);
          var warm = rnd() < 0.22;
          addInstance(warm ? inst.winWarm : inst.winDark, base, wx, wy, 0.045, 0);
          if (opt.shutters) {
            addInstance(inst.shutters, base, wx - 1.0, wy, 0.052, 0);
            addInstance(inst.shutters, base, wx + 1.0, wy, 0.052, 0);
          }
        }
      }
    }
    for (var d = 1; d < bays; d += doorEvery) {
      var dx = -W / 2 + bayW * (d + 0.5);
      addInstance(inst.doors, base, dx, 1.42, -2.62, 0);
    }
  }

  function buildRowBuilding(opt) {
    var side = opt.side;
    var yaw = side === "north" ? 0 : Math.PI;
    var W = opt.width;
    var D = opt.depth;
    var H = opt.height;
    var floors = opt.floors || 3;
    var levels = opt.levels || 1;
    var startY = levels === 2 ? 8.4 : 4.2;
    var bays = Math.max(2, Math.round(W / 3.2));
    var bayW = W / bays;
    var cx = opt.cx;
    var zFront = opt.zFront;

    var g = new THREE.Group();
    g.position.set(cx, 0, zFront);
    g.rotation.y = yaw;
    g.name = opt.name || "arcade-row";

    var upperH = H - startY;
    addBox(g, W, upperH, D, opt.wallMat, 0, startY + upperH / 2, -D / 2);
    addBox(g, 0.42, startY, D, opt.wallMat, -W / 2, startY / 2, -D / 2);
    addBox(g, 0.42, startY, D, opt.wallMat, W / 2, startY / 2, -D / 2);
    addBox(g, W, startY, 0.42, opt.wallMat, 0, startY / 2, -D);

    /* 拱廊地面、顶棚、后墙 */
    for (var lv = 0; lv < levels; lv++) {
      var y0 = lv * 4.2;
      addBox(g, W - 0.4, 0.1, 2.75, materials.paving, 0, y0 + 0.06, -1.4, 0, false);
      addBox(g, W, 0.16, 2.8, opt.wallMat, 0, y0 + 4.15, -1.4, 0, false);
      addBox(g, W, 4.2, 0.34, opt.wallMat, 0, y0 + 2.1, -2.78);
    }

    /* 檐口与女儿墙 */
    addBox(g, W + 0.3, 0.22, D + 0.25, materials.stoneLight, 0, startY + 0.05, -D / 2, 0, false);
    addBox(g, W + 0.45, 0.55, 0.42, opt.wallMat, 0, H + 0.28, 0.06, 0, false);
    addBox(g, W + 0.5, 0.16, 0.55, materials.stoneLight, 0, H + 0.02, 0.02, 0, false);
    /* 白色隅石与楼层线脚 */
    [-1, 1].forEach(function (qs) {
      addBox(g, 0.34, H, 0.24, materials.stoneLight, qs * (W / 2 - 0.12), H / 2, 0.08, 0, false);
    });
    [startY + 0.08, H - 0.28].forEach(function (by) {
      if (by > startY + 0.2) addBox(g, W + 0.1, 0.13, 0.3, materials.stoneLight, 0, by, 0.07, 0, false);
    });

    /* 屋顶 */
    var roof = new THREE.Mesh(makeHipRoofGeometry(W + 0.7, D + 0.7, 2.3, 1.1), materials.roof);
    roof.position.set(0, H, -D / 2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);

    /* 侧立面窗与线脚：避免从街上看过去是一整面白墙 */
    var sideRows = floors > 2 ? [6.4, 9.6] : [6.3, 9.3];
    var sideBase = baseMatrix(cx, zFront, yaw);
    [-1, 1].forEach(function (side) {
      sideRows.forEach(function (y) {
        [-D * 0.32, -D * 0.68].forEach(function (z) {
          addInstance(rnd() < 0.16 ? inst.winWarm : inst.winDark, sideBase,
            side * (W / 2 + 0.24), y, z, side > 0 ? Math.PI / 2 : -Math.PI / 2);
        });
      });
      addInstance(inst.winDark, sideBase, side * (W / 2 + 0.24), 2.5, -D * 0.3, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      addInstance(inst.doors, sideBase, side * (W / 2 + 0.24), 1.42, -2.0, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      addBox(g, 0.12, 0.18, D * 0.9, materials.stoneLight, side * (W / 2 + 0.24), 4.3, -D / 2, 0, false);
      addBox(g, 0.12, 0.18, D * 0.9, materials.stoneLight, side * (W / 2 + 0.24), 8.5, -D / 2, 0, false);
    });

    /* 廊下壁灯与木梁：只给主展示段 16–20 号，控制 draw calls */
    if (opt.name === "indian-residences") {
      for (var lv2 = 0; lv2 < levels; lv2++) {
        var by = lv2 * 4.2;
        for (var lb = 1; lb < bays; lb += 2) {
          var lbx = -W / 2 + lb * bayW;
          addBox(g, 0.1, 3.5, 0.14, materials.iron, lbx, by + 1.85, -2.52, 0, false);
          var globe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), materials.lamp);
          globe.position.set(lbx, by + 3.4, -2.42);
          g.add(globe);
        }
        for (var bb = 0; bb <= bays; bb += 2) {
          addBox(g, 0.14, 0.16, 2.8, materials.wood, -W / 2 + bb * bayW, by + 4.0, -1.4, 0, false);
        }
      }
      /* 券廊后墙的绿色百叶：两层都可见 */
      for (var lv3 = 0; lv3 < levels; lv3++) {
        for (var sb = 0; sb < bays; sb++) {
          var sbx = -W / 2 + bayW * (sb + 0.5);
          addInstance(inst.shutters, baseMatrix(cx, zFront, yaw), sbx - 0.68, lv3 * 4.2 + 2.5, -2.58, 0, 1.65, 1.1, 1);
          addInstance(inst.shutters, baseMatrix(cx, zFront, yaw), sbx + 0.68, lv3 * 4.2 + 2.5, -2.58, 0, 1.65, 1.1, 1);
        }
      }
    }

    root.add(g);
    addFacade(baseMatrix(cx, zFront, yaw), {
      width: W,
      levels: levels,
      floors: floors,
      archKey: opt.archKey || "cream",
      doorEvery: opt.doorEvery || 3,
      shutters: !!opt.shutters
    });
    return g;
  }

  function buildLourdes() {
    var g = new THREE.Group();
    g.name = "lourdes";
    var cx = 78, zFront = -9;
    g.position.set(cx, 0, zFront);
    var ivory = materials.ivory;
    var stone = materials.stoneLight;

    function crossAt(x, y, z, scale) {
      addBox(g, 0.1 * scale, 0.95 * scale, 0.1 * scale, materials.gold, x, y + 0.48 * scale, z, 0, false);
      addBox(g, 0.6 * scale, 0.1 * scale, 0.1 * scale, materials.gold, x, y + 0.66 * scale, z, 0, false);
    }

    /* 大堂：11 × 22 m，檐高 9 m，脊高 13.4 m */
    addBox(g, 11, 9, 22, ivory, 0, 4.5, -11);
    addBox(g, 11.5, 1.0, 22.5, stone, 0, 0.5, -11, 0, false);
    addBox(g, 11.5, 0.24, 22.5, stone, 0, 8.88, -11, 0, false);
    [-5.5, 5.5].forEach(function (x) {
      addBox(g, 0.34, 9, 0.2, stone, x, 4.5, 0.09, 0, false);
    });

    /* 双侧低侧廊 + 单坡瓦屋面 */
    var aisleAngle = Math.atan2(1.35, 3.2);
    [-1, 1].forEach(function (side) {
      var ax = side * 7.1;
      addBox(g, 3.2, 7.0, 18, ivory, ax, 3.5, -10);
      addBox(g, 3.5, 0.95, 18.4, stone, ax, 0.48, -10, 0, false);
      addBox(g, 3.45, 0.2, 18.3, stone, ax, 6.95, -10, 0, false);
      var slab = addBox(g, 3.5, 0.2, 18.6, materials.slate, side * 7.08, 7.62, -10, 0, false);
      slab.rotation.z = -side * aisleAngle;
      addBox(g, 0.26, 0.22, 18.5, stone, side * 8.8, 6.92, -10, 0, false);
      /* 侧廊外窗 */
      for (var i = 0; i < 4; i++) {
        var win = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.3), materials.pointed);
        win.position.set(side * 8.72, 3.9, -4.2 - i * 4.3);
        win.rotation.y = side * Math.PI / 2;
        g.add(win);
        addBox(g, 0.16, 2.8, 0.36, stone, side * 8.78, 3.9, -4.2 - i * 4.3 - 1.05, 0, false);
        addBox(g, 0.16, 2.8, 0.36, stone, side * 8.78, 3.9, -4.2 - i * 4.3 + 1.05, 0, false);
      }
      /* 侧廊正面尖窗 */
      var frontWin = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.2), materials.pointed);
      frontWin.position.set(ax, 3.4, -0.97);
      g.add(frontWin);
      addBox(g, 0.22, 2.7, 0.16, stone, ax - 0.66, 3.4, -0.94, 0, false);
      addBox(g, 0.22, 2.7, 0.16, stone, ax + 0.66, 3.4, -0.94, 0, false);
      addBox(g, 1.6, 0.16, 0.16, stone, ax, 4.74, -0.94, 0, false);
      /* 侧面扶壁 */
      [-4.5, -10.5, -16.5].forEach(function (bz) {
        addBox(g, 0.48, 5.8, 0.52, stone, side * 8.86, 2.9, bz, 0, false);
        addBox(g, 0.64, 0.3, 0.68, stone, side * 8.9, 5.85, bz, 0, false);
      });
      /* 侧廊山尖小尖饰 */
      addCyl(g, 0, 0.26, 1.3, 4, stone, side * 8.62, 8.1, -1.05);
    });

    /* 主屋面：脊线沿 Z，出檐 0.55 m */
    var naveAngle = Math.atan2(4.4, 6.05);
    [-1, 1].forEach(function (side) {
      var roof = addBox(g, 8.0, 0.22, 22.6, materials.slate, side * 3.02, 11.2, -11.1, 0, false);
      roof.rotation.z = -side * naveAngle;
    });
    var ridge = addCyl(g, 0.2, 0.2, 22.8, 6, materials.slateDark, 0, 13.5, -11.1);
    ridge.rotation.x = Math.PI / 2;
    [-1.8, -11.1, -20.2].forEach(function (rz) {
      addCyl(g, 0.0, 0.24, 0.85, 4, materials.slateDark, 0, 13.85, rz);
    });
    [-1, 1].forEach(function (side) {
      addBox(g, 0.16, 0.16, 22.7, stone, side * 6.08, 8.97, -11.1, 0, false);
    });

    /* 前山墙与石压顶 */
    var gableShape = new THREE.Shape();
    gableShape.moveTo(-5.5, 0);
    gableShape.lineTo(5.5, 0);
    gableShape.lineTo(0, 4.4);
    gableShape.lineTo(-5.5, 0);
    var gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.36, bevelEnabled: false });
    gableGeo.translate(0, 9, -0.18);
    var gable = new THREE.Mesh(gableGeo, ivory);
    gable.castShadow = true;
    g.add(gable);
    [-1, 1].forEach(function (side) {
      var cope = addBox(g, 7.55, 0.2, 0.3, materials.slateDark, side * 3.02, 11.2, 0.22, 0, false);
      cope.rotation.z = -side * naveAngle;
    });
    crossAt(0, 13.42, 0.26, 1.05);

    /* 玫瑰窗 */
    var rose = new THREE.Mesh(new THREE.CircleGeometry(1.45, 28), materials.rose);
    rose.position.set(0, 7.45, 0.06);
    g.add(rose);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.53, 0.12, 8, 32), stone);
    ring.position.set(0, 7.45, 0.08);
    g.add(ring);

    /* 入口：尖拱门洞、石框、山花、三级台阶 */
    var entrance = new THREE.Mesh(makePointedArchGeometry(3.4, 4.3, 0.32), stone);
    entrance.position.set(0, 0.28, 0.04);
    g.add(entrance);
    var portal = new THREE.Mesh(new THREE.ShapeGeometry(pointedDoorShape(1.45, 2.2, 3.95)), materials.dark);
    portal.position.set(0, 0.3, 0.055);
    g.add(portal);
    var door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), materials.door);
    door.position.set(0, 1.72, 0.07);
    g.add(door);
    [-1.75, 1.75].forEach(function (x) {
      addBox(g, 0.5, 4.1, 0.4, stone, x, 2.35, 0.26, 0, false);
    });
    var pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-2.25, 0);
    pedimentShape.lineTo(2.25, 0);
    pedimentShape.lineTo(0, 1.25);
    pedimentShape.lineTo(-2.25, 0);
    var pedimentGeo = new THREE.ExtrudeGeometry(pedimentShape, { depth: 0.34, bevelEnabled: false });
    pedimentGeo.translate(0, 4.55, 0.16);
    var pediment = new THREE.Mesh(pedimentGeo, materials.stone);
    pediment.castShadow = true;
    g.add(pediment);
    var pCopeL = addBox(g, 2.45, 0.16, 0.4, materials.slateDark, -1.15, 5.08, 0.24, 0, false);
    pCopeL.rotation.z = 0.5;
    var pCopeR = addBox(g, 2.45, 0.16, 0.4, materials.slateDark, 1.15, 5.08, 0.24, 0, false);
    pCopeR.rotation.z = -0.5;
    crossAt(0, 5.86, 0.26, 0.55);
    [[6.1, 0.3, 1.1], [5.4, 0.18, 0.8], [4.7, 0.1, 0.5]].forEach(function (st) {
      addBox(g, st[0], st[1], st[2], stone, 0, 0.28 - st[1] / 2, 0.32 + st[2] / 2, 0, false);
    });

    /* 立面两侧尖窗与门牌 */
    [-3.0, 3.0].forEach(function (x) {
      var sideWin = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.2), materials.pointed);
      sideWin.position.set(x, 3.25, 0.05);
      g.add(sideWin);
      addBox(g, 0.14, 2.6, 0.18, stone, x - 0.55, 3.25, 0.1, 0, false);
      addBox(g, 0.14, 2.6, 0.18, stone, x + 0.55, 3.25, 0.1, 0, false);
      addBox(g, 1.34, 0.16, 0.18, stone, x, 4.5, 0.1, 0, false);
    });
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), materials.plaque14);
    plaque.position.set(-4.55, 2.35, 0.06);
    g.add(plaque);
    /* 门前灯 */
    [-2.35, 2.35].forEach(function (x) {
      addCyl(g, 0.04, 0.06, 2.1, 6, materials.iron, x, 1.35, 0.55);
      var globe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), materials.lamp);
      globe.position.set(x, 2.48, 0.55);
      g.add(globe);
    });

    /* 钟塔：收细到 4.2 m，加扶壁、线脚、百叶钟窗与八棱尖顶 */
    var tx = 6.15, tz = -2.3, tw = 4.2;
    addBox(g, tw, 18.8, tw, ivory, tx, 9.4, tz);
    [8.9, 13.6, 18.25].forEach(function (y) {
      addBox(g, tw + 0.34, 0.24, tw + 0.34, stone, tx, y, tz, 0, false);
    });
    addBox(g, tw + 0.5, 0.3, tw + 0.5, stone, tx, 18.95, tz, 0, false);
    /* 角部扶壁/束柱 */
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sz) {
        addBox(g, 0.58, 12.2, 0.58, stone, tx + sx * (tw / 2 - 0.1), 6.1, tz + sz * (tw / 2 - 0.1), 0, false);
        addBox(g, 0.4, 5.4, 0.4, stone, tx + sx * (tw / 2 - 0.05), 16.3, tz + sz * (tw / 2 - 0.05), 0, false);
        addBox(g, 0.62, 0.26, 0.62, stone, tx + sx * (tw / 2 - 0.1), 12.3, tz + sz * (tw / 2 - 0.1), 0, false);
      });
    });
    /* 钟窗（四面百叶） */
    [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]].forEach(function (face) {
      var f = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.7), materials.belfry);
      f.position.set(tx + face[0] * (tw / 2 + 0.011), 16.0, tz + face[1] * (tw / 2 + 0.011));
      f.rotation.y = face[2];
      g.add(f);
      addBox(g, face[0] ? 0.16 : 1.5, 0.16, face[1] ? 0.16 : 1.5, stone,
        tx + face[0] * (tw / 2 + 0.04), 14.6, tz + face[1] * (tw / 2 + 0.04), 0, false);
    });
    /* 塔身下部尖窗：正面与东面 */
    [[0, 0.01, 0], [1, 0.01, Math.PI / 2]].forEach(function (face) {
      var w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.15), materials.pointed);
      w.position.set(tx + face[0] * (tw / 2 + 0.015), 10.6, tz + (face[0] ? 0 : tw / 2 + 0.015));
      w.rotation.y = face[2];
      g.add(w);
    });
    /* 四角小尖饰 */
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sz) {
        addBox(g, 0.44, 0.5, 0.44, stone, tx + sx * (tw / 2 - 0.12), 19.35, tz + sz * (tw / 2 - 0.12), 0, false);
        addCyl(g, 0, 0.28, 0.9, 4, stone, tx + sx * (tw / 2 - 0.12), 20.05, tz + sz * (tw / 2 - 0.12));
      });
    });
    var spire = new THREE.Mesh(new THREE.ConeGeometry(2.88, 6.4, 8), materials.slate);
    spire.position.set(tx, 22.2, tz);
    spire.rotation.y = Math.PI / 8;
    spire.castShadow = true;
    g.add(spire);
    var apex = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), materials.slateDark);
    apex.position.set(tx, 25.45, tz);
    g.add(apex);
    crossAt(tx, 25.55, tz, 0.9);

    root.add(g);

    return g;
  }

  function buildGarden() {
    var g = new THREE.Group();
    g.name = "lourdes-garden";
    var x0 = 86.9, x1 = 105.0, z0 = -9.0, z1 = -30.0;
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), materials.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((x0 + x1) / 2, 0.035, (z0 + z1) / 2);
    ground.receiveShadow = true;
    g.add(ground);

    /* 南侧矮墙 + 铁门（门洞两侧分段，不封死入口） */
    addBox(g, 4.2, 0.95, 0.42, materials.stoneLight, 88.9, 0.48, z0, 0, false);
    addBox(g, 11.3, 0.95, 0.42, materials.stoneLight, 99.65, 0.48, z0, 0, false);
    addBox(g, 0.42, 0.95, z0 - z1, materials.stoneLight, x1, 0.48, (z0 + z1) / 2, 0, false);
    /* 后侧绿篱压低，后面补树线 */
    addBox(g, x1 - x0, 1.3, 0.85, materials.hedge, (x0 + x1) / 2, 0.72, z1 + 0.43, 0, false);
    addBox(g, 0.85, 1.6, z0 - z1, materials.hedge, x1 - 0.42, 0.86, (z0 + z1) / 2, 0, false);
    addBox(g, 1.0, 1.5, z0 - z1, materials.hedge, x0 + 0.5, 0.8, (z0 + z1) / 2, 0, false);
    /* 门柱与铁门 */
    addBox(g, 0.5, 1.5, 0.5, materials.stoneLight, 91.0, 0.75, z0, 0, false);
    addBox(g, 0.5, 1.5, 0.5, materials.stoneLight, 94.0, 0.75, z0, 0, false);
    for (var i = 0; i < 6; i++) {
      addBox(g, 0.06, 1.2, 0.06, materials.iron, 91.35 + i * 0.43, 0.6, z0, 0, false);
    }
    addBox(g, 3.0, 0.06, 0.06, materials.iron, 92.5, 1.05, z0, 0, false);

    /* 小径：铺石主径 + 横向支径 */
    addBox(g, 2.2, 0.04, 12, materials.paving, 92.5, 0.045, -15.5, 0, false);
    addBox(g, 10, 0.04, 2.0, materials.paving, 95, 0.045, -22, 0, false);
    addBox(g, 1.5, 0.04, 4.0, materials.paving, 98.4, 0.045, -24.0, 0, false);
    /* 路边低绿篱，给草坪收边 */
    [[90.9, -16.5, 0.5, 8.0], [94.2, -16.5, 0.5, 8.0]].forEach(function (h) {
      addBox(g, h[2], 0.42, h[3], materials.hedge, h[0], 0.3, h[1], 0, false);
    });

    /* 圣母山：深色岩洞 + 白石像 + 石台，龛口朝南 */
    var grottoX = 98.6, grottoZ = -25.2;
    var rocks = new THREE.Group();
    rocks.position.set(grottoX, 0, grottoZ);
    addBox(rocks, 5.2, 0.4, 3.4, materials.stone, 0, 0.2, 0.9, 0, false);
    addBox(rocks, 4.6, 0.3, 0.9, materials.stone, 0, 0.52, 1.9, 0, false);
    addBox(rocks, 4.0, 3.5, 0.6, materials.dark, 0, 2.1, -1.25, 0, false);
    [-1, 1].forEach(function (side) {
      for (var r = 0; r < 5; r++) {
        var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62 + rnd() * 0.38, 0), materials.grottoRock);
        rock.position.set(side * (1.45 + rnd() * 0.55), 0.55 + r * 0.62, -0.55 + rnd() * 0.45);
        rock.rotation.set(rnd(), rnd(), rnd());
        rock.scale.set(1.0, 1.2, 0.85);
        rock.castShadow = true;
        rocks.add(rock);
      }
    });
    for (var rr = 0; rr < 7; rr++) {
      var lintel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rnd() * 0.3, 0), materials.grottoRock);
      lintel.position.set(-1.8 + rr * 0.6, 3.15 + rnd() * 0.3, -0.5 + rnd() * 0.25);
      lintel.rotation.set(rnd(), rnd(), rnd());
      lintel.scale.set(1.15, 0.75, 0.85);
      lintel.castShadow = true;
      rocks.add(lintel);
    }
    var statue = new THREE.Group();
    addCyl(statue, 0.14, 0.24, 0.72, 8, materials.statue, 0, 0.36, 0);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), materials.statue);
    head.position.set(0, 0.8, 0);
    statue.add(head);
    var halo = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 6, 18), materials.gold);
    halo.position.set(0, 0.94, -0.02);
    statue.add(halo);
    statue.position.set(0, 0.52, 0.68);
    statue.scale.setScalar(1.35);
    rocks.add(statue);
    addBox(rocks, 2.6, 0.26, 1.1, materials.stone, 0, 0.38, 0.75, 0, false);
    [-0.8, 0.8].forEach(function (x) {
      addCyl(rocks, 0.05, 0.07, 0.26, 6, materials.lamp, x, 0.62, 1.45);
    });
    [-2.5, 2.5].forEach(function (x) {
      var shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), materials.leafC);
      shrub.position.set(x, 0.6, 0.6);
      shrub.scale.y = 0.85;
      shrub.castShadow = true;
      rocks.add(shrub);
    });
    /* 岩顶爬藤：压住规则的石块轮廓 */
    [[-1.75, 3.05, 0.25, 0.45], [-0.8, 3.5, 0.1, 0.4], [0.3, 3.45, 0.3, 0.5], [1.35, 3.2, 0.15, 0.45], [2.0, 2.9, 0.35, 0.32]].forEach(function (iv) {
      var vine = new THREE.Mesh(new THREE.IcosahedronGeometry(iv[3], 0), materials.leafC);
      vine.position.set(iv[0], iv[1], iv[2]);
      vine.scale.set(1.3, 0.8, 0.9);
      vine.castShadow = true;
      rocks.add(vine);
    });
    g.add(rocks);

    /* 花坛：细花 + 绿篱，避免一团粉色球 */
    [[88.4, -12.5, 2.8, 1.6, materials.flowerPink], [102.2, -13.8, 2.4, 1.5, materials.flowerWhite], [89.4, -26.6, 2.2, 1.3, materials.flowerPink]].forEach(function (f) {
      addBox(g, f[2], 0.3, f[3], materials.stoneLight, f[0], 0.15, f[1], 0, false);
      addBox(g, f[2] - 0.3, 0.24, f[3] - 0.3, materials.soil, f[0], 0.34, f[1], 0, false);
      for (var k = 0; k < 26; k++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.055 + rnd() * 0.05, 5, 4), f[4]);
        s.position.set(f[0] + (rnd() - 0.5) * f[2] * 0.82, 0.48 + rnd() * 0.14, f[1] + (rnd() - 0.5) * f[3] * 0.72);
        g.add(s);
      }
      for (var b = 0; b < 5; b++) {
        var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 + rnd() * 0.16, 0), materials.leafB);
        bush.position.set(f[0] + (rnd() - 0.5) * f[2] * 0.7, 0.5, f[1] + (rnd() - 0.5) * f[3] * 0.6);
        g.add(bush);
      }
    });

    /* 长椅：面朝圣母山 */
    [[94.0, -18.4], [101.2, -19.2]].forEach(function (p) {
      var bench = new THREE.Group();
      bench.position.set(p[0], 0, p[1]);
      bench.rotation.y = Math.PI;
      addBox(bench, 1.6, 0.08, 0.5, materials.wood, 0, 0.46, 0, 0, false);
      addBox(bench, 1.6, 0.07, 0.42, materials.wood, 0, 0.78, -0.24, 0, false);
      [-0.62, 0.62].forEach(function (x) {
        addBox(bench, 0.07, 0.44, 0.46, materials.iron, x, 0.25, 0, 0, false);
        addBox(bench, 0.07, 0.4, 0.07, materials.iron, x, 0.62, -0.25, 0, false);
      });
      g.add(bench);
    });

    /* 花园树：沿后墙一排，压住城市块 */
    [[89.3, -28.0, 0.52], [93.5, -28.6, 0.62], [97.2, -29.2, 1.2], [102.0, -28.6, 0.75], [104.0, -19.0, 0.5]].forEach(function (t) {
      buildSmallTree(t[0], t[1], t[2]);
    });
    for (var hb = 0; hb < 7; hb++) {
      var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.4, 0), [materials.leafB, materials.leafC][hb % 2]);
      bush.position.set(88.5 + hb * 2.5, 1.05 + rnd() * 0.3, -29.1);
      bush.scale.y = 0.75;
      bush.castShadow = true;
      g.add(bush);
    }

    /* 花园灯 */
    var gl = new THREE.PointLight(0xffb86b, 0, 12, 2);
    gl.position.set(96, 2.2, -20);
    root.add(gl);
    gardenLights.push(gl);
    [[92.2, -20.0], [100.8, -22.0]].forEach(function (p) {
      addCyl(g, 0.05, 0.07, 2.3, 6, materials.iron, p[0], 1.15, p[1]);
      var top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), materials.lamp);
      top.position.set(p[0], 2.38, p[1]);
      g.add(top);
    });

    root.add(g);
    return g;
  }

  function buildQiChang() {
    var cx = -50, zFront = -9, W = 22.4, D = 18, H = 14.8;
    var g = new THREE.Group();
    g.name = "qichang";
    g.position.set(cx, 0, zFront);

    addBox(g, W, H - 4.2, D - 2.8, materials.washStone, 0, 4.2 + (H - 4.2) / 2, -2.8 - (D - 2.8) / 2);
    addBox(g, W, H - 12.6, 0.42, materials.washStone, 0, 12.6 + (H - 12.6) / 2, -0.21);
    addBox(g, 0.42, 4.2, D, materials.washStone, -W / 2, 2.1, -D / 2);
    addBox(g, W, 4.2, 0.42, materials.washStone, 0, 2.1, -D);
    addBox(g, W - 0.4, 0.1, 2.75, materials.paving, 0, 0.06, -1.4, 0, false);
    addBox(g, W, 0.16, 2.8, materials.stoneLight, 0, 4.15, -1.4, 0, false);
    addBox(g, W + 0.1, 0.8, 0.3, materials.stone, 0, 0.4, 0.02, 0, false);
    [4.2, 8.4].forEach(function (y) {
      addBox(g, W - 0.4, 0.1, 2.75, materials.paving, 0, y + 0.06, -1.4, 0, false);
      addBox(g, W, 0.16, 2.8, materials.stoneLight, 0, y + 4.15, -1.4, 0, false);
      addBox(g, W, 4.2, 0.34, materials.washStone, 0, y + 2.1, -2.78);
    });
    [8.46, 12.66].forEach(function (y) {
      addBox(g, W + 0.14, 0.12, 0.42, materials.stoneLight, 0, y, 0.03, 0, false);
    });
    var upperBays = Math.max(2, Math.round(W / 3.2));
    var upperBayW = W / upperBays;
    for (var uy = 0; uy < 2; uy++) {
      for (var ub = 0; ub < upperBays; ub++) {
        addInstance(rnd() < 0.18 ? inst.winWarm : inst.winDark, baseMatrix(cx, zFront, 0),
          -W / 2 + upperBayW * (ub + 0.5), 6.45 + uy * 4.2, -2.75, 0);
      }
    }
    addBox(g, W + 0.4, 0.25, D + 0.3, materials.stone, 0, 4.22, -D / 2, 0, false);
    addBox(g, W + 0.5, 0.55, 0.45, materials.stoneLight, 0, H + 0.28, 0.05, 0, false);
    addBox(g, W + 0.55, 0.16, 0.55, materials.stoneLight, 0, H + 0.02, 0.02, 0, false);

    var roof = new THREE.Mesh(makeHipRoofGeometry(W + 0.8, D + 0.8, 2.5, 1.2), materials.roof);
    roof.position.set(0, H, -D / 2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);

    root.add(g);

    /* 南立面 */
    addFacade(baseMatrix(cx, zFront, 0), { width: W, levels: 3, floors: 3, archKey: "stone", doorEvery: 3 });

    /* 东立面（面向四街） */
    var eastX = cx + W / 2;
    var eastBase = baseMatrix(eastX, zFront - D / 2, Math.PI / 2);
    addFacade(eastBase, { width: D, levels: 3, floors: 3, archKey: "stone", doorEvery: 4 });

    /* 西侧墙：从大街西望时不再是一整面白墙 */
    var westBase = baseMatrix(cx - W / 2, zFront - D / 2, -Math.PI / 2);
    [-D * 0.25, D * 0.25].forEach(function (lz) {
      addInstance(inst.winDark, westBase, lz, 6.4, 0.24, 0);
      addInstance(inst.winDark, westBase, lz, 9.7, 0.24, 0);
    });
    addInstance(inst.doors, westBase, 0, 1.42, 0.24, 0);

    /* 东南切角入口 */
    var corner = new THREE.Group();
    corner.position.set(cx + W / 2 - 1.6, 0, zFront - 1.6);
    corner.rotation.y = Math.PI / 4;
    addBox(corner, 5.2, 4.2, 0.42, materials.stoneLight, 0, 2.1, -0.9, 0, false);
    addBox(corner, 5.2, H - 4.2, 0.55, materials.stoneLight, 0, 4.2 + (H - 4.2) / 2, -1.05, 0, false);
    addBox(corner, 5.6, 0.55, 0.5, materials.stoneLight, 0, H + 0.28, -0.7, 0, false);
    var cornerArch = new THREE.Mesh(makeArchGeometry(3.4, 4.6, 0.36), materials.stone);
    cornerArch.position.set(0, 0, 0);
    corner.add(cornerArch);
    var door = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.0), materials.door);
    door.position.set(0, 1.5, -0.55);
    corner.add(door);
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), materials.plaque48);
    plaque.position.set(0, 5.1, 0.02);
    corner.add(plaque);
    root.add(corner);
    addInstance(inst.winDark, baseMatrix(corner.position.x, corner.position.z, Math.PI / 4), 0, 6.4, 0.045, 0);
    addInstance(inst.winDark, baseMatrix(corner.position.x, corner.position.z, Math.PI / 4), 0, 9.8, 0.045, 0);
  }

  function buildSouthRow() {
    buildRowBuilding({
      cx: 60, zFront: 9, width: 19.2, depth: 14, height: 14.2, floors: 3,
      side: "south", wallMat: materials.cream, archKey: "cream", name: "south-cream"
    });
    buildRowBuilding({
      cx: 26, zFront: 9, width: 12.8, depth: 14, height: 14.2, floors: 3,
      side: "south", wallMat: materials.brick, archKey: "stone", name: "south-brick"
    });
    buildRowBuilding({
      cx: -12, zFront: 9, width: 16, depth: 14, height: 13.8, floors: 3,
      side: "south", wallMat: materials.mint, archKey: "mint", name: "south-mint", shutters: true
    });
  }

  function buildHongLou(cx, zFront) {
    var W = 18, D = 14, H = 15.2;
    var g = new THREE.Group();
    g.name = "honglou-2-6";
    g.position.set(cx, 0, zFront);
    addBox(g, W, H, D, materials.brick, 0, H / 2, -D / 2);
    addBox(g, W + 0.3, 0.95, D + 0.3, materials.stone, 0, 0.48, -D / 2, 0, false);
    [4.7, 9.3, 13.9].forEach(function (y) {
      addBox(g, W + 0.2, 0.2, D + 0.2, materials.stoneLight, 0, y, -D / 2, 0, false);
    });
    [-1, 1].forEach(function (s) {
      addBox(g, 0.4, H, 0.3, materials.stoneLight, s * (W / 2 - 0.15), H / 2, 0.1, 0, false);
    });
    var base = baseMatrix(cx, zFront, 0);
    var bays = 5, bayW = W / bays;
    for (var row = 0; row < 3; row++) {
      for (var b = 0; b < bays; b++) {
        addInstance(inst.winDark, base, -W / 2 + bayW * (b + 0.5), 2.9 + row * 4.6, 0.06, 0);
      }
    }
    [-1, 1].forEach(function (side) {
      var sb = baseMatrix(cx + side * (W / 2 + 0.26), zFront - D / 2, side * Math.PI / 2);
      [-4.0, 0, 4.0].forEach(function (lz) {
        [6.2, 10.8].forEach(function (y) { addInstance(inst.winDark, sb, lz, y, 0, 0); });
      });
    });
    /* 双坡瓦顶 + 两个临街山尖 */
    var roof = new THREE.Mesh(makeHipRoofGeometry(W + 0.9, D + 0.9, 3.4, 1.3), materials.roof);
    roof.position.set(0, H, -D / 2);
    roof.castShadow = true;
    g.add(roof);
    [-4.4, 4.4].forEach(function (gx) {
      var shape = new THREE.Shape();
      shape.moveTo(-1.9, 0);
      shape.lineTo(1.9, 0);
      shape.lineTo(0, 2.2);
      shape.lineTo(-1.9, 0);
      var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
      var gable = new THREE.Mesh(geo, materials.brick);
      gable.position.set(gx, H, -0.5);
      gable.castShadow = true;
      g.add(gable);
      addBox(g, 0.8, 1.0, 0.14, materials.stoneLight, gx, H + 0.7, 0.06, 0, false);
    });
    root.add(g);
  }

  function buildStreetEnds() {
    buildHongLou(116, -9);
    buildRowBuilding({
      cx: 96, zFront: 9, width: 23, depth: 14, height: 12.8, floors: 3,
      side: "south", wallMat: materials.mint, archKey: "cream", name: "south-east", shutters: true
    });

    /* 东西端低层屋顶线 + 树线，收住发白的街道尽头 */
    var far = [
      [127, -25, 18, 8.5, 13, materials.yellow],
      [131, 26, 21, 7.5, 14, materials.mint],
      [146, 2, 11, 6.5, 20, materials.cream],
      [-127, -24, 19, 8, 13, materials.cream],
      [-132, 22, 18, 9, 14, materials.yellow],
      [-147, -2, 12, 6, 20, materials.mint]
    ];
    far.forEach(function (b) {
      addBox(root, b[2], b[3], b[4], b[5], b[0], b[3] / 2, b[1], 0, false);
      var r = new THREE.Mesh(makeHipRoofGeometry(b[2] + 0.8, b[4] + 0.8, 2.0, 0.9), materials.roof);
      r.position.set(b[0], b[3], b[1]);
      root.add(r);
    });

    var trees = [];
    for (var i = 0; i < 9; i++) {
      var tx = 118 + i * 6.2;
      trees.push([tx, -13.5 + (i % 2) * 2.4, 3.0 + (i % 3) * 0.7]);
      trees.push([-118 - i * 6.2, -12.0 + (i % 2) * 2.0, 3.1 + (i % 3) * 0.6]);
    }
    for (var j = 0; j < 6; j++) {
      trees.push([-46 + j * 20, -38 - (j % 2) * 4, 3.6 + (j % 3) * 0.5]);
    }
    /* 街口正对的一丛大树，堵住街道尽头的天空缺口 */
    [[-112, 0, 2.2], [-120, -8, 2.1], [-120, 8, 2.0], [112, 0, 2.2], [120, -8, 2.1], [120, 8, 2.0]].forEach(function (t) {
      buildSmallTree(t[0], t[1], t[2]);
    });
    trees.forEach(function (t, k) {
      var baseY = 4.6 + t[2] * 0.5;
      for (var qi = 0; qi < 3; qi++) {
        var key = ["A", "B", "C"][(k + qi) % 3];
        var off = qi === 0 ? [0, 0.35, 0] : [Math.cos(qi * 2.4) * t[2] * 0.55, 0.05, Math.sin(qi * 2.4) * t[2] * 0.55];
        canopyInst[key].push(new THREE.Matrix4().compose(
          new THREE.Vector3(t[0] + off[0], baseY + off[1] * t[2], t[1] + off[2]),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI, 0)),
          new THREE.Vector3(t[2] * (qi === 0 ? 1.0 : 0.78), t[2] * 0.72, t[2] * (qi === 0 ? 1.0 : 0.78))
        ));
      }
      pushBeamMatrix(inst.timber, new THREE.Vector3(t[0], 0.02, t[1]),
        new THREE.Vector3(t[0] + 0.3, baseY, t[1] + 0.2), 0.26 * t[2], 0, 0);
    });
  }

  function buildStreetLife() {
    /* 16–20 号券廊下的咖啡座（不落店招，只做桌椅） */
    var cafe = new THREE.Group();
    cafe.name = "cafe-seating";
    [36.6, 40.4, 44.2].forEach(function (x) {
      addCyl(cafe, 0.44, 0.44, 0.05, 12, materials.wood, x, 0.76, -10.5);
      addCyl(cafe, 0.05, 0.07, 0.72, 6, materials.iron, x, 0.38, -10.5);
      addCyl(cafe, 0.22, 0.3, 0.05, 8, materials.iron, x, 0.03, -10.5, 0);
      [-0.72, 0.72].forEach(function (dx) {
        var cz = dx > 0 ? -9.75 : -11.25;
        addBox(cafe, 0.44, 0.05, 0.42, materials.wood, x + dx * 0.6, 0.46, cz, 0, false);
        addBox(cafe, 0.44, 0.48, 0.05, materials.wood, x + dx * 0.6, 0.72, cz + (dx > 0 ? 0.19 : -0.19), 0, false);
        [-0.16, 0.16].forEach(function (lz) {
          [-0.16, 0.16].forEach(function (lx) {
            addBox(cafe, 0.04, 0.44, 0.04, materials.iron, x + dx * 0.6 + lx, 0.22, cz + lz, 0, false);
          });
        });
      });
    });
    root.add(cafe);

    /* 人行道长凳、花池、路牌、石墩 */
    [[56.5, -7.55], [-5.5, 7.55], [-58.5, -7.55]].forEach(function (p) {
      var b = new THREE.Group();
      b.position.set(p[0], 0, p[1]);
      b.rotation.y = p[1] < 0 ? 0 : Math.PI;
      addBox(b, 1.8, 0.08, 0.52, materials.wood, 0, 0.47, 0, 0, false);
      addBox(b, 1.8, 0.07, 0.44, materials.wood, 0, 0.8, -0.25, 0, false);
      [-0.7, 0.7].forEach(function (x) {
        addBox(b, 0.07, 0.44, 0.48, materials.iron, x, 0.24, 0, 0, false);
        addBox(b, 0.07, 0.42, 0.07, materials.iron, x, 0.63, -0.26, 0, false);
      });
      root.add(b);
    });

    [[48.5, -7.35], [-14.5, 7.35], [70.5, 7.35], [-66, -7.35]].forEach(function (p) {
      addBox(root, 1.5, 0.55, 0.7, materials.stoneLight, p[0], 0.28, p[1], 0, false);
      var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), materials.leafB);
      bush.position.set(p[0], 0.68, p[1]);
      bush.scale.set(1.15, 0.7, 0.9);
      bush.castShadow = true;
      root.add(bush);
    });

    /* 路缘排水沟：加深街沿阴影 */
    [-1, 1].forEach(function (side) {
      addBox(root, 220, 0.04, 0.34, materials.iron, 0, 0.045, side * 6.25, 0, false);
    });

    /* 街牌（西段再补一块，避免只在教堂前有） */
    var sign = new THREE.Group();
    sign.position.set(-38.5, 0, -8.15);
    addCyl(sign, 0.05, 0.065, 2.9, 7, materials.iron, 0, 1.45, 0);
    var plate = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), materials.sign);
    plate.position.set(0, 2.65, 0.03);
    sign.add(plate);
    var en = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), materials.signEn);
    en.position.set(0, 2.25, 0.03);
    sign.add(en);
    root.add(sign);
  }

  /* ---------------- 植被 ---------------- */

  function buildBanyan(x, z, s) {
    var trunkH = 4.3 * s;
    var v = function (px, py, pz) { return new THREE.Vector3(px, py, pz); };
    function timber(a, b, r) { pushBeamMatrix(inst.timber, a, b, r, x, z); }
    function rootBeam(a, b, r) { pushBeamMatrix(inst.rootTaper, a, b, r, x, z); }
    var pull = 0;
    if (z > 2 && z < 12) pull = -3.4 * s;
    if (z < -2 && z > -12) pull = 3.4 * s;

    /* 主干 + 多主干：两段收分，在 4–5 m 处并拢 */
    timber(v(0, 0.02, 0), v(0, trunkH * 0.5, 0), 0.82 * s);
    timber(v(0, trunkH * 0.45, 0), v(0, trunkH, 0), 0.62 * s);
    var stemN = low ? 3 : 4;
    for (var st = 0; st < stemN; st++) {
      var sa = (st / stemN) * Math.PI * 2 + 0.5 + rnd() * 0.25;
      var sr = (0.3 + rnd() * 0.08) * s;
      var s0 = v(Math.cos(sa) * 0.95 * s, 0.03, Math.sin(sa) * 0.95 * s);
      var s1 = v(Math.cos(sa) * 0.6 * s, trunkH * 0.44, Math.sin(sa) * 0.6 * s);
      var s2 = v(Math.cos(sa) * 0.24 * s, trunkH * (0.9 + rnd() * 0.12), Math.sin(sa) * 0.24 * s);
      timber(s0, s1, sr);
      timber(s1, s2, sr * 0.74);
      /* 板根：短而厚，贴着主干落地 */
      timber(v(Math.cos(sa) * 1.24 * s, 0.02, Math.sin(sa) * 1.24 * s), s1, sr * 0.56);
    }
    for (var bf = 0; bf < 3; bf++) {
      var ba = (bf / 3) * Math.PI * 2 + 0.9;
      timber(
        v(Math.cos(ba) * 1.3 * s, 0.02, Math.sin(ba) * 1.3 * s),
        v(Math.cos(ba) * 0.85 * s, 0.95 * s, Math.sin(ba) * 0.85 * s),
        0.16 * s
      );
    }

    /* 主枝：两段弯折收分，两级分叉，末梢带叶簇 */
    var clusters = [];
    var ends = [];
    var branchN = low ? 5 : 7;
    for (var b = 0; b < branchN; b++) {
      var a = (b / branchN) * Math.PI * 2 + rnd() * 0.35;
      var reach = (3.4 + rnd() * 2.2) * s;
      var ex = Math.cos(a) * reach;
      var ez = Math.sin(a) * reach + pull;
      var ey = trunkH + (1.2 + rnd() * 1.5) * s;
      var rMain = (0.22 + rnd() * 0.05) * s;
      var mx = ex * 0.52;
      var my = ey - (0.45 + rnd() * 0.25) * s;
      var mz = ez * 0.52;
      timber(v(0, trunkH * 0.68, 0), v(mx, my, mz), rMain);
      timber(v(mx, my, mz), v(ex, ey, ez), rMain * 0.62);
      ends.push([ex, ey, ez]);
      clusters.push([ex, ey + 0.5 * s, ez, 1.42 + rnd() * 0.42]);
      clusters.push([ex * 0.96, ey + 0.05 * s, ez * 0.96, 1.05 + rnd() * 0.3]);

      /* 二级分叉：从主枝中段向侧上方舒展 */
      var fA = a + (rnd() - 0.5) * 1.15;
      var fx = mx + Math.cos(fA) * (2.0 + rnd() * 1.3) * s;
      var fz = mz + Math.sin(fA) * (1.8 + rnd() * 1.3) * s;
      var fy = my + (0.45 + rnd() * 0.7) * s;
      timber(v(mx, my, mz), v(fx, fy, fz), rMain * 0.5);
      ends.push([fx, fy, fz]);
      clusters.push([fx, fy + 0.45 * s, fz, 1.15 + rnd() * 0.35]);

      /* 末梢细枝，把叶簇撑开 */
      var tA = a + (rnd() - 0.5) * 0.9;
      var tx = ex + Math.cos(tA) * (0.9 + rnd() * 0.9) * s;
      var tz = ez + Math.sin(tA) * (0.9 + rnd() * 0.9) * s;
      var ty = ey + (0.25 + rnd() * 0.55) * s;
      timber(v(ex, ey, ez), v(tx, ty, tz), rMain * 0.3);
      ends.push([tx, ty, tz]);
      clusters.push([tx, ty + 0.32 * s, tz, 0.85 + rnd() * 0.3]);
    }
    for (var c = 0; c < (low ? 4 : 6); c++) {
      var ca = (c / 6) * Math.PI * 2 + 0.4;
      var cr = (1.0 + rnd() * 2.2) * s;
      clusters.push([Math.cos(ca) * cr, trunkH + (3.0 + rnd() * 1.8) * s, Math.sin(ca) * cr + pull * 0.7, 1.35 + rnd() * 0.55]);
    }
    clusters.forEach(function (cl, i) {
      var key = ["A", "B", "C"][i % 3];
      canopyInst[key].push(new THREE.Matrix4().compose(
        new THREE.Vector3(x + cl[0], cl[1], z + cl[2]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.25)),
        new THREE.Vector3(cl[3] * s, cl[3] * s * 0.56, cl[3] * s)
      ));
    });

    /* 气根：从枝下垂直垂落，上粗下细，收在树冠下方 */
    var rootCount = low ? 3 : 4;
    for (var rr = 0; rr < rootCount; rr++) {
      var p = ends[Math.floor(rnd() * ends.length)];
      var topX = p[0] * (0.62 + rnd() * 0.3);
      var topZ = p[2] * (0.62 + rnd() * 0.3);
      var topY = p[1] - (0.15 + rnd() * 0.5) * s;
      var botY = Math.max(3.0, topY - (1.5 + rnd() * 1.7) * s);
      var drift = (rnd() - 0.5) * 0.3 * s;
      rootBeam(
        v(topX, topY, topZ),
        v(topX * 1.05 + drift, botY, topZ * 1.05 + drift),
        (0.044 + rnd() * 0.016) * s
      );
    }
  }

  function buildSmallTree(x, z, s) {
    var h = 3.0 * s;
    var a = new THREE.Vector3(x, 0.02, z);
    var b = new THREE.Vector3(x + 0.18 * s, h, z + 0.12 * s);
    pushBeamMatrix(inst.timber, a, b, 0.2 * s, 0, 0);
    pushBeamMatrix(inst.timber, new THREE.Vector3(x - 0.3 * s, 0.02, z + 0.2 * s),
      new THREE.Vector3(x + 0.45 * s, h * 0.82, z - 0.4 * s), 0.12 * s, 0, 0);
    var clusters = [
      [0, h + 0.6, 0, 1.35],
      [1.25, h + 0.25, 0.45, 0.95],
      [-1.15, h + 0.5, -0.5, 0.9],
      [0.25, h + 1.05, -1.0, 0.85],
      [-0.35, h + 0.85, 1.05, 0.8],
      [0.6, h + 0.15, -1.45, 0.7]
    ];
    clusters.forEach(function (c, i) {
      var key = ["A", "B", "C"][i % 3];
      canopyInst[key].push(new THREE.Matrix4().compose(
        new THREE.Vector3(x + c[0] * s, c[1], z + c[2] * s),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.2)),
        new THREE.Vector3(c[3] * s, c[3] * s * 0.8, c[3] * s)
      ));
    });
  }

  function buildPerson(x, z, coat, yaw) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw || 0;
    addCyl(g, 0.17, 0.22, 0.78, 7, coat, 0, 1.04, 0);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), materials.skin);
    head.position.set(0, 1.55, 0);
    head.castShadow = true;
    g.add(head);
    addCyl(g, 0.055, 0.07, 0.72, 5, materials.iron, -0.1, 0.36, 0);
    addCyl(g, 0.055, 0.07, 0.72, 5, materials.iron, 0.1, 0.36, 0);
    addCyl(g, 0.05, 0.06, 0.6, 5, coat, -0.24, 1.0, 0);
    addCyl(g, 0.05, 0.06, 0.6, 5, coat, 0.24, 1.0, 0);
    root.add(g);
    return g;
  }

  function buildPeople() {
    buildPerson(40, -7.2, materials.coatNavy, 0.3);
    buildPerson(28, 7.2, materials.cream, Math.PI - 0.4);
    buildPerson(-8, -7.2, materials.coatOlive, -0.5);
    buildPerson(60, -7.2, materials.coatBrick, 0.8);
    buildPerson(42.6, -10.35, materials.coatOlive, 2.5);
    buildPerson(70.5, -6.9, materials.coatNavy, -1.2);
  }

  function buildVegetation() {
    [
      [52, 0, 1.0], [10, 0, 1.15], [-34, 0, 1.0],
      [102, -21, 0.95],
      [88, 8, 0.9], [32, 8, 0.8], [-8, 8, 0.75]
    ].forEach(function (t) { buildBanyan(t[0], t[1], t[2]); });

    [
      [34, -7.4, 0.92], [34, 7.4, 0.92], [67, -7.2, 0.78]
    ].forEach(function (t) { buildBanyan(t[0], t[1], t[2]); });

    [
      [-70, -8, 0.7], [-58, 8, 0.75], [-20, -8, 0.68], [2, 8, 0.7],
      [24, -8, 0.66], [68, -12, 0.6], [94, 4, 0.64],
      [104, -6, 0.6], [-80, 8, 0.66]
    ].forEach(function (t) { buildSmallTree(t[0], t[1], t[2]); });
  }

  /* ---------------- 远景与标识 ---------------- */

  function buildDistant() {
    var northWater = new THREE.Mesh(new THREE.PlaneGeometry(260, 18), materials.water);
    northWater.rotation.x = -Math.PI / 2;
    northWater.position.set(0, -0.35, -62);
    root.add(northWater);
    addBox(root, 260, 1.1, 0.6, materials.stone, 0, 0.55, -52.8, 0, false);

    var southWater = new THREE.Mesh(new THREE.PlaneGeometry(320, 90), materials.water);
    southWater.rotation.x = -Math.PI / 2;
    southWater.position.set(0, -0.45, 120);
    root.add(southWater);

    var blocks = [];
    var blockGeo = new THREE.BoxGeometry(1, 1, 1);
    for (var i = 0; i < 30; i++) {
      var bx = -140 + rnd() * 280;
      var bz = -150 - rnd() * 80;
      var bh = 6 + rnd() * 18;
      var bw = 8 + rnd() * 14;
      var bd = 8 + rnd() * 14;
      var m = new THREE.Matrix4().compose(
        new THREE.Vector3(bx, bh / 2, bz),
        new THREE.Quaternion(),
        new THREE.Vector3(bw, bh, bd)
      );
      blocks.push(m);
    }
    var northCity = new THREE.InstancedMesh(blockGeo, materials.city, blocks.length);
    for (var b = 0; b < blocks.length; b++) northCity.setMatrixAt(b, blocks[b]);
    northCity.instanceMatrix.needsUpdate = true;
    northCity.frustumCulled = false;
    northCity.castShadow = false;
    northCity.receiveShadow = false;
    root.add(northCity);

    var southBlocks = [];
    for (var j = 0; j < 16; j++) {
      var sx = -150 + rnd() * 300;
      var sz = 220 + rnd() * 70;
      var sh = 5 + rnd() * 12;
      southBlocks.push(new THREE.Matrix4().compose(
        new THREE.Vector3(sx, sh / 2, sz),
        new THREE.Quaternion(),
        new THREE.Vector3(10 + rnd() * 18, sh, 10 + rnd() * 18)
      ));
    }
    var southCity = new THREE.InstancedMesh(blockGeo, materials.city, southBlocks.length);
    for (var s = 0; s < southBlocks.length; s++) southCity.setMatrixAt(s, southBlocks[s]);
    southCity.instanceMatrix.needsUpdate = true;
    southCity.frustumCulled = false;
    southCity.castShadow = false;
    root.add(southCity);

    /* 极简白天鹅剪影：只在南侧远景，不做 1:1 */
    addBox(root, 26, 70, 20, materials.white, -82, 35, 260, 0, false);

    cityWinMats.push(materials.cityWin);
  }

  function buildSigns() {
    var g = new THREE.Group();
    g.position.set(72.5, 0, -8.3);
    addCyl(g, 0.05, 0.065, 2.9, 7, materials.iron, 0, 1.45, 0);
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), materials.sign);
    sign.position.set(0, 2.65, 0.03);
    g.add(sign);
    var en = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), materials.signEn);
    en.position.set(0, 2.25, 0.03);
    g.add(en);
    root.add(g);

    var board = new THREE.Group();
    board.position.set(86.4, 0, -8.7);
    addBox(board, 0.12, 1.1, 0.12, materials.iron, -1.0, 0.55, 0, 0, false);
    addBox(board, 0.12, 1.1, 0.12, materials.iron, 1.0, 0.55, 0, 0, false);
    addBox(board, 2.3, 0.85, 0.06, materials.wood, 0, 1.25, 0, 0, false);
    addBox(board, 2.1, 0.65, 0.02, materials.plasterCream, 0, 1.25, 0.06, 0, false);
    root.add(board);
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "lourdes", no: "01", name: "露德圣母堂", craft: "church",
        pos: new THREE.Vector3(78, 12.2, -8.6),
        view: {
          pos: new THREE.Vector3(74.5, 3.4, 16.5),
          target: new THREE.Vector3(79.2, 10, -11)
        },
        lede: "1890 年建成，仿哥特式单尖塔；奶白墙面、玫瑰窗与彩色玻璃，是沙面大街东端最容易被认出的轮廓。",
        facts: [["建成", "1890"], ["门牌", "大街 14 号"], ["形制", "仿哥特 · 单塔"]],
        detail: "占地约 839.75 m²、建筑基底约 343 m²，可容纳约 200 人；花园南侧有圣母山。尖塔高度公开资料未给出，本场景按照片比例约 23–24.5 m 示意。"
      },
      {
        id: "grotto", no: "02", name: "圣母山与花园", craft: "garden",
        pos: new THREE.Vector3(98.5, 2.8, -22.8),
        view: {
          pos: new THREE.Vector3(92.9, 1.75, -11.4),
          target: new THREE.Vector3(98.2, 3.2, -24.6)
        },
        lede: "教堂东侧的花园里，圣母山与白石像藏在树荫下；矮墙、铁门和花坛把街道的喧闹隔开。",
        facts: [["位置", "教堂东侧"], ["要素", "圣母山 · 花坛"], ["口径", "示意复原"]],
        detail: "花园与圣母山的具体尺寸未测绘；场景按约 20 × 21 m 的示意花园组织，圣母山为程序化岩洞与抽象白石像，不作为宗教场所的精确复原。"
      },
      {
        id: "arcade", no: "03", name: "16–20 号券廊住宅", craft: "arcade",
        pos: new THREE.Vector3(42, 5.0, -8.7),
        view: {
          pos: new THREE.Vector3(56, 2.0, -6.6),
          target: new THREE.Vector3(34, 4.0, -9.2)
        },
        lede: "两层外廊：一层连续拱券，二层券廊后退，绿色百叶与白石线脚把岭南的遮阳做法留在街面上。",
        facts: [["形制", "两层券廊"], ["檐高", "9.23 m"], ["占地", "约 890 m²"]],
        detail: "资料称正立面第二层为券廊式、檐高 9.23 m、占地约 890 m²。本场景把一、二层都做成可穿行外廊，窗扇与门洞为示意。"
      },
      {
        id: "banyan", no: "04", name: "街心花园与古榕", craft: "tree",
        pos: new THREE.Vector3(10, 5.5, 1.6),
        view: {
          pos: new THREE.Vector3(24.5, 2.1, 5.4),
          target: new THREE.Vector3(8.5, 6.2, -1.0)
        },
        lede: "沙面大街的中轴不是一条空街，而是一个接一个的街心花园；细叶榕的气根垂到地面，树冠在街道上方合拢。",
        facts: [["树种", "细叶榕"], ["树冠", "约 12–18 m"], ["数量", "口径不一"]],
        detail: "沙面古树数量有 102/137/150+/178 多个口径，场景不写精确数字。主景榕树按多主干、气根、低多边形树冠簇示意，树龄与胸径未逐棵核对。"
      },
      {
        id: "qichang", no: "05", name: "48 号旗昌洋行", craft: "bank",
        pos: new THREE.Vector3(-42, 7.0, -9.2),
        view: {
          pos: new THREE.Vector3(-18, 2.4, 2.5),
          target: new THREE.Vector3(-44, 7.2, -11.5)
        },
        lede: "三层、四周连续券拱廊，水洗石米外墙；东南角切角入口正对四街，是沙面券廊式建筑的代表。",
        facts: [["门牌", "大街 48 号"], ["层数", "三层"], ["形制", "连续券廊"]],
        detail: "资料称旗昌洋行高三层、立面四周为连续拱券的券廊组合、外墙刷水洗石米；有资料称原为两层、1963 年加建一层。屋顶形式与内部未建模。"
      },
      {
        id: "street", no: "06", name: "沙面大街断面", craft: "street",
        pos: new THREE.Vector3(0, 3.4, 0),
        view: {
          pos: new THREE.Vector3(54, 2.0, -4.8),
          target: new THREE.Vector3(32, 4.8, -9.2)
        },
        lede: "846 m 长、12.9 m 宽的大街，是沙面的中轴；示范段约 170 m，窄街、连续券廊和街心花园一起构成沙面的街道性格。",
        facts: [["全长", "846 m"], ["街宽", "12.9 m"], ["示范段", "约 170 m"]],
        detail: "街道断面按公开的 846 m × 12.9 m 口径做 1:1 示意；两侧建筑退线与门牌位置按资料近似摆放，不是测绘成果。"
      }
    ];
  }

  /* ---------------- 组装 ---------------- */

  function build(opts) {
    textures = opts.textures;
    low = !!opts.low;
    rnd = mulberry32(20261031);
    root = new THREE.Group();
    root.name = "shamian-dajie";
    materials = makeMaterials();
    hotspots = [];
    lampLights = [];
    lampGlowMats = [];
    lampGlowSprites = [];
    warmWindowMats = [];
    gardenLights = [];
    canopyGroups = [];
    canopyInst = { A: [], B: [], C: [] };
    cityWinMats = [];
    inst = { archCream: [], archYellow: [], archMint: [], archStone: [], columns: [], bases: [], capitals: [], winDark: [], winWarm: [], doors: [], shutters: [], rootTaper: [], timber: [] };

    archGeo = makeArchGeometry(3.2, 4.2, 0.36);
    windowGeo = new THREE.PlaneGeometry(1.45, 2.0);
    doorGeo = new THREE.PlaneGeometry(1.9, 2.85);
    shutterGeo = new THREE.PlaneGeometry(0.55, 1.95);
    columnGeo = new THREE.BoxGeometry(0.55, 4.2, 0.55);
    baseGeo = new THREE.BoxGeometry(0.82, 0.26, 0.82);
    capitalGeo = new THREE.BoxGeometry(0.74, 0.22, 0.74);

    buildGround();
    buildGardens();
    buildLamps();
    buildLourdes();
    buildGarden();
    buildRowBuilding({
      cx: 42, zFront: -9, width: 19.2, depth: 16, height: 10.4,
      floors: 2, levels: 2, side: "north", wallMat: materials.yellow,
      archKey: "yellow", doorEvery: 3, name: "indian-residences"
    });
    buildRowBuilding({
      cx: 18, zFront: -9, width: 12.8, depth: 14, height: 14.2,
      floors: 3, levels: 1, side: "north", wallMat: materials.mint,
      archKey: "mint", doorEvery: 3, name: "transition-house", shutters: true
    });
    buildQiChang();
    buildSouthRow();
    buildStreetEnds();
    buildVegetation();
    buildPeople();
    buildStreetLife();
    buildDistant();
    buildSigns();

    var canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    flushInstanced(canopyGeo, materials.leafA, canopyInst.A, "canopy-a");
    flushInstanced(canopyGeo, materials.leafB, canopyInst.B, "canopy-b");
    flushInstanced(canopyGeo, materials.leafC, canopyInst.C, "canopy-c");
    flushInstanced(new THREE.CylinderGeometry(1, 1.1, 1, 7), materials.bark, inst.timber, "banyan-timber");
    flushInstanced(new THREE.CylinderGeometry(0.26, 1, 1, 6), materials.barkDark, inst.rootTaper, "banyan-aerial-roots");

    flushInstanced(archGeo, materials.cream, inst.archCream, "arches-cream");
    flushInstanced(archGeo, materials.yellow, inst.archYellow, "arches-yellow");
    flushInstanced(archGeo, materials.mint, inst.archMint, "arches-mint");
    flushInstanced(archGeo, materials.stoneLight, inst.archStone, "arches-stone");
    flushInstanced(columnGeo, materials.stoneLight, inst.columns, "columns");
    flushInstanced(baseGeo, materials.stoneLight, inst.bases, "column-bases");
    flushInstanced(capitalGeo, materials.stoneLight, inst.capitals, "column-capitals");
    flushInstanced(windowGeo, materials.windowDark, inst.winDark, "windows-dark");
    flushInstanced(windowGeo, materials.windowWarm, inst.winWarm, "windows-warm");
    flushInstanced(doorGeo, materials.door, inst.doors, "doors");
    flushInstanced(shutterGeo, materials.shutter, inst.shutters, "shutters");

    warmWindowMats.push(materials.windowWarm);
    lampGlowMats.push(materials.lamp);
    var roseMats = [materials.rose, materials.pointed];
    buildHotspots();
    root.updateMatrixWorld(true);

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      lampLights: lampLights,
      lampGlowMats: lampGlowMats,
      lampGlowSprites: lampGlowSprites,
      warmWindowMats: warmWindowMats,
      gardenLights: gardenLights,
      canopyGroups: canopyGroups,
      cityWinMats: cityWinMats,
      glassMats: roseMats,
      waterMats: [materials.water],
      bounds: new THREE.Box3(new THREE.Vector3(-120, -5, -120), new THREE.Vector3(120, 40, 190))
    };
  }

  window.ShamianModel = { build: build };
})();
