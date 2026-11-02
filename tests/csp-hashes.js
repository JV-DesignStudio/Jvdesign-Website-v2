#!/usr/bin/env node
/*
 * tests/csp-hashes.js - A2248 regression guard.
 *
 * The unified build injects partials/head-icons.html (hashless CSP with
 * 'unsafe-inline') into every page. The csp stage must put the per-page
 * sha256 hashes back, or every build leaves a 466-file diff.
 *
 * Run: node tests/csp-hashes.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { processHtml } = require('../scripts/csp-hashes');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function ok(name, pass, detail) {
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!pass) failures++;
}

const body = 'console.log("hi")';
const expected = crypto.createHash('sha256').update(body).digest('base64');
const sample =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' blob:; style-src \'self\' \'unsafe-inline\'">\n' +
  '<script>' + body + '</script>\n';

const once = processHtml(sample);
ok('adds the sha256 hash for the inline script', once.includes("'sha256-" + expected + "'"));
ok('removes unsafe-inline from script-src', !/script-src[^;]*'unsafe-inline'/.test(once));
ok('leaves style-src unsafe-inline alone', once.includes("style-src 'self' 'unsafe-inline'"));
ok('is idempotent', processHtml(once) === once);

const external =
  '<meta http-equiv="Content-Security-Policy" content="script-src \'self\' \'unsafe-inline\' blob:">\n' +
  '<script src="/app.js"></script>\n';
const ext = processHtml(external);
ok('external-only page adds no hash', !/'sha256-/.test(ext));
ok('external-only page still drops unsafe-inline', !/script-src[^;]*'unsafe-inline'/.test(ext));

const noCsp = '<p>no csp here</p>';
ok('page without a CSP is unchanged', processHtml(noCsp) === noCsp);

const page = fs.readFileSync(path.join(ROOT, 'workshops', 'my-first-browser-game.html'), 'utf8');
ok('real page is already hash-clean', processHtml(page) === page);

const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'index.js'), 'utf8');
const partials = build.indexOf("id: 'partials'");
const csp = build.indexOf("id: 'csp'");
const sitemap = build.indexOf("id: 'sitemap'");
ok('build has a csp stage', csp > -1);
ok('csp runs after partials', csp > partials);
ok('csp runs before sitemap', csp < sitemap);

console.log('\n' + (failures === 0 ? 'CSP HASH CHECKS PASSED' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
