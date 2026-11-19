import * as THREE from 'three';

export function disposeScene(scene: THREE.Scene, extra: unknown[] = []) {
  const disposable = new Set<{ dispose(): void }>();
  const visit = (resource: unknown) => {
    if (Array.isArray(resource)) { resource.forEach(visit); return; }
    if (resource instanceof THREE.Texture || resource instanceof THREE.BufferGeometry) disposable.add(resource);
    if (resource instanceof THREE.Material) {
      disposable.add(resource);
      Object.values(resource).forEach(property => { if (property instanceof THREE.Texture) disposable.add(property); });
    }
  };
  scene.traverse(node => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Line) {
      visit(node.geometry);
      visit(node.material);
    }
    if (node instanceof THREE.InstancedMesh) disposable.add(node);
    if (node instanceof THREE.DirectionalLight) disposable.add(node.shadow);
  });
  extra.forEach(visit);
  for (const entry of disposable) entry.dispose();
  scene.clear();
}
