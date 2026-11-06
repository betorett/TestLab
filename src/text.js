const SUPERSCRIPTS = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+'
};

export function normalizeAnswerText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function canonicalTrueFalse(value) {
  const normalized = normalizeAnswerText(value);
  if (normalized === 'v' || normalized === 'verdadero') return 'V';
  if (normalized === 'f' || normalized === 'falso') return 'F';
  return null;
}

export function parseDecimal(value) {
  const text = String(value ?? '').trim();
  if (!text) return { ok: false, message: 'El número está vacío' };
  if (/[eE]|infinity|nan/i.test(text)) {
    return { ok: false, message: 'El número debe ser finito, sin notación científica' };
  }
  const comma = (text.match(/,/g) || []).length;
  const dot = (text.match(/\./g) || []).length;
  if ((comma > 0 && dot > 0) || comma > 1 || dot > 1) {
    return { ok: false, message: 'Usa un solo separador decimal, coma o punto' };
  }
  const normalized = text.replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    return { ok: false, message: 'Número no válido' };
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { ok: false, message: 'El número debe ser finito' };
  return { ok: true, value: parsed };
}

export function withinTolerance(answer, expected, tolerance) {
  if (!Number.isFinite(answer) || !Number.isFinite(expected) || !Number.isFinite(tolerance)) return false;
  if (tolerance < 0) return false;
  const scale = Math.max(1, Math.abs(expected), Math.abs(answer), Math.abs(tolerance));
  const epsilon = 8 * Number.EPSILON * scale;
  return Math.abs(answer - expected) <= tolerance + epsilon;
}

export function normalizeUnit(value) {
  const source = String(value ?? '').trim().toLowerCase();
  let unit = '';
  let inSuperscript = false;
  for (const char of source) {
    if (Object.prototype.hasOwnProperty.call(SUPERSCRIPTS, char)) {
      if (!inSuperscript) {
        unit += '^';
        inSuperscript = true;
      }
      unit += SUPERSCRIPTS[char];
    } else {
      inSuperscript = false;
      unit += char;
    }
  }
  return unit.replace(/\s+/g, '');
}
