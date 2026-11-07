import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('pwa icons exist at the declared sizes and the cache name moved', () => {
  assert.deepEqual(pngSize(new URL('../icons/icon-192.png', import.meta.url)), { width: 192, height: 192 });
  assert.deepEqual(pngSize(new URL('../icons/icon-512.png', import.meta.url)), { width: 512, height: 512 });
  assert.deepEqual(pngSize(new URL('../icons/icon-maskable-192.png', import.meta.url)), { width: 192, height: 192 });
  assert.deepEqual(pngSize(new URL('../icons/icon-maskable-512.png', import.meta.url)), { width: 512, height: 512 });
  const svg = fs.readFileSync(new URL('../favicon.svg', import.meta.url), 'utf8');
  assert.match(svg, /<svg[^>]*viewBox=/);
  assert.doesNotMatch(svg, /<script/);
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'TestLab');
  assert.equal(manifest.short_name, 'TestLab');
  assert.equal(manifest.theme_color, '#1d4ed8');
  assert.equal(manifest.background_color, '#111113');
  assert.deepEqual(manifest.icons.map((icon) => icon.src).sort(), [
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-192.png',
    'icons/icon-maskable-512.png'
  ].sort());
  const maskable = manifest.icons.filter((icon) => icon.purpose === 'maskable');
  assert.equal(maskable.length, 2);
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /testlab-v11/);
  assert.doesNotMatch(sw, /testlab-v10/);
  assert.match(sw, /\.\/favicon\.svg/);
  assert.match(sw, /\.\/manifest\.json/);
});
