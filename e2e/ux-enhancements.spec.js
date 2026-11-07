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

test('quick launch buttons directly start study and exam modes without intermediate screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#empty-import').click();
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
  await page.locator('#empty-import').click();
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
  await page.locator('#empty-import').click();
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
