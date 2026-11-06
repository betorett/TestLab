import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalTrueFalse,
  normalizeAnswerText,
  normalizeUnit,
  parseDecimal,
  withinTolerance
} from '../src/text.js';

test('normalizeAnswerText folds case, accents and whitespace', () => {
  assert.equal(normalizeAnswerText('  París   '), 'paris');
  assert.equal(normalizeAnswerText('ESPAÑA'), 'espana');
  assert.equal(normalizeAnswerText('a   b\tc'), 'a b c');
});

test('canonicalTrueFalse accepts only V/F and VERDADERO/FALSO', () => {
  assert.equal(canonicalTrueFalse(' V '), 'V');
  assert.equal(canonicalTrueFalse('verdadero'), 'V');
  assert.equal(canonicalTrueFalse('FALSO'), 'F');
  assert.equal(canonicalTrueFalse('f'), 'F');
  assert.equal(canonicalTrueFalse('si'), null);
  assert.equal(canonicalTrueFalse('TRUE'), null);
  assert.equal(canonicalTrueFalse(''), null);
});

test('parseDecimal accepts one comma or one dot and rejects ambiguous numbers', () => {
  assert.deepEqual(parseDecimal('9,81'), { ok: true, value: 9.81 });
  assert.deepEqual(parseDecimal(' 0.05 '), { ok: true, value: 0.05 });
  assert.deepEqual(parseDecimal('+10'), { ok: true, value: 10 });
  assert.deepEqual(parseDecimal('-0,5'), { ok: true, value: -0.5 });
  assert.equal(parseDecimal('1.234,56').ok, false);
  assert.equal(parseDecimal('1,2,3').ok, false);
  assert.equal(parseDecimal('').ok, false);
  assert.equal(parseDecimal('Infinity').ok, false);
  assert.equal(parseDecimal('1e2').ok, false);
  assert.equal(parseDecimal('NaN').ok, false);
});

test('withinTolerance is inclusive and only adds a floating-point epsilon', () => {
  assert.equal(withinTolerance(0.1 + 0.2, 0.3, 0), true);
  assert.equal(withinTolerance(10.05, 10, 0.05), true);
  assert.equal(withinTolerance(9.95, 10, 0.05), true);
  assert.equal(withinTolerance(10.06, 10, 0.05), false);
  assert.equal(withinTolerance(9.94, 10, 0.05), false);
  assert.equal(withinTolerance(Number.NaN, 1, 0), false);
  assert.equal(withinTolerance(1, 1, -0.1), false);
});

test('normalizeUnit equates superscripts, case and spaces, not algebra', () => {
  assert.equal(normalizeUnit('m / s²'), 'm/s^2');
  assert.equal(normalizeUnit('M/S^2'), 'm/s^2');
  assert.equal(normalizeUnit('m / s ^ 2'), 'm/s^2');
  assert.notEqual(normalizeUnit('m/s2'), 'm/s^2');
  assert.notEqual(normalizeUnit('m·s^-2'), 'm/s^2');
  assert.equal(normalizeUnit(''), '');
});
