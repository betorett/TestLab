import { expect, test } from '@playwright/test';

test('exam bar stays inside 320px and progress is semantic', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Barra',
    questions: [
      { type: 'MULTIPLE', prompt: 'Elige', choices: [{ id: 'A', text: 'Uno' }, { id: 'B', text: 'Dos' }], answer: ['A'] },
      { type: 'SINGLE', prompt: '¿Sí?', choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }], answer: 'A' }
    ]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Empezar Barra' }).click();
  await page.getByRole('button', { name: 'Modo Estudio' }).click();
  const progress = page.locator('#exam-progress');
  await expect(progress).toHaveAttribute('max', '2');
  await expect(progress).toHaveAttribute('aria-label', 'Progreso del examen');
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
  await page.getByRole('button', { name: /Uno/ }).click();
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(progress).toHaveAttribute('value', '1');
  const bar = page.locator('.exam-bottombar');
  const widths = await bar.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
