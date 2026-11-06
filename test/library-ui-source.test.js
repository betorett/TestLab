import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('settings ask for JSON v1 and the page copies the system prompt module', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /CSV 100% compatible/);
  assert.doesNotMatch(html, /te devuelvan el CSV/);
  assert.match(html, /JSON TestLab v1/);
  assert.match(html, /no garantiza/);
  assert.match(app, /promptText\.textContent = SYSTEM_PROMPT_JSON_V1/);
  assert.doesNotMatch(app, /innerHTML/);
  assert.match(html, /id="library-sort"/);
  assert.match(html, /for="import-folder"/);
  assert.match(html, /id="new-folder-btn"/);
  assert.match(html, /aria-labelledby="library-dialog-title"/);
  assert.match(html, /aria-labelledby="delete-dialog-title"/);
});
