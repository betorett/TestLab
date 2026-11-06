# Biblioteca de carpetas y prompt JSON v1 — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el Repositorio plano en una biblioteca de carpetas sin límite de nivel, conservando el historial antiguo, y sustituir el prompt breve por un system prompt JSON v1 copiable.

**Architecture:** `src/library.js` posee `testlab-history`, el índice `testlab-library` y la preferencia `testlab-library-sort`. La lectura no escribe. `src/render-library.js` pinta migas, subcarpetas y tests del nivel con `textContent`. `app.js` sigue encargándose del examen y llama a la biblioteca por id. El prompt vive en `prompts/system-prompt-json-v1.md` y en `src/ai-prompt.js` con el mismo texto; la página lo asigna sin `fetch`.

**Tech Stack:** HTML, CSS y módulos JS nativos. Node `node --test` + jsdom. Playwright. Sin dependencias nuevas. ESLint 9 y Ajv solo como ya están.

## Global Constraints

- Partir de `2bb16c6b87aa8585dd495b99ecd6edd6454bbea2` en la rama `cursor/library-folders-addd`. No tocar la rama de la PR #1. No merge. No despliegue.
- No hay Asignatura, etiquetas, backend, cuentas, sincronización, papelera, deshacer ni drag and drop.
- No se añaden dependencias. No se cambia la fórmula de nota, los tipos, `SHORT_ANSWER`, las imágenes ni los modos.
- CSV y JSON v1 siguen igual. No hay conversor.
- Leer `testlab-history` no lo reescribe ni crea `testlab-library`.
- Navegación: migas + contenido del nivel. Preferencia de orden global.
- Fechas ambiguas de `toLocaleDateString()` no se inventan. Nota numérica; no realizados al final.
- Texto de usuario solo con `textContent` o APIs DOM seguras.
- `verify:static` copia y comprueba `dist/`. `check:syntax` es `node --check`. Ninguno empaqueta.
- TDD: el test nuevo se ejecuta y falla antes del código de producción de ese comportamiento.

---

### Task 1: Historial antiguo en Sin clasificar, sin escribir

**Files:**
- Create: `src/library.js`
- Test: `test/library.test.js`

**Interfaces:**
- Consumes: nada de producción nueva.
- Produces: `createLibrary(storage, now?, ids?)`, `view(null)`, `getTest`, `listFolders`, `getSort`. Un test antiguo sale en la raíz con id `legacy:<fnv1a>:<ocurrencia>`.

- [ ] **Step 1: Write the failing test**

Crear `test/library.test.js` con el helper `memoryStorage` y este test:

```javascript
test('legacy banks show up as Sin clasificar and reading does not write', () => {
  const stored = JSON.stringify([{
    name: 'Viejo',
    date: '1/1/2020',
    lastScore: '7.5',
    questions: [{ text: '¿Capital?', type: 'SINGLE', options: [{ id: 'A', text: 'Madrid' }], correct: ['A'] }]
  }, {
    name: 'Viejo',
    date: '1/1/2020',
    lastScore: null,
    questions: [{ text: '¿Capital?', type: 'SINGLE', options: [{ id: 'A', text: 'Madrid' }], correct: ['A'] }]
  }]);
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
  assert.equal(view.breadcrumbs.at(-1).name, 'Repositorio');
  assert.equal(storage.getItem('testlab-history'), stored);
  assert.equal(storage.getItem('testlab-library'), null);
  assert.equal(storage.getItem('testlab-library-sort'), null);
  assert.equal(library.listFolders().length, 0);
  assert.equal(library.getSort(), 'manual');
  assert.equal(library.getTest(view.tests[0].id).questions[0].text, '¿Capital?');
  assert.equal(storage.getItem('testlab-history'), stored);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/library.test.js`

Expected: FAIL porque `../src/library.js` no existe (`ERR_MODULE_NOT_FOUND`). Guardar esa salida.

- [ ] **Step 3: Write minimal implementation**

Crear `src/library.js` con `HISTORY_KEY = 'testlab-history'`, `LIBRARY_KEY = 'testlab-library'`, `SORT_KEY = 'testlab-library-sort'`. `fnv1a` de 32 bits. `identify(entries)` asigna `entry.id` trimado si es una cadena no vacía y, si no, `legacy:${fnv1a(JSON.stringify({ name, date, questions }))}:${ocurrencia}`. `view(null)` lee el array, no escribe, devuelve los tests en orden del array y cero carpetas. `getTest` busca por id derivado o propio. `listFolders()` devuelve `[]` cuando no hay índice aplicable. `getSort` devuelve `manual` si la clave no es `manual|name|imported|score`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/library.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library.js test/library.test.js
git commit -m "feat: read legacy banks as an unclassified library"
```

### Task 2: Carpetas, ciclos, nombres vacíos y conteos

**Files:**
- Modify: `src/library.js`
- Test: `test/library.test.js`

**Interfaces:**
- Consumes: `createLibrary`.
- Produces: `createFolder`, `renameFolder`, `moveFolder`, `listFolders`, `view(folderId)`.

- [ ] **Step 1: Write the failing tests**

Añadir tests que, con `ids` secuencial (`f_1`, `f_2`…) y `now` fijo a `new Date('2026-11-06T00:00:00.000Z')`:

- Crear «Ingeniería de Fluidos» en la raíz y «Tema 3» dentro. `view(null)` muestra solo la padre. `view(padre)` muestra «Tema 3» y `listFolders()` devuelve rutas `Ingeniería de Fluidos` y `Ingeniería de Fluidos / Tema 3`.
- `testCount` de la padre es 2 cuando hay un test en la padre y otro en la hija (el guardado de tests llega en la Task 3; mientras tanto el conteo puede afirmarse con tests colocados por `saveTest`. Escribir este assert en la Task 3 si `saveTest` aún no existe, y dejar aquí tres niveles vacíos: abuelo / padre / hija y `view` de cada uno).
- `createFolder(null, '   ')` y `renameFolder` a `'  '` devuelven `{ ok: false, error: 'empty-name' }` y no crean clave nueva si no había ninguna. Con nombre válido, el nombre guardado va recortado.
- `moveFolder(id, id)` y mover el abuelo dentro de la nieta devuelven `cycle` y el `parentId` no cambia.
- `moveFolder(id, 'no-existe')` y `createFolder('no-existe', 'X')` devuelven `missing`.
- `view('no-existe')` devuelve `missing`.
- Una carpeta nueva queda después de las hermanas ya creadas.
- Datos rotos: `parentId` inexistente se ve en la raíz una sola vez. `placement` a una carpeta ausente no hace falta hasta la Task 3. Índice `{ "version": 2, "folders": [...] }` hace que `view(null)` no muestre carpetas y que `createFolder` devuelva `unsupported-version` sin cambiar la cadena guardada.
- JSON `testlab-library` = `{` lanza al llamar a `view` y la cadena sigue igual.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/library.test.js`

Expected: FAIL por `createFolder` indefinido o `cycle` no producido. No debe fallar el test de la Task 1.

- [ ] **Step 3: Write minimal implementation**

Índice `version: 1` con `folders`, `placement`, `order`. Mutaciones bloqueadas si `version` no es 1 ni está ausente con forma válida. `createFolder` hace push al final de `order[parent].folders`. `moveFolder` rechaza el propio id y cualquier id devuelto por el recorrido de descendientes con conjunto `seen`. La vista usa el padre visible: si la cadena de `parentId` se rompe o se repite, la carpeta cuelga de la raíz. `listFolders` recorre ese árbol en preorden y une nombres con ` / `.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/library.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library.js test/library.test.js
git commit -m "feat: create, rename and move library folders"
```

### Task 3: Tests, ids estables, nota y movimiento

**Files:**
- Modify: `src/library.js`
- Test: `test/library.test.js`

**Interfaces:**
- Consumes: carpetas de la Task 2.
- Produces: `saveTest(name, questions, folderId = null)`, `moveTest`, `renameTest`, `updateScore`, `deleteTests`, `getTest`.

- [ ] **Step 1: Write the failing tests**

- Tres `saveTest` en la misma carpeta aparecen los tres en `view` de esa carpeta y no en la raíz. `testCount` de un ancestro suma los descendientes.
- El mismo nombre y el mismo `questions.length` en la misma carpeta sustituye (un solo test, mismo id, `lastScore` null). El mismo nombre en otra carpeta crea otro id.
- `saveTest(..., 'carpeta-ausente')` es `missing` y no cambia `testlab-history`.
- Mover un test a otra carpeta y luego a `null` lo deja en la raíz. Sigue habiendo una sola copia.
- Dos entradas antiguas idénticas: `renameTest` de la primera fija `id` `legacy:…:0` en el JSON, cambia solo el nombre de esa entrada y deja las `questions` de ambas deep-equal al original. La segunda sigue viéndose como `legacy:…:1`. Antes de renombrar, la cadena de `testlab-history` no cambia.
- `updateScore` de un id no modifica el `lastScore` del otro aunque compartan nombre. Un id desconocido es `missing`.
- `deleteTests` quita solo esos ids. Una carpeta no desaparece.
- Un test nuevo guarda `id` que empieza por `t_` e `importedAt` ISO cuando `now` devuelve un `Date`. Si `now` devuelve `'6/11/2026'`, `date` es ese texto y no hay `importedAt`.
- `moveTest` de un banco antiguo escribe el `id` derivado y no altera `questions`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/library.test.js`

Expected: FAIL por `saveTest` ausente o por no encontrar el test dentro de la carpeta.

- [ ] **Step 3: Write minimal implementation**

`saveTest` inserta al principio del historial y del orden manual del destino, salvo sustitución en la misma carpeta (mismo nombre y mismo número de preguntas). `pinAll` añade `id` derivado a las entradas que no lo tienen solo cuando esa operación escribe el historial. `updateScore` y `renameTest` buscan por id. `placement` guarda solo el id de carpeta; borrarlo es Sin clasificar. Lo movido se añade al final del orden manual del destino.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/library.test.js test/storage.test.js`

Expected: PASS, incluido el test viejo de que listar con `createRepository` no reescribe.

- [ ] **Step 5: Commit**

```bash
git add src/library.js test/library.test.js
git commit -m "feat: place tests in one folder and score them by id"
```

### Task 4: Orden manual, nombre, fecha y nota

**Files:**
- Modify: `src/library.js`
- Test: `test/library.test.js`

**Interfaces:**
- Consumes: `view`, `saveTest`, `createFolder`.
- Produces: `setSort`, `moveInOrder(kind, id, direction)`, `sortableTime` exportado si hace el test más directo. La preferencia queda en `testlab-library-sort`.

- [ ] **Step 1: Write the failing tests**

- `moveInOrder('test', primero, -1)` y `moveInOrder('test', ultimo, 1)` devuelven `limit` y no cambian el orden. Subir el segundo intercambia solo tests; las carpetas hermanas siguen igual. Bajar la primera carpeta no mueve tests.
- `setSort('name')` persiste. Otra instancia `createLibrary(storage)` lee `name`. `setSort('no')` es `missing` y no escribe. Una clave previa `'foo'` hace que `getSort()` sea `manual` sin reescribirla.
- Nombre: guardados en orden `Tema 10`, `Tema 2`. Con `name`, `Tema 2` va antes que `Tema 10`. Carpetas `Tema 10` y `Tema 2`, igual.
- Fecha: tres altas con reloj `2024-05-03`, `2024-05-02`, `2024-05-01` en ese orden de `saveTest` (el manual queda del más antiguo al más nuevo por el unshift). Con `imported`, el más reciente va primero.
- Historial escrito a mano, sin pasar por `saveTest`: `importedAt` `2019-01-01T00:00:00.000Z`; `date` `13/11/2020` sin `importedAt`; `date` `6/11/2026` sin `importedAt`; `date` `32/01/2020`. Tras `setSort('imported')`, el orden es el de 2020-11-13, luego 2019-01-01, y las dos desconocidas al final en su orden manual. La cadena original de esas entradas no gana un `importedAt` al hacer `view`.
- Nota: manual `Ocho` (`'8'`), `Diez` (`'10'`), `Ocho-2` (`8`), `Vacío` (`null`), `Raro` (`'bien'`). Con `score`: `Diez`, `Ocho`, `Ocho-2`, `Vacío`, `Raro`. `'10'` no se ordena como texto respecto de `'8'`.
- Carpetas con preferencia `score` conservan el orden manual entre ellas.
- Empate de nota o de instante: se mantiene el orden manual relativo.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/library.test.js`

Expected: FAIL al ordenar `Tema 10` antes que `Tema 2`, o porque `moveInOrder` no existe.

- [ ] **Step 3: Write minimal implementation**

Comparadores estables sobre el índice manual. Nombre: `localeCompare('es', { sensitivity: 'base', numeric: true })`. Fecha: instante ISO válido y, si no, `D/M/AAAA` solo con día > 12 y fecha real; desconocidas al final; entre conocidas, la más nueva primero. Nota: `Number` finito, coma decimal aceptada, mayor primero, no numéricos al final. Carpetas con `score`: comparador 0. `moveInOrder` intercambia dentro del grupo ya materializado (los ids no listados cuentan al final) y persiste esa lista.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/library.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library.js test/library.test.js
git commit -m "feat: sort each library level by hand, name, date and score"
```

### Task 5: Borrado recursivo

**Files:**
- Modify: `src/library.js`
- Test: `test/library.test.js`

**Interfaces:**
- Consumes: carpetas y tests.
- Produces: `removalPreview(id)` sin escritura y `deleteFolder(id)` que devuelve `{ ok: true, folders, tests }`.

- [ ] **Step 1: Write the failing test**

Montar raíz con carpeta `A`, subcarpeta `B`, un test en `A`, dos en `B` y un test en Sin clasificar. `removalPreview('A')` es `{ ok: true, folders: 2, tests: 3 }` y no cambia el almacenamiento. `deleteFolder('A')` elimina `A`, `B` y esos tres tests; el de Sin clasificar sigue. Un segundo `view('B')` es `missing`. `removalPreview('no')` es `missing`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/library.test.js`

Expected: FAIL porque `removalPreview` no existe o los conteos no cuadran.

- [ ] **Step 3: Write minimal implementation**

Recorrer hijos por `parentId` con un `Set` de ids vistos. Borrar esas carpetas, los tests cuya carpeta resuelta esté en el conjunto, sus `placement` y sus cubos de `order`. Escribir historial (fijando ids de lo que queda) e índice.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/library.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library.js test/library.test.js
git commit -m "feat: delete a folder together with its nested tests"
```

### Task 6: Render DOM

**Files:**
- Create: `src/render-library.js`
- Test: `test/render-library.test.js`
- Modify: ninguno de `src/render-history.js` (el test actual sigue cubriendo la lista plana).

**Interfaces:**
- Consumes: el objeto `view` (`breadcrumbs`, `folders`, `tests`, `sort`).
- Produces: `renderLibrary(container, view)`.

- [ ] **Step 1: Write the failing test**

Con jsdom, pintar una raíz anidada en «Fluidos» con una carpeta llamada `<b>Tema</b>` (`testCount: 3`) y un test llamado `<img src=x onerror=alert(1)>` de 2 preguntas sin nota. Afirmar: no hay elemento `img` ni `b`; el texto contiene esas cadenas literales, `3 tests`, `2 preguntas` y `Sin realizar`; hay una sola casilla y su nombre accesible es `Seleccionar <img…>`; la carpeta no tiene casilla; existen botones `Abrir <b>Tema</b>`, `Subir carpeta <b>Tema</b>`, `Borrar carpeta <b>Tema</b>`, `Empezar examen`, `Mover <img…>`; en Manual, con un solo hijo por grupo, Subir y Bajar de ese hijo están `disabled`; la miga «Repositorio» es botón y «Fluidos» tiene `aria-current="page"`; el nivel raíz con tests muestra un `h3` «Sin clasificar» solo cuando `breadcrumbs` tiene un elemento (pasar `atRoot: true` no: decidir por `breadcrumbs.at(-1).id === null`).

Segundo caso: dos tests, `sort: 'name'`, los cuatro botones Subir/Bajar de tests `disabled`.

Tercer caso: dos tests, `sort: 'manual'`. El Subir del primero y el Bajar del último están `disabled`; el Subir del segundo no.

Cuarto caso: nivel vacío dentro de una carpeta dice `Esta carpeta está vacía.` La raíz vacía dice `Repositorio vacío.` y «Repositorio» no es botón.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/render-library.test.js`

Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write minimal implementation**

`renderLibrary` vacía el contenedor con `replaceChildren` y crea nodos con `textContent`. Botones `type="button"` con `dataset.action`, `dataset.kind` y `dataset.id`. Casilla `class="repo-checkbox"` solo en tests. No usar `innerHTML`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/render-library.test.js test/render-history.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render-library.js test/render-library.test.js
git commit -m "feat: render the current library folder accessibly"
```

### Task 7: Prompt de sistema

**Files:**
- Create: `prompts/system-prompt-json-v1.md`
- Create: `src/ai-prompt.js`
- Test: `test/ai-prompt.test.js`

**Interfaces:**
- Consumes: `schema/testlab-bank-v1.schema.json` y `src/validate-bank.js` como referencia, sin modificarlos.
- Produces: `export const SYSTEM_PROMPT_JSON_V1` idéntico al Markdown.

- [ ] **Step 1: Write the failing test**

```javascript
test('the system prompt matches the markdown and names the eight types', () => {
  const file = fs.readFileSync(new URL('../prompts/system-prompt-json-v1.md', import.meta.url), 'utf8');
  assert.equal(SYSTEM_PROMPT_JSON_V1, file);
  for (const type of ['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'FILL_BLANK', 'NUMERIC', 'MATCHING', 'ORDERING', 'SHORT_ANSWER']) {
    assert.match(file, new RegExp(type));
  }
  assert.match(file, /IMAGE_BASED no es un tipo/);
  assert.doesNotMatch(file, /"type"\s*:\s*"IMAGE_BASED"/);
  assert.match(file, /ruta relativa del proyecto/);
  assert.match(file, /no garantiza|no promete/i);
  assert.match(file, /___/);
  assert.match(file, /tolerance/);
  assert.match(file, /pide el contenido|pide el material|pídelo/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ai-prompt.test.js`

Expected: FAIL con módulo o archivo ausente.

- [ ] **Step 3: Write minimal implementation**

El Markdown es el prompt, sin prólogo. Cubre salida solo JSON salvo cuando falte la fuente (entonces se pide y no se inventa), la ruta `"$schema": "../schema/testlab-bank-v1.schema.json"` como ruta del repo y no como URL pública, los ocho tipos con los campos que exige el esquema, huecos `___` y `blanks` anidados, numéricos sin conversión, pares uno a uno, orden, `modelAnswer` sin autocorrección, imagen `https` o relativa, ids estables, claves desconocidas prohibidas, coherencia de respuestas y validación contra el esquema del proyecto cuando la herramienta pueda ejecutarla. Decir explícitamente que eso no garantiza que otra generación sea válida. `src/ai-prompt.js` exporta ese texto exacto, incluido el salto de línea final del archivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ai-prompt.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prompts/system-prompt-json-v1.md src/ai-prompt.js test/ai-prompt.test.js
git commit -m "docs: add the JSON v1 system prompt"
```

### Task 8: UI, ajustes, PWA y README

**Files:**
- Modify: `index.html`, `app.js`, `style.css`, `sw.js`, `README.md`
- Test: `test/library-ui-source.test.js`, `test/sw-precache.test.js`
- Create: ninguno más.

**Interfaces:**
- Consumes: `createLibrary`, `renderLibrary`, `SYSTEM_PROMPT_JSON_V1`, `removalPreview`.
- Produces: la pantalla de subida usa la biblioteca. El examen puntúa por id.

- [ ] **Step 1: Write the failing tests**

`test/sw-precache.test.js` lee `sw.js`, exige `testlab-v10`, exige las rutas `src/library.js`, `src/render-library.js` y `src/ai-prompt.js`, exige que cada asset distinto de `./` exista en disco y que ninguna ruta contenga `prompts/`.

`test/library-ui-source.test.js` lee `index.html` y `app.js`: el HTML no contiene `CSV 100% compatible`; contiene `JSON TestLab v1` y `no garantiza`; `app.js` asigna `ui.promptText.textContent = SYSTEM_PROMPT_JSON_V1`; no aparece `innerHTML` nuevo (el archivo sigue sin `innerHTML`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/sw-precache.test.js test/library-ui-source.test.js`

Expected: FAIL porque la caché sigue en `testlab-v9` y el ajuste sigue hablando de CSV.

- [ ] **Step 3: Write minimal implementation**

En el Repositorio: botón «Nueva carpeta», `<label for="library-sort">`, `<label for="import-folder">` con opción inicial Sin clasificar, y el contenedor `#history-list`.

Dos `<dialog class="modal">` con `aria-labelledby` y `h2`. El de edición usa `<form method="dialog">`, etiqueta visible y el botón de confirmar primero. El de borrado pone Cancelar primero y `autofocus` en Cancelar. No añadir `role="dialog"`. CSS: `dialog:modal` y `dialog::backdrop` con `overscroll-behavior: contain`. Las acciones de tarjeta hacen `flex-wrap`.

`app.js` crea `createLibrary(localStorage)`. Estado `currentFolderId` y `currentExamId`. Importar usa el valor del select (`''` → `null`). Abrir un test carga `getTest` y `coerceStoredQuestion`. `finishExam` llama a `updateScore(currentExamId, scoreLabel)`. Renombrar test sigue con `prompt`. Borrar tests y borrar carpeta abren el diálogo; Cancelar o Esc no borra. Seleccionar todo solo marca `.repo-checkbox` del nivel. Subir/Bajar llaman a `moveInOrder`.

Sustituir el párrafo de ajustes por: «Copia el prompt de sistema para que ChatGPT o Gemini generen JSON TestLab v1. Un modelo no garantiza el esquema: hay que validar el resultado.» Vaciar el `<pre id="prompt-text">` y rellenarlo al iniciar.

`sw.js`: `CACHE_NAME = 'testlab-v10'` y los tres módulos nuevos. No añadir el Markdown.

README: la sección Historial pasa a describir carpetas, `testlab-library`, ids derivados y que la lectura no reescribe. La sección del prompt apunta a `prompts/system-prompt-json-v1.md` y dice que la validación sigue haciendo falta. No borrar las limitaciones existentes; añadir que no hay papelera, que el orden es global y que las fechas ambiguas no se reinterpretan.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/sw-precache.test.js test/library-ui-source.test.js test/render-history.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html app.js style.css sw.js README.md test/sw-precache.test.js test/library-ui-source.test.js
git commit -m "feat: browse the library from the repository screen"
```

### Task 9: E2E en navegador

**Files:**
- Create: `e2e/library.spec.js`
- Modify: ninguno de `e2e/smoke.spec.js`.

**Interfaces:**
- Consumes: la UI de la Task 8 y `sample_exam.csv`.

- [ ] **Step 1: Write the failing test**

El spec cubre, en un solo recorrido principal más un viewport estrecho:

1. Sembrar antes de `goto` un `testlab-history` antiguo de una pregunta SINGLE «Rojo/Azul» con `correct: ['A']` y `date: '1/1/2020'`.
2. Ver ese banco en el Repositorio sin carpeta, abrirlo, contestar y volver.
3. Pegar dos JSON v1 de una pregunta cada uno y subir `sample_exam.csv` (5 preguntas).
4. Crear `Fluidos` y, dentro, `Tema 3`.
5. Mover un test importado a `Tema 3` con el diálogo y el teclado (`Tab` no es obligatorio si el foco entra en el select; sí `Enter` para confirmar).
6. Mover `Tema 3` a la raíz.
7. Con Manual, pulsar Subir en un test que no sea el primero, enfocando el botón y pulsando Enter, y comprobar que el orden cambia.
8. Cambiar el `<select>` Ordenar por a Nombre y a Última nota.
9. Abrir el test movido, modo estudio, responder, finalizar, y ver la nota en su carpeta.
10. `reload`, volver a entrar en la carpeta y ver test y nota.
11. Seleccionar tests y pulsar Borrar. En el diálogo, Cancelar con Enter (el foco inicial está en Cancelar) y comprobar que siguen. Repetir y confirmar Borrar.
12. Borrar una carpeta: el diálogo menciona el número de carpetas y de tests; confirmar; la carpeta desaparece.
13. El CSV antiguo sigue pudiendo empezarse (el paso 3 ya lo dejó en el repositorio; si el borrado del paso 11 lo eliminó, importarlo otra vez y pulsar Empezar examen).

Viewport `390x844`: «Nueva carpeta» y «Ordenar por» visibles.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/library.spec.js`

Expected: FAIL en el primer control que aún no cumpla el recorrido (o PASS si la Task 8 ya lo cumple). Si pasa a la primera, no se debilita el spec: se deja constancia de que la UI ya cubría el recorrido y se sigue con la Task 10. Si falla por un bug, se corrige con un test unitario rojo nuevo antes del parche.

- [ ] **Step 3: Fix only failures the unit tests missed**

Cada fallo de comportamiento nuevo se reproduce primero en `test/library.test.js` o `test/render-library.test.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/library.spec.js e2e/smoke.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/library.spec.js test src
git commit -m "test: walk the library in a real browser"
```

### Task 10: Verificación final

**Files:**
- Modify: solo lo que falle y esté dentro del alcance.

- [ ] **Step 1: Run the full local check**

Run: `npm run check`

Expected: exit 0. Recordar en la PR que `check:syntax` es `node --check` y `verify:static` solo copia a `dist/` y comprueba archivos no vacíos.

- [ ] **Step 2: Run e2e on the final HEAD**

Run: `npm run test:e2e`

Expected: exit 0. No afirmar que CI remoto está en verde: la PR anterior no tenía checks remotos.

- [ ] **Step 3: Review the diff**

`git diff 2bb16c6b87aa8585dd495b99ecd6edd6454bbea2` y corregir cualquier fallo Critical o Important con un test rojo primero. No ampliar el alcance.

- [ ] **Step 4: Push and open the PR**

`git push -u origin cursor/library-folders-addd` y PR con base `main`. El cuerpo describe diseño, uso, almacenamiento, prompt, comandos ejecutados con resultado, limitaciones, rama y HEAD. No merge y no despliegue.

---

## Self-review

- Cobertura del spec: navegación por migas (Task 6 y 8), carpetas sin límite y conteos (Task 2 y 5), un test en una sola carpeta (Task 3), importación opcional a Sin clasificar (Task 8), legado sin reescritura (Task 1), ids y nota homónima (Task 3), orden y fechas (Task 4), selección y borrado (Task 5, 6 y 8), examen intacto (Task 8 no toca `grade.js` ni `score.js`), prompt (Task 7), PWA (Task 8).
- `render-history.js` y `createRepository` no se reescriben.
- La posición de una carpeta nueva (al final) y `listFolders` están en el spec.
- No hay TBDs. Los tests de la Task 2 que necesitan `saveTest` para el conteo se ejecutan en la Task 3, donde `saveTest` ya es el comportamiento bajo prueba; la Task 2 no llama a `saveTest`.
