import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {box, floor, hall, instances, mergeStatic, placement} from './factory';
import {createFactoryMaterials, type FactoryMaterials} from './materials';

let materials: FactoryMaterials;
let roots: THREE.Group[];
function root(): THREE.Group {
  const group = new THREE.Group(); roots.push(group); return group;
}
function closeVector(actual: THREE.Vector3, expected: THREE.Vector3, tolerance = 1e-5): void {
  expect(actual.distanceTo(expected)).toBeLessThan(tolerance);
}
it('preserves mixed extruded sheet and indexed frame geometry when batching a body',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();const shape=new THREE.Shape();shape.moveTo(-1,0);shape.lineTo(1,0);shape.lineTo(1,1);shape.lineTo(-1,1);shape.closePath();
 root.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:false}),material));
 root.add(new THREE.Mesh(new THREE.BoxGeometry(2,.08,.1),material));
 const before=new THREE.Box3().setFromObject(root,true);mergeStatic(root);const after=new THREE.Box3().setFromObject(root,true);
 closeVector(before.min,after.min);closeVector(before.max,after.max);expect(root.children.filter(o=>o instanceof THREE.Mesh)).toHaveLength(1);
});
beforeEach(() => {materials = createFactoryMaterials(); roots = []});
afterEach(() => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materialSet = new Set<THREE.Material>(Object.values(materials));
  const textures = new Set<THREE.Texture>();
  for (const group of roots) group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materialSet.add(material);
  });
  for (const material of materialSet) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
  vi.unstubAllGlobals();
});

describe('factory prefabs in a headless Node environment', () => {
  it('supplies uploadable fallback textures and builds hall labels without document', () => {
    vi.stubGlobal('document', undefined);
    const fallback = createFactoryMaterials();
    for (const material of [fallback.floor, fallback.steel]) {
      const texture = material.map;
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      const data = (texture as THREE.DataTexture).image;
      expect(data.width).toBe(1); expect(data.height).toBe(1);
      expect(data.data!.length).toBe(4);
      expect(data.data![3]).toBe(255);
      expect(texture!.version).toBeGreaterThan(0);
    }
    const group = root();
    expect(() => hall(group, 120, 36, fallback)).not.toThrow();
    for (const material of Object.values(fallback)) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });

  it.each([
    {shop: 'stamping', width: 132, depth: 56, walkway: 2.4},
    {shop: 'welding', width: 120, depth: 36, walkway: 1.8},
  ])('keeps the $shop floor footprint and pedestrian width in metres', ({width, depth, walkway}) => {
    const group = root(); floor(group, width, depth, materials, walkway);
    const slab = group.getObjectByName('环氧地坪')!;
    const path = group.getObjectByName('绿色人行通道')!;
    expect(slab).toBeInstanceOf(THREE.Mesh); expect(path).toBeInstanceOf(THREE.Mesh);
    closeVector(new THREE.Box3().setFromObject(slab).getSize(new THREE.Vector3()), new THREE.Vector3(width, .18, depth));
    expect(new THREE.Box3().setFromObject(path).getSize(new THREE.Vector3()).z).toBeCloseTo(walkway, 5);
    expect(new THREE.Box3().setFromObject(path).max.y).toBeLessThan(.01);
    const seams = group.children.find(object => object instanceof THREE.InstancedMesh && object.material === materials.darkSteel) as THREE.InstancedMesh;
    expect(seams).toBeInstanceOf(THREE.InstancedMesh);
    const vertical: number[] = [], horizontal: number[] = [];
    for (let index = 0; index < seams.count; index++) {
      const matrix = new THREE.Matrix4(); seams.getMatrixAt(index, matrix);
      const position = new THREE.Vector3(), scale = new THREE.Vector3();
      matrix.decompose(position, new THREE.Quaternion(), scale);
      if (scale.z > 1) vertical.push(position.x); else horizontal.push(position.z);
    }
    for (const coordinates of [vertical, horizontal]) {
      expect(coordinates.length).toBeGreaterThan(1);
      for (let index = 1; index < coordinates.length; index++) expect(coordinates[index] - coordinates[index - 1]).toBeCloseTo(6, 5);
    }
  });

  it.each([{width: 132, depth: 56}, {width: 120, depth: 36}])('retains a full-width north glazing band and independently hideable roof ($width × $depth)', ({width, depth}) => {
    const group = root(); const roof = hall(group, width, depth, materials);
    const glazing: THREE.Mesh[] = [];
    group.traverse(object => {if (object instanceof THREE.Mesh && object.material === materials.glass) glazing.push(object)});
    expect(glazing).toHaveLength(1);
    const band = new THREE.Box3().setFromObject(glazing[0]);
    expect(band.getSize(new THREE.Vector3()).x).toBeCloseTo(width, 5);
    expect(band.min.y).toBeCloseTo(5.1, 5); expect(band.max.y).toBeCloseTo(7.6, 5);
    expect(band.getCenter(new THREE.Vector3()).z).toBeCloseTo(-depth / 2 + .1, 5);
    expect(roof.parent).toBe(group);
    const roofBounds = new THREE.Box3().setFromObject(roof);
    expect(roofBounds.min.y).toBeGreaterThan(9.7);
    expect(roofBounds.max.x - roofBounds.min.x).toBeGreaterThanOrEqual(width - .001);
    expect(roofBounds.max.z - roofBounds.min.z).toBeGreaterThanOrEqual(depth - .001);
    roof.visible = false;
    expect(glazing[0].visible).toBe(true);
    expect(glazing[0].parent).not.toBe(roof);
  });
});

describe('geometry batching preserves spatial identity', () => {
  it('keeps instance transforms and raycast instance IDs under a transformed parent', () => {
    const group = root(); group.position.set(7, 0, -3); group.rotation.y = Math.PI / 2;
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    const matrices = [placement([2, 1, 0], [2, 2, 2], rotation), placement([6, 1, 0], [2, 2, 2])];
    const mesh = instances(group, new THREE.BoxGeometry(1, 1, 1), materials.steel, matrices);
    group.updateWorldMatrix(true, true);
    const stored = new THREE.Matrix4(); mesh.getMatrixAt(0, stored);
    expect(stored.elements).toEqual(matrices[0].elements.map(value => Math.fround(value)));
    for (const [instanceId, localX] of [[0, 2], [1, 6]]) {
      const center = new THREE.Vector3(localX, 1, 0).applyMatrix4(mesh.matrixWorld);
      const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObject(mesh, false);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].instanceId).toBe(instanceId);
      expect(hits[0].point.y).toBeCloseTo(2, 5);
    }
  });

  it('merges by material without changing world bounds, parent transforms, or excluded instances', () => {
    const group = root(); group.position.set(11, 3, -8); group.rotation.set(.1, -.6, .2); group.scale.set(1.2, .8, 1.3);
    const nested = new THREE.Group(); nested.position.set(-2, .7, 1); nested.rotation.z = .4; group.add(nested);
    const sources = [
      box(group, [2, 3, 4], [1, 2, 0], materials.steel),
      box(nested, [1, 2, 3], [-3, 0, 2], materials.steel),
      box(nested, [4, 1, 2], [2, 1, -2], materials.orange),
    ];
    const instance = instances(group, new THREE.BoxGeometry(1, 1, 1), materials.steel, [placement([6, 1, -1])]);
    group.updateWorldMatrix(true, true);
    const before = new THREE.Box3().setFromObject(group, true);
    const parentMatrix = group.matrixWorld.clone();
    const disposed = sources.map(() => 0);
    sources.forEach((source, index) => source.geometry.addEventListener('dispose', () => disposed[index]++));
    mergeStatic(group); group.updateWorldMatrix(true, true);
    const after = new THREE.Box3().setFromObject(group, true);
    closeVector(after.min, before.min); closeVector(after.max, before.max);
    expect(group.matrixWorld.elements).toEqual(parentMatrix.elements);
    expect(instance.parent).toBe(group); expect(instance.count).toBe(1);
    const merged = group.children.filter(object => object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh)) as THREE.Mesh[];
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map(mesh => mesh.material))).toEqual(new Set([materials.steel, materials.orange]));
    expect(sources.every(source => source.parent === null)).toBe(true);
    expect(disposed).toEqual([1, 1, 1]);
  });
});
