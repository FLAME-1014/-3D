/* 永庆坊 · 恩宁路近景 · 渲染、运镜与交互 */
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
  var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 1.85);

  if (!window.THREE) {
    ui.loading.classList.add("hidden");
    ui.intro.classList.add("hidden");
    ui.fallback.hidden = false;
    return;
  }

  var renderer, scene, camera, clock;
  var sun, hemi, ambient, fillLight, fillLight2, moon;
  var skyUniforms, sunSprite, moonSprite, starField;
  var yqf = null;
  var modelRoot = null;
  var hotspots = [];
  var hotspotEls = {};
  var activeCraft = null;
  var toastTimer = null;

  var state = {
    mode: "intro",
    time: "day",
    cinematic: false,
    cineTime: 0,
    cineSeg: 0,
    fps: 60,
    frames: 0,
    fpsAt: performance.now(),
    view: "gate",
    activeView: "gate",
    hoverHotspot: null,
    shooting: false
  };

  var desired = {
    theta: 0.42,
    phi: 1.16,
    radius: 80,
    target: new THREE.Vector3(20, 4, -30)
  };
  var orbit = {
    theta: 0.42,
    phi: 1.16,
    radius: 80,
    target: new THREE.Vector3(20, 4, -30)
  };

  var VIEWS = {
    gate: { id: "gate", pos: [0, 3.8, 7.2], target: [0, 3.8, -9], fov: 58, chapter: "01 / 门楼 · 永庆坊入口" },
    lane: { id: "lane", pos: [0, 3.1, -10], target: [2, 2.9, -52], fov: 62, chapter: "02 / 永庆大街 · 李小龙祖居" },
    opera: { id: "opera", pos: [86, 4.2, -80], target: [60, 3.4, -62], fov: 64, chapter: "03 / 粤博 · 广福台 / 晚沙湖" },
    water: { id: "water", pos: [64, 2.8, -124], target: [34, 1.6, -117], fov: 55, chapter: "04 / 月亮桥 · 荔枝湾涌" },
    bahe: { id: "bahe", pos: [112, 3.2, 6], target: [118, 4.2, -9], fov: 55, chapter: "05 / 八和会馆 · 恩宁路 177" },
    arcade: { id: "arcade", pos: [54, 2.4, 3.0], target: [140, 4.2, 8.2], fov: 60, chapter: "06 / 恩宁路骑楼 · 99–177" },
    plaza: { id: "plaza", pos: [14, 3.2, -14], target: [30, 2.5, -30], fov: 58, chapter: "07 / 古树广场 · 微改造" },
    intro: { pos: [160, 60, 80], target: [20, 0, -50], fov: 50, chapter: "" }
  };

  var CINE = [
    { dur: 5.5, chapter: "01 / 恩宁路 · 永庆坊", pos: [170, 62, 92], target: [35, 0, -18], toPos: [26, 20, 5], toTarget: [0, 4, -9] },
    { dur: 3.0, chapter: "02 / 门楼 · 永庆坊入口", pos: [26, 20, 5], target: [0, 4, -9], toPos: [0, 5.0, 7.4], toTarget: [0, 3.9, -9] },
    { dur: 4.8, chapter: "03 / 永庆大街 · 李小龙", pos: [0, 5.0, 7.4], target: [0, 3.9, -9], toPos: [0, 3.1, -12], toTarget: [2, 2.9, -50] },
    { dur: 5.0, chapter: "04 / 粤博 · 广福台 / 晚沙湖", pos: [0, 3.1, -12], target: [2, 2.9, -50], toPos: [84, 4.0, -80], toTarget: [58, 3.4, -68] },
    { dur: 4.6, chapter: "05 / 月亮桥 · 荔枝湾涌", pos: [84, 4.0, -80], target: [58, 3.4, -68], toPos: [64, 2.8, -124], toTarget: [34, 1.6, -117] },
    { dur: 4.6, chapter: "06 / 八和会馆 · 恩宁路 177", pos: [64, 2.8, -124], target: [34, 1.6, -117], toPos: [112, 3.2, 6], toTarget: [118, 4.2, -9] },
    { dur: 5.0, chapter: "07 / 恩宁路骑楼 · 99–177", pos: [112, 3.2, 6], target: [118, 4.2, -9], toPos: [28, 2.5, 4.2], toTarget: [150, 4.4, 6.8] }
  ];
  var CINE_TOTAL = CINE.reduce(function (sum, s) { return sum + s.dur; }, 0);

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
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x111510, 1);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xb9c6c4, 0.0016);

    camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.1, 12000);
    clock = new THREE.Clock();

    buildSky();
    buildLights();

    var textures = window.YongqingfangTextures.build(renderer);
    var built = window.YongqingfangModel.build({ textures: textures, low: isMobile });
    yqf = built;
    modelRoot = built.root;
    scene.add(modelRoot);
    hotspots = built.hotspots;
    collectOccluders();
    buildHotspotDom();

    applyTime("day");
    setCameraImmediate(VIEWS.intro);
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
        showCityButton();
        document.body.classList.remove("intro-active");
        ui.intro.classList.add("hidden");
        window.setTimeout(function () {
          var startView = params.get("view");
          if (startView && VIEWS[startView]) {
            enterFree(VIEWS[startView]);
            setActiveView(startView);
          } else {
            enterFree(VIEWS.gate);
            setActiveView("gate");
          }
        }, 650);
      }
    }, 260);
  }

  function buildSky() {
    skyUniforms = {
      topColor: { value: new THREE.Color(0x3f7090) },
      horizonColor: { value: new THREE.Color(0xdfe6df) },
      glowColor: { value: new THREE.Color(0xfff0cf) },
      sunDir: { value: new THREE.Vector3(0.5, 0.55, 0.4).normalize() },
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
        "  float h = smoothstep(-0.10, 0.62, vDir.y);",
        "  vec3 col = mix(horizonColor, topColor, h);",
        "  float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);",
        "  col += glowColor * pow(d, 7.0) * sunPower;",
        "  float band = smoothstep(0.0, 0.02, abs(vDir.y)) * (1.0 - smoothstep(0.02, 0.07, abs(vDir.y)));",
        "  col += glowColor * band * 0.06;",
        "  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.4545)), 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 18), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    var starGeo = new THREE.BufferGeometry();
    var pos = [];
    for (var i = 0; i < 900; i++) {
      var a = Math.random() * Math.PI * 2;
      var e = 0.08 + Math.random() * 1.25;
      var r = 5000 + Math.random() * 100;
      pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: lin(0xe7efff), size: 2.0, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false
    }));
    scene.add(starField);

    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffdfab, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, map: makeGlowTexture()
    }));
    sunSprite.position.set(400, 420, 300);
    sunSprite.scale.set(100, 100, 1);
    scene.add(sunSprite);

    moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: lin(0xdce7ff), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, map: makeGlowTexture()
    }));
    moonSprite.position.set(-260, 250, -140);
    moonSprite.scale.set(55, 55, 1);
    scene.add(moonSprite);
  }

  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function buildLights() {
    ambient = new THREE.AmbientLight(lin(0xcfd8d4), 0.32);
    scene.add(ambient);
    hemi = new THREE.HemisphereLight(lin(0xb7d0e0), lin(0x3d3830), 0.5);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xfff1d8, 2.1);
    sun.position.set(160, 140, 120);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(1536, 1536);
      sun.shadow.camera.left = -190;
      sun.shadow.camera.right = 230;
      sun.shadow.camera.top = 170;
      sun.shadow.camera.bottom = -170;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 700;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 0.03;
    }
    sun.target.position.set(40, 0, -50);
    scene.add(sun);
    scene.add(sun.target);

    fillLight = new THREE.DirectionalLight(lin(0xb9d3dd), 0.18);
    fillLight.position.set(-140, 90, -60);
    scene.add(fillLight);

    fillLight2 = new THREE.DirectionalLight(lin(0xffe2c0), 0.28);
    fillLight2.position.set(0, 60, 120);
    scene.add(fillLight2);

    moon = new THREE.DirectionalLight(lin(0x9db9ff), 0.0);
    moon.position.set(-240, 180, -120);
    scene.add(moon);
  }

  /* ---------------- 时段 ---------------- */

  var TIME_PRESETS = {
    day: {
      label: "晴日", next: "dusk",
      exposure: 0.97,
      fog: 0xc3ceca, fogDensity: 0.0016,
      top: 0x3f7090, horizon: 0xd7ddd6, glow: 0xfff0cf, sunPower: 1.0,
      sunColor: 0xfff1d8, sunIntensity: 2.1, sunPos: [160, 140, 120],
      hemiSky: 0xb7d0e0, hemiGround: 0x3d3830, hemiIntensity: 0.56,
      ambient: 0.34, fill: 0.18, moon: 0,
      stars: 0, sunSprite: 0.8, sunSpriteColor: 0xfff1cf, sunDir: [0.5, 0.62, 0.4],
      glowFactor: 0, lightFactor: 0
    },
    dusk: {
      label: "黄昏", next: "night",
      exposure: 1.06,
      fog: 0xa88978, fogDensity: 0.0019,
      top: 0x2f4260, horizon: 0xe8a978, glow: 0xff9a5a, sunPower: 1.15,
      sunColor: 0xffb877, sunIntensity: 1.7, sunPos: [-180, 52, 120],
      hemiSky: 0x8f9fbe, hemiGround: 0x2a2420, hemiIntensity: 0.4,
      ambient: 0.22, fill: 0.12, moon: 0.06,
      stars: 0.1, sunSprite: 0.9, sunSpriteColor: 0xffb877, sunDir: [-0.7, 0.2, 0.5],
      glowFactor: 0.32, lightFactor: 0.25
    },
    night: {
      label: "夜览", next: "day",
      exposure: 1.08,
      fog: 0x0c1420, fogDensity: 0.0024,
      top: 0x02060e, horizon: 0x172433, glow: 0x6f5a45, sunPower: 0.35,
      sunColor: 0x9db8ff, sunIntensity: 0.18, sunPos: [-220, 180, -100],
      hemiSky: 0x22344a, hemiGround: 0x0d0d0a, hemiIntensity: 0.16,
      ambient: 0.07, fill: 0.04, moon: 0.38,
      stars: 1, sunSprite: 0, sunSpriteColor: 0xdfe8ff, sunDir: [-0.5, 0.55, -0.3],
      glowFactor: 1, lightFactor: 1
    }
  };

  function applyTime(name) {
    var p = TIME_PRESETS[name];
    state.time = name;
    ui.timeBtn.textContent = p.label;
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
    if (renderer && renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
    hemi.color.copy(lin(p.hemiSky));
    hemi.groundColor.copy(lin(p.hemiGround));
    hemi.intensity = p.hemiIntensity;
    ambient.intensity = p.ambient;
    fillLight.intensity = p.fill;
    fillLight2.intensity = name === "day" ? 0.3 : name === "dusk" ? 0.16 : 0.05;
    moon.intensity = p.moon;
    sunSprite.position.set(p.sunDir[0] * 900, Math.max(120, p.sunDir[1] * 900), p.sunDir[2] * 900);
    moonSprite.position.set(-p.sunDir[0] * 700, Math.max(240, p.sunDir[1] * 700), -p.sunDir[2] * 700);
    sunSprite.material.opacity = p.sunSprite;
    sunSprite.material.color.copy(lin(p.sunSpriteColor));
    sunSprite.visible = p.sunSprite > 0;
    moonSprite.material.opacity = name === "night" ? 0.8 : name === "dusk" ? 0.12 : 0;
    moonSprite.visible = moonSprite.material.opacity > 0;
    starField.material.opacity = p.stars;
    starField.visible = p.stars > 0;

    if (yqf) {
      yqf.nightMats.forEach(function (m) {
        if (!m) return;
        m.emissiveIntensity = (m.userData.glowBase || 0.7) * p.glowFactor;
      });
      yqf.lanternLights.forEach(function (l) {
        l.visible = name !== "day";
        l.intensity = p.lightFactor * (l.userData.nightIntensity || 1);
      });
      if (yqf.waterMat) yqf.waterMat.emissiveIntensity = name === "night" ? 1.0 : name === "dusk" ? 0.5 : 0.2;
      if (yqf.lakeMat) yqf.lakeMat.emissiveIntensity = name === "night" ? 1.05 : name === "dusk" ? 0.55 : 0.22;
      if (yqf.moonGlowMat) yqf.moonGlowMat.opacity = name === "night" ? 0.82 : name === "dusk" ? 0.32 : 0.12;
      if (yqf.reflectArcMat) yqf.reflectArcMat.opacity = name === "night" ? 0.75 : name === "dusk" ? 0.55 : 0.42;
      if (yqf.glintMats) yqf.glintMats.forEach(function (gm) {
        gm.opacity = name === "night" ? 0.34 : name === "dusk" ? 0.26 : 0.2;
      });
    }
    document.body.classList.toggle("night-mode", name === "night");
    ui.timeBtn.setAttribute("aria-pressed", name === "night" ? "true" : "false");
  }

  /* ---------------- 相机与运镜 ---------------- */

  function orbitFromPos(pos, target) {
    var off = pos.clone().sub(target);
    var radius = off.length();
    return {
      theta: Math.atan2(off.x, off.z),
      phi: Math.acos(clamp(off.y / radius, -1, 1)),
      radius: radius,
      target: target.clone()
    };
  }

  function applyViewFov(v) {
    camera.fov = v.fov || baseFov;
    camera.updateProjectionMatrix();
  }

  var MOBILE_VIEWS = {
    gate:   { pos: [0, 3.8, 7.2],  target: [0, 3.8, -9],   fov: 78 },
    lane:   { pos: [0, 3.0, -13],   target: [1.5, 3.0, -50], fov: 64 },
    opera:  { pos: [80, 4.2, -78],  target: [60, 3.6, -66], fov: 68 },
    water:  { pos: [62, 2.7, -123.5], target: [30, 1.7, -116.5], fov: 62 },
    bahe:   { pos: [108, 3.4, 7],   target: [118, 4.2, -9], fov: 66 },
    arcade: { pos: [50, 2.6, -4.5], target: [110, 4.2, 8.0], fov: 66 },
    plaza:  { pos: [14, 3.3, -14],  target: [30, 2.5, -30], fov: 66 }
  };

  function resolveView(v) {
    if (!isMobile || v.id === "intro") return v;
    var mobile = MOBILE_VIEWS[v.id];
    if (mobile) {
      return { id: v.id, chapter: v.chapter, pos: mobile.pos, target: mobile.target, fov: mobile.fov };
    }
    return {
      id: v.id, chapter: v.chapter,
      pos: v.pos, target: v.target,
      fov: Math.min(78, (v.fov || baseFov) + 6)
    };
  }

  function setCameraImmediate(view) {
    var v = resolveView(typeof view === "string" ? VIEWS[view] : view);
    var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
    var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
    applyViewFov(v);
    camera.position.copy(pos);
    camera.lookAt(target);
    var o = orbitFromPos(pos, target);
    desired.theta = orbit.theta = o.theta;
    desired.phi = orbit.phi = o.phi;
    desired.radius = orbit.radius = o.radius;
    desired.target.copy(o.target);
    orbit.target.copy(o.target);
    if (v.chapter) ui.chapter.textContent = v.chapter;
  }

  function flyTo(view) {
    state.cinematic = false;
    state.mode = "free";
    var v = resolveView(typeof view === "string" ? VIEWS[view] : view);
    var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
    var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
    applyViewFov(v);
    var o = orbitFromPos(pos, target);
    desired.theta = o.theta;
    desired.phi = o.phi;
    desired.radius = o.radius;
    desired.target.copy(o.target);
    if (v.chapter) ui.chapter.textContent = v.chapter;
    setActiveView(v.id || null);
  }

  function enterFree(view) {
    state.cinematic = false;
    state.mode = "free";
    document.body.classList.remove("intro-active");
    ui.intro.classList.add("hidden");
    flyTo(view || VIEWS.gate);
    setActiveView(view && view.id ? view.id : "gate");
    updateProgress(100);
  }

  function startCinematic() {
    document.body.classList.remove("intro-active");
    ui.intro.classList.add("hidden");
    state.cinematic = true;
    state.mode = "cinematic";
    state.cineTime = 0;
    state.cineSeg = 0;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    setActiveView(null);
    updateProgress(0);
    closeInfo();
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
  var cineTarget = new THREE.Vector3();

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
      stopCinematic();
      flyTo("arcade");
      return;
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
    var k = 1 - Math.pow(0.001, dt);
    orbit.theta += (desired.theta - orbit.theta) * k * 0.72;
    orbit.phi += (desired.phi - orbit.phi) * k * 0.72;
    orbit.radius += (desired.radius - orbit.radius) * k * 0.72;
    orbit.target.lerp(desired.target, k * 0.72);
    var sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
    );
    camera.lookAt(orbit.target);
    if (state.mode !== "intro") ui.chapter.textContent = currentViewChapter();
  }

  function currentViewChapter() {
    if (activeCraft) {
      var craft = hotspots.find(function (h) { return h.id === activeCraft; });
      if (craft) return craft.name + " · " + craft.facts[0][1];
    }
    var v = VIEWS[state.activeView];
    if (v) return v.chapter;
    return "自由探索 · 拖动环绕";
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
    modelRoot.updateMatrixWorld(true);
    modelRoot.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh || o.isSprite) return;
      if (!o.material || o.material.transparent) return;
      var box = new THREE.Box3().setFromObject(o);
      var size = box.getSize(new THREE.Vector3());
      var dims = [size.x, size.y, size.z].sort(function (a, b) { return b - a; });
      if (dims[1] < 3.4 || dims[1] > 45) return;
      occluders.push(o);
    });
  }

  function refreshOcclusion() {
    hotspots.forEach(function (h) {
      occlusionDir.subVectors(h.pos, camera.position);
      var dist = occlusionDir.length();
      occlusionDir.normalize();
      occlusionRay.set(camera.position, occlusionDir);
      occlusionRay.near = 0.2;
      occlusionRay.far = Math.max(0.3, dist - 0.9);
      occluded[h.id] = occlusionRay.intersectObjects(occluders, false).length > 0;
    });
  }

  function updateHotspots() {
    if (state.mode === "intro" || state.mode === "cinematic") {
      Object.keys(hotspotEls).forEach(function (id) { hotspotEls[id].classList.remove("visible"); });
      return;
    }
    occlusionTick++;
    if (occlusionTick % 10 === 1) refreshOcclusion();
    var placed = [];
    hotspots.forEach(function (h) {
      var el = hotspotEls[h.id];
      projection.copy(h.pos).project(camera);
      var behind = projection.z > 1 || projection.z < -1;
      var dist = camera.position.distanceTo(h.pos);
      var x = (projection.x * 0.5 + 0.5) * width;
      var y = (-projection.y * 0.5 + 0.5) * height;
      var blocked = occluded[h.id];
      var edge = Math.max(el.offsetWidth, 40) / 2 + 8;
      var hide = behind || blocked || dist > 120 || x < 0 || x > width || y < 80 || y > height - 120;
      if (hide) {
        el.classList.remove("visible");
      } else {
        x = Math.max(edge, Math.min(width - edge, x));
        var guard = 0;
        while (guard < 5 && placed.some(function (p) { return Math.abs(p.x - x) < 94 && Math.abs(p.y - y) < 36; })) {
          y += 36;
          guard++;
        }
        if (y > height - 120) {
          el.classList.remove("visible");
        } else {
          placed.push({ x: x, y: y });
          el.style.left = x + "px";
          el.style.top = y + "px";
          el.classList.add("visible");
        }
      }
      el.classList.toggle("active", activeCraft === h.id);
    });
  }

  function openInfo(id) {
    var h = hotspots.find(function (item) { return item.id === id; });
    if (!h) return;
    activeCraft = id;
    ui.infoKicker.textContent = "永庆坊 · " + h.no;
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
    flyTo({ pos: [h.view.pos.x, h.view.pos.y, h.view.pos.z], target: [h.view.target.x, h.view.target.y, h.view.target.z] });
    ui.chapter.textContent = h.name + " · " + h.facts[0][1];
  }

  /* ---------------- 4K 与考据 ---------------- */

  function export4K() {
    if (state.shooting) return;
    if (isMobile) {
      showToast("4K 导出建议在桌面端使用");
      return;
    }
    if (!renderer || renderer.capabilities.maxTextureSize < 4096) {
      showToast("当前设备不支持 4K 画布");
      return;
    }
    state.shooting = true;
    showToast("正在渲染 4K（3840 × 2160）…");
    var oldW = width;
    var oldH = height;
    var oldRatio = renderer.getPixelRatio();
    var oldAspect = camera.aspect;
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
          if (!blob) {
            showToast("4K 渲染失败，请重试");
            return;
          }
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "yongqingfang-enning-4k.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          showToast("4K 截图已保存");
        }, "image/png");
      } catch (error) {
        renderer.setPixelRatio(oldRatio);
        renderer.setSize(oldW, oldH, false);
        camera.aspect = oldAspect;
        camera.updateProjectionMatrix();
        state.shooting = false;
        showToast("4K 渲染失败：" + (error.message || "未知错误"));
      }
    }, 60);
  }

  function openAbout() {
    ui.aboutPanel.hidden = false;
    closeInfo();
  }

  function closeAbout() {
    ui.aboutPanel.hidden = true;
  }

  function showCityButton() {
    ui.cityBtn.hidden = false;
  }

  function goCity() {
    if (inFrame) {
      window.parent.postMessage({ type: "canton-open-city", spot: "yongqingfang" }, "*");
    } else {
      window.location.href = "index.html?spot=yongqingfang&jump=1";
    }
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    ui.startBtn.addEventListener("click", startCinematic);
    ui.skipIntroBtn.addEventListener("click", function () { enterFree(VIEWS.gate); });
    ui.timeBtn.addEventListener("click", function () {
      var next = TIME_PRESETS[state.time].next;
      applyTime(next);
      showToast("时段 · " + TIME_PRESETS[next].label + (next === "night" ? " · 照明示意" : ""));
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
      setActiveView(name);
      flyTo(VIEWS[name]);
      closeInfo();
    });

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", function () {
      flyTo(VIEWS.gate);
      setActiveView("gate");
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

    if (params.get("view") && VIEWS[params.get("view")] && params.get("embed") !== "1") {
      window.setTimeout(function () {
        enterFree(VIEWS[params.get("view")]);
        setActiveView(params.get("view"));
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
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = { x: event.clientX, y: event.clientY };
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* synthetic or already-released pointer */ }
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
      desired.radius = clamp(pinch.radius * (pinch.dist / Math.max(dist, 1)), 10, 500);
      return;
    }
    if (!drag) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    desired.theta -= dx * 0.0052;
    desired.phi = clamp(desired.phi - dy * 0.0042, 0.16, 1.52);
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
    desired.radius = clamp(desired.radius * Math.exp(event.deltaY * 0.0011), 10, 500);
    setActiveView(null);
  }

  function onResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    var activeDpr = state.shooting ? 1 : dpr;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(activeDpr);
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
    var time = clock.elapsedTime;

    if (state.cinematic) {
      updateCinematic(dt);
    } else if (state.mode !== "intro") {
      updateOrbit(dt);
    }

    if (yqf && yqf.waterMat && yqf.waterMat.map) {
      yqf.waterMat.map.offset.x = (time * 0.008) % 1;
      yqf.waterMat.map.offset.y = (time * 0.003) % 1;
    }
    if (yqf && yqf.lakeMat && yqf.lakeMat.map) {
      yqf.lakeMat.map.offset.x = (time * 0.004) % 1;
      yqf.lakeMat.map.offset.y = (time * 0.0022) % 1;
    }
    if (yqf && yqf.glintMats) {
      for (var gi = 0; gi < yqf.glintMats.length; gi++) {
        var gm = yqf.glintMats[gi];
        if (gm.map) {
          gm.map.offset.x = (time * (gi === 0 ? 0.006 : 0.012)) % 1;
          gm.map.offset.y = (time * 0.002) % 1;
        }
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

  window.YongqingfangDebug = {
    get fps() { return state.fps; },
    get mode() { return state.mode; },
    get view() { return state.activeView; },
    get time() { return state.time; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get model() { return yqf; },
    get views() { return Object.keys(VIEWS); },
    get counts() {
      return renderer ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries
      } : null;
    },
    go: function (name) { flyTo(VIEWS[name] || VIEWS.gate); setActiveView(name); },
    snap: function (name) { setCameraImmediate(VIEWS[name] || VIEWS.gate); setActiveView(name); },
    look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
    open: openInfo,
    timeOfDay: function (name) { applyTime(name || "day"); }
  };

  initThree();
})();
