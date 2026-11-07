import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const jsonBank = fs.readFileSync(new URL('../examples/banco-mixto.json', import.meta.url), 'utf8');

test('JSON bank walks all eight types, keyboard controls, and an import error', async ({ page }) => {
  await page.goto('/');
  const opener = page.locator('#import-btn');
  if (await opener.isVisible()) await opener.click();
  else await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(jsonBank);
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.locator('#import-errors')).toBeEmpty();
  await page.getByRole('button', { name: 'Empezar Banco mixto' }).click();
  await page.getByRole('button', { name: /Modo Estudio/ }).click();

  await expect(page.locator('img.question-image')).toHaveAttribute('alt', 'Marca violeta sobre un esquema');
  await page.locator('.option-btn', { hasText: 'Madrid' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.locator('.option-btn', { hasText: '2' }).click();
  await page.locator('.option-btn', { hasText: '4' }).click();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.locator('.answer-status')).toHaveText('Respuesta correcta');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  const verdadero = page.getByLabel('Verdadero');
  await verdadero.focus();
  await page.keyboard.press('Space');
  await expect(verdadero).toBeChecked();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Hueco 1').fill('Paris');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Hueco 1').fill('Francia');
  await page.getByLabel('Hueco 2').fill('España');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Valor', { exact: true }).fill('9,81');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.locator('.answer-status')).toHaveText('Respuesta correcta');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Valor', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Madrid').selectOption('España');
  await page.getByLabel('Roma').selectOption('Italia');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  const down = page.getByRole('button', { name: 'Bajar Planificar' });
  const moveBtn = (await down.isDisabled())
    ? page.getByRole('button', { name: 'Subir Planificar' })
    : down;
  await moveBtn.focus();
  await expect(moveBtn).toBeFocused();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.locator('.answer-status')).toHaveText('Respuesta incorrecta');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Tu respuesta').fill('una respuesta distinta del modelo');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByText('Tendencia de un cuerpo a conservar su estado de movimiento')).toBeVisible();
  await expect(page.locator('.answer-status')).toContainText('Pendiente de autoevaluación');
  await page.screenshot({ path: 'test-results/testlab-short-answer.png', fullPage: true });
  await page.getByRole('button', { name: 'La he fallado' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.locator('#results-screen')).toHaveClass(/active/);
  await expect(page.locator('#score-detail')).not.toContainText('pendientes');
  await page.screenshot({ path: 'test-results/testlab-results.png', fullPage: true });

  await page.locator('#restart-btn').click();
  const opener2 = page.locator('#import-btn');
  if (await opener2.isVisible()) await opener2.click();
  else await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill('{"schemaVersion":2,"questions":[]}');
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.locator('#import-errors')).toContainText('schemaVersion');
});

test('a legacy CSV file upload still creates a repository entry', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles('sample_exam.csv');
  await expect(page.locator('#import-errors')).toBeEmpty();
  await expect(page.locator('#history-list')).toContainText('5 preguntas');
  await page.getByRole('button', { name: 'Empezar sample_exam' }).click();
  await page.getByRole('button', { name: /Modo Examen/ }).click();
  await page.locator('.option-btn', { hasText: 'Rojo' }).click();
  await expect(page.getByText('2 / 5')).toBeVisible();
});
