import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['app.js', 'sw.js', 'playwright.config.js', 'eslint.config.js', 'src', 'test', 'e2e', 'scripts'];
const files = [];

function walk(entry) {
  if (!fs.existsSync(entry)) return;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entry)) {
      if (name === 'node_modules') continue;
      walk(path.join(entry, name));
    }
    return;
  }
  if (entry.endsWith('.js')) files.push(entry);
}

for (const root of roots) walk(root);

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(`${file}\n${result.stderr}`);
  }
}

if (failed) process.exit(1);
console.log(`syntax ok: ${files.length} files checked with node --check (this is not a bundle or dist build)`);
