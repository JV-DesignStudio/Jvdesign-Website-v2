#!/usr/bin/env node
// tests/workshop-key-coverage.js (A1429): every complete-able workshop must be
// reconciled into the single progress ledger.
//
// a workshop that includes the shared engine (*-engine.js) saves completion
// under window.WORKSHOP_KEY (or STORAGE_KEY). player-profile.js only folds a
// key into completedWorkshops when WORKSHOP_KEY_TO_ID contains it, so an
// unmapped engine page earns XP but never counts as "done". That drift is what
// this guard catches: terraria ep4-12 and the sim-lockdown series were built
// and linked but never mapped, so their completions vanished.
//
// Structural check (no browser). Exit 0 PASS, 1 FAIL.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'workshops');
let fails = 0;
const ok = (m) => console.log('  [OK] ' + m);
const fail = (m) => { fails++; console.log('  [FAIL] ' + m); };

const profileSrc = fs.readFileSync(path.join(ROOT, 'player-profile.js'), 'utf8');
const mapBlock = (profileSrc.match(/var WORKSHOP_KEY_TO_ID = \{([\s\S]*?)\};/) || [])[1] || '';
const mapped = new Set([...mapBlock.matchAll(/'([^']+)':/g)].map((m) => m[1]));
if (mapped.size < 100) fail('WORKSHOP_KEY_TO_ID did not parse (' + mapped.size + ' keys)');
else ok(mapped.size + ' keys in WORKSHOP_KEY_TO_ID');

const resolveKeys = (html, external) => {
  const body = html.match(/<body[^>]*\bdata-workshop-key\s*=\s*['"]([^'"]+)['"]/i);
  const src = html + '\n' + (external || '');
  const sm = src.match(/\b(?:const|let|var)\s+STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/);
  const wm = src.match(/window\.WORKSHOP_KEY\s*=\s*['"]([^'"]+)['"]/);
  const wEq = /window\.WORKSHOP_KEY\s*=\s*STORAGE_KEY/.test(src);
  const inline = sm ? sm[1] : null;
  let engine = wm ? wm[1] : null;
  if (!engine && wEq) engine = inline;
  if (!engine && body) engine = body[1];
  return { inline, engine };
};

/* A1707: inline configs were externalised (CSP), so window.WORKSHOP_KEY often
   lives in assets/js/inline/*.js rather than in the page. Read every local
   script the page loads as well as the page HTML. */
const localScriptText = (html, dir) => {
  const parts = [];
  const re = /<script[^>]*\bsrc=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const s = m[1].split('?')[0];
    if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:')) continue;
    const abs = s.startsWith('/') ? path.join(ROOT, s) : path.join(dir, s);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) parts.push(fs.readFileSync(abs, 'utf8'));
  }
  return parts.join('\n');
};

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html'));
const unmapped = [];
let engines = 0;
for (const f of files) {
  const html = fs.readFileSync(path.join(DIR, f), 'utf8');
  if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) continue;
  if (!/[a-z0-9-]*engine\.js/i.test(html)) continue;
  engines++;
  const { inline, engine } = resolveKeys(html, localScriptText(html, DIR));
  const key = engine || inline;
  if (!key) { unmapped.push(f + ' (no key)'); continue; }
  if (!mapped.has(key)) unmapped.push(f + ' -> ' + key);
}
if (engines === 0) fail('found no engine pages; engine script name changed?');
else ok(engines + ' engine workshop pages found');
if (unmapped.length === 0) ok('every engine workshop key is mapped in WORKSHOP_KEY_TO_ID');
else fail('unmapped engine workshop keys: ' + unmapped.join('; '));

// every SERIES episode shown in my-progress.html must also reconcile
const mpSrc = fs.readFileSync(path.join(DIR, 'my-progress.html'), 'utf8');
const seriesKeys = [...mpSrc.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((m) => m[1]);
const unmappedSeries = [...new Set(seriesKeys)].filter((k) => !mapped.has(k));
if (seriesKeys.length && unmappedSeries.length === 0) ok(seriesKeys.length + ' SERIES keys all mapped');
else fail('SERIES keys missing from map: ' + unmappedSeries.slice(0, 5).join(', '));

console.log(fails ? '\nworkshop-key-coverage: FAIL (' + fails + ')' : '\nworkshop-key-coverage: PASS');
process.exit(fails ? 1 : 0);
