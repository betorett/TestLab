import { inspectImageSrc } from './image-url.js';
import { validateBankDocument } from './validate-bank.js';

export { validateBankDocument };

export function parseJsonBank(text) {
  let data;
  try {
    data = JSON.parse(String(text ?? '').replace(/^\uFEFF/, ''));
  } catch (error) {
    return {
      questions: [],
      errors: [{ path: '', message: `JSON inválido: ${error.message}` }],
      title: null
    };
  }
  const validation = validateBankDocument(data);
  if (!validation.ok) return { questions: [], errors: validation.errors, title: null };
  return {
    questions: bankDocumentToQuestions(data),
    errors: [],
    title: typeof data.title === 'string' ? data.title.trim() : null
  };
}

export function bankDocumentToQuestions(data) {
  const validation = validateBankDocument(data);
  if (!validation.ok) {
    const error = new Error('Banco JSON inválido');
    error.errors = validation.errors;
    throw error;
  }
  return data.questions.map(toQuestion);
}

function toQuestion(question) {
  const prompt = question.prompt.trim();
  const image = question.image
    ? {
        src: inspectImageSrc(question.image.src).src,
        alt: typeof question.image.alt === 'string' && question.image.alt.trim()
          ? question.image.alt.trim()
          : prompt
      }
    : null;
  const base = {
    id: typeof question.id === 'string' ? question.id.trim() : null,
    type: question.type,
    prompt,
    image
  };

  switch (question.type) {
    case 'SINGLE':
      return { ...base, body: { choices: mapChoices(question.choices), correctIds: [question.answer] } };
    case 'MULTIPLE':
      return { ...base, body: { choices: mapChoices(question.choices), correctIds: [...question.answer] } };
    case 'TRUE_FALSE':
      return { ...base, body: { correct: question.answer } };
    case 'FILL_BLANK':
      return {
        ...base,
        body: { blanks: question.blanks.map((group) => group.map((variant) => variant.trim())) }
      };
    case 'NUMERIC':
      return {
        ...base,
        body: {
          value: question.answer.value,
          tolerance: question.answer.tolerance,
          unit: typeof question.answer.unit === 'string' ? question.answer.unit.trim() : null
        }
      };
    case 'MATCHING':
      return {
        ...base,
        body: {
          pairs: question.pairs.map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
        }
      };
    case 'ORDERING':
      return { ...base, body: { items: question.items.map((item) => item.trim()) } };
    case 'SHORT_ANSWER':
      return { ...base, body: { modelAnswer: question.modelAnswer.trim() } };
    default:
      throw new Error(`Tipo no convertible: ${question.type}`);
  }
}

function mapChoices(choices) {
  return choices.map((choice) => ({ id: choice.id, text: choice.text.trim() }));
}
