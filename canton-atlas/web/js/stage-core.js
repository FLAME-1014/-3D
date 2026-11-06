/* stage-core.js — 广州立体志 · WebGL 渲染核心
 *
 * 从 diorama.js 中拆出的与 spot.html UI 无关的渲染能力：
 *   - renderer / scene / camera 初始化（透明纸色画布、灯光、色彩空间）
 *   - model.js 动态加载 + 包围盒机位生成（presets）
 *   - 模型在画布内增量加载、切换、dispose（只保留当前 + 前后各一件）
 *   - 剖切平面（clipping plane）统一挂在所有材质上，用于"从剪影立起"
 *   - 轨道相机与热点屏幕投影（供展开/自由展柜复用）
 *   - 渲染循环（可暂停/恢复，静止时不浪费帧）
 *
 * 契约：
 *   - 模型模块必须 export { create() }，create() 返回 { group, anchors, dispose }
 *   - 所有单位：米，Y 向上，原点在模型底面中心，北 = -Z
 *   - 无 DOM 依赖，仅依赖 window.THREE（r128）
 *
 * 用法（书页模式）：
 *   const stage = createStage(canvas, { alpha: true, maxPixelRatio: 1.75 });
 *   stage.resize();
 *   await stage.load('chenjiaci');
 *   stage.showPreset('overview', false);
 *   stage.rise(0.5);               // 0..1，由书页翻页动画驱动
 *   stage.tilt(0.1);               // 翻页跟手倾斜
 *   stage.render();                // 手动渲染一帧，或 stage.start() / stage.stop()
 *
 * 用法（spot.html 展柜模式）：由 diorama.js 调用，行为与旧版一致。
 */
(function (root) {
  'use strict';

  var THREE = (root && root.THREE) || null;
  if (!THREE) throw new Error('stage-core: window.THREE 未就绪');

  var PALETTE = (root && root.CantonPalette) || {};
  var PAPER = PALETTE.colors && PALETTE.colors.paper !== undefined
    ? PALETTE.colors.paper : 0xf4eee1;

  // ---------------------------------------------------------------- 工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------- 阶段核心
  function createStage(canvas, opts) {
    opts = opts || {};
    var alpha = opts.alpha !== false;
    var maxPixelRatio = opts.maxPixelRatio == null ? 1.75 : opts.maxPixelRatio;

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: alpha,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(canvas.clientWidth || root.innerWidth, canvas.clientHeight || root.innerHeight, false);
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
    }
    renderer.shadowMap.enabled = false;
    renderer.localClippingEnabled = true; // 剖切平面由材质局部生效，而非全场景

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PAPER, 230, 520);

    var camera = new THREE.PerspectiveCamera(36, 1, 0.5, 4400);
    camera.position.set(100, 80, 120);
    camera.lookAt(0, 10, 0);

    scene.add(new THREE.HemisphereLight(0xfff7e8, 0x8d8274, 0.95));
    var key = new THREE.DirectionalLight(0xfff0d0, 1.9);
    key.position.set(70, 120, 90);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xcfe0ff, 0.5);
    fill.position.set(-90, 55, -70);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffd8a8, 0.7);
    rim.position.set(0, 40, -120);
    scene.add(rim);

    // ---------------------------------------------------------------- 运行期状态
    var disposed = false;
    var model = null;            // { group, anchors, dispose }
    var spotId = null;
    var box = null;              // 当前模型包围盒
    var presets = {};
    var activePreset = 'overview';

    var current = { yaw: 0.7, pitch: 0.52, distance: 140, target: new THREE.Vector3(0, 6, 0) };
    var desired = { yaw: 0.7, pitch: 0.52, distance: 140, target: new THREE.Vector3(0, 6, 0) };
    var minDistance = 24;
    var maxDistance = 360;

    var dragging = false;
    var autoRotate = false;
    var lastPointer = { x: 0, y: 0 };
    var animationId = 0;
    var renderRequested = false;
    var loadAbort = new AbortController();

    var risePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var riseProgress = 0; // 0 = 平躺，1 = 完全立起
    var riseEnabled = false;

    // ---------------------------------------------------------------- 机位生成（与 diorama.js buildPresets 同口径）
    function buildPresets() {
      if (!model || !box) return;
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z);
      var aspect = camera.aspect || 1;
      var aspectFactor = Math.max(1, 1.3 / aspect);

      minDistance = maxDim * 0.28;
      maxDistance = maxDim * 4.2;
      var spotModel = (root.SPOT_DATA && root.SPOT_DATA.model && root.SPOT_DATA.model.zoom) || {};
      if (typeof spotModel.min === 'number') minDistance = spotModel.min;
      if (typeof spotModel.max === 'number') maxDistance = spotModel.max;

      var anchors = model.anchors || {};
      var baseTarget = new THREE.Vector3(center.x, box.min.y + size.y * 0.34, center.z);
      var frontTarget = new THREE.Vector3(center.x, box.min.y + size.y * 0.3, center.z);
      var detailTarget = (anchors.detail || anchors.roof_figures || baseTarget).clone();

      presets = {
        overview: { yaw: 0.7, pitch: 0.52, distance: maxDim * 1.55 * aspectFactor, target: baseTarget.clone() },
        front:    { yaw: 0,     pitch: 0.2,  distance: maxDim * 1.45 * aspectFactor, target: frontTarget },
        detail:   { yaw: 0.32,  pitch: 0.34, distance: maxDim * 0.72 * aspectFactor, target: detailTarget },
        courtyard:{ yaw: 0.04,  pitch: 0.11, distance: maxDim * 0.46 * aspectFactor, target: (anchors.courtyard || baseTarget).clone() },
        alley:    { yaw: 0,     pitch: 0.45, distance: maxDim * 0.55 * aspectFactor, target: (anchors.alley_view || anchors.alley || baseTarget).clone() },
        street:   { yaw: Math.PI/2, pitch: 0.08, distance: maxDim * 0.32 * aspectFactor, target: (anchors.street || baseTarget).clone() },
        arcade:   { yaw: 0.1,   pitch: 0.1,  distance: maxDim * 0.3 * aspectFactor, target: (anchors.arcade || baseTarget).clone() },
        gate:     { yaw: Math.PI/2, pitch: 0.15, distance: maxDim * 0.45 * aspectFactor, target: (anchors.gate || baseTarget).clone() },
        stage:    { yaw: Math.PI, pitch: 0.16, distance: maxDim * 0.4 * aspectFactor, target: (anchors.stage || baseTarget).clone() },
        avenue:   { yaw: -Math.PI/2, pitch: 0.06, distance: maxDim * 0.4 * aspectFactor, target: (anchors.avenue || baseTarget).clone() },
        church:   { yaw: 0,     pitch: 0.1,  distance: maxDim * 0.25 * aspectFactor, target: (anchors.church || baseTarget).clone() },
        hotel:    { yaw: Math.PI, pitch: 0.1,  distance: maxDim * 0.3 * aspectFactor, target: (anchors.hotel || baseTarget).clone() },
        park:     { yaw: Math.PI/2, pitch: 0.08, distance: maxDim * 0.2 * aspectFactor, target: (anchors.park || baseTarget).clone() },
        'ancient-road': { yaw: 0, pitch: 0.55, distance: maxDim * 0.3 * aspectFactor, target: (anchors.ancient || baseTarget).clone() },
        temple:   { yaw: 0.4,   pitch: 0.3,  distance: maxDim * 0.5 * aspectFactor, target: (anchors.temple || baseTarget).clone() },
        wuyang:   { yaw: 0.2,   pitch: 0.16, distance: maxDim * 0.28 * aspectFactor, target: (anchors.wuyang || baseTarget).clone() },
        wall:     { yaw: 0.15,  pitch: 0.2,  distance: maxDim * 0.34 * aspectFactor, target: (anchors.wall || baseTarget).clone() },
        zhenhai:  { yaw: 0.25,  pitch: 0.18, distance: maxDim * 0.4 * aspectFactor, target: (anchors.zhenhai || baseTarget).clone() },
        canal:    { yaw: -Math.PI/2, pitch: 0.06, distance: maxDim * 0.5 * aspectFactor, target: (anchors.canal || baseTarget).clone() },
        bridge:   { yaw: 0.5,   pitch: 0.12, distance: maxDim * 0.3 * aspectFactor, target: (anchors.bridge || baseTarget).clone() },
        tower:    { yaw: 0.35,  pitch: 0.12, distance: maxDim * 0.28 * aspectFactor, target: (anchors.tower || baseTarget).clone() },
        house:    { yaw: 0.25,  pitch: 0.08, distance: maxDim * 0.28 * aspectFactor, target: (anchors.house || baseTarget).clone() },
        opera:    { yaw: 0.2,   pitch: 0.1,  distance: maxDim * 0.28 * aspectFactor, target: (anchors.opera || baseTarget).clone() },
        qilou:    { yaw: 0.3,   pitch: 0.1,  distance: maxDim * 0.28 * aspectFactor, target: (anchors.qilou || baseTarget).clone() },
        taotao:   { yaw: 0.2,   pitch: 0.1,  distance: maxDim * 0.25 * aspectFactor, target: (anchors.taotao || baseTarget).clone() },
        lianxiang:{ yaw: 0.2,   pitch: 0.1,  distance: maxDim * 0.25 * aspectFactor, target: (anchors.lianxiang || baseTarget).clone() },
        hall:     { yaw: 0.1,   pitch: 0.1,  distance: maxDim * 0.35 * aspectFactor, target: (anchors.hall || baseTarget).clone() },
        pagoda:   { yaw: 0.25,  pitch: 0.1,  distance: maxDim * 0.32 * aspectFactor, target: (anchors.pagoda || baseTarget).clone() },
        tomb:     { yaw: -2.3,  pitch: 0.45, distance: maxDim * 0.46 * aspectFactor, target: (anchors.tomb || baseTarget).clone() },
        jade:     { yaw: -2.6,  pitch: 0.2,  distance: maxDim * 0.38 * aspectFactor, target: (anchors.jade || baseTarget).clone() },
        paifang:  { yaw: 0.05,  pitch: 0.13, distance: maxDim * 0.16 * aspectFactor, target: (anchors.paifang || baseTarget).clone() },
        summit:   { yaw: 3.34,  pitch: 0.2,  distance: maxDim * 0.3 * aspectFactor, target: (anchors.summit || anchors.star || baseTarget).clone() },
        base:     { yaw: 0.35,  pitch: 0.12, distance: maxDim * 0.36 * aspectFactor, target: (anchors.base || baseTarget).clone() },
        lattice:  { yaw: 0.9,   pitch: 0.05, distance: maxDim * 0.6 * aspectFactor, target: (anchors.lattice || baseTarget).clone() },
        top:      { yaw: 0.6,   pitch: 0.06, distance: maxDim * 0.5 * aspectFactor, target: (anchors.mast || anchors.deck || baseTarget).clone() },
        river:    { yaw: Math.PI, pitch: 0.05, distance: maxDim * 1.5 * aspectFactor, target: (anchors.steps || baseTarget).clone() },
        facade:   { yaw: 0,     pitch: 0.05, distance: maxDim * 0.7 * aspectFactor, target: (anchors.facade || baseTarget).clone() },
        rose:     { yaw: 0.04,  pitch: 0.05, distance: maxDim * 0.2 * aspectFactor, target: (anchors.rose || baseTarget).clone() },
        side:     { yaw: Math.PI/2, pitch: 0.08, distance: maxDim * 0.55 * aspectFactor, target: (anchors.buttress || baseTarget).clone() },
        apse:     { yaw: 3.6,   pitch: 0.1,  distance: maxDim * 0.5 * aspectFactor, target: (anchors.apse || baseTarget).clone() },
        box:      { yaw: -1.05, pitch: 0.03, distance: maxDim * 0.6 * aspectFactor, target: (anchors.box || baseTarget).clone() },
        plaza:    { yaw: -1.2,  pitch: 0.14, distance: maxDim * 0.4 * aspectFactor, target: (anchors.plaza || baseTarget).clone() },
        pool:     { yaw: -0.08, pitch: 0.05, distance: maxDim * 0.5 * aspectFactor, target: (anchors.pool || baseTarget).clone() },
        mouth:    { yaw: 0.32,  pitch: 0.11, distance: maxDim * 0.28 * aspectFactor, target: (anchors.mouth || baseTarget).clone() }
      };

      var overrides = (root.SPOT_DATA && root.SPOT_DATA.presetOverrides) || {};
      Object.keys(overrides).forEach(function (name) {
        var o = overrides[name];
        if (!presets[name] || !o) return;
        if (typeof o.yaw === "number") presets[name].yaw = o.yaw;
        if (typeof o.pitch === "number") presets[name].pitch = o.pitch;
        if (typeof o.distance === "number") presets[name].distance = o.distance * (o.fixed ? 1 : Math.min(aspectFactor, root.SPOT_DATA.id === "gd-museum" ? 2.6 : root.SPOT_DATA.id === "opera-house" ? 2.0 : 1.8));
        if (Array.isArray(o.target) && o.target.length === 3) {
          presets[name].target.set(o.target[0], o.target[1], o.target[2]);
        }
      });

      activePreset = presets['overview'] ? 'overview' : Object.keys(presets)[0];
    }

    // ---------------------------------------------------------------- 相机与剖切
    function updateCamera() {
      var cp = Math.cos(current.pitch), sp = Math.sin(current.pitch);
      camera.position.set(
        current.target.x + Math.sin(current.yaw) * cp * current.distance,
        current.target.y + sp * current.distance,
        current.target.z + Math.cos(current.yaw) * cp * current.distance
      );
      camera.lookAt(current.target);
      if (riseEnabled && box) {
        var size = box.getSize(new THREE.Vector3());
        var height = box.min.y + riseProgress * size.y;
        risePlane.constant = -height;
        var mats = collectMaterials();
        mats.forEach(function (m) {
          if (m.clippingPlanes) m.clippingPlanes[0] = risePlane;
          m.needsUpdate = true;
        });
      }
    }

    function collectMaterials() {
      var seen = new Set(), list = [];
      if (!model || !model.group) return list;
      model.group.traverse(function (o) {
        if (!o.material) return;
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          if (m && !seen.has(m)) { seen.add(m); list.push(m); }
        });
      });
      return list;
    }

    function attachRisePlane() {
      var mats = collectMaterials();
      mats.forEach(function (m) {
        m.clippingPlanes = [risePlane];
        m.clipShadows = true;
        m.needsUpdate = true;
      });
      riseEnabled = true;
      updateCamera();
    }

    function detachRisePlane() {
      var mats = collectMaterials();
      mats.forEach(function (m) {
        if (m.clippingPlanes) { m.clippingPlanes = null; m.needsUpdate = true; }
      });
      riseEnabled = false;
      riseProgress = 0;
    }

    // ---------------------------------------------------------------- 加载模型
    async function load(id) {
      if (disposed) throw new Error('stage 已销毁');
      if (spotId === id && model) return { id: id, ms: 0, cached: true };

      var start = performance.now();
      if (model) {
        detachRisePlane();
        unloadModel();
      }

      var mod = await import('../content/spots/' + encodeURIComponent(id) + '/model.js', { signal: loadAbort.signal });
      if (disposed) return null;
      if (!mod || typeof mod.create !== 'function') throw new Error('模型缺少 create()');
      model = mod.create();
      if (!model.group || !model.group.isObject3D || typeof model.dispose !== 'function') {
        throw new Error('create() 必须返回 group 与 dispose()');
      }
      spotId = id;

      var ms = Math.round(performance.now() - start);
      scene.add(model.group);

      box = new THREE.Box3().setFromObject(model.group);
      buildPresets();
      attachRisePlane();

      // 默认到 overview 机位，瞬间到位
      setPreset('overview', true);
      updateCamera();
      render();

      return { id: id, ms: ms, cached: false };
    }

    function unloadModel() {
      if (!model) return;
      if (model.group && model.group.parent) model.group.parent.remove(model.group);
      if (typeof model.dispose === 'function') model.dispose();
      model = null;
      spotId = null;
      box = null;
      presets = {};
      activePreset = null;
      detachRisePlane();
    }

    // ---------------------------------------------------------------- 机位与动画
    function setPreset(name, instant) {
      var p = presets[name];
      if (!p) return false;
      desired.yaw = p.yaw;
      desired.pitch = p.pitch;
      desired.distance = clamp(p.distance, minDistance, maxDistance);
      desired.target.copy(p.target);
      activePreset = name;
      if (instant) {
        current.yaw = desired.yaw;
        current.pitch = desired.pitch;
        current.distance = desired.distance;
        current.target.copy(desired.target);
        updateCamera();
      }
      requestRender();
      return true;
    }

    function getPresets() { return presets; }
    function getActivePreset() { return activePreset; }

    function setAutoRotate(enabled) {
      autoRotate = enabled === true;
      requestRender();
    }

    // 缩放：改变 desired.distance，由 animate 平滑追随
    function zoom(factor) {
      desired.distance = clamp(desired.distance * factor, minDistance, maxDistance);
      requestRender();
    }

    // 由外部驱动的剖切进度：0 = 平躺纸面，1 = 完全立起
    function rise(progress) {
      progress = clamp(progress, 0, 1);
      if (progress === riseProgress) return;
      riseProgress = progress;
      updateCamera();
      requestRender();
    }
    function getRiseProgress() { return riseProgress; }

    // 翻页跟手倾斜：对 yaw/pitch 的叠加偏移（模型随书页一起倾斜）
    var tiltYaw = 0, tiltPitch = 0;
    function tilt(dyaw, dpitch) {
      tiltYaw = dyaw || 0;
      tiltPitch = dpitch || 0;
      current.yaw = desired.yaw + tiltYaw;
      current.pitch = clamp(desired.pitch + tiltPitch, 0.06, 1.35);
      updateCamera();
      requestRender();
    }
    function resetTilt() { tilt(0, 0); }

    // ---------------------------------------------------------------- 渲染循环
    function render() {
      if (disposed) return;
      renderer.render(scene, camera);
    }

    var frame = 0, last = performance.now(), fps = 0;
    function animate() {
      animationId = requestAnimationFrame(animate);
      if (!renderRequested && !autoRotate && !dragging) return;
      var now = performance.now();
      var dt = Math.min(now - last, 50);
      last = now;

      if (autoRotate && !dragging) desired.yaw += dt * 0.00016;

      var k = 0.14;
      current.yaw += (desired.yaw - current.yaw) * k;
      current.pitch += (desired.pitch - current.pitch) * k;
      current.distance += (desired.distance - current.distance) * k;
      current.target.lerp(desired.target, k);

      updateCamera();
      render();

      frame++;
      if (now - last >= 1000) { /* fps 统计占位，保持结构兼容 */ last = now; frame = 0; }
    }

    function start() {
      if (animationId) return;
      last = performance.now();
      animate();
    }
    function stop() {
      if (animationId) { cancelAnimationFrame(animationId); animationId = 0; }
    }
    function requestRender() { renderRequested = true; start(); }

    // ---------------------------------------------------------------- 尺寸
    function resize() {
      if (!renderer || !camera) return;
      var w = canvas.clientWidth || root.innerWidth;
      var h = canvas.clientHeight || root.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, maxPixelRatio));
      renderer.setSize(w, h, false);
      updateCamera();
      render();
    }

    // ---------------------------------------------------------------- 热点屏幕投影（展开模式复用）
    function projectHotspots() {
      var out = {};
      if (!model || !model.anchors || !renderer) return out;
      var width = renderer.domElement.clientWidth;
      var height = renderer.domElement.clientHeight;
      var dir = camera.getWorldDirection(new THREE.Vector3());
      Object.keys(model.anchors).forEach(function (id) {
        var anchor = model.anchors[id];
        if (!anchor || !anchor.isVector3) return;
        var toAnchor = anchor.clone().sub(camera.position);
        var inFront = toAnchor.dot(dir) > 0;
        var v = anchor.clone().project(camera);
        var visible = inFront && v.z > -1 && v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92;
        out[id] = { visible: visible, x: visible ? (v.x * 0.5 + 0.5) * width : 0, y: visible ? (-v.y * 0.5 + 0.5) * height : 0 };
      });
      return out;
    }

    // ---------------------------------------------------------------- 统计与销毁
    function stats() {
      var info = renderer.info.render;
      return { calls: info.calls, triangles: info.triangles, spotId: spotId };
    }

    function destroy() {
      stop();
      loadAbort.abort();
      unloadModel();
      scene = null;
      camera = null;
      renderer.dispose();
      renderer = null;
      disposed = true;
    }

    return {
      canvas: canvas,
      renderer: renderer,
      scene: scene,
      camera: camera,
      load: load,
      unload: unloadModel,
      dispose: destroy,
      resize: resize,
      render: render,
      start: start,
      stop: stop,
      requestRender: requestRender,
      setPreset: setPreset,
      getPresets: getPresets,
      getActivePreset: getActivePreset,
      setAutoRotate: setAutoRotate,
      zoom: zoom,
      rise: rise,
      getRiseProgress: getRiseProgress,
      tilt: tilt,
      resetTilt: resetTilt,
      attachRisePlane: attachRisePlane,
      detachRisePlane: detachRisePlane,
      projectHotspots: projectHotspots,
      stats: stats,
      getSpotId: function () { return spotId; },
      getModel: function () { return model; }
    };
  }

  var api = { createStage: createStage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StageCore = api;
})(typeof window !== 'undefined' ? window : this);
