import { expect, test } from '@playwright/test';

function sampleBank(title = 'Banco UX') {
  return JSON.stringify({
    schemaVersion: 1,
    title,
    questions: [
      {
        type: 'SINGLE',
        prompt: '¿Cuál es la velocidad de la luz?',
        choices: [
          { id: 'A', text: '300.000 km/s' },
          { id: 'B', text: '150.000 km/s' }
        ],
        answer: 'A'
      },
      {
        type: 'TRUE_FALSE',
        prompt: 'El agua hierve a 100°C a nivel del mar',
        answer: true
      },
      {
        type: 'SINGLE',
        prompt: 'Capital de Portugal',
        choices: [
          { id: 'A', text: 'Lisboa' },
          { id: 'B', text: 'Oporto' }
        ],
        answer: 'A'
      }
    ]
  });
}

async function openImportDialog(page) {
  const opener = page.locator('#import-btn');
  if (await opener.isVisible()) await opener.click();
  else await page.locator('#empty-import').click();
}

test('quick launch buttons directly start study and exam modes without intermediate screen', async ({ page }) => {
  await page.goto('/');
  await openImportDialog(page);
  await page.locator('#paste-input').fill(sampleBank('Banco Rápido'));
  await page.getByRole('button', { name: 'Añadir texto' }).click();

  // Test direct study launch
  await page.getByRole('button', { name: 'Estudiar Banco Rápido' }).click();
  await expect(page.locator('#exam-screen')).toBeVisible();
  await expect(page.locator('#exam-mode-badge')).toHaveText('Modo Estudio');
  await page.locator('#quit-btn').click();
  await expect(page.locator('#upload-screen')).toBeVisible();

  // Test direct exam launch
  await page.getByRole('button', { name: 'Examinar Banco Rápido' }).click();
  await expect(page.locator('#exam-screen')).toBeVisible();
  await expect(page.locator('#exam-mode-badge')).toHaveText('Modo Examen');
});

test('interactive question map and keyboard shortcuts allow navigation and instant answering', async ({ page }) => {
  await page.goto('/');
  await openImportDialog(page);
  await page.locator('#paste-input').fill(sampleBank('Banco Teclado'));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Estudiar Banco Teclado' }).click();

  // Question map is visible
  const questionMap = page.locator('#question-map');
  await expect(questionMap).toBeVisible();
  const pills = questionMap.locator('.question-pill');
  await expect(pills).toHaveCount(3);
  await expect(pills.first()).toHaveClass(/pill-current/);

  // Press '1' or 'A' to answer single choice
  await page.keyboard.press('1');
  const optionA = page.locator('.option-btn', { hasText: '300.000 km/s' });
  await expect(optionA).toHaveClass(/selected/);
  await expect(optionA).toHaveClass(/correct/);
  await expect(pills.first()).toHaveClass(/pill-correct/);

  // Navigate using right arrow
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('2 / 3')).toBeVisible();
  await expect(pills.nth(1)).toHaveClass(/pill-current/);

  // Press 'V' to select Verdadero
  await page.keyboard.press('v');
  const tfVerdadero = page.getByLabel('Verdadero');
  await expect(tfVerdadero).toBeChecked();
  await expect(pills.nth(1)).toHaveClass(/pill-correct/);

  // Click on pill 1 to jump back to question 1
  await pills.first().click();
  await expect(page.getByText('1 / 3')).toBeVisible();
  await expect(pills.first()).toHaveClass(/pill-current/);
});

test('results screen displays instant results and breakdown items that open review', async ({ page }) => {
  await page.goto('/');
  await openImportDialog(page);
  await page.locator('#paste-input').fill(sampleBank('Banco Resultados'));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Examinar Banco Resultados' }).click();

  // Answer Q1 with '1' (300.000 km/s) -> automatically advances in exam mode
  await page.keyboard.press('1');
  await expect(page.getByText('2 / 3')).toBeVisible();

  // Answer Q2 with 'F' (Falso)
  await page.keyboard.press('f');
  // Use Enter key to advance to next question
  await page.keyboard.press('Enter');
  await expect(page.getByText('3 / 3')).toBeVisible();

  // Answer Q3 with '1' (Lisboa) -> auto finish ready
  await page.keyboard.press('1');
  // Use Enter key to submit exam
  await page.keyboard.press('Enter');

  // Results screen is shown instantly (no artificial loading freeze)
  await expect(page.locator('#results-screen')).toBeVisible();
  await expect(page.locator('#final-score')).toBeVisible();

  // Breakdown is rendered
  const breakdown = page.locator('#results-breakdown');
  await expect(breakdown).toBeVisible();
  const rows = breakdown.locator('.breakdown-row');
  await expect(rows).toHaveCount(3);

  // Clicking row #2 jumps directly to question 2 in review
  await rows.nth(1).click();
  await expect(page.locator('#exam-screen')).toBeVisible();
  await expect(page.locator('#exam-mode-badge')).toHaveText('Revisión');
  await expect(page.getByText('2 / 3')).toBeVisible();
});

test('short answer hides model answer until answered, numeric omits unit input, and ordering has arrows', async ({ page }) => {
  const customBank = JSON.stringify({
    schemaVersion: 1,
    title: 'Banco Mejoras Interfaz',
    questions: [
      {
        type: 'SHORT_ANSWER',
        prompt: '¿Qué es un closure?',
        modelAnswer: 'Función con acceso al ámbito de su función externa.'
      },
      {
        type: 'NUMERIC',
        prompt: 'Velocidad del sonido en m/s a 20°C',
        answer: { value: 343, tolerance: 2, unit: 'm/s' }
      },
      {
        type: 'ORDERING',
        prompt: 'Ordena la secuencia',
        items: ['Primero', 'Segundo', 'Tercero']
      }
    ]
  });

  await page.goto('/');
  await openImportDialog(page);
  await page.locator('#paste-input').fill(customBank);
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Estudiar Banco Mejoras Interfaz' }).click();

  // 1. SHORT_ANSWER: model answer is hidden before user types
  const area = page.getByLabel('Tu respuesta');
  await expect(page.getByText('Función con acceso al ámbito')).toBeHidden();
  await expect(page.getByRole('button', { name: 'La he acertado' })).toBeHidden();

  // Type answer -> model answer is STILL hidden until clicking Comprobar
  await area.click();
  await area.fill('Una función que recuerda su léxico');
  await expect(page.getByText('Función con acceso al ámbito')).toBeHidden();
  await expect(page.getByRole('button', { name: 'La he acertado' })).toBeHidden();

  // Click Comprobar -> NOW model answer and verdict buttons become visible
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByText('Función con acceso al ámbito')).toBeVisible();
  await expect(page.getByRole('button', { name: 'La he acertado' })).toBeVisible();
  await page.getByRole('button', { name: 'La he acertado' }).click();
  await expect(page.locator('.answer-status')).toHaveText('Marcada como correcta');

  // Advance to NUMERIC
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('2 / 3')).toBeVisible();

  // 2. NUMERIC: only value input exists, unit is a static badge
  const numInput = page.getByLabel('Valor');
  await expect(numInput).toBeVisible();
  await expect(page.locator('.numeric-unit-badge')).toHaveText('m/s');
  // No editable unit input exists
  await expect(page.getByLabel(/^Unidad/)).toHaveCount(0);

  await numInput.fill('343');
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.locator('.answer-status')).toHaveText('Respuesta correcta');

  // Advance to ORDERING
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('3 / 3')).toBeVisible();

  // 3. ORDERING: move buttons display arrows and have aria-label, items are draggable, and no "Confirmar este orden" button
  const items = page.locator('.ordering-item');
  await expect(items).toHaveCount(3);
  await expect(items.first()).toHaveAttribute('draggable', 'true');
  const upButtons = page.getByRole('button', { name: /^Subir / });
  const downButtons = page.getByRole('button', { name: /^Bajar / });
  await expect(upButtons.first()).toContainText('↑');
  await expect(downButtons.first()).toContainText('↓');
  await expect(page.getByRole('button', { name: 'Confirmar este orden' })).toHaveCount(0);
});

test('study mode reveals correct answer with checkmark and incorrect selection with cross', async ({ page }) => {
  await page.goto('/');
  const opener = page.locator('#import-btn');
  if (await opener.isVisible()) await opener.click();
  else await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(sampleBank('Banco Reveal Check'));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Estudiar Banco Reveal Check' }).click();
  await expect(page.locator('#exam-screen')).toBeVisible();

  // Option A is "300.000 km/s" (correct). Option B is "150.000 km/s" (incorrect).
  // Click Option B (incorrect answer)
  const optionB = page.locator('.option-btn', { hasText: '150.000 km/s' });
  await optionB.click();

  // Option B is marked incorrect and shows cross icon ✕
  await expect(optionB).toHaveClass(/incorrect/);
  await expect(optionB.locator('.checkbox-icon')).toHaveText('✕');

  // Option A is marked missed (the actual correct answer) and shows checkmark icon ✓
  const optionA = page.locator('.option-btn', { hasText: '300.000 km/s' });
  await expect(optionA).toHaveClass(/missed/);
  await expect(optionA.locator('.checkbox-icon')).toHaveText('✓');
});
