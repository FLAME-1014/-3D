import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const catalog=createRequire(import.meta.url)('../canton-atlas/web/immersive/fusion-catalog.js');
test('catalog supports names/aliases/empty results and landmark-specific views',()=>{
  assert.equal(catalog.search('').length,3);
  assert.equal(catalog.search(' 省博 ')[0].id,'museum');
  assert.equal(catalog.search('大剧院')[0].id,'opera');
  assert.equal(catalog.search('不存在').length,0);
  assert.equal(catalog.get('opera').views.find(v=>v.id==='entry').label,'玻璃口部');
  assert.equal(catalog.get('museum').views.find(v=>v.id==='entry').label,'西门入口');
  assert.equal(new Set(catalog.places.map(p=>p.id)).size,catalog.places.length);
});

test('all landmarks share complete registration metadata',()=>{
 const geo=createRequire(import.meta.url)('../canton-atlas/web/immersive/fusion-geo.js');
 for(const p of catalog.places){assert.ok(geo.anchors[p.anchor]);assert.ok(p.name&&p.en&&p.size&&p.height&&p.content);assert.ok(p.labelPriority>0);assert.equal(p.poi.radius,800);assert.ok(p.model.script&&p.model.global);assert.equal(new Set(p.views.map(v=>v.id)).size,p.views.length);assert.ok(p.views.every(v=>v.offset.length===3&&v.radius>90));}
 assert.equal(catalog.search('广图')[0].id,'library');assert.equal(catalog.get('library').level,'体量样板');
});
