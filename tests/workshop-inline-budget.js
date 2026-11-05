#!/usr/bin/env node
// tests/workshop-inline-budget.js (A2506): the Unity, Unreal, Blender and
// Tinkercad workshop genres moved their repeated inline styles into
// style-workshop-engines-shared.css. This guard keeps them from drifting back.
// Every genre must stay under 15 inline styles per page (A2506 acceptance).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKSHOPS = path.join(ROOT, 'workshops');
const CSS = 'style-workshop-engines-shared.css';

// Original inline-style totals before A2506, then the ceiling measured after the
// two conversion passes. The <15/page rule is the real gate.
const GENRES = {
  unity: { before: 935, ceiling: 18 },
  unreal: { before: 905, ceiling: 32 },
  blender: { before: 750, ceiling: 46 },
  tinkercad: { before: 665, ceiling: 4 }
};
const TARGET_PER_PAGE = 15;

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

const files = fs.readdirSync(WORKSHOPS).filter((f) => /\.html$/.test(f));
let grand = 0;
for (const [genre, cfg] of Object.entries(GENRES)) {
  const pages = files.filter((f) => f.startsWith(genre + '-'));
  let total = 0;
  for (const f of pages) {
    const html = fs.readFileSync(path.join(WORKSHOPS, f), 'utf8');
    total += (html.match(/style="/g) || []).length;
  }
  grand += total;
  const avg = pages.length ? total / pages.length : 0;
  check(genre + ': under ' + TARGET_PER_PAGE + ' inline styles per page', avg <= TARGET_PER_PAGE, avg.toFixed(1) + '/page, ' + total + ' total (was ' + cfg.before + ')');
  check(genre + ': under the ' + cfg.ceiling + ' inline-style ceiling', total <= cfg.ceiling, 'now ' + total);
  check(genre + ': shared stylesheet linked on every page', pages.every((f) => fs.readFileSync(path.join(WORKSHOPS, f), 'utf8').includes(CSS)), pages.length + ' pages');
}

const cssPath = path.join(ROOT, CSS);
check('shared stylesheet exists', fs.existsSync(cssPath), CSS);
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const classes = (css.match(/\.wsi2?-[a-z0-9-]+/g) || []).length;
  check('shared stylesheet defines the shared classes', classes >= 160, classes + ' classes');
  check('shared stylesheet keeps the theme tokens', /var\(--(charcoal|teal-dk|beige|unity-lt|ue-lt|accent)/.test(css));
}
check('overall inline styles cut by more than 95%', grand <= 150, grand + ' across 42 pages (was 3255)');

if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
console.log('\nWorkshop inline budget: all checks passed (' + grand + ' inline styles across 42 pages, ' + (grand / 42).toFixed(1) + '/page)');
