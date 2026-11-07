import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { renderLibrary } from '../src/render-library.js';

function root() {
  const { document } = new JSDOM('<!doctype html><body><div id="root"></div></body>').window;
  return document.getElementById('root');
}

function named(container, name) {
  return [...container.querySelectorAll('button, input')].find((element) => {
    return element.getAttribute('aria-label') === name || element.textContent === name;
  });
}

const hostileFolder = '<b>Tema</b>';
const hostileTest = '<img src=x onerror=alert(1)>';

test('folder and test names are text and only tests can be selected', () => {
  const container = root();
  renderLibrary(container, {
    sort: 'manual',
    breadcrumbs: [
      { id: null, name: 'Mis tests' },
      { id: 'f1', name: 'Fluidos' }
    ],
    folders: [{ id: 'f2', name: hostileFolder, testCount: 3 }],
    tests: [{
      id: 't1',
      name: hostileTest,
      date: '6/11/2026',
      lastScore: null,
      questionCount: 2
    }]
  });

  assert.equal(container.querySelector('img'), null);
  assert.equal(container.querySelector('b'), null);
  assert.match(container.textContent, /<b>Tema<\/b>/);
  assert.match(container.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(container.textContent, /3 tests/);
  assert.match(container.textContent, /2 preguntas/);
  assert.match(container.textContent, /Sin realizar/);
  assert.equal(container.querySelectorAll('input[type="checkbox"]').length, 1);
  assert.equal(container.querySelector('input').getAttribute('aria-label'), `Seleccionar ${hostileTest}`);
  assert.equal(container.querySelector('article').querySelector('input'), null);

  const openFolder = named(container, `Abrir ${hostileFolder}`);
  const menu = container.querySelector('details.library-menu');
  assert.equal(openFolder.closest('details'), null);
  assert.equal(menu.querySelector('summary').getAttribute('aria-label'), `Acciones de ${hostileFolder}`);
  assert.ok(named(container, `Renombrar carpeta ${hostileFolder}`));
  assert.ok(named(container, `Mover carpeta ${hostileFolder}`));
  assert.ok(named(container, `Subir carpeta ${hostileFolder}`).disabled);
  assert.ok(named(container, `Bajar carpeta ${hostileFolder}`).disabled);
  assert.ok(named(container, `Borrar carpeta ${hostileFolder}`));
  assert.equal(named(container, `Empezar ${hostileTest}`).closest('details'), null);
  assert.equal(container.querySelector('input').closest('button'), null);
  assert.equal(named(container, 'Mis tests').tagName, 'BUTTON');
  assert.equal(container.querySelector('[aria-current="page"]').textContent, 'Fluidos');
  assert.equal(container.querySelector('h3'), null);
});

test('reorder buttons stay disabled unless the manual order can move that item', () => {
  const container = root();
  renderLibrary(container, {
    sort: 'name',
    breadcrumbs: [{ id: null, name: 'Mis tests' }],
    folders: [],
    tests: [
      { id: 'a', name: 'A', date: '2020-01-01', lastScore: null, questionCount: 1 },
      { id: 'b', name: 'B', date: '2020-01-02', lastScore: '8', questionCount: 1 }
    ]
  });
  for (const name of ['Subir A', 'Bajar A', 'Subir B', 'Bajar B']) {
    assert.equal(named(container, name).disabled, true, name);
  }
  assert.equal(container.querySelector('h3').textContent, 'Sin clasificar');
  assert.match(container.textContent, /Nota: 8\/10/);

  renderLibrary(container, {
    sort: 'manual',
    breadcrumbs: [{ id: null, name: 'Mis tests' }],
    folders: [],
    tests: [
      { id: 'a', name: 'A', date: '2020-01-01', lastScore: null, questionCount: 1 },
      { id: 'b', name: 'B', date: '2020-01-02', lastScore: null, questionCount: 1 }
    ]
  });
  assert.equal(named(container, 'Subir A').disabled, true);
  assert.equal(named(container, 'Bajar A').disabled, false);
  assert.equal(named(container, 'Subir B').disabled, false);
  assert.equal(named(container, 'Bajar B').disabled, true);
});

test('empty levels explain whether the library or the folder is empty', () => {
  const container = root();
  renderLibrary(container, {
    sort: 'manual',
    breadcrumbs: [{ id: null, name: 'Mis tests' }, { id: 'f1', name: 'Fluidos' }],
    folders: [],
    tests: []
  });
  assert.match(container.textContent, /Esta carpeta está vacía\./);
  assert.equal(container.querySelector('#empty-import').textContent, 'Importar test');
  assert.equal(container.querySelector('#empty-folder').textContent, 'Crear carpeta');
  assert.equal(named(container, 'Mis tests').tagName, 'BUTTON');

  renderLibrary(container, {
    sort: 'manual',
    breadcrumbs: [{ id: null, name: 'Mis tests' }],
    folders: [],
    tests: []
  });
  assert.match(container.textContent, /Todavía no hay tests\. Un CSV o un JSON TestLab v1 válido se guarda solo en este navegador\./);
  assert.equal(container.querySelector('nav'), null);
  assert.equal(container.querySelector('[aria-current="page"]'), null);
  assert.equal(container.querySelector('#empty-import').classList.contains('primary'), true);
});
