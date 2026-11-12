/**
 * Browser verification of the editable portrait portfolio.
 *
 * node scripts/verify-portrait-portfolio.mjs
 * node scripts/verify-portrait-portfolio.mjs --base http://127.0.0.1:4188
 * node scripts/verify-portrait-portfolio.mjs --collect
 *
 * Uses an ephemeral loopback preview by default. All browser requests to other
 * origins are blocked and reported. User changes stay in isolated test contexts.
 * Screenshots, downloaded artifacts, and report.json go to output/portrait-portfolio/.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createPreview, workspace } from './preview.mjs';

const outputDir = path.join(workspace, 'output', 'portrait-portfolio');
const chromePath = process.env.PORTFOLIO_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const arguments_ = process.argv.slice(2);
const collectFailures = arguments_.includes('--collect');
const baseArgument = arguments_.find(value => value.startsWith('--base='))?.slice(7)
  || (arguments_.includes('--base') ? arguments_[arguments_.indexOf('--base') + 1] : null);
if (arguments_.includes('--base') && !baseArgument) throw new Error('--base requires a URL');

const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  url: null,
  browser: null,
  scope: 'Desktop Chrome plus emulated mobile viewport; not physical iOS/Android certification.',
  checks: [],
  diagnostics: {},
  screenshots: {},
  downloads: {},
  pageErrors: [],
  consoleErrors: [],
  expectedConsoleErrors: [],
  httpErrors: [],
  failedRequests: [],
  externalRequests: [],
};
let server;
let browser;
let activePage;
let runTimer;

const diagnostics = page => page.evaluate(() => window.portfolioDiagnostics());
const selectedId = state => typeof state.selectedEvent === 'object'
  ? state.selectedEvent?.id
  : state.selectedEvent;
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const expectVisible = async (page, selector) => assert.equal(
  await page.locator(selector).isVisible(), true, `${selector} should be visible`,
);
const waitState = (page, section, key, value) => page.waitForFunction(
  ({ section, key, value }) => window.portfolioDiagnostics?.()[section]?.[key] === value,
  { section, key, value },
);

async function check(name, callback) {
  const entry = { name, status: 'running' };
  report.checks.push(entry);
  const started = Date.now();
  try {
    await callback();
    entry.status = 'passed';
    console.log(`PASS ${name}`);
  } catch (error) {
    entry.status = 'failed';
    entry.error = error.stack || String(error);
    if (!collectFailures) throw error;
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    entry.durationMs = Date.now() - started;
  }
}

async function preparePage(label, origin, options = {}, expectedError = () => false) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    ...options,
  });
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(45000);
  page.on('pageerror', error => report.pageErrors.push({ label, message: error.message, stack: error.stack }));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const entry = { label, message: message.text(), location: message.location() };
    (expectedError(entry.message) ? report.expectedConsoleErrors : report.consoleErrors).push(entry);
  });
  page.on('response', response => {
    if (response.status() >= 400) report.httpErrors.push({ label, status: response.status(), url: response.url() });
  });
  page.on('requestfailed', request => {
    // Navigating or closing a page can cancel an otherwise valid resource request.
    const error = request.failure()?.errorText;
    if (error !== 'net::ERR_ABORTED') report.failedRequests.push({ label, error, url: request.url() });
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    report.externalRequests.push({ label, url: url.href });
    return route.abort('blockedbyclient');
  });
  return page;
}

async function load(page, url) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'The portfolio must load successfully');
  await page.waitForFunction(() => window.__PORTFOLIO_READY__ === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.portfolioDiagnostics?.().ready === true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images]
    .filter(image => !image.hidden && image.getAttribute('src'))
    .every(image => image.complete && image.naturalWidth > 0));
}

async function screenshot(page, name, selector = null) {
  const destination = path.join(outputDir, `${name}.png`);
  const options = { path: destination, animations: 'disabled', timeout: 30000 };
  // Full-section mobile captures can include fixed content above the viewport.
  // Keep the normally off-screen skip link out of these review images.
  if (name.startsWith('mobile')) options.style = '.skip-link:not(:focus){visibility:hidden!important}';
  if (selector) await page.locator(selector).screenshot(options);
  else await page.screenshot({ ...options, fullPage: true });
  report.screenshots[name] = destination;
}

async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, `${label}: document overflows (${JSON.stringify(dimensions)})`);
  assert.ok(dimensions.body <= dimensions.viewport + 1, `${label}: body overflows (${JSON.stringify(dimensions)})`);
  return dimensions;
}

async function openEditor(page, tab = 'profile') {
  if (!(await page.locator('#editor-dialog').isVisible())) await page.locator('[data-open-editor]').click();
  await expectVisible(page, '#editor-dialog');
  await page.locator(`#tab-${tab}`).click();
  await expectVisible(page, `#panel-${tab}`);
}

async function closeEditor(page) {
  if (await page.locator('#editor-dialog').isVisible()) await page.locator('#close-editor').click();
}

async function download(page, selector, name) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const item = await pending;
  assert.equal(await item.failure(), null, `${name} download must succeed`);
  const destination = path.join(outputDir, name);
  await item.saveAs(destination);
  report.downloads[name] = { path: destination, suggestedFilename: item.suggestedFilename() };
  return fs.readFile(destination);
}

function validateGlb(buffer) {
  assert.ok(buffer.length > 1024, 'The GLB must contain actual model geometry');
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, 'The downloaded asset must have a real glTF binary header');
  assert.equal(buffer.readUInt32LE(4), 2, 'The GLB must use glTF 2.0');
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'The GLB length header must match its actual bytes');
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, 'The first GLB chunk must contain JSON');
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8').trim());
  assert.ok(json.meshes?.length > 0, 'The GLB must contain meshes');
  assert.ok(json.materials?.length > 0, 'The GLB must contain materials');
  for (const item of [...(json.buffers || []), ...(json.images || [])]) {
    assert.ok(!item.uri || item.uri.startsWith('data:'), 'The downloadable GLB must be self-contained');
  }
  return { bytes: buffer.length, meshes: json.meshes.length, materials: json.materials.length };
}

function stretchModelDepth(buffer, factor = 40) {
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const scene = json.scenes[json.scene || 0];
  const parentIndex = json.nodes.length;
  json.nodes.push({ name: 'Depth framing regression fixture', children: scene.nodes, scale: [1, 1, factor] });
  scene.nodes = [parentIndex];
  const rawJson = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 0x20);
  rawJson.copy(paddedJson);
  const tail = buffer.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + paddedJson.length + tail.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, paddedJson, tail]);
}

async function verify(base) {
  const origin = new URL(base).origin;
  const url = `${base.replace(/\/$/, '')}/portrait-portfolio/`;
  report.url = url;
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  report.browser = browser.version();
  const desktop = await preparePage('desktop', origin);
  activePage = desktop;
  let initial;
  let glb;
  let exported;

  await check('desktop renders the real character and globe with local project assets', async () => {
    await load(desktop, url);
    await waitState(desktop, 'character', 'ready', true);
    await desktop.waitForFunction(() => window.portfolioDiagnostics().character.triangles > 1000);
    initial = await diagnostics(desktop);
    assert.equal(initial.character.mode, 'webgl');
    assert.ok(initial.character.meshes > 1, 'The character must contain actual meshes');
    assert.ok(initial.character.calls > 0, 'The character must issue WebGL draw calls');
    assert.equal(initial.globe.mode, 'webgl');
    assert.ok(initial.content.projects.length >= 3, 'Existing website projects must be integrated');
    assert.ok(initial.content.events.length > 0, 'The globe must have speaking locations');
    assert.match(await desktop.locator('#events-demo').textContent(), /示例/);
    assert.match(await desktop.locator('#character-demo').textContent(), /示例/);
    for (const project of initial.content.projects) {
      const link = new URL(project.url, url);
      assert.equal(link.origin, origin, 'Integrated project links should be local');
      assert.equal((await desktop.request.get(link.href)).status(), 200, `${project.title} must link to an existing project`);
    }
    report.diagnostics.desktop = initial;
    report.diagnostics.desktopViewport = await noOverflow(desktop, '1440px desktop');
    await desktop.locator('#speaking').scrollIntoViewIfNeeded();
    await expectVisible(desktop, '#globe-host canvas');
    const canvas = await desktop.locator('#globe-host canvas').evaluate(element => {
      const context = element.getContext('webgl2');
      return { width: element.width, height: element.height, live: !!context && !context.isContextLost() };
    });
    assert.ok(canvas.width > 200 && canvas.height > 200 && canvas.live, 'The globe must have a live, sized WebGL canvas');
    await desktop.waitForTimeout(350);
    await screenshot(desktop, 'speaking', '#speaking');
    await desktop.locator('#home').scrollIntoViewIfNeeded();
    await screenshot(desktop, 'hero', '#home');
    await screenshot(desktop, 'desktop');
  });

  await check('character rotation, wireframe, drag, reset, and image capture work', async () => {
    await desktop.locator('#character-reset').click();
    const startCamera = (await diagnostics(desktop)).character.camera;
    await desktop.locator('#character-rotate').click();
    await waitState(desktop, 'character', 'autoRotate', true);
    await desktop.waitForTimeout(300);
    assert.ok(distance(startCamera, (await diagnostics(desktop)).character.camera) > 0.005, 'Automatic rotation must move the camera');
    await desktop.locator('#character-rotate').click();
    await waitState(desktop, 'character', 'autoRotate', false);
    await desktop.locator('#character-wireframe').click();
    await waitState(desktop, 'character', 'wireframe', true);
    assert.equal(await desktop.locator('#character-wireframe').getAttribute('aria-pressed'), 'true');
    await desktop.locator('#character-wireframe').click();
    await waitState(desktop, 'character', 'wireframe', false);
    const box = await desktop.locator('#character-host canvas').boundingBox();
    const beforeDrag = (await diagnostics(desktop)).character.camera;
    await desktop.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await desktop.mouse.down();
    await desktop.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55, { steps: 12 });
    await desktop.mouse.up();
    await desktop.waitForTimeout(200);
    assert.ok(distance(beforeDrag, (await diagnostics(desktop)).character.camera) > 0.1, 'Dragging must change the viewing angle');
    await desktop.locator('#character-reset').click();
    await desktop.waitForTimeout(300);
    const resetCamera = (await diagnostics(desktop)).character.camera;
    report.diagnostics.characterReset = { initial: startCamera, reset: resetCamera, distance: distance(startCamera, resetCamera) };
    assert.ok(distance(startCamera, resetCamera) < 0.12, 'Reset must restore the original view');
    const png = await download(desktop, '#character-capture', 'character-view.png');
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Capture must download a PNG');
    assert.ok(png.length > 10000, 'Capture must contain a rendered image');
  });

  await check('event selection and year filtering keep the list, detail, and globe in sync', async () => {
    await desktop.locator('#speaking').scrollIntoViewIfNeeded();
    const year = [...new Set(initial.content.events.map(event => event.date.slice(0, 4)))].sort()[0];
    await desktop.locator('#event-filters button').filter({ hasText: year }).click();
    const expected = initial.content.events.filter(event => event.date.startsWith(year));
    assert.equal(await desktop.locator('#events-list button').count(), expected.length, 'Year filter must show exactly the matching events');
    await desktop.locator('#events-list button').last().click();
    const state = await diagnostics(desktop);
    const event = state.content.events.find(event => event.id === selectedId(state));
    assert.ok(event && event.date.startsWith(year), 'Selection must belong to the filtered year');
    assert.equal(state.globe.selectedId, event.id);
    assert.match(await desktop.locator('#selected-stop').textContent(), new RegExp(event.city));
    await desktop.locator('#globe-rotate').click();
    await waitState(desktop, 'globe', 'rotating', false);
    await desktop.locator('#globe-rotate').click();
    await waitState(desktop, 'globe', 'rotating', true);
    await desktop.locator('#event-filters button').filter({ hasText: /全部|ALL/i }).click();
    assert.equal(await desktop.locator('#events-list button').count(), initial.content.events.length);
  });

  await check('profile edits save, render safely, and persist across reload', async () => {
    await openEditor(desktop);
    await screenshot(desktop, 'editor', '#editor-dialog');
    await desktop.locator('input[name="name"]').fill('林间 · 工作室');
    await desktop.locator('input[name="latinName"]').fill('LIN JIAN STUDIO');
    await desktop.locator('input[name="location"]').fill('中国 · 杭州');
    await desktop.locator('textarea[name="headline"]').fill('让新的想法，\n在这里发生。');
    await desktop.locator('#save-content').click();
    await desktop.waitForFunction(() => window.portfolioDiagnostics().content.profile.name === '林间 · 工作室');
    await closeEditor(desktop);
    assert.equal(await desktop.locator('.site-header [data-profile="name"]').textContent(), '林间 · 工作室');
    await load(desktop, url);
    const profile = (await diagnostics(desktop)).content.profile;
    assert.equal(profile.name, '林间 · 工作室');
    assert.equal(profile.location, '中国 · 杭州');
    assert.equal(profile.headline, '让新的想法，\n在这里发生。');
  });

  await check('invalid event coordinates are rejected and valid edits update the atlas', async () => {
    await openEditor(desktop, 'events');
    const event = (await diagnostics(desktop)).content.events[0];
    await desktop.locator('#edit-event-select').selectOption(event.id);
    await desktop.locator('#event-lat').fill('91');
    await desktop.locator('#save-content').click();
    await expectVisible(desktop, '#editor-dialog');
    assert.equal((await diagnostics(desktop)).content.events.find(item => item.id === event.id).lat, event.lat,
      'An out-of-range coordinate must not change saved content');
    assert.equal(await desktop.locator('#event-lat').evaluate(input => input.validity.rangeOverflow), true);
    await desktop.locator('#event-lat').fill('30.2741');
    await desktop.locator('#event-lng').fill('120.1551');
    await desktop.locator('#event-city').fill('杭州');
    await desktop.locator('#event-title').fill('让界面跨越边界 · 验证示例');
    await desktop.locator('#save-content').click();
    await desktop.waitForFunction(id => window.portfolioDiagnostics().content.events
      .some(event => event.id === id && event.city === '杭州' && event.lat === 30.2741 && event.lng === 120.1551), event.id);
    await closeEditor(desktop);
    await desktop.locator('#events-list button').filter({ hasText: '让界面跨越边界' }).click();
    assert.equal((await diagnostics(desktop)).globe.selectedId, event.id);
    assert.match(await desktop.locator('#selected-stop').textContent(), /杭州/);
    await load(desktop, url);
    assert.equal((await diagnostics(desktop)).content.events.find(item => item.id === event.id).city, '杭州');
  });

  await check('JSON backup round-trips edited content and rejects malformed input', async () => {
    await openEditor(desktop, 'assets');
    const buffer = await download(desktop, '#export-content', 'portfolio-backup.json');
    exported = JSON.parse(buffer.toString('utf8'));
    const content = exported.content || exported;
    assert.equal(content.profile.name, '林间 · 工作室');
    assert.ok(content.events.some(event => event.city === '杭州'));
    content.profile.name = '配置导入验证';
    content.profile.intro = '<img src=x onerror=alert(1)> 应当作为文字显示。';
    await desktop.locator('#import-content').setInputFiles({
      name: 'edited-portfolio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
    });
    await desktop.waitForFunction(() => window.portfolioDiagnostics().content.profile.name === '配置导入验证');
    await closeEditor(desktop);
    assert.equal(await desktop.locator('.hero-intro img').count(), 0, 'Imported profile text must not become executable HTML');
    assert.match(await desktop.locator('.hero-intro').textContent(), /<img src=x/);
    await openEditor(desktop, 'assets');
    const before = (await diagnostics(desktop)).content;
    await desktop.locator('#import-content').setInputFiles({
      name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"profile":'),
    });
    await desktop.waitForFunction(() => /JSON|格式|失败|错误|有效/.test(document.querySelector('#form-message').textContent));
    assert.deepEqual((await diagnostics(desktop)).content, before, 'Malformed JSON must leave the saved content intact');
    await desktop.locator('#import-content').setInputFiles({
      name: 'wrong-schema.json', mimeType: 'application/json', buffer: Buffer.from('{"unrelated":true}'),
    });
    await desktop.waitForTimeout(100);
    assert.deepEqual((await diagnostics(desktop)).content, before, 'Unrelated JSON must not silently replace the portfolio');
    await closeEditor(desktop);
    await load(desktop, url);
    assert.equal((await diagnostics(desktop)).content.profile.name, '配置导入验证', 'Imported content must persist');
  });

  await check('downloaded GLB is a self-contained model and invalid asset uploads are rejected', async () => {
    await openEditor(desktop, 'assets');
    glb = await download(desktop, '#download-current-model', 'character-download.glb');
    report.diagnostics.downloadedModel = validateGlb(glb);
    const before = (await diagnostics(desktop)).character;
    await desktop.locator('#model-upload').setInputFiles({
      name: 'broken.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('This is not a binary glTF file.'),
    });
    await desktop.waitForFunction(() => /GLB|模型|格式|有效|失败/.test(document.querySelector('#form-message').textContent));
    assert.equal((await diagnostics(desktop)).character.model, before.model);
    assert.equal((await diagnostics(desktop)).character.meshes, before.meshes, 'Rejected upload must preserve the current model');
    await desktop.locator('#portrait-upload').setInputFiles({
      name: 'not-a-portrait.txt', mimeType: 'text/plain', buffer: Buffer.from('Not an image'),
    });
    await desktop.waitForFunction(() => /照片|图片|格式|JPG|PNG|WebP/.test(document.querySelector('#form-message').textContent));
    assert.equal(await desktop.locator('#portrait-reference').isVisible(), false);
  });

  await check('deep GLB replacement is framed, downloads its own bytes, persists, and can be restored', async () => {
    const baselineCamera = (await diagnostics(desktop)).character.camera;
    const deepGlb = stretchModelDepth(glb);
    validateGlb(deepGlb);
    await desktop.locator('#model-upload').setInputFiles({
      name: 'depth-stress-character.glb', mimeType: 'model/gltf-binary', buffer: deepGlb,
    });
    await waitState(desktop, 'character', 'model', 'custom');
    await desktop.waitForFunction(() => /模型已替换并保存在本机/.test(document.querySelector('#form-message').textContent));
    const custom = (await diagnostics(desktop)).character;
    assert.ok(custom.triangles > 1000);
    assert.ok(custom.camera[2] > baselineCamera[2] * 2, 'A model with forty times the depth must move the camera back to frame it');
    report.diagnostics.depthFraming = { baselineCamera, deepCamera: custom.camera, depthMultiplier: 40 };
    const currentDownload = await download(desktop, '#download-current-model', 'current-character.glb');
    assert.equal(report.downloads['current-character.glb'].suggestedFilename, 'depth-stress-character.glb');
    assert.equal(currentDownload.equals(deepGlb), true, 'Downloading the current model must return the uploaded bytes');
    await closeEditor(desktop);
    await load(desktop, url);
    await waitState(desktop, 'character', 'model', 'custom');
    await openEditor(desktop, 'assets');
    await desktop.locator('#restore-model').click();
    await waitState(desktop, 'character', 'model', 'default');
    await desktop.waitForFunction(() => /已恢复原创示例角色/.test(document.querySelector('#form-message').textContent));
    await closeEditor(desktop);
    await load(desktop, url);
    await waitState(desktop, 'character', 'model', 'default');
  });

  const storageFailure = await preparePage('storage-unavailable', origin);
  activePage = storageFailure;
  await check('restoring the original model keeps the visible state correct when local storage fails', async () => {
    await load(storageFailure, url);
    await openEditor(storageFailure, 'assets');
    await storageFailure.locator('#model-upload').setInputFiles({
      name: 'storage-recovery.glb', mimeType: 'model/gltf-binary', buffer: glb,
    });
    await waitState(storageFailure, 'character', 'model', 'custom');
    await storageFailure.waitForFunction(() => /模型已替换并保存在本机/.test(document.querySelector('#form-message').textContent));
    await storageFailure.evaluate(() => {
      Object.defineProperty(indexedDB, 'open', {
        configurable: true,
        value() { throw new DOMException('Simulated unavailable local storage', 'UnknownError'); },
      });
    });
    await storageFailure.locator('#restore-model').click();
    await waitState(storageFailure, 'character', 'model', 'default');
    await storageFailure.waitForFunction(() => /无法更新|不可用/.test(document.querySelector('#form-message').textContent));
    const state = await diagnostics(storageFailure);
    assert.equal(state.customModelName, '', 'Restored model UI must not retain the previous custom name');
    assert.match(await storageFailure.locator('#custom-model-name').textContent(), /原创示例角色/);
    assert.equal(await storageFailure.locator('#download-current-model').getAttribute('download'), 'character.glb');
    assert.ok(!(await storageFailure.locator('#download-current-model').getAttribute('href')).startsWith('blob:'),
      'Restoring the original model must also restore its download link');
    report.diagnostics.storageFailureRecovery = state;
  });
  await storageFailure.close();

  const mobile = await preparePage('mobile', origin, {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  activePage = mobile;
  await check('390px mobile keeps content, events, and editor usable without horizontal overflow', async () => {
    await load(mobile, url);
    assert.equal((await diagnostics(mobile)).character.mode, 'webgl');
    report.diagnostics.mobileViewport = await noOverflow(mobile, '390px mobile');
    await mobile.locator('#speaking').scrollIntoViewIfNeeded();
    await mobile.locator('#events-list button').first().click();
    assert.equal((await diagnostics(mobile)).globe.selectedId, selectedId(await diagnostics(mobile)));
    await mobile.evaluate(() => document.activeElement?.blur());
    await mobile.mouse.move(2, 2);
    await screenshot(mobile, 'mobile-speaking', '#speaking');
    await mobile.locator('#home').scrollIntoViewIfNeeded();
    await mobile.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await screenshot(mobile, 'mobile');
    await openEditor(mobile, 'events');
    await noOverflow(mobile, '390px mobile editor');
    const box = await mobile.locator('#editor-dialog').boundingBox();
    assert.ok(box.x >= -1 && box.x + box.width <= 391, 'The editor must fit within the mobile viewport');
    await screenshot(mobile, 'mobile-editor', '#editor-dialog');
    await mobile.locator('#close-editor').click();
    assert.equal(await mobile.locator('#editor-dialog').isVisible(), false);
    report.diagnostics.mobile = await diagnostics(mobile);
  });

  const reduced = await preparePage('reduced-motion', origin, { reducedMotion: 'reduce' });
  activePage = reduced;
  await check('reduced motion disables automatic character and globe rotation', async () => {
    await load(reduced, url);
    const state = await diagnostics(reduced);
    assert.equal(state.character.autoRotate, false);
    assert.equal(state.globe.rotating, false);
    assert.equal(await reduced.locator('#character-rotate').getAttribute('aria-pressed'), 'false');
    await reduced.locator('#speaking').scrollIntoViewIfNeeded();
    await reduced.locator('#events-list button').last().click();
    const after = await diagnostics(reduced);
    assert.equal(after.globe.selectedId, selectedId(after), 'Reduced motion must retain event navigation');
    assert.equal(after.globe.rotating, false);
    report.diagnostics.reducedMotion = after;
  });

  const fallback = await preparePage('webgl-unavailable', origin, {}, message =>
    /^THREE\.WebGLRenderer: Error creating WebGL context\./.test(message),
  );
  activePage = fallback;
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...arguments_) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...arguments_);
    };
  });
  await check('WebGL unavailability preserves the character poster and interactive map content', async () => {
    await load(fallback, url);
    const state = await diagnostics(fallback);
    assert.equal(state.character.mode, 'poster');
    assert.equal(state.globe.mode, 'map');
    await expectVisible(fallback, '.character-poster');
    assert.ok(await fallback.locator('.character-poster').evaluate(image => image.naturalWidth > 100));
    await fallback.locator('#speaking').scrollIntoViewIfNeeded();
    await expectVisible(fallback, '#globe-host svg');
    assert.ok(await fallback.locator('#globe-host svg path').count() > 20, 'Fallback must preserve recognizable world geography');
    await fallback.locator('#events-list button').last().click();
    const after = await diagnostics(fallback);
    assert.equal(after.globe.selectedId, selectedId(after));
    await fallback.locator('#globe-host svg [role="button"]').first().click();
    const fromMap = await diagnostics(fallback);
    assert.equal(fromMap.globe.selectedId, selectedId(fromMap), 'SVG map activation must update the event selection');
    const keyboardMarker = fallback.locator('#globe-host svg [role="button"]').nth(1);
    const keyboardLabel = await keyboardMarker.getAttribute('aria-label');
    await keyboardMarker.focus();
    await fallback.keyboard.press('Enter');
    assert.equal(await fallback.evaluate(() => document.activeElement.getAttribute('aria-label')), keyboardLabel,
      'Keyboard activation must preserve focus on the selected map marker after the map and event list update');
    assert.equal((await diagnostics(fallback)).globe.selectedId, selectedId(await diagnostics(fallback)));
    await screenshot(fallback, 'fallback-speaking', '#speaking');
    await fallback.locator('#home').scrollIntoViewIfNeeded();
    await screenshot(fallback, 'fallback');
    await openEditor(fallback);
    await expectVisible(fallback, 'input[name="name"]');
    await closeEditor(fallback);
    report.diagnostics.webglFallback = state;
  });

  await check('all verified workflows stay local and complete without browser or HTTP failures', async () => {
    assert.deepEqual(report.externalRequests, [], 'The portfolio must not request external assets');
    assert.deepEqual(report.pageErrors, [], 'No uncaught browser exceptions are allowed');
    assert.deepEqual(report.consoleErrors, [], 'No unexpected browser console errors are allowed');
    assert.deepEqual(report.httpErrors, [], 'All requested local assets must exist');
    assert.deepEqual(report.failedRequests, [], 'All requested assets must load');
  });
  const failures = report.checks.filter(check => check.status === 'failed');
  if (failures.length) throw new Error(`${failures.length} portfolio check(s) failed; see report.json for individual failures.`);
}

try {
  await fs.mkdir(outputDir, { recursive: true });
  let base = baseArgument;
  if (!base) {
    server = createPreview({ configPath: 'missing-config-for-portrait-test.json' });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const deadline = new Promise((_, reject) => {
    runTimer = setTimeout(() => reject(new Error('Portrait portfolio verification exceeded 240 seconds')), 240000);
    runTimer.unref();
  });
  await Promise.race([verify(base), deadline]);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack || String(error);
  process.exitCode = 1;
  console.error(report.error);
  if (activePage && !activePage.isClosed()) {
    try { await screenshot(activePage, 'failure'); } catch { /* Preserve the original error. */ }
  }
} finally {
  clearTimeout(runTimer);
  if (browser) {
    try { await browser.close(); } catch (error) { report.browserCloseError = String(error); }
  }
  if (server) {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Portrait portfolio verification ${report.status}: ${report.checks.filter(check => check.status === 'passed').length}/${report.checks.length} checks.`);
  console.log(`Report: ${path.join(outputDir, 'report.json')}`);
}
