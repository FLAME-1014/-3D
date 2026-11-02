import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const data=createRequire(import.meta.url)('../canton-atlas/web/immersive/fusion-poi-data.js');
test('POI helpers validate coordinates, preserve datum and encode external links',()=>{
  const p=data.normalize({name:'测试 & 商店',location:'113.327,23.117',distance:'42.3',address:'测试地址'});
  assert.equal(p.system,'GCJ-02');assert.equal(p.distance,42);
  const url=new URL(data.link(p));assert.equal(url.hostname,'uri.amap.com');assert.equal(url.searchParams.get('name'),p.name);assert.equal(url.searchParams.get('coordinate'),'gaode');
  assert.equal(data.link({...p,system:'WGS84'}),null);assert.equal(data.link({...p,location:[NaN,23]}),null);
  assert.equal(data.coord('0,0'),null);assert.equal(data.normalize({}).distance,null);
});
