(function () {
  "use strict";

  var THREE = window.THREE;
  if (!THREE) {
    document.getElementById("loading").hidden = true;
    var failure = document.getElementById("failure");
    document.title='模型加载失败 · 广州城市模型册';q('sceneName').textContent='模型未加载';q('spotPanel').hidden=true;document.querySelector('.toolbar').hidden=true;q('backAtlas').onclick=backAtlas;
    failure.hidden = false;
    failure.textContent = "Three.js 未加载，无法进入模型页。";
    var earlyParams = new URLSearchParams(location.search);
    if (earlyParams.get("from") === "museum" && window.parent !== window) window.parent.postMessage({ type: "canton-museum-error", id: earlyParams.get("id") }, location.origin);
    return;
  }

  var params = new URLSearchParams(location.search);
  var spotId = params.get("id") || "chenjiaci";
  if (params.get("from") === "museum") document.body.classList.add("embed-museum");
  document.body.dataset.spot = spotId;
  var forceRender = params.get("debug") === "1";
  var spot = null;
  var model = null;
  var place = null;
  var canvas = null;
  var hotspotLayer = null;
  var panel = null;

  var stage = null;

  var dragging = false;
  var autoRotate = false;
  var lastPointer = { x: 0, y: 0 };
  var touchSpan = 0;
  var lowPower = false;
  var fpsState = { frames: 0, last: performance.now(), fps: 0 };
  var hotspotEls = new Map();
  var hotspotAnchors = new Map();
  var hotspotPresets = new Map();
  var decor = [];
  var toastTimer = 0;
  var disposed = false, animationId = 0;
  var loadAbort = new AbortController();
  window.addEventListener('pagehide',cleanup);
  window.addEventListener('pageshow',function(event){if(event.persisted&&disposed)location.reload();});
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || event.source !== window.parent || window.parent === window || params.get("from") !== "museum") return;
    var data = event.data || {};
    if (data.type === "canton-museum-open-details" && data.id === spotId) {
      var panelEl = document.getElementById("spotPanel");
      if (panelEl) { panelEl.hidden = false; panelEl.scrollTop = 0; }
    }
  });

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
    pagoda: "塔",
    tomb: "墓室",
    jade: "玉圭门阙",
    paifang: "牌坊",
    summit: "山顶",
    base: "塔基",
    lattice: "塔身",
    top: "塔顶",
    river: "仰视",
    facade: "正立面",
    rose: "玫瑰窗",
    side: "侧廊",
    apse: "后殿",
    box: "盒体",
    plaza: "草坡入口",
    pool: "水池",
    mouth: "玻璃口部"
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
    if (params.get("from") === "museum" && window.parent !== window) {
      try { window.parent.postMessage({ type: "canton-museum-error", id: spotId }, location.origin); } catch (error) { /* ignore */ }
    }
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
      window.SPOT_DATA = spot;
      model = mod.create();
      var modelErrors=window.SpotContract.validateModel(model,spot);if(modelErrors.length)throw new Error(modelErrors.join('；'));
    } catch (error) {
      if(disposed)return;cleanup();
      showFailure("模型加载失败：" + error.message + " | STACK: " + (error.stack || "").split("\n").slice(0,4).join(" / "));
      return;
    }

    var places = window.__ATLAS_PLACES || [];
    place = places.filter(function (p) { return p.id === spotId; })[0] || null;

    lowPower = window.matchMedia("(max-width: 760px)").matches ||
      (navigator.hardwareConcurrency || 8) <= 4;

    canvas = q("scene");
    stage = window.StageCore.createStage(canvas, {
      alpha: true,
      maxPixelRatio: lowPower ? 1.25 : 1.75
    });
    stage.resize();

    stage.load(spotId).then(function () {
      if (disposed) return;
      buildHotspots();
      buildUI();
      bindControls();
      var requestedPreset = params.get("preset");
      setPreset(requestedPreset && stage.getPresets()[requestedPreset] ? requestedPreset : "overview", true);

      q("loading").hidden = true;
      window.__SPOT_READY__ = true;
      if (params.get("from") === "museum" && window.parent !== window) {
        try { window.parent.postMessage({ type: "canton-museum-ready", id: spotId }, location.origin); } catch (error) { /* ignore */ }
      }
      window.__SPOT_API__ = {
        setPreset: function (name) { setPreset(name, true); },
        stats: function () {
          var s = stage.stats();
          return { calls: s.calls, triangles: s.triangles, fps: fpsState.fps };
        },
        camera: function () {
          return {
            position: stage.camera.position.toArray(),
            target: null
          };
        },
        bench: function (n) {
          var frames = Math.max(1, Math.min(240, n || 60));
          var t0 = performance.now();
          for (var i = 0; i < frames; i++) stage.render();
          var t1 = performance.now();
          var s = stage.stats();
          return {
            frames: frames,
            msPerFrame: Number(((t1 - t0) / frames).toFixed(2)),
            calls: s.calls,
            triangles: s.triangles
          };
        }
      };

      if (params.get("silhouette") === "1") {
        setupSilhouette();
      } else {
        stage.start();
        stage.render();
        renderStats();
      }
    }).catch(function (error) {
      if (disposed) return;
      cleanup();
      showFailure("模型加载失败：" + error.message + " | STACK: " + (error.stack || "").split("\n").slice(0,4).join(" / "));
    });
  }

  function setupSilhouette() {
    document.body.classList.add("silhouette-mode");
    var r = stage.renderer;
    var sc = stage.scene;
    sc.fog = null;
    sc.background = new THREE.Color(0xffffff);
    r.setClearColor(0xffffff, 1);
    r.shadowMap.enabled = false;
    sc.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    var m = stage.getModel();
    var part = params.get("part");
    var group = m && m.group;
    if (group && part) {
      group.children.forEach(function (child) {
        child.visible = child.name === part;
      });
    }
    var target = (group && part ? group.getObjectByName(part) : group) || group;
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
    r.render(sc, cam);
    var gl = r.getContext();
    var sample = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
    window.__SILHOUETTE_CENTER__ = Array.from(sample);
    window.__SILHOUETTE_READY__ = true;

    var loop = function () {
      if (disposed) return;
      r.render(sc, cam);
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
  }

  function buildHotspots() {
    var list = spot.hotspots || [];
    var anchors = (stage.getModel() && stage.getModel().anchors) || {};
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
      hotspotPresets.set(hs.id, hs.preset || "");
    });
  }

  function showHotspot(hs, btn) {
    var card = q("hotspotCard");
    q("hotspotTitle").textContent = hs.label || "";
    q("hotspotText").textContent = hs.note || "";
    var focus = q("hotspotFocus");
    if (hs.preset && stage.getPresets()[hs.preset]) {
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
      var allPresets = stage.getPresets();
      presetNames.forEach(function (name) {
        if (!allPresets[name]) return;
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
      stage.setAutoRotate(autoRotate);
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

    if (window.innerWidth < 760 || params.get("from") === "museum") panel.hidden = true;
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
    stage.setPreset(name, instant === true);
    document.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.preset === stage.getActivePreset()));
    });
    if (spot.hotspotMode === "preset") {
      hotspotEls.forEach(function (el, id) {
        var ownPreset = hotspotPresets.get(id);
        el.classList.toggle("is-offpreset", stage.getActivePreset() !== "overview" && !!ownPreset && ownPreset !== stage.getActivePreset());
      });
    }
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
      stage.tilt(dx * -0.006, dy * 0.006);
    });

    function endDrag() {
      dragging = false;
      stage.resetTilt();
      canvas.classList.remove("is-dragging");
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", endDrag);

    canvas.addEventListener("wheel", function (event) {
      event.preventDefault();
      stage.zoom(Math.exp(event.deltaY * 0.0012));
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
          stage.zoom(touchSpan / span);
        }
        touchSpan = span;
        event.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("touchend", function () { touchSpan = 0; }, { passive: true });

    window.addEventListener("keydown", function (event) {
      var step = 0.08;
      if (event.key === "ArrowLeft") stage.tilt(step, 0);
      else if (event.key === "ArrowRight") stage.tilt(-step, 0);
      else if (event.key === "ArrowUp") stage.tilt(0, step);
      else if (event.key === "ArrowDown") stage.tilt(0, -step);
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
    stage.resize();
  }

  function updateCamera() {
    // 由 stage 内部自行更新相机，diorama 层不再直接操作
  }

  function updateHotspots() {
    var width = stage.canvas.clientWidth;
    var height = stage.canvas.clientHeight;
    var dir = stage.camera.getWorldDirection(new THREE.Vector3());
    hotspotEls.forEach(function (el, id) {
      var anchor = hotspotAnchors.get(id);
      if (!anchor) {
        el.classList.add("is-hidden");
        return;
      }
      var toAnchor = anchor.clone().sub(stage.camera.position);
      var inFront = toAnchor.dot(dir) > 0;
      var v = anchor.clone().project(stage.camera);
      var visible = inFront && v.z > -1 && v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92;
      el.classList.toggle("is-hidden", !visible);
      if (!visible) return;
      var x = (v.x * 0.5 + 0.5) * width;
      var y = (-v.y * 0.5 + 0.5) * height;
      var pad = 8;
      var halfW = (el.offsetWidth || 0) / 2;
      var halfH = (el.offsetHeight || 0) / 2;
      x = Math.max(halfW + pad, Math.min(width - halfW - pad, x));
      y = Math.max(halfH + pad, Math.min(height - halfH - pad, y));
      el.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)";
    });
  }

  function renderStats() {
    var s = stage.stats();
    var prefix = fpsState.fps > 0 ? fpsState.fps + " fps · " : "";
    q("metrics").textContent = prefix + s.calls + " calls · " + s.triangles.toLocaleString("en-US") + " tris";
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
    animationId = requestAnimationFrame(animate);
    if (document.hidden && !forceRender) return;

    stage.render();
    updateHotspots();
    updateMetrics();
  }

  function cleanup() {
    if (disposed) return; disposed = true;
    loadAbort.abort();
    cancelAnimationFrame(animationId);
    window.clearTimeout(toastTimer);
    if (stage) stage.dispose();
  }

  boot().catch(function (error) {
    if(disposed)return;cleanup();
    showFailure("页面初始化失败：" + error.message);
  });
})();
