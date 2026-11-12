import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createPreview, workspace } from './preview.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const out = path.join(workspace, 'canton-atlas/web/blender-workflow');
const bytes = await fs.readFile(path.join(out, 'seaside-hotel.glb'));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
assert.equal(gltf.asset.version, '2.0');
assert.ok(gltf.meshes.length > 50);
assert.equal(gltf.materials.length, 9);
assert.ok(gltf.nodes.some(node => node.extras?.building === true));
const source = await fs.stat(path.join(out, 'seaside-hotel.blend'));
assert.ok(source.size > 100000);

const server = createPreview();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const installedChrome = await fs.access(chromePath).then(() => true, () => false);
  browser = await chromium.launch({
    ...(installedChrome ? { executablePath: chromePath } : {}),
    headless: true, args: ['--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  // Fail external requests: the delivered page must work using only local resources.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      errors.push(`Unexpected external request: ${url}`);
      return route.abort();
    }
    return route.continue();
  });
  const url = `http://127.0.0.1:${server.address().port}/blender-workflow/`;
  await page.goto(url);
  await page.waitForFunction(() => window.workflowDiagnostics, null, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('hidden'));
  const diagnostics = () => page.evaluate(() => window.workflowDiagnostics());
  const initial = await diagnostics();
  assert.ok(initial.meshes > 50);
  assert.equal(initial.materials.length, 9);
  assert.ok(initial.triangles < 15000, 'Low-poly triangle budget');
  for (const dimension of initial.size) assert.ok(Number.isFinite(dimension) && dimension > 0);
  assert.ok(Math.abs(initial.size[0] - 30) < 0.01);
  assert.ok(Math.abs(initial.buildingSize[0] - 13) < 0.1);
  assert.ok(Math.abs(initial.buildingSize[1] - 6.025) < 0.1);
  for (const material of initial.materials) {
    assert.ok(material.color.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.ok(material.roughness >= 0 && material.roughness <= 1);
  }
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  const clickBuilding = async () => {
    const state = await diagnostics();
    await page.mouse.click(bounds.x + state.buildingPoint[0], bounds.y + state.buildingPoint[1]);
    await page.waitForFunction(() => document.querySelector('#info').classList.contains('visible'));
  };
  await clickBuilding();
  assert.match(await page.locator('#info h2').innerText(), /海滨酒店/);
  await page.screenshot({ path: path.join(out, 'web-preview.png'), animations: 'disabled' });
  await page.locator('#close').click();

  // A click on the empty background must not open building information.
  await page.mouse.click(bounds.x + 15, bounds.y + 15);
  assert.equal(await page.locator('#info').evaluate(el => el.classList.contains('visible')), false);
  const center = { x: bounds.x + bounds.width * 0.4, y: bounds.y + bounds.height * 0.55 };
  const settle = () => page.waitForTimeout(600);
  const changed = (a, b) => Math.hypot(...a.map((v, i) => v - b[i])) > 0.01;
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 70, center.y + 25, { steps: 12 });
  await page.mouse.up();
  await settle();
  const rotated = await diagnostics();
  assert.ok(changed(initial.camera, rotated.camera), 'Left drag rotates the camera');
  assert.equal(await page.locator('#info').evaluate(el => el.classList.contains('visible')), false, 'Drag must not show a card');
  await page.mouse.wheel(0, -250);
  await settle();
  const zoomed = await diagnostics();
  assert.ok(changed(rotated.camera, zoomed.camera), 'Wheel zoom changes distance');
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(center.x + 140, center.y + 45, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await settle();
  const panned = await diagnostics();
  assert.ok(changed(zoomed.target, panned.target), 'Right drag pans the target');

  await page.setViewportSize({ width: 390, height: 844 });
  await settle();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(out, 'web-mobile.png') });
  assert.deepEqual(errors, [], 'Browser must have no errors or failed requests');
  const report = {
    passed: true, blender: '5.2.1 LTS', glbBytes: bytes.length, blendBytes: source.size,
    ...initial, errors, checks: [
      'GLB 2.0 header and JSON', 'Editable blend exists', 'GLTFLoader loads local GLB',
      'Mesh / material counts', 'Finite dimensions and 13m main building width',
      'Low-poly triangle budget', 'Material PBR values',
      'Building click / close / empty background', 'Rotate / zoom / pan / drag filtering',
      'Mobile layout', 'No external network requests', 'No console or HTTP errors',
    ],
  };
  await fs.writeFile(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
