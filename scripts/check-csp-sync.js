#!/usr/bin/env node
// scripts/check-csp-sync.js (A1720)
// The shared policy in partials/head-icons.html is the source of truth (and
// _headers mirrors it for hosts that send response headers). Some pages hardcode
// their own CSP meta instead of using the BUILD:head-icons marker, so they drift
// silently: blob: was missing from script-src and connect-src on 123 pages.
// Fail when a page drops a token the shared policy allows, or when script-src
// regains 'unsafe-inline'.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE = new Set(['node_modules', '.git', '.claude', 'tmp', 'quest-board-deploy', 'partials']);

function cspFrom(html) {
  const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
  return m ? m[1] : '';
}

function directive(policy, name) {
  const m = new RegExp('\\b' + name + '\\s+([^;]*)').exec(policy);
  return m ? m[1].trim().split(/\s+/).filter(Boolean) : [];
}

const partial = cspFrom(fs.readFileSync(path.join(ROOT, 'partials', 'head-icons.html'), 'utf8'));
if (!partial) {
  console.error('csp-sync: FAIL (partials/head-icons.html has no CSP meta)');
  process.exit(1);
}
const headerLine = (fs.readFileSync(path.join(ROOT, '_headers'), 'utf8')
  .split('\n')
  .find((l) => l.trim().startsWith('Content-Security-Policy:')) || '')
  .replace(/^\s*Content-Security-Policy:\s*/, '').trim();

const needScript = directive(partial, 'script-src').includes('blob:');
const needConnect = directive(partial, 'connect-src').includes('blob:');
const fails = [];
if (!needScript) fails.push('partial script-src no longer allows blob: (update this guard)');
if (needScript && !directive(headerLine, 'script-src').includes('blob:')) fails.push('_headers script-src missing blob:');
if (needConnect && !directive(headerLine, 'connect-src').includes('blob:')) fails.push('_headers connect-src missing blob:');

let pages = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (IGNORE.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) {
      const s = fs.readFileSync(p, 'utf8');
      if (!s.includes('<head')) continue;
      const policy = cspFrom(s);
      if (!policy) continue; // tests/security-headers.js owns missing metas
      pages++;
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      const script = directive(policy, 'script-src');
      // Only enforce a directive the page actually declares. A page that omits
      // it falls back to default-src 'self', which is stricter, not drift.
      if (/\bscript-src\b/.test(policy)) {
        if (script.includes("'unsafe-inline'")) fails.push(rel + ': script-src has unsafe-inline');
        if (needScript && !script.includes('blob:')) fails.push(rel + ': script-src missing blob:');
      }
      if (/\bconnect-src\b/.test(policy) && needConnect && !directive(policy, 'connect-src').includes('blob:')) {
        fails.push(rel + ': connect-src missing blob:');
      }
    }
  }
}
walk(ROOT);

if (fails.length) {
  console.error('csp-sync: FAIL (' + fails.length + ')');
  for (const f of fails.slice(0, 30)) console.error('  [FAIL] ' + f);
  if (fails.length > 30) console.error('  ... and ' + (fails.length - 30) + ' more');
  process.exit(1);
}
console.log('csp-sync: PASS (' + pages + ' pages match the shared policy: script-src and connect-src allow blob:, no unsafe-inline)');
