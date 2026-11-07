import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function modalBlock() {
  const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const match = css.match(/^\.modal \{[\s\S]*?\n\}/m);
  assert.ok(match, 'falta la regla .modal');
  return match[0];
}

test('modal rule clears the legacy fixed offsets', () => {
  const block = modalBlock();
  assert.match(block, /margin:\s*auto/);
  assert.match(block, /transform:\s*none/);
  assert.match(block, /box-sizing:\s*border-box/);
  assert.match(block, /width:\s*min\(32rem, calc\(100vw - 32px\)\)/);
  assert.match(block, /max-width:\s*min\(32rem, calc\(100vw - 32px\)\)/);
  assert.match(block, /height:\s*fit-content/);
  assert.match(block, /max-height:\s*min\(90dvh, 40rem\)/);
  assert.match(block, /overflow:\s*auto/);
  assert.match(block, /padding:\s*0/);
  assert.match(block, /border:\s*none/);
  assert.doesNotMatch(block, /top:\s*50%/);
  assert.doesNotMatch(block, /left:\s*50%/);
  assert.doesNotMatch(block, /translate\(-50%/);
  assert.doesNotMatch(block, /margin:\s*0/);
  assert.doesNotMatch(block, /position:\s*fixed/);
  assert.doesNotMatch(block, /inset-inline/);
  assert.doesNotMatch(block, /inset\s*:/);
  assert.doesNotMatch(block, /\btop\s*:/);
  assert.doesNotMatch(block, /\bright\s*:/);
  assert.doesNotMatch(block, /\bbottom\s*:/);
  assert.doesNotMatch(block, /\bleft\s*:/);
  assert.doesNotMatch(block, /display\s*:/);
});
