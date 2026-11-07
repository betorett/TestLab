import { expect, test } from '@playwright/test';

test('inactive screens stay out of the accessibility tree', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.locator('body').evaluate((element) => getComputedStyle(element).overflow);
  expect(overflow).not.toBe('hidden');
  for (const id of ['mode-screen', 'exam-screen', 'loading-screen', 'results-screen']) {
    const screen = page.locator(`#${id}`);
    await expect(screen).toBeHidden();
    await expect.poll(() => screen.evaluate((element) => getComputedStyle(element).display)).toBe('none');
  }
  await expect(page.getByRole('heading', { name: '¿Cómo quieres estudiar?' })).toHaveCount(0);
});
