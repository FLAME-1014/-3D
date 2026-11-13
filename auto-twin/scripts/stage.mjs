import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const stage=process.argv[2]||'01';
const shop=process.argv[3]||'park';
const browser=await chromium.launch({headless:false,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto('http://127.0.0.1:4200/'+(shop==='park'?'':`?shop=${shop}`));
await page.waitForFunction(()=>window.__workshop?.debug().frames>2);
await page.evaluate(({station,time,quality,close})=>{window.__workshop.pause?.();window.__workshop.seek(time);if(station!==null)window.__workshop.station(station);if(quality)window.__workshop.quality(quality);if(close&&station!==null){const x=window.__workshop.debug().stations[station].x;window.__workshop.camera([x+4,4.8,6.5],[x,2,0])}},{station:process.argv[4]===undefined?null:Number(process.argv[4]),time:process.argv[5]===undefined?34.2:Number(process.argv[5]),quality:process.argv[6]||null,close:process.argv[7]==='close'});
await page.waitForTimeout(600);
const diagnostic=await page.evaluate(()=>window.__workshop.debug());
await fs.mkdir('docs/screenshots',{recursive:true});
await page.screenshot({path:`docs/screenshots/stage-${stage}-${shop}.png`});
await fs.writeFile(`docs/screenshots/stage-${stage}-${shop}.json`,JSON.stringify({stage,shop,errors,diagnostic},null,2));
console.log(JSON.stringify({stage,errors,diagnostic:{...diagnostic,poses:undefined,pickableScreens:undefined,componentScreens:undefined,details:diagnostic.details?{...diagnostic.details,robotContacts:undefined,lod:undefined}:undefined,frameIntervals:undefined}},null,2));
if(errors.length)process.exitCode=1;
} finally {await browser.close()}
