import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BACKGROUND = '#718895';
const stage = document.querySelector('#stage');
const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const error = document.querySelector('#error');
const announcement = document.querySelector('#announcement');
const snapshotButton = document.querySelector('#snapshot');
const controlsButtons = document.querySelectorAll('.toolbar button');
const viewButtons = document.querySelectorAll('[data-view]');
const rotateButton = document.querySelector('#auto-rotate');
const wireframeButton = document.querySelector('#wireframe');
const target = new THREE.Vector3(0, 3.1, 0);
const diagnostics = {
  loaded: false,
  error: null,
  meshCount: 0,
  triangles: 0,
  materials: [],
  bounds: null,
};

let renderer;
let scene;
let camera;
let controls;
let model;
let modelBounds;
let frameHeight = 20;
let currentView = 'isometric';
let animationFrame;
let lastFrameTime = 0;
let resizeObserver;
const materialSet = new Set();

function syncModelDiagnostics() {
  stage.dataset.loaded = String(diagnostics.loaded);
  stage.dataset.meshCount = String(diagnostics.meshCount);
  stage.dataset.triangles = String(diagnostics.triangles);
  stage.dataset.bounds = JSON.stringify(diagnostics.bounds);
  stage.dataset.error = diagnostics.error || '';
}

function syncCameraDiagnostics() {
  if (!camera || !controls) return;
  canvas.dataset.camera = JSON.stringify({
    type: camera.type,
    position: camera.position.toArray(),
    polarDegrees: THREE.MathUtils.radToDeg(controls.getPolarAngle()),
    azimuthDegrees: THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()),
  });
  canvas.dataset.zoom = JSON.stringify(camera.zoom);
  canvas.dataset.target = JSON.stringify(controls.target.toArray());
}

function announce(message) {
  announcement.textContent = message;
}

function setEnabled(enabled) {
  controlsButtons.forEach((button) => { button.disabled = !enabled; });
  snapshotButton.disabled = !enabled;
}

function showError(message) {
  diagnostics.error = message;
  diagnostics.loaded = false;
  syncModelDiagnostics();
  loading.hidden = true;
  error.hidden = false;
  document.querySelector('#error-detail').textContent = message;
  stage.setAttribute('aria-busy', 'false');
  setEnabled(false);
}

function markView(name) {
  currentView = name;
  viewButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  });
}

function setAutoRotate(enabled) {
  if (!controls) return;
  controls.autoRotate = enabled;
  rotateButton.setAttribute('aria-pressed', String(enabled));
}

// Compute framing from the actual exported geometry, including overhanging roofs.
function fitCamera() {
  if (!modelBounds) return;
  // Fit the actual silhouette, not the empty upper corners of a bounding cube.
  // This keeps a tall roof and a broad, low plinth visually centred together.
  const projected = new THREE.Box3();
  const point = new THREE.Vector3();
  const transform = new THREE.Matrix4();
  camera.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);
  model.traverse((object) => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position;
    transform.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(transform);
      projected.expandByPoint(point);
    }
  });
  const size = projected.getSize(new THREE.Vector3());
  const center = projected.getCenter(new THREE.Vector3());
  const shift = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(center.x);
  shift.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), center.y);
  camera.position.add(shift);
  controls.target.add(shift);
  frameHeight = Math.max(size.x, size.y) * 1.14;
  controls.update();
  resize();
}

function applyView(name) {
  if (!controls) return;
  setAutoRotate(false);
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update(0); // Clear inertia before placing a precise preset camera.
  const distance = 30;
  const directions = {
    isometric: new THREE.Vector3(0.5, Math.SQRT1_2, 0.5),
    front: new THREE.Vector3(0, 0.09, 1).normalize(),
    back: new THREE.Vector3(0, 0.09, -1).normalize(),
    top: new THREE.Vector3(0, 1, 0.012).normalize(),
  };
  const direction = directions[name] || directions.isometric;
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.zoom = 1;
  camera.up.set(0, 1, 0);
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();
  syncCameraDiagnostics();
  markView(name);
  fitCamera();
  controls.enableDamping = damping;
}

function resize() {
  if (!renderer || !camera) return;
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  const aspect = width / height;
  camera.left = -frameHeight * aspect / 2;
  camera.right = frameHeight * aspect / 2;
  camera.top = frameHeight / 2;
  camera.bottom = -frameHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function addLights() {
  scene.add(new THREE.HemisphereLight('#f1f4ff', '#9b8c78', 1.8));

  const key = new THREE.DirectionalLight('#fff3dd', 3.25);
  key.position.set(-8, 17, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
    near: 0.5,
    far: 48,
  });
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = 4;
  scene.add(key);

  const fill = new THREE.DirectionalLight('#d3e7ff', 1.05);
  fill.position.set(10, 8, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight('#fff7e8', 1.2);
  rim.position.set(2, 12, -12);
  scene.add(rim);

  // Transparent shadow receiver keeps the entire backdrop one solid colour.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ color: '#223640', opacity: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.035;
  ground.receiveShadow = true;
  ground.name = 'Preview shadow surface';
  scene.add(ground);
}

function loadModel() {
  new GLTFLoader().load(
    './temple-diorama.glb',
    (gltf) => {
      model = gltf.scene;
      scene.add(model);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        diagnostics.meshCount += 1;
        const geometry = object.geometry;
        diagnostics.triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          materialSet.add(material);
          if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        });
      });
      modelBounds = new THREE.Box3().setFromObject(model);
      modelBounds.getCenter(target);
      const min = modelBounds.min.toArray();
      const max = modelBounds.max.toArray();
      diagnostics.bounds = { min, max, size: modelBounds.getSize(new THREE.Vector3()).toArray() };
      diagnostics.materials = [...materialSet].map((material) => ({
        name: material.name,
        type: material.type,
        color: material.color ? `#${material.color.getHexString()}` : null,
        metalness: material.metalness ?? null,
        roughness: material.roughness ?? null,
      }));
      diagnostics.loaded = true;
      syncModelDiagnostics();
      applyView('isometric');
      loading.hidden = true;
      stage.setAttribute('aria-busy', 'false');
      setEnabled(true);
      announce('模型已准备好。拖拽旋转，滚轮或双指缩放。');
    },
    (progress) => {
      if (progress.total > 0) {
        const percent = Math.round(progress.loaded / progress.total * 100);
        document.querySelector('#loading-text').textContent = `正在展开微缩世界 · ${percent}%`;
      }
    },
    (loadError) => {
      console.error('Temple model failed to load:', loadError);
      showError(location.protocol === 'file:'
        ? '请通过项目的本地预览地址打开本页，再加载模型。'
        : '模型文件未能载入，请检查本地服务与模型文件，然后重新加载。');
    },
  );
}

function renderFrame(time) {
  animationFrame = requestAnimationFrame(renderFrame);
  const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.1) : 0;
  lastFrameTime = time;
  controls.update(delta);
  renderer.render(scene, camera);
}

function initialize() {
  setEnabled(false);
  syncModelDiagnostics();
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 150);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.75;
    controls.minZoom = 0.6;
    controls.maxZoom = 3.5;
    controls.minPolarAngle = 0.01;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.autoRotateSpeed = 0.65;
    controls.addEventListener('change', syncCameraDiagnostics);
    controls.addEventListener('start', () => {
      markView('');
      setAutoRotate(false);
    });
    addLights();
    applyView('isometric');
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();
    loadModel();
    renderFrame(0);
  } catch (initializationError) {
    console.error('Temple viewer initialization failed:', initializationError);
    showError('当前浏览器无法显示三维模型。请开启硬件加速，或换用支持 WebGL 的浏览器。');
  }
}

function downloadBlob(blob, filename) {
  if (!blob) throw new Error('无法创建图片文件。');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function saveSnapshot() {
  if (!diagnostics.loaded) return;
  snapshotButton.disabled = true;
  const originalLabel = snapshotButton.textContent;
  snapshotButton.textContent = '正在保存…';
  const size = renderer.getSize(new THREE.Vector2());
  const pixelRatio = renderer.getPixelRatio();
  const exportCamera = camera.clone();
  // Compose the title separately to keep the model and its shadow unobstructed.
  exportCamera.left = -frameHeight / 2;
  exportCamera.right = frameHeight / 2;
  exportCamera.top = frameHeight / 2;
  exportCamera.bottom = -frameHeight / 2;
  exportCamera.updateProjectionMatrix();
  const image = document.createElement('canvas');
  image.width = 1080;
  image.height = 1080;
  const context = image.getContext('2d');
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(950, 950, false);
    renderer.render(scene, exportCamera);
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, 1080, 1080);
    context.drawImage(renderer.domElement, 65, 116, 950, 950);
    context.fillStyle = '#fffaf0';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '900 66px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText('寺庙', 540, 82);
    const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/png'));
    downloadBlob(blob, '寺庙-立体模型-1080.png');
    announce('1080 × 1080 方图已保存。');
  } catch (snapshotError) {
    console.error('Snapshot failed:', snapshotError);
    announce('图片保存失败，请重试。');
  } finally {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(size.x, size.y, false);
    renderer.render(scene, camera);
    snapshotButton.disabled = false;
    snapshotButton.textContent = originalLabel;
  }
}

viewButtons.forEach((button) => {
  button.addEventListener('click', () => applyView(button.dataset.view));
});
rotateButton.addEventListener('click', () => {
  setAutoRotate(!controls.autoRotate);
  if (controls.autoRotate) markView('');
});
wireframeButton.addEventListener('click', () => {
  const enabled = wireframeButton.getAttribute('aria-pressed') !== 'true';
  materialSet.forEach((material) => { material.wireframe = enabled; });
  wireframeButton.setAttribute('aria-pressed', String(enabled));
});
snapshotButton.addEventListener('click', saveSnapshot);
document.querySelector('#retry').addEventListener('click', () => location.reload());

canvas.addEventListener('keydown', (event) => {
  if (!diagnostics.loaded) return;
  const supported = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'];
  if (!supported.includes(event.key)) return;
  event.preventDefault();
  if (event.key === '0') {
    applyView('isometric');
    return;
  }
  setAutoRotate(false);
  markView('');
  if (['+', '=', '-'].includes(event.key)) {
    camera.zoom = THREE.MathUtils.clamp(
      camera.zoom * (event.key === '-' ? 0.9 : 1.1),
      controls.minZoom,
      controls.maxZoom,
    );
    camera.updateProjectionMatrix();
  } else {
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const step = 0.1;
    if (event.key === 'ArrowLeft') spherical.theta -= step;
    if (event.key === 'ArrowRight') spherical.theta += step;
    if (event.key === 'ArrowUp') spherical.phi -= step;
    if (event.key === 'ArrowDown') spherical.phi += step;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
  }
  syncCameraDiagnostics();
});

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  cancelAnimationFrame(animationFrame);
  showError('三维显示暂时中断，请重新加载页面。');
});
window.addEventListener('pagehide', (event) => {
  cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  if (event.persisted) return;
  controls?.dispose();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene?.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (!object.material) return;
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  renderer?.dispose();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !renderer || diagnostics.error) return;
  resizeObserver?.observe(stage);
  lastFrameTime = 0;
  resize();
  renderFrame(0);
});
window.templeDiagnostics = () => ({
  ...diagnostics,
  camera: camera ? {
    type: camera.type,
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    zoom: camera.zoom,
    view: currentView,
    polarDegrees: THREE.MathUtils.radToDeg(controls.getPolarAngle()),
    azimuthDegrees: THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()),
  } : null,
  wireframe: wireframeButton.getAttribute('aria-pressed') === 'true',
  autoRotate: controls?.autoRotate ?? false,
  canvas: { width: canvas.width, height: canvas.height },
});

initialize();
