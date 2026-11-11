import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createPreview, isWithinRoot } from './preview.mjs';

test('preview path boundary handles Windows drive casing without allowing escapes', () => {
  const win = path.win32;
  assert.equal(isWithinRoot('c:/project/web', 'C:/project/web/index.html', win), true);
  assert.equal(isWithinRoot('c:/project/web', 'C:/project/web', win), true);
  assert.equal(isWithinRoot('c:/project/web', 'C:/project/web/assets/../book.html', win), true);
  assert.equal(isWithinRoot('c:/project/web', 'C:/project/web/../private.json', win), false);
  assert.equal(isWithinRoot('c:/project/web', 'C:/project/web-old/index.html', win), false);
  assert.equal(isWithinRoot('c:/project/web', 'D:/project/web/index.html', win), false);
  assert.equal(isWithinRoot('/project/web', '/project/web/index.html', path.posix), true);
  assert.equal(isWithinRoot('/project/web', '/project/Web/index.html', path.posix), false);
  assert.equal(isWithinRoot('/project/web', '/project/private.json', path.posix), false);
});
test('preview serves assets, injects safe fallback and rejects writes', async () => {
  const server = createPreview({ configPath: 'missing-config-for-test.json' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    const config = await fetch(base + '/immersive/poi-config.js');
    assert.match(await config.text(), /"enabled":false/);
    assert.equal(config.headers.get('cache-control'), 'no-store');
    const spot = await fetch(base + '/content/spots/chenjiaci/spot.json');
    assert.equal(spot.status, 200);
    assert.match(spot.headers.get('content-type'), /application\/json/);
    assert.equal((await spot.json()).id, 'chenjiaci');
    assert.equal((await fetch(base + '/content/%2e%2e%5cweb%5cindex.html')).status, 403);
    assert.equal((await fetch(base + '/not-found')).status, 404);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/%2e%2e%5cpackage.json')).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
