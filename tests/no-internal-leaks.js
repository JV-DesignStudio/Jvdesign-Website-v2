#!/usr/bin/env node
/*
 * tests/no-internal-leaks.js (A2024): the public site must not expose the
 * private board token, the localhost board server, the private workspace path
 * or the telemetry file. Scans deployed HTML and the same-origin scripts those
 * pages load, plus the sitemap and search index.
 *
 * Run: node tests/no-internal-leaks.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.worktrees', '.claude', 'tmp', 'reports', 'generated-images', 'downloads', 'social-posts', 'quest-board-deploy', 'docs']);
// The private mirror is allowlisted by scripts/validate-public-boundary.js and
// is not tracked in Git, so it is not a deployed page.
const IGNORE_FILES = new Set(['pages/dev-board.html', 'dev-board.html']);

const PATTERNS = [
  { re: /x-studio-token/i, name: 'board token header' },
  { re: /board-token/i, name: 'board token file' },
  { re: /\bBOARD_TOKEN\b/, name: 'board token env' },
  { re: /localhost:8787/i, name: 'local board server' },
  { re: /127\.0\.0\.1:8787/, name: 'local board server' },
  { re: /studio-workspace/i, name: 'private workspace path' },
  { re: /board-telemetry/i, name: 'private telemetry file' },
];

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(p);
    } else if (entry.name.endsWith('.html')) {
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      if (!IGNORE_FILES.has(rel)) htmlFiles.push(p);
    }
  }
})(ROOT);

const leaks = [];
const scriptFiles = new Set();
function scan(rel, text, where) {
  for (const p of PATTERNS) {
    if (p.re.test(text)) leaks.push(rel + ' (' + p.name + ')');
  }
}

for (const fp of htmlFiles) {
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  const text = fs.readFileSync(fp, 'utf8');
  scan(rel, text, 'html');
  for (const m of text.matchAll(/<script\b[^>]*src=["'](\/[^"'?]+\.js)[^"']*["']/gi)) {
    scriptFiles.add(m[1]);
  }
}

for (const src of scriptFiles) {
  const fp = path.join(ROOT, src.replace(/^\//, ''));
  if (!fs.existsSync(fp)) continue;
  scan(src, fs.readFileSync(fp, 'utf8'), 'script');
}

check('public HTML and same-origin scripts expose no board token, server or private path', leaks.length === 0, leaks.slice(0, 6).join(' | ') || htmlFiles.length + ' pages, ' + scriptFiles.size + ' scripts');

for (const file of ['sitemap.xml', 'search-index.json']) {
  const p = path.join(ROOT, file);
  const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const bad = [/studio-workspace/i, /tasks\.json/i, /board-data\.json/i, /dev-board\.html/i, /localhost:8787/i].filter((re) => re.test(text));
  check(file + ' lists no private pages or paths', bad.length === 0, bad.join(', ') || 'clean');
}

console.log('\n' + (failures === 0 ? 'NO INTERNAL LEAKS PASSED' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
