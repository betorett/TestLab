import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeQuestion } from '../src/grade.js';
import { parseJsonBank, validateBankDocument } from '../src/json-bank.js';

function single(overrides = {}) {
  return {
    type: 'SINGLE',
    prompt: 'Capital de España',
    choices: [
      { id: 'A', text: 'Madrid' },
      { id: 'B', text: 'Roma' }
    ],
    answer: 'A',
    ...overrides
  };
}

const valid = {
  $schema: '../schema/testlab-bank-v1.schema.json',
  schemaVersion: 1,
  title: 'Banco demo',
  questions: [
    { ...single(), id: 'q-single' },
    {
      type: 'MULTIPLE',
      prompt: 'Pares',
      choices: [
        { id: 'A', text: '2' },
        { id: 'B', text: '3' },
        { id: 'C', text: '4' }
      ],
      answer: ['A', 'C']
    },
    { type: 'TRUE_FALSE', prompt: 'El hielo flota', answer: false },
    { type: 'FILL_BLANK', prompt: 'La capital es ___.', blanks: [['París', 'Paris']] },
    { type: 'FILL_BLANK', prompt: '___ está en ___.', blanks: [['Madrid'], ['España']] },
    { type: 'NUMERIC', prompt: 'g', answer: { value: 9.81, tolerance: 0.05, unit: 'm/s^2' } },
    { type: 'NUMERIC', prompt: 'tres', answer: { value: 3, tolerance: 0 } },
    {
      type: 'MATCHING',
      prompt: 'Capitales',
      pairs: [
        { left: 'Madrid', right: 'España' },
        { left: 'Roma', right: 'Italia' }
      ]
    },
    { type: 'ORDERING', prompt: 'Ciclo', items: ['Planificar', 'Ejecutar', 'Comprobar'] },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Define inercia',
      modelAnswer: 'Conservar el movimiento',
      image: { src: 'examples/figura.svg', alt: 'Esquema' }
    }
  ]
};

test('a valid v1 bank becomes the shared internal model', () => {
  const result = parseJsonBank(JSON.stringify(valid));
  assert.deepEqual(result.errors, []);
  assert.equal(result.title, 'Banco demo');
  assert.equal(result.questions.length, 10);
  assert.equal(result.questions[0].id, 'q-single');
  assert.deepEqual(result.questions[0].body.correctIds, ['A']);
  assert.equal(result.questions[2].body.correct, false);
  assert.equal(result.questions[6].body.unit, null);
  assert.deepEqual(result.questions[9].image, { src: 'examples/figura.svg', alt: 'Esquema' });
  assert.equal(gradeQuestion(result.questions[3], ['paris']), 'correct');
  assert.equal(gradeQuestion(result.questions[9], { text: 'cualquier cosa', verdict: null }), 'pending');
});

test('invalid JSON does not fall through to CSV and a bad question rejects the bank', () => {
  const broken = parseJsonBank('{');
  assert.equal(broken.questions.length, 0);
  assert.match(broken.errors[0].message, /JSON inválido/);

  const partial = structuredClone(valid);
  partial.questions[6].answer.tolerance = -1;
  const rejected = parseJsonBank(JSON.stringify(partial));
  assert.equal(rejected.questions.length, 0);
  assert.ok(rejected.errors.some((error) => error.path === 'questions[6].answer.tolerance'));
});

test('reports the question path for structural and semantic mistakes', () => {
  const cases = [
    [{ schemaVersion: 2, questions: [single()] }, 'schemaVersion'],
    [{ schemaVersion: 1, extra: true, questions: [single()] }, 'extra'],
    [{ schemaVersion: 1, questions: [] }, 'questions'],
    [{ schemaVersion: 1, questions: [{ ...single(), prompt: '   ' }] }, 'questions[0].prompt'],
    [{ schemaVersion: 1, questions: [{ ...single(), choices: [{ id: 'A', text: 'Solo' }] }] }, 'questions[0].choices'],
    [{ schemaVersion: 1, questions: [{ ...single(), answer: 'Z' }] }, 'questions[0].answer'],
    [{ schemaVersion: 1, questions: [{ ...single(), note: 'sobrante' }] }, 'questions[0].note'],
    [{ schemaVersion: 1, questions: [{ type: 'IMAGE_BASED', prompt: 'Mira', answer: 'A' }] }, 'questions[0].type'],
    [{
      schemaVersion: 1,
      questions: [{
        type: 'MATCHING',
        prompt: 'Dup',
        pairs: [
          { left: 'Madrid', right: 'España' },
          { left: 'Roma', right: 'España' }
        ]
      }]
    }, 'questions[0].pairs'],
    [{
      schemaVersion: 1,
      questions: [{ type: 'NUMERIC', prompt: 'g', answer: { value: 1, tolerance: 0, unit: 5 } }]
    }, 'questions[0].answer.unit'],
    [{
      schemaVersion: 1,
      questions: [{ type: 'FILL_BLANK', prompt: 'Sin huecos', blanks: [['a'], ['b']] }]
    }, 'questions[0].blanks'],
    [{
      schemaVersion: 1,
      questions: [{ ...single(), image: { src: 'javascript:alert(1)', alt: 'Mala' } }]
    }, 'questions[0].image.src']
  ];

  for (const [document, path] of cases) {
    const result = validateBankDocument(document);
    assert.equal(result.ok, false, path);
    assert.ok(result.errors.some((error) => error.path === path), `${path}: ${JSON.stringify(result.errors)}`);
  }

  const imageBased = validateBankDocument({
    schemaVersion: 1,
    questions: [{ type: 'IMAGE_BASED', prompt: 'Mira' }]
  });
  assert.match(imageBased.errors.find((error) => error.path === 'questions[0].type').message, /image/i);
});
