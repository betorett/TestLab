import assert from 'node:assert/strict';
import test from 'node:test';
import { canAdvance, countsAsAnswered, isReadyToCheck, shuffleItems } from '../src/session.js';

const single = {
  type: 'SINGLE',
  body: { choices: [], correctIds: ['A'] }
};
const short = { type: 'SHORT_ANSWER', body: { modelAnswer: 'Modelo' } };
const ordering = { type: 'ORDERING', body: { items: ['Planificar', 'Ejecutar', 'Comprobar'] } };

test('study mode holds short answers until a manual verdict and exams can move on', () => {
  const pending = { text: 'Modelo', verdict: null };
  assert.equal(canAdvance({ question: short, answer: pending, mode: 'study', reviewing: false, checked: false }), false);
  assert.equal(canAdvance({ question: short, answer: pending, mode: 'exam', reviewing: false, checked: false }), true);
  assert.equal(canAdvance({
    question: short,
    answer: { text: 'Modelo', verdict: 'incorrect' },
    mode: 'study',
    reviewing: false,
    checked: false
  }), true);
  assert.equal(canAdvance({ question: single, answer: ['A'], mode: 'study', reviewing: false, checked: false }), true);
  assert.equal(canAdvance({ question: single, answer: [], mode: 'study', reviewing: false, checked: false }), false);
});

test('ordering stays skipped until confirmed, and shuffle is deterministic for a fixed rng', () => {
  const unconfirmed = { order: ['Planificar', 'Ejecutar', 'Comprobar'], confirmed: false };
  assert.equal(canAdvance({ question: ordering, answer: unconfirmed, mode: 'study', reviewing: false, checked: false }), false);
  assert.equal(canAdvance({
    question: ordering,
    answer: { ...unconfirmed, confirmed: true },
    mode: 'study',
    reviewing: false,
    checked: true
  }), true);
  assert.deepEqual(shuffleItems(['Planificar', 'Ejecutar', 'Comprobar'], () => 0), ['Ejecutar', 'Comprobar', 'Planificar']);
  assert.equal(canAdvance({
    question: ordering,
    answer: unconfirmed,
    mode: 'study',
    reviewing: false,
    checked: true
  }), false);
  assert.equal(countsAsAnswered(short, { text: 'Modelo', verdict: null }), true);
  assert.equal(countsAsAnswered(single, []), false);
  assert.equal(isReadyToCheck(ordering, unconfirmed), false);
  assert.equal(isReadyToCheck(ordering, { ...unconfirmed, confirmed: true }), true);
});
