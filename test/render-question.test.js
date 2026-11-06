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
    reveal: true,
    onAnswer(next) { updates.push(next); }
  });
  assert.match(root.textContent, /Conservar el movimiento/);
  assert.match(root.textContent, /Pendiente de autoevaluación/);
  assert.equal(root.querySelector('.is-correct'), null);
  const ok = [...root.querySelectorAll('button')].find((button) => button.textContent.includes('acertado'));
  ok.click();
  assert.equal(updates[0].verdict, 'correct');
  assert.equal(updates[0].text, model);
});
