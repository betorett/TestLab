# TestLab Pro

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**TestLab** convierte un banco de preguntas en una sesión de estudio o de examen. Sigue siendo una SPA en HTML, CSS y JavaScript, sin backend: PapaParse lee el CSV, el navegador guarda el repositorio en `localStorage` y la corrección ocurre en local.

El CSV sin cabecera sigue siendo el formato compatible. El JSON v1 es el formato recomendado cuando una IA genera el banco.

## Puesta en marcha

Hace falta un servidor estático para que los módulos y las imágenes relativas carguen. No hay bundler.

```bash
npm install
npx serve -l 8080 .
```

Abre `http://127.0.0.1:8080`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm test` | Tests de Node (`node --test`): CSV, tipos, nota, JSON, DOM e historial. |
| `npm run check:syntax` | `node --check` de los JavaScript del repo. Es una verificación de sintaxis, no un build. |
| `npm run lint` | ESLint (variables, `no-undef`, `eqeqeq`) sobre `app.js`, `src`, `test` y `scripts`. |
| `npm run validate:examples` | Ajv valida `examples/banco-mixto.json` contra `schema/testlab-bank-v1.schema.json` y el importador comprueba ese JSON y el CSV mixto. |
| `npm run verify:static` | Copia la SPA a `dist/` y comprueba que el HTML, los módulos, el esquema y los ejemplos están y no vacíos. No empaqueta JavaScript. |
| `npm run check` | Sintaxis, lint, ejemplos, tests y la copia estática, en ese orden. |
| `npm run test:e2e` | Smoke de Playwright (Chromium) contra un `serve` local. No publica nada. |

## CSV

Sin cabecera. Separador `;`. Las comillas se respetan como hasta ahora: PapaParse con `header: false`, `skipEmptyLines: true` y `delimiter` autodetectado. Un `;` dentro de un campo va entre comillas dobles.

La primera fila se omite si su primera celda contiene `pregunta` o `question`. Una fila SINGLE/MULTIPLE con menos de 5 columnas se ignora. Un tipo desconocido con 5 o más columnas sigue interpretándose como SINGLE, o como MULTIPLE si el texto contiene `MULT`.

### Tabla

| Tipo | Columnas | Respuesta |
| --- | --- | --- |
| `SINGLE` | `Pregunta;SINGLE;Opción A;Opción B;…;Letra` | Una letra. `A` es la primera opción, en el orden del archivo. No se barajan. |
| `MULTIPLE` | `Pregunta;MULTIPLE;Opción A;Opción B;…;Letras` | Letras unidas por `\|`, por ejemplo `A\|C`. Hay que marcar exactamente ese conjunto. |
| `TRUE_FALSE` | `Pregunta;TRUE_FALSE;V` | `V`, `F`, `VERDADERO` o `FALSO`. Se ignoran mayúsculas, espacios de los extremos y diacríticos. No se acepta `TRUE` ni `SI`. La interfaz son dos radios exclusivos. |
| `FILL_BLANK` | `Pregunta;FILL_BLANK;variantes` | Cada hueco del enunciado es `___` (tres o más `_`). `\|` separa variantes del mismo hueco. `\|\|` separa huecos. Sin ningún `___`, hay exactamente un hueco y no puede haber `\|\|`. |
| `NUMERIC` | `Pregunta;NUMERIC;valor;tolerancia` o `…;unidad` | Valor y tolerancia absoluta. Coma o punto, no los dos. Tolerancia `>= 0`. La unidad, si existe, es la última columna antes de la imagen. |
| `MATCHING` | `Pregunta;MATCHING;Izquierda=>Derecha\|…` | Al menos dos pares, uno a uno, sin repetir extremos. La interfaz son `<select>` nativos. |
| `ORDERING` | `Pregunta;ORDERING;Primero\|Segundo\|…` | El orden escrito es el correcto. Al menos dos textos distintos. Botones Subir/Bajar y una confirmación. |
| `SHORT_ANSWER` | `Pregunta;SHORT_ANSWER;Respuesta modelo` | Texto libre. No hay corrección por palabras. |

La imagen es opcional y va al final, en cualquier tipo, también SINGLE y MULTIPLE. Los bancos antiguos sin estos campos no cambian.

```text
IMG=https://ejemplo.test/figura.png
IMG=examples/figura.svg
IMG_ALT=Descripción de la figura
```

`IMG` y `IMG_ALT` pueden ir en cualquier orden, siempre después de la respuesta. `IMG_ALT` sin `IMG` es un error. Si falta el texto alternativo, se usa el enunciado.

Solo se aceptan URLs `https:` y rutas relativas (`examples/figura.svg`, `./figura.svg`, `/figura.svg`). Se rechazan `javascript:`, `data:`, `file:`, `blob:`, `http:`, URLs de protocolo relativo (`//host/...`) y cualquier otro esquema.

### Ejemplos copiables

```csv
¿Qué capital está marcada?;SINGLE;Lisboa;Madrid;París;B;IMG=examples/figura.svg;IMG_ALT=Marca violeta sobre un esquema
¿Qué números son pares?;MULTIPLE;2;3;4;A|C
El hielo flota en el agua líquida;TRUE_FALSE;V
La capital de Francia es ___.;FILL_BLANK;París|Paris
La ___ limita con ___.;FILL_BLANK;Francia||España
Gravedad estándar;NUMERIC;9,81;0,05;m/s^2
¿Cuántos lados tiene un triángulo?;NUMERIC;3;0
Empareja cada capital;MATCHING;Madrid=>España|Roma=>Italia
Orden del ciclo;ORDERING;Planificar|Ejecutar|Comprobar
¿Qué es la inercia?;SHORT_ANSWER;Tendencia de un cuerpo a conservar su estado de movimiento
```

El mismo banco está en `examples/banco-mixto.csv`. `sample_exam.csv` sigue siendo un banco antiguo de solo SINGLE/MULTIPLE.

### Corrección

- SINGLE y MULTIPLE: el conjunto de letras debe coincidir, sin importar el orden de pulsación.
- TRUE_FALSE: un radio. En estudio se corrige al elegir. En examen se avanza igual que en SINGLE.
- FILL_BLANK: se comparan mayúsculas, diacríticos y espacios de los extremos o repetidos. `París`, `paris` y `  PARIS ` coinciden. Un hueco vacío no es correcto. Si todos los huecos están vacíos, la pregunta cuenta como omitida. Si falta alguno, es incorrecta.
- NUMERIC: correcta si `abs(respuesta - esperado) <= tolerancia + margen`. El margen es solo de coma flotante: `8 * Number.EPSILON * max(1, |esperado|, |respuesta|, |tolerancia|)`. El límite es inclusivo. No hay conversión de unidades ni separadores de millar.
- Unidad: se compara en minúsculas, sin espacios, y los superíndices Unicode pasan a `^` (`m/s²` y `m / s ^ 2` equivalen a `m/s^2`). No hay equivalencia algebraica: `m·s^-2` no es `m/s^2`, ni `m/s2` tampoco. Si el CSV no trae unidad, el campo no se muestra y no se puntúa. Si la trae, hay que escribirla.
- MATCHING: todos los pares, por el texto elegido, no por la posición visual. Un par vacío con otros rellenos es incorrecto. Todos vacíos es omitida.
- ORDERING: el orden se comprueba al confirmar. Hasta entonces es omitida, aunque el barajado inicial coincida con la solución.
- SHORT_ANSWER: el texto nunca se compara con el modelo. Sin texto es omitida. Con texto y sin veredicto queda **pendiente**: no suma y no penaliza, pero entra en el total de preguntas igual que una omisión. El veredicto «La he fallado» sí penaliza. «La he acertado» suma aunque el texto no se parezca al modelo. En estudio no se puede avanzar mientras siga pendiente. En examen se puede pasar y la nota la dejará pendiente hasta que haya veredicto.

La nota no cambia de fórmula: `max(0, aciertos - fallos * penalización) / total * 10`. La penalización por defecto sigue siendo `0.33`. Las pendientes se ven aparte en el detalle (`⏳`) y no entran en el contador de fallos.

## JSON v1

Recomendado para generación por IA. No sustituye al CSV y no hace falta migrar bancos antiguos.

El contrato es `schema/testlab-bank-v1.schema.json` (JSON Schema draft 2020-12). Su `$id` es el nombre de archivo `testlab-bank-v1.schema.json`. No hay una URL pública nueva del esquema. En los ejemplos, `$schema` es la ruta relativa `../schema/testlab-bank-v1.schema.json`.

```bash
npm run validate:examples
```

Eso sí es validación contra el JSON Schema, hecha con Ajv 8.17.1 en Node. El navegador no carga Ajv: ejecuta `validateBankDocument` (`src/validate-bank.js`), un validador explícito con las mismas reglas estructurales (versión, claves desconocidas, tipos, campos obligatorios) y, además, reglas que el esquema no cubre solo: que `answer` sea un id existente, que los `___` coincidan con `blanks`, pares uno a uno y URL de imagen segura. Los tests comprueban en qué casos Ajv y el validador coinciden y en cuáles la URL insegura la rechaza solo la aplicación.

`schemaVersion` distinto de `1` se rechaza. Un JSON a medias no se importa. Las claves desconocidas producen un error con la ruta, por ejemplo `questions[2].answer.tolerance`.

`IMAGE_BASED` no es un tipo. Si la pregunta depende de una figura, se usa un tipo normal y `image`. El mensaje de error lo dice.

### Ejemplo con todos los tipos

Está en `examples/banco-mixto.json` y usa `examples/figura.svg`, servido junto a la app. Forma abreviada:

```json
{
  "$schema": "../schema/testlab-bank-v1.schema.json",
  "schemaVersion": 1,
  "title": "Banco mixto",
  "questions": [
    {
      "type": "SINGLE",
      "prompt": "¿Qué capital está marcada?",
      "image": { "src": "examples/figura.svg", "alt": "Marca violeta sobre un esquema" },
      "choices": [
        { "id": "A", "text": "Lisboa" },
        { "id": "B", "text": "Madrid" }
      ],
      "answer": "B"
    },
    {
      "type": "MULTIPLE",
      "prompt": "¿Qué números son pares?",
      "choices": [
        { "id": "A", "text": "2" },
        { "id": "B", "text": "3" },
        { "id": "C", "text": "4" }
      ],
      "answer": ["A", "C"]
    },
    { "type": "TRUE_FALSE", "prompt": "El hielo flota", "answer": true },
    { "type": "FILL_BLANK", "prompt": "La capital es ___.", "blanks": [["París", "Paris"]] },
    { "type": "NUMERIC", "prompt": "g", "answer": { "value": 9.81, "tolerance": 0.05, "unit": "m/s^2" } },
    {
      "type": "MATCHING",
      "prompt": "Capitales",
      "pairs": [
        { "left": "Madrid", "right": "España" },
        { "left": "Roma", "right": "Italia" }
      ]
    },
    { "type": "ORDERING", "prompt": "Ciclo", "items": ["Planificar", "Ejecutar", "Comprobar"] },
    { "type": "SHORT_ANSWER", "prompt": "Define inercia", "modelAnswer": "Conservar el estado de movimiento" }
  ]
}
```

Al pegar texto, si empieza por `{` se trata como JSON. Un archivo `.json` siempre es JSON y un `.csv` siempre es CSV, aunque el contenido empiece por `{`.

### Prompt para una IA

```text
Genera solo un JSON TestLab versión 1, sin markdown.
Usa "$schema": "../schema/testlab-bank-v1.schema.json" y "schemaVersion": 1.
Cada pregunta tiene type, prompt y un único bloque de solución según el tipo:
SINGLE y MULTIPLE con choices de id estable (A, B, C) y answer;
TRUE_FALSE con answer boolean;
FILL_BLANK con ___ en el enunciado y blanks como array de variantes;
NUMERIC con answer.value numérico, answer.tolerance >= 0 y unit opcional, sin convertir unidades;
MATCHING con pairs [{left, right}] sin repetir extremos;
ORDERING con items en el orden correcto;
SHORT_ANSWER con modelAnswer.
No uses IMAGE_BASED. Si hace falta una figura, añade image.src (https o ruta relativa) e image.alt a un tipo normal.
No añadas claves que no estén en el esquema. No dejes preguntas vacías ni opciones de menos.
Antes de entregarlo, valida el archivo con: npm run validate:examples
o, para otro archivo, el mismo Ajv contra schema/testlab-bank-v1.schema.json.
```

No hay exportador CSV→JSON. El modelo interno es el mismo, pero la migración queda fuera de este cambio.

## Historial

`localStorage` (`testlab-history`) guarda el banco y la última nota, no la sesión a medias. Una pregunta antigua `{ text, type, options, correct }` se sigue abriendo y corrigiendo. Leer el repositorio no reescribe ese JSON. Los bancos nuevos se guardan ya en el modelo interno (`prompt`, `type`, `image`, `body`).

## Limitaciones

- No hay OCR ni visión artificial. La persona interpreta la imagen.
- No hay conversión de unidades.
- Una imagen `https:` depende de la red, de CORS y de que la página no la bloquee por contenido mixto. El elemento es un `<img>` normal.
- Una ruta relativa tiene que publicarse junto a la app. No viaja embebida dentro del CSV o del JSON.
- SHORT_ANSWER enseña la respuesta modelo porque la nota es manual. No sirve como ítem ciego.
- Las opciones SINGLE/MULTIPLE no se aleatorizan: no existía esa función y no se ha añadido. En emparejar y ordenar, el orden visual inicial no es la clave de corrección.

## Tecnologías

HTML, CSS y JavaScript en módulos. PapaParse 5.4.1 (CDN en la página, la misma versión en `package.json` para los tests). KaTeX sigue renderizando el texto ya insertado con `textContent`. Ajv solo en desarrollo, para el esquema.
