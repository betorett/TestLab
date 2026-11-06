import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsvMatrix } from '../src/csv-bank.js';
import { scoreExam } from '../src/score.js';

function bank(rows) {
  return parseCsvMatrix(rows).questions;
}

test('a pending short answer does not score and does not penalize', () => {
  const questions = bank([
    ['Uno', 'SINGLE', 'A', 'B', 'A'],
    ['Dos', 'SINGLE', 'A', 'B', 'A'],
    ['Tres', 'SHORT_ANSWER', 'Modelo']
  ]);
  const result = scoreExam(questions, [
    ['A'],
    ['B'],
    { text: 'Modelo', verdict: null }
  ], 0.33);
  const expectedRaw = Math.max(0, 1 - 0.33);
  assert.equal(result.correct, 1);
  assert.equal(result.wrong, 1);
  assert.equal(result.pending, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.raw, expectedRaw);
  assert.equal(result.scoreOutOf10, (expectedRaw / 3) * 10);
  assert.equal(result.scoreLabel, ((expectedRaw / 3) * 10).toFixed(2).replace('.00', ''));
});

test('penalty cannot push the raw score below zero', () => {
  const questions = bank([
    ['Uno', 'SINGLE', 'A', 'B', 'A'],
    ['Dos', 'SINGLE', 'A', 'B', 'A']
  ]);
  const result = scoreExam(questions, [['B'], ['B']], 1);
  assert.equal(result.correct, 0);
  assert.equal(result.wrong, 2);
  assert.equal(result.raw, 0);
  assert.equal(result.scoreLabel, '0');
});

test('an empty answer is skipped, not wrong', () => {
  const questions = bank([['Uno', 'SINGLE', 'A', 'B', 'A']]);
  const result = scoreExam(questions, [[]], 0.33);
  assert.deepEqual(
    { correct: result.correct, wrong: result.wrong, skipped: result.skipped, pending: result.pending },
    { correct: 0, wrong: 0, skipped: 1, pending: 0 }
  );
  assert.equal(result.raw, 0);
});
