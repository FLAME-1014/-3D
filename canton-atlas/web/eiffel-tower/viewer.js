import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEiffelTower } from './model.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const stage = $('#stage');
const canvas = $('#scene');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  mode: 'explore', night: false, wireframe: false, autoRotate: false,
  progress: 100, playing: false, selectedFloor: null, currentView: 'overview',
};
const floorContent = {
  first: {
    kicker: 'THE FIRST FLOOR · 57 M', title: 'Above the great arches.', height: 57,
    text: 'A broad gallery rests above four sweeping arches. Look closely at the open central court, glass pavilions, and the diagonal lift rails that climb through the legs.',
    radius: 102, target: [0, 50, 0], direction: [1, 0.38, 1.5],
  },
  second: {
    kicker: 'THE SECOND FLOOR · 115 M', title: 'Four legs. One tower.', height: 115,
    text: 'The four independent supports draw together beneath the second gallery. Above this double deck, the structure becomes a single tapering lattice, carrying the tower toward the sky.',
    radius: 78, target: [0, 116, 0], direction: [1, 0.34, 1.45],
  },
  summit: {
    kicker: 'THE SUMMIT · 276 M', title: 'Paris, from another angle.', height: 276,
    text: 'The slender lattice opens into two small summit galleries. An enclosed lookout, delicate railings, and a braced antenna crown the tower’s unmistakable silhouette.',
    radius: 58, target: [0, 284, 0], direction: [1, 0.28, 1.5],
  },
};
const chapterNames = ['The foundations', 'The great arches', 'The first gallery', 'The second gallery', 'The rising lattice', 'The summit & antenna'];
const revealHeights = [-2.4, 1.7, 57.0, 64.0, 123.0, 275.0, 331.0];
const ownedGeometries = new Set();
const ownedMaterials = new Set();
const towerMaterials = new Set();
const markerPoint = new THREE.Vector3();
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 331);
const bounds = new THREE.Box3();
let scene, renderer, camera, controls, tower, hemisphere, keyLight, fillLight, plaza, groundRing;
let ready = false, sceneError = null, frameRequest = null, lastTime = 0, wakeUntil = 0;
let cameraTween = null, resizeObserver = null, toastTimer = null, hiddenPlaying = false;
let snapshotBusy = false;
const modelStats = { meshes: 0, instances: 0, height: 330, bounds: null };

function announce(message) { $('#announcement').textContent = message; }
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2400);
  announce(message);
}
function ownGeometry(geometry) { ownedGeometries.add(geometry); return geometry; }
function ownMaterial(material) { ownedMaterials.add(material); return material; }
function setPressed(selector, value) { $(selector).setAttribute('aria-pressed', String(value)); }

function showError(error) {
  sceneError = error instanceof Error ? error.message : String(error);
  ready = false;
  stage.dataset.ready = 'false';
  stage.dataset.error = sceneError;
  stage.setAttribute('aria-busy', 'false');
  $('#loading').hidden = true;
  $('#error').hidden = false;
  $$('.scene-tools button,.view-tabs button,.floor-list button,.mode-switch button').forEach(button => { button.disabled = true; });
  announce('The interactive view is unavailable. Download the model to explore it in a 3D application.');
}

function makePlaza() {
  plaza = new THREE.Group();
  plaza.name = 'Architectural display base';
  const plinthMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: '#d9d7c6', roughness: 0.96 }));
  const pavingMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: '#e6dfca', roughness: 0.9 }));
  const planterMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: '#9fa487', roughness: 1 }));
  const base = new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(88, 88, 2, 100)), plinthMaterial);
  base.position.y = -3.35;
  base.receiveShadow = true;
  plaza.add(base);
  const center = new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(72, 72, 0.06, 64)), pavingMaterial);
  center.position.y = -2.32;
  center.receiveShadow = true;
  plaza.add(center);
  const patchGeometry = ownGeometry(new THREE.BoxGeometry(19, 0.15, 28));
  for (const sign of [-1, 1]) {
    for (const direction of [0, 1]) {
      const patch = new THREE.Mesh(patchGeometry, planterMaterial);
      patch.position.set(direction ? sign * 76 : 0, -2.22, direction ? 0 : sign * 76);
      if (!direction) patch.rotation.y = Math.PI / 2;
      patch.receiveShadow = true;
      plaza.add(patch);
    }
  }
  const ringMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: '#c0c7af', transparent: true, opacity: 0.47, depthWrite: false }));
  const ringPoints = [];
  for (let i = 0; i <= 144; i++) {
    const angle = i / 144 * Math.PI * 2;
    ringPoints.push(new THREE.Vector3(Math.cos(angle) * 106, -3.4, Math.sin(angle) * 106));
  }
  groundRing = new THREE.Line(ownGeometry(new THREE.BufferGeometry().setFromPoints(ringPoints)), ringMaterial);
  groundRing.name = 'Display reference circle';
  // A faint studio floor catches shadows beneath the circular maquette base.
  const floor = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(1500, 1500)), ownMaterial(new THREE.ShadowMaterial({ opacity: 0.095 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.4;
  floor.receiveShadow = true;
  scene.add(floor, plaza, groundRing);
}

function overviewHeight() {
  const height = Math.max(1, stage.clientHeight);
  const aspect = stage.clientWidth / height;
  // Frame the whole maquette between the camera tabs and the floating tools.
  // Reserving the same usable space at every size keeps both antenna and feet visible.
  return Math.max(400, 340 * height / Math.max(260, height - 260), 190 / aspect);
}

function resize() {
  if (!renderer || !camera || snapshotBusy) return;
  const width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight);
  const aspect = width / height;
  const vertical = overviewHeight();
  camera.left = -vertical * aspect / 2;
  camera.right = vertical * aspect / 2;
  camera.top = vertical / 2;
  camera.bottom = -vertical / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  wake(400);
}

function presetCamera(name) {
  const height = overviewHeight();
  const views = {
    overview: { target: [0, 153, 0], direction: [0.58, 0.08, 1], zoom: 1 },
    front: { target: [0, 157, 0], direction: [0, 0.025, 1], zoom: 1 },
    top: { target: [0, 83, 0], direction: [0.18, 1, 0.2], zoom: height / 325 },
    detail: { target: [0, 182, 0], direction: [0.5, 0.045, 1], zoom: height / 112 },
  };
  return views[name] || views.overview;
}

function moveCamera({ target, direction, zoom }, immediate = false) {
  if (!controls) return;
  const targetPosition = new THREE.Vector3(...target);
  const offset = new THREE.Vector3(...direction).normalize().multiplyScalar(640);
  const destination = targetPosition.clone().add(offset);
  // Clear pending orbit inertia so a preset always lands on its intended view.
  const previousDamping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = previousDamping;
  if (immediate || reducedMotion.matches) {
    cameraTween = null;
    camera.position.copy(destination);
    controls.target.copy(targetPosition);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    controls.update();
  } else {
    cameraTween = {
      started: performance.now(), duration: 850,
      fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), fromZoom: camera.zoom,
      toPosition: destination, toTarget: targetPosition, toZoom: zoom,
    };
  }
  wake(1000);
}

function markView(name) {
  state.currentView = name;
  $$('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
}

function setAutoRotate(enabled) {
  state.autoRotate = Boolean(enabled);
  if (controls) controls.autoRotate = state.autoRotate;
  setPressed('#auto-rotate', state.autoRotate);
  wake(500);
}

function closeDetail({ returnToOverview = true } = {}) {
  state.selectedFloor = null;
  $('#detail-card').hidden = true;
  $$('[data-floor]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  if (returnToOverview) applyView('overview');
  wake(300);
}

function applyView(name, immediate = false) {
  if (!ready) return;
  setAutoRotate(false);
  closeDetail({ returnToOverview: false });
  markView(name);
  moveCamera(presetCamera(name), immediate);
  $('#scene-caption').textContent = { overview: 'THE COMPLETE TOWER', front: 'THE SOUTH ELEVATION', top: 'STRUCTURE FROM ABOVE', detail: 'THE RISING LATTICE' }[name] || 'THE COMPLETE TOWER';
  announce({ overview: 'Full tower perspective', front: 'Front elevation', top: 'View from above', detail: 'Close view of the iron lattice' }[name]);
}

function focusFloor(name) {
  if (!ready || !floorContent[name]) return;
  if (state.mode !== 'explore') setMode('explore');
  setAutoRotate(false);
  const content = floorContent[name];
  state.selectedFloor = name;
  markView('floor');
  $('#detail-kicker').textContent = content.kicker;
  $('#detail-title').textContent = content.title;
  $('#detail-text').textContent = content.text;
  $('#detail-height').textContent = `${content.height} m above the ground`;
  $('#detail-card').hidden = false;
  $$('[data-floor]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.floor === name)));
  $('#scene-caption').textContent = content.kicker;
  moveCamera({ target: content.target, direction: content.direction, zoom: overviewHeight() / content.radius });
  announce(content.kicker);
}

function updateNight() {
  if (!ready) return;
  tower.setNight(state.night);
  document.body.classList.toggle('night', state.night);
  setPressed('#night-mode', state.night);
  $('#night-mode use').setAttribute('href', state.night ? '#i-sun' : '#i-moon');
  $('#night-mode').title = state.night ? 'Return to daylight' : 'Paris after dark';
  hemisphere.intensity = state.night ? 0.72 : 2.3;
  hemisphere.color.set(state.night ? '#a8cbdd' : '#fffcf0');
  hemisphere.groundColor.set(state.night ? '#746747' : '#a7a685');
  keyLight.intensity = state.night ? 2.3 : 3.1;
  keyLight.color.set(state.night ? '#ffd391' : '#fff0d3');
  fillLight.intensity = state.night ? 0.65 : 0.8;
  fillLight.color.set(state.night ? '#88acbb' : '#dae4d5');
  plaza.children[0].material.color.set(state.night ? '#5b6356' : '#d9d7c6');
  plaza.children[1].material.color.set(state.night ? '#6c6c56' : '#e6dfca');
  groundRing.material.color.set(state.night ? '#7d9385' : '#c0c7af');
  groundRing.material.opacity = state.night ? 0.26 : 0.47;
  renderer.toneMappingExposure = state.night ? 1.2 : 1.12;
  wake(500);
}

function setWireframe(enabled) {
  state.wireframe = Boolean(enabled);
  towerMaterials.forEach(material => {
    if (material.isMeshStandardMaterial) material.wireframe = state.wireframe;
  });
  setPressed('#wireframe', state.wireframe);
  wake(350);
}

function setProgress(value) {
  state.progress = THREE.MathUtils.clamp(Number(value) || 0, 0, 100);
  const progress = state.progress / 100;
  const scaled = progress * tower.stages.length;
  const chapter = Math.min(5, Math.floor(scaled));
  // Reveal the real geometry with a horizontal section; its proportions stay fixed.
  tower.setStage(progress >= 1 ? 5 : Math.ceil(scaled) - 1);
  const heightIndex = Math.min(5, Math.floor(scaled));
  clipPlane.constant = THREE.MathUtils.lerp(revealHeights[heightIndex], revealHeights[heightIndex + 1], progress === 1 ? 1 : scaled - heightIndex);
  $('#build-progress').value = String(Math.round(state.progress));
  $('#build-progress').style.setProperty('--progress', `${state.progress}%`);
  $('#build-percent').textContent = `${Math.round(state.progress)}%`;
  $('#build-step').textContent = String(chapter + 1).padStart(2, '0');
  $('#build-title').textContent = progress >= 1 ? 'A Parisian icon, complete.' : chapterNames[chapter];
  $('#scene-caption').textContent = progress >= 1 ? 'THE COMPLETE TOWER' : chapterNames[chapter].toUpperCase();
  if (state.mode === 'build') {
    towerMaterials.forEach(material => { material.clippingPlanes = [clipPlane]; });
  }
  wake(350);
}

function setBuildPlaying(enabled) {
  state.playing = Boolean(enabled);
  setPressed('#build-play', state.playing);
  $('#build-play').setAttribute('aria-label', state.playing ? 'Pause construction animation' : 'Play construction animation');
  $('#build-play use').setAttribute('href', state.playing ? '#i-pause' : '#i-play');
  wake(350);
}

function setMode(mode) {
  if (!ready) return;
  state.mode = mode === 'build' ? 'build' : 'explore';
  setBuildPlaying(false);
  closeDetail({ returnToOverview: false });
  $$('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  const isBuild = state.mode === 'build';
  $('#floor-list').hidden = isBuild;
  $('#build-story').hidden = !isBuild;
  $('#build-controls').hidden = !isBuild;
  towerMaterials.forEach(material => { material.clippingPlanes = isBuild ? [clipPlane] : []; });
  applyView('overview');
  if (isBuild) {
    setProgress(0);
    announce('Construction study. Press play or move the progress slider.');
  } else {
    state.progress = 100;
    tower.setStage(5);
    announce('Explore the complete Eiffel Tower.');
  }
  wake(400);
}

function zoom(factor) {
  if (!ready) return;
  cameraTween = null;
  camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
  camera.updateProjectionMatrix();
  controls.update();
  wake(500);
}

function updateMarkers() {
  if (!ready || snapshotBusy) return;
  const width = stage.clientWidth, height = stage.clientHeight;
  const visible = state.mode === 'explore' && !state.selectedFloor && ['overview', 'front'].includes(state.currentView) && camera.zoom < 1.6;
  $('#floor-markers').hidden = !visible;
  if (!visible) return;
  const anchors = { first: [35, 59, 12], second: [26, 119, 5], summit: [10, 279, 1] };
  $$('.floor-marker').forEach(marker => {
    markerPoint.set(...anchors[marker.dataset.floor]).project(camera);
    const x = (markerPoint.x * 0.5 + 0.5) * width;
    const y = (-markerPoint.y * 0.5 + 0.5) * height;
    const outside = markerPoint.z < -1 || markerPoint.z > 1 || y < 96 || y > height - 155;
    const labelWidth = width < 520 ? 94 : 120;
    marker.style.left = `${THREE.MathUtils.clamp(x + 14, width * 0.54, width - labelWidth - 15)}px`;
    marker.style.top = `${y}px`;
    marker.style.opacity = outside ? '0' : '1';
    marker.style.pointerEvents = outside ? 'none' : 'auto';
    marker.tabIndex = outside ? -1 : 0;
  });
}

function wake(duration = 500) {
  wakeUntil = Math.max(wakeUntil, performance.now() + duration);
  if (ready && !document.hidden && frameRequest === null) frameRequest = requestAnimationFrame(renderFrame);
}

function renderFrame(now) {
  frameRequest = null;
  if (!ready || document.hidden || snapshotBusy) return;
  const delta = Math.min(0.06, lastTime ? (now - lastTime) / 1000 : 0);
  lastTime = now;
  if (cameraTween) {
    const linear = Math.min(1, (now - cameraTween.started) / cameraTween.duration);
    const t = linear < 0.5 ? 4 * linear ** 3 : 1 - (-2 * linear + 2) ** 3 / 2;
    camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, t);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, t);
    camera.zoom = THREE.MathUtils.lerp(cameraTween.fromZoom, cameraTween.toZoom, t);
    camera.updateProjectionMatrix();
    if (linear >= 1) cameraTween = null;
  }
  if (state.playing && state.mode === 'build') {
    setProgress(state.progress + delta * (100 / 24));
    if (state.progress >= 100) { setBuildPlaying(false); announce('The Eiffel Tower is complete.'); }
  }
  controls.update(delta);
  renderer.render(scene, camera);
  updateMarkers();
  if (frameRequest === null && (cameraTween || state.playing || state.autoRotate || now < wakeUntil)) frameRequest = requestAnimationFrame(renderFrame);
}

async function saveSnapshot() {
  if (!ready || snapshotBusy) return;
  snapshotBusy = true;
  $('#snapshot').disabled = true;
  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalRatio = renderer.getPixelRatio();
  const originalFrustum = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
  let objectUrl;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(1600, 1600, false);
    const vertical = (camera.top - camera.bottom) / 2;
    camera.left = -vertical; camera.right = vertical;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = 1600; imageCanvas.height = 1600;
    const context = imageCanvas.getContext('2d');
    context.fillStyle = state.night ? '#1f2e36' : '#eae7de';
    context.fillRect(0, 0, 1600, 1600);
    context.drawImage(canvas, 0, 0);
    context.fillStyle = state.night ? '#d8ccac' : '#616e54';
    context.font = '18px "Segoe UI", sans-serif';
    context.fillText('LANDMARK ATELIER', 68, 76);
    context.fillText('PARIS, FRANCE · 1889', 68, 1518);
    context.textAlign = 'right';
    context.font = 'italic 35px Georgia, serif';
    context.fillText('La Tour Eiffel', 1532, 1518);
    const blob = await new Promise((resolve, reject) => imageCanvas.toBlob(value => value ? resolve(value) : reject(new Error('Image export failed')), 'image/png'));
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `eiffel-tower-${state.night ? 'night' : 'day'}.png`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
    toast('Your little piece of Paris is saved.');
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    toast('The picture could not be saved. Try again.');
  } finally {
    Object.assign(camera, originalFrustum);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(originalRatio);
    renderer.setSize(originalSize.x, originalSize.y, false);
    snapshotBusy = false;
    $('#snapshot').disabled = false;
    resize();
    wake(500);
  }
}

function bindEvents() {
  const mobileLayout = matchMedia('(max-width: 700px)');
  const placeDownloads = () => {
    const files = $('#model-files');
    (mobileLayout.matches ? $('#experience') : $('.story-panel')).append(files);
  };
  placeDownloads();
  mobileLayout.addEventListener('change', placeDownloads);
  $$('[data-view]').forEach(button => button.addEventListener('click', () => applyView(button.dataset.view)));
  $$('[data-floor]').forEach(button => button.addEventListener('click', () => focusFloor(button.dataset.floor)));
  $$('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('#auto-rotate').addEventListener('click', () => { cameraTween = null; setAutoRotate(!state.autoRotate); });
  $('#night-mode').addEventListener('click', () => { state.night = !state.night; updateNight(); announce(state.night ? 'Paris after dark.' : 'Daylight view.'); });
  $('#wireframe').addEventListener('click', () => { setWireframe(!state.wireframe); announce(state.wireframe ? 'Wireframe view.' : 'Solid ironwork view.'); });
  $('#zoom-in').addEventListener('click', () => zoom(1.22));
  $('#zoom-out').addEventListener('click', () => zoom(1 / 1.22));
  $('#close-detail').addEventListener('click', () => closeDetail());
  $('#detail-overview').addEventListener('click', () => closeDetail());
  $('#snapshot').addEventListener('click', saveSnapshot);
  $('#retry').addEventListener('click', () => location.reload());
  $('#build-progress').addEventListener('input', event => { setBuildPlaying(false); setProgress(event.target.value); });
  $('#build-play').addEventListener('click', () => {
    if (state.progress >= 100) setProgress(0);
    setBuildPlaying(!state.playing);
  });
  $('#build-reset').addEventListener('click', () => { setBuildPlaying(false); setProgress(0); });
  canvas.addEventListener('pointerdown', () => { cameraTween = null; setAutoRotate(false); canvas.focus({ preventScroll: true }); wake(800); });
  canvas.addEventListener('wheel', () => { cameraTween = null; wake(800); }, { passive: true });
  canvas.addEventListener('keydown', event => {
    if (!ready) return;
    const key = event.key.toLowerCase();
    if (['+', '=', '-', 'r', '0', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'n', 'w', ' '].includes(key)) event.preventDefault();
    if (key === '+' || key === '=') zoom(1.18);
    else if (key === '-') zoom(1 / 1.18);
    else if (key === 'r' || key === '0') applyView('overview');
    else if (key === 'n') $('#night-mode').click();
    else if (key === 'w') $('#wireframe').click();
    else if (key === ' ' && state.mode === 'build') $('#build-play').click();
    else if (key.startsWith('arrow')) {
      cameraTween = null;
      setAutoRotate(false);
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      const increment = 0.075;
      if (key === 'arrowleft') spherical.theta -= increment;
      if (key === 'arrowright') spherical.theta += increment;
      if (key === 'arrowup') spherical.phi -= increment;
      if (key === 'arrowdown') spherical.phi += increment;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI / 2 + 0.1);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      controls.update(); wake(450);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.selectedFloor) { closeDetail(); canvas.focus({ preventScroll: true }); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenPlaying = state.playing;
      setBuildPlaying(false);
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      frameRequest = null;
    } else {
      lastTime = 0;
      if (hiddenPlaying && state.mode === 'build') setBuildPlaying(true);
      hiddenPlaying = false;
      wake(500);
    }
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); showError('WebGL context was lost.'); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  window.addEventListener('pagehide', () => {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    clearTimeout(toastTimer);
    resizeObserver?.disconnect();
    controls?.dispose(); tower?.dispose();
    ownedGeometries.forEach(geometry => geometry.dispose());
    ownedMaterials.forEach(material => material.dispose());
    renderer?.dispose();
    mobileLayout.removeEventListener('change', placeDownloads);
    ready = false;
  }, { once: true });
}

window.eiffelDiagnostics = () => ({
  ready, error: sceneError, state: { ...state },
  camera: camera && controls ? { position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom } : null,
  model: { ...modelStats, stageVisibility: tower?.stages.map(group => group.visible) || [] },
  render: { calls: renderer?.info.render.calls || 0, triangles: renderer?.info.render.triangles || 0 },
});

function initialize() {
  bindEvents();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor('#000000', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-200, 200, 200, -200, 1, 2000);
    camera.position.set(320, 197, 557);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.enablePan = true; controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.9;
    controls.minZoom = 0.6; controls.maxZoom = 10;
    controls.minPolarAngle = 0.06; controls.maxPolarAngle = Math.PI / 2 + 0.12;
    controls.autoRotateSpeed = 0.4;
    controls.target.set(0, 153, 0);
    controls.addEventListener('start', () => { cameraTween = null; wake(900); });
    controls.addEventListener('change', () => wake(240));
    controls.addEventListener('end', () => wake(700));
    hemisphere = new THREE.HemisphereLight('#fffcf0', '#a7a685', 2.3);
    keyLight = new THREE.DirectionalLight('#fff0d3', 3.1);
    keyLight.position.set(-180, 370, 240);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1536, 1536);
    Object.assign(keyLight.shadow.camera, { left: -155, right: 155, top: 330, bottom: -125, near: 1, far: 850 });
    keyLight.shadow.bias = -0.00018;
    keyLight.shadow.normalBias = 0.15;
    fillLight = new THREE.DirectionalLight('#dae4d5', 0.8);
    fillLight.position.set(240, 210, -190);
    scene.add(hemisphere, keyLight, fillLight);
    tower = createEiffelTower();
    tower.root.traverse(object => {
      if (!object.isMesh) return;
      modelStats.meshes++;
      modelStats.instances += object.isInstancedMesh ? object.count : 1;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { towerMaterials.add(material); material.clipShadows = true; });
    });
    bounds.setFromObject(tower.root);
    modelStats.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
    scene.add(tower.root);
    makePlaza();
    ready = true;
    stage.dataset.ready = 'true';
    stage.setAttribute('aria-busy', 'false');
    $('#loading').hidden = true;
    resize();
    applyView('overview', true);
    updateNight();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    wake(1000);
  } catch (error) { showError(error); }
}

initialize();
