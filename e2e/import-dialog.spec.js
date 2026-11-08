import { expect, test } from '@playwright/test';

test('paste and files keep the chosen folder', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mis tests' })).toBeVisible();
  await expect(page.locator('#empty-import')).toBeVisible();
  await page.locator('#empty-import').click();
  const dialog = page.locator('#import-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#paste-input').fill(`${'pregunta\n'.repeat(40)}{"schemaVersion":1,"title":"Largo","questions":[{"type":"SINGLE","prompt":"¿Sí?","choices":[{"id":"A","text":"Sí"},{"id":"B","text":"No"}],"answer":"A"}]}`);
  await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const add = dialog.getByRole('button', { name: 'Añadir texto' });
  const folder = dialog.getByLabel('Guardar en');
  await expect(add).toBeVisible();
  await expect(folder).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Nueva carpeta' }).click();
  await page.getByRole('dialog', { name: 'Nueva carpeta' }).getByLabel('Nombre').fill('Fluidos');
  await page.keyboard.press('Enter');
  await page.locator('#import-btn').click();
  await page.getByLabel('Guardar en').selectOption({ label: 'Fluidos' });
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Dentro',
    questions: [{ type: 'SINGLE', prompt: '¿Sí?', choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }], answer: 'A' }]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.getByText('Añadido a Mis tests')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir Fluidos' }).click();
  await expect(page.getByRole('button', { name: 'Empezar Dentro' })).toBeVisible();
  await page.locator('#import-btn').click();
  await expect(page.getByLabel('Guardar en')).toHaveValue(/.+/);
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Segundo en Fluidos',
    questions: [{ type: 'SINGLE', prompt: '¿Segundo?', choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }], answer: 'A' }]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.getByRole('button', { name: 'Empezar Segundo en Fluidos' })).toBeVisible();
});
