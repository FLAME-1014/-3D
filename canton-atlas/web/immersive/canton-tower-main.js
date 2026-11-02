/* 广州塔近景 · 渲染、运镜与交互 */
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
  var baseFov = isMobile ? 62 : 55;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var width = window.innerWidth;
  var height = window.innerHeight;
  var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.85);

  if (!window.THREE) {
    ui.loading.classList.add("hidden");
    ui.intro.classList.add("hidden");
    ui.fallback.hidden = false;
    return;
  }

  var renderer, scene, camera, clock;
  var sun, hemi, ambient, fillLight, moon;
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
    cineTotal: 42,
    fps: 60,
    frames: 0,
    fpsAt: performance.now(),
    activeView: "base",
    shooting: false,
    lastShot: null,
    elapsed: 0
  };

  var VIEWS = {
    base: { id: "base", pos: [0, 9, 185], target: [0, 65, 0], fov: 64, time: "day", type: "walk", chapter: "01 / 塔基 · 南广场与滨水" },
    lattice: { id: "lattice", pos: [0, 250, 500], target: [0, 240, 0], fov: 78, time: "day", type: "aerial", chapter: "02 / 远眺 · 塔身网格（示意视点，非步行可达）" },
    deck: { id: "deck", pos: [105, 468, 100], target: [0, 448, 0], fov: 52, time: "day", type: "aerial", chapter: "03 / 450 m · 观景层外景（示意视点，非步行可达）" },
    crown: { id: "crown", pos: [160, 600, 236], target: [0, 480, -120], fov: 54, time: "dusk", type: "aerial", chapter: "04 / 塔顶 · 桅杆与摩天轮（示意视点，非步行可达）" },
    river: { id: "river", pos: [-190, 9, -505], target: [0, 212, 0], fov: 64, time: "dusk", type: "walk", chapter: "05 / 北岸 · 江面回望（示意）" },
    axis: { id: "axis", pos: [0, 452, -40], target: [0, 195, -1350], fov: 58, time: "dusk", type: "fixed", chapter: "06 / 花城中轴 · 北望（450 m 平台固定视点，非步行可达）" },
    night: { id: "night", pos: [-500, 9, -150], target: [0, 205, 0], fov: 62, time: "night", type: "walk", chapter: "07 / 海心桥 · 夜景灯光（桥前江面示意）" }
  };

  var CINE = [
    { dur: 6.0, chapter: "01 / 珠江 · 海心沙上空", pos: [-120, 120, -760], target: [0, 300, 0], toPos: [-420, 40, -420], toTarget: [0, 260, 0] },
    { dur: 5.0, chapter: "02 / 江面 · 回望南岸", pos: [-420, 40, -420], target: [0, 260, 0], toPos: [-190, 9, -505], toTarget: [0, 212, 0] },
    { dur: 5.0, chapter: "03 / 塔基 · 南广场", pos: [-190, 9, -505], target: [0, 212, 0], toPos: [0, 9, 185], toTarget: [0, 65, 0] },
    { dur: 5.0, chapter: "04 / 仰视 · 塔身网格", pos: [0, 9, 185], target: [0, 65, 0], toPos: [120, 9.4, 372], toTarget: [0, 196, 0] },
    { dur: 5.0, chapter: "05 / 450 m 观景层", pos: [120, 9.4, 372], target: [0, 196, 0], toPos: [105, 468, 100], toTarget: [0, 448, 0] },
    { dur: 5.0, chapter: "06 / 塔顶 · 桅杆与摩天轮", pos: [105, 468, 100], target: [0, 448, 0], toPos: [160, 600, 236], toTarget: [0, 480, -120] },
    { dur: 5.0, chapter: "07 / 花城中轴 · 北望", pos: [160, 600, 236], target: [0, 480, -120], toPos: [0, 452, -40], toTarget: [0, 195, -1350] },
    { dur: 6.0, chapter: "08 / 海心桥 · 夜景", pos: [0, 452, -40], target: [0, 195, -1350], toPos: [-500, 9, -150], toTarget: [0, 205, 0] }
  ];
  var CINE_TOTAL = CINE.reduce(function (sum, s) { return sum + s.dur; }, 0);

  var NIGHT_PALETTES = [
    [0x2fd4c8, 0xffd166, 0x35c7e8, 0x9ff5ff],
    [0x47e0ff, 0xff4fa3, 0x6f5cff, 0xc9a6ff],
    [0x3f7cff, 0x8a5cf6, 0xff7ac8, 0xffd6e8]
  ].map(function (list) {
    return list.map(function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); });
  });
  var paletteFrom = 0, paletteTo = 0, paletteT = 1, paletteClock = 0;

  var desired = { theta: 0, phi: 1.2, radius: 600, target: new THREE.Vector3(0, 100, 0) };
  var orbit = { theta: 0, phi: 1.2, radius: 600, target: new THREE.Vector3(0, 100, 0) };
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
        antialias: !isMobile,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true
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
    renderer.toneMappingExposure = 0.98;
    renderer.setClearColor(0x0a1218, 1);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xc3d5dd, 0.00026);

    camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.5, 12000);
    clock = new THREE.Clock();

    var textures = window.CantonTowerTextures.build(renderer);
    buildSky(textures.glow);
    buildLights();

    var built = window.CantonTowerModel.build({ textures: textures, low: isMobile });
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
        var valid = startView && VIEWS[startView] ? startView : "base";
        enterImmediate(valid);
      }
    }, 260);
  }

  function buildSky(glowTex) {
    skyUniforms = {
      topColor: { value: lin(0x3f86b8) },
      horizonColor: { value: lin(0xeaf1f2) },
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
        "  float h = smoothstep(-0.12, 0.62, vDir.y);",
        "  vec3 col = mix(horizonColor, topColor, h);",
        "  float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);",
        "  col += glowColor * pow(d, 6.0) * sunPower;",
        "  float band = smoothstep(0.0, 0.02, abs(vDir.y)) * (1.0 - smoothstep(0.02, 0.07, abs(vDir.y)));",
        "  col += glowColor * band * 0.06;",
        "  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.4545)), 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 18), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    var starGeo = new THREE.BufferGeometry();
    var pos = [];
    for (var i = 0; i < 900; i++) {
      var a = Math.random() * Math.PI * 2;
      var e = 0.08 + Math.random() * 1.3;
      var r = 7000 + Math.random() * 300;
      pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: lin(0xe7efff), size: 2.0, sizeAttenuation: false,
      transparent: true, opacity: 0.0, depthWrite: false
    }));
    scene.add(starField);

    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffdfab, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex
    }));
    sunSprite.position.set(420, 700, 520);
    sunSprite.scale.set(130, 130, 1);
    scene.add(sunSprite);

    moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: lin(0xdce7ff), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex
    }));
    moonSprite.position.set(-500, 800, -600);
    moonSprite.scale.set(70, 70, 1);
    scene.add(moonSprite);
  }

  function buildLights() {
    ambient = new THREE.AmbientLight(lin(0xcfd8d4), 0.26);
    scene.add(ambient);
    hemi = new THREE.HemisphereLight(lin(0xbfd7e7), lin(0x4b5148), 0.5);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xfff3df, 2.1);
    sun.position.set(380, 520, 260);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -190;
      sun.shadow.camera.right = 190;
      sun.shadow.camera.top = 190;
      sun.shadow.camera.bottom = -190;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 900;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.05;
    }
    sun.target.position.set(0, 0, -4);
    scene.add(sun);
    scene.add(sun.target);

    fillLight = new THREE.DirectionalLight(lin(0xb9d3dd), 0.18);
    fillLight.position.set(-220, 160, -140);
    scene.add(fillLight);

    moon = new THREE.DirectionalLight(lin(0x9db9ff), 0.0);
    moon.position.set(-400, 500, -300);
    scene.add(moon);
  }

  /* ---------------- 时段 ---------------- */

  var TIME_PRESETS = {
    day: {
      label: "晴日", next: "dusk",
      exposure: 0.98,
      fog: 0xa9bdc6, fogDensity: 0.00024,
      top: 0x3f86b8, horizon: 0xeaf1f2, glow: 0xfff4d6, sunPower: 1.0,
      sunColor: 0xfff4dc, sunIntensity: 2.1, sunPos: [380, 520, 260],
      hemiSky: 0xbdd6e4, hemiGround: 0x4b5148, hemiIntensity: 0.5,
      ambient: 0.26, fill: 0.18, moon: 0, stars: 0, sunSprite: 0.8,
      sunSpriteColor: 0xfff1cf, sunDir: [0.42, 0.62, 0.55],
      steelMode: 0, steelIntensity: 0,
      window: 0, lamp: 0, core: 0, mast: 0, cabin: 0, bridge: 0, waterMode: 0
    },
    dusk: {
      label: "黄昏", next: "night",
      exposure: 1.04,
      fog: 0xb09280, fogDensity: 0.00030,
      top: 0x27324e, horizon: 0xf0a06a, glow: 0xff7a3c, sunPower: 1.12,
      sunColor: 0xffb27a, sunIntensity: 1.12, sunPos: [-320, 120, 300],
      hemiSky: 0x7b7590, hemiGround: 0x36303a, hemiIntensity: 0.44,
      ambient: 0.22, fill: 0.26, moon: 0.16, stars: 0.1, sunSprite: 0.9,
      sunSpriteColor: 0xffa26a, sunDir: [-0.58, 0.2, 0.42],
      steelMode: 1, steelIntensity: 0.4,
      window: 0.72, lamp: 0.55, core: 0.14, mast: 0.12, cabin: 0.12, bridge: 0.2, waterMode: 0.4
    },
    night: {
      label: "夜景", next: "day",
      exposure: 1.1,
      fog: 0x08111c, fogDensity: 0.00024,
      top: 0x03060f, horizon: 0x0e1a2e, glow: 0x1e3a66, sunPower: 0.25,
      sunColor: 0x7f9fd0, sunIntensity: 0.22, sunPos: [-420, 620, -320],
      hemiSky: 0x22304a, hemiGround: 0x0b1018, hemiIntensity: 0.34,
      ambient: 0.18, fill: 0.06, moon: 0.32, stars: 0.85, sunSprite: 0,
      sunSpriteColor: 0xdce7ff, sunDir: [-0.55, 0.42, -0.42],
      steelMode: 2, steelIntensity: 1.1,
      window: 1.0, lamp: 1.0, core: 0.42, mast: 0.75, cabin: 0.65, bridge: 0.32, waterMode: 2
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
    fillLight.intensity = p.fill;
    moon.intensity = p.moon;
    renderer.shadowMap.enabled = !isMobile && name !== "night";

    sunSprite.position.set(p.sunDir[0] * 3200, Math.max(200, p.sunDir[1] * 3200), p.sunDir[2] * 3200);
    moonSprite.position.set(-p.sunDir[0] * 3200, Math.max(400, p.sunDir[1] * 3200), -p.sunDir[2] * 3200);
    sunSprite.material.opacity = p.sunSprite;
    sunSprite.material.color.copy(lin(p.sunSpriteColor));
    sunSprite.visible = p.sunSprite > 0;
    moonSprite.material.opacity = name === "night" ? 0.55 : name === "dusk" ? 0.12 : 0;
    moonSprite.visible = moonSprite.material.opacity > 0;
    starField.material.opacity = p.stars;
    starField.visible = p.stars > 0;

    var night = name === "night";
    var dusk = name === "dusk";

    if (model) {
      var su = model.steelUniforms;
      su.uMode.value = p.steelMode;
      su.uIntensity.value = p.steelIntensity;
      su.uFogColor.value.copy(lin(p.fog));
      su.uFogDensity.value = p.fogDensity;
      su.uLightDir.value.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize();

      var wu = model.waterUniforms;
      if (wu) {
        wu.uMode.value = p.waterMode;
        wu.uFogColor.value.copy(lin(p.fog));
        wu.uFogDensity.value = p.fogDensity;
        wu.uSky.value.copy(lin(name === "night" ? 0x1b2c44 : dusk ? 0x8d9aa6 : 0x9cc2d6));
      }
      var pu = model.poolUniforms;
      if (pu) {
        pu.uMode.value = p.waterMode;
        pu.uFogColor.value.copy(lin(p.fog));
        pu.uFogDensity.value = p.fogDensity;
        pu.uSky.value.copy(lin(name === "night" ? 0x1b2c44 : dusk ? 0x9aa2b0 : 0xa9cbd8));
      }
      model.materials.core.emissiveIntensity = p.core;
      model.materials.city.emissiveIntensity = night ? 3.1 : dusk ? 2.1 : 0;
      model.materials.cityTall.emissiveIntensity = night ? 3.1 : dusk ? 2.1 : 0;
      if (model.materials.tower) model.materials.tower.emissiveIntensity = night ? 2.7 : dusk ? 2.0 : 0;
      if (model.materials.towerCrown) model.materials.towerCrown.emissiveIntensity = night ? 2.2 : dusk ? 1.0 : 0;
      if (model.materials.roof) model.materials.roof.color.setHex(night ? 0x3b4044 : dusk ? 0x8b8984 : 0xffffff);
      if (model.materials.bridgeLight) model.materials.bridgeLight.emissiveIntensity = night ? 1.8 : dusk ? 0.6 : 0.1;
      model.materials.mast.emissiveIntensity = p.mast;
      model.materials.mastAviation.emissiveIntensity = p.mast * 0.5;
      if (model.materials.mastCopper) model.materials.mastCopper.emissiveIntensity = p.mast * 0.55;
      model.materials.cabin.emissiveIntensity = p.cabin;
      model.materials.bridge.emissiveIntensity = p.bridge;
      model.materials.bridgeRail.emissiveIntensity = p.bridge;
      model.glowMats.forEach(function (mat) { mat.opacity = p.lamp; });
      if (model.cityLightMat) model.cityLightMat.opacity = Math.min(1, p.window * 1.05);
      model.materials.granite.color.setHex(night ? 0x787c7a : dusk ? 0xe4dccf : 0xffffff);
      model.materials.plaza.color.setHex(night ? 0x6f7370 : dusk ? 0xe8e2d8 : 0xf0eeea);
      model.materials.ripple.color.setHex(night ? 0x757a76 : dusk ? 0xe8e0d4 : 0xf4f0e8);
      model.materials.white.color.setHex(night ? 0x9aa7aa : dusk ? 0xd9dddb : 0xe7ecee);
      model.materials.bridge.color.setHex(night ? 0x50595d : dusk ? 0xdfe3e2 : 0xe9eef0);
      model.materials.bridgeRail.color.setHex(night ? 0x7a8487 : dusk ? 0xe6e9e8 : 0xf0f4f5);
      model.materials.city.color.setHex(night ? 0x413f45 : dusk ? 0x9c958c : 0xffffff);
      model.materials.cityTall.color.setHex(night ? 0x555f67 : dusk ? 0xc8c0b6 : 0xffffff);
      if (model.materials.tower) model.materials.tower.color.setHex(night ? 0x8e979c : dusk ? 0xd8d2c8 : 0xffffff);
      if (model.materials.land) model.materials.land.color.setHex(night ? 0x505a5a : dusk ? 0xc7c2b8 : 0xffffff);
      if (model.materials.cityGround) model.materials.cityGround.color.setHex(night ? 0x596166 : dusk ? 0xb8bfbc : 0xffffff);
      if (model.materials.park) model.materials.park.color.setHex(night ? 0x3c4a3d : dusk ? 0xa89f86 : 0xffffff);
      if (model.materials.street) model.materials.street.color.setHex(night ? 0x5c6467 : dusk ? 0xc2beb5 : 0xffffff);
      if (model.materials.coping) model.materials.coping.color.setHex(night ? 0x7c8588 : dusk ? 0xe6e0d4 : 0xffffff);
      if (model.materials.opera) model.materials.opera.color.setHex(night ? 0x8a9498 : dusk ? 0xf0ebe0 : 0xffffff);
      if (model.materials.library) model.materials.library.color.setHex(night ? 0x778084 : dusk ? 0xdcd8cf : 0xffffff);
      if (model.materials.museum) model.materials.museum.color.setHex(night ? 0x3f4244 : 0xffffff);
      if (model.materials.beacon) model.materials.beacon.visible = night;
    }

    paletteClock = 0;
    paletteFrom = 0;
    paletteTo = 0;
    paletteT = 1;
    document.body.classList.toggle("night-mode", name !== "day");
    if (name === "night") updateNightPalettes(0, true);
  }

  function prewarm() {
    ["night", "dusk", "day"].forEach(function (mode) {
      applyTime(mode);
      renderer.render(scene, camera);
    });
  }

  function updateNightPalettes(dt, force) {    if (!model || !model.steelUniforms) return;
    paletteClock += dt;
    var idx = Math.floor(paletteClock / 40) % NIGHT_PALETTES.length;
    if (idx !== paletteTo) {
      paletteFrom = paletteTo;
      paletteTo = idx;
      paletteT = 0;
    }
    if (!force) paletteT = Math.min(1, paletteT + dt / 2.5);
    var k = smoothstep(paletteT);
    var a = NIGHT_PALETTES[paletteFrom];
    var b = NIGHT_PALETTES[paletteTo];
    var su = model.steelUniforms;
    su.uNight0.value.copy(a[0]).lerp(b[0], k);
    su.uNight1.value.copy(a[1]).lerp(b[1], k);
    su.uNight2.value.copy(a[2]).lerp(b[2], k);
    su.uNight3.value.copy(a[3]).lerp(b[3], k);
    var wu = model.waterUniforms;
    if (wu) {
      wu.uNight0.value.copy(a[0]).lerp(b[0], k);
      wu.uNight1.value.copy(a[1]).lerp(b[1], k);
      wu.uNight2.value.copy(a[2]).lerp(b[2], k);
    }
    var pu = model.poolUniforms;
    if (pu) {
      pu.uNight0.value.copy(a[0]).lerp(b[0], k);
      pu.uNight1.value.copy(a[1]).lerp(b[1], k);
      pu.uNight2.value.copy(a[2]).lerp(b[2], k);
    }
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
      out.fov = Math.min(82, fov + 4);
      var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
      var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
      var pull = v.type === "walk" ? (v.id === "night" ? 1.0 : 1.13) : 1.06;
      out.pos = [
        target.x + (pos.x - target.x) * pull,
        pos.y,
        target.z + (pos.z - target.z) * pull
      ];
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
    // 保持角度连续
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
    var v = VIEWS[name] || VIEWS.base;
    if (name === "night") {
      applyTime("night");
      forcedNight = true;
    } else if (!userTime && !forcedNight && !visited[name] && v.time) {
      applyTime(v.time);
    }
    visited[name] = true;
    flyTo(v);
    setActiveView(VIEWS[name] ? name : "base");
  }

  function enterFree(name) {
    var view = VIEWS[name] ? name : "base";
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
    var view = VIEWS[name] ? name : "base";
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
      enterImmediate("river");
      applyTime("dusk");
      return;
    }
    document.body.classList.remove("intro-active");
    ui.intro.classList.add("hidden");
    state.cinematic = true;
    state.mode = "cinematic";
    state.cineTime = 0;
    state.cineSeg = 0;
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
  var cineTarget = new THREE.Vector3(0, 300, 0);

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
    if (state.cineSeg === CINE.length - 1 && state.time !== "night") {
      applyTime("night");
    }
    var u = smoothstep(local);
    tmpA.set(seg.pos[0], seg.pos[1], seg.pos[2]);
    tmpB.set(seg.toPos[0], seg.toPos[1], seg.toPos[2]);
    camera.position.lerpVectors(tmpA, tmpB, u);
    tmpA.set(seg.target[0], seg.target[1], seg.target[2]);
    tmpB.set(seg.toTarget[0], seg.toTarget[1], seg.toTarget[2]);
    cineTarget.lerpVectors(tmpA, tmpB, u);
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
      btn.dataset.craft = h.craft;
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
    model.root.updateMatrixWorld(true);
    model.root.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh || o.isSprite) return;
      if (!o.material || o.material.transparent) return;
      var box = new THREE.Box3().setFromObject(o);
      var size = box.getSize(new THREE.Vector3());
      var dims = [size.x, size.y, size.z].sort(function (a, b) { return b - a; });
      if (dims[2] < 12 || dims[1] < 8 || dims[1] > 260) return;
      occluders.push(o);
    });
  }

  function refreshOcclusion() {
    hotspots.forEach(function (h) {
      if (h.id !== "steps" && h.id !== "bridge" && h.id !== "axis") { occluded[h.id] = false; return; }
      occlusionDir.subVectors(h.pos, camera.position);
      var dist = occlusionDir.length();
      occlusionDir.normalize();
      occlusionRay.set(camera.position, occlusionDir);
      occlusionRay.near = 0.5;
      occlusionRay.far = Math.max(0.6, dist - 1.5);
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
      var hide = behind || occluded[h.id] || dist > 2600 || x < 24 || x > width - 24 || y < topGuard || y > height - bottomGuard;
      if (h.id === "bridge" && state.activeView !== "night" && state.activeView !== "river") {
        if (dist > 900) hide = true;
      }
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
    ui.infoKicker.textContent = "广州塔 · " + h.no;
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
    return new Promise(function (resolve) {
      window.setTimeout(function () {
        try {
          renderer.setPixelRatio(1);
          renderer.setSize(3840, 2160, false);
          camera.aspect = 3840 / 2160;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          canvas.toBlob(function (blob) {
            renderer.setPixelRatio(oldRatio);
            renderer.setSize(oldW, oldH, false);
            camera.aspect = oldAspect;
            camera.updateProjectionMatrix();
            state.shooting = false;
            var shot = { width: 3840, height: 2160, bytes: blob ? blob.size : 0 };
            state.lastShot = shot;
            if (blob && download) {
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a");
              a.href = url;
              a.download = "canton-tower-4k.png";
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
              showToast("4K 截图已保存");
            }
            resolve(shot);
          }, "image/png");
        } catch (error) {
          renderer.setPixelRatio(oldRatio);
          renderer.setSize(oldW, oldH, false);
          camera.aspect = oldAspect;
          camera.updateProjectionMatrix();
          state.shooting = false;
          showToast("4K 渲染失败：" + (error.message || "未知错误"));
          resolve({ error: String(error && error.message || error) });
        }
      }, 60);
    });
  }

  function export4K() {
    if (isMobile) {
      showToast("移动端 4K 渲染压力较大，建议在桌面端导出");
    }
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
      window.parent.postMessage({ type: "canton-open-city", spot: "tower" }, "*");
    } else {
      window.location.href = "index.html?spot=tower&jump=1";
    }
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    ui.startBtn.addEventListener("click", startCinematic);
    ui.skipIntroBtn.addEventListener("click", function () { enterFree("base"); });
    ui.timeBtn.addEventListener("click", function () {
      var next = TIME_PRESETS[state.time].next;
      if (state.activeView === "night" && next !== "night") {
        showToast("「海心桥 · 夜景」视点固定为夜景");
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
      var name = btn.dataset.view;
      closeInfo();
      go(name);
    });

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", function () {
      var name = state.activeView || "base";
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
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* synthetic pointer */ }
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
      desired.radius = clamp(pinch.radius * (pinch.dist / Math.max(dist, 1)), 12, 2800);
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
    desired.radius = clamp(desired.radius * Math.exp(event.deltaY * 0.0010), 12, 2800);
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
      model.steelUniforms.uTime.value = state.elapsed;
      if (model.waterUniforms) model.waterUniforms.uTime.value = state.elapsed;
      if (model.poolUniforms) model.poolUniforms.uTime.value = state.elapsed;
      if (state.time === "night") updateNightPalettes(dt);
      if (model.wheelGroup && !isMobile) model.wheelGroup.rotation.y += dt * (Math.PI * 2 / 1200);
      if (model.materials.beacon) {
        var pulse = (Math.sin(state.elapsed * Math.PI * 2) + 1) * 0.5;
        model.materials.beacon.visible = state.time === "night" && pulse > 0.25;
      }
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

  window.CantonTowerDebug = {
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
    get lattice() {
      if (!model || !model.lattice) return null;
      var s = model.lattice.stats;
      return {
        columns: s.columns,
        rings: s.rings,
        ringLevels: s.ringLevels,
        diagonals: s.diagonals,
        drawCalls: s.drawCalls,
        triangles: s.triangles,
        waist: s.waist.waist,
        waistAt: s.waist.at
      };
    },
    get lastShot() { return state.lastShot; },
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
