import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { SYSTEM_PROMPT_JSON_V1 } from '../src/ai-prompt.js';

test('the system prompt matches the markdown and names the eight types', () => {
  const file = fs.readFileSync(new URL('../prompts/system-prompt-json-v1.md', import.meta.url), 'utf8');
  assert.equal(SYSTEM_PROMPT_JSON_V1, file);
  for (const type of ['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'FILL_BLANK', 'NUMERIC', 'MATCHING', 'ORDERING', 'SHORT_ANSWER']) {
    assert.match(file, new RegExp(type));
  }
  assert.match(file, /IMAGE_BASED no es un tipo/);
  assert.doesNotMatch(file, /"type"\s*:\s*"IMAGE_BASED"/);
  assert.match(file, /ruta relativa del proyecto/);
  assert.match(file, /no garantiza|no promete/i);
  assert.match(file, /___/);
  assert.match(file, /tolerance/);
  assert.match(file, /pide el contenido|pide el material|pídelo/i);
});
