import { expect, test } from '@playwright/test';

async function openMode(page) {
  await page.goto('/');
  await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Modo',
    questions: [{ type: 'SINGLE', prompt: '¿Sí?', choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }], answer: 'A' }]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Empezar Modo' }).click();
}

test('mode choices sit side by side from 768px and stack below', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await openMode(page);
  const study = await page.locator('#mode-study').boundingBox();
  const exam = await page.locator('#mode-exam').boundingBox();
  expect(Math.abs(study.y - exam.y)).toBeLessThanOrEqual(2);
  expect(study.height).toBeGreaterThanOrEqual(48);
  await page.setViewportSize({ width: 320, height: 568 });
  const stackedStudy = await page.locator('#mode-study').boundingBox();
  const stackedExam = await page.locator('#mode-exam').boundingBox();
  expect(stackedExam.y).toBeGreaterThan(stackedStudy.y + stackedStudy.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Volver a Mis tests' })).toBeVisible();
});
