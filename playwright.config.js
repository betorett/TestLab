import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ignoreHTTPSErrors: true,
    ...devices['Desktop Chrome'],
    ...(process.platform === 'win32' ? { channel: 'chrome' } : {})
  },
  webServer: {
    command: 'npx serve -l 4173 .',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});
