import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreview } from './preview.mjs';
test('preview serves assets, injects safe fallback and rejects writes', async () => {
  const server = createPreview({ configPath: 'missing-config-for-test.json' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    const config = await fetch(base + '/immersive/poi-config.js');
    assert.match(await config.text(), /"enabled":false/);
    assert.equal(config.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(base + '/not-found')).status, 404);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/%2e%2e%5cpackage.json')).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
