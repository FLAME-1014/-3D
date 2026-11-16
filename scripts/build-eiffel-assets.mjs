import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'canton-atlas/web/eiffel-tower');
const sourcePath = path.join(directory, 'model.js');
const threeUrl = pathToFileURL(path.join(root, 'canton-atlas/web/aero-engine/vendor/build/three.module.js')).href;
const THREE = await import(threeUrl);
const source = await fs.readFile(sourcePath, 'utf8');
const moduleSource = source.replace(/(['"])three\1/g, JSON.stringify(threeUrl));
const { createEiffelTower } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
const tower = createEiffelTower();
tower.setStage(5);
tower.root.updateMatrixWorld(true);
const geometries = new Map();
const materials = new Map();
const dump = {
  title: 'Eiffel Tower — procedural architectural study',
  source: 'canton-atlas/web/eiffel-tower/model.js',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  sourceUpAxis: 'Y',
  units: 'meters',
  nominalHeight: tower.height,
  nominalBaseWidth: tower.baseWidth,
  stages: tower.stages.map((stage, index) => ({ index, name: stage.name, title: stage.userData.title })),
  geometries: [],
  materials: [],
  batches: [],
};
tower.root.traverse(object => {
  if (!object.isMesh) return;
  const geometry = object.geometry;
  if (!geometries.has(geometry.uuid)) {
    geometries.set(geometry.uuid, dump.geometries.length);
    dump.geometries.push({
      positions: Array.from(geometry.attributes.position.array),
      normals: geometry.attributes.normal ? Array.from(geometry.attributes.normal.array) : null,
      indices: geometry.index ? Array.from(geometry.index.array) : Array.from({ length: geometry.attributes.position.count }, (_, i) => i),
    });
  }
  if (Array.isArray(object.material)) throw new Error('Material arrays require explicit primitive splitting');
  const material = object.material;
  if (!materials.has(material.uuid)) {
    materials.set(material.uuid, dump.materials.length);
    dump.materials.push({
      name: `Tower material ${dump.materials.length + 1} / ${material.color.getHexString()}`,
      color: material.color.toArray(),
      metallic: material.metalness ?? 0,
      roughness: material.roughness ?? 0.5,
      alpha: material.transparent ? material.opacity : 1,
      emissive: material.emissive?.toArray() ?? [0, 0, 0],
      emissiveIntensity: material.emissiveIntensity ?? 0,
      unlit: material.isMeshBasicMaterial === true,
    });
  }
  let stage = object;
  while (stage && !tower.stages.includes(stage)) stage = stage.parent;
  if (!stage) throw new Error(`Mesh outside construction stages: ${object.name}`);
  const transforms = [];
  if (object.isInstancedMesh) {
    for (let i = 0; i < object.count; i++) {
      const matrix = new THREE.Matrix4();
      object.getMatrixAt(i, matrix);
      matrix.premultiply(object.matrixWorld);
      transforms.push(matrix.toArray());
    }
  } else transforms.push(object.matrixWorld.toArray());
  dump.batches.push({
    name: object.name,
    stage: tower.stages.indexOf(stage),
    geometry: geometries.get(geometry.uuid),
    material: materials.get(material.uuid),
    transforms,
  });
});
const bounds = new THREE.Box3().setFromObject(tower.root);
dump.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
dump.instances = dump.batches.reduce((total, batch) => total + batch.transforms.length, 0);
dump.triangles = dump.batches.reduce((total, batch) => total + batch.transforms.length * dump.geometries[batch.geometry].indices.length / 3, 0);
const dumpPath = path.join(root, 'tmp/eiffel-asset-geometry.json');
await fs.mkdir(path.dirname(dumpPath), { recursive: true });
await fs.writeFile(dumpPath, JSON.stringify(dump));
tower.dispose();
const blender = process.env.EIFFEL_BLENDER ?? 'D:/blender.exe';
const result = spawnSync(blender, [
  '--background', '--factory-startup', '--python-exit-code', '1',
  '--python', path.join(root, 'scripts/build_eiffel_assets.py'),
  '--', '--input', dumpPath, '--output', directory,
], { cwd: root, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
await fs.writeFile(path.join(root, 'tmp/eiffel-asset-build.log'), `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Blender build failed (${result.status}). See tmp/eiffel-asset-build.log`);
console.log(JSON.stringify({ batches: dump.batches.length, instances: dump.instances, triangles: dump.triangles, bounds: dump.bounds, sourceSha256: dump.sourceSha256 }, null, 2));
