import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const geo=require('../canton-atlas/web/immersive/fusion-geo.js');
test('regional projection uses explicit WGS84, meter scale and consistent directions',()=>{
  assert.deepEqual(geo.toLocal(geo.origin,'WGS84'),{x:0,z:0});
  const tower=geo.toLocal(geo.anchors.tower.coord,'WGS84');
  assert.ok(tower.x<0&&tower.z>900&&tower.z<950);
  assert.ok(geo.toLocal(geo.anchors.opera.coord,'WGS84').x<-400);
  assert.ok(geo.toLocal(geo.anchors.library.coord,'WGS84').z<-150);
  for(const a of Object.values(geo.anchors)){
    const back=geo.toGeo(geo.toLocal(a.coord,'WGS84'));
    assert.ok(Math.abs(back[0]-a.coord[0])<1e-10&&Math.abs(back[1]-a.coord[1])<1e-10);
  }
  assert.throws(()=>geo.toLocal(geo.origin,'GCJ-02'));
  assert.throws(()=>geo.toLocal([NaN,23],'WGS84'));
  assert.throws(()=>geo.toLocal([0,0],'WGS84'));
});
