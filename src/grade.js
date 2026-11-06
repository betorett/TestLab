import { normalizeAnswerText, normalizeUnit, parseDecimal, withinTolerance } from './text.js';

export function gradeQuestion(question, answer) {
  if (answer == null || answer === 'SKIPPED') return 'skipped';
  switch (question.type) {
    case 'SINGLE':
    case 'MULTIPLE':
      return gradeChoice(question, answer);
    case 'TRUE_FALSE':
      return gradeTrueFalse(question, answer);
    case 'FILL_BLANK':
      return gradeBlanks(question, answer);
    case 'NUMERIC':
      return gradeNumeric(question, answer);
    case 'MATCHING':
      return gradeMatching(question, answer);
    case 'ORDERING':
      return gradeOrdering(question, answer);
    case 'SHORT_ANSWER':
      return gradeShort(answer);
    default:
      return 'incorrect';
  }
}

function gradeChoice(question, answer) {
  if (!Array.isArray(answer) || answer.length === 0) return 'skipped';
  const expected = [...question.body.correctIds].sort();
  const given = [...answer].sort();
  if (given.length !== expected.length) return 'incorrect';
  return given.every((id, index) => id === expected[index]) ? 'correct' : 'incorrect';
}

function gradeTrueFalse(question, answer) {
  if (!Array.isArray(answer) || answer.length === 0) return 'skipped';
  if (answer.length !== 1) return 'incorrect';
  return answer[0] === (question.body.correct ? 'V' : 'F') ? 'correct' : 'incorrect';
}

function gradeBlanks(question, answer) {
  if (!Array.isArray(answer)) return 'skipped';
  if (answer.every((value) => String(value ?? '').trim() === '')) return 'skipped';
  const blanks = question.body.blanks;
  if (answer.length !== blanks.length) return 'incorrect';
  const matches = blanks.every((variants, index) => {
    const given = normalizeAnswerText(answer[index] ?? '');
    if (!given) return false;
    return variants.some((variant) => normalizeAnswerText(variant) === given);
  });
  return matches ? 'correct' : 'incorrect';
}

function gradeNumeric(question, answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return 'skipped';
  if (String(answer.value ?? '').trim() === '') return 'skipped';
  const parsed = parseDecimal(answer.value);
  if (!parsed.ok) return 'incorrect';
  if (question.body.unit && normalizeUnit(answer.unit ?? '') !== normalizeUnit(question.body.unit)) {
    return 'incorrect';
  }
  return withinTolerance(parsed.value, question.body.value, question.body.tolerance) ? 'correct' : 'incorrect';
}

function gradeMatching(question, answer) {
  if (!Array.isArray(answer)) return 'skipped';
  if (answer.every((value) => String(value ?? '').trim() === '')) return 'skipped';
  const pairs = question.body.pairs;
  if (answer.length !== pairs.length) return 'incorrect';
  return pairs.every((pair, index) => answer[index] === pair.right) ? 'correct' : 'incorrect';
}

function gradeOrdering(question, answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !answer.confirmed) return 'skipped';
  const items = question.body.items;
  if (!Array.isArray(answer.order) || answer.order.length !== items.length) return 'incorrect';
  return answer.order.every((item, index) => item === items[index]) ? 'correct' : 'incorrect';
}

function gradeShort(answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return 'skipped';
  if (String(answer.text ?? '').trim() === '') return 'skipped';
  if (answer.verdict !== 'correct' && answer.verdict !== 'incorrect') return 'pending';
  return answer.verdict;
}
