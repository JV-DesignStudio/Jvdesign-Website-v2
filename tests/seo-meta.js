#!/usr/bin/env node
// A965: Every real page must have a unique, non-empty <title> and meta description.
// Redirect stubs (meta refresh), noindex pages and canvas embeds are skipped: they are
// deliberately not indexable landing pages.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['', 'pages', 'tools', 'workshops', 'games'];

const files = [];
for (const d of DIRS) {
  const full = path.join(ROOT, d);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith('.html') || f.startsWith('_')) continue;
    files.push(path.join(d, f).replace(/\\/g, '/'));
  }
}

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const titles = {};
const descs = {};
const missingTitle = [];
const missingDesc = [];
let real = 0;

for (const rel of files) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const isRedirect = /http-equiv=["']refresh["']/i.test(html);
  const isNoindex = /name=["']robots["'][^>]*noindex/i.test(html);
  const isCanvas = /-canvas\.html$/.test(rel);
  if (isRedirect || isNoindex || isCanvas) continue;
  real++;

  const title = ((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
  const desc = ((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1]
    || (html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) || [])[1]
    || '').trim();

  if (!title) missingTitle.push(rel); else (titles[title] = titles[title] || []).push(rel);
  if (!desc) missingDesc.push(rel); else (descs[desc] = descs[desc] || []).push(rel);
}

const dupTitles = Object.entries(titles).filter(([, v]) => v.length > 1);
const dupDescs = Object.entries(descs).filter(([, v]) => v.length > 1);

console.log(`SEO meta QA: ${real} indexable pages scanned`);
ok('every indexable page has a <title>', missingTitle.length === 0, missingTitle.slice(0, 5).join(', ') || 'all present');
ok('every indexable page has a meta description', missingDesc.length === 0, missingDesc.slice(0, 5).join(', ') || 'all present');
ok('page titles are unique', dupTitles.length === 0, dupTitles.slice(0, 3).map(([k, v]) => `"${k.slice(0, 40)}" (${v.join(', ')})`).join(' | ') || 'all unique');
ok('meta descriptions are unique', dupDescs.length === 0, dupDescs.slice(0, 3).map(([k, v]) => `"${k.slice(0, 40)}" (${v.join(', ')})`).join(' | ') || 'all unique');

console.log(failures === 0 ? 'ALL SEO META CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
