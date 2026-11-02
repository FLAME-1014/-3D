/* 广州塔近景 · 程序化模型（塔身 24/46/1104、塔基、广场、江岸、城市） */
(function () {
  "use strict";

  var N = 24;
  var BODY_H = 454;
  var RING_GROUPS = 46;
  var RING_LEVELS = 47;
  var MAST_TOP = 600;
  var BASE = { a: 40, b: 30, rot: Math.PI * 135 / 180 };
  var TOP = { a: 27, b: 20.25, rot: Math.PI };
  var TOP_CENTER = new THREE.Vector3(10, 0, 0);
  var ZERO = new THREE.Vector3(0, 0, 0);

  var seed = 771026;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function ellipsePoint(e, t, y, c) {
    var x = e.b * Math.cos(t) * Math.cos(e.rot) - e.a * Math.sin(t) * Math.sin(e.rot);
    var z = e.b * Math.cos(t) * Math.sin(e.rot) + e.a * Math.sin(t) * Math.cos(e.rot);
    return new THREE.Vector3(c.x + x, y, c.z + z);
  }
  function bottomPoint(i) { return ellipsePoint(BASE, (90 + i * 15) * Math.PI / 180, 0, ZERO); }
  function topPoint(i) { return ellipsePoint(TOP, (180 + i * 15) * Math.PI / 180, BODY_H, TOP_CENTER); }
  function pointAt(i, y) {
    var t = y / BODY_H;
    return bottomPoint(i).lerp(topPoint(i), t);
  }
  function ringYs() {
    var ys = [];
    for (var i = 0; i < RING_LEVELS; i++) ys.push(i * BODY_H / (RING_LEVELS - 1));
    return ys;
  }
  function bodyExtents(y) {
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var i = 0; i < N; i++) {
      var p = pointAt(i, y);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    return {
      cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2,
      rx: (maxX - minX) / 2, rz: (maxZ - minZ) / 2
    };
  }

  function mergeGeos(geos) {
    var pos = [], nor = [], uv = [], idx = [], off = 0, hasUV = true;
    geos.forEach(function (g) {
      if (!g.attributes.uv) hasUV = false;
    });
    geos.forEach(function (g) {
      var p = g.attributes.position;
      var n = g.attributes.normal;
      var u = g.attributes.uv;
      var ix = g.index;
      for (var i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
        if (hasUV && u) uv.push(u.getX(i), u.getY(i));
      }
      if (ix) {
        for (var j = 0; j < ix.count; j++) idx.push(ix.getX(j) + off);
      } else {
        for (var k = 0; k < p.count; k++) idx.push(k + off);
      }
      off += p.count;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    if (hasUV && uv.length) out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
  }

  function quatBetween(a, b, up) {
    return new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
  }

  function makeInstanced(geo, mat, items, opts) {
    var mesh = new THREE.InstancedMesh(geo, mat, items.length);
    var dummy = new THREE.Object3D();
    items.forEach(function (item, i) {
      dummy.position.copy(item.pos);
      if (item.quat) dummy.quaternion.copy(item.quat); else dummy.quaternion.set(0, 0, 0, 1);
      if (item.scale) dummy.scale.copy(item.scale); else dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (item.color) mesh.setColorAt(i, item.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (opts && opts.castShadow) mesh.castShadow = true;
    if (opts && opts.receiveShadow) mesh.receiveShadow = true;
    return mesh;
  }

  function flatEllipseRing(rx, rz, innerRatio, segs) {
    var g = new THREE.RingGeometry(innerRatio, 1, segs || 48);
    g.rotateX(-Math.PI / 2);
    g.scale(rx, 1, rz);
    return g;
  }

  function build(opts) {
    var textures = opts.textures;
    var low = !!opts.low;
    var root = new THREE.Group();
    root.name = "canton-tower";
    var materials = {};
    var hotspots = [];
    var glowMats = [];
    var windowMats = [];
    var cityLightMat = null;
    var wheelGroup = null;
    var latticeGroup = null;
    var latticeStats = null;
    var waterMat = null;
    var poolUniforms = null;

    var steelUniforms = {
      uTime: { value: 0 },
      uMode: { value: 0 },
      uIntensity: { value: 1 },
      uDayColor: { value: new THREE.Color(0xd9dde0).convertSRGBToLinear() },
      uNight0: { value: new THREE.Color(0x2fd4c8).convertSRGBToLinear() },
      uNight1: { value: new THREE.Color(0xffd166).convertSRGBToLinear() },
      uNight2: { value: new THREE.Color(0x35c7e8).convertSRGBToLinear() },
      uNight3: { value: new THREE.Color(0x9ff5ff).convertSRGBToLinear() },
      uLightDir: { value: new THREE.Vector3(-0.42, 0.72, 0.52).normalize() },
      uAmbient: { value: new THREE.Color(0x9fb4c2).convertSRGBToLinear() },
      uFogColor: { value: new THREE.Color(0xc3d5dd).convertSRGBToLinear() },
      uFogDensity: { value: 0.00026 }
    };

    var steelMat = new THREE.ShaderMaterial({
      uniforms: steelUniforms,
      vertexShader: [
        "varying float vY;",
        "varying vec3 vNormalW;",
        "varying float vFogDepth;",
        "void main() {",
        "  vec3 p = position;",
        "  #ifdef USE_INSTANCING",
        "    p = (instanceMatrix * vec4(position, 1.0)).xyz;",
        "  #endif",
        "  vec4 world = modelMatrix * vec4(p, 1.0);",
        "  vY = world.y;",
        "  vNormalW = normalize(mat3(modelMatrix) * normal);",
        "  vec4 mv = viewMatrix * world;",
        "  vFogDepth = -mv.z;",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform float uMode;",
        "uniform float uIntensity;",
        "uniform vec3 uDayColor;",
        "uniform vec3 uNight0;",
        "uniform vec3 uNight1;",
        "uniform vec3 uNight2;",
        "uniform vec3 uNight3;",
        "uniform vec3 uLightDir;",
        "uniform vec3 uAmbient;",
        "uniform vec3 uFogColor;",
        "uniform float uFogDensity;",
        "varying float vY;",
        "varying vec3 vNormalW;",
        "varying float vFogDepth;",
        "void main() {",
        "  vec3 n = normalize(vNormalW);",
        "  float ndl = max(dot(n, normalize(uLightDir)), 0.0);",
        "  vec3 day = uDayColor * (0.5 + 0.72 * ndl) + uAmbient * 0.16;",
        "  float h = clamp(vY / 454.0, 0.0, 1.0);",
        "  float flow = 0.5 + 0.5 * sin(uTime * 0.35 - h * 9.0);",
        "  vec3 night = mix(uNight0, uNight1, smoothstep(0.0, 0.34, h));",
        "  night = mix(night, uNight2, smoothstep(0.34, 0.68, h));",
        "  night = mix(night, uNight3, smoothstep(0.68, 1.0, h));",
        "  night *= 0.55 + 0.75 * flow;",
        "  night += uDayColor * 0.06 * ndl;",
        "  vec3 dusk = mix(day, night, 0.22) + vec3(0.10, 0.05, 0.01) * ndl;",
        "  vec3 col = day;",
        "  if (uMode > 1.5) {",
        "    col = night * uIntensity + day * 0.05;",
        "  } else {",
        "    col = mix(day, dusk, clamp(uMode, 0.0, 1.0));",
        "  }",
        "  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);",
        "  col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));",
        "  gl_FragColor = vec4(col, 1.0);",
        "  #include <tonemapping_fragment>",
        "  #include <encodings_fragment>",
        "}"
      ].join("\n")
    });

    materials.steel = steelMat;

    var mastMat = new THREE.MeshStandardMaterial({
      color: 0xe8edef, roughness: 0.42, metalness: 0.45,
      emissive: new THREE.Color(0xffcf8a), emissiveIntensity: 0
    });
    materials.mast = mastMat;

    var mastAviation = new THREE.MeshStandardMaterial({
      map: textures.aviation, color: 0xffffff, roughness: 0.5, metalness: 0.3,
      emissive: new THREE.Color(0xffe6c4), emissiveMap: textures.aviation, emissiveIntensity: 0
    });
    materials.mastAviation = mastAviation;

    var mastCopper = new THREE.MeshStandardMaterial({
      color: 0xb4764c, roughness: 0.42, metalness: 0.62,
      emissive: new THREE.Color(0xffc27a), emissiveIntensity: 0
    });
    materials.mastCopper = mastCopper;

    var whiteMat = new THREE.MeshStandardMaterial({ color: 0xe7ecee, roughness: 0.55, metalness: 0.12 });
    materials.white = whiteMat;

    var deckMat = new THREE.MeshStandardMaterial({ color: 0x4a5359, roughness: 0.7, metalness: 0.35, side: THREE.DoubleSide });
    materials.deck = deckMat;

    var glassMat = new THREE.MeshStandardMaterial({
      map: textures.glassGrid, color: 0x9fc4d2, roughness: 0.22, metalness: 0.35,
      transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide
    });
    materials.glass = glassMat;

    var coreTex = textures.cityWindow.clone();
    coreTex.needsUpdate = true;
    coreTex.repeat.set(2, 6);
    var coreMat = new THREE.MeshStandardMaterial({
      map: textures.concrete, color: 0x39424a, roughness: 0.82, metalness: 0.08,
      emissive: new THREE.Color(0xa9c6d4), emissiveMap: coreTex, emissiveIntensity: 0
    });
    materials.core = coreMat;

    var cabinMat = new THREE.MeshStandardMaterial({
      map: textures.cabin, color: 0xffffff, roughness: 0.4, metalness: 0.25,
      emissive: new THREE.Color(0xffd2a8), emissiveMap: textures.cabin, emissiveIntensity: 0
    });
    materials.cabin = cabinMat;

    var bridgeMat = new THREE.MeshStandardMaterial({
      color: 0xe9eef0, roughness: 0.45, metalness: 0.22,
      emissive: new THREE.Color(0xdff2f5), emissiveIntensity: 0
    });
    materials.bridge = bridgeMat;
    materials.bridgeRail = new THREE.MeshStandardMaterial({
      color: 0xf0f4f5, roughness: 0.4, metalness: 0.24,
      emissive: new THREE.Color(0xeaf8fb), emissiveIntensity: 0
    });

    var graniteMat = new THREE.MeshStandardMaterial({ map: textures.granite, color: 0xffffff, roughness: 0.86, metalness: 0.02 });
    materials.granite = graniteMat;
    var plazaMat = new THREE.MeshStandardMaterial({ map: textures.plazaStone, color: 0xf0eeea, roughness: 0.9, metalness: 0.02 });
    materials.plaza = plazaMat;
    var rippleMat = new THREE.MeshStandardMaterial({ map: textures.ripplePaving, color: 0xf4f0e8, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide });
    materials.ripple = rippleMat;

    var leafMat = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0xd2dcc8, roughness: 0.9, metalness: 0.02 });
    materials.leaf = leafMat;
    var trunkMat = new THREE.MeshStandardMaterial({ map: textures.trunk, color: 0xffffff, roughness: 0.95, metalness: 0.01 });
    materials.trunk = trunkMat;

    var cityTex = textures.cityWindow;
    var tallTex = textures.cityWindow.clone();
    tallTex.needsUpdate = true;
    tallTex.repeat.set(2, 5);
    var cityWinTex = textures.cityWindow.clone();
    cityWinTex.needsUpdate = true;
    cityWinTex.repeat.set(2.2, 2.2);
    var cityMat = new THREE.MeshStandardMaterial({
      map: cityWinTex, color: 0xffffff, roughness: 0.82, metalness: 0.12,
      emissive: new THREE.Color(0xffffff), emissiveMap: textures.cityLit, emissiveIntensity: 0
    });
    var cityTallMat = new THREE.MeshStandardMaterial({
      map: tallTex, color: 0xffffff, roughness: 0.75, metalness: 0.18,
      emissive: new THREE.Color(0xffffff), emissiveMap: tallTex, emissiveIntensity: 0
    });
    materials.city = cityMat;
    materials.cityTall = cityTallMat;
    windowMats.push(cityMat, cityTallMat);
    var roofMat = new THREE.MeshStandardMaterial({ color: 0x60666a, roughness: 0.92, metalness: 0.04 });
    materials.roof = roofMat;
    var blockMaterials = [cityMat, cityMat, roofMat, roofMat, cityMat, cityMat];

    var towerTex = textures.cityWindow.clone();
    towerTex.needsUpdate = true;
    towerTex.repeat.set(2, 6);
    var towerMat = new THREE.MeshStandardMaterial({
      map: towerTex, color: 0xffffff, roughness: 0.68, metalness: 0.24,
      emissive: new THREE.Color(0xffe0b4), emissiveMap: textures.cityLit, emissiveIntensity: 0
    });
    materials.tower = towerMat;
    var towerCrownMat = new THREE.MeshStandardMaterial({
      color: 0x2b3034, roughness: 0.45, metalness: 0.4,
      emissive: new THREE.Color(0xffe4b8), emissiveIntensity: 0
    });
    materials.towerCrown = towerCrownMat;

    var cityGroundTex = textures.plazaStone.clone();
    cityGroundTex.needsUpdate = true;
    cityGroundTex.repeat.set(58, 36);
    var cityGroundMat = new THREE.MeshStandardMaterial({
      map: cityGroundTex, color: 0xffffff, roughness: 0.95, metalness: 0.01
    });
    materials.cityGround = cityGroundMat;
    var parkMat = new THREE.MeshStandardMaterial({ map: textures.grass, color: 0xffffff, roughness: 0.95, metalness: 0.0 });
    materials.park = parkMat;
    var streetMat = new THREE.MeshStandardMaterial({ map: textures.granite, color: 0xffffff, roughness: 0.88, metalness: 0.02 });
    materials.street = streetMat;

    var operaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.44, metalness: 0.08 });
    var museumMat = new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 0.66, metalness: 0.16 });
    var museumAccentMat = new THREE.MeshStandardMaterial({ color: 0x6e3d33, roughness: 0.7, metalness: 0.1 });
    var libraryMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.12 });
    materials.opera = operaMat;
    materials.museum = museumMat;
    materials.museumAccent = museumAccentMat;
    materials.library = libraryMat;

    var copingMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.42, metalness: 0.05 });
    materials.coping = copingMat;
    var woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.78, metalness: 0.02 });
    materials.wood = woodMat;
    var bridgeLightMat = new THREE.MeshStandardMaterial({
      color: 0x2a2f33, roughness: 0.5, metalness: 0.3,
      emissive: new THREE.Color(0xffe9c4), emissiveIntensity: 0.05
    });
    materials.bridgeLight = bridgeLightMat;

    /* ---------------- 地面 / 江岸底板 ---------------- */

    function buildGround() {
      var landMat = new THREE.MeshStandardMaterial({ map: textures.urban, color: 0xffffff, roughness: 0.96, metalness: 0.0 });
      materials.land = landMat;

      var southLand = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), landMat);
      southLand.rotation.x = -Math.PI / 2;
      southLand.position.set(0, -0.05, 6937.5);
      southLand.receiveShadow = true;
      root.add(southLand);

      var northLand = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), landMat);
      northLand.rotation.x = -Math.PI / 2;
      northLand.position.set(0, -0.05, -7700);
      northLand.receiveShadow = true;
      root.add(northLand);

      var south = new THREE.Mesh(
        new THREE.PlaneGeometry(5200, 545),
        new THREE.MeshStandardMaterial({ map: textures.plazaStone, color: 0xb5b4ac, roughness: 0.92, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
      );
      south.rotation.x = -Math.PI / 2;
      south.position.set(0, -0.02, 147.5);
      south.receiveShadow = true;
      root.add(south);
    }

    /* ---------------- 塔身 24 / 46 / 1104 ---------------- */

    function triCount(geo, instances) {
      var per = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      return per * instances;
    }

    function nodeRadiusFor(y) {
      var ext = bodyExtents(y);
      return clamp(0.18 + (ext.rx + ext.rz) * 0.012, 0.3, 0.62);
    }

    function buildLattice() {
      latticeGroup = new THREE.Group();
      latticeGroup.name = "lattice";
      root.add(latticeGroup);

      var radial = low ? 6 : 8;
      var colGeo = new THREE.CylinderGeometry(0.6, 1.0, 1, radial, 1, true);
      var columns = new THREE.InstancedMesh(colGeo, steelMat, N);
      var up = new THREE.Vector3(0, 1, 0);
      var dummy = new THREE.Object3D();
      for (var i = 0; i < N; i++) {
        var a = bottomPoint(i);
        var b = topPoint(i);
        var dir = b.clone().sub(a);
        var len = dir.length();
        var mid = a.clone().add(b).multiplyScalar(0.5);
        dummy.position.copy(mid);
        dummy.quaternion.copy(quatBetween(a, b, up));
        dummy.scale.set(1, len, 1);
        dummy.updateMatrix();
        columns.setMatrixAt(i, dummy.matrix);
      }
      columns.instanceMatrix.needsUpdate = true;
      latticeGroup.add(columns);

      var ringGeos = [];
      var tubular = low ? 32 : 48;
      var radialTube = low ? 3 : 4;
      ringYs().forEach(function (y) {
        var pts = [];
        for (var k = 0; k < N; k++) pts.push(pointAt(k, y));
        var curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.45);
        ringGeos.push(new THREE.TubeGeometry(curve, tubular, 0.38, radialTube, true));
      });
      var ringGeo = mergeGeos(ringGeos);
      var rings = new THREE.Mesh(ringGeo, steelMat);
      rings.name = "rings";
      latticeGroup.add(rings);
      ringGeos.forEach(function (g) { g.dispose(); });

      var diagGeo = new THREE.CylinderGeometry(0.30, 0.30, 1, low ? 3 : 4, 1, true);
      var diagonals = new THREE.InstancedMesh(diagGeo, steelMat, RING_GROUPS * N);
      var ys = ringYs();
      var di = 0;
      for (var j = 0; j < RING_LEVELS - 1; j++) {
        var sign = (j % 2 === 0) ? 1 : -1;
        for (var c = 0; c < N; c++) {
          var p0 = pointAt(c, ys[j]);
          var p1 = pointAt((c + sign + N) % N, ys[j + 1]);
          dummy.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
          dummy.quaternion.copy(quatBetween(p0, p1, up));
          dummy.scale.set(1, p0.distanceTo(p1), 1);
          dummy.updateMatrix();
          diagonals.setMatrixAt(di++, dummy.matrix);
        }
      }
      diagonals.count = di;
      diagonals.instanceMatrix.needsUpdate = true;
      latticeGroup.add(diagonals);

      var nodeGeo = new THREE.OctahedronGeometry(0.5, 0);
      var nodeItems = [];
      ys.forEach(function (y) {
        var s = nodeRadiusFor(y) / 0.5;
        for (var k = 0; k < N; k++) {
          var p = pointAt(k, y);
          nodeItems.push({ pos: p, scale: new THREE.Vector3(s, s, s) });
        }
      });
      var nodes = makeInstanced(nodeGeo, steelMat, nodeItems);
      nodes.name = "nodes";
      nodes.visible = !low;
      latticeGroup.add(nodes);

      var coreGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
      coreGeo.scale(9.7, BODY_H, 8.1);
      coreGeo.translate(0, BODY_H / 2, 0);
      var core = new THREE.Mesh(coreGeo, coreMat);
      core.name = "core";
      root.add(core);

      var floorGeos = [];
      [84, 116, 147, 168, 334, 355, 428, 433].forEach(function (y) {
        var ext = bodyExtents(y);
        var g = flatEllipseRing(ext.rx - 1.8, ext.rz - 1.8, 0.95, 30);
        g.translate(ext.cx, y, ext.cz);
        floorGeos.push(g);
      });
      var floors = new THREE.Mesh(mergeGeos(floorGeos), new THREE.MeshStandardMaterial({ color: 0x777f84, roughness: 0.7, metalness: 0.28, side: THREE.DoubleSide }));
      floorGeos.forEach(function (g) { g.dispose(); });
      root.add(floors);

      var bandRanges = low ? [[84, 116], [334, 355], [428, 436]] : [[84, 116], [147, 168], [300, 320], [355, 372], [420, 436]];
      var bandGeos = [];
      bandRanges.forEach(function (r) {
        var y0 = r[0], y1 = r[1];
        var ym = (y0 + y1) / 2;
        var ext = bodyExtents(ym);
        var g = new THREE.CylinderGeometry(1, 1, y1 - y0, 32, 1, true);
        g.scale(ext.rx + 0.35, 1, ext.rz + 0.35);
        g.translate(ext.cx, ym, ext.cz);
        bandGeos.push(g);
      });
      var bands = new THREE.Mesh(mergeGeos(bandGeos), glassMat);
      bandGeos.forEach(function (g) { g.dispose(); });
      root.add(bands);

      latticeStats = {
        columns: 24,
        rings: RING_GROUPS,
        ringLevels: RING_LEVELS,
        diagonals: di,
        drawCalls: low ? 3 : 4,
        triangles: triCount(colGeo, 24) + triCount(ringGeo, 1) + triCount(diagGeo, di) + (low ? 0 : triCount(nodeGeo, nodeItems.length)),
        waist: measureWaist()
      };
      return {
        group: latticeGroup,
        columns: columns,
        rings: rings,
        diagonals: diagonals,
        nodes: nodes,
        stats: latticeStats,
        measureWaist: measureWaist,
        pointAt: pointAt
      };
    }

    function measureWaist() {
      var best = Infinity, at = 0;
      for (var k = 0; k <= BODY_H - 2; k += 2) {
        var ext = bodyExtents(k);
        var width = Math.max(ext.rx * 2, ext.rz * 2);
        if (width < best) { best = width; at = k; }
      }
      return { waist: +best.toFixed(1), at: at };
    }

    /* ---------------- 塔基裙摆 / 玻璃大厅 ---------------- */

    function buildBase() {
      var lobbyGeo = new THREE.CylinderGeometry(1, 1, 1, 36, 1, true);
      lobbyGeo.scale(42, 30, 32);
      lobbyGeo.translate(0, 15, 0);
      var lobby = new THREE.Mesh(lobbyGeo, glassMat);
      root.add(lobby);

      var roof = new THREE.Mesh(flatEllipseRing(44, 34, 0.9, 40), whiteMat);
      roof.position.y = 30;
      root.add(roof);

      var footItems = [];
      var up = new THREE.Vector3(0, 1, 0);
      for (var i = 0; i < N; i++) {
        var base = bottomPoint(i);
        var foot = new THREE.Vector3(base.x * 1.62, 0, base.z * 1.62);
        var top = base.clone(); top.y = 27;
        footItems.push({
          pos: foot.clone().add(top).multiplyScalar(0.5),
          quat: quatBetween(foot, top, up),
          scale: new THREE.Vector3(1, foot.distanceTo(top), 1)
        });
      }
      var ribGeo = new THREE.CylinderGeometry(0.42, 0.62, 1, low ? 5 : 6, 1, true);
      var ribs = makeInstanced(ribGeo, whiteMat, footItems, { castShadow: false });
      root.add(ribs);

      var ringPts = [];
      for (var k = 0; k < N; k++) { var p = bottomPoint(k); p.y = 27; ringPts.push(p); }
      var skirtRing = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true, "catmullrom", 0.4), low ? 32 : 48, 0.5, low ? 3 : 4, true), whiteMat);
      root.add(skirtRing);

      var plinth = new THREE.Mesh(flatEllipseRing(68, 52, 0.87, 48), graniteMat);
      plinth.position.y = 0.12;
      plinth.receiveShadow = true;
      root.add(plinth);

      var fasciaGeo = new THREE.CylinderGeometry(1, 1, 2.4, 40, 1, true);
      fasciaGeo.scale(68, 1, 52);
      fasciaGeo.translate(0, 1.2, 0);
      var fascia = new THREE.Mesh(fasciaGeo, whiteMat);
      root.add(fascia);
    }

    /* ---------------- 450 m 平台 / 摩天轮 / 488 / 桅杆 ---------------- */

    function buildCrown() {
      var ext = bodyExtents(448);
      var outX = ext.rx + 7;
      var outZ = ext.rz + 7;
      var plat = new THREE.Mesh(flatEllipseRing(outX, outZ, 0.79, 56), deckMat);
      plat.position.y = 449.4;
      plat.rotation.y = 0;
      root.add(plat);

      var rimGeo = new THREE.CylinderGeometry(1, 1, 1.5, 56, 1, true);
      rimGeo.scale(outX, 1, outZ);
      rimGeo.translate(0, 450.1, 0);
      var rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0x3d464c, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }));
      root.add(rim);

      var railGeo = new THREE.CylinderGeometry(1, 1, 1.25, 56, 1, true);
      railGeo.scale(outX - 0.2, 1, outZ - 0.2);
      railGeo.translate(0, 451.5, 0);
      var rail = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({
        color: 0xbcd6de, roughness: 0.16, metalness: 0.2,
        transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide
      }));
      root.add(rail);

      var roofGeo = new THREE.CylinderGeometry(1, 1, 4, 40, 1, true);
      roofGeo.scale(ext.rx + 1.4, 1, ext.rz + 1.4);
      roofGeo.translate(0, 452, 0);
      var roof = new THREE.Mesh(roofGeo, deckMat);
      root.add(roof);

      var crownRim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 4, 56), whiteMat);
      crownRim.rotation.x = Math.PI / 2;
      crownRim.scale.set(ext.rx + 1.4, ext.rz + 1.4, 1);
      crownRim.position.y = 454;
      root.add(crownRim);

      /* 16 舱摩天轮 */
      wheelGroup = new THREE.Group();
      wheelGroup.name = "ferris-wheel";
      wheelGroup.position.y = 0;
      root.add(wheelGroup);

      var track = new THREE.Mesh(new THREE.TorusGeometry(1, 0.014, 4, 72), new THREE.MeshStandardMaterial({ color: 0x7d878e, roughness: 0.45, metalness: 0.6 }));
      track.rotation.x = Math.PI / 2;
      track.scale.set(outX + 2.2, outZ + 2.2, 1);
      track.position.y = 451.8;
      wheelGroup.add(track);

      var cabinGeo = new THREE.CylinderGeometry(1.45, 1.45, 2.35, low ? 8 : 10, 1, false);
      var cabins = new THREE.InstancedMesh(cabinGeo, cabinMat, 16);
      var dummy = new THREE.Object3D();
      for (var i = 0; i < 16; i++) {
        var ang = (i / 16) * Math.PI * 2;
        var x = Math.cos(ang) * (outX + 3.4);
        var z = Math.sin(ang) * (outZ + 3.4);
        dummy.position.set(x, 451.5, z);
        dummy.rotation.set(0, -ang + Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cabins.setMatrixAt(i, dummy.matrix);
      }
      cabins.instanceMatrix.needsUpdate = true;
      wheelGroup.add(cabins);

      var wheelMastGeo = new THREE.CylinderGeometry(0.22, 0.3, 5.2, 6, 1, true);
      var arms = [];
      for (var w = 0; w < 16; w++) {
        var wa = (w / 16) * Math.PI * 2;
        arms.push({
          pos: new THREE.Vector3(Math.cos(wa) * (outX + 1.8), 452.6, Math.sin(wa) * (outZ + 1.8)),
          scale: new THREE.Vector3(1, 2.2, 1)
        });
      }
      wheelGroup.add(makeInstanced(wheelMastGeo, new THREE.MeshStandardMaterial({ color: 0x9aa4aa, roughness: 0.5, metalness: 0.5 }), arms));

      /* 桅杆：454–550 格构，550–600 实腹航空色 */
      var mastGroup = new THREE.Group();
      mastGroup.name = "mast";
      root.add(mastGroup);
      var up = new THREE.Vector3(0, 1, 0);
      var legItems = [];
      var levels = 5;
      var legBase = 4.2, legTop = 1.15;
      var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (var li = 0; li < levels; li++) {
        var y0 = 454 + (550 - 454) * li / levels;
        var y1 = 454 + (550 - 454) * (li + 1) / levels;
        var r0 = legBase + (legTop - legBase) * li / levels;
        var r1 = legBase + (legTop - legBase) * (li + 1) / levels;
        corners.forEach(function (c) {
          var a = new THREE.Vector3(c[0] * r0, y0, c[1] * r0);
          var b = new THREE.Vector3(c[0] * r1, y1, c[1] * r1);
          legItems.push({ pos: a.clone().add(b).multiplyScalar(0.5), quat: quatBetween(a, b, up), scale: new THREE.Vector3(1, a.distanceTo(b), 1) });
        });
        for (var c2 = 0; c2 < 4; c2++) {
          var p0 = new THREE.Vector3(corners[c2][0] * r0, y0, corners[c2][1] * r0);
          var p1 = new THREE.Vector3(corners[(c2 + 1) % 4][0] * r0, y0, corners[(c2 + 1) % 4][1] * r0);
          legItems.push({ pos: p0.clone().add(p1).multiplyScalar(0.5), quat: quatBetween(p0, p1, up), scale: new THREE.Vector3(1, p0.distanceTo(p1), 1) });
          var q0 = new THREE.Vector3(corners[c2][0] * r0, y0, corners[c2][1] * r0);
          var q1 = new THREE.Vector3(corners[(c2 + 1) % 4][0] * r1, y1, corners[(c2 + 1) % 4][1] * r1);
          legItems.push({ pos: q0.clone().add(q1).multiplyScalar(0.5), quat: quatBetween(q0, q1, up), scale: new THREE.Vector3(1, q0.distanceTo(q1), 1) });
        }
      }
      var legGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 4, 1, true);
      mastGroup.add(makeInstanced(legGeo, mastMat, legItems));

      var copperGeo = new THREE.CylinderGeometry(1.35, 3.1, 40, 8, 1, false);
      copperGeo.translate(0, 570, 0);
      mastGroup.add(new THREE.Mesh(copperGeo, mastCopper));

      var upperGeo = new THREE.CylinderGeometry(0.55, 1.35, 10, 8, 1, false);
      upperGeo.translate(0, 595, 0);
      mastGroup.add(new THREE.Mesh(upperGeo, mastAviation));

      var tipGeo = new THREE.ConeGeometry(0.55, 2.2, 6);
      tipGeo.translate(0, 598.9, 0);
      mastGroup.add(new THREE.Mesh(tipGeo, mastMat));

      /* 488 m 白色平台 */
      var platform = new THREE.Mesh(flatEllipseRing(11.5, 11.5, 0.34, 8), whiteMat);
      platform.position.y = 488;
      root.add(platform);
      var platRailGeo = new THREE.CylinderGeometry(1, 1, 1.15, 8, 1, true);
      platRailGeo.scale(11.5, 1, 11.5);
      platRailGeo.translate(0, 488.6, 0);
      root.add(new THREE.Mesh(platRailGeo, new THREE.MeshStandardMaterial({ color: 0xf1f4f5, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide })));
      var armItems = [];
      for (var ai = 0; ai < 8; ai++) {
        var aa = (ai / 8) * Math.PI * 2;
        var ap0 = new THREE.Vector3(0, 486.6, 0);
        var ap1 = new THREE.Vector3(Math.cos(aa) * 10.5, 487.8, Math.sin(aa) * 10.5);
        armItems.push({ pos: ap0.clone().add(ap1).multiplyScalar(0.5), quat: quatBetween(ap0, ap1, up), scale: new THREE.Vector3(1, ap0.distanceTo(ap1), 1) });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.16, 0.16, 1, 4, 1, true), mastMat, armItems));

      /* 455–485 m 极速云霄：双导轨 + 轿厢剪影 */
      var zipItems = [];
      [-1.6, 1.6].forEach(function (dx) {
        var a = new THREE.Vector3(dx, 455, 6.2);
        var b = new THREE.Vector3(dx, 486, 6.2);
        zipItems.push({ pos: a.clone().add(b).multiplyScalar(0.5), quat: quatBetween(a, b, up), scale: new THREE.Vector3(1, a.distanceTo(b), 1) });
      });
      root.add(makeInstanced(new THREE.CylinderGeometry(0.09, 0.09, 1, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x9aa4aa, roughness: 0.45, metalness: 0.55 }), zipItems));
      var zipCar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.6), new THREE.MeshStandardMaterial({ color: 0xd05a3a, roughness: 0.5, metalness: 0.2 }));
      zipCar.position.set(0, 470, 6.4);
      root.add(zipCar);

      /* 航空灯 */
      var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b2f }));
      beacon.position.set(0, 600.4, 0);
      root.add(beacon);
      materials.beacon = beacon.material;
    }

    /* ---------------- 二层平台 / 南广场 / 滨水大台阶 ---------------- */

    function roundedRect(shape, x, z, w, d, r) {
      shape.moveTo(x + r, z);
      shape.lineTo(x + w - r, z);
      shape.quadraticCurveTo(x + w, z, x + w, z + r);
      shape.lineTo(x + w, z + d - r);
      shape.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
      shape.lineTo(x + r, z + d);
      shape.quadraticCurveTo(x, z + d, x, z + d - r);
      shape.lineTo(x, z + r);
      shape.quadraticCurveTo(x, z, x + r, z);
    }

    function buildPlaza() {
      var platformTex = textures.plazaStone.clone();
      platformTex.needsUpdate = true;
      platformTex.repeat.set(0.055, 0.055);
      var platformMat = new THREE.MeshStandardMaterial({ map: platformTex, color: 0xe9e6de, roughness: 0.9, metalness: 0.02 });

      var shape = new THREE.Shape();
      roundedRect(shape, -60, -50, 120, 100, 14);
      var hole = new THREE.Path();
      hole.absellipse(0, 0, 47, 37, 0, Math.PI * 2, true, 0);
      shape.holes.push(hole);
      var platformGeo = new THREE.ExtrudeGeometry(shape, { depth: 7, bevelEnabled: false, curveSegments: 24 });
      platformGeo.rotateX(-Math.PI / 2);
      var platform = new THREE.Mesh(platformGeo, platformMat);
      platform.receiveShadow = true;
      root.add(platform);

      var edgePosts = [];
      var edgeRails = [];
      var perEdge = low ? 9 : 14;
      for (var e = 0; e < 4; e++) {
        for (var ei = 0; ei < perEdge; ei++) {
          var t = (ei + 0.5) / perEdge;
          var px, pz;
          if (e === 0) { px = -60 + 120 * t; pz = -50; }
          else if (e === 1) { px = 60; pz = -50 + 100 * t; }
          else if (e === 2) { px = 60 - 120 * t; pz = 50; }
          else { px = -60; pz = 50 - 100 * t; }
          edgePosts.push({ pos: new THREE.Vector3(px, 7.6, pz), scale: new THREE.Vector3(1, 1, 1) });
        }
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 4, 1, true), whiteMat, edgePosts));
      edgeRails.push({ pos: new THREE.Vector3(0, 8.2, -50), scale: new THREE.Vector3(120, 1, 1) });
      edgeRails.push({ pos: new THREE.Vector3(0, 8.2, 50), scale: new THREE.Vector3(120, 1, 1) });
      edgeRails.push({ pos: new THREE.Vector3(-60, 8.2, 0), scale: new THREE.Vector3(1, 1, 100) });
      edgeRails.push({ pos: new THREE.Vector3(60, 8.2, 0), scale: new THREE.Vector3(1, 1, 100) });
      root.add(makeInstanced(new THREE.BoxGeometry(1, 0.08, 0.08), whiteMat, edgeRails));

      /* 滨水大台阶：14 级，从 y=7 落到 y≈0.5 */
      var stepItems = [];
      var steps = 14;
      for (var s = 0; s < steps; s++) {
        var topY = 7 - (s + 1) * (6.5 / steps);
        stepItems.push({
          pos: new THREE.Vector3(0, topY / 2, -52 - s * 4),
          scale: new THREE.Vector3(176, topY, 4.1)
        });
      }
      var stepsMesh = makeInstanced(new THREE.BoxGeometry(1, 1, 1), graniteMat, stepItems, { receiveShadow: true });
      root.add(stepsMesh);

      var railItems = [];
      var railUp = new THREE.Vector3(0, 1, 0);
      [-80, -40, 0, 40, 80].forEach(function (x) {
        var a = new THREE.Vector3(x, 7.8, -50);
        var b = new THREE.Vector3(x, 1.5, -108);
        railItems.push({ pos: a.clone().add(b).multiplyScalar(0.5), quat: quatBetween(a, b, railUp), scale: new THREE.Vector3(1, a.distanceTo(b), 1) });
      });
      root.add(makeInstanced(new THREE.CylinderGeometry(0.05, 0.05, 1, 4, 1, true), whiteMat, railItems));

      /* 大台阶白色悬挑遮阳（示意） */
      var canopy = new THREE.Mesh(new THREE.BoxGeometry(66, 0.9, 11), whiteMat);
      canopy.position.set(-6, 13.4, -80);
      canopy.castShadow = true;
      root.add(canopy);
      var canopyCols = [];
      [-24, 8].forEach(function (x) {
        canopyCols.push({ pos: new THREE.Vector3(x, 10.2, -80), scale: new THREE.Vector3(0.4, 6.4, 0.4) });
      });
      root.add(makeInstanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1), whiteMat, canopyCols, { castShadow: true }));

      /* 南侧二层市民广场 y≈7，z 60–400（邻塔段，向广场纵深延伸） */
      var southPlaza = new THREE.Mesh(new THREE.BoxGeometry(300, 7, 340), plazaMat);
      southPlaza.position.set(0, 3.5, 230);
      southPlaza.receiveShadow = true;
      root.add(southPlaza);

      var southRailItems = [];
      for (var rx = -146; rx <= 146; rx += 8) {
        southRailItems.push({ pos: new THREE.Vector3(rx, 7.65, 398), scale: new THREE.Vector3(1, 1, 1) });
      }
      for (var rz2 = 66; rz2 < 398; rz2 += 12) {
        southRailItems.push({ pos: new THREE.Vector3(-148, 7.65, rz2), scale: new THREE.Vector3(1, 1, 1) });
        southRailItems.push({ pos: new THREE.Vector3(148, 7.65, rz2), scale: new THREE.Vector3(1, 1, 1) });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 4, 1, true), whiteMat, southRailItems));

      /* 映塔水池：可读水面（天空反射 + 塔影 + 涟漪）+ 石缘 + 涟漪铺装 */
      poolUniforms = {
        uTime: { value: 0 },
        uMode: { value: 0 },
        uDeep: { value: new THREE.Color(0x2a5f6e).convertSRGBToLinear() },
        uShallow: { value: new THREE.Color(0x6c9daa).convertSRGBToLinear() },
        uSky: { value: new THREE.Color(0xd6e5ea).convertSRGBToLinear() },
        uNight0: { value: new THREE.Color(0x2fd4c8).convertSRGBToLinear() },
        uNight1: { value: new THREE.Color(0xffd166).convertSRGBToLinear() },
        uNight2: { value: new THREE.Color(0x6f5cff).convertSRGBToLinear() },
        uFogColor: { value: new THREE.Color(0xc3d5dd).convertSRGBToLinear() },
        uFogDensity: { value: 0.00026 }
      };
      var poolMat = new THREE.ShaderMaterial({
        uniforms: poolUniforms,
        vertexShader: [
          "varying vec3 vWorld;",
          "varying float vFogDepth;",
          "void main() {",
          "  vec4 world = modelMatrix * vec4(position, 1.0);",
          "  vWorld = world.xyz;",
          "  vec4 mv = viewMatrix * world;",
          "  vFogDepth = -mv.z;",
          "  gl_Position = projectionMatrix * mv;",
          "}"
        ].join("\n"),
        fragmentShader: [
          "uniform float uTime;",
          "uniform float uMode;",
          "uniform vec3 uDeep;",
          "uniform vec3 uShallow;",
          "uniform vec3 uSky;",
          "uniform vec3 uNight0;",
          "uniform vec3 uNight1;",
          "uniform vec3 uNight2;",
          "uniform vec3 uFogColor;",
          "uniform float uFogDensity;",
          "varying vec3 vWorld;",
          "varying float vFogDepth;",
          "void main() {",
          "  vec2 p = vec2(vWorld.x, vWorld.z - 138.0);",
          "  float r = length(p * vec2(1.0, 1.3));",
          "  float ring = sin(r * 0.85 - uTime * 1.15) * 0.5 + 0.5;",
          "  float fine = (sin(vWorld.x * 2.3 + uTime * 0.8) * sin(vWorld.z * 2.7 - uTime * 0.65)) * 0.5 + 0.5;",
          "  float band = exp(-(vWorld.x * vWorld.x) / 26.0) * (1.0 - smoothstep(128.0, 150.0, vWorld.z));",
          "  vec3 day = mix(uDeep, uShallow, 0.44 + 0.16 * ring);",
          "  day += uSky * (0.12 + 0.05 * fine);",
          "  vec3 refl = mix(uSky, vec3(0.86, 0.9, 0.92), 0.55) * (0.55 + 0.16 * ring);",
          "  vec3 dayCol = mix(day, refl, 0.45 * band) + vec3(0.02, 0.035, 0.04) * fine;",
          "  vec3 night = mix(vec3(0.02, 0.075, 0.10), vec3(0.03, 0.16, 0.19), 0.3 + 0.45 * ring);",
          "  night += uNight0 * band * 0.34 * (0.7 + 0.3 * fine);",
          "  night += uNight1 * band * 0.42;",
          "  night += uNight2 * band * 0.12;",
          "  vec3 col;",
          "  if (uMode > 1.5) col = night;",
          "  else if (uMode > 0.5) col = mix(dayCol * 0.9, dayCol * 0.62 + night * 0.55, 0.55);",
          "  else col = dayCol;",
          "  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);",
          "  col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));",
          "  gl_FragColor = vec4(col, 1.0);",
          "  #include <tonemapping_fragment>",
          "  #include <encodings_fragment>",
          "}"
        ].join("\n")
      });
      var poolGeo = new THREE.PlaneGeometry(30, 20);
      poolGeo.rotateX(-Math.PI / 2);
      var pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.set(0, 7.16, 138);
      root.add(pool);

      var copingItems = [
        { pos: new THREE.Vector3(0, 7.22, 127.25), scale: new THREE.Vector3(33, 0.44, 1.5) },
        { pos: new THREE.Vector3(0, 7.22, 148.75), scale: new THREE.Vector3(33, 0.44, 1.5) },
        { pos: new THREE.Vector3(-15.75, 7.22, 138), scale: new THREE.Vector3(1.5, 0.44, 20) },
        { pos: new THREE.Vector3(15.75, 7.22, 138), scale: new THREE.Vector3(1.5, 0.44, 20) }
      ];
      root.add(makeInstanced(new THREE.BoxGeometry(1, 1, 1), copingMat, copingItems));

      var apron = new THREE.Mesh(flatEllipseRing(48, 33, 0.32, 72), new THREE.MeshStandardMaterial({ map: textures.ripplePaving, color: 0xb9b4a9, roughness: 0.9 }));
      apron.position.set(0, 7.03, 138);
      root.add(apron);
      var poolInlay = new THREE.Mesh(flatEllipseRing(19.5, 14, 0.9, 64), new THREE.MeshStandardMaterial({ color: 0x767c7e, roughness: 0.8 }));
      poolInlay.position.set(0, 7.05, 138);
      root.add(poolInlay);

      var poolPlanterItems = [];
      var poolHedgeItems = [];
      [[-27, 120], [27, 120], [-27, 156], [27, 156]].forEach(function (pp) {
        poolPlanterItems.push({ pos: new THREE.Vector3(pp[0], 7.55, pp[1]), scale: new THREE.Vector3(8, 1.1, 8) });
        poolHedgeItems.push({ pos: new THREE.Vector3(pp[0], 8.5, pp[1]), scale: new THREE.Vector3(6.8, 1.1, 6.8) });
      });
      root.add(makeInstanced(new THREE.BoxGeometry(1, 1, 1), graniteMat, poolPlanterItems));
      root.add(makeInstanced(new THREE.BoxGeometry(1, 1, 1), leafMat, poolHedgeItems));

      var poolBenchItems = [];
      [[-21, 138], [21, 138]].forEach(function (bp) {
        poolBenchItems.push({ pos: new THREE.Vector3(bp[0], 7.35, bp[1]), scale: new THREE.Vector3(1.6, 0.5, 5.4) });
      });
      [[-14, 162], [14, 162]].forEach(function (bp) {
        poolBenchItems.push({ pos: new THREE.Vector3(bp[0], 7.42, bp[1]), scale: new THREE.Vector3(6.4, 0.55, 1.7) });
        poolBenchItems.push({ pos: new THREE.Vector3(bp[0], 7.9, bp[1] + 0.9), scale: new THREE.Vector3(6.4, 0.9, 0.22) });
      });
      root.add(makeInstanced(new THREE.BoxGeometry(1, 1, 1), woodMat, poolBenchItems));

      var forePave = new THREE.Mesh(new THREE.PlaneGeometry(86, 8), new THREE.MeshStandardMaterial({ map: textures.ripplePaving, color: 0xc6c0b4, roughness: 0.86 }));
      forePave.rotation.x = -Math.PI / 2;
      forePave.position.set(0, 7.04, 158);
      root.add(forePave);

      var bollardItems = [];
      var bollardLights = [];
      [[-18, 126], [18, 126], [-18, 150], [18, 150], [-40, 132], [-40, 144], [40, 132], [40, 144]].forEach(function (bp2) {
        bollardItems.push({ pos: new THREE.Vector3(bp2[0], 7.5, bp2[1]), scale: new THREE.Vector3(1, 1, 1) });
        bollardLights.push([bp2[0], 8.15, bp2[1]]);
      });
      root.add(makeInstanced(new THREE.CylinderGeometry(0.13, 0.16, 1.1, 6, 1), new THREE.MeshStandardMaterial({ color: 0xc7ced1, roughness: 0.5, metalness: 0.4 }), bollardItems));
      var bollardGeo = new THREE.BufferGeometry();
      var blp = [];
      bollardLights.forEach(function (p) { blp.push(p[0], p[1], p[2]); });
      bollardGeo.setAttribute("position", new THREE.Float32BufferAttribute(blp, 3));
      var bollardMat = new THREE.PointsMaterial({
        color: 0xffd9a3, size: 2.2, map: textures.glow, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      glowMats.push(bollardMat);
      root.add(new THREE.Points(bollardGeo, bollardMat));

      /* 两翼商业体量（只做外壳） */
      [-1, 1].forEach(function (side) {
        var wing = new THREE.Mesh(new THREE.BoxGeometry(34, 16, 96), graniteMat);
        wing.position.set(side * 78, 7 + 8, 165);
        wing.castShadow = true;
        wing.receiveShadow = true;
        root.add(wing);
        var strip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 88), glassMat);
        strip.position.set(side * 60.2, 7 + 8.5, 165);
        root.add(strip);
      });

      /* 媒体港/周边体量（放在海心桥南端西侧，避开南岸回望视线） */
      var mediaA = new THREE.Mesh(new THREE.BoxGeometry(56, 28, 46), cityMat);
      mediaA.position.set(-660, 14, -62);
      mediaA.castShadow = true;
      root.add(mediaA);
      var mediaB = new THREE.Mesh(new THREE.BoxGeometry(44, 20, 38), cityMat);
      mediaB.position.set(-740, 10, -8);
      mediaB.castShadow = true;
      root.add(mediaB);

      /* 白色弧形挡墙（台阶两端） */
      [-1, 1].forEach(function (side) {
        var wall = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 6.5, 20, 1, true, side > 0 ? -0.9 : Math.PI - 0.9, 1.8), whiteMat);
        wall.position.set(side * 94, 3.4, -70);
        root.add(wall);
      });

      /* 南岸滨水步道 */
      var promenade = new THREE.Mesh(new THREE.BoxGeometry(900, 0.7, 22), plazaMat);
      promenade.position.set(0, 0.35, -111);
      promenade.receiveShadow = true;
      root.add(promenade);

      var promPosts = [];
      for (var px = -430; px <= 430; px += 6) {
        promPosts.push({ pos: new THREE.Vector3(px, 1.35, -121), scale: new THREE.Vector3(1, 1, 1) });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 4, 1, true), whiteMat, promPosts));
      var promRails = [
        { pos: new THREE.Vector3(0, 2.25, -121), scale: new THREE.Vector3(860, 1, 1) },
        { pos: new THREE.Vector3(0, 1.55, -121), scale: new THREE.Vector3(860, 1, 1) }
      ];
      root.add(makeInstanced(new THREE.BoxGeometry(1, 0.07, 0.07), whiteMat, promRails));

      var planters = [];
      for (var bx = -400; bx <= 400; bx += 40) {
        planters.push({ pos: new THREE.Vector3(bx, 0.95, -112), scale: new THREE.Vector3(10, 0.9, 4) });
      }
      root.add(makeInstanced(new THREE.BoxGeometry(1, 1, 1), graniteMat, planters));

      /* 灯柱 + 灯点 */
      var poleItems = [];
      var lampPositions = [];
      for (var lx = -420; lx <= 420; lx += 30) {
        poleItems.push({ pos: new THREE.Vector3(lx, 3.1, -116), scale: new THREE.Vector3(1, 1, 1) });
        lampPositions.push([lx, 6.1, -116]);
      }
      for (var lz = 92; lz <= 380; lz += 32) {
        [-22, 22].forEach(function (x) {
          poleItems.push({ pos: new THREE.Vector3(x, 10.4, lz), scale: new THREE.Vector3(1, 1, 1) });
          lampPositions.push([x, 14.2, lz]);
        });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.09, 0.12, 6, 5, 1), new THREE.MeshStandardMaterial({ color: 0xc7ced1, roughness: 0.5, metalness: 0.4 }), poleItems));
      var lampGeo = new THREE.BufferGeometry();
      var lp = [];
      lampPositions.forEach(function (p) { lp.push(p[0], p[1], p[2]); });
      lampGeo.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
      var lampMat = new THREE.PointsMaterial({
        color: 0xffd9a3, size: 2.6, map: textures.glow, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      glowMats.push(lampMat);
      root.add(new THREE.Points(lampGeo, lampMat));
    }

    /* ---------------- 植被 ---------------- */

    function buildTrees() {
      var positions = [];
      for (var gx = -138; gx <= 138; gx += 22) {
        for (var gz = 96; gz <= 372; gz += 28) {
          if (Math.abs(gx) < 48) continue;
          positions.push([gx + (rnd() - 0.5) * 6, 7, gz + (rnd() - 0.5) * 8]);
        }
      }
      for (var rx = -270; rx <= 270; rx += 18) {
        positions.push([rx + (rnd() - 0.5) * 4, 0.9, -108 + (rnd() - 0.5) * 3]);
      }
      for (var hx = -220; hx <= 220; hx += 22) {
        positions.push([hx + (rnd() - 0.5) * 8, 1, -792 + (rnd() - 0.5) * 40]);
      }
      for (var nbx = -640; nbx <= 640; nbx += 28) {
        positions.push([nbx + (rnd() - 0.5) * 6, 0.6, -726 + (rnd() - 0.5) * 8]);
      }
      for (var az = -960; az >= -1960; az -= 30) {
        positions.push([-62 + (rnd() - 0.5) * 8, 0.6, az]);
        positions.push([62 + (rnd() - 0.5) * 8, 0.6, az]);
      }
      for (var az2 = -1060; az2 >= -1520; az2 -= 46) {
        positions.push([-154 + (rnd() - 0.5) * 14, 0.4, az2]);
        positions.push([154 + (rnd() - 0.5) * 14, 0.4, az2]);
      }
      var limit = low ? 110 : 260;
      positions = positions.slice(0, limit);

      var canopyGeo = new THREE.IcosahedronGeometry(1, 0);
      var trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 1, 5, 1, true);
      var canopyItems = [];
      var trunkItems = [];
      positions.forEach(function (p, i) {
        var h = 3.4 + rnd() * 2.2;
        var r = 2.9 + rnd() * 2.1;
        trunkItems.push({ pos: new THREE.Vector3(p[0], p[1] + h / 2, p[2]), scale: new THREE.Vector3(1, h, 1) });
        canopyItems.push({
          pos: new THREE.Vector3(p[0], p[1] + h + r * 0.72, p[2]),
          scale: new THREE.Vector3(r, r * (0.82 + rnd() * 0.3), r),
          color: new THREE.Color().setHSL(0.245 + rnd() * 0.05, 0.28 + rnd() * 0.16, 0.27 + rnd() * 0.13)
        });
      });
      var trunks = makeInstanced(trunkGeo, trunkMat, trunkItems);
      var canopies = makeInstanced(canopyGeo, leafMat, canopyItems, { castShadow: true });
      canopies.castShadow = true;
      root.add(trunks);
      root.add(canopies);
    }

    /* ---------------- 珠江 ---------------- */

    function buildRiver() {
      var uniforms = {
        uTime: { value: 0 },
        uMode: { value: 0 },
        uDeep: { value: new THREE.Color(0x16323d).convertSRGBToLinear() },
        uShallow: { value: new THREE.Color(0x2f5361).convertSRGBToLinear() },
        uSky: { value: new THREE.Color(0xa8c9dc).convertSRGBToLinear() },
        uNight0: { value: new THREE.Color(0x2fd4c8).convertSRGBToLinear() },
        uNight1: { value: new THREE.Color(0xffd166).convertSRGBToLinear() },
        uNight2: { value: new THREE.Color(0x6f5cff).convertSRGBToLinear() },
        uFogColor: { value: new THREE.Color(0xc3d5dd).convertSRGBToLinear() },
        uFogDensity: { value: 0.00026 }
      };
      waterMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: [
          "varying vec3 vWorld;",
          "varying float vFogDepth;",
          "void main() {",
          "  vec4 world = modelMatrix * vec4(position, 1.0);",
          "  vWorld = world.xyz;",
          "  vec4 mv = viewMatrix * world;",
          "  vFogDepth = -mv.z;",
          "  gl_Position = projectionMatrix * mv;",
          "}"
        ].join("\n"),
        fragmentShader: [
          "uniform float uTime;",
          "uniform float uMode;",
          "uniform vec3 uDeep;",
          "uniform vec3 uShallow;",
          "uniform vec3 uSky;",
          "uniform vec3 uNight0;",
          "uniform vec3 uNight1;",
          "uniform vec3 uNight2;",
          "uniform vec3 uFogColor;",
          "uniform float uFogDensity;",
          "varying vec3 vWorld;",
          "varying float vFogDepth;",
          "void main() {",
          "  float w = sin(vWorld.x * 0.055 + uTime * 0.35) * 0.5 + sin(vWorld.z * 0.11 - uTime * 0.27) * 0.5;",
          "  float fine = sin(vWorld.x * 0.32 + vWorld.z * 0.21 + uTime * 0.8) * 0.5 + 0.5;",
          "  vec3 viewDir = normalize(cameraPosition - vWorld);",
          "  float fres = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 4.0);",
          "  vec3 day = mix(uDeep, uShallow, 0.46 + 0.06 * w);",
          "  day = mix(day, uSky * (0.72 + 0.1 * w), 0.12 + 0.34 * fres);",
          "  day += uSky * 0.04 * smoothstep(0.72, 1.0, fine);",
          "  float sparkle = pow(max(sin(vWorld.x * 0.9 + uTime * 1.3) * sin(vWorld.z * 0.7 - uTime * 1.1), 0.0), 10.0);",
          "  day += uSky * 0.16 * sparkle;",
          "  float wave = sin(vWorld.x * 0.42 + sin(vWorld.z * 0.09 + uTime * 0.3) * 2.2 + uTime * 0.9);",
          "  day *= 0.9 + 0.16 * wave;",
          "  vec2 p = vec2(vWorld.x / 72.0, (vWorld.z + 280.0) / 170.0);",
          "  float streak = exp(-dot(p, p) * 1.35);",
          "  float along = smoothstep(-700.0, -130.0, vWorld.z);",
          "  float towerBand = exp(-(vWorld.x * vWorld.x) / 4000.0) * smoothstep(-360.0, -130.0, vWorld.z) * (0.6 + 0.4 * fine);",
          "  float h = clamp((vWorld.z + 700.0) / 575.0, 0.0, 1.0);",
          "  vec3 night = mix(uNight0, uNight1, smoothstep(0.1, 0.55, h));",
          "  night = mix(night, uNight2, smoothstep(0.55, 1.0, h));",
          "  night *= 0.5 + 0.4 * w;",
          "  vec3 refl = night * (streak * 1.2 + towerBand * 0.6) * along;",
          "  vec3 col;",
          "  if (uMode > 1.5) col = day * 0.16 + refl * 1.8 + vec3(0.03, 0.05, 0.08) * fine;",
          "  else if (uMode > 0.5) col = day * 0.92 + refl * 0.5 + uSky * 0.035 * fine;",
          "  else col = day;",
          "  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);",
          "  col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));",
          "  gl_FragColor = vec4(col, 1.0);",
          "  #include <tonemapping_fragment>",
          "  #include <encodings_fragment>",
          "}"
        ].join("\n")
      });
      var waterGeo = new THREE.PlaneGeometry(14000, 575);
      waterGeo.rotateX(-Math.PI / 2);
      var water = new THREE.Mesh(waterGeo, waterMat);
      water.position.set(0, -3, -412.5);
      root.add(water);

      var southQuay = new THREE.Mesh(new THREE.BoxGeometry(14000, 3.4, 5), new THREE.MeshStandardMaterial({ color: 0xa8aaa3, roughness: 0.9 }));
      southQuay.position.set(0, -1.5, -124);
      root.add(southQuay);
      var northQuay = new THREE.Mesh(new THREE.BoxGeometry(14000, 3.4, 5), new THREE.MeshStandardMaterial({ color: 0x7d8484, roughness: 0.9 }));
      northQuay.position.set(0, -1.5, -701);
      root.add(northQuay);

      /* 北岸滨江步道 + 栏杆（对岸层次，也为塔顶俯视提供江岸线） */
      var northProm = new THREE.Mesh(new THREE.BoxGeometry(1600, 0.9, 26), new THREE.MeshStandardMaterial({ map: textures.plazaStone, color: 0xbfc1bb, roughness: 0.9 }));
      northProm.position.set(0, 0.5, -712);
      root.add(northProm);
      var nbPosts = [];
      for (var npx = -780; npx <= 780; npx += 7) {
        nbPosts.push({ pos: new THREE.Vector3(npx, 1.35, -700), scale: new THREE.Vector3(1, 1, 1) });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.055, 0.055, 1.7, 4, 1, true), whiteMat, nbPosts));
      root.add(makeInstanced(new THREE.BoxGeometry(1, 0.07, 0.07), whiteMat, [
        { pos: new THREE.Vector3(0, 2.15, -700), scale: new THREE.Vector3(1560, 1, 1) },
        { pos: new THREE.Vector3(0, 1.4, -700), scale: new THREE.Vector3(1560, 1, 1) }
      ]));

      var boats = [
        { pos: new THREE.Vector3(-40, -2.2, -300), scale: new THREE.Vector3(24, 2.2, 7.4) },
        { pos: new THREE.Vector3(250, -2.25, -380), scale: new THREE.Vector3(20, 1.9, 6.6) }
      ];
      root.add(makeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3c4a52, roughness: 0.7, metalness: 0.1 }), boats));
      var boatCabins = [
        { pos: new THREE.Vector3(-43, 0.1, -300), scale: new THREE.Vector3(12, 2.2, 5.4) },
        { pos: new THREE.Vector3(248, 0.05, -380), scale: new THREE.Vector3(10, 1.8, 4.8) }
      ];
      root.add(makeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe2e6e5, roughness: 0.55 }), boatCabins));
    }

    /* ---------------- 海心桥 ---------------- */

    function buildDeckBand(points, halfWidth, thickness) {
      var pos = [], nor = [], uv = [], idx = [];
      var len = points.length;
      for (var i = 0; i < len; i++) {
        var p = points[i];
        var prev = points[Math.max(0, i - 1)];
        var next = points[Math.min(len - 1, i + 1)];
        var tx = next.x - prev.x, tz = next.z - prev.z;
        var tl = Math.hypot(tx, tz) || 1;
        var nx = -tz / tl, nz = tx / tl;
        var lx = p.x - nx * halfWidth, lz = p.z - nz * halfWidth;
        var rx = p.x + nx * halfWidth, rz = p.z + nz * halfWidth;
        pos.push(lx, p.y, lz, rx, p.y, rz, lx, p.y - thickness, lz, rx, p.y - thickness, rz);
        nor.push(0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0);
        uv.push(i / len, 0, i / len, 1, i / len, 0, i / len, 1);
      }
      for (var j = 0; j < len - 1; j++) {
        var a = j * 4, b = (j + 1) * 4;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
        idx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3);
        idx.push(a, a + 2, b, b, a + 2, b + 2);
        idx.push(a + 1, b + 1, a + 3, b + 1, b + 3, a + 3);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    }

    function buildBridge() {
      var control = [
        new THREE.Vector3(-400, 12, -90),
        new THREE.Vector3(-392, 13, -210),
        new THREE.Vector3(-410, 14, -360),
        new THREE.Vector3(-400, 13.5, -500),
        new THREE.Vector3(-400, 12, -578)
      ];
      var curve = new THREE.CatmullRomCurve3(control, false, "catmullrom", 0.4);
      var pts = curve.getPoints(low ? 36 : 64);
      var deck = new THREE.Mesh(buildDeckBand(pts, 7.5, 0.65), bridgeMat);
      root.add(deck);

      var archPts = [];
      for (var i = 0; i <= 24; i++) {
        var t = i / 24;
        var z = -206 - t * 198;
        var y = 13.5 + Math.sin(t * Math.PI) * 35;
        var x = -404 + Math.sin(t * Math.PI) * 10;
        archPts.push(new THREE.Vector3(x, y, z));
      }
      var archCurve = new THREE.CatmullRomCurve3(archPts, false, "catmullrom", 0.5);
      var arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, low ? 32 : 56, 1.55, low ? 4 : 6, false), bridgeMat);
      root.add(arch);

      var pierItems = [];
      [-150, -260, -430, -530].forEach(function (pz) {
        pierItems.push({ pos: new THREE.Vector3(-402, 5, pz), scale: new THREE.Vector3(1, 16, 1) });
      });
      root.add(makeInstanced(new THREE.CylinderGeometry(1.05, 1.45, 1, 6), whiteMat, pierItems));

      var hangers = [];
      for (var h = 1; h < 12; h++) {
        var t2 = h / 12;
        var az = -206 - t2 * 198;
        var ay = 13.5 + Math.sin(t2 * Math.PI) * 35;
        var ax = -404 + Math.sin(t2 * Math.PI) * 10;
        var a = new THREE.Vector3(ax, ay, az);
        var b = new THREE.Vector3(ax * 0.998, 13.4, az);
        hangers.push({ pos: a.clone().add(b).multiplyScalar(0.5), quat: quatBetween(a, b, new THREE.Vector3(0, 1, 0)), scale: new THREE.Vector3(1, a.distanceTo(b), 1) });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.09, 0.09, 1, 4, 1, true), materials.bridgeRail, hangers));

      var bridgePosts = [];
      for (var s = 0; s < pts.length; s += 2) {
        var p = pts[s];
        bridgePosts.push({ pos: new THREE.Vector3(p.x - 7.2, p.y + 0.75, p.z), scale: new THREE.Vector3(1, 1, 1) });
        bridgePosts.push({ pos: new THREE.Vector3(p.x + 7.2, p.y + 0.75, p.z), scale: new THREE.Vector3(1, 1, 1) });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4, 1, true), materials.bridgeRail, bridgePosts));

      var leftRailPts = [], rightRailPts = [];
      pts.forEach(function (p, i) {
        if (i % 4 !== 0) return;
        leftRailPts.push(new THREE.Vector3(p.x - 7.2, p.y + 1.5, p.z));
        rightRailPts.push(new THREE.Vector3(p.x + 7.2, p.y + 1.5, p.z));
      });
      if (leftRailPts.length > 2) {
        var railGeos = [
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftRailPts), 40, 0.06, 3, false),
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightRailPts), 40, 0.06, 3, false)
        ];
        root.add(new THREE.Mesh(mergeGeos(railGeos), materials.bridgeRail));
      }

      var bridgePoleItems = [];
      for (var bp = 0; bp < pts.length; bp += 16) {
        var bpp = pts[bp];
        bridgePoleItems.push({ pos: new THREE.Vector3(bpp.x - 7.2, bpp.y + 2.2, bpp.z), scale: new THREE.Vector3(1, 4.4, 1) });
        bridgePoleItems.push({ pos: new THREE.Vector3(bpp.x + 7.2, bpp.y + 2.2, bpp.z), scale: new THREE.Vector3(1, 4.4, 1) });
      }
      root.add(makeInstanced(new THREE.CylinderGeometry(0.08, 0.1, 1, 4, 1), materials.bridgeRail, bridgePoleItems));

      var stripPtsL = [], stripPtsR = [];
      pts.forEach(function (p, i) {
        if (i % 2 !== 0) return;
        stripPtsL.push(new THREE.Vector3(p.x - 7.3, p.y + 0.42, p.z));
        stripPtsR.push(new THREE.Vector3(p.x + 7.3, p.y + 0.42, p.z));
      });
      if (stripPtsL.length > 2) {
        var stripGeo = mergeGeos([
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripPtsL), low ? 40 : 80, 0.09, 4, false),
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripPtsR), low ? 40 : 80, 0.09, 4, false)
        ]);
        root.add(new THREE.Mesh(stripGeo, bridgeLightMat));
      }

      var bridgeGlowPos = [];
      for (var bg = 0; bg < pts.length; bg += 3) {
        var bgp = pts[bg];
        bridgeGlowPos.push(bgp.x - 7.2, bgp.y + 1.2, bgp.z);
        bridgeGlowPos.push(bgp.x + 7.2, bgp.y + 1.2, bgp.z);
      }
      for (var ag = 0; ag <= 24; ag++) {
        var agt = ag / 24;
        var agz = -206 - agt * 198;
        var agy = 13.5 + Math.sin(agt * Math.PI) * 35;
        var agx = -404 + Math.sin(agt * Math.PI) * 10;
        bridgeGlowPos.push(agx, agy + 1.8, agz);
      }
      var bridgeGlowGeo = new THREE.BufferGeometry();
      bridgeGlowGeo.setAttribute("position", new THREE.Float32BufferAttribute(bridgeGlowPos, 3));
      var bridgeGlowMat = new THREE.PointsMaterial({
        color: 0xfff1d6, size: 2.0, map: textures.glow, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      glowMats.push(bridgeGlowMat);
      root.add(new THREE.Points(bridgeGlowGeo, bridgeGlowMat));
    }

    /* ---------------- 海心沙 / 花城中轴 / CBD ---------------- */

    function farZ(z) {
      return z > -800 ? z : -800 + (z + 800) * 0.6;
    }

    function buildCity() {
      var island = new THREE.Mesh(new THREE.BoxGeometry(540, 1.2, 150), new THREE.MeshStandardMaterial({ color: 0x5a6b58, roughness: 0.9 }));
      island.position.set(0, 0.2, -792);
      root.add(island);
      var stand = new THREE.Mesh(new THREE.BoxGeometry(190, 12, 56), new THREE.MeshStandardMaterial({ color: 0xc9cbc4, roughness: 0.8 }));
      stand.position.set(-30, 6, -780);
      root.add(stand);
      var stand2 = new THREE.Mesh(new THREE.BoxGeometry(120, 7, 40), new THREE.MeshStandardMaterial({ color: 0xb9bdb6, roughness: 0.8 }));
      stand2.position.set(140, 3.5, -800);
      root.add(stand2);

      /* 北岸 CBD 浅色地面 + 滨江绿带（压掉大片棕色底板） */
      var cbdGround = new THREE.Mesh(new THREE.PlaneGeometry(4400, 2600), cityGroundMat);
      cbdGround.rotation.x = -Math.PI / 2;
      cbdGround.position.set(0, 0.02, -2150);
      root.add(cbdGround);
      var riverPark = new THREE.Mesh(new THREE.PlaneGeometry(2400, 155), parkMat);
      riverPark.rotation.x = -Math.PI / 2;
      riverPark.position.set(0, 0.14, -806);
      root.add(riverPark);

      /* 花城中轴：绿轴 + 中央步道 + 文化广场 + 横街 */
      var axisGreen = new THREE.Mesh(new THREE.PlaneGeometry(130, 1080), parkMat);
      axisGreen.rotation.x = -Math.PI / 2;
      axisGreen.position.set(0, 0.07, -1490);
      root.add(axisGreen);
      var axisWalk = new THREE.Mesh(new THREE.PlaneGeometry(34, 1080), streetMat);
      axisWalk.rotation.x = -Math.PI / 2;
      axisWalk.position.set(0, 0.12, -1490);
      root.add(axisWalk);
      var flatGeo = new THREE.PlaneGeometry(1, 1);
      flatGeo.rotateX(-Math.PI / 2);
      root.add(makeInstanced(flatGeo, streetMat, [
        { pos: new THREE.Vector3(0, 0.1, -1150), scale: new THREE.Vector3(280, 1, 46) },
        { pos: new THREE.Vector3(0, 0.1, -1300), scale: new THREE.Vector3(260, 1, 58) },
        { pos: new THREE.Vector3(0, 0.1, -1450), scale: new THREE.Vector3(220, 1, 34) },
        { pos: new THREE.Vector3(0, 0.1, -1600), scale: new THREE.Vector3(200, 1, 30) }
      ]));
      root.add(makeInstanced(flatGeo, streetMat, [
        { pos: new THREE.Vector3(0, 0.09, -1000), scale: new THREE.Vector3(2600, 1, 18) },
        { pos: new THREE.Vector3(0, 0.09, -1180), scale: new THREE.Vector3(2600, 1, 18) },
        { pos: new THREE.Vector3(0, 0.09, -1360), scale: new THREE.Vector3(2600, 1, 18) },
        { pos: new THREE.Vector3(0, 0.09, -1540), scale: new THREE.Vector3(2600, 1, 18) },
        { pos: new THREE.Vector3(0, 0.09, -1720), scale: new THREE.Vector3(2600, 1, 18) },
        { pos: new THREE.Vector3(0, 0.09, -1900), scale: new THREE.Vector3(2600, 1, 18) },
        { pos: new THREE.Vector3(-430, 0.09, -1600), scale: new THREE.Vector3(20, 1, 2500) },
        { pos: new THREE.Vector3(430, 0.09, -1600), scale: new THREE.Vector3(20, 1, 2500) }
      ]));

      /* 广州大剧院（西）：白色卵石双体量（示意） */
      var operaGeos = [];
      var o1 = new THREE.SphereGeometry(1, 16, 10);
      o1.scale(58, 22, 38);
      o1.translate(-28, 22, 0);
      var o2 = new THREE.SphereGeometry(1, 16, 10);
      o2.scale(40, 18, 32);
      o2.translate(34, 18, 8);
      operaGeos.push(o1, o2);
      var opera = new THREE.Mesh(mergeGeos(operaGeos), operaMat);
      opera.position.set(-185, 0, -1150);
      root.add(opera);
      var operaBase = new THREE.Mesh(new THREE.BoxGeometry(130, 6, 92), streetMat);
      operaBase.position.set(-185, 3, -1150);
      root.add(operaBase);

      /* 广东省博物馆（东）：深色方盒 + 挑出体量 + 红褐内盒 */
      var museum = new THREE.Mesh(new THREE.BoxGeometry(82, 34, 54), museumMat);
      museum.position.set(175, 17, -1195);
      root.add(museum);
      var museumTop = new THREE.Mesh(new THREE.BoxGeometry(64, 12, 46), museumMat);
      museumTop.position.set(185, 40, -1195);
      root.add(museumTop);
      var museumRed = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 30), museumAccentMat);
      museumRed.position.set(143, 26, -1192);
      root.add(museumRed);

      /* 广州图书馆（东）：双层浅灰体量 + 玻璃带 */
      var library = new THREE.Mesh(new THREE.BoxGeometry(74, 30, 48), libraryMat);
      library.position.set(180, 15, -1275);
      root.add(library);
      var libraryTop = new THREE.Mesh(new THREE.BoxGeometry(74, 12, 40), libraryMat);
      libraryTop.position.set(180, 36, -1271);
      root.add(libraryTop);
      var libraryGlass = new THREE.Mesh(new THREE.BoxGeometry(75, 4, 49), glassMat);
      libraryGlass.position.set(180, 17, -1275);
      root.add(libraryGlass);

      /* 西塔 438.6 m / 东塔 530 m / 中信 391 m：窗光 + 冠部灯带 */
      var westGeo = new THREE.CylinderGeometry(17, 30, 438.6, 10, 1, false);
      westGeo.translate(0, 219.3, 0);
      var west = new THREE.Mesh(westGeo, towerMat);
      west.position.set(-188, 0, -1600);
      root.add(west);
      var westCrown = new THREE.Mesh(new THREE.CylinderGeometry(18.2, 18.2, 8, 12, 1, false), towerCrownMat);
      westCrown.position.set(-188, 434, -1600);
      root.add(westCrown);

      var eastGeo = new THREE.CylinderGeometry(20, 34, 530, 4, 1, false);
      eastGeo.rotateY(Math.PI / 4);
      eastGeo.translate(0, 265, 0);
      var east = new THREE.Mesh(eastGeo, towerMat);
      east.position.set(230, 0, -1650);
      root.add(east);
      var eastCrown = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 46), towerCrownMat);
      eastCrown.position.set(230, 524, -1650);
      root.add(eastCrown);

      var citicGeos = [
        new THREE.BoxGeometry(44, 330, 40),
        new THREE.CylinderGeometry(0.6, 3.2, 70, 4, 1, false)
      ];
      citicGeos[0].translate(0, 165, 0);
      citicGeos[1].translate(0, 365, 0);
      var citic = new THREE.Mesh(mergeGeos(citicGeos), towerMat);
      citic.position.set(255, 0, -2140);
      root.add(citic);
      var citicCrown = new THREE.Mesh(new THREE.BoxGeometry(46, 10, 42), towerCrownMat);
      citicCrown.position.set(255, 324, -2140);
      root.add(citicCrown);

      /* 实例化城市块：减量 + 抽高 + 屋顶退台，避开中轴/地标 */
      var nearCount = low ? 80 : 170;
      var blockCount = low ? 230 : 420;
      var blockGeo = new THREE.BoxGeometry(1, 1, 1);
      var blockMesh = new THREE.InstancedMesh(blockGeo, blockMaterials, blockCount);
      var capMesh = new THREE.InstancedMesh(blockGeo, cityMat, blockCount + nearCount);
      var dummy = new THREE.Object3D();
      var placed = 0;
      var capped = 0;
      var guard = 0;
      var cityLightPos = [];
      var cityLightCol = [];
      function addCityLight(x, y, z) {
        cityLightPos.push(x, y, z);
        var warm = rnd() > 0.42;
        var c = new THREE.Color(warm ? 0xffd9a0 : 0xbcd8ff);
        cityLightCol.push(c.r, c.g, c.b);
      }
      function insideZone(bx, bz, cx, cz, rx, rz) {
        return Math.abs(bx - cx) < rx && Math.abs(bz - cz) < rz;
      }
      function blockedZone(bx, bz) {
        if (Math.abs(bx) < 100 && bz < -930) return true;
        if (Math.abs(bx) < 335 && bz < -1110 && bz > -1365) return true;
        if (insideZone(bx, bz, -188, -1600, 85, 85)) return true;
        if (insideZone(bx, bz, 230, -1650, 90, 90)) return true;
        if (insideZone(bx, bz, 255, -2140, 85, 85)) return true;
        return false;
      }
      while (placed < blockCount && guard < blockCount * 16) {
        guard++;
        var x = (rnd() - 0.5) * 3000;
        var rawZ = -870 - rnd() * 2400;
        var z = farZ(rawZ);
        if (blockedZone(x, z)) continue;
        var h = 24 + Math.pow(rnd(), 1.75) * 195;
        var w = 16 + rnd() * 34;
        var d = 16 + rnd() * 34;
        dummy.position.set(x, h / 2, z);
        dummy.scale.set(w, h, d);
        dummy.rotation.set(0, rnd() < 0.5 ? 0 : Math.PI / 2, 0);
        dummy.updateMatrix();
        blockMesh.setMatrixAt(placed, dummy.matrix);
        var tint = 0.62 + rnd() * 0.38;
        blockMesh.setColorAt(placed, new THREE.Color(tint, tint * (0.985 + rnd() * 0.03), tint * (0.96 + rnd() * 0.06)));
        if (placed % 3 === 1) {
          var capH = 5 + rnd() * 16;
          dummy.position.set(x, h + capH / 2 - 0.4, z);
          dummy.scale.set(w * (0.42 + rnd() * 0.3), capH, d * (0.42 + rnd() * 0.3));
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          capMesh.setMatrixAt(capped, dummy.matrix);
          var ct = tint * 0.9;
          capMesh.setColorAt(capped, new THREE.Color(ct, ct, ct * 0.98));
          capped++;
        }
        if (placed % 2 === 0 || h > 150) addCityLight(x + (rnd() - 0.5) * w * 0.5, h + 1.5 + rnd() * 4, z + (rnd() - 0.5) * d * 0.5);
        placed++;
      }
      blockMesh.count = placed;
      blockMesh.instanceMatrix.needsUpdate = true;
      if (blockMesh.instanceColor) blockMesh.instanceColor.needsUpdate = true;
      root.add(blockMesh);

      /* 近岸城市块：填充东西两翼与南侧天际线（避开江面/塔基/桥/媒体港/南广场） */
      var nearGeo = new THREE.BoxGeometry(1, 1, 1);
      var nearMesh = new THREE.InstancedMesh(nearGeo, blockMaterials, nearCount);
      var nearPlaced = 0;
      var nearGuard = 0;
      var blockShadows = [];
      while (nearPlaced < nearCount && nearGuard < nearCount * 24) {
        nearGuard++;
        var nx, nz;
        var roll = rnd();
        if (roll < 0.78) {
          nx = (rnd() < 0.5 ? -1 : 1) * (440 + rnd() * 1200);
          nz = -108 + rnd() * 1000;
        } else {
          nx = (rnd() < 0.5 ? -1 : 1) * (320 + rnd() * 1100);
          nz = -790 + rnd() * 75;
        }
        if (Math.abs(nx) < 330 && nz > -150 && nz < 430) continue;
        if (Math.abs(nx + 470) < 100 && nz > -180 && nz < 40) continue;
        if (nz < -120 && nz > -710) continue;
        if (Math.abs(nx + 400) < 48 && nz > -140) continue;
        if (Math.abs(nx + 520) < 52 && Math.abs(nz + 62) < 54) continue;
        if (Math.abs(nx + 592) < 48 && Math.abs(nz + 8) < 48) continue;
        var nh = 12 + Math.pow(rnd(), 1.6) * 62;
        var nw = 16 + rnd() * 30;
        var nd = 16 + rnd() * 30;
        dummy.position.set(nx, nh / 2, nz);
        dummy.scale.set(nw, nh, nd);
        dummy.rotation.set(0, rnd() < 0.5 ? 0 : Math.PI / 2, 0);
        dummy.updateMatrix();
        nearMesh.setMatrixAt(nearPlaced, dummy.matrix);
        var nt = 0.74 + rnd() * 0.26;
        nearMesh.setColorAt(nearPlaced, new THREE.Color(nt, nt * (0.98 + rnd() * 0.03), nt * (0.95 + rnd() * 0.05)));
        if (nearPlaced % 3 === 1) {
          var ncapH = 4 + rnd() * 10;
          dummy.position.set(nx, nh + ncapH / 2 - 0.3, nz);
          dummy.scale.set(nw * (0.45 + rnd() * 0.25), ncapH, nd * (0.45 + rnd() * 0.25));
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          capMesh.setMatrixAt(capped, dummy.matrix);
          capMesh.setColorAt(capped, new THREE.Color(nt * 0.9, nt * 0.9, nt * 0.88));
          capped++;
        }
        if (nearPlaced % 2 === 0) addCityLight(nx + (rnd() - 0.5) * nw * 0.5, nh + 1.2 + rnd() * 3, nz + (rnd() - 0.5) * nd * 0.5);
        blockShadows.push({ x: nx, z: nz, w: nw, d: nd });
        nearPlaced++;
      }
      nearMesh.count = nearPlaced;
      nearMesh.instanceMatrix.needsUpdate = true;
      if (nearMesh.instanceColor) nearMesh.instanceColor.needsUpdate = true;
      root.add(nearMesh);

      capMesh.count = capped;
      capMesh.instanceMatrix.needsUpdate = true;
      if (capMesh.instanceColor) capMesh.instanceColor.needsUpdate = true;
      root.add(capMesh);

      /* 远景天际线（雾中剪影，避免地平线空成一条棕色直线） */
      var farCount = low ? 90 : 165;
      var farMesh = new THREE.InstancedMesh(blockGeo, cityMat, farCount);
      var farPlaced = 0;
      var farGuard = 0;
      while (farPlaced < farCount && farGuard < farCount * 8) {
        farGuard++;
        var fx = (rnd() - 0.5) * 4600;
        var fz = -2280 - rnd() * 1050;
        var fh = 34 + Math.pow(rnd(), 1.4) * 205;
        var fw = 24 + rnd() * 64;
        var fd = 24 + rnd() * 64;
        dummy.position.set(fx, fh / 2, fz);
        dummy.scale.set(fw, fh, fd);
        dummy.rotation.set(0, rnd() < 0.5 ? 0 : Math.PI / 2, 0);
        dummy.updateMatrix();
        farMesh.setMatrixAt(farPlaced, dummy.matrix);
        var ft = 0.5 + rnd() * 0.28;
        farMesh.setColorAt(farPlaced, new THREE.Color(ft, ft, ft * 0.98));
        farPlaced++;
      }
      farMesh.count = farPlaced;
      farMesh.instanceMatrix.needsUpdate = true;
      if (farMesh.instanceColor) farMesh.instanceColor.needsUpdate = true;
      root.add(farMesh);

      for (var bs = 0; bs < placed; bs++) {
        var bm = new THREE.Matrix4();
        blockMesh.getMatrixAt(bs, bm);
        var bp = new THREE.Vector3().setFromMatrixPosition(bm);
        var bscale = new THREE.Vector3().setFromMatrixScale(bm);
        blockShadows.push({ x: bp.x, z: bp.z, w: bscale.x, d: bscale.z });
      }
      var shadowGeo = new THREE.PlaneGeometry(1, 1);
      shadowGeo.rotateX(-Math.PI / 2);
      var shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false });
      var shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, blockShadows.length);
      for (var sh = 0; sh < blockShadows.length; sh++) {
        var sdat = blockShadows[sh];
        dummy.position.set(sdat.x, 0.09, sdat.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(sdat.w * 1.12, 1, sdat.d * 1.12);
        dummy.updateMatrix();
        shadowMesh.setMatrixAt(sh, dummy.matrix);
      }
      shadowMesh.instanceMatrix.needsUpdate = true;
      root.add(shadowMesh);

      var cityLightGeo = new THREE.BufferGeometry();
      cityLightGeo.setAttribute("position", new THREE.Float32BufferAttribute(cityLightPos, 3));
      cityLightGeo.setAttribute("color", new THREE.Float32BufferAttribute(cityLightCol, 3));
      cityLightMat = new THREE.PointsMaterial({
        size: 2.6, sizeAttenuation: false, map: textures.glow,
        transparent: true, opacity: 0, vertexColors: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      root.add(new THREE.Points(cityLightGeo, cityLightMat));

      /* 猎德大桥远景（东侧） */
      var liedeDeck = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 580), new THREE.MeshStandardMaterial({ color: 0x8c9498, roughness: 0.7 }));
      liedeDeck.position.set(700, 11, -412);
      root.add(liedeDeck);
      var pylonMat = new THREE.MeshStandardMaterial({ color: 0xc6ccce, roughness: 0.6 });
      [-10, 10].forEach(function (dx) {
        var pylon = new THREE.Mesh(new THREE.BoxGeometry(4, 96, 6), pylonMat);
        pylon.position.set(700 + dx, 48, -412);
        root.add(pylon);
      });
      var cableGeo = new THREE.BufferGeometry();
      var cp = [];
      for (var ci = 0; ci < 14; ci++) {
        var cz = -412 + (ci - 6.5) * 34;
        cp.push(690, 90, -412, 700, 12, cz);
        cp.push(710, 90, -412, 700, 12, cz);
      }
      cableGeo.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
      root.add(new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: 0xcfd6d8, transparent: true, opacity: 0.55 })));
    }

    /* ---------------- 热点 ---------------- */

    function buildHotspots() {
      hotspots = [
        {
          id: "height", craft: "height", no: "01", name: "600 · 454 · 146",
          pos: new THREE.Vector3(0, 300, 12),
          view: "river",
          lede: "总高 600 m、塔身 454 m、天线 146 m；原设计 610 m，2010 年因航空限高削减约 10 m 天线。",
          facts: [["总高", "600 m"], ["塔身", "454 m"], ["天线", "146 m"]],
          detail: "450 m 是屋顶/户外观景平台，不是塔顶；488 m 是天线桅杆上的摄影平台，也不是主塔顶。外框筒局部最高 462.7 m 只作结构注脚，不用于总高。"
        },
        {
          id: "lattice", craft: "lattice", no: "02", name: "24 柱 × 46 环 × 1104 斜撑",
          pos: new THREE.Vector3(0, 190, 10),
          view: "lattice",
          lede: "塔身由 24 根笔直斜柱、46 组环梁与 46 个环间 × 24 = 1104 根斜撑编织而成；远看是双曲面，近看柱是直的。",
          facts: [["斜柱", "24 根"], ["环梁", "46 组 + 端环"], ["斜撑", "1104 根"]],
          detail: "底部椭圆 80 × 60 m、腰部约 30 m、顶部 54 × 40.5 m；核心筒内净 17 × 14 m。两个椭圆相对约 45°，24 根柱的对应轴线点约 135°（公开口径的视觉近似，未按施工图复核）。"
        },
        {
          id: "deck", craft: "deck", no: "03", name: "450 m 平台 · 16 舱摩天轮",
          pos: new THREE.Vector3(0, 456, 18),
          view: "deck",
          lede: "450 m 户外观景平台环绕塔身；450–454 m 的横向摩天轮有 16 个 6 人球舱，一周约 20 分钟。",
          facts: [["平台", "450 m"], ["摩天轮", "450–454 m"], ["舱位", "16 × 6 人"]],
          detail: "官方售票常写「460 米摩天轮」，为营销口径；设施高度按 450–454 m。107F 428 m 白云观光大厅、108F 433 m 星空观光大厅只做外观玻璃带，不建内部。deck 视点为无人机示意，非步行可达。"
        },
        {
          id: "mast", craft: "mast", no: "04", name: "488 m 平台 · 极速云霄",
          pos: new THREE.Vector3(0, 492, 10),
          view: "crown",
          lede: "488 m 摄影观景平台位于天线桅杆上；455–485 m 的极速云霄沿桅杆速降，营销常写 480 m。",
          facts: [["488 平台", "488 m"], ["速降", "455–485 m"], ["急坠", "约 30 m"]],
          detail: "桅杆从 454 m 衔接至 600 m：下段白色格构、上段橙铜/航空色，顶部细尖。455–485 m 速降只做轨道与轿厢剪影，不做完整坠落动画；crown 视点为无人机示意，非步行可达。"
        },
        {
          id: "steps", craft: "steps", no: "05", name: "滨水大台阶 · 二层平台",
          pos: new THREE.Vector3(0, 9, -78),
          view: "base",
          lede: "塔北侧的滨水大台阶（缤纷粤秀台）2025-09-29 开放；约 1.2 万㎡ 的二层平台 2025-10-09 试运行。",
          facts: [["大台阶", "2025-09-29"], ["二层平台", "约 1.2 万㎡"], ["滨江段", "约 3.6 km"]],
          detail: "台阶宽度、踏步数与悬挑尺寸未公开，场景按参考图估算并标「示意」；琴键台阶暖光与「珠水涟漪」地砖以材质与灯光表达。二层平台连接塔基玻璃大厅与滨水大台阶；南侧广州塔广场 2024-12-28 开业，总建筑面积约 11.4 万㎡、商业约 5.7 万㎡（本场景只做邻塔段外壳，不做商场内部）。"
        },
        {
          id: "bridge", craft: "bridge", no: "06", name: "海心桥 488 / 198",
          pos: new THREE.Vector3(-400, 28, -300),
          view: "night",
          lede: "广州首座跨珠江人行桥，2021-06-25 开通；全长 488 m、主拱 198 m、桥面宽 15 m。",
          facts: [["全长", "488 m"], ["主拱", "198 m"], ["宽", "15 m"]],
          detail: "南连广州塔/广州国际媒体港，北接二沙岛艺术公园；夜景以白色拱与暖白灯为意象。场景按塔西约 400 m 示意摆放（不采用 2.4 km 口径），桥面高度约 12–15 m 为示意。"
        },
        {
          id: "axis", craft: "axis", no: "07", name: "花城中轴 12 km",
          pos: new THREE.Vector3(0, 452, -60),
          view: "axis",
          lede: "花城中轴串联燕岭公园、天河体育中心、珠江新城、花城广场、海心沙与广州塔；全长约 12 km、用地约 5.88 km²。",
          facts: [["中轴", "约 12 km"], ["花城广场", "约 2 km"], ["双塔", "530 / 438.6 m"]],
          detail: "从 450 m 平台北望：海心沙—花城广场—广州大剧院/广东省博物馆/图书馆—东塔 530 m、西塔 438.6 m、中信 391 m。北岸 CBD 在 800 m 外按约 0.6× 压缩距离，体量与位置为示意，非测绘。"
        }
      ];
    }

    /* ---------------- 组装 ---------------- */

    buildGround();
    var lattice = buildLattice();
    buildBase();
    buildCrown();
    buildPlaza();
    buildTrees();
    buildRiver();
    buildBridge();
    buildCity();
    buildHotspots();

    var bounds = new THREE.Box3(
      new THREE.Vector3(-1600, -5, -2600),
      new THREE.Vector3(1600, 620, 400)
    );

    return {
      root: root,
      hotspots: hotspots,
      materials: materials,
      steelUniforms: steelUniforms,
      waterMat: waterMat,
      waterUniforms: waterMat ? waterMat.uniforms : null,
      poolUniforms: poolUniforms,
      glowMats: glowMats,
      windowMats: windowMats,
      cityLightMat: cityLightMat,
      lattice: lattice,
      wheelGroup: wheelGroup,
      bounds: bounds
    };
  }

  window.CantonTowerModel = { build: build };
})();
