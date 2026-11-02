/* 陈家祠近景 · 渲染、运镜与交互 */
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
  var lanternNightLights = [];
  var chen = null;
  var modelRoot = null;
  var hotspots = [];
  var hotspotEls = {};
  var activeCraft = null;
  var toastTimer = null;

  var state = {
    mode: "intro",
    time: "morning",
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
    gate: { pos: [0, 11.2, 73], target: [0, 6.3, 36], chapter: "正门 · 五间三启" },
    ridge: { pos: [0, 17.6, 23], target: [0, 16.6, 5], chapter: "聚贤堂 · 27 米陶塑瓦脊" },
    terrace: { pos: [10.5, 4.2, 26], target: [0, 2.4, 17.2], chapter: "月台 · 石栏与铁铸" },
    hall: { pos: [2.5, 5.4, 12.4], target: [0, 3.9, -2.8], chapter: "聚贤堂 · 十二扇屏门" },
    rear: { pos: [0, 5.2, -15.5], target: [0, 3.6, -29.9], chapter: "后座 · 十一座神龛" },
    alley: { pos: [-15.2, 3.4, 35.5], target: [-15.2, 4.0, -16], chapter: "青云巷 · 两路之间的缝" },
    aerial: { pos: [60, 64, 82], target: [0, 3, 0], chapter: "全院 · 80 × 80 米" }
  };

  var CINE = [
    {
      dur: 4.5, chapter: "01 / 城市里的书院",
      pos: [82, 54, 106], target: [0, 6, 30],
      toPos: [36, 27, 82], toTarget: [0, 7, 36]
    },
    {
      dur: 3.6, chapter: "02 / 正门 · 五间三启",
      pos: [36, 27, 82], target: [0, 7, 36],
      toPos: [15, 10.5, 62], toTarget: [0, 7, 38]
    },
    {
      dur: 3.6, chapter: "02 / 正门 · 门神与石鼓",
      pos: [15, 10.5, 62], target: [0, 7, 38],
      toPos: [0, 8.4, 49], toTarget: [0, 6.8, 40]
    },
    {
      dur: 5.2, chapter: "03 / 屋脊 · 一条脊一台戏",
      pos: [0, 8.4, 49], target: [0, 6.8, 40],
      toPos: [8, 18.2, 27], toTarget: [0, 16.6, 5]
    },
    {
      dur: 4.0, chapter: "04 / 月台 · 石栏与铁铸",
      pos: [8, 18.2, 27], target: [0, 16.6, 5],
      toPos: [12, 6.2, 30], toTarget: [0, 4.2, 16]
    },
    {
      dur: 3.8, chapter: "05 / 聚贤堂 · 十二扇屏门",
      pos: [12, 6.2, 30], target: [0, 4.2, 16],
      toPos: [0, 4.9, 9.6], toTarget: [0, 4.5, -2.8]
    },
    {
      dur: 2.4, chapter: "05 / 聚贤堂 · 梁架与灯笼",
      pos: [0, 4.9, 9.6], target: [0, 4.5, -2.8],
      toPos: [0, 6.0, 23], toTarget: [0, 5.4, 8]
    },
    {
      dur: 6.4, chapter: "06 / 全院 · 三路三进",
      pos: [0, 6.0, 23], target: [0, 5.4, 8],
      toPos: [62, 66, 84], toTarget: [0, 3, 0]
    }
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
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x0a1214, 1);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xc4d0cc, 0.0026);

    camera = new THREE.PerspectiveCamera(isMobile ? 56 : 43, width / height, 0.1, 1800);
    clock = new THREE.Clock();

    buildSky();
    buildLights();

    var textures = window.ChenTextures.build(renderer);
    var built = window.ChenModel.build({ textures: textures, low: isMobile });
    chen = built;
    modelRoot = built.root;
    scene.add(modelRoot);
    hotspots = built.hotspots;
    collectOccluders();
    buildHotspotDom();

    applyTime("morning");
    setCameraImmediate(VIEWS.aerial);
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
      } else {
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
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 18), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    var starGeo = new THREE.BufferGeometry();
    var pos = [];
    for (var i = 0; i < 700; i++) {
      var a = Math.random() * Math.PI * 2;
      var e = 0.06 + Math.random() * 1.3;
      var r = 900 + Math.random() * 100;
      pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: lin(0xe7efff), size: 1.4, sizeAttenuation: false,
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
    ambient = new THREE.AmbientLight(lin(0xcfd8d4), 0.36);
    scene.add(ambient);
    hemi = new THREE.HemisphereLight(lin(0xbfd7e7), lin(0x4a4030), 0.55);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xffe3bd, 2.2);
    sun.position.set(70, 92, 66);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -78;
      sun.shadow.camera.right = 78;
      sun.shadow.camera.top = 78;
      sun.shadow.camera.bottom = -78;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 260;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 0.03;
    }
    sun.target.position.set(0, 4, 0);
    scene.add(sun);
    scene.add(sun.target);

    fillLight = new THREE.DirectionalLight(lin(0xb9d3dd), 0.28);
    fillLight.position.set(-80, 40, -40);
    scene.add(fillLight);

    var frontFill = new THREE.DirectionalLight(lin(0xffe0c4), 0.52);
    frontFill.position.set(0, 12, 80);
    frontFill.target.position.set(0, 4, 30);
    scene.add(frontFill);
    scene.add(frontFill.target);

    var doorSpot = new THREE.SpotLight(lin(0xffcf9c), 1.6, 26, 0.34, 0.75, 1.2);
    doorSpot.position.set(0, 8.5, 48);
    doorSpot.target.position.set(0, 4.2, 40);
    scene.add(doorSpot);
    scene.add(doorSpot.target);

    moon = new THREE.DirectionalLight(lin(0x9db9ff), 0.0);
    moon.position.set(-60, 100, -50);
    scene.add(moon);

    [
      [0, 4.5, 29], [0, 4.5, -8]
    ].forEach(function (p) {
      var light = new THREE.PointLight(lin(0xffb46a), 0.0, 26, 2);
      light.position.set(p[0], p[1], p[2]);
      scene.add(light);
      lanternNightLights.push(light);
    });
  }

  /* ---------------- 时段 ---------------- */

  var TIME_PRESETS = {
    morning: {
      label: "晨光", next: "noon",
      exposure: 1.12,
      fog: 0xa8bdc4, fogDensity: 0.0032,
      top: 0x1d5a88, horizon: 0xb7cdd6, glow: 0xe8b878, sunPower: 1.2,
      sunColor: 0xffd6a0, sunIntensity: 3.6, sunPos: [66, 72, 86],
      hemiSky: 0x8fb5d2, hemiGround: 0x332d24, hemiIntensity: 0.38,
      ambient: 0.2, fill: 0.12,
      lantern: 0.5, window: 0.4, fire: 0.25,
      stars: 0, moon: 0, sunSprite: 0.78,
      sunSpriteColor: 0xffd39a, sunDir: [0.5, 0.5, 0.7]
    },
    noon: {
      label: "正午", next: "night",
      exposure: 1.04,
      fog: 0xb0c4c8, fogDensity: 0.0028,
      top: 0x1a5688, horizon: 0xc2d4d8, glow: 0xffe8b8, sunPower: 0.9,
      sunColor: 0xfff0d2, sunIntensity: 3.8, sunPos: [18, 105, 30],
      hemiSky: 0xaacbe2, hemiGround: 0x3b3429, hemiIntensity: 0.42,
      ambient: 0.24, fill: 0.12,
      lantern: 0.24, window: 0.3, fire: 0.12,
      stars: 0, moon: 0, sunSprite: 0.86,
      sunSpriteColor: 0xfff1cf, sunDir: [0.15, 0.92, 0.25]
    },
    night: {
      label: "夜游", next: "morning",
      exposure: 1.26,
      fog: 0x0d1b23, fogDensity: 0.005,
      top: 0x050d17, horizon: 0x152a33, glow: 0x8f5e44, sunPower: 0.5,
      sunColor: 0x9fbaff, sunIntensity: 0.52, sunPos: [-45, 95, -40],
      hemiSky: 0x2b3d53, hemiGround: 0x18120c, hemiIntensity: 0.34,
      ambient: 0.18, fill: 0.08,
      lantern: 1.85, window: 1.25, fire: 1.25,
      stars: 0.9, moon: 0.85, sunSprite: 0,
      sunSpriteColor: 0xdfe8ff, sunDir: [-0.35, 0.6, -0.4]
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
    moon.intensity = name === "night" ? 0.32 : 0;
    sunSprite.material.opacity = p.sunSprite;
    sunSprite.material.color.copy(lin(p.sunSpriteColor));
    sunSprite.visible = p.sunSprite > 0;
    moonSprite.material.opacity = p.moon;
    moonSprite.visible = p.moon > 0;
    starField.material.opacity = p.stars;
    starField.visible = p.stars > 0;

    if (chen) {
      chen.lanternMats.forEach(function (m) { m.emissiveIntensity = p.lantern; });
      chen.windowMats.forEach(function (m) { m.emissiveIntensity = p.window; });
      chen.flickerLights.forEach(function (l) { l.intensity = p.fire; });
    }
    lanternNightLights.forEach(function (l) { l.intensity = name === "night" ? 0.75 : 0; });
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

  function setCameraImmediate(view) {
    var v = typeof view === "string" ? VIEWS[view] : view;
    var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
    var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
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
    var v = typeof view === "string" ? VIEWS[view] : view;
    var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
    var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
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
      flyTo("aerial");
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
      if (dims[1] < 3.4) return;
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
      var blocked = camera.position.y < 26 && occluded[h.id];
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
    ui.infoKicker.textContent = "岭南七绝 · " + h.no;
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
          a.download = "chen-clan-hall-4k.png";
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
      window.parent.postMessage({ type: "canton-open-city", spot: "chenjiaci" }, "*");
    } else {
      window.location.href = "index.html?spot=chenjiaci&jump=1";
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
      canvas.setPointerCapture(event.pointerId);
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
      desired.radius = clamp(pinch.radius * (pinch.dist / Math.max(dist, 1)), 10, 190);
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
    desired.radius = clamp(desired.radius * Math.exp(event.deltaY * 0.0011), 10, 190);
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

    if (chen) {
      var flick = state.time === "night" ? 0.86 + Math.sin(time * 7.3) * 0.06 + Math.sin(time * 13.1) * 0.03 : 1;
      chen.flickerLights.forEach(function (l, i) {
        l.intensity = (state.time === "night" ? 1.0 : 0.16) * flick * (i % 2 ? 0.9 : 1.05);
      });
      chen.lanternMats.forEach(function (m) {
        m.emissiveIntensity = (state.time === "night" ? 1.75 : 0.3) * flick;
      });
    }
    if (state.time === "night") {
      lanternNightLights.forEach(function (l) { l.intensity = 0.72 * flick; });
    }

    clouds.forEach(function (c) {
      c.sprite.position.x += c.speed * dt;
      if (c.sprite.position.x > 340) c.sprite.position.x = -340;
    });

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

  window.ChenDebug = {
    get fps() { return state.fps; },
    get mode() { return state.mode; },
    get view() { return state.activeView; },
    get time() { return state.time; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get model() { return chen; },
    get counts() {
      return renderer ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries
      } : null;
    },
    view: function (name) { flyTo(VIEWS[name] || VIEWS.gate); setActiveView(name); },
    look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
    open: openInfo,
    timeOfDay: function (name) { applyTime(name || "morning"); }
  };

  initThree();
})();
