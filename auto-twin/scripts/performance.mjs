import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
import path from 'node:path';

const args = process.argv.slice(2);
let outputArg, scenariosArg;
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--output') {
    assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), 'Missing value after --output');
    outputArg = args[++index];
  } else if (arg === '--scenarios') {
    assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), 'Missing value after --scenarios');
    scenariosArg = args[++index];
  }
  else if (!arg.startsWith('--') && outputArg === undefined) outputArg = arg;
  else assert.fail(`Unknown or repeated argument: ${arg}`);
}
const output = outputArg || 'docs/verification/stage-08-' + new Date().toISOString().replace(/[:.]/g, '-');
assert.ok(output && output !== '--output', 'An output directory is required after --output');
await fs.mkdir(path.dirname(path.resolve(output)), {recursive: true});
await fs.mkdir(output);
const report = {
  startedAt: new Date().toISOString(), status: 'running',
  host: {platform: os.platform(), cpu: os.cpus()[0]?.model}, viewport: [1600, 1000], devicePixelRatio: 1,
  interpretation: 'passed means valid foreground measurement evidence and resource checks; no target FPS was specified or assessed',
  measurements: {cpuMs: 'CPU render submission duration, not GPU time', gpuTime: 'not measured', exactVideoMemory: 'not measured', geometriesAndTextures: 'renderer.info object counts, not bytes'},
  samplingPolicy: {nativeRAF: true, realChrome: true, chunkMs: 10000, chunkWatchdogMs: 15000, maximumScenarioWallMs: 100000, browserSamplingBudgetMs: 99000, schedulingGapLimitMs: 500, anyGapAboveLimit: 'partial', fullCycle: 'production starts at zero and must reach at least 76 seconds'},
  performance: [], switching: [], checks: [], errors: [], warnings: [], interactions: [],
};
const saveReport = () => fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const captureDiagnostics = async () => {
  if (!page) return;
  try {report.interactions = await page.evaluate(() => window.__workshopDiagnostics?.read?.() || [])}
  catch (error) {report.warnings.push('Could not read interaction diagnostics: ' + error.message)}
};
await saveReport();
let browser, page, keepForeground;
try {
browser = await chromium.launch({headless: false, channel: 'chrome'});
page = await browser.newPage({viewport: {width: 1600, height: 1000}, deviceScaleFactor: 1});
// One guarded foreground keeper for the entire run. No GPU or scheduling flags.
let refreshing = false;
keepForeground = setInterval(async () => {
  if (refreshing) return;
  refreshing = true;
  try {await page.bringToFront()} catch (error) {report.warnings.push('Foreground refresh failed: ' + error.message)}
  finally {refreshing = false}
}, 250);
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', m => {if (m.type() === 'error') report.errors.push(m.text())});
await page.addInitScript(() => {
  // Count actual GL handles. Instance buffers are invisible to renderer.info.memory.
  const counters = {}, live = {};
  for (const kind of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'Program']) {
    counters[kind] = {created: 0, deleted: 0, live: 0}; live[kind] = new WeakSet();
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const action of ['create', 'delete']) {
        const key = action + kind, original = prototype[key];
        prototype[key] = function (...args) {
          const result = original.apply(this, args), object = action === 'create' ? result : args[0];
          if (object && action === 'create' && !live[kind].has(object)) {live[kind].add(object); counters[kind].created++; counters[kind].live++}
          if (object && action === 'delete' && live[kind].delete(object)) {counters[kind].deleted++; counters[kind].live--}
          return result;
        };
      }
    }
  }
  window.__glResources = () => JSON.parse(JSON.stringify(counters));
  const safe = value => {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(safe);
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [key, safe(item)]));
    return String(value);
  };
  const diagnostics = window.__workshopDiagnostics = {interactions: []};
  const record = item => {
    diagnostics.interactions.push({...item, wallTime: new Date().toISOString(), time: performance.now()});
    if (diagnostics.interactions.length > 500) diagnostics.interactions.shift();
  };
  const eventTarget = target => {
    const element = target instanceof Element ? target : null;
    const marked = element?.closest?.('[data-testid]');
    return {tag: element?.tagName?.toLowerCase() || null, id: element?.id || null, testid: marked?.getAttribute('data-testid') || null, role: element?.getAttribute?.('role') || null};
  };
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, event => record({kind: 'browser-event', event: type, trusted: event.isTrusted, target: eventTarget(event.target), key: event.key || null, code: event.code || null}), true);
  const methodNames = ['shop', 'quality', 'camera', 'seek', 'station', 'play', 'pause', 'speed'];
  const install = () => {
    const api = window.__workshop;
    if (!api) return;
    for (const method of methodNames) {
      const original = api[method];
      if (typeof original !== 'function' || original.__workshopDiagnostics) continue;
      const wrapped = function (...args) {
        let productionTime = null;
        try {productionTime = api.metrics?.().time ?? null} catch {}
        record({kind: 'debug-method', method, args: safe(args), productionTime});
        return original.apply(this, args);
      };
      wrapped.__workshopDiagnostics = true;
      api[method] = wrapped;
    }
  };
  setInterval(install, 25);
  diagnostics.read = () => diagnostics.interactions.slice();
});
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const settle = async () => {
  await page.waitForFunction(() => window.__workshop && !window.__workshop.debug().cameraMoving && !document.querySelector('[data-testid="workshop-loading"]'));
  await paint();
};
const stats = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return {count: 0, min: null, mean: null, p50: null, p95: null, max: null};
  return {count: sorted.length, min: sorted[0], mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, p50: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.floor((sorted.length - 1) * .95)], max: sorted.at(-1)};
};
async function navigate(shop) {
  const current = await page.evaluate(() => window.__workshop.metrics().shop);
  if (current !== shop) {await page.getByTestId(shop === 'park' ? 'shop-home' : 'shop-' + shop).click(); await page.waitForFunction(shop => window.__workshop.metrics().shop === shop, shop); await settle()}
  await page.evaluate(() => {window.__workshop.pause(); window.__workshop.quality('balanced'); window.__workshop.seek(34.2); window.__workshop.station(-1)});
  await settle();
}
  report.browser = await browser.version();
  await page.goto('http://127.0.0.1:4200/'); await settle(); await page.bringToFront();
  report.gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : null, version: gl.getParameter(gl.VERSION)};
  });
  if (!report.gpu.renderer || /swiftshader|llvmpipe|software/i.test(report.gpu.renderer)) report.warnings.push('Physical GPU performance is not established by this renderer.');
  const scenarios = [
    {id: 'park-balanced', shop: 'park', quality: 'balanced', duration: 8000},
    {id: 'park-fine', shop: 'park', quality: 'fine', duration: 8000},
    {id: 'stamping-balanced', shop: 'stamping', quality: 'balanced', duration: 12000},
    {id: 'stamping-fine', shop: 'stamping', quality: 'fine', duration: 12000},
    {id: 'welding-balanced', shop: 'welding', quality: 'balanced', duration: 76000},
    {id: 'welding-fine', shop: 'welding', quality: 'fine', duration: 12000},
    {id: 'welding-fine-station-2', shop: 'welding', quality: 'fine', duration: 10000, station: 2},
  ];
  const selectedIds = scenariosArg ? scenariosArg.split(',').map(value => value.trim()).filter(Boolean) : scenarios.map(scenario => scenario.id);
  const knownIds = new Set(scenarios.map(scenario => scenario.id));
  assert.ok(selectedIds.length && selectedIds.every(id => knownIds.has(id)), `Unknown scenario id in --scenarios. Known ids: ${[...knownIds].join(', ')}`);
  report.scenarios = selectedIds;
  for (const scenario of scenarios.filter(candidate => selectedIds.includes(candidate.id))) {
    const {id, shop, quality, duration, station} = scenario;
    await navigate(shop);
    await page.evaluate(({quality, station}) => {window.__workshop.quality(quality); if (station !== undefined) window.__workshop.station(station)}, {quality, station});
    await settle(); await page.bringToFront();
    if (station !== undefined) {await page.evaluate(() => window.__workshop.camera([-14, 4.8, 6.5], [-18, 2, 0])); await paint()}
    // Warm up separately, then seek to zero before establishing the single global
    // measurement baseline. Startup time cannot consume the production cycle.
    await page.evaluate(() => {window.__workshop.speed(1); window.__workshop.play()});
    await page.waitForTimeout(800);
    await page.evaluate(() => {window.__workshop.pause(); window.__workshop.seek(0)});
    await settle();
    const fullCycle = shop === 'welding' && duration === 76000;
    // A Node deadline also bounds the operation if the browser main thread no
    // longer services either RAF or setTimeout. The browser budget leaves time
    // to return its last partial chunk before this independent deadline.
    const nodeDeadline = Date.now() + 100000;
    const initial = await page.evaluate(({duration, fullCycle}) => {
      const debug = window.__workshop.debug();
      const first = window.__workshop.metrics();
      const started = performance.now();
      window.__performanceProbe = {started, previous: started, first, duration, fullCycle, maximumWallMs: 99000};
      window.__workshop.play();
      return {first, camera: debug.camera, expectedRenderSize: debug.renderSize, viewport: debug.viewport, devicePixelRatio: window.devicePixelRatio, started, visible: document.visibilityState === 'visible', focused: document.hasFocus()};
    }, {duration, fullCycle});
    const result = {first: initial.first, last: initial.first, elapsedMs: 0, samples: [], camera: [{elapsedMs: 0, camera: initial.camera}], boundaries: [initial]};
    const summary = {id, shop, quality, station: station ?? -1, status: 'running', targetWallMs: duration, requiredProductionSeconds: fullCycle ? 76 : null, expectedRenderSize: initial.expectedRenderSize, viewport: initial.viewport, devicePixelRatio: initial.devicePixelRatio, first: initial.first, camera: result.camera};
    report.performance.push(summary);
    await saveReport();
    let done = false;
    while (!done) {
      // Each evaluate returns after <=10 seconds of browser time, including when
      // native RAF stops. The global deadline covers all chunks and report I/O.
      let deadlineTimer;
      let chunk;
      try {
      chunk = await Promise.race([page.evaluate(() => new Promise(resolve => {
        const probe = window.__performanceProbe, samples = [];
        let raf, timer, finished = false;
        const finishedSampling = now => {
          const d = window.__workshop.metrics();
          return probe.fullCycle ? d.time >= 76 || now - probe.started >= probe.maximumWallMs : now - probe.started >= probe.duration;
        };
        const finish = () => {
          if (finished) return;
          finished = true; cancelAnimationFrame(raf); clearTimeout(timer);
          const now = performance.now(), last = window.__workshop.metrics();
          const terminalGapMs = now - probe.previous;
          const done = finishedSampling(now);
          if (done) window.__workshop.pause();
          // debug() traverses meshes; collect camera only at boundaries rather
          // than adding that instrumentation to every measured frame.
          const debug = window.__workshop.debug();
          resolve({samples, elapsedMs: now - probe.started, last, terminalGapMs, camera: debug.camera, visible: document.visibilityState === 'visible', focused: document.hasFocus(), done});
        };
        const sample = () => {
          const now = performance.now(), d = window.__workshop.metrics();
          samples.push({...d, elapsedMs: now - probe.started, intervalMs: now - probe.previous, visible: document.visibilityState === 'visible', focused: document.hasFocus()});
          probe.previous = now;
          if (finishedSampling(now)) finish(); else raf = requestAnimationFrame(sample);
        };
        const deadlineMs = probe.fullCycle ? probe.maximumWallMs : probe.duration;
        timer = setTimeout(finish, Math.max(0, Math.min(10000, deadlineMs - (performance.now() - probe.started))));
        raf = requestAnimationFrame(sample);
      })), new Promise((_, reject) => {
        deadlineTimer = setTimeout(() => reject(new Error('Independent 15-second chunk / 100-second scenario watchdog expired; browser did not return bounded samples')), Math.max(0, Math.min(15000, nodeDeadline - Date.now())));
      })]);
      } catch (error) {
        summary.status = 'failed'; summary.failure = error.message;
        result.watchdogFailure = error.message;
        report.currentActivity = {phase: 'performance-failed', id, shop, quality, station: station ?? -1, elapsedMs: result.elapsedMs, samples: result.samples.length};
        await captureDiagnostics();
        await saveReport();
        done = true;
        break;
      } finally {clearTimeout(deadlineTimer)}
      result.samples.push(...chunk.samples);
      result.elapsedMs = chunk.elapsedMs; result.last = chunk.last;
      result.camera.push({elapsedMs: chunk.elapsedMs, camera: chunk.camera});
      result.boundaries.push({elapsedMs: chunk.elapsedMs, terminalGapMs: chunk.terminalGapMs, visible: chunk.visible, focused: chunk.focused});
      done = chunk.done;
      Object.assign(summary, {elapsedMs: result.elapsedMs, endTime: result.last.time, frames: result.last.frames - result.first.frames, sampleCount: result.samples.length, last: result.last, boundaries: result.boundaries});
      report.currentActivity = {phase: 'performance', id, shop, quality, station: station ?? -1, fullCycle, elapsedMs: result.elapsedMs, productionSeconds: result.last.time - result.first.time};
      await captureDiagnostics();
      await saveReport();
      console.log(JSON.stringify(report.currentActivity));
    }
    const observed = [result.first, ...result.samples, result.last];
    const states = [...result.samples, ...result.boundaries];
    const failures = [], limitations = [];
    if (result.watchdogFailure) failures.push(result.watchdogFailure);
    const frames = result.last.frames - result.first.frames;
    const productionSeconds = result.last.time - result.first.time;
    if (!(frames > 0) || !result.samples.length) failures.push('Engine frames did not advance or no native RAF samples were collected');
    if (!(productionSeconds > 0)) failures.push('Production time did not advance');
    if (Math.abs(result.first.time) > 1e-8) failures.push('Production measurement did not start at zero');
    if (observed.some(d => d.shop !== shop || d.quality !== quality)) failures.push('Observed shop or quality differs from requested scenario');
    if (observed.some(d => JSON.stringify(d.renderSize) !== JSON.stringify(initial.expectedRenderSize))) failures.push('Actual render size differs from quality-scaled viewport');
    if (observed.some(d => !Number.isFinite(d.frames) || !Number.isFinite(d.time))) failures.push('Non-finite engine counters');
    if (result.samples.some((d, i) => d.frames < (i ? result.samples[i - 1].frames : result.first.frames) || d.time < (i ? result.samples[i - 1].time : result.first.time))) failures.push('Engine frame or production counters regressed');
    const originalValues = observed.map(d => d.lod.robotOriginalResident).filter(Number.isFinite);
    if (originalValues.some(count => count > 3)) failures.push('Original robot residency exceeds budget');
    const gaps = [...result.samples.map(s => s.intervalMs), ...result.boundaries.map(s => s.terminalGapMs)].filter(Number.isFinite);
    if (states.some(s => !s.visible || !s.focused)) limitations.push('At least one sample or boundary was hidden or unfocused');
    if (gaps.some(ms => ms > 500)) limitations.push('At least one native RAF scheduling gap exceeded 500ms');
    if (fullCycle && productionSeconds < 76) limitations.push('Bounded wall-clock sampling budget expired before an actual 76-second production cycle completed');
    if (result.elapsedMs > 100000) limitations.push('Scenario exceeded wall-clock budget (browser scheduling delay)');
    const lodStates = new Map();
    for (const d of observed) {
      const key = JSON.stringify(d.lod);
      const entry = lodStates.get(key) || {lod: d.lod, observations: 0, firstTime: d.time, lastTime: d.time};
      entry.observations++; entry.lastTime = d.time; lodStates.set(key, entry);
    }
    Object.assign(summary, {
      status: failures.length ? 'failed' : limitations.length ? 'partial' : 'passed', failures, limitations,
      frames, renderedFps: frames * 1000 / result.elapsedMs,
      startTime: result.first.time, endTime: result.last.time, productionSeconds, productionToWallRatio: productionSeconds * 1000 / result.elapsedMs,
      fullCycleCovered: fullCycle ? Math.abs(result.first.time) <= 1e-8 && productionSeconds >= 76 : null,
      intervalMs: stats(result.samples.map(s => s.intervalMs)), schedulingGapsAbove500Ms: gaps.filter(ms => ms > 500),
      cpuMs: stats(result.samples.map(s => s.frameMs)), drawCalls: stats(result.samples.map(s => s.drawCalls)),
      triangles: stats(result.samples.map(s => s.triangles)), geometries: stats(result.samples.map(s => s.geometries)), textures: stats(result.samples.map(s => s.textures)),
      lodStates: [...lodStates.values()], maxOriginalRobots: originalValues.length ? Math.max(...originalValues) : null,
      renderSize: result.last.renderSize, samples: result.samples,
    });
    for (const note of limitations) report.warnings.push(`${shop}/${quality}/${station ?? -1}: ${note}`);
    await captureDiagnostics();
    await saveReport();
  }
  // Load both laser lines and all active particle buffers before every departure.
  for (let cycle = 0; cycle < 7; cycle++) {
    for (const shop of ['park', 'stamping', 'welding']) {
      await navigate(shop);
      for (const time of (shop === 'stamping' ? [34.2, 480, 501, 522, 34.2] : [26.2, 34.2, 50.2, 76.2, 34.2])) {await page.evaluate(t => window.__workshop.seek(t), time); await paint()}
      const data = await page.evaluate(() => ({metrics: window.__workshop.metrics(), gl: window.__glResources(), canvases: document.querySelectorAll('canvas').length}));
      assert.equal(data.canvases, 1);
      report.switching.push({cycle, shop, ...data});
      report.currentActivity = {phase: 'switching', cycle, shop};
      await saveReport();
    }
  }
  for (const shop of ['park', 'stamping', 'welding']) {
    const stable = report.switching.filter(s => s.shop === shop && s.cycle >= 2);
    for (const row of stable) for (const kind of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'Program']) assert.equal(row.gl[kind].live, stable[0].gl[kind].live, shop + ': live ' + kind + ' handles increased after warmup');
  }
  report.checks.push({name: 'seven warmed scene cycles preserve live GL handle counts', passed: true});
  await settle();
  const paused = await page.evaluate(() => window.__workshop.metrics()); await page.waitForTimeout(600);
  const idle = await page.evaluate(() => window.__workshop.metrics());
  assert.equal(idle.frames, paused.frames); assert.equal(idle.time, paused.time);
  report.checks.push({name: 'paused scene does not draw', passed: true});
  await page.screenshot({path: output + '/welding-final.png'});
  assert.equal(report.errors.length, 0);
  await captureDiagnostics();
  report.status = report.performance.some(s => s.status === 'failed') ? 'failed' : report.warnings.length || report.performance.some(s => s.status === 'partial') ? 'partial' : 'passed';
  if (report.status !== 'passed') process.exitCode = 1;
} catch (error) {report.status = 'failed'; report.failure = error.message; process.exitCode = 1}
finally {
  await captureDiagnostics();
  clearInterval(keepForeground); report.finishedAt = new Date().toISOString();
  if (browser) {try {await browser.close()} catch (error) {report.errors.push('Browser close: ' + error.message); report.status = 'failed'; process.exitCode = 1}}
  await saveReport();
}
console.log(JSON.stringify({status: report.status, output, checks: report.checks, failure: report.failure, warnings: report.warnings}));
