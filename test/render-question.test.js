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
