import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseJsonBank } from '../src/json-bank.js';

const schema = JSON.parse(fs.readFileSync(new URL('../schema/testlab-bank-v1.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

const valid = {
  $schema: '../schema/testlab-bank-v1.schema.json',
  schemaVersion: 1,
  title: 'Esquema',
  questions: [
    {
      type: 'SINGLE',
      prompt: '¿Color?',
      choices: [
        { id: 'A', text: 'Rojo' },
        { id: 'B', text: 'Azul' }
      ],
      answer: 'A'
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Define peso',
      modelAnswer: 'Fuerza de la gravedad'
    }
  ]
};

test('the schema identity stays a repo-relative contract', () => {
  assert.equal(schema.$id, 'testlab-bank-v1.schema.json');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schemaVersion.const, 1);
});

test('Ajv accepts the v1 example and rejects structural mistakes', () => {
  assert.equal(validate(valid), true, JSON.stringify(validate.errors));
  assert.equal(parseJsonBank(JSON.stringify(valid)).errors.length, 0);

  const rejected = [
    { ...valid, schemaVersion: 2 },
    { ...valid, extra: true },
    { ...valid, questions: [] },
    { schemaVersion: 1, questions: [{ type: 'SINGLE', choices: valid.questions[0].choices, answer: 'A' }] },
    { schemaVersion: 1, questions: [{ type: 'IMAGE_BASED', prompt: 'Mira' }] },
    {
      schemaVersion: 1,
      questions: [{ type: 'NUMERIC', prompt: 'g', answer: { value: 1, tolerance: -0.1 } }]
    }
  ];
  for (const document of rejected) {
    assert.equal(validate(document), false, JSON.stringify(document));
  }
});

test('unsafe image URLs are an application rule, not something Ajv is claimed to police alone', () => {
  const document = structuredClone(valid);
  document.questions[0].image = { src: 'javascript:alert(1)' };
  assert.equal(validate(document), true);
  assert.equal(parseJsonBank(JSON.stringify(document)).questions.length, 0);
});
