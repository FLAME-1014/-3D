import {expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {disposeSceneResources} from './resources';

it('releases instance buffers, ordinary laser lines, and shared resources exactly once', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({map: texture});
  const instances = new THREE.InstancedMesh(geometry, material, 2);
  instances.setColorAt(0, new THREE.Color('yellow'));
  const laserGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
  const laserMaterial = new THREE.LineBasicMaterial();
  const laser = new THREE.Line(laserGeometry, laserMaterial);
  root.add(instances, new THREE.Mesh(geometry, material), laser);
  const resources = [instances, geometry, texture, material, laserGeometry, laserMaterial];
  const released = resources.map(resource => vi.spyOn(resource, 'dispose'));
  disposeSceneResources(root, [material]);
  for (const spy of released) expect(spy).toHaveBeenCalledTimes(1);
});

it('releases light shadow targets and textures belonging to unused material variants', () => {
  const root = new THREE.Group(), light = new THREE.DirectionalLight();
  root.add(light);
  const texture = new THREE.Texture(), material = new THREE.MeshStandardMaterial({map: texture});
  const shadowDispose = vi.spyOn(light.shadow, 'dispose'), textureDispose = vi.spyOn(texture, 'dispose');
  disposeSceneResources(root, [material]);
  expect(shadowDispose).toHaveBeenCalledOnce();
  expect(textureDispose).toHaveBeenCalledOnce();
});
