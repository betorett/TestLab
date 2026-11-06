import { inspectImageSrc } from './image-url.js';

const QUESTION_TYPES = new Set([
  'SINGLE',
  'MULTIPLE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'NUMERIC',
  'MATCHING',
  'ORDERING',
  'SHORT_ANSWER'
]);

const ROOT_KEYS = new Set(['$schema', 'schemaVersion', 'title', 'questions']);
const TYPE_KEYS = {
  SINGLE: ['choices', 'answer'],
  MULTIPLE: ['choices', 'answer'],
  TRUE_FALSE: ['answer'],
  FILL_BLANK: ['blanks'],
  NUMERIC: ['answer'],
  MATCHING: ['pairs'],
  ORDERING: ['items'],
  SHORT_ANSWER: ['modelAnswer']
};

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function push(errors, path, message) {
  errors.push({ path, message });
}

export function validateBankDocument(data) {
  const errors = [];
  if (!isObject(data)) {
    push(errors, '', 'El banco debe ser un objeto JSON');
    return { ok: false, errors };
  }

  for (const key of Object.keys(data)) {
    if (!ROOT_KEYS.has(key)) push(errors, key, `Clave desconocida: ${key}`);
  }
  if (data.schemaVersion !== 1) push(errors, 'schemaVersion', 'schemaVersion debe ser exactamente 1');
  if (data.$schema !== undefined && typeof data.$schema !== 'string') {
    push(errors, '$schema', '$schema debe ser texto');
  }
  if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim() === '')) {
    push(errors, 'title', 'title debe ser texto no vacío');
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    push(errors, 'questions', 'questions debe ser un array con al menos una pregunta');
  } else {
    data.questions.forEach((question, index) => validateQuestion(question, `questions[${index}]`, errors));
  }
  return { ok: errors.length === 0, errors };
}

function validateQuestion(question, path, errors) {
  if (!isObject(question)) {
    push(errors, path, 'La pregunta debe ser un objeto');
    return;
  }

  const allowed = new Set(['id', 'type', 'prompt', 'image', ...(TYPE_KEYS[question.type] || [])]);
  for (const key of Object.keys(question)) {
    if (!allowed.has(key)) push(errors, `${path}.${key}`, `Clave desconocida: ${key}`);
  }
  if (question.id !== undefined && (typeof question.id !== 'string' || question.id.trim() === '')) {
    push(errors, `${path}.id`, 'id debe ser texto no vacío');
  }
  if (!QUESTION_TYPES.has(question.type)) {
    const message = question.type === 'IMAGE_BASED'
      ? 'IMAGE_BASED no es un tipo: adjunta image a un tipo normal'
      : `Tipo no reconocido: ${String(question.type)}`;
    push(errors, `${path}.type`, message);
  }
  if (typeof question.prompt !== 'string' || question.prompt.trim() === '') {
    push(errors, `${path}.prompt`, 'El enunciado está vacío');
  }
  if (question.image !== undefined) validateImage(question.image, `${path}.image`, errors);
  if (!QUESTION_TYPES.has(question.type)) return;

  if (question.type === 'SINGLE' || question.type === 'MULTIPLE') validateChoice(question, path, errors);
  else if (question.type === 'TRUE_FALSE') validateTrueFalse(question, path, errors);
  else if (question.type === 'FILL_BLANK') validateBlanks(question, path, errors);
  else if (question.type === 'NUMERIC') validateNumeric(question, path, errors);
  else if (question.type === 'MATCHING') validateMatching(question, path, errors);
  else if (question.type === 'ORDERING') validateOrdering(question, path, errors);
  else validateShort(question, path, errors);
}

function validateImage(image, path, errors) {
  if (!isObject(image)) {
    push(errors, path, 'image debe ser un objeto con src');
    return;
  }
  for (const key of Object.keys(image)) {
    if (key !== 'src' && key !== 'alt') push(errors, `${path}.${key}`, `Clave desconocida: ${key}`);
  }
  if (typeof image.src !== 'string') {
    push(errors, `${path}.src`, 'src debe ser texto');
    return;
  }
  const inspected = inspectImageSrc(image.src);
  if (!inspected.ok) push(errors, `${path}.src`, inspected.message);
  if (image.alt !== undefined && (typeof image.alt !== 'string' || image.alt.trim() === '')) {
    push(errors, `${path}.alt`, 'alt debe ser texto no vacío');
  }
}

function validateChoice(question, path, errors) {
  if (!Array.isArray(question.choices)) {
    push(errors, `${path}.choices`, 'choices debe ser un array');
    return;
  }
  if (question.choices.length < 2) push(errors, `${path}.choices`, 'Hacen falta al menos dos opciones');
  const ids = [];
  question.choices.forEach((choice, index) => {
    const choicePath = `${path}.choices[${index}]`;
    if (!isObject(choice)) {
      push(errors, choicePath, 'La opción debe ser un objeto');
      return;
    }
    for (const key of Object.keys(choice)) {
      if (key !== 'id' && key !== 'text') push(errors, `${choicePath}.${key}`, `Clave desconocida: ${key}`);
    }
    if (typeof choice.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(choice.id)) {
      push(errors, `${choicePath}.id`, 'id de opción inválido');
    } else {
      ids.push(choice.id);
    }
    if (typeof choice.text !== 'string' || choice.text.trim() === '') {
      push(errors, `${choicePath}.text`, 'El texto de la opción está vacío');
    }
  });
  if (new Set(ids).size !== ids.length) push(errors, `${path}.choices`, 'Hay ids de opción duplicados');

  if (question.type === 'SINGLE') {
    if (typeof question.answer !== 'string' || !ids.includes(question.answer)) {
      push(errors, `${path}.answer`, 'La respuesta no coincide con un id de opción');
    }
    return;
  }
  if (!Array.isArray(question.answer) || question.answer.length === 0) {
    push(errors, `${path}.answer`, 'La respuesta múltiple necesita al menos un id');
    return;
  }
  if (new Set(question.answer).size !== question.answer.length || question.answer.some((id) => !ids.includes(id))) {
    push(errors, `${path}.answer`, 'La respuesta múltiple debe ser ids de opción, sin repetir');
  }
}

function validateTrueFalse(question, path, errors) {
  if (typeof question.answer !== 'boolean') {
    push(errors, `${path}.answer`, 'answer debe ser true o false');
  }
}

function validateBlanks(question, path, errors) {
  if (!Array.isArray(question.blanks) || question.blanks.length === 0) {
    push(errors, `${path}.blanks`, 'blanks debe contener al menos un hueco');
    return;
  }
  question.blanks.forEach((group, index) => {
    if (!Array.isArray(group) || group.length === 0 || group.some((variant) => typeof variant !== 'string' || variant.trim() === '')) {
      push(errors, `${path}.blanks[${index}]`, 'Cada hueco necesita variantes no vacías');
    }
  });
  const markers = typeof question.prompt === 'string' ? (question.prompt.match(/_{3,}/g) || []).length : 0;
  const expected = markers === 0 ? 1 : markers;
  if (question.blanks.length !== expected) {
    push(errors, `${path}.blanks`, `El enunciado tiene ${markers} huecos (___) y blanks tiene ${question.blanks.length}`);
  }
}

function validateNumeric(question, path, errors) {
  const answer = question.answer;
  if (!isObject(answer)) {
    push(errors, `${path}.answer`, 'answer debe ser un objeto con value y tolerance');
    return;
  }
  for (const key of Object.keys(answer)) {
    if (!['value', 'tolerance', 'unit'].includes(key)) {
      push(errors, `${path}.answer.${key}`, `Clave desconocida: ${key}`);
    }
  }
  if (typeof answer.value !== 'number' || !Number.isFinite(answer.value)) {
    push(errors, `${path}.answer.value`, 'value debe ser un número finito');
  }
  if (typeof answer.tolerance !== 'number' || !Number.isFinite(answer.tolerance)) {
    push(errors, `${path}.answer.tolerance`, 'tolerance debe ser un número finito');
  } else if (answer.tolerance < 0) {
    push(errors, `${path}.answer.tolerance`, 'La tolerancia debe ser mayor o igual que 0');
  }
  if (answer.unit !== undefined && (typeof answer.unit !== 'string' || answer.unit.trim() === '')) {
    push(errors, `${path}.answer.unit`, 'La unidad debe ser texto');
  }
}

function validateMatching(question, path, errors) {
  if (!Array.isArray(question.pairs) || question.pairs.length < 2) {
    push(errors, `${path}.pairs`, 'Hacen falta al menos dos pares');
    return;
  }
  const lefts = [];
  const rights = [];
  question.pairs.forEach((pair, index) => {
    const pairPath = `${path}.pairs[${index}]`;
    if (!isObject(pair)) {
      push(errors, pairPath, 'El par debe ser un objeto');
      return;
    }
    for (const key of Object.keys(pair)) {
      if (key !== 'left' && key !== 'right') push(errors, `${pairPath}.${key}`, `Clave desconocida: ${key}`);
    }
    if (typeof pair.left !== 'string' || pair.left.trim() === '') push(errors, `${pairPath}.left`, 'left está vacío');
    else lefts.push(pair.left.trim());
    if (typeof pair.right !== 'string' || pair.right.trim() === '') push(errors, `${pairPath}.right`, 'right está vacío');
    else rights.push(pair.right.trim());
  });
  if (new Set(lefts).size !== lefts.length || new Set(rights).size !== rights.length) {
    push(errors, `${path}.pairs`, 'Los pares deben ser uno a uno, sin repetir extremos');
  }
}

function validateOrdering(question, path, errors) {
  if (!Array.isArray(question.items) || question.items.length < 2) {
    push(errors, `${path}.items`, 'ORDERING necesita al menos dos elementos');
    return;
  }
  const items = [];
  question.items.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') push(errors, `${path}.items[${index}]`, 'El elemento está vacío');
    else items.push(item.trim());
  });
  if (new Set(items).size !== items.length) push(errors, `${path}.items`, 'ORDERING no admite elementos duplicados');
}

function validateShort(question, path, errors) {
  if (typeof question.modelAnswer !== 'string' || question.modelAnswer.trim() === '') {
    push(errors, `${path}.modelAnswer`, 'La respuesta modelo está vacía');
  }
}
