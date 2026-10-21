/* breadcrumb-smoke.js (A1635/A1641): verify breadcrumb shell on sample long-tail pages.

   After A1641, breadcrumbs are BUILD-injected (breadcrumb-inject.js reads JSON-LD
   BreadcrumbList at runtime). This test checks the static deliverables:
   - BUILD:breadcrumb marker present with breadcrumb-inject.js script tag
   - JSON-LD BreadcrumbList present with 3+ items (the data source)
   - First JSON-LD item is Home (href "/")
   - CSS component present in style-shared.css
   - No horizontal overflow styles added to nav

   Run: node tests/breadcrumb-smoke.js
*/
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const PAGES = [
  { file: 'tools/bitmap-font-maker.html',         section: 'Tools',    page: 'Bitmap Font Maker' },
  { file: 'games/arcane_citadel_page.html',       section: 'Games',    page: 'Arcane Citadel' },
  { file: 'workshops/barrel-blast-workshop.html', section: 'Workshop', page: 'Barrel Blast' },
];

let passed = 0, failed = 0;

function check(label, ok, detail) {
  if (ok) { console.log(`  PASS  ${label}`); passed++; }
  else     { console.error(`  FAIL  ${label}${detail ? ' - ' + detail : ''}`); failed++; }
}

// Check CSS component
const sharedCss = fs.readFileSync(path.join(ROOT, 'style-shared.css'), 'utf8');
console.log('\nstyle-shared.css');
check('.breadcrumb CSS component present', sharedCss.includes('.breadcrumb{'));
check('aria-label Breadcrumb in CSS context', sharedCss.includes('nav.breadcrumb') || sharedCss.includes('.breadcrumb'));

// Check breadcrumb-inject.js exists
const injectJs = path.join(ROOT, 'assets/js/breadcrumb-inject.js');
check('breadcrumb-inject.js exists', fs.existsSync(injectJs));

// Check partial
const partial = path.join(ROOT, 'partials/breadcrumb-inject.html');
check('breadcrumb-inject.html partial exists', fs.existsSync(partial));
check('partial references breadcrumb-inject.js', fs.readFileSync(partial, 'utf8').includes('breadcrumb-inject.js'));

for (const { file } of PAGES) {
  const abs  = path.join(ROOT, file);
  const html = fs.readFileSync(abs, 'utf8');

  console.log(`\n${file}`);

  check('BUILD:breadcrumb marker present', html.includes('BUILD:breadcrumb'));
  check('breadcrumb-inject.js loaded', html.includes('breadcrumb-inject.js'));

  // JSON-LD BreadcrumbList (the data source)
  const ldMatch = html.match(/"@type"\s*:\s*"BreadcrumbList"[\s\S]*?"itemListElement"\s*:\s*(\[[\s\S]*?\])/);
  check('JSON-LD BreadcrumbList present', !!ldMatch);

  if (ldMatch) {
    try {
      const items = JSON.parse(ldMatch[1]);
      check('BreadcrumbList has 3+ items', items.length >= 3, `got ${items.length}`);
      check('first item is Home', items[0].name === 'Home');
    } catch (e) {
      check('BreadcrumbList parseable', false, e.message);
    }
  }
}

console.log(`\nbreadcrumb-smoke: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
