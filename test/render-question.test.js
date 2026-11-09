import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { renderQuestion } from '../src/render-question.js';

function mount() {
  const { document } = new JSDOM('<!doctype html><body><div id="root"></div></body>').window;
  return document.getElementById('root');
}

function base(type, body, extra = {}) {
  return { id: null, type, prompt: 'Enunciado', image: null, body, ...extra };
}

test('imported prompt text cannot inject an image or handler', () => {
  const root = mount();
  renderQuestion(root, base('SINGLE', {
    choices: [{ id: 'A', text: '<img src=x onerror=alert(1)>' }, { id: 'B', text: 'Bien' }],
    correctIds: ['B']
  }, { prompt: '<img src=x onerror=alert(1)>' }), [], {
    idPrefix: 'q',
    reveal: false,
    onAnswer() {}
  });
  assert.equal(root.querySelector('img'), null);
  assert.match(root.textContent, /<img src=x onerror=alert\(1\)>/);
});

test('a safe image is shown with its alternative text', () => {
  const root = mount();
  renderQuestion(root, base('TRUE_FALSE', { correct: true }, {
    prompt: '¿Flota?',
    image: { src: 'examples/figura.svg', alt: 'Esquema del hielo' }
  }), [], { idPrefix: 'q', reveal: false, onAnswer() {} });
  const image = root.querySelector('img');
  assert.equal(image.getAttribute('src'), 'examples/figura.svg');
  assert.equal(image.alt, 'Esquema del hielo');
  const trigger = root.querySelector('button.question-image-btn');
  assert.ok(trigger, 'image must be wrapped in an expandable button');
  assert.equal(trigger.getAttribute('aria-label'), 'Ampliar imagen: Esquema del hielo');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  const promptEl = root.querySelector('.question-text');
  const figureEl = root.querySelector('figure.question-figure');
  assert.ok(promptEl && figureEl);
  const children = Array.from(root.children);
  assert.ok(
    children.indexOf(promptEl) < children.indexOf(figureEl),
    'prompt must precede image in DOM order'
  );
  const radios = [...root.querySelectorAll('input[type="radio"]')];
  assert.equal(radios.length, 2);
  assert.equal(new Set(radios.map((radio) => radio.name)).size, 1);
  assert.ok(root.querySelector('label[for]'));
});

test('matching uses native selects and ordering uses move buttons', () => {
  const root = mount();
  const seen = [];
  renderQuestion(root, base('MATCHING', {
    pairs: [
      { left: 'Madrid', right: 'España' },
      { left: 'Roma', right: 'Italia' }
    ]
  }), ['', ''], {
    idPrefix: 'q',
    reveal: false,
    optionOrder: ['Italia', 'España'],
    onAnswer(next) { seen.push(next); }
  });
  const select = root.querySelector('select');
  assert.ok(select);
  assert.equal(root.querySelector('label[for]').textContent, 'Madrid');
  assert.deepEqual([...select.options].map((option) => option.value), ['', 'Italia', 'España']);
  select.value = 'España';
  select.dispatchEvent(new root.ownerDocument.defaultView.Event('change', { bubbles: true }));
  assert.deepEqual(seen.at(-1), ['España', '']);

  const orderRoot = mount();
  const orders = [];
  renderQuestion(orderRoot, base('ORDERING', {
    items: ['Planificar', 'Ejecutar', 'Comprobar']
  }), { order: ['Planificar', 'Ejecutar', 'Comprobar'], confirmed: false }, {
    idPrefix: 'ord',
    reveal: false,
    onAnswer(next) { orders.push(next); }
  });
  const down = [...orderRoot.querySelectorAll('button')].find((button) => button.textContent.includes('Bajar'));
  down.click();
  assert.equal(orders[0].confirmed, true);
  assert.deepEqual(orders[0].order, ['Ejecutar', 'Planificar', 'Comprobar']);
  assert.equal(orderRoot.querySelector('ol'), orderRoot.querySelector('ol'));
});

test('short answers show the model and never turn green from matching text', () => {
  const root = mount();
  const model = 'Conservar el movimiento';
  const updates = [];
  renderQuestion(root, base('SHORT_ANSWER', { modelAnswer: model }), {
    text: model,
    verdict: null
  }, {
    idPrefix: 'short',
    reveal: false,
    onAnswer(next) { updates.push(next); }
  });
  assert.equal(root.querySelector('.model-answer'), null);
  assert.equal(root.querySelector('.short-actions'), null);

  renderQuestion(root, base('SHORT_ANSWER', { modelAnswer: model }), {
    text: model,
    verdict: null
  }, {
    idPrefix: 'short',
    reveal: true,
    isReviewing: false,
    onAnswer(next) { updates.push(next); }
  });
  assert.match(root.textContent, /Conservar el movimiento/);
  assert.match(root.textContent, /Pendiente de autoevaluación/);
  assert.equal(root.querySelector('.is-correct'), null);
  const ok = [...root.querySelectorAll('button')].find((button) => button.textContent.includes('acertado'));
  assert.equal(ok.disabled, false);
  ok.click();
  assert.equal(updates[0].verdict, 'correct');
  assert.equal(updates[0].text, model);
});

test('review keeps a short answer visible and refuses verdict changes', () => {
  const root = mount();
  const updates = [];
  const text = 'una respuesta distinta del modelo';
  renderQuestion(root, base('SHORT_ANSWER', { modelAnswer: 'Modelo visible' }), {
    text,
    verdict: 'incorrect'
  }, {
    idPrefix: 'short',
    reveal: true,
    onAnswer(next) { updates.push(next); }
  });
  const area = root.querySelector('textarea');
  const buttons = [...root.querySelectorAll('.short-actions button')];
  const passed = buttons.find((button) => button.textContent.includes('acertado'));
  const failed = buttons.find((button) => button.textContent.includes('fallado'));
  assert.equal(area.value, text);
  assert.equal(area.readOnly, true);
  assert.equal(area.disabled, false);
  assert.match(root.textContent, /Modelo visible/);
  assert.match(root.textContent, /Marcada como incorrecta/);
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((button) => button.disabled));
  assert.equal(failed.getAttribute('aria-pressed'), 'true');
  assert.equal(passed.getAttribute('aria-pressed'), 'false');
  failed.dispatchEvent(new root.ownerDocument.defaultView.Event('click', { bubbles: true }));
  passed.dispatchEvent(new root.ownerDocument.defaultView.Event('click', { bubbles: true }));
  area.value = 'texto mutado';
  area.dispatchEvent(new root.ownerDocument.defaultView.Event('input', { bubbles: true }));
  assert.deepEqual(updates, []);
  assert.equal(area.value, text);
});

test('single and multiple choices mark the chosen option semantically', () => {
  const root = mount();
  renderQuestion(root, base('SINGLE', {
    choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }],
    correctIds: ['A']
  }), ['A'], {
    idPrefix: 'q0',
    reveal: false,
    onAnswer() {}
  });
  const list = root.querySelector('.options-list');
  assert.equal(list.getAttribute('role'), 'group');
  assert.equal(list.getAttribute('aria-labelledby'), 'q0-prompt');
  assert.equal(root.querySelector('#q0-prompt').textContent, 'Enunciado');
  const buttons = [...root.querySelectorAll('.option-btn')];
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
  assert.match(buttons[0].textContent, /✓/);
  assert.match(buttons[0].textContent, /Seleccionada/);
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'false');
  assert.doesNotMatch(buttons[1].textContent, /Seleccionada/);

  const tfRoot = mount();
  renderQuestion(tfRoot, base('TRUE_FALSE', { correct: true }), [], {
    idPrefix: 'tf',
    reveal: false,
    onAnswer() {}
  });
  assert.ok(tfRoot.querySelector('input[type="radio"]'));
  assert.equal(tfRoot.querySelector('.option-btn'), null);
});

test('revealed true-false applies correct/incorrect only to the outer item wrap and not inner label', () => {
  const root = mount();
  renderQuestion(root, base('TRUE_FALSE', { correct: true }), ['F'], {
    idPrefix: 'tf',
    reveal: true,
    onAnswer() {}
  });
  const correctWrap = root.querySelector('.true-false-item.is-correct');
  const incorrectWrap = root.querySelector('.true-false-item.is-incorrect');
  assert.ok(correctWrap, 'correct option container must have is-correct');
  assert.ok(incorrectWrap, 'incorrect option container must have is-incorrect');
  const labelsWithState = root.querySelectorAll('label.is-correct, label.is-incorrect');
  assert.equal(labelsWithState.length, 0, 'labels must not have is-correct or is-incorrect to prevent nested dark rectangles');
});

test('clicking the true-false outer container triggers answer even outside the label text', () => {
  const root = mount();
  let answered = null;
  renderQuestion(root, base('TRUE_FALSE', { correct: true }), [], {
    idPrefix: 'tf',
    reveal: false,
    onAnswer(ans) { answered = ans; }
  });
  const firstWrap = root.querySelector('.true-false-item');
  firstWrap.dispatchEvent(new root.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(answered, ['V']);

  // When revealed, clicks on outer container must not trigger onAnswer
  answered = null;
  const revealedRoot = mount();
  renderQuestion(revealedRoot, base('TRUE_FALSE', { correct: true }), ['V'], {
    idPrefix: 'tf-rev',
    reveal: true,
    onAnswer(ans) { answered = ans; }
  });
  const revWrap = revealedRoot.querySelector('.true-false-item');
  revWrap.dispatchEvent(new revealedRoot.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  assert.equal(answered, null, 'revealed question must not re-trigger onAnswer on container click');
});

test('revealed single choice shows tick on correct option and cross on chosen wrong option', () => {
  const root = mount();
  renderQuestion(root, base('SINGLE', {
    choices: [
      { id: 'A', text: 'Viscosidad dinámica' },
      { id: 'B', text: 'Tensión superficial' },
      { id: 'C', text: 'Presión de vapor' }
    ],
    correctIds: ['A']
  }), ['B'], {
    idPrefix: 'q-rev',
    reveal: true,
    onAnswer() {}
  });

  const buttons = [...root.querySelectorAll('.option-btn')];
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every((btn) => btn.disabled));

  // Option A (correct, missed by user)
  assert.ok(buttons[0].classList.contains('missed'));
  assert.ok(!buttons[0].classList.contains('selected'));
  assert.equal(buttons[0].querySelector('.checkbox-icon')?.textContent, '✓');
  assert.match(buttons[0].textContent, /Respuesta correcta/);

  // Option B (incorrect, selected by user)
  assert.ok(buttons[1].classList.contains('incorrect'));
  assert.ok(buttons[1].classList.contains('selected'));
  assert.equal(buttons[1].querySelector('.checkbox-icon')?.textContent, '✕');
  assert.doesNotMatch(buttons[1].textContent, /✓/);
  assert.match(buttons[1].textContent, /Respuesta incorrecta/);

  // Option C (unselected incorrect option in SINGLE)
  assert.ok(!buttons[2].classList.contains('correct'));
  assert.ok(!buttons[2].classList.contains('incorrect'));
  assert.ok(!buttons[2].classList.contains('missed'));
  assert.equal(buttons[2].querySelector('.checkbox-icon'), null);
});

test('revealed multiple choice shows ticks on correct options and cross on wrong selected options', () => {
  const root = mount();
  renderQuestion(root, base('MULTIPLE', {
    choices: [
      { id: 'A', text: 'Opción 1' },
      { id: 'B', text: 'Opción 2' },
      { id: 'C', text: 'Opción 3' },
      { id: 'D', text: 'Opción 4' }
    ],
    correctIds: ['A', 'C']
  }), ['A', 'B'], {
    idPrefix: 'q-rev-multi',
    reveal: true,
    onAnswer() {}
  });

  const buttons = [...root.querySelectorAll('.option-btn')];
  // A: correct & selected -> .selected.correct with '✓'
  assert.ok(buttons[0].classList.contains('correct'));
  assert.ok(buttons[0].classList.contains('selected'));
  assert.equal(buttons[0].querySelector('.checkbox-icon')?.textContent, '✓');

  // B: incorrect & selected -> .selected.incorrect with '✕'
  assert.ok(buttons[1].classList.contains('incorrect'));
  assert.ok(buttons[1].classList.contains('selected'));
  assert.equal(buttons[1].querySelector('.checkbox-icon')?.textContent, '✕');

  // C: correct & missed -> .missed with '✓'
  assert.ok(buttons[2].classList.contains('missed'));
  assert.ok(!buttons[2].classList.contains('selected'));
  assert.equal(buttons[2].querySelector('.checkbox-icon')?.textContent, '✓');

  // D: incorrect & unselected -> empty checkbox icon
  assert.equal(buttons[3].querySelector('.checkbox-icon')?.textContent, '');
});
