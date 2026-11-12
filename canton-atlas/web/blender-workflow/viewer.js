import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const host = document.querySelector("#scene");
const status = document.querySelector("#status");
const info = document.querySelector("#info");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#cadbd3");
scene.fog = new THREE.Fog("#cadbd3", 75, 170);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 150);
camera.position.set(18, -24, 17);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe8f6ef, 0x53685d, 2.1));
const sun = new THREE.DirectionalLight(0xffe1ba, 3);
sun.position.set(-8, -12, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 70 });
sun.shadow.normalBias = 0.04;
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1.8, 0);
controls.minDistance = 10;
controls.maxDistance = 110;
controls.maxPolarAngle = Math.PI * 0.47;

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: "#cadbd3", roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.62;
floor.receiveShadow = true;
scene.add(floor);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let model;
let fitScale = 1;

new GLTFLoader().load(
  "./seaside-hotel.glb",
  ({ scene: root }) => {
    model = root;
    model.name = "Seaside House | 海滨酒店";
    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    scene.add(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    controls.target.set(center.x, Math.min(center.y, 2.2), center.z);
    camera.position.copy(controls.target).add(new THREE.Vector3(24, 21, 29).multiplyScalar(fitScale));
    camera.lookAt(controls.target);
    controls.update();
    status.classList.add("hidden");
    window.modelCheck = { name: model.name, meshes: countMeshes(model), size: size.toArray() };
    window.workflowDiagnostics = () => {
      const materials = new Map();
      const box = new THREE.Box3();
      let triangles = 0;
      let roof;
      model.traverse((object) => {
        if (!object.isMesh) return;
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          materials.set(material.uuid, { name: material.name, color: material.color.toArray(), roughness: material.roughness });
        }
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
        if (object.userData.building) box.expandByObject(object);
        if (object.name.includes("roof")) roof = object;
      });
      const point = new THREE.Box3().setFromObject(roof).getCenter(new THREE.Vector3()).project(camera);
      return {
        ...window.modelCheck, triangles, materials: [...materials.values()],
        buildingSize: box.getSize(new THREE.Vector3()).toArray(),
        camera: camera.position.toArray(), target: controls.target.toArray(),
        buildingPoint: [(point.x + 1) / 2 * host.clientWidth, (1 - point.y) / 2 * host.clientHeight],
      };
    };
  },
  undefined,
  (error) => {
    status.textContent = "模型加载失败，请通过本地预览服务器打开此页面。";
    console.error("GLB load failed", error);
  },
);

function countMeshes(root) {
  let count = 0;
  root.traverse((object) => { if (object.isMesh) count++; });
  return count;
}

let pointerDown;
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button === 0) pointerDown = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener("click", (event) => {
  if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return;
  pointerDown = null;
  if (!model) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(model, true);
  if (hits[0]?.object.userData.building) info.classList.add("visible");
});
document.querySelector("#close").addEventListener("click", () => info.classList.remove("visible"));

const resize = () => {
  const { width, height } = host.getBoundingClientRect();
  camera.aspect = width / height;
  const nextFitScale = Math.max(1, 0.95 / camera.aspect);
  camera.position.sub(controls.target).multiplyScalar(nextFitScale / fitScale).add(controls.target);
  fitScale = nextFitScale;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};
new ResizeObserver(resize).observe(host);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
