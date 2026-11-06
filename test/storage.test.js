import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeQuestion } from '../src/grade.js';
import { createRepository } from '../src/repository.js';
import { coerceStoredQuestion } from '../src/storage.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    }
  };
}

test('legacy history questions still grade and reading them does not rewrite storage', () => {
  const stored = JSON.stringify([{
    name: 'Viejo',
    date: '1/1/2020',
    lastScore: '7.5',
    questions: [{
      text: '¿Capital?',
      type: 'SINGLE',
      options: [
        { id: 'A', text: 'Madrid' },
        { id: 'B', text: 'Roma' }
      ],
      correct: ['A']
    }, {
      text: '¿Cuáles?',
      type: 'MULTIPLE',
      options: [
        { id: 'A', text: 'Uno' },
        { id: 'B', text: 'Dos' },
        { id: 'C', text: 'Tres' }
      ],
      correct: ['A', 'C']
    }]
  }]);
  const storage = memoryStorage({ 'testlab-history': stored });
  const repo = createRepository(storage);
  const [item] = repo.list();
  assert.equal(storage.getItem('testlab-history'), stored);

  const single = coerceStoredQuestion(item.questions[0]);
  const multiple = coerceStoredQuestion(item.questions[1]);
  assert.equal(gradeQuestion(single, ['A']), 'correct');
  assert.equal(gradeQuestion(single, ['B']), 'incorrect');
  assert.equal(gradeQuestion(multiple, ['C', 'A']), 'correct');
  assert.equal(storage.getItem('testlab-history'), stored);
});

test('a saved fill-blank question round-trips through the repository', () => {
  const storage = memoryStorage();
  const repo = createRepository(storage, () => '6/11/2026');
  const saved = {
    id: 'q1',
    type: 'FILL_BLANK',
    prompt: 'Capital: ___',
    image: null,
    body: { blanks: [['París', 'Paris']] }
  };
  repo.save('Nuevo', [saved]);
  const loaded = coerceStoredQuestion(repo.list()[0].questions[0]);
  assert.equal(loaded.prompt, 'Capital: ___');
  assert.equal(gradeQuestion(loaded, ['paris']), 'correct');
  repo.updateScore('Nuevo', '8');
  assert.equal(repo.list()[0].lastScore, '8');
  assert.equal(repo.list()[0].date, '6/11/2026');
});
