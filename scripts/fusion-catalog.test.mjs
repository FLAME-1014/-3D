import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const catalog=createRequire(import.meta.url)('../canton-atlas/web/immersive/fusion-catalog.js');
test('catalog supports names/aliases/empty results and landmark-specific views',()=>{
  assert.equal(catalog.search('').length,2);
  assert.equal(catalog.search(' 省博 ')[0].id,'museum');
  assert.equal(catalog.search('大剧院')[0].id,'opera');
  assert.equal(catalog.search('不存在').length,0);
  assert.equal(catalog.get('opera').views.find(v=>v.id==='entry').label,'玻璃口部');
  assert.equal(catalog.get('museum').views.find(v=>v.id==='entry').label,'西门入口');
  assert.equal(new Set(catalog.places.map(p=>p.id)).size,catalog.places.length);
});
