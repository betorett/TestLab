import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome']
  },
  webServer: {
    command: './node_modules/.bin/serve -l 4173 .',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});
