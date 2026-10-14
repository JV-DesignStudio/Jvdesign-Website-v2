#!/usr/bin/env node
// scripts/csp-hashes.js (A1485): compute SHA-256 hashes for every inline
// <script> in each page and inject them into the page's CSP meta tag,
// replacing 'unsafe-inline' in script-src.
//   Run AFTER build.js (which syncs partials into pages).
//   node scripts/csp-hashes.js [--apply]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const IGN = new Set(['node_modules', '.git', '.claude', 'tmp', 'quest-board-deploy',
  '.aider.tags.cache.v4', 'assets', 'partials']);

let updated = 0, total = 0;

function processFile(p) {
  let s = fs.readFileSync(p, 'utf8');

  const cspRx = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")(.*?)(")/i;
  const cspMatch = cspRx.exec(s);
  if (!cspMatch) return;

  const hashes = [];
  const scriptRx = /<script(?!\s[^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while (m = scriptRx.exec(s)) {
    const body = m[1];
    if (!body.trim()) continue;
    const h = crypto.createHash('sha256').update(body.replace(/\r\n?/g, '\n')).digest('base64');
    hashes.push("'sha256-" + h + "'");
  }

  let csp = cspMatch[2];
  const hashStr = hashes.length ? ' ' + [...new Set(hashes)].join(' ') : '';
  csp = csp.replace(
    /script-src\s[^;]*/,
    function (dir) {
      let d = dir.replace(/\s*'unsafe-inline'\s*/g, ' ').replace(/\s*'sha256-[^']*'\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (hashStr) {
        d = d.replace(/^(script-src\s+'self')/, '$1' + hashStr);
      }
      return d;
    }
  );

  const newMeta = cspMatch[1] + csp + cspMatch[3];
  const newS = s.replace(cspMatch[0], newMeta);
  if (newS !== s) {
    total++;
    if (APPLY) { fs.writeFileSync(p, newS, 'utf8'); updated++; }
  }
}

const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (IGN.has(e.name)) continue;
    const q = path.join(d, e.name);
    if (e.isDirectory()) walk(q);
    else if (e.name.endsWith('.html')) processFile(q);
  }
};
walk(ROOT);

console.log((APPLY ? 'Updated ' : 'Would update ') + total + ' pages.');
if (!APPLY) console.log('Re-run with --apply to write.');
