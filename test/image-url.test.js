import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectImageSrc } from '../src/image-url.js';

test('accepts https URLs and relative paths', () => {
  assert.deepEqual(inspectImageSrc(' https://ejemplo.test/a.png '), {
    ok: true,
    src: 'https://ejemplo.test/a.png'
  });
  assert.equal(inspectImageSrc('examples/figura.svg').ok, true);
  assert.equal(inspectImageSrc('./examples/figura.svg').ok, true);
  assert.equal(inspectImageSrc('/examples/figura.svg').ok, true);
});

test('rejects unsafe or non-https schemes', () => {
  for (const src of [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:image/png;base64,aaaa',
    'file:///etc/passwd',
    'http://ejemplo.test/a.png',
    'blob:https://ejemplo.test/uuid',
    '//cdn.ejemplo.test/a.png',
    '%6Aavascript:alert(1)'
  ]) {
    const result = inspectImageSrc(src);
    assert.equal(result.ok, false, src);
  }
});
