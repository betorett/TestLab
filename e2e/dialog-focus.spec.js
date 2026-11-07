import { expect, test } from '@playwright/test';

test('opening the prompt dialog puts focus on copy and escape returns it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#settings-btn').click();
  const settingsModal = page.locator('#settings-modal');
  await expect(settingsModal).toBeVisible();
  const promptBtn = settingsModal.locator('#open-ai-prompt');
  await promptBtn.click();
  const promptModal = page.locator('#ai-prompt-modal');
  await expect(promptModal).toBeVisible();
  await expect(promptModal.locator('#copy-prompt-btn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(promptModal).toBeHidden();
  await expect(promptBtn).toBeFocused();
  const display = await promptModal.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe('none');
});
