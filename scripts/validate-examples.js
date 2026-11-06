import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import Papa from 'papaparse';
import { importBankText } from '../src/import-bank.js';
import { parseJsonBank } from '../src/json-bank.js';

const schema = JSON.parse(fs.readFileSync(new URL('../schema/testlab-bank-v1.schema.json', import.meta.url), 'utf8'));
const document = JSON.parse(fs.readFileSync(new URL('../examples/banco-mixto.json', import.meta.url), 'utf8'));
const csv = fs.readFileSync(new URL('../examples/banco-mixto.csv', import.meta.url), 'utf8');

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
if (!validate(document)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

const jsonBank = parseJsonBank(JSON.stringify(document));
if (jsonBank.errors.length || jsonBank.questions.length !== document.questions.length) {
  console.error(jsonBank.errors);
  process.exit(1);
}

const csvBank = importBankText(csv, 'banco-mixto.csv', Papa);
if (csvBank.errors.length || csvBank.questions.length !== 10) {
  console.error(csvBank.errors);
  console.error(`CSV questions: ${csvBank.questions.length}`);
  process.exit(1);
}

console.log(`examples ok: Ajv accepted banco-mixto.json (${jsonBank.questions.length} questions); CSV imported ${csvBank.questions.length} questions`);
