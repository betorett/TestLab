import { PAPA_OPTIONS, parseCsvMatrix } from './csv-bank.js';
import { parseJsonBank } from './json-bank.js';

export function detectFormat(text, fileName = '') {
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.csv')) return 'csv';
  const trimmed = String(text ?? '').replace(/^\uFEFF/, '').trim();
  return trimmed.startsWith('{') ? 'json' : 'csv';
}

export function importBankText(text, fileName, papa) {
  if (detectFormat(text, fileName) === 'json') {
    return { format: 'json', ...parseJsonBank(text) };
  }
  const table = papa.parse(String(text ?? ''), PAPA_OPTIONS);
  return { format: 'csv', title: null, ...parseCsvMatrix(table.data || []) };
}
