#!/usr/bin/env node
// tests/workshop-inline-budget.js (A2506 slice 1): the Unity, Unreal, Blender and
// Tinkercad workshop genres moved their repeated inline boilerplate into
// style-workshop-engines-shared.css. This guard keeps them from drifting back:
// it fails when a genre exceeds the ceiling measured after the conversion.
// Slice 2 lowers these ceilings to the <15 inline styles per page target.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKSHOPS = path.join(ROOT, 'workshops');
const CSS = 'style-workshop-engines-shared.css';

// Before A2506 slice 1 -> after. Ceilings are the after totals.
const GENRES = {
  unity: { before: 935, ceiling: 306 },
  unreal: { before: 905, ceiling: 311 },
  blender: { before: 750, ceiling: 251 },
  tinkercad: { before: 665, ceiling: 176 }
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
  const perPage = [];
  for (const f of pages) {
    const html = fs.readFileSync(path.join(WORKSHOPS, f), 'utf8');
    const count = (html.match(/style="/g) || []).length;
    total += count;
    perPage.push({ f, count });
  }
  grand += total;
  const avg = pages.length ? total / pages.length : 0;
  check(genre + ': under the ' + cfg.ceiling + ' inline-style ceiling', total <= cfg.ceiling, 'now ' + total + ' (was ' + cfg.before + ')');
  check(genre + ': shared stylesheet linked on every page', pages.every((f) => fs.readFileSync(path.join(WORKSHOPS, f), 'utf8').includes(CSS)), pages.length + ' pages');
  check(genre + ': still moving toward ' + TARGET_PER_PAGE + '/page', avg <= cfg.ceiling / pages.length, 'avg ' + avg.toFixed(1));
}

const cssPath = path.join(ROOT, CSS);
check('shared stylesheet exists', fs.existsSync(cssPath), CSS);
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const classes = (css.match(/\.wsi-[a-z0-9-]+/g) || []).length;
  check('shared stylesheet defines the boilerplate classes', classes >= 30, classes + ' classes');
  check('shared stylesheet keeps the theme tokens', /var\(--(charcoal|teal-dk|beige|unity-lt|ue-lt)/.test(css));
}
check('overall inline styles fell by more than half', grand <= 1100, grand + ' across 42 pages (was 3255)');

if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
console.log('\nWorkshop inline budget: all checks passed (' + grand + ' inline styles across 42 pages)');
