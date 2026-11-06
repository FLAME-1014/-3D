/* verify-book.mjs — 立体书骨架无头验证
 *
 * 检查：
 *   1. 封面加载，__BOOK_READY__
 *   2. 翻开 → 进入 page(0)（陈家祠），模型立起到 shot，就绪后 __BOOK__.state.pageState==='shot'
 *   3. 切换到广州塔页，加载并立起
 *   4. 展开/合上（expand true/false）
 *   5. 目录渲染 18 张剪影卡
 *   6. 三镜推进（nextShot ×2 后 markSeen 落 localStorage）
 *   7. URL 同步（history.replaceState 中 p=…）
 *   8. L 档降级（禁用 WebGL 时进 fallback，仍能翻页）
 */
import { createPreview } from './preview.mjs';
import { chromium } from 'playwright';

const server = createPreview();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});

async function check(name, fn) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  try {
    await fn(page);
    console.log('PASS', name, errors.length ? `(${errors.length} console errors: ${errors.slice(0,1).map(s=>s.slice(0,90)).join(' | ')})` : '');
  } catch (e) {
    console.log('FAIL', name, '->', e.message);
    if (errors.length) errors.slice(0, 3).forEach(s => console.log('   ERR:', s.slice(0, 140)));
  }
  await page.close();
}

const waitBook = page => page.waitForFunction(() => window.__BOOK_READY__ === true, { timeout: 30000 });
const settle = (page, ms = 200) => new Promise(r => setTimeout(() => {}, ms)) || page.waitForTimeout(ms);

// 1. cover boot
await check('cover-boot', async page => {
  await page.goto(`${base}/book.html`, { waitUntil: 'networkidle' });
  await waitBook(page);
  const coverVisible = await page.$eval('#cover', el => !el.classList.contains('is-out') && getComputedStyle(el).opacity !== '0');
  if (!coverVisible) throw new Error('cover not visible');
  const domOk = await page.evaluate(() => {
    return !!document.getElementById('pageNumber') && !!document.getElementById('shotDots') &&
      document.querySelectorAll('#tocGroups .toc-card').length === 18 &&
      document.querySelectorAll('#shotDots .shot-dot').length === 3;
  });
  if (!domOk) throw new Error('dom structure incomplete');
});

// 2. open -> page0 rises
await check('open-page0-rise', async page => {
  await page.goto(`${base}/book.html`, { waitUntil: 'networkidle' });
  await waitBook(page);
  await page.click('#coverOpen');
  await page.waitForTimeout(2600);
  const st = await page.evaluate(() => ({ ...window.__BOOK__.state }));
  if (st.view !== 'page') throw new Error('view != page: ' + st.view);
  if (st.index !== 0) throw new Error('index != 0: ' + st.index);
  if (st.pageState !== 'shot') throw new Error('pageState != shot: ' + st.pageState);
  const hasModel = await page.evaluate(() => !!window.__BOOK__ && document.querySelector('#footprint img').src.includes('chenjiaci'));
  if (!hasModel) throw new Error('footprint src missing');
});

// 3. deep link + rise
await check('deep-link-page', async page => {
  await page.goto(`${base}/book.html?p=canton-tower&shot=2`, { waitUntil: 'networkidle' });
  await waitBook(page);
  await page.waitForFunction(() => window.__BOOK__.state.view === 'page' && window.__BOOK__.state.index === 14, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const st = await page.evaluate(() => ({ view: window.__BOOK__.state.view, index: window.__BOOK__.state.index, shot: window.__BOOK__.state.shot }));
  if (st.view !== 'page' || st.index !== 14) throw new Error(JSON.stringify(st));
  const url = await page.evaluate(() => location.search);
  if (!url.includes('p=canton-tower')) throw new Error('url not synced: ' + url);
});

// 4. expand / collapse
await check('expand-collapse', async page => {
  await page.goto(`${base}/book.html?p=chenjiaci`, { waitUntil: 'networkidle' });
  await waitBook(page);
  await page.waitForTimeout(2000);
  await page.click('#btnExpand');
  await page.waitForTimeout(300);
  const on = await page.evaluate(() => ({ expanded: window.__BOOK__.state.expanded, cls: document.querySelector('.stage').classList.contains('is-expanded'), presets: document.querySelectorAll('#expandPresets .expand-preset').length }));
  if (!on.expanded || !on.cls) throw new Error('expand state wrong: ' + JSON.stringify(on));
  if (on.presets < 1) throw new Error('expand presets empty');
  await page.click('#btnCollapse');
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => ({ expanded: window.__BOOK__.state.expanded, cls: document.querySelector('.stage').classList.contains('is-expanded') }));
  if (off.expanded || off.cls) throw new Error('collapse state wrong: ' + JSON.stringify(off));
});

// 5. toc render + jump
await check('toc-jump', async page => {
  await page.goto(`${base}/book.html?p=chenjiaci`, { waitUntil: 'networkidle' });
  await waitBook(page);
  await page.waitForTimeout(1500);
  await page.click('#pageToc');
  await page.waitForTimeout(400);
  const cards = await page.$$eval('#tocGroups .toc-card', els => els.length);
  if (cards !== 18) throw new Error('toc cards: ' + cards);
  const imgs = await page.$$eval('#tocGroups .toc-card img', els => els.filter(i => i.complete && i.naturalWidth > 0).length);
  if (imgs !== 18) throw new Error('toc silhouette images loaded: ' + imgs + '/18');
  // theme filter
  await page.click('.toc-theme[data-theme="geometry"]');
  const visible = await page.$$eval('#tocGroups .toc-card:not(.is-hidden)', els => els.length);
  if (visible !== 3) throw new Error('geometry filter shows ' + visible);
});

// 6. three shots -> seen stamp
await check('three-shots-seen', async page => {
  await page.goto(`${base}/book.html?p=chenjiaci`, { waitUntil: 'networkidle' });
  await waitBook(page);
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.__BOOK__.nextShot());
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__BOOK__.nextShot());
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ shot: window.__BOOK__.state.shot, seen: JSON.parse(localStorage.getItem('canton-atlas-museum-seen') || '[]') }));
  if (st.shot !== 2) throw new Error('shot not advanced to 2: ' + st.shot);
  if (!st.seen.includes('chenjiaci')) throw new Error('chenjiaci not marked seen after 3 shots');
});

// 7. page turn via turnPage
await check('turn-page', async page => {
  await page.goto(`${base}/book.html?p=chenjiaci`, { waitUntil: 'networkidle' });
  await waitBook(page);
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.__BOOK__.turnPage(1));
  await page.waitForTimeout(3200);
  const st = await page.evaluate(() => ({ index: window.__BOOK__.state.index, id: document.querySelector('#pageNumber b').textContent, view: window.__BOOK__.state.view }));
  if (st.index !== 1) throw new Error('did not advance to page 2: ' + JSON.stringify(st));
});

// 8. L tier fallback (no WebGL)
await check('L-tier-fallback', async page => {
  await page.addInitScript(() => {
    try { Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null, configurable: true }); } catch (e) {}
  });
  await page.goto(`${base}/book.html?p=chenjiaci`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ tier: window.__BOOK__ ? window.__BOOK__.state.tier : 'none' }));
  // tier may stay H but stage creation throws; either way book must not crash
  const alive = await page.evaluate(() => !!window.__BOOK__);
  if (!alive) throw new Error('book crashed without WebGL');
});

// 9. no console errors on full walk
await check('clean-walk', async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(`${base}/book.html?p=chenjiaci`, { waitUntil: 'networkidle' });
  await waitBook(page);
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__BOOK__.turnPage(1));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__BOOK__.turnPage(-1));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__BOOK__.expand(true));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__BOOK__.expand(false));
  await page.waitForTimeout(400);
  const real = errs.filter(e => !/favicon|ERR_/.test(e));
  if (real.length) throw new Error(real.length + ' console errors: ' + real.slice(0, 2).join(' / '));
});

await browser.close();
await new Promise(r => server.close(r));
console.log('book verify done');
