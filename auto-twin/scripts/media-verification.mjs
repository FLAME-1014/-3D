import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const MAX_VERIFY_SECONDS = 120;

function fail(message) {
  throw new Error(`Media verification failed: ${message}`);
}

function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail('PNG signature is missing');
  }
  let width, height, channels, interlace, bitDepth, colorType;
  const idat = [];
  let offset = 8;
  let sawIend = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) fail('PNG chunk extends beyond the buffer');
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      if (length !== 13 || width !== undefined) fail('PNG has an invalid or duplicate IHDR');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
      if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
        fail('PNG must be non-interlaced 8-bit RGB or RGBA');
      }
      channels = colorType === 2 ? 3 : 4;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      sawIend = true;
      break;
    }
    offset = end;
  }
  if (!width || !height || !channels || !sawIend || idat.length === 0) fail('PNG is missing IHDR, IDAT, or IEND');
  const stride = width * channels;
  let encoded;
  try { encoded = inflateSync(Buffer.concat(idat)); } catch (error) {
    fail(`PNG IDAT decompression failed: ${error.message}`);
  }
  if (encoded.length !== (stride + 1) * height) fail('PNG scanline length does not match IHDR dimensions');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const encodedRow = y * (stride + 1);
    const filter = encoded[encodedRow];
    if (filter > 4) fail(`unsupported PNG scanline filter ${filter}`);
    for (let x = 0; x < stride; x++) {
      const row = y * stride;
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y ? pixels[row + x - stride] : 0;
      const corner = y && x >= channels ? pixels[row + x - stride - channels] : 0;
      const predictor = left + up - corner;
      const a = Math.abs(predictor - left), b = Math.abs(predictor - up), c = Math.abs(predictor - corner);
      const paeth = a <= b && a <= c ? left : b <= c ? up : corner;
      const adjustment = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      pixels[row + x] = (encoded[encodedRow + 1 + x] + adjustment) & 255;
    }
  }
  return {width, height, channels, pixels};
}

export function inspectPng(buffer, expectedWidth, expectedHeight) {
  if (!Number.isInteger(expectedWidth) || !Number.isInteger(expectedHeight) || expectedWidth < 1 || expectedHeight < 1) {
    fail('expected PNG dimensions must be positive integers');
  }
  const image = decodePng(buffer);
  if (image.width !== expectedWidth || image.height !== expectedHeight) {
    fail(`PNG dimensions are ${image.width}x${image.height}; expected ${expectedWidth}x${expectedHeight}`);
  }
  let sum = 0, squareSum = 0, nonBlack = 0, pixels = 0;
  for (let offset = 0; offset < image.pixels.length; offset += image.channels) {
    const red = image.pixels[offset], green = image.pixels[offset + 1], blue = image.pixels[offset + 2];
    const brightness = .2126 * red + .7152 * green + .0722 * blue;
    sum += brightness; squareSum += brightness * brightness; pixels++;
    if (brightness > 8) nonBlack++;
  }
  const meanBrightness = sum / pixels;
  const variance = Math.max(0, squareSum / pixels - meanBrightness * meanBrightness);
  const stddev = Math.sqrt(variance);
  const nonBlackProportion = nonBlack / pixels;
  if (nonBlackProportion === 0) fail('PNG is completely black');
  if (stddev < 1.5) fail(`PNG is near-uniform (brightness stddev ${stddev.toFixed(3)})`);
  return {
    width: image.width, height: image.height, channels: image.channels,
    meanBrightness, nonBlackProportion, stddev,
  };
}

function parseDuration(text) {
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
}

function parseInput(stderr) {
  const stream = stderr.split(/\r?\n/).find(line => /Stream #\d+:\d+.*Video:/i.test(line));
  if (!stream) fail('FFmpeg did not report a video input stream');
  const videoPart = stream.slice(stream.toLowerCase().indexOf('video:') + 6);
  const codec = videoPart.trim().split(/[\s,(]/)[0].toLowerCase();
  const pixelFormat = (videoPart.match(/\b(yuv420p(?:\w*)?)\b/i) || [])[1]?.toLowerCase() || null;
  const size = videoPart.match(/\b(\d{2,6})x(\d{2,6})\b/);
  const fps = videoPart.match(/\b(\d+(?:\.\d+)?)\s+fps\b/i);
  if (!size || !fps) fail(`FFmpeg input metadata lacks dimensions or fps: ${stream}`);
  const duration = parseDuration(stderr);
  if (duration === null) fail('FFmpeg input metadata lacks duration');
  return {
    codec, pixelFormat,
    width: Number(size[1]), height: Number(size[2]),
    fps: Number(fps[1]), duration,
  };
}

function parseDecodedFrames(stdout) {
  const matches = [...stdout.matchAll(/(?:^|\n)frame=\s*(\d+)/g)];
  if (!matches.length) fail('FFmpeg progress output did not report decoded frames');
  return Number(matches.at(-1)[1]);
}

export function verifyVideo(binary, videoPath, expected) {
  if (!binary || typeof binary !== 'string') fail('FFmpeg binary is required');
  if (!videoPath || typeof videoPath !== 'string') fail('video path is required');
  const {frameCount, fps, width, height} = expected || {};
  if (![frameCount, fps, width, height].every(Number.isFinite) || frameCount < 1 || fps <= 0 || width < 1 || height < 1) {
    fail('expected frameCount, fps, width, and height must be positive finite numbers');
  }
  let stat;
  try { stat = fs.statSync(videoPath); } catch (error) { fail(`video file cannot be read: ${error.message}`); }
  if (!stat.isFile() || stat.size <= 0) fail('video file is missing or empty');
  const args = [
    '-hide_banner', '-loglevel', 'info', '-nostats', '-progress', 'pipe:1',
    '-i', videoPath, '-map', '0:v:0', '-vf', 'blackdetect=d=0.1:pix_th=0.01',
    '-an', '-f', 'null', '-',
  ];
  const result = spawnSync(binary, args, {
    encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
    timeout: 60000,
  });
  if (result.error) fail(`FFmpeg execution failed: ${result.error.message}`);
  if (result.signal) fail(`FFmpeg timed out or was terminated by ${result.signal}`);
  const stderr = result.stderr || '', stdout = result.stdout || '';
  if (result.status !== 0) fail(`FFmpeg decode failed (exit ${result.status}): ${stderr.trim().slice(-2000)}`);
  const input = parseInput(stderr);
  if (/\bblack_start\s*:/i.test(stderr)) fail('FFmpeg blackdetect found a black segment');
  const decodedFrames = parseDecodedFrames(stdout);
  const epsilon = Math.max(.02, 1 / fps);
  if (decodedFrames !== Math.round(frameCount)) fail(`decoded ${decodedFrames} frames; expected ${Math.round(frameCount)}`);
  if (input.width !== Math.round(width) || input.height !== Math.round(height)) {
    fail(`video dimensions are ${input.width}x${input.height}; expected ${width}x${height}`);
  }
  if (Math.abs(input.fps - fps) > epsilon) fail(`video fps is ${input.fps}; expected ${fps}`);
  const expectedDuration = frameCount / fps;
  if (Math.abs(input.duration - expectedDuration) > Math.max(.08, epsilon * 2)) {
    fail(`video duration is ${input.duration.toFixed(4)}s; expected about ${expectedDuration.toFixed(4)}s`);
  }
  if (input.codec !== 'h264') fail(`video codec is ${input.codec}; expected h264`);
  if (input.pixelFormat !== 'yuv420p') fail(`video pixel format is ${input.pixelFormat || 'unknown'}; expected yuv420p`);
  return {
    path: videoPath, bytes: stat.size,
    sha256: createHash('sha256').update(fs.readFileSync(videoPath)).digest('hex'),
    decodedFrames, input,
    command: [binary, ...args],
  };
}
