(function () {
  "use strict";

  var THREE = window.THREE;
  if (!THREE) {
    document.getElementById("loading").hidden = true;
    var failure = document.getElementById("failure");
    document.title='模型加载失败 · 广州城市模型册';q('sceneName').textContent='模型未加载';q('spotPanel').hidden=true;document.querySelector('.toolbar').hidden=true;q('backAtlas').onclick=backAtlas;
    failure.hidden = false;
    failure.textContent = "Three.js 未加载，无法进入模型页。";
    return;
  }

  var params = new URLSearchParams(location.search);
  var spotId = params.get("id") || "chenjiaci";
  var forceRender = params.get("debug") === "1";
  var spot = null;
  var place = null;
  var model = null;
  var anchors = {};
  var presets = {};
  var activePreset = "overview";
  var minDistance = 24;
  var maxDistance = 360;

  var renderer = null;
  var scene = null;
  var camera = null;
  var clock = null;
  var canvas = null;
  var hotspotLayer = null;
  var panel = null;

  var current = {
    yaw: 0.7,
    pitch: 0.52,
    distance: 140,
    target: new THREE.Vector3(0, 6, 0)
  };
  var desired = {
    yaw: 0.7,
    pitch: 0.52,
    distance: 140,
    target: new THREE.Vector3(0, 6, 0)
  };

  var dragging = false;
  var autoRotate = false;
  var lastPointer = { x: 0, y: 0 };
  var touchSpan = 0;
  var lowPower = false;
  var fpsState = { frames: 0, last: performance.now(), fps: 0 };
  var hotspotEls = new Map();
  var hotspotAnchors = new Map();
  var decor = [];
  var toastTimer = 0;
  var disposed = false,animationId=0;
  var loadAbort=new AbortController();
  var releaseResources=window.SpotResources.createCleanup(function(){return {model:model,scene:scene,renderer:renderer};});
  window.addEventListener('pagehide',cleanup);
  window.addEventListener('pageshow',function(event){if(event.persisted&&disposed)location.reload();});

  var PRESET_LABELS = {
    overview: "总览",
    front: "正面",
    detail: "细节",
    courtyard: "庭院",
    alley: "青云巷",
    street: "街道",
    arcade: "廊道",
    gate: "门楼",
    stage: "广福台",
    avenue: "林荫道",
    church: "教堂",
    hotel: "白天鹅",
    park: "公园",
    "ancient-road": "古道",
    temple: "大佛寺",
    wuyang: "五羊",
    wall: "城墙",
    zhenhai: "镇海楼",
    canal: "河涌",
    bridge: "龙津桥",
    tower: "文塔",
    house: "西关大屋",
    opera: "大戏台",
    qilou: "骑楼",
    taotao: "陶陶居",
    lianxiang: "莲香楼",
    hall: "大殿",
    pagoda: "塔"
  };

  function q(id) {
    return document.getElementById(id);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(message) {
    var el = q("toast");
    el.textContent = message;
    el.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  function showFailure(message) {
    var loading = q("loading");
    if (loading) loading.hidden = true;
    var failure = q("failure");
    if (!failure) return;
    document.title='模型加载失败 · 广州城市模型册';q('sceneName').textContent='模型未加载';q('spotPanel').hidden=true;document.querySelector('.toolbar').hidden=true;q('backAtlas').onclick=backAtlas;
    failure.hidden = false;
    failure.textContent = message + " 返回图鉴后可以重试。";
  }

  async function boot() {
    canvas = q("scene");
    hotspotLayer = q("hotspots");
    panel = q("spotPanel");
    q("backAtlas").onclick=backAtlas;

    try {
      spot = await fetch("../content/spots/" + encodeURIComponent(spotId) + "/spot.json", { cache: "no-store", signal:loadAbort.signal }).then(function (res) {
        if (!res.ok) throw new Error("spot.json HTTP " + res.status);
        return res.json();
      });
      if(disposed)return;
      var errors=window.SpotContract.validate(spot,spotId);if(errors.length)throw new Error(errors.join('；'));
      var mod = await import("../content/spots/" + encodeURIComponent(spotId) + "/model.js");
      if(disposed)return;
      if(typeof mod.create!=='function')throw new Error('模型缺少 create()');
      model = mod.create();
      var modelErrors=window.SpotContract.validateModel(model,spot);if(modelErrors.length)throw new Error(modelErrors.join('；'));
    } catch (error) {
      if(disposed)return;cleanup();
      showFailure("模型加载失败：" + error.message);
      return;
    }

    var places = window.__ATLAS_PLACES || [];
    place = places.filter(function (p) { return p.id === spotId; })[0] || null;

    lowPower = window.matchMedia("(max-width: 760px)").matches ||
      (navigator.hardwareConcurrency || 8) <= 4;

    initScene();
    addModel();
    buildPresets();
    buildHotspots();
    buildUI();
    bindControls();
    var requestedPreset = params.get("preset");
    setPreset(requestedPreset && presets[requestedPreset] ? requestedPreset : "overview", true);

    q("loading").hidden = true;
    window.__SPOT_READY__ = true;
    window.__SPOT_API__ = {
      setPreset: function (name) { setPreset(name, true); },
      stats: function () {
        return {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          fps: fpsState.fps
        };
      },
      camera: function () {
        return {
          position: camera.position.toArray(),
          target: current.target.toArray()
        };
      },
      bench: function (n) {
        var frames = Math.max(1, Math.min(240, n || 60));
        var t0 = performance.now();
        for (var i = 0; i < frames; i++) renderer.render(scene, camera);
        var t1 = performance.now();
        return {
          frames: frames,
          msPerFrame: Number(((t1 - t0) / frames).toFixed(2)),
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles
        };
      }
    };

    if (params.get("silhouette") === "1") {
      setupSilhouette();
    } else {
      clock.start();
      updateCamera();
      updateHotspots();
      renderer.render(scene, camera);
      renderStats();
      animate();
    }
  }

  function setupSilhouette() {
    document.body.classList.add("silhouette-mode");
    decor.forEach(function (obj) { obj.visible = false; });
    scene.fog = null;
    scene.background = new THREE.Color(0xffffff);
    renderer.setClearColor(0xffffff, 1);
    renderer.shadowMap.enabled = false;
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    var part = params.get("part");
    if (part) {
      model.group.children.forEach(function (child) {
        child.visible = child.name === part;
      });
    }
    var target = part ? model.group.getObjectByName(part) : model.group;
    var box = new THREE.Box3().setFromObject(target);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var aspect = window.innerWidth / window.innerHeight;
    var pad = 1.12;
    var halfH = Math.max(size.y, size.x / aspect) * 0.5 * pad;
    var halfW = halfH * aspect;
    var cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 3000);
    cam.position.set(center.x, center.y, box.max.z + 600);
    cam.lookAt(center.x, center.y, center.z);
    renderer.render(scene, cam);
    var gl = renderer.getContext();
    var sample = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
    window.__SILHOUETTE_CENTER__ = Array.from(sample);
    window.__SILHOUETTE_READY__ = true;

    var loop = function () {
      if (disposed) return;
      renderer.render(scene, cam);
      animationId=requestAnimationFrame(loop);
    };
    animationId=requestAnimationFrame(loop);
  }

  function colorSpace(renderer) {
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
  }

  function initScene() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: params.get("silhouette") === "1"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 0);
    colorSpace(renderer);
    if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = !lowPower;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xe9e1d1, 230, 520);
    camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.5, 1400);
    clock = new THREE.Clock(false);

    scene.add(new THREE.HemisphereLight(0xfff7e8, 0x8d8274, 0.95));

    var key = new THREE.DirectionalLight(0xfff0d0, 1.9);
    key.position.set(70, 120, 90);
    key.castShadow = !lowPower;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -95;
    key.shadow.camera.right = 95;
    key.shadow.camera.top = 95;
    key.shadow.camera.bottom = -95;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 420;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    var fill = new THREE.DirectionalLight(0xcfe0ff, 0.5);
    fill.position.set(-90, 55, -70);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffd8a8, 0.7);
    rim.position.set(0, 40, -120);
    scene.add(rim);

    var plinthMat = new THREE.MeshStandardMaterial({ color: 0xd7cec0, roughness: 0.92 });
    var plinth = new THREE.Mesh(new THREE.BoxGeometry(98, 1.2, 80), plinthMat);
    plinth.position.y = -0.6;
    plinth.receiveShadow = true;
    scene.add(plinth);

    var plinthTopMat = new THREE.MeshStandardMaterial({ color: 0xe2d9c9, roughness: 0.95 });
    var plinthTop = new THREE.Mesh(new THREE.BoxGeometry(92, 0.12, 74), plinthTopMat);
    plinthTop.position.y = 0.04;
    plinthTop.receiveShadow = true;
    scene.add(plinthTop);

    var groundMat = new THREE.MeshStandardMaterial({ color: 0xe6dece, roughness: 1 });
    var ground = new THREE.Mesh(new THREE.CircleGeometry(380, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.3;
    scene.add(ground);

    var shadowTex = makeContactShadow();
    var shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    var contact = new THREE.Mesh(new THREE.PlaneGeometry(112, 92), shadowMat);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.12;
    scene.add(contact);
    decor.push(plinth, plinthTop, ground, contact);
  }

  function makeContactShadow() {
    var c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, "rgba(42,32,22,0.55)");
    grad.addColorStop(0.55, "rgba(42,32,22,0.2)");
    grad.addColorStop(1, "rgba(42,32,22,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  function addModel() {
    scene.add(model.group);
    anchors = model.anchors || {};
  }

  function buildPresets() {
    var box = new THREE.Box3().setFromObject(model.group);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);

    minDistance = maxDim * 0.28;
    maxDistance = maxDim * 4.2;
    var zoom = (spot.model && spot.model.zoom) || {};
    if (typeof zoom.min === "number") minDistance = zoom.min;
    if (typeof zoom.max === "number") maxDistance = zoom.max;

    var aspectFactor = Math.max(1, 1.3 / camera.aspect);
    var baseTarget = new THREE.Vector3(center.x, box.min.y + size.y * 0.34, center.z);
    var frontTarget = new THREE.Vector3(center.x, box.min.y + size.y * 0.3, center.z);
    var detailTarget = (anchors.detail || anchors.roof_figures || baseTarget).clone();
    var courtyardTarget = (anchors.courtyard || baseTarget).clone();

    presets = {
      overview: { yaw: 0.7, pitch: 0.52, distance: maxDim * 1.55 * aspectFactor, target: baseTarget.clone() },
      front: { yaw: 0, pitch: 0.2, distance: maxDim * 1.45 * aspectFactor, target: frontTarget },
      detail: { yaw: 0.32, pitch: 0.34, distance: maxDim * 0.72 * aspectFactor, target: detailTarget },
      courtyard: { yaw: 0.04, pitch: 0.11, distance: maxDim * 0.46 * aspectFactor, target: courtyardTarget },
      alley: { yaw: 0, pitch: 0.45, distance: maxDim * 0.55 * aspectFactor, target: (anchors.alley_view || anchors.alley || baseTarget).clone() },
      street: { yaw: Math.PI / 2, pitch: 0.08, distance: maxDim * 0.32 * aspectFactor, target: (anchors.street || baseTarget).clone() },
      arcade: { yaw: 0.1, pitch: 0.1, distance: maxDim * 0.3 * aspectFactor, target: (anchors.arcade || baseTarget).clone() },
      gate: { yaw: Math.PI / 2, pitch: 0.15, distance: maxDim * 0.45 * aspectFactor, target: (anchors.gate || baseTarget).clone() },
      stage: { yaw: Math.PI, pitch: 0.16, distance: maxDim * 0.4 * aspectFactor, target: (anchors.stage || baseTarget).clone() },
      avenue: { yaw: -Math.PI / 2, pitch: 0.06, distance: maxDim * 0.4 * aspectFactor, target: (anchors.avenue || baseTarget).clone() },
      church: { yaw: 0, pitch: 0.1, distance: maxDim * 0.25 * aspectFactor, target: (anchors.church || baseTarget).clone() },
      hotel: { yaw: Math.PI, pitch: 0.1, distance: maxDim * 0.3 * aspectFactor, target: (anchors.hotel || baseTarget).clone() },
      park: { yaw: Math.PI / 2, pitch: 0.08, distance: maxDim * 0.2 * aspectFactor, target: (anchors.park || baseTarget).clone() },
      "ancient-road": { yaw: 0, pitch: 0.55, distance: maxDim * 0.3 * aspectFactor, target: (anchors.ancient || baseTarget).clone() },
      temple: { yaw: 0.4, pitch: 0.3, distance: maxDim * 0.5 * aspectFactor, target: (anchors.temple || baseTarget).clone() },
      wuyang: { yaw: 0.2, pitch: 0.16, distance: maxDim * 0.28 * aspectFactor, target: (anchors.wuyang || baseTarget).clone() },
      wall: { yaw: 0.15, pitch: 0.2, distance: maxDim * 0.34 * aspectFactor, target: (anchors.wall || baseTarget).clone() },
      zhenhai: { yaw: 0.25, pitch: 0.18, distance: maxDim * 0.4 * aspectFactor, target: (anchors.zhenhai || baseTarget).clone() },
      canal: { yaw: -Math.PI / 2, pitch: 0.06, distance: maxDim * 0.5 * aspectFactor, target: (anchors.canal || baseTarget).clone() },
      bridge: { yaw: 0.5, pitch: 0.12, distance: maxDim * 0.3 * aspectFactor, target: (anchors.bridge || baseTarget).clone() },
      tower: { yaw: 0.35, pitch: 0.12, distance: maxDim * 0.28 * aspectFactor, target: (anchors.tower || baseTarget).clone() },
      house: { yaw: 0.25, pitch: 0.08, distance: maxDim * 0.28 * aspectFactor, target: (anchors.house || baseTarget).clone() },
      opera: { yaw: 0.2, pitch: 0.1, distance: maxDim * 0.28 * aspectFactor, target: (anchors.opera || baseTarget).clone() },
      qilou: { yaw: 0.3, pitch: 0.1, distance: maxDim * 0.28 * aspectFactor, target: (anchors.qilou || baseTarget).clone() },
      taotao: { yaw: 0.2, pitch: 0.1, distance: maxDim * 0.25 * aspectFactor, target: (anchors.taotao || baseTarget).clone() },
      lianxiang: { yaw: 0.2, pitch: 0.1, distance: maxDim * 0.25 * aspectFactor, target: (anchors.lianxiang || baseTarget).clone() },
      hall: { yaw: 0.1, pitch: 0.1, distance: maxDim * 0.35 * aspectFactor, target: (anchors.hall || baseTarget).clone() },
      pagoda: { yaw: 0.25, pitch: 0.1, distance: maxDim * 0.32 * aspectFactor, target: (anchors.pagoda || baseTarget).clone() }
    };

    var overrides = spot.presetOverrides || {};
    Object.keys(overrides).forEach(function (name) {
      var o = overrides[name];
      if (!presets[name] || !o) return;
      if (typeof o.yaw === "number") presets[name].yaw = o.yaw;
      if (typeof o.pitch === "number") presets[name].pitch = o.pitch;
      if (typeof o.distance === "number") presets[name].distance = o.distance * Math.min(aspectFactor, 1.8);
      if (Array.isArray(o.target) && o.target.length === 3) {
        presets[name].target.set(o.target[0], o.target[1], o.target[2]);
      }
    });
  }

  function buildHotspots() {
    var list = spot.hotspots || [];
    list.forEach(function (hs) {
      var anchor = anchors[hs.anchor];
      if (!anchor) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hotspot";
      btn.dataset.hotspot = hs.id;
      btn.innerHTML = '<span class="hotspot-dot" aria-hidden="true"></span><span class="hotspot-label">' + escapeHtml(hs.label) + "</span>";
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        showHotspot(hs, btn);
      });
      hotspotLayer.appendChild(btn);
      hotspotEls.set(hs.id, btn);
      hotspotAnchors.set(hs.id, anchor.clone());
    });
  }

  function showHotspot(hs, btn) {
    var card = q("hotspotCard");
    q("hotspotTitle").textContent = hs.label || "";
    q("hotspotText").textContent = hs.note || "";
    var focus = q("hotspotFocus");
    if (hs.preset && presets[hs.preset]) {
      focus.hidden = false;
      focus.onclick = function () { setPreset(hs.preset); };
    } else {
      focus.hidden = true;
      focus.onclick = null;
    }
    card.hidden = false;
    hotspotEls.forEach(function (el) { el.classList.remove("is-active"); });
    if (btn) btn.classList.add("is-active");
  }

  function closeHotspot() {
    q("hotspotCard").hidden = true;
    hotspotEls.forEach(function (el) { el.classList.remove("is-active"); });
  }

  function buildUI() {
    var p = place || {
      name: spot.name,
      en: "",
      no: "001",
      sig: "风格化单体模型。",
      facts: [],
      highlights: [],
      best: "",
      tip: ""
    };
    var clusters = window.__ATLAS_CLUSTERS || {};
    var cluster = p.cluster ? clusters[p.cluster] : null;
    var facts = (p.facts || []).slice();
    if (facts.length % 2 === 1) facts.push(["片区", cluster ? cluster.name : "广州"]);

    document.title = p.name + " · 广州城市模型册";
    q("sceneName").textContent = p.name;
    canvas.setAttribute("aria-label",p.name+"风格化三维模型");
    var number="MODEL "+(p.no||spot.id);q("modelNumber").textContent="模型册 · "+number;
    document.querySelector('meta[name="description"]').setAttribute("content",p.name+"风格化模型；非测绘，仅作城市观察与文化展示。");
    q("spotKicker").textContent = number+" · " + (cluster ? cluster.name : "广州");
    q("spotName").textContent = p.name;
    q("spotEn").textContent = p.en || "";
    q("spotSig").textContent = p.sig || "";
    q("spotFacts").innerHTML = facts.map(function (f) {
      return '<div class="fact"><span>' + escapeHtml(f[0]) + "</span><strong>" + escapeHtml(f[1]) + "</strong></div>";
    }).join("");
    q("spotHighlights").innerHTML = (p.highlights || []).map(function (h) {
      return "<li>" + escapeHtml(h) + "</li>";
    }).join("");
    q("spotBest").textContent = p.best || "以现场公告为准";
    q("spotTip").textContent = p.tip || "";

    var presetWrap = q("presets");
    if (presetWrap) {
      presetWrap.innerHTML = "";
      var presetNames = Array.isArray(spot.presets) && spot.presets.length ? spot.presets : ["overview"];
      presetNames.forEach(function (name) {
        if (!presets[name]) return;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.preset = name;
        btn.textContent = PRESET_LABELS[name] || name;
        btn.addEventListener("click", function () { setPreset(name); });
        presetWrap.appendChild(btn);
      });
    }

    q("autoRotate").addEventListener("click", function () {
      autoRotate = !autoRotate;
      this.setAttribute("aria-pressed", String(autoRotate));
      this.textContent = autoRotate ? "自动旋转 开" : "自动旋转";
    });

    q("markVisited").addEventListener("click", markVisited);

    q("panelToggle").addEventListener("click", function () {
      panel.hidden = !panel.hidden;
    });
    q("panelClose").addEventListener("click", function () {
      panel.hidden = true;
    });
    q("hotspotClose").addEventListener("click", closeHotspot);

    if (window.innerWidth < 760) panel.hidden = true;
    updateMarkButton();
  }

  function isVisited() {
    try {
      var marks = JSON.parse(localStorage.getItem("canton-atlas-marks") || "{}");
      return marks[spotId] === "visited";
    } catch (error) {
      return false;
    }
  }

  function updateMarkButton() {
    var btn = q("markVisited");
    var visited = isVisited();
    btn.textContent = visited ? "✓ 已去过" : "✓ 标记去过";
    btn.classList.toggle("is-visited", visited);
    btn.setAttribute("aria-pressed", String(visited));
  }

  function markVisited() {
    try {
      var marks = JSON.parse(localStorage.getItem("canton-atlas-marks") || "{}");
      marks[spotId] = "visited";
      localStorage.setItem("canton-atlas-marks", JSON.stringify(marks));
    } catch (error) { /* 本地存储不可用时忽略 */ }
    updateMarkButton();
    toast("已标记去过，回到图鉴会同步");
    if (new URLSearchParams(location.search).get("embed")==="1" && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "canton-mark-visited", id: spotId }, location.origin);
      } catch (error) { /* ignore */ }
    }
  }

  function backAtlas(event) {
    if (new URLSearchParams(location.search).get("embed")==="1" && window.parent !== window) {
      try {
        if(event)event.preventDefault();
        cleanup();
        window.parent.postMessage({ type: "canton-close-immersive" }, location.origin);
      } catch (error) {
        window.location.href = "index.html";
      }
      return;
    }
    // Standalone pages use the anchor href, including when initialization fails.
  }

  function setPreset(name, instant) {
    var p = presets[name];
    if (!p) return;
    desired.yaw = p.yaw;
    desired.pitch = p.pitch;
    desired.distance = clamp(p.distance, minDistance, maxDistance);
    desired.target.copy(p.target);
    if (instant) {
      current.yaw = desired.yaw;
      current.pitch = desired.pitch;
      current.distance = desired.distance;
      current.target.copy(desired.target);
    }
    activePreset = name;
    document.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.preset === name));
    });
  }

  function bindControls() {
    canvas.addEventListener("pointerdown", function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      dragging = true;
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
      canvas.classList.add("is-dragging");
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      var dx = event.clientX - lastPointer.x;
      var dy = event.clientY - lastPointer.y;
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
      desired.yaw -= dx * 0.006;
      desired.pitch = clamp(desired.pitch + dy * 0.006, 0.06, 1.35);
    });

    function endDrag() {
      dragging = false;
      canvas.classList.remove("is-dragging");
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", endDrag);

    canvas.addEventListener("wheel", function (event) {
      event.preventDefault();
      desired.distance = clamp(desired.distance * Math.exp(event.deltaY * 0.0012), minDistance, maxDistance);
    }, { passive: false });

    canvas.addEventListener("dblclick", function () {
      setPreset("overview");
    });

    canvas.addEventListener("touchstart", function (event) {
      if (event.touches.length === 2) {
        touchSpan = touchDistance(event.touches);
        dragging = false;
      }
    }, { passive: true });

    canvas.addEventListener("touchmove", function (event) {
      if (event.touches.length === 2) {
        var span = touchDistance(event.touches);
        if (touchSpan && span) {
          desired.distance = clamp(desired.distance * (touchSpan / span), minDistance, maxDistance);
        }
        touchSpan = span;
        event.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("touchend", function () { touchSpan = 0; }, { passive: true });

    window.addEventListener("keydown", function (event) {
      var step = 0.08;
      if (event.key === "ArrowLeft") desired.yaw += step;
      else if (event.key === "ArrowRight") desired.yaw -= step;
      else if (event.key === "ArrowUp") desired.pitch = clamp(desired.pitch + step, 0.06, 1.35);
      else if (event.key === "ArrowDown") desired.pitch = clamp(desired.pitch - step, 0.06, 1.35);
      else if (event.key === "+" || event.key === "=") desired.distance = clamp(desired.distance * 0.9, minDistance, maxDistance);
      else if (event.key === "-") desired.distance = clamp(desired.distance * 1.1, minDistance, maxDistance);
      else if (event.key === "0") setPreset("overview");
      else return;
      event.preventDefault();
    });

    window.addEventListener("resize", onResize);

  }

  function touchDistance(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function updateCamera() {
    var cp = Math.cos(current.pitch);
    var sp = Math.sin(current.pitch);
    camera.position.set(
      current.target.x + Math.sin(current.yaw) * cp * current.distance,
      current.target.y + sp * current.distance,
      current.target.z + Math.cos(current.yaw) * cp * current.distance
    );
    camera.lookAt(current.target);
  }

  function updateHotspots() {
    var width = renderer.domElement.clientWidth;
    var height = renderer.domElement.clientHeight;
    var dir = camera.getWorldDirection(new THREE.Vector3());
    hotspotEls.forEach(function (el, id) {
      var anchor = hotspotAnchors.get(id);
      if (!anchor) {
        el.classList.add("is-hidden");
        return;
      }
      var toAnchor = anchor.clone().sub(camera.position);
      var inFront = toAnchor.dot(dir) > 0;
      var v = anchor.clone().project(camera);
      var visible = inFront && v.z > -1 && v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92;
      el.classList.toggle("is-hidden", !visible);
      if (!visible) return;
      var x = (v.x * 0.5 + 0.5) * width;
      var y = (-v.y * 0.5 + 0.5) * height;
      el.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)";
    });
  }

  function renderStats() {
    var info = renderer.info.render;
    var prefix = fpsState.fps > 0 ? fpsState.fps + " fps · " : "";
    q("metrics").textContent = prefix + info.calls + " calls · " + info.triangles.toLocaleString("en-US") + " tris";
  }

  function updateMetrics() {
    fpsState.frames++;
    var now = performance.now();
    if (now - fpsState.last < 600) return;
    if (fpsState.frames > 0) {
      fpsState.fps = Math.round(fpsState.frames * 1000 / (now - fpsState.last));
    }
    fpsState.frames = 0;
    fpsState.last = now;
    renderStats();
  }

  function animate() {
    if (disposed) return;
    animationId=requestAnimationFrame(animate);
    if (document.hidden && !forceRender) return;

    var dt = Math.min(clock.getDelta(), 0.05);
    if (autoRotate && !dragging) desired.yaw += dt * 0.16;

    var k = 0.14;
    current.yaw += (desired.yaw - current.yaw) * k;
    current.pitch += (desired.pitch - current.pitch) * k;
    current.distance += (desired.distance - current.distance) * k;
    current.target.lerp(desired.target, k);

    updateCamera();
    updateHotspots();
    renderer.render(scene, camera);
    updateMetrics();
  }

  function cleanup() {
    if(disposed)return;disposed=true;loadAbort.abort();cancelAnimationFrame(animationId);window.clearTimeout(toastTimer);releaseResources();
  }

  boot().catch(function (error) {
    if(disposed)return;cleanup();
    showFailure("页面初始化失败：" + error.message);
  });
})();
