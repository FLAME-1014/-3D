import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {MAX_PRODUCTION_SECONDS, PLAYBACK_SPEEDS} from '../src/core/clock.ts';
import {inspectPng, verifyVideo} from './media-verification.mjs';

function argumentsFrom(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`Unexpected argument: ${argv[i]}`);
    const key = argv[i].slice(2);
    result[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return result;
}
const options = argumentsFrom(process.argv.slice(2));
if (options.help) {
  console.log('npm run capture -- --shop welding --start 34 --duration 2 --fps 60 [--station 2] [--close] [--quality fine] [--video] [--ffmpeg path] [--output docs/captures/name] [--chrome path] [--url http://127.0.0.1:4200]');
  process.exit(0);
}
const shop = String(options.shop || 'welding');
if (!['park', 'stamping', 'welding'].includes(shop)) throw new Error('--shop must be park, stamping, or welding');
const start = Number(options.start ?? 34);
const duration = Number(options.duration ?? options.seconds ?? 2);
const fps = Number(options.fps ?? 60);
const width = Number(options.width ?? 1600);
const height = Number(options.height ?? 1000);
const speed = Number(options.speed ?? 1);
if (!PLAYBACK_SPEEDS.includes(speed)) throw new Error('--speed must be one of 0.25, 0.5, 1, 2, 4, 8, 16');
const quality = String(options.quality || 'balanced');
if (!['smooth', 'balanced', 'fine'].includes(quality)) throw new Error('--quality must be smooth, balanced, or fine');
const station = options.station === undefined ? null : Number(options.station);
if (station !== null && (!Number.isInteger(station) || station < 0 || station >= (shop === 'welding' ? 8 : shop === 'stamping' ? 9 : 0))) throw new Error('--station must identify an existing workshop station');
if (options.close && station === null) throw new Error('--close requires --station');
if (![start, duration, fps, width, height, speed].every(Number.isFinite) || start < 0 || duration <= 0 || duration > 120 || fps < 1 || fps > 120 || !Number.isInteger(fps) || !Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 240 || speed <= 0) {
  throw new Error('Invalid capture settings: finite start >= 0, duration in (0,120], integer fps in [1,120], width >= 320, height >= 240, and speed > 0 required');
}
const frameCount = Math.ceil(duration * fps);
const lastProductionTime = start + (frameCount - 1) / fps * speed;
if (start > MAX_PRODUCTION_SECONDS || !Number.isFinite(lastProductionTime) || lastProductionTime > MAX_PRODUCTION_SECONDS) throw new Error('Capture production time exceeds the supported 1,000,000,000-second range');
if (options.video && (width % 2 || height % 2)) throw new Error('H.264 / yuv420p video requires even width and height');
const baseUrl = new URL(String(options.url || 'http://127.0.0.1:4200'));
baseUrl.search = shop === 'park' ? '' : `?shop=${shop}`;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(String(options.output || `docs/captures/${shop}-${stamp}`));
await fs.mkdir(path.dirname(output), {recursive: true});
try { await fs.mkdir(output); } catch (error) {
  if (error.code === 'EEXIST') throw new Error(`Output already exists; choose a new --output directory: ${output}`);
  throw error;
}
let chromium;
try { ({chromium} = await import('playwright')); } catch {
  throw new Error('Playwright is required. Run npm install after adding/installing the project Playwright dev dependency.');
}
const errors = [];
let browser;
const manifest = {
  status: 'running', startedAt: new Date().toISOString(), command: [process.execPath, ...process.argv.slice(1)],
  mode: 'virtual-clock', shop, url: baseUrl.href, start, duration, fps, speed, quality, station, close: Boolean(options.close),
  viewport: [width, height], devicePixelRatio: 1, plannedFrames: frameCount,
  writtenFrames: 0, virtualEpochMs: 1700000000000, output,
  productionPolicy: 'paused; seek(start + frameIndex / fps * speed); confirm React DOM time; advance one virtual RAF; confirm one rendered frame before screenshot',
  video: {requested: Boolean(options.video), status: 'not-requested'}, frameChecks: [], errors,
};
try {
  browser = await chromium.launch(options.chrome
    ? {headless: false, executablePath: String(options.chrome)}
    : {headless: false, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
  page.on('pageerror', error => errors.push({type: 'pageerror', message: error.message}));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGLProgram|WebGL.*(?:error|invalid)|NaN/i.test(message.text())) errors.push({type: 'shader', message: message.text()});
  });
  await page.addInitScript(() => {
    let now = 0;
    let nextId = 1;
    let callbacks = new Map();
    let activeBatch = null;
    let maxQueued = 0;
    let steppedFrames = 0;
    Object.defineProperty(performance, 'now', {configurable: true, value: () => now});
    Date.now = () => 1700000000000 + now;
    window.requestAnimationFrame = callback => {
      const id = nextId++;
      callbacks.set(id, callback);
      maxQueued = Math.max(maxQueued, callbacks.size);
      return id;
    };
    window.cancelAnimationFrame = id => { callbacks.delete(id); activeBatch?.delete(id); };
    window.__captureClock = {
      advance(milliseconds) {
        if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Invalid virtual step');
        now += milliseconds;
        const pending = callbacks;
        callbacks = new Map();
        activeBatch = pending;
        try {
          for (const [id, callback] of pending) {
            pending.delete(id);
            callback(now);
          }
        } finally { activeBatch = null; }
        steppedFrames++;
        return {now, queued: callbacks.size, maxQueued, steppedFrames};
      },
      debug: () => ({now, queued: callbacks.size, maxQueued, steppedFrames}),
    };
  });
  await page.goto(baseUrl.href, {waitUntil: 'networkidle'});
  // Playwright's default RAF polling cannot run until the virtual queue advances.
  await page.waitForFunction(() => typeof window.__workshop?.debug === 'function', undefined, {polling: 25, timeout: 30000});
  await page.evaluate(async ({start, quality, station, close, speed}) => {
    if (typeof window.__workshop.pause !== 'function') throw new Error('window.__workshop.pause() is required for deterministic capture');
    await document.fonts.ready;
    window.__workshop.pause();
    window.__workshop.seek(start);
    window.__workshop.speed(speed);
    window.__workshop.quality(quality);
    if (station !== null) {
      window.__workshop.station(station);
      const x = window.__workshop.debug().stations[station].x;
      window.__workshop.camera(close ? [x + 4, 4.8, 6.5] : [x + 8, 11, 19], [x, close ? 2 : 2.5, 0]);
    }
  }, {start, quality, station, close: Boolean(options.close), speed});
  const domReady = async time => page.waitForFunction(({time, shop}) => {
    const main = document.querySelector('main');
    const labelsReady = shop !== 'welding' || document.querySelectorAll('[data-world-label]').length === 8;
    return main?.dataset.shop === shop && Number(main.dataset.productionTime) === time && labelsReady;
  }, {time, shop}, {polling: 10, timeout: 10000});
  await domReady(start);
  await page.evaluate(() => window.__captureClock.advance(0));
  await page.waitForFunction(() => !document.querySelector('[data-testid="workshop-loading"]'), undefined, {polling: 10, timeout: 10000});
  await domReady(start);
  const firstReady = await page.evaluate(() => ({metrics: window.__workshop.metrics(), camera: window.__workshop.debug().camera, loading: !!document.querySelector('[data-testid="workshop-loading"]'), labels: document.querySelectorAll('[data-world-label]').length}));
  if (firstReady.metrics.frames < 1 || firstReady.metrics.shop !== shop || firstReady.metrics.quality !== quality || firstReady.loading) throw new Error('Initial scene and DOM are not ready for capture');
  manifest.ready = firstReady;
  manifest.browser = await browser.version();
  manifest.initialDiagnostic = await page.evaluate(() => window.__workshop.debug());
  for (let index = 0; index < frameCount; index++) {
    const productionTime = start + index / fps * speed;
    await page.evaluate(time => window.__workshop.seek(time), productionTime);
    await domReady(productionTime);
    const state = await page.evaluate(({productionTime, frameMs, shop, quality}) => {
      const before = window.__workshop.metrics().frames;
      window.__captureClock.advance(frameMs);
      const metrics = window.__workshop.metrics();
      if (metrics.time !== productionTime || metrics.frames !== before + 1 || metrics.shop !== shop || metrics.quality !== quality || document.querySelector('[data-testid="workshop-loading"]')) throw new Error('Capture frame did not render exactly once at the requested time and configuration');
      return metrics;
    }, {productionTime, frameMs: 1000 / fps, shop, quality});
    const framePath = path.join(output, `frame-${String(index).padStart(6, '0')}.png`);
    const png = await page.screenshot({path: framePath, animations: 'disabled', caret: 'hide'});
    if ([0, Math.floor(frameCount / 2), frameCount - 1].includes(index)) {
      manifest.frameChecks.push({index, productionTime, metrics: state, png: inspectPng(png, width, height)});
    }
    manifest.writtenFrames++;
    if (index === 0 || index === frameCount - 1) {
      manifest[index === 0 ? 'firstFrame' : 'lastFrame'] = {
        name: path.basename(framePath), productionTime,
        sha256: crypto.createHash('sha256').update(png).digest('hex'),
      };
    }
    if (errors.length) throw new Error(`Browser reported ${errors.length} error(s)`);
    if ((index + 1) % fps === 0) console.log(`Captured ${index + 1}/${frameCount} frames; production ${productionTime.toFixed(3)} s`);
  }
  manifest.finalDiagnostic = await page.evaluate(() => window.__workshop.debug());
  manifest.virtualClock = await page.evaluate(() => window.__captureClock.debug());
  if (options.video) {
    const binary = String(options.ffmpeg || 'ffmpeg');
    const probe = spawnSync(binary, ['-version'], {encoding: 'utf8', windowsHide: true});
    if (probe.error || probe.status !== 0) {
      manifest.video = {requested: true, status: 'skipped', reason: 'FFmpeg unavailable; deterministic PNG frames retained'};
      throw new Error('Video was requested but FFmpeg is unavailable; PNG frames have been retained');
    } else {
      const videoPath = path.join(output, 'capture.mp4');
      const ffmpegArgs = ['-n', '-framerate', String(fps), '-start_number', '0', '-i', path.join(output, 'frame-%06d.png'), '-frames:v', String(frameCount), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), videoPath];
      const encoded = spawnSync(binary, ffmpegArgs, {encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
      manifest.video = {requested: true, status: encoded.status === 0 ? 'encoded' : 'failed', path: videoPath, binary, arguments: ffmpegArgs, version: probe.stdout.split(/\r?\n/)[0]};
      if (encoded.error || encoded.status !== 0) {
        manifest.video.error = encoded.error?.message || encoded.stderr;
        throw new Error('FFmpeg encoding failed; see manifest.json');
      }
      manifest.video.verification = await verifyVideo(binary, videoPath, {frameCount, fps, width, height});
      manifest.video.status = 'complete';
    }
  }
  manifest.status = 'complete';
} catch (error) {
  manifest.status = 'failed';
  manifest.failure = error.message;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  manifest.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
console.log(JSON.stringify({status: manifest.status, output, frames: manifest.writtenFrames, video: manifest.video, failure: manifest.failure || null}, null, 2));
