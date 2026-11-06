import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibrary } from '../src/library.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    }
  };
}

function sequentialIds() {
  const counts = { t_: 0, f_: 0 };
  return (prefix) => {
    counts[prefix] = (counts[prefix] || 0) + 1;
    return `${prefix}${counts[prefix]}`;
  };
}

function question(text = '¿?') {
  return {
    text,
    type: 'SINGLE',
    options: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }],
    correct: ['A']
  };
}

function clock(isos) {
  let index = 0;
  return () => new Date(isos[Math.min(index++, isos.length - 1)]);
}

function legacyEntry(name, extra = {}) {
  return {
    name,
    date: '1/1/2020',
    lastScore: null,
    questions: [question(name)],
    ...extra
  };
}

test('legacy banks show up as Sin clasificar and reading does not write', () => {
  const stored = JSON.stringify([
    legacyEntry('Viejo', { lastScore: '7.5' }),
    legacyEntry('Viejo')
  ]);
  const storage = memoryStorage({ 'testlab-history': stored });
  const library = createLibrary(storage);
  const view = library.view(null);

  assert.equal(view.ok, true);
  assert.equal(view.folders.length, 0);
  assert.equal(view.tests.length, 2);
  assert.equal(view.tests[0].name, 'Viejo');
  assert.notEqual(view.tests[0].id, view.tests[1].id);
  assert.match(view.tests[0].id, /^legacy:[0-9a-f]{8}:0$/);
  assert.match(view.tests[1].id, /^legacy:[0-9a-f]{8}:1$/);
  assert.deepEqual(view.breadcrumbs, [{ id: null, name: 'Repositorio' }]);
  assert.equal(library.listFolders().length, 0);
  assert.equal(library.getSort(), 'manual');
  assert.equal(library.getTest(view.tests[0].id).questions[0].text, 'Viejo');
  assert.equal(library.getTest('ausente'), null);
  assert.equal(storage.getItem('testlab-history'), stored);
  assert.equal(storage.getItem('testlab-library'), null);
  assert.equal(storage.getItem('testlab-library-sort'), null);
});

test('invalid stored JSON is left untouched', () => {
  const storage = memoryStorage({ 'testlab-history': '{', 'testlab-library': '{' });
  const library = createLibrary(storage);
  assert.throws(() => library.view(null));
  assert.equal(storage.getItem('testlab-history'), '{');
  assert.equal(storage.getItem('testlab-library'), '{');
});

test('a history value that is not an array is left untouched', () => {
  const storage = memoryStorage({ 'testlab-history': '{}' });
  const library = createLibrary(storage);
  assert.throws(() => library.view(null));
  assert.equal(storage.getItem('testlab-history'), '{}');
});

test('folders nest, reject empty names and cycles, and keep broken data', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());

  assert.deepEqual(library.createFolder(null, '   '), { ok: false, error: 'empty-name' });
  assert.equal(storage.getItem('testlab-library'), null);

  const fluidos = library.createFolder(null, '  Ingeniería de Fluidos  ');
  const tema = library.createFolder(fluidos.id, 'Tema 3');
  const nota = library.createFolder(tema.id, 'Nota');
  assert.equal(fluidos.ok, true);
  assert.equal(library.view(null).folders.map((folder) => folder.name).join('|'), 'Ingeniería de Fluidos');
  assert.equal(library.view(fluidos.id).folders[0].name, 'Tema 3');
  assert.deepEqual(
    library.view(nota.id).breadcrumbs.map((crumb) => crumb.name),
    ['Repositorio', 'Ingeniería de Fluidos', 'Tema 3', 'Nota']
  );
  assert.deepEqual(library.listFolders().map((folder) => folder.path), [
    'Ingeniería de Fluidos',
    'Ingeniería de Fluidos / Tema 3',
    'Ingeniería de Fluidos / Tema 3 / Nota'
  ]);
  assert.equal(
    JSON.parse(storage.getItem('testlab-library')).folders[0].createdAt,
    '2026-11-06T00:00:00.000Z'
  );

  assert.deepEqual(library.renameFolder(tema.id, '   '), { ok: false, error: 'empty-name' });
  assert.equal(library.renameFolder(tema.id, '  Tema 3b ').ok, true);
  assert.equal(library.view(fluidos.id).folders[0].name, 'Tema 3b');

  const beforeCycle = storage.getItem('testlab-library');
  assert.deepEqual(library.moveFolder(fluidos.id, fluidos.id), { ok: false, error: 'cycle' });
  assert.deepEqual(library.moveFolder(fluidos.id, nota.id), { ok: false, error: 'cycle' });
  assert.equal(storage.getItem('testlab-library'), beforeCycle);
  assert.deepEqual(library.moveFolder(fluidos.id, 'no-existe'), { ok: false, error: 'missing' });
  assert.deepEqual(library.createFolder('no-existe', 'X'), { ok: false, error: 'missing' });
  assert.deepEqual(library.view('no-existe'), { ok: false, error: 'missing' });

  const extra = library.createFolder(null, 'Otra');
  assert.deepEqual(library.view(null).folders.map((folder) => folder.id), [fluidos.id, extra.id]);
  assert.equal(library.moveFolder(nota.id, null).ok, true);
  assert.deepEqual(library.view(null).folders.map((folder) => folder.name), [
    'Ingeniería de Fluidos',
    'Otra',
    'Nota'
  ]);
});

test('a folder with a missing parent is shown once at the root', () => {
  const stored = JSON.stringify({
    version: 1,
    folders: [
      { id: 'f_lost', name: 'Huérfana', parentId: 'missing', createdAt: '2026-01-01T00:00:00.000Z' }
    ],
    placement: {},
    order: { root: { folders: [], tests: [] }, missing: { folders: ['f_lost'], tests: [] } }
  });
  const storage = memoryStorage({ 'testlab-library': stored, 'testlab-history': '[]' });
  const library = createLibrary(storage);
  const view = library.view(null);
  assert.equal(view.folders.length, 1);
  assert.equal(view.folders[0].name, 'Huérfana');
  assert.deepEqual(library.view('f_lost').breadcrumbs.map((crumb) => crumb.name), ['Repositorio', 'Huérfana']);
  assert.equal(storage.getItem('testlab-library'), stored);
});

test('an unsupported library index is not applied or overwritten', () => {
  const stored = JSON.stringify({
    version: 2,
    folders: [{ id: 'f', name: 'X', parentId: null, createdAt: '2026-01-01T00:00:00.000Z' }]
  });
  const history = JSON.stringify([legacyEntry('T')]);
  const storage = memoryStorage({ 'testlab-library': stored, 'testlab-history': history });
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const view = library.view(null);
  assert.equal(view.folders.length, 0);
  assert.equal(view.tests.length, 1);
  assert.equal(library.listFolders().length, 0);
  assert.deepEqual(library.createFolder(null, 'Nueva'), { ok: false, error: 'unsupported-version' });
  assert.deepEqual(library.saveTest('Otro', [question()], null), { ok: false, error: 'unsupported-version' });
  assert.deepEqual(library.deleteFolder('f'), { ok: false, error: 'unsupported-version' });
  assert.equal(storage.getItem('testlab-library'), stored);
  assert.equal(storage.getItem('testlab-history'), history);
});

test('a version 1 index whose folders are not an array is not overwritten', () => {
  const stored = JSON.stringify({ version: 1, folders: { bad: true } });
  const storage = memoryStorage({ 'testlab-library': stored, 'testlab-history': '[]' });
  const library = createLibrary(storage);
  assert.equal(library.view(null).folders.length, 0);
  assert.deepEqual(library.createFolder(null, 'A'), { ok: false, error: 'unsupported-version' });
  assert.equal(storage.getItem('testlab-library'), stored);
});

test('a folder holds many tests, including the same name elsewhere', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const parent = library.createFolder(null, 'A').id;
  const child = library.createFolder(parent, 'B').id;
  library.saveTest('en A', [question('a1')], parent);
  library.saveTest('en B', [question('b1')], child);
  library.saveTest('en B2', [question('b2')], child);
  library.saveTest('fuera', [question('z')], null);

  assert.equal(library.view(null).folders[0].testCount, 3);
  assert.equal(library.view(parent).folders[0].testCount, 2);
  assert.deepEqual(library.view(parent).tests.map((item) => item.name), ['en A']);
  assert.equal(library.view(child).tests.length, 2);
  assert.deepEqual(library.view(null).tests.map((item) => item.name), ['fuera']);

  const first = library.saveTest('Parcial', [question('p1'), question('p2')], parent);
  library.updateScore(first.id, '5');
  library.saveTest('Parcial', [question('nuevo'), question('otro')], parent);
  const inParent = library.getTest(first.id);
  assert.equal(library.view(parent).tests.filter((item) => item.name === 'Parcial').length, 1);
  assert.equal(inParent.questions[0].text, 'nuevo');
  assert.equal(inParent.lastScore, null);

  const elsewhere = library.saveTest('Parcial', [question('p1'), question('p2')], child);
  assert.notEqual(elsewhere.id, first.id);
  assert.equal(library.view(child).tests.filter((item) => item.name === 'Parcial').length, 1);

  const before = storage.getItem('testlab-history');
  assert.deepEqual(library.saveTest('X', [question()], 'ausente'), { ok: false, error: 'missing' });
  assert.equal(storage.getItem('testlab-history'), before);
});

test('moving a test keeps a single copy and can return it to Sin clasificar', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const folder = library.createFolder(null, 'Tema').id;
  const other = library.createFolder(null, 'Otra').id;
  const first = library.saveTest('Uno', [question('1')], folder).id;
  const second = library.saveTest('Dos', [question('2')], folder).id;
  const third = library.saveTest('Tres', [question('3')], null).id;

  assert.equal(library.moveTest(third, folder).ok, true);
  assert.deepEqual(library.view(folder).tests.map((item) => item.name), ['Dos', 'Uno', 'Tres']);
  assert.equal(library.view(null).tests.length, 0);
  assert.equal(library.moveTest(third, null).ok, true);
  assert.deepEqual(library.view(null).tests.map((item) => item.id), [third]);
  assert.equal(library.view(folder).tests.some((item) => item.id === third), false);
  assert.equal(library.moveTest(third, 'ausente').ok, false);
  assert.equal(JSON.parse(storage.getItem('testlab-history')).length, 3);
  assert.equal(library.getTest(first).name, 'Uno');
  assert.notEqual(first, second);
  assert.ok(other);
});

test('legacy ids are pinned on write and scores follow the id, not the name', () => {
  const original = [legacyEntry('Igual'), legacyEntry('Igual')];
  const stored = JSON.stringify(original);
  const storage = memoryStorage({ 'testlab-history': stored });
  const library = createLibrary(storage, () => '6/11/2026', sequentialIds());
  const before = library.view(null);
  assert.equal(storage.getItem('testlab-history'), stored);

  assert.equal(library.renameTest(before.tests[0].id, '  Distinto ').ok, true);
  const raw = JSON.parse(storage.getItem('testlab-history'));
  assert.equal(raw[0].id, before.tests[0].id);
  assert.equal(raw[0].name, 'Distinto');
  assert.deepEqual(raw[0].questions, original[0].questions);
  assert.equal(raw[0].date, '1/1/2020');
  assert.equal(raw[1].id, before.tests[1].id);
  assert.equal(raw[1].name, 'Igual');
  assert.deepEqual(raw[1].questions, original[1].questions);
  assert.equal(library.view(null).tests[1].id, before.tests[1].id);

  assert.deepEqual(library.renameTest(before.tests[1].id, '   '), { ok: false, error: 'empty-name' });
  assert.equal(library.updateScore(before.tests[0].id, '9.5').ok, true);
  assert.equal(library.getTest(before.tests[0].id).lastScore, '9.5');
  assert.equal(library.getTest(before.tests[1].id).lastScore, null);
  assert.deepEqual(library.getTest(before.tests[0].id).questions, original[0].questions);
  assert.deepEqual(library.updateScore('no-esta', '1'), { ok: false, error: 'missing' });

  const fresh = memoryStorage({ 'testlab-history': stored });
  const mover = createLibrary(fresh, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const id = mover.view(null).tests[0].id;
  const folder = mover.createFolder(null, 'Destino').id;
  assert.equal(mover.moveTest(id, folder).ok, true);
  const moved = JSON.parse(fresh.getItem('testlab-history'))[0];
  assert.equal(moved.id, id);
  assert.deepEqual(moved.questions, original[0].questions);
  assert.equal(mover.view(folder).tests[0].id, id);
});

test('new tests store an ISO import time unless the clock returns a display string', () => {
  const dated = memoryStorage();
  const datedLibrary = createLibrary(dated, () => new Date('2026-11-06T15:04:05.123Z'), sequentialIds());
  const saved = datedLibrary.saveTest('Nuevo', [question()], null);
  assert.equal(saved.id, 't_1');
  assert.equal(datedLibrary.getTest(saved.id).importedAt, '2026-11-06T15:04:05.123Z');

  const textual = memoryStorage();
  const textualLibrary = createLibrary(textual, () => '6/11/2026', sequentialIds());
  const textSaved = textualLibrary.saveTest('Viejo estilo', [question()], null);
  assert.equal(textualLibrary.getTest(textSaved.id).date, '6/11/2026');
  assert.equal(textualLibrary.getTest(textSaved.id).importedAt, undefined);
  textualLibrary.createFolder(null, 'Carpeta');
  const folderDate = JSON.parse(textual.getItem('testlab-library')).folders[0].createdAt;
  assert.match(folderDate, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(folderDate, '6/11/2026');

  const generated = createLibrary(memoryStorage());
  assert.match(generated.saveTest('UUID', [question()], null).id, /^t_[0-9a-f-]{36}$/i);
});

test('manual order moves tests and folders separately and stops at the ends', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const folderA = library.createFolder(null, 'A').id;
  library.createFolder(null, 'B');
  const first = library.saveTest('T1', [question()], null).id;
  const second = library.saveTest('T2', [question()], null).id;
  const third = library.saveTest('T3', [question()], null).id;
  assert.deepEqual(library.view(null).tests.map((item) => item.name), ['T3', 'T2', 'T1']);

  assert.deepEqual(library.moveInOrder('test', third, -1), { ok: false, error: 'limit' });
  assert.deepEqual(library.moveInOrder('test', first, 1), { ok: false, error: 'limit' });
  assert.equal(library.moveInOrder('test', second, -1).ok, true);
  assert.deepEqual(library.view(null).tests.map((item) => item.name), ['T2', 'T3', 'T1']);
  assert.deepEqual(library.view(null).folders.map((item) => item.name), ['A', 'B']);

  assert.equal(library.moveInOrder('folder', folderA, 1).ok, true);
  assert.deepEqual(library.view(null).folders.map((item) => item.name), ['B', 'A']);
  assert.deepEqual(library.view(null).tests.map((item) => item.name), ['T2', 'T3', 'T1']);

  library.setSort('name');
  assert.equal(library.moveInOrder('test', third, 1).ok, true);
  library.setSort('manual');
  assert.deepEqual(library.view(null).tests.map((item) => item.name), ['T2', 'T1', 'T3']);
});

test('sort preference is global and orders name, real dates and numeric scores', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, clock([
    '2024-05-03T00:00:00.000Z',
    '2024-05-02T00:00:00.000Z',
    '2024-05-01T00:00:00.000Z'
  ]), sequentialIds());
  library.saveTest('Dia3', [question()], null);
  library.saveTest('Dia2', [question()], null);
  library.saveTest('Dia1', [question()], null);
  assert.deepEqual(library.view(null).tests.map((item) => item.name), ['Dia1', 'Dia2', 'Dia3']);
  assert.equal(library.setSort('imported').ok, true);
  assert.deepEqual(library.view(null).tests.map((item) => item.name), ['Dia3', 'Dia2', 'Dia1']);
  assert.equal(createLibrary(storage).getSort(), 'imported');
  assert.deepEqual(library.setSort('no'), { ok: false, error: 'missing' });
  assert.equal(storage.getItem('testlab-library-sort'), 'imported');

  const names = memoryStorage();
  const byName = createLibrary(names, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  byName.saveTest('Tema 2', [question()], null);
  byName.saveTest('Tema 10', [question()], null);
  byName.createFolder(null, 'Tema 10');
  byName.createFolder(null, 'Tema 2');
  byName.setSort('name');
  assert.deepEqual(byName.view(null).tests.map((item) => item.name), ['Tema 2', 'Tema 10']);
  assert.deepEqual(byName.view(null).folders.map((item) => item.name), ['Tema 2', 'Tema 10']);

  const tied = memoryStorage();
  const sameTime = createLibrary(tied, () => new Date('2024-05-01T00:00:00.000Z'), sequentialIds());
  sameTime.saveTest('A', [question()], null);
  sameTime.saveTest('B', [question()], null);
  sameTime.setSort('imported');
  assert.deepEqual(sameTime.view(null).tests.map((item) => item.name), ['B', 'A']);

  const handwritten = JSON.stringify([
    { name: 'Ambiguo', date: '6/11/2026', questions: [question('a')], lastScore: null },
    { name: 'Claro', date: '13/11/2020', questions: [question('c')], lastScore: null },
    {
      name: 'ISO',
      date: '2019-01-01',
      importedAt: '2019-01-01T00:00:00.000Z',
      questions: [question('i')],
      lastScore: null
    },
    { name: 'Roto', date: '32/01/2020', questions: [question('r')], lastScore: null }
  ]);
  const oldStorage = memoryStorage({ 'testlab-history': handwritten });
  const oldLibrary = createLibrary(oldStorage);
  oldLibrary.setSort('imported');
  assert.deepEqual(oldLibrary.view(null).tests.map((item) => item.name), ['Claro', 'ISO', 'Ambiguo', 'Roto']);
  assert.equal(oldStorage.getItem('testlab-history'), handwritten);

  const scored = JSON.stringify([
    { id: 'ocho', name: 'Ocho', date: '2020-01-01', lastScore: '8', questions: [question()] },
    { id: 'diez', name: 'Diez', date: '2020-01-02', lastScore: '10', questions: [question()] },
    { id: 'nueve', name: 'Nueve', date: '2020-01-03', lastScore: '9', questions: [question()] },
    { id: 'ocho2', name: 'Ocho-2', date: '2020-01-04', lastScore: 8, questions: [question()] },
    { id: 'coma', name: 'Coma', date: '2020-01-05', lastScore: '7,5', questions: [question()] },
    { id: 'vacio', name: 'Vacio', date: '2020-01-06', lastScore: null, questions: [question()] },
    { id: 'raro', name: 'Raro', date: '2020-01-07', lastScore: 'bien', questions: [question()] }
  ]);
  const scoreStorage = memoryStorage({ 'testlab-history': scored });
  const scoreLibrary = createLibrary(scoreStorage);
  scoreLibrary.setSort('score');
  assert.deepEqual(scoreLibrary.view(null).tests.map((item) => item.name), [
    'Diez', 'Nueve', 'Ocho', 'Ocho-2', 'Coma', 'Vacio', 'Raro'
  ]);

  const folderStorage = memoryStorage();
  const folderLibrary = createLibrary(folderStorage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const alpha = folderLibrary.createFolder(null, 'A').id;
  folderLibrary.createFolder(null, 'B');
  folderLibrary.moveInOrder('folder', alpha, 1);
  folderLibrary.setSort('score');
  assert.deepEqual(folderLibrary.view(null).folders.map((item) => item.name), ['B', 'A']);

  const bogus = memoryStorage({ 'testlab-library-sort': 'foo' });
  assert.equal(createLibrary(bogus).getSort(), 'manual');
  assert.equal(bogus.getItem('testlab-library-sort'), 'foo');
});

test('deleting selected tests leaves folders, and deleting a folder is recursive', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const parent = library.createFolder(null, 'A').id;
  const child = library.createFolder(parent, 'B').id;
  const inParent = library.saveTest('Padre', [question('p')], parent).id;
  const inChildA = library.saveTest('Hijo', [question('h1')], child).id;
  library.saveTest('Hijo 2', [question('h2')], child);
  const loose = library.saveTest('Suelto', [question('s')], null).id;

  const historyBefore = storage.getItem('testlab-history');
  const libraryBefore = storage.getItem('testlab-library');
  assert.deepEqual(library.removalPreview(parent), { ok: true, folders: 2, tests: 3 });
  assert.equal(storage.getItem('testlab-history'), historyBefore);
  assert.equal(storage.getItem('testlab-library'), libraryBefore);
  assert.deepEqual(library.removalPreview('no'), { ok: false, error: 'missing' });

  assert.equal(library.deleteTests([inChildA]).ok, true);
  assert.equal(library.view(child).tests.length, 1);
  assert.equal(library.view(null).folders.length, 1);
  assert.equal(library.removalPreview(parent).tests, 2);

  assert.deepEqual(library.deleteFolder(parent), { ok: true, folders: 2, tests: 2 });
  assert.deepEqual(library.view(child), { ok: false, error: 'missing' });
  assert.equal(library.view(null).folders.length, 0);
  assert.deepEqual(library.view(null).tests.map((item) => item.id), [loose]);
  assert.equal(library.getTest(inParent), null);
  assert.equal(library.getTest(loose).name, 'Suelto');
});

test('moving a folder keeps the manual order inside it', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const parent = library.createFolder(null, 'Padre').id;
  const first = library.createFolder(parent, 'Uno').id;
  library.createFolder(parent, 'Dos');
  library.moveInOrder('folder', first, 1);
  const host = library.createFolder(null, 'Otra').id;
  assert.deepEqual(library.view(parent).folders.map((folder) => folder.name), ['Dos', 'Uno']);
  assert.equal(library.moveFolder(parent, host).ok, true);
  assert.deepEqual(library.view(parent).folders.map((folder) => folder.name), ['Dos', 'Uno']);
  assert.equal(library.view(host).folders[0].id, parent);
});

test('descendant ids include the folder itself and nested folders', () => {
  const storage = memoryStorage();
  const library = createLibrary(storage, () => new Date('2026-11-06T00:00:00.000Z'), sequentialIds());
  const parent = library.createFolder(null, 'A').id;
  const child = library.createFolder(parent, 'B').id;
  library.createFolder(null, 'C');
  assert.deepEqual(new Set(library.descendantFolderIds(parent)), new Set([parent, child]));
  assert.deepEqual(library.descendantFolderIds('no'), []);
});

test('a dangling placement is shown in Sin clasificar and is not repaired on read', () => {
  const history = JSON.stringify([
    { id: 't_1', name: 'Colgado', date: '2020-01-01', lastScore: null, questions: [question()] }
  ]);
  const index = JSON.stringify({
    version: 1,
    folders: [],
    placement: { t_1: 'f_ausente' },
    order: { root: { folders: [], tests: [] } }
  });
  const storage = memoryStorage({ 'testlab-history': history, 'testlab-library': index });
  const library = createLibrary(storage);
  assert.equal(library.view(null).tests[0].name, 'Colgado');
  assert.equal(storage.getItem('testlab-history'), history);
  assert.equal(storage.getItem('testlab-library'), index);
});
