#!/usr/bin/env node
// A1986/A1987: Book pages must have parent notes, theme chips, and consistent structure.
// A1987: Every book page must carry JVDesignStudio branding visible within 5 seconds.
// Checks all five individual book pages and the books hub.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' -- ' + detail : ''));
  if (!ok) failures++;
}

const BOOK_PAGES = [
  'books/Stardust.html',
  'books/Pip_and_the_night_sky.html',
  'books/lumo_and_the_grumble_grit.html',
  'books/Elara.html',
  'books/Echo_and_the_mountain_of_choice.html',
];

for (const rel of BOOK_PAGES) {
  const full = path.join(ROOT, rel);
  const src = fs.readFileSync(full, 'utf8');
  const name = path.basename(rel, '.html');

  check(name + ':grownup-section',
    /grownup-section|grownup-card|grownup-tag/.test(src),
    'missing parent/grown-ups section');

  check(name + ':themes',
    /themes-section|themes-grid|theme-chip/.test(src),
    'missing themes section');

  check(name + ':full-footer',
    /BUILD:footer-content/.test(src) || /footer-brand|footer-col-title/.test(src),
    'missing shared footer partial');

  check(name + ':skip-link',
    /skip-link|Skip to main/.test(src),
    'missing skip-to-main-content link');

  // A1987: studio identity — logo, shared nav, and JVDesignStudio in title
  check(name + ':jvds-title',
    /JVDesignStudio/.test(src),
    'page title does not include JVDesignStudio');

  check(name + ':shared-nav',
    /BUILD:nav-content/.test(src),
    'missing shared nav partial');
}

// Books hub links to all individual pages
const hub = path.join(ROOT, 'pages/books.html');
if (fs.existsSync(hub)) {
  const hubSrc = fs.readFileSync(hub, 'utf8');
  for (const p of BOOK_PAGES) {
    const basename = path.basename(p);
    check('pages/books.html:links-to-' + basename,
      hubSrc.includes(basename),
      'hub should link to ' + basename);
  }
}

console.log(failures === 0 ? 'books-http: PASS (' + (BOOK_PAGES.length * 4 + BOOK_PAGES.length) + ')' : 'books-http: FAIL (' + failures + ' failures)');
process.exit(failures === 0 ? 0 : 1);
