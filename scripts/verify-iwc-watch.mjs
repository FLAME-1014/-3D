/**
 * Browser verification for the local IWC-inspired watch experience.
 *
 *   node scripts/verify-iwc-watch.mjs
 *   node scripts/verify-iwc-watch.mjs --base http://127.0.0.1:4188
 *
 * Uses visible controls and reads window.watchDiagnostics() for the resulting
 * geometry, camera, and clock state. The default server is loopback-only.
 * Chrome can be overridden with IWC_CHROME_PATH.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createPreview, workspace } from './preview.mjs';

const outputDir = path.join(workspace, 'output', 'iwc-watch');
const chromePath = process.env.IWC_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const baseArgument = args.find(value => value.startsWith('--base='))?.slice(7)
  || (args.includes('--base') ? args[args.indexOf('--base') + 1] : null);
if (args.includes('--base') && !baseArgument) throw new Error('--base requires a URL');
const TAU = Math.PI * 2;
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  url: null,
  browser: null,
  checks: [],
  diagnostics: {},
  performance: {},
  pageErrors: [],
  consoleErrors: [],
  failedRequests: [],
  httpErrors: [],
  externalRequests: [],
  screenshots: {},
};
let server;
let browser;
let activePage;
let runTimer;

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const circularDifference = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const diagnostics = page => page.evaluate(() => window.watchDiagnostics());
const isVisible = (page, selector) => page.locator(selector).isVisible();
const waitState = (page, key, value) => page.waitForFunction(
  ({ key, value }) => window.watchDiagnostics?.().state[key] === value,
  { key, value }, { timeout: 12000 },
);
const waitExplosion = (page, target) => page.waitForFunction(
  value => Math.abs(window.watchDiagnostics?.().state.explosion - value) < 0.008,
  target, { timeout: 15000 },
);

async function check(name, operation) {
  const entry = { name, status: 'running' };
  const started = Date.now();
  report.checks.push(entry);
  try {
    await operation();
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

function observe(page, viewport, origin) {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  page.on('console', message => {
    if (message.type() === 'error') {
      report.consoleErrors.push({ viewport, message: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', error => report.pageErrors.push({ viewport, message: error.message, stack: error.stack }));
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) {
      report.externalRequests.push({ viewport, url: request.url() });
    }
  });
  page.on('requestfailed', request => report.failedRequests.push({
    viewport, url: request.url(), error: request.failure()?.errorText,
  }));
  page.on('response', response => {
    if (response.status() >= 400) {
      report.httpErrors.push({ viewport, url: response.url(), status: response.status() });
    }
  });
}

async function load(page, url) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'The watch page must load successfully');
  await page.waitForFunction(() => window.watchDiagnostics?.().ready, null, { timeout: 60000 });
  await page.waitForFunction(() => window.watchDiagnostics?.().drawCalls > 0, null, { timeout: 20000 });
  assert.equal(await isVisible(page, '#webgl-error'), false, 'The WebGL fallback must not be shown');
  assert.equal(await isVisible(page, '#viewport canvas'), true, 'The real 3D canvas must be visible');
}

async function screenshot(page, name) {
  const destination = path.join(outputDir, `${name}.png`);
  await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('visible'), null, { timeout: 7000 });
  await page.screenshot({ path: destination, fullPage: true, animations: 'disabled', timeout: 30000 });
  await assertSceneUnscrolled(page);
  report.screenshots[name] = destination;
}

async function assertSceneUnscrolled(page) {
  assert.equal(
    await page.locator('#experience').evaluate(element => element.scrollLeft),
    0,
    'The 3D scene must not acquire an internal horizontal scroll offset when controls receive focus',
  );
}

async function rendererCheck(page) {
  const data = await diagnostics(page);
  assert.ok(data.partCount >= 50, 'The model must expose individually inspectable mechanical parts');
  assert.equal(data.parts.length, data.partCount);
  assert.equal(new Set(data.parts.map(part => part.id)).size, data.partCount, 'Component IDs must be unique');
  assert.ok(data.meshCount >= data.partCount, 'Inspectable components must have real geometry');
  assert.ok(data.triangleCount > 10000 && Number.isFinite(data.triangleCount));
  assert.ok(data.drawCalls > 0 && Number.isFinite(data.drawCalls));
  assert.ok(data.pixelRatio > 0 && data.pixelRatio <= 2, 'The renderer should cap drawing-buffer resolution');
  assert.ok(data.sapphire.ior >= 1.7 && data.sapphire.ior <= 1.8, 'Sapphire should use its physical refractive index');
  assert.ok(data.sapphire.transmission > 0.8, 'The sapphire must have physical light transmission');
  for (const part of data.parts) {
    assert.equal(typeof part.name, 'string');
    assert.ok(part.name.length > 0);
    for (const key of ['position', 'base', 'explode']) {
      assert.equal(part[key].length, 3, `${part.id}.${key} must be a 3D vector`);
      assert.ok(part[key].every(Number.isFinite), `${part.id}.${key} must remain finite`);
      assert.ok(part[key].every(value => Math.abs(value) < 1000), `${part.id}.${key} must remain bounded`);
    }
    assert.ok(part.screen.length >= 2 && part.screen.every(Number.isFinite), `${part.id} screen projection must remain finite`);
  }
  const canvas = await page.locator('#viewport canvas').evaluate(element => {
    const gl = element.getContext('webgl2');
    const bounds = element.getBoundingClientRect();
    return { width: element.width, height: element.height, visibleWidth: bounds.width, visibleHeight: bounds.height, lost: !gl || gl.isContextLost() };
  });
  assert.equal(canvas.lost, false, 'The WebGL 2 context must remain live');
  assert.ok(canvas.width > 100 && canvas.height > 100);
  assert.ok(canvas.visibleWidth > 100 && canvas.visibleHeight > 100);
  return {
    partCount: data.partCount,
    meshCount: data.meshCount,
    triangleCount: data.triangleCount,
    drawCalls: data.drawCalls,
    pixelRatio: data.pixelRatio,
    sapphire: data.sapphire,
    camera: data.camera,
    target: data.target,
    canvas,
  };
}

async function selectRenderedPart(page) {
  const candidates = await page.evaluate(() => {
    const data = window.watchDiagnostics();
    const canvas = document.querySelector('#viewport canvas');
    const box = canvas.getBoundingClientRect();
    return data.parts.filter(part => part.visible && part.category !== 'movement')
      .map(part => ({ id: part.id, x: part.screen[0], y: part.screen[1] }))
      .filter(point => point.x > box.left + 10 && point.x < box.right - 10
        && point.y > box.top + 10 && point.y < box.bottom - 10
        && document.elementFromPoint(point.x, point.y) === canvas)
      .slice(0, 16);
  });
  assert.ok(candidates.length > 0, 'The visible model must provide a clickable projected component');
  for (const point of candidates) {
    await page.mouse.click(point.x, point.y);
    const data = await diagnostics(page);
    if (data.state.selected) {
      assert.ok(data.parts.some(part => part.id === data.state.selected));
      assert.equal(await isVisible(page, '#part-card'), true);
      await page.locator('#close-part').click();
      assert.equal(Boolean((await diagnostics(page)).state.selected), false);
      return;
    }
  }
  assert.fail('Clicking rendered component centers must select a visible model part');
}

async function frameSample(page) {
  // These are observed animation-frame intervals in this browser environment,
  // not a hardware-independent promise of production GPU frame rate.
  return page.evaluate(() => new Promise(resolve => {
    const samples = [];
    const started = performance.now();
    let previous = started;
    const frame = now => {
      samples.push(now - previous);
      previous = now;
      if (now - started < 1400 && samples.length < 90) {
        requestAnimationFrame(frame);
        return;
      }
      const sorted = samples.slice(1).sort((a, b) => a - b);
      const percentile = fraction => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null;
      resolve({
        sampleFrames: samples.length,
        elapsedMs: now - started,
        medianFrameIntervalMs: percentile(0.5),
        p95FrameIntervalMs: percentile(0.95),
        note: 'Headless browser observation only; actual GPU performance varies.',
      });
    };
    requestAnimationFrame(frame);
  }));
}

async function dragCanvas(page) {
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  const point = await page.locator('#viewport canvas').evaluate(canvas => {
    const box = canvas.getBoundingClientRect();
    for (const [rx, ry] of [[0.48, 0.42], [0.5, 0.65], [0.7, 0.55], [0.3, 0.4]]) {
      const x = box.x + box.width * rx;
      const y = box.y + box.height * ry;
      if (document.elementFromPoint(x, y) === canvas) return { x, y };
    }
    return null;
  });
  assert.ok(point, 'An unobstructed canvas area must accept orbit input');
  const before = (await diagnostics(page)).camera;
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y - 24, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(previous => {
    const current = window.watchDiagnostics().camera;
    return Math.hypot(...current.map((value, i) => value - previous[i])) > 0.05;
  }, before);
  return point;
}

async function verify(base) {
  const url = new URL('/iwc-watch/', base).href;
  report.url = url;
  await fs.access(chromePath);
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  report.browser = browser.version();
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, timezoneId: 'Asia/Shanghai' });
  activePage = desktop;
  observe(desktop, 'desktop', new URL(base).origin);

  await check('desktop loads detailed finite geometry and a physical sapphire material', async () => {
    await load(desktop, url);
    report.diagnostics.desktop = await rendererCheck(desktop);
    report.performance.desktop = await frameSample(desktop);
    await screenshot(desktop, 'desktop');
  });

  await check('hour, minute, and small-second hands follow current local time continuously', async () => {
    const read = () => desktop.evaluate(() => {
      const clock = window.watchDiagnostics().clock;
      const date = new Date(clock.timestamp);
      const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
      const minutes = date.getMinutes() + seconds / 60;
      const hours = date.getHours() % 12 + minutes / 60;
      return {
        clock, now: Date.now(),
        expected: { hour: -hours / 12 * Math.PI * 2, minute: -minutes / 60 * Math.PI * 2, second: -seconds / 60 * Math.PI * 2 },
      };
    });
    const first = await read();
    await desktop.waitForFunction(timestamp => window.watchDiagnostics().clock.timestamp > timestamp + 750, first.clock.timestamp);
    const second = await read();
    for (const sample of [first, second]) {
      assert.ok(Math.abs(sample.now - sample.clock.timestamp) < 1200, 'Clock time must stay synchronized with the system');
      for (const hand of ['hour', 'minute', 'second']) {
        assert.ok(Number.isFinite(sample.clock[hand]));
        assert.ok(circularDifference(sample.clock[hand], sample.expected[hand]) < 0.001, `${hand} angle must include sub-unit time fractions`);
      }
    }
    const elapsedSeconds = (second.clock.timestamp - first.clock.timestamp) / 1000;
    const actualSecondDelta = Math.atan2(Math.sin(second.clock.second - first.clock.second), Math.cos(second.clock.second - first.clock.second));
    assert.ok(Math.abs(actualSecondDelta + elapsedSeconds * TAU / 60) < 0.001, 'Small seconds must sweep clockwise at one revolution per minute');
    assert.ok(circularDifference(second.clock.minute, first.clock.minute) > 0.00001, 'The minute hand must advance between seconds');
    report.diagnostics.clock = { first, second, elapsedSeconds };
  });

  await check('mouse orbit, wheel zoom, zoom buttons, and automatic rotation change the camera', async () => {
    const point = await dragCanvas(desktop);
    let before = await diagnostics(desktop);
    let previousDistance = distance(before.camera, before.target);
    await desktop.mouse.move(point.x, point.y);
    await desktop.mouse.wheel(0, -180);
    await desktop.waitForFunction(previous => {
      const data = window.watchDiagnostics();
      return Math.hypot(...data.camera.map((value, i) => value - data.target[i])) < previous * 0.98;
    }, previousDistance);
    before = await diagnostics(desktop);
    previousDistance = distance(before.camera, before.target);
    await desktop.locator('#zoom-out').click();
    await desktop.waitForFunction(previous => {
      const data = window.watchDiagnostics();
      return Math.hypot(...data.camera.map((value, i) => value - data.target[i])) > previous * 1.02;
    }, previousDistance);
    before = await diagnostics(desktop);
    previousDistance = distance(before.camera, before.target);
    await desktop.locator('#zoom-in').click();
    await desktop.waitForFunction(previous => {
      const data = window.watchDiagnostics();
      return Math.hypot(...data.camera.map((value, i) => value - data.target[i])) < previous * 0.98;
    }, previousDistance);
    await desktop.locator('#auto-rotate').click();
    await waitState(desktop, 'autoRotate', true);
    const rotationStart = (await diagnostics(desktop)).camera;
    await desktop.waitForFunction(previous => {
      const current = window.watchDiagnostics().camera;
      return Math.hypot(...current.map((value, i) => value - previous[i])) > 0.04;
    }, rotationStart);
    await desktop.locator('#auto-rotate').click();
    await waitState(desktop, 'autoRotate', false);
    await desktop.locator('#reset-view').click();
    await waitState(desktop, 'view', 'hero');
  });

  await check('the rendered model supports direct component picking', async () => {
    await desktop.waitForTimeout(1100);
    await selectRenderedPart(desktop);
  });

  await check('front, back, and side presets produce distinct camera positions', async () => {
    const cameras = [];
    for (const view of ['front', 'back', 'side']) {
      await desktop.locator(`[data-view="${view}"]`).click();
      await waitState(desktop, 'view', view);
      await desktop.waitForTimeout(1100);
      cameras.push((await diagnostics(desktop)).camera);
      assert.equal(await desktop.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'), 'true');
    }
    assert.ok(distance(cameras[0], cameras[1]) > 1, 'Front and back must face opposite sides');
    assert.ok(distance(cameras[1], cameras[2]) > 1, 'Side must reveal the case profile');
    report.diagnostics.presetCameras = cameras;
    await desktop.locator('#reset-view').click();
  });

  await check('explosion and native slider move individual parts, and assembly restores every base position', async () => {
    await waitExplosion(desktop, 0);
    const initial = await diagnostics(desktop);
    await desktop.locator('#exploded-button').click();
    await waitExplosion(desktop, 1);
    assert.equal(await desktop.locator('#exploded-button').getAttribute('aria-pressed'), 'true');
    const exploded = await diagnostics(desktop);
    const moved = exploded.parts.filter(part => distance(part.position, initial.parts.find(item => item.id === part.id).position) > 0.05);
    assert.ok(moved.length > initial.partCount * 0.75, 'Explosion must physically move most individual components');
    await assertSceneUnscrolled(desktop);
    report.diagnostics.explosion = { partCount: initial.partCount, movedParts: moved.length };
    await desktop.evaluate(() => scrollTo(0, 0));
    await screenshot(desktop, 'exploded');
    const range = desktop.locator('#explosion');
    await range.focus();
    await range.press('Home');
    for (let index = 0; index < 4; index++) await range.press('PageUp');
    assert.equal(await range.inputValue(), '40');
    await waitExplosion(desktop, 0.4);
    assert.match(await desktop.locator('#explosion-value').textContent(), /40/);
    await desktop.locator('#assembled-button').click();
    await waitExplosion(desktop, 0);
    await desktop.waitForFunction(() => window.watchDiagnostics().parts.every(part =>
      Math.hypot(...part.position.map((value, i) => value - part.base[i])) < 0.025,
    ));
    await assertSceneUnscrolled(desktop);
  });

  await check('catalog search and category filters reach individual mechanical components', async () => {
    await desktop.locator('#components-button').click();
    assert.equal(await isVisible(desktop, '#components-drawer'), true);
    const initial = await diagnostics(desktop);
    assert.equal(await desktop.locator('#parts-list .part-row').count(), initial.partCount);
    await desktop.locator('[data-filter="movement"]').click();
    const movementCount = await desktop.locator('#parts-list .part-row').count();
    assert.ok(movementCount > 20 && movementCount < initial.partCount);
    await desktop.locator('#part-search').fill('不存在的零件xyz');
    assert.equal(await desktop.locator('#parts-list .part-row').count(), 0);
    await desktop.locator('#part-search').fill('');
    const selectedName = (await desktop.locator('#parts-list .part-row .part-row-copy strong').first().textContent()).trim();
    await desktop.locator('#part-search').fill(selectedName);
    assert.ok(await desktop.locator('#parts-list .part-row').count() >= 1);
    await desktop.locator('#parts-list .part-row').first().click();
    assert.equal(await isVisible(desktop, '#part-card'), true);
    assert.equal(await isVisible(desktop, '#components-drawer'), false);
    assert.equal((await desktop.locator('#part-name').textContent()).trim(), selectedName);
    assert.ok((await desktop.locator('#part-description').textContent()).trim().length > 20);
    assert.ok((await desktop.locator('#part-material').textContent()).trim().length > 0);
  });

  await check('selected parts can be separated, restored, and isolated without losing the complete assembly', async () => {
    // Choosing a movement component also opens the assembly. Let that existing
    // UI transition settle before measuring the independent separation action.
    await desktop.waitForFunction(() => {
      const data = window.watchDiagnostics();
      return Math.abs(data.state.explosion - data.state.targetExplosion) < 0.0005
        && data.parts.every(part => Math.hypot(...part.position.map((value, i) =>
          value - part.base[i] - part.explode[i] * data.state.targetExplosion)) < 0.01);
    }, null, { timeout: 15000 });
    const initial = await diagnostics(desktop);
    const selectedId = initial.state.selected;
    assert.ok(selectedId, 'A part must be selected in the catalog');
    const original = initial.parts.find(part => part.id === selectedId);
    assert.ok(original);
    await desktop.locator('#separate-part').click();
    await desktop.waitForFunction(({ id, position }) => {
      const part = window.watchDiagnostics().parts.find(item => item.id === id);
      return Math.hypot(...part.position.map((value, i) => value - position[i])) > 0.2;
    }, { id: selectedId, position: original.position });
    await desktop.locator('#separate-part').click();
    await desktop.waitForFunction(({ id, position }) => {
      const part = window.watchDiagnostics().parts.find(item => item.id === id);
      return Math.hypot(...part.position.map((value, i) => value - position[i])) < 0.025;
    }, { id: selectedId, position: original.position });
    await desktop.locator('#isolate-part').click();
    await desktop.waitForFunction(() => Boolean(window.watchDiagnostics().state.isolated));
    const isolated = await diagnostics(desktop);
    const visibleParts = isolated.parts.filter(part => part.visible);
    assert.equal(visibleParts.length, 1, 'Only the isolated component must remain visible');
    assert.equal(visibleParts[0].id, selectedId);
    assert.equal(await isVisible(desktop, '#return-button'), true);
    await desktop.locator('#return-button').click();
    await desktop.waitForFunction(() => !window.watchDiagnostics().state.isolated);
    assert.equal((await diagnostics(desktop)).parts.filter(part => part.visible).length, initial.partCount);
    await desktop.locator('#reset-view').click();
    await waitExplosion(desktop, 0);
    const reset = await diagnostics(desktop);
    assert.equal(reset.state.view, 'hero');
    assert.equal(Boolean(reset.state.selected), false);
    assert.equal(Boolean(reset.state.isolated), false);
    assert.equal(reset.state.autoRotate, false);
    assert.equal(await isVisible(desktop, '#part-card'), false);
  });

  await check('isolating a small screw during an active explosion keeps it stationary and centered', async () => {
    await desktop.locator('#reset-view').click();
    await waitExplosion(desktop, 0);
    await desktop.waitForFunction(() => window.watchDiagnostics().parts.every(part =>
      Math.hypot(...part.position.map((value, i) => value - part.base[i])) < 0.01,
    ));
    await desktop.locator('#components-button').click();
    await desktop.locator('[data-filter="movement"]').click();
    await desktop.locator('#part-search').fill('机芯螺丝');
    const screwId = 'movement-screw-01';
    await desktop.locator(`#parts-list [data-part="${screwId}"]`).click();
    const opening = await diagnostics(desktop);
    assert.equal(opening.state.selected, screwId);
    assert.ok(opening.state.targetExplosion - opening.state.explosion > 0.01, 'The screw must be selected while the assembly is still opening');
    await desktop.locator('#isolate-part').click();
    await desktop.waitForFunction(() => window.watchDiagnostics().state.isolated);
    const frozen = await diagnostics(desktop);
    assert.ok(frozen.state.targetExplosion - frozen.state.explosion > 0.0005, 'Isolation must begin before the global explosion settles');
    const frozenPart = frozen.parts.find(part => part.id === screwId);
    assert.equal(frozen.parts.filter(part => part.visible).length, 1);
    await desktop.waitForTimeout(1600);
    const settled = await diagnostics(desktop);
    const settledPart = settled.parts.find(part => part.id === screwId);
    assert.ok(distance(frozenPart.position, settledPart.position) < 0.000001, 'The isolated screw must stay at the camera-fit position as explosion animation continues');
    assert.ok(settled.parts.some(part => part.id !== screwId
      && distance(part.position, frozen.parts.find(item => item.id === part.id).position) > 0.01),
    'Other assembly components must continue easing independently');
    const viewport = await desktop.locator('#viewport').boundingBox();
    const relativeScreen = [
      (settledPart.screen[0] - viewport.x) / viewport.width,
      (settledPart.screen[1] - viewport.y) / viewport.height,
    ];
    assert.ok(relativeScreen.every(value => value > 0.3 && value < 0.7),
      `The isolated screw should remain centered in the viewport, got ${JSON.stringify(relativeScreen)}`);
    report.diagnostics.midExplosionIsolation = {
      id: screwId,
      startingExplosion: frozen.state.explosion,
      endingExplosion: settled.state.explosion,
      positionDrift: distance(frozenPart.position, settledPart.position),
      relativeScreen,
    };
    await assertSceneUnscrolled(desktop);
    await desktop.locator('#return-button').click();
    await desktop.locator('#reset-view').click();
    await waitExplosion(desktop, 0);
  });

  await check('movement exploration and explanatory dialogs are reachable and dismissible', async () => {
    await desktop.locator('#nav-movement').click();
    await desktop.waitForTimeout(1400);
    report.diagnostics.movement = await rendererCheck(desktop);
    await desktop.evaluate(() => scrollTo(0, 0));
    await screenshot(desktop, 'movement');
    await desktop.locator('#nav-watch').click();
    for (const selector of ['#help-button', '#nav-craft', '#model-notes']) {
      await desktop.locator(selector).click();
      assert.equal(await isVisible(desktop, '#info-dialog'), true);
      assert.ok((await desktop.locator('#dialog-content').textContent()).trim().length > 60);
      await desktop.keyboard.press('Escape');
      assert.equal(await isVisible(desktop, '#info-dialog'), false);
    }
  });

  await check('pause freezes every clock hand and resume resynchronizes local time', async () => {
    await desktop.locator('#model-notes').click();
    await desktop.locator('#pause-button').click();
    await waitState(desktop, 'paused', true);
    const paused = (await diagnostics(desktop)).clock;
    await desktop.waitForTimeout(600);
    const stillPaused = (await diagnostics(desktop)).clock;
    assert.deepEqual(stillPaused, paused, 'Pause should keep the timestamp and all hand angles unchanged');
    await desktop.locator('#pause-button').click();
    await waitState(desktop, 'paused', false);
    await desktop.waitForFunction(timestamp => window.watchDiagnostics().clock.timestamp > timestamp + 500, paused.timestamp);
    await desktop.keyboard.press('Escape');
    assert.equal(await isVisible(desktop, '#info-dialog'), false);
  });
  await desktop.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai',
  });
  activePage = mobile;
  observe(mobile, 'mobile', new URL(base).origin);
  await check('mobile renders the model and all primary controls without horizontal overflow', async () => {
    await load(mobile, url);
    report.diagnostics.mobile = await rendererCheck(mobile);
    report.performance.mobile = await frameSample(mobile);
    const bounds = await mobile.evaluate(() => ({
      viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(bounds.documentWidth <= bounds.viewportWidth + 1, `Mobile layout overflows: ${JSON.stringify(bounds)}`);
    await screenshot(mobile, 'mobile');
    await mobile.locator('#components-button').tap();
    assert.equal(await isVisible(mobile, '#components-drawer'), true);
    await mobile.locator('[data-filter="strap"]').tap();
    const count = await mobile.locator('#parts-list .part-row').count();
    assert.ok(count > 0);
    await mobile.locator('#parts-list .part-row').first().tap();
    assert.equal(await isVisible(mobile, '#part-card'), true);
    const card = await mobile.locator('#part-card').boundingBox();
    assert.ok(card.x >= -1 && card.x + card.width <= 391, 'The mobile part card must fit the viewport width');
    await mobile.locator('#isolate-part').tap();
    await mobile.waitForFunction(() => Boolean(window.watchDiagnostics().state.isolated));
    assert.equal((await diagnostics(mobile)).parts.filter(part => part.visible).length, 1);
    await mobile.locator('#return-button').tap();
    await mobile.waitForFunction(() => !window.watchDiagnostics().state.isolated);
    await mobile.locator('#reset-view').tap();
    await waitExplosion(mobile, 0);
  });

  await check('a native two-finger pinch zooms the mobile camera without selecting a part', async () => {
    await mobile.waitForTimeout(1250);
    await mobile.locator('#viewport canvas').scrollIntoViewIfNeeded();
    const canvas = await mobile.locator('#viewport canvas').boundingBox();
    const center = { x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.48 };
    assert.ok(center.y > 60 && center.y < 780, 'The native touch gesture must fall inside the visible browser viewport');
    const initial = await diagnostics(mobile);
    assert.equal(initial.state.selected, null);
    const initialDistance = distance(initial.camera, initial.target);
    const session = await mobile.context().newCDPSession(mobile);
    try {
      const touch = (id, x) => ({ id, x, y: center.y, radiusX: 5, radiusY: 5, force: 1 });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [touch(1, center.x - 45), touch(2, center.x + 25)],
      });
      for (let index = 1; index <= 8; index++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [touch(1, center.x - 45 - index * 7), touch(2, center.x + 25)],
        });
        await mobile.waitForTimeout(20);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await mobile.waitForFunction(previous => {
        const data = window.watchDiagnostics();
        return Math.hypot(...data.camera.map((value, i) => value - data.target[i])) < previous * 0.95;
      }, initialDistance);
      await mobile.waitForTimeout(150);
      const zoomed = await diagnostics(mobile);
      assert.equal(zoomed.state.selected, null, 'Ending a multi-touch gesture must not trigger single-tap part picking');
      assert.equal(await isVisible(mobile, '#part-card'), false);
      report.diagnostics.mobilePinch = {
        distanceBefore: initialDistance,
        distanceAfter: distance(zoomed.camera, zoomed.target),
        selectedAfter: zoomed.state.selected,
      };
      await assertSceneUnscrolled(mobile);
    } finally {
      await session.detach();
    }
    await mobile.locator('#reset-view').tap();
  });

  await check('local desktop and mobile interaction completes without runtime or network errors', async () => {
    assert.deepEqual(report.pageErrors, [], 'No uncaught browser exceptions are allowed');
    assert.deepEqual(report.consoleErrors, [], 'No browser console errors are allowed');
    assert.deepEqual(report.httpErrors, [], 'All local assets must load successfully');
    assert.deepEqual(report.failedRequests, [], 'No asset request may fail');
    assert.deepEqual(report.externalRequests, [], 'The experience must not depend on a CDN or external network');
  });
}

try {
  await fs.mkdir(outputDir, { recursive: true });
  let base = baseArgument;
  if (!base) {
    server = createPreview({ configPath: path.join(outputDir, 'unused-map-config.json') });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const deadline = new Promise((_, reject) => {
    runTimer = setTimeout(() => reject(new Error('Watch browser verification exceeded 300 seconds')), 300000);
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
  console.log(`IWC verification ${report.status}: ${report.checks.filter(item => item.status === 'passed').length}/${report.checks.length} checks.`);
  console.log(`Report: ${path.join(outputDir, 'report.json')}`);
}
