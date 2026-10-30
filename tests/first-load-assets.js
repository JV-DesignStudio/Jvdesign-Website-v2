#!/usr/bin/env node
/* A2017 first-load guard.

   The performance budget gate (scripts/check-performance.js) measures LCP and
   CLS in a real browser but takes minutes and needs Puppeteer. This file is the
   fast companion that runs in the normal test sweep: it fails if the markup
   that keeps first load cheap is removed by accident.

   Checks:
     1. Every image on the homepage and the workshop hub declares width and
        height, so nothing reflows into a blank space while it downloads.
     2. The workshop hub hero mascot is the small WebP, not the 72 KB PNG, and
        it is preloaded because it is the largest paint on a phone.
     3. Both pages preload the two above-the-fold font files before the big
        fonts.css, so the first paint already has the right typeface.
     4. The performance budget still enforces an LCP target at or below 2.8 s
        for the homepage and the workshop hub.

   Run: node tests/first-load-assets.js
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log('  ' + (ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? '  ' + detail : ''));
  if (!ok) fails++;
};

const PAGES = {
  'Homepage': 'index.html',
  'Workshop hub': 'pages/workshop.html',
};

for (const [label, rel] of Object.entries(PAGES)) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const imgs = [...src.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const unsized = imgs.filter((t) => !(/width="\d+"/.test(t) && /height="\d+"/.test(t)));
  check(label + ' images all declare width and height', unsized.length === 0, unsized.slice(0, 3).join(' | '));

  const preloads = [...src.matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)].map((m) => m[0]);
  const fontPreload = preloads.filter((t) => /as="font"/.test(t) && /\.woff2/.test(t));
  check(label + ' preloads the body and display fonts', fontPreload.length >= 2, fontPreload.length + ' font preload(s)');

  const firstFontPreload = src.indexOf('as="font"');
  const fontsCss = src.indexOf('/assets/fonts/fonts.css');
  check(label + ' starts the fonts before fonts.css', firstFontPreload > -1 && firstFontPreload < fontsCss);
}

const hub = fs.readFileSync(path.join(ROOT, 'pages', 'workshop.html'), 'utf8');
check('workshop hero uses the WebP mascot', /class="ws-welcome-mascot"[^>]*src="\.\.\/games\/chars\/lumo\.webp"/.test(hub));
const mascotPreload = [...hub.matchAll(/<link\b[^>]*>/g)]
  .map((m) => m[0])
  .some((t) => /rel="preload"/.test(t) && /as="image"/.test(t) && /lumo\.webp/.test(t));
check('workshop hero mascot is preloaded as an image', mascotPreload);
check('workshop hero mascot requests high priority', /class="ws-welcome-mascot"[^>]*fetchpriority="high"/.test(hub));

const webp = path.join(ROOT, 'games', 'chars', 'lumo.webp');
const png = path.join(ROOT, 'games', 'chars', 'lumo.png');
check('webp mascot exists', fs.existsSync(webp));
if (fs.existsSync(webp) && fs.existsSync(png)) {
  const w = fs.statSync(webp).size;
  const p = fs.statSync(png).size;
  check('webp mascot is much smaller than the png', w < p / 4, Math.round(w / 1024) + 'KB vs ' + Math.round(p / 1024) + 'KB');
}

const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'performance-budget.json'), 'utf8'));
for (const url of ['/', '/pages/workshop.html']) {
  const lcp = budget.pages[url] && budget.pages[url].lcp;
  check('budget for ' + url + ' enforces LCP at or below 2800ms', lcp != null && lcp <= 2800, String(lcp));
}

console.log(fails ? '\nfirst-load-assets: FAIL (' + fails + ')' : '\nfirst-load-assets: PASS');
process.exit(fails ? 1 : 0);
