/**
 * Practical browser checks for the local Eiffel Tower experience.
 * Run: node scripts/verify-eiffel-viewer.mjs [--base=http://127.0.0.1:4188]
 * Uses the installed Chrome and existing Playwright dependency.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createPreview, workspace } from './preview.mjs';

const out = path.join(workspace, 'output', 'eiffel-tower');
const baseArg = process.argv.find(arg => arg.startsWith('--base='))?.slice(7);
const chrome = process.env.EIFFEL_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const report = {
  startedAt: new Date().toISOString(), status: 'running', checks: [],
  screenshots: {}, diagnostics: {}, pageErrors: [], consoleErrors: [],
  failedRequests: [], httpErrors: [], externalRequests: [],
};
let server, browser, activePage, deadlineTimer;
const read = page => page.evaluate(() => window.eiffelDiagnostics());
const vector = value => Array.isArray(value) ? value : [value.x, value.y, value.z];
const distance = (a, b) => Math.hypot(...vector(a).map((value, i) => value - vector(b)[i]));
const state = (page, key, value) => page.waitForFunction(
  ({ key, value }) => window.eiffelDiagnostics().state[key] === value,
  { key, value }, { timeout: 12000 },
);
async function check(name, callback) {
  const entry = { name, status: 'running' }, start = Date.now();
  report.checks.push(entry);
  try {
    await callback();
    entry.status = 'passed';
    console.log(`PASS ${name}`);
  } catch (error) {
    entry.status = 'failed';
    entry.error = error.stack || String(error);
    console.error(`FAIL ${name}: ${error.message}`);
    if (activePage && !activePage.isClosed()) {
      try { entry.diagnostics = await read(activePage); } catch { /* Preserve failure. */ }
      try { await capture(activePage, `failed-check-${report.checks.length}`); } catch { /* Preserve failure. */ }
    }
  } finally { entry.durationMs = Date.now() - start; }
}
function observe(page, viewport, origin) {
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(45000);
  page.on('pageerror', error => report.pageErrors.push({ viewport, error: error.stack || error.message }));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push({ viewport, text: message.text() });
  });
  page.on('requestfailed', request => report.failedRequests.push({ viewport, url: request.url(), error: request.failure() }));
  page.on('response', response => {
    if (response.status() >= 400) report.httpErrors.push({ viewport, url: response.url(), status: response.status() });
  });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) report.externalRequests.push(request.url());
  });
}
async function load(page, url) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.eiffelDiagnostics?.().ready, null, { timeout: 60000 });
  await page.waitForFunction(() => window.eiffelDiagnostics().render.calls > 0);
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#loading').isVisible(), false);
  assert.equal(await page.locator('#stage canvas#scene').isVisible(), true);
  const data = await read(page);
  assert.ok(!data.error, 'Diagnostics should not contain an application error');
  assert.ok(data.model.meshes > 0 && data.render.triangles > 1000, 'The model needs real rendered geometry');
  assert.ok(Number.isFinite(data.model.height) && data.model.height > 0, 'Model height must be finite');
  assert.ok(vector(data.camera.position).every(Number.isFinite));
  const gl = await page.locator('#scene').evaluate(canvas => {
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return { live: Boolean(context && !context.isContextLost()), width: canvas.width, height: canvas.height };
  });
  assert.ok(gl.live && gl.width > 100 && gl.height > 100, 'WebGL must remain live');
}
async function capture(page, name) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  report.screenshots[name] = file;
}
async function noOverflow(page) {
  const bounds = await page.evaluate(() => ({
    width: innerWidth, document: document.documentElement.scrollWidth,
    stageScroll: document.querySelector('#stage').scrollLeft,
  }));
  assert.ok(bounds.document <= bounds.width + 1, `Horizontal overflow: ${JSON.stringify(bounds)}`);
  assert.equal(bounds.stageScroll, 0, 'Controls must not scroll the scene sideways');
}
async function cameraChanged(page, previous, amount = 0.1) {
  await page.waitForFunction(({ previous, amount }) => {
    const position = window.eiffelDiagnostics().camera.position;
    const next = Array.isArray(position) ? position : [position.x, position.y, position.z];
    return Math.hypot(...next.map((v, i) => v - previous[i])) > amount;
  }, { previous: vector(previous), amount });
}
async function setProgress(page, progress) {
  await page.locator('#build-progress').evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(progress));
  await page.waitForFunction(value => Math.abs(window.eiffelDiagnostics().state.progress - value) < 0.1, progress);
}
async function run(base) {
  const url = new URL('/eiffel-tower/', base).href;
  report.url = url;
  browser = await chromium.launch({
    executablePath: chrome, headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  report.browser = browser.version();
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  activePage = desktop;
  observe(desktop, 'desktop', new URL(base).origin);
  await check('desktop loads a real WebGL tower with finite geometry', async () => {
    await load(desktop, url);
    report.diagnostics.initial = await read(desktop);
    await noOverflow(desktop);
    await capture(desktop, 'desktop');
  });
  await check('canvas orbit, wheel zoom, zoom buttons and automatic rotation change the camera', async () => {
    if ((await read(desktop)).state.autoRotate) await desktop.locator('#auto-rotate').click();
    await state(desktop, 'autoRotate', false);
    const point = await desktop.locator('#scene').evaluate(canvas => {
      const b = canvas.getBoundingClientRect();
      for (const [rx, ry] of [[0.5, 0.5], [0.65, 0.5], [0.4, 0.65], [0.5, 0.3]]) {
        const x = b.x + b.width * rx, y = b.y + b.height * ry;
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
      return null;
    });
    assert.ok(point, 'Canvas needs an unobstructed area for orbit gestures');
    const start = await read(desktop);
    await desktop.mouse.move(point.x, point.y);
    await desktop.mouse.down();
    await desktop.mouse.move(point.x + 80, point.y - 25, { steps: 10 });
    await desktop.mouse.up();
    await cameraChanged(desktop, start.camera.position);
    let before = (await read(desktop)).camera.zoom;
    await desktop.mouse.move(point.x, point.y);
    await desktop.mouse.wheel(0, -160);
    await desktop.waitForFunction(previous => {
      return window.eiffelDiagnostics().camera.zoom > previous * 1.01;
    }, before);
    before = (await read(desktop)).camera.zoom;
    await desktop.locator('#zoom-out').click();
    await desktop.waitForFunction(previous => {
      return window.eiffelDiagnostics().camera.zoom < previous * 0.99;
    }, before);
    before = (await read(desktop)).camera.zoom;
    await desktop.locator('#zoom-in').click();
    await desktop.waitForFunction(previous => {
      return window.eiffelDiagnostics().camera.zoom > previous * 1.01;
    }, before);
    await desktop.locator('#auto-rotate').click();
    await state(desktop, 'autoRotate', true);
    assert.equal(await desktop.locator('#auto-rotate').getAttribute('aria-pressed'), 'true');
    await cameraChanged(desktop, (await read(desktop)).camera.position);
    await desktop.locator('#auto-rotate').click();
    await state(desktop, 'autoRotate', false);
  });
  await check('overview, front, top and detail presets produce distinct usable camera views', async () => {
    const cameras = {};
    for (const view of ['overview', 'front', 'top', 'detail']) {
      await desktop.locator(`[data-view="${view}"]`).click();
      await state(desktop, 'currentView', view);
      await desktop.waitForTimeout(1050);
      cameras[view] = (await read(desktop)).camera;
      assert.equal(await desktop.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'), 'true');
    }
    assert.ok(distance(cameras.front.position, cameras.top.position) > 1);
    assert.ok(distance(cameras.overview.position, cameras.detail.position) > 1);
    report.diagnostics.presets = cameras;
  });
  await check('first, second and summit markers focus their floor and dismiss their information card', async () => {
    const targets = [];
    for (const floor of ['first', 'second', 'summit']) {
      await desktop.locator(`#floor-list [data-floor="${floor}"]`).click();
      await state(desktop, 'selectedFloor', floor);
      assert.equal(await desktop.locator('#detail-card').isVisible(), true);
      assert.ok((await desktop.locator('#detail-card').textContent()).trim().length > 30);
      await desktop.waitForTimeout(1000);
      targets.push((await read(desktop)).camera.target);
      await desktop.locator('#close-detail').click();
      assert.equal(await desktop.locator('#detail-card').isVisible(), false);
    }
    assert.ok(distance(targets[0], targets[2]) > 1, 'Floor focus must move the camera target');
    report.diagnostics.floorTargets = targets;
  });
  await check('night lighting and wireframe toggles update renderer state', async () => {
    await desktop.locator('[data-view="overview"]').click();
    await desktop.locator('#night-mode').click();
    await state(desktop, 'night', true);
    assert.equal(await desktop.locator('#night-mode').getAttribute('aria-pressed'), 'true');
    await desktop.waitForTimeout(1000);
    await capture(desktop, 'night');
    await desktop.locator('#wireframe').click();
    await state(desktop, 'wireframe', true);
    assert.equal(await desktop.locator('#wireframe').getAttribute('aria-pressed'), 'true');
    await desktop.locator('#wireframe').click();
    await state(desktop, 'wireframe', false);
    await desktop.locator('#night-mode').click();
    await state(desktop, 'night', false);
  });
  await check('construction slider changes physical stage visibility, replay advances, and explore restores the tower', async () => {
    await desktop.locator('[data-mode="build"]').click();
    await state(desktop, 'mode', 'build');
    await setProgress(desktop, 100);
    const complete = await read(desktop);
    await setProgress(desktop, 35);
    const partial = await read(desktop);
    assert.notDeepEqual(partial.model.stageVisibility, complete.model.stageVisibility, 'Construction stages must actually change visibility');
    await capture(desktop, 'construction');
    await setProgress(desktop, 0);
    await desktop.locator('#build-play').click({ timeout: 30000 });
    await desktop.waitForFunction(() => window.eiffelDiagnostics().state.progress > 2);
    await desktop.locator('#build-play').click({ timeout: 30000 });
    await desktop.locator('[data-mode="explore"]').click();
    await state(desktop, 'mode', 'explore');
    await desktop.waitForFunction(() => window.eiffelDiagnostics().state.progress >= 99.9);
    assert.deepEqual((await read(desktop)).model.stageVisibility, complete.model.stageVisibility);
    report.diagnostics.construction = { complete, partial };
  });
  await check('GLB and Blender assets download successfully and snapshot is a real PNG', async () => {
    for (const extension of ['glb', 'blend']) {
      const link = desktop.locator(`a[href="./eiffel-tower.${extension}"]`);
      assert.equal(await link.count(), 1);
      const downloadPromise = desktop.waitForEvent('download');
      await link.click();
      const download = await downloadPromise;
      assert.equal(await download.failure(), null);
      assert.ok((await fs.stat(await download.path())).size > 1000);
      const buffer = await fs.readFile(await download.path());
      if (extension === 'glb') assert.equal(buffer.subarray(0, 4).toString(), 'glTF');
      else {
        const source = await fs.readFile(path.join(workspace, 'canton-atlas', 'web', 'eiffel-tower', 'eiffel-tower.blend'));
        assert.ok(buffer.equals(source), 'Downloaded Blender data must match the validated local source');
        assert.ok(buffer.subarray(0, 4).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))
          || buffer.subarray(0, 4).toString() === 'BLEN', 'Blender file must have native or compressed Blender signature');
      }
      report.diagnostics[`${extension}Download`] = { filename: download.suggestedFilename(), bytes: buffer.length };
    }
    const promise = desktop.waitForEvent('download');
    await desktop.locator('#snapshot').click();
    const download = await promise;
    assert.equal(await download.failure(), null);
    const bytes = await fs.readFile(await download.path());
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    assert.ok(bytes.length > 10000, 'Snapshot should contain rendered pixels');
    const preview = path.join(workspace, 'canton-atlas', 'web', 'eiffel-tower', 'eiffel-tower-preview.png');
    await download.saveAs(preview);
    report.diagnostics.snapshot = { filename: download.suggestedFilename(), bytes: bytes.length, savedPreview: preview };
    await noOverflow(desktop);
  });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  });
  activePage = mobile;
  observe(mobile, 'mobile', new URL(base).origin);
  await check('mobile displays the tower without horizontal overflow and primary controls are usable', async () => {
    await load(mobile, url);
    await noOverflow(mobile);
    await capture(mobile, 'mobile');
    await mobile.locator('[data-view="front"]').tap();
    await state(mobile, 'currentView', 'front');
    await mobile.locator('#night-mode').tap();
    await state(mobile, 'night', true);
    await mobile.locator('#night-mode').tap();
    await mobile.locator('#floor-list [data-floor="first"]').tap();
    await state(mobile, 'selectedFloor', 'first');
    assert.equal(await mobile.locator('#detail-card').isVisible(), true);
    const card = await mobile.locator('#detail-card').boundingBox();
    assert.ok(card.x >= -1 && card.x + card.width <= 391, 'Floor information must fit mobile width');
    await mobile.locator('#close-detail').tap();
    await mobile.locator('[data-mode="build"]').tap();
    await state(mobile, 'mode', 'build');
    await setProgress(mobile, 50);
    await mobile.locator('[data-mode="explore"]').tap();
    await state(mobile, 'mode', 'explore');
    await mobile.locator('#zoom-in').tap();
    await noOverflow(mobile);
    report.diagnostics.mobile = await read(mobile);
  });
  await check('all browser interactions finish without runtime or failed local resource errors', async () => {
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.failedRequests, []);
    assert.deepEqual(report.httpErrors, []);
    assert.deepEqual(report.externalRequests, [], 'The viewer should be self contained');
  });
}
try {
  await fs.mkdir(out, { recursive: true });
  let base = baseArg;
  if (!base) {
    server = createPreview();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const deadline = new Promise((_, reject) => {
    deadlineTimer = setTimeout(() => reject(new Error('Eiffel browser verification exceeded 240 seconds')), 240000);
    deadlineTimer.unref();
  });
  await Promise.race([run(base), deadline]);
  report.status = report.checks.every(check => check.status === 'passed') ? 'passed' : 'failed';
  if (report.status === 'failed') process.exitCode = 1;
} catch (error) {
  report.status = 'failed';
  report.error = error.stack || String(error);
  process.exitCode = 1;
  console.error(report.error);
  if (activePage && !activePage.isClosed()) {
    try { report.diagnostics.failure = await read(activePage); } catch { /* Keep original failure. */ }
    try { await capture(activePage, 'failure'); } catch { /* Keep original failure. */ }
  }
} finally {
  clearTimeout(deadlineTimer);
  if (browser) await browser.close().catch(error => { report.browserCloseError = String(error); });
  if (server) {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'viewer-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Eiffel verification ${report.status}: ${report.checks.filter(check => check.status === 'passed').length}/${report.checks.length}.`);
}
