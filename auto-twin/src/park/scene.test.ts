import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createParkWorld, PARK_BUILDINGS, PARK_SIZE } from './scene';

function dispose(world: ReturnType<typeof createParkWorld>) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  world.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
}

describe('park navigation and layout', () => {
  it('exposes stable building picks and marks the two planned shops as unavailable entrances', () => {
    const world = createParkWorld();
    try {
      expect(world.shop).toBe('park'); expect(world.stations).toEqual([]);
      expect(world.pickables.map(pickable => pickable.id)).toEqual(['stamping', 'welding', 'paint', 'assembly']);
      for (const pickable of world.pickables) {
        expect(pickable.object.parent).toBe(world.group);
        expect(pickable.object.userData.id).toBe(pickable.id);
        expect(pickable.object.userData.entryCamera.every(Number.isFinite)).toBe(true);
        expect(pickable.object.userData.entryTarget.every(Number.isFinite)).toBe(true);
      }
      expect(PARK_BUILDINGS.filter(building => building.planned).map(building => building.id)).toEqual(['paint', 'assembly']);
      expect(world.pickables.filter(pickable => pickable.object.userData.planned).map(pickable => pickable.id)).toEqual(['paint', 'assembly']);
      const debug = world.debug!();
      expect(debug.navigationShops).toEqual(['stamping', 'welding']);
      expect(debug.treeInstances).toBeGreaterThan(100); expect(debug.finishedCars).toBe(48); expect(debug.visitorCars).toBe(14);
      let instanceCount = 0;
      world.group.traverse(object => {if (object instanceof THREE.InstancedMesh) instanceCount++});
      expect(instanceCount).toBeGreaterThanOrEqual(10);
    } finally { dispose(world); }
  });

  it('keeps static building and vehicle geometry finite across production seeks', () => {
    const world = createParkWorld();
    try {
      world.group.updateWorldMatrix(true, true);
      const before = world.pickables.map(pickable => pickable.object.matrixWorld.elements.slice());
      for (const time of [0, 76, 480, 522, 960]) {
        world.update(time, false, null); world.group.updateWorldMatrix(true, true);
        expect(world.pickables.map(pickable => pickable.object.matrixWorld.elements.slice())).toEqual(before);
      }
      world.group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        for (let index = 0; index < positions.array.length; index++) expect(Number.isFinite(positions.array[index])).toBe(true);
        if (object instanceof THREE.InstancedMesh) for (const value of object.instanceMatrix.array) expect(Number.isFinite(value)).toBe(true);
      });
      for (const building of PARK_BUILDINGS) {
        expect(Math.abs(building.center[0]) + building.size[0] / 2).toBeLessThan(PARK_SIZE[0] / 2);
        expect(Math.abs(building.center[2]) + building.size[2] / 2).toBeLessThan(PARK_SIZE[1] / 2);
      }
    } finally { dispose(world); }
  });
});
