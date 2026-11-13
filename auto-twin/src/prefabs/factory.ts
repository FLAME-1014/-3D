import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FactoryMaterials } from './materials';

export type Point3 = [number, number, number];
export function box(parent: THREE.Object3D, size: Point3, position: Point3, material: THREE.Material, name = ''): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position); mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function cylinder(parent: THREE.Object3D, radius: number, height: number, position: Point3, material: THREE.Material, segments = 16, name = ''): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.set(...position); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
export function beam(parent: THREE.Object3D, a: Point3, b: Point3, width: number, material: THREE.Material, depth = width): THREE.Mesh {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const mesh = box(parent, [width, start.distanceTo(end), depth], start.clone().add(end).multiplyScalar(0.5).toArray() as Point3, material);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return mesh;
}

export function label(parent: THREE.Object3D, title: string, subtitle: string, position: Point3, width = 5, height = 0.9): THREE.Group {
  const group = new THREE.Group(); group.position.set(...position); parent.add(group);
  const backing = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), new THREE.MeshStandardMaterial({ color: '#27383b', roughness: 0.8 }));
  group.add(backing);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#26373b'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f4ce47'; context.fillRect(0, 0, 12, canvas.height);
    context.fillStyle = '#f0f3ed'; context.font = `600 ${Math.round(canvas.height * 0.38)}px "Microsoft YaHei", sans-serif`;
    context.fillText(title, 36, canvas.height * 0.45);
    context.fillStyle = '#b7c3c2'; context.font = `${Math.round(canvas.height * 0.2)}px Arial, sans-serif`;
    context.fillText(subtitle, 38, canvas.height * 0.8);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    face.position.z = 0.057; group.add(face);
  }
  return group;
}

export function instances(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix)); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function placement(position: Point3, scale: Point3 = [1, 1, 1], rotation?: THREE.Quaternion): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(...position), rotation ?? new THREE.Quaternion(), new THREE.Vector3(...scale));
}

/** Static components retain a group for picking/explosion while reducing draws by material. */
export function mergeStatic(parent: THREE.Group): void {
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const old: THREE.Mesh[] = [];
  parent.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
    // Extruded sheet metal is non-indexed; boxes and cylinders are indexed.
    // Normalize before batching so mixed car-body parts are never dropped.
    const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(inverse.clone().multiply(object.matrixWorld));
    const list = batches.get(object.material) ?? []; list.push(geometry); batches.set(object.material, list); old.push(object);
  });
  const combined: THREE.Mesh[] = [];
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error(`Unable to batch geometry in ${parent.name || 'procedural prefab'}`);
    const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; combined.push(mesh);
  }
  old.forEach((object) => object.removeFromParent());
  combined.forEach((mesh) => parent.add(mesh));
  // Source geometries were uniquely owned by these helpers.
  old.forEach((object) => object.geometry.dispose());
}

export function floor(parent: THREE.Object3D, width: number, depth: number, materials: FactoryMaterials, walkwayWidth = 2.4): void {
  box(parent, [width, 0.18, depth], [0, -0.13, 0], materials.floor, '环氧地坪').castShadow = false;
  const seams: THREE.Matrix4[] = [];
  for (let x = -width / 2 + 6; x < width / 2; x += 6) seams.push(placement([x, -0.03, 0], [0.018, 0.012, depth]));
  for (let z = -depth / 2 + 6; z < depth / 2; z += 6) seams.push(placement([0, -0.03, z], [width, 0.012, 0.018]));
  instances(parent, new THREE.BoxGeometry(1, 1, 1), materials.darkSteel, seams).castShadow = false;
  box(parent, [width - 3, 0.014, walkwayWidth], [0, -0.008, depth / 2 - 8], materials.green, '绿色人行通道').castShadow = false;
  const markings: THREE.Matrix4[] = [];
  for (const z of [-7.15, 7.15, depth / 2 - 8 - walkwayWidth / 2 - 0.12, depth / 2 - 8 + walkwayWidth / 2 + 0.12]) markings.push(placement([0, 0, z], [width - 3, 0.015, 0.1]));
  for (let x = -width / 2 + 3; x < width / 2; x += 4) markings.push(placement([x, 0.001, depth / 2 - 8], [0.8, 0.014, 0.1]));
  instances(parent, new THREE.BoxGeometry(1, 1, 1), materials.yellow, markings).castShadow = false;
}

export function hall(parent: THREE.Object3D, width: number, depth: number, materials: FactoryMaterials): THREE.Group {
  const shell = new THREE.Group(); parent.add(shell);
  const north = -depth / 2;
  box(shell, [width, 5.1, 0.28], [0, 2.5, north], materials.white);
  box(shell, [width, 1.4, 0.28], [0, 9.2, north], materials.white);
  box(shell, [width, 2.5, 0.09], [0, 6.35, north + 0.1], materials.glass);
  const piers: THREE.Matrix4[] = [], ribs: THREE.Matrix4[] = [];
  for (let x = -width / 2; x <= width / 2; x += 6) {
    piers.push(placement([x, 5, north + 0.12], [0.24, 10, 0.34]));
    ribs.push(placement([x + 3, 6.35, north + 0.16], [0.05, 2.5, 0.04]));
  }
  instances(shell, new THREE.BoxGeometry(1, 1, 1), materials.darkSteel, piers);
  instances(shell, new THREE.BoxGeometry(1, 1, 1), materials.white, ribs);
  box(shell, [0.25, 5, depth], [-width / 2, 2.45, 0], materials.white);
  for (let x = -width / 2 + 1.5; x < width / 2; x += 18) {
    box(shell, [3.4, 3.2, 0.1], [x, 1.6, north + 0.2], materials.darkSteel);
    label(shell, '物流门', 'LOGISTICS ACCESS', [x, 3.8, north + 0.3], 3.3, 0.55);
  }
  const roof = new THREE.Group(); roof.name = '钢桁架屋盖'; parent.add(roof);
  const trusses = new THREE.Group(); roof.add(trusses);
  for (let x = -width / 2 + 3; x < width / 2; x += 12) {
    beam(trusses, [x, 10.1, -depth / 2], [x, 10.1, depth / 2], 0.19, materials.darkSteel);
    beam(trusses, [x, 11.5, -depth / 2], [x, 11.5, depth / 2], 0.15, materials.darkSteel);
    for (let z = -depth / 2; z < depth / 2; z += 4) {
      beam(trusses, [x, 10.1, z], [x, 11.5, z + 4], 0.09, materials.darkSteel);
      beam(trusses, [x, 11.5, z], [x, 10.1, z + 4], 0.09, materials.darkSteel);
    }
  }
  for (const z of [-depth / 2 + 1, -12, 0, 12, depth / 2 - 1]) beam(trusses, [-width / 2, 11.5, z], [width / 2, 11.5, z], 0.12, materials.darkSteel);
  mergeStatic(trusses);
  const lights: THREE.Matrix4[] = [];
  for (let x = -width / 2 + 6; x < width / 2; x += 12) for (const z of [-10, 10]) lights.push(placement([x, 9.9, z], [3.2, 0.08, 0.2]));
  instances(roof, new THREE.BoxGeometry(1, 1, 1), materials.light, lights);
  mergeStatic(shell);
  return roof;
}

export function railing(parent: THREE.Object3D, x: number, z: number, length: number, materials: FactoryMaterials): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z); parent.add(group);
  for (let offset = -length / 2; offset <= length / 2 + 0.01; offset += 1.5) cylinder(group, 0.04, 1.1, [offset, 0.55, 0], materials.yellow, 8);
  beam(group, [-length / 2, 1.1, 0], [length / 2, 1.1, 0], 0.06, materials.yellow);
  beam(group, [-length / 2, 0.55, 0], [length / 2, 0.55, 0], 0.04, materials.yellow);
  mergeStatic(group); return group;
}
