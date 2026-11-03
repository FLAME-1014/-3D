import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {createRequire} from 'node:module';
const contract=createRequire(import.meta.url)('../canton-atlas/web/js/spot-contract.js');
import { workspace } from './preview.mjs';
const root = path.join(workspace, 'canton-atlas/web');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
let failed = false; let js = 0; let refs = 0;
const content=path.join(workspace,'canton-atlas/content');
for (const file of files(root).concat(files(content))) {
  if (file.endsWith('.js')) {
    js++;
    const result = spawnSync(process.execPath, file.startsWith(content)?['--input-type=module','--check']:['--check', file], { encoding: 'utf8', ...(file.startsWith(content)?{input:fs.readFileSync(file,'utf8')}:{}) });
    if (result.status !== 0) { failed = true; console.error('Syntax failed: ' + path.relative(workspace, file)); }
  }
  if(path.basename(file)==='spot.json'&&path.basename(path.dirname(file))!=='_template'){
    try{const card=JSON.parse(fs.readFileSync(file,'utf8'));const errors=contract.validate(card,path.basename(path.dirname(file)));if(!fs.existsSync(path.join(path.dirname(file),'model.js'))&&card.status!=='draft')errors.push('非草稿数据卡缺少 model.js');if(errors.length){failed=true;console.error(path.relative(workspace,file)+': '+errors.join('; '));}}catch(error){failed=true;console.error('Invalid data card: '+path.relative(workspace,file)+' '+error.message);}
  }
  if (file.endsWith('.html')) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const url = match[1]; if (/^(https?:|data:|#|mailto:|javascript:)/i.test(url)) continue;
      refs++;
      if (!fs.existsSync(path.resolve(path.dirname(file), url.split(/[?#]/)[0]))) { failed = true; console.error('Missing local reference in ' + path.relative(workspace, file)); }
    }
  }
}
const fallback = fs.readFileSync(path.join(root, 'immersive/poi-config.js'), 'utf8');
if (!/enabled:\s*false/.test(fallback) || !/key:\s*""/.test(fallback) || !/securityJsCode:\s*""/.test(fallback)) { failed = true; console.error('Source configuration must be disabled and credential-free.'); }
console.log(`Checked ${js} JavaScript files and ${refs} local HTML references. ${failed ? 'FAIL' : 'PASS'}`);
process.exitCode = failed ? 1 : 0;
