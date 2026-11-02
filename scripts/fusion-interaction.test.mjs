import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const h=createRequire(import.meta.url)('../canton-atlas/web/immersive/fusion-interaction.js');
test('label priorities avoid panels, bounds and other labels',()=>{
const base={left:10,top:10,right:100,bottom:40};const items=[{...base,id:'low',priority:1},{...base,id:'high',priority:10},{left:200,top:20,right:250,bottom:50,priority:5,id:'panel'},{left:-10,top:50,right:50,bottom:80,priority:8,id:'outside'}];
assert.deepEqual(h.selectLabels(items,[{left:190,top:10,right:260,bottom:60}],{width:300,height:200},3).map(x=>x.id),['high']);
});
test('pan scales with distance and rotates with camera heading',()=>{
const a=h.pan(10,0,100,0,1000,48),b=h.pan(10,0,200,0,1000,48);assert.ok(a.x<0);assert.equal(a.z,0);assert.equal(b.x,a.x*2);const c=h.pan(10,0,100,Math.PI/2,1000,48);assert.ok(c.z>0);assert.ok(Math.abs(c.x)<1e-10);
});
test('label caps and spacing remain predictable on small screens',()=>{
 const items=Array.from({length:6},(_,i)=>({id:i,priority:6-i,left:i*50,top:10,right:i*50+30,bottom:35}));
 assert.equal(h.selectLabels(items,[],{width:320,height:740},3).length,3);
 assert.equal(h.overlaps({left:0,top:0,right:30,bottom:30},{left:35,top:0,right:60,bottom:30},8),true);
 assert.equal(h.overlaps({left:0,top:0,right:30,bottom:30},{left:40,top:0,right:60,bottom:30},8),false);
});
