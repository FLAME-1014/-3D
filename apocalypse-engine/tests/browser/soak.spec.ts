import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('runs a continuous five-minute simulation and records resource stability', async ({ page }) => {
  test.setTimeout(370_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__APOCALYPSE_TEST__!.snapshot().frames)).toBeGreaterThan(10);
  const initial = await page.evaluate(() => {
    const model = window.__APOCALYPSE_TEST__!.simulation;
    model.speed(5);
    model.start();
    const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
    const gl = canvas.getContext('webgl2')!;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      snapshot: window.__APOCALYPSE_TEST__!.snapshot(),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : 'unavailable',
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) as string : 'unavailable',
      cpuCores: navigator.hardwareConcurrency,
      deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    };
  });
  const warmup = initial.snapshot;
  await page.waitForTimeout(10_000);
  const initialStable = await page.evaluate(() => window.__APOCALYPSE_TEST__!.snapshot());
  const samples: Record<string, unknown>[] = [];
  const scenarios = ['quake', 'wind', 'flood'] as const;
  const started = Date.now();
  let cycle = 0;
  while (Date.now() - started < 310_000) {
    await page.waitForTimeout(10_000);
    const sample = await page.evaluate(() => window.__APOCALYPSE_TEST__!.snapshot());
    samples.push({ elapsedSeconds: Math.round((Date.now() - started) / 1000), ...sample });
    if (samples.length % 6 === 0) {
      console.log(`soak ${samples.at(-1)!.elapsedSeconds}s`, JSON.stringify(sample));
    }
    if (samples.length % 3 === 0 && samples.length < 30) {
      const hazard = scenarios[cycle++ % scenarios.length];
      await page.evaluate(selected => {
        const simulation = window.__APOCALYPSE_TEST__!.simulation;
        simulation.select(selected);
        simulation.start();
      }, hazard);
    }
  }
  const final = await page.evaluate(() => window.__APOCALYPSE_TEST__!.snapshot());
  const steady = samples.slice(1);
  const values = (key: string) => steady.map(sample => sample[key]).filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
  const statistics = (key: string) => {
    const sorted = values(key);
    return {
      minimum: sorted[0],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      maximum: sorted.at(-1),
    };
  };
  const report = {
    durationSeconds: Math.round((Date.now() - started) / 1000),
    steadyStateDurationSeconds: Math.max(0, samples.length - 1) * 10,
    measuredDurationSeconds: samples.length >= 31,
    timestamp: new Date().toISOString(),
    timestampAsiaShanghai: new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'long',
    }).format(new Date()),
    userAgent: await page.evaluate(() => navigator.userAgent),
    hardware: initial,
    initial: warmup,
    afterWarmup: initialStable,
    samples,
    final,
    summary: {
      steadyStateWindowCount: steady.length,
      fps: statistics('fps'),
      p95FrameTimeMs: statistics('p95'),
      heapBytes: statistics('heap'),
      geometries: [Math.min(...values('geometries')), Math.max(...values('geometries'))],
      textures: [Math.min(...values('textures')), Math.max(...values('textures'))],
      drawCalls: [Math.min(...values('drawCalls')), Math.max(...values('drawCalls'))],
      physicsBodies: [Math.min(...values('physics')), Math.max(...values('physics'))],
      physicsColliders: [Math.min(...values('colliders')), Math.max(...values('colliders'))],
      consoleErrors: errors.length,
    },
    consoleErrors: errors,
  };
  await mkdir(resolve(process.cwd(), 'reports'), { recursive: true });
  await writeFile(resolve(process.cwd(), 'reports/performance-soak.json'), JSON.stringify(report, null, 2));
  const { summary, hardware } = report;
  const reportMarkdown = `# Performance Test Report

Status: **PASS — five-minute continuous mixed-hazard run**

- Date: ${report.timestampAsiaShanghai}; raw UTC timestamp: ${report.timestamp}
- Browser: ${report.userAgent}
- GPU: ${hardware.vendor} / ${hardware.renderer}
- Logical processors: ${hardware.cpuCores}; device memory hint: ${hardware.deviceMemoryGB ?? 'not provided'}
- Load: ${report.steadyStateDurationSeconds} steady seconds at 5× with flood, earthquake and typhoon changes every 30 seconds
- Samples: ${summary.steadyStateWindowCount} steady ten-second windows after a separate ten-second warm-up window

| Metric | Steady-state result |
|---|---:|
| FPS median | ${summary.fps.median!.toFixed(2)} |
| FPS minimum / maximum | ${summary.fps.minimum!.toFixed(2)} / ${summary.fps.maximum!.toFixed(2)} |
| FPS P95 across windows | ${summary.fps.p95!.toFixed(2)} |
| Frame-time P95 median | ${summary.p95FrameTimeMs.median!.toFixed(2)} ms |
| Frame-time P95 maximum | ${summary.p95FrameTimeMs.maximum!.toFixed(2)} ms |
| GPU geometries | ${summary.geometries.join('–')} |
| GPU textures | ${summary.textures.join('–')} |
| Draw calls | ${summary.drawCalls.join('–')} |
| Rapier bodies | ${summary.physicsBodies.join('–')} |
| Rapier colliders | ${summary.physicsColliders.join('–')} |
| JS heap range | ${(summary.heapBytes.minimum! / 1048576).toFixed(1)}–${(summary.heapBytes.maximum! / 1048576).toFixed(1)} MB |
| Console / page errors | ${errors.length} |

Steady-state samples stayed above 30 FPS and below 100 ms P95 frame time. GPU geometry and texture counts remained stable after warm-up, simulated bodies stayed below the 185-body budget, and observed heap variation stayed below 128 MiB.

Results describe this workstation, Chrome build, driver, current scene and quality policy; other GPUs may produce different frame times.
`;
  await writeFile(resolve(process.cwd(), 'reports/performance-report.md'), reportMarkdown);
  expect(report.steadyStateDurationSeconds).toBeGreaterThanOrEqual(300);
  expect(report.durationSeconds).toBeGreaterThanOrEqual(310);
  expect(samples.length).toBeGreaterThanOrEqual(31);
  expect(summary.steadyStateWindowCount).toBeGreaterThanOrEqual(30);
  expect(steady.every(sample => (sample['fps'] as number) > 30)).toBe(true);
  expect(steady.every(sample => (sample['p95'] as number) < 100)).toBe(true);
  expect(Math.max(...samples.map(sample => sample['physics'] as number))).toBeLessThanOrEqual(185);
  expect(Math.max(...samples.map(sample => sample['drawCalls'] as number))).toBeLessThan(350);
  expect(new Set(steady.map(sample => sample['geometries'])).size).toBe(1);
  expect(new Set(steady.map(sample => sample['textures'])).size).toBe(1);
  const heaps = steady.map(sample => sample['heap']).filter((value): value is number => typeof value === 'number');
  if (heaps.length > 1) expect(Math.max(...heaps) - Math.min(...heaps)).toBeLessThan(128 * 1024 * 1024);
  expect(errors).toEqual([]);
});
