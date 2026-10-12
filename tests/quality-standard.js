#!/usr/bin/env node
// tests/quality-standard.js (A1436): the audit board points at one definition of
// finished (QUALITY_STANDARD.md). This guard keeps that document honest: it must
// keep defining the four dispositions and a checklist for every asset type, and
// it must stay consistent with the game labels in GAME_QUALITY.md.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const check = (label, ok) => { console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${label}`); if (!ok) fails++; };

const stdPath = path.join(ROOT, 'QUALITY_STANDARD.md');
const gamePath = path.join(ROOT, 'GAME_QUALITY.md');
check('QUALITY_STANDARD.md exists', fs.existsSync(stdPath));
check('GAME_QUALITY.md exists', fs.existsSync(gamePath));
if (!fs.existsSync(stdPath) || !fs.existsSync(gamePath)) process.exit(1);

const std = fs.readFileSync(stdPath, 'utf8');
const game = fs.readFileSync(gamePath, 'utf8');

for (const d of ['Keep-and-polish', 'Fix-before-release', 'Merge-or-simplify', 'Remove-or-archive']) {
  check(`defines disposition ${d}`, std.includes(d));
}
for (const t of ['### Game', '### Workshop', '### Tool', '### App', '### Site page']) {
  check(`has a checklist ${t.replace('### ', '')}`, std.includes(t));
}
check('points at GAME_QUALITY.md', /GAME_QUALITY\.md/.test(std));
check('states the owner + checklist + evidence rule', /owner[\s\S]*checklist[\s\S]*evidence/i.test(std));

for (const label of ['READY', 'BETA', 'EXPERIMENT', 'HIDDEN']) {
  check(`GAME_QUALITY.md still defines ${label}`, game.includes(label));
}

console.log(fails ? `\nquality-standard: FAIL (${fails})` : '\nquality-standard: PASS');
process.exit(fails ? 1 : 0);
