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
const CHECK = process.argv.includes('--check');
const IGN = new Set(['node_modules', '.git', '.claude', 'tmp', 'quest-board-deploy',
  '.aider.tags.cache.v4', 'assets', 'partials']);
// Vendored third-party exports: their own inline scripts and CSP contracts are
// not ours to rewrite. The Godot web editor is a copied engine build.
const SKIP_DIRS = new Set(['workshops/godot-lab/editor']);

// A2625: the hashes a page needs for its inline scripts.
function inlineHashes(s) {
  const hashes = [];
  const scriptRx = /<script(?!\s[^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while (m = scriptRx.exec(s)) {
    const body = m[1];
    if (!body.trim()) continue;
    const h = crypto.createHash('sha256').update(body.replace(/\r\n?/g, '\n')).digest('base64');
    hashes.push("'sha256-" + h + "'");
  }
  return hashes;
}

function processHtml(s) {
  const cspRx = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")(.*?)(")/i;
  const cspMatch = cspRx.exec(s);
  if (!cspMatch) return s;

  const hashes = inlineHashes(s);

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
  return s.replace(cspMatch[0], newMeta);
}

// A2625: fail when a page's CSP is not the applied state (a new inline script
// was added and the hashes were not regenerated) or when an inline script has
// no CSP meta at all, so the build cannot silently ship a blocked script.
function checkHtml(s) {
  const hashes = inlineHashes(s);
  const cspMatch = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")(.*?)(")/i.exec(s);
  if (!cspMatch) return hashes.length ? ['inline script but no CSP meta'] : [];
  if (processHtml(s) !== s) return ['CSP hashes out of date'];
  return [];
}

let updated = 0, total = 0;
const failures = [];

function processFile(p) {
  const s = fs.readFileSync(p, 'utf8');
  if (CHECK) {
    const issues = checkHtml(s);
    if (issues.length) failures.push(path.relative(ROOT, p).replace(/\\/g, '/') + ': ' + issues.join(', '));
    return;
  }
  const newS = processHtml(s);
  if (newS !== s) {
    total++;
    if (APPLY) { fs.writeFileSync(p, newS, 'utf8'); updated++; }
  }
}

const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (IGN.has(e.name)) continue;
    const q = path.join(d, e.name);
    if (e.isDirectory()) {
      const rel = path.relative(ROOT, q).replace(/\\/g, '/');
      if (SKIP_DIRS.has(rel)) continue;
      walk(q);
    }
    else if (e.name.endsWith('.html')) processFile(q);
  }
};

if (require.main === module) {
  walk(ROOT);
  if (CHECK) {
    if (failures.length) {
      console.error('csp-hashes: FAIL (' + failures.length + ')');
      failures.slice(0, 30).forEach((f) => console.error('  ' + f));
      if (failures.length > 30) console.error('  ... and ' + (failures.length - 30) + ' more');
      process.exit(1);
    }
    console.log('csp-hashes: PASS (every inline script has a matching CSP hash)');
  } else {
    console.log((APPLY ? 'Updated ' : 'Would update ') + total + ' pages.');
    if (!APPLY) console.log('Re-run with --apply to write.');
  }
}

module.exports = { processHtml, checkHtml, inlineHashes };
