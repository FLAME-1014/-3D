import * as THREE from 'three';
import type { Building } from './CityData';
import type { StructureState } from './BuildingDamage';
import type { MaterialLibrary } from '../core/MaterialLibrary';
import { seeded } from '../utils/math';

export class BuildingView {
  readonly root = new THREE.Group();
  readonly tower = new THREE.LOD();
  readonly rubble = new THREE.Group();
  readonly halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly alert: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  state: StructureState | undefined;

  constructor(readonly data: Building, assets: MaterialLibrary) {
    const { x, y, z, height, width, depth, style, tint, id } = data;
    this.root.position.set(x, y, z);
    this.root.userData.building = id;
    const detail = new THREE.Group();
    const distant = new THREE.Group();
    const glass = assets.glass[tint];
    const masonry = assets.masonry[tint];
    const wall = style === 'masonry' || style === 'civic' ? masonry : glass;
    const walls = [wall, wall, assets.roof, assets.concrete, wall, wall];
    const anchor = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[],
      dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, parent = detail) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(dx, dy, dz);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    anchor(assets.box, assets.concreteDark, 0, 0.08, 0, width + 3, 0.8, depth + 3, this.root);
    const box = (material: THREE.Material | THREE.Material[], dy: number, sx: number, sy: number, sz: number, dx = 0, dz = 0) =>
      anchor(assets.box, material, dx, dy, dz, sx, sy, sz);
    if (style === 'round') {
      anchor(assets.cylinder, [wall, assets.roof, assets.roof], 0, height * 0.52, 0, width * 0.95, height * 0.95, depth);
      for (const fraction of [0.08, 0.38, 0.69, 0.985]) {
        anchor(assets.cylinder, assets.steel, 0, height * fraction, 0, width * 1.015, 0.35, depth * 1.04);
      }
      anchor(assets.cylinder, assets.concrete, 0, height + 0.45, 0, width * 0.62, 1.25, depth * 0.68);
    } else if (style === 'setback') {
      box(walls, height * 0.16, width, height * 0.32, depth);
      box(walls, height * 0.55, width * 0.82, height * 0.46, depth * 0.84, -0.35);
      box(walls, height * 0.89, width * 0.62, height * 0.22, depth * 0.66, -0.8);
      box(assets.steel, height * 0.995, width * 0.66, 0.6, depth * 0.7, -0.8);
      box(assets.bronze, height + 2.35, 0.43, 4.7, 0.43, -0.8);
      box(assets.amber, height + 4.55, 0.65, 0.32, 0.65, -0.8);
    } else if (style === 'civic') {
      box(walls, height * 0.45, width * 0.95, height * 0.9, depth * 0.83);
      for (let rib = 0; rib < 4; rib++) {
        const dx = (rib - 1.5) * width * 0.25;
        const roof = box(assets.roof, height * 0.92, width * 0.267, height * 0.16, depth * 1.03, dx);
        roof.rotation.z = 0.13;
        box(assets.concrete, height * 0.43, 0.55, height * 0.87, 0.62, dx, depth * 0.44);
      }
    } else {
      box(walls, height * 0.49, width, height * 0.98, depth);
      box(assets.steel, height * 0.981, width * 1.03, 0.47, depth * 1.04);
      box(assets.roof, height + 0.6, width * 0.34, 1.25, depth * 0.36, width * 0.16, -depth * 0.19);
      if (style === 'glass') {
        for (const sign of [-1, 1]) {
          box(assets.concrete, height * 0.48, 0.45, height * 0.96, depth * 1.035, sign * width * 0.43);
        }
        box(assets.bronze, height + 1.9, 0.27, 3.8, 0.27, -width * 0.26);
        box(assets.amber, height + 3.74, 0.47, 0.23, 0.47, -width * 0.26);
      } else {
        box(assets.concrete, height * 0.22, width * 1.026, 0.31, depth * 1.026);
        box(assets.concrete, height * 0.53, width * 1.026, 0.27, depth * 1.026);
      }
    }
    anchor(style === 'round' ? assets.cylinder : assets.box,
      style === 'round' ? [wall, assets.roof, assets.roof] : walls,
      0, height / 2, 0, width, height, depth, distant);
    this.tower.addLevel(detail, 0);
    this.tower.addLevel(distant, 330, 0.12);
    this.root.add(this.tower, this.rubble);
    this.rubble.visible = false;
    const rng = seeded(data.id.charCodeAt(2) * 29 + data.id.charCodeAt(3) * 17);
    for (let index = 0; index < 8; index++) {
      const debris = anchor(assets.canopy, assets.rubble, (rng() - 0.5) * width * 0.86, 0.55,
        (rng() - 0.5) * depth * 0.82, 3 + rng() * 5, 1.6 + rng() * 3, 2 + rng() * 5, this.rubble);
      debris.rotation.set(rng(), rng(), rng());
    }
    this.halo = new THREE.Mesh(new THREE.RingGeometry(width * 0.7, width * 0.73, 32),
      new THREE.MeshBasicMaterial({ color: 0xffca87, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }));
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.66;
    this.halo.visible = false;
    this.root.add(this.halo);
    this.alert = new THREE.Mesh(assets.box, new THREE.MeshBasicMaterial({ color: 0xff845a }));
    this.alert.scale.set(1.15, 0.32, 1.15);
    this.alert.position.y = height + 1.8;
    this.alert.visible = false;
    this.root.add(this.alert);
  }

  apply(state: StructureState) {
    this.state = state;
    this.root.userData.condition = state.condition;
    const collapsed = state.condition === 'collapsed';
    this.tower.visible = !collapsed;
    this.rubble.visible = collapsed;
    this.alert.visible = state.condition !== 'intact';
    this.alert.position.y = collapsed ? 3 : this.data.height + 1.8;
    this.alert.material.color.setHex(state.condition === 'inundated' ? 0x61e8e1 : collapsed ? 0xef5b4c : 0xffab62);
    this.tower.rotation.z = -state.x / this.data.height;
    this.tower.rotation.x = state.z / this.data.height;
  }
}
