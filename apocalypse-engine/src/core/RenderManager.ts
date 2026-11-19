import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Quality, QualityMode } from './EnvironmentView';
import type { SceneManager } from './SceneManager';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { clamp } from '../utils/math';

export type CameraMode = 'overview' | 'map' | 'coast';
export type Point = { x: number; y: number; z: number };

const presets = {
  overview: { position: [141, 139, 199], target: [0, 9, -6] },
  map: { position: [0.2, 286, 5], target: [0, 0, -10] },
  coast: { position: [109, 52, 126], target: [6, 12, 2] },
} as const;

export class RenderManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.6, 1600);
  readonly controls: OrbitControls;
  readonly performance = new PerformanceMonitor();
  private readonly observer: ResizeObserver;
  private readonly reflection: THREE.WebGLRenderTarget;
  private readonly oldViewport = { width: 0, height: 0 };
  private readonly projectPoint = new THREE.Vector3();
  private readonly destination = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private switching = false;
  private lastShadow = -1;
  private lastQuality = 0;
  private lowCount = 0;
  private highCount = 0;
  private testPixelChecked = false;
  testPixel: number[] = [0, 0, 0, 0];
  cameraMode: CameraMode = 'overview';
  quality: Quality = 'medium';
  qualityMode: QualityMode = 'auto';

  constructor(private canvas: HTMLCanvasElement, private view: SceneManager) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.reflection = pmrem.fromScene(room, 0.06, 0.1, 100, { size: 48 });
    room.dispose();
    pmrem.dispose();
    view.scene.environment = this.reflection.texture;
    view.scene.environmentIntensity = 0.76;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 74;
    this.controls.maxDistance = 560;
    this.controls.maxPolarAngle = Math.PI * 0.474;
    this.controls.minPolarAngle = 0.018;
    this.controls.zoomSpeed = 0.8;
    this.controls.rotateSpeed = 0.48;
    this.controls.panSpeed = 0.68;
    this.controls.addEventListener('start', this.endTransition);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.setCamera('overview', false);
    this.setQuality('auto');
  }

  private endTransition = () => { this.switching = false; };

  private pixelRatio() {
    return Math.min(devicePixelRatio || 1, this.quality === 'high' ? 1.55 : this.quality === 'medium' ? 1.03 : 0.76);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === this.oldViewport.width && height === this.oldViewport.height) return;
    this.oldViewport.width = width;
    this.oldViewport.height = height;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < 1.1 ? 49 : this.camera.aspect < 1.65 ? 43 : 40;
    this.camera.updateProjectionMatrix();
    this.setCamera(this.cameraMode, false);
  }

  setCamera(mode: CameraMode, animate = true) {
    this.cameraMode = mode;
    const preset = presets[mode];
    this.destination.fromArray(preset.position);
    this.target.fromArray(preset.target);
    if (this.camera.aspect < 1.05 && mode !== 'coast') {
      this.destination.sub(this.target).multiplyScalar(clamp(1.15 / this.camera.aspect, 1, 1.54)).add(this.target);
    }
    this.switching = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.switching) {
      this.camera.position.copy(this.destination);
      this.controls.target.copy(this.target);
      this.controls.update();
    }
  }

  zoom(inward: boolean) {
    this.switching = false;
    const delta = this.camera.position.clone().sub(this.controls.target);
    const length = clamp(delta.length() * (inward ? 0.80 : 1.25), this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(delta.setLength(length));
    this.controls.update();
  }

  setQuality(mode: QualityMode) {
    this.qualityMode = mode;
    this.lowCount = this.highCount = 0;
    this.applyQuality(mode === 'auto' ? 'low' : mode);
  }

  private applyQuality(quality: Quality) {
    this.quality = quality;
    this.view.environment.setQuality(quality);
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.lastQuality = this.lastShadow = -1;
  }

  private auto(now: number) {
    const { fps } = this.performance.sample;
    if (this.qualityMode !== 'auto' || now < this.lastQuality + 7) return;
    this.lowCount = fps < 27 ? this.lowCount + 1 : 0;
    this.highCount = fps > 54 ? this.highCount + 1 : 0;
    if (this.lowCount >= 3 && this.quality !== 'low') {
      this.applyQuality(this.quality === 'high' ? 'medium' : 'low');
    } else if (this.highCount >= 8 && this.quality === 'low') {
      this.applyQuality('medium');
    } else return;
    this.lowCount = this.highCount = 0;
    this.lastQuality = now;
    this.performance.reset();
  }

  render(delta: number, wall: number) {
    if (this.switching) {
      const factor = 1 - Math.exp(-Math.min(delta, 0.1) * 9);
      this.camera.position.lerp(this.destination, factor);
      this.controls.target.lerp(this.target, factor);
      if (this.camera.position.distanceToSquared(this.destination) < 0.001) this.switching = false;
    }
    this.controls.update();
    this.view.frame(this.camera, wall);
    this.renderer.toneMappingExposure = this.view.environment.exposure;
    if (this.quality !== 'low' && (this.lastShadow < 0 || this.view.simulation.canAdvance() && wall - this.lastShadow > 0.05)) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadow = wall;
    }
    this.renderer.render(this.view.scene, this.camera);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('test') && !this.testPixelChecked) {
      this.testPixelChecked = true;
      const gl = this.renderer.getContext();
      const width = this.renderer.domElement.width;
      const height = this.renderer.domElement.height;
      const pixels = new Uint8Array(21 * 21 * 4);
      gl.readPixels(Math.max(0, Math.floor(width * 0.5) - 10), Math.max(0, Math.floor(height * 0.49) - 10),
        21, 21, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      this.testPixel = Array.from(pixels);
    }
    const { render, memory } = this.renderer.info;
    if (this.performance.frame(wall, delta, {
      drawCalls: render.calls, triangles: render.triangles, geometries: memory.geometries,
      textures: memory.textures, bodies: this.view.simulation.physics.count,
    })) this.auto(wall);
  }

  project(point: Point) {
    this.projectPoint.set(point.x + this.view.city.position.x, point.y, point.z + this.view.city.position.z).project(this.camera);
    return {
      x: (this.projectPoint.x * 0.5 + 0.5) * this.oldViewport.width,
      y: (0.5 - this.projectPoint.y * 0.5) * this.oldViewport.height,
      visible: this.projectPoint.z >= -1 && this.projectPoint.z <= 1 &&
        Math.abs(this.projectPoint.x) < 0.98 && Math.abs(this.projectPoint.y) < 0.94,
    };
  }

  invalidateShadows() { this.lastShadow = -1; }

  dispose() {
    this.observer.disconnect();
    this.controls.removeEventListener('start', this.endTransition);
    this.controls.dispose();
    this.view.scene.environment = null;
    this.reflection.dispose();
    this.view.dispose();
    this.renderer.dispose();
  }
}
