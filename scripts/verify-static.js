import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
fs.rmSync(dist, { recursive: true, force: true });

const files = [
  'index.html',
  'style.css',
  'app.js',
  'sw.js',
  'manifest.json',
  'sample_exam.csv',
  'schema/testlab-bank-v1.schema.json',
  'examples/banco-mixto.csv',
  'examples/banco-mixto.json',
  'examples/figura.svg',
  ...fs.readdirSync('src').filter((name) => name.endsWith('.js')).map((name) => `src/${name}`)
];

for (const file of files) {
  const target = path.join(dist, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
}

const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const token of ['type="module"', 'src="app.js"', 'papaparse', 'style.css']) {
  if (!index.includes(token)) {
    console.error(`dist/index.html is missing ${token}`);
    process.exit(1);
  }
}

const schema = JSON.parse(fs.readFileSync(path.join(dist, 'schema/testlab-bank-v1.schema.json'), 'utf8'));
if (schema.$id !== 'testlab-bank-v1.schema.json' || schema.properties.schemaVersion.const !== 1) {
  console.error('dist schema is not the v1 contract');
  process.exit(1);
}

for (const file of files) {
  if (!fs.existsSync(path.join(dist, file)) || fs.statSync(path.join(dist, file)).size === 0) {
    console.error(`missing or empty artifact: ${file}`);
    process.exit(1);
  }
}

console.log(`static distribution ok: ${files.length} files copied to dist/ and checked`);
