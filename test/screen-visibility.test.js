import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('inactive screens are hidden and the document can scroll', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  for (const id of ['mode-screen', 'exam-screen', 'loading-screen', 'results-screen']) {
    assert.match(html, new RegExp(`<main id="${id}" class="screen" hidden>`));
  }
  assert.match(html, /<main id="upload-screen" class="screen active">/);
  assert.doesNotMatch(html, /id="upload-screen"[^>]*hidden/);
  assert.match(css, /\.screen\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /\.screen:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/);
  assert.doesNotMatch(css, /^\.screen\s*\{[^}]*display:\s*(?:flex|grid)/m);
  const body = css.match(/body\s*\{[\s\S]*?\n\}/m)[0];
  assert.doesNotMatch(body, /overflow:\s*hidden/);
  assert.doesNotMatch(body, /position:\s*fixed/);
  assert.match(app, /toggleAttribute\('hidden', !active\)/);
  assert.match(app, /TestLab — Mis tests/);
});
