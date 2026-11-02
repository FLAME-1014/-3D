import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),catalog=require('../canton-atlas/web/immersive/fusion-catalog.js'),data=require('../canton-atlas/web/immersive/fusion-poi-data.js');
test('POI cache isolates landmark/category and ignores late results',async()=>{
 const status={},list={replaceChildren(){},append(){}},retry={},buttons=['food','shopping'].map(category=>({dataset:{poiCategory:category},setAttribute(){}}));
 const pending=[];let calls=0;
 function PlaceSearch(){this.search=(name,done)=>done('complete',{poiList:{pois:[{name,location:[113.32,23.12]}]}});this.searchNearBy=(_,center,radius,done)=>{assert.equal(radius,800);calls++;pending.push(done);};}
 const window={FusionCatalog:catalog,FusionPoiData:data,CANTON_AMAP:{enabled:true,key:'test',securityJsCode:'test'},AMap:{PlaceSearch}};
 const document={getElementById:id=>({'poi-list':list,'poi-status':status,'poi-retry':retry}[id]),querySelectorAll:()=>buttons,createElement:()=>({append(){}})};
 vm.runInNewContext(fs.readFileSync(new URL('../canton-atlas/web/immersive/fusion-poi.js',import.meta.url),'utf8'),{window,document,setTimeout,clearTimeout});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));const complete=()=>pending.shift()('no_data');
 window.FusionPoi.activate('museum');await settle();complete();await settle();
 window.FusionPoi.activate('library');await settle();complete();await settle();assert.equal(calls,2);
 window.FusionPoi.activate('museum');await settle();assert.equal(calls,2);
 buttons[1].onclick();await settle();assert.equal(calls,3);
 window.FusionPoi.activate('opera');await settle();assert.equal(calls,4);const before=status.textContent;
 complete();await settle();assert.equal(status.textContent,before);complete();await settle();
 window.FusionPoi.activate('museum');await settle();assert.equal(calls,4);
});
