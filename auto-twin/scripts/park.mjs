import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv[2]||`docs/verification/stage-07-${new Date().toISOString().replace(/[:.]/g,'-')}`;
await fs.mkdir('docs/verification',{recursive:true});
await fs.mkdir(output);
const browser=await chromium.launch({headless:false,channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const report={startedAt:new Date().toISOString(),output,checks:[],errors:[]};page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text())});
const settle=async()=>{await page.waitForFunction(()=>window.__workshop&&window.__workshop.debug().frames>0&&!window.__workshop.debug().cameraMoving);await page.waitForFunction(()=>!document.querySelector('[data-testid="workshop-loading"]'));await page.waitForTimeout(120)};
const pick=async(id)=>{
 const projected=await page.evaluate(id=>window.__workshop.debug().pickableScreens.find(p=>p.id===id&&p.visible),id);assert.ok(projected,`projected ${id} building required`);
 for(const [dx,dy] of [[0,0],[0,-10],[10,0],[-10,0],[0,10],[20,-10],[-20,-10]]){
  await page.mouse.move(projected.x+dx,projected.y+dy);await page.waitForTimeout(40);
  if((await page.locator('.hover-info code').allTextContents()).includes(id)){await page.mouse.click(projected.x+dx,projected.y+dy);return}
 }
 throw Error(`Could not hit ${id} building via real pointer`);
};
try{
 await page.goto('http://127.0.0.1:4200/');await settle();await page.evaluate(()=>{window.__workshop.pause();window.__workshop.seek(34.2)});
 assert.equal(await page.locator('.park-kpi-bar').count(),1);assert.equal(await page.locator('.park-entry-cards button').count(),2);
 const initial=await page.evaluate(()=>window.__workshop.debug());assert.equal(initial.shop,'park');assert.equal(initial.rendererCount,1);assert.equal(initial.worldCount,1);
 report.checks.push({name:'campus/DOM/one scene',passed:true,details:initial.details});
 await page.screenshot({path:`${output}/park.png`});
 for(const id of ['paint','assembly']){await pick(id);await page.waitForTimeout(180);assert.equal((await page.evaluate(()=>window.__workshop.debug())).shop,'park');report.checks.push({name:`${id} remains planned`,passed:true})}
 for(const shop of ['stamping','welding']){
  await pick(shop);await page.waitForFunction(shop=>window.__workshop.debug().shop===shop,shop);await settle();
  const d=await page.evaluate(()=>window.__workshop.debug());assert.equal(d.rendererCount,1);assert.equal(d.worldCount,1);assert.equal(await page.locator('canvas').count(),1);assert.equal(new URL(page.url()).searchParams.get('shop'),shop);
  report.checks.push({name:`actual ${shop} building flight/route`,passed:true,disposedWorlds:d.disposedWorlds});
  await page.getByTestId('shop-home').click();await settle();assert.equal((await page.evaluate(()=>window.__workshop.debug())).shop,'park');
 }
 for(const shop of ['stamping','welding']){
  await page.getByTestId(`park-enter-${shop}`).click();await page.waitForFunction(shop=>window.__workshop.debug().shop===shop,shop);await settle();assert.equal(await page.locator('canvas').count(),1);report.checks.push({name:`${shop} DOM entrance/loader completion`,passed:true});
  await page.getByTestId('shop-home').click();await settle();
 }
 await page.getByTestId('park-enter-welding').click();await page.waitForFunction(()=>window.__workshop.debug().shop==='welding');await settle();
 await page.goBack();await settle();assert.equal((await page.evaluate(()=>window.__workshop.debug())).shop,'park');report.checks.push({name:'browser back to park',passed:true});
 await page.goForward();await settle();assert.equal((await page.evaluate(()=>window.__workshop.debug())).shop,'welding');report.checks.push({name:'browser forward to welding',passed:true});
 await page.getByTestId('shop-home').click();await settle();
 // Activate both controls within one browser task so automation's click waits cannot hide a pending-flight bug.
 assert.equal(await page.evaluate(()=>{document.querySelector('[data-testid="park-enter-stamping"]').click();const moving=window.__workshop.debug().cameraMoving;document.querySelector('[data-testid="shop-home"]').click();return moving}),true);
 await settle();await page.waitForTimeout(750);
 assert.equal((await page.evaluate(()=>window.__workshop.debug())).shop,'park','returning home must cancel a pending entrance');
 assert.equal(new URL(page.url()).searchParams.get('shop'),null);
 report.checks.push({name:'home cancels in-progress entrance',passed:true});
 await page.evaluate(()=>{document.querySelector('[data-testid="park-enter-stamping"]').click();document.querySelector('[data-testid="shop-welding"]').click()});
 await page.waitForFunction(()=>window.__workshop.debug().shop==='welding');await settle();
 report.checks.push({name:'latest header destination replaces pending entrance',passed:true});
 for(const shop of ['park','stamping','welding']){
  await page.goto('http://127.0.0.1:4200/'+(shop==='park'?'':`?shop=${shop}`));await settle();
  assert.equal((await page.evaluate(()=>window.__workshop.debug())).shop,shop);
  assert.equal(await page.locator('canvas').count(),1);
  report.checks.push({name:`${shop} direct URL and initial loader completion`,passed:true});
 }
 assert.equal(report.errors.length,0);report.status='passed';
}catch(error){report.status='failed';report.failure=error.message;process.exitCode=1}finally{report.finishedAt=new Date().toISOString();await browser.close();await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2))}
console.log(JSON.stringify({status:report.status,output,checks:report.checks.map(({name,passed})=>({name,passed})),failure:report.failure,errors:report.errors},null,2));
