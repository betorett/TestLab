# Biblioteca de carpetas y prompt JSON v1

Fecha: 2026-11-06. Diseño aprobado por Vicent y transcrito aquí sin ampliar el alcance. Las dos elecciones que el diseño dejaba abiertas (navegación y alcance de la preferencia de orden) quedan cerradas en este documento, igual que las lecturas necesarias para implementar sin ambigüedad.

## Objetivo

El Repositorio deja de ser una lista plana y pasa a ser una biblioteca de carpetas y subcarpetas, sin límite de niveles y sin una entidad Asignatura ni etiquetas. Cada test pertenece como máximo a una carpeta. Los bancos ya guardados en `localStorage` siguen apareciendo, se pueden abrir, contestar, puntuar, reintentar y renombrar, y la nota no cambia de fórmula. El CSV anterior y el JSON v1 siguen intactos.

Además, `prompts/system-prompt-json-v1.md` será un prompt de sistema listo para copiar, y la UI de ajustes lo mostrará entero en lugar del texto breve actual.

## Contexto que no se toca

- Corrección, tipos, fórmula `max(0, aciertos - fallos * penalización) / total * 10` y penalización por defecto `0.33`.
- `SHORT_ANSWER`, imágenes, modos estudio/examen y el modelo interno de pregunta.
- No hay conversor CSV↔JSON ni migración obligatoria de bancos.
- No se mezclan preguntas de tests distintos.
- No hay backend, cuentas, sincronización, papelera, deshacer ni drag and drop.
- No se añaden dependencias.
- Las limitaciones ya escritas en el README se mantienen. Esta entrega puede añadir limitaciones de la biblioteca; no elimina las anteriores.
- `createRepository` en `src/repository.js` sigue existiendo con su contrato actual para los tests de historial ya escritos. La aplicación pasa a usar la biblioteca.

## Navegación elegida

Se usa **migas de pan más el contenido de la carpeta actual**, no un árbol con ramas plegables.

Motivo: el Repositorio ya es una columna de tarjetas, también en móvil (una sola columna por debajo de 800 px). Mostrar un solo nivel mantiene objetivos táctiles grandes, evita el sangrado horizontal de un árbol anidado y se recorre con botones nativos en el orden del tabulador. No hace falta un `tree` ARIA ni arrastrar.

- La miga es un `<nav aria-label="Ruta de la biblioteca">` con una lista ordenada.
- El primer elemento es el botón «Repositorio» (la raíz).
- Los ancestros son botones. La carpeta actual es texto con `aria-current="page"`.
- Dentro del nivel se muestran primero sus subcarpetas y después sus tests directos. Esos dos grupos no se intercalan.
- En la raíz, los tests sin carpeta se titulan «Sin clasificar». «Sin clasificar» no es una carpeta: es la ausencia de carpeta. No se puede crear, renombrar ni borrar.

## Qué se puede hacer

- Crear una carpeta dentro del nivel actual. El nombre se recorta; un nombre vacío o solo espacios no se guarda. No hace falta red. Crear no pide un test.
- Renombrar una carpeta con el mismo criterio de nombre.
- Mover una carpeta a la raíz o a otra carpeta. Se rechaza moverla a sí misma o a una descendiente. Un destino que no existe no se escribe.
- Mover un test a cualquier carpeta existente, o a Sin clasificar. Un test no se duplica en varias carpetas.
- Importar un banco (archivo o pegado) eligiendo la carpeta en un `<select>` etiquetado «Guardar en». La opción por defecto es Sin clasificar. Importar no exige crear una carpeta. El mismo control vale para soltar archivos y para pegar texto.
- Varios tests en la misma carpeta, también con el mismo nombre en carpetas distintas.
- Orden manual con botones Subir y Bajar, por separado para las subcarpetas y para los tests de ese nivel. El primero no sube y el último no baja; los botones quedan `disabled` en ese extremo. No hay salto de grupo ni envoltura.
- Orden por nombre (A–Z), por fecha de importación y por última nota.
- Selección múltiple solo de tests, con casillas, como hasta ahora. «Seleccionar todo» afecta a los tests visibles del nivel actual, no a los de las subcarpetas ni a las carpetas. Borrar pide confirmación. Un clic en Borrar sin confirmar no elimina nada.
- Borrar una carpeta elimina también sus subcarpetas y los tests de toda esa rama. Antes, la confirmación dice cuántas carpetas (incluida la propia) y cuántos tests se van a eliminar. No hay papelera.
- Abrir, contestar, puntuar, reintentar y renombrar un test sigue igual. Renombrar un test sigue usando `prompt`, que es el comportamiento actual. Crear, renombrar y mover carpetas, mover tests y confirmar borrados usan `<dialog>` nativo.

## Orden

La **preferencia** es global y se guarda en `localStorage` con la clave `testlab-library-sort`. Valores admitidos: `manual`, `name`, `imported`, `score`. Si falta o no es uno de esos valores, se usa `manual` y la lectura no reescribe la clave.

El **orden manual** es propio de cada carpeta (y de la raíz), por separado para subcarpetas y para tests. Cambiar de criterio no borra ese orden: al volver a Manual se recupera.

| Criterio | Carpetas | Tests |
| --- | --- | --- |
| Manual | Orden guardado | Orden guardado |
| Nombre | A–Z con `localeCompare('es', { sensitivity: 'base', numeric: true })` | Igual |
| Fecha de importación | `createdAt` ISO, de más reciente a más antigua | Ver abajo |
| Última nota | Una carpeta no tiene nota. Todas empatan y se queda el orden manual | Ver abajo |

Dirección elegida, porque el diseño no la fijaba:

- Nombre: A→Z.
- Fecha: la más reciente primero. La comparación usa un instante real, no el texto localizado.
- Nota: el valor numérico más alto primero. Los no realizados van al final, aunque su ausencia pudiera ordenarse como cero.

Empates, incluidos los no realizados entre sí y las fechas desconocidas entre sí: se conserva el orden manual relativo (ordenación estable).

Los botones Subir y Bajar solo están activos en Manual, y además respetan los extremos. En los otros criterios quedan `disabled`, porque pulsarlos no cambiaría lo que se está viendo.

### Fechas antiguas

Los tests nuevos guardan `importedAt` como `Date.toISOString()`, además del `date` de presentación que ya existía (`toLocaleDateString()`).

Para ordenar se usa, en este orden:

1. `importedAt` si es una cadena ISO-8601 finita (`YYYY-MM-DD` o con hora).
2. Si no, `date` si es ISO-8601 del mismo modo.
3. Si no, `date` solo cuando coincide con `D/M/AAAA` o `DD/MM/AAAA`, el día es mayor que 12, el mes está entre 1 y 12 y el día existe en ese mes. Ejemplo válido: `13/11/2026`. Se interpreta como día/mes/año.
4. En cualquier otro caso, incluida `6/11/2026` o `1/1/2020` (día y mes podrían intercambiarse), la fecha es **desconocida**. Esas entradas van después de las que sí tienen instante, en su orden manual. No se inventa una fecha y no se escribe una fecha interpretada de vuelta al almacén durante la lectura.

`createdAt` de una carpeta nueva es siempre ISO. Si un dato de carpeta llegara sin un `createdAt` válido, esa carpeta se trata como fecha desconocida.

### Notas

`lastScore` se ordena con `Number` si el valor es un número finito o un texto numérico finito (`8`, `7.50`, `7,5`). `null`, cadena vacía o texto no numérico cuentan como no realizado y van al final. No se ordena como texto: `10` va antes que `9`.

## Identidad de un test

El nombre no identifica un test. Dos bancos llamados «Test 1» en carpetas distintas son dos tests, y la nota de uno no pisa la del otro.

- Un test nuevo recibe `id` persistido: `t_` más `crypto.randomUUID()`.
- Un test antiguo sin `id` recibe un id derivado, no guardado por el mero hecho de leer:

```text
legacy:<fnv1a de JSON.stringify({ name, date, questions })>:<ocurrencia>
```

`ocurrencia` es 0, 1, 2… entre las entradas **sin** `id` propio que comparten la misma canonicalización, en el orden del array. FNV-1a 32 bits en hexadecimal de 8 cifras. No interviene `lastScore` ni la carpeta.

La lectura no escribe `testlab-history`. La primera operación que ya reescribe el historial (guardar, renombrar, mover, borrar, puntuar) fija `id` en las entradas que no lo tenían, con ese valor derivado calculado antes de modificarlas, y no cambia `name`, `date`, `questions` ni `lastScore` de las entradas que no son el objeto de la operación, salvo añadir ese `id`. Hace falta fijarlo en todas las que carecen de él en esa escritura: si solo se fijara una, la ocurrencia de las demás cambiaría.

`updateScore` busca por `id`. La pantalla de examen recuerda el `id` del test abierto, no solo el nombre.

Al reimportar, se sustituye un test solo cuando el destino es la misma carpeta y ya hay uno con el mismo nombre y el mismo número de preguntas. Se conserva su `id` y su posición manual; se actualizan preguntas, fecha e `importedAt`, y `lastScore` vuelve a `null`, igual que el reemplazo actual vaciaba la nota. El mismo nombre en otra carpeta crea otro test. Un banco nuevo dentro de la carpeta se inserta al principio del orden manual de tests. Un test o carpeta movidos se colocan al final del orden manual del destino.

## Almacén

Siguen siendo solo claves de `localStorage`. No hay red.

### `testlab-history`

Sigue siendo el array de bancos. Una entrada antigua puede ser exactamente `{ name, date, questions, lastScore }` con preguntas `{ text, type, options, correct }`. Eso se sigue leyendo con `coerceStoredQuestion` al abrir el examen, no al listar.

Una entrada nueva o sustituida puede añadir solo:

- `id`: cadena no vacía.
- `importedAt`: cadena ISO, ausente cuando el reloj inyectado en tests devuelve un texto (compatibilidad con el reloj actual de `createRepository`).

El reloj por defecto de la biblioteca es `() => new Date()`. De ahí salen `date = toLocaleDateString()` e `importedAt = toISOString()`.

### `testlab-library`

Índice nuevo. No existe hasta la primera mutación de carpetas, movimiento, orden o preferencia que lo necesite. Leer tests antiguos no lo crea.

```json
{
  "version": 1,
  "folders": [
    { "id": "f_<uuid>", "name": "Tema 3", "parentId": "f_<padre o null>", "createdAt": "<ISO>" }
  ],
  "placement": { "<testId>": "<folderId>" },
  "order": {
    "root": { "folders": ["f_…"], "tests": ["<testId>"] },
    "<folderId>": { "folders": [], "tests": [] }
  }
}
```

- `placement` solo guarda tests que están en una carpeta. Ausencia o `null` significa Sin clasificar.
- `order` guarda el orden manual. Los ids que ya no existen se ignoran al pintar. Los tests o carpetas que faltan en la lista se añaden al final, en el orden del historial o de creación, sin escribir esa reparación en una lectura.
- `parentId` de una carpeta de primer nivel es `null`.
- Si `placement` apunta a una carpeta que no existe, el test se muestra en Sin clasificar y la lectura no borra la clave.
- Una carpeta se pinta dentro de su padre solo si, subiendo por `parentId`, se llega a la raíz sin repetir un id y todos esos padres existen. Si `parentId` no existe o el recorrido se repite, esa carpeta se muestra una sola vez en la raíz. La lectura no reescribe el índice.
- Clave ausente: biblioteca vacía en memoria. La primera mutación crea `version: 1`.
- `version` ausente o `1`, con `folders` array o ausente: se usa. `placement` u `order` ausentes cuentan como `{}`. `folders` presente y que no sea un array es forma inválida.
- `version` distinta de `1`, o forma inválida: al leer no se aplica el índice (todos los tests en Sin clasificar, ninguna carpeta) y no se borra la clave. Cualquier mutación devuelve `unsupported-version` y no escribe, para no pisar un índice que esta versión no entiende.
- JSON inválido en `testlab-history` o en `testlab-library` sigue lanzando al parsear. La lectura no lo sustituye por `[]`.

La preferencia de orden no vive dentro de este objeto: vive en `testlab-library-sort`, para poder cambiarla sin reescribir bancos.

## API de dominio

`createLibrary(storage, now = () => new Date(), ids = defaultIds)` en `src/library.js`. `ids` es una función inyectable para los tests (`t_…` / `f_…`).

Resultados `{ ok: true, ... }` o `{ ok: false, error }` con `error` en:

`empty-name`, `missing`, `cycle`, `limit`, `unsupported-version`.

Operaciones:

- `view(folderId = null)` → `{ ok: true, breadcrumbs, folders, tests, sort }`. Las subcarpetas incluyen `testCount` (propios más descendientes) y los tests directos ya vienen ordenados. `folderId === null` es la raíz. Un id que no existe es `{ ok: false, error: 'missing' }`. No escribe.
- `createFolder(parentId, name)`
- `renameFolder(id, name)`
- `moveFolder(id, parentId)` donde `parentId === null` es la raíz. `cycle` si el destino es el propio id o un descendiente.
- `deleteFolder(id)` → `{ ok, folders, tests }` con los recuentos ya eliminados. La UI pregunta antes con `removalPreview(id)` → `{ folders, tests }`, que no escribe.
- `saveTest(name, questions, folderId = null)`. `folderId === null` es Sin clasificar. Si `folderId` no existe, `missing` y no se escribe nada.
- `renameTest(id, name)`. El nombre vacío es `empty-name` y no se escribe.
- `moveTest(id, folderId)` con `folderId === null` = Sin clasificar. Destino inexistente: `missing`.
- `deleteTests(ids)`
- `updateScore(id, score)`
- `moveInOrder(kind, id, direction)` con `kind` `folder` o `test` y `direction` `-1` o `1`. `limit` en un extremo. Cambia el orden manual guardado aunque la preferencia visible sea otra; la UI solo deja el botón activo en Manual.
- `getSort()` / `setSort(mode)`
- `getTest(id)` → la entrada del historial, o `null`. No coacciona preguntas.

`createFolder(parentId, name)` con un `parentId` que no existe devuelve `missing`. `parentId === null` crea la carpeta en la raíz. El recuento de borrado recorre los hijos con un conjunto de ids ya vistos y se detiene ante un ciclo, para no contar dos veces ni colgarse.

Los nombres de carpeta y de test que ve la persona salen de estas cadenas. La UI los inserta con `textContent` o con `option.value` más texto creado por la API DOM. No se usa `innerHTML` para datos de usuario o importados.

## UI

Dentro del Repositorio actual (`index.html` / `app.js`), sin pantalla nueva:

- Control «Nueva carpeta».
- `<label for="library-sort">Ordenar por</label>` y un `<select>` con Manual, Nombre (A–Z), Fecha de importación, Última nota.
- `<label for="import-folder">Guardar en</label>` y un `<select>` cuya primera opción es Sin clasificar (`value=""`). Las demás muestran la ruta `Ingeniería de Fluidos / Tema 3`, construida con nodos de texto.
- Migas y, debajo, las tarjetas.

Tarjeta de carpeta: nombre, «N tests» (descendientes incluidos), botones Abrir, Renombrar, Mover, Subir, Bajar y Borrar. Sin casilla. Nombres accesibles del tipo `Abrir Tema 3`, `Subir carpeta Tema 3`, `Borrar carpeta Tema 3`.

Tarjeta de test: la información actual (nombre, preguntas, fecha, nota o «Sin realizar»), casilla `Seleccionar <nombre>`, y botones Empezar examen, Renombrar, Mover, Subir y Bajar. Los nombres accesibles de Renombrar y Empezar se mantienen reconocibles.

Los botones de la tarjeta usan las clases ya existentes (`.nav-btn`, `.back-btn`) y pueden pasar a la línea siguiente. No se introduce un sistema nuevo de tamaño táctil que reestilice toda la app. El foco visible global (`:focus-visible`) se conserva.

### Diálogos

Se usa `<dialog>` abierto con `showModal()`. No se añade `role="dialog"` ni `aria-modal`. Cada diálogo tiene `aria-labelledby` hacia su `h2`. El foco vuelve solo al control que lo abrió.

- Crear, renombrar y mover: `<form method="dialog">`, campo con `<label>` asociado, `autofocus` en el campo, botón de confirmar como primer `type="submit"` para que Enter acepte, y Cancelar. Un error de nombre vacío se escribe en un elemento visible; el diálogo no se cierra.
- Mover: un `<select>` etiquetado «Destino». Para una carpeta, el propio id y sus descendientes no aparecen. Siempre existe «Repositorio» o «Sin clasificar», según se mueva una carpeta o un test.
- Borrar carpeta o tests: otro `<dialog>`, enfoque inicial en Cancelar, y Cancelar es el primer botón de envío para que Enter no confirme. El botón Borrar es explícito. Cerrar con Esc o Cancelar no borra. No se cierra al pulsar el fondo, para que un toque fuera no se confunda con una confirmación.
- Se añade `overscroll-behavior: contain` en `dialog:modal` y en `dialog::backdrop`, sin poner `display` incondicional en `dialog`.

No se corrige en este cambio el hecho previo de que cada pantalla sea un `<main>`. La biblioteca vive en el `<main id="upload-screen">` que ya existe.

## Prompt de sistema

`prompts/system-prompt-json-v1.md` es el texto entero que una persona copia como instrucción de sistema o de desarrollador. No lleva prólogo de documentación: el archivo es el prompt.

`src/ai-prompt.js` exporta `SYSTEM_PROMPT_JSON_V1` con exactamente el mismo texto. La página lo asigna con `textContent` al abrir la app, de modo que funciona con `file://` y con el servidor estático, sin `fetch` del Markdown. El `<pre id="prompt-text">` deja de contener el resumen breve.

El botón Copiar Prompt copia ese texto. El párrafo de ajustes deja de decir que las reglas devuelven «el CSV 100% compatible» y pasa a decir que el prompt pide JSON TestLab v1 y que la salida hay que validarla: un modelo no garantiza el esquema.

El prompt exige, en sustancia:

- Salida únicamente de un JSON TestLab v1, sin Markdown ni texto alrededor.
- Documento según `schema/testlab-bank-v1.schema.json`: raíz con solo `$schema`, `schemaVersion`, `title` opcional y `questions`. `schemaVersion` exactamente `1`. `additionalProperties` no admitido.
- `"$schema": "../schema/testlab-bank-v1.schema.json"` es una ruta del repositorio, no una URL pública. No hay que inventar un `https://` para el esquema.
- Los ocho tipos y sus campos exactos, alineados con el esquema y con `validateBankDocument`: `SINGLE` (`choices`, `answer` string id), `MULTIPLE` (`choices`, `answer` array de ids), `TRUE_FALSE` (`answer` boolean), `FILL_BLANK` (`blanks`), `NUMERIC` (`answer.value`, `answer.tolerance` ≥ 0, `unit` opcional, sin conversión de unidades), `MATCHING` (`pairs` de `left`/`right`, uno a uno), `ORDERING` (`items` en el orden correcto), `SHORT_ANSWER` (`modelAnswer`, sin corrección automática).
- Campos comunes: `type`, `prompt`, `id` opcional estable, `image` opcional `{ src, alt }`. `src` solo `https:` o ruta relativa. Prohibidos `javascript:`, `data:`, `file:`, `blob:` y `http:`.
- Huecos: cada `___` (tres o más `_`) es un hueco; `blanks` es un array de arrays de variantes no vacías, uno por hueco y en el mismo orden. Sin ningún `___`, hay exactamente un hueco.
- No usar `IMAGE_BASED`. La figura, si existe, va en `image` de un tipo normal.
- No añadir claves desconocidas. No inventar enunciados, cifras, unidades ni soluciones que no estén en el material fuente. Si falta el contenido fuente, pedirlo en vez de inventarlo. Las respuestas tienen que ser coherentes con el enunciado y, en elección, con ids que existan.
- Ids de opción estables (`A`, `B`, `C`, patrón `^[A-Za-z0-9_-]+$`), únicos dentro de la pregunta. Ids de pregunta estables si se incluyen.
- Cuando la herramienta pueda validar, comprobar el resultado contra el JSON Schema del proyecto antes de entregarlo. Eso no promete que la salida sea válida: la aplicación y `npm run validate:examples` siguen siendo la comprobación.

Un test lee el Markdown y el módulo, comprueba que son iguales, que nombran los ocho tipos y que no instruye a emitir `IMAGE_BASED` (sí puede prohibirlo).

## Caché PWA

`sw.js` incluye cualquier módulo nuevo (`src/library.js`, `src/render-library.js`, `src/ai-prompt.js`) y sube `CACHE_NAME` de `testlab-v9` a `testlab-v10`. El precache no lista rutas que no existan. El prompt Markdown no se precachea: la página no lo descarga. Un test comprueba que cada ruta de `ASSETS` existe en el disco.

`npm run verify:static` solo copia la SPA a `dist/` y comprueba que esos archivos no están vacíos y que el HTML sigue enlazando el módulo. `npm run check:syntax` es `node --check`. Ninguno de los dos es un empaquetado.

## Pruebas

Unitarias y de DOM, escritas antes del código de producción y vistas fallar:

- Crear, renombrar y mover carpetas; muchos tests en una carpeta; subcarpetas; rechazo de ciclos, nombre vacío y destino inexistente.
- Historial antiguo visible en Sin clasificar; la lectura no reescribe `testlab-history` ni crea el índice.
- Tras una mutación, el id derivado queda fijado y las preguntas antiguas siguen iguales.
- Dos tests con el mismo nombre se puntúan por id.
- Mover un test a otra carpeta y a Sin clasificar.
- Orden por nombre, fecha, nota y manual, con empates, extremos de Subir/Bajar, fechas ambiguas sin instante inventado e `importedAt` ordenable de verdad.
- Borrado recursivo con recuentos; la selección solo incluye tests.
- Nombres con aspecto de HTML no crean elementos.
- El prompt cubre los ocho tipos y no pide `IMAGE_BASED`.
- El precache no apunta a archivos ausentes.

E2E en Chromium, contra el `serve` que ya arranca Playwright:

- Importar varios tests, crear al menos dos niveles, mover un test, mover una carpeta, reordenar en Manual, cambiar criterios de orden, abrir un test movido, puntuar, recargar y ver la estructura, borrar tests seleccionados y borrar una carpeta tras la confirmación (también cancelar una vez).
- Un banco CSV antiguo (`sample_exam.csv`) y un banco sembrado al estilo `testlab-history` antiguo siguen abriéndose.
- Teclado en controles nuevos: foco y Enter/Espacio en Subir o en un diálogo, y el `<select>` de destino.

## Limitaciones de esta entrega

- Sin drag and drop, sin papelera y sin deshacer.
- La preferencia de orden es global, no por carpeta.
- Las fechas `toLocaleDateString()` ambiguas no se convierten: se ordenan como desconocidas.
- Una carpeta no tiene nota; ordenar carpetas por última nota no las reordena.
- «Seleccionar todo» no entra en subcarpetas.
- No hay cuentas ni sincronización entre navegadores.
- El prompt no hace válido el JSON por sí solo.
- Siguen vigentes las limitaciones de imagen, unidades, `SHORT_ANSWER` y opciones no barajadas.
