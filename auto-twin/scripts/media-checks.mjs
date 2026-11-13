import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync, crc32} from 'node:zlib';
import {inspectPng} from './media-verification.mjs';

function chunk(type, data) {
  const name = Buffer.from(type);
  const body = Buffer.concat([name, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  return Buffer.concat([length, body, crc]);
}
function png(width, height, pixel) {
  const channels = 3, rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * channels); row[0] = 0;
    for (let x = 0; x < width; x++) pixel(x, y, row, 1 + x * channels);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('rejects an all-black PNG', () => {
  const image = png(8, 4, (_x, _y, row, offset) => row.fill(0, offset, offset + 3));
  assert.throws(() => inspectPng(image, 8, 4), /completely black/);
});

test('rejects a PNG with wrong dimensions', () => {
  const image = png(8, 4, (_x, _y, row, offset) => row.fill(80, offset, offset + 3));
  assert.throws(() => inspectPng(image, 9, 4), /dimensions are 8x4/);
});

test('rejects a near-uniform loading-like PNG', () => {
  const image = png(8, 4, (_x, _y, row, offset) => row.fill(180, offset, offset + 3));
  assert.throws(() => inspectPng(image, 8, 4), /near-uniform/);
});

test('returns useful brightness statistics for a representative scene PNG', () => {
  const image = png(8, 4, (x, y, row, offset) => {
    const value = (x < 4 ? 24 : 210) + y * 4;
    row[offset] = value; row[offset + 1] = Math.min(255, value + (x % 2) * 20); row[offset + 2] = 45;
  });
  const result = inspectPng(image, 8, 4);
  assert.equal(result.width, 8); assert.equal(result.height, 4);
  assert.ok(result.meanBrightness > 50 && result.meanBrightness < 180);
  assert.ok(result.nonBlackProportion > .99);
  assert.ok(result.stddev > 50);
});
