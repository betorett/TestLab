import { gradeQuestion } from './grade.js';

const CHECKED_TYPES = new Set(['MULTIPLE', 'FILL_BLANK', 'NUMERIC', 'MATCHING', 'ORDERING']);

export function canAdvance({ question, answer, mode, reviewing, checked }) {
  if (reviewing || mode === 'exam') return true;
  if (answer === 'SKIPPED') return true;
  if (question.type === 'SHORT_ANSWER') {
    const status = gradeQuestion(question, answer);
    return status === 'correct' || status === 'incorrect';
  }
  if (question.type === 'SINGLE' || question.type === 'TRUE_FALSE') {
    return gradeQuestion(question, answer) !== 'skipped';
  }
  if (question.type === 'ORDERING') return Boolean(checked) && Boolean(answer?.confirmed);
  if (CHECKED_TYPES.has(question.type)) return Boolean(checked);
  return false;
}

export function countsAsAnswered(question, answer) {
  if (answer === 'SKIPPED') return true;
  return gradeQuestion(question, answer) !== 'skipped';
}

export function isReadyToCheck(question, answer) {
  if (answer == null || answer === 'SKIPPED') return false;
  switch (question.type) {
    case 'MULTIPLE':
      return Array.isArray(answer) && answer.length > 0;
    case 'FILL_BLANK':
      return Array.isArray(answer)
        && answer.length === question.body.blanks.length
        && answer.every((value) => String(value).trim() !== '');
    case 'NUMERIC':
      return String(answer.value ?? '').trim() !== '';
    case 'MATCHING':
      return Array.isArray(answer)
        && answer.length === question.body.pairs.length
        && answer.every((value) => String(value).trim() !== '');
    case 'ORDERING':
      return Boolean(answer.confirmed);
    case 'SHORT_ANSWER':
      return String(answer.text ?? '').trim() !== '';
    default:
      return false;
  }
}

export function shuffleItems(items, rng = Math.random) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function blankAnswer(question, rng = Math.random) {
  switch (question.type) {
    case 'FILL_BLANK':
      return question.body.blanks.map(() => '');
    case 'NUMERIC':
      return { value: '', unit: '' };
    case 'MATCHING':
      return question.body.pairs.map(() => '');
    case 'ORDERING':
      return { order: shuffleItems(question.body.items, rng), confirmed: false };
    case 'SHORT_ANSWER':
      return { text: '', verdict: null };
    default:
      return [];
  }
}
