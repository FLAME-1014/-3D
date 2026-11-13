import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('video rejects incompatible dimensions before launching a browser or creating output', () => {
  const result = spawnSync(process.execPath, ['scripts/capture.mjs', '--video', '--width', '1601'], {encoding: 'utf8'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires even width and height/);
});
test('capture rejects an unrepresentable end time before launching a browser', () => {
  for (const args of [['--start', '1e20'], ['--start', '999999999', '--duration', '2', '--speed', '16']]) {
    const result = spawnSync(process.execPath, ['scripts/capture.mjs', ...args], {encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exceeds the supported/);
  }
});
test('capture rejects unsupported speed and camera settings before opening a browser', () => {
  for (const [args, message] of [
    [['--speed', '100'], /--speed must be one of/],
    [['--shop', 'stamping', '--station', '9'], /existing workshop station/],
    [['--close'], /requires --station/],
    [['--quality', 'invalid'], /--quality must be/],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/capture.mjs', ...args], {encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
  }
});
