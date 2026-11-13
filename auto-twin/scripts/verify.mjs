import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';

const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
  const key = argument.slice(2);
  options[key] = process.argv[index + 1] && !process.argv[index + 1].startsWith('--') ? process.argv[++index] : true;
}
if (options.help) {
  console.log('npm run verify -- [--url http://127.0.0.1:4200] [--output docs/verification/name] [--samples 120] [--chrome path] [--strict-images] [--allow-missing-controls]');
  process.exit(0);
}
const width = Number(options.width || 1600), height = Number(options.height || 1000);
const sampleCount = Number(options.samples || 120);
if (![width, height, sampleCount].every(Number.isInteger) || width < 320 || height < 240 || sampleCount < 10 || sampleCount > 1200) throw new Error('Invalid viewport or sample count');
const baseUrl = new URL(String(options.url || 'http://127.0.0.1:4200'));
const output = path.resolve(String(options.output || `docs/verification/${new Date().toISOString().replace(/[:.]/g, '-')}`));
await fs.mkdir(path.dirname(output), {recursive: true});
try { await fs.mkdir(output); } catch (error) {
  if (error.code === 'EEXIST') throw new Error(`Choose a new verification output directory: ${output}`);
  throw error;
}
let chromium;
try { ({chromium} = await import('playwright')); } catch { throw new Error('Playwright is required. Install the project dependencies before npm run verify.'); }
const report = {
  startedAt: new Date().toISOString(), url: baseUrl.href, output,
  mode: 'headed Chrome, foreground, native browser clock, no GPU spoofing launch arguments',
  viewport: [width, height], devicePixelRatio: 1,
  host: {platform: os.platform(), release: os.release(), architecture: os.arch(), cpuModel: os.cpus()[0]?.model || null},
  checks: [], errors: [], warnings: [], routes: [], controls: [], switching: [], networkFailures: [],
  memoryPolicy: 'geometries/textures are renderer object counts; no VRAM MB claimed',
};
let foregroundTimer;
let browser, page, currentShop = 'startup';
async function check(name, action) {
  try {
    const detail = await action();
    report.checks.push({name, status: 'passed', detail: detail ?? null});
  } catch (error) {
    report.checks.push({name, status: 'failed', error: error.message});
  }
}
const pause = async () => page.evaluate(() => {
  if (typeof window.__workshop.pause !== 'function') throw new Error('pause() debug interface required');
  window.__workshop.pause();
});
const paint = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const diagnostic = async () => page.evaluate(() => window.__workshop.debug());
const settleCamera = async () => {
  await page.waitForFunction(() => window.__workshop.debug().cameraMoving !== true, undefined, {timeout: 5000});
  await paint();
};
const projectedLabels = async () => page.locator('[data-world-label]').evaluateAll(labels => labels.map(label => {
  const rectangle = label.getBoundingClientRect();
  return {index: Number(label.dataset.worldLabel), transform: label.style.transform, visible: getComputedStyle(label).display !== 'none', x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height, text: label.textContent};
}));
async function canvasTarget(items, expectedId) {
  for (const item of items) {
    const point = item.screen ?? item.center ?? [item.x, item.y];
    if (item.visible === false || !Array.isArray(point) || !point.slice(0, 2).every(Number.isFinite)) continue;
    for (const [dx, dy] of [[0, 0], [-12, 0], [12, 0], [0, -12], [0, 12]]) {
      const x = point[0] + dx, y = point[1] + dy;
      if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
      const canvasExposed = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', {x, y});
      if (!canvasExposed) continue;
      await page.mouse.move(x, y); await paint();
      const hover = page.locator('.hover-info');
      if (!await hover.count()) continue;
      const id = (await hover.locator('code').textContent())?.trim();
      if (expectedId ? id !== expectedId : id !== item.id) continue;
      return {id, name: (await hover.locator('strong').textContent())?.trim(), x, y, source: item};
    }
  }
  throw new Error(`No actual canvas hit found for ${expectedId || 'visible projected equipment'}; DOM overlays and ray-hit identities were checked`);
}
const robotTool = (debug, id) => {
  const index = Number(id.replace('ROBOT-', '')) - 1;
  const contact = debug.details?.robotContacts?.find(robot => robot.index === index);
  assert.ok(Array.isArray(contact?.actualTCP) && contact.actualTCP.every(Number.isFinite), 'actual robot TCP must be measured');
  return contact.actualTCP;
};
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
function decodeScreenshot(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'screenshot must be PNG');
  const chunks = []; let width, height, channels;
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8), data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8, '8-bit screenshot expected'); assert.equal(data[12], 0, 'non-interlaced screenshot expected');
      assert.ok(data[9] === 2 || data[9] === 6, 'RGB or RGBA screenshot expected'); channels = data[9] === 2 ? 3 : 4;
    } else if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  const encoded = inflateSync(Buffer.concat(chunks)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  assert.equal(encoded.length, (stride + 1) * height, 'PNG scanlines must match image dimensions');
  for (let y = 0; y < height; y++) {
    const filter = encoded[y * (stride + 1)], source = y * (stride + 1) + 1, row = y * stride;
    assert.ok(filter <= 4, 'supported PNG row filter required');
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[row + x - channels] : 0, up = y ? pixels[row + x - stride] : 0, corner = y && x >= channels ? pixels[row + x - stride - channels] : 0;
      const predictor = left + up - corner, a = Math.abs(predictor - left), b = Math.abs(predictor - up), c = Math.abs(predictor - corner);
      const paeth = a <= b && a <= c ? left : b <= c ? up : corner;
      const adjustment = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      pixels[row + x] = (encoded[source + x] + adjustment) & 255;
    }
  }
  return {width, height, channels, pixels};
}
function screenshotDifference(first, second) {
  const a = decodeScreenshot(first), b = decodeScreenshot(second);
  assert.deepEqual([a.width, a.height, a.channels], [b.width, b.height, b.channels], 'repeat images must use identical dimensions and color mode');
  let changedPixels = 0, maxChannelDifference = 0, totalChannelDifference = 0;
  let left = a.width, top = a.height, right = -1, bottom = -1;
  for (let offset = 0; offset < a.pixels.length; offset += a.channels) {
    let changed = false;
    for (let channel = 0; channel < a.channels; channel++) {
      const delta = Math.abs(a.pixels[offset + channel] - b.pixels[offset + channel]);
      changed ||= delta > 0; maxChannelDifference = Math.max(maxChannelDifference, delta); totalChannelDifference += delta;
    }
    if (changed) {
      changedPixels++; const pixel = offset / a.channels, x = pixel % a.width, y = Math.floor(pixel / a.width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return {changedPixels, totalPixels: a.width * a.height, changedFraction: changedPixels / (a.width * a.height), maxChannelDifference, meanChannelDifference: totalChannelDifference / a.pixels.length, bounds: changedPixels ? [left, top, right, bottom] : null};
}
function poseFingerprint(debug) {
  for (const key of ['poses', 'pose', 'productionState', 'production', 'deterministic']) {
    if (debug[key] !== undefined) return JSON.stringify({shop: debug.shop, time: debug.time, [key]: debug[key]});
  }
  return null;
}
function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {count: sorted.length, min: sorted[0], mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, p50: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.floor((sorted.length - 1) * .95)], max: sorted.at(-1)};
}
async function control(id, action) {
  const locator = page.getByTestId(id);
  if (await locator.count() !== 1) {
    const detail = {id, status: options['allow-missing-controls'] ? 'skipped' : 'failed', reason: 'Expected exactly one matching data-testid'};
    report.controls.push(detail);
    if (!options['allow-missing-controls']) throw new Error(`Missing control selector: ${id}`);
    return false;
  }
  await action(locator);
  report.controls.push({id, status: 'passed'});
  return true;
}
async function assertShop(shop) {
  await page.waitForFunction(expected => window.__workshop?.debug().shop === expected, shop, {timeout: 15000});
  currentShop = shop;
  await paint();
  const d = await diagnostic();
  assert.equal(d.shop, shop);
  assert.equal(await page.locator('canvas').count(), 1, 'one live scene canvas expected');
  for (const field of ['rendererCount', 'loopCount', 'clockCount']) assert.equal(d[field], 1, `${field} must be one`);
  return d;
}
try {
  browser = await chromium.launch(options.chrome
    ? {headless: false, executablePath: String(options.chrome)}
    : {headless: false, channel: 'chrome'});
  report.browserVersion = await browser.version();
  page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
  foregroundTimer = setInterval(() => page.bringToFront().catch(() => {}), 250);
  page.on('pageerror', error => report.errors.push({shop: currentShop, type: 'pageerror', message: error.message}));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push({shop: currentShop, type: /shader|WebGLProgram/i.test(message.text()) ? 'shader' : 'console-error', message: message.text()});
  });
  page.on('response', response => {if (response.status() >= 400) report.networkFailures.push({shop: currentShop, status: response.status(), url: response.url()})});
  for (const shop of ['park', 'stamping', 'welding']) {
    currentShop = shop;
    const url = new URL(baseUrl); url.search = shop === 'park' ? '' : `?shop=${shop}`;
    await check(`${shop}: route and one live renderer`, async () => {
      await page.goto(url.href, {waitUntil: 'networkidle'});
      await page.bringToFront();
      await page.waitForFunction(() => typeof window.__workshop?.debug === 'function', undefined, {timeout: 30000});
      const d = await assertShop(shop);
      await pause();
      await page.evaluate(() => {window.__workshop.quality('balanced'); window.__workshop.seek(34.2)});
      await paint();
      const platform = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const gl = canvas?.getContext('webgl2');
        const extension = gl?.getExtension('WEBGL_debug_renderer_info');
        return {
          visibility: document.visibilityState, focus: document.hasFocus(),
          viewport: [innerWidth, innerHeight], devicePixelRatio,
          renderer: gl && extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
          vendor: gl && extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
          webglVersion: gl ? gl.getParameter(gl.VERSION) : null,
        };
      });
      assert.equal(platform.visibility, 'visible', 'performance verification requires a foreground page');
      if (platform.renderer && /swiftshader|llvmpipe|software rasterizer/i.test(platform.renderer)) report.warnings.push(`${shop}: software renderer detected; measurements cannot establish physical GPU performance`);
      const screenshot = `${shop}-balanced-34.2.png`;
      await page.screenshot({path: path.join(output, screenshot), animations: 'disabled', caret: 'hide'});
      report.routes.push({shop, platform, diagnostic: await diagnostic(), screenshot});
      return d;
    });
    if (shop === 'park') continue;
    await check(`${shop}: required debug methods`, async () => {
      const methods = await page.evaluate(() => Object.fromEntries(['station', 'seek', 'speed', 'play', 'pause', 'camera', 'explode', 'quality', 'debug'].map(key => [key, typeof window.__workshop[key]])));
      for (const [key, type] of Object.entries(methods)) assert.equal(type, 'function', `${key} must be a function`);
      return methods;
    });
    await check(`${shop}: seek repeats deterministic production poses`, async () => {
      await pause();
      const times = shop === 'stamping' ? [0, 1.5, 3.9, 4, 480.1, 522.1] : [0, 26.2, 34.2, 75.5, 76.1, 152.1];
      const snapshots = [];
      for (const time of times) {
        await page.evaluate(time => window.__workshop.seek(time), time); await paint();
        const first = await diagnostic();
        assert.ok(Math.abs(first.time - time) < 1e-7, `seek(${time}) was not exact`);
        const fingerprint = poseFingerprint(first);
        assert.notEqual(fingerprint, null, 'debug must expose poses or productionState; time alone does not prove pose determinism');
        await page.evaluate(time => window.__workshop.seek(time + 19.7), time); await paint();
        await page.evaluate(time => window.__workshop.seek(time), time); await paint();
        assert.equal(poseFingerprint(await diagnostic()), fingerprint, `poses changed when returning to ${time}s`);
        snapshots.push({time, sha256: crypto.createHash('sha256').update(fingerprint).digest('hex')});
      }
      return snapshots;
    });
    await check(`${shop}: paused scene stops drawing`, async () => {
      await pause(); await paint();
      const first = await diagnostic(); await page.waitForTimeout(200);
      const second = await diagnostic();
      assert.equal(second.time, first.time);
      assert.equal(second.frames, first.frames, 'idle paused scene should not render');
      return {frames: second.frames, intervalMs: 200};
    });
    await check(`${shop}: dashboard content and visibility`, async () => {
      await pause();
      await page.evaluate(() => {window.__workshop.seek(34.2); window.__workshop.station(-1)}); await settleCamera();
      const dashboard = page.getByTestId('production-dashboard');
      assert.equal(await dashboard.count(), 1, 'dashboard toggle must control an actual dashboard');
      assert.equal(await dashboard.locator('.dashboard-kpi').count(), 4);
      assert.equal(await dashboard.locator('.dashboard-column').count(), 2);
      const stationCount = shop === 'welding' ? 8 : 9;
      assert.equal(await dashboard.locator('.dashboard-status-row').count(), stationCount);
      assert.equal(await dashboard.locator('.dashboard-flow-node').count(), stationCount);
      const text = await dashboard.textContent();
      for (const title of ['今日产量', '在制数量', '生产节拍', '一次合格率', '设备综合效率', '质量偏差', '生产事件', '演示数据']) assert.ok(text.includes(title), `missing ${title}`);
      assert.ok(!/NaN|Infinity|undefined/.test(text), 'dashboard values must be finite');
      const beforeTime = (await diagnostic()).time;
      await control('dashboard-toggle', async locator => {
        await locator.click(); await paint();
        assert.equal(await dashboard.count(), 0, 'disabled dashboard must remove its panels');
        assert.equal(await page.locator('[data-world-label]').count(), 0, 'disabled dashboard must remove its world labels');
        await locator.click(); await paint();
        assert.equal(await dashboard.count(), 1);
        assert.equal(await dashboard.locator('.dashboard-kpi').count(), 4);
      });
      assert.equal((await diagnostic()).time, beforeTime, 'dashboard interaction must preserve paused production time');
      return {stationCount, panels: 7, labels: await page.locator('[data-world-label]').count(), time: beforeTime};
    });
    await check(`${shop}: flow navigation, dropdown, roof and process controls`, async () => {
      const nodes = page.locator('.dashboard-flow-node');
      const desiredIndex = 2;
      const id = (await page.locator('.dashboard-status-row').nth(desiredIndex).locator('.dashboard-status-name b').textContent()).trim();
      const before = await diagnostic();
      await nodes.nth(desiredIndex).click(); await settleCamera();
      const after = await diagnostic();
      assert.equal(after.station, desiredIndex, 'flow node must select its station');
      assert.equal(await nodes.nth(desiredIndex).getAttribute('aria-pressed'), 'true');
      assert.ok((await page.getByTestId('station-trigger').textContent()).includes(id), 'dropdown must follow flow station selection');
      assert.ok(Array.isArray(after.camera?.position) && Array.isArray(after.camera?.target), 'camera diagnostics are required');
      assert.ok(distance(after.camera.position, before.camera.position) > 1, 'flow selection must move the scene camera');
      await control('station-trigger', async locator => {
        await locator.click();
        assert.equal(await locator.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.getByRole('menu').count(), 1);
        await page.mouse.click(width / 2, 95);
        assert.equal(await locator.getAttribute('aria-expanded'), 'false', 'outside click must close custom dropdown');
        assert.equal(await page.getByRole('menu').count(), 0);
        await locator.click();
      });
      await control('station-option-0', async locator => {
        await locator.click(); await settleCamera();
        assert.equal((await diagnostic()).station, 0);
        assert.equal(await page.getByTestId('station-trigger').getAttribute('aria-expanded'), 'false');
        assert.equal(await nodes.nth(0).getAttribute('aria-pressed'), 'true');
      });
      const roof = (await diagnostic()).roofVisible;
      assert.equal(typeof roof, 'boolean', 'roofVisible must reflect actual world roof visibility');
      await control('roof-toggle', async locator => {
        await locator.click(); await paint(); assert.equal((await diagnostic()).roofVisible, !roof);
        await locator.click(); await paint(); assert.equal((await diagnostic()).roofVisible, roof);
      });
      await control('process-toggle', async locator => {
        assert.equal(await page.locator('.process-info').count(), 0);
        await locator.click(); await paint();
        assert.equal(await page.locator('.process-info').count(), 1);
        assert.ok((await page.locator('.process-info p').textContent()).length > 20, 'process explanation must include selected station content');
        await locator.click(); await paint(); assert.equal(await page.locator('.process-info').count(), 0);
      });
      assert.equal((await diagnostic()).time, before.time, 'navigation and controls must preserve paused production time');
      return {flowStation: id, dropdownStation: 0, roofRestored: roof, processCard: 'shown and dismissed'};
    });
    if (shop === 'welding') await check('welding: eight world labels follow the camera', async () => {
      await page.evaluate(() => window.__workshop.camera([0, 72, 105], [0, 2, 0])); await paint();
      const before = await projectedLabels();
      assert.equal(before.length, 8, 'all eight welding stations require a world label');
      assert.deepEqual(before.map(label => label.index).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
      assert.ok(before.every(label => label.visible && label.width > 0 && label.height > 0 && label.transform.startsWith('translate(')), 'panorama must project eight visible labels');
      assert.ok(before.every(label => [label.x, label.y].every(Number.isFinite) && !/NaN|Infinity/.test(label.transform)));
      const time = (await diagnostic()).time;
      await page.evaluate(() => window.__workshop.camera([18, 66, 98], [0, 2, 0])); await paint();
      const after = await projectedLabels();
      assert.deepEqual((await diagnostic()).viewport, [width, height], 'projected labels must not shrink the viewport with page scrollbars');
      const moved = after.filter(label => label.visible && distance([label.x, label.y], [before[label.index].x, before[label.index].y]) > 2);
      assert.ok(moved.length >= 6, 'world labels must move with the camera instead of using fixed screen positions');
      assert.equal((await diagnostic()).time, time);
      const screenshot = 'welding-world-labels.png';
      await page.screenshot({path: path.join(output, screenshot), animations: 'disabled', caret: 'hide'});
      return {before, after, moved: moved.length, screenshot};
    });
  }
  await check('welding: interface controls', async () => {
    await assertShop('welding'); await pause();
    await control('quality-trigger', locator => locator.click());
    await control('quality-fine', async locator => {
      await locator.click(); await paint(); assert.equal((await diagnostic()).quality, 'fine');
    });
    await control('quality-trigger', locator => locator.click());
    await control('quality-balanced', async locator => {
      await locator.click(); await paint(); assert.equal((await diagnostic()).quality, 'balanced');
    });
    await control('play-toggle', async locator => {
      const before = (await diagnostic()).time; await locator.click(); await page.waitForTimeout(160);
      assert.ok((await diagnostic()).time > before, 'play button should advance production');
      await locator.click(); await paint();
    });
    await control('time-seek', async locator => {
      await locator.evaluate(input => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        descriptor.set.call(input, '34.2');
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
      });
      await paint(); assert.ok(Math.abs((await diagnostic()).time - 34.2) < .01, 'seek input should update production');
    });
    for (const multiplier of [.25, .5, 1, 2, 4, 8, 16]) {
      await control('speed-trigger', locator => locator.click());
      await control(`speed-${multiplier}`, async locator => {
        await locator.click(); await paint(); assert.equal((await diagnostic()).speed, multiplier, 'speed dropdown must update the production clock');
      });
    }
    await page.evaluate(() => {window.__workshop.speed(1); window.__workshop.pause()});
    await control('station-trigger', locator => locator.click());
    await control('station-option-0', locator => locator.click());
    await settleCamera();
    return {exercised: report.controls.length};
  });
  await check('welding: actual robot pick, explosion and restoration', async () => {
    await assertShop('welding'); await pause();
    // Hide the dashboard with its real control so equipment is reachable through the canvas.
    if (await page.getByTestId('production-dashboard').count()) await control('dashboard-toggle', async locator => {await locator.click(); await paint()});
    await page.evaluate(() => {window.__workshop.seek(34.2); window.__workshop.station(0)}); await settleCamera();
    const screens = (await diagnostic()).pickableScreens;
    assert.ok(Array.isArray(screens), 'pickableScreens is required for actual equipment selection');
    const target = await canvasTarget(screens.filter(item => item.station === 0 && /^ROBOT-\d+$/.test(item.id)));
    await page.mouse.click(target.x, target.y);
    await settleCamera();
    assert.equal((await diagnostic()).selected, target.id, 'canvas pick must select the robot hit by the real pointer ray');
    assert.equal(await page.locator('.machine-info').count(), 1);
    assert.ok((await page.locator('.machine-info code').textContent()).includes(target.id));
    report.controls.push({id: 'canvas-equipment-pick', status: 'passed', target});
    const before = await diagnostic(), toolBefore = robotTool(before, target.id);
    let toolExploded;
    await control('explode-toggle', async locator => {
      await locator.click(); await paint();
      const exploded = await diagnostic();
      assert.equal(exploded.exploded, true);
      toolExploded = robotTool(exploded, target.id);
      assert.ok(distance(toolBefore, toolExploded) > .1, 'explosion must move actual robot geometry');
      assert.equal(exploded.time, before.time);
      await locator.click(); await paint();
      const restored = await diagnostic();
      assert.equal(restored.exploded, false);
      assert.ok(distance(toolBefore, robotTool(restored, target.id)) < 1e-7, 'restore must return actual robot TCP to its original pose');
      assert.equal(restored.selected, target.id);
    });
    return {target, toolBefore, toolExploded, restored: true};
  });
  await check('welding: component information and projected leader', async () => {
    const before = await diagnostic(), ownerId = before.selected;
    assert.ok(/^ROBOT-\d+$/.test(ownerId), 'the selected robot must remain active for component picking');
    assert.ok(Array.isArray(before.componentScreens), 'componentScreens must expose real selectable component projections');
    const candidates = before.componentScreens.filter(component => component.ownerId === ownerId);
    assert.ok(candidates.length > 0, 'selected robot must expose named components');
    const target = await canvasTarget(candidates, ownerId);
    await page.mouse.click(target.x, target.y); await paint();
    assert.equal((await diagnostic()).selected, ownerId, 'component inspection must retain the selected machine');
    const card = page.getByTestId('component-info');
    assert.equal(await card.count(), 1, 'component click must show an actual information card');
    const text = await card.textContent();
    assert.ok(text.includes(target.name), 'component card must identify the component hit by the pointer');
    assert.ok(text.length > target.name.length + 15, 'component card must explain the component function');
    const readLeader = async () => page.getByTestId('component-leader').evaluate(element => {
      const line = element.tagName.toLowerCase() === 'line' ? element : element.querySelector('line');
      if (line) return ['x1', 'y1', 'x2', 'y2'].map(attribute => Number(line.getAttribute(attribute)));
      const polyline = element.tagName.toLowerCase() === 'polyline' ? element : element.querySelector('polyline');
      if (!polyline) throw new Error('projected component leader must contain an SVG line or polyline');
      const points = (polyline.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      if (points.length < 4) throw new Error('component leader has no projected points');
      return [...points.slice(0, 2), ...points.slice(-2)];
    });
    const leaderBefore = await readLeader();
    assert.ok(leaderBefore.every(Number.isFinite));
    assert.ok(distance(leaderBefore.slice(0, 2), leaderBefore.slice(2)) > 10, 'leader must connect distinct world and card points');
    const camera = (await diagnostic()).camera;
    await page.evaluate(camera => window.__workshop.camera([camera.position[0] + 2, camera.position[1] + 1, camera.position[2]], camera.target), camera); await paint();
    const leaderAfter = await readLeader();
    assert.ok(leaderAfter.every(Number.isFinite));
    assert.ok(distance(leaderBefore.slice(0, 2), leaderAfter.slice(0, 2)) > 1, 'leader world endpoint must follow camera movement');
    assert.equal((await diagnostic()).time, before.time);
    const screenshot = 'welding-component-info.png';
    await page.mouse.move(width / 2, 95); await paint();
    await page.screenshot({path: path.join(output, screenshot), animations: 'disabled', caret: 'hide'});
    await control('return-overview', async locator => {
      await locator.click(); await settleCamera();
      const restored = await diagnostic();
      assert.equal(restored.selected, null); assert.equal(restored.exploded, false); assert.equal(restored.station, -1);
      assert.equal(await page.locator('.machine-info').count(), 0);
      assert.equal(await page.getByTestId('component-info').count(), 0);
      assert.equal(await page.getByTestId('component-leader').count(), 0);
    });
    await control('dashboard-toggle', async locator => {await locator.click(); await paint(); assert.equal(await page.getByTestId('production-dashboard').count(), 1)});
    return {target, ownerId, leaderBefore, leaderAfter, screenshot, overviewRestored: true};
  });
  await check('welding: fixed-time image repeat', async () => {
    await pause();
    await page.evaluate(() => {window.__workshop.seek(34.2); window.__workshop.station(2)}); await settleCamera();
    const firstUI = {labels: await projectedLabels(), camera: (await diagnostic()).camera, viewport: (await diagnostic()).viewport};
    assert.deepEqual(firstUI.viewport, [width, height]);
    const first = await page.screenshot({path: path.join(output, 'repeat-a.png'), animations: 'disabled', caret: 'hide'});
    await page.evaluate(() => window.__workshop.seek(50.2)); await paint();
    await page.evaluate(() => window.__workshop.seek(34.2)); await paint();
    const secondUI = {labels: await projectedLabels(), camera: (await diagnostic()).camera, viewport: (await diagnostic()).viewport};
    assert.deepEqual(secondUI, firstUI, 'paused labels must return to the same projected positions');
    const second = await page.screenshot({path: path.join(output, 'repeat-b.png'), animations: 'disabled', caret: 'hide'});
    const firstHash = crypto.createHash('sha256').update(first).digest('hex');
    const secondHash = crypto.createHash('sha256').update(second).digest('hex');
    const difference = screenshotDifference(first, second);
    report.imageRepeat = {firstHash, secondHash, identical: firstHash === secondHash, difference, firstUI, secondUI, interpretation: 'Native Chromium raster output is compared independently from exact production poses; pixel count, channel difference and bounds are retained for review.'};
    if (firstHash !== secondHash) {
      if (options['strict-images']) assert.equal(secondHash, firstHash, 'fixed-time raster output changed');
      report.warnings.push(`Repeat PNG hashes differ in ${difference.changedPixels}/${difference.totalPixels} pixels; inspect repeat-a/b.png and report.imageRepeat. Pose determinism is checked independently.`);
    }
    return report.imageRepeat;
  });
  await check('welding: foreground device frame samples', async () => {
    await page.bringToFront();
    await page.evaluate(() => {window.__workshop.speed(1); window.__workshop.play()});
    const samples = await page.evaluate(count => new Promise(resolve => {
      const values = []; let previous;
      // Temporary test observer; this is not a second production/render loop.
      function sample(now) {
        const d = window.__workshop.debug();
        values.push({observerIntervalMs: previous === undefined ? null : now - previous, renderCpuMs: d.frameMs, drawCalls: d.drawCalls, triangles: d.triangles, geometries: d.geometries, textures: d.textures, lod: d.lod ?? d.lodCounts ?? null, quality: d.quality, viewport: d.viewport, renderSize: d.renderSize ?? null, visibility: document.visibilityState, renderedFrames: d.frames});
        previous = now;
        if (values.length >= count) resolve(values); else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }), sampleCount);
    assert.ok(samples.every(sample => sample.visibility === 'visible'), 'all performance samples must be foreground');
    await pause();
    report.performance = {
      samples,
      observerIntervalMs: stats(samples.map(sample => sample.observerIntervalMs)),
      renderCpuMs: stats(samples.map(sample => sample.renderCpuMs)),
      drawCalls: stats(samples.map(sample => sample.drawCalls)),
      triangles: stats(samples.map(sample => sample.triangles)),
      geometries: stats(samples.map(sample => sample.geometries)), textures: stats(samples.map(sample => sample.textures)),
      interpretation: 'native RAF observer intervals include browser scheduling; engine frameMs measures render submission CPU time, not GPU duration or VRAM; test observer adds small overhead',
    };
    return {observerIntervalMs: report.performance.observerIntervalMs, renderCpuMs: report.performance.renderCpuMs};
  });
  await check('SPA navigation and switching cleanup', async () => {
    const weldingCounts = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      await control('shop-home', locator => locator.click());
      const park = await assertShop('park'); report.switching.push({cycle, shop: 'park', diagnostic: park});
      await control('shop-stamping', locator => locator.click());
      const stamping = await assertShop('stamping'); report.switching.push({cycle, shop: 'stamping', diagnostic: stamping});
      await control('shop-home', locator => locator.click()); await assertShop('park');
      await control('shop-welding', locator => locator.click());
      const welding = await assertShop('welding'); report.switching.push({cycle, shop: 'welding', diagnostic: welding});
      weldingCounts.push({geometries: welding.geometries, textures: welding.textures});
    }
    assert.ok(weldingCounts.every(count => Number.isFinite(count.geometries) && Number.isFinite(count.textures)), 'resource counts must be measured');
    assert.ok(weldingCounts.every(count => count.geometries <= weldingCounts[0].geometries + 2 && count.textures <= weldingCounts[0].textures + 2), 'renderer resource counts increased across equivalent scene switches');
    return {weldingCounts, note: 'one live canvas and stable renderer counts are evidence; external caches and listener cleanup also require engine/source audit'};
  });
  await check('no browser or shader errors', async () => {assert.equal(report.errors.length, 0, JSON.stringify(report.errors)); return {errors: 0}});
} catch (error) {
  report.checks.push({name: 'verification setup', status: 'failed', error: error.message});
} finally {
  clearInterval(foregroundTimer);
  report.finishedAt = new Date().toISOString();
  const failures = report.checks.filter(check => check.status === 'failed');
  const skipped = report.controls.filter(control => control.status === 'skipped');
  report.status = failures.length ? 'failed' : skipped.length ? 'partial' : 'passed';
  if (failures.length) process.exitCode = 1;
  if (browser) await browser.close();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({status: report.status, output, passed: report.checks.filter(check => check.status === 'passed').length, failures: report.checks.filter(check => check.status === 'failed'), warnings: report.warnings}, null, 2));
