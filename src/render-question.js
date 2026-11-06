import { gradeQuestion } from './grade.js';
import { normalizeAnswerText, normalizeUnit } from './text.js';

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderQuestion(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  container.replaceChildren();
  appendImage(container, question);

  if (question.type === 'FILL_BLANK') renderBlanks(container, question, answer, ctx);
  else container.append(el(doc, 'p', 'question-text', question.prompt));

  if (question.type === 'MULTIPLE') {
    container.append(el(doc, 'p', 'meta', 'Puedes elegir varias respuestas.'));
  }

  switch (question.type) {
    case 'SINGLE':
    case 'MULTIPLE':
      renderChoices(container, question, answer, ctx);
      break;
    case 'TRUE_FALSE':
      renderTrueFalse(container, question, answer, ctx);
      break;
    case 'NUMERIC':
      renderNumeric(container, question, answer, ctx);
      break;
    case 'MATCHING':
      renderMatching(container, question, answer, ctx);
      break;
    case 'ORDERING':
      renderOrdering(container, question, answer, ctx);
      break;
    case 'SHORT_ANSWER':
      renderShort(container, question, answer, ctx);
      break;
    default:
      break;
  }

  const status = statusText(question, answer, ctx);
  if (status) container.append(el(doc, 'p', 'answer-status', status));
}

function appendImage(container, question) {
  if (!question.image?.src) return;
  const doc = container.ownerDocument;
  const figure = el(doc, 'figure', 'question-figure');
  const image = el(doc, 'img', 'question-image');
  image.src = question.image.src;
  image.alt = question.image.alt || question.prompt;
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  figure.append(image);
  container.append(figure);
}

function renderChoices(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const selected = Array.isArray(answer) ? answer : [];
  const list = el(doc, 'div', 'options-list');
  const reveal = Boolean(ctx.reveal);
  question.body.choices.forEach((choice) => {
    const button = el(doc, 'button', 'option-btn');
    button.type = 'button';
    button.dataset.id = choice.id;
    button.append(el(doc, 'span', 'option-letter', choice.id));
    button.append(el(doc, 'span', 'option-text', choice.text));
    const pressed = selected.includes(choice.id);
    button.setAttribute('aria-pressed', String(pressed));
    if (pressed) button.classList.add('selected');
    if (question.type === 'MULTIPLE') button.append(el(doc, 'span', 'checkbox-icon', pressed ? '✓' : ''));
    if (reveal) {
      const isCorrect = question.body.correctIds.includes(choice.id);
      if (isCorrect && pressed) button.classList.add('correct');
      if (!isCorrect && pressed) button.classList.add('incorrect');
      if (isCorrect && !pressed) button.classList.add('missed');
      button.disabled = true;
    }
    button.addEventListener('click', () => {
      if (question.type === 'SINGLE') ctx.onAnswer([choice.id]);
      else {
        const next = pressed ? selected.filter((id) => id !== choice.id) : [...selected, choice.id];
        ctx.onAnswer(next);
      }
    });
    list.append(button);
  });
  container.append(list);
}

function renderTrueFalse(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const field = el(doc, 'fieldset', 'true-false');
  field.append(el(doc, 'legend', 'visually-hidden', 'Verdadero o falso'));
  const selected = Array.isArray(answer) ? answer[0] : '';
  [['V', 'Verdadero'], ['F', 'Falso']].forEach(([value, label]) => {
    const id = `${ctx.idPrefix}-tf-${value}`;
    const input = doc.createElement('input');
    input.type = 'radio';
    input.name = `${ctx.idPrefix}-tf`;
    input.id = id;
    input.value = value;
    input.checked = selected === value;
    if (ctx.reveal) input.disabled = true;
    input.addEventListener('change', () => ctx.onAnswer([value]));
    const caption = el(doc, 'label', 'true-false-option', label);
    caption.htmlFor = id;
    if (ctx.reveal) {
      const expected = question.body.correct ? 'V' : 'F';
      if (value === expected) caption.classList.add('is-correct');
      if (selected === value && value !== expected) caption.classList.add('is-incorrect');
    }
    field.append(input, caption);
  });
  container.append(field);
}

function renderBlanks(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const values = Array.isArray(answer) ? answer : [];
  const inputs = question.body.blanks.map((variants, index) => {
    const id = `${ctx.idPrefix}-blank-${index}`;
    const input = doc.createElement('input');
    input.type = 'text';
    input.id = id;
    input.className = 'blank-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = values[index] || '';
    input.setAttribute('aria-label', `Hueco ${index + 1}`);
    if (ctx.reveal) {
      const given = normalizeAnswerText(input.value);
      const ok = given && variants.some((variant) => normalizeAnswerText(variant) === given);
      input.disabled = true;
      input.classList.add(ok ? 'is-correct' : 'is-incorrect');
      input.setAttribute('aria-invalid', String(!ok));
    }
    input.addEventListener('input', () => {
      const next = question.body.blanks.map((_, blankIndex) => (
        blankIndex === index ? input.value : (values[blankIndex] || '')
      ));
      ctx.onAnswer(next);
    });
    return input;
  });

  const markers = question.prompt.match(/_{3,}/g) || [];
  const paragraph = el(doc, 'p', 'question-text');
  if (markers.length === 0) {
    paragraph.textContent = question.prompt;
    container.append(paragraph);
    inputs.forEach((input, index) => {
      const label = el(doc, 'label', null, `Hueco ${index + 1}`);
      label.htmlFor = input.id;
      const row = el(doc, 'div', 'blank-row');
      row.append(label, input);
      container.append(row);
    });
    return;
  }

  const parts = question.prompt.split(/_{3,}/);
  parts.forEach((part, index) => {
    paragraph.append(doc.createTextNode(part));
    if (inputs[index]) paragraph.append(inputs[index]);
  });
  container.append(paragraph);
}

function renderNumeric(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const current = answer && typeof answer === 'object' ? answer : { value: '', unit: '' };
  const valueId = `${ctx.idPrefix}-value`;
  const valueLabel = el(doc, 'label', null, 'Valor');
  valueLabel.htmlFor = valueId;
  const value = doc.createElement('input');
  value.type = 'text';
  value.id = valueId;
  value.inputMode = 'decimal';
  value.autocomplete = 'off';
  value.spellcheck = false;
  value.value = current.value || '';
  const hint = el(doc, 'p', 'meta', `Tolerancia absoluta ±${question.body.tolerance}. Usa coma o punto decimal.`);
  hint.id = `${ctx.idPrefix}-hint`;
  value.setAttribute('aria-describedby', hint.id);
  value.addEventListener('input', () => ctx.onAnswer({ value: value.value, unit: current.unit || '' }));

  const group = el(doc, 'div', 'numeric-fields');
  group.append(valueLabel, value, hint);
  if (question.body.unit) {
    const unitId = `${ctx.idPrefix}-unit`;
    const unitLabel = el(doc, 'label', null, `Unidad (${question.body.unit})`);
    unitLabel.htmlFor = unitId;
    const unit = doc.createElement('input');
    unit.type = 'text';
    unit.id = unitId;
    unit.autocomplete = 'off';
    unit.spellcheck = false;
    unit.value = current.unit || '';
    unit.addEventListener('input', () => ctx.onAnswer({ value: current.value || '', unit: unit.value }));
    group.append(unitLabel, unit);
    if (ctx.reveal) {
      const matches = normalizeUnit(unit.value) === normalizeUnit(question.body.unit);
      unit.disabled = true;
      unit.classList.add(matches ? 'is-correct' : 'is-incorrect');
    }
  }
  if (ctx.reveal) {
    value.disabled = true;
    value.classList.add(gradeQuestion(question, { value: value.value, unit: current.unit || '' }) === 'correct' ? 'is-correct' : 'is-incorrect');
  }
  container.append(group);
}

function renderMatching(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const selections = Array.isArray(answer) ? answer : question.body.pairs.map(() => '');
  const rights = ctx.optionOrder || question.body.pairs.map((pair) => pair.right);
  const field = el(doc, 'fieldset', 'matching');
  field.append(el(doc, 'legend', null, 'Emparejamientos'));
  question.body.pairs.forEach((pair, index) => {
    const id = `${ctx.idPrefix}-match-${index}`;
    const row = el(doc, 'div', 'matching-row');
    const label = el(doc, 'label', null, pair.left);
    label.htmlFor = id;
    const select = doc.createElement('select');
    select.id = id;
    const placeholder = el(doc, 'option', null, 'Elige…');
    placeholder.value = '';
    select.append(placeholder);
    const taken = new Set(selections.filter(Boolean));
    rights.forEach((right) => {
      const option = el(doc, 'option', null, right);
      option.value = right;
      if (taken.has(right) && selections[index] !== right) option.disabled = true;
      select.append(option);
    });
    select.value = selections[index] || '';
    if (ctx.reveal) {
      select.disabled = true;
      select.classList.add(selections[index] === pair.right ? 'is-correct' : 'is-incorrect');
    }
    select.addEventListener('change', () => {
      const next = selections.slice();
      next[index] = select.value;
      ctx.onAnswer(next);
    });
    row.append(label, select);
    field.append(row);
  });
  container.append(field);
}

function renderOrdering(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const state = answer && Array.isArray(answer.order)
    ? answer
    : { order: question.body.items.slice(), confirmed: false };
  const list = el(doc, 'ol', 'ordering-list');
  state.order.forEach((item, index) => {
    const itemNode = el(doc, 'li', 'ordering-item');
    itemNode.append(el(doc, 'span', 'ordering-label', item));
    const up = el(doc, 'button', 'nav-btn', 'Subir');
    up.type = 'button';
    up.disabled = index === 0 || Boolean(ctx.reveal);
    up.setAttribute('aria-label', `Subir ${item}`);
    const down = el(doc, 'button', 'nav-btn', 'Bajar');
    down.type = 'button';
    down.disabled = index === state.order.length - 1 || Boolean(ctx.reveal);
    down.setAttribute('aria-label', `Bajar ${item}`);
    up.addEventListener('click', () => ctx.onAnswer({ order: move(state.order, index, index - 1), confirmed: true }));
    down.addEventListener('click', () => ctx.onAnswer({ order: move(state.order, index, index + 1), confirmed: true }));
    itemNode.append(up, down);
    list.append(itemNode);
  });
  container.append(list);
  const confirm = el(doc, 'button', 'nav-btn', 'Confirmar este orden');
  confirm.type = 'button';
  confirm.disabled = Boolean(ctx.reveal);
  confirm.addEventListener('click', () => ctx.onAnswer({ order: state.order.slice(), confirmed: true }));
  container.append(confirm);
  if (ctx.reveal && gradeQuestion(question, state) !== 'correct') {
    container.append(el(doc, 'p', 'meta', `Orden correcto: ${question.body.items.join(' → ')}`));
  }
}

function renderShort(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const current = answer && typeof answer === 'object' ? answer : { text: '', verdict: null };
  const id = `${ctx.idPrefix}-short`;
  const label = el(doc, 'label', null, 'Tu respuesta');
  label.htmlFor = id;
  const area = doc.createElement('textarea');
  area.id = id;
  area.rows = 4;
  area.value = current.text || '';
  area.addEventListener('input', () => ctx.onAnswer({ text: area.value, verdict: null }));
  const model = el(doc, 'p', 'model-answer');
  const modelLabel = el(doc, 'span', 'model-label', 'Respuesta modelo: ');
  model.append(modelLabel, doc.createTextNode(question.body.modelAnswer));
  const correct = el(doc, 'button', 'nav-btn', 'La he acertado');
  correct.type = 'button';
  correct.setAttribute('aria-pressed', String(current.verdict === 'correct'));
  const incorrect = el(doc, 'button', 'nav-btn', 'La he fallado');
  incorrect.type = 'button';
  incorrect.setAttribute('aria-pressed', String(current.verdict === 'incorrect'));
  const textNow = current.text || '';
  correct.addEventListener('click', () => ctx.onAnswer({ text: textNow, verdict: 'correct' }));
  incorrect.addEventListener('click', () => ctx.onAnswer({ text: textNow, verdict: 'incorrect' }));
  if (current.verdict === 'correct') correct.classList.add('is-correct');
  if (current.verdict === 'incorrect') incorrect.classList.add('is-incorrect');
  const actions = el(doc, 'div', 'short-actions');
  actions.append(correct, incorrect);
  container.append(label, area, model, actions);
}

function move(items, from, to) {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function statusText(question, answer, ctx) {
  if (question.type === 'SHORT_ANSWER') {
    const text = String(answer?.text ?? '').trim();
    if (!text || (answer?.verdict !== 'correct' && answer?.verdict !== 'incorrect')) {
      return text
        ? 'Pendiente de autoevaluación. No se puntúa automáticamente.'
        : 'La respuesta corta no se corrige sola. Pendiente de autoevaluación hasta que escribas y decidas.';
    }
    return answer.verdict === 'correct' ? 'Marcada como correcta' : 'Marcada como incorrecta';
  }
  if (question.type === 'ORDERING' && answer && !answer.confirmed && !ctx.reveal) {
    return 'Confirma el orden para que cuente como respuesta.';
  }
  if (!ctx.reveal) return '';
  const status = gradeQuestion(question, answer);
  if (status === 'correct') return 'Respuesta correcta';
  if (status === 'incorrect') return 'Respuesta incorrecta';
  if (status === 'pending') return 'Pendiente de autoevaluación. No se puntúa automáticamente.';
  if (status === 'skipped') return 'Pregunta omitida';
  return '';
}
