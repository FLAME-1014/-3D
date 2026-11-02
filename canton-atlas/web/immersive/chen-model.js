/* 陈家祠近景 · 1:1 主体建模
   坐标：1 单位 = 1 米；南为 +Z，北为 -Z；主体 80 × 80 m。
   依据公开测绘：头门 27 × 12.75、聚贤堂 27.84 × 16.7、后座 27 × 16.4。
   屋脊、砖雕、门神等按公开题材重绘，细节为演示级复原。 */
(function () {
  "use strict";

  var LOW = false;
  var rand = null;
  var materials = null;
  var textures = null;
  var root = null;
  var hotspots = [];
  var lanternMats = [];
  var windowMats = [];
  var flickerLights = [];

  function rng(seed) {
    var s = seed || 1;
    return function () {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function srgb(hex) {
    return new THREE.Color(hex).convertSRGBToLinear();
  }

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

  function addPlane(parent, w, h, mat, x, y, z, rotY) {
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    if (rotY) mesh.rotation.y = rotY;
    parent.add(mesh);
    return mesh;
  }

  function makeMaterials(tex) {
    var brickMap = tex.brick;
    var roofMap = tex.roof;
    var graniteMap = tex.granite;
    var woodMap = tex.wood;
    var plasterMap = tex.plaster;

    var m = {};
    m.brick = new THREE.MeshStandardMaterial({
      map: brickMap, bumpMap: tex.brickBump, bumpScale: 0.06,
      roughness: 0.95, metalness: 0.01, color: srgb(0xd2d6ce)
    });
    m.brickWarm = new THREE.MeshStandardMaterial({
      map: brickMap, bumpMap: tex.brickBump, bumpScale: 0.06,
      roughness: 0.95, metalness: 0.01, color: srgb(0xbdb6a6)
    });
    m.roof = new THREE.MeshStandardMaterial({
      map: roofMap, bumpMap: tex.roofBump, bumpScale: 0.1,
      roughness: 0.9, metalness: 0.03, color: srgb(0xb5b5b1)
    });
    m.roofDark = new THREE.MeshStandardMaterial({
      map: roofMap, bumpMap: tex.roofBump, bumpScale: 0.1,
      roughness: 0.93, metalness: 0.03, color: srgb(0x8c8c88)
    });
    m.granite = new THREE.MeshStandardMaterial({
      map: graniteMap, bumpMap: tex.graniteBump, bumpScale: 0.04,
      roughness: 0.9, metalness: 0.02, color: srgb(0xc5bfaf)
    });
    m.graniteDark = new THREE.MeshStandardMaterial({
      map: graniteMap, bumpMap: tex.graniteBump, bumpScale: 0.04,
      roughness: 0.92, metalness: 0.02, color: srgb(0x979387)
    });
    m.wood = new THREE.MeshStandardMaterial({
      map: woodMap, roughness: 0.66, metalness: 0.04, color: srgb(0xc7a883)
    });
    m.woodDark = new THREE.MeshStandardMaterial({
      map: woodMap, roughness: 0.7, metalness: 0.05, color: srgb(0x8a6444)
    });
    m.plaster = new THREE.MeshStandardMaterial({
      map: plasterMap, bumpMap: tex.plasterBump, bumpScale: 0.03,
      roughness: 0.96, metalness: 0.01, color: srgb(0xd7d2c4)
    });
    m.ridgeBand = new THREE.MeshStandardMaterial({
      map: tex.ridge, roughness: 0.52, metalness: 0.1, color: srgb(0xb2baae)
    });
    m.ridgeBase = new THREE.MeshStandardMaterial({
      map: plasterMap, bumpMap: tex.plasterBump, bumpScale: 0.03,
      roughness: 0.9, color: srgb(0xa49e8f)
    });
    m.iron = new THREE.MeshStandardMaterial({
      map: tex.iron, roughness: 0.62, metalness: 0.62, color: srgb(0xbfc3b8)
    });
    m.gold = new THREE.MeshStandardMaterial({
      color: srgb(0xb98b48), roughness: 0.38, metalness: 0.62
    });
    m.goldDark = new THREE.MeshStandardMaterial({
      color: srgb(0x7d5a2c), roughness: 0.5, metalness: 0.5
    });
    m.lacquer = new THREE.MeshStandardMaterial({
      color: srgb(0x0b0a09), roughness: 0.3, metalness: 0.22
    });
    m.dark = new THREE.MeshStandardMaterial({
      color: srgb(0x241c15), roughness: 0.86, metalness: 0.03
    });
    m.interior = new THREE.MeshStandardMaterial({
      color: srgb(0x1b1410), roughness: 0.9, metalness: 0.02
    });
    m.hallFloor = new THREE.MeshStandardMaterial({
      map: graniteMap, bumpMap: tex.graniteBump, bumpScale: 0.03,
      roughness: 0.92, metalness: 0.02, color: srgb(0x6e695d)
    });
    m.ceiling = new THREE.MeshStandardMaterial({
      color: srgb(0x2b2018), roughness: 0.95, metalness: 0.02
    });
    m.oldWall = new THREE.MeshStandardMaterial({
      map: brickMap, bumpMap: tex.brickBump, bumpScale: 0.04,
      roughness: 0.96, metalness: 0.01, color: srgb(0x6f6a5e)
    });
    m.soil = new THREE.MeshStandardMaterial({
      color: srgb(0x2f2a22), roughness: 1, metalness: 0
    });
    m.leaf = [
      new THREE.MeshStandardMaterial({ color: srgb(0x1c3523), roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: srgb(0x25472c), roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: srgb(0x152b1c), roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: srgb(0x30553a), roughness: 0.92 })
    ];
    m.trunk = new THREE.MeshStandardMaterial({ color: srgb(0x3a2c21), roughness: 0.98 });
    m.carving = tex.carvings.map(function (t) {
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0.02 });
    });
    m.screen = new THREE.MeshStandardMaterial({
      map: tex.screen, roughness: 0.58, metalness: 0.06,
      color: srgb(0xc7a883)
    });
    m.doorGod = tex.doorGods.map(function (t) {
      return new THREE.MeshStandardMaterial({
        map: t, roughness: 0.54, metalness: 0.04,
        emissive: srgb(0x2a140b), emissiveIntensity: 0.85
      });
    });
    m.plaque = new THREE.MeshBasicMaterial({ map: tex.plaque });
    m.couplets = tex.couplets.map(function (t) {
      return new THREE.MeshStandardMaterial({
        map: t, roughness: 0.6, metalness: 0.05,
        emissive: srgb(0x3a2410), emissiveIntensity: 0.7
      });
    });
    m.window = new THREE.MeshStandardMaterial({
      map: tex.window, roughness: 0.4, metalness: 0.1,
      emissive: srgb(0x0b1a19), emissiveIntensity: 0.5
    });
    m.cloud = new THREE.MeshBasicMaterial({
      map: tex.cloud, transparent: true, opacity: 0.32, depthWrite: false
    });
    return m;
  }

  /* ---------------- 屋顶 ---------------- */

  function gableRoof(parent, opt) {
    var group = new THREE.Group();
    group.position.set(opt.x, 0, opt.z);
    parent.add(group);

    var w = opt.w;
    var d = opt.d;
    var eaveY = opt.eaveY;
    var ridgeY = opt.ridgeY;
    var ov = opt.overhang === undefined ? 1.15 : opt.overhang;
    var thick = 0.24;
    var D = d / 2 + ov;
    var rise = ridgeY - eaveY;
    var slopeLen = Math.sqrt(D * D + rise * rise);
    var angle = Math.atan2(rise, D);
    var roofMat = opt.dark ? materials.roofDark : materials.roof;
    var uvX = w / 2.2;
    var uvY = slopeLen / 2.2;

    var southGeo = new THREE.BoxGeometry(w + ov * 1.6, thick, slopeLen);
    scaleUV(southGeo, uvX, uvY);
    var south = new THREE.Mesh(southGeo, roofMat);
    south.position.set(0, (eaveY + ridgeY) / 2 + thick * 0.35, D / 2);
    south.rotation.x = angle;
    south.castShadow = true;
    south.receiveShadow = true;
    group.add(south);

    var northGeo = new THREE.BoxGeometry(w + ov * 1.6, thick, slopeLen);
    scaleUV(northGeo, uvX, uvY);
    var north = new THREE.Mesh(northGeo, roofMat);
    north.position.set(0, (eaveY + ridgeY) / 2 + thick * 0.35, -D / 2);
    north.rotation.x = -angle;
    north.castShadow = true;
    north.receiveShadow = true;
    group.add(north);

    /* 檐口与椽子 */
    var eaveMat = materials.woodDark;
    [-1, 1].forEach(function (side) {
      addBox(group, w + ov * 1.6, 0.16, 0.65, eaveMat, 0, eaveY - 0.02, side * (d / 2 + ov - 0.2), [1, 1], false);
      var rafterCount = Math.max(4, Math.round(w / 1.1));
      for (var i = 0; i < rafterCount; i++) {
        var rx = -w / 2 + (i + 0.5) * (w / rafterCount);
        addBox(group, 0.11, 0.13, 1.15, eaveMat, rx, eaveY - 0.14, side * (d / 2 + ov - 0.1), null, false);
      }
    });

    /* 山墙 */
    if (opt.gable !== false) {
      var shape = new THREE.Shape();
      shape.moveTo(-d / 2 + 0.15, eaveY - 0.35);
      shape.lineTo(d / 2 - 0.15, eaveY - 0.35);
      shape.lineTo(0, ridgeY - 0.1);
      shape.closePath();
      var gableGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.48, bevelEnabled: false });
      [-1, 1].forEach(function (side) {
        var gable = new THREE.Mesh(gableGeo, materials.brick);
        gable.rotation.y = Math.PI / 2;
        gable.position.set(side > 0 ? w / 2 - 0.24 : -w / 2 - 0.24, 0, 0);
        gable.castShadow = true;
        gable.receiveShadow = true;
        group.add(gable);

        /* 灰塑包边 */
        var trimS = addBox(group, 0.3, 0.32, slopeLen, materials.plaster, side * (w / 2 + 0.03), (eaveY + ridgeY) / 2 + 0.14, D / 2, [1, slopeLen / 2]);
        trimS.rotation.x = angle;
        var trimN = addBox(group, 0.3, 0.32, slopeLen, materials.plaster, side * (w / 2 + 0.03), (eaveY + ridgeY) / 2 + 0.14, -D / 2, [1, slopeLen / 2]);
        trimN.rotation.x = -angle;

        /* 翘起的檐角 */
        var tip = addBox(group, 0.34, 0.22, 1.1, materials.plaster, side * (w / 2 + 0.1), eaveY + 0.52, d / 2 + ov - 0.2, null, false);
        tip.rotation.x = -0.45;
        var tip2 = addBox(group, 0.34, 0.22, 1.1, materials.plaster, side * (w / 2 + 0.1), eaveY + 0.52, -(d / 2 + ov - 0.2), null, false);
        tip2.rotation.x = 0.45;
      });
    }

    /* 正脊基座 */
    addBox(group, w + ov * 1.2, 0.42, 0.72, materials.ridgeBase, 0, ridgeY + 0.1, 0, [1, 1]);
    addBox(group, w + ov * 1.2, 0.16, 0.86, materials.plaster, 0, ridgeY + 0.38, 0, [1, 1]);

    if (opt.ridge !== false) {
      ceramicRidge(group, 0, 0, ridgeY + 0.46, opt.ridgeLength || w, 0.9, opt.figures || 26, opt.ridgeScale || 0.7, !!opt.important);
    }

    return group;
  }

  /* ---------------- 陶塑瓦脊 ---------------- */

  function ceramicRidge(parent, x, z, y, length, depth, figureCount, scale, important) {
    var group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);

    var bandH = important ? 1.55 : 0.52 * scale;
    var baseH = important ? 0.7 : 0.26;
    var d = depth * (important ? 1.08 : 1);

    addBox(group, length, baseH, d + 0.42, materials.ridgeBase, 0, baseH / 2, 0, [length / 2, 1]);
    addBox(group, length, 0.12, d + 0.6, materials.plaster, 0, baseH + 0.02, 0, [length / 2, 1], false);

    var bandGeo = new THREE.BoxGeometry(length, bandH, d);
    scaleUV(bandGeo, Math.max(1, length / 6.2), 1);
    var band = new THREE.Mesh(bandGeo, materials.ridgeBand);
    band.position.set(0, baseH + bandH / 2, 0);
    band.castShadow = true;
    group.add(band);

    addBox(group, length, 0.14, d * 1.02, materials.goldDark, 0, baseH + bandH + 0.06, 0, [length / 2, 1], false);
    var top = baseH + bandH + 0.14;

    var count = LOW ? Math.floor(figureCount * 0.48) : figureCount;
    var bodyGeo = new THREE.CylinderGeometry(0.075, 0.22, 0.64, 5);
    bodyGeo.translate(0, 0.32, 0);
    var headGeo = new THREE.SphereGeometry(0.105, 6, 5);
    headGeo.translate(0, 0.75, 0);
    var hatGeo = new THREE.ConeGeometry(0.13, 0.16, 5);
    hatGeo.translate(0, 0.88, 0);

    var figureMat = new THREE.MeshStandardMaterial({
      roughness: 0.38, metalness: 0.16, color: 0xffffff
    });
    var bodies = new THREE.InstancedMesh(bodyGeo, figureMat, count);
    var heads = new THREE.InstancedMesh(headGeo, figureMat, count);
    var hats = new THREE.InstancedMesh(hatGeo, figureMat, count);
    bodies.castShadow = false;
    heads.castShadow = false;
    hats.castShadow = false;

    var robes = [0x8a2a1e, 0xa8601e, 0x143f36, 0x244a63, 0x5e211c, 0x4b365b, 0x8a6b2e, 0x35604f];
    var hatsC = [0xb08a3e, 0x7d2a1e, 0x194338, 0x223f55, 0x8a6b2e];
    var dummy = new THREE.Object3D();
    var r = rng(important ? 279 : 189);
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0.5 : i / (count - 1);
      var px = -length / 2 + 0.35 + t * (length - 0.7) + (r() - 0.5) * 0.14;
      var row = i % 3;
      var pz = row === 0 ? -0.26 : (row === 1 ? 0.24 : 0.02);
      var s = (important ? 0.64 : 0.56) * (0.86 + r() * 0.35);
      if (important && Math.abs(px) < 2.2) s *= 1.08;
      dummy.position.set(px, top + (row === 1 ? 0.05 : 0), pz);
      dummy.rotation.set((r() - 0.5) * 0.16, r() * Math.PI * 2, (r() - 0.5) * 0.16);
      dummy.scale.set(s, s * (0.92 + r() * 0.22), s);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      heads.setMatrixAt(i, dummy.matrix);
      hats.setMatrixAt(i, dummy.matrix);
      bodies.setColorAt(i, srgb(robes[Math.floor(r() * robes.length)]));
      heads.setColorAt(i, srgb(0xa97f5a));
      hats.setColorAt(i, srgb(hatsC[Math.floor(r() * hatsC.length)]));
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    hats.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    if (hats.instanceColor) hats.instanceColor.needsUpdate = true;
    group.add(bodies);
    group.add(heads);
    group.add(hats);

    /* 小旗与凉伞，增加戏台感 */
    var flagGeo = new THREE.PlaneGeometry(0.34, 0.46);
    var flagMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.55, metalness: 0.04 });
    var flagCount = important ? 28 : 8;
    var flags = new THREE.InstancedMesh(flagGeo, flagMat, flagCount);
    var flagCols = [0xa83726, 0xd7b76a, 0x1d5a4b, 0x2f5d7a];
    var fb = new THREE.Object3D();
    for (var f = 0; f < flagCount; f++) {
      fb.position.set(-length / 2 + 1.2 + f * ((length - 2.4) / Math.max(1, flagCount - 1)), top + 0.5, 0.42);
      fb.rotation.set(0, r() * 0.7 - 0.35, 0.18);
      fb.updateMatrix();
      flags.setMatrixAt(f, fb.matrix);
      flags.setColorAt(f, srgb(flagCols[f % flagCols.length]));
    }
    flags.instanceMatrix.needsUpdate = true;
    if (flags.instanceColor) flags.instanceColor.needsUpdate = true;
    group.add(flags);

    /* 骑马人物：让整条脊读成一台戏 */
    if (important) {
      var horseMat = new THREE.MeshStandardMaterial({ color: srgb(0x6b4a2f), roughness: 0.5, metalness: 0.08 });
      var saddleMat = new THREE.MeshStandardMaterial({ color: srgb(0x7d2a1e), roughness: 0.5, metalness: 0.12 });
      [-10.5, -4.2, 4.8, 11.2].forEach(function (hx) {
        var hg = new THREE.Group();
        hg.position.set(hx, top + 0.02, 0.36);
        hg.rotation.y = 0.08;
        hg.scale.setScalar(0.76);
        group.add(hg);
        var hb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), horseMat);
        hb.scale.set(1.6, 0.8, 0.72);
        hb.position.set(0, 0.56, 0);
        hg.add(hb);
        var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 5), horseMat);
        neck.position.set(0.34, 0.86, 0);
        neck.rotation.z = -0.45;
        hg.add(neck);
        var hh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), horseMat);
        hh.scale.set(1.15, 0.85, 0.85);
        hh.position.set(0.52, 1.05, 0);
        hg.add(hh);
        [-0.15, 0.15].forEach(function (ear) {
          var e = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), horseMat);
          e.position.set(0.4, 1.22, ear);
          hg.add(e);
        });
        [-0.26, 0.26].forEach(function (lz) {
          [-0.24, 0.24].forEach(function (lx) {
            var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 4), horseMat);
            leg.position.set(lx, 0.26, lz);
            hg.add(leg);
          });
        });
        var tail2 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 4), horseMat);
        tail2.position.set(-0.52, 0.6, 0);
        tail2.rotation.z = 0.7;
        hg.add(tail2);
        var saddle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.24), saddleMat);
        saddle.position.set(-0.02, 0.82, 0);
        hg.add(saddle);
        var rider = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.42, 5), new THREE.MeshStandardMaterial({ color: 0x244a63, roughness: 0.45 }));
        rider.position.set(-0.02, 1.02, 0);
        hg.add(rider);
        var rh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), new THREE.MeshStandardMaterial({ color: 0xa97f5a, roughness: 0.5 }));
        rh.position.set(-0.02, 1.28, 0);
        hg.add(rh);
        var rflag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), new THREE.MeshStandardMaterial({ color: 0x8a2a1e, side: THREE.DoubleSide, roughness: 0.5 }));
        rflag.position.set(-0.16, 1.4, 0.1);
        rflag.rotation.y = 0.4;
        hg.add(rflag);
      });
    }

    /* 彩亭与脊上小树 */
    if (important) {
      var treeLeafMat = new THREE.MeshStandardMaterial({ color: srgb(0x24482c), roughness: 0.7, metalness: 0.04 });
      var treeTrunkMat = new THREE.MeshStandardMaterial({ color: srgb(0x3a2a1c), roughness: 0.8 });
      [-12.0, -7.2, -2.4, 2.6, 7.4, 12.0].forEach(function (tx) {
        var tg = new THREE.Group();
        tg.position.set(tx, top, -0.28);
        group.add(tg);
        addCyl(tg, 0.035, 0.05, 0.48, 4, treeTrunkMat, 0, 0.24, 0, false);
        var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), treeLeafMat);
        crown.position.set(0, 0.58, 0);
        crown.scale.set(1.1, 0.8, 1.1);
        tg.add(crown);
        var crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), treeLeafMat);
        crown2.position.set(0.14, 0.48, 0.05);
        tg.add(crown2);
      });
    }
    var pavilions = important ? [-10.2, -5.2, 5.2, 10.2] : [-length * 0.26, length * 0.26];
    pavilions.forEach(function (pvx) {
      var pav = new THREE.Group();
      pav.position.set(pvx, top, 0);
      pav.scale.setScalar(0.8);
      group.add(pav);
      addBox(pav, 2.15, 0.24, 1.15, materials.goldDark, 0, 0.12, 0, [1, 1], false);
      addBox(pav, 1.6, 0.82, 0.66, materials.ridgeBand, 0, 0.62, 0, [1, 1], false);
      addBox(pav, 0.72, 0.5, 0.06, materials.interior, 0, 0.56, 0.35, [1, 1], false);
      [-0.75, 0.75].forEach(function (cx) {
        addBox(pav, 0.1, 1.0, 0.1, materials.gold, cx, 0.7, -0.32, [1, 1], false);
        addBox(pav, 0.1, 1.0, 0.1, materials.gold, cx, 0.7, 0.32, [1, 1], false);
      });
      var pr = new THREE.Mesh(new THREE.ConeGeometry(1.38, 0.62, 4), materials.ridgeBand);
      pr.position.set(0, 1.5, 0);
      pr.rotation.y = Math.PI / 4;
      pr.scale.set(1, 1, 0.62);
      pav.add(pr);
      addBox(pav, 0.08, 0.44, 0.08, materials.gold, 0, 1.72, 0, [1, 1], false);
      var finial = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), materials.gold);
      finial.position.set(0, 1.98, 0);
      pav.add(finial);
      for (var ff = 0; ff < 4; ff++) {
        var guest = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.32, 5), materials.ridgeBand);
        guest.position.set(-0.6 + ff * 0.4, 0.3, 0.38);
        pav.add(guest);
        var gh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), materials.gold);
        gh.position.set(-0.6 + ff * 0.4, 0.52, 0.38);
        pav.add(gh);
      }
    });

    /* 中央宝珠 */
    if (important) {
      var pearlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.22, 8), materials.ridgeBand);
      pearlBase.position.set(0, top + 0.05, 0.7);
      group.add(pearlBase);
      var pearl = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), materials.gold);
      pearl.position.set(0, top + 0.8, 0.7);
      pearl.scale.set(1, 1.15, 1);
      group.add(pearl);
      var flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.62, 6),
        new THREE.MeshStandardMaterial({ color: srgb(0x8a2a1e), roughness: 0.4, metalness: 0.2 })
      );
      flame.position.set(0, top + 1.32, 0.7);
      group.add(flame);
    }

    /* 两端鳌鱼 */
    [-1, 1].forEach(function (dir) {
      var fish = new THREE.Group();
      fish.position.set(dir * (length / 2 - 0.4), top + 0.14, 0);
      fish.rotation.y = dir > 0 ? 0 : Math.PI;
      group.add(fish);
      var body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f6b4f, roughness: 0.34, metalness: 0.2 }));
      body.scale.set(1.6, 0.72, 0.7);
      body.position.set(0.18, 0.22, 0);
      fish.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 6), materials.ridgeBand);
      head.position.set(0.78, 0.4, 0);
      fish.add(head);
      var jaw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 5), materials.gold);
      jaw.rotation.z = -Math.PI / 2;
      jaw.position.set(1.08, 0.44, 0);
      fish.add(jaw);
      var tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 5), materials.ridgeBand);
      tail.rotation.z = Math.PI / 2.4;
      tail.position.set(-0.62, 0.48, 0);
      fish.add(tail);
      [-1, 1].forEach(function (hs) {
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.56, 5), materials.gold);
        horn.rotation.z = -0.5;
        horn.position.set(0.7, 0.8, hs * 0.12);
        fish.add(horn);
      });
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), materials.dark);
      eye.position.set(0.9, 0.48, 0.2);
      fish.add(eye);
    });

    /* 花球 */
    var flowerGeo = new THREE.SphereGeometry(0.12, 5, 4);
    var flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0.18 });
    var flowerCount = LOW ? 34 : (important ? 110 : 42);
    var flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    var fd = new THREE.Object3D();
    for (var fl = 0; fl < flowerCount; fl++) {
      fd.position.set(-length / 2 + r() * length, top - 0.02 + r() * 0.25, (r() - 0.5) * d * 0.78);
      var fs = 0.55 + r() * 1.1;
      fd.scale.set(fs, fs, fs);
      fd.updateMatrix();
      flowers.setMatrixAt(fl, fd.matrix);
      flowers.setColorAt(fl, srgb(robes[Math.floor(r() * robes.length)]));
    }
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    group.add(flowers);

    return group;
  }

  /* ---------------- 通用尺寸与文字 ---------------- */

  var UV = {
    brick: function (w, h) { return [w / 2.4, h / 1.2]; },
    granite: function (w, d) { return [w / 3, d / 3]; },
    wood: function (w, h) { return [w / 1.5, h / 1.5]; },
    plaster: function (w, h) { return [w / 2, h / 2]; }
  };

  function textBoard(parent, text, x, y, z, w, h, rotY) {
    var c = document.createElement("canvas");
    c.width = 512;
    c.height = Math.round(512 * h / w);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#1b1510";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#8e6a37";
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
    ctx.strokeStyle = "#c99a52";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, c.width - 36, c.height - 36);
    ctx.fillStyle = "#d7b77a";
    ctx.font = '600 ' + Math.round(c.height * 0.5) + 'px "KaiTi","STKaiti","Songti SC","SimSun",serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2 + 2);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    var mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.45, metalness: 0.2,
      emissive: 0x1a1208, emissiveIntensity: 0.3
    });
    var group = new THREE.Group();
    group.position.set(x, y, z);
    if (rotY) group.rotation.y = rotY;
    parent.add(group);
    addBox(group, w + 0.22, h + 0.22, 0.14, materials.goldDark, 0, 0, -0.05, [1, 1], false);
    addPlane(group, w, h, mat, 0, 0, 0.025);
    return group;
  }

  function addWindow(parent, x, y, z, w, h, rotY) {
    var group = new THREE.Group();
    group.position.set(x, y, z);
    if (rotY) group.rotation.y = rotY;
    parent.add(group);
    addBox(group, w + 0.22, h + 0.22, 0.12, materials.woodDark, 0, 0, 0, [1, 1], false);
    addPlane(group, w, h, materials.window, 0, 0, 0.07);
    addBox(group, 0.06, h, 0.05, materials.woodDark, 0, 0, 0.1, null, false);
    addBox(group, w, 0.06, 0.05, materials.woodDark, 0, 0, 0.1, null, false);
    windowMats.push(materials.window);
    return group;
  }

  function addLantern(parent, x, y, z, scale) {
    var mat = new THREE.MeshStandardMaterial({
      color: 0x9b2f22, roughness: 0.5, metalness: 0.05,
      emissive: 0x742218, emissiveIntensity: 0.5
    });
    lanternMats.push(mat);
    var group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat);
    body.scale.set(1, 1.32, 1);
    group.add(body);
    addCyl(group, 0.13, 0.16, 0.1, 8, materials.gold, 0, 0.43, 0, false);
    addCyl(group, 0.13, 0.16, 0.1, 8, materials.gold, 0, -0.43, 0, false);
    var tassel = addCyl(group, 0.03, 0.03, 0.55, 5, materials.gold, 0, -0.76, 0, false);
    tassel.scale.set(1, 1, 1);
    if (scale) group.scale.setScalar(scale);
    return group;
  }

  /* ---------------- 地面与围墙 ---------------- */

  function buildGround() {
    var outer = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.MeshStandardMaterial({ color: 0x3a4035, roughness: 1, metalness: 0 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.08;
    outer.receiveShadow = true;
    root.add(outer);

    var paving = new THREE.Mesh(new THREE.PlaneGeometry(98, 92), materials.granite);
    scaleUV(paving.geometry, 98 / 3, 92 / 3);
    paving.rotation.x = -Math.PI / 2;
    paving.position.y = 0.01;
    paving.receiveShadow = true;
    root.add(paving);

    var plaza = new THREE.Mesh(new THREE.PlaneGeometry(96, 40), materials.granite);
    scaleUV(plaza.geometry, 96 / 3, 40 / 3);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.005, 60);
    plaza.receiveShadow = true;
    root.add(plaza);

    var pathMat = new THREE.MeshStandardMaterial({
      map: textures.granite, bumpMap: textures.graniteBump, bumpScale: 0.03,
      color: 0xd8d0be, roughness: 0.9, metalness: 0.02
    });
    var path = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 82), pathMat);
    scaleUV(path.geometry, 7.2 / 3, 82 / 3);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.025, 0);
    path.receiveShadow = true;
    root.add(path);

    var crossMat = new THREE.MeshStandardMaterial({
      color: 0x6e6b5f, roughness: 0.95, metalness: 0.02
    });
    [18.6, -9, -34].forEach(function (z) {
      addBox(root, 60, 0.035, 0.28, crossMat, 0, 0.04, z, null, false);
    });
    [-15.2, 15.2].forEach(function (x) {
      addBox(root, 0.26, 0.035, 78, crossMat, x, 0.04, 0, null, false);
    });

    /* 门前台阶 */
    for (var s = 0; s < 3; s++) {
      addBox(root, 10.8 - s * 0.7, 0.3, 0.55, materials.granite, 0, 0.15 + s * 0.3, 41.2 + s * 0.55, UV.granite(10, 1));
    }
    /* 月台台阶 */
    for (var m = 0; m < 4; m++) {
      addBox(root, 5.4 - m * 0.35, 0.22, 0.48, materials.granite, 0, 0.11 + m * 0.22, 18.15 + m * 0.48, UV.granite(5, 1));
    }
    /* 后座台阶 */
    for (var r = 0; r < 3; r++) {
      addBox(root, 7.2 - r * 0.4, 0.25, 0.5, materials.granite, 0, 0.125 + r * 0.25, -14.1 + r * 0.5, UV.granite(7, 1));
    }
  }

  function wallCoping(parent, x, z, length, alongZ) {
    var g = new THREE.Group();
    g.position.set(x, 5.35, z);
    if (alongZ) g.rotation.y = Math.PI / 2;
    parent.add(g);
    addBox(g, length, 0.18, 1.25, materials.plaster, 0, 0, 0, [length / 2, 1], false);
    addBox(g, length, 0.16, 1.05, materials.roof, 0, 0.16, 0, [length / 2, 0.8], false);
    addBox(g, length, 0.22, 0.18, materials.plaster, 0, 0.32, 0, [length / 2, 1], false);
  }

  function buildWalls() {
    [-40, 40].forEach(function (x) {
      addBox(root, 0.85, 5.2, 80, materials.brick, x, 2.6, 0, UV.brick(80, 5.2));
      addBox(root, 1.1, 1.0, 80.2, materials.granite, x, 0.5, 0, UV.granite(80, 1));
      wallCoping(root, x, 0, 80, true);
      for (var z = -34; z <= 34; z += 17) {
        addLantern(root, x > 0 ? x - 0.7 : x + 0.7, 3.5, z, 0.72);
      }
    });
    addBox(root, 80.4, 5.2, 0.85, materials.brick, 0, 2.6, -40, UV.brick(80, 5.2));
    addBox(root, 80.4, 1.0, 1.1, materials.granite, 0, 0.5, -40, UV.granite(80, 1));
    wallCoping(root, 0, -40, 80, false);

    /* 围墙转角石 */
    [-40, 40].forEach(function (x) {
      [-40, 40].forEach(function (z) {
        addBox(root, 1.2, 1.3, 1.2, materials.graniteDark, x, 0.65, z, UV.granite(1, 1));
      });
    });
  }

  /* ---------------- 正门 ---------------- */

  function buildGate() {
    var B = 0.9;
    var baseZ = 33.6;

    addBox(root, 29.2, B, 14.4, materials.granite, 0, B / 2, baseZ, UV.granite(29, 14));
    addBox(root, 27.4, 6.8, 0.8, materials.brick, 0, B + 3.4, 27.6, UV.brick(27.4, 6.8));
    [-13.45, 13.45].forEach(function (x) {
      addBox(root, 0.85, 6.8, 12.2, materials.brick, x, B + 3.4, 33.5, UV.brick(12.2, 6.8));
    });

    /* 前檐墙 */
    var wallTop = B + 5.3;
    [
      [-13.45, -8.35, 5.1],
      [-8.35, -2.55, 5.8],
      [2.55, 8.35, 5.8],
      [8.35, 13.45, 5.1]
    ].forEach(function (seg) {
      var w = seg[1] - seg[0];
      var cx = (seg[0] + seg[1]) / 2;
      addBox(root, w, 5.3, 0.8, materials.brick, cx, B + 2.65, 39.55, UV.brick(w, 5.3));
      addBox(root, w, 0.18, 1.05, materials.granite, cx, B + 0.09, 39.55, UV.granite(w, 1), false);
    });

    /* 门洞与门框（暗盒退到门扇之后，避免遮住门神） */
    addBox(root, 4.75, 5.6, 0.55, materials.interior, 0, B + 2.8, 39.05, [1, 1], false);
    addBox(root, 5.4, 0.55, 1.1, materials.graniteDark, 0, B + 5.55, 39.6, UV.granite(5, 1));
    [-2.55, 2.55].forEach(function (x) {
      addBox(root, 0.5, 5.4, 0.9, materials.graniteDark, x, B + 2.7, 39.65, UV.granite(1, 5));
    });
    addBox(root, 5.2, 0.18, 0.85, materials.granite, 0, B + 0.09, 40.05, UV.granite(5, 1), false);

    /* 门扇 */
    [-1.15, 1.15].forEach(function (x, idx) {
      addBox(root, 2.15, 5.25, 0.14, materials.lacquer, x, B + 2.65, 39.72, [1, 1]);
      addPlane(root, 1.95, 4.95, materials.doorGod[idx], x, B + 2.85, 39.9);
      var studGeo = new THREE.SphereGeometry(0.045, 6, 5);
      var studs = new THREE.InstancedMesh(studGeo, materials.gold, 20);
      var sd = new THREE.Object3D();
      for (var r = 0; r < 5; r++) {
        for (var c = 0; c < 4; c++) {
          sd.position.set(x - 0.72 + c * 0.48, B + 1.0 + r * 0.38, 39.96);
          sd.updateMatrix();
          studs.setMatrixAt(r * 4 + c, sd.matrix);
        }
      }
      studs.instanceMatrix.needsUpdate = true;
      root.add(studs);
      var knocker = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 14), materials.gold);
      knocker.position.set(x, B + 2.15, 39.99);
      root.add(knocker);
    });

    /* 门神、匾额、楹联 */
    addBox(root, 4.9, 1.25, 0.18, materials.goldDark, 0, B + 6.25, 39.9, [1, 1], false);
    addPlane(root, 4.65, 1.05, materials.plaque, 0, B + 6.25, 40.0);
    [-3.5, 3.5].forEach(function (x, i) {
      addBox(root, 0.86, 5.1, 0.13, materials.goldDark, x, B + 3.55, 39.88, [1, 1], false);
      addPlane(root, 0.72, 4.9, materials.couplets[i], x, B + 3.55, 39.95);
    });

    /* 石檐柱 */
    [-12.9, -8.35, -2.55, 2.55, 8.35, 12.9].forEach(function (x) {
      addCyl(root, 0.24, 0.29, 5.55, 14, materials.granite, x, B + 2.78, 39.95);
      addCyl(root, 0.36, 0.4, 0.3, 14, materials.graniteDark, x, B + 0.15, 39.95);
    });

    /* 额枋与斗拱（中间留出匾额位置） */
    addBox(root, 10.6, 0.42, 0.55, materials.woodDark, -8.2, B + 5.85, 39.9, UV.wood(10.6, 1));
    addBox(root, 10.6, 0.42, 0.55, materials.woodDark, 8.2, B + 5.85, 39.9, UV.wood(10.6, 1));
    var bracketGeoW = new THREE.BoxGeometry(0.65, 0.16, 0.5);
    var bracketMat = materials.woodDark;
    var brackets = new THREE.InstancedMesh(bracketGeoW, bracketMat, 18);
    var bd = new THREE.Object3D();
    for (var bi = 0; bi < 18; bi++) {
      bd.position.set(-13 + bi * 1.52, B + 6.15, 39.82);
      bd.updateMatrix();
      brackets.setMatrixAt(bi, bd.matrix);
    }
    brackets.instanceMatrix.needsUpdate = true;
    root.add(brackets);

    /* 屋顶：中三间高、两梢间低，共九条脊 */
    gableRoof(root, {
      x: 0, z: baseZ, w: 16.8, d: 13.9,
      eaveY: B + 6.8, ridgeY: B + 10.4,
      figures: 34, ridgeLength: 16.4, ridgeScale: 0.8, dark: false
    });
    [-11.2, 11.2].forEach(function (x) {
      gableRoof(root, {
        x: x, z: baseZ, w: 5.7, d: 13.9,
        eaveY: B + 5.85, ridgeY: B + 8.8,
        figures: 12, ridgeLength: 5.5, ridgeScale: 0.62, dark: true
      });
    });

    /* 两侧包台 */
    [-7.9, 7.9].forEach(function (x) {
      addBox(root, 4.4, 1.15, 2.4, materials.granite, x, 0.575, 40.55, UV.granite(4, 2));
      addBox(root, 4.0, 0.15, 2.0, materials.graniteDark, x, 1.2, 40.55, UV.granite(4, 2), false);
    });

    buildDrums();
    buildLions();
    buildFlagpoles();
    addLantern(root, -3.9, B + 5.0, 40.2, 0.85);
    addLantern(root, 3.9, B + 5.0, 40.2, 0.85);
  }

  function buildDrums() {
    [-3.85, 3.85].forEach(function (x) {
      addBox(root, 1.8, 1.15, 1.25, materials.graniteDark, x, 0.575, 41.15, UV.granite(2, 1));
      var drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.55, 24), materials.granite);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(x, 1.85, 41.15);
      drum.castShadow = true;
      root.add(drum);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 8, 28), materials.graniteDark);
      rim.position.set(x, 1.85, 41.45);
      root.add(rim);
      var swirl = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 24), materials.graniteDark);
      swirl.position.set(x, 1.85, 41.46);
      root.add(swirl);
    });
  }

  function buildLion(x, z, female) {
    var g = new THREE.Group();
    g.name = female ? "stone-lion-female" : "stone-lion-male";
    g.position.set(x, 0, z);
    root.add(g);
    addBox(g, 2.7, 1.25, 2.1, materials.graniteDark, 0, 0.625, 0, UV.granite(3, 2));
    addBox(g, 3.0, 0.2, 2.35, materials.granite, 0, 1.35, 0, UV.granite(3, 2), false);
    addBox(g, 2.3, 0.28, 1.8, materials.granite, 0, 1.55, 0, UV.granite(2, 2), false);

    var mat = materials.granite;
    var dark = materials.graniteDark;

    function orb(m, sx, sy, sz, x, y, z) {
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), m);
      mesh.scale.set(sx, sy, sz);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    }
    function block(m, w, h, d, x, y, z) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    }

    /* 蹲坐的躯体：后胯低、胸口高，头要抬出胸口 */
    orb(mat, 0.82, 0.72, 1.1, 0, 2.02, -0.2);
    orb(mat, 0.7, 0.8, 0.6, 0, 2.32, 0.3);
    orb(mat, 0.45, 0.55, 0.6, -0.6, 1.98, -0.55);
    orb(mat, 0.45, 0.55, 0.6, 0.6, 1.98, -0.55);
    orb(mat, 0.34, 0.44, 0.4, -0.5, 2.42, 0.32);
    orb(mat, 0.34, 0.44, 0.4, 0.5, 2.42, 0.32);

    /* 颈毛：两圈石雕卷瓣，脸要露在卷瓣前面 */
    orb(mat, 0.86, 0.82, 0.28, 0, 3.05, 0.42);
    [0.56, 0.72].forEach(function (rad, ri) {
      for (var i = 0; i < 11; i++) {
        var a = (i / 11) * Math.PI * 2 + ri * 0.28;
        var petal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), ri ? mat : dark);
        petal.scale.set(0.62, 1.0, 0.46);
        petal.position.set(Math.cos(a) * rad, 3.05 + Math.sin(a) * rad * 0.9, 0.5 - ri * 0.08);
        petal.rotation.z = a - Math.PI / 2;
        petal.castShadow = true;
        g.add(petal);
      }
    });

    /* 头、眉、吻、耳 */
    orb(mat, 0.54, 0.52, 0.52, 0, 3.15, 0.85);
    block(mat, 0.86, 0.18, 0.24, 0, 3.38, 1.12);
    orb(mat, 0.2, 0.15, 0.16, -0.38, 3.08, 1.2);
    orb(mat, 0.2, 0.15, 0.16, 0.38, 3.08, 1.2);
    block(mat, 0.56, 0.36, 0.42, 0, 2.98, 1.25);
    block(dark, 0.28, 0.14, 0.14, 0, 3.1, 1.47);
    block(dark, 0.4, 0.07, 0.05, 0, 2.84, 1.44);
    orb(mat, 0.46, 0.22, 0.3, 0, 2.78, 1.2);
    [-0.24, 0.24].forEach(function (ex) {
      orb(dark, 0.13, 0.11, 0.07, ex, 3.2, 1.28);
      orb(mat, 0.07, 0.065, 0.05, ex, 3.19, 1.33);
    });
    [-0.48, 0.48].forEach(function (ex) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 5), mat);
      ear.position.set(ex, 3.48, 0.78);
      ear.rotation.z = ex > 0 ? -0.5 : 0.5;
      ear.castShadow = true;
      g.add(ear);
    });

    /* 前腿：一侧踏绣球 / 抚幼狮 */
    var pawYLeft = female ? 2.3 : 1.78;
    var pawYRight = female ? 1.78 : 2.36;
    [[-0.5, pawYLeft], [0.5, pawYRight]].forEach(function (p) {
      var lx = p[0], py = p[1];
      var leg = block(mat, 0.28, 2.4 - py + 0.24, 0.32, lx, (2.4 + py) / 2, 0.74);
      leg.rotation.x = -0.14;
      orb(mat, 0.28, 0.2, 0.38, lx, py, 1.08);
      for (var c = 0; c < 3; c++) {
        var claw = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 5), dark);
        claw.position.set(lx - 0.16 + c * 0.16, py - 0.05, 1.42);
        claw.rotation.x = Math.PI / 2;
        g.add(claw);
      }
    });

    /* 后爪与尾巴 */
    orb(mat, 0.3, 0.18, 0.42, -0.66, 1.76, 0.02);
    orb(mat, 0.3, 0.18, 0.42, 0.66, 1.76, 0.02);
    var tail = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.11, 6, 20, Math.PI * 1.35), mat);
    tail.position.set(0, 2.5, -1.12);
    tail.rotation.z = 0.35;
    tail.castShadow = true;
    g.add(tail);
    orb(mat, 0.16, 0.16, 0.16, 0.06, 2.85, -1.28);

    if (female) {
      /* 幼狮伏在左爪下 */
      orb(mat, 0.24, 0.17, 0.34, -0.5, 1.88, 1.18);
      orb(mat, 0.19, 0.19, 0.19, -0.5, 2.1, 1.48);
      orb(dark, 0.14, 0.09, 0.07, -0.5, 2.12, 1.61);
      orb(mat, 0.22, 0.2, 0.18, -0.5, 2.02, 1.32);
    } else {
      /* 绣球 */
      var ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat);
      ball.position.set(0.5, 2.02, 1.18);
      ball.castShadow = true;
      g.add(ball);
      var band = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.035, 6, 20), dark);
      band.position.copy(ball.position);
      g.add(band);
      var band2 = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.035, 6, 20), dark);
      band2.position.copy(ball.position);
      band2.rotation.y = Math.PI / 2;
      g.add(band2);
    }
    return g;
  }

  function buildLions() {
    buildLion(-8.7, 45.7, true).scale.setScalar(0.82);
    buildLion(8.7, 45.7, false).scale.setScalar(0.82);
  }

  function buildFlagpoles() {
    [-13.3, 13.3].forEach(function (x) {
      addCyl(root, 0.75, 0.95, 0.7, 12, materials.graniteDark, x, 0.35, 54);
      addCyl(root, 0.14, 0.2, 12, 10, materials.granite, x, 6.7, 54);
      var top = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8), materials.granite);
      top.position.set(x, 13.1, 54);
      root.add(top);
      [7.6, 9.1, 10.6].forEach(function (y, i) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 - i * 0.1, 0.06, 6, 18), materials.graniteDark);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, y, 54);
        root.add(ring);
        for (var k = 0; k < 6; k++) {
          var a = (k / 6) * Math.PI * 2;
          var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 5), materials.granite);
          leaf.position.set(x + Math.cos(a) * 0.55, y + 0.16, 54 + Math.sin(a) * 0.55);
          leaf.rotation.z = Math.PI;
          leaf.rotation.y = -a;
          root.add(leaf);
        }
      });
    });
  }

  /* ---------------- 聚贤堂与月台 ---------------- */

  function addBracketRow(parent, x0, x1, y, z, step, scale) {
    var count = Math.max(2, Math.floor(Math.abs(x1 - x0) / step));
    var geoW = new THREE.BoxGeometry(0.85 * (scale || 1), 0.18, 0.55);
    var geoV = new THREE.BoxGeometry(0.24, 0.5, 0.4);
    var mat = materials.woodDark;
    var bw = new THREE.InstancedMesh(geoW, mat, count);
    var bv = new THREE.InstancedMesh(geoV, mat, count);
    var d = new THREE.Object3D();
    for (var i = 0; i < count; i++) {
      var x = x0 + (i + 0.5) * ((x1 - x0) / count);
      d.position.set(x, y, z);
      d.updateMatrix();
      bw.setMatrixAt(i, d.matrix);
      d.position.set(x, y - 0.32, z);
      d.updateMatrix();
      bv.setMatrixAt(i, d.matrix);
    }
    bw.instanceMatrix.needsUpdate = true;
    bv.instanceMatrix.needsUpdate = true;
    parent.add(bw);
    parent.add(bv);
  }

  function buildScreenWall(parent, z, count, totalW, baseY, height, facing) {
    var panelW = totalW / count;
    var barMat = materials.woodDark;
    var goldMat = materials.goldDark;
    for (var i = 0; i < count; i++) {
      var x = -totalW / 2 + (i + 0.5) * panelW;
      var g = new THREE.Group();
      g.position.set(x, baseY + height / 2, z);
      if (facing === -1) g.rotation.y = Math.PI;
      parent.add(g);
      addPlane(g, panelW - 0.06, height, materials.screen, 0, 0, 0.02);
      addBox(g, 0.07, height, 0.09, barMat, -panelW / 2, 0, 0.05, [1, 1], false);
      addBox(g, 0.07, height, 0.09, barMat, panelW / 2, 0, 0.05, [1, 1], false);
      addBox(g, panelW, 0.09, 0.09, barMat, 0, height / 2, 0.05, [1, 1], false);
      addBox(g, panelW, 0.09, 0.09, barMat, 0, -height / 2, 0.05, [1, 1], false);
      for (var v = 0; v < 3; v++) {
        addBox(g, 0.035, height - 0.2, 0.05, barMat, -panelW / 2 + (panelW / 4) * (v + 1), 0, 0.06, null, false);
      }
      for (var h = 0; h < 4; h++) {
        addBox(g, panelW - 0.12, 0.035, 0.05, barMat, 0, -height / 2 + 0.5 + (height - 1) * (h / 3), 0.06, null, false);
      }
      addBox(g, 0.035, 0.035, 0.04, goldMat, 0, -height / 2 + 0.08, 0.1, null, false);
      addBox(g, 0.035, 0.035, 0.04, goldMat, 0, height / 2 - 0.08, 0.1, null, false);
    }
  }

  function buildBalustrade() {
    var topY = 0.9;
    var frontZ = 18.05;
    var postMat = materials.granite;
    var xs = [-10.5, -7, -3.5, 0, 3.5, 7, 10.5];
    xs.forEach(function (x) {
      addBox(root, 0.3, 1.1, 0.3, postMat, x, topY + 0.55, frontZ, [1, 1]);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), postMat);
      cap.position.set(x, topY + 1.18, frontZ);
      cap.scale.set(1, 1.25, 1);
      root.add(cap);
    });
    addBox(root, 21.4, 0.16, 0.34, postMat, 0, topY + 1.02, frontZ, [1, 1], false);
    for (var i = 0; i < 6; i++) {
      var x0 = xs[i] + 0.18;
      var x1 = xs[i + 1] - 0.18;
      var cx = (x0 + x1) / 2;
      var w = x1 - x0;
      addBox(root, w, 0.12, 0.22, materials.graniteDark, cx, topY + 0.16, frontZ, [1, 1], false);
      addBox(root, w, 0.12, 0.28, materials.graniteDark, cx, topY + 0.82, frontZ, [1, 1], false);
      addPlane(root, w - 0.1, 0.52, materials.iron, cx, topY + 0.5, frontZ + 0.02);
    }
    /* 侧栏 */
    [-10.65, 10.65].forEach(function (x) {
      var zs = [13.6, 15.8, 17.9];
      zs.forEach(function (z) {
        addBox(root, 0.28, 1.05, 0.28, postMat, x, topY + 0.525, z, [1, 1]);
      });
      addBox(root, 0.3, 0.15, 4.5, postMat, x, topY + 1.0, 15.75, [1, 1], false);
      for (var i = 0; i < 2; i++) {
        var z0 = zs[i] + 0.16;
        var z1 = zs[i + 1] - 0.16;
        var cz = (z0 + z1) / 2;
        addPlane(root, z1 - z0 - 0.1, 0.52, materials.iron, x + 0.02, topY + 0.5, cz, Math.PI / 2);
        addBox(root, 0.2, 0.12, z1 - z0, materials.graniteDark, x, topY + 0.16, cz, [1, 1], false);
      }
    });
  }

  function buildHall() {
    var baseY = 1.0;
    var eaveY = 8.45;
    addBox(root, 29.6, 1.0, 18.4, materials.granite, 0, 0.5, 4.9, UV.granite(29, 18));
    addBox(root, 21.2, 0.9, 4.8, materials.granite, 0, 0.45, 15.7, UV.granite(21, 5));
    addBox(root, 28.2, 0.7, 17.0, materials.hallFloor, 0, baseY + 0.01, 4.9, [1, 1], false);
    addBox(root, 27.6, 0.12, 16.6, materials.ceiling, 0, eaveY - 0.3, 4.9, [1, 1], false);

    [-13.9, 13.9].forEach(function (x) {
      addBox(root, 0.85, 7.45, 16.7, materials.brick, x, baseY + 3.72, 4.9, UV.brick(16.7, 7.4));
      addBox(root, 0.95, 0.9, 16.9, materials.granite, x, 0.45, 4.9, UV.granite(16.9, 1));
      for (var wz = 1; wz <= 3; wz++) {
        addWindow(root, x + (x < 0 ? 0.45 : -0.45), 5.4, 4.9 + (wz - 2) * 5.1, 2.0, 2.2, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    });
    addBox(root, 27.8, 7.45, 0.85, materials.brick, 0, baseY + 3.72, -3.2, UV.brick(27.8, 7.4));

    /* 前廊木柱 */
    [-13.0, -7.8, -2.6, 2.6, 7.8, 13.0].forEach(function (x) {
      addCyl(root, 0.33, 0.38, 7.45, 14, materials.woodDark, x, baseY + 3.72, 13.45);
      addCyl(root, 0.48, 0.52, 0.35, 14, materials.graniteDark, x, baseY + 0.18, 13.45);
      addBracketRow(root, x - 0.8, x + 0.8, eaveY - 0.35, 13.35, 1.6, 0.9);
    });

    addBox(root, 27.9, 0.5, 0.65, materials.woodDark, 0, eaveY - 0.55, 13.38, UV.wood(27, 1));
    addBracketRow(root, -13, 13, eaveY - 0.25, 13.3, 2.1, 1.0);

    /* 梁架与室内 */
    for (var b = 0; b < 4; b++) {
      addBox(root, 27.0, 0.35, 0.4, materials.woodDark, 0, 7.35, -1.0 + b * 3.6, UV.wood(27, 1), false);
    }
    addBox(root, 0.4, 0.35, 16.0, materials.woodDark, -6.8, 7.35, 4.9, UV.wood(16, 1), false);
    addBox(root, 0.4, 0.35, 16.0, materials.woodDark, 6.8, 7.35, 4.9, UV.wood(16, 1), false);
    addBox(root, 18.6, 0.9, 0.3, materials.woodDark, 0, 6.55, -2.95, UV.wood(18, 1), false);
    buildScreenWall(root, -2.78, 12, 18.7, baseY, 5.35, 1);

    /* 月台栏杆 + 铁铸通花 */
    buildBalustrade();

    /* 匾额与灯笼 */
    textBoard(root, "聚贤堂", 0, 7.25, 13.55, 3.2, 0.78, 0);
    [ -9.4, -4.7, 4.7, 9.4 ].forEach(function (x) {
      addLantern(root, x, 6.7, 13.9, 0.9);
    });
    var warm = new THREE.PointLight(0xffb46a, 0.55, 22, 2);
    warm.position.set(0, 4.5, 5.0);
    root.add(warm);
    flickerLights.push(warm);

    /* 屋顶：27 米陶塑瓦脊 */
    gableRoof(root, {
      x: 0, z: 4.9, w: 30.5, d: 19.0,
      eaveY: eaveY, ridgeY: 13.75,
      overhang: 1.45, figures: 224, ridgeLength: 27,
      ridgeScale: 1, important: true
    });
  }

  /* ---------------- 后座与神龛 ---------------- */

  function buildShrines() {
    var startX = -9.0;
    var step = 1.8;
    for (var i = 0; i < 11; i++) {
      var x = startX + i * step;
      var g = new THREE.Group();
      g.position.set(x, 1.0, -29.9);
      root.add(g);
      addBox(g, 1.55, 4.2, 1.1, materials.dark, 0, 2.1, 0, [1, 1], false);
      addBox(g, 1.7, 0.18, 1.3, materials.goldDark, 0, 4.25, 0, [1, 1], false);
      addBox(g, 1.45, 3.5, 0.08, materials.screen, 0, 2.1, 0.58, [1, 1], false);
      addBox(g, 0.09, 4.0, 0.12, materials.gold, -0.72, 2.0, 0.6, [1, 1], false);
      addBox(g, 0.09, 4.0, 0.12, materials.gold, 0.72, 2.0, 0.6, [1, 1], false);
      addBox(g, 1.55, 0.1, 0.12, materials.gold, 0, 4.0, 0.6, [1, 1], false);
      var mini = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.45, 4), materials.goldDark);
      mini.position.set(0, 4.55, 0);
      mini.rotation.y = Math.PI / 4;
      mini.scale.set(1, 1, 0.7);
      g.add(mini);
      if (i % 2 === 0) addLantern(g, 0, 3.15, 0.95, 0.35);
    }
  }

  function buildRear() {
    var baseY = 0.9;
    var eaveY = 8.0;
    addBox(root, 29.0, 0.9, 18.0, materials.granite, 0, 0.45, -22.65, UV.granite(29, 18));
    addBox(root, 27.5, 0.65, 16.3, materials.hallFloor, 0, baseY + 0.01, -22.65, [1, 1], false);
    addBox(root, 26.8, 0.12, 15.9, materials.ceiling, 0, eaveY - 0.3, -22.65, [1, 1], false);
    [-13.4, 13.4].forEach(function (x) {
      addBox(root, 0.85, 7.1, 16.2, materials.brick, x, baseY + 3.55, -22.65, UV.brick(16.2, 7.1));
    });
    addBox(root, 27.0, 7.1, 0.85, materials.brick, 0, baseY + 3.55, -30.7, UV.brick(27, 7.1));

    addBox(root, 27.0, 7.1, 0.75, materials.brick, 0, baseY + 3.55, -14.65, UV.brick(27, 7.1));
    /* 三个门洞 */
    [-7.4, 0, 7.4].forEach(function (x) {
      addBox(root, 4.2, 5.4, 0.9, materials.dark, x, baseY + 2.7, -14.6, [1, 1], false);
      addBox(root, 4.6, 0.42, 0.95, materials.woodDark, x, baseY + 5.35, -14.55, [1, 1], false);
      addBox(root, 0.35, 5.2, 0.8, materials.woodDark, x - 2.25, baseY + 2.6, -14.5, [1, 1], false);
      addBox(root, 0.35, 5.2, 0.8, materials.woodDark, x + 2.25, baseY + 2.6, -14.5, [1, 1], false);
    });
    [-10.0, -3.7, 3.7, 10.0].forEach(function (x) {
      addCyl(root, 0.3, 0.34, 7.1, 12, materials.woodDark, x, baseY + 3.55, -14.55);
    });
    addBox(root, 27.0, 0.4, 0.6, materials.woodDark, 0, eaveY - 0.45, -14.55, UV.wood(27, 1));
    addBracketRow(root, -13, 13, eaveY - 0.2, -14.5, 2.2, 0.9);

    buildShrines();
    textBoard(root, "祖  堂", 0, 6.9, -14.4, 2.8, 0.7, 0);
    var warm = new THREE.PointLight(0xffb46a, 0.42, 18, 2);
    warm.position.set(0, 3.8, -24);
    root.add(warm);
    flickerLights.push(warm);

    gableRoof(root, {
      x: 0, z: -22.65, w: 29.4, d: 18.4,
      eaveY: eaveY, ridgeY: 13.05,
      overhang: 1.35, figures: 58, ridgeLength: 24,
      ridgeScale: 0.82, important: false
    });
  }

  /* ---------------- 东西两路 ---------------- */

  function buildSideHall(cx, cz, depth, tall) {
    var baseY = 0.7;
    var eaveY = tall ? 7.25 : 6.45;
    var ridgeY = tall ? 10.9 : 9.7;
    addBox(root, 15.2, 0.7, depth + 1.5, materials.granite, cx, 0.35, cz, UV.granite(15, depth));
    addBox(root, 13.9, 0.55, depth, materials.hallFloor, cx, baseY + 0.01, cz, [1, 1], false);
    addBox(root, 13.4, 0.12, depth - 1.2, materials.ceiling, cx, eaveY - 0.3, cz, [1, 1], false);
    [-7.0, 7.0].forEach(function (dx) {
      addBox(root, 0.85, eaveY - baseY, depth, materials.brick, cx + dx, baseY + (eaveY - baseY) / 2, cz, UV.brick(depth, eaveY - baseY));
      for (var wz = 0; wz < 2; wz++) {
        addWindow(root, cx + dx + (dx < 0 ? -0.45 : 0.45), 4.4, cz + (wz - 0.5) * (depth * 0.45), 1.8, 2.0, dx < 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    });
    addBox(root, 13.9, eaveY - baseY, 0.8, materials.brick, cx, baseY + (eaveY - baseY) / 2, cz - depth / 2 + 0.4, UV.brick(13.9, eaveY - baseY));

    /* 临院立面 */
    var frontZ = cz + depth / 2 - 0.4;
    addBox(root, 13.9, eaveY - baseY, 0.8, materials.brick, cx, baseY + (eaveY - baseY) / 2, frontZ, UV.brick(13.9, eaveY - baseY));
    addBox(root, 3.9, 4.5, 0.9, materials.dark, cx, baseY + 2.25, frontZ + 0.02, [1, 1], false);
    addBox(root, 4.2, 0.4, 0.95, materials.woodDark, cx, baseY + 4.6, frontZ + 0.03, [1, 1], false);
    [-5.05, 5.05].forEach(function (dx) {
      addWindow(root, cx + dx, 2.9, frontZ + 0.42, 2.0, 1.55, 0);
    });
    [-5.4, -2.0, 2.0, 5.4].forEach(function (dx) {
      addCyl(root, 0.24, 0.28, eaveY - baseY, 12, materials.woodDark, cx + dx, baseY + (eaveY - baseY) / 2, frontZ + 0.55);
    });
    addBox(root, 13.6, 0.36, 0.55, materials.woodDark, cx, eaveY - 0.5, frontZ + 0.55, UV.wood(13, 1));
    buildScreenWall(root, frontZ + 0.1, 2, 3.7, baseY + 0.05, 4.3, 1);
    addLantern(root, cx - 4.6, eaveY - 1.4, frontZ + 0.8, 0.72);
    addLantern(root, cx + 4.6, eaveY - 1.4, frontZ + 0.8, 0.72);

    gableRoof(root, {
      x: cx, z: cz, w: 15.4, d: depth + 1.4,
      eaveY: eaveY, ridgeY: ridgeY,
      overhang: 1.1, figures: tall ? 30 : 20,
      ridgeLength: 13.4, ridgeScale: tall ? 0.72 : 0.6,
      dark: !tall, gable: true
    });
  }

  function buildSideHalls() {
    [-23.5, 23.5].forEach(function (cx) {
      buildSideHall(cx, 33.6, 12.75, false);
      buildSideHall(cx, 4.9, 16.7, true);
      buildSideHall(cx, -22.65, 16.4, false);
    });
  }

  function buildWings() {
    var rows = [
      [33.8, 10.6], [21.0, 10.2], [6.4, 11.6], [-8.6, 11.8], [-23.0, 11.6]
    ];
    [-34.6, 34.6].forEach(function (cx) {
      rows.forEach(function (row, idx) {
        var cz = row[0];
        var depth = row[1];
        var eaveY = 4.35;
        var ridgeY = 5.85;
        addBox(root, 7.2, 0.4, depth + 0.9, materials.granite, cx, 0.2, cz, UV.granite(7, depth));
        addBox(root, 6.6, 3.95, depth, materials.brick, cx, 2.18, cz, UV.brick(depth, 3.9));
        var inward = cx > 0 ? -1 : 1;
        addBox(root, 0.75, 3.95, depth, materials.brick, cx + inward * 3.2, 2.18, cz, UV.brick(depth, 3.9));
        addWindow(root, cx + inward * 3.6, 2.55, cz + 2.2, 1.6, 1.5, inward > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (idx === 0 || idx === 2 || idx === 4) {
          addBox(root, 0.85, 2.5, 1.5, materials.woodDark, cx + inward * 3.62, 1.65, cz - 2.5, [1, 1], false);
          addPlane(root, 1.25, 2.3, materials.screen, cx + inward * 3.99, 1.65, cz - 2.5, inward > 0 ? Math.PI / 2 : -Math.PI / 2);
        }
        gableRoof(root, {
          x: cx, z: cz, w: 7.5, d: depth + 0.9,
          eaveY: eaveY, ridgeY: ridgeY,
          overhang: 0.75, figures: 8, ridgeLength: 6.4,
          ridgeScale: 0.46, dark: idx % 2 === 0
        });
      });
    });
  }

  function buildCorridor(x, z0, z1) {
    var length = Math.abs(z1 - z0);
    var cz = (z0 + z1) / 2;
    var g = new THREE.Group();
    g.position.set(x, 0, cz);
    g.rotation.y = Math.PI / 2;
    root.add(g);

    addBox(g, length, 0.35, 2.9, materials.granite, 0, 0.175, 0, UV.granite(length, 3));
    addBox(g, length, 0.16, 0.3, materials.graniteDark, 0, 0.43, 0, [1, 1], false);
    var count = Math.max(3, Math.floor(length / 3.2));
    for (var i = 0; i < count; i++) {
      var lx = -length / 2 + 1.4 + i * ((length - 2.8) / Math.max(1, count - 1));
      [-1.05, 1.05].forEach(function (lz) {
        addCyl(g, 0.17, 0.2, 4.0, 10, materials.woodDark, lx, 2.15, lz);
        addCyl(g, 0.25, 0.28, 0.16, 10, materials.graniteDark, lx, 0.5, lz);
      });
    }
    gableRoof(g, {
      x: 0, z: 0, w: length, d: 3.1,
      eaveY: 4.1, ridgeY: 5.25,
      overhang: 0.55, gable: false, ridge: false, dark: true
    });
    addBox(g, length, 0.3, 0.55, materials.ridgeBase, 0, 5.35, 0, [length / 2, 1], false);
    addBox(g, length, 0.12, 0.4, materials.plaster, 0, 5.55, 0, [length / 2, 1], false);
  }

  function buildCorridors() {
    [-13.25, 13.25].forEach(function (x) {
      buildCorridor(x, 13.7, 27.0);
      buildCorridor(x, -3.8, -14.1);
    });
  }

  function buildAlley() {
    [-15.2, 15.2].forEach(function (x) {
      textBoard(root, "青云巷", x, 3.45, 39.9, 0.92, 0.46, 0);
      [34, 22, 9, -4, -17, -29].forEach(function (z, i) {
        addLantern(root, x + (x < 0 ? 0.95 : -0.95), 3.55, z, 0.55);
      });
      addBox(root, 1.25, 0.45, 1.25, materials.graniteDark, x, 0.225, 30.0, UV.granite(1, 1));
      addBox(root, 1.0, 0.4, 1.0, materials.soil, x, 0.55, 30.0, null, false);
      var fern = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 6), materials.leaf[2]);
      fern.position.set(x, 1.35, 30.0);
      root.add(fern);
    });
  }

  /* ---------------- 庭院树与周边 ---------------- */

  function buildTree(x, z, scale) {
    var s = scale || 1;
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    addBox(g, 3.2, 0.35, 3.2, materials.graniteDark, 0, 0.175, 0, UV.granite(3, 3));
    addBox(g, 2.85, 0.3, 2.85, materials.soil, 0, 0.38, 0, null, false);
    addCyl(g, 0.28 * s, 0.45 * s, 5.2 * s, 9, materials.trunk, 0, 0.45 + 2.6 * s, 0);
    var branchCount = LOW ? 3 : 5;
    for (var b = 0; b < branchCount; b++) {
      var a = (b / branchCount) * Math.PI * 2 + 0.4;
      var br = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.16 * s, 2.5 * s, 5), materials.trunk);
      br.position.set(Math.cos(a) * 0.5 * s, 0.45 + 4.3 * s, Math.sin(a) * 0.5 * s);
      br.rotation.z = Math.cos(a) * 0.55;
      br.rotation.x = -Math.sin(a) * 0.55;
      g.add(br);
    }
    var blobs = LOW ? 5 : 9;
    for (var i = 0; i < blobs; i++) {
      var a2 = (i / blobs) * Math.PI * 2;
      var rr = i === 0 ? 0 : 1.4 + rand() * 2.0;
      var blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55 + rand() * 0.9, 1), materials.leaf[i % materials.leaf.length]);
      blob.position.set(Math.cos(a2) * rr * s, 0.45 + (4.7 + rand() * 1.9) * s, Math.sin(a2) * rr * s);
      blob.scale.set(1.25 + rand() * 0.5, 0.78 + rand() * 0.32, 1.25 + rand() * 0.5);
      blob.castShadow = true;
      g.add(blob);
    }
    /* 榕树气根 */
    if (!LOW) {
      for (var r = 0; r < 7; r++) {
        var ra = (r / 7) * Math.PI * 2;
        var rootH = 2.4 + rand() * 2.4;
        addCyl(g, 0.025, 0.04, rootH, 4, materials.trunk, Math.cos(ra) * (0.9 + rand() * 1.3) * s, 0.4 + rootH / 2, Math.sin(ra) * (0.9 + rand() * 1.3) * s, false);
      }
    }
    return g;
  }

  function buildTrees() {
    buildTree(-23.2, 20.2, 1.05);
    buildTree(23.2, 20.2, 1.0);
    buildTree(-23.2, -9.1, 1.15);
    buildTree(23.2, -9.1, 1.05);
    buildTree(-9.6, -39.5, 0.95);
    buildTree(9.6, -39.5, 1.0);
    buildTree(-19.5, 49.8, 0.8);
    buildTree(19.5, 49.8, 0.8);
  }

  function buildSurroundings() {
    var r = rng(520);
    var blocks = [
      [-58, 46, 15, 5, 11], [-62, 20, 13, 6, 13], [-58, -8, 16, 5, 10],
      [-62, -34, 14, 4, 12], [-55, -58, 12, 5, 9],
      [58, 48, 16, 5, 12], [63, 22, 13, 4, 10], [58, -6, 15, 5, 11],
      [61, -32, 14, 6, 13], [55, -58, 16, 5, 10],
      [-26, -58, 18, 4, 11], [26, -58, 18, 5, 12],
      [-26, 68, 18, 4, 10], [26, 68, 18, 4, 10]
    ];
    blocks.forEach(function (b, i) {
      var x = b[0], z = b[1], w = b[2], h = b[3], d = b[4];
      addBox(root, w, h, d, i % 3 === 0 ? materials.oldWall : materials.brickWarm, x, h / 2, z, UV.brick(w, h));
      var s1 = addBox(root, w + 1.6, 0.2, d * 0.6, materials.roofDark, x, h + 0.36, z - d * 0.22, [w / 2, d / 2], false);
      s1.rotation.x = -0.3;
      var s2 = addBox(root, w + 1.6, 0.2, d * 0.6, materials.roofDark, x, h + 0.36, z + d * 0.22, [w / 2, d / 2], false);
      s2.rotation.x = 0.3;
      addBox(root, w + 1.8, 0.16, 0.42, materials.plaster, x, h + 0.78, z, [w / 2, 1], false);
      addBox(root, w * 0.18, 1.5, 0.14, materials.dark, x, 1.2, z + d / 2 + 0.01, [1, 1], false);
      for (var wnd = 0; wnd < 3; wnd++) {
        addBox(root, 0.8, 0.9, 0.1, materials.window, x - w * 0.28 + wnd * w * 0.28, h * 0.58, z + d / 2 + 0.02, [1, 1], false);
      }
      if (r() > 0.4) buildTree(x + w * 0.6, z + d * 0.8, 0.65 + r() * 0.25);
    });
    /* 院外树带：阔叶冠幅为主，远看不再是一排尖锥 */
    var belt = [];
    var outsideTrees = LOW ? 14 : 34;
    for (var i = 0; i < outsideTrees; i++) {
      var ox = (r() > 0.5 ? 1 : -1) * (46 + r() * 30);
      var oz = -70 + r() * 140;
      if (Math.abs(oz) < 10 && Math.abs(ox) < 55) continue;
      belt.push([ox, oz, 0.82 + r() * 0.55]);
    }
    /* 北侧树带，给屋脊一个绿色背景 */
    for (var nt = 0; nt < (LOW ? 8 : 18); nt++) {
      var nx = -58 + nt * 6.8 + r() * 3;
      belt.push([nx, -52 - r() * 10, 0.9 + r() * 0.4]);
    }

    var crownGeo = new THREE.IcosahedronGeometry(1, 1);
    var crownMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.94, metalness: 0.02, flatShading: true
    });
    var crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, belt.length * 3);
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    var trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 6);
    var trunkMesh = new THREE.InstancedMesh(trunkGeo, materials.trunk, belt.length);
    trunkMesh.castShadow = true;
    var dummy = new THREE.Object3D();
    var tones = [0x1e3a26, 0x27492e, 0x18301f, 0x2f5336];
    var ci = 0;
    belt.forEach(function (t, ti) {
      var tx = t[0], tz = t[1], s = t[2];
      var th = 8.4 * s;
      dummy.position.set(tx, th * 0.33, tz);
      dummy.rotation.set(0, r() * Math.PI, 0);
      dummy.scale.set(s, th * 0.66, s);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(ti, dummy.matrix);
      var lumps = [
        [0, th * 0.66, 0, 3.4, 2.5, 3.2],
        [1.3, th * 0.55, 0.7, 2.3, 1.85, 2.2],
        [-1.1, th * 0.72, -0.6, 2.6, 2.05, 2.4]
      ];
      for (var k = 0; k < 3; k++) {
        var l = lumps[k];
        dummy.position.set(tx + l[0] * s, l[1], tz + l[2] * s);
        dummy.rotation.set(0, r() * Math.PI, 0);
        dummy.scale.set(l[3] * s, l[4] * s, l[5] * s);
        dummy.updateMatrix();
        crownMesh.setMatrixAt(ci, dummy.matrix);
        crownMesh.setColorAt(ci, srgb(tones[Math.floor(r() * tones.length)]));
        ci++;
      }
    });
    crownMesh.instanceMatrix.needsUpdate = true;
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;
    root.add(trunkMesh);
    root.add(crownMesh);
  }

  function buildFacadeCarvings() {
    var slots = [
      [-34.5, 2.45, 3.0, 1.35, 2],
      [-27.5, 2.75, 3.4, 1.55, 0],
      [-19.5, 2.75, 3.4, 1.55, 1],
      [19.5, 2.75, 3.4, 1.55, 1],
      [27.5, 2.75, 3.4, 1.55, 0],
      [34.5, 2.45, 3.0, 1.35, 2]
    ];
    slots.forEach(function (s) {
      var x = s[0], y = s[1], w = s[2], h = s[3], v = s[4];
      addBox(root, w + 0.32, h + 0.32, 0.14, materials.graniteDark, x, y, 39.98, [1, 1], false);
      addPlane(root, w, h, materials.carving[v], x, y, 40.06);
      addBox(root, w + 0.36, 0.12, 0.22, materials.granite, x, y + h / 2 + 0.18, 40.02, [1, 1], false);
      addBox(root, w + 0.36, 0.12, 0.22, materials.granite, x, y - h / 2 - 0.18, 40.02, [1, 1], false);
    });
  }

  /* ---------------- 热点与讲解 ---------------- */

  function buildHotspots() {
    hotspots = [
      {
        id: "brick", craft: "brick", no: "01", name: "砖雕",
        pos: new THREE.Vector3(-27.5, 2.9, 40.45),
        view: { pos: new THREE.Vector3(-34, 5.2, 54), target: new THREE.Vector3(-27.5, 2.9, 40) },
        lede: "正门两侧六幅挂线砖雕，最大一幅接近 4.8 米，是广东现存规模最大的砖雕之一。",
        facts: [["数量", "6 幅"], ["最大", "约 4.8 m"], ["位置", "首进东西檐墙"]],
        detail: "东檐正中为《刘庆伏狼驹》，两侧是《百鸟图》《五伦全图》；西檐以《水浒》聚义厅为题。青砖逐块雕好再拼成整幅，浮雕、透雕、圆雕叠用，人物和亭台能分出好几层。"
      },
      {
        id: "wood", craft: "wood", no: "02", name: "木雕",
        pos: new THREE.Vector3(0, 4.2, -2.6),
        view: { pos: new THREE.Vector3(0, 4.6, 10.5), target: new THREE.Vector3(0, 4.2, -2.8) },
        lede: "头门四扇屏门、聚贤堂十二扇双面镂雕屏门，是岭南木雕最密集的一次展示。",
        facts: [["聚贤堂", "12 扇"], ["头门", "4 扇"], ["后座", "11 座龛罩"]],
        detail: "聚贤堂后金柱正中三间装十二扇双面屏门，正反两面各刻不同典故；后座老檐柱之间还有十一座数米高的木雕龛罩。梁架、雀替、花罩上也都是同一套语言。"
      },
      {
        id: "stone", craft: "stone", no: "03", name: "石雕",
        pos: new THREE.Vector3(0, 2.25, 18.2),
        view: { pos: new THREE.Vector3(10, 3.4, 26), target: new THREE.Vector3(0, 1.9, 17.8) },
        lede: "石狮、2.55 米高的石鼓、月台望柱与栏板，把石雕放在人伸手就能碰到的地方。",
        facts: [["石鼓", "2.55 m"], ["月台", "白石栏杆"], ["题材", "佳果 · 暗八仙"]],
        detail: "大门两侧一对石鼓是广东现存最大；月台望柱以狮子、花鸟、佳果为题，栏板刻暗八仙、苏武牧羊等。门前石狮一雌一雄，雌狮抚幼狮。"
      },
      {
        id: "pottery", craft: "pottery", no: "04", name: "陶塑",
        pos: new THREE.Vector3(0, 15.3, 4.9),
        view: { pos: new THREE.Vector3(24, 19, 32), target: new THREE.Vector3(0, 14.8, 4.5) },
        lede: "全院十一条石湾陶塑瓦脊，聚贤堂一条长 27 米、连灰塑基座高 4.26 米。",
        facts: [["瓦脊", "11 条"], ["聚贤堂", "27 m"], ["人物", "224 个"]],
        detail: "聚贤堂正脊为光绪十九年（1893）石湾文如璧店烧制，题材有刘备过江招亲、武王伐纣、四郎探母等。整条脊像一座立起来的戏台，人物、亭台、鳌鱼、花鸟层层叠上去。"
      },
      {
        id: "plaster", craft: "plaster", no: "05", name: "灰塑",
        pos: new THREE.Vector3(-14.2, 8.5, 30.0),
        view: { pos: new THREE.Vector3(-28, 12, 43), target: new THREE.Vector3(-13, 8.0, 29.5) },
        lede: "灰塑沿屋脊基座、山墙垂脊和连廊铺开，全院总长一千八百余米。",
        facts: [["总长", "1800 余米"], ["位置", "脊基 · 山墙 · 连廊"], ["题材", "人物 · 花鸟 · 山水"]],
        detail: "灰塑以石灰、稻草、纸筋塑形，现场制作，不怕岭南湿热。它常做陶塑的基座和山墙包边，把屋脊上的彩色人物托起来，也让屋脊轮廓更饱满。"
      },
      {
        id: "iron", craft: "iron", no: "06", name: "铁铸",
        pos: new THREE.Vector3(5.2, 1.7, 18.2),
        view: { pos: new THREE.Vector3(7.5, 2.8, 24), target: new THREE.Vector3(5.2, 1.55, 18.05) },
        lede: "月台石栏杆之间嵌着铁铸通花栏板，是岭南祠堂里少见的中西合璧细节。",
        facts: [["位置", "聚贤堂月台"], ["正面", "6 幅"], ["题材", "麒麟玉书 · 双龙戏珠"]],
        detail: "正面六幅为麒麟玉书凤凰图，台阶两侧是双龙戏珠，另有 3 阳开泰、金玉满堂等。铁铸栏板嵌在石栏板中，色调沉着，和白色花岗岩形成对比。"
      },
      {
        id: "paint", craft: "paint", no: "07", name: "彩绘门神",
        pos: new THREE.Vector3(1.15, 4.55, 40.35),
        view: { pos: new THREE.Vector3(0, 5.2, 51), target: new THREE.Vector3(0, 4.6, 40) },
        lede: "正门两扇黑漆大门各绘一尊四米高门神，是广东现存最大的清代彩绘门神。",
        facts: [["高度", "约 4 m"], ["门扇", "2.05 × 5.6 m"], ["人物", "秦琼 · 尉迟恭"]],
        detail: "左门红脸秦琼持锏，右门黑脸尉迟恭持鞭，配铜制椒图铺首。门额悬“陈氏书院”匾，两侧挂“四壁灿瑰奇…”“一祠涵藻采…”楹联。"
      }
    ];
    return hotspots;
  }

  function build(opts) {
    LOW = !!(opts && opts.low);
    textures = opts.textures;
    materials = makeMaterials(textures);
    rand = rng(1894);
    root = new THREE.Group();
    root.name = "chen-clan-hall";
    hotspots = [];
    lanternMats = [];
    windowMats = [];
    flickerLights = [];

    buildGround();
    buildWalls();
    buildGate();
    buildHall();
    buildRear();
    buildSideHalls();
    buildWings();
    buildCorridors();
    buildAlley();
    buildTrees();
    buildSurroundings();
    buildFacadeCarvings();
    buildHotspots();

    return {
      root: root,
      hotspots: hotspots,
      lanternMats: lanternMats,
      windowMats: windowMats,
      flickerLights: flickerLights,
      materials: materials,
      bounds: new THREE.Box3(new THREE.Vector3(-42, 0, -42), new THREE.Vector3(42, 20, 42))
    };
  }

  window.ChenModel = { build: build };
})();
