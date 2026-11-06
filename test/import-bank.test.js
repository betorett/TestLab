import assert from 'node:assert/strict';
import test from 'node:test';
import Papa from 'papaparse';
import { importBankText } from '../src/import-bank.js';

test('paste detects JSON, while file extensions win', () => {
  const json = JSON.stringify({
    schemaVersion: 1,
    title: 'Pegado',
    questions: [{
      type: 'TRUE_FALSE',
      prompt: '¿Flota el hielo?',
      answer: true
    }]
  });
  const pasted = importBankText(json, '', Papa);
  assert.equal(pasted.format, 'json');
  assert.equal(pasted.title, 'Pegado');
  assert.equal(pasted.questions[0].body.correct, true);

  const brokenPaste = importBankText('{', '', Papa);
  assert.equal(brokenPaste.format, 'json');
  assert.equal(brokenPaste.questions.length, 0);
  assert.match(brokenPaste.errors[0].message, /JSON inválido/);

  const csvNamed = importBankText('{esto no es json', 'banco.csv', Papa);
  assert.equal(csvNamed.format, 'csv');
  assert.equal(csvNamed.questions.length, 0);
  assert.equal(csvNamed.errors.length, 0);

  const jsonNamed = importBankText('¿Color?;SINGLE;Rojo;Azul;A', 'banco.json', Papa);
  assert.equal(jsonNamed.format, 'json');
  assert.equal(jsonNamed.questions.length, 0);
  assert.match(jsonNamed.errors[0].message, /JSON inválido/);
});

test('a legacy CSV paste still loads the original choice question', () => {
  const result = importBankText('¿Color?;SINGLE;Rojo;Azul;A', '', Papa);
  assert.equal(result.format, 'csv');
  assert.equal(result.questions.length, 1);
  assert.deepEqual(result.questions[0].body.correctIds, ['A']);
  assert.deepEqual(result.questions[0].body.choices.map((choice) => choice.text), ['Rojo', 'Azul']);
});
