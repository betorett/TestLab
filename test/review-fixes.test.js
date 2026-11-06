import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('readme does not claim that displaying an img depends on CORS', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, /depende de la red, de CORS/);
  assert.match(readme, /no usa CORS para mostrarse/);
  assert.match(readme, /contenido mixto/);
});

test('service worker precache lists only files that exist', () => {
  const source = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const assets = [...source.matchAll(/'\.\/([^']*)'/g)].map((match) => match[1]).filter(Boolean);
  const missing = assets.filter((asset) => !fs.existsSync(new URL(`../${asset}`, import.meta.url)));
  assert.deepEqual(missing, []);
});
