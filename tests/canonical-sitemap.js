// canonical-sitemap.js - A783: every sitemap URL must match the page's
// canonical link, and no /tools/<name>/index.html stub may be submitted.
// Run: node tests/canonical-sitemap.js
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const sm = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

function resolveFile(urlPath) {
  if (urlPath === '/') return 'index.html';
  const direct = urlPath.replace(/^\//, '');
  const abs = path.join(SITE, direct);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return direct;
  for (const cand of ['pages' + (urlPath.endsWith('.html') ? urlPath : urlPath + '.html')]) {
    if (fs.existsSync(path.join(SITE, cand))) return cand;
  }
  return null;
}

ok('sitemap has no /tools/<name>/index.html stubs',
  !locs.some((u) => /\/tools\/[^/]+\/index\.html$/.test(u)),
  locs.filter((u) => /\/tools\/[^/]+\/index\.html$/.test(u)).join(','));

let checked = 0;
for (const u of locs) {
  const rel = resolveFile(new URL(u).pathname);
  if (!rel) { ok('resolves ' + u, false, 'no file on disk'); continue; }
  const html = fs.readFileSync(path.join(SITE, rel), 'utf8');
  const m = html.match(/<link rel="canonical" href="([^"]+)"/);
  ok('canonical == sitemap for ' + rel, !!m && m[1] === u, 'canonical=' + (m && m[1]));
  checked++;
}
console.log('\nchecked ' + checked + '/' + locs.length + ' sitemap URLs');
if (failures) {
  console.log('FAIL canonical-sitemap: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('PASS canonical-sitemap: all green');
