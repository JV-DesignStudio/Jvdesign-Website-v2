#!/usr/bin/env node
// A963: page consistency guard. Every indexable page should declare exactly one
// canonical URL, canonicals should be unique, and they should point at the live host.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['', 'pages', 'tools', 'workshops', 'games'];
const files = [];
for (const d of DIRS) {
  const full = path.join(ROOT, d);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) if (f.endsWith('.html') && !f.startsWith('_')) files.push(path.join(d, f).replace(/\\/g, '/'));
}

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const canon = {};
const missing = [];
const multi = [];
const wrongHost = [];
for (const rel of files) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (/http-equiv=["']refresh["']/i.test(html) || /name=["']robots["'][^>]*noindex/i.test(html) || /-canvas\.html$/.test(rel)) continue;
  const links = [...html.matchAll(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi)].map(m => m[1].trim());
  if (links.length === 0) { missing.push(rel); continue; }
  if (links.length > 1) multi.push(rel + ' (' + links.length + ')');
  const href = links[0];
  if (!/^https:\/\/jvdesignstudio\.co\.uk\//.test(href)) wrongHost.push(rel + ' -> ' + href);
  (canon[href] = canon[href] || []).push(rel);
}
const dupCanon = Object.entries(canon).filter(([, v]) => v.length > 1);

ok('every indexable page has a canonical link', missing.length === 0, missing.slice(0, 5).join(', ') || 'all present');
ok('no page declares more than one canonical', multi.length === 0, multi.slice(0, 5).join(', ') || 'all single');
ok('canonical URLs are unique', dupCanon.length === 0, dupCanon.slice(0, 3).map(([k, v]) => k + ' (' + v.join(', ') + ')').join(' | ') || 'all unique');
ok('canonical URLs use the live host', wrongHost.length === 0, wrongHost.slice(0, 5).join(', ') || 'all correct');

console.log(failures === 0 ? 'ALL PAGE CONSISTENCY CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
