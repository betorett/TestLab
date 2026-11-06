import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { renderHistoryList } from '../src/render-history.js';

test('history names are text, including names that look like markup', () => {
  const { document } = new JSDOM('<!doctype html><body><div id="root"></div></body>').window;
  const root = document.getElementById('root');
  renderHistoryList(root, [{
    name: '<img src=x onerror=alert(1)>',
    date: '6/11/2026',
    lastScore: null,
    questions: [{ type: 'SINGLE' }]
  }]);
  assert.equal(root.querySelector('img'), null);
  assert.match(root.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(root.textContent, /1 preguntas/);
  assert.match(root.textContent, /Sin realizar/);
});
