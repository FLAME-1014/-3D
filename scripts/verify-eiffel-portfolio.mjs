import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
import {createPreview, workspace} from './preview.mjs';

const output = path.join(workspace, 'output/eiffel-portfolio');
await fs.mkdir(output, {recursive:true});
const preview = createPreview({configPath:'missing-integration-config.json'});
const prefix = '/-3D';
const server = http.createServer((req,res)=>{
  if(!req.url.startsWith(prefix+'/')){res.writeHead(404);res.end();return}
  req.url=req.url.slice(prefix.length);preview.emit('request',req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}${prefix}`;
const report={startedAt:new Date().toISOString(),checks:[],errors:[],httpErrors:[]};
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:false});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()})});
  const loadPortfolio=async()=>{await page.goto(base+'/portrait-portfolio/');await page.waitForFunction(()=>window.__PORTFOLIO_READY__===true)};
  await loadPortfolio();
  assert.equal(await page.locator('.project-card').count(),6);
  const card=page.locator('.project-card[href="../eiffel-tower/"]');
  await card.scrollIntoViewIfNeeded();
  await card.locator('img').evaluate(image=>image.decode());
  await page.locator('#work').screenshot({path:path.join(output,'projects-desktop.png')});
  await card.click();
  await page.waitForFunction(()=>window.eiffelDiagnostics?.().ready===true);
  assert.equal(new URL(page.url()).pathname,prefix+'/eiffel-tower/');
  assert.ok(await page.evaluate(()=>window.eiffelDiagnostics().render.calls>0));
  for(const file of ['eiffel-tower.glb','eiffel-tower.blend']){
    const response=await page.request.get(base+'/eiffel-tower/'+file);
    assert.equal(response.status(),200);assert.ok((await response.body()).length>100000);
  }
  await page.getByTestId('portfolio-return').click();
  await page.waitForFunction(()=>window.__PORTFOLIO_READY__===true);
  assert.equal(new URL(page.url()).pathname,prefix+'/portrait-portfolio/');
  assert.equal(new URL(page.url()).hash,'#work');
  report.checks.push('desktop six cards, tower render, both downloads, return under repository subpath');
  await page.setViewportSize({width:390,height:844});
  await card.scrollIntoViewIfNeeded();await card.locator('img').evaluate(image=>image.decode());
  await card.screenshot({path:path.join(output,'card-mobile.png')});
  await card.click();await page.waitForFunction(()=>window.eiffelDiagnostics?.().ready===true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await page.getByTestId('portfolio-return').isVisible());
  await page.getByTestId('portfolio-return').click();await page.waitForFunction(()=>window.__PORTFOLIO_READY__===true);
  report.checks.push('mobile tower card and return navigation without overflow');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;process.exitCode=1}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify(report,null,2));
