import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
import {createPreview, workspace} from './preview.mjs';

const output = path.join(workspace, 'output/workshop-portfolio');
await fs.mkdir(output, {recursive:true});
const preview = createPreview({configPath:'missing-config-for-integration.json'});
// Exercise repository-relative links exactly as a GitHub project site would.
const prefix = '/-3D';
const server = http.createServer((request, response) => {
  if (!request.url.startsWith(prefix + '/')) {response.writeHead(404); response.end(); return}
  request.url = request.url.slice(prefix.length);
  preview.emit('request', request, response);
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = origin + prefix;
const report = {startedAt:new Date().toISOString(),base,checks:[],errors:[],failedRequests:[]};
let browser;
try {
  browser = await chromium.launch({channel:'chrome',headless:false});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)report.failedRequests.push({url:response.url(),status:response.status()})});
  await page.goto(base+'/portrait-portfolio/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__PORTFOLIO_READY__===true);
  const card=page.locator('.project-card[href="../auto-twin/"]');
  assert.equal(await card.count(),1);
  assert.equal(await card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  await page.locator('#work').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'portfolio-work.png')});
  report.checks.push('portfolio shows workshop card and cover');
  await card.click();
  const settle=async shop=>{
    await page.waitForFunction(shop=>window.__workshop?.metrics().shop===shop&&window.__workshop.metrics().frames>0&&!document.querySelector('[data-testid="workshop-loading"]'),shop);
    assert.ok(new URL(page.url()).pathname.startsWith(prefix+'/auto-twin/'));
    assert.equal(await page.locator('canvas').count(),1);
  };
  await settle('park');
  await page.screenshot({path:path.join(output,'park.png')});
  report.checks.push('portfolio card opens built workshop under project subpath');
  for(const shop of ['stamping','welding']){
    await page.getByTestId('park-enter-'+shop).click();await settle(shop);
    assert.equal(new URL(page.url()).searchParams.get('shop'),shop);
    await page.getByTestId('portfolio-return').click();
    await page.waitForFunction(()=>window.__PORTFOLIO_READY__===true);
    assert.equal(new URL(page.url()).pathname,prefix+'/portrait-portfolio/');
    assert.equal(new URL(page.url()).hash,'#work');
    await page.locator('.project-card[href="../auto-twin/"]').click();await settle('park');
    await page.goto(base+'/auto-twin/?shop='+shop);await settle(shop);
    await page.getByTestId('shop-home').click();await settle('park');
    report.checks.push(shop+': entrance, return to portfolio, direct URL, park return');
  }
  await page.getByTestId('portfolio-return').click();
  await page.waitForFunction(()=>window.__PORTFOLIO_READY__===true);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#work').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('.project-card[href="../auto-twin/"]').isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(output,'portfolio-mobile.png')});
  report.checks.push('mobile card visible without page overflow');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);
  report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify(report,null,2));
