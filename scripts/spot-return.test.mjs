import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../canton-atlas/web/js/diorama.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  function backAtlas('),source.indexOf('\n  function ',source.indexOf('  function backAtlas(')+10));
test('standalone return uses native link, embedded return stops resources and messages parent',()=>{
 const html=fs.readFileSync(new URL('../canton-atlas/web/spot.html',import.meta.url),'utf8');assert.match(html,/<a[^>]+id="backAtlas"[^>]+href="index.html"/);
 for(const embed of [false,true]){let stopped=0,prevented=0,messages=[];const location={search:embed?'?embed=1':'',origin:'http://localhost:4188'},window={parent:{postMessage:(m,o)=>messages.push([m,o])},location:{}};
 const context={window,location,URLSearchParams,cleanup:()=>stopped++,event:{preventDefault:()=>prevented++}};vm.runInNewContext(body+'\nbackAtlas(event);',context);
 assert.equal(prevented,embed?1:0);assert.equal(stopped,embed?1:0);assert.equal(messages.length,embed?1:0);if(embed){assert.equal(messages[0][0].type,'canton-close-immersive');assert.equal(messages[0][1],location.origin);}
 }
});
