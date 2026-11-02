/* 白云山 · 摩星岭近景 · 渲染、运镜与交互 */
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
  var clouds = [];
  var baiyun = null;
  var modelRoot = null;
  var hotspots = [];
  var hotspotEls = {};
  var activeCraft = null;
  var toastTimer = null;

  var state = {
    mode: "intro",
    time: "dawn",
    cinematic: false,
    cineTime: 0,
    cineTotal: 30,
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
    radius: 74,
    target: new THREE.Vector3(0, 7, 30)
  };
  var orbit = {
    theta: 0.42,
    phi: 1.16,
    radius: 74,
    target: new THREE.Vector3(0, 7, 30)
  };

  var VIEWS = {
    gate: { id: "gate", pos: [36, 10, 150], target: [0, -20, 60], fov: 52, chapter: "门岗 · 吉星石" },
    paifang: { id: "paifang", pos: [0, -20, -8], target: [0, -4, -45], fov: 52, chapter: "锦绣南天 · 石级" },
    escalator: { id: "escalator", pos: [-72, 2, 58], target: [-16, -10, -42], fov: 55, chapter: "栈道 · 两段扶梯" },
    platform: { id: "platform", pos: [0, 3.2, -75], target: [0, 3.2, -91], fov: 54, chapter: "山顶平台 · 382 米" },
    pavilion: { id: "pavilion", pos: [-9, 3.8, -80], target: [2, 3.4, -93], fov: 48, chapter: "山顶观景亭" },
    city: { id: "city", pos: [0, 6.5, -80], target: [0, -180, 1600], fov: 55, chapter: "南望 · 城市与珠江" },
    cloudsea: { id: "cloudsea", pos: [80, 26, -80], target: [-60, -60, 800], fov: 58, chapter: "云海 · 山脊" },
    intro: { pos: [150, 70, 250], target: [0, -10, 20], fov: 50, chapter: "" }
  };

  var CINE = [
    { dur: 5.0, chapter: "01 / 白云山 · 摩星岭", pos: [180, 90, 300], target: [0, -10, 0], toPos: [90, 34, 190], toTarget: [0, -20, 40] },
    { dur: 4.5, chapter: "02 / 门岗 · 吉星石", pos: [90, 34, 190], target: [0, -20, 40], toPos: [46, 16, 166], toTarget: [0, -22, 70] },
    { dur: 4.5, chapter: "03 / 吉星石 · 摩星岭", pos: [46, 16, 166], target: [0, -22, 70], toPos: [24, -20, 130], toTarget: [8, -23, 110] },
    { dur: 4.5, chapter: "04 / 石级 · 锦绣南天", pos: [24, -20, 130], target: [8, -23, 110], toPos: [0, -9, -22], toTarget: [0, -7, -45] },
    { dur: 4.5, chapter: "05 / 栈道 · 两段扶梯", pos: [0, -20, -8], target: [0, -6, -45], toPos: [-72, 2, 58], toTarget: [-16, -10, -42] },
    { dur: 4.5, chapter: "06 / 山顶平台 · 382 米", pos: [-72, 2, 58], target: [-16, -10, -42], toPos: [0, 3.2, -75], toTarget: [0, 3.2, -91] },
    { dur: 6.0, chapter: "07 / 南望 · 城市与珠江", pos: [-1.5, 3.6, -72], target: [-1.5, 3.2, -91], toPos: [0, 6.5, -80], toTarget: [0, -180, 1600] }
  ];
  var CINE_TOTAL = CINE.reduce(function (sum, s) { return sum + s.dur; }, 0);

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpVec(a, b, t, out) {
    out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
    return out;
  }

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
    renderer.toneMappingExposure = 1.02;
    renderer.setClearColor(0x0a1418, 1);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x9fb0c2, 0.00026);

    camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.1, 30000);
    clock = new THREE.Clock();

    buildSky();
    buildLights();

    var textures = window.BaiyunTextures.build(renderer);
    var built = window.BaiyunModel.build({ textures: textures, low: isMobile });
    baiyun = built;
    modelRoot = built.root;
    scene.add(modelRoot);
    hotspots = built.hotspots;
    collectOccluders();
    buildHotspotDom();

    applyTime("dawn");
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
        window.setTimeout(function () {
          var startView = params.get("view");
          if (startView && VIEWS[startView]) {
            enterFree(VIEWS[startView]);
            setActiveView(startView);
          } else if (!reducedMotion) {
            startCinematic();
          } else {
            enterFree(VIEWS.gate);
          }
        }, 650);
        document.body.classList.remove("intro-active");
        ui.intro.classList.remove("hidden");
        showCityButton();
      }
    }, 260);
  }

  function buildSky() {
    skyUniforms = {
      topColor: { value: new THREE.Color(0x5b86a3) },
      horizonColor: { value: new THREE.Color(0xd8dfd4) },
      glowColor: { value: new THREE.Color(0xf0c48d) },
      sunDir: { value: new THREE.Vector3(0.5, 0.55, 0.65).normalize() },
      sunPower: { value: 0.9 }
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
        "  float band = smoothstep(0.0, 0.025, abs(vDir.y)) * (1.0 - smoothstep(0.02, 0.08, abs(vDir.y)));",
        "  col += glowColor * band * 0.08;",
        "  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.4545)), 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 18), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    var starGeo = new THREE.BufferGeometry();
    var pos = [];
    for (var i = 0; i < 1000; i++) {
      var a = Math.random() * Math.PI * 2;
      var e = 0.06 + Math.random() * 1.3;
      var r = 6000 + Math.random() * 100;
      pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: lin(0xe7efff), size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0.0, depthWrite: false
    }));
    scene.add(starField);

    var glowTex = window.ChenTextures && window.ChenTextures.cloud ? null : null;
    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffdfab, transparent: true, opacity: 0.65,
      blending: THREE.AdditiveBlending, depthWrite: false,
      map: makeGlowTexture()
    }));
    sunSprite.position.set(260, 210, 320);
    sunSprite.scale.set(90, 90, 1);
    scene.add(sunSprite);

    moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: lin(0xdce7ff), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
      map: makeGlowTexture()
    }));
    moonSprite.position.set(-220, 240, -300);
    moonSprite.scale.set(55, 55, 1);
    scene.add(moonSprite);

    /* 云层保持极轻，避免抢建筑轮廓 */
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

  function makeCloudCanvas() {
    var c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (var i = 0; i < 12; i++) {
      var x = 50 + i * 35;
      var y = 72 + Math.sin(i * 0.8) * 10;
      ctx.beginPath();
      ctx.arc(x, y, 24 + Math.random() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(30, 64, 450, 30);
    return c;
  }

  function buildLights() {
    ambient = new THREE.AmbientLight(lin(0xcfd8d4), 0.22);
    scene.add(ambient);
    hemi = new THREE.HemisphereLight(lin(0xbfd7e7), lin(0x4a4030), 0.4);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xffe3bd, 2.4);
    sun.position.set(180, 160, 220);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -170;
      sun.shadow.camera.right = 170;
      sun.shadow.camera.top = 170;
      sun.shadow.camera.bottom = -170;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 600;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 0.03;
    }
    sun.target.position.set(0, -10, -30);
    scene.add(sun);
    scene.add(sun.target);

    fillLight = new THREE.DirectionalLight(lin(0xb9d3dd), 0.18);
    fillLight.position.set(-120, 80, -60);
    scene.add(fillLight);

    moon = new THREE.DirectionalLight(lin(0x9db9ff), 0.0);
    moon.position.set(-260, 200, -120);
    scene.add(moon);
  }

  /* ---------------- 时段 ---------------- */

  var TIME_PRESETS = {
    dawn: {
      label: "云海晨曦", next: "day",
      exposure: 1.02,
      fog: 0x9fb0c2, fogDensity: 0.00026,
      top: 0x2c4a68, horizon: 0xe8c6a4, glow: 0xffb877, sunPower: 1.1,
      sunColor: 0xffd6a4, sunIntensity: 1.4, sunPos: [420, 60, 300],
      hemiSky: 0x8fa8c8, hemiGround: 0x2a2c24, hemiIntensity: 0.38,
      ambient: 0.22, fill: 0.12,
      city: 0.15, stars: 0.18, moon: 0.1, sunSprite: 0.8,
      sunSpriteColor: 0xffc98f, sunDir: [0.8, 0.1, 0.5], cloud: 0.55, platform: 0.35
    },
    day: {
      label: "晴日", next: "night",
      exposure: 1.0,
      fog: 0xc8d3d8, fogDensity: 0.00018,
      top: 0x3a7cab, horizon: 0xdfe9ee, glow: 0xfff2cf, sunPower: 1.0,
      sunColor: 0xfff2d8, sunIntensity: 3.0, sunPos: [180, 160, 220],
      hemiSky: 0xb7d0e0, hemiGround: 0x3d3830, hemiIntensity: 0.46,
      ambient: 0.3, fill: 0.18,
      city: 0, stars: 0, moon: 0, sunSprite: 0.85,
      sunSpriteColor: 0xfff1cf, sunDir: [0.35, 0.75, 0.4], cloud: 0, platform: 0
    },
    night: {
      label: "夜览", next: "dawn",
      exposure: 1.08,
      fog: 0x0a1420, fogDensity: 0.00032,
      top: 0x02060e, horizon: 0x132433, glow: 0x6f5a45, sunPower: 0.4,
      sunColor: 0x9db8ff, sunIntensity: 0.2, sunPos: [-260, 200, -120],
      hemiSky: 0x22344a, hemiGround: 0x0e0e0b, hemiIntensity: 0.14,
      ambient: 0.06, fill: 0.04,
      city: 1, stars: 1, moon: 0.85, sunSprite: 0,
      sunSpriteColor: 0xdfe8ff, sunDir: [-0.5, 0.55, -0.3], cloud: 0.12, platform: 1
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
    hemi.color.copy(lin(p.hemiSky));
    hemi.groundColor.copy(lin(p.hemiGround));
    hemi.intensity = p.hemiIntensity;
    ambient.intensity = p.ambient;
    fillLight.intensity = p.fill;
    moon.intensity = name === "night" ? 0.42 : 0;
    sunSprite.position.set(p.sunDir[0] * 900, Math.max(120, p.sunDir[1] * 900), p.sunDir[2] * 900);
    moonSprite.position.set(-p.sunDir[0] * 700, Math.max(260, p.sunDir[1] * 700), -p.sunDir[2] * 700);
    sunSprite.material.opacity = p.sunSprite;
    sunSprite.material.color.copy(lin(p.sunSpriteColor));
    sunSprite.visible = p.sunSprite > 0;
    moonSprite.material.opacity = p.moon;
    moonSprite.visible = p.moon > 0;
    starField.material.opacity = p.stars;
    starField.visible = p.stars > 0;

    if (baiyun) {
      (baiyun.cityWinMats || []).forEach(function (m) { m.emissiveIntensity = (p.city || 0) * 1.4; });
      if (baiyun.cityLightMat) baiyun.cityLightMat.opacity = p.city || 0;
      if (baiyun.cloudSeaMat) baiyun.cloudSeaMat.opacity = (p.cloud || 0) * 0.7;
      if (baiyun.riverMat) baiyun.riverMat.emissiveIntensity = (p.city || 0) * 0.55;
      (baiyun.cloudMats || []).forEach(function (m) { m.opacity = (p.cloud || 0) * (m.userData.baseOpacity || 1); });
      (baiyun.platformLights || []).forEach(function (l) { l.intensity = p.platform || 0; });
      (baiyun.pathLights || []).forEach(function (l) { l.intensity = (p.platform || 0) * 0.7; });
      (baiyun.landmarkMats || []).forEach(function (m) { m.emissiveIntensity = p.city || 0; });
    }
    document.body.classList.toggle("night-mode", name === "night");
    if (ui.timeBtn) ui.timeBtn.setAttribute("aria-pressed", name === "night" ? "true" : "false");
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

  function resolveView(v) {
    if (!isMobile || (v.id !== "platform" && v.id !== "pavilion")) return v;
    var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
    var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
    pos.sub(target).multiplyScalar(1.75).add(target);
    return {
      id: v.id, chapter: v.chapter,
      pos: [pos.x, pos.y, pos.z],
      target: v.target,
      fov: Math.min(78, (v.fov || baseFov) + 8)
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
    var shot = v.chapter;
    if (shot) ui.chapter.textContent = shot;
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
    var o = orbitFromPos(camera.position.clone(), currentTarget());
    desired.theta = orbit.theta = o.theta;
    desired.phi = orbit.phi = o.phi;
    desired.radius = orbit.radius = o.radius;
    desired.target.copy(o.target);
    orbit.target.copy(o.target);
  }

  var tmpA = new THREE.Vector3();
  var tmpB = new THREE.Vector3();
  var cineTarget = new THREE.Vector3();

  function currentTarget() {
    return cineTarget.clone();
  }

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
      flyTo("city");
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

  function terrainBlocked(from, to) {
    if (!window.BaiyunModel || !window.BaiyunModel.heightAt) return false;
    var steps = 20;
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var x = from.x + (to.x - from.x) * t;
      var y = from.y + (to.y - from.y) * t;
      var z = from.z + (to.z - from.z) * t;
      if (y < window.BaiyunModel.heightAt(x, z) + 0.35) return true;
    }
    return false;
  }

  function updateHotspots() {
    if (state.mode === "intro" || state.mode === "cinematic") {
      Object.keys(hotspotEls).forEach(function (id) { hotspotEls[id].classList.remove("visible"); });
      return;
    }
    if (camera.position.y < 26) {
      occlusionTick++;
      if (occlusionTick % 10 === 1) refreshOcclusion();
    } else {
      occluded = {};
    }
    var placed = [];
    hotspots.forEach(function (h) {
      var el = hotspotEls[h.id];
      projection.copy(h.pos).project(camera);
      var behind = projection.z > 1 || projection.z < -1;
      var dist = camera.position.distanceTo(h.pos);
      var x = (projection.x * 0.5 + 0.5) * width;
      var y = (-projection.y * 0.5 + 0.5) * height;
      var blocked = (camera.position.y < 26 && occluded[h.id]) || terrainBlocked(camera.position, h.pos);
      var hide = behind || blocked || dist > 150 || x < 18 || x > width - 18 || y < 80 || y > height - 120;
      if (hide) {
        el.classList.remove("visible");
      } else {
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
    ui.infoKicker.textContent = "摩星岭 · " + h.no;
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
          a.download = "baiyun-moxingling-4k.png";
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
      window.parent.postMessage({ type: "canton-open-city", spot: "baiyun" }, "*");
    } else {
      window.location.href = "index.html?spot=baiyun&jump=1";
    }
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    ui.startBtn.addEventListener("click", startCinematic);
    ui.skipIntroBtn.addEventListener("click", function () { enterFree(VIEWS.gate); });
    ui.timeBtn.addEventListener("click", function () {
      applyTime(TIME_PRESETS[state.time].next);
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
      desired.radius = clamp(pinch.radius * (pinch.dist / Math.max(dist, 1)), 10, 2400);
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
    desired.radius = clamp(desired.radius * Math.exp(event.deltaY * 0.0011), 10, 2400);
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

    if (baiyun && state.time === "dawn") {
      baiyun.cloudSprites.forEach(function (c) {
        var x = c.baseX + (time * c.speed) % 2800;
        if (x > 1400) x -= 2800;
        c.sprite.position.x = x;
      });
    } else if (baiyun && state.time === "night") {
      baiyun.cloudSprites.forEach(function (c) {
        var x = c.baseX + (time * c.speed * 0.25) % 2800;
        if (x > 1400) x -= 2800;
        c.sprite.position.x = x;
      });
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

  window.BaiyunDebug = {
    get fps() { return state.fps; },
    get mode() { return state.mode; },
    get view() { return state.activeView; },
    get time() { return state.time; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get model() { return baiyun; },
    get counts() {
      return renderer ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries
      } : null;
    },
    go: function (name) { flyTo(VIEWS[name] || VIEWS.gate); setActiveView(name); },
    look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
    open: openInfo,
    timeOfDay: function (name) { applyTime(name || "dawn"); }
  };

  initThree();
})();
