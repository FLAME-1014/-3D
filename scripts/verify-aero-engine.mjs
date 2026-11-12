/**
 * Browser-level verification of the AERIS engine experience.
 *
 * Usage:
 *   node scripts/verify-aero-engine.mjs
 *   node scripts/verify-aero-engine.mjs --base http://127.0.0.1:4188
 *
 * Starts a loopback-only ephemeral preview by default, without loading local
 * map credentials. Exercises visible controls rather than invoking app actions.
 * Screenshots and a machine-readable report are written to output/aero-engine/.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createPreview, workspace } from './preview.mjs';

const outputDir = path.join(workspace, 'output', 'aero-engine');
const chromePath = process.env.AERIS_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const baseArgument = args.find(value => value.startsWith('--base='))?.slice(7)
  || (args.includes('--base') ? args[args.indexOf('--base') + 1] : null);
if (args.includes('--base') && !baseArgument) throw new Error('--base requires a URL');

const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  url: null,
  browser: null,
  checks: [],
  diagnostics: {},
  performance: {
    scope: 'Local desktop Chrome and emulated mobile viewport; not real iOS/Android device certification.',
    samples: [],
  },
  consoleErrors: [],
  expectedConsoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  httpErrors: [],
  screenshots: {},
};
let server;
let browser;
let activePage;
let runTimer;

const diagnostics = page => page.evaluate(() => window.aerisDiagnostics());
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const visible = async (page, selector) => assert.equal(
  await page.locator(selector).isVisible(), true, `${selector} should be visible`,
);
const hidden = async (page, selector) => assert.equal(
  await page.locator(selector).isVisible(), false, `${selector} should be hidden`,
);
const waitState = (page, key, value, timeout = 8000) => page.waitForFunction(
  ({ key, value }) => window.aerisDiagnostics?.()[key] === value,
  { key, value },
  { timeout },
);

async function check(name, callback) {
  const entry = { name, status: 'running', startedAt: new Date().toISOString() };
  report.checks.push(entry);
  const started = Date.now();
  try {
    await callback();
    entry.status = 'passed';
    console.log(`PASS ${name}`);
  } catch (error) {
    entry.status = 'failed';
    entry.error = error.stack || String(error);
    throw error;
  } finally {
    entry.durationMs = Date.now() - started;
  }
}

function observe(page, viewport, expectedError = () => false) {
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(45000);
  page.on('console', message => {
    if (message.type() === 'error') {
      const entry = { viewport, text: message.text(), location: message.location() };
      (expectedError(entry.text) ? report.expectedConsoleErrors : report.consoleErrors).push(entry);
    }
  });
  page.on('pageerror', error => report.pageErrors.push({ viewport, message: error.message, stack: error.stack }));
  page.on('requestfailed', request => report.failedRequests.push({
    viewport, url: request.url(), error: request.failure()?.errorText,
  }));
  page.on('response', response => {
    if (response.status() >= 400) report.httpErrors.push({ viewport, url: response.url(), status: response.status() });
  });
}

async function load(page, url) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'Engine page must load successfully');
  await page.waitForFunction(() => window.__AERIS_READY__ === true, null, { timeout: 60000 });
  await hidden(page, '#loading-screen');
  await hidden(page, '#scene-error');
  await visible(page, '#scene-host canvas');
  await page.waitForFunction(() => {
    const viewer = window.aerisDiagnostics?.().viewer;
    return viewer?.renderer?.calls > 0 && viewer?.renderer?.triangles > 0;
  }, null, { timeout: 20000 });
}

async function screenshot(page, name) {
  const destination = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: destination, fullPage: true, animations: 'disabled', timeout: 30000 });
  report.screenshots[name] = destination;
}

async function checkWebGL(page) {
  const state = await diagnostics(page);
  assert.ok(state.viewer, 'Viewer must be initialized, not merely the HTML fallback');
  assert.equal(state.viewer.webgl2, true, 'The real WebGL 2 renderer must be active');
  assert.ok(state.viewer.renderer.calls > 0, 'The renderer must issue draw calls');
  assert.ok(state.viewer.renderer.triangles > 1000, 'The engine must contain rendered 3D geometry');
  assert.ok(state.viewer.renderer.geometries > 0, 'Renderer geometry memory must be allocated');
  assert.ok(state.viewer.frames > 0, 'The animation/render loop must be advancing');
  const canvas = await page.locator('#scene-host canvas').evaluate(element => {
    const context = element.getContext('webgl2');
    const rect = element.getBoundingClientRect();
    const debug = context?.getExtension('WEBGL_debug_renderer_info');
    return {
      width: element.width,
      height: element.height,
      visibleWidth: rect.width,
      visibleHeight: rect.height,
      lost: context ? context.isContextLost() : true,
      renderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context?.getParameter(context.RENDERER),
      vendor: debug ? context.getParameter(debug.UNMASKED_VENDOR_WEBGL) : context?.getParameter(context.VENDOR),
    };
  });
  assert.equal(canvas.lost, false, 'WebGL context must remain live');
  assert.ok(canvas.width > 100 && canvas.height > 100, 'Canvas drawing buffer must be populated');
  assert.ok(canvas.visibleWidth > 100 && canvas.visibleHeight > 100, 'Canvas must occupy the visible stage');
  state.renderingEnvironment = {
    browser: report.browser,
    headless: true,
    renderer: canvas.renderer,
    vendor: canvas.vendor,
    viewport: [canvas.visibleWidth, canvas.visibleHeight],
    drawingBuffer: [canvas.width, canvas.height],
  };
  return state;
}

async function verify(base) {
  const url = new URL('/aero-engine/', base).href;
  report.url = url;
  await fs.access(chromePath);
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  report.browser = browser.version();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  activePage = desktop;
  observe(desktop, 'desktop');

  await check('desktop loads a real rendered engine', async () => {
    await load(desktop, url);
    report.diagnostics.desktopInitial = await checkWebGL(desktop);
    assert.equal(await desktop.locator('#parts-list .part-button').count(), 6, 'Six component systems should be discoverable');
    assert.equal((await diagnostics(desktop)).mode, 'explore');
  });

  await check('drag, zoom, and reset change the 3D camera', async () => {
    const start = (await diagnostics(desktop)).viewer.camera;
    const dragPoint = await desktop.locator('#scene-host canvas').evaluate(canvas => {
      const rect = canvas.getBoundingClientRect();
      for (const [rx, ry] of [[0.54, 0.64], [0.6, 0.7], [0.46, 0.68], [0.7, 0.5]]) {
        const x = rect.x + rect.width * rx;
        const y = rect.y + rect.height * ry;
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
      return null;
    });
    assert.ok(dragPoint, 'An unobstructed part of the canvas must be available for orbit controls');
    await desktop.mouse.move(dragPoint.x, dragPoint.y);
    await desktop.mouse.down();
    await desktop.mouse.move(dragPoint.x + 85, dragPoint.y - 26, { steps: 12 });
    await desktop.mouse.up();
    await desktop.waitForFunction(position => {
      const actual = window.aerisDiagnostics().viewer.camera.position;
      return Math.hypot(...actual.map((value, index) => value - position[index])) > 0.05;
    }, start.position);

    const beforeZoom = (await diagnostics(desktop)).viewer.camera;
    const beforeDistance = distance(beforeZoom.position, beforeZoom.target);
    await desktop.locator('#zoom-in').click();
    await desktop.waitForFunction(before => {
      const camera = window.aerisDiagnostics().viewer.camera;
      return Math.hypot(...camera.position.map((value, index) => value - camera.target[index])) < before * 0.98;
    }, beforeDistance);
    const zoomed = (await diagnostics(desktop)).viewer.camera;
    const zoomedDistance = distance(zoomed.position, zoomed.target);
    await desktop.locator('#zoom-out').click();
    await desktop.waitForFunction(before => {
      const camera = window.aerisDiagnostics().viewer.camera;
      return Math.hypot(...camera.position.map((value, index) => value - camera.target[index])) > before * 1.02;
    }, zoomedDistance);
    await desktop.locator('#reset-camera').click();
    await desktop.waitForTimeout(1400);
  });

  await check('component selection explains materials and function, and focus moves the camera', async () => {
    const firstPart = desktop.locator('#parts-list .part-button').first();
    const partName = (await firstPart.locator('.part-name').textContent()).trim();
    await firstPart.click();
    await visible(desktop, '#part-detail');
    assert.equal((await desktop.locator('#detail-title').textContent()).trim(), partName);
    assert.equal((await diagnostics(desktop)).selectedPart, 'fan');
    assert.ok((await desktop.locator('#detail-description').textContent()).trim().length > 30);
    assert.ok((await desktop.locator('#detail-principle').textContent()).trim().length > 30);
    assert.ok((await desktop.locator('#detail-material').textContent()).trim().length > 5);
    const before = (await diagnostics(desktop)).viewer.camera;
    await desktop.locator('#focus-part').click();
    await desktop.waitForFunction(previous => {
      const camera = window.aerisDiagnostics().viewer.camera;
      const positionChange = Math.hypot(...camera.position.map((value, index) => value - previous.position[index]));
      const targetChange = Math.hypot(...camera.target.map((value, index) => value - previous.target[index]));
      return positionChange + targetChange > 0.1;
    }, before);
    await desktop.locator('#close-detail').click();
    await hidden(desktop, '#part-detail');
    await desktop.locator('#reset-camera').click();
    await desktop.waitForTimeout(1400);
  });

  await check('exploded view animates, its slider adjusts separation, and assembly restores', async () => {
    await desktop.locator('#exploded-view').click();
    await waitState(desktop, 'exploded', 1);
    await visible(desktop, '#explode-control');
    await desktop.waitForTimeout(1400);
    await desktop.waitForFunction(() => Math.abs(window.aerisDiagnostics().viewer.explode - 1) < 0.035);
    assert.equal(await desktop.locator('#exploded-view').getAttribute('aria-pressed'), 'true');
    report.diagnostics.exploded = await diagnostics(desktop);
    await screenshot(desktop, 'exploded');

    const range = desktop.locator('#explode-range');
    await range.focus();
    await range.press('Home');
    for (let step = 0; step < 4; step++) await range.press('PageUp');
    assert.equal(await range.inputValue(), '40', 'Keyboard operation should set the native range slider to 40%');
    await waitState(desktop, 'exploded', 0.4);
    assert.match(await desktop.locator('#explode-output').textContent(), /40/);
    await desktop.locator('#assembled-view').click();
    await waitState(desktop, 'exploded', 0);
    await hidden(desktop, '#explode-control');
    await desktop.waitForFunction(() => window.aerisDiagnostics().viewer.explode < 0.035);
  });

  await check('cutaway and annotation controls toggle and restore their state', async () => {
    for (const [selector, key] of [['#toggle-cutaway', 'cutaway'], ['#toggle-labels', 'labels']]) {
      const initial = (await diagnostics(desktop))[key];
      assert.equal(typeof initial, 'boolean');
      await desktop.locator(selector).click();
      await waitState(desktop, key, !initial);
      assert.equal(await desktop.locator(selector).getAttribute('aria-pressed'), String(!initial));
      await desktop.locator(selector).click();
      await waitState(desktop, key, initial);
    }
  });

  await check('principle mode explains cycle stages and supports pause/resume', async () => {
    await desktop.locator('.mode-button[data-mode="principle"]').click();
    await waitState(desktop, 'mode', 'principle');
    await visible(desktop, '#principle-panel');
    assert.equal(await desktop.locator('#principle-steps button').count(), 4);
    const description = await desktop.locator('#principle-description').textContent();
    await desktop.locator('#principle-steps button').nth(1).click();
    const changedDescription = await desktop.locator('#principle-description').textContent();
    assert.notEqual(changedDescription, description, 'Selecting another cycle stage must update its explanation');
    assert.ok(changedDescription.trim().length > 30);
    await visible(desktop, '#toggle-running');
    const running = (await diagnostics(desktop)).running;
    await desktop.locator('#toggle-running').click();
    await waitState(desktop, 'running', !running);
    await desktop.locator('#toggle-running').click();
    await waitState(desktop, 'running', running);
    report.diagnostics.principle = await diagnostics(desktop);
  });

  await check('principle details and feature drilldown preserve the selected stage, animation and camera', async () => {
    await desktop.locator('#principle-steps button').nth(2).click();
    await desktop.waitForTimeout(1500);
    const before = await diagnostics(desktop);
    assert.equal(before.principleStep, 2);
    assert.equal(before.viewer.principleStage, 'combustion');
    await desktop.locator('.part-button[data-part="combustor"]').click();
    await visible(desktop, '#part-detail');
    let state = await diagnostics(desktop);
    assert.equal(state.mode, 'principle', 'Reading a component must not exit the active principle stage');
    assert.equal(state.principleStep, 2);
    assert.equal(state.running, before.running);
    assert.equal(state.viewer.airflow, true);
    assert.ok(distance(state.viewer.camera.position, before.viewer.camera.position) < 0.1,
      'Opening a text explanation must not reset the camera');
    await desktop.locator('#detail-features .feature-button').first().click();
    state = await diagnostics(desktop);
    assert.equal(state.selectedFeature, 'fuel-injector');
    assert.ok((await desktop.locator('#detail-description').textContent()).length > 30);
    await visible(desktop, '#detail-back');
    await desktop.locator('#detail-back').click();
    assert.equal((await diagnostics(desktop)).selectedFeature, null);
    await desktop.locator('#focus-part').click();
    await desktop.waitForTimeout(1500);
    await desktop.locator('#close-detail').click();
    await desktop.waitForTimeout(1500);
    state = await diagnostics(desktop);
    assert.equal(state.mode, 'principle');
    assert.equal(state.principleStep, 2);
    assert.equal(state.running, before.running);
    assert.ok(distance(state.viewer.camera.position, before.viewer.camera.position) < 0.15,
      'Closing a focused detail must restore the interrupted principle camera');
  });

  await check('guided disassembly exposes seven steps, previous/dots, and automatic playback', async () => {
    await desktop.locator('.mode-button[data-mode="explore"]').click();
    await desktop.locator('#start-tour').click();
    await waitState(desktop, 'mode', 'tour');
    await waitState(desktop, 'tourStep', 0);
    await visible(desktop, '#tour-controls');
    assert.equal(await desktop.locator('#tour-dots button').count(), 7);
    assert.equal(await desktop.locator('#tour-prev').isDisabled(), true);
    const order = ['fan', 'compressor', 'combustor', 'turbine', 'nozzle', 'accessories'];
    let retainedPoses = null;
    let previousExplode = (await diagnostics(desktop)).exploded;
    for (let step = 1; step < 7; step++) {
      await desktop.locator('#tour-next').click();
      await waitState(desktop, 'tourStep', step);
      await desktop.waitForFunction(() => {
        const poses = window.aerisDiagnostics().viewer.partPoses;
        return poses && Object.values(poses).every(pose =>
          Math.hypot(...pose.position.map((value, index) => value - pose.targetPosition[index])) < 0.035);
      });
      const state = await diagnostics(desktop);
      assert.ok(state.exploded > previousExplode, `Step ${step + 1} must advance the disassembly`);
      previousExplode = state.exploded;
      for (let index = 0; index < order.length; index++) {
        const id = order[index];
        const pose = state.viewer.partPoses[id];
        if (index >= step) {
          assert.ok(Math.hypot(...pose.position) < 0.035, `Not-yet-disassembled ${id} must remain assembled`);
        } else {
          assert.ok(Math.hypot(...pose.position) > 0.1, `${id} must have an independent disassembled pose`);
          if (index < step - 1 && retainedPoses) {
            assert.ok(distance(pose.position, retainedPoses[id].position) < 0.06,
              `Previously removed ${id} must stay in place while the next component moves`);
          }
        }
      }
      retainedPoses = state.viewer.partPoses;
      assert.match(await desktop.locator('#tour-counter').textContent(), new RegExp(`0${step + 1}\\s*/\\s*07`));
      assert.ok((await desktop.locator('#experience-description').textContent()).trim().length > 30);
    }
    assert.equal(await desktop.locator('#tour-next').isDisabled(), true);
    await desktop.locator('#tour-prev').click();
    await waitState(desktop, 'tourStep', 5);
    await desktop.waitForFunction(() =>
      Math.hypot(...window.aerisDiagnostics().viewer.partPoses.accessories.position) < 0.035);
    const reversed = await diagnostics(desktop);
    assert.ok(distance(reversed.viewer.partPoses.fan.position, retainedPoses.fan.position) < 0.06,
      'Reverse assembly must restore the current component without moving earlier removed components');
    await desktop.locator('#tour-dots button').nth(2).click();
    await waitState(desktop, 'tourStep', 2);
    await desktop.locator('#tour-play').click();
    await waitState(desktop, 'tourPlaying', true);
    await waitState(desktop, 'tourStep', 3, 10000);
    await desktop.locator('#tour-play').click();
    await waitState(desktop, 'tourPlaying', false);
    report.diagnostics.tour = await diagnostics(desktop);
  });

  await check('idle rendering stops, controls wake it, and quality profiles are effective', async () => {
    await desktop.locator('.mode-button[data-mode="explore"]').click();
    await desktop.mouse.move(10, 10);
    await desktop.waitForFunction(() => window.aerisDiagnostics().viewer.performance.idle === true,
      null, { timeout: 15000 });
    const before = (await diagnostics(desktop)).viewer.frames;
    await desktop.waitForTimeout(700);
    assert.equal((await diagnostics(desktop)).viewer.frames, before, 'A fully static foreground scene must stop rendering');
    await desktop.locator('#zoom-in').click();
    await desktop.waitForFunction(count => window.aerisDiagnostics().viewer.frames > count, before);
    await desktop.locator('#quality-select').selectOption('low');
    let state = await diagnostics(desktop);
    assert.equal(state.viewer.performance.effectiveQuality, 'low');
    const lowPixelRatio = state.viewer.pixelRatio;
    await desktop.locator('#quality-select').selectOption('high');
    state = await diagnostics(desktop);
    assert.equal(state.viewer.performance.effectiveQuality, 'high');
    assert.ok(state.viewer.pixelRatio >= lowPixelRatio);
    await desktop.locator('#quality-select').selectOption('auto');
    await desktop.locator('#auto-orbit').click();
    await desktop.waitForTimeout(4000);
    state = await diagnostics(desktop);
    assert.ok(state.viewer.performance.samples >= 20, 'Performance measurements require actual consecutive animated frames');
    assert.ok(state.viewer.performance.fps > 0);
    assert.ok(state.viewer.performance.p95FrameMs > 0);
    report.performance.samples.push({ scenario: 'desktop orbit', ...state.viewer.performance, renderer: state.viewer.renderer });
    await desktop.locator('#auto-orbit').click();
    await desktop.locator('.mode-button[data-mode="principle"]').click();
    await desktop.waitForTimeout(4000);
    state = await diagnostics(desktop);
    report.performance.samples.push({ scenario: 'desktop rotors and airflow', ...state.viewer.performance, renderer: state.viewer.renderer });
    await desktop.locator('.mode-button[data-mode="explore"]').click();
  });

  await check('revisiting assembled, disassembled and running views does not accumulate GPU resources', async () => {
    await desktop.locator('#toggle-cutaway').click();
    await desktop.waitForTimeout(250);
    await desktop.locator('#toggle-cutaway').click();
    await desktop.locator('.mode-button[data-mode="principle"]').click();
    await desktop.waitForTimeout(300);
    await desktop.locator('.mode-button[data-mode="explore"]').click();
    await desktop.waitForTimeout(1600);
    const baseline = (await diagnostics(desktop)).viewer.renderer;
    for (let cycle = 0; cycle < 5; cycle++) {
      await desktop.locator('#exploded-view').click();
      await desktop.waitForTimeout(100);
      await desktop.locator('#assembled-view').click();
      await desktop.locator('.mode-button[data-mode="principle"]').click();
      await desktop.locator('#principle-steps button').nth(cycle % 4).click();
      await desktop.locator('.mode-button[data-mode="explore"]').click();
    }
    await desktop.waitForFunction(() => window.aerisDiagnostics().viewer.performance.idle === true,
      null, { timeout: 15000 });
    const after = (await diagnostics(desktop)).viewer.renderer;
    assert.ok(after.geometries <= baseline.geometries, 'Mode revisits must reuse geometry resources');
    assert.ok(after.textures <= baseline.textures, 'Mode revisits must reuse texture resources');
    report.performance.resourceReuse = { baseline, after, cycles: 5 };
  });

  await check('help, specifications, and project dialogs open and close accessibly', async () => {
    await desktop.locator('#open-help').click();
    await visible(desktop, '#info-dialog');
    assert.ok((await desktop.locator('#dialog-content').textContent()).trim().length > 40);
    await desktop.locator('#close-dialog').click();
    await hidden(desktop, '#info-dialog');
    await desktop.locator('#open-specs').click();
    await visible(desktop, '#info-dialog');
    assert.ok((await desktop.locator('#dialog-content').textContent()).includes('CF6'));
    await desktop.keyboard.press('Escape');
    await hidden(desktop, '#info-dialog');
    await desktop.locator('#open-about').click();
    await visible(desktop, '#info-dialog');
    await desktop.locator('#dialog-done').click();
    await hidden(desktop, '#info-dialog');
  });

  await check('desktop default view remains healthy after a fresh load', async () => {
    await load(desktop, url);
    await desktop.waitForTimeout(1400);
    report.diagnostics.desktopFinal = await checkWebGL(desktop);
    await screenshot(desktop, 'desktop');
  });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  activePage = mobile;
  observe(mobile, 'mobile');

  await check('mobile menu reaches component details without horizontal overflow', async () => {
    await load(mobile, url);
    await checkWebGL(mobile);
    await visible(mobile, '#mobile-menu');
    let dimensions = await mobile.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.viewport + 1, `Mobile page overflows: ${JSON.stringify(dimensions)}`);
    await mobile.locator('#mobile-menu').click();
    assert.equal(await mobile.locator('#mobile-menu').getAttribute('aria-expanded'), 'true');
    await mobile.locator('#parts-list .part-button').nth(1).click();
    await visible(mobile, '#part-detail');
    assert.equal((await diagnostics(mobile)).selectedPart, 'compressor');
    assert.equal(await mobile.locator('#mobile-menu').getAttribute('aria-expanded'), 'false');
    const detailBounds = await mobile.locator('#part-detail').boundingBox();
    assert.ok(detailBounds.x >= -1 && detailBounds.x + detailBounds.width <= 391, 'Mobile detail should fit the viewport');
    await mobile.locator('#close-detail').click();
    await hidden(mobile, '#part-detail');
    await mobile.locator('#mobile-menu').click();
    await mobile.locator('#mobile-help').click();
    await visible(mobile, '#info-dialog');
    assert.match(await mobile.locator('#dialog-content').textContent(), /双指/);
    await mobile.locator('#close-dialog').click();
    if (await mobile.locator('#mobile-menu').getAttribute('aria-expanded') !== 'true') {
      await mobile.locator('#mobile-menu').click();
    }
    await mobile.locator('.mode-button[data-mode="principle"]').click();
    await waitState(mobile, 'mode', 'principle');
    await visible(mobile, '#principle-panel');
    dimensions = await mobile.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.viewport + 1, 'Principle controls should not cause mobile horizontal overflow');
    await mobile.waitForTimeout(1400);
    report.diagnostics.mobilePrinciple = await diagnostics(mobile);
    await screenshot(mobile, 'mobile-principle');
    await mobile.waitForTimeout(3000);
    report.performance.samples.push({
      scenario: '390px emulated mobile rotors and airflow',
      ...(await diagnostics(mobile)).viewer.performance,
    });
    const principleFont = await mobile.locator('#principle-description').evaluate(node =>
      Number.parseFloat(getComputedStyle(node).fontSize));
    assert.ok(principleFont >= 13, 'Mobile principle body text must remain readable');
    await mobile.locator('#mobile-menu').click();
    await mobile.locator('.mode-button[data-mode="tour"]').click();
    await waitState(mobile, 'mode', 'tour');
    await mobile.locator('#tour-dots button').nth(3).click();
    await waitState(mobile, 'tourStep', 3);
    await mobile.waitForTimeout(1400);
    report.diagnostics.mobileTour = await diagnostics(mobile);
    await screenshot(mobile, 'mobile-tour');
    for (const selector of ['#tour-prev', '#tour-next', '#tour-play', '#reset-camera', '#zoom-in', '#mobile-menu']) {
      const box = await mobile.locator(selector).boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `${selector} must offer a 44px touch target`);
    }
    await mobile.locator('#toggle-experience-details').click();
    await visible(mobile, '#info-dialog');
    assert.ok((await mobile.locator('#dialog-content').textContent()).length > 70);
    const dialogFont = await mobile.locator('#dialog-content p').first().evaluate(node =>
      Number.parseFloat(getComputedStyle(node).fontSize));
    assert.ok(dialogFont >= 13, 'Full mobile explanations must use readable body text');
    await mobile.locator('#close-dialog').click();
  });

  await check('mobile default view renders and produces a reviewable screenshot', async () => {
    await load(mobile, url);
    await mobile.waitForTimeout(1400);
    report.diagnostics.mobile = await checkWebGL(mobile);
    await screenshot(mobile, 'mobile');
  });

  await check('unsupported WebGL shows a useful fallback with accessible component descriptions', async () => {
    const fallback = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    activePage = fallback;
    observe(fallback, 'webgl-unsupported', text =>
      /^(THREE\.WebGLRenderer: Error creating WebGL context\.|AERIS: 3D viewer initialization failed\.)/.test(text),
    );
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl2') return null;
        return original.call(this, type, ...args);
      };
    });
    const response = await fallback.goto(url, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200);
    await fallback.waitForFunction(() => window.__AERIS_READY__ === true);
    await visible(fallback, '#scene-error');
    await hidden(fallback, '#loading-screen');
    const state = await diagnostics(fallback);
    assert.equal(state.viewer, null, 'WebGL unavailability must use the content fallback');
    assert.match(await fallback.locator('#scene-error-message').textContent(), /WebGL/);
    await fallback.locator('#parts-list .part-button').first().click();
    await visible(fallback, '#part-detail');
    assert.equal((await diagnostics(fallback)).selectedPart, 'fan');
    const detailUncovered = await fallback.locator('#detail-title').evaluate(title => {
      const rect = title.getBoundingClientRect();
      const topElement = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return document.getElementById('part-detail').contains(topElement);
    });
    assert.equal(detailUncovered, true, 'The fallback message must not cover component descriptions');
    await screenshot(fallback, 'webgl-fallback');
    await fallback.locator('#close-detail').click();
    await hidden(fallback, '#part-detail');
    report.diagnostics.webglFallback = state;
  });

  await check('desktop and mobile interactions complete without browser errors', async () => {
    assert.deepEqual(report.pageErrors, [], 'No uncaught browser exceptions are allowed');
    assert.deepEqual(report.consoleErrors, [], 'No browser console errors are allowed');
    assert.deepEqual(report.httpErrors, [], 'All requested assets must load successfully');
  });
}

try {
  await fs.mkdir(outputDir, { recursive: true });
  let base = baseArgument;
  if (!base) {
    server = createPreview({ configPath: 'missing-config-for-engine-test.json' });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const deadline = new Promise((_, reject) => {
    runTimer = setTimeout(() => reject(new Error('AERIS browser verification exceeded 240 seconds')), 240000);
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
    try { await screenshot(activePage, 'failure'); } catch { /* Keep the original failure in the report. */ }
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
  console.log(`AERIS verification ${report.status}: ${report.checks.filter(check => check.status === 'passed').length}/${report.checks.length} checks.`);
  console.log(`Report: ${path.join(outputDir, 'report.json')}`);
}
