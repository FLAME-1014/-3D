/* 广州大剧院近景 · 渲染、运镜与交互 */
(function () {
  "use strict";

  var canvas = document.getElementById("scene");
  var ui = {
    intro: document.getElementById("intro"),
    loading: document.getElementById("loading"),
    fallback: document.getElementById("fallback"),
    hotspots: document.getElementById("hotspots"),
    infoCard: document.getElementById("infoCard"),
    infoKicker: document.getElementById("infoKicker"),
    infoTitle: document.getElementById("infoTitle"),
    infoLede: document.getElementById("infoLede"),
    infoFacts: document.getElementById("infoFacts"),
    infoDetail: document.getElementById("infoDetail"),
    infoClose: document.getElementById("infoClose"),
    nextCraftBtn: document.getElementById("nextCraftBtn"),
    focusCraftBtn: document.getElementById("focusCraftBtn"),
    viewRail: document.getElementById("viewRail"),
    chapter: document.getElementById("chapter"),
    progressFill: document.getElementById("progressFill"),
    progress: document.querySelector(".progress"),
    timeBtn: document.getElementById("timeBtn"),
    replayBtn: document.getElementById("replayBtn"),
    shotBtn: document.getElementById("shotBtn"),
    aboutBtn: document.getElementById("aboutBtn"),
    aboutPanel: document.getElementById("aboutPanel"),
    aboutClose: document.getElementById("aboutClose"),
    cityBtn: document.getElementById("cityBtn"),
    startBtn: document.getElementById("startBtn"),
    skipIntroBtn: document.getElementById("skipIntroBtn"),
    hint: document.getElementById("hint"),
    toast: document.getElementById("toast")
  };

  var params = new URLSearchParams(location.search);
  var inFrame = window.parent && window.parent !== window;
  var isMobile = window.matchMedia("(max-width: 820px)").matches || /Mobi|Android/i.test(navigator.userAgent);
  var baseFov = isMobile ? 60 : 55;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var width = window.innerWidth;
  var height = window.innerHeight;
  var dprCap = isMobile ? 1.35 : 1.75;
  var dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  if (isMobile) {
    ui.replayBtn.textContent = "重播";
    ui.cityBtn.textContent = "全景 ↗";
    ui.shotBtn.textContent = "4K";
  }

  if (!window.THREE) {
    ui.loading.classList.add("hidden");
    ui.intro.classList.add("hidden");
    ui.fallback.hidden = false;
    return;
  }

  var renderer, scene, camera, clock;
  var sun, hemi, ambient, mouthLight, plazaLight;
  var skyUniforms, sunSprite, moonSprite, starField;
  var model = null;
  var hotspots = [];
  var hotspotEls = {};
  var activeCraft = null;
  var toastTimer = null;

  var state = {
    mode: "intro",
    time: "day",
    cinematic: false,
    cineTime: 0,
    fps: 60,
    frames: 0,
    fpsAt: performance.now(),
    activeView: "plaza",
    shooting: false,
    lastShot: null,
    elapsed: 0
  };

  var VIEWS = {
    plaza: { id: "plaza", pos: [2, 2.4, 86], target: [-14, 19, -38], fov: 54, time: "day", type: "walk", chapter: "01 / 南广场 · 双砾与水池" },
    mouth: { id: "mouth", pos: [-70, 7.4, 30], target: [-46, 19, -22], fov: 60, time: "day", type: "walk", chapter: "02 / 大砾石 · 玻璃口部" },
    pool: { id: "pool", pos: [-34, 8.6, 62], target: [-36, 10, -10], fov: 54, time: "dusk", type: "walk", chapter: "03 / 倒影池 · 南侧" },
    west: { id: "west", pos: [-165, 2.6, -50], target: [-35, 20, -55], fov: 54, time: "day", type: "walk", chapter: "04 / 珠江西路 · 石背" },
    small: { id: "small", pos: [115, 1.7, 10], target: [45, 12, -60], fov: 58, time: "day", type: "walk", chapter: "05 / 小砾石 · 草坡与坡道" },
    axis: { id: "axis", pos: [280, 200, -280], target: [20, 120, 60], fov: 60, time: "dusk", type: "aerial", chapter: "06 / 文化轴 · 双砾与省博/广州塔（航拍示意，非步行可达）" },
    night: { id: "night", pos: [-38, 7.2, 60], target: [-36, 11, -10], fov: 56, time: "night", type: "walk", chapter: "07 / 夜景 · 水映双砾" }
  };

  var CINE = [
    { dur: 5.0, chapter: "01 / 珠江 · 海心沙与广州塔", pos: [60, 110, 470], target: [10, 60, 200], toPos: [120, 70, 260], toTarget: [20, 25, 20] },
    { dur: 4.0, chapter: "02 / 花城广场 · 南望双砾", pos: [120, 70, 260], target: [20, 25, 20], toPos: [70, 26, 155], toTarget: [0, 22, -25] },
    { dur: 4.0, chapter: "03 / 南广场 · 双砾全景", pos: [70, 26, 155], target: [0, 22, -25], toPos: [0, 1.7, 95], toTarget: [-15, 22, -40] },
    { dur: 4.5, chapter: "04 / 大砾石 · 玻璃口部", pos: [0, 1.7, 95], target: [-15, 22, -40], toPos: [5, 1.7, 30], toTarget: [-5, 22, -8] },
    { dur: 4.0, chapter: "05 / 草坡 · 小砾石", pos: [5, 1.7, 30], target: [-5, 22, -8], toPos: [46, 10, 52], toTarget: [40, 12, -30] },
    { dur: 4.0, chapter: "05 / 小砾石 · 草坡与坡道", pos: [46, 10, 52], target: [40, 12, -30], toPos: [115, 1.7, 10], toTarget: [45, 12, -60] },
    { dur: 5.0, chapter: "06 / 航拍 · 文化轴", pos: [115, 1.7, 10], target: [45, 12, -60], toPos: [280, 200, -280], toTarget: [20, 120, 60] },
    { dur: 5.0, chapter: "07 / 夜景 · 水映双砾", pos: [280, 200, -280], target: [20, 120, 60], toPos: [0, 2.5, 90], toTarget: [-10, 18, -20] }
  ];
  var CINE_TOTAL = CINE.reduce(function (sum, s) { return sum + s.dur; }, 0);

  var desired = { theta: 0, phi: 1.2, radius: 600, target: new THREE.Vector3(0, 30, -40) };
  var orbit = { theta: 0, phi: 1.2, radius: 600, target: new THREE.Vector3(0, 30, -40) };
  var flying = null;
  var visited = {};
  var userTime = false;
  var forcedNight = false;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { ui.toast.classList.remove("show"); }, 2600);
  }

  /* ---------------- 渲染基础 ---------------- */

  function initThree() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false
      });
    } catch (error) {
      ui.fallback.hidden = false;
      ui.loading.classList.add("hidden");
      ui.intro.classList.add("hidden");
      return false;
    }
    if (!renderer || !renderer.getContext()) {
      ui.fallback.hidden = false;
      ui.loading.classList.add("hidden");
      ui.intro.classList.add("hidden");
      return false;
    }

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x0a1014, 1);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xa9bdc6, 0.00055);

    camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.4, 6000);
    clock = new THREE.Clock();

    var textures = window.OperaHouseTextures.build(renderer);
    buildSky(textures.glow);
    buildLights();

    var built = window.OperaHouseModel.build({ textures: textures, low: isMobile });
    model = built;
    scene.add(built.root);
    hotspots = built.hotspots;
    buildHotspotDom();

    prewarm();
    applyTime("day");
    setCameraImmediate(CINE[0].pos, CINE[0].target, baseFov);
    bindEvents();
    updateProgress(0);
    hideLoading();
    startLoop();
    return true;
  }

  function hideLoading() {
    window.setTimeout(function () {
      ui.loading.classList.add("hidden");
      if (params.get("embed") === "1") {
        document.body.classList.add("embed");
        document.body.classList.remove("intro-active");
        ui.intro.classList.add("hidden");
        var startView = params.get("view");
        var valid = startView && VIEWS[startView] ? startView : "plaza";
        enterImmediate(valid);
      }
    }, 260);
  }

  function buildSky(glowTex) {
    skyUniforms = {
      topColor: { value: lin(0x4a86b8) },
      horizonColor: { value: lin(0xdfe9ee) },
      glowColor: { value: lin(0xfff4d6) },
      sunDir: { value: new THREE.Vector3(0.42, 0.62, 0.55).normalize() },
      sunPower: { value: 1.0 }
    };
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: [
        "varying vec3 vDir;",
        "void main() {",
        "  vDir = normalize(position);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vDir;",
        "uniform vec3 topColor;",
        "uniform vec3 horizonColor;",
        "uniform vec3 glowColor;",
        "uniform vec3 sunDir;",
        "uniform float sunPower;",
        "void main() {",
        "  float h = smoothstep(-0.10, 0.6, vDir.y);",
        "  vec3 col = mix(horizonColor, topColor, h);",
        "  float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);",
        "  col += glowColor * pow(d, 7.0) * sunPower;",
        "  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.4545)), 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 18), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    var starGeo = new THREE.BufferGeometry();
    var pos = [];
    var starSeed = 20261031;
    function srnd() {
      starSeed = (starSeed * 1664525 + 1013904223) % 4294967296;
      return starSeed / 4294967296;
    }
    for (var i = 0; i < 760; i++) {
      var a = srnd() * Math.PI * 2;
      var e = 0.06 + srnd() * 1.35;
      var r = 4200 + srnd() * 300;
      pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: lin(0xe7efff), size: 1.9, sizeAttenuation: false,
      transparent: true, opacity: 0.0, depthWrite: false
    }));
    scene.add(starField);

    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffdfab, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex
    }));
    sunSprite.position.set(420, 700, 520);
    sunSprite.scale.set(120, 120, 1);
    scene.add(sunSprite);

    moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: lin(0xdce7ff), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex
    }));
    moonSprite.position.set(-500, 800, -600);
    moonSprite.scale.set(64, 64, 1);
    scene.add(moonSprite);
  }

  function buildLights() {
    ambient = new THREE.AmbientLight(lin(0xcfd8d4), 0.28);
    scene.add(ambient);
    hemi = new THREE.HemisphereLight(lin(0xbfd7e7), lin(0x4b5148), 0.55);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xfff3df, 2.2);
    sun.position.set(380, 520, 260);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -170;
      sun.shadow.camera.right = 170;
      sun.shadow.camera.top = 170;
      sun.shadow.camera.bottom = -170;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 1100;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.06;
    }
    sun.target.position.set(-10, 0, -40);
    scene.add(sun);
    scene.add(sun.target);

    mouthLight = new THREE.PointLight(0xffc98a, 0.0, 190, 1.5);
    mouthLight.position.set(-30, 12, 12);
    scene.add(mouthLight);

    plazaLight = new THREE.PointLight(0xffd6a8, 0.0, 220, 1.6);
    plazaLight.position.set(2, 5, 46);
    scene.add(plazaLight);
  }

  /* ---------------- 时段 ---------------- */

  var TIME_PRESETS = {
    day: {
      label: "晴日", next: "dusk",
      exposure: 1.0,
      fog: 0xa9bdc6, fogDensity: 0.00068,
      top: 0x4a86b8, horizon: 0xdfe9ee, glow: 0xfff4d6, sunPower: 1.0,
      sunColor: 0xfff4dc, sunIntensity: 2.2, sunPos: [380, 520, 260],
      hemiSky: 0xbdd6e4, hemiGround: 0x4b5148, hemiIntensity: 0.55,
      ambient: 0.28, stars: 0, sunSprite: 0.8, sunSpriteColor: 0xfff1cf,
      sunDir: [0.42, 0.62, 0.55],
      points: [0, 0],
      glassMode: 0, glassInterior: 0.12, glassOpacity: 0.5,
      waterMode: 0, waterDeep: 0x14262b, waterSky: 0x6f94a4,
      baseGlow: 0.0, ribbon: 0.14, lobbyGlow: 0.14, lobbyFloor: 0.08,
      city: 0.0, diagrid: 0.0, lamp: 0x594a37, sign: 0.0,
      stoneDark: 0xffffff, stoneLight: 0xffffff, terrace: 0xe4ded1, podium: 0xd6d0c4,
      gzOpacity: 0.5, gzCabin: 0.0
    },
    dusk: {
      label: "黄昏", next: "night",
      exposure: 1.06,
      fog: 0xb58a72, fogDensity: 0.0009,
      top: 0x2b3452, horizon: 0xf0a06a, glow: 0xff8a4a, sunPower: 1.15,
      sunColor: 0xffb277, sunIntensity: 1.2, sunPos: [-330, 130, 300],
      hemiSky: 0x8a8fb8, hemiGround: 0x303038, hemiIntensity: 0.5,
      ambient: 0.24, stars: 0.12, sunSprite: 0.85, sunSpriteColor: 0xffa26a,
      sunDir: [-0.55, 0.18, 0.35],
      points: [0.5, 0.25],
      glassMode: 1, glassInterior: 0.5, glassOpacity: 0.44,
      waterMode: 0.5, waterDeep: 0x0c161a, waterSky: 0x55636f,
      baseGlow: 0.35, ribbon: 0.32, lobbyGlow: 0.5, lobbyFloor: 0.42,
      city: 0.85, diagrid: 0.22, lamp: 0xffc27c, sign: 0.18,
      stoneDark: 0xdcd6ce, stoneLight: 0xffe8cc, terrace: 0xefe4d4, podium: 0xd8c8b2,
      gzOpacity: 0.7, gzCabin: 0.25
    },
    night: {
      label: "夜景", next: "day",
      exposure: 1.12,
      fog: 0x0a1220, fogDensity: 0.00095,
      top: 0x03060f, horizon: 0x0e1a2e, glow: 0x1e3a66, sunPower: 0.22,
      sunColor: 0x8fa8d8, sunIntensity: 0.18, sunPos: [-420, 620, -320],
      hemiSky: 0x22304a, hemiGround: 0x0b1018, hemiIntensity: 0.24,
      ambient: 0.12, stars: 0.85, sunSprite: 0, sunSpriteColor: 0xdce7ff,
      sunDir: [-0.5, 0.42, -0.42],
      points: [3.0, 0.45],
      glassMode: 2, glassInterior: 1.0, glassOpacity: 0.56,
      waterMode: 1.0, waterDeep: 0x081318, waterSky: 0x1f2c3a,
      baseGlow: 1.0, ribbon: 0.55, lobbyGlow: 0.95, lobbyFloor: 1.0,
      city: 2.4, diagrid: 0.55, lamp: 0xffd9a0, sign: 0.4,
      stoneDark: 0xb6bbbc, stoneLight: 0xd8d0c2, terrace: 0x9aa0a1, podium: 0x8a8e8c,
      gzOpacity: 0.95, gzCabin: 1.0
    }
  };

  function applyTime(name) {
    var p = TIME_PRESETS[name] || TIME_PRESETS.day;
    state.time = name;
    ui.timeBtn.textContent = p.label;
    ui.timeBtn.setAttribute("aria-pressed", name !== "day" ? "true" : "false");
    renderer.toneMappingExposure = p.exposure;
    scene.fog.color.copy(lin(p.fog));
    scene.fog.density = p.fogDensity;

    skyUniforms.topColor.value.copy(lin(p.top));
    skyUniforms.horizonColor.value.copy(lin(p.horizon));
    skyUniforms.glowColor.value.copy(lin(p.glow));
    skyUniforms.sunPower.value = p.sunPower;
    skyUniforms.sunDir.value.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize();

    sun.color.copy(lin(p.sunColor));
    sun.intensity = p.sunIntensity;
    sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    sun.castShadow = !isMobile && name !== "night";
    hemi.color.copy(lin(p.hemiSky));
    hemi.groundColor.copy(lin(p.hemiGround));
    hemi.intensity = p.hemiIntensity;
    ambient.intensity = p.ambient;
    mouthLight.intensity = p.points[0];
    plazaLight.intensity = p.points[1];
    renderer.shadowMap.enabled = !isMobile && name !== "night";

    sunSprite.position.set(p.sunDir[0] * 3200, Math.max(160, p.sunDir[1] * 3200), p.sunDir[2] * 3200);
    moonSprite.position.set(-p.sunDir[0] * 3200, Math.max(400, p.sunDir[1] * 3200), -p.sunDir[2] * 3200);
    sunSprite.material.opacity = p.sunSprite;
    sunSprite.material.color.copy(lin(p.sunSpriteColor));
    sunSprite.visible = p.sunSprite > 0;
    moonSprite.material.opacity = name === "night" ? 0.55 : name === "dusk" ? 0.1 : 0;
    moonSprite.visible = moonSprite.material.opacity > 0;
    starField.material.opacity = p.stars;
    starField.visible = p.stars > 0;

    if (model) {
      var su = model.glassUniforms;
      su.uMode.value = p.glassMode;
      su.uInterior.value = p.glassInterior;
      su.uOpacity.value = p.glassOpacity;
      su.uSky.value.copy(lin(name === "night" ? 0x1a2c40 : name === "dusk" ? 0xc2927c : 0x7f9dad));
      su.uFogColor.value.copy(lin(p.fog));
      su.uFogDensity.value = p.fogDensity;
      var wu = model.waterUniforms;
      wu.uMode.value = p.waterMode;
      wu.uDeep.value.copy(lin(p.waterDeep));
      wu.uSky.value.copy(lin(p.waterSky));
      wu.uFogColor.value.copy(lin(p.fog));
      wu.uFogDensity.value = p.fogDensity;
      model.baseUniforms.uIntensity.value = p.baseGlow;
      model.ribbonMat.opacity = p.ribbon;
      model.lobbyMats.glow.opacity = p.lobbyGlow;
      model.lobbyMats.floor.opacity = p.lobbyFloor;
      model.materials.lampHead.color.copy(lin(p.lamp));
      if (model.materials.lampHalo) model.materials.lampHalo.opacity = name === "night" ? 0.85 : name === "dusk" ? 0.34 : 0;
      model.materials.sign.emissiveIntensity = p.sign;
      model.materials.stoneDark.color.copy(lin(p.stoneDark));
      model.materials.stoneLight.color.copy(lin(p.stoneLight));
      model.materials.terraceTop.color.copy(lin(p.terrace));
      model.materials.terraceWall.color.copy(lin(p.podium));
      model.materials.city.emissiveIntensity = p.city;
      model.materials.museum.emissiveIntensity = p.city * 0.9;
      model.materials.library.emissiveIntensity = p.city * 0.9;
      model.materials.ifc.emissiveIntensity = p.city;
      model.materials.eastTower.emissiveIntensity = p.city;
      model.materials.citic.emissiveIntensity = p.city;
      model.materials.gz.opacity = p.gzOpacity;
      model.materials.gzCabin.emissiveIntensity = p.gzCabin;
      model.materials.southBank.emissiveIntensity = p.city;
      model.materials.paving.color.setHex(name === "night" ? 0x565c5d : name === "dusk" ? 0xbfb5a5 : 0xd6d1c4);
      model.materials.grass.color.setHex(name === "night" ? 0x4f584b : name === "dusk" ? 0xd9cdb6 : 0xffffff);
      model.materials.crown.color.setHex(name === "night" ? 0x4f5a4c : name === "dusk" ? 0xd9cfb8 : 0xffffff);
      model.materials.curb.color.setHex(name === "night" ? 0x5c625f : name === "dusk" ? 0xa3988a : 0xd9d3c6);
      model.materials.walk.color.setHex(name === "night" ? 0x4e5350 : name === "dusk" ? 0x8f8475 : 0xc9c2b4);
      model.materials.rail.color.setHex(name === "night" ? 0x6a7072 : name === "dusk" ? 0xc8c2b8 : 0x8d9294);
    }

    document.body.classList.toggle("night-mode", name !== "day");
  }

  function prewarm() {
    ["night", "dusk", "day"].forEach(function (mode) {
      applyTime(mode);
      renderer.render(scene, camera);
    });
  }

  /* ---------------- 相机与运镜 ---------------- */

  function orbitFromPos(pos, target) {
    var off = pos.clone().sub(target);
    var radius = Math.max(off.length(), 1);
    return {
      theta: Math.atan2(off.x, off.z),
      phi: Math.acos(clamp(off.y / radius, -1, 1)),
      radius: radius,
      target: target.clone()
    };
  }

  function resolveView(v) {
    if (!v) return v;
    var fov = v.fov || baseFov;
    var out = { id: v.id, chapter: v.chapter, pos: v.pos.slice(), target: v.target.slice(), fov: fov, time: v.time };
    if (isMobile) {
      out.fov = Math.min(88, fov + (v.id === "plaza" ? 8 : 14));
      var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
      var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
      var pullMap = { mouth: 1.45, pool: 1.25, west: 1.2, small: 1.3, night: 1.3, axis: 1.4 };
      var pull = pullMap[v.id] || 1.6;
      out.pos = [
        target.x + (pos.x - target.x) * pull,
        pos.y,
        target.z + (pos.z - target.z) * pull
      ];
      if (v.id === "plaza") {
        out.pos = [64, 9, 100];
        out.target = [-10, 17, -46];
        out.fov = 64;
      } else if (v.id === "axis") {
        out.pos = [520, 260, -520];
        out.target = [-30, 110, 180];
        out.fov = 78;
      }
    }
    return out;
  }

  function setCameraImmediate(pos, target, fov) {
    var p = pos.isVector3 ? pos.clone() : new THREE.Vector3(pos[0], pos[1], pos[2]);
    var t = target.isVector3 ? target.clone() : new THREE.Vector3(target[0], target[1], target[2]);
    camera.position.copy(p);
    camera.fov = fov || baseFov;
    camera.updateProjectionMatrix();
    camera.lookAt(t);
    var o = orbitFromPos(p, t);
    desired.theta = orbit.theta = o.theta;
    desired.phi = orbit.phi = o.phi;
    desired.radius = orbit.radius = o.radius;
    desired.target.copy(o.target);
    orbit.target.copy(o.target);
    flying = null;
  }

  function startFly(pos, target, fov, duration) {
    var p = pos.isVector3 ? pos.clone() : new THREE.Vector3(pos[0], pos[1], pos[2]);
    var t = target.isVector3 ? target.clone() : new THREE.Vector3(target[0], target[1], target[2]);
    var o = orbitFromPos(p, t);
    flying = {
      t: 0,
      dur: duration || 1.7,
      from: { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, target: orbit.target.clone(), fov: camera.fov },
      to: { theta: o.theta, phi: o.phi, radius: o.radius, target: o.target, fov: fov || baseFov }
    };
    if (flying.to.theta - flying.from.theta > Math.PI) flying.to.theta -= Math.PI * 2;
    if (flying.from.theta - flying.to.theta > Math.PI) flying.to.theta += Math.PI * 2;
  }

  function flyTo(v) {
    state.cinematic = false;
    state.mode = "free";
    var rv = resolveView(typeof v === "string" ? VIEWS[v] : v);
    if (!rv) return;
    startFly(rv.pos, rv.target, rv.fov, 1.7);
    if (rv.chapter) ui.chapter.textContent = rv.chapter;
    if (rv.id) setActiveView(rv.id);
  }

  function go(name) {
    var v = VIEWS[name] || VIEWS.plaza;
    if (name === "night") {
      applyTime("night");
      forcedNight = true;
    } else if (!userTime && !forcedNight && !visited[name] && v.time) {
      applyTime(v.time);
    }
    visited[name] = true;
    flyTo(v);
    setActiveView(VIEWS[name] ? name : "plaza");
  }

  function enterFree(name) {
    var view = VIEWS[name] ? name : "plaza";
    state.cinematic = false;
    state.mode = "free";
    document.body.classList.remove("intro-active");
    ui.intro.classList.add("hidden");
    if (VIEWS[view].time && VIEWS[view].time !== state.time) applyTime(VIEWS[view].time);
    if (view === "night") forcedNight = true;
    flyTo(VIEWS[view]);
    setActiveView(view);
    updateProgress(100);
    visited[view] = true;
  }

  function enterImmediate(name) {
    var view = VIEWS[name] ? name : "plaza";
    var rv = resolveView(VIEWS[view]);
    state.cinematic = false;
    state.mode = "free";
    document.body.classList.remove("intro-active");
    ui.intro.classList.add("hidden");
    if (VIEWS[view].time) applyTime(VIEWS[view].time);
    if (view === "night") forcedNight = true;
    setCameraImmediate(rv.pos, rv.target, rv.fov);
    setActiveView(view);
    updateProgress(100);
    visited[view] = true;
  }

  function startCinematic() {
    if (reducedMotion) {
      enterImmediate("plaza");
      applyTime("day");
      return;
    }
    document.body.classList.remove("intro-active");
    ui.intro.classList.add("hidden");
    state.cinematic = true;
    state.mode = "cinematic";
    state.cineTime = 0;
    userTime = false;
    forcedNight = false;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    setActiveView(null);
    updateProgress(0);
    closeInfo();
    applyTime("day");
  }

  function stopCinematic() {
    if (!state.cinematic) return;
    state.cinematic = false;
    state.mode = "free";
    var o = orbitFromPos(camera.position.clone(), cineTarget.clone());
    desired.theta = orbit.theta = o.theta;
    desired.phi = orbit.phi = o.phi;
    desired.radius = orbit.radius = o.radius;
    desired.target.copy(o.target);
    orbit.target.copy(o.target);
  }

  var tmpA = new THREE.Vector3();
  var tmpB = new THREE.Vector3();
  var cineTarget = new THREE.Vector3(10, 60, 200);

  function updateCinematic(dt) {
    state.cineTime += dt;
    var t = state.cineTime;
    var acc = 0;
    var seg = null;
    var local = 0;
    for (var i = 0; i < CINE.length; i++) {
      if (t < acc + CINE[i].dur) {
        seg = CINE[i];
        local = (t - acc) / CINE[i].dur;
        state.cineSeg = i;
        break;
      }
      acc += CINE[i].dur;
    }
    if (!seg) {
      var last = CINE[CINE.length - 1];
      camera.position.set(last.toPos[0], last.toPos[1], last.toPos[2]);
      cineTarget.set(last.toTarget[0], last.toTarget[1], last.toTarget[2]);
      camera.lookAt(cineTarget);
      updateProgress(100);
      state.cinematic = false;
      state.mode = "free";
      enterImmediate("night");
      applyTime("night");
      return;
    }
    if (state.cineSeg === CINE.length - 1 && state.time !== "night") applyTime("night");
    var u = smoothstep(local);
    tmpA.set(seg.pos[0], seg.pos[1], seg.pos[2]);
    tmpB.set(seg.toPos[0], seg.toPos[1], seg.toPos[2]);
    camera.position.lerpVectors(tmpA, tmpB, u);
    tmpA.set(seg.target[0], seg.target[1], seg.target[2]);
    tmpB.set(seg.toTarget[0], seg.toTarget[1], seg.toTarget[2]);
    cineTarget.lerpVectors(tmpA, tmpB, u);
    if (isMobile) {
      var dxm = camera.position.x - cineTarget.x;
      var dzm = camera.position.z - cineTarget.z;
      var km = camera.position.y > 70 ? 1.22 : 1.42;
      camera.position.x = cineTarget.x + dxm * km;
      camera.position.z = cineTarget.z + dzm * km;
    }
    camera.lookAt(cineTarget);
    ui.chapter.textContent = seg.chapter;
    updateProgress((t / CINE_TOTAL) * 100);
  }

  function updateProgress(value) {
    var v = clamp(value, 0, 100);
    ui.progressFill.style.width = v + "%";
    ui.progress.setAttribute("aria-valuenow", Math.round(v));
  }

  function updateOrbit(dt) {
    if (flying) {
      flying.t += dt;
      var raw = clamp(flying.t / flying.dur, 0, 1);
      var k = smoothstep(raw);
      orbit.theta = lerp(flying.from.theta, flying.to.theta, k);
      orbit.phi = lerp(flying.from.phi, flying.to.phi, k);
      orbit.radius = lerp(flying.from.radius, flying.to.radius, k);
      orbit.target.lerpVectors(flying.from.target, flying.to.target, k);
      camera.fov = lerp(flying.from.fov, flying.to.fov, k);
      camera.updateProjectionMatrix();
      if (raw >= 1) {
        desired.theta = orbit.theta;
        desired.phi = orbit.phi;
        desired.radius = orbit.radius;
        desired.target.copy(orbit.target);
        flying = null;
      }
    } else {
      var damp = 1 - Math.pow(0.0015, dt);
      orbit.theta += (desired.theta - orbit.theta) * damp;
      orbit.phi += (desired.phi - orbit.phi) * damp;
      orbit.radius += (desired.radius - orbit.radius) * damp;
      orbit.target.lerp(desired.target, damp);
    }
    var sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
    );
    camera.lookAt(orbit.target);
    if (state.mode !== "intro" && !activeCraft) ui.chapter.textContent = currentViewChapter();
  }

  function currentViewChapter() {
    var v = VIEWS[state.activeView];
    return v ? v.chapter : "自由探索 · 拖动环绕";
  }

  function setActiveView(name) {
    state.activeView = name;
    Array.prototype.forEach.call(ui.viewRail.querySelectorAll("button"), function (btn) {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspotDom() {
    hotspots.forEach(function (h) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hotspot";
      btn.dataset.craft = h.id;
      btn.innerHTML = "<i>" + h.no + "</i><span>" + h.name + "</span>";
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        openInfo(h.id);
      });
      ui.hotspots.appendChild(btn);
      hotspotEls[h.id] = btn;
    });
  }

  var projection = new THREE.Vector3();
  var occluders = [];
  var occluded = {};
  var occlusionTick = 0;
  var occlusionRay = new THREE.Raycaster();
  var occlusionDir = new THREE.Vector3();

  function collectOccluders() {
    if (!model) return;
    occluders = [];
    if (model.shell && model.shell.large) occluders.push(model.shell.large.mesh);
    if (model.shell && model.shell.small) occluders.push(model.shell.small.mesh);
  }

  function refreshOcclusion() {
    hotspots.forEach(function (h) {
      occlusionDir.subVectors(h.pos, camera.position);
      var dist = occlusionDir.length();
      occlusionDir.normalize();
      occlusionRay.set(camera.position, occlusionDir);
      occlusionRay.near = 0.5;
      occlusionRay.far = Math.max(0.6, dist - 2.5);
      occluded[h.id] = occlusionRay.intersectObjects(occluders, false).length > 0;
    });
  }

  function updateHotspots() {
    if (state.mode === "intro" || state.mode === "cinematic") {
      Object.keys(hotspotEls).forEach(function (id) { hotspotEls[id].classList.remove("visible"); });
      return;
    }
    occlusionTick++;
    if (occlusionTick % 14 === 1) refreshOcclusion();
    var dotMode = window.innerWidth <= 560;
    var topGuard = isMobile ? 152 : 84;
    var bottomGuard = isMobile ? 150 : 126;
    var candidates = [];
    hotspots.forEach(function (h) {
      var el = hotspotEls[h.id];
      projection.copy(h.pos).project(camera);
      var behind = projection.z > 1 || projection.z < -1;
      var dist = camera.position.distanceTo(h.pos);
      var x = (projection.x * 0.5 + 0.5) * width;
      var y = (-projection.y * 0.5 + 0.5) * height;
      var viewMismatch = state.activeView && h.views && h.views.indexOf(state.activeView) === -1;
      var hide = viewMismatch || behind || occluded[h.id] || dist > 1400 || x < 24 || x > width - 24 || y < topGuard || y > height - bottomGuard;
      el.classList.toggle("active", activeCraft === h.id);
      if (hide) {
        el.classList.remove("visible");
        return;
      }
      candidates.push({ h: h, el: el, x: x, y: y, dist: dist });
    });
    candidates.sort(function (a, b) { return a.dist - b.dist; });
    var shown = candidates.slice(0, 3);
    candidates.slice(3).forEach(function (c) { c.el.classList.remove("visible"); });
    var placed = [];
    shown.forEach(function (c, i) {
      var side = dotMode ? "" : (i === 1 ? "left" : "right");
      var y = c.y;
      if (!dotMode) {
        var guard = 0;
        while (guard < 8 && placed.some(function (p) { return p.side === side && Math.abs(p.y - y) < 46; })) {
          y += side === "right" ? 46 : -46;
          guard++;
        }
        if (y < topGuard || y > height - bottomGuard) y = c.y;
        var gap = 26;
        var canRight = c.x + gap + 280 < width - 16;
        var canLeft = c.x - gap - 280 > 16;
        if (side === "right" && !canRight && canLeft) side = "left";
        else if (side === "left" && !canLeft && canRight) side = "right";
        c.el.dataset.side = side;
        c.el.style.left = (c.x + (side === "right" ? gap : -gap)) + "px";
      } else {
        c.el.dataset.side = "dot";
        c.el.style.left = c.x + "px";
      }
      c.el.style.top = y + "px";
      c.el.classList.add("visible");
      placed.push({ side: side, y: y });
    });
  }

  function openInfo(id) {
    var h = hotspots.find(function (item) { return item.id === id; });
    if (!h) return;
    activeCraft = id;
    ui.infoKicker.textContent = "广州大剧院 · " + h.no;
    ui.infoTitle.textContent = h.name;
    ui.infoLede.textContent = h.lede;
    ui.infoDetail.textContent = h.detail;
    ui.infoFacts.innerHTML = h.facts.map(function (f) {
      return "<div><span>" + f[0] + "</span><strong>" + f[1] + "</strong></div>";
    }).join("");
    ui.infoCard.classList.add("open");
    ui.infoCard.setAttribute("aria-hidden", "false");
    ui.focusCraftBtn.dataset.craft = id;
    ui.nextCraftBtn.dataset.craft = id;
  }

  function closeInfo() {
    ui.infoCard.classList.remove("open");
    ui.infoCard.setAttribute("aria-hidden", "true");
    activeCraft = null;
    Object.keys(hotspotEls).forEach(function (id) { hotspotEls[id].classList.remove("active"); });
  }

  function nextCraft() {
    var index = hotspots.findIndex(function (h) { return h.id === activeCraft; });
    var next = hotspots[(index + 1) % hotspots.length];
    openInfo(next.id);
  }

  function focusCraft() {
    var h = hotspots.find(function (item) { return item.id === activeCraft; });
    if (!h) return;
    go(h.view);
    closeInfo();
  }

  /* ---------------- 4K / 考据 / 城市 ---------------- */

  function shot4K(opts) {
    var download = !(opts && opts.download === false);
    if (state.shooting) return Promise.resolve({ busy: true });
    if (!renderer || renderer.capabilities.maxTextureSize < 4096) {
      showToast("当前设备不支持 4K 画布");
      return Promise.resolve({ error: "unsupported" });
    }
    state.shooting = true;
    if (download) showToast("正在渲染 4K（3840 × 2160）…");
    var oldW = width;
    var oldH = height;
    var oldRatio = renderer.getPixelRatio();
    var oldAspect = camera.aspect;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(3840, 2160, false);
      camera.aspect = 3840 / 2160;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      var capW = canvas.width;
      var capH = canvas.height;

      // preserveDrawingBuffer=false：必须在同一任务内同步读回
      var probe = document.createElement("canvas");
      probe.width = 96;
      probe.height = 54;
      var pctx = probe.getContext("2d", { willReadFrequently: true });
      pctx.drawImage(canvas, 0, 0, 96, 54);
      var px = pctx.getImageData(0, 0, 96, 54).data;
      var sum = 0, sum2 = 0, n = 0, min = 255, max = 0;
      for (var i = 0; i < px.length; i += 4) {
        var l = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722);
        sum += l; sum2 += l * l; n++;
        if (l < min) min = l;
        if (l > max) max = l;
      }
      var mean = sum / n;
      var variance = sum2 / n - mean * mean;
      var dataUrl = canvas.toDataURL("image/png");
      var base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      var bytes = Math.floor((base64.length * 3) / 4);
      var pngW = 0, pngH = 0;
      try {
        var bin = atob(base64.slice(0, 64));
        pngW = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19);
        pngH = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23);
      } catch (error) { /* ignore */ }

      renderer.setPixelRatio(oldRatio);
      renderer.setSize(oldW, oldH, false);
      camera.aspect = oldAspect;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);

      var shot = {
        width: 3840, height: 2160, bytes: bytes,
        canvasW: capW, canvasH: capH, pngW: pngW, pngH: pngH,
        luminance: { min: Math.round(min), max: Math.round(max), mean: Math.round(mean), variance: Math.round(variance) },
        nonBlank: variance > 20 && max > 12
      };
      state.lastShot = shot;
      state.shooting = false;
      if (dataUrl && download) {
        var a = document.createElement("a");
        a.href = dataUrl;
        a.download = "guangzhou-opera-house-4k.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("4K 截图已保存");
      }
      return Promise.resolve(shot);
    } catch (error) {
      renderer.setPixelRatio(oldRatio);
      renderer.setSize(oldW, oldH, false);
      camera.aspect = oldAspect;
      camera.updateProjectionMatrix();
      state.shooting = false;
      showToast("4K 渲染失败：" + (error.message || "未知错误"));
      return Promise.resolve({ error: String((error && error.message) || error) });
    }
  }

  function export4K() {
    if (isMobile) showToast("移动端 4K 渲染压力较大，建议在桌面端导出");
    shot4K({ download: true });
  }

  function openAbout() {
    ui.aboutPanel.hidden = false;
    closeInfo();
  }

  function closeAbout() {
    ui.aboutPanel.hidden = true;
  }

  function goCity() {
    if (inFrame) {
      window.parent.postMessage({ type: "canton-open-city", spot: "operahouse" }, "*");
    } else {
      window.location.href = "index.html?spot=operahouse&jump=1";
    }
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    ui.startBtn.addEventListener("click", startCinematic);
    ui.skipIntroBtn.addEventListener("click", function () { enterFree("plaza"); });
    ui.timeBtn.addEventListener("click", function () {
      var next = TIME_PRESETS[state.time].next;
      if (state.activeView === "night" && next !== "night") {
        showToast("「夜景 · 水映双砾」视点固定为夜景");
        return;
      }
      userTime = true;
      forcedNight = false;
      applyTime(next);
      showToast("时段 · " + TIME_PRESETS[state.time].label);
    });
    ui.replayBtn.addEventListener("click", function () {
      if (reducedMotion) { showToast("已开启减少动态效果，运镜保持关闭"); return; }
      startCinematic();
    });
    ui.shotBtn.addEventListener("click", export4K);
    ui.aboutBtn.addEventListener("click", openAbout);
    ui.aboutClose.addEventListener("click", closeAbout);
    ui.aboutPanel.addEventListener("click", function (event) {
      if (event.target === ui.aboutPanel) closeAbout();
    });
    ui.cityBtn.addEventListener("click", goCity);
    ui.infoClose.addEventListener("click", closeInfo);
    ui.nextCraftBtn.addEventListener("click", nextCraft);
    ui.focusCraftBtn.addEventListener("click", focusCraft);

    ui.viewRail.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-view]");
      if (!btn) return;
      closeInfo();
      go(btn.dataset.view);
    });

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", function () {
      var name = state.activeView || "plaza";
      closeInfo();
      go(name);
    });
    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeInfo();
        closeAbout();
      }
      if (event.key === " " && state.mode === "intro") {
        event.preventDefault();
        startCinematic();
      }
    });

    var startView = params.get("view");
    if (startView && VIEWS[startView] && params.get("embed") !== "1") {
      window.setTimeout(function () {
        enterFree(startView);
        if (VIEWS[startView].time === "night") applyTime("night");
      }, 900);
    }
    if (params.get("embed") === "1") {
      document.body.classList.add("embed");
    }
  }

  var pointers = new Map();
  var drag = null;
  var pinch = null;

  function onPointerDown(event) {
    if (state.shooting) return;
    if (state.cinematic) stopCinematic();
    if (state.mode === "intro") return;
    flying = null;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = { x: event.clientX, y: event.clientY };
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* synthetic */ }
    } else if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        radius: desired.radius
      };
      drag = null;
    }
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.mode === "intro") return;
    if (pointers.size === 2 && pinch) {
      var pts = Array.from(pointers.values());
      var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      desired.radius = clamp(pinch.radius * (pinch.dist / Math.max(dist, 1)), 12, 1800);
      setActiveView(null);
      return;
    }
    if (!drag) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    desired.theta -= dx * 0.0048;
    desired.phi = clamp(desired.phi - dy * 0.0038, 0.1, 1.54);
    setActiveView(null);
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch (error) { /* ignore */ }
  }

  function onWheel(event) {
    event.preventDefault();
    if (state.mode === "intro") return;
    if (state.cinematic) stopCinematic();
    flying = null;
    desired.radius = clamp(desired.radius * Math.exp(event.deltaY * 0.0010), 12, 1800);
    setActiveView(null);
  }

  function onResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(state.shooting ? 1 : dpr);
    renderer.setSize(width, height, false);
  }

  /* ---------------- 主循环 ---------------- */

  function startLoop() {
    clock.start();
    requestAnimationFrame(loop);
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    state.elapsed += dt;

    if (state.cinematic) {
      updateCinematic(dt);
    } else if (state.mode !== "intro" && !state.shooting) {
      updateOrbit(dt);
    }

    if (model) {
      model.glassUniforms.uTime.value = state.elapsed;
      model.waterUniforms.uTime.value = state.elapsed;
    }

    updateHotspots();
    renderer.render(scene, camera);

    state.frames++;
    var now = performance.now();
    if (now - state.fpsAt >= 900) {
      state.fps = Math.round((state.frames * 1000) / (now - state.fpsAt));
      state.frames = 0;
      state.fpsAt = now;
    }
  }

  window.OperaHouseDebug = {
    get fps() { return state.fps; },
    get mode() { return state.mode; },
    get view() { return state.activeView; },
    get time() { return state.time; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get model() { return model; },
    get hotspots() { return hotspots.map(function (h) { return { id: h.id, name: h.name, pos: [h.pos.x, h.pos.y, h.pos.z] }; }); },
    get counts() {
      return renderer ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries
      } : null;
    },
    get shell() { return model && model.shell ? model.shell.stats : null; },
    get lastShot() { return state.lastShot; },
    get lights() {
      if (!scene) return null;
      var active = 0;
      scene.traverse(function (o) {
        if (o.isLight && (o.intensity > 0 || o.isAmbientLight || o.isHemisphereLight)) active++;
      });
      return { active: active, total: 5, nightPoints: 2 };
    },
    go: function (name) { go(name); },
    look: function (pos, target) {
      state.cinematic = false;
      state.mode = "free";
      document.body.classList.remove("intro-active");
      ui.intro.classList.add("hidden");
      closeInfo();
      setCameraImmediate(pos, target, camera.fov || baseFov);
      setActiveView(null);
      ui.chapter.textContent = "自由探索 · 拖动环绕";
    },
    timeOfDay: function (name) { applyTime(name || "day"); },
    open: openInfo,
    shot4K: shot4K,
    enter: function (name) { enterFree(name); }
  };

  if (!initThree()) return;
  collectOccluders();
  window.setTimeout(collectOccluders, 500);
})();
