import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('initializes an interactive 3D city and produces a visible WebGL frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?test=1');
  await expect(page.locator('canvas#scene')).toBeVisible();
  await expect(page.locator('h1')).toContainText('子午港');
  await expect(page.locator('#status-title')).toHaveText('待命');
  await expect.poll(() => page.evaluate(() => window.__APOCALYPSE_TEST__?.snapshot().frames ?? 0)).toBeGreaterThan(0);
  const state = await page.evaluate(() => ({
    width: document.querySelector<HTMLCanvasElement>('#scene')!.width,
    height: document.querySelector<HTMLCanvasElement>('#scene')!.height,
    pixels: window.__APOCALYPSE_TEST__!.snapshot()['testPixel'] as number[],
    snapshot: window.__APOCALYPSE_TEST__!.snapshot(),
  }));
  expect(state.width).toBeGreaterThan(1000);
  expect(state.height).toBeGreaterThan(500);
  expect(state.pixels.some(channel => channel > 20)).toBe(true);
  expect(state.snapshot['colliders']).toBeGreaterThan(40);
  expect(state.snapshot['geometries']).toBeGreaterThan(25);
  await mkdir(resolve(process.cwd(), 'reports'), { recursive: true });
  await page.screenshot({ path: resolve(process.cwd(), 'reports/city-overview.png') });
  expect(errors).toEqual([]);
});

test('synchronizes scenario, controls, pause, single step and water reset', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hazard-card[data-hazard="flood"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.play-button').click();
  await expect(page.locator('#status-title')).toHaveText('灾害预警');
  await page.evaluate(() => {
    const model = window.__APOCALYPSE_TEST__!.simulation;
    for (let step = 0; step < 13; step++) model.advance(0.24);
  });
  await expect(page.locator('#status-title')).toHaveText(/运行中|危险/);
  await page.locator('.play-button').click();
  await expect(page.locator('#status-title')).toHaveText('已暂停');
  const pausedTime = await page.evaluate(() => window.__APOCALYPSE_TEST__!.simulation.clock.time);
  await page.waitForTimeout(160);
  expect(await page.evaluate(() => window.__APOCALYPSE_TEST__!.simulation.clock.time)).toBe(pausedTime);
  await page.locator('[data-action="step"]').click();
  expect(await page.evaluate(() => window.__APOCALYPSE_TEST__!.simulation.clock.time)).toBeGreaterThan(pausedTime);
  await page.evaluate(() => {
    const slider = document.querySelector<HTMLInputElement>('[data-param="initial"]')!;
    slider.value = '5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const liveWater = await page.evaluate(() => ({
    display: document.querySelector('#metrics .hero-metric .metric-value strong')!.textContent,
    model: window.__APOCALYPSE_TEST__!.simulation.metrics().water,
  }));
  expect(Number(liveWater.display)).toBeCloseTo(liveWater.model, 1);
  expect(liveWater.model).toBeGreaterThanOrEqual(5);
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('#status-title')).toHaveText('待命');
  await expect(page.locator('#metrics .hero-metric .metric-value strong')).toHaveText('2.4');
  const state = await page.evaluate(() => {
    const simulation = window.__APOCALYPSE_TEST__!.simulation;
    return { water: simulation.metrics().water, boundary: simulation.flood.head, configured: simulation.settings.flood.initial };
  });
  expect(state.water).toBe(state.boundary);
  expect(state.boundary).toBe(state.configured);
  await page.locator('.play-button').click();
  await page.evaluate(() => {
    const model = window.__APOCALYPSE_TEST__!.simulation;
    for (let step = 0; step < 14; step++) model.advance(0.24);
  });
  await expect(page.locator('#status-title')).toHaveText(/运行中|危险/);
  await expect(page.locator('#body-count')).toHaveText(/\d+ OBJ/);
  await page.locator('.play-button').click();
  await expect(page.locator('#status-title')).toHaveText('已暂停');
  await page.locator('[data-action="stop"]').click();
  await expect(page.locator('#status-title')).toHaveText('恢复中');
  const stateAfterStop = await page.evaluate(() => window.__APOCALYPSE_TEST__!.simulation.machine.state);
  expect(stateAfterStop).toBe('RECOVERY');
});

test('loads all disasters and restores complete simulation checkpoints', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /地震/ }).click();
  await expect(page.locator('#dock-hazard')).toContainText('EARTHQUAKE');
  await expect(page.locator('[data-param="magnitude"]')).toBeVisible();
  await page.getByRole('button', { name: /台风/ }).click();
  await expect(page.locator('#dock-hazard')).toContainText('TYPHOON');
  await expect(page.locator('[data-param="direction"]')).toBeVisible();
  await page.getByRole('button', { name: /洪水/ }).click();
  await page.getByRole('button', { name: '保存当前状态' }).click();
  await expect(page.locator('.checkpoint-row')).toHaveCount(1);
  const checkpoint = await page.evaluate(() => window.__APOCALYPSE_TEST__!.simulation.checkpoints()[0].id);
  await page.evaluate(() => window.__APOCALYPSE_TEST__!.simulation.configure('initial', 5));
  await page.locator(`[data-restore="${checkpoint}"]`).click();
  await expect(page.locator('[data-param="initial"]')).toHaveValue('2.4');
  await expect(page.locator('#metrics .hero-metric .metric-value strong')).toHaveText('2.4');
  await page.locator('[data-action="settings"]').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.getByRole('button', { name: '夜间' }).click();
  await page.locator('[data-action="close-modal"]').click();
  await page.locator('[data-layer="depth"]').first().click();
  await expect(page.locator('[data-layer="depth"]').first()).toHaveClass(/active/);
  await page.locator('[data-layer="drainage"]').first().click();
});

test('reproduces and verifies each opt-in development fault case', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?faults=1');
  await expect(page.locator('.fault-run')).toHaveCount(8);
  for (const button of await page.locator('.fault-run').all()) {
    const name = await button.locator('i').textContent();
    await button.click();
    await expect(button.locator('i')).toHaveText('回归通过', { timeout: 30_000 });
    await expect(page.locator('.fault-result')).toContainText('注入时断言失败');
    await expect(page.locator('.fault-result')).toContainText('关闭注入后通过');
    expect(name).toBe('运行回归');
  }
  expect(errors).toEqual([]);
});

test('lays out the scene, telemetry and controls on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?test=1');
  await expect(page.locator('canvas#scene')).toBeVisible();
  await expect(page.locator('.bottom-dock')).toBeVisible();
  await expect(page.locator('.panel-right')).toBeVisible();
  const bounds = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
    const dock = document.querySelector<HTMLElement>('.bottom-dock')!;
    const right = document.querySelector<HTMLElement>('.panel-right')!;
    const left = document.querySelector<HTMLElement>('.panel-left')!;
    return { canvas: canvas.getBoundingClientRect().toJSON(), dock: dock.getBoundingClientRect().toJSON(),
      right: right.getBoundingClientRect().toJSON(), left: left.getBoundingClientRect().toJSON(),
      documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  });
  expect(bounds.documentWidth).toBe(bounds.viewportWidth);
  expect(bounds.canvas.width).toBeGreaterThan(300);
  expect(bounds.dock.bottom).toBeLessThanOrEqual(844);
  const overlapX = Math.min(bounds.left.right, bounds.right.right) - Math.max(bounds.left.left, bounds.right.left);
  const overlapY = Math.min(bounds.left.bottom, bounds.right.bottom) - Math.max(bounds.left.top, bounds.right.top);
  expect(overlapX > 0 && overlapY > 0).toBe(false);
  await expect.poll(() => page.evaluate(() =>
    (window.__APOCALYPSE_TEST__!.snapshot()['testPixel'] as number[]).some(channel => channel > 20))).toBe(true);
  await page.screenshot({ path: resolve(process.cwd(), 'reports/city-mobile.png') });
  expect(errors).toEqual([]);
});
