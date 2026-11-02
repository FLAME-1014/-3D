/* 越秀公园 · 五羊—明城墙—镇海楼近景 · 1:1 主体建模
   坐标：1 unit = 1 m；+X 东、+Z 南、-Z 北；五羊仙庭 y = 0；镇海楼台基 y = 22。
   依据：docs/superpowers/research/2026-10-30-yuexiu-park-facts.md（第 17 节口径）。
   五羊群雕、镇海楼、明城墙为公开资料示意复原；城市远景为压缩示意，不做测绘级。 */
(function () {
  "use strict";

  var root = null;
  var textures = null;
  var materials = null;
  var hotspots = [];
  var cityWinMats = [];
  var landmarkMats = [];
  var lanternMats = [];
  var plazaLights = [];
  var pathLights = [];
  var riverMat = null;

  var FIVE = { x: -210, z: 40, y: 0 };
  var GATE_X = -262;
  var WALL = { x0: -120, x1: 52, z: -80, base: 12, top: 20.9, thick: 6 };
  var WALL_RUNS = [
    { x0: -120, x1: -78, z: -84, top: 20.9 },
    { x0: -78, x1: -36, z: -80, top: 21.1 },
    { x0: -36, x1: 6, z: -82.5, top: 20.7 },
    { x0: 6, x1: 52, z: -78.5, top: 21.0 }
  ];
  var WALL_PATH = { y: 12, z: -60 };
  var TOWER = { x: 120, z: -94, y: 22, w: 31, d: 15.77 };
  var TOWER_PLAZA = { x: 124, z: -78, y: 22 };
  var MONUMENT = { x: 120, z: 248, y: 14, h: 37 };

  function sstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function heightAt(x, z) {
    var ridge = 22 * sstep(-210, 30, x) * sstep(80, -80, z);
    ridge -= 10 * sstep(30, 280, z);
    ridge += 24 * Math.exp(-(Math.pow((x - 120) / 100, 2) + Math.pow((z - 248) / 100, 2)));
    var dFive = Math.max(Math.abs(x + 210) - 58, Math.abs(z - 40) - 48, 0);
    var flatFive = 1 - sstep(0, 20, dFive);
    ridge *= (1 - flatFive);

    var dWall = Math.max(Math.abs(x + 34) - 86, Math.abs(z + 62) - 30, 0);
    var flatWall = 1 - sstep(0, 12, dWall);
    ridge = ridge * (1 - flatWall) + WALL_PATH.y * flatWall;

    var dTower = Math.max(Math.abs(x - 124) - 66, Math.abs(z + 79) - 41, 0);
    var flatTower = 1 - sstep(0, 14, dTower);
    ridge = ridge * (1 - flatTower) + TOWER_PLAZA.y * flatTower;
    return ridge;
  }

  /* ---------------- helpers ---------------- */

  function addBox(parent, w, h, d, mat, x, y, z, ry, noShadow) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = !noShadow;
    mesh.receiveShadow = !noShadow;
    parent.add(mesh);
    return mesh;
  }

  function addCyl(parent, rt, rb, h, seg, mat, x, y, z, noShadow) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = !noShadow;
    mesh.receiveShadow = !noShadow;
    parent.add(mesh);
    return mesh;
  }

  function addBeam(parent, ax, ay, az, bx, by, bz, radius, mat, seg) {
    var a = new THREE.Vector3(ax, ay, az);
    var b = new THREE.Vector3(bx, by, bz);
    var dir = b.clone().sub(a);
    var len = dir.length();
    if (len < 0.001) return null;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, seg || 6), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addPlane(parent, tex, w, h, x, y, z, ry, transparent) {
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: !!transparent, side: THREE.DoubleSide, depthWrite: !transparent
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry || 0;
    parent.add(mesh);
    return mesh;
  }

  function addText(parent, text, w, h, color, bg, x, y, z, ry) {
    return addPlane(parent, YuexiuTextures.makeTextTexture(text, 768, 220, color, bg), w, h, x, y, z, ry || 0);
  }

  function addVerticalText(parent, text, w, h, color, bg, x, y, z, ry) {
    return addPlane(parent, YuexiuTextures.makeVerticalTextTexture(text, 256, 900, color, bg), w, h, x, y, z, ry || 0);
  }

  /* ---------------- materials ---------------- */

  function makeMaterials() {
    var m = {};
    m.granite = new THREE.MeshStandardMaterial({ map: textures.graniteCoarse, color: 0xb0a184, roughness: 0.98, metalness: 0.01, flatShading: true });
    m.graniteSheep = new THREE.MeshStandardMaterial({ map: textures.graniteCoarse, color: 0x9d8f74, roughness: 1, metalness: 0.01, flatShading: true });
    m.graniteRock = new THREE.MeshStandardMaterial({ map: textures.graniteCoarse, color: 0x81755f, roughness: 1, metalness: 0.01, flatShading: true });
    m.graniteRock2 = new THREE.MeshStandardMaterial({ map: textures.graniteCoarse, color: 0x8d8169, roughness: 1, metalness: 0.01, flatShading: true });
    m.graniteLight = new THREE.MeshStandardMaterial({ map: textures.graniteLight, color: 0xc4b491, roughness: 0.96, metalness: 0.01, flatShading: true });
    m.graniteGrey = new THREE.MeshStandardMaterial({ map: textures.graniteCoarse, color: 0x8a8d84, roughness: 0.98, metalness: 0.01, flatShading: true });
    m.brickGrey = new THREE.MeshStandardMaterial({ map: textures.brickGreyWall, color: 0xa1a99f, roughness: 0.97, metalness: 0.01 });
    m.brickGreySmall = new THREE.MeshStandardMaterial({ map: textures.brickGrey, color: 0xa1a99f, roughness: 0.97, metalness: 0.01 });
    m.brickRed = new THREE.MeshStandardMaterial({ map: textures.brickRedWall, color: 0x8a6254, roughness: 0.97, metalness: 0.01 });
    m.brickRedSmall = new THREE.MeshStandardMaterial({ map: textures.brickRed, color: 0x8a6254, roughness: 0.97, metalness: 0.01 });
    m.paving = new THREE.MeshStandardMaterial({ map: textures.paving, color: 0xaaa294, roughness: 0.92, metalness: 0.02 });
    m.pavingRed = new THREE.MeshStandardMaterial({ map: textures.pavingRed, color: 0x9a7664, roughness: 0.94, metalness: 0.01 });
    m.pathBand = new THREE.MeshStandardMaterial({ color: 0x65564b, roughness: 0.95, metalness: 0.01 });
    m.tile = new THREE.MeshStandardMaterial({ map: textures.tileGreen, color: 0x9db6a2, roughness: 0.48, metalness: 0.1 });
    m.tileDark = new THREE.MeshStandardMaterial({ map: textures.tileGreenDark, color: 0x6b8674, roughness: 0.52, metalness: 0.08 });
    m.tileRoof = new THREE.MeshStandardMaterial({ map: textures.tileGreen, color: 0xaec4b1, roughness: 0.5, metalness: 0.08, side: THREE.DoubleSide, emissive: 0x0c130d, emissiveIntensity: 0.55 });
    m.redWall = new THREE.MeshStandardMaterial({ map: textures.redPlaster, color: 0x99513f, roughness: 0.86, metalness: 0.01 });
    m.redDark = new THREE.MeshStandardMaterial({ color: 0x411410, roughness: 0.9, metalness: 0.01 });
    m.column = new THREE.MeshStandardMaterial({ color: 0x5d2016, roughness: 0.84, metalness: 0.01 });
    m.leaf = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x789767, roughness: 1 });
    m.leafOlive = new THREE.MeshStandardMaterial({ map: textures.leafOlive, color: 0x879769, roughness: 1 });
    m.lattice = new THREE.MeshStandardMaterial({ map: textures.lattice, color: 0xa8865c, roughness: 0.75, metalness: 0.02 });
    m.wood = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x8b5c3e, roughness: 0.86, metalness: 0.01 });
    m.woodDark = new THREE.MeshStandardMaterial({ color: 0x24160f, roughness: 0.92, metalness: 0.01 });
    m.root = new THREE.MeshStandardMaterial({ map: textures.root, color: 0x3d342c, roughness: 0.96, metalness: 0.01 });
    m.rootDark = new THREE.MeshStandardMaterial({ map: textures.root, color: 0x2b241e, roughness: 0.98, metalness: 0.01 });
    m.stoneDark = new THREE.MeshStandardMaterial({ color: 0x34362f, roughness: 0.95, metalness: 0.01 });
    m.stoneGrey = new THREE.MeshStandardMaterial({ map: textures.brickGrey, color: 0xb9bcb1, roughness: 0.95 });
    m.metal = new THREE.MeshStandardMaterial({ color: 0x3b4140, roughness: 0.5, metalness: 0.55 });
    m.bronze = new THREE.MeshStandardMaterial({ color: 0x4a4332, roughness: 0.6, metalness: 0.4 });
    m.gold = new THREE.MeshStandardMaterial({ color: 0xb98c4a, roughness: 0.42, metalness: 0.55 });
    m.plaque = new THREE.MeshStandardMaterial({ color: 0x27170f, roughness: 0.7, metalness: 0.05 });
    m.relief = new THREE.MeshStandardMaterial({ map: textures.relief, color: 0xd0c0a2, roughness: 0.95 });
    m.lantern = new THREE.MeshStandardMaterial({ color: 0x7a1811, emissive: 0xff3a1a, emissiveIntensity: 0, roughness: 0.6 });
    m.lanternGold = new THREE.MeshStandardMaterial({ color: 0xc7a158, roughness: 0.4, metalness: 0.5 });
    m.cityBody = new THREE.MeshStandardMaterial({ map: textures.cityWindow, color: 0xb8ad97, roughness: 0.9, metalness: 0.02, emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0 });
    m.cityRoof = new THREE.MeshStandardMaterial({ map: textures.tileGrey, color: 0x8d8f86, roughness: 0.95 });
    m.cityModern = new THREE.MeshStandardMaterial({ color: 0x5b6a6c, roughness: 0.7, metalness: 0.15, emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0 });
    m.blueRoof = new THREE.MeshStandardMaterial({ map: textures.roofBlue, color: 0x7fa2ba, roughness: 0.45, metalness: 0.1 });
    m.water = new THREE.MeshStandardMaterial({ color: 0x2d4b4c, roughness: 0.28, metalness: 0.35, emissive: 0xff9a5a, emissiveIntensity: 0 });
    m.grassDark = new THREE.MeshStandardMaterial({ color: 0x3c4f35, roughness: 1 });
    m.soil = new THREE.MeshStandardMaterial({ color: 0x3a3126, roughness: 1 });
    m.magenta = new THREE.MeshStandardMaterial({ color: 0x9c2f52, roughness: 0.9 });
    m.bougain2 = new THREE.MeshStandardMaterial({ color: 0xbd4d6a, roughness: 0.9 });
    m.shrub = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x4d6a42, roughness: 1 });
    m.moss = new THREE.MeshStandardMaterial({ map: textures.mossOverlay, transparent: true, opacity: 0.82, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    m.weeds = new THREE.MeshStandardMaterial({ color: 0x435837, roughness: 1, flatShading: true });
    m.redFlower = new THREE.MeshStandardMaterial({ color: 0xa84232, roughness: 0.9 });
    m.yellowSeat = new THREE.MeshStandardMaterial({ color: 0xc9a844, roughness: 0.9 });
    m.blueTrack = new THREE.MeshStandardMaterial({ color: 0x2e6f9e, roughness: 0.8 });
    m.pitch = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 1 });
    return m;
  }

  /* ---------------- terrain ---------------- */

  function buildTerrain(low) {
    var W = 640, D = 560, SX = low ? 78 : 140, SZ = low ? 68 : 120;
    var positions = [], uvs = [], indices = [];
    for (var iz = 0; iz <= SZ; iz++) {
      var z = -D / 2 + (iz / SZ) * D + 40;
      for (var ix = 0; ix <= SX; ix++) {
        var x = -W / 2 + (ix / SX) * W;
        positions.push(x, heightAt(x, z), z);
        uvs.push(ix / SX * 26, iz / SZ * 24);
        if (ix < SX && iz < SZ) {
          var a = iz * (SX + 1) + ix, b = a + 1, c = a + SX + 1, d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    var colors = new Float32Array(positions.length);
    var normals = geo.attributes.normal;
    for (var i = 0; i < positions.length / 3; i++) {
      var y = positions[i * 3 + 1];
      var ny = normals.getY(i);
      var rock = sstep(0.35, 0.68, 1 - ny);
      var high = sstep(0, 24, y);
      var r = (0.30 + 0.18 * high) * (1 - rock) + 0.54 * rock;
      var g = (0.36 + 0.10 * high) * (1 - rock) + 0.50 * rock;
      var b = (0.23 + 0.06 * high) * (1 - rock) + 0.42 * rock;
      var px = positions[i * 3], pz = positions[i * 3 + 2];
      var patch = Math.sin(px * 0.055) * Math.cos(pz * 0.047) * 0.045;
      colors[i * 3] = r + patch;
      colors[i * 3 + 1] = g + patch * 1.1;
      colors[i * 3 + 2] = b + patch * 0.7;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    var mat = new THREE.MeshStandardMaterial({ map: textures.grass, vertexColors: true, roughness: 1, color: 0xffffff });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  function buildSouthGround(low) {
    var W = 2000, D = 1200, SX = low ? 26 : 48, SZ = low ? 12 : 24;
    var geo = new THREE.PlaneGeometry(W, D, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var zLocal = pos.getZ(i) + 900;
      var y;
      if (zLocal < 420) {
        y = lerp(heightAt(x, clamp(zLocal, 300, 420)), -18, sstep(300, 420, zLocal));
      } else {
        y = -18;
      }
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x475240, roughness: 1 }));
    mesh.position.z = 900;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  /* ---------------- 五羊仙庭 / 五羊 ---------------- */

  function buildFiveRamsPlaza() {
    var g = new THREE.Group();
    // 广场收窄，用树池与花床把视线收到岩座上
    addBox(g, 104, 0.5, 84, materials.paving, FIVE.x, -0.25, FIVE.z, 0, false);
    addBox(g, 102, 0.34, 82, materials.paving, FIVE.x, -0.08, FIVE.z, 0, true);
    [[-46, 0, 4, 62], [46, 0, 4, 62], [0, -36, 88, 3.4], [0, 36, 88, 3.4]].forEach(function (strip) {
      addBox(g, strip[2], 0.16, strip[3], materials.pavingRed, FIVE.x + strip[0], 0.08, FIVE.z + strip[1], 0, true);
    });
    [[-42, 0, 5, 58], [42, 0, 5, 58], [0, -33, 80, 5], [0, 33, 80, 5]].forEach(function (strip) {
      addBox(g, strip[2], 0.12, strip[3], materials.grassDark, FIVE.x + strip[0], 0.14, FIVE.z + strip[1], 0, true);
    });
    // 侧向树池改成低矮花床，不再是大块空石台
    [-34, 34].forEach(function (dx) {
      var bx = FIVE.x + dx, bz = FIVE.z + 20;
      addBox(g, 11, 0.5, 8, materials.stoneGrey, bx, 0.25, bz, 0, false);
      addBox(g, 10, 0.18, 7, materials.grassDark, bx, 0.55, bz, 0, true);
      var rand = mulberry32(Math.floor(bx));
      for (var s = 0; s < 9; s++) {
        var shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.4, 0), materials.shrub);
        shrub.position.set(bx - 4 + rand() * 8, 0.8 + rand() * 0.3, bz - 2.6 + rand() * 5.2);
        shrub.scale.set(1.1, 0.8, 1.0);
        shrub.castShadow = true; shrub.receiveShadow = true;
        g.add(shrub);
      }
      for (var f = 0; f < 7; f++) {
        var fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), f % 2 ? materials.magenta : materials.bougain2);
        fl.position.set(bx - 4.4 + rand() * 8.8, 0.95 + rand() * 0.3, bz - 2.8 + rand() * 5.6);
        fl.scale.set(1, 0.7, 1);
        g.add(fl);
      }
    });
    // 背后花池留在岩座北侧，避免挡住正面
    addBox(g, 14, 0.7, 7.5, materials.stoneGrey, FIVE.x, 0.35, FIVE.z - 26, 0, false);
    addBox(g, 12.4, 0.3, 6, materials.grassDark, FIVE.x, 0.78, FIVE.z - 26, 0, true);
    root.add(g);
    buildXiantingGate();
    buildFiveRams();
    buildBougainvillea();
    // 五羊台地树阵：把广场四周收紧
    [[-254, 8, 1.15], [-254, 74, 1.0], [-166, 8, 1.0], [-166, 74, 1.1], [-236, 84, 1.05], [-184, 84, 1.1], [-244, 26, 0.95], [-176, 30, 0.95]].forEach(function (p) {
      buildFeatureTree(p[0], heightAt(p[0], p[1]), p[1], p[2], p[0] < -220 ? materials.leaf : materials.leafOlive);
    });
  }

  function buildXiantingGate() {
    var g = new THREE.Group();
    var x = GATE_X, z = FIVE.z;
    [-5.2, 5.2].forEach(function (dz) {
      addCyl(g, 0.55, 0.72, 7.2, 10, materials.graniteLight, x, 3.6, z + dz);
      addCyl(g, 1.0, 1.2, 0.4, 10, materials.stoneGrey, x, 0.2, z + dz);
      addCyl(g, 0.72, 0.55, 0.55, 10, materials.gold, x, 7.35, z + dz);
    });
    addBox(g, 1.4, 0.7, 12.4, materials.graniteLight, x, 6.9, z);
    addBox(g, 4.8, 0.28, 16.4, materials.redDark, x, 7.28, z);
    addBox(g, 5.4, 0.55, 16.8, materials.tile, x, 7.55, z);
    addBox(g, 2.8, 0.35, 14.4, materials.tileDark, x, 7.95, z);
    [-1, 1].forEach(function (side) {
      addBox(g, 3.6, 0.18, 0.9, materials.tile, x, 7.72, z + side * 8.3, 0, true);
    });
    addBox(g, 0.18, 1.15, 5.8, materials.plaque, x + 0.75, 6.15, z);
    var plaque = addText(g, "五羊仙庭", 5.0, 0.95, "#e8c878", "#2a1a12", x + 0.86, 6.15, z, Math.PI / 2);
    plaque.castShadow = false;
    addBox(g, 0.18, 1.15, 5.8, materials.plaque, x - 0.75, 6.15, z);
    var plaqueW = addText(g, "五羊仙庭", 5.0, 0.95, "#e8c878", "#2a1a12", x - 0.86, 6.15, z, -Math.PI / 2);
    plaqueW.castShadow = false;
    // 两侧浮雕墙
    [-1, 1].forEach(function (side) {
      var wz = z + side * 19;
      addBox(g, 22, 2.7, 0.9, materials.stoneGrey, x + 13, 1.35, wz, 0, false);
      addBox(g, 20, 2.0, 0.12, materials.relief, x + 13, 1.55, wz + side * 0.51, 0, true);
      addBox(g, 22.6, 0.4, 1.4, materials.tileDark, x + 13, 2.85, wz, 0, false);
    });
    root.add(g);
  }

  function roughenGeo(geo, amp) {
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var f = 1 + amp * (
        Math.sin(x * 5.7 + 1.3) * Math.cos(y * 6.9 + 0.7) * Math.sin(z * 4.9 + 2.1) +
        0.45 * Math.sin(x * 11.3 + z * 8.1)
      );
      pos.setXYZ(i, x * f, y * f, z * f);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function stoneBlob(parent, mat, sx, sy, sz, x, y, z, amp) {
    var mesh = new THREE.Mesh(roughenGeo(new THREE.IcosahedronGeometry(1, 1), amp == null ? 0.045 : amp), mat);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // 把同材质的静态小网格合并，压 draw calls（雕塑/楼体）
  function mergeStaticMeshes(group) {
    group.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    var buckets = {};
    group.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
      var key = o.material.uuid;
      if (!buckets[key]) buckets[key] = { mat: o.material, meshes: [] };
      buckets[key].meshes.push(o);
    });
    Object.keys(buckets).forEach(function (key) {
      var bucket = buckets[key];
      if (bucket.meshes.length < 2) return;
      var pos = [], nor = [], uv = [];
      bucket.meshes.forEach(function (m) {
        var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        var t = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
        g.applyMatrix4(t);
        var p = g.attributes.position.array, n = g.attributes.normal && g.attributes.normal.array;
        var u = g.attributes.uv && g.attributes.uv.array;
        for (var i = 0; i < p.length; i++) pos.push(p[i]);
        for (var j = 0; j < p.length; j++) nor.push(n ? n[j] : 0);
        var uvCount = p.length / 3 * 2;
        for (var k = 0; k < uvCount; k++) uv.push(u ? u[k] : 0);
        g.dispose();
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      var mesh = new THREE.Mesh(geo, bucket.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      bucket.meshes.forEach(function (m) { if (m.parent) m.parent.remove(m); });
    });
  }

  function makeSheep(scale, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var mat = opts.mat || materials.graniteSheep;
    var pose = opts.pose || "stand";
    var lying = pose === "recline";
    var kneeling = pose === "kneel";
    var grazing = pose === "graze";
    var bodyY = lying ? 0.62 : (kneeling ? 0.9 : 1.02);

    // 石块拼成的躯干：肩、桶身、后臀三块，避免气球感
    stoneBlob(g, mat, 0.98, 0.7, 1.28, 0, bodyY, -0.08);
    stoneBlob(g, mat, 0.76, 0.62, 0.7, 0, bodyY + 0.08, 0.68);
    stoneBlob(g, mat, 0.84, 0.64, 0.78, 0, bodyY + 0.02, -0.74);
    stoneBlob(g, mat, 0.5, 0.25, 0.96, 0, bodyY + 0.5, -0.1, 0.07);

    // 颈与头组：短颈、大头，才是石羊不是长颈鹿
    var neckEnd = grazing
      ? new THREE.Vector3(0, bodyY + 0.02, 1.1)
      : (opts.headUp || kneeling
        ? new THREE.Vector3(0, bodyY + 0.76, 0.82)
        : new THREE.Vector3(0, bodyY + 0.64, 0.8));
    addBeam(g, 0, bodyY + 0.2, 0.6, neckEnd.x, neckEnd.y - 0.12, neckEnd.z, 0.28, mat, 8);
    stoneBlob(g, mat, 0.3, 0.36, 0.32, 0, bodyY + 0.32, 0.74, 0.04);

    var headG = new THREE.Group();
    headG.position.copy(neckEnd);
    headG.rotation.y = opts.headTurn || 0;
    g.add(headG);

    var head = stoneBlob(headG, mat, 0.32, 0.38, 0.5, 0, 0.1, 0.16);
    head.rotation.x = grazing ? 0.42 : 0.02;
    var muzzle = stoneBlob(headG, mat, 0.22, 0.2, 0.46, 0, -0.03, 0.5, 0.03);
    muzzle.rotation.x = grazing ? 0.2 : -0.05;
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), materials.rootDark);
    nose.position.set(0, -0.09, 0.8);
    headG.add(nose);
    [-1, 1].forEach(function (side) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 5, 4), materials.rootDark);
      eye.position.set(side * 0.23, 0.15, 0.32);
      headG.add(eye);
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 4), mat);
      ear.position.set(side * 0.38, -0.02, 0.1);
      ear.rotation.z = side * 1.25;
      ear.rotation.x = 0.3;
      ear.castShadow = true;
      headG.add(ear);
      // 盘角：在头侧向外、向前卷，不举到头顶
      var hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.08, 0.26, 0.02),
        new THREE.Vector3(side * 0.34, 0.26, -0.04),
        new THREE.Vector3(side * 0.5, 0.08, 0.02),
        new THREE.Vector3(side * 0.46, -0.12, 0.16),
        new THREE.Vector3(side * 0.32, -0.18, 0.28)
      ]);
      var horn = new THREE.Mesh(new THREE.TubeGeometry(hornCurve, 12, 0.085, 5, false), mat);
      horn.castShadow = true;
      headG.add(horn);
      var horn2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.1, 0.22, 0.03),
        new THREE.Vector3(side * 0.3, 0.18, -0.01),
        new THREE.Vector3(side * 0.38, 0.04, 0.08),
        new THREE.Vector3(side * 0.32, -0.1, 0.18)
      ]), 10, 0.055, 4, false), mat);
      horn2.castShadow = true;
      headG.add(horn2);
    });
    var beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 5), mat);
    beard.position.set(0, -0.42, 0.5);
    beard.rotation.x = Math.PI - (grazing ? 0.45 : 0.1);
    beard.castShadow = true;
    headG.add(beard);

    // 腿：站立时四条粗石腿；跪乳/旁卧收腿
    if (!lying && !kneeling) {
      [-1, 1].forEach(function (side) {
        [0.5, -0.56].forEach(function (lz) {
          addCyl(g, 0.14, 0.18, bodyY - 0.04, 6, mat, side * 0.5, (bodyY - 0.04) / 2, lz);
          stoneBlob(g, mat, 0.22, 0.34, 0.26, side * 0.5, bodyY - 0.32, lz, 0.03);
          addBox(g, 0.3, 0.13, 0.38, mat, side * 0.5, 0.065, lz + 0.05, 0, false);
        });
      });
    } else if (kneeling) {
      [-1, 1].forEach(function (side) {
        addBox(g, 0.42, 0.38, 0.86, mat, side * 0.5, 0.2, -0.42, 0, false);
        addBeam(g, side * 0.5, bodyY - 0.32, 0.62, side * 0.52, 0.28, 1.1, 0.16, mat, 6);
        addBox(g, 0.3, 0.18, 0.72, mat, side * 0.52, 0.1, 1.3, 0, false);
      });
    } else {
      addBox(g, 0.38, 0.28, 0.95, mat, -0.5, 0.16, 0.48, 0, false);
      addBox(g, 0.38, 0.28, 0.8, mat, 0.5, 0.16, -0.48, 0, false);
      addCyl(g, 0.13, 0.15, 0.24, 5, mat, 0.52, 0.12, 0.62);
    }

    var tail = stoneBlob(g, mat, 0.2, 0.34, 0.24, 0, bodyY + 0.12, -1.22, 0.03);
    tail.rotation.x = 0.3;

    if (opts.grain) {
      // “一茎六出”谷穗：与羊同石色，不是金属
      for (var s = 0; s < 6; s++) {
        var off = (s - 2.5) * 0.085;
        var start = new THREE.Vector3(off * 0.3, -0.12, 0.74);
        var mid = new THREE.Vector3(off * 0.9, -0.44, 1.1 + Math.abs(s - 2.5) * 0.03);
        var end = new THREE.Vector3(off * 1.25, -0.72, 1.34);
        var stalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, end]), 7, 0.038, 4, false), mat);
        stalk.castShadow = true;
        headG.add(stalk);
        for (var k = 0; k < 5; k++) {
          var grain = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat);
          grain.scale.set(0.62, 1.45, 0.62);
          grain.position.set(off * 1.25 + (k - 2) * 0.04, -0.64 - k * 0.055, 1.3 + k * 0.045);
          grain.rotation.z = (k - 2) * 0.16;
          grain.castShadow = true;
          headG.add(grain);
        }
      }
    }
    g.scale.setScalar(scale);
    mergeStaticMeshes(g);
    return g;
  }

  function buildFiveRams() {
    var g = new THREE.Group();
    g.position.set(FIVE.x, FIVE.y, FIVE.z);

    // 粗凿岩座：一整块露头 + 前侧石台，缝里长草
    var rockA = new THREE.Mesh(roughenGeo(new THREE.DodecahedronGeometry(1, 1), 0.07), materials.graniteRock);
    rockA.scale.set(5.4, 2.35, 4.05);
    rockA.position.set(0, 1.75, 0);
    rockA.rotation.set(0.03, 0.18, 0.02);
    rockA.castShadow = true; rockA.receiveShadow = true;
    g.add(rockA);
    var rockB = new THREE.Mesh(roughenGeo(new THREE.DodecahedronGeometry(1, 1), 0.08), materials.graniteRock2);
    rockB.scale.set(4.2, 1.55, 3.2);
    rockB.position.set(-0.2, 3.5, -0.1);
    rockB.rotation.set(0.05, 0.5, 0.03);
    rockB.castShadow = true; rockB.receiveShadow = true;
    g.add(rockB);
    var rockC = new THREE.Mesh(roughenGeo(new THREE.DodecahedronGeometry(1, 1), 0.06), materials.graniteRock);
    rockC.scale.set(3.1, 0.95, 2.45);
    rockC.position.set(0.1, 4.85, 0.08);
    rockC.rotation.set(0.02, 0.12, 0.05);
    rockC.castShadow = true; rockC.receiveShadow = true;
    g.add(rockC);
    // 四羊站台：向前伸出，让四羊在正面形成下层轮廓
    [
      [-2.8, 2.4, 4.2, 2.2, 0.5, 1.7, 0.4],
      [2.9, 2.32, 4.35, 2.3, 0.52, 1.75, -0.3],
      [-4.5, 2.45, 1.1, 1.85, 0.48, 1.5, 0.6],
      [4.1, 2.6, -0.9, 1.85, 0.5, 1.45, 0.2]
    ].forEach(function (r) {
      var rock = new THREE.Mesh(roughenGeo(new THREE.DodecahedronGeometry(1, 0), 0.06), r[0] < 0 ? materials.graniteRock2 : materials.graniteRock);
      rock.scale.set(r[3], r[4], r[5]);
      rock.position.set(r[0], r[1], r[2]);
      rock.rotation.set(0.02, r[6], 0.02);
      rock.castShadow = true; rock.receiveShadow = true;
      g.add(rock);
    });
    // 基面
    addBox(g, 10.0, 0.24, 7.2, materials.graniteRock, 0, 0.12, 0, 0, false);
    // 岩缝草
    var rand = mulberry32(1960);
    for (var w = 0; w < 16; w++) {
      var a = rand() * Math.PI * 2;
      var rr = 4.4 + rand() * 1.4;
      var tuft = new THREE.Mesh(new THREE.ConeGeometry(0.15 + rand() * 0.14, 0.34 + rand() * 0.4, 4), materials.weeds);
      tuft.position.set(Math.cos(a) * rr, 0.32, Math.sin(a) * rr * 0.72);
      tuft.rotation.z = (rand() - 0.5) * 0.5;
      tuft.castShadow = true;
      g.add(tuft);
    }

    // 主羊：最高处，昂首面向南，口衔谷穗
    var main = makeSheep(2.25, { grain: true, headTurn: -0.25 });
    main.position.set(0.18, 5.7, 0.22);
    main.rotation.y = -0.08;
    g.add(main);
    // 四羊环绕：跪乳、旁卧回首、吃草、回望
    var s2 = makeSheep(1.4, { pose: "kneel", headUp: true });
    s2.position.set(-2.8, 2.88, 3.5);
    s2.rotation.y = 0.55;
    g.add(s2);
    var s3 = makeSheep(1.45, { pose: "recline", headTurn: 2.25 });
    s3.position.set(2.9, 2.82, 3.62);
    s3.rotation.y = -0.35;
    g.add(s3);
    var s4 = makeSheep(1.32, { pose: "graze" });
    s4.position.set(-4.45, 2.91, 0.8);
    s4.rotation.y = 1.35;
    g.add(s4);
    var s5 = makeSheep(1.2, { pose: "stand", headTurn: -1.5 });
    s5.position.set(4.05, 3.08, -0.9);
    s5.rotation.y = 2.5;
    g.add(s5);

    // 椭圆花床收边：低矮、贴着岩座，不再是方台
    var bed = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), materials.soil);
    bed.rotation.x = -Math.PI / 2;
    bed.scale.set(1, 1, 0.78);
    bed.position.y = 0.17;
    g.add(bed);
    var curb = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.16, 5, 52), materials.stoneGrey);
    curb.rotation.x = Math.PI / 2;
    curb.scale.z = 0.78;
    curb.position.y = 0.22;
    curb.castShadow = true;
    g.add(curb);
    mergeStaticMeshes(g);
    root.add(g);
  }

  function buildFeatureTree(x, y, z, scale, mat) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    addCyl(g, 0.32 * scale, 0.48 * scale, 2.8 * scale, 6, materials.woodDark, 0, 1.4 * scale, 0);
    var crownY = 3.2 * scale;
    [[-0.7, 0, 0.2], [0.7, 0.2, -0.3], [0.1, 0.9, 0.5]].forEach(function (p) {
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * scale, 0), mat || materials.leaf);
      crown.position.set(p[0] * scale, crownY + p[2] * scale, p[1] * scale);
      crown.scale.set(1.1, 0.85, 1.0);
      crown.castShadow = true; crown.receiveShadow = true;
      g.add(crown);
    });
    addBox(g, 2.8 * scale, 0.4, 2.8 * scale, materials.stoneGrey, 0, 0.2, 0, 0, false);
    root.add(g);
  }

  function buildBougainvillea() {
    var rand = mulberry32(1960);
    var count = 200;
    var geo = new THREE.IcosahedronGeometry(0.34, 1);
    var sets = [
      { mat: materials.magenta, mesh: new THREE.InstancedMesh(geo, materials.magenta, count), n: 0 },
      { mat: materials.bougain2, mesh: new THREE.InstancedMesh(geo, materials.bougain2, count), n: 0 }
    ];
    var dummy = new THREE.Object3D();
    for (var i = 0; i < count; i++) {
      var a = rand() * Math.PI * 2;
      var r = 5.75 + rand() * 1.45;
      dummy.position.set(FIVE.x + Math.cos(a) * r, 0.4 + rand() * 0.42, FIVE.z + Math.sin(a) * r * 0.76);
      var s = 0.18 + rand() * 0.26;
      dummy.scale.set(s, s * 0.38, s);
      dummy.rotation.set(rand() * 0.3, rand() * 6.3, rand() * 0.3);
      dummy.updateMatrix();
      var set = sets[i % 2];
      set.mesh.setMatrixAt(set.n++, dummy.matrix);
    }
    sets.forEach(function (set) {
      set.mesh.count = set.n;
      set.mesh.castShadow = true;
      set.mesh.receiveShadow = true;
      root.add(set.mesh);
    });
    // 花带里的低矮绿叶，压低粉色体量
    for (var k = 0; k < 14; k++) {
      var ang = -0.9 + rand() * 2.1;
      var rad = 6.0 + rand() * 0.9;
      var small = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + rand() * 0.1, 1), materials.shrub);
      small.position.set(FIVE.x + Math.cos(ang) * rad, 0.45 + rand() * 0.25, FIVE.z + Math.sin(ang) * rad * 0.8);
      small.scale.set(1.4, 0.55, 1.1);
      small.castShadow = true;
      root.add(small);
    }
  }

  /* ---------------- 登高步道 / 明城墙 / 榕根 ---------------- */

  function buildApproach() {
    var pts = [
      new THREE.Vector3(-205, 0.1, 45),
      new THREE.Vector3(-178, 2.0, 26),
      new THREE.Vector3(-150, 4.8, 8),
      new THREE.Vector3(-122, 8.2, -14),
      new THREE.Vector3(-100, 10.8, -36),
      new THREE.Vector3(-88, 11.8, -52),
      new THREE.Vector3(-80, 12.0, -60)
    ];
    var curve = new THREE.CatmullRomCurve3(pts);
    var N = 96;

    // 连续石铺坡道（宽 7.4 m）
    var verts = [], uvs = [], idx = [];
    for (var i = 0; i <= 120; i++) {
      var p = curve.getPointAt(i / 120);
      var tan = curve.getTangentAt(i / 120);
      var nx = -tan.z, nz = tan.x;
      var len = Math.sqrt(nx * nx + nz * nz) || 1;
      nx /= len; nz /= len;
      verts.push(p.x + nx * 3.7, p.y, p.z + nz * 3.7);
      verts.push(p.x - nx * 3.7, p.y, p.z - nz * 3.7);
      uvs.push(0, i / 120 * 26, 1, i / 120 * 26);
      if (i < 120) {
        var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var deck = new THREE.Mesh(geo, materials.paving);
    deck.castShadow = true; deck.receiveShadow = true;
    root.add(deck);

    // 实体石阶：薄踏步贴着坡面，宽 7.2 m，不再像金属梯
    var stepGeo = new THREE.BoxGeometry(7.2, 0.24, 2.2);
    var steps = new THREE.InstancedMesh(stepGeo, materials.paving, N);
    var dummy = new THREE.Object3D();
    for (var s = 0; s < N; s++) {
      var sp = curve.getPointAt(s / N);
      var stan = curve.getTangentAt(s / N);
      dummy.position.set(sp.x, sp.y - 0.1, sp.z);
      dummy.rotation.y = Math.atan2(stan.x, stan.z);
      dummy.updateMatrix();
      steps.setMatrixAt(s, dummy.matrix);
    }
    steps.castShadow = true; steps.receiveShadow = true;
    root.add(steps);

    // 中央深色石带，读出“神道”方向
    var stripVerts = [], stripUvs = [], stripIdx = [];
    for (var q = 0; q <= 60; q++) {
      var qp = curve.getPointAt(q / 60);
      var qt = curve.getTangentAt(q / 60);
      var qnx = -qt.z, qnz = qt.x;
      var ql = Math.sqrt(qnx * qnx + qnz * qnz) || 1;
      stripVerts.push(qp.x + qnx / ql * 0.65, qp.y + 0.035, qp.z + qnz / ql * 0.65);
      stripVerts.push(qp.x - qnx / ql * 0.65, qp.y + 0.035, qp.z - qnz / ql * 0.65);
      stripUvs.push(0, q / 60 * 14, 1, q / 60 * 14);
      if (q < 60) {
        var qa = q * 2, qb = qa + 1, qc = qa + 2, qd = qa + 3;
        stripIdx.push(qa, qc, qb, qb, qc, qd);
      }
    }
    var stripGeo = new THREE.BufferGeometry();
    stripGeo.setAttribute("position", new THREE.Float32BufferAttribute(stripVerts, 3));
    stripGeo.setAttribute("uv", new THREE.Float32BufferAttribute(stripUvs, 2));
    stripGeo.setIndex(stripIdx);
    stripGeo.computeVertexNormals();
    var strip = new THREE.Mesh(stripGeo, materials.pathBand);
    strip.receiveShadow = true;
    root.add(strip);

    // 两侧矮石墙 + 石柱，替代金属扶手
    var parapetGeo = new THREE.BoxGeometry(0.36, 0.66, 5.6);
    var parapets = new THREE.InstancedMesh(parapetGeo, materials.stoneGrey, 76);
    var pi = 0;
    [-1, 1].forEach(function (side) {
      for (var k = 0; k <= 36; k++) {
        var t = k / 36;
        var pp = curve.getPointAt(t);
        var pt = curve.getTangentAt(t);
        var pnx = -pt.z, pnz = pt.x;
        var pl = Math.sqrt(pnx * pnx + pnz * pnz) || 1;
        dummy.position.set(pp.x + side * pnx / pl * 3.88, pp.y + 0.3, pp.z + side * pnz / pl * 3.88);
        dummy.rotation.y = Math.atan2(pt.x, pt.z);
        dummy.updateMatrix();
        parapets.setMatrixAt(pi++, dummy.matrix);
      }
    });
    parapets.count = pi;
    parapets.castShadow = true; parapets.receiveShadow = true;
    root.add(parapets);
    [-1, 1].forEach(function (side) {
      for (var j = 0; j <= 9; j++) {
        var t2 = j / 9;
        var p2 = curve.getPointAt(t2);
        var tan2 = curve.getTangentAt(t2);
        var nx2 = -tan2.z, nz2 = tan2.x;
        var l2 = Math.sqrt(nx2 * nx2 + nz2 * nz2) || 1;
        var px = p2.x + side * nx2 / l2 * 3.92;
        var pz = p2.z + side * nz2 / l2 * 3.92;
        addBox(root, 0.56, 1.0, 0.56, materials.stoneGrey, px, p2.y + 0.48, pz, 0, false);
        addBox(root, 0.72, 0.14, 0.72, materials.stoneGrey, px, p2.y + 1.02, pz, 0, false);
      }
    });

    // 石灯柱
    [0.08, 0.34, 0.62, 0.86].forEach(function (t) {
      var lp = curve.getPointAt(t);
      var lt = curve.getTangentAt(t);
      var lnx = -lt.z, lnz = lt.x;
      var ll = Math.sqrt(lnx * lnx + lnz * lnz) || 1;
      var lx = lp.x + lnx / ll * 3.4, lz = lp.z + lnz / ll * 3.4;
      addCyl(root, 0.14, 0.2, 2.3, 6, materials.stoneGrey, lx, lp.y + 1.15, lz);
      var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), new THREE.MeshBasicMaterial({ color: 0xffd29a }));
      lamp.position.set(lx, lp.y + 2.3, lz);
      root.add(lamp);
      var light = new THREE.PointLight(0xffc98a, 0, 16, 2);
      light.position.copy(lamp.position);
      root.add(light);
      pathLights.push(light);
    });
  }

  function buildWallTerrace() {
    var len = WALL.x1 - WALL.x0;
    var cx = (WALL.x0 + WALL.x1) / 2;
    addBox(root, 236, 0.45, 30, materials.paving, -12, WALL_PATH.y - 0.22, WALL_PATH.z, 0, false);
    addBox(root, 232, 0.2, 28, materials.paving, -12, WALL_PATH.y + 0.02, WALL_PATH.z, 0, true);
    addBox(root, 232, 0.16, 2.4, materials.pavingRed, -12, WALL_PATH.y + 0.12, WALL_PATH.z - 13.2, 0, true);
    addBox(root, 232, 0.16, 2.4, materials.pavingRed, -12, WALL_PATH.y + 0.12, WALL_PATH.z + 13.2, 0, true);
    // 南侧挡墙：压低、分段、加壁柱，避免一条黑色长墙横在近景
    addBox(root, 199, 5.5, 1.2, materials.brickGreySmall, -30.5, WALL_PATH.y - 3.0, WALL_PATH.z + 15.2, 0, false);
    addBox(root, 11, 5.5, 1.2, materials.brickGreySmall, 100.5, WALL_PATH.y - 3.0, WALL_PATH.z + 15.2, 0, false);
    addBox(root, 210, 0.55, 1.5, materials.stoneGrey, -25.5, WALL_PATH.y + 0.15, WALL_PATH.z + 15.2, 0, false);
    [-110, -74, -38, -2, 34, 64].forEach(function (bx) {
      addBox(root, 1.1, 5.0, 1.7, materials.stoneGrey, bx, WALL_PATH.y - 2.9, WALL_PATH.z + 15.2, 0, false);
    });
    // 矮绿篱与石凳
    for (var i = 0; i < 8; i++) {
      var x = WALL.x0 + 8 + i * (len - 12) / 7;
      addBox(root, 10, 0.55, 0.8, materials.grassDark, x, WALL_PATH.y + 0.28, WALL_PATH.z + 12.5, 0, true);
    }
    [-80, -40, 0, 38].forEach(function (x) {
      addBox(root, 2.2, 0.22, 0.55, materials.stoneGrey, x, WALL_PATH.y + 0.55, WALL_PATH.z + 10.6, 0, false);
      addBox(root, 0.28, 0.55, 0.5, materials.stoneGrey, x - 0.8, WALL_PATH.y + 0.28, WALL_PATH.z + 10.6, 0, false);
      addBox(root, 0.28, 0.55, 0.5, materials.stoneGrey, x + 0.8, WALL_PATH.y + 0.28, WALL_PATH.z + 10.6, 0, false);
    });
    // 墙前树阵：把 30 m 宽的步道分成“墙根—树荫—栏杆”三层
    [-104, -66, -28, 10, 40].forEach(function (x) {
      buildFeatureTree(x, WALL_PATH.y, WALL_PATH.z + 8.2, 0.95, x % 2 ? materials.leaf : materials.leafOlive);
    });
  }

  function buildWall() {
    var dummy = new THREE.Object3D();
    var mossRand = mulberry32(1381);
    var bodyY0 = WALL.base + 2.3;

    WALL_RUNS.forEach(function (run) {
      var len = run.x1 - run.x0;
      var cx = (run.x0 + run.x1) / 2;
      var z = run.z;
      var bh = run.top - bodyY0;
      // 红砂岩基座略宽，青砖墙身略收，形成明显的下重上轻
      addBox(root, len, 2.3, 6.6, materials.brickRed, cx, WALL.base + 1.15, z, 0, false);
      addBox(root, len, bh, 6.0, materials.brickGrey, cx, bodyY0 + bh / 2, z, 0, false);
      addBox(root, len + 0.35, 0.3, 6.5, materials.stoneGrey, cx, run.top + 0.15, z, 0, false);
      // 雉堞
      var n = Math.floor(len / 1.7);
      var merlonGeo = new THREE.BoxGeometry(0.9, 0.85, 0.62);
      var merlons = new THREE.InstancedMesh(merlonGeo, materials.brickGreySmall, n);
      for (var i = 0; i < n; i++) {
        dummy.position.set(run.x0 + 0.9 + i * 1.7, run.top + 0.72, z + 2.66);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        merlons.setMatrixAt(i, dummy.matrix);
      }
      merlons.castShadow = true; merlons.receiveShadow = true;
      root.add(merlons);
      // 红砂岩基的条石层次交给纹理，不再做突出块（避免像箭窗）
      // 扶壁，打破长直墙面
      [0.28, 0.68].forEach(function (frac) {
        var bx = run.x0 + len * frac;
        addBox(root, 1.35, bh + 1.2, 0.55, materials.brickGreySmall, bx, bodyY0 + (bh + 1.2) / 2 - 0.6, z + 3.25, 0, false);
        addBox(root, 1.7, 0.35, 0.8, materials.stoneGrey, bx, run.top + 0.4, z + 3.25, 0, false);
      });
    });

    // 折墙转角墩子，遮住每段错位
    for (var j = 1; j < WALL_RUNS.length; j++) {
      var prev = WALL_RUNS[j - 1], next = WALL_RUNS[j];
      var jz = (prev.z + next.z) / 2;
      var jtop = Math.max(prev.top, next.top);
      addBox(root, 2.8, jtop - WALL.base + 0.2, 7.3, materials.brickGreySmall, next.x0, WALL.base + (jtop - WALL.base + 0.2) / 2, jz, 0, false);
      addBox(root, 3.2, 0.32, 7.7, materials.stoneGrey, next.x0, jtop + 0.35, jz, 0, false);
    }
    // 西端折返 + 东端收头，不让墙无限延伸
    addBox(root, 6.2, 8.8, 26, materials.brickGrey, -123.2, WALL.base + 4.4, -96, 0, false);
    addBox(root, 5.4, 9.4, 9.2, materials.brickGreySmall, -121.2, WALL.base + 4.7, -84, 0, false);
    addBox(root, 5.8, 9.4, 9.2, materials.brickGreySmall, 54, WALL.base + 4.7, -80.5, 0, false);
    // 墙脚蕨草/杂草
    var weedGeo = new THREE.ConeGeometry(0.16, 0.45, 4);
    var weeds = new THREE.InstancedMesh(weedGeo, materials.shrub, 130);
    var wi = 0;
    for (var w = 0; w < 130; w++) {
      var run = WALL_RUNS[w % WALL_RUNS.length];
      var wx = run.x0 + 2 + Math.random() * (run.x1 - run.x0 - 4);
      dummy.position.set(wx, WALL.base + 0.22, run.z + 3.15 + Math.random() * 0.6);
      dummy.scale.set(0.6 + Math.random() * 0.7, 0.5 + Math.random() * 0.7, 0.6 + Math.random() * 0.7);
      dummy.rotation.set(0, Math.random() * 6.3, (Math.random() - 0.5) * 0.3);
      dummy.updateMatrix();
      weeds.setMatrixAt(wi++, dummy.matrix);
    }
    weeds.count = wi;
    weeds.castShadow = false; weeds.receiveShadow = true;
    root.add(weeds);
    // 墙脚/砖缝苔藓簇
    var mossGeo = new THREE.IcosahedronGeometry(0.34, 1);
    var mossClumps = new THREE.InstancedMesh(mossGeo, materials.shrub, 120);
    var mi = 0;
    for (var mc = 0; mc < 120; mc++) {
      var mrun = WALL_RUNS[mc % WALL_RUNS.length];
      var mx = mrun.x0 + 1 + Math.random() * (mrun.x1 - mrun.x0 - 2);
      var my = WALL.base + 0.05 + Math.pow(Math.random(), 2) * 3.6;
      dummy.position.set(mx, my, mrun.z + 3.04);
      dummy.scale.set(0.4 + Math.random() * 1.1, 0.18 + Math.random() * 0.3, 0.18 + Math.random() * 0.2);
      dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6.3, (Math.random() - 0.5) * 0.4);
      dummy.updateMatrix();
      mossClumps.setMatrixAt(mi++, dummy.matrix);
    }
    mossClumps.count = mi;
    mossClumps.castShadow = false;
    mossClumps.receiveShadow = true;
    root.add(mossClumps);
  }

  function buildBanyans() {
    var rand = mulberry32(1380);
    var mainSegs = [], fineSegs = [];
    var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };

    function addSeg(a, b, r, fine) {
      var arr = fine ? fineSegs : mainSegs;
      arr.push({ a: a.clone(), b: b.clone(), r: r });
    }
    function addCurve(points, r0, r1, steps, fine) {
      var curve = new THREE.CatmullRomCurve3(points);
      var prev = curve.getPoint(0);
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        var p = curve.getPoint(t);
        addSeg(prev, p, r0 + (r1 - r0) * t, fine);
        prev = p;
      }
      return curve;
    }

    function curtain(cx, run, spread, count, fineHairs) {
      var face = run.z + 3.0;
      for (var i = 0; i < count; i++) {
        var sx = cx + (rand() - 0.5) * spread;
        var ex = cx + (rand() - 0.5) * spread * 1.3;
        var topY = run.top + 0.08;
        var midY = (topY + WALL.base) / 2 + (rand() - 0.5) * 2.2;
        var pts = [
          V(sx + (rand() - 0.5) * 0.3, topY + 0.3, run.z + 1.7),
          V(sx + (rand() - 0.5) * 0.5, topY - 0.65, face - 0.08),
          V((sx + ex) / 2 + (rand() - 0.5) * 1.3, midY, face + 0.12 + rand() * 0.18),
          V(ex, WALL.base + 0.35 + rand() * 0.35, face + 0.18 + rand() * 0.16)
        ];
        var rc = addCurve(pts, 0.1 + rand() * 0.07, 0.03 + rand() * 0.015, 7, false);
        // 分叉
        var branches = 3 + Math.floor(rand() * 2);
        for (var b = 0; b < branches; b++) {
          var t0 = 0.25 + rand() * 0.55;
          var bp0 = rc.getPoint(t0);
          var bp1 = V(bp0.x + (rand() - 0.5) * 3.2, Math.max(WALL.base + 0.4, bp0.y - 1.2 - rand() * 3.2), face + 0.14 + rand() * 0.22);
          var bpm = bp0.clone().lerp(bp1, 0.5);
          bpm.x += (rand() - 0.5) * 0.9;
          bpm.z = face + 0.2;
          addCurve([bp0, bpm, bp1], 0.05, 0.012, 4, false);
          if (rand() > 0.45) {
            addCurve([
              bp1,
              V(bp1.x + (rand() - 0.5) * 1.5, Math.max(WALL.base + 0.3, bp1.y - 0.8 - rand() * 1.6), face + 0.2),
              V(bp1.x + (rand() - 0.5) * 2.0, Math.max(WALL.base + 0.3, bp1.y - 1.8 - rand() * 2.5), face + 0.22)
            ], 0.03, 0.008, 4, true);
          }
        }
      }
      // 沿砖缝横向爬墙的根
      for (var h = 0; h < 8; h++) {
        var hy = WALL.base + 1.1 + h * 1.05 + rand() * 0.3;
        var hx0 = cx + (rand() - 0.5) * spread * 0.9;
        var hx1 = hx0 + (rand() - 0.5) * 4.5;
        addCurve([
          V(hx0, hy, face + 0.12),
          V((hx0 + hx1) / 2, hy + (rand() - 0.5) * 0.45, face + 0.2),
          V(hx1, Math.max(WALL.base + 0.35, hy - 0.5 - rand() * 1.8), face + 0.17)
        ], 0.045, 0.012, 5, false);
      }
      // 顶沿垂下的细根幕
      for (var t = 0; t < fineHairs; t++) {
        var tx = cx + (rand() - 0.5) * spread * 0.95;
        var ty = run.top - 0.1;
        var px = tx, py = ty;
        for (var q = 0; q < 3; q++) {
          var nx = px + (rand() - 0.5) * 0.7;
          var ny = Math.max(WALL.base + 0.25, py - 0.4 - rand() * 1.4);
          addSeg(V(px, py, face + 0.15 + rand() * 0.1), V(nx, ny, face + 0.18 + rand() * 0.12), 0.012, true);
          px = nx; py = ny;
        }
      }
      // 墙面随机细根
      for (var f = 0; f < fineHairs * 3; f++) {
        var fx = cx + (rand() - 0.5) * spread * 1.15;
        var fy = WALL.base + 0.7 + rand() * (run.top - WALL.base - 1.4);
        var qx = fx, qy = fy;
        var steps = 2 + Math.floor(rand() * 3);
        for (var s2 = 0; s2 < steps; s2++) {
          var nx2 = qx + (rand() - 0.5) * 0.55;
          var ny2 = Math.max(WALL.base + 0.25, qy - 0.25 - rand() * 1.0);
          addSeg(V(qx, qy, face + 0.16 + rand() * 0.12), V(nx2, ny2, face + 0.18 + rand() * 0.12), 0.009, true);
          qx = nx2; qy = ny2;
        }
      }
    }

    var trees = [
      { x: -108, run: 0, s: 1.0, spread: 4.6, count: 9, fine: 14 },
      { x: -72, run: 1, s: 1.05, spread: 5.2, count: 10, fine: 16 },
      { x: -48, run: 2, s: 1.32, spread: 7.2, count: 22, fine: 36 },
      { x: -20, run: 2, s: 1.0, spread: 4.6, count: 10, fine: 14 },
      { x: 14, run: 3, s: 1.1, spread: 5.2, count: 11, fine: 16 },
      { x: 40, run: 3, s: 1.0, spread: 4.4, count: 9, fine: 13 }
    ];
    trees.forEach(function (t) {
      var run = WALL_RUNS[t.run];
      curtain(t.x, run, t.spread, t.count, t.fine);
      var tg = new THREE.Group();
      tg.position.set(t.x, run.top, run.z - 1.35);
      var th = (5.0 + rand() * 2.0) * t.s;
      addCyl(tg, 0.7 * t.s, 1.1 * t.s, th, 8, materials.rootDark, 0, th / 2, 0);
      for (var k = 0; k < 3; k++) {
        addBeam(tg, (rand() - 0.5) * 1.6, 0.15, 0.4, (rand() - 0.5) * 3.2, 0.05, 1.2, 0.28 * t.s, materials.rootDark, 5);
      }
      for (var c = 0; c < 8; c++) {
        var blob = new THREE.Mesh(new THREE.IcosahedronGeometry((2.2 + rand() * 1.5) * t.s, 1), c % 2 ? materials.leaf : materials.leafOlive);
        blob.position.set((rand() - 0.5) * 10 * t.s, th + 0.5 + rand() * 3.6 * t.s, -1.2 + (rand() - 0.5) * 7 * t.s);
        blob.scale.set(1.15, 0.82, 1.05);
        blob.castShadow = true; blob.receiveShadow = true;
        tg.add(blob);
      }
      mergeStaticMeshes(tg);
      root.add(tg);
    });
    // 树间再补几束小根，让墙面根网连续
    [
      { x: -90, run: 0, spread: 3.4, count: 6 },
      { x: -58, run: 1, spread: 3.8, count: 7 },
      { x: -34, run: 2, spread: 3.4, count: 7 },
      { x: 0, run: 2, spread: 3.6, count: 7 },
      { x: 27, run: 3, spread: 3.4, count: 6 },
      { x: -53, run: 2, spread: 4.6, count: 11 },
      { x: -43, run: 2, spread: 4.6, count: 11 },
      { x: -66, run: 1, spread: 3.8, count: 8 },
      { x: -41, run: 2, spread: 3.8, count: 9 },
      { x: -27, run: 2, spread: 3.8, count: 9 },
      { x: 7, run: 3, spread: 3.8, count: 8 },
      { x: 22, run: 3, spread: 3.8, count: 8 }
    ].forEach(function (e) {
      curtain(e.x, WALL_RUNS[e.run], e.spread, e.count, 16);
    });

    function buildRootInst(segs, mat, castShadow) {
      if (!segs.length) return;
      var geo = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
      var mesh = new THREE.InstancedMesh(geo, mat, segs.length);
      var dummy = new THREE.Object3D();
      var up = new THREE.Vector3(0, 1, 0);
      var placed = 0;
      segs.forEach(function (s) {
        var dir = new THREE.Vector3().subVectors(s.b, s.a);
        var len = dir.length();
        if (len < 0.001) return;
        dummy.position.copy(s.a).add(s.b).multiplyScalar(0.5);
        dummy.quaternion.setFromUnitVectors(up, dir.normalize());
        dummy.scale.set(s.r, len, s.r);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed++, dummy.matrix);
      });
      mesh.count = placed;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    function buildRootLines(segs) {
      if (!segs.length) return;
      var pos = new Float32Array(segs.length * 6);
      segs.forEach(function (s, i) {
        pos[i * 6] = s.a.x; pos[i * 6 + 1] = s.a.y; pos[i * 6 + 2] = s.a.z;
        pos[i * 6 + 3] = s.b.x; pos[i * 6 + 4] = s.b.y; pos[i * 6 + 5] = s.b.z;
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      var lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1c1511, transparent: true, opacity: 0.95 }));
      root.add(lines);
    }
    buildRootInst(mainSegs, materials.root, true);
    buildRootLines(fineSegs);
  }

  /* ---------------- 镇海楼 / 前广场 ---------------- */

  function buildTowerTerrace() {
    addBox(root, 132, 0.5, 82, materials.paving, TOWER_PLAZA.x, TOWER_PLAZA.y - 0.25, TOWER_PLAZA.z, 0, false);
    addBox(root, 128, 0.2, 78, materials.paving, TOWER_PLAZA.x, TOWER_PLAZA.y + 0.02, TOWER_PLAZA.z, 0, true);
    addBox(root, 128, 0.16, 3.0, materials.pavingRed, TOWER_PLAZA.x, TOWER_PLAZA.y + 0.12, -114.5, 0, true);
    addBox(root, 128, 0.16, 3.0, materials.pavingRed, TOWER_PLAZA.x, TOWER_PLAZA.y + 0.12, -41.5, 0, true);
    // 南缘挡墙：在 x=69..95 的台阶处留口
    addBox(root, 11, 10, 1.4, materials.stoneGrey, 63.5, TOWER_PLAZA.y - 5, -37.6, 0, false);
    addBox(root, 95, 10, 1.4, materials.stoneGrey, 142.5, TOWER_PLAZA.y - 5, -37.6, 0, false);
    var stepCount = 12;
    for (var i = 0; i < stepCount; i++) {
      var y = WALL_PATH.y + (i + 0.5) * (TOWER_PLAZA.y - WALL_PATH.y) / stepCount;
      addBox(root, 26, 0.82, 1.0, materials.stoneGrey, 82, y, -48 + i * 0.85, 0, false);
    }
    addBox(root, 26, 0.4, 2.0, materials.paving, 82, TOWER_PLAZA.y - 0.2, -37.8, 0, true);
    [-1, 1].forEach(function (side) {
      addBox(root, 0.5, 10, 12, materials.stoneGrey, 82 + side * 13.3, TOWER_PLAZA.y - 5, -43, 0, false);
    });
    // 广场树池与草带
    [-1, 1].forEach(function (side) {
      addBox(root, 26, 0.55, 1.4, materials.grassDark, TOWER_PLAZA.x + side * 46, TOWER_PLAZA.y + 0.28, -52, 0, true);
    });
    // 石狮一对
    buildLion(96, -44, 1);
    buildLion(144, -44, -1);
    // 古炮成排（不写数量）
    [-1, 1].forEach(function (side) {
      for (var k = 0; k < 3; k++) {
        buildCannon(TOWER_PLAZA.x + side * (27 + k * 3.2), TOWER_PLAZA.y + 0.5, -62 - k * 3.6);
      }
    });
    buildSteleCorridor();
    buildTower();
    // 楼前花木，收住光秃的台地
    [[78, -92, 1.3, true], [162, -92, 1.28, false], [82, -110, 2.0, false], [158, -110, 1.9, true], [60, -70, 1.05, true], [180, -70, 1.05, false]].forEach(function (t) {
      buildFeatureTree(t[0], TOWER_PLAZA.y, t[1], t[2], t[3] ? materials.leaf : materials.leafOlive);
    });
  }

  function buildLion(x, z, dir) {
    var g = new THREE.Group();
    g.position.set(x, TOWER_PLAZA.y, z);
    g.rotation.y = dir * 0.05;
    g.scale.setScalar(0.85);
    var body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), materials.brickRedSmall);
    body.scale.set(1.1, 1.0, 1.8);
    body.position.set(0, 1.15, 0);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 9), materials.brickRedSmall);
    head.position.set(0, 2.3, 1.25);
    head.castShadow = true;
    g.add(head);
    var mane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), materials.brickRedSmall);
    mane.position.set(0, 2.15, 0.95);
    mane.scale.set(1.0, 1.1, 0.7);
    mane.castShadow = true;
    g.add(mane);
    [-1, 1].forEach(function (side) {
      addCyl(g, 0.2, 0.26, 1.0, 6, materials.brickRedSmall, side * 0.6, 0.5, 0.9);
      addCyl(g, 0.2, 0.26, 1.0, 6, materials.brickRedSmall, side * 0.6, 0.5, -0.9);
    });
    addBox(g, 2.8, 0.4, 4.2, materials.stoneGrey, 0, 0.2, 0, 0, false);
    root.add(g);
  }

  function buildCannon(x, y, z) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 2.8, 8), materials.bronze);
    barrel.rotation.x = Math.PI / 2 - 0.08;
    barrel.position.set(0, 0.75, 0.4);
    barrel.castShadow = true;
    g.add(barrel);
    addBox(g, 0.9, 0.5, 1.5, materials.woodDark, 0, 0.35, -0.25, 0, false);
    [-1, 1].forEach(function (side) {
      var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.16, 10), materials.woodDark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.52, 0.36, -0.25);
      wheel.castShadow = true;
      g.add(wheel);
    });
    root.add(g);
  }

  function buildSteleCorridor() {
    var g = new THREE.Group();
    g.position.set(67, TOWER_PLAZA.y, -92);
    addBox(g, 18, 0.35, 5.6, materials.stoneGrey, 0, 0.2, 0, 0, false);
    for (var i = 0; i < 5; i++) {
      var x = -8 + i * 4;
      addCyl(g, 0.18, 0.22, 3.1, 6, materials.woodDark, x, 1.75, -2.2);
      addCyl(g, 0.18, 0.22, 3.1, 6, materials.woodDark, x, 1.75, 2.2);
    }
    addBox(g, 19, 0.28, 3.0, materials.tileDark, 0, 3.4, 0, 0, false);
    addBox(g, 17.4, 0.16, 2.2, materials.tile, 0, 3.65, 0, 0, true);
    for (var s = 0; s < 4; s++) {
      addBox(g, 1.2, 2.0, 0.28, materials.stoneDark, -5.2 + s * 3.5, 1.3, 1.8, 0, false);
      addBox(g, 0.95, 1.55, 0.05, materials.stoneGrey, -5.2 + s * 3.5, 1.35, 1.95, 0, true);
    }
    root.add(g);
  }

  function buildRoofGeometry(innerW, innerD, outerW, outerD, topY, eaveY, cornerLift, sag) {
    var pos = [], uv = [], idx = [];
    function addFace(nu, nv, fn, flip) {
      var base = pos.length / 3;
      for (var j = 0; j <= nv; j++) {
        for (var i = 0; i <= nu; i++) {
          var u = i / nu, v = j / nv;
          var p = fn(u, v);
          pos.push(p[0], p[1], p[2]);
          uv.push(p[0] * 0.24, p[2] * 0.24);
        }
      }
      for (var j2 = 0; j2 < nv; j2++) {
        for (var i2 = 0; i2 < nu; i2++) {
          var a = base + j2 * (nu + 1) + i2;
          var b = a + 1;
          var c = a + nu + 1;
          var d = c + 1;
          if (!flip) idx.push(a, c, b, b, c, d);
          else idx.push(a, b, c, b, d, c);
        }
      }
    }
    var sagF = function (v) { return sag * Math.sin(Math.PI * v); };
    var lift = function (u, v) {
      var e = Math.abs(2 * u - 1);
      return cornerLift * Math.pow(e, 4) * Math.pow(v, 3);
    };
    // 前坡 / 后坡（内圈为腰檐顶或正脊）
    addFace(10, 6, function (u, v) {
      var x = lerp(-innerW / 2, innerW / 2, u) * (1 - v) + lerp(-outerW / 2, outerW / 2, u) * v;
      var z = lerp(innerD / 2, outerD / 2, v);
      var y = lerp(topY, eaveY, v) - sagF(v) + lift(u, v);
      return [x, y, z];
    }, false);
    addFace(10, 6, function (u, v) {
      var x = lerp(innerW / 2, -innerW / 2, u) * (1 - v) + lerp(outerW / 2, -outerW / 2, u) * v;
      var z = -lerp(innerD / 2, outerD / 2, v);
      var y = lerp(topY, eaveY, v) - sagF(v) + lift(u, v);
      return [x, y, z];
    }, false);
    // 左右坡
    [-1, 1].forEach(function (side) {
      addFace(8, 6, function (u, v) {
        var x = side * lerp(innerW / 2, outerW / 2, u);
        var z = lerp(-innerD / 2, innerD / 2, v) * (1 - u) + lerp(-outerD / 2, outerD / 2, v) * u;
        var y = lerp(topY, eaveY, u) - sagF(u) + cornerLift * Math.pow(Math.abs(2 * v - 1), 4) * Math.pow(u, 3);
        return [x, y, z];
      }, side < 0);
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function addEaveEdge(g, outerW, outerD, eaveY, cornerLift) {
    var hw = outerW / 2, hd = outerD / 2;
    function ribbon(pts, topY, height, mat) {
      var curve = new THREE.CatmullRomCurve3(pts);
      var N = 28;
      var pos = [], uv = [], idx = [];
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        var p = curve.getPoint(t);
        pos.push(p.x, topY + (p.y - eaveY), p.z);
        pos.push(p.x, topY + (p.y - eaveY) - height, p.z);
        uv.push(t * 8, 1, t * 8, 0);
        if (i < N) {
          var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
          idx.push(a, c, b, b, c, d);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      var mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
    }
    function edge(x0, z0, x1, z1, mx, mz) {
      var pts = [
        new THREE.Vector3(x0, eaveY + cornerLift, z0),
        new THREE.Vector3(mx, eaveY, mz),
        new THREE.Vector3(x1, eaveY + cornerLift, z1)
      ];
      ribbon(pts, 0, 0.72, materials.tileRoof);
      ribbon(pts, -0.64, 0.1, materials.gold);
    }
    edge(-hw, hd, hw, hd, 0, hd);
    edge(-hw, -hd, hw, -hd, 0, -hd);
    edge(hw, -hd, hw, hd, hw, 0);
    edge(-hw, -hd, -hw, hd, -hw, 0);
  }

  function addRoofHorn(g, x, y, z, ox, oz, mat) {
    var pts = [
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + ox * 0.4, y + 0.2, z + oz * 0.4),
      new THREE.Vector3(x + ox * 0.68, y + 0.55, z + oz * 0.68)
    ];
    var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 7, 0.22, 4, false), mat);
    tube.castShadow = true;
    g.add(tube);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 5), materials.gold);
    tip.position.set(x + ox * 0.74, y + 0.74, z + oz * 0.74);
    tip.rotation.z = -ox * 0.5;
    tip.rotation.x = oz * 0.5;
    tip.castShadow = true;
    g.add(tip);
  }

  function addTowerRailing(g, w, d, y, h, mat) {
    var top = y + h;
    addBox(g, w, 0.1, 0.1, mat, 0, top, d / 2, 0, true);
    addBox(g, w, 0.1, 0.1, mat, 0, top, -d / 2, 0, true);
    addBox(g, 0.1, 0.1, d, mat, w / 2, top, 0, 0, true);
    addBox(g, 0.1, 0.1, d, mat, -w / 2, top, 0, 0, true);
    addBox(g, w, 0.08, 0.08, mat, 0, y + 0.15, d / 2, 0, true);
    addBox(g, w, 0.08, 0.08, mat, 0, y + 0.15, -d / 2, 0, true);
    addBox(g, 0.08, 0.08, d, mat, w / 2, y + 0.15, 0, 0, true);
    addBox(g, 0.08, 0.08, d, mat, -w / 2, y + 0.15, 0, 0, true);
    var n = Math.max(4, Math.floor(w / 1.4));
    for (var i = 0; i <= n; i++) {
      var x = -w / 2 + i * w / n;
      addBox(g, 0.08, h, 0.08, mat, x, y + h / 2, d / 2, 0, true);
      addBox(g, 0.08, h, 0.08, mat, x, y + h / 2, -d / 2, 0, true);
    }
    var m = Math.max(3, Math.floor(d / 1.4));
    for (var j = 0; j <= m; j++) {
      var z = -d / 2 + j * d / m;
      addBox(g, 0.08, h, 0.08, mat, w / 2, y + h / 2, z, 0, true);
      addBox(g, 0.08, h, 0.08, mat, -w / 2, y + h / 2, z, 0, true);
    }
  }

  function addTowerSideWindow(g, x, y, z, w, h, side) {
    addBox(g, 0.1, h, w, materials.lattice, x, y, z, 0, true);
    addBox(g, 0.14, 0.14, w + 0.24, materials.redDark, x, y + h / 2 + 0.07, z, 0, true);
    addBox(g, 0.14, 0.14, w + 0.24, materials.redDark, x, y - h / 2 - 0.07, z, 0, true);
    addBox(g, 0.14, h + 0.28, 0.14, materials.redDark, x, y, z - w / 2 - 0.07, 0, true);
    addBox(g, 0.14, h + 0.28, 0.14, materials.redDark, x, y, z + w / 2 + 0.07, 0, true);
    addBox(g, 0.12, h, 0.06, materials.redDark, x + side * 0.06, y, z, 0, true);
  }

  function addTowerWindow(g, x, y, z, w, h, facing) {
    addBox(g, w, h, 0.1, materials.lattice, x, y, z, 0, true);
    addBox(g, w + 0.24, 0.14, 0.14, materials.redDark, x, y + h / 2 + 0.07, z, 0, true);
    addBox(g, w + 0.24, 0.14, 0.14, materials.redDark, x, y - h / 2 - 0.07, z, 0, true);
    addBox(g, 0.14, h + 0.28, 0.14, materials.redDark, x - w / 2 - 0.07, y, z, 0, true);
    addBox(g, 0.14, h + 0.28, 0.14, materials.redDark, x + w / 2 + 0.07, y, z, 0, true);
    addBox(g, 0.06, h, 0.12, materials.redDark, x, y, z + (facing > 0 ? 0.06 : -0.06), 0, true);
  }

  function buildTower() {
    var g = new THREE.Group();
    g.position.set(TOWER.x, TOWER.y, TOWER.z);

    // 台基与正面踏步
    addBox(g, 37, 1.2, 23, materials.stoneGrey, 0, 0.6, 0, 0, false);
    addBox(g, 33.6, 0.2, 19.6, materials.pavingRed, 0, 1.28, 0, 0, true);
    for (var st = 0; st < 4; st++) {
      addBox(g, 17, 0.3, 0.85, materials.stoneGrey, 0, 1.05 - st * 0.28, 12.0 + st * 0.82, 0, false);
    }
    // 台基石栏（左右分段，中间留踏步）
    [-1, 1].forEach(function (side) {
      addBox(g, 12.5, 0.14, 0.22, materials.stoneGrey, side * 11.2, 1.9, 11.2, 0, true);
      for (var p = 0; p < 8; p++) {
        addBox(g, 0.24, 0.75, 0.24, materials.stoneGrey, side * (6.0 + p * 1.5), 1.55, 11.2, 0, true);
      }
    });
    addBox(g, 34, 0.14, 0.22, materials.stoneGrey, 0, 1.9, -11.2, 0, true);
    [-1, 1].forEach(function (side) {
      addBox(g, 0.22, 0.14, 22, materials.stoneGrey, side * 17, 1.9, 0, 0, true);
    });

    var levels = [
      { y: 1.2, w: 31.0, d: 16.0, h: 3.6 },
      { y: 6.4, w: 29.0, d: 15.0, h: 3.2 },
      { y: 10.8, w: 27.2, d: 14.2, h: 3.0 },
      { y: 15.0, w: 25.4, d: 13.4, h: 2.8 },
      { y: 19.0, w: 23.6, d: 12.6, h: 2.7 }
    ];

    levels.forEach(function (lv, i) {
      var y = lv.y, w = lv.w, d = lv.d, h = lv.h;
      // 墙身
      addBox(g, w, h, d, materials.redWall, 0, y + h / 2, 0, 0, false);
      // 台明/楼板
      addBox(g, w + 0.8, i === 0 ? 0.4 : 0.5, d + 0.8, materials.stoneGrey, 0, y - 0.2, 0, 0, false);
      // 上下额枋
      addBox(g, w + 0.7, 0.4, d + 0.7, materials.redDark, 0, y + h - 0.3, 0, 0, false);
      addBox(g, w + 0.5, 0.26, d + 0.5, materials.redDark, 0, y + 0.42, 0, 0, false);
      // 角柱
      [-1, 1].forEach(function (sx) {
        [-1, 1].forEach(function (sz) {
          addCyl(g, 0.3, 0.34, h, 6, materials.column, sx * (w / 2 - 0.1), y + h / 2, sz * (d / 2 - 0.1));
        });
      });
      // 正面/背面廊柱与窗
      var bays = 5;
      var bayW = (w - 1.8) / bays;
      for (var b = 0; b <= bays; b++) {
        var cx = -w / 2 + 0.9 + b * bayW;
        addCyl(g, 0.22, 0.26, h, 6, materials.column, cx, y + h / 2, d / 2 + 0.18);
        addCyl(g, 0.22, 0.26, h, 6, materials.column, cx, y + h / 2, -d / 2 - 0.18);
        // 斗拱/雀替
        [-1, 1].forEach(function (sz) {
          addBox(g, 0.62, 0.16, 0.55, materials.gold, cx, y + h - 0.56, sz * (d / 2 + 0.42), 0, true);
          addBox(g, 0.92, 0.14, 0.5, materials.redDark, cx, y + h - 0.74, sz * (d / 2 + 0.36), 0, true);
        });
      }
      for (var bay = 0; bay < bays; bay++) {
        var wx = -w / 2 + 0.9 + (bay + 0.5) * bayW;
        if (i === 0 && bay === 2) {
          // 一层明间大门
          addBox(g, 3.2, 2.7, 0.16, materials.lattice, wx, y + 1.35, d / 2 + 0.24, 0, true);
          addBox(g, 3.9, 0.3, 0.5, materials.stoneGrey, wx, y + 2.95, d / 2 + 0.2, 0, true);
          [-1, 1].forEach(function (sx) {
            addBox(g, 0.28, 2.8, 0.44, materials.stoneGrey, wx + sx * 1.7, y + 1.4, d / 2 + 0.2, 0, true);
          });
        } else {
          addTowerWindow(g, wx, y + h * 0.56, d / 2 + 0.22, bayW - 1.0, h * 0.55, 1);
        }
        addTowerWindow(g, wx, y + h * 0.56, -d / 2 - 0.22, bayW - 1.0, h * 0.55, -1);
      }
      // 侧面柱与窗
      var sideBays = 2;
      for (var sb = 0; sb <= sideBays; sb++) {
        var czc = -d / 2 + 0.9 + sb * (d - 1.8) / sideBays;
        [-1, 1].forEach(function (sx) {
          addCyl(g, 0.22, 0.26, h, 6, materials.column, sx * (w / 2 + 0.18), y + h / 2, czc);
          addBox(g, 0.55, 0.16, 0.62, materials.gold, sx * (w / 2 + 0.42), y + h - 0.56, czc, 0, true);
        });
      }
      for (var sb2 = 0; sb2 < sideBays; sb2++) {
        var cz = -d / 2 + 0.9 + (sb2 + 0.5) * (d - 1.8) / sideBays;
        [-1, 1].forEach(function (sx) {
          addTowerSideWindow(g, sx * (w / 2 + 0.22), y + h * 0.56, cz, (d - 1.8) / sideBays - 1.2, h * 0.52, sx);
        });
      }
    });

    // 五层腰檐 + 顶层庑殿顶
    levels.forEach(function (lv, i) {
      var isTop = i === levels.length - 1;
      var eaveY = lv.y + lv.h + 0.35;
      var outerW = lv.w + (isTop ? 7.4 : 5.4);
      var outerD = lv.d + (isTop ? 7.4 : 5.4);
      var innerW, innerD, topY;
      if (!isTop) {
        var next = levels[i + 1];
        innerW = next.w + 2.6;
        innerD = next.d + 2.6;
        topY = next.y - 0.4;
      } else {
        innerW = 9.2;
        innerD = 0;
        topY = eaveY + 5.2;
      }
      var cornerLift = isTop ? 1.7 : 1.0 + i * 0.08;
      var sag = isTop ? 0.34 : 0.22;
      var roofGeo = buildRoofGeometry(innerW, innerD, outerW, outerD, topY, eaveY, cornerLift, sag);
      var roof = new THREE.Mesh(roofGeo, materials.tileRoof);
      roof.castShadow = true; roof.receiveShadow = true;
      g.add(roof);
      // 檐口沿曲线走，保留四角起翘
      addEaveEdge(g, outerW, outerD, eaveY, cornerLift);
      addBox(g, outerW - 2.0, 0.22, outerD - 2.0, materials.brickRedSmall, 0, eaveY - 0.4, 0, 0, false);
      // 垂脊与起翘
      [-1, 1].forEach(function (sx) {
        [-1, 1].forEach(function (sz) {
          var inner = new THREE.Vector3(sx * innerW / 2, topY + 0.04, sz * innerD / 2);
          var outer = new THREE.Vector3(sx * outerW / 2, eaveY + cornerLift, sz * outerD / 2);
          var mid = inner.clone().lerp(outer, 0.55);
          mid.y += 0.2;
          var hip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([inner, mid, outer]), 8, 0.12, 4, false), materials.tileDark);
          hip.castShadow = true;
          g.add(hip);
          addRoofHorn(g, sx * outerW / 2, eaveY + cornerLift, sz * outerD / 2, sx * 0.85, sz * 0.85, materials.tileDark);
        });
      });
      // 檐下椽头
      var nR = Math.floor(outerW / 1.4);
      for (var r = 0; r <= nR; r++) {
        var rx = -outerW / 2 + r * outerW / nR;
        addBox(g, 0.18, 0.18, 0.8, materials.gold, rx, eaveY - 0.28, outerD / 2 - 0.3, 0, true);
        addBox(g, 0.18, 0.18, 0.8, materials.gold, rx, eaveY - 0.28, -outerD / 2 + 0.3, 0, true);
      }
      var nS = Math.floor(outerD / 1.4);
      for (var s2 = 0; s2 <= nS; s2++) {
        var rz = -outerD / 2 + s2 * outerD / nS;
        addBox(g, 0.8, 0.18, 0.18, materials.gold, outerW / 2 - 0.3, eaveY - 0.28, rz, 0, true);
        addBox(g, 0.8, 0.18, 0.18, materials.gold, -outerW / 2 + 0.3, eaveY - 0.28, rz, 0, true);
      }
      // 灯笼
      [-1, 1].forEach(function (sx) {
        [-1, 1].forEach(function (sz) {
          addLantern(g, sx * lv.w * 0.3, eaveY - 1.1, sz * (lv.d / 2 + 2.2));
        });
      });
      if (!isTop) {
        // 平座/回廊
        addBox(g, innerW + 1.0, 0.3, innerD + 1.0, materials.redDark, 0, topY - 0.12, 0, 0, false);
        addTowerRailing(g, innerW + 0.6, innerD + 0.6, topY + 0.1, 0.82, materials.column);
      } else {
        // 正脊、脊饰、宝顶
        addBox(g, innerW + 1.6, 0.75, 1.15, materials.tileDark, 0, topY + 0.28, 0, 0, false);
        [-1, 1].forEach(function (sx) {
          var tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.6, 5), materials.tileDark);
          tail.position.set(sx * (innerW / 2 + 1.0), topY + 1.1, 0);
          tail.rotation.z = -sx * 0.55;
          tail.castShadow = true;
          g.add(tail);
          for (var rb = 0; rb < 3; rb++) {
            var beast = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), materials.tileDark);
            beast.position.set(sx * (innerW / 2 - rb * 1.2), topY + 0.5, 0.22);
            beast.castShadow = true;
            g.add(beast);
          }
        });
        addCyl(g, 0.35, 0.45, 1.1, 8, materials.gold, 0, topY + 0.55, 0);
        var orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), materials.gold);
        orb.position.set(0, topY + 1.3, 0);
        orb.castShadow = true;
        g.add(orb);
        var spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 6), materials.gold);
        spire.position.set(0, topY + 1.9, 0);
        spire.castShadow = true;
        g.add(spire);
      }
    });

    // 匾额
    addBox(g, 5.8, 1.25, 0.24, materials.plaque, 0, 20.55, 6.55, 0, true);
    addText(g, "镇海楼", 5.1, 1.05, "#e8c878", "#2a1a12", 0, 20.55, 6.68, 0).castShadow = false;
    addBox(g, 4.6, 0.75, 0.2, materials.plaque, 0, 4.12, 8.25, 0, true);
    addText(g, "广州博物馆", 4.0, 0.62, "#e8c878", "#2a1a12", 0, 4.12, 8.38, 0).castShadow = false;

    mergeStaticMeshes(g);
    root.add(g);
  }

  function addLantern(parent, x, y, z) {
    var lantern = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), materials.lantern);
    lantern.scale.set(1, 1.2, 1);
    lantern.position.set(x, y, z);
    parent.add(lantern);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 8), materials.lanternGold);
    cap.position.set(x, y + 0.42, z);
    parent.add(cap);
    var tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 4), materials.lanternGold);
    tassel.position.set(x, y - 0.45, z);
    parent.add(tassel);
    lanternMats.push(materials.lantern);
  }

  /* ---------------- 城市 / 纪念碑 / 体育场 ---------------- */

  function buildMonument() {
    var g = new THREE.Group();
    var y = heightAt(MONUMENT.x, MONUMENT.z);
    g.position.set(MONUMENT.x, y, MONUMENT.z);
    // 岩座与台阶
    var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), materials.granite);
    rock.scale.set(9, 4.2, 8);
    rock.position.set(0, 2.1, 0);
    rock.rotation.set(0.08, 0.4, 0.04);
    rock.castShadow = true; rock.receiveShadow = true;
    g.add(rock);
    addBox(g, 13, 2.2, 12, materials.stoneGrey, 0, 5.0, 0, 0, false);
    addBox(g, 11, 0.5, 10, materials.paving, 0, 6.3, 0, 0, true);
    for (var i = 0; i < 8; i++) {
      addBox(g, 10, 0.35, 1.2, materials.stoneGrey, 0, 3.8 + i * 0.45, 6.4 + i * 0.8, 0, false);
    }
    // 方锥碑身
    var obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 3.2, 30, 4), materials.graniteGrey);
    obelisk.rotation.y = Math.PI / 4;
    obelisk.position.set(0, 6.5 + 15, 0);
    obelisk.castShadow = true; obelisk.receiveShadow = true;
    g.add(obelisk);
    addCyl(g, 0.06, 0.06, 2.2, 4, materials.metal, 0, 37.0, 0);
    // 26 个羊头意象：远景只做一圈体量，不逐个建模
    var ring = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.16, 4, 26), materials.graniteGrey);
    ring.rotation.x = Math.PI / 2;
    ring.scale.z = 0.9;
    ring.position.set(0, 6.55, 0);
    g.add(ring);
    root.add(g);
  }

  function buildOldCity(low) {
    var rand = mulberry32(20261031);
    var count = low ? 120 : 260;
    var bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    var body = new THREE.InstancedMesh(bodyGeo, materials.cityBody, count);
    var roofGeo = new THREE.ConeGeometry(0.72, 1, 4);
    var roof = new THREE.InstancedMesh(roofGeo, materials.cityRoof, count);
    var dummy = new THREE.Object3D();
    var n = 0, guard = 0;
    while (n < count && guard < count * 12) {
      guard++;
      var x = rand() * 760 - 380;
      var z = 350 + rand() * 520;
      if (Math.abs(x - 120) < 60 && z < 880) continue;
      if (Math.abs(x - 120) < 70 && z > 385 && z < 475) continue;
      if (Math.abs(x - 120) < 80 && z > 520 && z < 610) continue;
      if (Math.abs(x - 120) < 90 && z > 650 && z < 740) continue;
      if (Math.abs(x - 120) < 80 && z > 785 && z < 870) continue;
      if (Math.hypot(x - 330, z - 300) < 120) continue;
      var w = 12 + rand() * 24;
      var d = 12 + rand() * 24;
      var h = 11 + Math.pow(rand(), 1.4) * 24;
      dummy.position.set(x, -18 + h / 2, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.y = rand() < 0.5 ? 0 : Math.PI / 2;
      dummy.updateMatrix();
      body.setMatrixAt(n, dummy.matrix);
      dummy.position.set(x, -18 + h + 2.4, z);
      dummy.scale.set(w * 0.72, 4.8, d * 0.72);
      dummy.rotation.y = Math.PI / 4;
      dummy.updateMatrix();
      roof.setMatrixAt(n, dummy.matrix);
      n++;
    }
    body.count = roof.count = n;
    body.castShadow = false; body.receiveShadow = false;
    roof.castShadow = false; roof.receiveShadow = false;
    root.add(body); root.add(roof);
    cityWinMats.push(materials.cityBody);
  }

  function buildMemorialHall() {
    var g = new THREE.Group();
    g.position.set(120, -18, 430);
    addBox(g, 88, 2, 74, materials.stoneGrey, 0, 1, 0, 0, false);
    addBox(g, 70, 18, 54, materials.graniteLight, 0, 10, 0, 0, true);
    var roof = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 44, 16, 8), materials.blueRoof);
    roof.position.set(0, 27, 0);
    roof.castShadow = false;
    g.add(roof);
    addCyl(g, 0.35, 0.35, 7, 6, materials.gold, 0, 37, 0);
    addBox(g, 30, 11, 11, materials.graniteLight, 0, 6.5, 33, 0, true);
    addBox(g, 34, 1.0, 13, materials.blueRoof, 0, 12.4, 33, 0, true);
    for (var i = 0; i < 6; i++) {
      addCyl(g, 0.35, 0.4, 9, 8, materials.graniteLight, -10 + i * 4, 5.5, 33);
    }
    root.add(g);
  }

  function buildCityHall() {
    var g = new THREE.Group();
    g.position.set(120, -18, 560);
    addBox(g, 92, 2, 58, materials.stoneGrey, 0, 1, 0, 0, false);
    addBox(g, 80, 22, 34, materials.graniteLight, 0, 12, 0, 0, true);
    addBox(g, 28, 10, 9, materials.graniteLight, 0, 7, 21, 0, true);
    addBox(g, 32, 1.0, 11, materials.tileDark, 0, 12.4, 21, 0, true);
    for (var i = 0; i < 6; i++) {
      addCyl(g, 0.4, 0.45, 9, 8, materials.graniteLight, -12 + i * 4.8, 5.5, 21);
    }
    root.add(g);
  }

  function buildPeoplePark() {
    var g = new THREE.Group();
    g.position.set(120, -18, 690);
    addBox(g, 180, 0.3, 110, materials.grassDark, 0, 0.15, 0, 0, true);
    addBox(g, 150, 0.35, 80, materials.paving, 0, 0.32, 0, 0, true);
    var rand = mulberry32(1927);
    for (var i = 0; i < 12; i++) {
      var x = -64 + rand() * 128;
      var z = -38 + rand() * 76;
      if (Math.abs(x) < 8 && Math.abs(z) < 24) continue;
      addCyl(g, 0.3, 0.4, 3.2, 5, materials.woodDark, x, 1.7, z, true);
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), materials.leaf);
      crown.position.set(x, 4.8, z);
      crown.scale.set(1.1, 0.8, 1.0);
      g.add(crown);
    }
    root.add(g);
  }

  function buildHaizhuSquare() {
    var g = new THREE.Group();
    g.position.set(120, -18, 820);
    addBox(g, 140, 0.3, 92, materials.paving, 0, 0.15, 0, 0, true);
    addBox(g, 26, 1.2, 26, materials.stoneGrey, 0, 0.8, 0, 0, true);
    addCyl(g, 0.18, 0.25, 18, 6, materials.metal, 0, 9.8, 0);
    addBox(g, 50, 12, 24, materials.cityBody, -70, 6, 0, 0, true);
    addBox(g, 50, 12, 24, materials.cityBody, 70, 6, 0, 0, true);
    root.add(g);
  }

  function buildRiverAndBridge() {
    riverMat = materials.water;
    var river = new THREE.Mesh(new THREE.PlaneGeometry(1600, 140), riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, -17.6, 900);
    root.add(river);
    var bridge = new THREE.Group();
    bridge.position.set(120, -18, 900);
    addBox(bridge, 26, 1.2, 150, materials.stoneGrey, 0, 8, 0, 0, true);
    [-1, 1].forEach(function (side) {
      addBox(bridge, 1.4, 7, 150, materials.metal, side * 12.5, 12, 0, 0, true);
      for (var i = 0; i < 8; i++) {
        addCyl(bridge, 0.24, 0.3, 15, 5, materials.metal, side * 12.5, 6, -64 + i * 18.3, true);
      }
    });
    root.add(bridge);
  }

  function buildStadium() {
    var g = new THREE.Group();
    g.position.set(330, -8, 300);
    var field = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), materials.pitch);
    field.rotation.x = -Math.PI / 2;
    field.position.y = 0.2;
    g.add(field);
    var track = new THREE.Mesh(new THREE.RingGeometry(42, 54, 40), materials.blueTrack);
    track.rotation.x = -Math.PI / 2;
    track.scale.set(1.35, 0.92, 1);
    track.position.y = 0.28;
    g.add(track);
    [-1, 1].forEach(function (side) {
      var stand = new THREE.Mesh(new THREE.BoxGeometry(110, 7, 12), materials.yellowSeat);
      stand.position.set(0, 4.0, side * 38);
      stand.rotation.x = side * 0.12;
      g.add(stand);
    });
    var west = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 72), materials.yellowSeat);
    west.position.set(-52, 4.0, 0);
    west.rotation.z = 0.12;
    g.add(west);
    var canopy = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 80), materials.stoneGrey);
    canopy.position.set(46, 12, 0);
    canopy.rotation.z = -0.16;
    g.add(canopy);
    for (var i = 0; i < 4; i++) {
      addCyl(g, 0.2, 0.2, 13, 5, materials.metal, 46, 6, -30 + i * 20, true);
    }
    root.add(g);
  }

  function buildCity(low) {
    buildOldCity(low);
    var boulevard = new THREE.Mesh(new THREE.PlaneGeometry(48, 520), materials.paving);
    boulevard.rotation.x = -Math.PI / 2;
    boulevard.position.set(120, -17.45, 590);
    root.add(boulevard);
    [440, 510, 580, 650, 720, 790].forEach(function (z) {
      [-27, 27].forEach(function (dx) {
        buildFeatureTree(120 + dx, -18, z, 0.82, dx < 0 ? materials.leaf : materials.leafOlive);
      });
    });
    buildMemorialHall();
    buildCityHall();
    buildPeoplePark();
    buildHaizhuSquare();
    buildRiverAndBridge();
    buildStadium();
    // 远处广州塔剪影（压缩，不作为主体）
    var tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 18, 300, 12), materials.cityModern);
    tower.position.set(-420, 132, 1180);
    tower.scale.z = 0.7;
    root.add(tower);
    addCyl(root, 0.5, 0.5, 60, 5, materials.metal, -420, 312, 1180, true);
    landmarkMats.push(materials.cityModern);
  }

  /* ---------------- 植被 / 灯 ---------------- */

  function buildVegetation(low) {
    var rand = mulberry32(20261030);
    var target = low ? 140 : 460;
    var trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 2.2, 5);
    trunkGeo.translate(0, 1.1, 0);
    var blobGeo = new THREE.IcosahedronGeometry(1.5, 0);
    blobGeo.translate(0, 2.0, 0);
    var trunkMat = new THREE.MeshStandardMaterial({ map: textures.trunk, color: 0x6e5a44, roughness: 1 });
    var canMats = [
      new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x6f8f64, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x4f704f, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: textures.leafOlive, color: 0x7c8f5c, roughness: 1 })
    ];
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, target);
    var blobs = [
      new THREE.InstancedMesh(blobGeo, canMats[0], target),
      new THREE.InstancedMesh(blobGeo, canMats[1], target),
      new THREE.InstancedMesh(blobGeo, canMats[2], target)
    ];
    var counts = [0, 0, 0];
    var dummy = new THREE.Object3D();
    var placed = 0, guard = 0;
    while (placed < target && guard < target * 16) {
      guard++;
      var x = rand() * 600 - 300;
      var z = rand() * 520 - 220;
      if (z > 250) continue;
      var y = heightAt(x, z);
      if (y > 23.2 || y < -20) continue;
      if (Math.abs(x + 210) < 58 && Math.abs(z - 40) < 48) continue;
      if (Math.abs(x + 34) < 92 && Math.abs(z + 62) < 34) continue;
      if (Math.abs(x - 124) < 70 && Math.abs(z + 79) < 44) continue;
      if (Math.abs(x - 120) < 12 && z > -110 && z < 30) continue;
      if (z > 180 && Math.abs(x - 120) < 14) continue;
      if (x < -255 && z > 45 && z < 90) continue;
      var s = 0.8 + rand() * 1.1;
      dummy.position.set(x, y, z);
      dummy.scale.set(s, s * (0.9 + rand() * 0.35), s);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      var shade = Math.floor(rand() * 3);
      blobs[shade].setMatrixAt(counts[shade], dummy.matrix);
      counts[shade]++;
      placed++;
    }
    trunks.count = placed;
    trunks.castShadow = !low;
    trunks.receiveShadow = true;
    root.add(trunks);
    for (var c = 0; c < 3; c++) {
      blobs[c].count = counts[c];
      blobs[c].castShadow = !low;
      blobs[c].receiveShadow = true;
      root.add(blobs[c]);
    }
    // 纪念碑附近红棉/红花树
    [[80, 226], [160, 228], [96, 286], [150, 284]].forEach(function (p) {
      addCyl(root, 0.3, 0.4, 4.2, 5, materials.woodDark, p[0], heightAt(p[0], p[1]) + 2.1, p[1]);
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), materials.redFlower);
      crown.position.set(p[0], heightAt(p[0], p[1]) + 6.0, p[1]);
      crown.scale.set(1.1, 0.75, 1.0);
      root.add(crown);
    });
    // 五羊花坛三角梅已由 buildBougainvillea 处理
  }

  function buildLamps() {
    [-52, -18, 16].forEach(function (x) {
      var y = WALL_PATH.y;
      addCyl(root, 0.06, 0.09, 2.2, 6, materials.stoneDark, x, y + 1.1, -49.5);
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd29a }));
      lamp.position.set(x, y + 2.2, -49.5);
      root.add(lamp);
      var light = new THREE.PointLight(0xffc98a, 0, 18, 2);
      light.position.copy(lamp.position);
      root.add(light);
      pathLights.push(light);
    });
    [[86, -46], [154, -46], [86, -92], [154, -92]].forEach(function (p) {
      addCyl(root, 0.06, 0.09, 2.4, 6, materials.stoneDark, p[0], TOWER_PLAZA.y + 1.2, p[1]);
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd29a }));
      lamp.position.set(p[0], TOWER_PLAZA.y + 2.4, p[1]);
      root.add(lamp);
      var light = new THREE.PointLight(0xffc98a, 0, 20, 2);
      light.position.copy(lamp.position);
      root.add(light);
      plazaLights.push(light);
    });
  }

  /* ---------------- hotspots ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "xianting", craft: "xianting", no: "01", name: "五羊仙庭",
        pos: new THREE.Vector3(-238, 4.2, 40),
        view: { pos: new THREE.Vector3(-292, 8.5, 62), target: new THREE.Vector3(-238, 5.0, 40) },
        lede: "1990 年以五羊石像为核心扩建的景区：两组五羊仙故事浮雕、牌坊、亭台廊碑，把一座雕塑扩成近一万平方米的“仙庭”。",
        facts: [["扩建", "1990 年"], ["范围", "近 1 万㎡"], ["核心", "五羊石像"]],
        detail: "牌坊与浮雕按公开资料做示意复原；浮雕内容不逐幅照抄，文字用 canvas 近似。"
      },
      {
        id: "rams", craft: "rams", no: "02", name: "五羊石像",
        pos: new THREE.Vector3(-210, 7.2, 42),
        view: { pos: new THREE.Vector3(-227, 4.2, 54), target: new THREE.Vector3(-210, 6.0, 40) },
        lede: "连基座高 11 米，130 余块花岗岩组砌；主羊衔“一茎六出”谷穗，四羊环绕。1959–1960 年建成，常见口径为 1960 年 4 月落成。",
        facts: [["高", "11 m"], ["花岗岩", "130 余块"], ["落成", "1960.04"]],
        detail: "五羊为羊城城标；1999 年市保、2022 年省保。基座是粗凿岩座，不是独立方台；群雕为低模示意复原。"
      },
      {
        id: "wall", craft: "wall", no: "03", name: "明城墙 · 榕根",
        pos: new THREE.Vector3(-38, 17.0, -73),
        view: { pos: new THREE.Vector3(-38, 15.2, -53), target: new THREE.Vector3(-48, 16.8, -79.5) },
        lede: "明洪武十三年（1380）扩建广州城时修到越秀山；现存总长 1137 米，高 6–10 米，镇海楼段约 170–200 米，青砖、红砂岩基与榕树气生根长成“树抱墙”。",
        facts: [["始建", "1380 年"], ["现存", "1137 m"], ["镇海楼段", "170–200 m"]],
        detail: "城墙只做镇海楼段核心 170–200 米；是否可上墙未确认，场景只做墙前步道与墙顶轮廓。"
      },
      {
        id: "tower", craft: "tower", no: "04", name: "镇海楼",
        pos: new THREE.Vector3(120, 38.0, -86),
        view: { pos: new THREE.Vector3(108, 25.5, -46), target: new THREE.Vector3(120, 35.0, -94) },
        lede: "明洪武十三年（1380）建，五层，俗称“五层楼”；高 28 米，首层 31 × 15.77 米，朱红墙、绿琉璃瓦。1928 年重修改为钢筋混凝土，现为广州博物馆。",
        facts: [["始建", "1380 年"], ["高", "28 m"], ["层数", "5 层"]],
        detail: "旧资料作 25 米；1928 年重修保留明代外观。楼内展陈不在近景范围；牌匾与灯笼为示意。"
      },
      {
        id: "axis", craft: "axis", no: "05", name: "南望 · 老城中轴",
        pos: new THREE.Vector3(120, 3.0, 560),
        far: true,
        view: { pos: new THREE.Vector3(120, 88, -165), target: new THREE.Vector3(120, 12, 430) },
        lede: "从镇海楼顶层向南：中山纪念堂、市政府、人民公园、海珠广场、海珠桥依次落在传统中轴线上；珠江在更远处。",
        facts: [["方向", "南望"], ["轴线", "纪念堂—海珠桥"], ["水面", "珠江"]],
        detail: "城市为压缩示意：高度按公开量级，水平距离缩短并加雾；不作为测绘或导航依据。"
      },
      {
        id: "monument", craft: "monument", no: "06", name: "中山纪念碑 · 远景",
        pos: new THREE.Vector3(120, 38.0, 248),
        far: true,
        view: { pos: new THREE.Vector3(120, 55.0, -82), target: new THREE.Vector3(120, 34.0, 248) },
        lede: "越井岗顶的方锥形花岗岩碑，高 37 米、13 层；1929–1930 年建成，吕彦直设计；基座 26 个羊头石雕，南面刻《总理遗嘱》。",
        facts: [["高", "37 m"], ["层数", "13 层"], ["羊头", "26 个"]],
        detail: "只做南侧远景剪影；碑内旋梯、498 级台阶与碑文书写者不在近景范围，碑文不刻具体书法。"
      }
    ];
    return hotspots;
  }

  /* ---------------- build ---------------- */

  function build(opts) {
    textures = opts.textures;
    var low = !!opts.low;
    root = new THREE.Group();
    root.name = "yuexiu-park-core";
    materials = makeMaterials();
    hotspots = [];
    cityWinMats = [];
    landmarkMats = [];
    lanternMats = [];
    plazaLights = [];
    pathLights = [];
    riverMat = null;

    buildTerrain(low);
    buildSouthGround(low);
    buildFiveRamsPlaza();
    buildApproach();
    buildWallTerrace();
    buildWall();
    buildBanyans();
    buildTowerTerrace();
    buildMonument();
    buildCity(low);
    buildVegetation(low);
    buildLamps();
    buildHotspots();

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      cityWinMats: cityWinMats,
      landmarkMats: landmarkMats,
      lanternMats: lanternMats,
      plazaLights: plazaLights,
      pathLights: pathLights,
      riverMat: riverMat,
      bounds: new THREE.Box3(new THREE.Vector3(-320, -30, -240), new THREE.Vector3(700, 60, 1400))
    };
  }

  window.YuexiuModel = { build: build, heightAt: heightAt };
})();
