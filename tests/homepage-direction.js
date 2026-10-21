// homepage-direction.js (A1799): verify the homepage has one primary CTA and one
// beginner route, with no competing first action before the hub section.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
};

// 1. First btn-primary must be in the hero section (above first-make)
// A secondary btn-primary lower on the page (e.g. start-here) is allowed but must not precede the beginner route.
const heroEnd = html.indexOf('</section>', html.indexOf('class="home-hero"'));
const firstPrimaryIdx = html.indexOf('class="btn-primary"');
check(
  'first .btn-primary CTA is inside the hero section',
  firstPrimaryIdx !== -1 && firstPrimaryIdx < heroEnd,
  `first btn-primary at ${firstPrimaryIdx}, hero ends at ${heroEnd}`
);

// 2. The primary CTA points to Pixel Studio first-mission (the beginner route)
check(
  'primary CTA targets Pixel Studio first-mission',
  html.includes('href="/tools/pixel-studio.html#first-mission"')
);

// 3. The first-make section (beginner route) exists
check('first-make section exists', html.includes('id="first-make"'));

// 4. The creative-journey section must not exist (it was removed as a competing route)
check(
  'creative-journey section removed',
  !html.includes('class="creative-journey"')
);

// 5. Today's spark must appear AFTER the hub section (not before it as a competing first action)
const sparkIdx = html.indexOf('class="jvds-today-spark"');
const hubIdx = html.indexOf('class="hub-section"');
check(
  'today-spark section comes after hub-section',
  sparkIdx !== -1 && hubIdx !== -1 && sparkIdx > hubIdx,
  `spark at ${sparkIdx}, hub at ${hubIdx}`
);

// 6. No "promoted" modifier on today's spark (it was the old first-position class)
check(
  'today-spark no longer has --promoted modifier',
  !html.includes('jvds-today-spark--promoted')
);

// 7. First Make section precedes the hub section
const firstMakeIdx = html.indexOf('id="first-make"');
check(
  'first-make section comes before hub-section',
  firstMakeIdx !== -1 && hubIdx !== -1 && firstMakeIdx < hubIdx,
  `first-make at ${firstMakeIdx}, hub at ${hubIdx}`
);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL HOMEPAGE-DIRECTION CHECKS PASSED');
process.exit(failures ? 1 : 0);
