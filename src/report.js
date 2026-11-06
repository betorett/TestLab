import { gradeQuestion } from './grade.js';

const LABELS = {
  correct: 'CORRECTA',
  incorrect: 'INCORRECTA',
  skipped: 'OMITIDA',
  pending: 'PENDIENTE DE AUTOEVALUACIÓN'
};

export function describeAttempt(question, answer) {
  const status = gradeQuestion(question, answer);
  return {
    status,
    label: LABELS[status] || status,
    detail: [
      `Enunciado: ${question.prompt}`,
      `Respuesta dada: ${formatGiven(question, answer)}`,
      `Referencia: ${formatReference(question)}`
    ].join('\n')
  };
}

export function formatReference(question) {
  switch (question.type) {
    case 'SINGLE':
    case 'MULTIPLE':
      return question.body.correctIds.join(' y ');
    case 'TRUE_FALSE':
      return question.body.correct ? 'Verdadero' : 'Falso';
    case 'FILL_BLANK':
      return question.body.blanks.map((group) => group.join(' / ')).join(' || ');
    case 'NUMERIC': {
      const unit = question.body.unit ? ` ${question.body.unit}` : '';
      return `${question.body.value} ± ${question.body.tolerance}${unit}`;
    }
    case 'MATCHING':
      return question.body.pairs.map((pair) => `${pair.left} => ${pair.right}`).join(' | ');
    case 'ORDERING':
      return question.body.items.join(' | ');
    case 'SHORT_ANSWER':
      return `Respuesta modelo (no es corrección automática): ${question.body.modelAnswer}`;
    default:
      return '';
  }
}

function formatGiven(question, answer) {
  if (answer == null || answer === 'SKIPPED') return '(en blanco)';
  switch (question.type) {
    case 'SINGLE':
    case 'MULTIPLE':
    case 'TRUE_FALSE':
      return Array.isArray(answer) && answer.length ? answer.join(' y ') : '(en blanco)';
    case 'FILL_BLANK':
      return Array.isArray(answer) ? answer.map((value) => value || '∅').join(' || ') : '(en blanco)';
    case 'NUMERIC':
      return `${answer.value || '(vacío)'}${answer.unit ? ` ${answer.unit}` : ''}`;
    case 'MATCHING':
      return question.body.pairs.map((pair, index) => `${pair.left} => ${answer[index] || '∅'}`).join(' | ');
    case 'ORDERING':
      return answer.confirmed ? answer.order.join(' | ') : '(orden sin confirmar)';
    case 'SHORT_ANSWER':
      return `${answer.text || '(vacío)'} [veredicto: ${answer.verdict || 'pendiente'}]`;
    default:
      return String(answer);
  }
}
