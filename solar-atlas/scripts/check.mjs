import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PLANETS, MOON, MISSIONS, orbitalPosition, EPOCH, OCEAN_CURRENTS } from '../src/data.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const file of ['server.mjs','config.js','src/data.js','src/scene.js','src/app.js','src/environment.js','scripts/fetch-assets.mjs','scripts/verify.mjs']){
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});assert.equal(result.status,0,`${file}: ${result.stderr}`);
}
const all=[...PLANETS,MOON,...MISSIONS];assert.equal(new Set(all.map(p=>p.id)).size,all.length,'IDs must be unique');
for(const p of PLANETS.filter(p=>p.a)){
  for(const factor of [0,.125,.5,.9,1]){
    const xyz=orbitalPosition(p,EPOCH+p.period*86400000*factor);assert(xyz.every(Number.isFinite));const r=Math.hypot(...xyz);assert(r>=p.a*(1-p.e)-1e-8&&r<=p.a*(1+p.e)+1e-8,`${p.id}: distance bounds`);
  }
  const start=orbitalPosition(p,EPOCH),end=orbitalPosition(p,EPOCH+p.period*86400000);assert(Math.hypot(...start.map((v,i)=>v-end[i]))<1e-7,`${p.id}: closed orbit`);
}
for(const mission of MISSIONS){assert(PLANETS.some(p=>p.id===mission.body)||mission.body==='moon');assert(mission.year>=1957);assert(mission.milestones.length);}
for(const current of OCEAN_CURRENTS)for(const [lon,lat] of current.points){assert(Math.abs(lon)<=180&&Math.abs(lat)<=90);}
for(const name of [...PLANETS.map(p=>p.id),'moon','earth-night','earth-clouds','milky-way'])assert((await fs.stat(path.join(root,`assets/textures/${name}.jpg`))).size>100);
const catalog=JSON.parse(await fs.readFile(path.join(root,'assets/catalog/constellations.json'),'utf8'));assert.equal(catalog.figures.length,88);assert(catalog.stars.length>1000);
const html=await fs.readFile(path.join(root,'index.html'),'utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'HTML IDs must be unique');
console.log(`PASS · syntax, ${PLANETS.length+1} worlds, ${MISSIONS.length} missions, orbital invariants, local assets, 88 constellations and unique HTML IDs`);
