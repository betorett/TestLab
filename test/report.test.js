import assert from 'node:assert/strict';
import test from 'node:test';
import { describeAttempt } from '../src/report.js';

test('a pending short answer is labeled pending, not incorrect', () => {
  const question = {
    type: 'SHORT_ANSWER',
    prompt: 'Define peso',
    image: null,
    body: { modelAnswer: 'Fuerza' }
  };
  const pending = describeAttempt(question, { text: 'Fuerza', verdict: null });
  assert.match(pending.label, /PENDIENTE/);
  assert.match(pending.detail, /Fuerza/);
  assert.doesNotMatch(pending.label, /INCORRECTA|CORRECTA/);

  const wrong = describeAttempt(question, { text: 'Fuerza', verdict: 'incorrect' });
  assert.match(wrong.label, /INCORRECTA/);
});
