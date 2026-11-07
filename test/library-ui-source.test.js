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

test('home is the library and import lives in a dialog', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="library-title">Mis tests</);
  assert.match(html, /id="import-btn"/);
  assert.match(html, /id="import-dialog"/);
  assert.match(html, /id="choose-files-btn"[^>]*autofocus/);
  assert.match(html, /Uno o más archivos \.csv o \.json\. También vale un \.txt con ese mismo contenido\./);
  assert.match(html, /El Gem es un recurso externo y opcional\. TestLab no genera las preguntas\./);
  assert.match(html, /https:\/\/gemini\.google\.com\/gem\/1kTBWN4ZZ0rlxpnbaalrRotSjX-vYZHcO\?usp=sharing/);
  assert.doesNotMatch(html, /Convierte tus apuntes en exámenes interactivos/);
  assert.doesNotMatch(html, /Añadir al Repositorio/);
  assert.doesNotMatch(html, />Repositorio</);
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /Añadido a Mis tests/);
  assert.match(app, /¿Seguro que deseas borrar \$\{countLabel\(selected\.length, 'test', 'tests'\)\}\?/);
});
