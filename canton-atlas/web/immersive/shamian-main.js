/* 沙面 · 大街一段近景 · 渲染、运镜与交互 */
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
  var sun, hemi, ambient, fillLight;
  var skyUniforms, sunSprite;
  var model = null;
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
    cineSeg: 0,
    fps: 60,
    frames: 0,
    fpsAt: performance.now(),
    activeView: "lourdes",
    shooting: false
  };

  var desired = {
    theta: 0.4,
    phi: 1.12,
    radius: 80,
    target: new THREE.Vector3(0, 6, -6)
  };
  var orbit = {
    theta: 0.4,
    phi: 1.12,
    radius: 80,
    target: new THREE.Vector3(0, 6, -6)
  };

  var VIEWS = {
    lourdes: { id: "lourdes", pos: [74.5, 3.4, 16.5], target: [79.2, 10.0, -11], fov: 58, chapter: "01 / 露德圣母堂 · 1890" },
    garden: { id: "garden", pos: [92.9, 1.75, -11.4], target: [98.2, 3.2, -24.6], fov: 62, chapter: "02 / 教堂花园 · 圣母山" },
    arcade: { id: "arcade", pos: [56, 2.0, -6.6], target: [34, 4.0, -9.2], fov: 62, chapter: "03 / 16–20 号 · 两层券廊" },
    green: { id: "green", pos: [24.5, 2.1, 5.4], target: [8.5, 6.2, -1.0], fov: 63, chapter: "04 / 街心花园 · 古榕" },
    qichang: { id: "qichang", pos: [-18, 2.4, 2.5], target: [-44, 7.2, -11.5], fov: 58, chapter: "05 / 48 号旗昌 · 转角" },
    avenue: { id: "avenue", pos: [54, 2.0, -4.8], target: [32, 4.8, -9.2], fov: 58, chapter: "06 / 大街西望 · 券廊与古榕" },
    intro: { pos: [132, 54, 96], target: [40, 6, 0], fov: 50, chapter: "" }
  };

  var CINE = [
    { dur: 4.8, chapter: "01 / 沙面 · 大街一段", pos: [138, 58, 102], target: [36, 5, 0], toPos: [96, 24, 46], toTarget: [72, 8, -8] },
    { dur: 4.6, chapter: "02 / 露德圣母堂 · 尖塔", pos: [96, 24, 46], target: [72, 8, -8], toPos: [64, 5, 10], toTarget: [78, 9, -11] },
    { dur: 4.4, chapter: "03 / 券廊 · 16–20 号", pos: [64, 5, 10], target: [78, 9, -11], toPos: [48, 2.8, -5], toTarget: [38, 5, -9] },
    { dur: 4.4, chapter: "04 / 外廊下的阴影", pos: [48, 2.8, -5], target: [38, 5, -9], toPos: [24, 2.2, -8.8], toTarget: [14, 5, -9] },
    { dur: 4.6, chapter: "05 / 街心花园 · 古榕", pos: [24, 2.2, -8.8], target: [14, 5, -9], toPos: [9, 1.9, 3.2], toTarget: [8, 6, -1] },
    { dur: 4.8, chapter: "06 / 48 号旗昌 · 转角", pos: [9, 1.9, 3.2], target: [8, 6, -1], toPos: [-24, 2.3, 6.5], toTarget: [-43, 7, -11] }
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
    renderer.setClearColor(0xcfd9da, 1);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xc7d4d2, 0.0026);

    camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.1, 12000);
    clock = new THREE.Clock();

    buildSky();
    buildLights();

    var textures = window.ShamianTextures.build(renderer);
    var built = window.ShamianModel.build({ textures: textures, low: isMobile });
    model = built;
    modelRoot = built.root;
    scene.add(modelRoot);
    hotspots = built.hotspots;
    collectOccluders();
    buildHotspotDom();

    applyTime("morning");
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
        window.setTimeout(function () {
          var startView = params.get("view");
          if (startView && VIEWS[startView]) {
            enterFree(VIEWS[startView]);
            setActiveView(startView);
          } else if (!reducedMotion) {
            startCinematic();
          } else {
            enterFree(VIEWS.lourdes);
          }
        }, 650);
        document.body.classList.remove("intro-active");
        ui.intro.classList.remove("hidden");
      }
    }, 260);
  }

  function buildSky() {
    skyUniforms = {
      topColor: { value: new THREE.Color(0x6f99b0) },
      horizonColor: { value: new THREE.Color(0xf1d8bd) },
      glowColor: { value: new THREE.Color(0xffc48a) },
      sunDir: { value: new THREE.Vector3(0.7, 0.18, 0.5).normalize() },
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
        "  float h = smoothstep(-0.12, 0.68, vDir.y);",
        "  vec3 col = mix(horizonColor, topColor, h);",
        "  float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);",
        "  col += glowColor * pow(d, 5.0) * sunPower;",
        "  float band = smoothstep(0.0, 0.03, abs(vDir.y)) * (1.0 - smoothstep(0.02, 0.10, abs(vDir.y)));",
        "  col += glowColor * band * 0.06;",
        "  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.4545)), 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 18), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffd9ab,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: makeGlowTexture()
    }));
    sunSprite.position.set(360, 90, 300);
    sunSprite.scale.set(80, 80, 1);
    scene.add(sunSprite);
  }

  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function buildLights() {
    ambient = new THREE.AmbientLight(lin(0xcfd8d4), 0.26);
    scene.add(ambient);
    hemi = new THREE.HemisphereLight(lin(0xbfd7e7), lin(0x4a4030), 0.42);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xffe3bd, 2.4);
    sun.position.set(420, 90, 180);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -115;
      sun.shadow.camera.right = 115;
      sun.shadow.camera.top = 90;
      sun.shadow.camera.bottom = -90;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 900;
      sun.shadow.bias = -0.0003;
      sun.shadow.normalBias = 0.03;
    }
    sun.target.position.set(0, 0, -6);
    scene.add(sun);
    scene.add(sun.target);

    fillLight = new THREE.DirectionalLight(lin(0xb9d3dd), 0.14);
    fillLight.position.set(-120, 80, -60);
    scene.add(fillLight);
  }

  /* ---------------- 时段 ---------------- */

  var TIME_PRESETS = {
    morning: {
      label: "晨光", next: "day",
      exposure: 0.92,
      fog: 0xc7d4d2, fogDensity: 0.0040,
      top: 0x6f99b0, horizon: 0xf1d8bd, glow: 0xffc48a, sunPower: 1.0,
      sunColor: 0xffd9b0, sunIntensity: 2.2, sunPos: [420, 90, 180],
      hemiSky: 0xa9c3d2, hemiGround: 0x3d3a2f, hemiIntensity: 0.44,
      ambient: 0.3, ambientColor: 0xcfd8d4, fill: 0.14,
      lamp: 0.12, window: 0.05, garden: 0.1, city: 0
    },
    day: {
      label: "晴日", next: "dusk",
      exposure: 0.9,
      fog: 0xd0dadc, fogDensity: 0.0028,
      top: 0x4d87b3, horizon: 0xe7edef, glow: 0xfff2d4, sunPower: 1.0,
      sunColor: 0xfff2d8, sunIntensity: 2.7, sunPos: [180, 230, 160],
      hemiSky: 0xb7d0e0, hemiGround: 0x3d3830, hemiIntensity: 0.52,
      ambient: 0.34, ambientColor: 0xd3dcd8, fill: 0.18,
      lamp: 0, window: 0, garden: 0, city: 0
    },
    dusk: {
      label: "暮色", next: "morning",
      exposure: 0.78,
      fog: 0x46312a, fogDensity: 0.0058,
      top: 0x1d2c47, horizon: 0xc97148, glow: 0xff6a30, sunPower: 1.0,
      sunColor: 0xff9658, sunIntensity: 0.8, sunPos: [-420, 55, 200],
      hemiSky: 0x6b6068, hemiGround: 0x241f19, hemiIntensity: 0.24,
      ambient: 0.16, ambientColor: 0xc2c6c2, fill: 0.06,
      lamp: 1.45, window: 1.0, garden: 1.1, city: 0.6
    }
  };

  function applyTime(name) {
    var p = TIME_PRESETS[name];
    if (!p) return;
    state.time = name;
    if (ui.timeBtn) ui.timeBtn.textContent = p.label;
    renderer.toneMappingExposure = p.exposure;
    scene.fog.color.copy(lin(p.fog));
    scene.fog.density = p.fogDensity;

    skyUniforms.topColor.value.copy(lin(p.top));
    skyUniforms.horizonColor.value.copy(lin(p.horizon));
    skyUniforms.glowColor.value.copy(lin(p.glow));
    skyUniforms.sunPower.value = p.sunPower;
    skyUniforms.sunDir.value.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]).normalize();

    sun.color.copy(lin(p.sunColor));
    sun.intensity = p.sunIntensity;
    sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    hemi.color.copy(lin(p.hemiSky));
    hemi.groundColor.copy(lin(p.hemiGround));
    hemi.intensity = p.hemiIntensity;
    ambient.intensity = p.ambient;
    ambient.color.copy(lin(p.ambientColor || 0xcfd8d4));
    fillLight.intensity = p.fill;

    if (sunSprite) {
      sunSprite.position.set(p.sunPos[0], Math.max(100, p.sunPos[1] * 0.9), p.sunPos[2]);
      sunSprite.material.opacity = name === "dusk" ? 0.8 : 0.55;
      sunSprite.material.color.copy(lin(p.sunColor));
    }

    if (model) {
      (model.lampGlowMats || []).forEach(function (m) { m.emissiveIntensity = 0.08 + p.lamp * 1.6; });
      (model.lampGlowSprites || []).forEach(function (m) { m.opacity = p.lamp * 0.72; });
      (model.warmWindowMats || []).forEach(function (m) { m.emissiveIntensity = p.window * 0.9; });
      (model.gardenLights || []).forEach(function (l) { l.intensity = p.garden * 1.5; });
      (model.lampLights || []).forEach(function (l) { l.intensity = p.lamp * 12; });
      (model.cityWinMats || []).forEach(function (m) { m.emissiveIntensity = p.city * 0.8; });
      (model.glassMats || []).forEach(function (m) { m.emissiveIntensity = p.window * 0.35; });
    }

    document.body.classList.toggle("dusk-mode", name === "dusk");
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

  var MOBILE_VIEWS = {
    lourdes: { pos: [74.5, 4.0, 16.5], target: [79.2, 10.0, -11], fov: 68 },
    garden: { pos: [92.8, 1.8, -11.2], target: [98.2, 3.2, -24.5], fov: 64 },
    arcade: { pos: [57, 2.4, -5.8], target: [34, 4.2, -9.2], fov: 64 },
    green: { pos: [24, 2.4, 5.4], target: [8, 6.2, -1], fov: 64 },
    qichang: { pos: [-18, 3.4, 3.0], target: [-44, 7.2, -11.5], fov: 70 },
    avenue: { pos: [54, 2.4, -4.8], target: [32, 4.8, -9.2], fov: 64 }
  };

  function resolveView(v) {
    if (!isMobile) return v;
    var m = v.id && MOBILE_VIEWS[v.id];
    if (!m) return v;
    return {
      id: v.id,
      chapter: v.chapter,
      pos: m.pos,
      target: m.target,
      fov: m.fov
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
    flyTo(view || VIEWS.lourdes);
    setActiveView(view && view.id ? view.id : "lourdes");
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
      flyTo("qichang");
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
      if (dims[1] < 2.6 || dims[1] > 40) return;
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
    if (camera.position.y < 28) {
      occlusionTick++;
      if (occlusionTick % 12 === 1) refreshOcclusion();
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
      var blocked = camera.position.y < 28 && occluded[h.id];
      var hide = behind || blocked || dist > 115 || x < 18 || x > width - 18 || y < 80 || y > height - 118;
      if (hide) {
        el.classList.remove("visible");
      } else {
        var guard = 0;
        while (guard < 5 && placed.some(function (p) { return Math.abs(p.x - x) < 94 && Math.abs(p.y - y) < 36; })) {
          y += 36;
          guard++;
        }
        if (y > height - 118) {
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
    ui.infoKicker.textContent = "沙面 · " + h.no;
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
          a.download = "shamian-dajie-4k.png";
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

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    ui.startBtn.addEventListener("click", startCinematic);
    ui.skipIntroBtn.addEventListener("click", function () { enterFree(VIEWS.lourdes); });
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
      flyTo(VIEWS.lourdes);
      setActiveView("lourdes");
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
      desired.radius = clamp(pinch.radius * (pinch.dist / Math.max(dist, 1)), 6, 1800);
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
    desired.radius = clamp(desired.radius * Math.exp(event.deltaY * 0.0011), 6, 1800);
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

    if (model && !reducedMotion) {
      (model.canopyGroups || []).forEach(function (c) {
        c.mesh.rotation.z = c.baseZ + Math.sin(time * 0.55 + c.phase) * 0.008;
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

  window.ShamianDebug = {
    get fps() { return state.fps; },
    get mode() { return state.mode; },
    get view() { return state.activeView; },
    get time() { return state.time; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get model() { return model; },
    get views() { return Object.keys(VIEWS).filter(function (k) { return k !== "intro"; }); },
    get counts() {
      return renderer ? {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries
      } : null;
    },
    go: function (name) { flyTo(VIEWS[name] || VIEWS.lourdes); setActiveView(name); },
    look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
    open: openInfo,
    timeOfDay: function (name) { applyTime(name || "morning"); }
  };

  initThree();
})();
