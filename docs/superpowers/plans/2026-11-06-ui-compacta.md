# UI compacta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la portada holgada por la biblioteca «Mis tests» y un diálogo de importación, con filas densas, examen legible y diálogos centrados por el navegador, sin cambiar la calificación ni el almacén.

**Architecture:** `index.html` y `style.css` son la cáscara. `app.js` sigue dueño de las pantallas, el examen y los diálogos, y llama a `createLibrary` / `renderLibrary` / `renderQuestion`. `src/library.js` solo cambia el nombre visible de la raíz. `src/render-library.js` pinta el vacío y las filas. `src/render-question.js` solo marca la opción elegida. El precache sube a `testlab-v11` cuando existen los iconos.

**Tech Stack:** HTML, CSS y módulos JS nativos. `npm test` es `node --test`. `npm run check` encadena sintaxis, ESLint, ejemplos, tests y `verify:static`. `npm run test:e2e` es Playwright 1.49 contra `serve` en el puerto 4173. Sin dependencias nuevas. PapaParse 5.4.1 y KaTeX 0.16.8 siguen en las etiquetas que ya hay.

## Global Constraints

- Partir de `81a30130dc8b1018828a03149af9a4e6a41dd6b7`. La rama de implementación es nueva, incluye este plan y `docs/superpowers/specs/2026-11-06-ui-compacta-design.md`, y no se corta de un `main` anterior. No se implementa en `cursor/ui-compacta-spec-5853`. La PR #3 no se fusiona.
- Título visible de la biblioteca: `Mis tests`. La interfaz no muestra la palabra «Repositorio». El prompt de `src/ai-prompt.js` no se reescribe.
- Claves intactas: `testlab-history`, `testlab-library`, `testlab-library-sort`, `testlab-theme`, `testlab-penalty`.
- No se editan `src/grade.js`, `src/score.js`, `src/csv-bank.js`, `src/json-bank.js`, `src/validate-bank.js`, `src/ai-prompt.js`, `prompts/system-prompt-json-v1.md` ni `src/render-history.js`.
- `canPreserveTextEntry` y el retorno `{ preserved: true }` no se reescriben. En revisión, la respuesta corta sigue `readOnly` y «La he acertado» / «La he fallado» siguen `disabled`.
- Fórmula intacta: `Math.max(0, correct - wrong * penalty) / total * 10`, penalización por defecto `0.33`.
- Gem: `https://gemini.google.com/gem/1kTBWN4ZZ0rlxpnbaalrRotSjX-vYZHcO?usp=sharing`. No hay generación en el cliente.
- Carpetas sin límite. Como máximo una carpeta por test. Sin papelera, búsqueda, cuentas ni sincronización. Renombrar un test sigue en `window.prompt` con «Introduce un nuevo nombre para este banco de preguntas:».
- No se añaden dependencias ni framework. Los diálogos se abren con `showModal()`. No hay `role="dialog"`, `aria-modal`, `command`/`commandfor` ni polyfill.
- `.modal` no declara `position`, `top`, `right`, `bottom`, `left`, `inset`, `inset-inline` ni `display`. Sí declara `margin: auto`, `transform: none`, `box-sizing: border-box`, `width` y `max-width` `min(32rem, calc(100vw - 32px))`, `height: fit-content`, `max-height: min(90dvh, 40rem)`, `overflow: auto`, `border: none`, `padding: 0`.
- Controles a 16px y 48px de alto mínimo. Espaciado de cáscara 8, 12 y 16px. Acento `#1d4ed8`. Tema oscuro si falta `testlab-theme`.
- TDD: el test nuevo se ejecuta y falla antes del código de producción de ese comportamiento. `npm test` no arrastra el navegador. La geometría va en `npm run test:e2e`.
- Si Playwright dice que falta el browser: `npx playwright install chromium` una vez y se relanza el mismo comando.

---

### Task 1: Centrado nativo de `.modal`

**Files:**
- Modify: `style.css` (regla `.modal`, hoy líneas 322-328, y `.modal-content` línea 330)
- Test: `test/modal-centering.test.js`
- Test: `e2e/modal-centering.spec.js`

**Interfaces:**
- Consumes: `#settings-btn` y `#settings-modal` ya existentes en `index.html`. `app.js` abre el diálogo con `ui.settingsModal.showModal()` dentro del click.
- Produces: la regla `.modal` descrita en Global Constraints. `.modal-content` con `width: 100%`, `box-sizing: border-box`, `padding: 16px` y sin `max-width`.

- [ ] **Step 1: Write the failing test**

Crear `test/modal-centering.test.js`:

```javascript
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
```

Crear `e2e/modal-centering.spec.js`:

```javascript
import { expect, test } from '@playwright/test';

test('native dialog centering clears the old fixed offsets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#settings-btn').click();
  const dialog = page.locator('#settings-modal');
  await expect(dialog).toBeVisible();
  const box = await dialog.evaluate((element) => {
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      position: style.position,
      top: style.top,
      right: style.right,
      bottom: style.bottom,
      left: style.left,
      transform: style.transform,
      marginTop: style.marginTop,
      marginRight: style.marginRight,
      marginBottom: style.marginBottom,
      marginLeft: style.marginLeft,
      display: style.display,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
    };
  });
  expect(box.position).toBe('fixed');
  expect(box.top).toBe('0px');
  expect(box.right).toBe('0px');
  expect(box.bottom).toBe('0px');
  expect(box.left).toBe('0px');
  expect(box.transform).toBe('none');
  expect(box.marginLeft).toBe(box.marginRight);
  expect(box.marginTop).toBe(box.marginBottom);
  expect(box.display).toBe('block');
  const viewport = page.viewportSize();
  expect(Math.abs(box.rect.x + box.rect.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.rect.y + box.rect.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  expect(box.rect.x).toBeGreaterThanOrEqual(0);
  expect(box.rect.y).toBeGreaterThanOrEqual(0);
  expect(box.rect.right).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.rect.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#settings-btn')).toBeFocused();
  await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).display)).toBe('none');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/modal-centering.test.js`

Expected: FAIL. La regla actual contiene `top: 50%` y `doesNotMatch` lanza.

Run: `npx playwright test e2e/modal-centering.spec.js`

Expected: FAIL. `transform` no es `none` (es una matriz del `translate(-50%, -50%)`) o `top` no es `0px`, y el borde derecho supera 320.

- [ ] **Step 3: Write the minimal CSS**

Sustituir la regla `.modal` de `style.css` por el bloque de Global Constraints. En `.modal-content`, quitar cualquier ancho fijo y dejar:

```css
.modal-content {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 16px;
  color: var(--text-primary);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
```

No añadir `display` ni `position` a `dialog` ni a `.modal`. Conservar `dialog:modal { overscroll-behavior: contain; }` y en `dialog::backdrop` añadir `overflow: hidden` junto al `overscroll-behavior: contain` y el `backdrop-filter: blur(4px)` que ya existen.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/modal-centering.test.js`

Expected: PASS.

Run: `npx playwright test e2e/modal-centering.spec.js`

Expected: PASS. El diálogo de ajustes cabe en 320×568, centrado, y Escape devuelve el foco a `#settings-btn`.

- [ ] **Step 5: Commit**

```bash
git add style.css test/modal-centering.test.js e2e/modal-centering.spec.js
git commit -m "fix: center dialogs with the user agent anchors"
```

---

### Task 2: Pantallas inactivas y scroll del documento

**Files:**
- Modify: `index.html` (los cuatro `<main class="screen">` que no son `#upload-screen`)
- Modify: `style.css` (`body`, `.screen`, `.screen.active`, `#upload-screen`, `.history-list`)
- Modify: `app.js` (`showScreen`, líneas 251-255; `SCREEN_TITLES.upload`)
- Test: `test/screen-visibility.test.js`
- Test: `e2e/compact-shell.spec.js`

**Interfaces:**
- Consumes: `screens` en `app.js` (`upload`, `mode`, `exam`, `loading`, `results`) y `SCREEN_TITLES`.
- Produces: `showScreen(name)` pone `hidden` en las inactivas y lo quita en la activa. `document.title` de `upload` pasa a `TestLab — Mis tests`.

- [ ] **Step 1: Write the failing test**

Crear `test/screen-visibility.test.js`:

```javascript
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
```

Crear `e2e/compact-shell.spec.js` con un test `inactive screens stay out of the accessibility tree`:

```javascript
import { expect, test } from '@playwright/test';

test('inactive screens stay out of the accessibility tree', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.locator('body').evaluate((element) => getComputedStyle(element).overflow);
  expect(overflow).not.toBe('hidden');
  for (const id of ['mode-screen', 'exam-screen', 'loading-screen', 'results-screen']) {
    const screen = page.locator(`#${id}`);
    await expect(screen).toBeHidden();
    await expect.poll(() => screen.evaluate((element) => getComputedStyle(element).display)).toBe('none');
  }
  await expect(page.getByRole('heading', { name: '¿Cómo quieres estudiar?' })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/screen-visibility.test.js`

Expected: FAIL. Los `<main>` inactivos no tienen `hidden` y `body` contiene `overflow: hidden`.

- [ ] **Step 3: Implement the shell contract**

En `index.html`, los `<main id="mode-screen">`, `exam-screen`, `loading-screen` y `results-screen` quedan `<main id="…" class="screen" hidden>`. `#upload-screen` sigue sin `hidden`.

En `style.css`, quitar `overflow: hidden` de `body`. Quitar `position: fixed; inset: 0` de `.screen`. La regla de display pasa a:

```css
.screen { position: relative; min-height: 100dvh; }
.screen:not([hidden]) { display: flex; }
.screen[hidden] { display: none !important; }
```

Quitar la transición que deja las inactivas en `opacity: 0` sin `hidden`. `#upload-screen` no lleva `position: fixed` ni `padding-top: 5vh`. `.history-list` pierde `max-height` y `overflow-y`.

Sustituir `showScreen`:

```javascript
function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    const active = key === name;
    screen.classList.toggle('active', active);
    screen.toggleAttribute('hidden', !active);
  });
  document.title = SCREEN_TITLES[name];
}
```

`SCREEN_TITLES.upload` pasa a `'TestLab — Mis tests'`. Las otras cuatro cadenas se quedan.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/screen-visibility.test.js`

Expected: PASS.

Run: `npx playwright test e2e/compact-shell.spec.js`

Expected: PASS. `body` no tiene `overflow: hidden` y las cuatro pantallas calculan `display: none`.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css app.js test/screen-visibility.test.js e2e/compact-shell.spec.js
git commit -m "fix: hide inactive screens and let the document scroll"
```

---

### Task 3: La raíz visible se llama Mis tests

**Files:**
- Modify: `src/library.js` (línea 68 y línea 619)
- Modify: `test/library.test.js` (las aserciones de `'Repositorio'` en las líneas 65, 105 y 153)
- Modify: `app.js` (`emptyLabel: 'Repositorio'` en `move-folder`, línea 662)

**Interfaces:**
- Consumes: `createLibrary(storage, now?, ids?)`, `view(folderId)`, `breadcrumbTrail`.
- Produces: `view(null).breadcrumbs[0].name === 'Mis tests'` también cuando el índice está bloqueado. `moveFolder` hacia la raíz sigue usando `parentId === null`; solo cambia la etiqueta del `<option>`.

- [ ] **Step 1: Write the failing test**

En `test/library.test.js`, sustituir las tres expectativas `'Repositorio'` de las migas por `'Mis tests'`. No cambiar ids, orden ni claves. Ejemplo de la raíz vacía, que hoy es:

```javascript
assert.deepEqual(view.breadcrumbs, [{ id: null, name: 'Repositorio' }]);
```

y pasa a:

```javascript
assert.deepEqual(view.breadcrumbs, [{ id: null, name: 'Mis tests' }]);
```

El mismo cambio en el array `['Repositorio', 'Ingeniería de Fluidos', 'Tema 3', 'Nota']` y en `['Repositorio', 'Huérfana']`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/library.test.js`

Expected: FAIL. `view.breadcrumbs[0].name` sigue siendo `'Repositorio'`.

- [ ] **Step 3: Change the two display strings**

En `src/library.js`, las dos cadenas `name: 'Repositorio'` de la miga de raíz pasan a `name: 'Mis tests'`. No se escribe `testlab-library` ni `testlab-history` por ese cambio.

En `app.js`, el `openLibraryDialog` de `move-folder` usa `emptyLabel: 'Mis tests'`. El de mover un test sigue con `emptyLabel: 'Sin clasificar'`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/library.test.js`

Expected: PASS. Leer sigue sin escribir: los tests que comparan `storage.getItem('testlab-history')` antes y después de `view` siguen igual.

- [ ] **Step 5: Commit**

```bash
git add src/library.js test/library.test.js app.js
git commit -m "fix: name the library root Mis tests"
```

---

### Task 4: Vacío y filas de la biblioteca

**Files:**
- Modify: `src/render-library.js`
- Modify: `test/render-library.test.js`
- Modify: `app.js` (`renderHistory` y `onLibraryClick`)

**Interfaces:**
- Consumes: `renderLibrary(container, view)` con `{ breadcrumbs, folders, tests, sort }`. Cada folder trae `id`, `name`, `testCount`. Cada test trae `id`, `name`, `date`, `lastScore`, `questionCount`.
- Produces: en la raíz no hay `<nav>`. El vacío de raíz tiene `#empty-import` y `#empty-folder`. Una fila no anida el botón de abrir dentro de `<details>`. `onLibraryClick` sigue despachando `open-folder`, `start`, `rename-folder`, `move-folder`, `rename-test`, `move-test`, `move-up`, `move-down`, `delete-folder`.

- [ ] **Step 1: Write the failing test**

Reescribir las expectativas de `test/render-library.test.js` sin relajar el caso hostil. El primer test sigue exigiendo cero `img` y cero `b`, el texto literal del nombre hostil, `3 tests`, `2 preguntas`, `Sin realizar`, una sola casilla `Seleccionar ${hostileTest}` y que la primera `article` (la carpeta) no contenga un `input`. Cambia las búsquedas así:

```javascript
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
```

La fixture de migas usa `{ id: null, name: 'Mis tests' }`. El test de orden conserva Subir/Bajar `disabled` fuera de `manual` y en los extremos, y el `<h3>` «Sin clasificar» solo en la raíz con tests. El test de vacío queda:

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/render-library.test.js`

Expected: FAIL. El vacío sigue diciendo `Repositorio vacío.` y no existe `#empty-import`.

- [ ] **Step 3: Implement the renderer and the two wirings**

`renderLibrary` omite el `<nav>` cuando `breadcrumbs.length === 1`. En cualquier nivel vacío, después del nav si lo hay, pinta:

```html
<div class="library-empty">
  <p>…texto de arriba…</p>
  <button type="button" id="empty-import" class="nav-btn primary">Importar test</button>
  <button type="button" id="empty-folder" class="nav-btn">Crear carpeta</button>
</div>
```

La fila de carpeta es un `<article class="library-row">` con un botón `data-action="open-folder"` y `aria-label` `Abrir ${name}`, y un `<details class="library-menu">` hermano cuyo `summary` dice `Acciones` y `aria-label` `Acciones de ${name}`. Dentro, los cinco botones actuales con sus `aria-label` y `movementDisabled`. La fila de test pone el checkbox en un `<label>` hermano, fuera del botón `data-action="start"` con `aria-label` `Empezar ${name}`. Su menú tiene renombrar, mover, subir y bajar, y no tiene borrar. Nombres y cuentas siguen por `textContent`. El `<h3 class="library-group">Sin clasificar</h3>` se mantiene en la raíz cuando hay tests.

CSS nuevo, sin tocar la lógica:

```css
.library-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 48px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-raised);
}
.library-row .library-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.library-menu summary { min-width: 48px; min-height: 48px; }
.library-empty { display: flex; flex-direction: column; gap: 8px; }
```

Esta task no enlaza los botones del vacío: `#empty-import` y `#empty-folder` solo tienen que existir en el DOM que pinta `renderLibrary`. El click se une en la Task 5, dentro de `renderHistory`, cuando `#import-dialog` ya está en la página. El cierre de los demás `<details>` también va en esa función:

```javascript
ui.historyList.querySelector('#empty-import')?.addEventListener('click', () => ui.importDialog.showModal());
ui.historyList.querySelector('#empty-folder')?.addEventListener('click', openNewFolderDialog);
ui.historyList.querySelectorAll('details.library-menu').forEach((menu) => {
  menu.addEventListener('toggle', () => {
    if (!menu.open) return;
    ui.historyList.querySelectorAll('details.library-menu[open]').forEach((other) => {
      if (other !== menu) other.removeAttribute('open');
    });
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/render-library.test.js test/library.test.js`

Expected: PASS. El nombre hostil sigue siendo texto.

- [ ] **Step 5: Commit**

```bash
git add src/render-library.js test/render-library.test.js style.css
git commit -m "feat: render dense library rows and the empty state"
```

---

### Task 5: Cáscara de inicio y diálogo de importación

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `app.js` (`ui`, `init`, `showImportNotes`, `deleteSelectedExams`, `handleMultipleFiles`)
- Modify: `test/library-ui-source.test.js`
- Test: `e2e/import-dialog.spec.js`

**Interfaces:**
- Consumes: `handleMultipleFiles`, `importBankText`, `rememberBank(name, parsed, notes)`, `fillSelect(select, folders, emptyLabel, selected = select.value)`, `PAPA_OPTIONS`.
- Produces: `#import-btn`, `#import-dialog`, `#choose-files-btn`, `#file-input`, `#paste-input`, `#load-paste-btn`, `#import-folder`, `#import-errors`. El toast de éxito es `Añadido a Mis tests`. La confirmación de tests es ``¿Seguro que deseas borrar ${countLabel(n, 'test', 'tests')}? Esta acción no se puede deshacer.``

- [ ] **Step 1: Write the failing test**

Añadir a `test/library-ui-source.test.js`:

```javascript
test('home is the library and import lives in a dialog', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="library-title">Mis tests</);
  assert.match(html, /id="import-btn"/);
  assert.match(html, /id="import-dialog"/);
  assert.match(html, /id="choose-files-btn"[^>]*autofocus/);
  assert.match(html, /Uno o más archivos \.csv o \.json\. También vale un \.txt con ese mismo contenido\./);
  assert.match(html, /El Gem es un recurso externo y opcional\. TestLab no genera las preguntas\./);
  assert.match(html, /https:\/\/gemini\.google\.com\/gem\/1kTBWN4ZZ0rlxpnbaalrRotSjX-vYZHcO\?usp=sharing/);
  assert.doesNotMatch(html, /Convierte tus apuntes en exámenes interactivos/);
  assert.doesNotMatch(html, /Añadir al Repositorio/);
  assert.doesNotMatch(html, />Repositorio</);
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /Añadido a Mis tests/);
  assert.match(app, /¿Seguro que deseas borrar \$\{countLabel\(selected\.length, 'test', 'tests'\)\}\?/);
});
```

Crear `e2e/import-dialog.spec.js`. El test `paste and files keep the chosen folder`:

```javascript
import { expect, test } from '@playwright/test';

test('paste and files keep the chosen folder', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mis tests' })).toBeVisible();
  await expect(page.locator('#empty-import')).toBeVisible();
  await page.locator('#empty-import').click();
  const dialog = page.locator('#import-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#paste-input').fill(`${'pregunta\n'.repeat(40)}{"schemaVersion":1,"title":"Largo","questions":[{"type":"SINGLE","prompt":"¿Sí?","choices":[{"id":"A","text":"Sí"},{"id":"B","text":"No"}],"answer":"A"}]}`);
  await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const add = dialog.getByRole('button', { name: 'Añadir texto' });
  const folder = dialog.getByLabel('Guardar en');
  await expect(add).toBeVisible();
  await expect(folder).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Nueva carpeta' }).click();
  await page.getByRole('dialog', { name: 'Nueva carpeta' }).getByLabel('Nombre').fill('Fluidos');
  await page.keyboard.press('Enter');
  await page.locator('#import-btn').click();
  await page.getByLabel('Guardar en').selectOption({ label: 'Fluidos' });
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Dentro',
    questions: [{ type: 'SINGLE', prompt: '¿Sí?', choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }], answer: 'A' }]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.getByText('Añadido a Mis tests')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir Fluidos' }).click();
  await expect(page.getByRole('button', { name: 'Empezar Dentro' })).toBeVisible();
  await page.locator('#import-btn').click();
  await expect(page.getByLabel('Guardar en')).toHaveValue(/.+/);
});
```

El JSON pegado del caso de 40 líneas es inválido a propósito en el prefijo y válido al final solo si `importBankText` acepta el documento completo. No uses ese relleno como banco. El relleno de 40 líneas es texto que no es un banco, para forzar el scroll, y se hace antes de Escape, sin pulsar «Añadir texto». El banco válido es el segundo pegado.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/library-ui-source.test.js`

Expected: FAIL. `index.html` no tiene `id="library-title"` y todavía contiene el subtítulo.

- [ ] **Step 3: Implement the home and the import dialog**

Quitar de `#upload-screen` el bloque `.brand` (icono, `h1` suelto y subtítulo), `#drop-zone` de la página, el botón «Pegar texto manualmente» y el enlace Gem de la columna izquierda. La columna queda así:

```html
<header class="app-header">
  <p class="wordmark">TestLab</p>
  <div class="header-actions">
    <button id="settings-btn" class="icon-toggle" type="button" aria-label="Ajustes">…svg…</button>
    <button id="theme-toggle" class="icon-toggle" type="button" aria-label="Cambiar tema">…svg…</button>
  </div>
</header>
<div class="library-column">
  <h1 id="library-title">Mis tests</h1>
  <div class="library-toolbar">
    <button type="button" id="import-btn" class="nav-btn primary">Importar test</button>
    <button type="button" id="new-folder-btn" class="nav-btn">Nueva carpeta</button>
    <div class="library-field">
      <label for="library-sort">Ordenar por</label>
      <select id="library-sort">…las cuatro options actuales…</select>
    </div>
    <button type="button" id="select-all-btn" class="nav-btn">Seleccionar todo</button>
    <button type="button" id="delete-selected-btn" class="nav-btn hidden">Borrar seleccionados</button>
  </div>
  <div id="history-list" class="history-list"></div>
</div>
```

El `<dialog id="import-dialog" class="modal" aria-labelledby="import-dialog-title">` contiene, en este orden: título «Importar test», botón `aria-label="Cerrar"`, `#choose-files-btn` con `autofocus` y texto «Elegir archivos», `#file-input` con `accept=".csv,.json,.txt,text/csv,application/json,text/plain"` y `multiple`, la ayuda literal del test, una zona `#drop-zone` dentro del diálogo, `<label for="paste-input">Pegar CSV o JSON v1</label>`, `#paste-input` con el placeholder de dos líneas del spec, `#load-paste-btn` «Añadir texto» `disabled`, `<label for="import-folder">Guardar en</label>`, `#import-folder` con la option inicial «Sin clasificar» `value=""`, `#import-errors` con `role="alert"`, y el enlace Gem con el texto «El Gem es un recurso externo y opcional. TestLab no genera las preguntas.» Los botones de archivo y de pegar son `type="button"`. No hay `<form method="dialog">` en este diálogo.

`app.js`: `ui.importDialog = $('import-dialog')`, `ui.importBtn = $('import-btn')`, `ui.chooseFilesBtn = $('choose-files-btn')`. El click de `#import-btn` y de `#choose-files-btn` hace lo que hoy hacen el drop y `#browse-btn`. Los listeners de arrastre pasan de la página al `#drop-zone` del diálogo. Se eliminan `#toggle-paste-btn` y la clase que ocultaba `#paste-collapse`. `showImportNotes` usa `'Añadido a Mis tests'`. `deleteSelectedExams` usa la plantilla con `countLabel`. `renderHistory` pone o quita `aria-current="page"` en `#library-title` según `currentFolderId == null`, enlaza `#empty-import` y `#empty-folder`, y cierra los otros `<details class="library-menu">` al abrir uno, con el bloque escrito en la Task 4.

CSS de la barra por debajo de 768px: rejilla de dos columnas, gap 8px; `.library-field` ocupa las dos columnas. Desde 768px, `flex-wrap: wrap`. La columna de la biblioteca: `width: 100%`, `max-width: 960px`, `margin-inline: auto`, `padding: 16px`. `.nav-btn`, inputs, selects, textarea y `summary`: `font-size: 16px` y `min-height: 48px`. Iconos de cabecera: 48×48. Migas: `min-width: 0`, `max-width: 100%`, `overflow-x: auto`.

Tokens de `:root` y `[data-theme="light"]` como la tabla del spec (`--accent: #1d4ed8`, `--text-secondary: #c8c8cd` en oscuro, `--text-tertiary: #64748b` en claro, `--focus: #93c5fd` en oscuro y `#1d4ed8` en claro). El anillo `:focus-visible` usa `var(--focus)`. `#paste-input` no pone `outline: none`.

El `<meta name="viewport">` queda `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/library-ui-source.test.js test/render-library.test.js`

Expected: PASS.

Run: `npx playwright test e2e/import-dialog.spec.js e2e/modal-centering.spec.js`

Expected: PASS. El diálogo largo se desplaza hasta «Guardar en» y «Añadir texto». El destino «Fluidos» se conserva al reabrir.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css app.js test/library-ui-source.test.js e2e/import-dialog.spec.js
git commit -m "feat: make the library the home and import from a dialog"
```

---

### Task 6: Modo de estudio en dos opciones comparables

**Files:**
- Modify: `index.html` (`#mode-screen`)
- Modify: `style.css` (`.mode-layout`, `.mode-card`)
- Test: `e2e/mode-layout.spec.js`

**Interfaces:**
- Consumes: `#mode-study` y `#mode-exam` siguen llamando a `startExam` desde `init`. `#back-to-upload` sigue haciendo `showScreen('upload')`. `#question-count-label` lo escribe `loadFromHistory` como `` `${questions.length} preguntas pre-cargadas` ``.
- Produces: textos visibles «Volver», «Modo Estudio», «Feedback inmediato tras cada respuesta.», «Modo Examen», «Responde todo y revisa al final.» El botón de vuelta tiene `aria-label="Volver a Mis tests"`.

- [ ] **Step 1: Write the failing test**

```javascript
import { expect, test } from '@playwright/test';

async function openMode(page) {
  await page.goto('/');
  await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Modo',
    questions: [{ type: 'SINGLE', prompt: '¿Sí?', choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }], answer: 'A' }]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Empezar Modo' }).click();
}

test('mode choices sit side by side from 768px and stack below', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await openMode(page);
  const study = await page.locator('#mode-study').boundingBox();
  const exam = await page.locator('#mode-exam').boundingBox();
  expect(Math.abs(study.y - exam.y)).toBeLessThanOrEqual(2);
  expect(study.height).toBeGreaterThanOrEqual(48);
  await page.setViewportSize({ width: 320, height: 568 });
  const stackedStudy = await page.locator('#mode-study').boundingBox();
  const stackedExam = await page.locator('#mode-exam').boundingBox();
  expect(stackedExam.y).toBeGreaterThan(stackedStudy.y + stackedStudy.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Volver a Mis tests' })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/mode-layout.spec.js`

Expected: FAIL. A 768px las dos tarjetas siguen en columna (`exam.y` mayor que `study.y`) o el botón no se llama «Volver a Mis tests».

- [ ] **Step 3: Implement the mode layout**

Sustituir el texto de las dos tarjetas por las frases de la interfaz. El botón `#back-to-upload` muestra «Volver» y `aria-label="Volver a Mis tests"`. Quitar la flecha y el `transform` de hover.

```css
.mode-layout { width: 100%; max-width: 720px; padding: 16px; }
.mode-cards { display: flex; flex-direction: column; gap: 12px; }
.mode-card { min-height: 48px; padding: 12px 16px; width: 100%; }
@media (min-width: 768px) {
  .mode-cards { display: grid; grid-template-columns: 1fr 1fr; }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test e2e/mode-layout.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css e2e/mode-layout.spec.js
git commit -m "feat: compare study and exam modes in one row on desktop"
```

---

### Task 7: Examen con salida, progreso y barra que cabe

**Files:**
- Modify: `index.html` (`#exam-screen`)
- Modify: `style.css` (`.exam-topbar`, `.exam-bottombar`, `progress`)
- Modify: `app.js` (`renderCurrent`, quitar `ui.progressFill`)
- Modify: `src/render-question.js` (`renderChoices` únicamente)
- Test: `test/render-question.test.js` (añadir un caso; no editar los de caret)
- Test: `e2e/exam-bar.spec.js`

**Interfaces:**
- Consumes: `countsAsAnswered(question, answer)` de `src/session.js`. `renderCurrent` ya calcula `answeredCount` con ese predicado. `updateNavButtons` no cambia qué botones enseña.
- Produces: `<progress id="exam-progress" aria-label="Progreso del examen">` con `max = questions.length` y `value = answeredCount`. `#quit-btn` muestra «Salir». En `SINGLE` y `MULTIPLE`, la opción pulsada tiene `aria-pressed="true"`, el carácter «✓» y un `<span class="visually-hidden">Seleccionada</span>`.

- [ ] **Step 1: Write the failing test**

Añadir a `test/render-question.test.js` un caso que monte un `SINGLE` con respuesta `['A']` y `reveal: false`, y afirme: la lista tiene `role="group"`, el enunciado tiene id `q0-prompt`, `aria-pressed` de A es `true`, el texto contiene `✓` y `Seleccionada`, y el de B es `aria-pressed="false"` sin ese span. Un `TRUE_FALSE` sigue teniendo un `input[type="radio"]` y no un `.option-btn`.

Crear `e2e/exam-bar.spec.js`:

```javascript
test('exam bar stays inside 320px and progress is semantic', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(JSON.stringify({
    schemaVersion: 1,
    title: 'Barra',
    questions: [
      { type: 'MULTIPLE', prompt: 'Elige', choices: [{ id: 'A', text: 'Uno' }, { id: 'B', text: 'Dos' }], answer: ['A'] },
      { type: 'SINGLE', prompt: '¿Sí?', choices: [{ id: 'A', text: 'Sí' }, { id: 'B', text: 'No' }], answer: 'A' }
    ]
  }));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await page.getByRole('button', { name: 'Empezar Barra' }).click();
  await page.getByRole('button', { name: 'Modo Estudio' }).click();
  const progress = page.locator('#exam-progress');
  await expect(progress).toHaveAttribute('max', '2');
  await expect(progress).toHaveAttribute('aria-label', 'Progreso del examen');
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
  await page.getByRole('button', { name: 'A Uno' }).click();
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(progress).toHaveAttribute('value', '1');
  const bar = page.locator('.exam-bottombar');
  const widths = await bar.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
```

El nombre accesible del botón de opción debe incluir la letra y el texto, porque `renderChoices` mete ambos en el botón. Ajustar el localizador a `getByRole('button', { name: /Uno/ })` si la letra va delante: el botón contiene `A`, `Uno` y, al elegirlo, `Seleccionada`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/render-question.test.js`

Expected: FAIL. El caso nuevo no encuentra `role="group"` o `Seleccionada` en un `SINGLE`.

Run: `npx playwright test e2e/exam-bar.spec.js`

Expected: FAIL. No existe `#exam-progress` o el botón de salida no se llama «Salir».

- [ ] **Step 3: Implement exam chrome and the choice mark**

En `#exam-screen`, `#quit-btn` incluye el texto `Salir`. Sustituir `.progress-track` / `#progress-fill` por:

```html
<progress id="exam-progress" aria-label="Progreso del examen" max="1" value="0"></progress>
```

En `renderCurrent`, borrar la asignación a `progressFill.style.width`. Poner:

```javascript
ui.examProgress.max = questions.length;
ui.examProgress.value = answeredCount;
```

`ui.examProgress = $('exam-progress')` y se elimina `progressFill`.

CSS de la barra, copiado del spec:

```css
.exam-bottombar { display: flex; flex-wrap: wrap; gap: 8px; position: sticky; bottom: 0; background: var(--bg); padding-top: 8px; padding-bottom: max(8px, env(safe-area-inset-bottom)); }
.exam-bottombar .nav-btn { min-height: 48px; font-size: 16px; flex: 1 1 calc(50% - 8px); white-space: nowrap; }
.exam-bottombar .nav-btn.primary { flex-basis: 100%; }
.question-area { overflow-y: auto; min-height: 0; scroll-padding-bottom: 64px; }
progress.exam-progress, #exam-progress {
  appearance: none;
  border: 0 solid;
  overflow: clip;
  width: 100%;
  height: 8px;
  background: var(--bg-element);
}
#exam-progress::-webkit-progress-bar { background: transparent; }
#exam-progress::-webkit-progress-value { background: var(--accent-bar); }
#exam-progress::-moz-progress-bar { background: var(--accent-bar); }
```

Las reglas `::-webkit-progress-value` y `::-moz-progress-bar` van separadas. `--accent-bar` es `#93c5fd` en oscuro y `#1d4ed8` en claro.

En `renderChoices`, el `<p class="question-text">` del enunciado (se crea antes del switch, en `renderQuestion`) recibe `id = ${ctx.idPrefix}-prompt`. La lista:

```javascript
list.setAttribute('role', 'group');
list.setAttribute('aria-labelledby', `${ctx.idPrefix}-prompt`);
```

Después de marcar `aria-pressed`, si `pressed`, añadir el span `visually-hidden` con texto `Seleccionada` y, también en `SINGLE`, el span `.checkbox-icon` con `✓` que `MULTIPLE` ya añade. No cambiar el `click` ni la forma del array de respuesta. No entrar en `renderShort`, `canPreserveTextEntry` ni `renderTrueFalse`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/render-question.test.js test/text-entry.test.js`

Expected: PASS. Los tests de caret existentes no se han editado y siguen pasando.

Run: `npx playwright test e2e/exam-bar.spec.js`

Expected: PASS.

`e2e/text-entry.spec.js` sigue usando «Añadir al Repositorio» hasta la Task 11. No se lanza como puerta de esta task. Si se lanza y falla dentro de la revisión (`readOnly`, «MUTACION» o la nota), parar: eso no se arregla cambiando el localizador.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css app.js src/render-question.js test/render-question.test.js e2e/exam-bar.spec.js
git commit -m "feat: show exam progress and a wrapping action bar"
```

---

### Task 8: Resultados compactos

**Files:**
- Modify: `index.html` (`#restart-btn`, `.score-ring`)
- Modify: `style.css` (`.score-ring` de 140px a 96px, `.results-layout` `max-width: 480px`)
- Test: `e2e/results-layout.spec.js`

**Interfaces:**
- Consumes: `finishExam` escribe `result.scoreLabel` en `#final-score`, el detalle con `✅`, `❌`, `⏭️` y `(Penaliza: -${penaltyFactor})`, y el trazo `var(--incorrect)` si `scoreOutOf10 < 5`, si no `var(--accent)`. `circumference` sigue `2 * Math.PI * 52`.
- Produces: `#restart-btn` con texto `Volver a Mis tests`, mismo `resetApp`. «Descargar Reporte IA» y «Ver detalles» no cambian de id ni de handler.

- [ ] **Step 1: Write the failing test**

Un examen de una `SINGLE` contestada bien acaba en resultados. Afirmar que `#final-score` es `10`, `#score-detail` contiene `(Penaliza: -0.33)`, el botón «Volver a Mis tests» está visible, y la caja de `.score-ring` mide entre 90 y 102 px. No afirmar un porcentaje.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/results-layout.spec.js`

Expected: FAIL. El botón sigue diciendo `Salir` o el anillo mide 140px.

- [ ] **Step 3: Implement the results chrome**

Cambiar el texto de `#restart-btn` a `Volver a Mis tests`. `.score-ring { width: 96px; height: 96px; }`. `.results-layout { max-width: 480px; }`. No editar `finishExam` ni `src/score.js`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test e2e/results-layout.spec.js`

Expected: PASS. La nota visible es `10` y el detalle conserva la penalización `0.33`.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css e2e/results-layout.spec.js
git commit -m "feat: tighten the results summary"
```

---

### Task 9: Ajustes, prompt y cierre de diálogos

**Files:**
- Modify: `index.html` (`#settings-modal`, `#ai-prompt-modal`, botones de cierre)
- Modify: `app.js` solo si un botón de cierre no llama ya a `close()`
- Test: `test/library-ui-source.test.js` (otro `test()`)
- Test: el de foco de Task 1 ya cubre Escape en ajustes; añadir `e2e/dialog-focus.spec.js` para el prompt

**Interfaces:**
- Consumes: `openLibraryDialog` ya hace `focus()` en el nombre o en el destino después de `showModal()`. No añadir un listener de `close` que mueva el foco.
- Produces: `#settings-modal` con `aria-labelledby="settings-title"`, `#penalty-input` con `autofocus`. `#ai-prompt-modal` con `aria-labelledby="prompt-title"`. `#copy-prompt-btn` con `autofocus`. Los cierres son `<button type="button" aria-label="Cerrar">`.

- [ ] **Step 1: Write the failing test**

```javascript
test('settings and the prompt dialog name themselves', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="settings-modal"[^>]*aria-labelledby="settings-title"/);
  assert.match(html, /id="settings-title">Ajustes</);
  assert.match(html, /id="penalty-input"[^>]*autofocus/);
  assert.match(html, /id="ai-prompt-modal"[^>]*aria-labelledby="prompt-title"/);
  assert.match(html, /id="prompt-title">Prompt para IA</);
  assert.match(html, /id="copy-prompt-btn"[^>]*autofocus/);
  assert.doesNotMatch(html, /role="dialog"/);
  assert.doesNotMatch(html, /aria-modal/);
});
```

Y en `e2e/dialog-focus.spec.js`: abrir «Ver Prompt de IA», el foco está en `#copy-prompt-btn`, Escape devuelve el foco a `#open-ai-prompt`, y el diálogo calcula `display: none`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/library-ui-source.test.js`

Expected: FAIL en el test nuevo. Los tests viejos de esa archivo, si buscan ids que siguen, pasan.

- [ ] **Step 3: Add the names and the initial focus**

Poner los atributos de arriba. `#penalty-input` puede quedarse con `autofocus` además del foco que el navegador ya da al abrir ajustes; no hace falta un `focus()` nuevo en `app.js` si el atributo está. El cierre de ajustes y del prompt llama a `close()` como ya hace el listener, y el botón tiene `aria-label="Cerrar"`. No registrar `role="dialog"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/library-ui-source.test.js`

Expected: PASS.

Run: `npx playwright test e2e/dialog-focus.spec.js e2e/modal-centering.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html app.js test/library-ui-source.test.js e2e/dialog-focus.spec.js
git commit -m "fix: name settings and prompt dialogs"
```

---

### Task 10: Iconos, manifiesto y precache v11

**Files:**
- Create: `favicon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-192.png`, `icons/icon-maskable-512.png`
- Create: `scripts/write-pwa-icons.js` (se queda; no es una dependencia)
- Modify: `manifest.json`, `index.html`, `sw.js`, `test/sw-precache.test.js`
- Test: `test/pwa-icons.test.js`

**Interfaces:**
- Consumes: `test/sw-precache.test.js` ya exige que cada ruta de `ASSETS` exista y hoy busca `testlab-v10`.
- Produces: `CACHE_NAME = 'testlab-v11'`. `ASSETS` incluye `./favicon.svg`, `./manifest.json` y los cuatro PNG. El manifiesto no menciona `icon.png`. `theme_color` y el `<meta name="theme-color">` son `#1d4ed8`. `background_color` es `#111113`. `name` es `TestLab`.

- [ ] **Step 1: Write the failing test**

```javascript
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
```

En `test/sw-precache.test.js`, la expectativa `testlab-v10` pasa a `testlab-v11`.

Crear `e2e/pwa-assets.spec.js`:

```javascript
import { expect, test } from '@playwright/test';

test('pwa assets respond and the manifest drops icon.png', async ({ page }) => {
  for (const path of [
    '/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-192.png',
    '/icons/icon-maskable-512.png',
    '/manifest.json'
  ]) {
    const response = await page.request.get(path);
    expect(response.ok(), path).toBe(true);
  }
  const manifest = await (await page.request.get('/manifest.json')).text();
  expect(manifest).not.toContain('icon.png');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/pwa-icons.test.js test/sw-precache.test.js`

Expected: FAIL. `icons/icon-192.png` no existe o el precache sigue en `testlab-v10`.

Run: `npx playwright test e2e/pwa-assets.spec.js`

Expected: FAIL. `/favicon.svg` o un PNG responde 404.

- [ ] **Step 3: Write the files**

`favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#1d4ed8"/>
  <path d="M8 8h16v3H11v4h10v3H11v6H8z" fill="#ffffff"/>
</svg>
```

`scripts/write-pwa-icons.js` usa `node:zlib` `deflateSync` y escribe un PNG RGBA. Los `any` llevan fondo transparente y un rectángulo azul `#1d4ed8` centrado. Los `maskable` llevan fondo `#111113` hasta el borde y el rectángulo azul solo entre el 10% y el 90% de cada lado. IHDR ancho y alto son los del nombre del archivo. Ejecutar `node scripts/write-pwa-icons.js`.

`manifest.json` lista los cuatro con `sizes` `192x192` o `512x512`, `type` `image/png` y `purpose` `any` o `maskable`. Quitar `icon.png`.

`index.html`: `<link rel="icon" href="favicon.svg" type="image/svg+xml">` y `<meta name="theme-color" content="#1d4ed8">`.

`sw.js`: `CACHE_NAME = 'testlab-v11'` y las cinco rutas nuevas en `ASSETS`. No añadir `prompts/` ni este plan.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/pwa-icons.test.js test/sw-precache.test.js test/review-fixes.test.js`

Expected: PASS. `review-fixes` sigue viendo que cada asset del precache existe.

Run: `npx playwright test e2e/pwa-assets.spec.js`

Expected: PASS. Cada ruta responde 200 y el manifiesto no contiene `icon.png`.

- [ ] **Step 5: Commit**

```bash
git add favicon.svg icons scripts/write-pwa-icons.js manifest.json index.html sw.js test/pwa-icons.test.js test/sw-precache.test.js e2e/pwa-assets.spec.js
git commit -m "feat: add the maskable icons and bump the cache"
```

---

### Task 11: Recorrido ya escrito y anchos sin scroll horizontal

**Files:**
- Modify: `e2e/library.spec.js`, `e2e/smoke.spec.js`, `e2e/text-entry.spec.js`
- Modify: `README.md` (solo el párrafo que empieza «El Repositorio es una biblioteca»)
- Test: `e2e/compact-widths.spec.js`

**Interfaces:**
- Consumes: el helper de pegado de cada e2e. Hoy pulsa «Pegar texto manualmente» y «Añadir al Repositorio». `e2e/library.spec.js` pulsa la miga «Repositorio» y elige el destino «Repositorio».
- Produces: el mismo recorrido de carpetas, nota, borrado con cancelar, foco, caret y revisión. Los localizadores nuevos son `#empty-import` o `#import-btn`, «Añadir texto», «Mis tests» y «Empezar ${nombre}».

- [ ] **Step 1: Write the failing width test and update the old locators**

Crear `e2e/compact-widths.spec.js` que, en 320, 390, 768, 1280 y 1440, abre la biblioteca vacía y afirma `scrollWidth <= clientWidth`. En 390×844 afirma que `#import-btn` y `#empty-import` están visibles sin haber un `#drop-zone` fuera del diálogo. Con un test importado, la primera `.library-row` tiene el borde superior por debajo de la cabecera y dentro de los primeros 844px. Un nombre de 200 «M» no hace `scrollWidth > clientWidth` a 320. Con `document.documentElement.style.fontSize = '32px'` y viewport 1280, la biblioteca tampoco desborda. Treinta tests de una sola pregunta: el `summary` del último, tras `scrollIntoView`, tiene `top` menor que el alto del viewport.

Actualizar los tres specs existentes en el mismo paso, porque si no el ancho nuevo pasa y el recorrido viejo queda rojo por copy. `pasteBank` queda:

```javascript
async function pasteBank(page, title) {
  const opener = page.locator('#import-btn');
  if (await opener.isVisible()) await opener.click();
  else await page.locator('#empty-import').click();
  await page.locator('#paste-input').fill(bank(title));
  await page.getByRole('button', { name: 'Añadir texto' }).click();
  await expect(page.locator('#import-errors')).toBeEmpty();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}
```

Donde el spec pulse `getByRole('button', { name: 'Repositorio' })`, pasa a `Mis tests`. Donde haga `selectOption({ label: 'Repositorio' })` al mover una carpeta, pasa a `Mis tests`. Donde pulse `Empezar examen` a secas y ahora hay un solo test, pasa a `Empezar ${title}`. No cambiar las aserciones de `readOnly`, `MUTACION`, `#final-score` ni `#score-detail` de `e2e/text-entry.spec.js`.

En `README.md`, el párrafo de biblioteca empieza: «Mis tests es la biblioteca de carpetas, sin límite de niveles y sin asignaturas ni etiquetas.» El resto de limitaciones de ese párrafo y de la sección Limitaciones se conservan. No se borra la frase de que no hay papelera.

- [ ] **Step 2: Run the suites to verify the old names fail and the new width test fails before the README-only assertion**

Run: `npx playwright test e2e/library.spec.js e2e/smoke.spec.js e2e/text-entry.spec.js e2e/compact-widths.spec.js`

Expected antes de editar los localizadores: FAIL por «Añadir al Repositorio» o «Repositorio». Después de editarlos y con la Task 5 ya hecha, `library`, `smoke` y `text-entry` pasan. `compact-widths` falla si alguna anchura desborda; ese fallo se corrige en el CSS de esta task, no relajando el `<=`.

- [ ] **Step 3: Fix only the overflow the width test reports**

Si una anchura falla, el arreglo es `min-width: 0` en la columna, `overflow-x: auto` solo en `.library-breadcrumbs`, y quitar `white-space: nowrap` de `.nav-btn` fuera de `.exam-bottombar`. No subir el `max-width` de la biblioteca por encima de 960px. No esconder el desborde con `overflow-x: hidden` en `body`.

- [ ] **Step 4: Run the suites to verify they pass**

Run: `npx playwright test e2e/library.spec.js e2e/smoke.spec.js e2e/text-entry.spec.js e2e/compact-widths.spec.js e2e/modal-centering.spec.js e2e/exam-bar.spec.js`

Expected: PASS. La revisión de respuesta corta sigue con `readOnly === true`, los dos veredictos `disabled`, el texto sin «MUTACION» y la misma nota al volver.

Run: `npm run check`

Expected: el comando termina en 0. Incluye `node scripts/check-syntax.js`, ESLint, `validate:examples`, `node --test` y `verify:static`.

- [ ] **Step 5: Commit**

```bash
git add e2e/library.spec.js e2e/smoke.spec.js e2e/text-entry.spec.js e2e/compact-widths.spec.js style.css README.md
git commit -m "test: walk the compact library at the checked widths"
```

---

## Self-review

Cobertura del spec: cáscara y título (Tasks 2, 3, 5), importación y Gem (Task 5), filas y borrado (Tasks 3, 4, 11), modo (Task 6), examen y progreso (Task 7), resultados (Task 8), diálogos y centrado (Tasks 1, 9), pantallas ocultas (Task 2), iconos y `testlab-v11` (Task 10), anchos y regresión de nota/foco (Task 11). `src/grade.js` y `src/score.js` no tienen task. El plan no añade papelera, búsqueda ni cuentas.

La aserción de centrado está nombrada `native dialog centering clears the old fixed offsets` y lee `getComputedStyle` más la caja en 320×568. No es un snapshot de imagen: no hay `toHaveScreenshot`.
