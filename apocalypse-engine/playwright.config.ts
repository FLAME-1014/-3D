import { defineConfig, devices } from '@playwright/test';

const soak = process.argv.includes('--project=soak');

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: soak ? 'reports/soak-results.json' : 'reports/browser-results.json' }]],
  timeout: soak ? 375_000 : 90_000,
  expect: { timeout: 12_000 },
  outputDir: soak ? 'test-results/soak' : 'test-results/browser',
  use: {
    baseURL: 'http://127.0.0.1:5180',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: { args: ['--enable-webgl', '--enable-webgl2', '--ignore-gpu-blocklist', '--disable-gpu-driver-bug-workarounds', '--use-angle=default'] },
  },
  projects: [
    {
      name: 'browser',
      testMatch: /app\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1600, height: 960 } },
    },
    {
      name: 'soak',
      testMatch: /soak\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1600, height: 960 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
