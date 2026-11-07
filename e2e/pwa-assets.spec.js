import { expect, test } from '@playwright/test';

test('pwa assets respond and the manifest drops icon.png', async ({ page }) => {
  for (const path of [
    '/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-192.png',
    '/icons/icon-maskable-512.png',
    '/manifest.json'
  ]) {
    const response = await page.request.get(path);
    expect(response.ok(), path).toBe(true);
  }
  const manifest = await (await page.request.get('/manifest.json')).text();
  expect(manifest).not.toContain('icon.png');
});
