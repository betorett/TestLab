import { gradeQuestion } from './grade.js';
import { normalizeAnswerText, normalizeUnit } from './text.js';

const TEXT_TYPES = new Set(['FILL_BLANK', 'NUMERIC', 'SHORT_ANSWER']);

const TYPE_LABELS = {
  SINGLE: 'Selección única',
  MULTIPLE: 'Opción múltiple',
  TRUE_FALSE: 'Verdadero o falso',
  FILL_BLANK: 'Rellenar huecos',
  NUMERIC: 'Respuesta numérica',
  MATCHING: 'Emparejar conceptos',
  ORDERING: 'Ordenar secuencia',
  SHORT_ANSWER: 'Respuesta corta'
};

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function questionDomKey(question) {
  if (question.type === 'FILL_BLANK') return `FILL_BLANK:${question.prompt}:${question.body.blanks.length}`;
  if (question.type === 'NUMERIC') return `NUMERIC:${question.prompt}:${question.body.unit || ''}`;
  if (question.type === 'SHORT_ANSWER') return `SHORT_ANSWER:${question.prompt}`;
  return question.type;
}

function liveKey(question, ctx) {
  return `${ctx.idPrefix}:${questionDomKey(question)}`;
}

function canPreserveTextEntry(container, question, ctx) {
  if (ctx.reveal || !TEXT_TYPES.has(question.type)) return false;
  if (container.dataset.liveKey !== liveKey(question, ctx)) return false;
  if (container.dataset.revealed === 'true') return false;
  const active = container.ownerDocument.activeElement;
  if (!active || !container.contains(active)) return false;
  if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') return false;
  if (active.disabled || active.readOnly) return false;
  return true;
}

function syncStatus(container, question, answer, ctx) {
  const info = statusInfo(question, answer, ctx);
  const status = container.querySelector('.answer-status');
  if (!info.text) {
    status?.remove();
    return;
  }
  if (!status) {
    const node = el(container.ownerDocument, 'p', 'answer-status', info.text);
    node.dataset.tone = info.tone;
    container.append(node);
    return;
  }
  if (status.textContent !== info.text) status.textContent = info.text;
  status.dataset.tone = info.tone;
}

function syncShortVerdict(container, answer) {
  const actions = container.querySelector('.short-actions');
  if (!actions) return;
  const [correct, incorrect] = actions.querySelectorAll('button');
  if (!correct || !incorrect) return;
  const verdict = answer?.verdict;
  correct.classList.toggle('is-correct', verdict === 'correct');
  incorrect.classList.toggle('is-incorrect', verdict === 'incorrect');
  correct.setAttribute('aria-pressed', String(verdict === 'correct'));
  incorrect.setAttribute('aria-pressed', String(verdict === 'incorrect'));
}

export function renderQuestion(container, question, answer, ctx) {
  if (canPreserveTextEntry(container, question, ctx)) {
    syncStatus(container, question, answer, ctx);
    if (question.type === 'SHORT_ANSWER') syncShortVerdict(container, answer);
    return { preserved: true };
  }

  const doc = container.ownerDocument;
  container.replaceChildren();

  const headerMeta = el(doc, 'div', 'question-header-meta');
  const typeBadge = el(doc, 'span', 'question-type-badge', TYPE_LABELS[question.type] || question.type);
  headerMeta.append(typeBadge);
  if (question.type === 'MULTIPLE') {
    headerMeta.append(el(doc, 'span', 'meta question-type-hint', 'Puedes elegir varias respuestas.'));
  }
  container.append(headerMeta);

  appendImage(container, question);

  if (question.type === 'FILL_BLANK') renderBlanks(container, question, answer, ctx);
  else {
    const promptEl = el(doc, 'p', 'question-text', question.prompt);
    promptEl.id = `${ctx.idPrefix}-prompt`;
    container.append(promptEl);
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

  const info = statusInfo(question, answer, ctx);
  if (info.text) {
    const statusNode = el(doc, 'p', 'answer-status', info.text);
    statusNode.dataset.tone = info.tone;
    container.append(statusNode);
  }
  container.dataset.liveKey = TEXT_TYPES.has(question.type) ? liveKey(question, ctx) : '';
  container.dataset.revealed = ctx.reveal ? 'true' : 'false';
  return { preserved: false };
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
  list.setAttribute('role', 'group');
  list.setAttribute('aria-labelledby', `${ctx.idPrefix}-prompt`);
  const reveal = Boolean(ctx.reveal);
  question.body.choices.forEach((choice) => {
    const button = el(doc, 'button', 'option-btn');
    button.type = 'button';
    button.dataset.id = choice.id;
    button.append(el(doc, 'span', 'option-letter', choice.id));
    button.append(el(doc, 'span', 'option-text', choice.text));
    const pressed = selected.includes(choice.id);
    button.setAttribute('aria-pressed', String(pressed));
    if (pressed) {
      button.classList.add('selected');
      button.append(el(doc, 'span', 'checkbox-icon', '✓'));
      button.append(el(doc, 'span', 'visually-hidden', 'Seleccionada'));
    } else if (question.type === 'MULTIPLE') {
      button.append(el(doc, 'span', 'checkbox-icon', ''));
    }
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
    const itemWrap = el(doc, 'div', 'true-false-item');
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
      if (value === expected) {
        caption.classList.add('is-correct');
        itemWrap.classList.add('is-correct');
      }
      if (selected === value && value !== expected) {
        caption.classList.add('is-incorrect');
        itemWrap.classList.add('is-incorrect');
      }
    }
    itemWrap.append(input, caption);
    field.append(itemWrap);
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
    input.placeholder = `Hueco ${index + 1}`;
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
      ctx.onAnswer(inputs.map((field) => field.value));
    });
    return input;
  });

  const markers = question.prompt.match(/_{3,}/g) || [];
  const paragraph = el(doc, 'p', 'question-text question-text-blanks');
  if (markers.length === 0) {
    paragraph.textContent = question.prompt;
    container.append(paragraph);
    const stack = el(doc, 'div', 'blanks-stack');
    inputs.forEach((input, index) => {
      const label = el(doc, 'label', 'blank-label', `Hueco ${index + 1}`);
      label.htmlFor = input.id;
      const row = el(doc, 'div', 'blank-row');
      row.append(label, input);
      stack.append(row);
    });
    container.append(stack);
  } else {
    const parts = question.prompt.split(/_{3,}/);
    parts.forEach((part, index) => {
      paragraph.append(doc.createTextNode(part));
      if (inputs[index]) paragraph.append(inputs[index]);
    });
    container.append(paragraph);
  }

  if (ctx.reveal && gradeQuestion(question, answer) !== 'correct') {
    const expectedText = question.body.blanks.map((variants, i) => `Hueco ${i + 1}: ${variants.join(' / ')}`).join(' · ');
    container.append(el(doc, 'p', 'model-answer', `Soluciones válidas — ${expectedText}`));
  }
}

function renderNumeric(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const current = answer && typeof answer === 'object' ? answer : { value: '', unit: '' };
  const valueId = `${ctx.idPrefix}-value`;
  const valueLabel = el(doc, 'label', 'field-label', 'Valor');
  valueLabel.htmlFor = valueId;
  const value = doc.createElement('input');
  value.type = 'text';
  value.id = valueId;
  value.inputMode = 'decimal';
  value.autocomplete = 'off';
  value.spellcheck = false;
  value.placeholder = 'Ej. 9,81';
  value.value = current.value || '';
  const hint = el(doc, 'p', 'meta numeric-hint', `Tolerancia absoluta ±${question.body.tolerance}. Usa coma o punto decimal.`);
  hint.id = `${ctx.idPrefix}-hint`;
  value.setAttribute('aria-describedby', hint.id);
  let unit = null;
  const publishNumeric = () => ctx.onAnswer({
    value: value.value,
    unit: unit ? unit.value : ''
  });
  value.addEventListener('input', publishNumeric);

  const group = el(doc, 'div', 'numeric-fields');
  const grid = el(doc, 'div', 'numeric-grid');
  const valCol = el(doc, 'div', 'numeric-col');
  valCol.append(valueLabel, value);
  grid.append(valCol);

  if (question.body.unit) {
    const unitId = `${ctx.idPrefix}-unit`;
    const unitLabel = el(doc, 'label', 'field-label', `Unidad (${question.body.unit})`);
    unitLabel.htmlFor = unitId;
    unit = doc.createElement('input');
    unit.type = 'text';
    unit.id = unitId;
    unit.autocomplete = 'off';
    unit.spellcheck = false;
    unit.placeholder = question.body.unit;
    unit.value = current.unit || '';
    unit.addEventListener('input', publishNumeric);
    const unitCol = el(doc, 'div', 'numeric-col');
    unitCol.append(unitLabel, unit);
    grid.append(unitCol);
    if (ctx.reveal) {
      const matches = normalizeUnit(unit.value) === normalizeUnit(question.body.unit);
      unit.disabled = true;
      unit.classList.add(matches ? 'is-correct' : 'is-incorrect');
    }
  }
  if (ctx.reveal) {
    value.disabled = true;
    const isOk = gradeQuestion(question, { value: value.value, unit: current.unit || '' }) === 'correct';
    value.classList.add(isOk ? 'is-correct' : 'is-incorrect');
  }
  group.append(grid, hint);
  if (ctx.reveal && gradeQuestion(question, current) !== 'correct') {
    const unitSuffix = question.body.unit ? ` ${question.body.unit}` : '';
    group.append(el(doc, 'p', 'model-answer', `Valor esperado: ${question.body.value} (±${question.body.tolerance})${unitSuffix}`));
  }
  container.append(group);
}

function renderMatching(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const selections = Array.isArray(answer) ? answer : question.body.pairs.map(() => '');
  const rights = ctx.optionOrder || question.body.pairs.map((pair) => pair.right);
  const field = el(doc, 'fieldset', 'matching');
  field.append(el(doc, 'legend', 'matching-legend', 'Emparejamientos'));
  question.body.pairs.forEach((pair, index) => {
    const id = `${ctx.idPrefix}-match-${index}`;
    const row = el(doc, 'div', 'matching-row');
    const label = el(doc, 'label', 'matching-left', pair.left);
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
      const isOk = selections[index] === pair.right;
      select.classList.add(isOk ? 'is-correct' : 'is-incorrect');
      row.classList.add(isOk ? 'is-correct' : 'is-incorrect');
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
    if (ctx.reveal) {
      itemNode.classList.add(question.body.items[index] === item ? 'is-correct' : 'is-incorrect');
    }
    const stepBadge = el(doc, 'span', 'ordering-index', String(index + 1));
    stepBadge.setAttribute('aria-hidden', 'true');
    itemNode.append(stepBadge, el(doc, 'span', 'ordering-label', item));

    const controls = el(doc, 'div', 'ordering-controls');
    const up = el(doc, 'button', 'nav-btn ordering-move-btn', 'Subir');
    up.type = 'button';
    up.disabled = index === 0 || Boolean(ctx.reveal);
    up.setAttribute('aria-label', `Subir ${item}`);
    const down = el(doc, 'button', 'nav-btn ordering-move-btn', 'Bajar');
    down.type = 'button';
    down.disabled = index === state.order.length - 1 || Boolean(ctx.reveal);
    down.setAttribute('aria-label', `Bajar ${item}`);
    up.addEventListener('click', () => ctx.onAnswer({ order: move(state.order, index, index - 1), confirmed: true }));
    down.addEventListener('click', () => ctx.onAnswer({ order: move(state.order, index, index + 1), confirmed: true }));
    controls.append(up, down);
    itemNode.append(controls);
    list.append(itemNode);
  });
  container.append(list);
  const confirm = el(doc, 'button', `nav-btn ordering-confirm-btn${state.confirmed ? ' is-confirmed' : ''}`, 'Confirmar este orden');
  confirm.type = 'button';
  confirm.disabled = Boolean(ctx.reveal);
  confirm.addEventListener('click', () => ctx.onAnswer({ order: state.order.slice(), confirmed: true }));
  container.append(confirm);
  if (ctx.reveal && gradeQuestion(question, state) !== 'correct') {
    container.append(el(doc, 'p', 'model-answer', `Orden correcto: ${question.body.items.join(' → ')}`));
  }
}

function renderShort(container, question, answer, ctx) {
  const doc = container.ownerDocument;
  const current = answer && typeof answer === 'object' ? answer : { text: '', verdict: null };
  const id = `${ctx.idPrefix}-short`;
  const label = el(doc, 'label', 'field-label', 'Tu respuesta');
  label.htmlFor = id;
  const area = doc.createElement('textarea');
  area.id = id;
  area.rows = 4;
  area.placeholder = 'Escribe aquí tu desarrollo antes de compararlo con la respuesta modelo…';
  area.value = current.text || '';
  const locked = Boolean(ctx.reveal);
  area.readOnly = locked;
  area.addEventListener('input', () => {
    if (locked) {
      area.value = current.text || '';
      return;
    }
    ctx.onAnswer({ text: area.value, verdict: null });
  });
  const model = el(doc, 'p', 'model-answer');
  const modelLabel = el(doc, 'span', 'model-label', 'Respuesta modelo: ');
  model.append(modelLabel, doc.createTextNode(question.body.modelAnswer));
  const correct = el(doc, 'button', 'nav-btn short-verdict-btn', 'La he acertado');
  correct.type = 'button';
  correct.disabled = locked;
  correct.setAttribute('aria-pressed', String(current.verdict === 'correct'));
  const incorrect = el(doc, 'button', 'nav-btn short-verdict-btn', 'La he fallado');
  incorrect.type = 'button';
  incorrect.disabled = locked;
  incorrect.setAttribute('aria-pressed', String(current.verdict === 'incorrect'));
  const choose = (verdict) => {
    if (locked) return;
    ctx.onAnswer({ text: area.value, verdict });
  };
  correct.addEventListener('click', () => choose('correct'));
  incorrect.addEventListener('click', () => choose('incorrect'));
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

function statusInfo(question, answer, ctx) {
  if (question.type === 'SHORT_ANSWER') {
    const text = String(answer?.text ?? '').trim();
    if (!text || (answer?.verdict !== 'correct' && answer?.verdict !== 'incorrect')) {
      return {
        tone: 'pending',
        text: text
          ? 'Pendiente de autoevaluación. No se puntúa automáticamente.'
          : 'La respuesta corta no se corrige sola. Pendiente de autoevaluación hasta que escribas y decidas.'
      };
    }
    return {
      tone: answer.verdict === 'correct' ? 'correct' : 'incorrect',
      text: answer.verdict === 'correct' ? 'Marcada como correcta' : 'Marcada como incorrecta'
    };
  }
  if (question.type === 'ORDERING' && answer && !answer.confirmed && !ctx.reveal) {
    return {
      tone: 'info',
      text: 'Confirma el orden para que cuente como respuesta.'
    };
  }
  if (!ctx.reveal) return { tone: '', text: '' };
  const status = gradeQuestion(question, answer);
  if (status === 'correct') return { tone: 'correct', text: 'Respuesta correcta' };
  if (status === 'incorrect') return { tone: 'incorrect', text: 'Respuesta incorrecta' };
  if (status === 'pending') return { tone: 'pending', text: 'Pendiente de autoevaluación. No se puntúa automáticamente.' };
  if (status === 'skipped') return { tone: 'skipped', text: 'Pregunta omitida' };
  return { tone: '', text: '' };
}
