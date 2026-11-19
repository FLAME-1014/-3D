import * as THREE from 'three';
import { MaterialLibrary } from './MaterialLibrary';
import { WaterView } from './WaterView';
import { EnvironmentView } from './EnvironmentView';
import type { Simulation } from './Simulation';
import { BuildingView } from '../city/BuildingView';
import { batch, drainageView, farTerrain, infrastructure } from '../city/InfrastructureView';
import type { DynamicKind } from '../physics/PhysicsWorld';
import { disposeScene } from '../utils/ResourceManager';
import { clamp } from '../utils/math';

export type Layer = 'surface' | 'depth' | 'drainage';
export interface Probe { x: number; y: number; z: number; building?: string }
const KIND: DynamicKind[] = ['debris', 'crate', 'container', 'buoy'];
const picker = new THREE.Raycaster();
const selection = new THREE.Vector3();

export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly city = new THREE.Group();
  readonly buildings: BuildingView[];
  readonly water: WaterView;
  readonly environment: EnvironmentView;
  readonly assets = new MaterialLibrary();
  private readonly drainage: THREE.InstancedMesh;
  private readonly trunks: THREE.InstancedMesh;
  private readonly crowns: THREE.InstancedMesh;
  private readonly form = new THREE.Object3D();
  private readonly batches: Record<DynamicKind, THREE.InstancedMesh>;
  private readonly marker: THREE.Mesh;
  private readonly ground: THREE.Object3D;
  private revision = -1;
  probe?: Probe;
  layer: Layer = 'surface';

  constructor(readonly simulation: Simulation) {
    const data = simulation.city;
    this.environment = new EnvironmentView(this.scene, data.seed);
    this.water = new WaterView(data.terrain);
    this.drainage = drainageView(data, this.assets);
    const built = infrastructure(data, this.assets);
    this.ground = built.children[0];
    this.scene.add(this.city, farTerrain());
    this.city.add(built, this.water.root, this.drainage);
    this.buildings = data.buildings.map(spec => new BuildingView(spec, this.assets));
    for (const b of this.buildings) this.city.add(b.root);
    const bases = data.trees.map(item => ({
      ...item, y: data.terrain.height(item.x, item.z) + 1.15 * item.scale,
      sx: item.scale * 0.36, sy: item.scale * 2.3, sz: item.scale * 0.36,
    }));
    this.trunks = batch(this.assets.pole, this.assets.bark, bases);
    this.crowns = batch(this.assets.canopy, this.assets.foliage, bases.map((item, index) => ({
      ...item, y: item.y + 2.35 * item.scale, sx: 3.55 * item.scale, sy: 4.45 * item.scale, sz: 3.33 * item.scale,
      tint: [0xb0c5ab, 0x87a386, 0x759b87, 0xbfbd9e][index % 4],
    })), true);
    this.crowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crowns.boundingSphere!.radius += 6;
    this.city.add(this.trunks, this.crowns);
    const buffer = (geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) => {
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = true;
      this.city.add(mesh);
      return mesh;
    };
    this.batches = {
      debris: buffer(this.assets.box, this.assets.rubble, 144), crate: buffer(this.assets.box, this.assets.crate, 16),
      container: buffer(this.assets.box, this.assets.container, 16), buoy: buffer(this.assets.canopy, this.assets.amber, 1),
    };
    this.marker = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.2, 36), new THREE.MeshBasicMaterial({
      color: 0xf8d397, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false,
    }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.renderOrder = 10;
    this.marker.visible = false;
    this.city.add(this.marker);
    this.sync();
  }

  sync() {
    const model = this.simulation;
    if (this.revision === model.revision) return;
    this.revision = model.revision;
    this.city.position.set(model.quake.x, 0, model.quake.z);
    this.water.apply(model.flood);
    for (const view of this.buildings) view.apply(model.structures.get(view.data.id)!);
    for (const kind of KIND) this.batches[kind].count = 0;
    for (const entry of model.physics.dynamics.values()) {
      const body = model.physics.body(entry);
      const p = body.translation();
      const q = body.rotation();
      const mesh = this.batches[entry.kind];
      this.form.position.set(p.x, p.y, p.z);
      this.form.quaternion.set(q.x, q.y, q.z, q.w);
      this.form.scale.set(entry.size.x, entry.size.y, entry.size.z);
      this.form.updateMatrix();
      mesh.setMatrixAt(mesh.count++, this.form.matrix);
    }
    for (const kind of KIND) this.batches[kind].instanceMatrix.needsUpdate = true;
    this.updateProbe();
  }

  frame(camera: THREE.PerspectiveCamera, wall: number) {
    this.sync();
    const model = this.simulation;
    const time = model.machine.state === 'NORMAL' ? wall * 0.7 : model.clock.time;
    const { rain, wind } = model;
    this.environment.frame(camera, time, rain, wind, this.layer === 'depth');
    this.water.frame(time, this.environment.weather, this.environment.fog.color, this.layer === 'depth');
    this.drainage.visible = this.layer === 'drainage';
    if (model.machine.state !== 'PAUSED' && model.machine.state !== 'COMPLETED') {
      for (const [index, tree] of model.city.trees.entries()) {
        const oscillation = Math.sin(time * 3.7 + tree.phase);
        const bend = (0.76 + 0.23 * oscillation) * 0.0082;
        const bx = clamp(wind.x * bend + 0.035 * oscillation, -0.76, 0.76);
        const bz = clamp(wind.z * bend - 0.018 * Math.cos(time * 2.8 + tree.phase), -0.76, 0.76);
        this.form.position.set(tree.x + bx * 2.2, model.city.terrain.height(tree.x, tree.z) + 3.5 * tree.scale, tree.z + bz * 2.2);
        this.form.rotation.set(bz, 0, -bx);
        this.form.scale.set(3.55 * tree.scale, 4.45 * tree.scale, 3.33 * tree.scale);
        this.form.updateMatrix();
        this.crowns.setMatrixAt(index, this.form.matrix);
      }
      this.crowns.instanceMatrix.needsUpdate = true;
    }
  }

  pick(x: number, y: number, camera: THREE.PerspectiveCamera) {
    picker.setFromCamera(new THREE.Vector2(x, y), camera);
    const ground = picker.intersectObject(this.ground, false)[0]?.point;
    let hit: Probe | undefined = ground ? {
      x: ground.x - this.city.position.x, y: ground.y, z: ground.z - this.city.position.z,
    } : undefined;
    let closest = ground?.distanceTo(camera.position) ?? Infinity;
    for (const view of this.buildings) {
      const b = view.data;
      const centerX = b.x + this.city.position.x;
      const centerZ = b.z + this.city.position.z;
      const volume = new THREE.Box3(
        new THREE.Vector3(centerX - b.width / 2, b.y, centerZ - b.depth / 2),
        new THREE.Vector3(centerX + b.width / 2, b.y + (view.state?.condition === 'collapsed' ? 2.7 : b.height), centerZ + b.depth / 2),
      );
      const result = picker.ray.intersectBox(volume, selection);
      if (result && camera.position.distanceTo(result) < closest) {
        closest = camera.position.distanceTo(result);
        hit = { x: b.x, y: b.y, z: b.z, building: b.id };
      }
    }
    this.setProbe(hit);
    return hit;
  }

  setProbe(probe?: Probe) { this.probe = probe; this.updateProbe(); }

  private updateProbe() {
    for (const view of this.buildings) view.halo.visible = view.data.id === this.probe?.building;
    this.marker.visible = !!this.probe && !this.probe.building;
    if (this.probe) {
      const { x, z, y } = this.probe;
      this.marker.position.set(x, Math.max(y, this.simulation.flood.level(x, z)) + 0.16, z);
    }
  }

  dispose() { disposeScene(this.scene, Object.values(this.assets)); }
}
