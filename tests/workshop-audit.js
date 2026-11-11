#!/usr/bin/env node
/*
 * A2957: prove the workshop audit grades every catalogue entry.
 * Runs scripts/audit-workshops.js against a temp output file, then checks:
 *   - every workshop-audit.json entry gets a result, checks and checkedAt
 *   - a complete canvas page passes
 *   - a redirect and a cheatsheet are reference pages, not failures
 *   - the result counts add up
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SITE = path.resolve(__dirname, '..');
const SOURCE = path.resolve(SITE, '..', 'studio-workspace', 'workshop-audit.json');
const tmp = path.join(os.tmpdir(), 'jvds-workshop-audit-' + process.pid + '.json');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

try {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const run = spawnSync(process.execPath, ['scripts/audit-workshops.js', '--out', tmp, '--json'], {
    cwd: SITE, encoding: 'utf8', timeout: 120000
  });
  check('auditor exits cleanly', run.status === 0, (run.stderr || '').trim().slice(0, 200));
  const out = JSON.parse(run.stdout || '{}');
  const items = out.workshops || [];

  check('every catalogue entry is audited', items.length === source.workshops.length,
    items.length + ' of ' + source.workshops.length);

  const bad = items.filter(function (w) {
    return !w.result || !w.checks || !w.checkedAt || !Array.isArray(w.missing);
  });
  check('every entry has result, checks, checkedAt and missing', bad.length === 0,
    bad.slice(0, 3).map(function (w) { return w.slug; }).join(', '));

  const allowed = new Set(['pass', 'needs-work', 'fails', 'reference']);
  const unknown = items.filter(function (w) { return !allowed.has(w.result); });
  check('results use the four known states', unknown.length === 0,
    unknown.slice(0, 3).map(function (w) { return w.slug + '=' + w.result; }).join(', '));

  const snake = items.find(function (w) { return w.slug === 'js-snake-workshop'; });
  check('complete canvas page passes', !!snake && snake.result === 'pass',
    snake ? snake.result + ' / ' + JSON.stringify(snake.pillars) : 'missing');

  const redirect = items.find(function (w) { return w.role === 'redirect'; });
  check('redirect pages are reference, not failures', !!redirect && redirect.result === 'reference',
    redirect ? redirect.slug + '=' + redirect.result : 'no redirect found');

  const cheatsheet = items.find(function (w) { return w.slug === 'blender-cheatsheet'; });
  check('cheatsheets are reference', !!cheatsheet && cheatsheet.result === 'reference',
    cheatsheet ? cheatsheet.result : 'missing');

  const s = out.stats || {};
  check('stats add up', s.pass + s.needsWork + s.fails + s.reference === items.length,
    JSON.stringify({ pass: s.pass, needsWork: s.needsWork, fails: s.fails, reference: s.reference, total: items.length }));
  check('graded count excludes reference pages', s.graded + s.reference === items.length,
    s.graded + ' graded + ' + s.reference + ' reference');
  check('audit writes a checkedAt stamp', !!out.checkedAt, out.checkedAt || '');

  if (failures) console.log('\n' + failures + ' FAILED');
  else console.log('\nALL PASS');
} catch (e) {
  console.error(e);
  failures++;
} finally {
  try { fs.unlinkSync(tmp); } catch (e) {}
}
process.exit(failures ? 1 : 0);
