import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),d=require('../canton-atlas/web/immersive/fusion-district.js'),catalog=require('../canton-atlas/web/immersive/fusion-catalog.js');
test('manual exploration has valid stops, does not loop at completion',()=>{assert.ok(d.ids.every(id=>catalog.get(id)));assert.equal(d.next('museum'),'library');assert.equal(d.next('library'),'opera');assert.equal(d.next('opera'),null);assert.equal(d.next('unknown'),null);});
test('district overview centers anchors and fits narrow screens farther out',()=>{const points=[{x:0,z:0},{x:-440,z:-40},{x:-85,z:-160}],wide=d.fit(points,1.8,48),narrow=d.fit(points,.46,48);assert.deepEqual(wide.target,[-220,0,-80]);assert.ok(narrow.radius>wide.radius);assert.ok(wide.radius>520);assert.ok(narrow.radius<4300);});
test('district camera keeps landmark extents inside wide and portrait viewports',()=>{
 const T=require('../canton-atlas/web/immersive/three.min.js');const points=[{x:0,z:0},{x:-440,z:-40},{x:-85,z:-160}];
 for(const aspect of [1.8,.46]){const v=d.fit(points,aspect,48),camera=new T.PerspectiveCamera(48,aspect,1,12000),target=new T.Vector3(...v.target);camera.position.set(target.x,target.y+v.radius*Math.cos(v.phi),target.z+v.radius*Math.sin(v.phi));camera.lookAt(target);camera.updateMatrixWorld();
 for(const point of points)for(const dx of [-65,65])for(const dz of [-65,65])for(const y of [0,55]){const p=new T.Vector3(point.x+dx,y,point.z+dz).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1);}}
});
