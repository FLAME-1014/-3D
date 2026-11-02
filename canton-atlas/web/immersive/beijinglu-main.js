/* 北京路 · 千年古道近景 · 渲染、运镜与交互 */
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
  var baseFov = isMobile ? 64 : 55;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var width = window.innerWidth;
  var height = window.innerHeight;
  var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2);
  var renderScale = isMobile ? 1 : 0.9;

  if (!window.THREE) {
    ui.loading.classList.add("hidden");
    ui.intro.classList.add("hidden");
    ui.fallback.hidden = false;
    return;
  }

  var renderer, scene, camera, clock;
  var sun, hemi, ambient, fillLight, fillLight2, moon;
  var skyUniforms, sunSprite, moonSprite, starField;
  var bl = null;
  var modelRoot = null;
  var hotspots = [];
  var hotspotEls = {};
  var activeCraft = null;
  var toastTimer = null;
  var ledAcc = 0;

  var state = {
    mode: "intro",
    time: "day",
    cinematic: false,
    cineTime: 0,
    cineSeg: 0,
    fps: 60,
    frames: 0,
    fpsAt: performance.now(),
    view: "crossing",
    activeView: "crossing",
    hoverHotspot: null,
    shooting: false,
    quality: "full",
    slowTime: 0
  };

  var desired = {
    theta: 0,
    phi: 1.2,
    radius: 80,
    target: new THREE.Vector3(0, 4, 100)
  };
  var orbit = {
    theta: 0,
    phi: 1.2,
    radius: 80,
    target: new THREE.Vector3(0, 4, 100)
  };

  var VIEWS = {
    crossing: { id: "crossing", pos: [5.6, 4.0, 33], target: [-9, 8, -16], fov: 62, chapter: "01 / 中山五路 · 十字星街" },
    ancient: { id: "ancient", pos: [4.2, 3.2, 94], target: [-0.8, -0.6, 58], fov: 58, chapter: "02 / 千年古道 · 玻璃罩" },
    arcade: { id: "arcade", pos: [-2.4, 2.4, 148], target: [5.8, 3.4, 224], fov: 60, chapter: "03 / 骑楼界面 · 中段廊道" },
    gongbei: { id: "gongbei", pos: [5.8, 2.8, 255], target: [-1.5, 1.5, 224], fov: 58, chapter: "04 / 拱北楼 · 铜壶滴漏" },
    huifu: { id: "huifu", pos: [-96, 3.0, 441.8], target: [-140, 6.2, 434.4], fov: 56, chapter: "05 / 惠福东路 · 美食花街 / 大佛寺" },
    dafo: { id: "dafo", pos: [-100, 17, 430], target: [-146, 12, 368], fov: 55, chapter: "06 / 大佛寺 · 大雄宝殿 / 普觉楼" },
    chenghuang: { id: "chenghuang", pos: [180, 8.5, 4], target: [180, 4.2, -44], fov: 58, chapter: "07 / 城隍庙 · 忠佑广场" },
    intro: { pos: [60, 70, 560], target: [0, 0, 200], fov: 50, chapter: "" }
  };

  var MOBILE_VIEWS = {
    crossing: { pos: [7.2, 4.6, 40], target: [-9, 8, -16], fov: 70 },
    ancient: { pos: [5.0, 3.6, 100], target: [-0.8, -0.4, 58], fov: 66 },
    arcade: { pos: [-2.6, 2.8, 146], target: [5.8, 3.4, 224], fov: 68 },
    gongbei: { pos: [5.4, 3.2, 260], target: [-1.5, 1.6, 224], fov: 66 },
    huifu: { pos: [-94, 3.4, 442], target: [-140, 6.2, 434.4], fov: 62 },
    dafo: { pos: [-98, 18, 432], target: [-136, 13, 364], fov: 82 },
    chenghuang: { pos: [180, 9.5, 10], target: [180, 4.2, -44], fov: 64 }
  };

  var CINE = [
    { dur: 5.6, chapter: "01 / 北京路 · 千年商都", pos: [40, 95, 540], target: [40, 10, 300], toPos: [-60, 42, 360], toTarget: [-140, 20, 312] },
    { dur: 4.2, chapter: "02 / 大佛寺 · 普觉楼金顶", pos: [-60, 42, 360], target: [-140, 20, 312], toPos: [-100, 17, 430], toTarget: [-146, 12, 368] },
    { dur: 4.4, chapter: "03 / 中山五路 · 十字星街", pos: [-100, 17, 430], target: [-146, 12, 368], toPos: [10, 3.6, 30], toTarget: [-4, 8, -12] },
    { dur: 4.4, chapter: "04 / 千年古道 · 十一层路面", pos: [10, 3.6, 30], target: [-4, 8, -12], toPos: [4.5, 2.4, 96], toTarget: [-1, 0.2, 44] },
    { dur: 4.4, chapter: "05 / 骑楼界面 · 中段廊道", pos: [4.5, 2.4, 96], target: [-1, 0.2, 44], toPos: [5.8, 1.8, 150], toTarget: [4, 2.4, 300] },
    { dur: 4.6, chapter: "06 / 惠福东路 · 美食花街", pos: [5.8, 1.8, 150], target: [4, 2.4, 300], toPos: [-18, 2.0, 442], toTarget: [-140, 6, 438] },
    { dur: 5.2, chapter: "07 / 城隍庙 · 忠佑广场", pos: [-18, 2.0, 442], target: [-140, 6, 438], toPos: [60, 58, 240], toTarget: [180, 5, -50] }
  ];
  var CINE_TOTAL = CINE.reduce(function (sum, s) { return sum + s.dur; }, 0);

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

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

    renderer.setPixelRatio(dpr * renderScale);
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
    scene.fog = new THREE.FogExp2(0xc9cfc9, 0.0014);

    camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.1, 12000);
    clock = new THREE.Clock();

    buildSky();
    buildLights();

    var textures = window.BeijingluTextures.build(renderer);
    var built = window.BeijingluModel.build({ textures: textures, low: isMobile });
    bl = built;
    modelRoot = built.root;
    scene.add(modelRoot);
    hotspots = built.hotspots;
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
          if (startView && VIEWS[startView] && startView !== "intro") {
            enterFree(VIEWS[startView]);
            setActiveView(startView);
          } else {
            enterFree(VIEWS.crossing);
            setActiveView("crossing");
          }
        }, 650);
      }
    }, 260);
  }

  function buildSky() {
    skyUniforms = {
      topColor: { value: new THREE.Color(0x4a7c9a) },
      horizonColor: { value: new THREE.Color(0xdfe3da) },
      glowColor: { value: new THREE.Color(0xfff1d0) },
      sunDir: { value: new THREE.Vector3(0.55, 0.7, 0.5).normalize() },
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
    for (var i = 0; i < 800; i++) {
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
    hemi = new THREE.HemisphereLight(lin(0xbcd2dd), lin(0x3e3a32), 0.55);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xfff1d8, 2.0);
    sun.position.set(180, 200, 160);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -280;
      sun.shadow.camera.right = 280;
      sun.shadow.camera.top = 420;
      sun.shadow.camera.bottom = -420;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 1100;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.04;
    }
    sun.target.position.set(0, 0, 220);
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
      exposure: 0.98,
      fog: 0xc9cfc9, fogDensity: 0.0014,
      top: 0x4a7c9a, horizon: 0xdfe3da, glow: 0xfff1d0, sunPower: 1.0,
      sunColor: 0xfff1d8, sunIntensity: 2.0, sunPos: [180, 200, 160],
      hemiSky: 0xbcd2dd, hemiGround: 0x3e3a32, hemiIntensity: 0.55,
      ambient: 0.34, fill: 0.18, fill2: 0.3, moon: 0,
      stars: 0, sunSprite: 0.75, sunSpriteColor: 0xfff1cf, sunDir: [0.55, 0.7, 0.5],
      glowFactor: 0.1, lightFactor: 0, led: 0.55
    },
    dusk: {
      label: "黄昏", next: "night",
      exposure: 1.06,
      fog: 0xb38f78, fogDensity: 0.0017,
      top: 0x334568, horizon: 0xe9a878, glow: 0xff9a5a, sunPower: 1.1,
      sunColor: 0xffb877, sunIntensity: 1.55, sunPos: [-260, 55, 140],
      hemiSky: 0x92a2c0, hemiGround: 0x2a2520, hemiIntensity: 0.4,
      ambient: 0.2, fill: 0.1, fill2: 0.15, moon: 0.05,
      stars: 0.08, sunSprite: 0.95, sunSpriteColor: 0xffb877, sunDir: [-0.8, 0.22, 0.4],
      glowFactor: 0.38, lightFactor: 0.3, led: 0.9
    },
    night: {
      label: "夜览", next: "day",
      exposure: 1.14,
      fog: 0x0a1220, fogDensity: 0.0021,
      top: 0x02060e, horizon: 0x162334, glow: 0x6f5a45, sunPower: 0.3,
      sunColor: 0x9db8ff, sunIntensity: 0.18, sunPos: [-220, 180, -100],
      hemiSky: 0x22344a, hemiGround: 0x0d0d0a, hemiIntensity: 0.24,
      ambient: 0.15, fill: 0.05, fill2: 0.06, moon: 0.42,
      stars: 1, sunSprite: 0, sunSpriteColor: 0xdfe8ff, sunDir: [-0.5, 0.55, -0.3],
      glowFactor: 1, lightFactor: 1, led: 1.15
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
    fillLight2.intensity = p.fill2;
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

    if (bl) {
      bl.nightMats.forEach(function (m) {
        if (!m) return;
        if (m.emissive === undefined && !m.emissive) return;
        m.emissiveIntensity = (m.userData.glowBase || 0.7) * p.glowFactor;
      });
      bl.lanternLights.forEach(function (l) {
        l.visible = name !== "day";
        l.intensity = p.lightFactor * (l.userData.nightIntensity || 1);
      });
      if (bl.led) {
        bl.led.mat.color.setScalar(p.led);
      }
      if (bl.fountain) {
        bl.fountain.jets.forEach(function (jet) {
          jet.material.opacity = name === "night" ? 0.62 : name === "dusk" ? 0.45 : 0.3;
        });
      }
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

  function resolveView(v) {
    if (!isMobile || v.id === "intro") return v;
    var mobile = MOBILE_VIEWS[v.id];
    if (mobile) {
      return { id: v.id, chapter: v.chapter, pos: mobile.pos, target: mobile.target, fov: mobile.fov };
    }
    return {
      id: v.id, chapter: v.chapter,
      pos: v.pos, target: v.target,
      fov: Math.min(80, (v.fov || baseFov) + 6)
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
    flyTo(view || VIEWS.crossing);
    setActiveView(view && view.id ? view.id : "crossing");
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
      flyTo("chenghuang");
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

  function updateHotspots() {
    if (state.mode === "intro" || state.mode === "cinematic") {
      Object.keys(hotspotEls).forEach(function (id) { hotspotEls[id].classList.remove("visible"); });
      return;
    }
    var placed = [];
    hotspots.forEach(function (h) {
      var el = hotspotEls[h.id];
      projection.copy(h.pos).project(camera);
      var behind = projection.z > 1 || projection.z < -1;
      var dist = camera.position.distanceTo(h.pos);
      var x = (projection.x * 0.5 + 0.5) * width;
      var y = (-projection.y * 0.5 + 0.5) * height;
      var edge = Math.max(el.offsetWidth, 40) / 2 + 8;
      var hide = behind || dist > 150 || x < 0 || x > width || y < 80 || y > height - 120;
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
    ui.infoKicker.textContent = "北京路 · " + h.no;
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

  function render4KBlob() {
    return new Promise(function (resolve, reject) {
      var oldW = width;
      var oldH = height;
      var oldRatio = renderer.getPixelRatio();
      var oldAspect = camera.aspect;
      state.shooting = true;
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
          if (!blob) reject(new Error("toBlob returned null"));
          else resolve(blob);
        }, "image/png");
      } catch (error) {
        renderer.setPixelRatio(oldRatio);
        renderer.setSize(oldW, oldH, false);
        camera.aspect = oldAspect;
        camera.updateProjectionMatrix();
        state.shooting = false;
        reject(error);
      }
    });
  }

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
    showToast("正在渲染 4K（3840 × 2160）…");
    render4KBlob().then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "beijinglu-ancient-road-4k.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      showToast("4K 截图已保存 · " + Math.round(blob.size / 1024) + " KB");
    }).catch(function (error) {
      showToast("4K 渲染失败：" + (error.message || "未知错误"));
    });
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
      window.parent.postMessage({ type: "canton-open-city", spot: "beijinglu" }, "*");
    } else {
      window.location.href = "index.html?spot=beijinglu&jump=1";
    }
  }

  /* ---------------- 性能自适应 ---------------- */

  function reduceQuality() {
    if (state.quality === "low") return;
    state.quality = "low";
    renderer.shadowMap.enabled = false;
    if (sun) sun.castShadow = false;
    if (bl) {
      if (bl.instanced.lanterns) bl.instanced.lanterns.forEach(function (mesh) { mesh.count = Math.floor(mesh.count * 0.55); });
      if (bl.instanced.people) bl.instanced.people.forEach(function (mesh) { mesh.count = Math.floor(mesh.count * 0.5); });
    }
    var reduced = Math.min(dpr, isMobile ? 1.25 : 1.5) * renderScale;
    renderer.setPixelRatio(reduced);
    renderer.setSize(width, height, false);
    showToast("已自动降低画质以保持流畅");
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    ui.startBtn.addEventListener("click", startCinematic);
    ui.skipIntroBtn.addEventListener("click", function () { enterFree(VIEWS.crossing); });
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
      var name = state.activeView && VIEWS[state.activeView] ? state.activeView : "crossing";
      flyTo(VIEWS[name]);
      setActiveView(name);
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

    if (params.get("view") && VIEWS[params.get("view")] && VIEWS[params.get("view")].id && params.get("embed") !== "1") {
      window.setTimeout(function () {
        enterFree(VIEWS[params.get("view")]);
        setActiveView(params.get("view"));
      }, 900);
    }
    if (params.get("embed") === "1") {
      document.body.classList.add("embed");
    }
    showCityButton();
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
      desired.radius = clamp(pinch.radius * (pinch.dist / Math.max(dist, 1)), 8, 500);
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
    desired.radius = clamp(desired.radius * Math.exp(event.deltaY * 0.0011), 8, 500);
    setActiveView(null);
  }

  function onResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    var activeDpr = state.shooting ? 1 : (state.quality === "low" ? Math.min(dpr, isMobile ? 1.25 : 1.5) * renderScale : dpr * renderScale);
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

    if (bl) {
      if (bl.fountain) {
        for (var ji = 0; ji < bl.fountain.jets.length; ji++) {
          var jet = bl.fountain.jets[ji];
          var ph = jet.userData.phase;
          var hh = 0.55 + 0.45 * Math.sin(time * (1.7 + (ji % 3) * 0.35) + ph);
          jet.scale.y = 0.5 + hh * 1.4;
          jet.position.y = 0.35 + (0.5 + hh * 1.4) / 2;
        }
      }
      if (bl.led && time - ledAcc > (state.time === "day" ? 0.8 : 0.12)) {
        ledAcc = time;
        var tex = bl.led.mat.map;
        if (tex && tex.image && tex.image.getContext) {
          var ctx = tex.image.getContext("2d");
          drawLedCanvas(ctx, time, state.time !== "day", tex);
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

    if (!isMobile && state.fps < 50 && state.mode === "free") {
      state.slowTime += dt;
      if (state.slowTime > 3) reduceQuality();
    } else if (state.fps >= 55) {
      state.slowTime = 0;
    }
  }

  /* LED 动画直接复用纹理模块的绘制函数（通过 window.BeijingluTextures 暴露不可得，
     这里保留主循环内的小型重绘：抽象天际线 + 广州） */
  function drawLedCanvas(ctx, t, night, tex) {
    var w = 512, h = 256;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, night ? "#08203a" : "#204a60");
    g.addColorStop(0.55, night ? "#0c2a3e" : "#2d6474");
    g.addColorStop(1, night ? "#04121f" : "#18313c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 46; i++) {
      var bx = (i * 37 + 11) % w;
      var bh = 20 + ((i * 53) % 110);
      ctx.fillStyle = "rgba(12, 30, 44, 0.6)";
      ctx.fillRect(bx, h - bh, 18 + (i % 3) * 6, bh);
      ctx.fillStyle = night ? "rgba(255, 214, 140, 0.75)" : "rgba(255, 226, 168, 0.5)";
      for (var wy = h - bh + 8; wy < h - 10; wy += 12) {
        for (var wx = bx + 4; wx < bx + 16 + (i % 3) * 6; wx += 9) {
          if ((wx + wy + i) % 3 !== 0) ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
    ctx.fillStyle = night ? "rgba(255, 240, 210, 0.95)" : "rgba(255, 244, 220, 0.75)";
    ctx.font = "bold 62px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("广州", 318, 92);
    ctx.font = "500 19px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillStyle = "rgba(255, 240, 210, 0.62)";
    ctx.fillText("CANTON · 千年商都", 318, 122);
    var band = (t * 40) % (w + 160) - 80;
    var lg = ctx.createLinearGradient(band - 60, 0, band + 60, 0);
    lg.addColorStop(0, "rgba(120, 220, 255, 0)");
    lg.addColorStop(0.5, night ? "rgba(140, 230, 255, 0.3)" : "rgba(160, 235, 255, 0.16)");
    lg.addColorStop(1, "rgba(120, 220, 255, 0)");
    ctx.fillStyle = lg;
    ctx.fillRect(band - 60, 0, 120, h);
    if (tex) tex.needsUpdate = true;
  }

  window.BeijingluDebug = {
    get fps() { return state.fps; },
    get mode() { return state.mode; },
    get view() { return state.activeView; },
    get time() { return state.time; },
    get quality() { return state.quality; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get model() { return bl; },
    get views() { return Object.keys(VIEWS).filter(function (k) { return k !== "intro"; }); },
    get counts() {
      var info = renderer ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        drawCalls: renderer.info.render.calls
      } : {};
      var mc = bl ? bl.counts : {};
      return Object.assign({}, mc, info);
    },
    go: function (name) { flyTo(VIEWS[name] || VIEWS.crossing); setActiveView(name); },
    snap: function (name) { setCameraImmediate(VIEWS[name] || VIEWS.crossing); setActiveView(name); },
    look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
    open: openInfo,
    timeOfDay: function (name) { applyTime(name || "day"); },
    capture4K: function () {
      return render4KBlob().then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () {
            resolve({ width: 3840, height: 2160, bytes: blob.size, dataUrl: reader.result });
          };
          reader.readAsDataURL(blob);
        });
      });
    },
    toView: function (name) { enterFree(VIEWS[name] || VIEWS.crossing); setActiveView(name); }
  };

  initThree();
})();
