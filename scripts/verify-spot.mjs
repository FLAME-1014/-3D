import { createPreview } from './preview.mjs';
import { chromium } from 'playwright';

const server = createPreview();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});

async function checkSpot(query, readyKey, readyTimeout) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto(`http://127.0.0.1:${port}/spot.html?id=chenjiaci${query.replace(/^\?/,'&')}`, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  const step = await page.evaluate(async () => {
    const log = [];
    try {
      const res = await fetch('../content/spots/chenjiaci/spot.json', { cache: 'no-store' });
      const spot = await res.json();
      log.push('1 fetched ' + spot.id);
      const errors = window.SpotContract.validate(spot, 'chenjiaci');
      log.push('2 validate errors=' + errors.length);
      window.SPOT_DATA = spot;
      log.push('3 SPOT_DATA set');
      const mod = await import('../content/spots/chenjiaci/model.js');
      log.push('4 imported');
      if (typeof mod.create !== 'function') throw new Error('no create');
      log.push('5 create fn ok');
      const model = mod.create();
      log.push('6 create() ok, group=' + !!model.group);
      const merrs = window.SpotContract.validateModel(model, spot);
      log.push('7 validateModel errors=' + merrs.length);
      const canvas = document.getElementById('scene');
      log.push('8 canvas=' + !!canvas);
      const stage = window.StageCore.createStage(canvas, { alpha: true, maxPixelRatio: 1.75 });
      log.push('9 createStage ok');
      stage.resize();
      log.push('10 resize ok');
      const r = await stage.load('chenjiaci');
      log.push('11 load ok ' + JSON.stringify(r));
      return { ok: true, log };
    } catch (e) {
      return { ok: false, err: String(e.stack || e), log };
    }
  });
  console.log(`${query || '(default)'} STEP:`, JSON.stringify(step));

  try {
    await page.waitForFunction((k) => window[k] === true, readyKey, { timeout: readyTimeout });
  } catch (e) {
    console.log(`${query || '(default)'}: READY TIMEOUT`);
  }
  const info = await page.evaluate((k) => ({
    ready: window[k] === true,
    failure: document.getElementById('failure')?.hidden ? null : document.getElementById('failure')?.textContent,
    stats: window.__SPOT_API__ ? window.__SPOT_API__.stats() : null
  }), readyKey);
  console.log(`${query || '(default)'}: ready=${info.ready} errors=${errors.length} failure=${info.failure} stats=${JSON.stringify(info.stats)}`);
  errors.forEach(e => console.log('  ERR:', e.slice(0, 160)));
  await page.close();
}

await checkSpot('', '__SPOT_READY__', 30000);
await checkSpot('?silhouette=1', '__SILHOUETTE_READY__', 30000);

await browser.close();
await new Promise(r => server.close(r));
console.log('spot verify done');
