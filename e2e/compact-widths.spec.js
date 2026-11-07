import { expect, test } from '@playwright/test';

function bank(title) {
  return JSON.stringify({
    schemaVersion: 1,
    title,
    questions: [{
      type: 'SINGLE',
      prompt: title,
      choices: [
        { id: 'A', text: 'Sí' },
        { id: 'B', text: 'No' }
      ],
      answer: 'A'
    }]
  });
}

const CHECKED_WIDTHS = [320, 390, 768, 1280, 1440];

test('empty library does not overflow at checked widths', async ({ page }) => {
  for (const width of CHECKED_WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(noOverflow, `overflow at width ${width}`).toBe(true);
  }
});

test('at 390x844 import-btn and empty-import are visible and no drop-zone outside dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#import-btn')).toBeVisible();
  await expect(page.locator('#empty-import')).toBeVisible();
  const outerDropZone = page.locator('#upload-screen > #drop-zone, .library-column > #drop-zone');
  await expect(outerDropZone).toHaveCount(0);
});

test('with an imported test, first library row is below header and within 844px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(bank('Primero'));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  const row = page.locator('.library-row').first();
  await expect(row).toBeVisible();
  const headerBox = await page.locator('.app-header').boundingBox();
  const rowBox = await row.boundingBox();
  expect(rowBox.y).toBeGreaterThan(headerBox.y + headerBox.height);
  expect(rowBox.y + rowBox.height).toBeLessThan(844);
});

test('a 200 M character name does not cause horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#empty-import').click();
  const longName = 'M'.repeat(200);
  await page.locator('#paste-input').fill(bank(longName));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(noOverflow).toBe(true);
});

test('with 32px font size and viewport 1280 the library does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(noOverflow).toBe(true);
});

test('thirty tests of one question: the summary of the last after scroll has top less than viewport height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const thirty = Array.from({ length: 30 }, (_, i) => ({
    name: `Test ${i + 1}`,
    date: '1/1/2026',
    lastScore: null,
    questions: [{
      type: 'SINGLE',
      prompt: `Pregunta ${i + 1}`,
      body: {
        choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }],
        correctIds: ['A']
      }
    }]
  }));
  await page.addInitScript((items) => {
    localStorage.setItem('testlab-history', JSON.stringify(items));
  }, thirty);

  await page.goto('/');
  const summaries = page.locator('.library-menu summary');
  await expect(summaries).toHaveCount(30);
  const lastSummary = summaries.last();
  await lastSummary.scrollIntoViewIfNeeded();
  const box = await lastSummary.boundingBox();
  expect(box.y).toBeLessThan(844);
  expect(box.y).toBeGreaterThanOrEqual(0);
});
