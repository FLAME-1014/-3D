/* 永庆坊 · 恩宁路近景 · 1:1 主体建模
   坐标：1 单位 = 1 米；+X 东（宝华路），-X 西（多宝路），
   +Z 南（恩宁路/沙面），-Z 北（荔枝湾涌/多宝路）；恩宁路中心线 z = 0。
   依据：docs/superpowers/research/2026-10-31-yongqingfang-facts.md。
   未测绘的尺寸按示意复原；水岸/远景为压缩示意。 */
(function () {
  "use strict";

  var root = null;
  var textures = null;
  var materials = null;
  var hotspots = [];
  var nightMats = [];
  var lanternLights = [];
  var signCache = {};
  var shopfrontCache = {};
  var waterMat = null;
  var lakeMat = null;
  var moonGlowMat = null;
  var glintMats = [];
  var reflectArcMat = null;
  var cityMats = [];
  var lowMode = false;
  var R = null;

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

  function addPlane(parent, w, h, mat, x, y, z, ry) {
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
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

  function addLantern(parent, x, y, z, s, kind) {
    var mat = kind === 2 ? materials.lanternPink : kind === 1 ? materials.lanternWarm : materials.lanternRed;
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 8, 6), mat);
    body.scale.y = 1.25;
    body.position.set(x, y, z);
    body.castShadow = false;
    parent.add(body);
    addCyl(parent, 0.07 * s, 0.07 * s, 0.06 * s, 6, materials.darkWood, x, y + 0.27 * s, z, false);
    addBeam(parent, x, y + 0.3 * s, z, x, y + 0.85 * s, z, 0.012 * s, materials.darkWood, 4, false);
    return body;
  }

  function addPipe(parent, x, z, radius, h) {
    addCyl(parent, radius, radius, h, 6, materials.metal, x, h / 2, z, false);
    for (var y = 1.2; y < h; y += 3) addBox(parent, radius * 3, 0.06, radius * 3, materials.metal, x, y, z, 0, false);
  }

  function addAC(parent, x, y, z) {
    addBox(parent, 0.78, 0.52, 0.34, materials.metal, x, y, z, 0, false);
    addBox(parent, 0.66, 0.42, 0.02, materials.greyMetal, x, y, z + 0.18, 0, false);
    addCyl(parent, 0.03, 0.03, 0.55, 5, materials.metal, x + 0.22, y - 0.5, z + 0.08, false);
  }

  function addWindow(parent, x, y, z, w, h, kind) {
    var mat = kind === 3 ? materials.windowDark : materials.manzhou[kind % 3];
    addPlane(parent, w, h, mat, x, y, z + 0.065);
    addBox(parent, w + 0.26, 0.09, 0.16, materials.granite, x, y - h / 2 - 0.08, z + 0.05, 0, false);
  }

  function addSign(parent, tex, w, h, x, y, z, ry) {
    if (!tex) return;
    if (!signCache[tex.uuid]) {
      var mat = new THREE.MeshStandardMaterial({
        map: tex, color: 0xffffff, roughness: 0.72, metalness: 0.05,
        emissive: 0xffb36b, emissiveMap: tex, emissiveIntensity: 0
      });
      mat.userData.glowBase = 0.8;
      signCache[tex.uuid] = mat;
      nightMats.push(mat);
    }
    addBox(parent, w + 0.16, h + 0.14, 0.08, materials.darkWood, x, y, z - 0.02, ry || 0, false);
    var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signCache[tex.uuid]);
    p.position.set(x, y, z + 0.045);
    if (ry) p.rotation.y = ry;
    parent.add(p);
  }

  function addSignBack(parent, tex, w, h, x, y, z) {
    if (!tex) return;
    if (!signCache[tex.uuid]) {
      var mat = new THREE.MeshStandardMaterial({
        map: tex, color: 0xffffff, roughness: 0.72, metalness: 0.05,
        emissive: 0xffb36b, emissiveMap: tex, emissiveIntensity: 0
      });
      mat.userData.glowBase = 0.8;
      signCache[tex.uuid] = mat;
      nightMats.push(mat);
    }
    addBox(parent, w + 0.16, h + 0.14, 0.08, materials.darkWood, x, y, z + 0.02, 0, false);
    var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signCache[tex.uuid]);
    p.position.set(x, y, z - 0.045);
    p.rotation.y = Math.PI;
    parent.add(p);
  }

  function addWindowBack(parent, x, y, z, w, h, kind) {
    var mat = kind === 3 ? materials.windowDark : materials.manzhou[kind % 3];
    addPlane(parent, w, h, mat, x, y, z - 0.065, Math.PI);
    addBox(parent, w + 0.26, 0.09, 0.16, materials.granite, x, y - h / 2 - 0.08, z - 0.05, 0, false);
  }

  function shopfrontMaterial(tex) {
    if (!shopfrontCache[tex.uuid]) {
      var mat = new THREE.MeshStandardMaterial({
        map: tex, color: 0xffffff, roughness: 0.55, metalness: 0.05,
        emissive: 0xffb36b, emissiveMap: tex, emissiveIntensity: 0
      });
      mat.userData.glowBase = 0.85;
      shopfrontCache[tex.uuid] = mat;
      nightMats.push(mat);
    }
    return shopfrontCache[tex.uuid];
  }

  function addParapet(parent, w, y, d) {
    addBox(parent, w, 0.55, 0.35, materials.plaster, 0, y + 0.27, 0.12, 0, false);
    addBox(parent, 0.3, 0.55, d, materials.plaster, -w / 2 + 0.15, y + 0.27, -d / 2, 0, false);
    addBox(parent, 0.3, 0.55, d, materials.plaster, w / 2 - 0.15, y + 0.27, -d / 2, 0, false);
  }

  function addGableRoof(parent, w, d, y, rise) {
    var len = Math.sqrt((d / 2) * (d / 2) + rise * rise);
    var front = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.16, len + 0.2), materials.roof);
    front.position.set(0, y + rise / 2, -d / 4);
    front.rotation.x = -Math.atan2(rise, d / 2);
    front.castShadow = true; front.receiveShadow = true;
    parent.add(front);
    var back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.16, len + 0.2), materials.roof);
    back.position.set(0, y + rise / 2, -d * 0.75);
    back.rotation.x = Math.atan2(rise, d / 2);
    back.castShadow = true; back.receiveShadow = true;
    parent.add(back);
    addBox(parent, w + 0.75, 0.14, 0.22, materials.roofDark, 0, y + rise + 0.04, -d / 2, 0, false);
  }

  function addHipRoof(parent, w, d, h, y) {
    var geo = new THREE.ConeGeometry(1, 1, 4);
    var mesh = new THREE.Mesh(geo, materials.roof);
    mesh.rotation.y = Math.PI / 4;
    mesh.scale.set(w * 0.58, h, d * 0.58);
    mesh.position.set(0, y + h / 2, 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    addBox(parent, 0.45, 0.25, 0.45, materials.roofDark, 0, y + h + 0.1, 0, 0, false);
  }

  function addBalustradeX(parent, x1, x2, z, y) {
    var n = Math.max(2, Math.round(Math.abs(x2 - x1) / 1.4));
    for (var i = 0; i <= n; i++) {
      var x = x1 + (x2 - x1) * i / n;
      addBox(parent, 0.12, 0.9, 0.12, materials.whiteStone, x, y + 0.45, z, 0, false);
    }
    addBox(parent, Math.abs(x2 - x1), 0.12, 0.12, materials.whiteStone, (x1 + x2) / 2, y + 0.92, z, 0, false);
    addBox(parent, Math.abs(x2 - x1), 0.08, 0.08, materials.whiteStone, (x1 + x2) / 2, y + 0.35, z, 0, false);
  }

  function addRailingX(parent, x1, x2, z, y, mat) {
    var n = Math.max(2, Math.round(Math.abs(x2 - x1) / 3.2));
    for (var i = 0; i <= n; i++) {
      var x = x1 + (x2 - x1) * i / n;
      addBox(parent, 0.08, 1.0, 0.08, mat || materials.metal, x, y + 0.5, z, 0, false);
    }
    addBox(parent, Math.abs(x2 - x1), 0.07, 0.07, mat || materials.metal, (x1 + x2) / 2, y + 0.92, z, 0, false);
    addBox(parent, Math.abs(x2 - x1), 0.06, 0.06, mat || materials.metal, (x1 + x2) / 2, y + 0.5, z, 0, false);
  }

  function addArch(parent, span, springY, z, mat, tube, ry) {
    var mesh = new THREE.Mesh(new THREE.TorusGeometry(span / 2, tube || 0.16, 6, 14, Math.PI), mat || materials.arcadeArch);
    mesh.position.set(0, springY, z);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = false; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addPerson(parent, x, z, ry, coat, pants, skin) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    var legH = 0.8;
    addCyl(g, 0.07, 0.085, legH, 5, pants || materials.pants, -0.1, legH / 2, 0, false);
    addCyl(g, 0.07, 0.085, legH, 5, pants || materials.pants, 0.1, legH / 2, 0, false);
    addCyl(g, 0.16, 0.19, 0.7, 6, coat || materials.cloth[0], 0, legH + 0.35, 0, false);
    addCyl(g, 0.05, 0.055, 0.58, 5, coat || materials.cloth[0], -0.23, legH + 0.38, 0, false);
    addCyl(g, 0.05, 0.055, 0.58, 5, coat || materials.cloth[0], 0.23, legH + 0.38, 0, false);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 6), skin || materials.skin);
    head.position.set(0, legH + 0.82, 0);
    g.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), materials.hair);
    hair.position.set(0, legH + 0.85, 0);
    g.add(hair);
    return g;
  }

  function addBike(parent, x, z, ry, color) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    [-0.55, 0.55].forEach(function (wx) {
      var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 5, 14), materials.metal);
      wheel.position.set(wx, 0.34, 0);
      g.add(wheel);
    });
    addBeam(g, -0.55, 0.34, 0, 0.1, 0.34, 0, 0.022, color || materials.bikeFrame, 4, false);
    addBeam(g, 0.1, 0.34, 0, 0.42, 0.82, 0, 0.022, color || materials.bikeFrame, 4, false);
    addBeam(g, 0.42, 0.82, 0, 0.55, 0.34, 0, 0.022, color || materials.bikeFrame, 4, false);
    addBeam(g, -0.55, 0.34, 0, -0.28, 0.78, 0, 0.022, color || materials.bikeFrame, 4, false);
    addBeam(g, -0.28, 0.78, 0, 0.1, 0.34, 0, 0.022, color || materials.bikeFrame, 4, false);
    addBeam(g, -0.28, 0.78, 0, 0.42, 0.82, 0, 0.022, color || materials.bikeFrame, 4, false);
    addBox(g, 0.26, 0.06, 0.1, materials.darkWood, -0.3, 0.86, 0, 0, false);
    addBeam(g, 0.42, 0.82, 0, 0.42, 1.02, 0, 0.018, materials.metal, 4, false);
    addBeam(g, 0.3, 1.02, 0, 0.54, 1.02, 0, 0.018, materials.metal, 4, false);
    return g;
  }

  function addAwning(parent, w, x, y, z, ry, mat) {
    var a = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 1.15), mat || materials.awning);
    a.position.set(x, y, z);
    a.rotation.x = -0.24;
    if (ry) a.rotation.y = ry;
    a.castShadow = false; a.receiveShadow = true;
    parent.add(a);
    return a;
  }

  function addHangingSign(parent, tex, x, y, z, w, h) {
    if (!tex) return;
    if (!signCache[tex.uuid]) {
      var mat = new THREE.MeshStandardMaterial({
        map: tex, color: 0xffffff, roughness: 0.72, metalness: 0.05,
        emissive: 0xffb36b, emissiveMap: tex, emissiveIntensity: 0
      });
      mat.userData.glowBase = 0.8;
      signCache[tex.uuid] = mat;
      nightMats.push(mat);
    }
    addBox(parent, 0.12, h + 0.14, w + 0.14, materials.darkWood, x, y, z, 0, false);
    var p1 = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signCache[tex.uuid]);
    p1.position.set(x - 0.065, y, z);
    p1.rotation.y = -Math.PI / 2;
    parent.add(p1);
    var p2 = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signCache[tex.uuid]);
    p2.position.set(x + 0.065, y, z);
    p2.rotation.y = Math.PI / 2;
    parent.add(p2);
    addBeam(parent, x, y + h / 2 + 0.12, z, x, y + h / 2 + 0.5, z, 0.018, materials.darkWood, 4, false);
  }

  function addStoneLamp(parent, x, z, h) {
    addCyl(parent, 0.12, 0.16, h || 3.2, 6, materials.metal, x, (h || 3.2) / 2, z, false);
    addBox(parent, 0.42, 0.48, 0.42, materials.darkWood, x, (h || 3.2) + 0.1, z, 0, false);
    addBox(parent, 0.3, 0.32, 0.3, materials.lanternWarm, x, (h || 3.2) + 0.1, z, 0, false);
    addCyl(parent, 0.34, 0.2, 0.2, 4, materials.roofDark, x, (h || 3.2) + 0.42, z, false);
  }


  /* ---------------- 材质 ---------------- */

  function makeMaterials() {
    var m = {};
    m.brickGreen = new THREE.MeshStandardMaterial({ map: textures.brickGreen, color: 0xaeb6a8, roughness: 0.94, metalness: 0.01 });
    m.brickRed = new THREE.MeshStandardMaterial({ map: textures.brickRed, color: 0xb98a76, roughness: 0.95, metalness: 0.01 });
    m.brickGrey = new THREE.MeshStandardMaterial({ map: textures.brickGrey, color: 0xa6a49a, roughness: 0.95, metalness: 0.01 });
    m.granite = new THREE.MeshStandardMaterial({ map: textures.granite, color: 0xb8b3a4, roughness: 0.92, metalness: 0.02 });
    m.paving = new THREE.MeshStandardMaterial({ map: textures.paving, color: 0xbab2a2, roughness: 0.94, metalness: 0.01 });
    m.asphalt = new THREE.MeshStandardMaterial({ map: textures.asphalt, color: 0xffffff, roughness: 0.98, metalness: 0.01 });
    m.wood = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x8a6145, roughness: 0.86, metalness: 0.02 });
    m.darkWood = new THREE.MeshStandardMaterial({ color: 0x2c1d14, roughness: 0.82, metalness: 0.02 });
    m.roof = new THREE.MeshStandardMaterial({ map: textures.roofTile, color: 0xb0b8a8, roughness: 0.9, metalness: 0.02 });
    m.roofDark = new THREE.MeshStandardMaterial({ color: 0x4a554c, roughness: 0.88, metalness: 0.02 });
    m.plaster = new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xe8e0ce, roughness: 0.96, metalness: 0.01 });
    m.whiteStone = new THREE.MeshStandardMaterial({ color: 0xe4dfd0, roughness: 0.86, metalness: 0.02 });
    m.metal = new THREE.MeshStandardMaterial({ color: 0x3b403c, roughness: 0.5, metalness: 0.55 });
    m.greyMetal = new THREE.MeshStandardMaterial({ color: 0x8c918b, roughness: 0.45, metalness: 0.45 });
    m.windowFrame = new THREE.MeshStandardMaterial({ color: 0x6f6352, roughness: 0.7, metalness: 0.08 });
    m.windowDark = new THREE.MeshStandardMaterial({ map: textures.windowDark, color: 0x718383, roughness: 0.2, metalness: 0.25 });
    m.shopGlass = new THREE.MeshStandardMaterial({
      color: 0x4b5c55, roughness: 0.16, metalness: 0.25, transparent: true, opacity: 0.6,
      emissive: 0xffb36b, emissiveIntensity: 0
    });
    m.shopInterior = new THREE.MeshStandardMaterial({
      color: 0x2f2118, roughness: 0.8, emissive: 0xffb36b, emissiveIntensity: 0
    });
    m.shopWall = new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.8, metalness: 0.02 });
    m.portalDark = new THREE.MeshBasicMaterial({ color: 0x120e0b, side: THREE.DoubleSide });
    m.shopInteriorNight = m.shopInterior;
    m.shopGlass.userData.glowBase = 0.55;
    m.shopInterior.userData.glowBase = 0.9;
    m.glass = new THREE.MeshStandardMaterial({
      color: 0x9fb9b2, roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.34,
      side: THREE.DoubleSide, depthWrite: false, emissive: 0xffd9a0, emissiveIntensity: 0
    });
    m.glass.userData.glowBase = 0.35;
    m.steel = new THREE.MeshStandardMaterial({ color: 0x6a716c, roughness: 0.4, metalness: 0.6 });
    m.lanternRed = new THREE.MeshStandardMaterial({ color: 0x8f2e25, roughness: 0.6, emissive: 0xff6e32, emissiveIntensity: 0 });
    m.lanternPink = new THREE.MeshStandardMaterial({ color: 0xb75c69, roughness: 0.65, emissive: 0xff9a9a, emissiveIntensity: 0 });
    m.lanternWarm = new THREE.MeshStandardMaterial({ color: 0xd7b077, roughness: 0.6, emissive: 0xffd39a, emissiveIntensity: 0 });
    m.lanternRed.userData.glowBase = 1.2;
    m.lanternPink.userData.glowBase = 1.1;
    m.lanternWarm.userData.glowBase = 1.0;
    m.leaf = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x8fa878, roughness: 1, metalness: 0 });
    m.leafDark = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x6b855a, roughness: 1, metalness: 0 });
    m.lotus = new THREE.MeshStandardMaterial({ color: 0x4f7a4f, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    m.trunk = new THREE.MeshStandardMaterial({ map: textures.trunk, color: 0x8a6a4d, roughness: 0.96, metalness: 0 });
    m.rock = new THREE.MeshStandardMaterial({ color: 0x77786e, roughness: 0.98, metalness: 0.01 });
    m.boatRed = new THREE.MeshStandardMaterial({ color: 0x7c2e24, roughness: 0.7, metalness: 0.05 });
    m.stageGold = new THREE.MeshStandardMaterial({ color: 0x6a4a26, roughness: 0.55, metalness: 0.2, emissive: 0xffc46a, emissiveIntensity: 0 });
    m.stageGold.userData.glowBase = 0.8;
    m.arcadeArch = new THREE.MeshStandardMaterial({ color: 0xa89e8b, roughness: 0.94, metalness: 0.01 });
    m.lotusFlower = new THREE.MeshStandardMaterial({ color: 0xc07a86, roughness: 0.8, emissive: 0xffb0b8, emissiveIntensity: 0 });
    m.lotusFlower.userData.glowBase = 0.35;
    m.bikeFrame = new THREE.MeshStandardMaterial({ color: 0x2f3a3b, roughness: 0.55, metalness: 0.4 });
    m.skin = new THREE.MeshStandardMaterial({ color: 0xb98b6c, roughness: 0.85 });
    m.hair = new THREE.MeshStandardMaterial({ color: 0x231a15, roughness: 0.9 });
    m.pants = new THREE.MeshStandardMaterial({ color: 0x343b3d, roughness: 0.9 });
    m.cloth = [
      new THREE.MeshStandardMaterial({ color: 0x6d7b76, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x8a5a4a, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x4e5c66, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x8f8468, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.9 })
    ];
    m.laundry = [
      new THREE.MeshStandardMaterial({ color: 0xc9b9a0, roughness: 0.95, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0x7f8f8a, roughness: 0.95, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0xa46b5c, roughness: 0.95, side: THREE.DoubleSide })
    ];
    nightMats.push(m.lotusFlower);
    m.waterGlint = new THREE.MeshBasicMaterial({
      map: textures.waterGlint, color: 0xfff0cf, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    m.reflectArc = new THREE.MeshBasicMaterial({
      map: textures.reflectArc, color: 0xfff3d6, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    m.reflectDark = new THREE.MeshBasicMaterial({
      color: 0x12211f, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide
    });
    m.city = new THREE.MeshStandardMaterial({
      map: textures.cityWindow, color: 0x9aa4a4, roughness: 0.86, metalness: 0.05,
      emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0
    });
    m.city.userData.glowBase = 0.55;
    m.manzhou = [];
    for (var i = 0; i < 3; i++) {
      var mm = new THREE.MeshStandardMaterial({
        map: textures.manzhou[i], color: 0xffffff, roughness: 0.45, metalness: 0.05,
        emissive: 0xffc98a, emissiveMap: textures.manzhouGlow[i], emissiveIntensity: 0
      });
      mm.userData.glowBase = 0.85;
      m.manzhou.push(mm);
      nightMats.push(mm);
    }
    nightMats.push(m.shopGlass);
    nightMats.push(m.shopInterior);
    nightMats.push(m.glass);
    nightMats.push(m.lanternRed);
    nightMats.push(m.lanternPink);
    nightMats.push(m.lanternWarm);
    nightMats.push(m.stageGold);
    nightMats.push(m.city);
    cityMats.push(m.city);
    m.signs = {};
    return m;
  }

  /* ---------------- 地面 ---------------- */

  function buildGround() {
    // 基底地面避开荔枝湾涌（z -122..-112）与晚沙湖（x 51.7..92.3 / z -88.3..-51.7），否则水面被压在地上
    addBox(root, 760, 0.2, 258, materials.asphalt, 30, -0.24, -251, 0, false);
    addBox(root, 270, 0.2, 10, materials.asphalt, -215, -0.24, -117, 0, false);
    addBox(root, 230, 0.2, 10, materials.asphalt, 295, -0.24, -117, 0, false);
    addBox(root, 760, 0.2, 23.7, materials.asphalt, 30, -0.24, -100.15, 0, false);
    addBox(root, 401.7, 0.2, 36.6, materials.asphalt, -149.15, -0.24, -70, 0, false);
    addBox(root, 317.7, 0.2, 36.6, materials.asphalt, 251.15, -0.24, -70, 0, false);
    addBox(root, 760, 0.2, 291.7, materials.asphalt, 30, -0.24, 94.15, 0, false);
    addBox(root, 300, 0.18, 14, materials.asphalt, 50, 0.03, 0, 0, false);
    addBox(root, 300, 0.22, 2, materials.granite, 50, 0.1, -8, 0, false);
    addBox(root, 300, 0.22, 2, materials.granite, 50, 0.1, 8, 0, false);
    addBox(root, 300, 0.14, 3.1, materials.paving, 50, 0.08, 10.55, 0, false);
    addBox(root, 300, 0.14, 3.1, materials.paving, 50, 0.08, -10.55, 0, false);
    addBox(root, 300, 0.16, 0.18, materials.granite, 50, 0.1, -7.05, 0, false);
    addBox(root, 300, 0.16, 0.18, materials.granite, 50, 0.1, 7.05, 0, false);
    addBox(root, 300, 0.025, 0.13, materials.yellowLine, 50, 0.13, -0.18, 0, false);
    addBox(root, 300, 0.025, 0.13, materials.yellowLine, 50, 0.13, 0.18, 0, false);
    for (var i = 0; i < 6; i++) {
      addBox(root, 1.0, 0.025, 9, materials.whiteLine, -3.5 + i * 1.4, 0.135, 0, 0, false);
    }
    for (var mh = 0; mh < 5; mh++) {
      addCyl(root, 0.45, 0.45, 0.03, 12, materials.metal, -40 + mh * 32, 0.13, mh % 2 ? 2.5 : -2.5, false);
    }
    addBox(root, 5, 0.14, 86, materials.paving, 0, 0.08, -52, 0, false);
    addBox(root, 0.32, 0.03, 86, materials.metal, 0, 0.16, -52, 0, false);
    addBox(root, 22, 0.14, 4, materials.paving, 11, 0.08, -45, 0, false);
    addBox(root, 24, 0.14, 4, materials.paving, -10, 0.08, -70, 0, false);
    addBox(root, 6, 0.14, 10, materials.paving, 30, 0.08, -24, 0, false);
    addBox(root, 20, 0.14, 22, materials.paving, 26, 0.08, -27, 0, false);
    addBox(root, 24, 0.14, 22, materials.paving, 27, 0.08, -27, 0, false);
    addBox(root, 78, 0.14, 12, materials.granite, 73, 0.08, -15, 0, false);
    addBox(root, 14, 0.14, 83, materials.paving, 45, 0.08, -63.5, 0, false);
    addBox(root, 16, 0.14, 83, materials.paving, 100, 0.08, -63.5, 0, false);
    addBox(root, 40, 0.14, 30, materials.paving, 72, 0.08, -37, 0, false);
    addBox(root, 40, 0.14, 17, materials.paving, 72, 0.08, -96.5, 0, false);
    addBox(root, 230, 0.14, 7, materials.granite, 50, 0.08, -108.5, 0, false);
    addBox(root, 80, 0.14, 8, materials.paving, 30, 0.08, -125, 0, false);
    addBox(root, 30, 0.14, 6, materials.paving, 5, 0.08, -111, 0, false);
    addBox(root, 2.2, 0.12, 24, materials.paving, 33, 0.08, -34, 0, false);
    addBox(root, 16, 0.12, 3, materials.paving, 30, 0.08, -45, 0, false);
    addBox(root, 7, 0.12, 8, materials.paving, 7, 0.08, -115, 0, false);
    addBox(root, 6, 0.45, 12, materials.plaster, 34, 0.23, -27, 0, false);
    for (var st = 0; st < 3; st++) {
      addBox(root, 6 - st * 0.4, 0.16, 1.1, materials.granite, 34, 0.32 + st * 0.16, -33 + st * 1.1, 0, false);
    }
  }

  /* ---------------- 门楼 ---------------- */

  function buildGate() {
    var g = new THREE.Group();
    g.position.set(0, 0, -9);
    root.add(g);
    addBox(g, 1.9, 7.0, 1.2, materials.brickGrey, -3.1, 3.5, 0);
    addBox(g, 1.9, 7.0, 1.2, materials.brickGrey, 3.1, 3.5, 0);
    addBox(g, 1.9, 1.1, 1.26, materials.granite, -3.1, 0.55, 0);
    addBox(g, 1.9, 1.1, 1.26, materials.granite, 3.1, 0.55, 0);
    addBox(g, 4.2, 1.7, 1.2, materials.brickGrey, 0, 6.15, 0);
    addBox(g, 8.4, 0.28, 1.5, materials.granite, 0, 7.0, 0, 0, false);
    addHipRoof(g, 9.2, 2.8, 0.85, 7.1);
    addBox(g, 8.6, 0.12, 1.5, materials.granite, 0, 6.95, 0, 0, false);
    addBox(g, 4.7, 0.3, 0.26, materials.granite, 0, 5.02, 0.64, 0, false);
    addBox(g, 0.28, 4.4, 0.24, materials.granite, -2.22, 2.7, 0.63, 0, false);
    addBox(g, 0.28, 4.4, 0.24, materials.granite, 2.22, 2.7, 0.63, 0, false);
    addBox(g, 2.4, 0.86, 0.18, materials.darkWood, 0, 5.75, 0.65, 0, false);
    addSign(g, textures.signs.yongqingfang, 2.25, 0.72, 0, 5.75, 0.78, 0);
    addBox(g, 3.1, 0.5, 0.14, materials.darkWood, 0, 4.85, 0.68, 0, false);
    addSign(g, textures.signs.luanyu, 2.95, 0.38, 0, 4.85, 0.78, 0);
    var gateL = YongqingfangTextures.makeVerticalTextTexture("山野鲜果", 130, 620, "#e8c684", "#22382c");
    var gateR = YongqingfangTextures.makeVerticalTextTexture("永庆坊文创", 130, 620, "#e8c684", "#2b1b12");
    addSign(g, gateL, 0.52, 2.3, -3.1, 2.75, 0.66, 0);
    addSign(g, gateR, 0.52, 2.3, 3.1, 2.75, 0.66, 0);
    addBox(g, 0.95, 1.25, 0.08, materials.darkWood, -1.62, 2.1, 0.63, 0, false);
    addBox(g, 0.8, 1.1, 0.09, materials.darkWood, 1.62, 2.1, 0.63, 0, false);
    addBox(g, 0.42, 0.52, 0.26, materials.lanternWarm, -3.1, 3.9, 0.6, 0, false);
    addBox(g, 0.42, 0.52, 0.26, materials.lanternWarm, 3.1, 3.9, 0.6, 0, false);
    addBox(g, 4.6, 0.16, 1.7, materials.granite, 0, 0.08, 0.1, 0, false);
    for (var gst = 0; gst < 3; gst++) {
      addBox(g, 5.4 - gst * 0.4, 0.13, 0.55, materials.granite, 0, 0.065 + gst * 0.13, 1.15 + gst * 0.52, 0, false);
    }
    [-4.0, 4.0].forEach(function (x) {
      addBox(g, 1.5, 0.35, 1.5, materials.granite, x, 0.18, 0.3, 0, false);
      var lion = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), materials.whiteStone);
      lion.position.set(x, 0.85, 0.35); lion.scale.set(0.8, 1.1, 0.9);
      lion.castShadow = true; g.add(lion);
      addBox(g, 0.9, 0.32, 0.9, materials.granite, x, 0.45, 0.35, 0, false);
    });
    [-3.0, 3.0].forEach(function (x) {
      addCyl(g, 0.28, 0.28, 0.6, 10, materials.whiteStone, x, 0.3, 2.6, false);
    });
    addLantern(g, -1.4, 4.0, 0.45, 0.9, 2);
    addLantern(g, 1.4, 4.0, 0.45, 0.9, 0);
    addBeam(g, -2.5, 4.55, -0.2, 2.5, 4.55, -0.2, 0.018, materials.darkWood, 4, false);
    addBeam(g, -2.5, 4.55, -0.2, -2.5, 4.55, 0.8, 0.018, materials.darkWood, 4, false);
    addBeam(g, 2.5, 4.55, -0.2, 2.5, 4.55, 0.8, 0.018, materials.darkWood, 4, false);
    addBox(g, 0.5, 0.5, 0.5, materials.granite, -3.6, 0.25, 2.0, 0, false);
    addBox(g, 0.5, 0.5, 0.5, materials.granite, 3.6, 0.25, 2.0, 0, false);
    addCyl(g, 0.25, 0.3, 0.5, 8, materials.terracotta, -2.35, 0.25, 1.7, false);
    var gp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), materials.leaf);
    gp.position.set(-2.35, 0.85, 1.7); gp.castShadow = true; g.add(gp);
    addCyl(g, 0.25, 0.3, 0.5, 8, materials.terracotta, 2.35, 0.25, 1.7, false);
    var gp2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), materials.leafDark);
    gp2.position.set(2.35, 0.85, 1.7); gp2.castShadow = true; g.add(gp2);
    addBike(g, 5.6, 1.9, -0.55);
    addBike(g, -5.8, 1.4, 0.7);
    addPerson(g, -2.0, 4.2, 0.3, materials.cloth[1], materials.pants);
    addPerson(g, 2.6, 3.6, -0.5, materials.cloth[0], materials.pants);
    addPerson(g, 0.9, -3.8, Math.PI + 0.3, materials.cloth[3], materials.pants);
    // 门楼两翼：把空白砖墙用店招/雨棚/灯笼打断
    addSign(root, textures.signs.shanye, 2.0, 0.66, -9.4, 3.35, -8.8, 0);
    addSign(root, textures.signs.tea, 2.0, 0.66, 9.4, 3.35, -8.8, 0);
    addAwning(root, 4.4, -11.0, 3.05, -8.6, 0, materials.awning);
    addAwning(root, 4.4, 11.0, 3.05, -8.6, 0, materials.canvas);
    addLantern(root, -7.4, 3.9, -8.7, 0.6, 0);
    addLantern(root, 7.4, 3.9, -8.7, 0.6, 2);
    addPerson(root, -6.0, -7.0, 0.2, materials.cloth[2], materials.pants);
    addPerson(root, 6.4, -7.4, -0.4, materials.cloth[4], materials.pants);
  }

  /* ---------------- 通用立面 ---------------- */

  function addShopfront(g, w, gh, z, signKey) {
    addBox(g, w * 0.94, gh * 0.58, 0.08, materials.shopWall, 0, gh * 0.39, z - 0.16, 0, false);
    var tex = textures.shopfronts[Math.floor(rnd() * textures.shopfronts.length)];
    addPlane(g, w * 0.9, gh * 0.54, shopfrontMaterial(tex), 0, gh * 0.42, z + 0.035);
    addBox(g, w * 0.94, 0.45, 0.2, materials.darkWood, 0, 0.24, z + 0.04, 0, false);
    if (signKey) addSign(g, textures.signs[signKey], Math.min(w * 0.52, 3.6), 0.72, 0, gh - 0.55, z + 0.12, 0);
    if (rnd() > 0.45) {
      addBox(g, w * 0.62, 0.06, 1.0, rnd() > 0.5 ? materials.canvas : materials.awning, 0, 3.08, z + 0.52, 0, false).rotation.x = -0.18;
    }
  }

  function buildFacade(o) {
    var g = new THREE.Group();
    g.position.set(o.x, 0, o.z);
    g.rotation.y = o.ry || 0;
    root.add(g);
    var w = o.w, d = o.d, floors = o.floors || 3;
    var arcade = o.arcade !== false;
    var gh = arcade ? 4.3 : 3.7;
    var fh = 3.0;
    var h = gh + (floors - 1) * fh + 0.8;
    var bodyMat = o.style === "red" ? materials.brickRed : o.style === "grey" ? materials.brickGrey : materials.brickGreen;
    if (arcade) {
      addBox(g, w, h - gh, d, bodyMat, 0, gh + (h - gh) / 2, -d / 2);
      addBox(g, w, gh, 0.35, materials.shopWall, 0, gh / 2, -2.9);
      addBox(g, w, 0.16, 3, materials.darkWood, 0, gh - 0.08, -1.45, 0, false);
      var cols = [];
      for (var cx = -w / 2 + 1.1; cx < w / 2; cx += 3.4) {
        addBox(g, 0.55, gh, 0.55, materials.darkWood, cx, gh / 2, -0.35);
        cols.push(cx);
      }
      for (var ai = 1; ai < cols.length; ai++) {
        addArch(g, cols[ai] - cols[ai - 1], gh - 1.9, -0.35, materials.arcadeArch, 0.24);
        addBox(g, cols[ai] - cols[ai - 1], 0.3, 0.5, materials.arcadeArch, (cols[ai] + cols[ai - 1]) / 2, gh - 0.3, -0.35, 0, false);
      }
      addShopfront(g, w, gh, -2.7, o.sign);
    } else {
      addBox(g, w, h, d, bodyMat, 0, h / 2, -d / 2);
      addShopfront(g, w, gh, 0.02, o.sign);
    }
    for (var f = 1; f < floors; f++) {
      addBox(g, w, 0.13, 0.16, materials.plaster, 0, gh + (f - 1) * fh, 0.06, 0, false);
      var y = gh + (f - 1) * fh + 1.55;
      var count = w > 13 ? 3 : w > 9 ? 2 : 1;
      for (var i = 0; i < count; i++) {
        var wx = -w / 2 + (i + 0.5) * (w / count);
        var kind = (i + f) % 4;
        addWindow(g, wx, y, 0.05, Math.min(2.0, (w / count) * 0.54), 2.0, kind === 3 ? 3 : kind);
        addBox(g, Math.min(2.0, (w / count) * 0.54) + 0.18, 0.12, 0.3, materials.plaster, wx, y + 1.1, 0.09, 0, false);
        if (rnd() > 0.55) addAC(g, wx + 0.6, y - 0.95, 0.26);
      }
    }
    addParapet(g, w, h, d);
    if (o.gable) addGableRoof(g, w, d, h + 0.2, o.rise || 2.0);
    else addBox(g, w, 0.18, d, materials.plaster, 0, h, -d / 2, 0, false);
    if (o.pipe !== false) addPipe(g, w / 2 - 0.35, 0.18, 0.055, h - 0.3);
    if (o.balcony) {
      addBox(g, w * 0.72, 0.14, 1.0, materials.granite, 0, gh + fh - 0.25, 0.5, 0, false);
      addBalustradeX(g, -w * 0.36, w * 0.36, 0.95, gh + fh - 0.2);
    }
    if (o.hang) {
      var hangKeys = ["liangcha", "wonton", "bike", "grocery", "barber", "shanhuo"];
      addHangingSign(g, textures.signs[hangKeys[Math.floor(rnd() * hangKeys.length)]], w / 2 - 2.0, gh + 0.35, 0.55, 0.62, 1.5);
    }
    if (o.laundry && !lowMode) {
      var lx = -w / 2 + 2.4;
      addBeam(g, lx, gh + fh * 1.5 + 0.8, 0, lx, gh + fh * 1.5 + 0.8, 1.15, 0.022, materials.metal, 4, false);
      for (var cl = 0; cl < 2; cl++) {
        var cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75), materials.laundry[cl % 3]);
        cloth.position.set(lx, gh + fh * 1.5 + 0.5, 0.35 + cl * 0.5);
        cloth.rotation.y = Math.PI / 2;
        g.add(cloth);
      }
    }
    return g;
  }

  function buildRow(start, end, fixed, horizontal, o) {
    var length = Math.abs(end - start);
    var modules = Math.max(1, Math.round(length / (o.module || 12)));
    for (var i = 0; i < modules; i++) {
      var a = start + (end - start) * (i / modules);
      var b = start + (end - start) * ((i + 1) / modules);
      var c = (a + b) / 2, w = Math.abs(b - a) - 0.12;
      var signKeys = ["dayi", "coffee", "dessert", "wenyi", "zhongshu", "shanhuo", "ju", "liangcha", "wonton", "grocery", "barber"];
      var sign = o.signs === false ? null : signKeys[Math.floor(rnd() * signKeys.length)];
      var style = ["green", "grey", "red"][Math.floor(rnd() * 3)];
      if (horizontal) {
        buildFacade({
          x: c, z: fixed, w: w, d: o.d || 14, floors: o.floors || 4, style: style,
          ry: o.ry || 0, arcade: o.arcade !== false, sign: sign, gable: o.gable, balcony: rnd() > 0.55,
          pipe: rnd() > 0.35,
          hang: o.hang !== false && rnd() > 0.42,
          laundry: o.laundry !== false && rnd() > 0.5 && (o.floors || 4) > 2
        });
      } else {
        buildFacade({
          x: fixed, z: c, w: w, d: o.d || 14, floors: o.floors || 4, style: style,
          ry: o.ry, arcade: o.arcade !== false, sign: sign, gable: o.gable, balcony: rnd() > 0.55,
          pipe: rnd() > 0.35,
          hang: o.hang !== false && rnd() > 0.42,
          laundry: o.laundry !== false && rnd() > 0.5 && (o.floors || 4) > 2
        });
      }
    }
  }

  /* ---------------- 主巷建筑 ---------------- */

  function buildLaneBuildings() {
    buildRow(-12, -68, -2.5, false, { ry: Math.PI / 2, d: 6, floors: 3, arcade: false, module: 10, gable: false, signs: true });
    buildRow(-72, -92, -2.5, false, { ry: Math.PI / 2, d: 6, floors: 3, arcade: false, module: 10, gable: false, signs: true });
    buildRow(-12, -22, 2.5, false, { ry: -Math.PI / 2, d: 6, floors: 3, arcade: false, module: 10, gable: false, signs: true });
    buildRow(-26, -43, 2.5, false, { ry: -Math.PI / 2, d: 6, floors: 3, arcade: false, module: 10, gable: false, signs: true });
    buildRow(-47, -92, 2.5, false, { ry: -Math.PI / 2, d: 6, floors: 3, arcade: false, module: 10, gable: false, signs: true });
    buildRow(3, 8, -47, true, { d: 6, floors: 2, arcade: false, module: 5, gable: false, signs: true });
    buildRow(18, 22, -47, true, { d: 6, floors: 2, arcade: false, module: 5, gable: false, signs: true });
    buildRow(3, 8, -43, true, { ry: Math.PI, d: 6, floors: 2, arcade: false, module: 5, gable: false, signs: true });
    buildRow(18, 22, -43, true, { ry: Math.PI, d: 6, floors: 2, arcade: false, module: 5, gable: false, signs: true });
    buildRow(-22, -16, -72, true, { d: 6, floors: 2, arcade: false, module: 6, gable: false, signs: true });
    buildRow(-8, -2, -72, true, { d: 6, floors: 2, arcade: false, module: 6, gable: false, signs: true });
    buildRow(-22, -16, -68, true, { ry: Math.PI, d: 6, floors: 2, arcade: false, module: 6, gable: false, signs: true });
    buildRow(-8, -2, -68, true, { ry: Math.PI, d: 6, floors: 2, arcade: false, module: 6, gable: false, signs: true });
    // 巷内生活痕迹：空调、管线、盆栽、灯笼
    for (var i = 0; i < 10; i++) {
      var z = -14 - i * 7.5;
      addLantern(root, i % 2 ? -1.6 : 1.6, 4.05, z, 0.75, i % 3 === 0 ? 2 : i % 3 === 1 ? 0 : 1);
      addBeam(root, -2.4, 4.45, z, 2.4, 4.45, z, 0.012, materials.darkWood, 4, false);
    }
    for (var p = 0; p < 8; p++) {
      var px = p % 2 ? -1.9 : 1.9, pz = -16 - p * 9;
      addCyl(root, 0.28, 0.32, 0.55, 8, materials.terracotta, px, 0.28, pz, false);
      var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), p % 2 ? materials.leaf : materials.leafDark);
      bush.position.set(px, 0.95, pz); bush.castShadow = true; root.add(bush);
    }
    // 巷内生活痕迹：雨棚、横跨电线、单车、行人与石凳
    addAwning(root, 3.6, -2.0, 3.1, -24, Math.PI / 2, materials.awning);
    addAwning(root, 3.6, 2.0, 3.1, -38, -Math.PI / 2, materials.canvas);
    addAwning(root, 3.4, -2.0, 3.05, -57, Math.PI / 2, materials.awning);
    addAwning(root, 3.4, 2.0, 3.05, -75, -Math.PI / 2, materials.canvas);
    addBeam(root, -2.5, 5.0, -22, 2.5, 5.15, -22, 0.016, materials.metal, 4, false);
    addBeam(root, -2.5, 5.3, -48, 2.5, 5.1, -48, 0.016, materials.metal, 4, false);
    addBeam(root, -2.5, 5.1, -72, 2.5, 5.25, -72, 0.016, materials.metal, 4, false);
    addHangingSign(root, textures.signs.grocery, -2.15, 3.35, -28, 0.55, 1.4);
    addHangingSign(root, textures.signs.bike, 2.15, 3.25, -62, 0.55, 1.4);
    addBike(root, -1.75, -20.5, 1.2);
    addBike(root, 1.75, -57.5, -1.4);
    addBike(root, 1.8, -79.5, 1.5);
    addPerson(root, -2.2, -26.5, Math.PI + 0.3, materials.cloth[2], materials.pants);
    addPerson(root, 1.0, -41.0, 0.2, materials.cloth[1], materials.pants);
    addPerson(root, -1.1, -63.0, -0.4, materials.cloth[4], materials.pants);
    addBox(root, 1.4, 0.42, 0.42, materials.granite, 1.7, 0.21, -34, 0, false);
    addBox(root, 1.4, 0.42, 0.42, materials.granite, -1.7, 0.21, -68, 0, false);
    // 巷尾北门：把视线引向永庆码头/荔枝湾
    var endG = new THREE.Group();
    endG.position.set(0, 0, -95);
    root.add(endG);
    addBox(endG, 1.1, 6.2, 1.2, materials.brickGrey, -3.0, 3.1, 0);
    addBox(endG, 1.1, 6.2, 1.2, materials.brickGrey, 3.0, 3.1, 0);
    addBox(endG, 7.2, 1.1, 1.2, materials.brickGrey, 0, 5.9, 0);
    addBox(endG, 8.0, 0.22, 1.6, materials.roofDark, 0, 6.55, 0, 0, false);
    addBox(endG, 2.6, 0.6, 0.14, materials.darkWood, 0, 5.35, 0.68, 0, false);
    addSign(endG, YongqingfangTextures.makeSignTexture("永庆码头", 320, 90, "#e8c684", "#2b1b12", "#9f7b43"), 2.3, 0.48, 0, 5.35, 0.78, 0);
    addLantern(endG, -1.8, 4.6, 0.5, 0.65, 0);
    addLantern(endG, 1.8, 4.6, 0.5, 0.65, 2);
  }

  /* ---------------- 李小龙祖居 ---------------- */

  function buildBruceLee() {
    var g = new THREE.Group();
    g.position.set(13, 0, -47);
    root.add(g);
    var w = 8.5, d = 19, h = 7.5;
    addBox(g, w, 0.85, d, materials.granite, 0, 0.42, -d / 2);
    addBox(g, 3.05, h - 3.2, d, materials.brickGreen, -2.72, 3.2 + (h - 3.2) / 2, -d / 2);
    addBox(g, 3.05, h - 3.2, d, materials.brickGreen, 2.72, 3.2 + (h - 3.2) / 2, -d / 2);
    addBox(g, 2.4, 4.3, d, materials.brickGreen, 0, 3.2 + 2.15, -d / 2);
    addBox(g, 2.4, 0.1, 0.7, materials.granite, 0, 0.05, 0.1, 0, false);
    addBox(g, 0.98, 3.0, 0.12, materials.darkWood, -0.98, 1.5, 0.12, 0, false).rotation.y = 0.18;
    addBox(g, 0.98, 3.0, 0.12, materials.darkWood, 0.98, 1.5, 0.12, 0, false).rotation.y = -0.18;
    addBox(g, 2.5, 0.2, 0.5, materials.granite, 0, 3.35, 0.04);
    addBox(g, 0.25, 3.35, 0.25, materials.granite, -1.25, 1.67, 0.06, 0, false);
    addBox(g, 0.25, 3.35, 0.25, materials.granite, 1.25, 1.67, 0.06, 0, false);
    for (var i = 0; i < 7; i++) {
      addCyl(g, 0.055, 0.055, 2.5, 5, materials.wood, -0.95 + i * 0.31, 1.65, 0.18, false);
    }
    addBox(g, 0.9, 4.0, 0.18, materials.wood, 0, 5.55, 0.04, 0, false);
    addSign(g, textures.signs.bruce, 2.25, 0.62, 0, 3.75, 0.12, 0);
    var coupletL = YongqingfangTextures.makeVerticalTextTexture("凤毛麟角绕西关", 160, 700, "#d9b273", "#4a1c17");
    var coupletR = YongqingfangTextures.makeVerticalTextTexture("凛烈虎威尊武德", 160, 700, "#d9b273", "#4a1c17");
    addSign(g, coupletL, 0.48, 2.3, -1.85, 1.85, 0.1, 0);
    addSign(g, coupletR, 0.48, 2.3, 1.85, 1.85, 0.1, 0);
    addBox(g, 0.9, 2.7, 0.35, materials.darkWood, -2.6, 1.45, -1.2, 0, false);
    addBox(g, 0.9, 2.7, 0.35, materials.darkWood, 2.6, 1.45, -1.2, 0, false);
    addWindow(g, -2.15, 5.5, 0.04, 1.55, 1.7, 1);
    addWindow(g, 2.15, 5.5, 0.04, 1.55, 1.7, 2);
    addGableRoof(g, w, d, h, 2.0);
    // 门厅/天井：开敞门洞 + 屏风 + “戏武世家”
    addBox(g, 5.2, 0.08, 5.4, materials.redFloor, 0, 0.06, -3.3, 0, false);
    addBox(g, 5.2, 2.9, 0.2, materials.darkWood, 0, 1.45, -6.0, 0, false);
    addBox(g, 0.2, 2.9, 5.4, materials.darkWood, -2.6, 1.45, -3.3, 0, false);
    addBox(g, 0.2, 2.9, 5.4, materials.darkWood, 2.6, 1.45, -3.3, 0, false);
    addBox(g, 5.2, 0.16, 5.4, materials.darkWood, 0, 2.88, -3.3, 0, false);
    addBox(g, 2.0, 0.72, 0.12, materials.stageGold, 0, 2.65, -5.88, 0, false);
    addSign(g, YongqingfangTextures.makeSignTexture("戏武世家", 420, 140, "#e6c47f", "#24150e", "#8d6a39"), 1.75, 0.55, 0, 2.65, -5.78, 0);
    addBox(g, 3.4, 0.75, 0.14, materials.darkWood, 0, 1.6, -4.9, 0, false);
    addBox(g, 3.1, 0.6, 0.1, materials.shopInterior, 0, 1.6, -4.82, 0, false);
    addGlowSprite(g, 0, 1.9, -4.5, 2.3, 0xffc887, 0.28);
    addBox(g, 3.6, 0.16, 2.2, materials.paving, 0, 0.08, 1.2, 0, false);
    addBox(g, 0.8, 0.6, 0.8, materials.granite, -3.5, 0.3, 1.4, 0, false);
    var plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), materials.leaf);
    plant.position.set(-3.5, 1.0, 1.4); plant.castShadow = true; g.add(plant);
    addSign(g, textures.signs.bruce, 1.15, 0.42, 4.8, 2.8, 1.0, Math.PI / 2);
  }

  /* ---------------- 銮舆堂 ---------------- */

  function buildLuanyu() {
    var g = new THREE.Group();
    g.position.set(-12, 0, -72);
    root.add(g);
    var w = 10, d = 12, h = 8.2;
    addBox(g, w, 0.75, d, materials.granite, 0, 0.37, -d / 2);
    addBox(g, w, h - 3.6, d, materials.brickGreen, 0, 3.6 + (h - 3.6) / 2, -d / 2);
    addBox(g, w, 3.6, 0.36, materials.brickGreen, 0, 1.8, -0.18);
    addBox(g, 3.8, 3.2, 0.35, materials.darkWood, 0, 1.6, 0.02);
    for (var i = 0; i < 5; i++) {
      addCyl(g, 0.06, 0.06, 2.5, 5, materials.wood, -1.35 + i * 0.68, 1.6, 0.2, false);
    }
    addBox(g, 0.8, 0.55, 0.12, materials.darkWood, 0, 3.35, 0.04, 0, false);
    addSign(g, textures.signs.luanyu, 2.4, 0.44, 0, 3.35, 0.14, 0);
    addWindow(g, -3.0, 5.9, 0.05, 1.5, 1.6, 0);
    addWindow(g, 3.0, 5.9, 0.05, 1.5, 1.6, 2);
    addGableRoof(g, w, d, h, 1.9);
    addBox(g, 0.35, 1.1, 0.35, materials.granite, -4.4, 0.55, 1.0, 0, false);
    addBox(g, 0.35, 1.1, 0.35, materials.granite, 4.4, 0.55, 1.0, 0, false);
    addLantern(g, -2.0, 3.1, 0.5, 0.7, 0);
    addLantern(g, 2.0, 3.1, 0.5, 0.7, 0);
  }

  /* ---------------- 八和会馆 ---------------- */

  function buildBahe() {
    var g = new THREE.Group();
    g.position.set(118, 0, -9);
    root.add(g);
    var w = 12, d = 14, h = 9.8;
    addBox(g, w, 0.7, d, materials.granite, 0, 0.35, -d / 2);
    addBox(g, w, h - 4.3, d, materials.brickGreen, 0, 4.3 + (h - 4.3) / 2, -d / 2);
    addBox(g, w, 4.3, 0.36, materials.brickGreen, 0, 2.15, -0.18);
    // 拱形门洞：深色暗部 + 趟栊 + 石拱套 + 石阶
    addBox(g, 3.2, 2.6, 0.08, materials.portalDark, 0, 1.3, 0.035, 0, false);
    var portalTop = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20, 0, Math.PI), materials.portalDark);
    portalTop.position.set(0, 2.6, 0.075);
    g.add(portalTop);
    addGlowSprite(g, 0, 1.8, 0.16, 2.2, 0xffc887, 0.08);
    for (var i = 0; i < 11; i++) {
      addBeam(g, -1.45, 0.58 + i * 0.215, 0.18, 1.45, 0.58 + i * 0.215, 0.18, 0.018, materials.darkWood, 5, false);
    }
    addArch(g, 3.2, 2.6, 0.16, materials.granite, 0.3);
    addBox(g, 0.38, 2.6, 0.5, materials.granite, -1.62, 1.3, 0.12, 0, false);
    addBox(g, 0.38, 2.6, 0.5, materials.granite, 1.62, 1.3, 0.12, 0, false);
    for (var st = 0; st < 3; st++) {
      addBox(g, 5.0 - st * 0.35, 0.14, 0.6, materials.granite, 0, 0.07 + st * 0.14, 1.15 + st * 0.55, 0, false);
    }
    [-2.25, 2.25].forEach(function (x) {
      var drum = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 10), materials.granite);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(x, 0.55, 0.75);
      g.add(drum);
    });
    // 门匾 + 对联 + 门灯 + 三层檐口
    addBox(g, 2.9, 0.66, 0.14, materials.darkWood, 0, 4.62, 0.12, 0, false);
    addSign(g, textures.signs.bahe, 2.7, 0.5, 0, 4.62, 0.2, 0);
    var coupletL = YongqingfangTextures.makeVerticalTextTexture("和乐和衷同倡盛世歌", 150, 760, "#d9b273", "#2b1a12");
    var coupletR = YongqingfangTextures.makeVerticalTextTexture("八音八表高奏升平调", 150, 760, "#d9b273", "#2b1a12");
    addSign(g, coupletL, 0.42, 2.5, -2.65, 2.35, 0.1, 0);
    addSign(g, coupletR, 0.42, 2.5, 2.65, 2.35, 0.1, 0);
    addSign(g, textures.signs.enning177, 1.2, 0.34, 4.55, 2.15, 0.13, 0);
    addBox(g, 7.4, 0.16, 2.2, materials.roof, 0, 5.55, 0.9, 0, false).rotation.x = -0.08;
    addBox(g, 7.6, 0.12, 0.28, materials.roofDark, 0, 5.72, 1.95, 0, false);
    addBeam(g, -3.2, 5.45, 0.1, -3.2, 4.5, 1.55, 0.06, materials.darkWood, 5, false);
    addBeam(g, 3.2, 5.45, 0.1, 3.2, 4.5, 1.55, 0.06, materials.darkWood, 5, false);
    addLantern(g, -3.6, 4.05, 0.85, 0.7, 0);
    addLantern(g, 3.6, 4.05, 0.85, 0.7, 2);
    // 二层满洲窗 + 檐口 + 山花
    addBox(g, w, 0.16, 0.24, materials.brickGreen, 0, 4.38, 0.08, 0, false);
    addWindow(g, -3.8, 6.6, 0.06, 1.55, 1.8, 1);
    addWindow(g, 0, 6.6, 0.06, 1.55, 1.8, 0);
    addWindow(g, 3.8, 6.6, 0.06, 1.55, 1.8, 2);
    addWindow(g, -3.8, 8.55, 0.06, 1.5, 0.95, 3);
    addWindow(g, 0, 8.55, 0.06, 1.5, 0.95, 3);
    addWindow(g, 3.8, 8.55, 0.06, 1.5, 0.95, 2);
    addBox(g, w, 0.2, 0.34, materials.plaster, 0, 9.45, 0.08, 0, false);
    addBox(g, 3.4, 1.1, 0.2, materials.plaster, 0, 10.15, 0.06, 0, false);
    addBox(g, 2.0, 0.55, 0.12, materials.brickGreen, 0, 10.2, 0.17, 0, false);
    addGableRoof(g, w, d, h, 1.9);
    addBox(g, 4.8, 0.22, 1.6, materials.granite, 0, 0.1, 1.6, 0, false);
    addPipe(g, -w / 2 + 0.4, 0.2, 0.06, h - 0.4);
    addHangingSign(g, YongqingfangTextures.makeVerticalTextTexture("八和会馆", 160, 620, "#e8c684", "#2b1b12"), 5.9, 2.8, 0.55, 0.5, 2.0);
    addPerson(g, -3.4, 2.4, 2.7, materials.cloth[0], materials.pants);
    addPerson(g, 3.2, 3.0, 0.4, materials.cloth[2], materials.pants);
    addBike(g, 4.7, 1.9, -0.4);
  }

  /* ---------------- 恩宁路骑楼 ---------------- */

  function buildEnningArcade() {
    buildRow(-70, -6, -9, true, { d: 14, floors: 4, arcade: true, module: 13, sign: true });
    buildRow(4, 15, -9, true, { d: 14, floors: 4, arcade: true, module: 11, sign: true });
    buildRow(108, 112, -9, true, { d: 14, floors: 3, arcade: true, module: 6, sign: false });
    buildRow(124, 150, -9, true, { d: 14, floors: 3, arcade: true, module: 13, sign: true });
    buildRow(-70, 160, 9, true, { ry: Math.PI, d: 14, floors: 4, arcade: true, module: 16, sign: true });
    // 金声电影院：只存牌楼/立面剪影
    var cin = new THREE.Group();
    cin.position.set(161, 0, -9);
    root.add(cin);
    addBox(cin, 13, 20, 6, materials.brickGrey, 0, 10, -3, 0, true);
    addBox(cin, 15, 1.2, 7, materials.plaster, 0, 20.4, -3, 0, false);
    addBox(cin, 10, 1.0, 1.0, materials.darkWood, 0, 5.0, 0.2, 0, false);
    addSign(cin, textures.signs.cinema, 9.2, 1.1, 0, 5.0, 0.75, 0);
    addBox(cin, 2.2, 8.5, 0.5, materials.darkWood, 0, 2.6, 0.1, 0, false);
    // 街道家具与电线
    for (var l = 0; l < 6; l++) {
      var lx = -50 + l * 36;
      addCyl(root, 0.08, 0.1, 5.2, 6, materials.metal, lx, 2.6, 7.7, false);
      addBox(root, 0.5, 0.16, 0.5, materials.lanternWarm, lx, 5.2, 7.7, 0, false);
      addCyl(root, 0.08, 0.1, 5.2, 6, materials.metal, lx + 12, 2.6, -7.7, false);
      addBox(root, 0.5, 0.16, 0.5, materials.lanternWarm, lx + 12, 5.2, -7.7, 0, false);
    }
    [15, 45, 75, 105].forEach(function (tx) {
      addBox(root, 2.2, 0.3, 2.2, materials.granite, tx, 0.15, 7.3, 0, false);
      addTree(tx, 7.3, 0.62, "round");
    });
    [22, 62, 98].forEach(function (tx) {
      addBox(root, 2.2, 0.3, 2.2, materials.granite, tx, 0.15, -7.3, 0, false);
      addTree(tx, -7.3, 0.58, "round");
    });
    addBike(root, 8, -7.9, 1.1);
    addBike(root, 46, -7.8, -1.3);
    addBike(root, 86, 7.8, 1.4);
    addBike(root, 118, 7.9, -1.1);
    addPerson(root, -6, 7.6, 1.2, materials.cloth[0], materials.pants);
    addPerson(root, 18, -7.7, -1.8, materials.cloth[2], materials.pants);
    addPerson(root, 52, 7.6, 2.2, materials.cloth[3], materials.pants);
    addPerson(root, 88, 7.7, -2.5, materials.cloth[4], materials.pants);
    addPerson(root, 132, -7.8, 2.9, materials.cloth[0], materials.pants);
    [0, 40, 82, 126].forEach(function (tx, ti) {
      addCyl(root, 0.26, 0.3, 0.85, 8, materials.metal, tx + ti * 0.4, 0.43, ti % 2 ? -7.9 : 7.9, false);
      addCyl(root, 0.3, 0.32, 0.1, 8, materials.darkWood, tx + ti * 0.4, 0.9, ti % 2 ? -7.9 : 7.9, false);
    });
    for (var w = 0; w < 3; w++) {
      var wx = -30 + w * 55;
      addBeam(root, wx, 7.6, -9, wx + 3, 7.25, 0, 0.018, materials.metal, 4, false);
      addBeam(root, wx + 3, 7.25, 0, wx + 4, 7.5, 9, 0.018, materials.metal, 4, false);
    }
    for (var b = 0; b < 5; b++) {
      addCyl(root, 0.22, 0.22, 0.55, 8, materials.whiteStone, -3 + b * 1.5, 0.3, 7.0, false);
    }
  }

  /* ---------------- 粤剧艺术博物馆 ---------------- */

  function buildMuseumWall() {
    var z = -20;
    var segs = [[38, 42], [46, 56], [56, 76], [76, 96], [96, 108]];
    segs.forEach(function (s) {
      addBox(root, s[1] - s[0], 4.0, 0.55, materials.plaster, (s[0] + s[1]) / 2, 2.0, z, 0, true);
      addBox(root, s[1] - s[0] + 0.4, 0.22, 0.95, materials.roof, (s[0] + s[1]) / 2, 4.1, z, 0, false);
      addBox(root, s[1] - s[0], 0.7, 0.6, materials.brickGreen, (s[0] + s[1]) / 2, 0.35, z, 0, false);
    });
    addBox(root, 4.0, 4.6, 0.55, materials.plaster, 42, 2.3, z, 0, false);
    addBox(root, 4.0, 0.6, 0.6, materials.roof, 42, 4.7, z, 0, false);
    addBox(root, 3.2, 3.0, 0.4, materials.darkWood, 44, 1.5, z + 0.1, 0, false);
    addBox(root, 0.8, 0.55, 0.16, materials.darkWood, 44, 4.0, z + 0.35, 0, false);
    addSign(root, textures.signs.museum, 2.5, 0.45, 44, 4.0, z + 0.46, 0);
    addBox(root, 4.2, 0.15, 1.4, materials.granite, 44, 0.1, z + 0.8, 0, false);
    // 西侧院墙 + 月洞门
    var wx = 38;
    addBox(root, 0.55, 3.6, 21, materials.plaster, wx, 1.8, -32.5, 0, true);
    addBox(root, 0.55, 3.6, 58, materials.plaster, wx, 1.8, -76, 0, true);
    addBox(root, 0.9, 0.2, 21, materials.roofDark, wx, 3.65, -32.5, 0, false);
    addBox(root, 0.9, 0.2, 58, materials.roofDark, wx, 3.65, -76, 0, false);
    addBox(root, 0.55, 0.9, 6, materials.plaster, wx, 3.15, -45, 0, false);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.14, 8, 24), materials.whiteStone);
    ring.position.set(wx, 1.55, -45);
    ring.rotation.y = Math.PI / 2;
    root.add(ring);
    addBox(root, 1.8, 0.1, 3.2, materials.granite, wx, 0.1, -45, 0, false);
    addBox(root, 0.4, 0.45, 0.4, materials.roofDark, wx, 3.65, -41.5, 0, false);
    addBox(root, 0.4, 0.45, 0.4, materials.roofDark, wx, 3.65, -48.5, 0, false);
    // 临街白墙的深色墙裙、通风窗与两棵树，避免长墙空白
    addBox(root, 70, 0.72, 0.14, materials.darkWood, 73, 0.36, -19.64, 0, false);
    for (var mx = 50; mx <= 100; mx += 10) {
      if (mx % 20 === 0) addWindow(root, mx, 2.45, -19.66, 1.4, 1.5, 1);
      else addWindow(root, mx, 2.45, -19.66, 1.1, 1.35, 3);
      addBox(root, 1.7, 0.16, 0.24, materials.brickGreen, mx, 1.6, -19.62, 0, false);
    }
    [-1.55, 1.55].forEach(function (dz) {
      var drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 12), materials.granite);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(37.35, 0.35, -45 + dz);
      drum.castShadow = true; root.add(drum);
      addBox(root, 0.8, 0.18, 1.2, materials.granite, 37.35, 0.09, -45 + dz, 0, false);
    });
    for (var bb = 0; bb < 8; bb++) {
      addCyl(root, 0.035, 0.05, 3.4 + rnd() * 1.6, 5, materials.leafDark, 39.4 + rnd() * 1.2, 2.0, -26 - bb * 6.5, false);
    }
    addHangingSign(root, YongqingfangTextures.makeVerticalTextTexture("粤剧艺术博物馆", 160, 860, "#e8c684", "#2b1b12"), 38.5, 2.7, -50, 0.55, 2.8);
    addTree(54, -16, 0.66, "round");
    addTree(94, -16, 0.7, "round");
    [-55, -65, -75, -85].forEach(function (wz) {
      addBox(root, 0.18, 2.2, 1.5, materials.darkWood, 37.72, 1.8, wz, 0, false);
      addLantern(root, 37.45, 2.9, wz, 0.42, 1);
    });
  }

  function buildStage() {
    var g = new THREE.Group();
    g.position.set(58, 0, -68);
    g.rotation.y = Math.PI / 2;
    root.add(g);
    addBox(g, 12, 1.1, 8, materials.granite, 0, 0.55, -4, 0, true);
    addBox(g, 11.2, 0.12, 7.2, materials.darkWood, 0, 1.16, -4, 0, false);
    for (var i = 0; i < 4; i++) {
      addBox(g, 1.2, 0.16, 0.9, materials.granite, -4.2 + i * 2.8, 0.58, -0.5, 0, false);
    }
    [-5.3, 5.3].forEach(function (x) {
      [-0.6, -3.6, -6.4].forEach(function (z) {
        addCyl(g, 0.18, 0.22, 4.8, 8, materials.darkWood, x, 3.5, z, false);
      });
    });
    addBox(g, 11, 3.8, 0.4, materials.darkWood, 0, 3.0, -7.5, 0, true);
    addBox(g, 8.0, 2.6, 0.12, materials.stageGold, 0, 3.0, -7.25, 0, false);
    addSign(g, textures.signs.guangfu, 2.1, 0.48, 0, 4.9, -7.2, 0);
    addBox(g, 11.8, 0.35, 8.4, materials.darkWood, 0, 5.55, -4, 0, false);
    addHipRoof(g, 14.5, 10.4, 2.2, 5.7);
    addBox(g, 9.2, 1.2, 6.4, materials.darkWood, 0, 6.55, -4, 0, true);
    addHipRoof(g, 10.8, 7.8, 1.6, 7.15);
    addBox(g, 12.4, 0.2, 8.8, materials.roofDark, 0, 6.05, -4, 0, false);
    addBalustradeX(g, -5.6, 5.6, -7.9, 1.2);
    addLantern(g, -4.4, 4.4, -7.1, 0.7, 0);
    addLantern(g, 4.4, 4.4, -7.1, 0.7, 2);
    addGlowSprite(g, 0, 3.0, -7.0, 4.0, 0xffc46a, 0.35);
    addBox(g, 12, 0.1, 1.2, materials.granite, 0, 0.12, 0.3, 0, false);
    // 后台连接岸线：石阶从博物馆西岸上到台面，台后加一道屏门
    for (var bs = 0; bs < 5; bs++) {
      var bh = 0.22 * (5 - bs);
      addBox(g, 4.0, bh, 0.6, materials.granite, 0, bh / 2, -8.35 - bs * 0.6, 0, false);
    }
    addBox(g, 4.4, 0.22, 1.2, materials.granite, 0, 1.08, -8.1, 0, false);
    addBox(g, 4.0, 2.6, 0.16, materials.darkWood, 0, 2.45, -8.05, 0, false);
    addBox(g, 4.2, 0.5, 0.2, materials.darkWood, 0, 3.75, -8.03, 0, false);
    addSign(g, textures.signs.guangfu, 1.7, 0.38, 0, 3.75, -7.93, 0);
    addBeam(g, -2.0, 1.1, -8.0, -2.0, 3.4, -8.0, 0.05, materials.darkWood, 5, false);
    addBeam(g, 2.0, 1.1, -8.0, 2.0, 3.4, -8.0, 0.05, materials.darkWood, 5, false);
    addPerson(g, -4.6, -5.6, 0.4, materials.cloth[1], materials.pants);
    addPerson(g, -4.6, -1.8, -0.4, materials.cloth[3], materials.pants);
    addPerson(g, 4.6, -3.4, 2.6, materials.cloth[0], materials.pants);
  }

  function buildMainHall() {
    var g = new THREE.Group();
    g.position.set(66, 0, -45);
    root.add(g);
    addBox(g, 24, 0.6, 13, materials.granite, 0, 0.3, 0, 0, true);
    for (var s = 0; s < 3; s++) {
      addBox(g, 9 - s * 0.7, 0.18, 0.95, materials.granite, 0, 0.5 - s * 0.16, -6.9 - s * 0.78, 0, false);
    }
    addBox(g, 22, 6.4, 11, materials.plaster, 0, 3.8, 0, 0, true);
    addBox(g, 22.15, 1.15, 11.15, materials.brickGreen, 0, 1.2, 0, 0, false);
    [-10.85, 10.85].forEach(function (px) {
      addBox(g, 0.55, 6.4, 0.55, materials.brickGrey, px, 3.8, -5.4, 0, false);
    });
    for (var vx = -8; vx <= 8; vx += 4) {
      addCyl(g, 0.19, 0.23, 4.9, 8, materials.darkWood, vx, 2.45, -5.85, false);
    }
    addBox(g, 21.2, 0.3, 1.8, materials.darkWood, 0, 5.05, -5.85, 0, false);
    addBox(g, 21.2, 0.2, 1.3, materials.darkWood, 0, 0.68, -5.85, 0, false);
    addLantern(g, -7.6, 4.5, -6.25, 0.62, 0);
    addLantern(g, 7.6, 4.5, -6.25, 0.62, 2);
    addSignBack(g, textures.signs.museum, 2.7, 0.52, 0, 5.28, -6.78);
    var hallC1 = YongqingfangTextures.makeVerticalTextTexture("南国红豆", 150, 640, "#e8c684", "#2b1b12");
    var hallC2 = YongqingfangTextures.makeVerticalTextTexture("粤韵风华", 150, 640, "#e8c684", "#2b1b12");
    addSignBack(g, hallC1, 0.46, 2.2, -9.3, 3.3, -6.66);
    addSignBack(g, hallC2, 0.46, 2.2, 9.3, 3.3, -6.66);
    [-6.6, -2.3, 2.3, 6.6].forEach(function (wx, wi) {
      addWindowBack(g, wx, 3.45, -5.56, 2.0, 2.2, wi % 3);
    });
    addHipRoof(g, 26, 15, 1.7, 7.0);
    addBox(g, 22.3, 0.26, 11.3, materials.whiteStone, 0, 7.02, 0, 0, false);
    addBox(g, 15, 4.4, 7.5, materials.plaster, 0, 9.5, -0.6, 0, true);
    addBox(g, 15.15, 0.9, 7.65, materials.brickGreen, 0, 7.55, -0.6, 0, false);
    addBox(g, 15.8, 0.22, 2.1, materials.granite, 0, 8.28, -4.7, 0, false);
    addBalustradeX(g, -7.3, 7.3, -5.6, 8.38);
    [-4.6, 0, 4.6].forEach(function (wx, wi) {
      addWindowBack(g, wx, 9.7, -4.4, 2.0, 2.2, (wi + 1) % 3);
    });
    addHipRoof(g, 18.8, 10.6, 1.5, 11.7);
    addBox(g, 8.8, 2.8, 5.2, materials.plaster, 0, 13.7, -0.6, 0, true);
    addWindowBack(g, -2.3, 13.9, -3.25, 1.5, 1.6, 0);
    addWindowBack(g, 2.3, 13.9, -3.25, 1.5, 1.6, 2);
    addSignBack(g, textures.signs.museum, 1.9, 0.4, 0, 12.7, -3.28);
    addHipRoof(g, 11.6, 7.8, 1.4, 15.1);
    addCyl(g, 0.16, 0.24, 1.8, 8, materials.roofDark, 0, 16.5, -0.6, false);
    addGlowSprite(g, 0, 6.2, -6.9, 5.2, 0xffc46a, 0.2);
    addBox(g, 6, 0.25, 1.4, materials.granite, 0, 0.5, -7.35, 0, false);
  }

  function buildTower() {
    var g = new THREE.Group();
    g.position.set(86, 0, -43);
    root.add(g);
    addBox(g, 15, 1.1, 15, materials.granite, 0, 0.55, 0, 0, true);
    for (var s = 0; s < 3; s++) {
      addBox(g, 8 - s * 0.5, 0.18, 0.9, materials.granite, 0, 1.0 - s * 0.2, -8.2 - s * 0.7, 0, false);
    }
    var tiers = [
      { w: 12, d: 12, h: 4.6, y: 1.1 },
      { w: 10.2, d: 10.2, h: 4.2, y: 5.7 },
      { w: 8.4, d: 8.4, h: 3.8, y: 9.9 }
    ];
    tiers.forEach(function (t, i) {
      addBox(g, t.w, t.h, t.d, materials.plaster, 0, t.y + t.h / 2, 0, 0, true);
      addBox(g, t.w + 0.5, 0.22, t.d + 0.5, materials.whiteStone, 0, t.y + t.h, 0, 0, false);
      addBalustradeX(g, -t.w / 2 - 0.15, t.w / 2 + 0.15, t.d / 2 + 0.3, t.y + t.h + 0.05);
      addBox(g, t.w * 0.72, 0.8, 0.12, materials.darkWood, 0, t.y + t.h * 0.55, t.d / 2 + 0.06, 0, false);
      addHipRoof(g, t.w + 1.8, t.d + 1.8, 1.5, t.y + t.h + 0.25);
      addWindow(g, -t.w * 0.25, t.y + t.h * 0.55, t.d / 2 + 0.12, 1.2, 1.3, i % 3);
      addWindow(g, t.w * 0.25, t.y + t.h * 0.55, t.d / 2 + 0.12, 1.2, 1.3, (i + 1) % 3);
      addWindowBack(g, -t.w * 0.25, t.y + t.h * 0.55, -t.d / 2 - 0.12, 1.2, 1.3, (i + 1) % 3);
      addWindowBack(g, t.w * 0.25, t.y + t.h * 0.55, -t.d / 2 - 0.12, 1.2, 1.3, i % 3);
    });
    addCyl(g, 0.25, 0.4, 2.4, 8, materials.roofDark, 0, 16.2, 0, false);
    addGlowSprite(g, 0, 15.8, 0, 1.8, 0xffc46a, 0.3);
    addSignBack(g, textures.signs.museum, 2.2, 0.44, 0, 4.2, -6.12);
  }

  function buildAudienceDeck() {
    addBox(root, 6.2, 0.35, 18, materials.granite, 89, 0.18, -68, 0, false);
    for (var pz = -75; pz <= -61; pz += 3.5) {
      addCyl(root, 0.28, 0.32, 1.6, 6, materials.granite, 87.2, -0.5, pz, false);
      addCyl(root, 0.28, 0.32, 1.6, 6, materials.granite, 90.8, -0.5, pz, false);
    }
    for (var s = 0; s < 2; s++) {
      addBox(root, 0.9, 0.18 - s * 0.08, 16, materials.granite, 92.6 + s * 0.85, 0.28 - s * 0.1, -68, 0, false);
    }
    addBox(root, 0.22, 0.4, 16, materials.whiteStone, 86.1, 0.55, -68, 0, false);
    for (var bz = -75; bz <= -61; bz += 3.5) {
      addBox(root, 3.2, 0.18, 0.58, materials.whiteStone, 88.4, 0.52, bz, 0, false);
      addBox(root, 0.18, 0.45, 0.5, materials.granite, 87.2, 0.28, bz, 0, false);
      addBox(root, 0.18, 0.45, 0.5, materials.granite, 89.6, 0.28, bz, 0, false);
    }
    addPerson(root, 88.2, -71.4, Math.PI / 2, materials.cloth[2], materials.pants);
    addPerson(root, 89.4, -64.6, Math.PI / 2 + 0.4, materials.cloth[4], materials.pants);
    addCyl(root, 0.34, 0.4, 0.55, 8, materials.terracotta, 90.6, 0.28, -58.5, false);
    var bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), materials.leaf);
    bush.position.set(90.6, 0.95, -58.5); bush.castShadow = true; root.add(bush);
    addCyl(root, 0.34, 0.4, 0.55, 8, materials.terracotta, 90.6, 0.28, -77.2, false);
    var bush2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), materials.leafDark);
    bush2.position.set(90.6, 0.95, -77.2); bush2.castShadow = true; root.add(bush2);
  }

  function buildLake() {
    addBox(root, 40, 0.14, 36, materials.lakeBed, 72, -0.42, -70, 0, false);
    var water = new THREE.Mesh(new THREE.PlaneGeometry(40, 36), lakeMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(72, -0.33, -70);
    root.add(water);
    var glint = new THREE.Mesh(new THREE.PlaneGeometry(39.6, 35.6), glintMats[0]);
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(72, -0.305, -70);
    root.add(glint);
    [[66, -53.5, 20, 4.2], [86, -54.4, 10, 5], [63, -68, 10, 10], [72, -76, 14, 5]].forEach(function (rp) {
      var ref = new THREE.Mesh(new THREE.PlaneGeometry(rp[2], rp[3]), materials.reflectDark);
      ref.rotation.x = -Math.PI / 2;
      ref.position.set(rp[0], -0.298, rp[1]);
      root.add(ref);
    });
    // 石砌驳岸：块石体量 + 现有压顶/栏杆
    for (var bx = 53; bx <= 91; bx += 1.7) {
      addBox(root, 1.45, 0.9, 0.7, materials.granite, bx, -0.12, -88.0, 0, false);
      if (bx < 57 || bx > 75) addBox(root, 1.45, 0.9, 0.7, materials.granite, bx, -0.12, -52.0, 0, false);
    }
    for (var bz = -60; bz >= -88; bz -= 1.7) {
      addBox(root, 0.7, 0.9, 1.45, materials.granite, 52.0, -0.12, bz, 0, false);
    }
    for (var ez = -52; ez >= -58; ez -= 1.6) {
      addBox(root, 0.7, 0.9, 1.45, materials.granite, 92.0, -0.12, ez, 0, false);
    }
    for (var ez2 = -78; ez2 >= -88; ez2 -= 1.6) {
      addBox(root, 0.7, 0.9, 1.45, materials.granite, 92.0, -0.12, ez2, 0, false);
    }
    addBox(root, 42, 0.55, 0.6, materials.granite, 72, 0.1, -51.7, 0, false);
    addBox(root, 42, 0.55, 0.6, materials.granite, 72, 0.1, -88.3, 0, false);
    addBox(root, 0.6, 0.55, 36, materials.granite, 51.7, 0.1, -70, 0, false);
    addBox(root, 0.6, 0.55, 36, materials.granite, 92.3, 0.1, -70, 0, false);
    addBox(root, 42, 0.16, 0.9, materials.whiteStone, 72, 0.43, -51.7, 0, false);
    addBox(root, 42, 0.16, 0.9, materials.whiteStone, 72, 0.43, -88.3, 0, false);
    addBox(root, 0.9, 0.16, 36, materials.whiteStone, 51.7, 0.43, -70, 0, false);
    addBox(root, 0.9, 0.16, 36, materials.whiteStone, 92.3, 0.43, -70, 0, false);
    addRailingX(root, 52, 92, -51.7, 0.65, materials.whiteStone);
    addRailingX(root, 52, 92, -88.3, 0.65, materials.whiteStone);
    // 荷叶/荷花：三组，近岸为主
    [[62, -74, 16], [66, -60, 12], [84, -77, 13]].forEach(function (cl) {
      for (var lp = 0; lp < cl[2]; lp++) {
        var ang = rnd() * Math.PI * 2;
        var rad = rnd() * 3.6;
        var lx = cl[0] + Math.cos(ang) * rad;
        var lz = cl[1] + Math.sin(ang) * rad;
        var pad = new THREE.Mesh(new THREE.CircleGeometry(0.4 + rnd() * 0.5, 9), rnd() > 0.6 ? materials.leafDark : materials.lotus);
        pad.rotation.x = -Math.PI / 2 + (rnd() - 0.5) * 0.08;
        pad.position.set(lx, -0.285 + rnd() * 0.02, lz);
        root.add(pad);
        if (rnd() > 0.72) {
          addCyl(root, 0.025, 0.03, 0.42, 4, materials.lotus, lx + 0.1, -0.05, lz, false);
          var flower = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 6), materials.lotusFlower);
          flower.position.set(lx + 0.1, 0.19, lz);
          root.add(flower);
        }
      }
    });
    // 岸边菖蒲/芦苇
    for (var rd = 0; rd < 26; rd++) {
      var rrx = 53 + rnd() * 38;
      var rrz = rnd() > 0.5 ? -51.2 - rnd() * 0.8 : -88.8 + rnd() * 0.8;
      addCyl(root, 0.015, 0.025, 0.6 + rnd() * 0.7, 4, materials.leafDark, rrx, 0.2, rrz, false);
    }
    [[62, -66], [64, -73], [68, -83], [80, -54]].forEach(function (p) {
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), moonGlowMat);
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(p[0], -0.29, p[1]);
      root.add(gl);
    });
    // 戏台/主楼在水面的暖色倒影条
    [[62, -68, 9, 5], [66, -55, 8, 4], [84, -56, 6, 4]].forEach(function (p) {
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(p[2], p[3]), moonGlowMat);
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(p[0], -0.288, p[1]);
      root.add(gl);
    });
    for (var r = 0; r < 9; r++) {
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + rnd() * 1.2, 0), materials.rock);
      rock.position.set(42 + rnd() * 4, 0.4 + rnd() * 0.5, -58 - rnd() * 24);
      rock.scale.set(1.4, 0.8, 1.1);
      rock.rotation.set(rnd(), rnd() * 6.3, rnd());
      rock.castShadow = true; root.add(rock);
    }
    [94.5, 96.5].forEach(function (rx) {
      var rock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), materials.rock);
      rock2.position.set(rx, 0.5, -80 + rnd() * 3);
      rock2.scale.set(1.5, 0.7, 1.2);
      rock2.rotation.set(rnd(), rnd() * 6.3, rnd());
      rock2.castShadow = true; root.add(rock2);
    });
  }

  function buildBackstage() {
    var g = new THREE.Group();
    g.position.set(46.5, 0, -68);
    root.add(g);
    addBox(g, 7, 7.2, 14, materials.brickGrey, 0, 3.6, 0, 0, true);
    addBox(g, 7.2, 0.8, 14.2, materials.granite, 0, 0.4, 0, 0, false);
    addBox(g, 7.25, 1.0, 14.25, materials.brickGreen, 0, 4.25, 0, 0, false);
    addHipRoof(g, 8.6, 15.4, 1.5, 7.2);
    for (var z = -5.2; z <= 5.2; z += 2.1) {
      addCyl(g, 0.14, 0.17, 4.0, 6, materials.darkWood, 3.25, 2.05, z, false);
    }
    addBox(g, 1.3, 0.22, 12.6, materials.darkWood, 3.25, 4.1, 0, 0, false);
    for (var p = 0; p < 5; p++) {
      addBox(g, 0.1, 2.4, 1.6, materials.darkWood, 3.52, 2.4, -5 + p * 2.5, 0, false);
    }
    addLantern(g, 3.8, 3.4, -4.0, 0.55, 0);
    addLantern(g, 3.8, 3.4, 4.0, 0.55, 2);
    addGlowSprite(g, 3.6, 2.2, 0, 3.2, 0xffc46a, 0.18);
  }

  function buildMuseum() {
    buildMuseumWall();
    buildLake();
    buildStage();
    buildBackstage();
    buildMainHall();
    buildTower();
    buildAudienceDeck();
    // 廊桥：东侧 + 北侧
    var corridor1 = new THREE.Group();
    corridor1.position.set(96, 0, -70);
    root.add(corridor1);
    addBox(corridor1, 4.4, 0.4, 38, materials.granite, 1.5, 0.2, 0, 0, false);
    for (var i = 0; i < 9; i++) {
      addCyl(corridor1, 0.12, 0.15, 3.2, 6, materials.darkWood, 0, 1.6, -18 + i * 4.5, false);
      addCyl(corridor1, 0.12, 0.15, 3.2, 6, materials.darkWood, 3.0, 1.6, -18 + i * 4.5, false);
    }
    addBox(corridor1, 3.8, 0.18, 38, materials.darkWood, 1.5, 3.25, 0, 0, false);
    addHipRoof(corridor1, 4.4, 39, 1.1, 3.3);
    addBalustradeX(corridor1, 0, 3.0, 18.6, 0.35);
    var corridor2 = new THREE.Group();
    corridor2.position.set(70, 0, -90);
    root.add(corridor2);
    addBox(corridor2, 36.4, 0.4, 4.4, materials.granite, 0, 0.2, 1.5, 0, false);
    for (var j = 0; j < 8; j++) {
      addCyl(corridor2, 0.12, 0.15, 3.2, 6, materials.darkWood, -16 + j * 4.4, 1.6, 0, false);
      addCyl(corridor2, 0.12, 0.15, 3.2, 6, materials.darkWood, -16 + j * 4.4, 1.6, 3.0, false);
    }
    addBox(corridor2, 36, 0.18, 3.8, materials.darkWood, 0, 3.25, 1.5, 0, false);
    addHipRoof(corridor2, 37, 4.4, 1.1, 3.3);
    // 院墙内的树/竹
    addTree(45, -35, 0.85, "round");
    addTree(103, -50, 0.8, "round");
    addTree(42, -55, 0.7, "round");
    addTree(48, -96, 0.75, "banyan");
    addTree(100, -100, 0.9, "banyan");
    addTree(106, -76, 0.75, "round");
    addGlowSprite(root, 58, 4.2, -68, 6.0, 0xffc46a, 0.22);
    addGlowSprite(root, 66, 8.4, -50.5, 7.0, 0xffc46a, 0.18);
  }

  /* ---------------- 荔枝湾涌 / 月亮桥 ---------------- */

  function buildBoat(x, z) {
    var g = new THREE.Group();
    g.position.set(x, -0.62, z);
    root.add(g);
    addBox(g, 7.0, 0.55, 2.1, materials.boatRed, 0, 0.3, 0, 0, true);
    addBox(g, 6.0, 0.12, 1.7, materials.wood, 0, 0.62, 0, 0, false);
    addBox(g, 4.2, 0.5, 1.8, materials.darkWood, 0, 0.9, 0, 0, false);
    var roofL = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.09, 1.25), materials.boatRed);
    roofL.position.set(0, 1.32, -0.55);
    roofL.rotation.x = 0.5;
    roofL.castShadow = true;
    g.add(roofL);
    var roofR = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.09, 1.25), materials.boatRed);
    roofR.position.set(0, 1.32, 0.55);
    roofR.rotation.x = -0.5;
    roofR.castShadow = true;
    g.add(roofR);
    addBox(g, 5.1, 0.1, 0.14, materials.darkWood, 0, 1.64, 0, 0, false);
    for (var i = -1; i <= 1; i++) {
      addCyl(g, 0.05, 0.05, 1.9, 5, materials.darkWood, i * 1.8, 1.25, -0.95, false);
      addCyl(g, 0.05, 0.05, 1.9, 5, materials.darkWood, i * 1.8, 1.25, 0.95, false);
    }
    addBox(g, 2.6, 0.5, 0.06, materials.canvas, 0, 1.05, -1.02, 0, false);
    addBox(g, 2.6, 0.5, 0.06, materials.canvas, 0, 1.05, 1.02, 0, false);
    addLantern(g, -2.2, 1.5, 0.0, 0.55, 0);
    addLantern(g, 2.2, 1.5, 0.0, 0.55, 2);
    addPerson(g, -1.2, 0, 1.57, materials.cloth[4], materials.pants);
    addPerson(g, 1.5, 0.2, -1.57, materials.cloth[2], materials.pants);
    addGlowSprite(g, 0, 1.4, 0, 2.0, 0xffb36b, 0.22);
  }

  function buildWaterfront() {
    addBox(root, 260, 0.9, 10.2, materials.waterBed, 50, -1.35, -117, 0, false);
    var water = new THREE.Mesh(new THREE.PlaneGeometry(260, 10), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(50, -0.78, -117);
    root.add(water);
    var glint = new THREE.Mesh(new THREE.PlaneGeometry(259, 9.6), glintMats[1]);
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(50, -0.76, -117);
    root.add(glint);
    addBox(root, 260, 1.15, 0.7, materials.granite, 50, -0.18, -112.0, 0, false);
    addBox(root, 260, 1.15, 0.7, materials.granite, 50, -0.18, -122.0, 0, false);
    addBox(root, 260, 0.18, 1.0, materials.whiteStone, 50, 0.3, -111.9, 0, false);
    addBox(root, 260, 0.18, 1.0, materials.whiteStone, 50, 0.3, -122.1, 0, false);
    for (var cb = -60; cb <= 170; cb += 3.2) {
      addBox(root, 2.6, 0.8, 0.34, materials.granite, cb, -0.55, -111.6, 0, false);
      addBox(root, 2.6, 0.8, 0.34, materials.granite, cb + 1.2, -0.55, -122.4, 0, false);
    }
    addRailingX(root, -60, 170, -111.8, 0.35, materials.metal);
    addRailingX(root, -60, 170, -122.2, 0.35, materials.metal);
    // 月亮桥：拱桥 + 半环 + 水面月影
    var bridge = new THREE.Group();
    bridge.position.set(40, 0, -117);
    root.add(bridge);
    for (var i = 0; i < 11; i++) {
      var t = i / 10;
      var z = -5 + t * 10;
      var y = 0.1 + Math.sin(t * Math.PI) * 2.15;
      var seg = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.24, 1.2), materials.whiteStone);
      seg.position.set(0, y, z);
      seg.rotation.x = -Math.cos(t * Math.PI) * 0.36;
      seg.castShadow = true; seg.receiveShadow = true;
      bridge.add(seg);
      [-1.35, 1.35].forEach(function (x) {
        addBox(bridge, 0.14, 0.95, 0.14, materials.whiteStone, x, y + 0.5, z, 0, false);
      });
      if (i > 0) {
        addBeam(bridge, -1.35, y - 0.1, z, -1.35, y + 0.95, z, 0.045, materials.whiteStone, 4, false);
        addBeam(bridge, 1.35, y - 0.1, z, 1.35, y + 0.95, z, 0.045, materials.whiteStone, 4, false);
      }
      if (i > 0) {
        var tp = 0.1 + Math.sin((i - 1) / 10 * Math.PI) * 2.15;
        var tz = -5 + (i - 1) / 10 * 10;
        addBeam(bridge, -1.35, tp + 0.93, tz, -1.35, y + 0.93, z, 0.055, materials.whiteStone, 4, false);
        addBeam(bridge, 1.35, tp + 0.93, tz, 1.35, y + 0.93, z, 0.055, materials.whiteStone, 4, false);
      }
    }
    addBeam(bridge, -1.35, 0.12, -5, -1.35, 2.25, 0, 0.07, materials.whiteStone, 4, false);
    addBeam(bridge, 1.35, 0.12, -5, 1.35, 2.25, 0, 0.07, materials.whiteStone, 4, false);
    addBeam(bridge, -1.35, 2.25, 0, -1.35, 0.12, 5, 0.07, materials.whiteStone, 4, false);
    addBeam(bridge, 1.35, 2.25, 0, 1.35, 0.12, 5, 0.07, materials.whiteStone, 4, false);
    [-1.52, 1.52].forEach(function (x) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(5.7, 0.22, 8, 32, Math.PI), materials.whiteStone);
      ring.position.set(x, -3.55, 0);
      ring.rotation.y = Math.PI / 2;
      bridge.add(ring);
    });
    addGlowSprite(bridge, 0, 1.0, 0, 5.0, 0xffd39a, 0.25);
    var bridgeRef = new THREE.Mesh(new THREE.PlaneGeometry(15, 12), materials.reflectArc);
    bridgeRef.rotation.x = -Math.PI / 2;
    bridgeRef.rotation.z = Math.PI;
    bridgeRef.position.set(40, -0.735, -117);
    root.add(bridgeRef);
    var moonGlow = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), moonGlowMat);
    moonGlow.rotation.x = -Math.PI / 2;
    moonGlow.position.set(40, -0.75, -117);
    root.add(moonGlow);
    addPerson(bridge, 0, -2.2, 0, materials.cloth[1], materials.pants);
    addPerson(bridge, 0.5, 2.0, Math.PI, materials.cloth[3], materials.pants);
    // 永庆码头
    var dock = new THREE.Group();
    dock.position.set(7, 0, -115);
    root.add(dock);
    addBox(dock, 8, 0.4, 5, materials.granite, 0, 0.05, 0, 0, false);
    for (var s = 0; s < 4; s++) {
      addBox(dock, 6, 0.2, 0.9, materials.granite, 0, -0.12 - s * 0.2, -2.6 - s * 0.85, 0, false);
    }
    addBox(dock, 0.25, 1.2, 0.25, materials.darkWood, -3.4, 0.7, -2.0, 0, false);
    addBox(dock, 0.25, 1.2, 0.25, materials.darkWood, 3.4, 0.7, -2.0, 0, false);
    addLantern(dock, -3.2, 1.8, -2.0, 0.55, 0);
    addLantern(dock, 3.2, 1.8, -2.0, 0.55, 2);
    addSign(dock, YongqingfangTextures.makeSignTexture("永庆码头", 320, 90, "#e8c684", "#2b1b12", "#9f7b43"), 1.8, 0.5, 0, 2.2, -2.55, 0);
    addLantern(bridge, -1.9, 2.0, -5, 0.5, 0);
    addLantern(bridge, 1.9, 2.0, 5, 0.5, 2);
    buildBoat(8, -117);
    buildBoat(48, -118.6);
    [[-16, -106.5, 54, 4], [26, -106.5, 44, 4], [66, -123.4, 60, 4]].forEach(function (dr) {
      var dark = new THREE.Mesh(new THREE.PlaneGeometry(dr[2], dr[3]), materials.reflectDark);
      dark.rotation.x = -Math.PI / 2;
      dark.position.set(dr[0], -0.765, dr[1]);
      root.add(dark);
    });
    // 南岸低层店铺，给水岸一个街墙；中间留出永庆大街→永庆码头的通道
    buildRow(-70, -6, -104, true, { ry: Math.PI, d: 8, floors: 2, arcade: false, module: 16, signs: true });
    buildRow(6, 34, -104, true, { ry: Math.PI, d: 8, floors: 2, arcade: false, module: 16, signs: true });
    buildRow(110, 160, -104, true, { ry: Math.PI, d: 8, floors: 2, arcade: false, module: 16, signs: true });
    // 北岸多宝坊街墙，给月亮桥/水岸一个背景
    buildRow(-10, 90, -132, true, { ry: 0, d: 8, floors: 2, arcade: false, module: 16, signs: true });
    [[-4, -117], [72, -117], [40, -120.5]].forEach(function (g) {
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(g[0] === 40 ? 16 : 8, g[0] === 40 ? 10 : 6), moonGlowMat);
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(g[0], -0.72, g[1]);
      root.add(gl);
    });
    // 两岸树/石栏/灯
    addTree(-18, -110.5, 0.95, "banyan");
    addTree(18, -123, 0.85, "banyan");
    addTree(56, -110.5, 1.0, "banyan");
    addTree(96, -123, 0.9, "banyan");
    addTree(132, -110.5, 0.8, "banyan");
    addTree(28, -110.8, 0.7, "round");
    addTree(-2, -107.2, 0.74, "round");
    addTree(88, -107.5, 0.72, "round");
    addTree(101, -107.2, 0.68, "round");
    for (var l = 0; l < 8; l++) {
      addLantern(root, -28 + l * 22, 2.5, l % 2 ? -123.0 : -111.2, 0.65, l % 3 === 0 ? 2 : 0);
    }
    addPerson(root, 30, -110.4, 2.4, materials.cloth[0], materials.pants);
    addPerson(root, 44, -123.2, 0.6, materials.cloth[2], materials.pants);
    addPerson(root, 60, -111.0, -1.2, materials.cloth[4], materials.pants);
    addBike(root, 34, -110.6, 0.15);
    // 北岸多宝坊广场
    addBox(root, 60, 0.5, 0.6, materials.plaster, 30, 0.25, -129, 0, false);
    addBox(root, 60, 0.2, 1.0, materials.roofDark, 30, 0.55, -129, 0, false);
    addSign(root, YongqingfangTextures.makeSignTexture("多宝坊", 280, 90, "#3d3328", "#e7dfcc", "#a99778"), 1.6, 0.45, 30, 2.2, -129.0, 0);
    addTree(14, -126, 0.75, "round");
    addTree(44, -126, 0.8, "round");
  }

  /* ---------------- 古树广场 / 微改造 ---------------- */

  function buildOldTreePlaza() {
    var big = addTree(28, -27, 0.98, "banyan", true);
    addBox(root, 5.2, 0.5, 5.2, materials.granite, 28, 0.3, -27, 0, false);
    addBox(root, 4.6, 0.18, 4.6, materials.wood, 28, 0.58, -27, 0, false);
    [-2.4, 2.4].forEach(function (dx) {
      [-2.4, 2.4].forEach(function (dz) {
        addBox(root, 0.2, 0.6, 0.2, materials.wood, 28 + dx, 0.9, -27 + dz, 0, false);
      });
    });
    // 东侧微改造：钢/玻璃/红砖 + 台阶 + 屋顶招牌
    var micro = new THREE.Group();
    micro.position.set(33.2, 0, -27);
    root.add(micro);
    addBox(micro, 4.2, 8.6, 10, materials.brickRed, 0, 4.3, -1.0, 0, true);
    addBox(micro, 3.0, 8.2, 9.0, materials.glass, -1.8, 4.1, -1.0, 0, false);
    for (var i = 0; i < 4; i++) {
      addBox(micro, 0.16, 8.6, 0.16, materials.steel, -3.2, 4.3, -5 + i * 2.6, 0, false);
    }
    for (var f = 0; f < 3; f++) {
      addBox(micro, 3.4, 0.16, 9.2, materials.steel, -1.8, 1.2 + f * 2.7, -1.0, 0, false);
    }
    var microShop = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.2), shopfrontMaterial(textures.shopfronts[1]));
    microShop.rotation.y = -Math.PI / 2;
    microShop.position.set(-3.26, 2.35, -0.8);
    micro.add(microShop);
    addSign(micro, textures.signs.dayi, 2.7, 0.66, -3.28, 4.9, -0.8, -Math.PI / 2);
    addSign(micro, textures.signs.yongqingfang, 3.8, 0.85, -1.4, 9.0, 3.0, 0);
    addBox(micro, 4.4, 0.14, 1.2, materials.steel, -3.5, 4.3, -0.8, 0, false);
    for (var s = 0; s < 4; s++) {
      addBox(micro, 4.0 - s * 0.3, 0.18, 0.8, materials.granite, -3.9, 0.12 + s * 0.18, 4.8 + s * 0.7, 0, false);
    }
    addLantern(micro, -3.0, 2.7, 2.0, 0.6, 2);
    addLantern(micro, -3.0, 2.7, -2.0, 0.6, 0);
    addBeam(root, 17.5, 4.55, -23.5, 36, 4.55, -23.5, 0.016, materials.darkWood, 4, false);
    [19.5, 23, 26.5, 30, 33.5].forEach(function (lx, i) {
      addLantern(root, lx, 4.05, -23.5, 0.55, i % 2 ? 2 : 0);
    });
    // 广场周边店铺：北侧一排、临恩宁路一排、东侧微改造
    buildRow(16, 36, -36, true, { d: 8, floors: 2, arcade: false, module: 10, gable: false, signs: true });
    buildRow(16, 36, -9, true, { d: 5, floors: 2, arcade: false, module: 10, gable: false, signs: true });
    addSign(root, YongqingfangTextures.makeSignTexture("古树广场", 320, 90, "#e8c684", "#2b1b12", "#9f7b43"), 1.7, 0.48, 26, 2.5, -35.4, 0);
    addPerson(root, 21.5, -22.5, 0.6, materials.cloth[1], materials.pants);
    addPerson(root, 30.5, -18.0, -1.1, materials.cloth[2], materials.pants);
    addPerson(root, 24.0, -31.5, 2.4, materials.cloth[4], materials.pants);
    addBike(root, 18.5, -18.5, 0.8);
    addBike(root, 31.0, -33.0, -1.6);
    addBox(root, 2.4, 0.42, 0.5, materials.granite, 22.4, 0.21, -25.8, 0, false);
  }

  /* ---------------- 树 ---------------- */

  function addTree(x, z, s, kind, big) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    var trunkH = 4.8 * s;
    addCyl(g, 0.32 * s, 0.5 * s, trunkH, 8, materials.trunk, 0, trunkH / 2, 0, true);
    var branches = kind === "banyan" ? 5 : 3;
    for (var b = 0; b < branches; b++) {
      var a = (b / branches) * Math.PI * 2 + rnd();
      var len = 2.2 * s + rnd() * 1.8 * s;
      addBeam(g, 0, trunkH * 0.72, 0, Math.cos(a) * len, trunkH + 0.8 * s, Math.sin(a) * len, 0.14 * s, materials.trunk, 5, true);
    }
    var blobs = lowMode ? 4 : (kind === "banyan" ? 7 : 5);
    for (var i = 0; i < blobs; i++) {
      var ang = (i / blobs) * Math.PI * 2 + rnd();
      var rad = (big ? 3.4 : 2.2) * s * (0.5 + rnd() * 0.6);
      var canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), i % 3 === 0 ? materials.leafDark : materials.leaf);
      canopy.position.set(Math.cos(ang) * rad, trunkH + 1.2 * s + rnd() * 1.8 * s, Math.sin(ang) * rad);
      var cs = (big ? 4.2 : 2.7) * s * (0.75 + rnd() * 0.45);
      canopy.scale.set(cs, cs * 0.72, cs);
      canopy.rotation.set(rnd(), rnd() * 6.3, rnd());
      canopy.castShadow = true; canopy.receiveShadow = true;
      g.add(canopy);
    }
    if (kind === "banyan") {
      var roots = lowMode ? 3 : 6;
      for (var r = 0; r < roots; r++) {
        var ra = (r / roots) * Math.PI * 2 + rnd();
        var rr = 1.2 * s + rnd() * 1.8 * s;
        addBeam(g, Math.cos(ra) * rr, trunkH * 0.8, Math.sin(ra) * rr, Math.cos(ra) * (rr + 0.4), 0, Math.sin(ra) * (rr + 0.4), 0.035 * s, materials.trunk, 4, false);
      }
    }
    return g;
  }

  /* ---------------- 远景 ---------------- */

  function buildBackdrop() {
    var count = lowMode ? 45 : 95;
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var inst = new THREE.InstancedMesh(geo, materials.city, count);
    var dummy = new THREE.Object3D();
    var n = 0, guard = 0;
    while (n < count && guard < count * 12) {
      guard++;
      var x = -260 + rnd() * 560;
      var z = -220 + rnd() * 340;
      if (x > -120 && x < 225 && z > -175 && z < 55) continue;
      if (z > -175 && z < -55 && x > -80 && x < 190) continue;
      var w = 8 + rnd() * 22;
      var d = 8 + rnd() * 22;
      var h = 6 + Math.pow(rnd(), 1.7) * 14;
      dummy.position.set(x, h / 2 - 0.2, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      n++;
    }
    inst.count = n;
    inst.castShadow = false; inst.receiveShadow = true;
    root.add(inst);
    // 东西两端低层老城边界，避免出现 CBD 式高楼
    addBox(root, 16, 16, 18, materials.brickGrey, 230, 8, -40, 0, false);
    addBox(root, 12, 14, 16, materials.brickRed, -132, 7, -40, 0, false);
    addBox(root, 18, 15, 14, materials.brickGrey, 232, 7.5, 26, 0, false);
    // 远处树：只放在核心街区之外，避免随机落进门楼/晚沙湖画面
    for (var t = 0; t < (lowMode ? 6 : 12); t++) {
      var tx, tz, tguard = 0;
      do {
        tx = -180 + rnd() * 380;
        tz = -170 + rnd() * 200;
        tguard++;
      } while (tguard < 24 && tx > -125 && tx < 230 && tz > -180 && tz < 45);
      addTree(tx, tz, 0.55 + rnd() * 0.4, "round");
    }
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "gate", craft: "gate", no: "01", name: "门楼",
        pos: new THREE.Vector3(0, 4.1, -9),
        view: { pos: new THREE.Vector3(0, 5.2, 7.5), target: new THREE.Vector3(0, 4.4, -9) },
        lede: "恩宁路 97/99 号之间的灰石门楼，上挂“永庆坊”铜匾，门洞内是永庆大街；门楼也是“广东粤剧銮舆堂”的入口。",
        facts: [["门牌", "恩宁路 97/99"], ["门楼", "约 8 m 宽"], ["匾额", "永庆坊"]],
        detail: "门楼按现场照片做灰石/砖门楼示意；石狮、灯笼、麻石铺地为近景细节。门楼后的主巷约 4–6 m 宽，两侧是青砖/红砖/灰砖混合的 2–4 层民居。"
      },
      {
        id: "lee", craft: "lee", no: "02", name: "李小龙祖居",
        pos: new THREE.Vector3(13, 4.0, -47),
        view: { pos: new THREE.Vector3(13, 3.2, -40), target: new THREE.Vector3(13, 3.5, -47) },
        lede: "永庆一巷 13 号，李小龙父亲、粤剧“四大名丑”之一李海泉于 20 世纪 40 年代所建；西关大屋式，一正一偏、三进、两层。",
        facts: [["门牌", "永庆一巷 13"], ["面宽×进深", "8.5 × 19 m"], ["开放", "2019-03 特展"]],
        detail: "祖居占地 161.5 ㎡（另有 207/400 ㎡ 口径），青砖石脚、花岗石门夹、雕花大梁、彩色玻璃屏风。本场景做外观 + 门厅/天井，不做二楼完整展陈。"
      },
      {
        id: "guangfu", craft: "guangfu", no: "03", name: "广福台",
        pos: new THREE.Vector3(58, 4.4, -68),
        view: { pos: new THREE.Vector3(86, 4.2, -80), target: new THREE.Vector3(60, 3.4, -62) },
        lede: "粤剧艺术博物馆南岸园林里的临水戏台，重檐歇山抬梁式木构（资料口径）；台口朝向晚沙湖，隔水看戏是这里最典型的画面。",
        facts: [["位置", "粤博南岸"], ["形制", "重檐歇山"], ["水面", "晚沙湖"]],
        detail: "广福台按“深色木构、重檐、临水”做示意；紫铜瓦、砖雕《六国大封相》为游记/展陈口径，场景不逐字复刻。粤博只做南岸外观 + 园林，不做展厅/剧场内部。"
      },
      {
        id: "moon", craft: "moon", no: "04", name: "月亮桥",
        pos: new THREE.Vector3(40, 2.2, -117),
        view: { pos: new THREE.Vector3(64, 2.8, -124), target: new THREE.Vector3(34, 1.6, -117) },
        lede: "正式名“叠月桥”，横跨荔枝湾涌；桥拱与水面倒影合成“满月”，近看是弯月、走远看是圆月。",
        facts: [["正式名", "叠月桥"], ["跨度", "约 16 m"], ["位置", "粤博西/北侧"]],
        detail: "月亮桥位置有粤博西门/北门/南门口径差异，场景放在粤博西/北侧、连接多宝坊广场与粤博；夜景灯光为照明示意。荔枝湾涌水面宽约 8–12 m，画舫/永庆码头为水岸节点。"
      },
      {
        id: "bahe", craft: "bahe", no: "05", name: "八和会馆",
        pos: new THREE.Vector3(118, 4.2, -9),
        view: { pos: new THREE.Vector3(112, 3.2, 6), target: new THREE.Vector3(118, 4.2, -9) },
        lede: "恩宁路 177 号，粤剧艺人的行会“母会”；1889 年创建于黄沙，1937/1938 年旧馆被炸毁，1946 年决定恢复、翌年迁入现址。",
        facts: [["门牌", "恩宁路 177"], ["创建", "1889 黄沙"], ["迁入", "1946–47"]],
        detail: "八和会馆下设兆和、庆和、福和、新和、永和、德和、慎和、普和八堂；现址青砖墙、木匾、木趟栊，仍是粤剧活动场所。本场景只做外观 + 门厅一瞥，不做内部八堂。"
      },
      {
        id: "arcade", craft: "arcade", no: "06", name: "恩宁路骑楼",
        pos: new THREE.Vector3(95, 3.4, 8.2),
        view: { pos: new THREE.Vector3(54, 2.4, 3.0), target: new THREE.Vector3(140, 4.2, 8.2) },
        lede: "恩宁路 1931 年建成，全长 1115 m、宽约 18 m（资料口径）；骑楼廊道约 3 m 宽、净高 4–6 m，青砖/满洲窗/巴洛克山花连成一线。",
        facts: [["全长", "1115 m"], ["廊道", "约 3 m"], ["净高", "4–6 m"]],
        detail: "骑楼为柱廊式、钢筋混凝土框架、连续拱券；底层商铺挑高约 4 m，二层以上住宅保留趟栊门、青砖外墙。本场景做核心段 99–177，金声电影院只做东端牌楼剪影。"
      },
      {
        id: "tree", craft: "tree", no: "07", name: "古树广场",
        pos: new THREE.Vector3(28, 2.6, -27),
        view: { pos: new THREE.Vector3(14, 3.2, -14), target: new THREE.Vector3(30, 2.5, -30) },
        lede: "永庆坊二期的一处口袋广场：大冠幅古树 + 树池坐凳，东侧是钢/玻璃/红砖并置的微改造立面。",
        facts: [["位置", "永庆坊二期"], ["树冠", "约 12–15 m"], ["做法", "树池 + 钢玻璃"]],
        detail: "古树广场的树种未确认，场景按大冠幅榕/樟类形态示意；树池、台阶、粉色灯笼和“永庆坊”屋顶招牌来自现场照片。微改造不是“做旧”，而是钢/玻璃/旧砖直接并置。"
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

  /* ---------------- 组装 ---------------- */

  function build(opts) {
    textures = opts.textures;
    lowMode = !!opts.low;
    R = mulberry32(20261031);
    root = new THREE.Group();
    root.name = "yongqingfang-enning";
    materials = makeMaterials();
    materials.yellowLine = new THREE.MeshStandardMaterial({ color: 0xd2ab4b, roughness: 0.8 });
    materials.whiteLine = new THREE.MeshStandardMaterial({ color: 0xd8d4c6, roughness: 0.85 });
    materials.canvas = new THREE.MeshStandardMaterial({ color: 0x6e4432, roughness: 0.85 });
    materials.awning = new THREE.MeshStandardMaterial({ color: 0x6d3b2c, roughness: 0.85 });
    materials.terracotta = new THREE.MeshStandardMaterial({ color: 0x8d5b42, roughness: 0.9 });
    materials.redFloor = new THREE.MeshStandardMaterial({ color: 0x6e3a2d, roughness: 0.8 });
    materials.lakeBed = new THREE.MeshStandardMaterial({ color: 0x263a35, roughness: 0.9 });
    materials.waterBed = new THREE.MeshStandardMaterial({ color: 0x1f332f, roughness: 0.9 });
    waterMat = new THREE.MeshStandardMaterial({
      map: textures.water.clone(), color: 0xb2c6cc, roughness: 0.1, metalness: 0.2,
      emissive: 0x1a3b3d, emissiveIntensity: 0.16
    });
    waterMat.map.repeat.set(52, 2);
    waterMat.map.needsUpdate = true;
    lakeMat = new THREE.MeshStandardMaterial({
      map: textures.water.clone(), color: 0xafc4c9, roughness: 0.08, metalness: 0.24,
      emissive: 0x1a3b3d, emissiveIntensity: 0.18
    });
    lakeMat.map.repeat.set(6, 5);
    lakeMat.map.needsUpdate = true;
    moonGlowMat = new THREE.MeshBasicMaterial({
      map: textures.glow, color: 0xffd39a, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var lakeGlint = materials.waterGlint.clone();
    lakeGlint.map = textures.waterGlint.clone();
    lakeGlint.map.repeat.set(10, 9);
    lakeGlint.map.needsUpdate = true;
    var riverGlint = materials.waterGlint.clone();
    riverGlint.map = textures.waterGlint.clone();
    riverGlint.map.repeat.set(44, 2);
    riverGlint.map.needsUpdate = true;
    glintMats = [lakeGlint, riverGlint];
    reflectArcMat = materials.reflectArc;

    buildGround();
    buildGate();
    buildLaneBuildings();
    buildBruceLee();
    buildLuanyu();
    buildBahe();
    buildEnningArcade();
    buildMuseum();
    buildWaterfront();
    buildOldTreePlaza();
    buildBackdrop();

    // 点光源：只给关键节点
    var lightDefs = [
      [0, 4.6, -9, 22, 1.4],
      [0, 3.8, -32, 18, 1.1],
      [58, 4.5, -68, 26, 1.5],
      [40, 2.2, -117, 24, 1.4],
      [118, 3.8, -9, 20, 1.2],
      [28, 4.8, -27, 20, 1.1],
      [72, 3.0, -72, 28, 1.0]
    ];
    lightDefs.forEach(function (d) {
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
      waterMat: waterMat,
      lakeMat: lakeMat,
      moonGlowMat: moonGlowMat,
      glintMats: glintMats,
      reflectArcMat: reflectArcMat,
      cityMats: cityMats,
      bounds: new THREE.Box3(new THREE.Vector3(-120, -4, -145), new THREE.Vector3(220, 40, 30))
    };
  }

  window.YongqingfangModel = { build: build };
})();
