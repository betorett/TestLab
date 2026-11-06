export function coerceStoredQuestion(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Pregunta almacenada inválida');
  if (typeof raw.prompt === 'string' && raw.body && typeof raw.type === 'string') {
    return structuredClone(raw);
  }
  if (typeof raw.text === 'string' && Array.isArray(raw.options) && Array.isArray(raw.correct)) {
    const type = String(raw.type || '').toUpperCase().includes('MULT') ? 'MULTIPLE' : 'SINGLE';
    return {
      id: null,
      type,
      prompt: raw.text,
      image: raw.image ?? null,
      body: {
        choices: raw.options.map((option) => ({ id: String(option.id), text: String(option.text) })),
        correctIds: raw.correct.map(String)
      }
    };
  }
  throw new Error('Formato de pregunta almacenado no reconocido');
}
