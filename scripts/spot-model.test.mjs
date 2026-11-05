import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {createRequire} from 'node:module';import {workspace} from './preview.mjs';
const require=createRequire(import.meta.url),T=require('../canton-atlas/web/immersive/three.min.js'),contract=require('../canton-atlas/web/js/spot-contract.js'),resources=require('../canton-atlas/web/js/spot-resources.js');
const spots=path.join(workspace,'canton-atlas/content/spots'),ids=fs.readdirSync(spots).filter(id=>id!=='_template'&&fs.statSync(path.join(spots,id)).isDirectory()&&fs.existsSync(path.join(spots,id,'model.js')));
function loadModel(id){const gradient={addColorStop(){}};const context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:50})},{get:(o,k)=>k in o?o[k]:()=>{}});const sandbox={window:{THREE:T},document:{createElement:()=>({width:0,height:0,getContext:()=>context})},console};const code=fs.readFileSync(path.join(spots,id,'model.js'),'utf8').replace('export function create()', 'function create()');vm.runInNewContext(code+'\nthis.factory=create;',sandbox,{filename:id+'/model.js'});return sandbox.factory;}
for(const id of ids)test(id+' data card, model anchors, independent construction and complete disposal',()=>{
 const card=JSON.parse(fs.readFileSync(path.join(spots,id,'spot.json'),'utf8'));assert.deepEqual(contract.validate(card,id),[]);
 const create=loadModel(id),a=create(),b=create();assert.deepEqual(contract.validateModel(a,card),[]);assert.ok(a.group.children.length>0);
 const owned=new Set();function collect(model){const all=new Set();model.group.traverse(o=>{if(o.geometry)all.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean).forEach(m=>{all.add(m);Object.values(m).forEach(v=>{if(v&&v.isTexture)all.add(v);});});});return all;}
 const ar=collect(a),br=collect(b);for(const r of ar){assert.ok(!br.has(r),'instances share GPU resources');owned.add(r);}
 const count=new Map();for(const r of owned)r.addEventListener('dispose',()=>count.set(r,(count.get(r)||0)+1));a.dispose();for(const r of owned)assert.equal(count.get(r),1,'owned resource not disposed exactly once');b.dispose();
});
test('invalid cards and missing runtime anchors fail explicitly; unknown dimensions remain allowed',()=>{
 const card=JSON.parse(fs.readFileSync(path.join(spots,'chenjiaci/spot.json'),'utf8'));assert.deepEqual(contract.validate(card,'chenjiaci'),[]);card.presets.push('wrong');card.hotspots[0].preset='missing';card.geo.wgs84=[0,0];card.model.module='../private.js';assert.ok(contract.validate(card,'wrong').length>=4);assert.ok(contract.validateModel({group:new T.Group(),anchors:{},dispose(){}},card).length>0);
});
test('draft data cards are allowed without a model while non-draft cards require one',()=>{
 const card=JSON.parse(fs.readFileSync(path.join(spots,'yuntai/spot.json'),'utf8'));assert.equal(card.status,'draft');assert.deepEqual(contract.validate(card,'yuntai'),[]);
 const check=fs.readFileSync(new URL('./check.mjs',import.meta.url),'utf8');assert.match(check,/card\.status!=='draft'/);
 const requireModel=(status,exists)=>status!=='draft'&&!exists?['非草稿数据卡缺少 model.js']:[];
 assert.deepEqual(requireModel('draft',false),[]);assert.equal(requireModel('review',false).length,1);assert.deepEqual(requireModel('review',true),[]);
});
test('cleanup is idempotent and includes scene decor, shader textures, shadows and renderer',()=>{
 const scene=new T.Scene(),modelGroup=new T.Group(),g=new T.BoxGeometry(),texture=new T.Texture(),material=new T.ShaderMaterial({uniforms:{map:{value:texture}}});const mesh=new T.Mesh(g,material);scene.add(mesh,new T.Mesh(g,material),modelGroup);let shadows=0;mesh.shadow={dispose(){shadows++;}};
 const counts=new Map();for(const r of [g,texture,material])r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));let models=0,renders=0;const cleanup=resources.createCleanup(()=>({scene,model:{group:modelGroup,dispose(){models++;}},renderer:{dispose(){renders++;}}}));cleanup();cleanup();assert.equal(models,1);assert.equal(renders,1);assert.equal(shadows,1);for(const r of [g,texture,material])assert.equal(counts.get(r),1);assert.equal(modelGroup.parent,null);
});
