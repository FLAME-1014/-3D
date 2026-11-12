import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEngineModel } from './engine-model.js';

const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const TAU = Math.PI * 2;
const PART_ORDER = ['fan', 'compressor', 'combustor', 'turbine', 'nozzle', 'accessories'];
const TOUR_AMOUNTS = [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1];
const TOUR_OFFSETS = [
  [-3.45, 0, 0], [-1.6, 1.2, 0], [0, 2.8, 0],
  [1.7, 1.2, 0], [3.35, 0, 0], [0.12, -1.4, 0.75],
];
const STAGE_PARTS = { intake: 'fan', compression: 'compressor', combustion: 'combustor', exhaust: 'turbine' };
const copyPose = pose => ({ position: [...pose.position], rotation: [...pose.rotation] });
const emptyPoses = () => Object.fromEntries(PART_ORDER.map(id => [id, { position: [0, 0, 0], rotation: [0, 0, 0] }]));
const samePose = (a, b) => a.position.every((value, i) => Math.abs(value - b.position[i]) < 0.00001)
  && a.rotation.every((value, i) => Math.abs(value - b.rotation[i]) < 0.00001);

/**
 * The scene owns all GPU resources, picking and motion. The interface stays
 * independent so descriptions remain available if WebGL is unavailable.
 */
export function createEngineViewer(host, callbacks = {}) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 150);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x151b18, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '航空发动机交互式三维模型');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  host.append(renderer.domElement);

  const owned = [];
  const environment = createStudioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.1;
  owned.push(environment);
  scene.add(new THREE.HemisphereLight(0xd6e4df, 0x3d4540, 1.15));

  function light(color, intensity, position) {
    const result = new THREE.DirectionalLight(color, intensity);
    result.position.set(...position);
    scene.add(result);
    return result;
  }
  const key = light(0xf6f1df, 3.6, [-5, 9, 7]);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 8, bottom: -8, near: 0.1, far: 38 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = 4;
  light(0xb8d4e5, 2.5, [2, 4, -7]);
  light(0xd9e8e2, 1.5, [-9, 1, 3]);
  light(0xf3ceb0, 1.2, [6, 2, 5]);

  const model = createEngineModel();
  scene.add(model.root);
  const pickables = [];
  const highlightMaterials = new Map();
  // The base model reuses materials. Give each selectable module its own
  // material instances so hovering one module cannot tint other modules.
  for (const [id, group] of model.parts) {
    const clones = new Map();
    group.traverse(object => {
      if (!object.isMesh) return;
      pickables.push(object);
      const replace = material => {
        if (!clones.has(material)) clones.set(material, material.clone());
        return clones.get(material);
      };
      object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
    });
    highlightMaterials.set(id, [...clones.values()]);
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ color: 0x030604, opacity: 0.31 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.25;
  floor.receiveShadow = true;
  scene.add(floor);
  owned.push(floor.geometry, floor.material);

  const contactTexture = makeContactTexture();
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(14.5, 7),
    new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -2.24;
  scene.add(contact);
  owned.push(contact.geometry, contact.material, contactTexture);

  const grid = new THREE.GridHelper(40, 40, 0x6c7c6c, 0x6c7c6c);
  grid.position.y = -2.27;
  grid.material.transparent = true;
  grid.material.opacity = 0.065;
  grid.material.depthWrite = false;
  scene.add(grid);
  owned.push(grid.geometry, grid.material);

  const airflow = createAirflow();
  scene.add(airflow.root);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.55;
  controls.minDistance = 4;
  controls.maxDistance = 110;
  controls.maxPolarAngle = Math.PI * 0.76;
  controls.minPolarAngle = 0.15;
  controls.autoRotateSpeed = 0.55;
  controls.screenSpacePanning = true;

  let width = 1;
  let height = 1;
  let destroyed = false;
  let contextLost = false;
  let raf = 0;
  let frames = 0;
  let lastTime = 0;
  let lastAnchorTime = 0;
  let inTick = false;
  let dirty = true;
  let idle = false;
  let previousContinuous = false;
  let tourStep = null;
  let principleStage = null;
  let qualityMode = 'auto';
  let effectiveQuality = 'high';
  let qualityEvaluations = 0;
  let slowWindows = 0;
  let qualityChangedAt = 0;
  const frameSamples = [];
  const poses = emptyPoses();
  let poseTargets = emptyPoses();
  const poseTracks = new Map();
  const partBounds = new Map();
  model.root.updateMatrixWorld(true);
  for (const [id, group] of model.parts) partBounds.set(id, new THREE.Box3().setFromObject(group));
  const transmission = createTransmissionGuides();
  scene.add(transmission.root);
  let explode = 0;
  let explodeTarget = 0;
  let cutaway = true;
  let running = false;
  let airflowVisible = false;
  let autoRotate = false;
  let selected = null;
  let cameraTransition = null;
  let pointerDown = null;
  let pointerInside = false;
  let needsPicking = false;
  let hoverId = null;
  let hoverFeature = null;
  let lastPointer = { clientX: 0, clientY: 0 };
  let gestureActive = false;
  let currentPreset = 'overview';
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const scratch = new THREE.Vector3();
  const bounds = new THREE.Box3();
  const modelCenter = new THREE.Vector3();
  const anchors = {};
  const visiblePickables = [];
  const anchorRay = new THREE.Raycaster();
  const anchorDirection = new THREE.Vector3();
  const worldAnchor = new THREE.Vector3();
  const anchorOffsets = {
    fan: new THREE.Vector3(-0.8, 1.58, 0.55),
    compressor: new THREE.Vector3(-0.1, 1.15, 0.9),
    combustor: new THREE.Vector3(0.3, 1.18, 0.55),
    turbine: new THREE.Vector3(0.25, 1.1, 0.65),
    nozzle: new THREE.Vector3(0.25, 0.9, 0.65),
    accessories: new THREE.Vector3(0.1, -1, 1.4),
  };
  const defaultDirection = new THREE.Vector3(-0.7, 0.36, 1).normalize();

  function wake() {
    if (destroyed || contextLost) return;
    dirty = true;
    if (!raf && !inTick && !document.hidden) {
      idle = false;
      lastTime = 0;
      previousContinuous = false;
      raf = requestAnimationFrame(tick);
    }
  }

  function applyQuality(tier) {
    const nextRatio = Math.min(devicePixelRatio || 1, tier === 'high' ? 1.75 : 1);
    const shadowSize = tier === 'high' ? 2048 : 1024;
    if (effectiveQuality !== tier || renderer.getPixelRatio() !== nextRatio) {
      effectiveQuality = tier;
      renderer.setPixelRatio(nextRatio);
      renderer.setSize(width, height, false);
    }
    // Low quality keeps the soft baked contact shadow, avoiding another full
    // dynamic shadow pass while still making the engine sit on the stage.
    renderer.shadowMap.enabled = tier === 'high';
    if (key.shadow.mapSize.x !== shadowSize) {
      key.shadow.mapSize.set(shadowSize, shadowSize);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    renderer.shadowMap.needsUpdate = true;
    qualityChangedAt = performance.now();
    wake();
  }

  function performanceStats() {
    const sorted = [...frameSamples].sort((a, b) => a - b);
    const average = frameSamples.reduce((sum, value) => sum + value, 0) / (frameSamples.length || 1);
    return {
      fps: average ? Math.round(10000 / average) / 10 : null,
      p95FrameMs: sorted.length ? Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] * 10) / 10 : null,
      samples: frameSamples.length,
      renderedFrames: frames,
      idle,
      quality: qualityMode,
      effectiveQuality,
      pixelRatio: renderer.getPixelRatio(),
    };
  }

  function sampleFrame(milliseconds, now) {
    frameSamples.push(milliseconds);
    if (frameSamples.length > 240) frameSamples.shift();
    qualityEvaluations++;
    if (qualityMode !== 'auto' || effectiveQuality === 'low' || qualityEvaluations < 90) return;
    qualityEvaluations = 0;
    const stats = performanceStats();
    slowWindows = stats.fps < 42 && stats.p95FrameMs > 30 ? slowWindows + 1 : 0;
    // Two sustained windows and a minimum settling period avoid reacting to
    // startup compilation. Auto only downgrades until explicitly reset.
    if (slowWindows >= 2 && now - qualityChangedAt > 5000) applyQuality('low');
  }

  function setPoseTargets(targets, sequential = false) {
    let delayed = 0;
    for (const id of PART_ORDER) {
      const next = targets[id] ?? emptyPoses()[id];
      if (samePose(poseTargets[id], next)) continue;
      const previous = copyPose(poses[id]);
      const waypoints = [previous];
      const target = copyPose(next);
      // Lift compressor/turbine modules clear of the neighbouring assembled
      // core before translating axially. Reverse uses the same clearance.
      if (sequential && (id === 'compressor' || id === 'turbine')) {
        const clearance = 3.15;
        waypoints.push({ position: [previous.position[0], clearance, previous.position[2]], rotation: [...previous.rotation] });
        waypoints.push({ position: [target.position[0], clearance, target.position[2]], rotation: [...target.rotation] });
      }
      waypoints.push(target);
      poseTracks.set(id, {
        waypoints,
        start: performance.now() + (reducedMotion ? 0 : delayed),
        duration: reducedMotion ? 60 : (waypoints.length > 2 ? 1450 : 1150),
      });
      delayed += sequential ? 100 : 0;
    }
    poseTargets = Object.fromEntries(PART_ORDER.map(id => [id, copyPose(targets[id] ?? emptyPoses()[id])]));
    wake();
  }

  function updatePoses(now) {
    let changed = false;
    for (const [id, track] of poseTracks) {
      const progress = clamp((now - track.start) / track.duration, 0, 1);
      const segments = track.waypoints.length - 1;
      const segment = Math.min(segments - 1, Math.floor(progress * segments));
      const local = progress === 1 ? 1 : progress * segments - segment;
      const ease = local * local * (3 - 2 * local);
      const from = track.waypoints[segment];
      const to = track.waypoints[segment + 1];
      for (let axis = 0; axis < 3; axis++) {
        poses[id].position[axis] = THREE.MathUtils.lerp(from.position[axis], to.position[axis], ease);
        poses[id].rotation[axis] = THREE.MathUtils.lerp(from.rotation[axis], to.rotation[axis], ease);
      }
      changed = true;
      if (progress === 1) poseTracks.delete(id);
    }
    if (changed) {
      model.applyPartPoses(poses);
      let lowest = -2.1;
      for (const [id, box] of partBounds) lowest = Math.min(lowest, box.min.y + poses[id].position[1]);
      floor.position.y = Math.min(-2.25, lowest - 0.15);
      contact.position.y = floor.position.y + 0.01;
      grid.position.y = floor.position.y - 0.02;
    }
    return changed;
  }

  function overviewDistance(amount = explodeTarget) {
    const horizontalSpan = 10.2 + amount * 7.3;
    const verticalSpan = 8.45 + amount * 0.8;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const vertical = verticalSpan / (2 * Math.tan(vFov / 2));
    const horizontal = horizontalSpan / (2 * Math.tan(vFov / 2) * camera.aspect);
    return Math.max(vertical, horizontal) * (width < 600 ? 1.08 : 1.0);
  }

  function transitionTo(position, target, duration = 1000) {
    controls.autoRotate = false;
    cameraTransition = {
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: position.clone(),
      toTarget: target.clone(),
      start: performance.now(),
      duration: reducedMotion ? 80 : duration,
    };
    wake();
  }

  function safeViewport(focusing = false) {
    const mobile = matchMedia('(max-width:760px)').matches;
    const stage = host.parentElement;
    const hostRect = host.getBoundingClientRect();
    const viewport = {
      left: mobile ? 16 : 45,
      right: width - (mobile ? 16 : 45),
      top: mobile ? Math.min(210, height * 0.35) : Math.min(180, height * 0.24),
      bottom: height - (mobile ? 115 : 80),
    };
    if (mobile && (principleStage || tourStep !== null)) {
      const heading = stage.querySelector('.stage-heading');
      if (heading) viewport.top = Math.max(105, heading.getBoundingClientRect().bottom - hostRect.top + 14);
    }
    const panel = stage.querySelector('#principle-panel:not([hidden])');
    if (panel && mobile && getComputedStyle(panel).visibility !== 'hidden') {
      viewport.bottom = Math.min(viewport.bottom, panel.getBoundingClientRect().top - hostRect.top - 14);
    }
    const detail = stage.querySelector('#part-detail:not([hidden])');
    if (focusing && detail) {
      if (mobile) viewport.bottom = Math.min(viewport.bottom, detail.getBoundingClientRect().top - hostRect.top - 14);
      else viewport.right = Math.min(viewport.right, detail.getBoundingClientRect().left - hostRect.left - 20);
    }
    if (viewport.bottom - viewport.top < 100) viewport.top = Math.max(100, viewport.bottom - 100);
    viewport.bottom = Math.max(viewport.top + 80, viewport.bottom);
    viewport.right = Math.max(viewport.left + 120, viewport.right);
    return viewport;
  }

  function targetBounds(targets = poseTargets) {
    const result = [];
    for (const [id, base] of partBounds) {
      const box = base.clone().translate(new THREE.Vector3().fromArray(targets[id].position));
      result.push(box);
    }
    return result;
  }

  function fittedView(boundsOrBoxes, direction = defaultDirection, focusing = false) {
    const rect = safeViewport(focusing);
    const boxes = Array.isArray(boundsOrBoxes) ? boundsOrBoxes : [boundsOrBoxes];
    const outward = direction.clone().normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, outward).normalize();
    const up = new THREE.Vector3().crossVectors(outward, right).normalize();
    const projected = [];
    const extents = new THREE.Box3();
    for (const box of boxes) {
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const corner = new THREE.Vector3(x, y, z);
        const point = new THREE.Vector3(corner.dot(right), corner.dot(up), corner.dot(outward));
        projected.push(point);
        extents.expandByPoint(point);
      }
    }
    const middle = extents.getCenter(new THREE.Vector3());
    const center = right.clone().multiplyScalar(middle.x).addScaledVector(up, middle.y).addScaledVector(outward, middle.z);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const xLeft = rect.left / width * 2 - 1;
    const xRight = rect.right / width * 2 - 1;
    const yBottom = 1 - rect.bottom / height * 2;
    const yTop = 1 - rect.top / height * 2;
    const midX = (xLeft + xRight) / 2;
    const midY = (yBottom + yTop) / 2;
    const halfX = (xRight - xLeft) / 2;
    const halfY = (yTop - yBottom) / 2;
    let distance = controls.minDistance;
    // Fit each real module corner under perspective. The empty diagonal
    // corners of one giant exploded bounding box no longer shrink the view.
    for (const point of projected) {
      point.sub(middle);
      distance = Math.max(distance,
        (point.x / (tangent * camera.aspect) + xRight * point.z) / halfX,
        (-point.x / (tangent * camera.aspect) - xLeft * point.z) / halfX,
        (point.y / tangent + yTop * point.z) / halfY,
        (-point.y / tangent - yBottom * point.z) / halfY,
      );
    }
    distance = clamp(distance * 1.035, controls.minDistance, 105);
    const worldHeight = 2 * distance * tangent;
    const target = center.clone()
      .addScaledVector(right, -midX * worldHeight * camera.aspect / 2)
      .addScaledVector(up, -midY * worldHeight / 2);
    return { position: target.clone().addScaledVector(outward, distance), target };
  }

  function framePoseTargets(animate = true) {
    const direction = tourStep !== null ? new THREE.Vector3(-0.32, 0.16, 1) : defaultDirection;
    const view = fittedView(targetBounds(), direction);
    if (animate) transitionTo(view.position, view.target, 1150);
    else {
      cameraTransition = null;
      camera.position.copy(view.position);
      controls.target.copy(view.target);
      controls.update();
      wake();
    }
  }

  function resetCamera(animate = true) {
    currentPreset = 'overview';
    if (tourStep !== null || explodeTarget > 0) return framePoseTargets(animate);
    if (principleStage) return focusStage(principleStage, animate);
    const target = new THREE.Vector3(-0.15, width < 600 ? 0.25 : 0.1, 0);
    const position = defaultDirection.clone().multiplyScalar(overviewDistance()).add(target);
    if (animate) transitionTo(position, target);
    else {
      cameraTransition = null;
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      wake();
    }
  }

  function resize() {
    const previousWidth = width;
    const previousHeight = height;
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    const relevantHeightChange = Math.abs(previousHeight - height) > 2
      && (principleStage || tourStep !== null);
    if (previousWidth === 1 || Math.abs(previousWidth - width) > 100 || relevantHeightChange) {
      if (model.parts.has(currentPreset) || model.features?.has(currentPreset)) focusPart(currentPreset, false);
      else if (principleStage) focusStage(principleStage, false);
      else if (tourStep !== null) framePoseTargets(false);
      else resetCamera(false);
    }
    wake();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  function isVisible(object) {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  }
  function refreshPickables() {
    visiblePickables.length = 0;
    for (const object of pickables) if (isVisible(object)) visiblePickables.push(object);
  }
  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    refreshPickables();
    const hit = raycaster.intersectObjects(visiblePickables, false)[0];
    const featureId = hit?.object.userData.featureId ?? null;
    return {
      partId: model.features?.get(featureId)?.parentPart ?? hit?.object.userData.partId ?? null,
      featureId,
    };
  }
  function handlePointerMove(event) {
    lastPointer = { clientX: event.clientX, clientY: event.clientY };
    pointerInside = true;
    if (!gestureActive && event.pointerType !== 'touch') needsPicking = true;
    wake();
  }
  function clearHover() {
    pointerInside = false;
    needsPicking = false;
    if (hoverId) {
      hoverId = null;
      hoverFeature = null;
      callbacks.onHover?.(null, lastPointer, null);
    }
    renderer.domElement.style.cursor = gestureActive ? 'grabbing' : 'grab';
    wake();
  }
  function handlePointerDown(event) {
    pointerDown = { x: event.clientX, y: event.clientY, at: performance.now(), button: event.button };
    cameraTransition = null;
    gestureActive = true;
    renderer.domElement.style.cursor = 'grabbing';
    callbacks.onHover?.(null, lastPointer, null);
    wake();
  }
  function handlePointerUp(event) {
    gestureActive = false;
    if (pointerDown && pointerDown.button === 0 &&
      Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 6 &&
      performance.now() - pointerDown.at < 600) {
      const hit = pick(event);
      if (hit.partId) callbacks.onSelect?.(hit.partId, hit.featureId);
    }
    pointerDown = null;
    renderer.domElement.style.cursor = hoverId ? 'pointer' : 'grab';
    if (pointerInside) needsPicking = true;
    wake();
  }
  const abort = new AbortController();
  const listen = (element, name, callback, options = {}) =>
    element.addEventListener(name, callback, { ...options, signal: abort.signal });
  listen(renderer.domElement, 'pointermove', handlePointerMove);
  listen(renderer.domElement, 'pointerdown', handlePointerDown);
  listen(renderer.domElement, 'pointerleave', clearHover);
  listen(window, 'pointerup', handlePointerUp);
  listen(window, 'pointercancel', () => { gestureActive = false; pointerDown = null; clearHover(); });
  listen(renderer.domElement, 'wheel', () => { cameraTransition = null; wake(); }, { passive: true });
  controls.addEventListener('change', wake);
  controls.addEventListener('start', wake);
  controls.addEventListener('end', wake);
  listen(renderer.domElement, 'webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    idle = true;
    callbacks.onContextLost?.();
  });
  renderer.domElement.style.cursor = 'grab';

  function updateAnchors() {
    refreshPickables();
    const entries = Object.entries(anchorOffsets).map(([id, offset]) => ({ id, parentPart: id, offset }));
    for (const [id, feature] of model.features ?? []) entries.push({ id, parentPart: feature.parentPart, offset: feature.anchor, featureId: id });
    for (const entry of entries) {
      const group = model.parts.get(entry.parentPart);
      worldAnchor.copy(entry.offset);
      group.localToWorld(worldAnchor);
      scratch.copy(worldAnchor).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * width;
      const y = (-scratch.y * 0.5 + 0.5) * height;
      const visible = scratch.z > -1 && scratch.z < 1 && x >= 0 && x <= width && y >= 0 && y <= height;
      let occluded = false;
      if (visible) {
        anchorDirection.copy(worldAnchor).sub(camera.position);
        const distance = anchorDirection.length();
        anchorRay.set(camera.position, anchorDirection.normalize());
        anchorRay.far = Math.max(0, distance - (entry.featureId ? 0.12 : 0.25));
        occluded = anchorRay.intersectObjects(visiblePickables, false).length > 0;
      }
      anchors[entry.id] = {
        x, y, visible, occluded,
        parentPart: entry.parentPart,
        featureId: entry.featureId ?? null,
      };
    }
    callbacks.onFrame?.({ anchors });
  }

  function tick(now) {
    raf = 0;
    if (destroyed || contextLost || document.hidden) { idle = true; return; }
    inTick = true;
    const frameMs = lastTime ? now - lastTime : 1000 / 60;
    if (previousContinuous && lastTime) sampleFrame(frameMs, now);
    const dt = Math.min(frameMs / 1000, 0.05);
    lastTime = now;
    const wasDirty = dirty;
    dirty = false;
    const poseChanged = updatePoses(now);
    if (Math.abs(explodeTarget - explode) > 0.0001) {
      explode = reducedMotion ? explodeTarget : damp(explode, explodeTarget, 4.2, dt);
      contact.scale.x = 1 + explode * 0.7;
    } else explode = explodeTarget;
    const rotorsMoving = model.update(dt);
    if (airflowVisible && running) airflow.update(dt);
    if (transmission.root.visible && running) transmission.update(dt);
    const cameraMoving = Boolean(cameraTransition);
    if (cameraTransition) {
      const t = clamp((now - cameraTransition.start) / cameraTransition.duration, 0, 1);
      const ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.toPosition, ease);
      controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.toTarget, ease);
      if (t === 1) cameraTransition = null;
    }
    controls.autoRotate = autoRotate && !cameraTransition && !gestureActive;
    const controlsMoving = controls.update(dt);
    model.root.updateMatrixWorld();
    if (needsPicking && pointerInside && !gestureActive) {
      needsPicking = false;
      const hit = pick(lastPointer);
      hoverId = hit.partId;
      hoverFeature = hit.featureId;
      renderer.domElement.style.cursor = hoverId ? 'pointer' : 'grab';
      callbacks.onHover?.(hoverId, lastPointer, hoverFeature);
    }
    const active = poseTracks.size > 0 || Boolean(cameraTransition) || rotorsMoving || controlsMoving
      || autoRotate || (airflowVisible && running) || Math.abs(explodeTarget - explode) > 0.0001;
    if (wasDirty || dirty || poseChanged || cameraMoving || rotorsMoving || controlsMoving || active) {
      renderer.render(scene, camera);
      frames++;
    }
    dirty = false;
    if (now - lastAnchorTime > 150 || !active) {
      updateAnchors();
      lastAnchorTime = now;
    }
    inTick = false;
    previousContinuous = active;
    if (active || dirty) {
      idle = false;
      raf = requestAnimationFrame(tick);
    } else {
      idle = true;
      lastTime = 0;
      dirty = false;
    }
  }
  listen(document, 'visibilitychange', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
    previousContinuous = false;
    idle = true;
    if (!document.hidden) wake();
  });
  applyQuality(width < 760 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ? 'low' : 'high');
  wake();

  function focusStage(id, animate = true) {
    const partId = STAGE_PARTS[id];
    if (!partId) return;
    currentPreset = `principle:${id}`;
    const box = partBounds.get(partId).clone();
    if (id === 'exhaust') box.union(partBounds.get('nozzle'));
    box.expandByScalar(0.18);
    const direction = id === 'intake' ? defaultDirection : new THREE.Vector3(-0.35, 0.27, 1);
    const view = fittedView(box, direction);
    if (animate) transitionTo(view.position, view.target, 1000);
    else {
      cameraTransition = null;
      camera.position.copy(view.position);
      controls.target.copy(view.target);
      controls.update();
      wake();
    }
  }

  function focusPart(id, animate = true) {
    const feature = model.features?.get(id);
    const group = model.parts.get(feature?.parentPart ?? id);
    if (!group) return;
    currentPreset = id;
    if (feature) {
      group.localToWorld(modelCenter.copy(feature.anchor));
      const radius = id === 'fan-blade' ? 1.45 : id === 'drive-shafts' ? 1.6 : 0.8;
      bounds.setFromCenterAndSize(modelCenter, new THREE.Vector3(radius * 2, radius * 2, radius * 2));
    } else bounds.setFromObject(group);
    const view = fittedView(bounds, defaultDirection, true);
    if (animate) transitionTo(view.position, view.target, 1100);
    else {
      cameraTransition = null;
      camera.position.copy(view.position);
      controls.target.copy(view.target);
      controls.update();
      wake();
    }
  }

  return {
    setExplode(amount) {
      tourStep = null;
      explodeTarget = clamp(Number(amount) || 0, 0, 1);
      setPoseTargets(model.getDefaultExplodePoses(explodeTarget));
      resetCamera();
    },
    setTourStep(index) {
      tourStep = clamp(Math.round(Number(index) || 0), 0, 6);
      explodeTarget = TOUR_AMOUNTS[tourStep];
      const targets = emptyPoses();
      PART_ORDER.forEach((id, i) => {
        if (i < tourStep) targets[id].position = [...TOUR_OFFSETS[i]];
      });
      setPoseTargets(targets, true);
      currentPreset = `tour:${tourStep}`;
      framePoseTargets();
    },
    setPrincipleStage(id) {
      principleStage = Object.hasOwn(STAGE_PARTS, id) ? id : null;
      airflow.setStage(principleStage);
      transmission.setStage(principleStage);
      if (principleStage) focusStage(principleStage);
      wake();
    },
    captureView() {
      return {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        preset: currentPreset,
        autoRotate,
      };
    },
    restoreView(snapshot) {
      if (!snapshot?.position?.every(Number.isFinite) || !snapshot?.target?.every(Number.isFinite)
        || snapshot.position.length !== 3 || snapshot.target.length !== 3) return;
      currentPreset = snapshot.preset ?? 'overview';
      autoRotate = Boolean(snapshot.autoRotate);
      transitionTo(new THREE.Vector3().fromArray(snapshot.position), new THREE.Vector3().fromArray(snapshot.target), 900);
    },
    setQuality(value) {
      if (!['auto', 'high', 'low'].includes(value)) return effectiveQuality;
      qualityMode = value;
      slowWindows = 0;
      qualityEvaluations = 0;
      applyQuality(value === 'auto'
        ? (width < 760 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ? 'low' : 'high')
        : value);
      return effectiveQuality;
    },
    setCutaway(enabled) {
      cutaway = Boolean(enabled);
      model.setCutaway(cutaway);
      needsPicking = pointerInside;
      wake();
    },
    setRunning(enabled) {
      running = Boolean(enabled);
      model.setRunning(running);
      wake();
    },
    setAirflow(enabled) {
      airflowVisible = Boolean(enabled);
      airflow.root.visible = airflowVisible;
      transmission.root.visible = airflowVisible && Boolean(principleStage);
      wake();
    },
    setAutoRotate(enabled) {
      autoRotate = Boolean(enabled);
      wake();
    },
    resetCamera() {
      resetCamera(true);
    },
    setCameraPreset(preset) {
      if (tourStep !== null) return framePoseTargets();
      if (preset === 'overview') return resetCamera();
      currentPreset = preset;
      const targets = {
        front: new THREE.Vector3(-2.2 - explodeTarget * 2, 0.25, 0),
        core: new THREE.Vector3(0.3, 0.25, 0),
        rear: new THREE.Vector3(2.2 + explodeTarget * 2, 0.25, 0),
      };
      const directions = {
        front: new THREE.Vector3(-1.4, 0.35, 1.2),
        core: new THREE.Vector3(-0.2, 0.45, 1.4),
        rear: new THREE.Vector3(0.8, 0.4, 1.5),
      };
      const target = targets[preset] ?? targets.core;
      const distance = overviewDistance() * (width < 600 ? 1 : 0.9);
      const position = (directions[preset] ?? directions.core).clone().normalize().multiplyScalar(distance).add(target);
      transitionTo(position, target, 1250);
    },
    focusPart,
    zoom(factor) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      const target = controls.target.clone();
      const direction = camera.position.clone().sub(target);
      const distance = clamp(direction.length() * factor, controls.minDistance, controls.maxDistance);
      transitionTo(direction.normalize().multiplyScalar(distance).add(target), target, 350);
    },
    setHighlight(id) {
      if (selected === id) return;
      selected = id;
      for (const [partId, list] of highlightMaterials) {
        for (const material of list) {
          material.emissive.set(partId === id ? 0x9bbb7e : 0x000000);
          material.emissiveIntensity = partId === id ? 0.13 : 0;
        }
      }
      wake();
    },
    getDiagnostics() {
      return {
        renderer: {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        },
        camera: { position: camera.position.toArray(), target: controls.target.toArray() },
        parts: model.parts.size,
        meshCount: pickables.length,
        explode,
        cutaway,
        running,
        airflow: airflowVisible,
        autoRotate,
        frames,
        tourStep,
        principleStage,
        partPoses: Object.fromEntries(PART_ORDER.map(id => [id, {
          ...copyPose(poses[id]),
          targetPosition: [...poseTargets[id].position],
          targetRotation: [...poseTargets[id].rotation],
          target: copyPose(poseTargets[id]),
        }])),
        poseTargets: Object.fromEntries(PART_ORDER.map(id => [id, copyPose(poseTargets[id])])),
        features: [...(model.features?.keys() ?? [])],
        motion: model.getMotionState?.() ?? null,
        performance: performanceStats(),
        webgl2: renderer.capabilities.isWebGL2,
        pixelRatio: renderer.getPixelRatio(),
      };
    },
    dispose() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      abort.abort();
      observer.disconnect();
      controls.removeEventListener('change', wake);
      controls.removeEventListener('start', wake);
      controls.removeEventListener('end', wake);
      controls.dispose();
      airflow.dispose();
      transmission.dispose();
      highlightMaterials.forEach(list => list.forEach(material => material.dispose()));
      model.dispose();
      owned.forEach(resource => resource.dispose());
      key.shadow.map?.dispose();
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function makeContactTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 18, 128, 128, 125);
  gradient.addColorStop(0, 'rgba(0,5,2,0.8)');
  gradient.addColorStop(0.45, 'rgba(0,5,2,0.5)');
  gradient.addColorStop(1, 'rgba(0,5,2,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createStudioEnvironment(renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x454e4e);
  const materials = [];
  const geometries = [];
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(22, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x485252, side: THREE.BackSide }),
  );
  room.add(sphere);
  materials.push(sphere.material);
  geometries.push(sphere.geometry);
  function panel(width, height, position, color, intensity = 1) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
    geometries.push(geometry);
    materials.push(material);
  }
  panel(18, 8, [-4, 10, 4], 0xf5f1e8, 3.4);
  panel(8, 12, [-11, 1, 1], 0xcddde3, 2.3);
  panel(18, 3, [3, 4, -12], 0xc7dce7, 3.2);
  panel(5, 11, [11, 1, 6], 0xe4d4c1, 1.5);
  panel(13, 2, [0, -6, 9], 0xa2b5a8, 0.8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.055, 0.1, 100);
  pmrem.dispose();
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  return target;
}

function createAirflow() {
  const root = new THREE.Group();
  root.visible = false;
  root.name = 'Animated core and bypass airflow';
  const resources = [];
  const paths = [];
  const cool = new THREE.Color('#8dcbd3');
  const warm = new THREE.Color('#ffac6e');
  const point = new THREE.Vector3();
  const stageRanges = { intake: [-6, -2.7], compression: [-2.7, 0.5], combustion: [0.5, 1.8], exhaust: [1.8, 6.8] };
  let stage = null;
  function corePoint(t, angle, target = point) {
    const x = -6 + t * 12.8;
    let radius = 0.91;
    if (x < -3.1) radius = 0.91 + Math.min(1, (-3.1 - x) / 2.9) * 0.3;
    else if (x > 1.5 && x < 4.3) radius = 0.91 - (x - 1.5) / 2.8 * 0.29;
    else if (x >= 4.3) radius = 0.62 + (x - 4.3) * 0.13;
    return target.set(x, radius * Math.cos(angle), radius * Math.sin(angle));
  }
  function bypassPoint(t, angle, target = point) {
    const x = -6 + t * 12.8;
    const radius = x < -3.7 ? 1.6 : (x > 3.7 ? 1.72 : 1.9 + 0.2 * Math.sin((x + 3.7) / 7.4 * Math.PI));
    return target.set(x, radius * Math.cos(angle), radius * Math.sin(angle));
  }
  function strengthAt(x, bypass) {
    if (!stage) return 1;
    if (bypass && stage !== 'intake') return 0.13;
    const range = stageRanges[stage];
    return x >= range[0] && x <= range[1] ? 1.6 : 0.18;
  }
  function writeColor(array, offset, x, bypass) {
    const blend = bypass ? 0 : clamp((x + 0.5) / 2, 0, 1);
    const strength = strengthAt(x, bypass);
    array[offset] = (cool.r + (warm.r - cool.r) * blend) * strength;
    array[offset + 1] = (cool.g + (warm.g - cool.g) * blend) * strength;
    array[offset + 2] = (cool.b + (warm.b - cool.b) * blend) * strength;
  }
  for (let i = 0; i < 12; i++) {
    const bypass = i >= 6;
    const angle = (i % 6) / 6 * TAU + 0.25;
    const fn = bypass ? bypassPoint : corePoint;
    const points = Array.from({ length: 80 }, (_, j) => fn(j / 79, angle, new THREE.Vector3()));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const colors = [];
    for (let j = 0; j < points.length; j++) {
      const color = bypass ? cool : cool.clone().lerp(warm, clamp((points[j].x + 0.5) / 2, 0, 1));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.14, depthWrite: false,
      blending: THREE.AdditiveBlending, depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 4;
    root.add(line);
    resources.push(geometry, material);
    paths.push({ fn, angle, bypass, geometry, material });
  }
  const count = 312;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.PointsMaterial({
    size: 0.055, transparent: true, opacity: 0.85, vertexColors: true,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const particles = new THREE.Points(geometry, material);
  particles.renderOrder = 5;
  root.add(particles);
  resources.push(geometry, material);
  let phase = 0;
  function update(dt) {
    phase += dt * 0.145;
    for (let i = 0; i < count; i++) {
      const path = paths[i % paths.length];
      const t = ((Math.floor(i / paths.length) / 26) + phase * (path.bypass ? 1 : 1.35)) % 1;
      path.fn(t, path.angle, point);
      const offset = i * 3;
      positions[offset] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
      writeColor(colors, offset, point.x, path.bypass);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }
  update(0);
  return {
    root, update,
    setStage(id) {
      stage = stageRanges[id] ? id : null;
      for (const path of paths) {
        const positions = path.geometry.attributes.position.array;
        const colors = path.geometry.attributes.color.array;
        for (let i = 0; i < positions.length; i += 3) writeColor(colors, i, positions[i], path.bypass);
        path.geometry.attributes.color.needsUpdate = true;
        path.material.opacity = stage ? 0.24 : 0.14;
      }
      update(0);
    },
    dispose() { resources.forEach(resource => resource.dispose()); root.removeFromParent(); },
  };
}

function createTransmissionGuides() {
  const root = new THREE.Group();
  root.name = 'Educational low- and high-pressure shaft power paths';
  root.visible = false;
  const resources = [];
  const channels = [];
  const definitions = [
    { id: 'low', front: -3.75, rear: 3.15, y: -0.28, z: 0.28, color: '#76d9d4', label: '低压轴 → 风扇' },
    { id: 'high', front: -1.6, rear: 2.4, y: 0.28, z: 0.28, color: '#cab0ef', label: '高压轴 → 压气机' },
  ];
  for (const definition of definitions) {
    const points = [
      new THREE.Vector3(definition.front, definition.y, definition.z),
      new THREE.Vector3(definition.rear, definition.y, definition.z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: definition.color, transparent: true, opacity: 0.8,
      depthTest: false, depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 6;
    root.add(line);
    resources.push(geometry, material);
    const arrowGeometry = new THREE.ConeGeometry(0.065, 0.2, 8);
    arrowGeometry.rotateZ(Math.PI / 2);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: definition.color, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false,
    });
    const arrows = [];
    for (let i = 0; i < 4; i++) {
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.position.set(THREE.MathUtils.lerp(definition.rear, definition.front, i / 4), definition.y, definition.z);
      arrow.renderOrder = 7;
      root.add(arrow);
      arrows.push(arrow);
    }
    resources.push(arrowGeometry, arrowMaterial);
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(16,25,24,.85)';
    context.fillRect(0, 0, 320, 64);
    context.fillStyle = definition.color;
    context.font = '24px "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(definition.label, 160, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const labelMaterial = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false, depthWrite: false,
    });
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(definition.id === 'low' ? -2.35 : 0.1, definition.y + (definition.id === 'low' ? -0.65 : 0.65), 0.5);
    label.scale.set(1.55, 0.31, 1);
    label.renderOrder = 8;
    root.add(label);
    resources.push(texture, labelMaterial);
    channels.push({ ...definition, material, arrowMaterial, arrows, label });
  }
  let phase = 0;
  return {
    root,
    setStage(stage) {
      root.visible = Boolean(stage);
      for (const channel of channels) {
        const emphasized = stage === 'exhaust' || (stage === 'intake' && channel.id === 'low')
          || (stage === 'compression' && channel.id === 'high');
        channel.material.opacity = emphasized ? 0.9 : 0.2;
        channel.arrowMaterial.opacity = emphasized ? 0.95 : 0.2;
        channel.label.visible = emphasized;
      }
    },
    update(dt) {
      phase = (phase + dt * 0.3) % 1;
      for (const channel of channels) for (let i = 0; i < channel.arrows.length; i++) {
        const t = (i / channel.arrows.length + phase) % 1;
        channel.arrows[i].position.x = THREE.MathUtils.lerp(channel.rear, channel.front, t);
      }
    },
    dispose() {
      resources.forEach(resource => resource.dispose());
      root.removeFromParent();
    },
  };
}
