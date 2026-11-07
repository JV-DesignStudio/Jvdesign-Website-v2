/* Homepage single-intro-path guard (A1416, revised A2798).
   The homepage presents one hero, one four-path hub, one four-intent starter
   and one guided first-make section. It should not restate the invitation in a
   second competing route list. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let failures = 0;
const check = (n, ok, d = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' - ' + d : '')); if (!ok) failures++; };

check('one hero present', /<section class="home-hero"/.test(html));
check('no duplicate "What can I do here?" route list', !/What can I do here\?/.test(html));

const hubCards = (html.match(/class="hub-card /g) || []).length;
check('exactly one four-path hub', hubCards === 4, 'hub cards=' + hubCards);
const hubHrefs = [...html.matchAll(/class="hub-card[^"]*"\s+href="([^"]+)"/g)].map(m => m[1]).sort().join(',');
check('the four hub paths are Learn/Play/Create/Read', hubHrefs === ['/arcade.html', '/books', '/create', '/workshop'].sort().join(','), hubHrefs);

const entryCards = (html.match(/class="home-entry-card"/g) || []).length;
check('four Start Here intent cards', entryCards === 4, 'intent cards=' + entryCards);
check('guided first-make section present', /id="first-make"/.test(html));

const firstMake = html.indexOf('id="first-make"');
const hub = html.indexOf('class="hub-section"');
check('first-make comes before the hub', firstMake !== -1 && hub !== -1 && firstMake < hub);
check('retired creative-journey strip has not returned', !html.includes('class="creative-journey"'));
check('retired guide teaser has not returned', !html.includes('aria-labelledby="guides-title"'));

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
