import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsvMatrix } from '../src/csv-bank.js';
import { gradeQuestion } from '../src/grade.js';

function question(type, body, prompt = 'Pregunta') {
  return { id: null, type, prompt, image: null, body };
}

test('grades single and multiple as an exact set, order independent', () => {
  const single = question('SINGLE', {
    choices: [{ id: 'A', text: 'Uno' }, { id: 'B', text: 'Dos' }],
    correctIds: ['B']
  });
  assert.equal(gradeQuestion(single, ['B']), 'correct');
  assert.equal(gradeQuestion(single, ['A']), 'incorrect');
  assert.equal(gradeQuestion(single, []), 'skipped');
  assert.equal(gradeQuestion(single, 'SKIPPED'), 'skipped');

  const multiple = question('MULTIPLE', {
    choices: [],
    correctIds: ['A', 'C']
  });
  assert.equal(gradeQuestion(multiple, ['C', 'A']), 'correct');
  assert.equal(gradeQuestion(multiple, ['A']), 'incorrect');
  assert.equal(gradeQuestion(multiple, ['A', 'A']), 'incorrect');
});

test('grades true/false, blanks, numbers, pairs and order from parsed rows', () => {
  const { questions } = parseCsvMatrix([
    ['Flota', 'TRUE_FALSE', 'F'],
    ['La capital es ___.', 'FILL_BLANK', 'París|Paris'],
    ['___ y ___.', 'FILL_BLANK', 'uno||dos'],
    ['g', 'NUMERIC', '9,81', '0,05', 'm/s^2'],
    ['n', 'NUMERIC', '3', '0'],
    ['Mapa', 'MATCHING', 'Madrid=>España|Roma=>Italia'],
    ['Pasos', 'ORDERING', 'Planificar|Ejecutar|Comprobar']
  ]);
  const [tf, one, two, gravity, count, matching, ordering] = questions;

  assert.equal(gradeQuestion(tf, ['F']), 'correct');
  assert.equal(gradeQuestion(tf, ['V']), 'incorrect');

  assert.equal(gradeQuestion(one, ['  paris ']), 'correct');
  assert.equal(gradeQuestion(one, ['Lyon']), 'incorrect');
  assert.equal(gradeQuestion(one, ['']), 'skipped');

  assert.equal(gradeQuestion(two, ['UNO', 'dos']), 'correct');
  assert.equal(gradeQuestion(two, ['uno', '']), 'incorrect');
  assert.equal(gradeQuestion(two, ['', '']), 'skipped');

  assert.equal(gradeQuestion(gravity, { value: '9.81', unit: 'm/s²' }), 'correct');
  assert.equal(gradeQuestion(gravity, { value: '9,90', unit: 'm/s^2' }), 'incorrect');
  assert.equal(gradeQuestion(gravity, { value: '9,81', unit: '' }), 'incorrect');
  assert.equal(gradeQuestion(gravity, { value: '', unit: 'm/s^2' }), 'skipped');

  assert.equal(gradeQuestion(count, { value: '3', unit: 'kg' }), 'correct');
  assert.equal(gradeQuestion(count, { value: '3.0000000000000004', unit: '' }), 'correct');

  assert.equal(gradeQuestion(matching, ['España', 'Italia']), 'correct');
  assert.equal(gradeQuestion(matching, ['Italia', 'España']), 'incorrect');
  assert.equal(gradeQuestion(matching, ['España', '']), 'incorrect');
  assert.equal(gradeQuestion(matching, ['', '']), 'skipped');

  const items = ['Planificar', 'Ejecutar', 'Comprobar'];
  assert.equal(gradeQuestion(ordering, { order: items, confirmed: true }), 'correct');
  assert.equal(gradeQuestion(ordering, { order: [...items].reverse(), confirmed: true }), 'incorrect');
  assert.equal(gradeQuestion(ordering, { order: items, confirmed: false }), 'skipped');
});

test('short answers are never graded by comparing words', () => {
  const { questions } = parseCsvMatrix([
    ['Define inercia', 'SHORT_ANSWER', 'Tendencia a conservar el movimiento']
  ]);
  const question = questions[0];
  const model = question.body.modelAnswer;
  assert.equal(gradeQuestion(question, { text: model, verdict: null }), 'pending');
  assert.equal(gradeQuestion(question, { text: model, verdict: 'incorrect' }), 'incorrect');
  assert.equal(gradeQuestion(question, { text: 'otra respuesta', verdict: 'correct' }), 'correct');
  assert.equal(gradeQuestion(question, { text: '   ', verdict: 'correct' }), 'skipped');
  assert.equal(gradeQuestion(question, { text: '', verdict: null }), 'skipped');
});
