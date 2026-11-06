import { inspectImageSrc } from './image-url.js';
import { canonicalTrueFalse, parseDecimal } from './text.js';

export const PAPA_OPTIONS = {
  header: false,
  skipEmptyLines: true,
  delimiter: ''
};

const KNOWN_TYPES = new Set([
  'SINGLE',
  'MULTIPLE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'NUMERIC',
  'MATCHING',
  'ORDERING',
  'SHORT_ANSWER'
]);

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function asText(value) {
  return value == null ? '' : String(value);
}

function question(type, prompt, image, body) {
  return { id: null, type, prompt, image, body };
}

function fail(path, message) {
  return { error: { path, message } };
}

export function parseCsvMatrix(rows) {
  const questions = [];
  const errors = [];
  if (!Array.isArray(rows) || rows.length === 0) return { questions, errors };

  let start = 0;
  const firstCell = rows[0]?.[0];
  if (firstCell && /pregunta|question/i.test(String(firstCell))) start = 1;

  for (let index = start; index < rows.length; index += 1) {
    const path = `fila ${index + 1}`;
    const cells = (rows[index] || []).map(asText);
    const meta = extractImageMeta(cells, path);
    if (meta.error) {
      errors.push(meta.error);
      continue;
    }
    const parsed = parseRow(meta.cells, meta.image, path);
    if (parsed.error) errors.push(parsed.error);
    else if (parsed.question) questions.push(parsed.question);
  }

  return { questions, errors };
}

function extractImageMeta(cells, path) {
  const rest = cells.slice();
  let src = null;
  let alt = null;
  let sawImage = false;
  let sawAlt = false;

  while (rest.length > 0) {
    const last = rest[rest.length - 1].trim();
    const image = last.match(/^IMG=(.*)$/i);
    const altText = last.match(/^IMG_ALT=(.*)$/i);
    if (image) {
      if (sawImage) return fail(path, 'IMG está repetido');
      sawImage = true;
      src = image[1].trim();
      rest.pop();
    } else if (altText) {
      if (sawAlt) return fail(path, 'IMG_ALT está repetido');
      sawAlt = true;
      alt = altText[1].trim();
      rest.pop();
    } else {
      break;
    }
  }

  if (sawAlt && !sawImage) return fail(path, 'IMG_ALT no puede usarse sin IMG');
  if (!sawImage) return { cells: rest, image: null };

  const inspected = inspectImageSrc(src);
  if (!inspected.ok) return fail(path, inspected.message);
  const prompt = asText(rest[0]).trim();
  return {
    cells: rest,
    image: { src: inspected.src, alt: alt || prompt || 'Figura de la pregunta' }
  };
}

function parseRow(cells, image, path) {
  if (cells.length < 2 || !asText(cells[1]).trim()) return {};
  const typeRaw = asText(cells[1]).trim().toUpperCase();
  const prompt = asText(cells[0]).trim();

  if (typeRaw === 'SINGLE' || typeRaw === 'MULTIPLE' || !KNOWN_TYPES.has(typeRaw)) {
    if (cells.length < 5) return {};
    const type = typeRaw === 'MULTIPLE' || typeRaw.includes('MULT') ? 'MULTIPLE' : 'SINGLE';
    if (!prompt) return fail(path, 'El enunciado está vacío');
    return { question: buildChoice(type, prompt, cells, image) };
  }

  if (!prompt) return fail(path, 'El enunciado está vacío');
  switch (typeRaw) {
    case 'TRUE_FALSE':
      return parseTrueFalse(cells, prompt, image, path);
    case 'FILL_BLANK':
      return parseFillBlank(cells, prompt, image, path);
    case 'NUMERIC':
      return parseNumeric(cells, prompt, image, path);
    case 'MATCHING':
      return parseMatching(cells, prompt, image, path);
    case 'ORDERING':
      return parseOrdering(cells, prompt, image, path);
    case 'SHORT_ANSWER':
      return parseShortAnswer(cells, prompt, image, path);
    default:
      return fail(path, `Tipo no reconocido: ${typeRaw}`);
  }
}

function buildChoice(type, prompt, cells, image) {
  const options = cells.slice(2, -1);
  const correctIds = asText(cells[cells.length - 1])
    .trim()
    .toUpperCase()
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  return question(type, prompt, image, {
    choices: options.map((text, index) => ({
      id: LETTERS[index] || '?',
      text: asText(text).trim()
    })),
    correctIds
  });
}

function parseTrueFalse(cells, prompt, image, path) {
  if (cells.length !== 3) return fail(path, 'TRUE_FALSE debe ser Pregunta;TRUE_FALSE;V');
  const verdict = canonicalTrueFalse(cells[2]);
  if (!verdict) return fail(path, 'La respuesta de TRUE_FALSE debe ser V, F, VERDADERO o FALSO');
  return { question: question('TRUE_FALSE', prompt, image, { correct: verdict === 'V' }) };
}

function parseFillBlank(cells, prompt, image, path) {
  if (cells.length !== 3) return fail(path, 'FILL_BLANK debe ser Pregunta;FILL_BLANK;variantes');
  const groups = asText(cells[2]).split('||').map((group) => group.split('|').map((part) => part.trim()));
  if (groups.some((group) => group.length === 0 || group.some((part) => part === ''))) {
    return fail(path, 'Una variante vacía no es una respuesta válida');
  }
  const markers = (prompt.match(/_{3,}/g) || []).length;
  const expected = markers === 0 ? 1 : markers;
  if (groups.length !== expected) {
    return fail(path, `El enunciado tiene ${markers} huecos (___) y hay ${groups.length} grupos de respuesta`);
  }
  return { question: question('FILL_BLANK', prompt, image, { blanks: groups }) };
}

function parseNumeric(cells, prompt, image, path) {
  if (cells.length !== 4 && cells.length !== 5) {
    return fail(path, 'NUMERIC debe ser Pregunta;NUMERIC;valor;tolerancia o con unidad');
  }
  const value = parseDecimal(cells[2]);
  const tolerance = parseDecimal(cells[3]);
  if (!value.ok) return fail(path, `Valor numérico: ${value.message}`);
  if (!tolerance.ok) return fail(path, `Tolerancia: ${tolerance.message}`);
  if (tolerance.value < 0) return fail(path, 'La tolerancia debe ser mayor o igual que 0');
  let unit = null;
  if (cells.length === 5) {
    unit = asText(cells[4]).trim();
    if (!unit) return fail(path, 'La unidad está vacía');
  }
  return { question: question('NUMERIC', prompt, image, { value: value.value, tolerance: tolerance.value, unit }) };
}

function parseMatching(cells, prompt, image, path) {
  if (cells.length !== 3) return fail(path, 'MATCHING debe ser Pregunta;MATCHING;Izquierda=>Derecha|...');
  const chunks = asText(cells[2]).split('|').map((part) => part.trim()).filter(Boolean);
  if (chunks.length < 2) return fail(path, 'MATCHING necesita al menos dos pares');
  const pairs = [];
  for (const chunk of chunks) {
    const separator = chunk.indexOf('=>');
    if (separator <= 0) return fail(path, `Par de MATCHING inválido: ${chunk}`);
    const left = chunk.slice(0, separator).trim();
    const right = chunk.slice(separator + 2).trim();
    if (!left || !right) return fail(path, `Par de MATCHING inválido: ${chunk}`);
    pairs.push({ left, right });
  }
  if (new Set(pairs.map((pair) => pair.left)).size !== pairs.length) {
    return fail(path, 'Hay enunciados duplicados en MATCHING');
  }
  if (new Set(pairs.map((pair) => pair.right)).size !== pairs.length) {
    return fail(path, 'Hay destinos duplicados en MATCHING');
  }
  return { question: question('MATCHING', prompt, image, { pairs }) };
}

function parseOrdering(cells, prompt, image, path) {
  if (cells.length !== 3) return fail(path, 'ORDERING debe ser Pregunta;ORDERING;Primero|Segundo');
  const items = asText(cells[2]).split('|').map((part) => part.trim()).filter((part) => part !== '');
  if (items.length < 2) return fail(path, 'ORDERING necesita al menos dos elementos');
  if (new Set(items).size !== items.length) return fail(path, 'ORDERING no admite elementos duplicados');
  return { question: question('ORDERING', prompt, image, { items }) };
}

function parseShortAnswer(cells, prompt, image, path) {
  if (cells.length !== 3) return fail(path, 'SHORT_ANSWER debe ser Pregunta;SHORT_ANSWER;Respuesta modelo');
  const modelAnswer = asText(cells[2]).trim();
  if (!modelAnswer) return fail(path, 'La respuesta modelo está vacía');
  return { question: question('SHORT_ANSWER', prompt, image, { modelAnswer }) };
}
