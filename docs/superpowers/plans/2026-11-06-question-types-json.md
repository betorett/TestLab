# Tipos de pregunta y banco JSON v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir TRUE_FALSE, FILL_BLANK, NUMERIC, MATCHING, ORDERING y SHORT_ANSWER, imagen opcional en cualquier tipo, y un banco JSON v1 validado, sin romper el CSV SINGLE/MULTIPLE ni el historial antiguo.

**Architecture:** Un modelo interno único (`prompt`, `type`, `image`, `body`) lo producen el CSV y el JSON. La corrección, la nota y la persistencia leen solo ese modelo. El navegador sigue siendo una SPA estática: PapaParse por CDN, módulos ES en `src/` sin bundler. El contrato JSON Schema se valida con Ajv en Node; el navegador ejecuta un validador explícito alineado y probado contra el mismo corpus, más reglas semánticas (URL, huecos, ids). No se llama «validación contra JSON Schema» a esas comprobaciones manuales.

**Tech Stack:** HTML/CSS/JS vanilla, PapaParse 5.4.1, Node 22 `node:test`, Ajv 8 (solo dev), jsdom, Playwright, ESLint 9.

Vicent ya autorizó este diseño. No se pide otra aprobación. Sin merge y sin despliegue.

## Global Constraints

- CSV sin cabecera, separador `;`, comillas como PapaParse hoy (`header: false`, `skipEmptyLines: true`, `delimiter: ""`).
- SINGLE/MULTIPLE: `Pregunta;SINGLE|MULTIPLE;Opción A;Opción B;...;Respuesta` con respuesta `A` o `A|C`. Misma semántica, sin cabecera obligatoria. Tipos desconocidos con 5+ columnas siguen cayendo en SINGLE, o MULTIPLE si el tipo contiene `MULT`.
- Filas SINGLE/MULTIPLE con menos de 5 columnas se omiten en silencio, como ahora. La primera fila se omite si la primera celda contiene `pregunta` o `question`.
- TRUE_FALSE solo `V`/`F`/`VERDADERO`/`FALSO` tras normalizar caso, espacios y diacríticos.
- FILL_BLANK: marcador `___` (3 o más `_`). Sin marcadores hay exactamente un hueco. `|` variantes, `||` huecos. No vale respuesta vacía.
- NUMERIC: `abs(respuesta-esperado) <= tolerancia + margen de coma flotante`. Sin conversión de unidades. Coma o punto, no ambos. Tolerancia `>= 0`. Números finitos.
- Margen flotante exacto: `8 * Number.EPSILON * max(1, |esperado|, |respuesta|, |tolerancia|)`.
- Unidad: si hay unidad esperada, se exige. Normalización: minúsculas, sin espacios, superíndices Unicode a `^n` (`m/s²` = `m/s^2`). No hay equivalencia algebraica (`m·s^-2` no es `m/s^2`). Si no hay unidad esperada, no se muestra ni se puntúa el campo.
- MATCHING uno a uno, `<select>` nativo. ORDERING con botones Subir/Bajar y confirmación explícita. Sin drag-and-drop.
- SHORT_ANSWER nunca se corrige por coincidencia de texto. Vacío = omitida. Texto sin veredicto = `pending` (no suma y no penaliza; entra en el total como una omisión, pero se muestra aparte). Veredicto `incorrect` sí penaliza. Veredicto `correct` suma aunque el texto difiera del modelo.
- Imagen opcional final `IMG=` y `IMG_ALT=` en cualquier tipo, también SINGLE/MULTIPLE. Sin esos campos, el CSV antiguo no cambia. Alt ausente: se usa el enunciado. Solo `https:` o ruta relativa. Rechazar `javascript:`, `data:`, `file:`, `http:`, `blob:`, protocolo relativo `//` y esquemas desconocidos.
- IMAGE_BASED no es un tipo. Una pregunta de imagen es un tipo normal con `image`. JSON `type: "IMAGE_BASED"` se rechaza con un mensaje que lo explica.
- JSON no sustituye al CSV. `schemaVersion` distinto de `1` se rechaza. Claves desconocidas se rechazan. JSON inválido no se importa en parte. CSV inválido en filas nuevas informa el error y conserva las filas válidas.
- Contenido importado al DOM solo con `textContent` / propiedades, nunca interpolado en `innerHTML`.
- No hay aleatorización de opciones SINGLE/MULTIPLE (no existía). No añadirla.
- No hay OCR, visión artificial ni conversión de unidades.
- `node --check` es verificación de sintaxis, no un build. `verify:static` copia la SPA a `dist/` y comprueba artefactos.
- No framework ni bundler de aplicación.

## Modelo interno

```javascript
/**
 * @typedef {{ src: string, alt: string }} ImageRef
 * @typedef {{
 *   id: string|null,
 *   type: 'SINGLE'|'MULTIPLE'|'TRUE_FALSE'|'FILL_BLANK'|'NUMERIC'|'MATCHING'|'ORDERING'|'SHORT_ANSWER',
 *   prompt: string,
 *   image: ImageRef|null,
 *   body: object
 * }} Question
 * body:
 *   SINGLE|MULTIPLE { choices: {id: string, text: string}[], correctIds: string[] }
 *   TRUE_FALSE      { correct: boolean }
 *   FILL_BLANK      { blanks: string[][] }
 *   NUMERIC         { value: number, tolerance: number, unit: string|null }
 *   MATCHING        { pairs: {left: string, right: string}[] }
 *   ORDERING        { items: string[] }          // el orden del array es la solución
 *   SHORT_ANSWER    { modelAnswer: string }
 */
```

Respuesta de sesión (`'SKIPPED'` o):

- SINGLE, MULTIPLE, TRUE_FALSE: `string[]` (`'V'`/`'F'` en verdadero/falso).
- FILL_BLANK: `string[]` por hueco.
- NUMERIC: `{ value: string, unit: string }`.
- MATCHING: `string[]` alineado a `pairs` (`''` si falta).
- ORDERING: `{ order: string[], confirmed: boolean }`. Sin confirmar = omitida, aunque el orden visual ya esté barajado.
- SHORT_ANSWER: `{ text: string, verdict: null|'correct'|'incorrect' }`.

`gradeQuestion(question, answer)` devuelve `'correct' | 'incorrect' | 'skipped' | 'pending'`.

Nota, igual que ahora, con `pending` contado en el detalle y dentro del total, sin punto y sin penalización:

```text
raw = max(0, correct - wrong * penaltyFactor)
nota = (raw / totalPreguntas) * 10
```

## Archivos

- Create: `src/text.js`, `src/image-url.js`, `src/grade.js`, `src/csv-bank.js`, `src/validate-bank.js`, `src/json-bank.js`, `src/score.js`, `src/storage.js`, `src/repository.js`, `src/render-question.js`, `src/render-history.js`, `src/import-bank.js`
- Create: `schema/testlab-bank-v1.schema.json`, `examples/banco-mixto.csv`, `examples/banco-mixto.json`, `examples/figura.svg`, `examples/README.md`
- Create: `scripts/check-syntax.js`, `scripts/validate-examples.js`, `scripts/verify-static.js`
- Create: `test/*.test.js`, `test/e2e/smoke.spec.js`, `playwright.config.js`
- Modify: `app.js`, `index.html`, `style.css`, `sw.js`, `README.md`, `.gitignore`
- Keep: `sample_exam.csv` como banco antiguo

`package.json` declara `papaparse` 5.4.1 (tests; la página sigue usando el mismo build por CDN) y devDependencies fijadas: `ajv`, `eslint`, `globals`, `jsdom`, `@playwright/test`, `serve`. Se commitea `package-lock.json` (hoy está en `.gitignore`; hay que dejar de ignorarlo).

## Interfaces que comparten las tareas

- `normalizeAnswerText(value: string): string`
- `normalizeUnit(value: string): string`
- `parseDecimal(value: string): { ok: true, value: number } | { ok: false, message: string }`
- `canonicalTrueFalse(value: string): 'V'|'F'|null`
- `withinTolerance(answer: number, expected: number, tolerance: number): boolean`
- `inspectImageSrc(src: string): { ok: true, src: string } | { ok: false, message: string }`
- `parseCsvMatrix(rows: string[][]): { questions: Question[], errors: { path: string, message: string }[] }`
- `PAPA_OPTIONS = { header: false, skipEmptyLines: true, delimiter: '' }`
- `gradeQuestion(question, answer): 'correct'|'incorrect'|'skipped'|'pending'`
- `validateBankDocument(data: unknown): { ok: boolean, errors: { path: string, message: string }[] }`
- `bankDocumentToQuestions(data): Question[]` (solo si `validateBankDocument` ok)
- `parseJsonBank(text: string): { questions: Question[], errors, title: string|null }`
- `scoreExam(questions, answers, penaltyFactor: number): { correct, wrong, skipped, pending, scoreOutOf10, scoreLabel }`
- `coerceStoredQuestion(raw): Question`
- `createRepository(storage): { list, save, rename, remove, updateScore }`
- `detectFormat(text, fileName): 'json'|'csv'`
- `importBankText(text, fileName, papa): { format, title, questions, errors }`
- `renderQuestion(container, question, answer, ctx)`
- `renderHistoryList(container, items)`

Errores de importación: `path` como `fila 3` o `questions[2].body.tolerance`, y `message` en español.

---

### Task 1: Plan y herramental

**Files:** este documento, `package.json`, `package-lock.json`, `.gitignore`, `eslint.config.js`, `scripts/check-syntax.js`, `scripts/verify-static.js`.

- [ ] Commit del plan en `cursor/question-types-json-e3aa`.
- [ ] Dejar de ignorar `package-lock.json`.
- [ ] Scripts: `test` (`node --test`), `check:syntax` (`node --check`, no es un build), `lint`, `validate:examples`, `verify:static`, `test:e2e`.
- [ ] `verify:static` copia `index.html`, `style.css`, `app.js`, `src/`, `schema/`, `examples/`, `sw.js`, `manifest.json`, `sample_exam.csv` a `dist/` y falla si falta el entry o el esquema.

### Task 2: Texto, unidades y URL (TDD)

**Test:** `test/text.test.js`, `test/image-url.test.js`.

- [ ] RED: normalización de «  París  », diacríticos, espacios repetidos; `canonicalTrueFalse(' verdadero ') === 'V'`; `si` y `TRUE` devuelven null; `parseDecimal('9,81')`, rechazo de `1.234,56`, `Infinity`, vacío; `withinTolerance(0.1+0.2, 0.3, 0)`; límite inclusivo `10.05` con tolerancia `0.05`; `10.06` fuera; `normalizeUnit('m / s²') === 'm/s^2'`; `m/s2` y `m·s^-2` distintos.
- [ ] RED: `https://ejemplo.test/a.png` y `examples/figura.svg` aceptadas; `javascript:`, `data:`, `file:`, `http:`, `blob:`, `//cdn/x`, `%6Aavascript:alert(1)` rechazadas.
- [ ] GREEN mínimo en `src/text.js` y `src/image-url.js`.

### Task 3: CSV antiguo y tipos nuevos (TDD)

**Test:** `test/csv-bank.test.js`, `test/grade.test.js`.

- [ ] RED: `sample_exam.csv` vía PapaParse produce las mismas 5 preguntas, opciones en el mismo orden (no hay barajado), letras de respuesta y comillas con `;` interno.
- [ ] RED: fila corta SINGLE se omite; cabecera `Pregunta;...` se omite; `MULTI` sigue siendo MULTIPLE.
- [ ] RED: cada tipo nuevo, variantes de hueco, hueco vacío no correcto, `||`, tolerancia, pares incompletos/duplicados, orden exacto, SHORT_ANSWER con texto idéntico al modelo y veredicto null es `pending`, veredicto incorrect con texto idéntico es `incorrect`.
- [ ] RED: `IMG=` / `IMG_ALT=` en SINGLE y en TRUE_FALSE; banco sin imagen igual que antes; URL insegura produce error de fila y no una pregunta.
- [ ] GREEN: `src/csv-bank.js`, `src/grade.js`.

### Task 4: Nota, pendientes y localStorage (TDD)

**Test:** `test/score.test.js`, `test/storage.test.js`.

- [ ] RED: 1 acierto, 1 fallo, 1 pending, penalización 0.33 → raw `0.67`, nota sobre 3 preguntas, pending no está en `wrong`. Suelo 0 si la penalización se come el acierto.
- [ ] RED: historial antiguo `{ text, type, options, correct }` se coacciona y puntúa igual; leerlo no reescribe el JSON guardado. Un FILL_BLANK guardado en el modelo nuevo entra y sale.
- [ ] GREEN: `src/score.js`, `src/storage.js`, `src/repository.js`.

### Task 5: JSON v1 (TDD)

**Test:** `test/json-bank.test.js`, `test/schema.test.js`.
**Files:** `schema/testlab-bank-v1.schema.json`, `src/validate-bank.js`, `src/json-bank.js`, `scripts/validate-examples.js`.

- [ ] RED: documento válido de los 8 tipos pasa el validador explícito y Ajv. `schemaVersion: 2`, clave desconocida, pregunta vacía, menos de 2 opciones, respuesta que no es un id, pares duplicados, tolerancia negativa, unidad numérica, `IMAGE_BASED`, huecos que no coinciden con `___`, `javascript:` en `image.src` fallan con `path` que incluye el índice.
- [ ] Un JSON a medias no devuelve preguntas. Texto que empieza por `{` y no es JSON no cae a CSV.
- [ ] `$schema` en los ejemplos es la ruta relativa `../schema/testlab-bank-v1.schema.json`. El `$id` del esquema es el nombre de archivo, no una URL pública nueva. El `$schema` del propio archivo sí apunta al metaesquema estándar de draft 2020-12.
- [ ] GREEN: validador explícito + Ajv solo en `npm run validate:examples` y en los tests de acuerdo. El README dirá esta división con esas palabras.

### Task 6: DOM, modos y app

**Test:** `test/render-question.test.js`, `test/render-history.test.js`, `test/import-bank.test.js`.

- [ ] RED: enunciado con `<img onerror>` no crea un elemento imagen; la imagen segura sí, con alt; radios V/F exclusivos y con label; selects de emparejamiento; botones subir/bajar; SHORT_ANSWER muestra la respuesta modelo y dos botones, y no marca correcto al escribir el modelo; nombre de historial hostil no se interpreta como HTML.
- [ ] GREEN: render en `src/render-*.js` e integración en `app.js` (modos estudio/examen, comprobar, revisión, reporte, duda IA, progreso, saltar). Controles nativos, `:focus-visible`, `accent-color`, región `role="alert"` para errores de importación y `aria-live="polite"` para el resultado de corrección.
- [ ] Aceptar `.csv` y `.json` en la subida. El pegado detecta por contenido.

### Task 7: Documentación, ejemplos y humo

- [ ] README con tabla CSV de cada tipo, imagen, JSON recomendado, ejemplo completo, prompt para IA, comandos reales y limitaciones (sin OCR, sin conversión de unidades, imágenes remotas sujetas a red/CORS/mixed content, rutas relativas no viajan dentro del archivo).
- [ ] `examples/figura.svg` propio. Bancos mixto CSV y JSON que lo referencian.
- [ ] Playwright: pegar JSON, ver los 8 tipos, teclado en verdadero/falso y en orden, error de importación, CSV antiguo. Captura en `/opt/cursor/artifacts/`.
- [ ] Ejecutar `npm run check`, `npm test` y `npm run test:e2e`. Anotar la salida literal. Abrir la PR. No merge.

## Decisiones cerradas

| Tema | Decisión |
| --- | --- |
| IMAGE_BASED | No es tipo. `image` opcional cubre el caso. |
| Huecos | `___` (3+ guiones bajos). |
| JSON en el navegador | Validador explícito. Ajv es la validación de esquema en Node. |
| Pendiente SHORT_ANSWER | No es acierto ni fallo. Cuenta en el total. |
| Orden inicial ORDERING | Barajado solo visual; sin confirmar cuenta como omitida. |
| Opciones SINGLE/MULTIPLE | Orden del archivo. |
| Build | No hay bundler. `verify:static` comprueba la copia estática. |
