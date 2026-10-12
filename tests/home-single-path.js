/* Homepage single-intro-path guard (A1416).
   The homepage should present one hero, one set of four paths (the Explore-the-Studio
   hub cards), and one beginner-guide teaser that links to the full /learn/ hub. It
   should not restate the same invitation in a second route list. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let failures = 0;
const check = (n, ok, d = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' , ' + d : '')); if (!ok) failures++; };

check('one hero present', /<section class="home-hero"/.test(html));
check('no duplicate "What can I do here?" route list', !/What can I do here\?/.test(html));

const hubCards = (html.match(/class="hub-card /g) || []).length;
check('exactly one four-path set (hub cards)', hubCards === 4, 'hub cards=' + hubCards);

const hubHrefs = [...html.matchAll(/class="hub-card[^"]*"\s+href="([^"]+)"/g)].map(m => m[1]).sort().join(',');
check('the four paths are Learn/Play/Create/Read', hubHrefs === ['/books', '/dev-tools', '/games', '/workshop'].sort().join(','), hubHrefs);

check('guide teaser links to the full /learn/ hub', /href="\/learn\/"/.test(html));
const guideCards = (html.match(/aria-labelledby="guides-title"[\s\S]*?<\/section>/)[0].match(/class="path-card /g) || []).length;
check('guide teaser shows a small curated set', guideCards > 0 && guideCards <= 6, 'guide cards=' + guideCards);

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
