// tests/workshop-weight.js - A2339
// The weight report must be in sync, every page must sit inside the agreed
// budget, and the hub must defer offscreen catalogue rendering.
// Run: node tests/workshop-weight.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

let reportOk = false;
let reportOut = '';
try {
  reportOut = execFileSync(process.execPath, [path.join(SITE, 'scripts', 'workshop-weight-report.js'), '--check'], {
    cwd: SITE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  reportOk = true;
} catch (e) {
  reportOut = String(e.stdout || '') + String(e.stderr || '');
}
ok('weight report is in sync and inside budget', reportOk, reportOut.trim().split('\n').slice(-3).join(' | '));

const report = path.join(SITE, 'reports', 'workshop-weight.md');
ok('weight report exists', fs.existsSync(report));
if (fs.existsSync(report)) {
  const md = fs.readFileSync(report, 'utf8');
  ok('report names the hub', md.includes('pages/workshop.html'));
  ok('report lists the budget', /## Budget/.test(md) && /Gzip/.test(md));
  ok('report has a per-page baseline', /## All pages/.test(md) && /workshops\//.test(md));
}

const css = fs.readFileSync(path.join(SITE, 'style-workshop-hub.css'), 'utf8');
ok('catalogue cards defer offscreen rendering', /\.course-card\{[^}]*content-visibility:auto/.test(css));

const budget = JSON.parse(fs.readFileSync(path.join(SITE, 'content', 'workshop-weight-budget.json'), 'utf8'));
ok('budget covers the default page class', typeof budget.default === 'object' && budget.default.gzipKB > 0);
ok('hub has its own budget', budget.pages && budget.pages['pages/workshop.html']);

if (failures) {
  console.log('\nFAIL workshop-weight: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS workshop-weight: every workshop page and the hub are inside the agreed budget');
