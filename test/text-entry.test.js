import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { renderQuestion } from '../src/render-question.js';

function question(type, extra) {
  return { id: null, type, prompt: extra.prompt, image: null, body: extra.body };
}

function mount(initialQuestion, initialAnswer) {
  const { window } = new JSDOM('<!doctype html><body><div id="root"></div></body>');
  const root = window.document.getElementById('root');
  let answer = initialAnswer;
  const ctx = {
    idPrefix: 'q0',
    reveal: false,
    onAnswer(next) {
      answer = next;
      renderQuestion(root, initialQuestion, answer, ctx);
    }
  };
  renderQuestion(root, initialQuestion, answer, ctx);
  return {
    window,
    root,
    get answer() {
      return answer;
    },
    rerender(next, overrides = {}) {
      answer = next;
      renderQuestion(root, initialQuestion, answer, { ...ctx, ...overrides });
    }
  };
}

function type(session, chars) {
  const { window, root } = session;
  for (const ch of chars) {
    const field = window.document.activeElement;
    assert.ok(
      field && root.contains(field) && (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA'),
      `focus lost before typing ${JSON.stringify(ch)}`
    );
    const start = field.selectionStart;
    const end = field.selectionEnd;
    field.value = `${field.value.slice(0, start)}${ch}${field.value.slice(end)}`;
    field.setSelectionRange(start + ch.length, start + ch.length);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
}

function placeCaret(session, selector, start, end = start) {
  const field = session.root.querySelector(selector);
  field.focus();
  field.setSelectionRange(start, end);
  return field;
}

test('second blank keeps focus, caret and the other blank while typing', () => {
  const session = mount(question('FILL_BLANK', {
    prompt: 'La ___ limita con ___.',
    body: { blanks: [['Francia'], ['España']] }
  }), ['', '']);
  placeCaret(session, '#q0-blank-1', 0);
  type(session, 'Es');
  placeCaret(session, '#q0-blank-1', 1);
  type(session, 'X');

  const blank = session.root.querySelector('#q0-blank-1');
  assert.equal(session.window.document.activeElement, blank);
  assert.equal(blank.value, 'EXs');
  assert.equal(blank.selectionStart, 2);
  assert.equal(blank.selectionEnd, 2);

  blank.setSelectionRange(0, 2);
  type(session, 'Pa');
  const replaced = session.root.querySelector('#q0-blank-1');
  assert.equal(session.window.document.activeElement, replaced);
  assert.equal(replaced.value, 'Pas');
  assert.equal(replaced.selectionStart, 2);
  assert.equal(replaced.selectionEnd, 2);

  placeCaret(session, '#q0-blank-0', 0);
  type(session, 'Francia');
  assert.deepEqual(
    [...session.root.querySelectorAll('.blank-input')].map((input) => input.value),
    ['Francia', 'Pas']
  );
  assert.deepEqual(session.answer, ['Francia', 'Pas']);
  assert.equal(session.window.document.activeElement, session.root.querySelector('#q0-blank-0'));
  assert.equal(session.root.querySelector('#q0-blank-0').selectionStart, 'Francia'.length);
});

test('numeric value keeps focus and caret while typing, and unit is displayed statically', () => {
  const session = mount(question('NUMERIC', {
    prompt: 'Gravedad',
    body: { value: 9.81, tolerance: 0.05, unit: 'm/s^2' }
  }), { value: '', unit: '' });

  assert.equal(session.root.querySelector('.numeric-unit-badge').textContent, 'm/s^2');
  assert.equal(session.root.querySelector('#q0-unit'), null);

  placeCaret(session, '#q0-value', 0);
  type(session, '9,81');
  placeCaret(session, '#q0-value', 1);
  type(session, 'Q');
  const value = session.root.querySelector('#q0-value');
  assert.equal(session.window.document.activeElement, value);
  assert.equal(value.value, '9Q,81');
  assert.equal(value.selectionStart, 2);
  assert.equal(value.selectionEnd, 2);
  assert.deepEqual(session.answer, { value: '9Q,81', unit: 'm/s^2' });
});

test('short answer keeps focus and a caret inside the existing text', () => {
  const session = mount(question('SHORT_ANSWER', {
    prompt: 'Define inercia',
    body: { modelAnswer: 'Tendencia a conservar el movimiento' }
  }), { text: '', verdict: null });

  const area = placeCaret(session, '#q0-short', 0);
  type(session, 'abcd');
  area.setSelectionRange(2, 2);
  type(session, 'X');
  const live = session.root.querySelector('#q0-short');
  assert.equal(session.window.document.activeElement, live);
  assert.equal(live.value, 'abXcd');
  assert.equal(live.selectionStart, 3);
  assert.equal(live.selectionEnd, 3);

  live.setSelectionRange(1, 4);
  type(session, 'Z');
  const selected = session.root.querySelector('#q0-short');
  assert.equal(session.window.document.activeElement, selected);
  assert.equal(selected.value, 'aZd');
  assert.equal(selected.selectionStart, 2);
  assert.equal(selected.selectionEnd, 2);

  selected.setSelectionRange(0, selected.value.length);
  selected.value = 'texto pegado';
  selected.setSelectionRange('texto pegado'.length, 'texto pegado'.length);
  selected.dispatchEvent(new session.window.Event('input', { bubbles: true }));
  const pasted = session.root.querySelector('#q0-short');
  assert.equal(session.window.document.activeElement, pasted);
  assert.equal(pasted.value, 'texto pegado');
  assert.equal(pasted.selectionStart, 'texto pegado'.length);
  assert.equal(session.answer.text, 'texto pegado');
  assert.equal(session.answer.verdict, null);
  assert.equal(session.root.querySelector('.model-answer'), null);

  session.rerender({ text: 'texto pegado', verdict: null }, { reveal: true, isReviewing: false });
  assert.match(session.root.textContent, /Tendencia a conservar el movimiento/);

  const correct = [...session.root.querySelectorAll('button')].find((button) => button.textContent.includes('acertado'));
  correct.click();
  assert.equal(session.answer.text, 'texto pegado');
  assert.equal(session.answer.verdict, 'correct');
  assert.equal(session.root.querySelector('#q0-short').value, 'texto pegado');
  assert.match(session.root.textContent, /Marcada como correcta/);
});

test('revealing a text question still disables the fields', () => {
  const session = mount(question('FILL_BLANK', {
    prompt: 'La ___ limita con ___.',
    body: { blanks: [['Francia'], ['España']] }
  }), ['Francia', 'España']);
  session.rerender(['Francia', 'España'], { reveal: true });
  const inputs = [...session.root.querySelectorAll('.blank-input')];
  assert.equal(inputs.length, 2);
  assert.ok(inputs.every((input) => input.disabled));
  assert.deepEqual(inputs.map((input) => input.value), ['Francia', 'España']);
});
