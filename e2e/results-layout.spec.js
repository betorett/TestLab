import { expect, test } from '@playwright/test';

test('results summary is compact and restart button returns to Mis tests', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Resultados',
    questions: [
      { type: 'SINGLE', prompt: '¿2+2?', choices: [{ id: 'A', text: '4' }, { id: 'B', text: '5' }], answer: 'A' }
    ]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Empezar Resultados' }).click();
  await page.getByRole('button', { name: 'Modo Examen' }).click();
  await page.getByRole('button', { name: /4/ }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();

  // Wait for 1500ms calculating screen transition
  const restartBtn = page.getByRole('button', { name: 'Volver a Mis tests' });
  await expect(restartBtn).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#final-score')).toHaveText('10');
  await expect(page.locator('#score-detail')).toContainText('(Penaliza: -0.33)');

  const ringBox = await page.locator('.score-ring').boundingBox();
  expect(ringBox.width).toBeGreaterThanOrEqual(90);
  expect(ringBox.width).toBeLessThanOrEqual(102);
  expect(ringBox.height).toBeGreaterThanOrEqual(90);
  expect(ringBox.height).toBeLessThanOrEqual(102);
});
