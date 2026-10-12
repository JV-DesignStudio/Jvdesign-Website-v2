// heading-qa.js - A788: every indexable (sitemap) page must have exactly one
// <h1>. Mirrors rendered-DOM semantics: <script>, <noscript> and <template>
// contents are not page headings (lesson starter code lives in those).
// Run: node tests/heading-qa.js
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const sm = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath).split('?')[0];
  if (clean === '/') return 'index.html';
  const rel = clean.replace(/^\//, '').replace(/\/$/, '');
  const candidates = [
    rel,
    'pages/' + rel,
    'pages/' + rel + '.html',
    rel + '/index.html',
    rel + '.html',
  ];
  for (const c of candidates) {
    const abs = path.join(SITE, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return c;
  }
  return null;
}

const strip = (html) => html
  .slice(html.indexOf('<body'))
  .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
  .replace(/<noscript[\s>][\s\S]*?<\/noscript>/gi, '')
  .replace(/<template[\s>][\s\S]*?<\/template>/gi, '');

let failures = 0;
let checked = 0;
for (const u of locs) {
  const rel = resolveFile(new URL(u).pathname);
  if (!rel) { console.log('FAIL resolves ' + u + ' :: no file on disk'); failures++; continue; }
  const h1s = [...strip(fs.readFileSync(path.join(SITE, rel), 'utf8')).matchAll(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi)];
  if (h1s.length !== 1) {
    console.log('FAIL exactly one h1: ' + rel + ' has ' + h1s.length);
    failures++;
    continue;
  }
  checked++;
}
console.log('\nchecked ' + checked + '/' + locs.length + ' sitemap URLs');
if (failures) {
  console.log('FAIL heading-qa: ' + failures + ' page(s) off');
  process.exit(1);
}
console.log('PASS heading-qa: exactly one h1 on every indexable page');
