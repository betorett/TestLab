import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('the service worker precache lists real files and the new modules', () => {
  const source = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(source, /testlab-v11/);
  assert.match(source, /src\/library\.js/);
  assert.match(source, /src\/render-library\.js/);
  assert.match(source, /src\/ai-prompt\.js/);
  assert.doesNotMatch(source, /prompts\//);
  const assets = [...source.matchAll(/'\.\/([^']+)'/g)].map((match) => match[1]);
  assert.ok(assets.length > 0);
  for (const asset of assets) {
    assert.equal(fs.existsSync(new URL(`../${asset}`, import.meta.url)), true, asset);
  }
});
