/* 白云山 · 摩星岭登顶段近景 · 1:1 主体建模
   坐标：1 单位 = 1 米；+Z 为南（城市方向），-Z 为北；山顶平台面 y = 0。
   依据：公开资料与游记（382 m、吉星石 6 × 4 m、栈道 150 m + 扶梯 60 m、抬升 26 m、
   锦绣南天牌坊、星形指北碑），以及公开实景照片做示意复原。
   城市与珠江为压缩示意，不做测绘级复原。 */
(function () {
  "use strict";

  var root = null;
  var textures = null;
  var materials = null;
  var hotspots = [];
  var cityWinMats = [];
  var cityLightMat = null;
  var cloudSeaMat = null;
  var landmarkMats = [];
  var cloudMats = [];
  var cloudSprites = [];
  var platformLights = [];
  var pathLights = [];

  var GATE_Z = 10;
  var ROCK_Z = 110;
  var STAIR_BOTTOM_Z = 5;
  var STAIR_TOP_Z = -83;
  var STAIR_RISE = 26;
  var PLATFORM_Z = -90;
  var PLATFORM_W = 15;
  var PLATFORM_D = 13;

  function sstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function heightAt(x, z) {
    var y = -26 * sstep(-80, GATE_Z, z);
    y -= 18 * sstep(150, 300, z);
    var ridge = 12 * Math.exp(-Math.pow((Math.abs(x) - 62) / 30, 2)) * sstep(-150, -70, z);
    y += ridge;
    var noise = (Math.sin(x * 0.055) * Math.cos(z * 0.043) + Math.sin(z * 0.11 + x * 0.07)) * 0.9;
    y += noise * sstep(8, 30, Math.abs(x));
    var d = Math.max(Math.abs(x) - 12, Math.abs(z - PLATFORM_Z) - 16, 0);
    var flat = 1 - sstep(0, 14, d);
    return y * (1 - flat);
  }

  function stairY(z) {
    var t = (STAIR_BOTTOM_Z - z) / (STAIR_BOTTOM_Z - STAIR_TOP_Z);
    return -STAIR_RISE * (1 - Math.max(0, Math.min(1, t)));
  }

  /* ---------------- 基础几何 helper ---------------- */

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

  function makeStarShape(outer, inner) {
    var s = new THREE.Shape();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var x = Math.cos(a) * r;
      var y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }

  /* ---------------- 材质 ---------------- */

  function makeMaterials() {
    var m = {};
    m.stone = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.92, metalness: 0.02, color: 0xd8d2c4 });
    m.stoneLight = new THREE.MeshStandardMaterial({ map: textures.stoneLight, roughness: 0.9, metalness: 0.02, color: 0xf0ece1 });
    m.stoneDark = new THREE.MeshStandardMaterial({ color: 0x565a52, roughness: 0.95, metalness: 0.02 });
    m.paving = new THREE.MeshStandardMaterial({ map: textures.paving, roughness: 0.9, metalness: 0.02, color: 0xc4bcab });
    m.wood = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.86, metalness: 0.02, color: 0xa07652 });
    m.tile = new THREE.MeshStandardMaterial({ map: textures.tile, roughness: 0.72, metalness: 0.05, color: 0xd09a55 });
    m.rock = new THREE.MeshStandardMaterial({ map: textures.rock, roughness: 0.98, metalness: 0.01, color: 0xb2ab9d });
    m.star = new THREE.MeshStandardMaterial({ map: textures.rock, roughness: 0.9, metalness: 0.02, color: 0x9c7e60 });
    m.metal = new THREE.MeshStandardMaterial({ color: 0x3d4548, roughness: 0.45, metalness: 0.6 });
    m.steel = new THREE.MeshStandardMaterial({ color: 0xb9c4c6, roughness: 0.5, metalness: 0.45 });
    m.steelDark = new THREE.MeshStandardMaterial({ color: 0x49565a, roughness: 0.55, metalness: 0.35 });
    m.glass = new THREE.MeshStandardMaterial({ color: 0xc8e4e2, roughness: 0.12, metalness: 0.08, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
    m.gold = new THREE.MeshStandardMaterial({ color: 0xb08a4e, roughness: 0.4, metalness: 0.55 });
    m.plaque = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.7 });
    m.red = new THREE.MeshStandardMaterial({ color: 0xa8322a, roughness: 0.75 });
    m.pink = new THREE.MeshStandardMaterial({ color: 0xdf9cae, roughness: 0.92 });
    m.bench = new THREE.MeshStandardMaterial({ color: 0x8b6f4d, roughness: 0.85 });
    m.glow = new THREE.MeshBasicMaterial({ color: 0xffd6a0 });
    return m;
  }

  /* ---------------- 地形 ---------------- */

  function buildTerrain(low) {
    var W = 400, D = 400, SX = low ? 70 : 120, SZ = low ? 70 : 120;
    var positions = [], uvs = [], indices = [];
    for (var iz = 0; iz <= SZ; iz++) {
      var z = -D / 2 + (iz / SZ) * D + 20;
      for (var ix = 0; ix <= SX; ix++) {
        var x = -W / 2 + (ix / SX) * W;
        positions.push(x, heightAt(x, z), z);
        uvs.push(ix / SX * 22, iz / SZ * 22);
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
      var rock = sstep(0.28, 0.62, 1 - ny);
      var high = sstep(-5, 1, y);
      var r = (0.30 + 0.22 * high) * (1 - rock) + 0.52 * rock;
      var g = (0.38 + 0.14 * high) * (1 - rock) + 0.49 * rock;
      var b = (0.23 + 0.10 * high) * (1 - rock) + 0.41 * rock;
      var px = positions[i * 3], pz = positions[i * 3 + 2];
      var patch = Math.sin(px * 0.08) * Math.cos(pz * 0.06) * 0.05
        + Math.sin(px * 0.21 + pz * 0.13) * 0.03;
      colors[i * 3] = r + patch;
      colors[i * 3 + 1] = g + patch * 1.2;
      colors[i * 3 + 2] = b + patch * 0.8;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    var mat = new THREE.MeshStandardMaterial({
      map: textures.grass, vertexColors: true, roughness: 1, metalness: 0, color: 0xffffff
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  function buildMidground(low) {
    var geo = new THREE.PlaneGeometry(4600, 3000, low ? 30 : 60, low ? 20 : 40);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i) + 1650;
      var y = -44 - 336 * sstep(150, 2300, z)
        + 26 * Math.sin(x * 0.0022 + 1.7) * Math.cos(z * 0.0019);
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x33453a, roughness: 1 }));
    mesh.position.z = 1650;
    root.add(mesh);
    [[-520, -560, 620, 120], [380, -660, 760, 150], [780, -420, 520, 100]].forEach(function (r) {
      var ridge = new THREE.Mesh(new THREE.ConeGeometry(r[2], r[3], 6), new THREE.MeshStandardMaterial({ color: 0x263a30, roughness: 1 }));
      ridge.position.set(r[0], -60, r[1]);
      ridge.scale.z = 0.55;
      root.add(ridge);
    });
  }

  /* ---------------- 门岗 · 吉星石 · 石级 ---------------- */

  function buildGate() {
    var g = new THREE.Group();
    var y0 = heightAt(0, GATE_Z);
    [-4.2, 4.2].forEach(function (x) {
      addBox(g, 1.4, 0.5, 1.6, materials.stone, x, y0 + 0.25, GATE_Z);
      addBox(g, 1.0, 5.0, 1.0, materials.stoneLight, x, y0 + 2.9, GATE_Z);
      addBox(g, 1.2, 0.3, 1.2, materials.stoneDark, x, y0 + 5.45, GATE_Z);
    });
    [-1, 1].forEach(function (side) {
      addBox(g, 6.2, 2.8, 1.1, materials.stone, side * 7.9, y0 + 1.4, GATE_Z);
      addBox(g, 6.2, 0.7, 1.3, materials.stoneLight, side * 7.9, y0 + 3.15, GATE_Z);
    });
    addBox(g, 9.4, 0.75, 1.2, materials.stoneLight, 0, y0 + 5.55, GATE_Z);
    addBox(g, 6.4, 0.3, 2.0, materials.tile, 0, y0 + 6.0, GATE_Z);
    addBox(g, 2.9, 1.05, 0.2, materials.plaque, 0, y0 + 5.1, GATE_Z + 0.63);
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 0.8), new THREE.MeshBasicMaterial({
      map: BaiyunTextures.makeTextTexture("摩星岭", 768, 240, "#e6d4a4", "#2b241b"), transparent: true
    }));
    plaque.position.set(0, y0 + 5.1, GATE_Z + 0.75);
    g.add(plaque);
    addBox(g, 16, 0.1, 14, materials.paving, 0, y0 + 0.05, GATE_Z + 10);
    addBox(g, 4.2, 0.08, 104, materials.paving, 0, heightAt(0, 60) + 0.04, 60);
    addBox(g, 3.4, 0.06, 104, materials.stoneDark, 0, heightAt(0, 60) + 0.02, 60);
    [-1, 1].forEach(function (side) {
      for (var i = 0; i < 12; i++) {
        var z = GATE_Z + 4 + i * 1.6;
        addBox(g, 0.28, 0.9, 0.28, materials.stoneLight, side * 2.4, heightAt(0, z) + 0.45, z);
      }
      addBox(g, 0.1, 0.12, 18, materials.steel, side * 2.4, heightAt(0, 20) + 0.95, GATE_Z + 13);
    });
    root.add(g);
  }

  function buildJixingStone() {
    var g = new THREE.Group();
    var x = 8, z = ROCK_Z;
    var y = heightAt(x, z);
    addBox(g, 8, 0.3, 5.6, materials.paving, x, y + 0.15, z);
    var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), materials.rock);
    rock.scale.set(2.2, 3.2, 1.4);
    rock.position.set(x, y + 3.1, z);
    rock.rotation.set(0.08, -0.35, 0.06);
    rock.castShadow = true; rock.receiveShadow = true;
    g.add(rock);
    var text = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.8), new THREE.MeshBasicMaterial({
      map: BaiyunTextures.makeVerticalTextTexture("摩星岭", 512, 900, "#e6d4a4", "#3b342a"), transparent: true
    }));
    text.position.set(x - 0.35, y + 3.25, z + 1.4);
    text.rotation.y = -0.16;
    g.add(text);
    addBox(g, 0.35, 1.2, 2.6, materials.wood, x + 4.2, y + 0.8, z - 0.6);
    addBox(g, 0.12, 0.5, 1.9, materials.plaque, x + 4.4, y + 0.9, z - 0.6);
    root.add(g);
  }

  function buildStairs() {
    var count = 180;
    var steps = [];
    for (var i = 0; i < count; i++) {
      var z = STAIR_BOTTOM_Z - (i / count) * (STAIR_BOTTOM_Z - STAIR_TOP_Z);
      steps.push({ z: z, y: stairY(z) });
    }
    var stepGeo = new THREE.BoxGeometry(3.8, 0.16, 0.52);
    var stepMesh = new THREE.InstancedMesh(stepGeo, materials.stone, steps.length);
    var dummy = new THREE.Object3D();
    steps.forEach(function (s, i) {
      dummy.position.set(0, s.y - 0.08, s.z);
      dummy.updateMatrix();
      stepMesh.setMatrixAt(i, dummy.matrix);
    });
    stepMesh.castShadow = true; stepMesh.receiveShadow = true;
    root.add(stepMesh);
    [30, 60, 90, 120, 150].forEach(function (i) {
      var s = steps[i];
      addBox(root, 6.2, 0.22, 2.2, materials.paving, 0, s.y + 0.03, s.z);
    });
    [-2.1, 2.1].forEach(function (x) {
      var pts = [];
      for (var i = 0; i < steps.length; i += 5) {
        var s = steps[i];
        pts.push(new THREE.Vector3(x, s.y + 1.0, s.z));
      }
      var curve = new THREE.CatmullRomCurve3(pts);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.055, 5, false), materials.steel));
      for (var j = 0; j < steps.length; j += 10) {
        var s2 = steps[j];
        addCyl(root, 0.045, 0.045, 1.0, 5, materials.steel, x, s2.y + 0.5, s2.z);
      }
      var kerbPts = [];
      for (var k = 0; k < steps.length; k += 8) {
        kerbPts.push(new THREE.Vector3(x * 1.35, steps[k].y + 0.28, steps[k].z));
      }
      var kerb = new THREE.CatmullRomCurve3(kerbPts);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(kerb, 50, 0.16, 5, false), materials.stone));
    });
    [-2.1, 2.1].forEach(function (x) {
      addBox(root, 0.55, 1.1, 0.55, materials.stoneLight, x, 0.55, STAIR_TOP_Z);
      addBox(root, 0.55, 1.1, 0.55, materials.stoneLight, x, stairY(STAIR_BOTTOM_Z) + 0.55, STAIR_BOTTOM_Z);
    });
  }

  function buildPaifang() {
    var z = -45;
    var y0 = stairY(z);
    var g = new THREE.Group();
    [-5.1, -2.4, 2.4, 5.1].forEach(function (x) {
      addCyl(g, 0.28, 0.34, 7.2, 10, materials.stoneLight, x, y0 + 3.6, z);
      addCyl(g, 0.5, 0.56, 0.45, 10, materials.stone, x, y0 + 0.22, z);
      addCyl(g, 0.42, 0.3, 0.5, 10, materials.gold, x, y0 + 7.25, z);
      var cap = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.75, 4), materials.tile);
      cap.rotation.y = Math.PI / 4;
      cap.position.set(x, y0 + 7.95, z);
      g.add(cap);
    });
    addBox(g, 11.6, 0.55, 0.95, materials.stoneLight, 0, y0 + 6.7, z);
    addBox(g, 5.8, 0.45, 0.85, materials.stoneLight, 0, y0 + 7.15, z);
    addBox(g, 4.6, 0.9, 0.18, materials.plaque, 0, y0 + 6.2, z + 0.52);
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.25, 0.72), new THREE.MeshBasicMaterial({
      map: BaiyunTextures.makeTextTexture("锦绣南天", 900, 180, "#e8c56f", "#2b241b"), transparent: true
    }));
    plaque.position.set(0, y0 + 6.2, z + 0.63);
    g.add(plaque);
    [1, -1].forEach(function (side) {
      var roof = addBox(g, 13.2, 0.22, 2.0, materials.tile, 0, y0 + 7.45, z + side * 0.82);
      roof.rotation.x = side * 0.17;
      var eave = addBox(g, 13.4, 0.18, 0.18, materials.stoneDark, 0, y0 + 7.28, z + side * 1.7);
      eave.rotation.x = side * 0.17;
    });
    addBox(g, 13.4, 0.2, 0.3, materials.stoneDark, 0, y0 + 7.72, z);
    addBox(g, 10.2, 0.3, 1.4, materials.stoneDark, 0, y0 + 6.1, z);
    root.add(g);
  }

  /* ---------------- 钢构栈道与扶梯 ---------------- */

  function boardwalkCurve() {
    var pts = [
      new THREE.Vector3(-13, heightAt(-13, 104) + 0.65, 104),
      new THREE.Vector3(-30, heightAt(-30, 82) + 0.65, 82),
      new THREE.Vector3(-15, heightAt(-15, 55) + 0.65, 55),
      new THREE.Vector3(-31, heightAt(-31, 28) + 0.65, 28),
      new THREE.Vector3(-18, heightAt(-18, 2) + 0.65, 2),
      new THREE.Vector3(-24, heightAt(-24, -20) + 0.65, -20)
    ];
    return new THREE.CatmullRomCurve3(pts);
  }

  function buildBoardwalk() {
    var curve = boardwalkCurve();
    var N = 140;
    var verts = [], uvs = [], idx = [];
    for (var i = 0; i <= N; i++) {
      var p = curve.getPointAt(i / N);
      var tan = curve.getTangentAt(i / N);
      var nx = -tan.z, nz = tan.x;
      var len = Math.sqrt(nx * nx + nz * nz) || 1;
      nx /= len; nz /= len;
      verts.push(p.x + nx * 1.2, p.y, p.z + nz * 1.2);
      verts.push(p.x - nx * 1.2, p.y, p.z - nz * 1.2);
      uvs.push(0, i / N * 20, 1, i / N * 20);
      if (i < N) {
        var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var deck = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x465358, roughness: 0.62, metalness: 0.28 }));
    deck.castShadow = true; deck.receiveShadow = true;
    root.add(deck);

    var slatGeo = new THREE.BoxGeometry(0.035, 1.05, 0.09);
    var slatPerSide = Math.floor(N * 1.6) + 1;
    var slats = new THREE.InstancedMesh(slatGeo, materials.steel, slatPerSide * 2);
    var dummy = new THREE.Object3D();
    var si = 0;
    for (var side = -1; side <= 1; side += 2) {
      for (var k = 0; k < slatPerSide; k++) {
        var t = k / (slatPerSide - 1);
        var p = curve.getPointAt(t);
        var tan = curve.getTangentAt(t);
        var nx = -tan.z, nz = tan.x;
        var l = Math.sqrt(nx * nx + nz * nz) || 1;
        dummy.position.set(p.x + side * nx / l * 1.08, p.y + 0.58, p.z + side * nz / l * 1.08);
        dummy.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
        dummy.updateMatrix();
        slats.setMatrixAt(si++, dummy.matrix);
      }
    }
    slats.count = si;
    root.add(slats);

    var supportGeo = new THREE.BoxGeometry(0.22, 1, 0.22);
    var supports = new THREE.InstancedMesh(supportGeo, materials.steelDark, 60);
    var sc = 0;
    for (var s = 0; s < 24; s++) {
      var p = curve.getPointAt(s / 24);
      var ground = heightAt(p.x, p.z);
      var h = Math.max(0.4, p.y - ground - 0.2);
      dummy.position.set(p.x, ground + h / 2, p.z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      supports.setMatrixAt(sc++, dummy.matrix);
      if (sc < 60) {
        dummy.position.set(p.x, ground + h * 0.55, p.z);
        dummy.scale.set(1, h * 0.62, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        supports.setMatrixAt(sc++, dummy.matrix);
      }
    }
    supports.count = sc;
    root.add(supports);
    return curve;
  }

  function buildEscalator() {
    var lower = new THREE.Vector3(-24, heightAt(-24, -20) + 0.65, -20);
    var mid = new THREE.Vector3(-22, -10.4, -50);
    var top = new THREE.Vector3(-14, 0.15, -80);
    var legs = [[lower, mid], [mid, top]];
    legs.forEach(function (leg) {
      var a = leg[0], b = leg[1];
      var dir = b.clone().sub(a);
      var flat = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
      var angle = Math.atan2(dir.y, flat);
      var len = dir.length();
      var yaw = Math.atan2(dir.x, dir.z);
      var center = a.clone().add(b).multiplyScalar(0.5);
      var base = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.55, len), materials.steelDark);
      base.position.copy(center);
      base.rotation.order = "YXZ";
      base.rotation.y = yaw;
      base.rotation.x = -angle;
      root.add(base);
      var glassL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, len), materials.glass);
      glassL.position.copy(center);
      glassL.position.x += Math.cos(yaw) * 1.6;
      glassL.position.z -= Math.sin(yaw) * 1.6;
      glassL.rotation.y = yaw;
      glassL.rotation.x = -angle;
      root.add(glassL);
      var glassR = glassL.clone();
      glassR.position.copy(center);
      glassR.position.x -= Math.cos(yaw) * 1.6;
      glassR.position.z += Math.sin(yaw) * 1.6;
      root.add(glassR);
      var stepGeo = new THREE.BoxGeometry(2.7, 0.16, 0.4);
      var steps = new THREE.InstancedMesh(stepGeo, materials.steelDark, Math.floor(len / 0.6));
      var dummy = new THREE.Object3D();
      for (var i = 0; i < steps.count; i++) {
        var t = (i + 0.5) / steps.count;
        dummy.position.lerpVectors(a, b, t);
        dummy.position.y += 0.12;
        dummy.rotation.y = yaw;
        dummy.rotation.x = -angle;
        dummy.updateMatrix();
        steps.setMatrixAt(i, dummy.matrix);
      }
      root.add(steps);
      for (var f = 0; f <= 5; f++) {
        var p = a.clone().lerp(b, f / 5);
        var left = new THREE.Vector3(p.x + Math.cos(yaw) * 2.0, p.y + 2.7, p.z - Math.sin(yaw) * 2.0);
        var right = new THREE.Vector3(p.x - Math.cos(yaw) * 2.0, p.y + 2.7, p.z + Math.sin(yaw) * 2.0);
        addBeam(root, p.x + Math.cos(yaw) * 1.9, p.y, p.z - Math.sin(yaw) * 1.9, left.x, left.y, left.z, 0.13, materials.steel, 6);
        addBeam(root, p.x - Math.cos(yaw) * 1.9, p.y, p.z + Math.sin(yaw) * 1.9, right.x, right.y, right.z, 0.13, materials.steel, 6);
        addBeam(root, left.x, left.y, left.z, right.x, right.y, right.z, 0.1, materials.steel, 6);
        if (f < 5) {
          var q = a.clone().lerp(b, (f + 1) / 5);
          var segLen = p.distanceTo(q);
          var panel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, segLen), materials.glass);
          panel.position.copy(p).add(q).multiplyScalar(0.5);
          panel.position.y += 2.72;
          panel.rotation.order = "YXZ";
          panel.rotation.y = yaw;
          panel.rotation.x = -angle;
          root.add(panel);
        }
      }
      var strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, len), materials.glow);
      strip.position.copy(center);
      strip.position.y += 2.35;
      strip.rotation.y = yaw;
      strip.rotation.x = -angle;
      root.add(strip);
    });
    addBox(root, 6, 2.6, 5, materials.stone, -24, heightAt(-24, -20) + 1.3, -20);
    addBox(root, 6, 3.4, 5, materials.stone, -14, 1.7, -80);
    addBox(root, 6, 0.4, 5.5, materials.tile, -14, 3.6, -80);
    addBox(root, 4, 0.25, 4, materials.paving, -14, 0.12, -82);
    [-20, -35, -50, -65].forEach(function (z) {
      var x = -22;
      var light = new THREE.PointLight(0xffc98a, 0, 18, 2);
      light.position.set(x, stairY(z) + 3.2, z);
      root.add(light);
      pathLights.push(light);
    });
  }

  /* ---------------- 山顶 ---------------- */

  function buildPlatform() {
    addBox(root, PLATFORM_W, 0.3, PLATFORM_D, materials.paving, 0, 0, PLATFORM_Z);
    addBox(root, PLATFORM_W + 0.8, 0.5, PLATFORM_D + 0.8, materials.stoneDark, 0, -0.35, PLATFORM_Z);
    [-1, 1].forEach(function (side) {
      addBox(root, 0.25, 1.0, PLATFORM_D, materials.stone, side * (PLATFORM_W / 2), 0.5, PLATFORM_Z);
      addBox(root, 3.0, 0.9, 0.25, materials.stone, side * 5.8, 0.45, PLATFORM_Z + PLATFORM_D / 2);
    });
    addBox(root, PLATFORM_W, 1.0, 0.25, materials.stone, 0, 0.5, PLATFORM_Z - PLATFORM_D / 2);
    for (var i = 0; i < 20; i++) {
      var t = i / 19;
      var x = -PLATFORM_W / 2 + 0.6 + t * (PLATFORM_W - 1.2);
      addCyl(root, 0.05, 0.05, 1.05, 5, materials.steel, x, 0.55, PLATFORM_Z - PLATFORM_D / 2 - 0.16);
    }
    addBox(root, PLATFORM_W - 1.0, 0.07, 0.07, materials.steel, 0, 1.05, PLATFORM_Z - PLATFORM_D / 2 - 0.16);
    [-1, 1].forEach(function (side) {
      addBox(root, 0.07, 0.07, PLATFORM_D - 1.0, materials.steel, side * (PLATFORM_W / 2 + 0.16), 1.05, PLATFORM_Z);
    });
  }

  function buildMarker() {
    var x = -3.4, z = PLATFORM_Z + 3.4;
    addBox(root, 3.6, 0.35, 2.6, materials.stoneDark, x, 0.28, z);
    var obShape = new THREE.Shape();
    obShape.moveTo(-0.75, 0);
    obShape.lineTo(0.75, 0);
    obShape.lineTo(0.75, 3.6);
    obShape.lineTo(-0.75, 3.6);
    obShape.lineTo(-0.75, 0);
    var obGeo = new THREE.ExtrudeGeometry(obShape, { depth: 0.8, bevelEnabled: false });
    obGeo.translate(0, 0, -0.4);
    var obelisk = new THREE.Mesh(obGeo, materials.steelDark);
    obelisk.position.set(x, 0.45, z);
    obelisk.castShadow = true;
    obelisk.receiveShadow = true;
    root.add(obelisk);
    addCyl(root, 0.28, 0.28, 0.6, 8, materials.steelDark, x, 4.15, z);
    var starGeo = new THREE.ExtrudeGeometry(makeStarShape(2.35, 0.95), { depth: 1.0, bevelEnabled: false });
    starGeo.translate(0, 0, -0.5);
    starGeo.rotateZ(Math.PI);
    var star = new THREE.Mesh(starGeo, materials.star);
    star.position.set(x, 5.4, z);
    star.castShadow = true; star.receiveShadow = true;
    root.add(star);
    var starText = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.05), new THREE.MeshBasicMaterial({
      map: BaiyunTextures.makeTextTextureTransparent("1900km 北京", 1100, 340, "#3a2a1c", 0.34),
      transparent: true, depthWrite: false
    }));
    starText.position.set(x, 5.45, z + 0.53);
    root.add(starText);
    var alt = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.9), new THREE.MeshBasicMaterial({
      map: BaiyunTextures.makeVerticalTextTexture("海拔382米", 260, 900, "#b5352a", "#3b3d34"), transparent: true
    }));
    alt.position.set(x + 0.78, 2.3, z + 0.42);
    root.add(alt);
    addCyl(root, 0.55, 0.55, 0.45, 16, materials.stone, x, 0.45, z);
    var rand = mulberry32(382);
    for (var i = 0; i < 40; i++) {
      var a = rand() * Math.PI * 2;
      var r = 1.1 + rand() * 0.7;
      var ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.03), materials.red);
      ribbon.position.set(x + Math.cos(a) * r, 0.55 + rand() * 0.6, z + Math.sin(a) * r * 0.8);
      ribbon.rotation.y = a;
      ribbon.rotation.z = (rand() - 0.5) * 0.5;
      root.add(ribbon);
    }
  }

  function buildLocks() {
    var x = 5.6, z = PLATFORM_Z + 2.0;
    addCyl(root, 1.7, 1.9, 0.3, 24, materials.stone, x, 0.15, z);
    for (var i = 0; i < 16; i++) {
      var a = (i / 16) * Math.PI * 2;
      addCyl(root, 0.035, 0.035, 1.0, 4, materials.gold, x + Math.cos(a) * 1.55, 0.75, z + Math.sin(a) * 1.55);
    }
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.04, 5, 40), materials.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 1.22, z);
    root.add(ring);
    var rand = mulberry32(522);
    for (var k = 0; k < 18; k++) {
      var a2 = rand() * Math.PI * 2;
      var lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.08), k % 3 === 0 ? materials.gold : materials.red);
      lock.position.set(x + Math.cos(a2) * (1.1 + rand() * 0.4), 0.75 + rand() * 0.35, z + Math.sin(a2) * (1.1 + rand() * 0.4));
      lock.rotation.y = a2;
      root.add(lock);
    }
  }

  function buildPrayerRacks() {
    [-4.8, -7.0].forEach(function (x) {
      addBox(root, 0.15, 2.4, 0.15, materials.wood, x, 1.2, PLATFORM_Z - 2.4);
      addBox(root, 2.0, 0.12, 0.12, materials.wood, x + 0.9, 2.2, PLATFORM_Z - 2.4);
      addBox(root, 0.15, 2.4, 0.15, materials.wood, x + 1.8, 1.2, PLATFORM_Z - 2.4);
      for (var j = 0; j < 7; j++) {
        var plaque = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.03), j % 2 ? materials.red : materials.gold);
        plaque.position.set(x + 0.2 + j * 0.24, 1.95 - (j % 3) * 0.06, PLATFORM_Z - 2.4);
        root.add(plaque);
      }
    });
    addBox(root, 1.6, 2.1, 0.45, materials.stone, -6.4, 1.05, PLATFORM_Z + 4.4);
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.0), new THREE.MeshBasicMaterial({
      map: BaiyunTextures.makeTextTexture("摩星岭 382m", 500, 400, "#e6d4a4", "#3b3a32"), transparent: true
    }));
    sign.position.set(-6.4, 1.2, PLATFORM_Z + 4.64);
    root.add(sign);
  }

  function buildPavilion() {
    var g = new THREE.Group();
    g.position.set(2.0, 0.15, PLATFORM_Z - 3.0);
    addCyl(g, 3.2, 3.4, 0.3, 24, materials.stone, 0, 0.15, 0);
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      addCyl(g, 0.12, 0.14, 3.2, 8, materials.stoneLight, Math.cos(a) * 2.35, 1.9, Math.sin(a) * 2.35);
    }
    var ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.16, 6, 40), materials.stoneLight);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 3.5;
    g.add(ring);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 1.5, 16), new THREE.MeshStandardMaterial({ color: 0x6f7873, roughness: 0.6, metalness: 0.15 }));
    roof.position.y = 4.3;
    g.add(roof);
    var eave = new THREE.Mesh(new THREE.TorusGeometry(3.82, 0.09, 5, 40), materials.stoneDark);
    eave.rotation.x = Math.PI / 2;
    eave.position.y = 3.62;
    g.add(eave);
    addCyl(g, 0.06, 0.06, 0.9, 6, materials.stoneLight, 0, 5.35, 0);
    var bench = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.18, 6, 32), materials.bench);
    bench.rotation.x = Math.PI / 2;
    bench.position.y = 0.75;
    g.add(bench);
    root.add(g);
    var light = new THREE.PointLight(0xffc98a, 0, 22, 2);
    light.position.set(2.0, 3.8, PLATFORM_Z - 3.0);
    root.add(light);
    platformLights.push(light);
    var tree = new THREE.Group();
    tree.position.set(8.6, 0, PLATFORM_Z - 6.0);
    addCyl(tree, 0.18, 0.26, 3.0, 6, materials.wood, 0, 1.5, 0);
    var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), materials.pink);
    crown.position.set(0, 3.4, 0);
    crown.scale.set(1.15, 0.9, 1.0);
    tree.add(crown);
    [[-1.1, 3.0, 0.4], [0.9, 2.9, -0.5], [0.4, 3.9, 0.6]].forEach(function (p) {
      var blossom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), materials.pink);
      blossom.position.set(p[0], p[1], p[2]);
      tree.add(blossom);
    });
    root.add(tree);
  }

  function buildLamps() {
    [[-6.4, PLATFORM_Z + 4.2], [6.4, PLATFORM_Z + 4.2], [-6.4, PLATFORM_Z - 4.8], [6.4, PLATFORM_Z - 4.8]].forEach(function (p) {
      addCyl(root, 0.06, 0.08, 2.6, 6, materials.steelDark, p[0], 1.3, p[1]);
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), materials.glow);
      lamp.position.set(p[0], 2.65, p[1]);
      root.add(lamp);
      var light = new THREE.PointLight(0xffc98a, 0, 16, 2);
      light.position.set(p[0], 2.5, p[1]);
      root.add(light);
      platformLights.push(light);
    });
    [ROCK_Z - 20, 70, 35].forEach(function (z) {
      var x = z > 90 ? -5.2 : 5.2;
      var y = heightAt(x, z);
      addCyl(root, 0.05, 0.07, 2.4, 6, materials.steelDark, x, y + 1.2, z);
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), materials.glow);
      lamp.position.set(x, y + 2.4, z);
      root.add(lamp);
      var light = new THREE.PointLight(0xffc98a, 0, 14, 2);
      light.position.set(x, y + 2.3, z);
      root.add(light);
      pathLights.push(light);
    });
  }

  /* ---------------- 植被与山石 ---------------- */

  function buildVegetation(low) {
    var rand = mulberry32(20261030);
    var target = low ? 380 : 1200;
    var trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1.5, 5);
    trunkGeo.translate(0, 0.75, 0);
    var coneGeo = new THREE.ConeGeometry(1.0, 2.9, 6);
    coneGeo.translate(0, 1.45, 0);
    var blobGeo = new THREE.IcosahedronGeometry(1.15, 0);
    blobGeo.translate(0, 1.55, 0);
    var trunkMat = new THREE.MeshStandardMaterial({ map: textures.trunk, color: 0x71604a, roughness: 1 });
    var canMats = [
      new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x6f8f64, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x55764f, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x3f5e3d, roughness: 1 })
    ];
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, target);
    var cones = [
      new THREE.InstancedMesh(coneGeo, canMats[0], target),
      new THREE.InstancedMesh(coneGeo, canMats[1], target),
      new THREE.InstancedMesh(coneGeo, canMats[2], target)
    ];
    var blobs = [
      new THREE.InstancedMesh(blobGeo, canMats[0], target),
      new THREE.InstancedMesh(blobGeo, canMats[1], target),
      new THREE.InstancedMesh(blobGeo, canMats[2], target)
    ];
    var counts = [0, 0, 0];
    var blobCounts = [0, 0, 0];
    var dummy = new THREE.Object3D();
    var placed = 0, guard = 0;
    while (placed < target && guard < target * 14) {
      guard++;
      var x = rand() * 370 - 185;
      var z = rand() * 350 - 150;
      var y = heightAt(x, z);
      if (y > 18 || y < -62) continue;
      if (Math.abs(x) < 9 && z > -90 && z < 128) continue;
      if (x > -38 && x < -8 && z > -88 && z < 122) continue;
      if (Math.abs(x) < 14 && z > -108 && z < -70) continue;
      if (z > -72 && Math.abs(x) < 0.14 * (z + 72) + 10) continue;
      var s = 0.58 + rand() * 0.9;
      dummy.position.set(x, y, z);
      dummy.scale.set(s, s * (0.9 + rand() * 0.35), s);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      var shade = Math.floor(rand() * 3);
      if (rand() < 0.32) {
        cones[shade].setMatrixAt(counts[shade], dummy.matrix);
        counts[shade]++;
      } else {
        blobs[shade].setMatrixAt(blobCounts[shade], dummy.matrix);
        blobCounts[shade]++;
      }
      placed++;
    }
    trunks.count = placed;
    root.add(trunks);
    for (var c = 0; c < 3; c++) {
      cones[c].count = counts[c];
      blobs[c].count = blobCounts[c];
      if (counts[c] > 0) root.add(cones[c]);
      if (blobCounts[c] > 0) root.add(blobs[c]);
    }

    var rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.9, 0), materials.rock, low ? 30 : 80);
    var rc = 0;
    guard = 0;
    while (rc < rocks.count && guard < 1600) {
      guard++;
      var rx = rand() * 340 - 170;
      var rz = rand() * 300 - 140;
      var ry = heightAt(rx, rz);
      if (ry > 16 || ry < -45) continue;
      if (Math.abs(rx) < 14 && rz > -108 && rz < -70) continue;
      if (Math.abs(rx) < 9 && rz > -90 && rz < 128) continue;
      var rs = 0.4 + rand() * 1.3;
      dummy.position.set(rx, ry + rs * 0.2, rz);
      dummy.scale.set(rs, rs * 0.7, rs);
      dummy.rotation.set(rand(), rand() * 6.3, rand());
      dummy.updateMatrix();
      rocks.setMatrixAt(rc, dummy.matrix);
      rc++;
    }
    rocks.count = rc;
    root.add(rocks);
  }

  /* ---------------- 城市 · 珠江 ---------------- */

  function buildCity(low) {
    var rand = mulberry32(3020);
    var count = low ? 180 : 420;
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshStandardMaterial({
      map: textures.cityWindow, color: 0x9aa4a6, roughness: 0.82, metalness: 0.08,
      emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0
    });
    cityWinMats.push(mat);
    var blocks = new THREE.InstancedMesh(geo, mat, count);
    var dummy = new THREE.Object3D();
    var lightPositions = [];
    var n = 0, guard = 0;
    while (n < count && guard < count * 8) {
      guard++;
      var x = rand() * 3600 - 1800;
      var z = 2850 + rand() * 1300;
      if (z > 2350 && z < 2650 && Math.abs(x) < 2600) continue;
      if (Math.abs(x) < 8 && z < 3200) continue;
      if (Math.hypot(x + 260, z - 3050) < 90) continue;
      if (Math.hypot(x - 280, z - 3150) < 80) continue;
      if (Math.hypot(x - 360, z - 3230) < 80) continue;
      if (Math.hypot(x - 40, z - 3000) < 70) continue;
      var h = 38 + Math.pow(rand(), 1.5) * 220;
      dummy.position.set(x, -380 + h / 2, z);
      dummy.scale.set(28 + rand() * 50, h, 28 + rand() * 50);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      blocks.setMatrixAt(n, dummy.matrix);
      lightPositions.push(x + (rand() - 0.5) * 40, -380 + h + 4, z + (rand() - 0.5) * 40);
      n++;
    }
    blocks.count = n;
    root.add(blocks);
    for (var li = 0; li < 520; li++) {
      var lx = rand() * 4000 - 2000;
      var lz = 2700 + rand() * 1600;
      lightPositions.push(lx, -380 + 6, lz);
    }
    var lightGeo = new THREE.BufferGeometry();
    lightGeo.setAttribute("position", new THREE.Float32BufferAttribute(lightPositions, 3));
    cityLightMat = new THREE.PointsMaterial({
      color: 0xffc07a, size: 2.4, sizeAttenuation: false,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    });
    var lights = new THREE.Points(lightGeo, cityLightMat);
    root.add(lights);
  }

  function buildLandmarks() {
    var g = new THREE.Group();
    var glass = new THREE.MeshStandardMaterial({
      color: 0x2c3946, roughness: 0.3, metalness: 0.4,
      emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0
    });
    landmarkMats.push(glass);
    cityWinMats.push(glass);
    var profile = [
      new THREE.Vector2(26, 0), new THREE.Vector2(19, 60), new THREE.Vector2(15, 140),
      new THREE.Vector2(13, 220), new THREE.Vector2(17, 300), new THREE.Vector2(22, 380),
      new THREE.Vector2(19, 440), new THREE.Vector2(11, 500), new THREE.Vector2(5, 560),
      new THREE.Vector2(2, 600)
    ];
    var tower = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), glass);
    tower.position.set(-260, -380, 3050);
    g.add(tower);
    var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 90, 6), materials.metal);
    antenna.position.set(-260, 265, 3050);
    g.add(antenna);
    for (var i = 0; i < 10; i++) {
      var y = 40 + i * 52;
      var r = 20 - i * 1.1;
      var ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.8, 4, 24), new THREE.MeshBasicMaterial({ color: 0x8fa7b8, transparent: true, opacity: 0.35 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-260, -380 + y, 3050);
      g.add(ring);
    }
    function towerBox(x, z, w, h, color) {
      var m = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.35, metalness: 0.45,
        emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0
      });
      landmarkMats.push(m);
      cityWinMats.push(m);
      var t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m);
      t.position.set(x, -380 + h / 2, z);
      g.add(t);
      var crown = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.12, w * 0.45, h * 0.08, 4), m);
      crown.position.set(x, -380 + h + h * 0.04, z);
      crown.rotation.y = Math.PI / 4;
      g.add(crown);
    }
    towerBox(280, 3150, 46, 530, 0x33475a);
    towerBox(360, 3230, 42, 520, 0x33475a);
    towerBox(40, 3000, 38, 390, 0x374b52);
    root.add(g);
  }

  function buildRiver() {
    var riverMat = new THREE.MeshStandardMaterial({
      color: 0x24424a, roughness: 0.32, metalness: 0.35,
      emissive: 0xff9a5a, emissiveIntensity: 0
    });
    var river = new THREE.Mesh(new THREE.PlaneGeometry(5200, 420, 1, 1), riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, -379.5, 2480);
    root.add(river);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 2600), new THREE.MeshBasicMaterial({ color: 0x0c1418 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -380.2, 3500);
    root.add(ground);
    return riverMat;
  }

  function buildClouds(low) {
    var rand = mulberry32(7712);
    var count = low ? 14 : 30;
    for (var k = 0; k < count; k++) {
      var mat = new THREE.SpriteMaterial({
        map: textures.cloud, color: 0xdfe9ef, transparent: true, opacity: 0,
        depthWrite: false
      });
      mat.userData.baseOpacity = 0.5 + rand() * 0.25;
      var sprite = new THREE.Sprite(mat);
      var x = rand() * 2800 - 1400;
      var z = 150 + rand() * 2600;
      var y = -110 + rand() * 72;
      sprite.position.set(x, y, z);
      var s = 380 + rand() * 620;
      sprite.scale.set(s, s * 0.34, 1);
      root.add(sprite);
      cloudMats.push(mat);
      cloudSprites.push({ sprite: sprite, baseX: x, speed: 0.35 + rand() * 0.55 });
    }
    [[-120, 620, -50, 700], [260, 900, -40, 820], [-380, 1200, -55, 900], [480, 1450, -35, 780], [-160, 1750, -50, 980], [240, 2050, -45, 860], [-80, 350, -30, 320], [160, 420, -25, 380], [-220, 520, -35, 420], [40, 760, -30, 360]].forEach(function (c) {
      var mat = new THREE.SpriteMaterial({ map: textures.cloud, color: 0xe8f0f4, transparent: true, opacity: 0, depthWrite: false });
      mat.userData.baseOpacity = 0.62 + rand() * 0.18;
      var sprite = new THREE.Sprite(mat);
      sprite.position.set(c[0], c[2], c[1]);
      sprite.scale.set(c[3], c[3] * 0.34, 1);
      root.add(sprite);
      cloudMats.push(mat);
      cloudSprites.push({ sprite: sprite, baseX: c[0], speed: 0.25 + rand() * 0.25 });
    });
    var seaTex = textures.cloud.clone();
    seaTex.needsUpdate = true;
    seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
    seaTex.repeat.set(5, 3);
    cloudSeaMat = new THREE.MeshBasicMaterial({
      map: seaTex, color: 0xeaf2f4, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide
    });
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(5200, 2800), cloudSeaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -100, 1200);
    root.add(sea);
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "jixing", craft: "jixing", no: "01", name: "吉星石",
        pos: new THREE.Vector3(8, heightAt(8, ROCK_Z) + 2.6, ROCK_Z + 2.3),
        view: { pos: new THREE.Vector3(24, heightAt(8, ROCK_Z) + 3, ROCK_Z + 18), target: new THREE.Vector3(8, heightAt(8, ROCK_Z) + 3, ROCK_Z) },
        lede: "门岗约 100 米处的大型塑石，高 6 米、宽 4 米，合为 10 米，取“十全十美、吉星高照”。",
        facts: [["高", "6 m"], ["宽", "4 m"], ["距门岗", "约 100 m"]],
        detail: "石上刻“摩星岭”三字，游客常在此留影再登顶。尺寸与位置来自公开游记，场景按 1:1 示意复原。"
      },
      {
        id: "paifang", craft: "paifang", no: "02", name: "锦绣南天牌坊",
        pos: new THREE.Vector3(0, stairY(-45) + 10.0, -45),
        view: { pos: new THREE.Vector3(0, stairY(-45) + 1.8, -23), target: new THREE.Vector3(0, stairY(-45) + 4.0, -45) },
        lede: "石级中上段的石牌坊，正面“锦绣南天”四字为朱德 1965 年登临白云山时所题。",
        facts: [["题写", "1965 年"], ["题字", "朱德"], ["位置", "登顶石级"]],
        detail: "牌坊为白石三间、金瓦顶；不同游记对位置的描述略有差异，本场景按“石级中上段”布置。"
      },
      {
        id: "escalator", craft: "escalator", no: "03", name: "栈道与扶梯",
        pos: new THREE.Vector3(-22, -7, -40),
        view: { pos: new THREE.Vector3(-46, -14, 0), target: new THREE.Vector3(-22, -7, -46) },
        lede: "2024 年建成的登顶辅助设施：150 米钢构栈道 + 两段总长 60 米的自动扶梯，垂直抬升 26 米。",
        facts: [["栈道", "150 m"], ["扶梯", "60 m"], ["抬升", "26 m"]],
        detail: "栈道为浅灰钢构与竖向密条栏杆，扶梯有白色钢架与玻璃顶棚；游客可选石级或“栈道 + 扶梯”登顶。"
      },
      {
        id: "peak", craft: "peak", no: "04", name: "摩星岭 · 382 米",
        pos: new THREE.Vector3(-3.4, 4.0, PLATFORM_Z + 3.4),
        view: { pos: new THREE.Vector3(-3.4, 2.8, PLATFORM_Z + 14), target: new THREE.Vector3(-3.4, 3.8, PLATFORM_Z + 3.4) },
        lede: "白云山主峰，广州城区最高点；旧称碧云峰，清康熙《广东志》以“高可摩星”得名。",
        facts: [["海拔", "382 m"], ["旧称", "碧云峰"], ["地标", "1900 km · 北京"]],
        detail: "山顶的星形指北碑标出广州距北京 1900 公里，碑身写“海拔 382 米”。平台面积约 188 ㎡ 为公开游记口径，场景按 15 × 13 米示意复原。"
      },
      {
        id: "locks", craft: "locks", no: "05", name: "锁爱台 · 祈福牌",
        pos: new THREE.Vector3(5.6, 1.4, PLATFORM_Z + 2.0),
        view: { pos: new THREE.Vector3(10, 2.4, PLATFORM_Z + 7), target: new THREE.Vector3(5.6, 0.8, PLATFORM_Z + 2.0) },
        lede: "山顶的许愿区：锁爱台、祈福牌与红色许愿带，把“登高”变成一件可以留下的事情。",
        facts: [["位置", "山顶平台"], ["做法", "锁爱台 · 祈福牌"], ["提示", "以现场为准"]],
        detail: "锁爱台与祈福牌是山顶平台上的常见打卡点；具体形式会随景区维护调整，本场景只做示意。"
      },
      {
        id: "city", craft: "city", no: "06", name: "城市中轴 · 珠江",
        pos: new THREE.Vector3(0, 2.6, PLATFORM_Z + 5.2),
        view: { pos: new THREE.Vector3(0, 6, PLATFORM_Z + 10), target: new THREE.Vector3(0, -180, 1600) },
        lede: "从摩星岭向南，珠江与广州塔、东西塔、中信一起出现在山脚；晴天能望到珠江三角洲平原。",
        facts: [["方向", "南望"], ["地标", "广州塔 · 东西塔"], ["水面", "珠江"]],
        detail: "城市与珠江为示意压缩：高度按公开地标的量级，水平距离缩短并加雾，不作为测绘或导航依据。"
      }
    ];
    return hotspots;
  }

  /* ---------------- 组装 ---------------- */

  function build(opts) {
    textures = opts.textures;
    var low = !!opts.low;
    root = new THREE.Group();
    root.name = "baiyun-moxingling";
    materials = makeMaterials();
    hotspots = [];
    cityWinMats = [];
    landmarkMats = [];
    cloudMats = [];
    cloudSprites = [];
    platformLights = [];
    pathLights = [];

    buildTerrain(low);
    buildMidground(low);
    buildGate();
    buildJixingStone();
    buildStairs();
    buildPaifang();
    buildBoardwalk();
    buildEscalator();
    buildPlatform();
    buildMarker();
    buildLocks();
    buildPrayerRacks();
    buildPavilion();
    buildLamps();
    buildVegetation(low);
    buildCity(low);
    buildLandmarks();
    var riverMat = buildRiver();
    buildClouds(low);
    buildHotspots();

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      cityWinMats: cityWinMats,
      cityLightMat: cityLightMat,
      riverMat: riverMat,
      cloudMats: cloudMats,
      cloudSeaMat: cloudSeaMat,
      cloudSprites: cloudSprites,
      platformLights: platformLights,
      pathLights: pathLights,
      landmarkMats: landmarkMats,
      bounds: new THREE.Box3(new THREE.Vector3(-200, -320, -180), new THREE.Vector3(200, 40, 3200))
    };
  }

  window.BaiyunModel = { build: build, heightAt: heightAt };
})();
