import { expect, test } from '@playwright/test';

test('native dialog centering clears the old fixed offsets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#settings-btn').click();
  const dialog = page.locator('#settings-modal');
  await expect(dialog).toBeVisible();
  const box = await dialog.evaluate((element) => {
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      position: style.position,
      top: style.top,
      right: style.right,
      bottom: style.bottom,
      left: style.left,
      transform: style.transform,
      marginTop: style.marginTop,
      marginRight: style.marginRight,
      marginBottom: style.marginBottom,
      marginLeft: style.marginLeft,
      display: style.display,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
    };
  });
  expect(box.position).toBe('fixed');
  expect(box.top).toBe('0px');
  expect(box.right).toBe('0px');
  expect(box.bottom).toBe('0px');
  expect(box.left).toBe('0px');
  expect(box.transform).toBe('none');
  expect(box.marginLeft).toBe(box.marginRight);
  expect(box.marginTop).toBe(box.marginBottom);
  expect(box.display).toBe('block');
  const viewport = page.viewportSize();
  expect(Math.abs(box.rect.x + box.rect.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.rect.y + box.rect.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  expect(box.rect.x).toBeGreaterThanOrEqual(0);
  expect(box.rect.y).toBeGreaterThanOrEqual(0);
  expect(box.rect.right).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.rect.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#settings-btn')).toBeFocused();
  await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).display)).toBe('none');
});
