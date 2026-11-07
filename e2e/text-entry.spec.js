import { expect, test } from '@playwright/test';

const bank = {
  schemaVersion: 1,
  title: 'Entrada de texto',
  questions: [
    {
      type: 'FILL_BLANK',
      prompt: 'La ___ limita con ___.',
      blanks: [['Francia'], ['España']]
    },
    {
      type: 'NUMERIC',
      prompt: 'Gravedad estándar',
      answer: { value: 9.81, tolerance: 0.05, unit: 'm/s^2' }
    },
    {
      type: 'SHORT_ANSWER',
      prompt: '¿Qué es la inercia?',
      modelAnswer: 'Tendencia a conservar el movimiento'
    },
    {
      type: 'SINGLE',
      prompt: '¿Qué capital está marcada?',
      choices: [
        { id: 'A', text: 'Lisboa' },
        { id: 'B', text: 'Madrid' }
      ],
      answer: 'B'
    },
    {
      type: 'MATCHING',
      prompt: 'Empareja cada capital',
      pairs: [
        { left: 'Madrid', right: 'España' },
        { left: 'Roma', right: 'Italia' }
      ]
    },
    {
      type: 'ORDERING',
      prompt: 'Orden del ciclo',
      items: ['Planificar', 'Ejecutar', 'Comprobar']
    }
  ]
};

async function openBank(page, mode) {
  await page.goto('/');
  const opener = page.locator('#import-btn');
  if (await opener.isVisible()) await opener.click();
  else await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(JSON.stringify(bank));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.locator('#import-errors')).toBeEmpty();
  await page.getByRole('button', { name: 'Empezar Entrada de texto' }).click();
  await page.getByRole('button', { name: mode === 'study' ? /Modo Estudio/ : /Modo Examen/ }).click();
}

async function caret(locator) {
  return locator.evaluate((element) => ({
    start: element.selectionStart,
    end: element.selectionEnd
  }));
}

async function expectCaret(locator, start, end = start) {
  await expect(locator).toBeFocused();
  expect(await caret(locator)).toEqual({ start, end });
}

async function typeAt(locator, start, end, text) {
  await locator.evaluate((element, range) => {
    element.focus();
    element.setSelectionRange(range.start, range.end);
  }, { start, end });
  await locator.pressSequentially(text, { delay: 15 });
}

test('study typing keeps focus, caret, earlier blanks, paste and grading', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openBank(page, 'study');

  const blank2 = page.getByLabel('Hueco 2');
  await blank2.click();
  await blank2.pressSequentially('España', { delay: 15 });
  await expect(blank2).toHaveValue('España');
  await expectCaret(blank2, 'España'.length);

  await typeAt(blank2, 2, 2, 'X');
  await expect(blank2).toHaveValue('EsXpaña');
  await expectCaret(blank2, 3);

  await typeAt(blank2, 1, 3, 'Q');
  await expect(blank2).toHaveValue('EQpaña');
  await expectCaret(blank2, 2);

  const blank1 = page.getByLabel('Hueco 1');
  await blank1.click();
  await blank1.pressSequentially('zz', { delay: 15 });
  await expect(blank2).toHaveValue('EQpaña');
  await expect(blank1).toBeFocused();

  await page.evaluate(async () => {
    await navigator.clipboard.writeText('Francia');
  });
  await blank1.press('Control+A');
  await blank1.press('Control+V');
  await expect(blank1).toHaveValue('Francia');
  await expect(blank1).toBeFocused();
  await expect(blank2).toHaveValue('EQpaña');
  await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeHidden();

  await blank2.fill('España');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.locator('.answer-status')).toHaveText('Respuesta correcta');
  await expect(blank1).toBeDisabled();
  await expect(blank2).toBeDisabled();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  const value = page.getByLabel('Valor', { exact: true });
  await expect(page.locator('.numeric-unit-badge')).toHaveText('m/s^2');
  await value.click();
  await value.pressSequentially('9,81', { delay: 15 });
  await expect(value).toHaveValue('9,81');
  await expectCaret(value, 4);
  await typeAt(value, 1, 1, '0');
  await expect(value).toHaveValue('90,81');
  await expectCaret(value, 2);
  await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeEnabled();

  await value.fill('9,81');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.locator('.answer-status')).toHaveText('Respuesta correcta');
  await expect(value).toBeDisabled();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  const area = page.getByLabel('Tu respuesta');
  await expect(page.getByText('Tendencia a conservar el movimiento')).toBeHidden();
  await expect(page.getByRole('button', { name: 'La he acertado' })).toBeHidden();
  await area.click();
  await area.pressSequentially('abcd', { delay: 15 });
  await expect(page.getByText('Tendencia a conservar el movimiento')).toBeVisible();
  await expect(page.getByRole('button', { name: 'La he acertado' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'La he fallado' })).toBeEnabled();
  await expect(area).toHaveValue('abcd');
  await expectCaret(area, 4);
  await typeAt(area, 2, 2, 'XY');
  await expect(area).toHaveValue('abXYcd');
  await expectCaret(area, 4);
  await typeAt(area, 1, 4, 'Z');
  await expect(area).toHaveValue('aZcd');
  await expectCaret(area, 2);

  await page.evaluate(async () => {
    await navigator.clipboard.writeText('una respuesta distinta');
  });
  await area.press('Control+A');
  await area.press('Control+V');
  await expect(area).toHaveValue('una respuesta distinta');
  await expect(area).toBeFocused();
  await expect(page.locator('.answer-status')).toContainText('Pendiente de autoevaluación');
  await expect(page.locator('.is-correct')).toHaveCount(0);

  await page.getByRole('button', { name: 'La he fallado' }).click();
  await expect(page.locator('.answer-status')).toHaveText('Marcada como incorrecta');
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByLabel('Valor', { exact: true })).toHaveValue('9,81');
  await expect(page.locator('.numeric-unit-badge')).toHaveText('m/s^2');
  await expect(page.getByLabel('Valor', { exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeHidden();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.locator('.answer-status')).toHaveText('Respuesta correcta');
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByLabel('Hueco 1')).toHaveValue('Francia');
  await expect(page.getByLabel('Hueco 2')).toHaveValue('España');
  await expect(page.getByLabel('Hueco 1')).toBeEnabled();
});

test('exam typing keeps answers while moving between questions', async ({ page }) => {
  await openBank(page, 'exam');

  const blank2 = page.getByLabel('Hueco 2');
  await blank2.click();
  await blank2.pressSequentially('España', { delay: 15 });
  await expectCaret(blank2, 'España'.length);
  const blank1 = page.getByLabel('Hueco 1');
  await blank1.click();
  await blank1.pressSequentially('Francia', { delay: 15 });
  await expect(blank2).toHaveValue('España');
  await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  const value = page.getByLabel('Valor', { exact: true });
  await expect(page.locator('.numeric-unit-badge')).toHaveText('m/s^2');
  await value.click();
  await value.pressSequentially('1234', { delay: 15 });
  await typeAt(value, 1, 3, 'X');
  await expect(value).toHaveValue('1X4');
  await expectCaret(value, 2);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  const area = page.getByLabel('Tu respuesta');
  await area.click();
  await area.pressSequentially('respuesta de examen', { delay: 10 });
  await typeAt(area, 'respuesta'.length, 'respuesta'.length, ' larga');
  await expect(area).toHaveValue('respuesta larga de examen');
  await expectCaret(area, 'respuesta larga'.length);
  await page.getByRole('button', { name: 'La he acertado' }).click();
  await expect(page.locator('.answer-status')).toHaveText('Marcada como correcta');

  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByLabel('Valor', { exact: true })).toHaveValue('1X4');
  await expect(page.locator('.numeric-unit-badge')).toHaveText('m/s^2');
  await expect(page.getByLabel('Valor', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByLabel('Hueco 1')).toHaveValue('Francia');
  await expect(page.getByLabel('Hueco 2')).toHaveValue('España');
  await expect(page.getByLabel('Hueco 2')).toBeEnabled();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByLabel('Tu respuesta')).toHaveValue('respuesta larga de examen');
  await expect(page.locator('.answer-status')).toHaveText('Marcada como correcta');
});

test('single, matching and ordering controls stay usable during the exam', async ({ page }) => {
  await openBank(page, 'exam');
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }

  await page.locator('.option-btn', { hasText: 'Madrid' }).click();
  await expect(page.locator('.option-btn', { hasText: 'Madrid' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByLabel('Madrid')).toBeEnabled();
  await expect(page.getByLabel('Roma')).toBeEnabled();
  await page.getByLabel('Madrid').selectOption('España');
  await page.getByLabel('Roma').selectOption('Italia');
  await expect(page.getByLabel('Madrid')).toHaveValue('España');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  const downButtons = page.getByRole('button', { name: /^Bajar / });
  const count = await downButtons.count();
  let moved = false;
  for (let index = 0; index < count; index += 1) {
    const button = downButtons.nth(index);
    if (await button.isEnabled()) {
      await button.click();
      moved = true;
      break;
    }
  }
  expect(moved).toBe(true);
  await expect(page.getByRole('button', { name: 'Confirmar este orden' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirmar este orden' }).click();
  await expect(page.locator('.ordering-list')).toContainText('Ejecutar');
});

test('review keeps the short answer and score when verdict buttons are pressed', async ({ page }) => {
  const reviewBank = {
    schemaVersion: 1,
    title: 'Revisión corta',
    questions: [
      {
        type: 'SHORT_ANSWER',
        prompt: '¿Qué es la inercia?',
        modelAnswer: 'Tendencia a conservar el movimiento'
      },
      {
        type: 'FILL_BLANK',
        prompt: 'La capital es ___.',
        blanks: [['París', 'Paris']]
      }
    ]
  };
  await page.goto('/');
  const opener = page.locator('#import-btn');
  if (await opener.isVisible()) await opener.click();
  else await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(JSON.stringify(reviewBank));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.locator('#import-errors')).toBeEmpty();
  await page.getByRole('button', { name: 'Empezar Revisión corta' }).click();
  await page.getByRole('button', { name: /Modo Examen/ }).click();

  const area = page.getByLabel('Tu respuesta');
  await area.click();
  await area.pressSequentially('texto guardado', { delay: 10 });
  await expect(page.getByRole('button', { name: 'La he acertado' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'La he fallado' })).toBeEnabled();
  await page.getByRole('button', { name: 'La he acertado' }).click();
  await expect(page.locator('.answer-status')).toHaveText('Marcada como correcta');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Hueco 1').pressSequentially('Paris', { delay: 10 });
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.locator('#results-screen')).toHaveClass(/active/);
  const score = await page.locator('#final-score').innerText();
  const detail = await page.locator('#score-detail').innerText();

  await page.getByRole('button', { name: 'Ver detalles' }).click();
  await expect(page.getByText('Tendencia a conservar el movimiento')).toBeVisible();
  await expect(page.locator('.answer-status')).toHaveText('Marcada como correcta');
  await expect(area).toHaveValue('texto guardado');
  await expect(area).toHaveJSProperty('readOnly', true);
  const correct = page.getByRole('button', { name: 'La he acertado' });
  const incorrect = page.getByRole('button', { name: 'La he fallado' });
  await expect(correct).toBeDisabled();
  await expect(incorrect).toBeDisabled();
  await expect(correct).toHaveAttribute('aria-pressed', 'true');

  await area.focus();
  await page.keyboard.type('MUTACION');
  await expect(area).toHaveValue('texto guardado');
  await incorrect.evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    button.dispatchEvent(new view.MouseEvent('click', { bubbles: true }));
  });
  await correct.evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    button.dispatchEvent(new view.MouseEvent('click', { bubbles: true }));
  });
  await expect(page.locator('.answer-status')).toHaveText('Marcada como correcta');
  await expect(area).toHaveValue('texto guardado');
  await expect(correct).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Siguiente' }).click();
  const blank = page.getByLabel('Hueco 1');
  await expect(blank).toHaveValue('Paris');
  await expect(blank).toBeDisabled();
  await blank.focus();
  await page.keyboard.type('Roma');
  await expect(blank).toHaveValue('Paris');
  await page.getByRole('button', { name: 'Volver a resultados' }).click();
  await expect(page.locator('#final-score')).toHaveText(score);
  await expect(page.locator('#score-detail')).toHaveText(detail);
});
