import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.THREE=require('../canton-atlas/web/immersive/three.min.js');
const model=require('../canton-atlas/web/immersive/library-model.js');
test('library massing stays local, bounded and reuses low-cost geometry',()=>{
 const a=model.build({low:true}),b=model.build({low:false});
 const bounds=new THREE.Box3();a.root.updateMatrixWorld(true);a.root.traverse(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();if(o.isInstancedMesh){for(let i=0;i<o.count;i++){const matrix=new THREE.Matrix4();o.getMatrixAt(i,matrix);bounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix));}}else bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});
 assert.ok(bounds.min.x>-70&&bounds.max.x<70);
 assert.equal(bounds.min.y,0);assert.ok(Math.abs(bounds.max.y-50)<1e-4);
 assert.ok(bounds.min.z>=-43&&bounds.max.z<=43);
 const geo=new Set(),mat=new Set();a.root.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)mat.add(o.material);});
 assert.equal(geo.size,1);assert.equal(mat.size,3);
 assert.notEqual(a.root.children[0].geometry,b.root.children[0].geometry);
 const instanced=a.root.children.find(o=>o.isInstancedMesh);assert.equal(instanced.count,18);
 geo.forEach(g=>g.dispose());mat.forEach(m=>m.dispose());
});

