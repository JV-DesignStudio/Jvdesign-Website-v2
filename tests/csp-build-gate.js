#!/usr/bin/env node
// tests/csp-build-gate.js (A2625)
// Proves the build keeps CSP hashes in step:
//   1. a page with a matching hash passes the check,
//   2. a stale hash or a new inline script is flagged,
//   3. an inline script with no CSP meta is flagged,
//   4. external scripts and script-free pages are clean,
//   5. the repo passes `csp-hashes --check`, the shared policy is in sync,
//      and `npm run build` runs apply then check.
// Run: node tests/csp-build-gate.js
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { processHtml, checkHtml } = require('../scripts/csp-hashes.js');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'">';
const page = (head, body) => '<!doctype html><html><head>' + head + '</head><body>' + body + '</body></html>';
const inline = "<script>console.log('hi')</script>";

const applied = processHtml(page(CSP, inline));
check('a matching hash passes the check', checkHtml(applied).length === 0, JSON.stringify(checkHtml(applied)));
check('the hash is idempotent', processHtml(applied) === applied);
check('a stale hash is flagged', checkHtml(page(CSP, inline)).includes('CSP hashes out of date'), JSON.stringify(checkHtml(page(CSP, inline))));
check('a newly added inline script is flagged', checkHtml(applied.replace('</body>', '<script>window.__new=1;</script></body>')).includes('CSP hashes out of date'));
check('an inline script with no CSP meta is flagged', checkHtml(page('', inline)).includes('inline script but no CSP meta'), JSON.stringify(checkHtml(page('', inline))));
check('a script-free page is clean', checkHtml(page(CSP, '<p>hi</p>')).length === 0);
check('an external script is clean', checkHtml(page(CSP, '<script src="/app.js"></script>')).length === 0);

const cli = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'csp-hashes.js'), '--check'], { encoding: 'utf8' });
check('the repo passes csp-hashes --check', /PASS/.test(cli), cli.trim());

const sync = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'check-csp-sync.js')], { encoding: 'utf8' });
check('the shared CSP policy is in sync', /PASS/.test(sync), sync.trim());

const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'index.js'), 'utf8');
check('npm run build runs apply then check', /csp-hashes\.js'\), '--apply'/.test(build) && /csp-hashes\.js'\), '--check'/.test(build));

if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
console.log('\nCSP BUILD GATE CHECKS PASSED');
