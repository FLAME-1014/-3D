import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'canton-atlas/web');
const spots = path.join(root, 'canton-atlas/content/spots');
const read = file => fs.readFileSync(file, 'utf8');

function buildCatalog() {
  const context = vm.createContext({window: {}});
  vm.runInContext(read(path.join(web, 'data.js')) + '\nwindow.__ATLAS_PLACES = PLACES;', context);
  vm.runInContext(read(path.join(web, 'museum-catalog.js')), context);
  return context.window.MUSEUM_CATALOG;
}

test('museum catalog covers every modeled spot and has a compact poster for each', () => {
  const catalog = buildCatalog();
  const spotIds = fs.readdirSync(spots, {withFileTypes: true}).filter(entry => entry.isDirectory() && entry.name !== '_template').map(entry => entry.name).sort();
  const exhibitIds = Array.from(catalog.entries, entry => entry.id).sort();
  assert.equal(catalog.entries.length, 18);
  assert.deepEqual(exhibitIds, spotIds);
  for (const entry of catalog.entries) {
    assert.ok(entry.name.length > 0, `${entry.id} has a display name`);
    assert.ok(catalog.themes[entry.theme], `${entry.id} has a valid theme`);
    const imagePath = path.join(web, entry.cover);
    assert.ok(fs.existsSync(imagePath), `${entry.id} has a poster image`);
    assert.ok(fs.statSync(imagePath).size < 250_000, `${entry.id} poster is optimized`);
  }
});

test('museum lobby defers Three.js and supports direct exhibit links', () => {
  const html = read(path.join(web, 'museum.html'));
  const js = read(path.join(web, 'museum.js'));
  assert.doesNotMatch(html, /immersive\/three\.min\.js/);
  assert.match(html, /id="viewerFrame"/);
  assert.match(js, /new URL\(location\.href\)\.searchParams\.get\("item"\)/);
  assert.match(js, /spot\.html\?id=/);
  assert.match(js, /&embed=1&from=museum/);
  assert.match(js, /canton-museum-open-details/);
  assert.match(js, /detailsRequested/);
  assert.match(html, /id="viewerLead"/);
});

test('museum collection is separate from physical visit marks and receives model lifecycle messages', () => {
  const js = read(path.join(web, 'museum.js'));
  const diorama = read(path.join(web, 'js/diorama.js'));
  const css = read(path.join(web, 'spot.css'));
  assert.match(js, /canton-atlas-museum-seen/);
  assert.match(js, /canton-atlas-museum-favorites/);
  assert.doesNotMatch(js, /canton-atlas-marks/);
  assert.match(js, /event\.source !== frame\.contentWindow/);
  assert.match(js, /state\.restoreScrollY = window\.scrollY/);
  assert.match(js, /focus\(\{ preventScroll: true \}\)/);
  assert.match(js, /history\.scrollRestoration = "manual"/);
  assert.match(diorama, /canton-museum-ready/);
  assert.match(diorama, /canton-museum-error/);
  assert.match(diorama, /event\.source !== window\.parent/);
  assert.match(diorama, /data\.type === "canton-museum-open-details"/);
  assert.match(read(path.join(web, 'museum.css')), /body\.viewer-open \{ position: fixed/);
  assert.match(css, /body\.embed-museum #markVisited/);
});
