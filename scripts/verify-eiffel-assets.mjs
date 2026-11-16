import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'canton-atlas/web/eiffel-tower');
const report = { passed: false, verifiedAt: new Date().toISOString(), checks: [] };
const check = (condition, label) => { assert(condition, label); report.checks.push(label); };
const identity = () => [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply = (a, b) => Array.from({ length: 16 }, (_, i) => {
  const row = i % 4, col = Math.floor(i / 4);
  return a[row] * b[col * 4] + a[row + 4] * b[col * 4 + 1] + a[row + 8] * b[col * 4 + 2] + a[row + 12] * b[col * 4 + 3];
});
function matrix(node) {
  if (node.matrix) return node.matrix;
  const [x,y,z,w] = node.rotation ?? [0,0,0,1];
  const [a,b,c] = node.scale ?? [1,1,1];
  return [
    (1-2*(y*y+z*z))*a,2*(x*y+z*w)*a,2*(x*z-y*w)*a,0,
    2*(x*y-z*w)*b,(1-2*(x*x+z*z))*b,2*(y*z+x*w)*b,0,
    2*(x*z+y*w)*c,2*(y*z-x*w)*c,(1-2*(x*x+y*y))*c,0,
    ...(node.translation ?? [0,0,0]),1,
  ];
}
const transform = (p, m) => [0,1,2].map(i => m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
const round = n => Math.round(n * 1e5) / 1e5;
try {
  const [bytes, blend, info, source] = await Promise.all([
    fs.readFile(path.join(directory, 'eiffel-tower.glb')),
    fs.readFile(path.join(directory, 'eiffel-tower.blend')),
    fs.readFile(path.join(directory, 'model-info.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(directory, 'model.js')),
  ]);
  check(bytes.toString('ascii',0,4) === 'glTF' && bytes.readUInt32LE(4) === 2, 'GLB version 2 header');
  check(bytes.readUInt32LE(8) === bytes.length, 'GLB length matches file');
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset+4);
    assert(length % 4 === 0 && offset+8+length <= bytes.length, 'Invalid GLB chunk');
    chunks.push({ type, bytes: bytes.subarray(offset+8,offset+8+length) });
    offset += 8+length;
  }
  check(chunks.length === 2 && chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942, 'Embedded JSON and BIN chunks');
  const gltf = JSON.parse(chunks[0].bytes.toString('utf8'));
  const bin = chunks[1].bytes;
  check(gltf.asset.version === '2.0' && gltf.buffers.length === 1 && !gltf.buffers[0].uri, 'Self-contained glTF 2.0 buffer');
  check(gltf.buffers[0].byteLength <= bin.length, 'Embedded buffer bounds');
  check(!gltf.images?.length && !gltf.textures?.length, 'No external textures');
  check(!gltf.cameras?.length && !gltf.extensions?.KHR_lights_punctual, 'Portable tower excludes studio cameras and lights');
  for (const view of gltf.bufferViews) assert((view.byteOffset ?? 0)+view.byteLength <= bin.length, 'Buffer view exceeds BIN');
  const components = { SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16 };
  const types = { 5120:[1,'getInt8'],5121:[1,'getUint8'],5122:[2,'getInt16'],5123:[2,'getUint16'],5125:[4,'getUint32'],5126:[4,'getFloat32'] };
  const dataView = new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
  function accessor(index) {
    const entry = gltf.accessors[index];
    assert(entry && !entry.sparse, 'Missing or sparse accessor');
    const view = gltf.bufferViews[entry.bufferView];
    const [size,reader] = types[entry.componentType] ?? [];
    const count = components[entry.type];
    assert(size && count, 'Unsupported accessor format');
    const stride = view.byteStride ?? size*count;
    const start = (view.byteOffset ?? 0)+(entry.byteOffset ?? 0);
    assert((entry.byteOffset ?? 0) + (entry.count-1)*stride+size*count <= view.byteLength, 'Accessor exceeds buffer view');
    return Array.from({ length: entry.count }, (_, i) => Array.from({ length: count }, (_, c) => dataView[reader](start+i*stride+c*size,true)));
  }
  const allPositions = [];
  const normalLengths = [];
  let triangles = 0, primitives = 0, vertices = 0;
  function visit(index, parent = identity()) {
    const node = gltf.nodes[index];
    const world = multiply(parent,matrix(node));
    assert(world.every(Number.isFinite), 'Nonfinite node transform');
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        assert((primitive.mode ?? 4) === 4, 'Expected triangle geometry');
        const positions = accessor(primitive.attributes.POSITION);
        assert(positions.flat().every(Number.isFinite), 'Nonfinite position');
        const indices = primitive.indices !== undefined ? accessor(primitive.indices).flat() : positions.map((_,i) => i);
        assert(indices.length % 3 === 0, 'Incomplete triangles');
        assert(indices.every(i => Number.isInteger(i) && i >= 0 && i < positions.length), 'Index exceeds POSITION bounds');
        assert(primitive.material < gltf.materials.length, 'Missing primitive material');
        if (primitive.attributes.NORMAL !== undefined) {
          const normals = accessor(primitive.attributes.NORMAL);
          assert(normals.length === positions.length && normals.flat().every(Number.isFinite), 'Invalid normals');
          normalLengths.push(...normals.map(n => Math.hypot(...n)));
        }
        allPositions.push(...positions.map(p => transform(p,world)));
        vertices += positions.length;
        triangles += indices.length/3;
        primitives++;
      }
    }
    for (const child of node.children ?? []) visit(child,world);
  }
  for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node);
  check(primitives > 0 && vertices > 1000 && triangles > 10000, 'Substantial tower geometry is present');
  check(normalLengths.every(n => Math.abs(n-1) < .002), 'All vertex normals are normalized');
  const bounds = {
    min:[0,1,2].map(axis => Math.min(...allPositions.map(p => p[axis]))),
    max:[0,1,2].map(axis => Math.max(...allPositions.map(p => p[axis]))),
  };
  const dimensions = bounds.max.map((v,i) => v-bounds.min[i]);
  check(dimensions[0] > 124 && dimensions[0] < 145 && dimensions[2] > 124 && dimensions[2] < 145, 'Tower has a complete square base footprint');
  check(bounds.min[1] > -10 && bounds.min[1] < 1 && bounds.max[1] > 329 && bounds.max[1] < 331, 'Meter scale and Y-up 330 m summit');
  const silhouette = [[0,15],[52,60],[110,120],[190,220],[275,289],[315,331]].map(([low,high]) => {
    const positions = allPositions.filter(p => p[1] >= low && p[1] <= high);
    assert(positions.length > 0, `No geometry at height ${low}–${high}`);
    return {
      heightRangeMeters:[low,high], vertices:positions.length,
      widthMeters: round(Math.max(...positions.map(p => p[0]))-Math.min(...positions.map(p => p[0]))),
      depthMeters: round(Math.max(...positions.map(p => p[2]))-Math.min(...positions.map(p => p[2]))),
    };
  });
  check(silhouette[0].widthMeters > silhouette[2].widthMeters && silhouette[2].widthMeters > silhouette[3].widthMeters && silhouette[3].widthMeters > silhouette[5].widthMeters, 'Full height lattice silhouette tapers from feet to antenna');
  check(triangles === info.triangles, 'Export triangle count matches procedural source');
  check(info.constructionStages.length === 6 && gltf.nodes.filter(node => node.extras?.construction_stage && node.mesh === undefined).length === 6, 'Six editable construction stages preserved');
  const blendHeader = blend.subarray(0,7).toString('ascii') === 'BLENDER';
  const compressedBlend = blend.readUInt32LE(0) === 0xfd2fb528 || blend.readUInt16LE(0) === 0x8b1f;
  check(blend.length > 100000 && (blendHeader || compressedBlend), 'Native Blender file or Blender compressed file header');
  check(info.blendReadback?.passed && info.blendReadback.meshes === primitives && info.blendReadback.stages === 6, 'Blender reopened saved file and verified editable meshes and six stages');
  check(info.sourceSha256 === createHash('sha256').update(source).digest('hex'), 'Exports match current procedural model source');
  Object.assign(report, {
    glbBytes:bytes.length, blendBytes:blend.length,
    glbSha256:createHash('sha256').update(bytes).digest('hex'),
    blendSha256:createHash('sha256').update(blend).digest('hex'),
    sourceSha256:info.sourceSha256,
    primitives, vertices, triangles, materials:gltf.materials.length,
    boundsYUp:{ min:bounds.min.map(round),max:bounds.max.map(round) },
    dimensionsMeters:dimensions.map(round),silhouette,passed:true,
  });
} catch(error) {
  report.error = error.stack;
  process.exitCode = 1;
}
await fs.writeFile(path.join(directory,'asset-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
