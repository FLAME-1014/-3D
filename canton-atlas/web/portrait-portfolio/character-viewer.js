import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEFAULT_MODEL = new URL('./assets/character.glb', import.meta.url).href;

function releaseModel(model) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  model?.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(item => item.dispose());
  textures.forEach(item => item.dispose());
  materials.forEach(item => item.dispose());
}

export function createCharacterViewer({ container, reducedMotion = false, onStatus = () => {} }) {
  let renderer;
  let model;
  let currentURL = DEFAULT_MODEL;
  let active = true;
  let disposed = false;
  let ready = false;
  let wireframe = false;
  let autoRotate = false;
  let jacketColor = '#e7dac0';
  let loadVersion = 0;
  let frame = 0;
  let totalMeshes = 0;
  let modelHeight = 3.3;
  let modelWidth = 2.0;
  let modelDepth = 1.0;
  let fallBack = false;
  let lastTime = 0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 150);
  const target = new THREE.Vector3(0, 1.65, 0);
  const clockMotion = { value: reducedMotion };
  const notify = (mode, message) => {
    container.dataset.mode = mode;
    container.dataset.ready = String(mode === 'webgl' && ready);
    onStatus({ mode, message, ready });
  };
  const fallbackAPI = {
    async loadModel() { throw new Error('此浏览器无法显示三维模型，请在支持 WebGL 的浏览器中打开。'); },
    setColor() {}, setWireframe() {}, setAutoRotate() {}, reset() {}, capture() { return null; },
    setReducedMotion() {},
    getState: () => ({ mode: 'poster', ready: true, autoRotate: false, wireframe: false, meshes: 0 }),
    dispose() { disposed = true; },
  };
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    ready = true;
    notify('poster', '当前显示静态预览');
    return fallbackAPI;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.07;
  controls.minPolarAngle = Math.PI * 0.27;
  controls.maxPolarAngle = Math.PI * 0.63;
  controls.autoRotateSpeed = 1.0;
  controls.target.copy(target);
  scene.add(new THREE.HemisphereLight(0xfff8df, 0x526253, 2.4));
  const key = new THREE.DirectionalLight(0xfff0d5, 4.2);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe5efed, 2.2);
  fill.position.set(5, 3, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe9b5, 3.3);
  rim.position.set(1, 6, -4);
  scene.add(rim);
  const loader = new GLTFLoader();

  function setView() {
    const height = Math.max(container.clientHeight, 1);
    const width = Math.max(container.clientWidth, 1);
    camera.aspect = width / height;
    const vertical = (modelHeight + modelDepth * 0.065) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const horizontal = (modelWidth + modelDepth * 0.12) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const distance = Math.max(vertical, horizontal) * 1.04 + modelDepth / 2;
    camera.position.set(distance * 0.12, target.y + distance * 0.065, distance);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 30;
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.update();
    controls.saveState();
  }
  function resize() {
    if (disposed || fallBack) return;
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1), false);
    setView();
    renderer.render(scene, camera);
  }
  function applyAppearance(root = model) {
    root?.traverse(node => {
      if (!node.isMesh) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        material.wireframe = wireframe;
        if (/^Clothing_(Jacket|Lapel)/.test(material.name)) material.color.set(jacketColor);
      }
    });
  }
  async function loadModel(url = DEFAULT_MODEL) {
    if (fallBack) throw new Error('三维视图已不可用，请刷新页面后重试。');
    const request = ++loadVersion;
    if (!model) notify('loading', '正在加载三维角色');
    let gltf;
    try {
      gltf = await loader.loadAsync(url);
      if (disposed || fallBack || request !== loadVersion) {
        releaseModel(gltf.scene);
        throw new Error('三维视图已暂停，本次模型加载已取消。');
      }
      const nextModel = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(nextModel);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y < 0.000001 || size.length() > 1e8) {
        releaseModel(nextModel);
        throw new Error('模型没有可显示的有效几何体。');
      }
      // Standardise models to a 3.3-unit bust without altering the original file.
      const scale = 3.3 / size.y;
      const group = new THREE.Group();
      group.add(nextModel);
      group.scale.setScalar(scale);
      group.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      modelHeight = 3.3;
      modelWidth = size.x * scale;
      modelDepth = size.z * scale;
      target.set(0, modelHeight * 0.5, 0);
      totalMeshes = 0;
      group.traverse(node => { if (node.isMesh) totalMeshes += 1; });
      if (!totalMeshes) { releaseModel(group); throw new Error('GLB 中没有可显示的网格。'); }
      applyAppearance(group);
      if (model) { scene.remove(model); releaseModel(model); }
      model = group;
      scene.add(model);
      currentURL = url;
      ready = true;
      resize();
      notify('webgl', '拖动，换个角度认识我');
      return true;
    } catch (error) {
      if (!model) {
        ready = true;
        notify('poster', '模型加载失败，当前显示静态预览');
      }
      throw error;
    }
  }
  function draw(time) {
    if (disposed || fallBack) return;
    frame = requestAnimationFrame(draw);
    if (!active || document.hidden || time - lastTime < 1000 / 40) return;
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    controls.autoRotate = autoRotate && !clockMotion.value;
    controls.update(delta);
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const intersection = new IntersectionObserver(entries => {
    active = entries[0].isIntersecting;
  }, { rootMargin: '100px' });
  intersection.observe(container);
  const contextLost = event => {
    event.preventDefault();
    fallBack = true;
    ++loadVersion;
    cancelAnimationFrame(frame);
    ready = true;
    notify('poster', '三维视图已暂停，当前显示静态预览');
    renderer.domElement.style.display = 'none';
  };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  resize();
  draw(0);
  return {
    loadModel,
    setColor(color) { jacketColor = color; applyAppearance(); },
    setWireframe(value) { wireframe = Boolean(value); applyAppearance(); },
    setAutoRotate(value) { autoRotate = Boolean(value) && !clockMotion.value; controls.autoRotate = autoRotate; },
    setReducedMotion(value) { clockMotion.value = value; controls.enableDamping = !value; if (value) autoRotate = false; },
    reset() {
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.autoRotate = false;
      controls.update();
      controls.reset();
      setView();
      controls.enableDamping = damping;
      controls.autoRotate = autoRotate && !clockMotion.value;
    },
    capture() {
      if (!ready || fallBack) return null;
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    getState: () => ({
      mode: fallBack ? 'poster' : container.dataset.mode,
      ready, meshes: totalMeshes, wireframe, autoRotate, color: jacketColor,
      camera: camera.position.toArray(), model: currentURL.startsWith('blob:') ? 'custom' : 'default',
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    }),
    dispose() {
      disposed = true;
      ++loadVersion;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      controls.dispose();
      releaseModel(model);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
