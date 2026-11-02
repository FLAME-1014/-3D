/* 石室圣心大教堂近景 · 1:1 主体建模
   坐标：1 单位 = 1 米；南为 +Z，北为 -Z；正立面在 z=+39.345，后殿尖在 z=-39.345。
   依据：广州市政府公开尺寸 35 × 78.69 m、塔尖 58.5 m；
   《岭南历史建筑测绘图选集（一）》一层平面、屋面图与比例尺。
   石作、彩窗与街景为演示级程序化复原，不对应单张照片。 */
(function () {
  "use strict";

  var LOW = false;
  var textures = null;
  var rand = null;
  var root = null;
  var materials = null;
  var hotspots = [];
  var windowMats = [];
  var facadeLights = [];
  var accentLights = [];
  var interiorLights = [];
  var flickerLights = [];

  var FRONT_Z = 39.345;
  var BACK_Z = -39.345;
  var TOWER_X = 13.5;
  var TOWER_W = 8;
  var TOWER_Z = FRONT_Z - TOWER_W / 2;
  var TOWER_BODY_TOP = 40;
  var TOWER_TOP = 58.5;
  var NAVE_OUTER_X = 12;
  var COL_X = 5.3;
  var ARCADE_TOP = 10.6;
  var WALL_TOP = 22;
  var ROOF_RIDGE = 30;
  var NAVE_START_Z = 33;
  var NAVE_END_Z = -24;
  var APSE_START_Z = -24;
  var APSE_TIP_Z = BACK_Z;

  function rng(s) {
    var value = s || 1;
    return function () {
      value |= 0;
      value = (value + 0x6D2B79F5) | 0;
      var t = Math.imul(value ^ (value >>> 15), 1 | value);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  function scaleUV(geo, x, y) {
    var uv = geo.attributes.uv;
    if (!uv) return;
    for (var i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * x, uv.getY(i) * y);
    }
    uv.needsUpdate = true;
  }

  function addBox(parent, w, h, d, mat, x, y, z, uv, shadow) {
    var geo = new THREE.BoxGeometry(w, h, d);
    if (uv) scaleUV(geo, uv[0], uv[1]);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addCyl(parent, rt, rb, h, seg, mat, x, y, z, shadow) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addPlane(parent, w, h, mat, x, y, z, rotY, shadow) {
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    if (rotY) mesh.rotation.y = rotY;
    mesh.castShadow = !!shadow;
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
    var geo = new THREE.CylinderGeometry(radius, radius, len, seg || (LOW ? 5 : 8));
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function archOutline(w, h, spring) {
    var s = new THREE.Shape();
    var half = w / 2;
    s.moveTo(-half, 0);
    s.lineTo(half, 0);
    s.lineTo(half, spring);
    s.quadraticCurveTo(half, h * 0.82, 0, h);
    s.quadraticCurveTo(-half, h * 0.82, -half, spring);
    s.lineTo(-half, 0);
    return s;
  }

  function archHolePath(cx, base, w, h, spring) {
    var p = new THREE.Path();
    var half = w / 2;
    p.moveTo(cx - half, base);
    p.lineTo(cx - half, base + spring);
    p.quadraticCurveTo(cx - half, base + h * 0.82, cx, base + h);
    p.quadraticCurveTo(cx + half, base + h * 0.82, cx + half, base + spring);
    p.lineTo(cx + half, base);
    p.closePath();
    return p;
  }

  function extrude(shape, depth, mat, uv, shadow) {
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: false,
      curveSegments: LOW ? 6 : 14
    });
    if (uv) scaleUV(geo, uv[0], uv[1]);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadow !== false;
    mesh.receiveShadow = true;
    return mesh;
  }

  function archRing(outerW, outerH, innerW, innerH, depth, mat, outerSpring, innerSpring) {
    var shape = archOutline(outerW, outerH, outerSpring || outerH * 0.56);
    shape.holes.push(archHolePath(0, 0, innerW, innerH, innerSpring || innerH * 0.56));
    return extrude(shape, depth, mat, [1.4, 1.4], true);
  }

  function makeMaterials() {
    var m = {};
    var stoneMap = textures.granite;
    m.stone = new THREE.MeshStandardMaterial({
      map: stoneMap, bumpMap: textures.graniteBump, bumpScale: 0.07,
      roughness: 0.94, metalness: 0.02, color: srgb(0xd6d0c4)
    });
    var wallMap = textures.granite.clone();
    wallMap.needsUpdate = true;
    wallMap.repeat.set(6, 2);
    var wallBump = textures.graniteBump.clone();
    wallBump.needsUpdate = true;
    wallBump.repeat.set(6, 2);
    m.stoneWall = new THREE.MeshStandardMaterial({
      map: wallMap, bumpMap: wallBump, bumpScale: 0.08,
      roughness: 0.95, metalness: 0.02, color: srgb(0xd2ccc0)
    });
    var tallMap = textures.granite.clone();
    tallMap.needsUpdate = true;
    tallMap.repeat.set(4, 4);
    var tallBump = textures.graniteBump.clone();
    tallBump.needsUpdate = true;
    tallBump.repeat.set(4, 4);
    m.stoneWallTall = new THREE.MeshStandardMaterial({
      map: tallMap, bumpMap: tallBump, bumpScale: 0.08,
      roughness: 0.95, metalness: 0.02, color: srgb(0xd0cabe)
    });
    m.stoneBump = new THREE.MeshStandardMaterial({
      map: stoneMap, bumpMap: textures.graniteBump, bumpScale: 0.12,
      roughness: 0.96, metalness: 0.015, color: srgb(0xd0c9bc)
    });
    m.trim = new THREE.MeshStandardMaterial({
      map: textures.trim, bumpMap: textures.graniteBump, bumpScale: 0.04,
      roughness: 0.88, metalness: 0.03, color: srgb(0xd6d0c3)
    });
    m.trimLight = new THREE.MeshStandardMaterial({
      color: srgb(0xded9cf), roughness: 0.82, metalness: 0.04
    });
    m.stoneDark = new THREE.MeshStandardMaterial({
      color: srgb(0x6c6860), roughness: 0.95, metalness: 0.01
    });
    m.roof = new THREE.MeshStandardMaterial({
      map: textures.roof, roughness: 0.9, metalness: 0.04, color: srgb(0xb3ada1),
      emissive: srgb(0x3f3a33), emissiveIntensity: 1, side: THREE.DoubleSide
    });
    m.roofDark = new THREE.MeshStandardMaterial({
      color: srgb(0x3d403c), roughness: 0.92, metalness: 0.02, emissive: srgb(0x141513), emissiveIntensity: 1, side: THREE.DoubleSide
    });
    m.floor = new THREE.MeshStandardMaterial({
      map: textures.floor, roughness: 0.92, metalness: 0.02, color: srgb(0xc6bcaa)
    });
    m.vault = new THREE.MeshStandardMaterial({
      map: textures.vault, roughness: 0.95, metalness: 0.01, color: srgb(0xc2a58e), emissive: srgb(0x241c15), emissiveIntensity: 1, side: THREE.DoubleSide
    });
    m.dark = new THREE.MeshStandardMaterial({
      color: srgb(0x10161a), roughness: 0.98, metalness: 0.01
    });
    m.deep = new THREE.MeshStandardMaterial({
      color: srgb(0x070a0c), roughness: 1, metalness: 0
    });
    m.door = new THREE.MeshStandardMaterial({
      map: textures.door, roughness: 0.82, metalness: 0.05
    });
    m.metal = new THREE.MeshStandardMaterial({
      color: srgb(0x4a4d4f), roughness: 0.42, metalness: 0.68
    });
    m.gold = new THREE.MeshStandardMaterial({
      color: srgb(0xb18b45), roughness: 0.42, metalness: 0.55
    });
    m.treeTrunk = new THREE.MeshStandardMaterial({ color: srgb(0x4d3d2d), roughness: 0.96 });
    m.treeLeaf = new THREE.MeshStandardMaterial({ color: srgb(0x4d6a3d), roughness: 0.94 });
    m.treeLeafDark = new THREE.MeshStandardMaterial({ color: srgb(0x3e5834), roughness: 0.96 });
    m.paving = new THREE.MeshStandardMaterial({ map: textures.paving, roughness: 0.92, metalness: 0.02 });
    m.asphalt = new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: 0.98, metalness: 0.01 });
    m.sidewalk = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.94, metalness: 0.01 });
    m.grass = new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 1, metalness: 0 });
    m.shophouse = new THREE.MeshStandardMaterial({
      map: textures.shophouse, roughness: 0.93, metalness: 0.02, color: srgb(0xbdb3a4)
    });

    function glassMaterial(t, strength) {
      var mat = new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: strength,
        roughness: 0.96, metalness: 0, side: THREE.DoubleSide
      });
      windowMats.push(mat);
      return mat;
    }
    m.glassTall = textures.glassTall.map(function (t) { return glassMaterial(t, 0.95); });
    m.glassSide = textures.glassSide.map(function (t) { return glassMaterial(t, 0.9); });
    m.glassRose = glassMaterial(textures.glassRose, 1);
    m.towerGlass = new THREE.MeshStandardMaterial({
      map: textures.glassSide[0], emissive: 0xffffff, emissiveMap: textures.glassSide[0], emissiveIntensity: 0.12,
      roughness: 0.4, metalness: 0.04, color: srgb(0x6d675e)
    });
    m.roseTracery = new THREE.MeshStandardMaterial({
      alphaMap: textures.roseTracery, color: srgb(0x8f8878), transparent: true, alphaTest: 0.4,
      depthWrite: true, side: THREE.DoubleSide, roughness: 0.86, metalness: 0.02
    });
    return m;
  }

  /* ---------------- 地面与街区 ---------------- */

  function buildGround() {
    var ground = addBox(root, 340, 0.4, 340, materials.asphalt, 0, -0.22, 20, [30, 30], false);
    ground.receiveShadow = true;
    addBox(root, 220, 0.1, 220, materials.sidewalk, 0, 0.01, 20, [40, 40], false);

    addBox(root, 50, 0.14, 82, materials.paving, 0, 0.03, 0, [9, 15], false);
    addBox(root, 76, 0.12, 18, materials.paving, 0, 0.02, 46, [12, 3], false);
    addBox(root, 76, 0.12, 4.5, materials.sidewalk, 0, 0.03, 57.2, [12, 1], false);
    addBox(root, 76, 0.14, 26, materials.asphalt, 0, 0.02, 70.5, [10, 4], false);
    addBox(root, 76, 0.12, 4.5, materials.sidewalk, 0, 0.03, 85.2, [12, 1], false);
    addBox(root, 76, 0.12, 46, materials.paving, 0, 0.02, 110, [12, 8], false);

    // 教堂前三级台阶
    addBox(root, 24, 0.28, 1.2, materials.trim, 0, 0.14, 40.0, [5, 1], false);
    addBox(root, 25, 0.22, 1.0, materials.trim, 0, 0.11, 41.2, [5, 1], false);
    addBox(root, 26, 0.16, 0.9, materials.trim, 0, 0.08, 42.2, [5, 1], false);

    buildShophouses();
    buildTrees();
  }

  function buildShophouses() {
    var boxes = [
      [-34, 0, 86, 14, 16, 16], [-35, 0, 104, 14, 14, 16], [-36, 0, 122, 14, 18, 16],
      [34, 0, 86, 14, 18, 16], [35, 0, 104, 14, 14, 16], [36, 0, 122, 14, 16, 16],
      [-46, 0, -46, 18, 14, 22], [46, 0, -46, 18, 15, 22]
    ];
    boxes.forEach(function (b) {
      var bx = b[0], by = b[1], bz = b[2], bw = b[3], bh = b[4], bd = b[5];
      addBox(root, bw, bh, bd, materials.shophouse, bx, by + bh / 2, bz, null, false);
      addBox(root, bw + 0.4, 0.4, bd + 0.4, materials.trim, bx, by + bh + 0.1, bz, null, false);
      addBox(root, bw * 0.82, 0.28, bd * 0.82, materials.roofDark, bx, by + bh + 0.4, bz, null, false);
      // 一层雨棚
      addBox(root, bw * 0.86, 0.16, 1.2, materials.roofDark, bx, by + 3.0, bz + (bz > 0 ? -bd / 2 - 0.5 : bd / 2 + 0.5), null, false);
    });
  }

  function buildTrees() {
    var positions = [
      [-23, 48], [-27, 58], [-26, 78], [-23, 96], [-25, 118],
      [23, 48], [27, 58], [26, 78], [23, 96], [25, 118],
      [-21, 30], [21, 30], [-20, -12], [20, -12]
    ];
    if (LOW) positions = positions.slice(0, 8);
    var trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 4.2, 6);
    var leafGeo = new THREE.IcosahedronGeometry(2.6, LOW ? 0 : 1);
    var trunks = new THREE.InstancedMesh(trunkGeo, materials.treeTrunk, positions.length);
    var leaves = new THREE.InstancedMesh(leafGeo, materials.treeLeaf, positions.length);
    var leaves2 = new THREE.InstancedMesh(leafGeo, materials.treeLeafDark, positions.length);
    var dummy = new THREE.Object3D();
    positions.forEach(function (p, i) {
      dummy.position.set(p[0], 2.1, p[1]);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      var s = 0.75 + rand() * 0.45;
      dummy.position.set(p[0], 5.1, p[1]);
      dummy.scale.set(s, s * 0.86, s);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0] + 1.1, 6.1, p[1] - 0.6);
      dummy.scale.set(s * 0.72, s * 0.6, s * 0.72);
      dummy.updateMatrix();
      leaves2.setMatrixAt(i, dummy.matrix);
    });
    trunks.castShadow = false;
    leaves.castShadow = true;
    leaves2.castShadow = true;
    root.add(trunks);
    root.add(leaves);
    root.add(leaves2);

    // 路灯
    [-18, 0, 18].forEach(function (x) {
      [50, 82].forEach(function (z) {
        addCyl(root, 0.08, 0.12, 5.2, 6, materials.metal, x, 2.6, z, false);
        addCyl(root, 0.28, 0.28, 0.5, 8, materials.gold, x, 5.4, z, false);
      });
    });
  }

  /* ---------------- 正立面与双塔 ---------------- */

  function buildFacade() {
    var wallH = 25.4;
    var wallW = 19;
    var shape = new THREE.Shape();
    shape.moveTo(-wallW / 2, 0);
    shape.lineTo(wallW / 2, 0);
    shape.lineTo(wallW / 2, wallH);
    shape.lineTo(-wallW / 2, wallH);
    shape.lineTo(-wallW / 2, 0);
    shape.holes.push(archHolePath(0, 0, 5.6, 8.8, 4.6));
    shape.holes.push(archHolePath(-6.6, 0, 3.6, 6.9, 3.5));
    shape.holes.push(archHolePath(6.6, 0, 3.6, 6.9, 3.5));

    var wall = extrude(shape, 1.5, materials.stone, [0.34, 0.34], true);
    wall.position.set(0, 0, FRONT_Z - 1.5);
    root.add(wall);

    // 中央山墙与小圆窗
    var gable = new THREE.Shape();
    gable.moveTo(-9.5, 25.4);
    gable.lineTo(0, 36.2);
    gable.lineTo(9.5, 25.4);
    gable.lineTo(-9.5, 25.4);
    var gableMesh = extrude(gable, 1.5, materials.stone, [0.34, 0.34], true);
    gableMesh.position.set(0, 0, FRONT_Z - 1.5);
    root.add(gableMesh);
    addBeam(root, -9.5, 25.4, FRONT_Z + 0.02, 0, 36.2, FRONT_Z + 0.02, 0.14, materials.trim, 4);
    addBeam(root, 9.5, 25.4, FRONT_Z + 0.02, 0, 36.2, FRONT_Z + 0.02, 0.14, materials.trim, 4);

    // 山墙小圆窗
    var oculus = new THREE.Mesh(new THREE.CircleGeometry(1.05, LOW ? 24 : 40), materials.glassRose);
    oculus.position.set(0, 29.6, FRONT_Z + 0.06);
    root.add(oculus);
    var oculusRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.13, 8, LOW ? 24 : 40), materials.trim);
    oculusRing.position.set(0, 29.6, FRONT_Z + 0.08);
    root.add(oculusRing);
    addBox(root, 0.13, 1.8, 0.13, materials.metal, 0, 37.0, FRONT_Z - 1.3, null, false);
    addBox(root, 0.9, 0.13, 0.13, materials.metal, 0, 37.45, FRONT_Z - 1.3, null, false);

    // 三座透视门的层层尖券
    [
      { cx: 0, w: 5.6, h: 8.8, spring: 4.6, layers: 4 },
      { cx: -6.6, w: 3.6, h: 6.9, spring: 3.5, layers: 3 },
      { cx: 6.6, w: 3.6, h: 6.9, spring: 3.5, layers: 3 }
    ].forEach(function (p) {
      for (var i = 0; i < p.layers; i++) {
        var ring = archRing(p.w + 1.8 - i * 0.32, p.h + 1.5 - i * 0.26, p.w, p.h, 0.22, materials.trim, p.spring + 0.6, p.spring);
        ring.position.set(p.cx, 0, FRONT_Z + 0.08 + i * 0.2);
        root.add(ring);
      }
      // 门扇与门楣
      addPlane(root, p.w - 0.25, p.h * 0.62, materials.door, p.cx, p.h * 0.31, FRONT_Z - 0.9, 0, false);
      addBox(root, 0.14, p.h * 0.62, 0.16, materials.dark, p.cx, p.h * 0.31, FRONT_Z - 0.82, [1, 1], false);
      addBox(root, p.w, 0.22, 0.35, materials.trim, p.cx, p.spring + 0.25, FRONT_Z + 0.05, [2, 1], false);
    });

    // 玫瑰窗：尖券石框、深色背衬、彩玻璃、石棂与双重石圈
    var roseArch = archRing(12.4, 13.0, 11.6, 12.4, 0.36, materials.stoneBump, 8.6, 8.2);
    roseArch.position.set(0, 12.4, FRONT_Z - 0.1);
    root.add(roseArch);
    [-5.9, 5.9].forEach(function (x) {
      addCyl(root, 0.16, 0.19, 7.4, 10, materials.stoneBump, x, 16.9, FRONT_Z + 0.12, false);
      addBox(root, 0.52, 0.3, 0.42, materials.trim, x, 20.75, FRONT_Z + 0.12, null, false);
    });

    var roseBack = new THREE.Mesh(new THREE.CircleGeometry(3.8, LOW ? 32 : 64), materials.deep);
    roseBack.position.set(0, 18.2, FRONT_Z + 0.02);
    root.add(roseBack);
    var roseGlass = new THREE.Mesh(new THREE.CircleGeometry(3.5, LOW ? 32 : 64), materials.glassRose);
    roseGlass.position.set(0, 18.2, FRONT_Z + 0.08);
    root.add(roseGlass);
    var roseTracery = new THREE.Mesh(new THREE.CircleGeometry(3.55, LOW ? 32 : 64), materials.roseTracery);
    roseTracery.position.set(0, 18.2, FRONT_Z + 0.2);
    root.add(roseTracery);
    var roseRing = new THREE.Mesh(new THREE.RingGeometry(3.45, 3.95, LOW ? 32 : 64), materials.trim);
    roseRing.position.set(0, 18.2, FRONT_Z + 0.14);
    root.add(roseRing);
    var roseRing2 = new THREE.Mesh(new THREE.RingGeometry(3.95, 4.18, LOW ? 32 : 64), materials.stoneBump);
    roseRing2.position.set(0, 18.2, FRONT_Z + 0.1);
    root.add(roseRing2);
    addBox(root, 8.6, 0.26, 0.55, materials.trim, 0, 14.45, FRONT_Z + 0.12, [2, 1], false);

    // 玫瑰窗两侧的高窗
    [-7.7, 7.7].forEach(function (x, index) {
      addPlane(root, 2.8, 8.0, materials.stoneDark, x, 10.2, FRONT_Z + 0.01, 0, false);
      addPlane(root, 2.0, 7.2, materials.glassTall[index % 3], x, 10.2, FRONT_Z + 0.04, 0, false);
      var frame = archRing(2.9, 8.1, 2.0, 7.2, 0.28, materials.trim, 4.3, 4.0);
      frame.position.set(x, 6.6, FRONT_Z + 0.12);
      root.add(frame);
    });

    // 立面两侧扶壁
    [-9.4, 9.4].forEach(function (x) {
      addBox(root, 1.1, 25.4, 1.2, materials.stoneBump, x, 12.7, FRONT_Z + 0.1, [1, 4], true);
      addConePinnacle(x, 25.4, FRONT_Z + 0.1, 0.9, 4.4);
    });
  }

  function addConePinnacle(x, y, z, r, h) {
    var cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, LOW ? 6 : 8), materials.trim);
    cone.position.set(x, y + h / 2, z);
    cone.castShadow = true;
    cone.receiveShadow = true;
    root.add(cone);
    return cone;
  }

  function buildTowers() {
    [-1, 1].forEach(function (side) {
      var x = side * TOWER_X;
      addBox(root, 8, 14, 8, materials.stone, x, 7, TOWER_Z, [2, 3], true);
      addBox(root, 7.6, 12, 7.6, materials.stone, x, 20, TOWER_Z, [2, 3], true);
      addBox(root, 7.2, 10, 7.2, materials.stoneBump, x, 31, TOWER_Z, [2, 2], true);
      addBox(root, 8.3, 2.6, 8.3, materials.trim, x, 37.3, TOWER_Z, [2, 1], true);
      addBox(root, 7.8, 1.8, 7.8, materials.stone, x, 39.5, TOWER_Z, [2, 1], true);

      // 角部扶壁
      [-1, 1].forEach(function (sx) {
        [-1, 1].forEach(function (sz) {
          addBox(root, 0.8, 29, 0.8, materials.stoneBump, x + sx * 3.8, 15, TOWER_Z + sz * 3.8, [0.8, 4], true);
        });
      });

      // 钟楼层高窗
      addPlane(root, 2.5, 6.6, materials.stoneDark, x, 28.5, FRONT_Z + 0.01, 0, false);
      addPlane(root, 1.9, 6.0, materials.towerGlass, x, 28.5, FRONT_Z + 0.04, 0, false);
      addPlane(root, 1.9, 6.0, materials.towerGlass, x, 28.5, TOWER_Z - 3.84, Math.PI, false);
      addPlane(root, 1.9, 6.0, materials.towerGlass, x + side * 3.84, 28.5, TOWER_Z, side * Math.PI / 2, false);
      var frame = archRing(2.7, 6.9, 1.9, 6.0, 0.22, materials.trim, 3.7, 3.4);
      frame.position.set(x, 25.5, FRONT_Z + 0.1);
      root.add(frame);

      // 下部尖券窗
      addPlane(root, 1.5, 5.0, materials.towerGlass, x, 18.2, FRONT_Z + 0.03, 0, false);
      addPlane(root, 1.5, 5.0, materials.towerGlass, x + side * 3.84, 18.2, TOWER_Z, side * Math.PI / 2, false);
      var lowFrame = archRing(2.1, 5.7, 1.5, 5.0, 0.18, materials.trim, 3.1, 2.8);
      lowFrame.position.set(x, 15.6, FRONT_Z + 0.09);
      root.add(lowFrame);

      // 钟：西塔正面时钟
      if (side === -1) {
        addBox(root, 3.0, 3.0, 0.18, materials.trim, x, 32.8, FRONT_Z + 0.02, [1, 1], false);
        var clock = new THREE.Mesh(new THREE.CircleGeometry(1.2, LOW ? 24 : 48), new THREE.MeshStandardMaterial({
          map: textures.clock, transparent: true, alphaTest: 0.3, roughness: 0.6
        }));
        clock.position.set(x, 32.8, FRONT_Z + 0.12);
        root.add(clock);
        var clockRing = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.12, 8, LOW ? 24 : 48), materials.trim);
        clockRing.position.set(x, 32.8, FRONT_Z + 0.1);
        root.add(clockRing);
      }

      // 空八角尖塔
      var spire = new THREE.Mesh(new THREE.ConeGeometry(4.45, TOWER_TOP - TOWER_BODY_TOP, 8), materials.stone);
      spire.position.set(x, TOWER_BODY_TOP + (TOWER_TOP - TOWER_BODY_TOP) / 2, TOWER_Z);
      spire.castShadow = true;
      spire.receiveShadow = true;
      root.add(spire);
      for (var i2 = 0; i2 < 8; i2++) {
        var a = (i2 / 8) * Math.PI * 2;
        var bx = x + Math.cos(a) * 4.5;
        var bz = TOWER_Z + Math.sin(a) * 4.5;
        addBeam(root, bx, TOWER_BODY_TOP, bz, x, TOWER_TOP, TOWER_Z, 0.16, materials.trim, 5);
      }
      // 塔尖基座与尖饰
      var baseRing = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.16, 6, 16), materials.trim);
      baseRing.rotation.x = Math.PI / 2;
      baseRing.position.set(x, TOWER_BODY_TOP + 0.2, TOWER_Z);
      root.add(baseRing);
      for (var k = 0; k < 4; k++) {
        var ak = (k / 4) * Math.PI * 2 + Math.PI / 4;
        addConePinnacle(x + Math.cos(ak) * 4.0, 40.1, TOWER_Z + Math.sin(ak) * 4.0, 0.5, 3.2);
        // 尖塔基座老虎窗
        var lx = x + Math.cos(ak) * 3.85;
        var lz = TOWER_Z + Math.sin(ak) * 3.85;
        addBox(root, 1.0, 1.5, 0.7, materials.stoneDark, lx, 41.4, lz, null, false);
        var lroof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 4), materials.roofDark);
        lroof.position.set(lx, 42.7, lz);
        lroof.rotation.y = ak;
        root.add(lroof);
      }
      // 尖塔中段石环与小尖饰
      [44.3, 48.6, 52.4].forEach(function (ry) {
        var rr = 4.45 * (1 - (ry - TOWER_BODY_TOP) / (TOWER_TOP - TOWER_BODY_TOP));
        var ring = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.04, 0.09, 5, 16), materials.trim);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, ry, TOWER_Z);
        root.add(ring);
      });
      for (var c2 = 0; c2 < 8; c2++) {
        var ac = (c2 / 8) * Math.PI * 2;
        var cy = 44.2;
        var cr = 4.45 * (1 - (cy - TOWER_BODY_TOP) / (TOWER_TOP - TOWER_BODY_TOP)) + 0.18;
        addConePinnacle(x + Math.cos(ac) * cr, cy, TOWER_Z + Math.sin(ac) * cr, 0.18, 0.9);
      }
      // 塔脊上的石芽
      var crocketGeo = new THREE.ConeGeometry(0.2, 0.72, LOW ? 4 : 5);
      var crocketCount = 8 * 5;
      var crockets = new THREE.InstancedMesh(crocketGeo, materials.trim, crocketCount);
      var dummy = new THREE.Object3D();
      for (var c3 = 0; c3 < 8; c3++) {
        var ac3 = (c3 / 8) * Math.PI * 2;
        for (var c4 = 0; c4 < 5; c4++) {
          var cy3 = 43.4 + c4 * 2.9;
          var cr3 = 4.45 * (1 - (cy3 - TOWER_BODY_TOP) / (TOWER_TOP - TOWER_BODY_TOP)) + 0.14;
          dummy.position.set(x + Math.cos(ac3) * cr3, cy3, TOWER_Z + Math.sin(ac3) * cr3);
          dummy.rotation.set(0, -ac3, 0);
          dummy.updateMatrix();
          crockets.setMatrixAt(c3 * 5 + c4, dummy.matrix);
        }
      }
      crockets.castShadow = true;
      root.add(crockets);
      // 塔顶十字
      addBox(root, 0.16, 2.0, 0.16, materials.metal, x, TOWER_TOP + 1.0, TOWER_Z, null, false);
      addBox(root, 1.05, 0.16, 0.16, materials.metal, x, TOWER_TOP + 1.5, TOWER_Z, null, false);

      // 塔身水平线脚
      [8, 14, 20, 26, 32, 36, 38.2].forEach(function (y) {
        addBox(root, 8.5, 0.3, 8.5, materials.trim, x, y, TOWER_Z, [2, 1], false);
      });
    });
  }

  /* ---------------- 中殿、侧廊、耳堂与屋顶 ---------------- */

  function buildNave() {
    var length = NAVE_START_Z - NAVE_END_Z; // 57
    var centerZ = (NAVE_START_Z + NAVE_END_Z) / 2;

    // 外侧廊墙
    [-1, 1].forEach(function (side) {
      addBox(root, 1.2, 9.5, length, materials.stoneWall, side * NAVE_OUTER_X, 4.75, centerZ, null, true);
    });

    // 连拱墙（带尖券洞）
    var arcLength = NAVE_START_Z - (-18);
    var arcShape = new THREE.Shape();
    arcShape.moveTo(0, 0);
    arcShape.lineTo(arcLength, 0);
    arcShape.lineTo(arcLength, ARCADE_TOP);
    arcShape.lineTo(0, ARCADE_TOP);
    arcShape.lineTo(0, 0);
    var bayCenters = [];
    for (var i = 0; i < 10; i++) bayCenters.push(30 - i * 5.1);
    for (var h = 0; h < 9; h++) {
      var zc = (bayCenters[h] + bayCenters[h + 1]) / 2;
      var u = NAVE_START_Z - zc;
      arcShape.holes.push(archHolePath(u, 0, 4.5, 9.6, 5.0));
    }
    var arcGeo = new THREE.ExtrudeGeometry(arcShape, { depth: 0.9, bevelEnabled: false, curveSegments: LOW ? 6 : 14 });
    scaleUV(arcGeo, arcLength / 3, ARCADE_TOP / 3);
    var arcMaterial = materials.stone;
    [-1, 1].forEach(function (side) {
      var wall = new THREE.Mesh(arcGeo, arcMaterial);
      wall.rotation.y = Math.PI / 2;
      wall.position.set(side * COL_X - 0.45, 0, NAVE_START_Z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);
    });

    // 高侧窗墙
    [-1, 1].forEach(function (side) {
      addBox(root, 1.1, 11.4, arcLength, materials.stoneWall, side * COL_X, 16.3, NAVE_START_Z - arcLength / 2, null, true);
    });

    // 交叉部两侧补墙：中殿拱廊止于 z=-18，与圣坛墙之间原本露出侧廊屋面暗底
    [-1, 1].forEach(function (side) {
      addBox(root, 1.1, 12.8, 6, materials.stoneWall, side * COL_X, 15.6, -21, null, true);
    });

    // 侧廊窗与高侧窗
    var aisleZ = [29, 23, 17, 11, 5, -1, -7, -13, -19];
    aisleZ.forEach(function (z, index) {
      [-1, 1].forEach(function (side) {
        var outer = side * (NAVE_OUTER_X + 0.75);
        var inner = side * (NAVE_OUTER_X - 0.82);
        addPlane(root, 3.4, 6.6, materials.stoneDark, outer - side * 0.02, 5.1, z, side * Math.PI / 2, false);
        addPlane(root, 2.7, 5.8, materials.glassSide[index % 2], outer, 5.1, z, side * Math.PI / 2, false);
        addPlane(root, 3.4, 6.6, materials.stoneDark, inner + side * 0.02, 5.1, z, side * Math.PI / 2, false);
        addPlane(root, 2.7, 5.8, materials.glassSide[index % 2], inner, 5.1, z, side * Math.PI / 2, false);
        var frame = archRing(3.5, 6.7, 2.7, 5.8, 0.24, materials.trim, 3.4, 3.2);
        frame.rotation.y = side * Math.PI / 2;
        frame.position.set(outer + side * 0.08, 2.2, z);
        root.add(frame);
        addBox(root, 0.3, 0.28, 3.6, materials.trim, outer + side * 0.1, 8.4, z, [1, 1], false);
      });
    });
    bayCenters.forEach(function (z, index) {
      [-1, 1].forEach(function (side) {
        var outer = side * (COL_X + 0.72);
        var inner = side * (COL_X - 0.78);
        addPlane(root, 3.2, 7.2, materials.stoneDark, outer - side * 0.02, 16.3, z, side * Math.PI / 2, false);
        addPlane(root, 2.5, 6.4, materials.glassTall[index % 3], outer, 16.3, z, side * Math.PI / 2, false);
        addPlane(root, 3.2, 7.2, materials.stoneDark, inner + side * 0.02, 16.3, z, side * Math.PI / 2, false);
        addPlane(root, 2.5, 6.4, materials.glassTall[index % 3], inner, 16.3, z, side * Math.PI / 2, false);
        var frame = archRing(3.3, 7.3, 2.5, 6.4, 0.22, materials.trim, 3.8, 3.5);
        frame.rotation.y = side * Math.PI / 2;
        frame.position.set(outer + side * 0.08, 12.6, z);
        root.add(frame);
        addBox(root, 0.28, 0.28, 3.4, materials.trim, outer + side * 0.1, 19.8, z, [1, 1], false);
      });
    });

    // 侧廊单坡屋顶
    [-1, 1].forEach(function (side) {
      var roofGeo = new THREE.BufferGeometry();
      var a = side * NAVE_OUTER_X;
      var b = side * 5.15;
      var positions = [
        a, 9.8, NAVE_START_Z, a, 9.8, NAVE_END_Z, b, 12.2, NAVE_END_Z,
        a, 9.8, NAVE_START_Z, b, 12.2, NAVE_END_Z, b, 12.2, NAVE_START_Z
      ];
      roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      roofGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 12, 4, 12, 0, 0, 4, 12, 4, 0], 2));
      roofGeo.computeVertexNormals();
      var roof = new THREE.Mesh(roofGeo, materials.roof);
      roof.castShadow = true;
      roof.receiveShadow = true;
      root.add(roof);
    });

    // 中央殿屋顶
    [-1, 1].forEach(function (side) {
      var roofGeo = new THREE.BufferGeometry();
      var a = side * 6.6;
      var positions = [
        0, ROOF_RIDGE, NAVE_START_Z, 0, ROOF_RIDGE, NAVE_END_Z, a, WALL_TOP, NAVE_END_Z,
        0, ROOF_RIDGE, NAVE_START_Z, a, WALL_TOP, NAVE_END_Z, a, WALL_TOP, NAVE_START_Z
      ];
      roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      roofGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 12, 4, 12, 0, 0, 4, 12, 4, 0], 2));
      roofGeo.computeVertexNormals();
      var roof = new THREE.Mesh(roofGeo, materials.roof);
      roof.castShadow = true;
      roof.receiveShadow = true;
      root.add(roof);
    });
    addBox(root, 0.55, 0.4, 57, materials.roofDark, 0, ROOF_RIDGE + 0.1, centerZ, null, false);
    addBox(root, 13.8, 0.26, 57, materials.trim, 0, WALL_TOP + 0.06, centerZ, [2, 12], false);

    // 檐口与飞扶壁
    var buttressZ = [30, 24, 18, 12, 6, 0, -6, -12, -18];
    buttressZ.forEach(function (z) {
      [-1, 1].forEach(function (side) {
        addBox(root, 1.5, 11.5, 2.0, materials.stoneBump, side * (NAVE_OUTER_X + 0.9), 5.75, z, [1, 2], true);
        addBox(root, 1.2, 0.5, 1.7, materials.trim, side * (NAVE_OUTER_X + 0.9), 11.6, z, [1, 1], false);
        addConePinnacle(side * (NAVE_OUTER_X + 0.9), 11.95, z, 0.6, 3.6);
        if (z > -18) {
          addBeam(root, side * (NAVE_OUTER_X + 0.9), 10.6, z, side * 9.4, 15.2, z, 0.34, materials.stoneBump, 6);
          addBeam(root, side * 9.4, 15.2, z, side * (COL_X + 0.55), 18.2, z, 0.3, materials.stoneBump, 6);
          addBeam(root, side * (NAVE_OUTER_X + 0.9), 9.2, z, side * 10.2, 13.6, z, 0.18, materials.trim, 5);
        }
      });
    });

    buildTransept();
  }

  function buildTransept() {
    var z0 = -23;
    var z1 = -13;
    [-1, 1].forEach(function (side) {
      var x0 = side > 0 ? 12 : -17.5;
      var w = 5.5;
      // 耳堂端墙
      addBox(root, w, 22, 10, materials.stone, side * 14.75, 11, -18, [2, 4], true);
      // 端墙大窗
      addPlane(root, 3.2, 9.2, materials.glassTall[side > 0 ? 1 : 0], side * 17.51, 12.3, -18, side * Math.PI / 2, false);
      addPlane(root, 4.0, 10.2, materials.stoneDark, side * 17.45, 12.3, -18, side * Math.PI / 2, false);
      // 耳堂南北窗
      addPlane(root, 2.4, 6.0, materials.glassSide[side > 0 ? 0 : 1], side * 14.75, 7.5, z1 + 0.02, 0, false);
      addBox(root, 5.5, 0.4, 0.8, materials.trim, side * 14.75, 12.0, z1 + 0.02, [2, 1], false);
      // 耳堂屋顶
      var ridgeY = 26.4;
      var roofGeo = new THREE.BufferGeometry();
      var positions = [
        side * 12, ridgeY, z0, side * 12, ridgeY, z1, side * 17.5, 22, z1,
        side * 12, ridgeY, z0, side * 17.5, 22, z1, side * 17.5, 22, z0
      ];
      roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      roofGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 4, 3, 4, 0, 0, 3, 4, 3, 0], 2));
      roofGeo.computeVertexNormals();
      var roof = new THREE.Mesh(roofGeo, materials.roof);
      roof.castShadow = true;
      roof.receiveShadow = true;
      root.add(roof);
      // 内侧半坡：从中殿檐口升到耳堂屋脊，封住交叉部
      var inGeo = new THREE.BufferGeometry();
      var inPositions = [
        side * 6.6, WALL_TOP, z0, side * 6.6, WALL_TOP, z1, side * 12, ridgeY, z1,
        side * 6.6, WALL_TOP, z0, side * 12, ridgeY, z1, side * 12, ridgeY, z0
      ];
      inGeo.setAttribute("position", new THREE.Float32BufferAttribute(inPositions, 3));
      inGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 3, 3, 3, 0, 0, 3, 3, 3, 0], 2));
      inGeo.computeVertexNormals();
      var inRoof = new THREE.Mesh(inGeo, materials.roof);
      inRoof.castShadow = true;
      inRoof.receiveShadow = true;
      root.add(inRoof);
      addBox(root, 0.5, 0.45, 10, materials.trim, side * 12, ridgeY + 0.1, -18, [1, 2], false);
      addConePinnacle(side * 17.5, 22, z0, 0.7, 4.0);
      addConePinnacle(side * 17.5, 22, z1, 0.7, 4.0);
      // 端墙十字（立在女儿墙顶）
      addBox(root, 0.14, 1.5, 0.14, materials.metal, side * 17.45, 22.8, -18.12, null, false);
      addBox(root, 0.82, 0.14, 0.14, materials.metal, side * 17.45, 23.22, -18.12, null, false);
    });
  }

  /* ---------------- 后殿 ---------------- */

  function buildApse() {
    var pts = [
      [-12, APSE_START_Z], [-10.6, -30.0], [-6.6, -36.0], [-3.2, APSE_TIP_Z],
      [3.2, APSE_TIP_Z], [6.6, -36.0], [10.6, -30.0], [12, APSE_START_Z]
    ];
    var wallH = 22;

    // 圣坛拱墙：封住中殿与后殿之间的缝，顶部做成山墙盖过拱洞
    var chShape = new THREE.Shape();
    chShape.moveTo(-12, 0);
    chShape.lineTo(12, 0);
    chShape.lineTo(12, wallH);
    chShape.lineTo(6.6, wallH);
    chShape.lineTo(0, 28);
    chShape.lineTo(-6.6, wallH);
    chShape.lineTo(-12, wallH);
    chShape.lineTo(-12, 0);
    chShape.holes.push(archHolePath(0, 0, 10.4, 15.4, 8.0));
    var chWall = extrude(chShape, 0.9, materials.stoneWallTall, [3, 2], true);
    chWall.position.set(0, 0, APSE_START_Z - 0.9);
    root.add(chWall);
    var chTrim = archRing(11.6, 16.2, 10.4, 15.4, 0.25, materials.trim, 8.6, 8.0);
    chTrim.position.set(0, 0, APSE_START_Z + 0.02);
    root.add(chTrim);
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i];
      var b = pts[i + 1];
      var mx = (a[0] + b[0]) / 2;
      var mz = (a[1] + b[1]) / 2;
      var dx = b[0] - a[0];
      var dz = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dz * dz);
      var angle = Math.atan2(dx, dz);
      var normalA = angle + Math.PI / 2;
      var nx = Math.sin(normalA);
      var nz = Math.cos(normalA);

      var wall = addBox(root, 0.9, wallH, len, materials.stoneWallTall, mx, wallH / 2, mz, null, true);
      wall.rotation.y = angle;

      if (i >= 1 && i <= 5) {
        var winW = Math.min(4.0, len * 0.7);
        var winH = 11.2;
        var baseY = 2.2;
        // 外侧
        addPlane(root, winW + 0.9, winH + 1.0, materials.stoneDark, mx + nx * 0.42, baseY + winH / 2, mz + nz * 0.42, normalA, false);
        addPlane(root, winW, winH, materials.glassTall[i % 3], mx + nx * 0.6, baseY + winH / 2, mz + nz * 0.6, normalA, false);
        var frame = archRing(winW + 1.1, winH + 0.8, winW, winH, 0.24, materials.trim, winH * 0.55, winH * 0.5);
        frame.rotation.y = normalA;
        frame.position.set(mx + nx * 0.6, baseY, mz + nz * 0.6);
        root.add(frame);
        // 内侧
        addPlane(root, winW + 0.9, winH + 1.0, materials.stoneDark, mx - nx * 0.42, baseY + winH / 2, mz - nz * 0.42, normalA + Math.PI, false);
        addPlane(root, winW, winH, materials.glassTall[i % 3], mx - nx * 0.6, baseY + winH / 2, mz - nz * 0.6, normalA + Math.PI, false);
        var innerFrame = archRing(winW + 1.1, winH + 0.8, winW, winH, 0.2, materials.trim, winH * 0.55, winH * 0.5);
        innerFrame.rotation.y = normalA + Math.PI;
        innerFrame.position.set(mx - nx * 0.6, baseY, mz - nz * 0.6);
        root.add(innerFrame);
      }
      // 外侧扶壁
      var bx = mx + nx * 0.55;
      var bz = mz + nz * 0.55;
      addBox(root, 1.1, 12, 1.8, materials.stoneBump, bx, 6, bz, null, true).rotation.y = angle;
      addConePinnacle(bx, 12, bz, 0.55, 3.2);
    }

    // 后殿室内平顶，封住天空
    var ceilPositions = [];
    var ceilUvs = [];
    for (var c = 0; c < pts.length - 1; c++) {
      ceilPositions.push(0, 21.9, -31.5, pts[c][0], 21.9, pts[c][1], pts[c + 1][0], 21.9, pts[c + 1][1]);
      ceilUvs.push(0, 0, 1, 0, 1, 1);
    }
    var ceilGeo = new THREE.BufferGeometry();
    ceilGeo.setAttribute("position", new THREE.Float32BufferAttribute(ceilPositions, 3));
    ceilGeo.setAttribute("uv", new THREE.Float32BufferAttribute(ceilUvs, 2));
    ceilGeo.computeVertexNormals();
    var ceiling = new THREE.Mesh(ceilGeo, materials.trim);
    ceiling.receiveShadow = true;
    root.add(ceiling);

    // 后殿平屋面：填补锥顶与中殿屋面之间的高差缺口
    var deck = new THREE.Mesh(ceilGeo.clone(), materials.roofDark);
    deck.position.y = 0.75;
    deck.receiveShadow = true;
    root.add(deck);

    // 后殿屋面
    var apex = new THREE.Vector3(0, 27.2, -31.5);
    var roofPositions = [];
    var roofUvs = [];
    for (var j = 0; j < pts.length - 1; j++) {
      var p1 = new THREE.Vector3(pts[j][0], wallH, pts[j][1]);
      var p2 = new THREE.Vector3(pts[j + 1][0], wallH, pts[j + 1][1]);
      roofPositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, apex.x, apex.y, apex.z);
      roofUvs.push(0, 0, 4, 0, 2, 4);
    }
    var roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(roofPositions, 3));
    roofGeo.setAttribute("uv", new THREE.Float32BufferAttribute(roofUvs, 2));
    roofGeo.computeVertexNormals();
    var roof = new THREE.Mesh(roofGeo, materials.roof);
    roof.castShadow = true;
    roof.receiveShadow = true;
    root.add(roof);
    addBox(root, 0.14, 2.0, 0.14, materials.metal, 0, 28.4, -31.5, null, false);
    addBox(root, 1.0, 0.14, 0.14, materials.metal, 0, 28.9, -31.5, null, false);
  }

  /* ---------------- 中殿内部 ---------------- */

  function buildInterior() {
    // 地面与中央地毯
    addBox(root, 22.5, 0.22, 66, materials.floor, 0, 0.11, 3, [8, 16], false);
    addBox(root, 2.8, 0.24, 54, new THREE.MeshStandardMaterial({ color: srgb(0x5d2c26), roughness: 0.96 }), 0, 0.23, 4, [1, 10], false);

    // 20 根束柱：柱础、柱身、四根附柱、柱头
    var colZ = [];
    for (var i = 0; i < 10; i++) colZ.push(30 - i * 5.1);
    var dummy = new THREE.Object3D();
    var coreGeo = new THREE.CylinderGeometry(0.5, 0.58, 9.6, LOW ? 8 : 12);
    var shaftGeo = new THREE.CylinderGeometry(0.16, 0.18, 9.6, 6);
    var baseGeo = new THREE.CylinderGeometry(0.92, 1.05, 0.8, 8);
    var capGeo = new THREE.CylinderGeometry(0.78, 0.55, 0.65, 8);
    var abacusGeo = new THREE.BoxGeometry(1.55, 0.28, 1.55);
    var cores = new THREE.InstancedMesh(coreGeo, materials.stone, 20);
    var bases = new THREE.InstancedMesh(baseGeo, materials.trim, 20);
    var caps = new THREE.InstancedMesh(capGeo, materials.trim, 20);
    var abacuses = new THREE.InstancedMesh(abacusGeo, materials.trim, 20);
    var shafts = new THREE.InstancedMesh(shaftGeo, materials.stoneBump, 80);
    var count = 0;
    var shaftCount = 0;
    colZ.forEach(function (z) {
      [-1, 1].forEach(function (side) {
        var x = side * COL_X;
        dummy.position.set(x, 0.4, z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        bases.setMatrixAt(count, dummy.matrix);
        dummy.position.set(x, 5.6, z);
        dummy.updateMatrix();
        cores.setMatrixAt(count, dummy.matrix);
        dummy.position.set(x, 10.65, z);
        dummy.updateMatrix();
        caps.setMatrixAt(count, dummy.matrix);
        dummy.position.set(x, 11.05, z);
        dummy.updateMatrix();
        abacuses.setMatrixAt(count, dummy.matrix);
        count++;
        for (var s = 0; s < 4; s++) {
          var a = (s / 4) * Math.PI * 2 + Math.PI / 4;
          dummy.position.set(x + Math.cos(a) * 0.46, 5.6, z + Math.sin(a) * 0.46);
          dummy.updateMatrix();
          shafts.setMatrixAt(shaftCount++, dummy.matrix);
        }
      });
    });
    [cores, bases, caps, abacuses, shafts].forEach(function (mesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    });

    // 拱顶：两道斜面 + 横向/对角石肋
    var vaultMat = materials.vault;
    addBox(root, 6.2, 0.25, 51, vaultMat, 0, 25.7, 7.5, [3, 12], false);
    [-1, 1].forEach(function (side) {
      var geo = new THREE.BufferGeometry();
      var positions = [
        0, 25.8, 33, 0, 25.8, -18, side * 5.8, 18.1, -18,
        0, 25.8, 33, side * 5.8, 18.1, -18, side * 5.8, 18.1, 33
      ];
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 10, 4, 10, 0, 0, 4, 10, 4, 0], 2));
      geo.computeVertexNormals();
      var mesh = new THREE.Mesh(geo, vaultMat);
      mesh.receiveShadow = true;
      root.add(mesh);
    });
    for (var b = 0; b < colZ.length - 1; b++) {
      var zc = (colZ[b] + colZ[b + 1]) / 2;
      addBeam(root, -COL_X, 10.9, zc, 0, 24.8, zc, 0.22, materials.trim, 6);
      addBeam(root, 0, 24.8, zc, COL_X, 10.9, zc, 0.22, materials.trim, 6);
      addBeam(root, -COL_X, 10.9, colZ[b], 0, 24.8, zc, 0.16, materials.trim, 5);
      addBeam(root, 0, 24.8, zc, COL_X, 10.9, colZ[b], 0.16, materials.trim, 5);
      addBeam(root, -COL_X, 10.9, colZ[b + 1], 0, 24.8, zc, 0.16, materials.trim, 5);
      addBeam(root, 0, 24.8, zc, COL_X, 10.9, colZ[b + 1], 0.16, materials.trim, 5);
    }
    addBox(root, 0.55, 0.5, 51, materials.trim, 0, 26.1, 7.5, [1, 10], false);

    // 侧廊顶
    [-1, 1].forEach(function (side) {
      addBox(root, 6.2, 0.25, 51, vaultMat, side * 8.9, 9.2, 7.5, [2, 12], false);
      for (var k = 0; k < colZ.length - 1; k++) {
        addBeam(root, side * COL_X, 9.3, colZ[k], side * NAVE_OUTER_X, 9.3, colZ[k], 0.15, materials.trim, 5);
      }
    });

    // 长椅：两列各 12 排
    var pewSeatGeo = new THREE.BoxGeometry(4.4, 0.22, 0.7);
    var pewBackGeo = new THREE.BoxGeometry(4.4, 0.95, 0.16);
    var pewEndGeo = new THREE.BoxGeometry(0.18, 1.15, 1.1);
    var pewMat = new THREE.MeshStandardMaterial({ color: srgb(0x5b402c), roughness: 0.9 });
    var seats = new THREE.InstancedMesh(pewSeatGeo, pewMat, 24);
    var backs = new THREE.InstancedMesh(pewBackGeo, pewMat, 24);
    var ends = new THREE.InstancedMesh(pewEndGeo, pewMat, 48);
    var pc = 0;
    var ec = 0;
    for (var row = 0; row < 12; row++) {
      var pz = 25 - row * 2.6;
      [-1, 1].forEach(function (side) {
        var px = side * 2.75;
        dummy.position.set(px, 0.55, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        seats.setMatrixAt(pc, dummy.matrix);
        dummy.position.set(px, 1.0, pz - 0.42);
        dummy.updateMatrix();
        backs.setMatrixAt(pc, dummy.matrix);
        pc++;
        [-1, 1].forEach(function (e) {
          dummy.position.set(px + e * 2.25, 0.6, pz);
          dummy.updateMatrix();
          ends.setMatrixAt(ec++, dummy.matrix);
        });
      });
    }
    [seats, backs, ends].forEach(function (mesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    });

    // 祭台与后殿陈设
    addBox(root, 15, 0.5, 5.5, materials.trim, 0, 0.35, -29.4, [3, 2], false);
    addBox(root, 13, 0.35, 1.0, materials.trim, 0, 0.7, -27.0, [3, 1], false);
    addBox(root, 4.8, 1.25, 1.5, materials.trim, 0, 1.3, -31.5, [2, 1], false);
    addBox(root, 4.4, 0.12, 1.2, materials.gold, 0, 1.98, -31.5, [2, 1], false);
    addBox(root, 0.16, 3.2, 0.16, materials.gold, 0, 3.4, -33.2, null, false);
    addBox(root, 1.8, 0.16, 0.16, materials.gold, 0, 4.1, -33.2, null, false);
    addCyl(root, 0.7, 0.9, 0.45, 12, materials.trim, 0, 0.52, -26.1, false);
    // 圣像龛
    addBox(root, 2.4, 3.0, 1.2, materials.stoneDark, 0, 2.6, -35.8, [1, 1], false);
    addCyl(root, 0.55, 0.75, 1.8, 10, materials.trim, 0, 2.4, -35.0, false);
    addCyl(root, 0.32, 0.32, 0.6, 10, materials.trim, 0, 3.6, -35.0, false);

    // 吊灯
    [12, -4].forEach(function (z) {
      addCyl(root, 0.06, 0.06, 6.5, 4, materials.metal, 0, 22.2, z, false);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 6, 20), materials.metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 18.9, z);
      root.add(ring);
      for (var c = 0; c < 8; c++) {
        var a = (c / 8) * Math.PI * 2;
        addCyl(root, 0.06, 0.06, 0.35, 5, materials.gold, Math.cos(a) * 1.4, 19.15, z + Math.sin(a) * 1.4, false);
      }
    });

    // 内部灯光
    [[0, 8, 16], [0, 8, -4], [0, 10, -28], [-9, 5.5, 12], [9, 5.5, 12], [-9, 5.5, -6], [9, 5.5, -6]].forEach(function (p) {
      var light = new THREE.PointLight(0xffd3a0, 0.15, 32, 2);
      light.position.set(p[0], p[1], p[2]);
      root.add(light);
      interiorLights.push(light);
    });
    // 后殿补光，避免高侧墙落进死黑
    [[0, 17, -30, 0.5, 48], [-9.5, 13, -22, 0.34, 44], [9.5, 13, -22, 0.34, 44], [0, 12, 6, 0.3, 46]].forEach(function (p) {
      var fill = new THREE.PointLight(0xffe2bc, p[3], p[4], 1.6);
      fill.position.set(p[0], p[1], p[2]);
      root.add(fill);
      interiorLights.push(fill);
    });
    var chancelWash = new THREE.SpotLight(0xffe6c4, 14, 46, 0.62, 0.85, 1.1);
    chancelWash.position.set(0, 13, 6);
    chancelWash.target.position.set(0, 17, -24.8);
    root.add(chancelWash);
    root.add(chancelWash.target);
    [[-1.2, 3.2, -31.5], [1.2, 3.2, -31.5]].forEach(function (p, i) {
      var candle = new THREE.PointLight(0xffa25a, 0.2, 8, 2);
      candle.position.set(p[0], p[1], p[2]);
      root.add(candle);
      flickerLights.push(candle);
    });
  }

  /* ---------------- 立面灯光 ---------------- */

  function buildFacadeLights() {
    [-12, -4, 4, 12].forEach(function (x) {
      var light = new THREE.SpotLight(0xffc98a, 0, 120, 0.48, 0.62, 1.4);
      light.position.set(x, 1.4, FRONT_Z + 18);
      light.target.position.set(x * 0.55, 22, FRONT_Z);
      light.castShadow = false;
      root.add(light);
      root.add(light.target);
      facadeLights.push(light);
    });
    // 塔顶冷光，夜里勾出双塔轮廓
    [-13.5, 13.5].forEach(function (x) {
      var light = new THREE.SpotLight(0xcfe0ff, 0, 90, 0.4, 0.7, 1.2);
      light.position.set(x, 48, FRONT_Z + 22);
      light.target.position.set(x, 44, TOWER_Z);
      root.add(light);
      root.add(light.target);
      accentLights.push(light);
    });
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "tower", craft: "tower", no: "01", name: "双尖塔",
        pos: new THREE.Vector3(-13.5, 44, FRONT_Z + 0.4),
        view: { pos: new THREE.Vector3(-31, 42, 58), target: new THREE.Vector3(-13.5, 44, 39) },
        lede: "一对八角形空心石塔把立面拉到 58.5 米；西塔装时钟，塔间有四具法国铜钟。",
        facts: [["塔尖", "58.5 m"], ["塔身", "八角锥体"], ["铜钟", "四具"]],
        detail: "石塔不是实心砌体：八角锥壳由石块与铁件连接，塔顶立十字和避雷针。官方尺寸把地面到塔尖记作 58.5 m；另有测绘记塔尖 52.86 m（不计避雷针），本场景取官方口径。"
      },
      {
        id: "rose", craft: "rose", no: "02", name: "玫瑰窗",
        pos: new THREE.Vector3(0, 18.2, FRONT_Z + 0.5),
        view: { pos: new THREE.Vector3(0, 18.5, 55), target: new THREE.Vector3(0, 18.2, 39.2) },
        lede: "正立面中央的圆形玫瑰窗，石棂从中心放射，彩色玻璃把南面的光收进中殿。",
        facts: [["直径", "约 7 m"], ["位置", "正立面中央"], ["做法", "石雕镂空"]],
        detail: "玫瑰窗位于三座尖券门上方，外圈是石砌圆环，内圈石棂呈放射与花瓣状。彩色玻璃以红、蓝、金为主，白天把光滤成彩色，夜里从室内透出。"
      },
      {
        id: "portal", craft: "portal", no: "03", name: "透视门",
        pos: new THREE.Vector3(0, 4.6, FRONT_Z + 0.6),
        view: { pos: new THREE.Vector3(0, 4.4, 56), target: new THREE.Vector3(0, 5.2, 39.2) },
        lede: "正立面三座尖券门，中央最大；门框层层退入，像把整面墙往堂内吸。",
        facts: [["正门", "三座"], ["中央", "最大"], ["线脚", "层层退入"]],
        detail: "三座门都是尖券，门框外有层层退入的柱线与尖拱肋，形成很强的透视。两侧门略小，中央门正对中殿轴线。"
      },
      {
        id: "buttress", craft: "buttress", no: "04", name: "飞扶壁",
        pos: new THREE.Vector3(13.0, 11, 6),
        view: { pos: new THREE.Vector3(35, 13, 20), target: new THREE.Vector3(13, 11, 6) },
        lede: "东西侧墙外一排扶壁和飞拱，把拱顶向外推的力接住；从侧面看，是石室最像“机器”的一面。",
        facts: [["位置", "东西侧墙"], ["构件", "扶壁 + 飞拱"], ["作用", "抵住拱顶推力"]],
        detail: "中殿的尖形肋骨十字拱顶会把力向外推，外侧的扶壁和飞拱把这股力传到地面。侧廊较低，高侧窗因此能开得很高，堂内才有向上的空间感。"
      },
      {
        id: "glass", craft: "glass", no: "05", name: "彩色玻璃",
        pos: new THREE.Vector3(0, 12, -33),
        view: { pos: new THREE.Vector3(0, 3.6, -6), target: new THREE.Vector3(0, 14, -36) },
        lede: "后殿三面高窗与玫瑰窗都嵌彩色玻璃；资料记玻璃从法国运来，图案以圣经故事为主。",
        facts: [["来源", "法国运来"], ["题材", "圣经故事"], ["位置", "玫瑰窗 · 后殿 · 侧窗"]],
        detail: "彩色玻璃由铅条分成小块，红、蓝、金、绿并置。白天从堂内看，窗是发光的；从堂外看，则是深色石墙上的彩色镶嵌。"
      },
      {
        id: "granite", craft: "granite", no: "06", name: "花岗岩砌筑",
        pos: new THREE.Vector3(-5.5, 7, FRONT_Z + 0.4),
        view: { pos: new THREE.Vector3(-6.5, 7, 49), target: new THREE.Vector3(-5.5, 7, 39.2) },
        lede: "墙、柱、拱券全部用花岗岩砌成，广州人因此直接叫它“石室”。",
        facts: [["材质", "花岗岩"], ["面积", "2,754 ㎡"], ["砌法", "石块 + 铁件"]],
        detail: "官方介绍称其为东南亚唯一用花岗岩石砌成的哥特式大教堂。地方资料还说石料采自香港九龙、用糯米灰浆砌筑，这两条未见官方测绘确认，先作为地方说法保留。"
      },
      {
        id: "hybrid", craft: "hybrid", no: "07", name: "中西合璧",
        pos: new THREE.Vector3(13.5, 31, FRONT_Z + 0.4),
        view: { pos: new THREE.Vector3(25, 31, 54), target: new THREE.Vector3(13.5, 31, 39.2) },
        lede: "法国图纸、中国工匠：出水口做成石狮，地面改用广东大阶砖，门上也留下广式木雕。",
        facts: [["建造", "1863–1888"], ["总管工", "蔡孝"], ["细节", "石狮 · 大阶砖 · 木雕"]],
        detail: "教堂由法国传教士明稽章筹建，法国建筑师主持设计，广东揭西石匠蔡孝总管施工，历时 25 年。地方资料记屋顶出水口改为石狮、地板改用广东大阶砖、门上刻广式木雕；这些细节让哥特平面里混进岭南手艺。"
      }
    ];
    return hotspots;
  }

  /* ---------------- 组装 ---------------- */

  function build(opts) {
    LOW = !!(opts && opts.low);
    textures = opts.textures;
    materials = makeMaterials();
    rand = rng(1863);
    root = new THREE.Group();
    root.name = "shishi-sacred-heart";
    hotspots = [];
    windowMats = [];
    facadeLights = [];
    interiorLights = [];
    flickerLights = [];

    buildGround();
    buildFacade();
    buildTowers();
    buildNave();
    buildApse();
    buildInterior();
    buildFacadeLights();
    buildHotspots();

    return {
      root: root,
      hotspots: hotspots,
      windowMats: windowMats,
      facadeLights: facadeLights,
      accentLights: accentLights,
      interiorLights: interiorLights,
      flickerLights: flickerLights,
      materials: materials,
      bounds: new THREE.Box3(new THREE.Vector3(-60, 0, -60), new THREE.Vector3(60, 62, 130))
    };
  }

  window.SacredModel = { build: build };
})();
