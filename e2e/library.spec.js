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

async function pasteBank(page, title) {
  await page.getByRole('button', { name: 'Pegar texto manualmente' }).click();
  await page.locator('#paste-input').fill(bank(title));
  await page.getByRole('button', { name: 'Añadir al Repositorio' }).click();
  await expect(page.locator('#import-errors')).toBeEmpty();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

async function createFolder(page, name) {
  await page.getByRole('button', { name: 'Nueva carpeta' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Nueva carpeta' });
  await dialog.getByLabel('Nombre').fill(name);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: `Abrir ${name}` })).toBeVisible();
}

test('folders, ordering, scoring and deletion work in the browser', async ({ page }) => {
  test.setTimeout(60_000);
  const legacy = JSON.stringify([{
    name: 'Antiguo',
    date: '1/1/2020',
    lastScore: null,
    questions: [{
      text: '¿Color?',
      type: 'SINGLE',
      options: [
        { id: 'A', text: 'Rojo' },
        { id: 'B', text: 'Azul' }
      ],
      correct: ['A']
    }]
  }]);
  await page.addInitScript((history) => {
    const storage = globalThis.localStorage;
    if (storage.getItem('testlab-library-seeded') === '1') return;
    storage.setItem('testlab-history', history);
    storage.setItem('testlab-library-seeded', '1');
  }, legacy);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sin clasificar' })).toBeVisible();
  await page.getByRole('button', { name: 'Empezar examen' }).click();
  await page.getByRole('button', { name: /Modo Estudio/ }).click();
  await page.locator('.option-btn', { hasText: 'Rojo' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.locator('#results-screen')).toHaveClass(/active/);
  await page.locator('#restart-btn').click();
  await expect(page.getByText('Nota: 10/10')).toBeVisible();

  await pasteBank(page, 'Alpha');
  await pasteBank(page, 'Beta');
  await page.locator('#file-input').setInputFiles('sample_exam.csv');
  await expect(page.locator('#import-errors')).toBeEmpty();
  await expect(page.getByText('5 preguntas')).toBeVisible();

  await createFolder(page, 'Fluidos');
  await page.getByRole('button', { name: 'Abrir Fluidos' }).click();
  await createFolder(page, 'Tema 3');

  await page.getByRole('button', { name: 'Repositorio' }).click();
  await page.getByRole('button', { name: 'Mover Alpha' }).click();
  const moveTest = page.getByRole('dialog', { name: 'Mover test' });
  await moveTest.getByLabel('Destino').selectOption({ label: 'Fluidos / Tema 3' });
  await moveTest.getByRole('button', { name: 'Mover' }).click();
  await expect(page.getByRole('button', { name: 'Mover Alpha' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Abrir Fluidos' }).click();
  await page.getByRole('button', { name: 'Mover carpeta Tema 3' }).click();
  const moveFolder = page.getByRole('dialog', { name: 'Mover carpeta' });
  await moveFolder.getByLabel('Destino').selectOption({ label: 'Repositorio' });
  await moveFolder.getByRole('button', { name: 'Mover' }).focus();
  await page.keyboard.press('Enter');
  await expect(moveFolder).toBeHidden();
  await page.getByRole('button', { name: 'Repositorio' }).click();
  await expect(page.getByRole('button', { name: 'Abrir Tema 3' })).toBeVisible();

  const before = await page.locator('#history-list').innerText();
  expect(before.indexOf('sample_exam')).toBeLessThan(before.indexOf('Beta'));
  const up = page.getByRole('button', { name: 'Subir Beta' });
  await up.focus();
  await page.keyboard.press('Enter');
  const after = await page.locator('#history-list').innerText();
  expect(after.indexOf('Beta')).toBeLessThan(after.indexOf('sample_exam'));

  await page.getByLabel('Ordenar por').selectOption('name');
  await expect(page.getByRole('button', { name: 'Subir Beta' })).toBeDisabled();
  await page.getByLabel('Ordenar por').selectOption('score');
  const scored = await page.locator('#history-list').innerText();
  expect(scored.indexOf('Antiguo')).toBeLessThan(scored.indexOf('Beta'));
  await page.getByLabel('Ordenar por').selectOption('manual');

  await page.getByRole('button', { name: 'Abrir Tema 3' }).click();
  await page.getByRole('button', { name: 'Empezar examen' }).click();
  await page.getByRole('button', { name: /Modo Estudio/ }).click();
  await page.locator('.option-btn', { hasText: 'Sí' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.locator('#results-screen')).toHaveClass(/active/);
  await page.locator('#restart-btn').click();
  await expect(page.locator('#history-list').getByText('Nota: 10/10')).toBeVisible();
  await expect(page.locator('#history-list').getByText('Alpha', { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Abrir Tema 3' }).click();
  await expect(page.locator('#history-list').getByText('Nota: 10/10')).toBeVisible();
  await expect(page.locator('#history-list').getByText('Alpha', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Repositorio' }).click();
  await page.getByRole('checkbox', { name: 'Seleccionar Beta' }).check();
  await page.getByRole('button', { name: 'Borrar seleccionados' }).click();
  const cancelDelete = page.getByRole('dialog', { name: 'Confirmar borrado' });
  await expect(cancelDelete).toContainText('1 exámenes');
  await cancelDelete.getByRole('button', { name: 'Cancelar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#history-list').getByText('Beta', { exact: true })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Seleccionar Beta' }).check();
  await page.getByRole('button', { name: 'Borrar seleccionados' }).click();
  await page.getByRole('dialog', { name: 'Confirmar borrado' }).getByRole('button', { name: 'Borrar' }).click();
  await expect(page.locator('#history-list').getByText('Beta', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Borrar carpeta Tema 3' }).click();
  const deleteFolder = page.getByRole('dialog', { name: 'Confirmar borrado' });
  await expect(deleteFolder).toContainText('1 carpeta');
  await expect(deleteFolder).toContainText('1 test');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Abrir Tema 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Borrar carpeta Tema 3' }).click();
  await page.getByRole('dialog', { name: 'Confirmar borrado' }).getByRole('button', { name: 'Borrar' }).click();
  await expect(page.getByRole('button', { name: 'Abrir Tema 3' })).toHaveCount(0);
  await expect(page.locator('#history-list').getByText('Alpha', { exact: true })).toHaveCount(0);

  await page.locator('article', { hasText: 'sample_exam' }).getByRole('button', { name: 'Empezar examen' }).click();
  await expect(page.getByText('5 preguntas pre-cargadas')).toBeVisible();
  await page.locator('#back-to-upload').click();

  await page.getByRole('button', { name: 'Ajustes' }).click();
  const settings = page.locator('#settings-modal');
  await expect(settings.getByText('JSON TestLab v1')).toBeVisible();
  await expect(settings.getByText('no garantiza')).toBeVisible();
  await page.getByRole('button', { name: 'Ver Prompt de IA' }).click();
  await expect(page.locator('#prompt-text')).toContainText('SHORT_ANSWER');
  await expect(page.locator('#prompt-text')).toContainText('IMAGE_BASED no es un tipo');
  await page.getByRole('button', { name: 'Copiar Prompt' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Nueva carpeta' })).toBeVisible();
  await expect(page.getByLabel('Ordenar por')).toBeVisible();
  await expect(page.getByLabel('Guardar en')).toBeVisible();
});
