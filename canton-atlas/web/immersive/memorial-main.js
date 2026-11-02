/* 中山纪念堂近景 · 渲染、运镜与交互 */
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
    yuexiuBtn: document.getElementById("yuexiuBtn"),
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
  var memorial = null;
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
    view: "lawn",
    activeView: "lawn",
    hoverHotspot: null,
    shooting: false
  };

  var desired = {
    theta: 0.42,
    phi: 1.16,
    radius: 74,
    target: new THREE.Vector3(0, 10, 40)
  };
  var orbit = {
    theta: 0.42,
    phi: 1.16,
    radius: 74,
    target: new THREE.Vector3(0, 10, 40)
  };

  var VIEWS = {
    gate: { id: "gate", pos: [0, 7.5, 154], target: [0, 8.5, 120], fov: 50, chapter: "01 / 门楼 · 东风中路" },
    lawn: { id: "lawn", pos: [30, 11, 118], target: [30, 11, 50], fov: 66, chapter: "02 / 前草坪 · 云鹤华表" },
    statue: { id: "statue", pos: [2.8, 7.3, 64], target: [0, 9.0, 50], fov: 44, chapter: "03 / 孙中山铜像" },
    facade: { id: "facade", pos: [0, 8, 48], target: [0, 14, 4], fov: 52, chapter: "04 / 南抱厦 · 天下为公" },
    roof: { id: "roof", pos: [46, 26, 22], target: [0, 30, -30], fov: 50, chapter: "05 / 八角蓝顶 · 四抱厦" },
    north: { id: "north", pos: [0, 26, -150], target: [0, 18, -30], fov: 48, chapter: "06 / 北侧 · 山在堂后" },
    corner: { id: "corner", pos: [62, 11, 30], target: [0, 13, -20], fov: 52, chapter: "07 / 东南角 · 平台与侧后" },
    intro: { pos: [80, 36, 190], target: [0, 12, 40], fov: 52, chapter: "" }
  };

  var CINE = [
    { dur: 5.0, chapter: "01 / 中山纪念堂 · 近代中轴", pos: [90, 42, 220], target: [0, 18, 90], toPos: [46, 26, 170], toTarget: [0, 12, 110] },
    { dur: 4.5, chapter: "02 / 门楼 · 东风中路", pos: [46, 26, 170], target: [0, 12, 110], toPos: [0, 8, 150], toTarget: [0, 9, 120] },
    { dur: 4.5, chapter: "03 / 前草坪 · 云鹤华表", pos: [0, 8, 150], target: [0, 9, 120], toPos: [0, 9, 112], toTarget: [0, 12, 50] },
    { dur: 4.5, chapter: "04 / 孙中山铜像", pos: [0, 9, 112], target: [0, 12, 50], toPos: [0, 5.5, 72], toTarget: [0, 8, 50] },
    { dur: 4.5, chapter: "05 / 南抱厦 · 天下为公", pos: [0, 5.5, 72], target: [0, 8, 50], toPos: [0, 6, 34], toTarget: [0, 13, 4] },
    { dur: 5.5, chapter: "06 / 八角蓝顶 · 四抱厦", pos: [0, 6, 34], target: [0, 13, 4], toPos: [46, 26, 22], toTarget: [0, 30, -30] },
    { dur: 5.5, chapter: "07 / 北侧 · 山在堂后", pos: [46, 26, 22], target: [0, 30, -30], toPos: [0, 12, -86], toTarget: [0, 16, -24] }
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
    renderer.setClearColor(0x0d1620, 1);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xcfd8dd, 0.0016);

    camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.1, 20000);
    clock = new THREE.Clock();

    buildSky();
    buildLights();

    var textures = window.MemorialTextures.build(renderer);
    var built = window.MemorialModel.build({ textures: textures, low: isMobile });
    memorial = built;
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
        document.body.classList.remove("intro-active");
        ui.intro.classList.add("hidden");
        var startView = params.get("view");
        var valid = startView && VIEWS[startView] ? startView : "lawn";
        enterFree(VIEWS[valid]);
        setActiveView(valid);
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
    sun.position.set(180, 220, 240);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -150;
      sun.shadow.camera.right = 150;
      sun.shadow.camera.top = 150;
      sun.shadow.camera.bottom = -150;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 520;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 0.03;
    }
    sun.target.position.set(0, 0, -10);
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
      label: "晨光", next: "day",
      exposure: 0.95,
      fog: 0xcfd8dc, fogDensity: 0.0018,
      top: 0x3f6f96, horizon: 0xf0d2ae, glow: 0xffb877, sunPower: 1.05,
      sunColor: 0xffd9b0, sunIntensity: 1.3, sunPos: [300, 90, 300],
      hemiSky: 0xa8c2d4, hemiGround: 0x5b5142, hemiIntensity: 0.36,
      ambient: 0.18, fill: 0.1, lamp: 0.18, window: 0.12,
      stars: 0, moon: 0, sunSprite: 0.75,
      sunSpriteColor: 0xffc98f, sunDir: [0.8, 0.18, 0.5]
    },
    day: {
      label: "晴日", next: "dusk",
      exposure: 0.92,
      fog: 0xdde6e8, fogDensity: 0.00125,
      top: 0x3f86b8, horizon: 0xeaf1f2, glow: 0xfff4d6, sunPower: 1.0,
      sunColor: 0xfff4dc, sunIntensity: 2.4, sunPos: [180, 220, 240],
      hemiSky: 0xbdd6e4, hemiGround: 0x5b5040, hemiIntensity: 0.44,
      ambient: 0.22, fill: 0.12, lamp: 0, window: 0,
      stars: 0, moon: 0, sunSprite: 0.8,
      sunSpriteColor: 0xfff1cf, sunDir: [0.35, 0.75, 0.4]
    },
    dusk: {
      label: "暮色", next: "dawn",
      exposure: 1.08,
      fog: 0x8a7a78, fogDensity: 0.0021,
      top: 0x2a3550, horizon: 0xf0a06a, glow: 0xff7a3c, sunPower: 1.15,
      sunColor: 0xffb27a, sunIntensity: 1.2, sunPos: [-260, 60, 200],
      hemiSky: 0x7b7590, hemiGround: 0x3a2c28, hemiIntensity: 0.4,
      ambient: 0.2, fill: 0.09, lamp: 1.15, window: 0.9,
      stars: 0.08, moon: 0.15, sunSprite: 0.9,
      sunSpriteColor: 0xffa26a, sunDir: [-0.55, 0.16, 0.45]
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
    moon.intensity = name === "dusk" ? 0.18 : 0;
    sunSprite.position.set(p.sunDir[0] * 900, Math.max(120, p.sunDir[1] * 900), p.sunDir[2] * 900);
    moonSprite.position.set(-p.sunDir[0] * 700, Math.max(260, p.sunDir[1] * 700), -p.sunDir[2] * 700);
    sunSprite.material.opacity = p.sunSprite;
    sunSprite.material.color.copy(lin(p.sunSpriteColor));
    sunSprite.visible = p.sunSprite > 0;
    moonSprite.material.opacity = p.moon;
    moonSprite.visible = p.moon > 0;
    starField.material.opacity = p.stars;
    starField.visible = p.stars > 0;

    if (memorial) {
      (memorial.lampLights || []).forEach(function (light) { light.intensity = p.lamp || 0; });
      (memorial.glowMats || []).forEach(function (mat) { mat.opacity = 0.12 + (p.lamp || 0) * 0.82; });
      (memorial.windowMats || []).forEach(function (mat) { mat.emissiveIntensity = (p.window || 0) * 1.1; });
    }
    document.body.classList.toggle("night-mode", name === "dusk");
    if (ui.timeBtn) ui.timeBtn.setAttribute("aria-pressed", name === "dusk" ? "true" : "false");
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
    if (!isMobile) return v;
    if (v.id === "lawn") {
      return {
        id: v.id, chapter: v.chapter,
        pos: [0, 8.5, 116],
        target: [0, 12.5, 20],
        fov: 72
      };
    }
    if (v.id === "facade") {
      return {
        id: v.id, chapter: v.chapter,
        pos: [0, 9, 46],
        target: [0, 13, 4],
        fov: 70
      };
    }
    var pos = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
    var target = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
    pos.sub(target).multiplyScalar(1.35).add(target);
    return {
      id: v.id, chapter: v.chapter,
      pos: [pos.x, pos.y, pos.z],
      target: [target.x, target.y, target.z],
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
    var shot = v.chapter;
    if (shot) ui.chapter.textContent = shot;
    setActiveView(v.id || null);
  }

  function enterFree(view) {
    state.cinematic = false;
    state.mode = "free";
    document.body.classList.remove("intro-active");
    ui.intro.classList.add("hidden");
    flyTo(view || VIEWS.lawn);
    setActiveView(view && view.id ? view.id : "lawn");
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
      flyTo("lawn");
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
      var blocked = (camera.position.y < 26 && occluded[h.id]);
      var hide = behind || blocked || dist > 150 || x < 18 || x > width - 18 || y < 80 || y > height - 120;
      if (state.activeView === "statue" && h.id === "structure") hide = true;
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
    ui.infoKicker.textContent = "纪念堂 · " + h.no;
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
          a.download = "memorial-hall-4k.png";
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

  function goYuexiu() {
    var url = "yuexiu.html?view=tower";
    if (inFrame) url += "&embed=1&from=atlas";
    window.location.href = url;
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    ui.startBtn.addEventListener("click", function () {
      if (reducedMotion) { enterFree(VIEWS.lawn); return; }
      startCinematic();
    });
    ui.skipIntroBtn.addEventListener("click", function () { enterFree(VIEWS.lawn); });
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
    if (ui.yuexiuBtn) ui.yuexiuBtn.addEventListener("click", goYuexiu);
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
      flyTo(VIEWS.lawn);
      setActiveView("lawn");
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

    if (state.cinematic) {
      updateCinematic(dt);
    } else if (state.mode !== "intro") {
      updateOrbit(dt);
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

  window.MemorialDebug = {
    get fps() { return state.fps; },
    get mode() { return state.mode; },
    get view() { return state.activeView; },
    get time() { return state.time; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get model() { return memorial; },
    get counts() {
      return renderer ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries
      } : null;
    },
    go: function (name) { flyTo(VIEWS[name] || VIEWS.lawn); setActiveView(name); },
    look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
    open: openInfo,
    timeOfDay: function (name) { applyTime(name || "dawn"); }
  };

  initThree();
})();
