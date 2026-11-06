import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Papa from 'papaparse';
import { PAPA_OPTIONS, parseCsvMatrix } from '../src/csv-bank.js';

function parseText(text) {
  const parsed = Papa.parse(text.trim(), PAPA_OPTIONS);
  assert.equal(parsed.errors.length, 0, JSON.stringify(parsed.errors));
  return parseCsvMatrix(parsed.data);
}

test('legacy sample exam keeps choice order, letters and quoted semicolons', () => {
  const text = fs.readFileSync(new URL('../sample_exam.csv', import.meta.url), 'utf8');
  const { questions, errors } = parseText(text);
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 5);
  assert.equal(questions[0].type, 'SINGLE');
  assert.deepEqual(questions[0].body.choices.map((choice) => choice.text), ['Verde', 'Rojo', 'Azul']);
  assert.deepEqual(questions[0].body.choices.map((choice) => choice.id), ['A', 'B', 'C']);
  assert.deepEqual(questions[0].body.correctIds, ['B']);
  assert.equal(questions[0].image, null);

  assert.equal(questions[1].type, 'MULTIPLE');
  assert.deepEqual(questions[1].body.correctIds, ['A', 'B', 'C', 'D']);
  assert.equal(questions[1].body.choices[0].text.includes(','), true);

  assert.equal(questions[4].body.choices.length, 5);
  assert.deepEqual(questions[4].body.correctIds, ['C']);

  const quoted = parseText('"Hay un ; dentro";SINGLE;Uno;Dos;A');
  assert.equal(quoted.questions.length, 1);
  assert.equal(quoted.questions[0].prompt, 'Hay un ; dentro');
  assert.deepEqual(quoted.questions[0].body.correctIds, ['A']);
});

test('legacy rows still skip a short line, a header and unknown types', () => {
  const { questions, errors } = parseCsvMatrix([
    ['Pregunta', 'Tipo', 'Opción A', 'Opción B', 'Respuesta'],
    ['¿Color?', 'SINGLE', 'Rojo'],
    ['¿Forma?', 'MULTI', 'Círculo', 'Cuadrado', 'A|B'],
    ['¿Libre?', 'FOO', 'Sí', 'No', 'A']
  ]);
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].type, 'MULTIPLE');
  assert.deepEqual(questions[0].body.correctIds, ['A', 'B']);
  assert.equal(questions[1].type, 'SINGLE');
  assert.equal(questions[1].prompt, '¿Libre?');
});

test('parses true/false, blanks, numeric, matching, ordering and short answers', () => {
  const { questions, errors } = parseCsvMatrix([
    ['El hielo flota', 'TRUE_FALSE', ' verdadero '],
    ['La capital de Francia es ___.', 'FILL_BLANK', 'París|Paris'],
    ['La ___ está en ___.', 'FILL_BLANK', 'capital||España|Spain'],
    ['Gravedad', 'NUMERIC', '9,81', '0,05', 'm/s^2'],
    ['¿Cuántos?', 'NUMERIC', '3', '0'],
    ['Capitales', 'MATCHING', 'Madrid=>España|Roma=>Italia'],
    ['Ciclo', 'ORDERING', 'Planificar|Ejecutar|Comprobar'],
    ['Define inercia', 'SHORT_ANSWER', 'Tendencia a conservar el movimiento']
  ]);
  assert.deepEqual(errors, []);
  assert.equal(questions[0].body.correct, true);
  assert.deepEqual(questions[1].body.blanks, [['París', 'Paris']]);
  assert.deepEqual(questions[2].body.blanks, [['capital'], ['España', 'Spain']]);
  assert.deepEqual(questions[3].body, { value: 9.81, tolerance: 0.05, unit: 'm/s^2' });
  assert.deepEqual(questions[4].body, { value: 3, tolerance: 0, unit: null });
  assert.deepEqual(questions[5].body.pairs, [
    { left: 'Madrid', right: 'España' },
    { left: 'Roma', right: 'Italia' }
  ]);
  assert.deepEqual(questions[6].body.items, ['Planificar', 'Ejecutar', 'Comprobar']);
  assert.equal(questions[7].body.modelAnswer, 'Tendencia a conservar el movimiento');
});

test('rejects malformed new rows and unsafe images without dropping valid ones', () => {
  const { questions, errors } = parseCsvMatrix([
    ['Bien', 'TRUE_FALSE', 'V'],
    ['Mal', 'TRUE_FALSE', 'quizá'],
    ['Huecos', 'FILL_BLANK', 'solo||uno'],
    ['Sin marca y dos', 'FILL_BLANK', 'a||b'],
    ['Vacío', 'FILL_BLANK', 'Paris|'],
    ['Malo', 'NUMERIC', '1', '-0,1'],
    ['Raro', 'NUMERIC', 'Infinity', '0'],
    ['Uno', 'MATCHING', 'Madrid=>España'],
    ['Dup', 'MATCHING', 'Madrid=>España|Roma=>España'],
    ['Corto', 'ORDERING', 'Solo'],
    ['Script', 'TRUE_FALSE', 'F', 'IMG=javascript:alert(1)'],
    ['Alt huérfano', 'TRUE_FALSE', 'V', 'IMG_ALT=Nada'],
    ['Color', 'SINGLE', 'Rojo', 'Azul', 'A', 'IMG=https://ejemplo.test/a.png', 'IMG_ALT=Muestra de color'],
    ['Relativa', 'SINGLE', 'Rojo', 'Azul', 'A', 'IMG=examples/figura.svg']
  ]);
  assert.equal(questions.length, 3);
  assert.equal(questions[0].type, 'TRUE_FALSE');
  assert.deepEqual(questions[1].image, {
    src: 'https://ejemplo.test/a.png',
    alt: 'Muestra de color'
  });
  assert.deepEqual(questions[2].image, {
    src: 'examples/figura.svg',
    alt: 'Relativa'
  });
  assert.ok(errors.length >= 10);
  assert.ok(errors.some((error) => error.path === 'fila 2' && /verdadero|falso|V\/F/i.test(error.message)));
  assert.ok(errors.some((error) => error.path === 'fila 11' && /esquema|imagen/i.test(error.message)));
});
