#!/usr/bin/env node
// tests/tools-workflow.js (A1426): a tool may only sit in the public catalogue
// if its primary workflow actually exists. A create tool needs somewhere to
// keep work (browser-local save) and a way to get it out (export/download);
// a utility needs an export. Reference/board pages are exempt by design.
// This is the guard behind "hide unfinished tools until repaired": if a
// catalogue entry loses its save or export, this fails instead of shipping a
// dead-end.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const fail = (m) => { fails++; console.log('  [FAIL] ' + m); };

const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
const classify = (id) => {
  const l = id.toLowerCase();
  if (/cheat|glossary|worksheet|shortcut|reference|starter-setup|starter-guide|guide|gallery|parent-guide/.test(l)) return 'reference';
  if (/tracker|quest-board/.test(l)) return 'board';
  if (['asset-packs', 'certificate', 'code-snippet-generator', 'game-idea-generator', 'game-logo-maker'].includes(id)) return 'utility';
  return 'create';
};

let checked = 0;
const problems = [];
for (const t of tools) {
  const rel = (t.url || '').replace(/^\//, '');
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { problems.push(`${t.id}: catalogued file missing (${rel})`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  checked++;
  const kind = classify(t.id);
  const noindex = /<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
  if (noindex) problems.push(`${t.id}: catalogued but noindex (should be public or removed)`);
  const hasSave = /localStorage|IndexedDB|autosave|saveProject/i.test(html);
  const hasExport = /export|download/i.test(html);
  if (kind === 'create' && (!hasSave || !hasExport)) {
    problems.push(`${t.id}: create tool missing ${!hasSave ? 'browser save' : 'export/download'}`);
  }
  if (kind === 'utility' && !hasExport) problems.push(`${t.id}: utility missing export/download`);
}

if (problems.length === 0) {
  console.log(`  [OK] ${checked} catalogued tools have their primary workflow (create=save+export, utility=export)`);
} else {
  problems.forEach(fail);
}
console.log(fails ? `\ntools-workflow: FAIL (${fails})` : '\ntools-workflow: PASS');
process.exit(fails ? 1 : 0);
