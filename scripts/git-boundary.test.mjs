import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {workspace} from './preview.mjs';

const privatePaths=[
 '.local/amap.development.json','.local/amap.production.json',
 '.env','.env.production','高德3d地图案例.html',
 '中山纪念堂近景_第一版验收_2026-10-31_附件/photo.png',
 '广州大剧院近景_最终验收_2026-10-31/photo.png',
 'canton-atlas/content/spots/chenjiaci/refs/overlay/reference-front.jpg',
 'canton-atlas/content/spots/chenjiaci/refs/overlay/reference-hall-front.jpg',
 'canton-atlas/content/spots/chenjiaci/refs/overlay/rough-hall-overlay.png',
 'canton-atlas/content/spots/chenjiaci/refs/overlay/overlay-front-hall.png',
 'canton-atlas/content/spots/future/refs/overlay/reference-front.jpg',
 'canton-atlas/dist/index.html'
];
function ignored(path){const r=spawnSync('git',['check-ignore','--no-index','--stdin'],{cwd:workspace,input:path+'\n',encoding:'utf8'});assert.ok(r.status===0||r.status===1,r.stderr);return r.status===0;}
test('private local files remain ignored while authored model assets stay eligible',()=>{
 for(const p of privatePaths)assert.equal(ignored(p),true,'Must remain local: '+p);
 for(const p of ['canton-atlas/web/immersive/poi-config.js','canton-atlas/content/spots/beijinglu/model.js','canton-atlas/content/spots/beijinglu/spot.json','canton-atlas/content/spots/beijinglu/refs/preview/preview-overview.png','canton-atlas/content/spots/chenjiaci/refs/overlay/model-front-silhouette.png','canton-atlas/content/spots/chenjiaci/refs/overlay/SOURCE.md','中山纪念堂近景_第一版验收_2026-10-31.md'])assert.equal(ignored(p),false,'Must remain eligible: '+p);
});
test('Git index contains no ignored local files (including force-added files)',()=>{
 const r=spawnSync('git',['ls-files','-ci','--exclude-standard','-z'],{cwd:workspace,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 assert.deepEqual(r.stdout.split('\0').filter(Boolean),[],'Ignored files are already tracked or staged; inspect paths without printing their contents.');
});
