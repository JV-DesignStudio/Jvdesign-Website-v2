/* Navigation consolidation guard (A791/A792/A1437).
   - Downloads has one canonical page; the /freebies clean route maps to it.
   - Progress/leaderboards have one owner (/me.html); the old routes map to it.
   - No public page links straight at a removed route stub.
   Keeps the routes from drifting back into duplicates.

   A1437 removed the stub files (pages/freebies.html, pages/my-progress.html,
   pages/leaderboards.html); these routes are now served by the 404 clean-URL map. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
let failures = 0;
const check = (n, ok, d = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' , ' + d : '')); if (!ok) failures++; };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const nav = read('partials/nav-content.html');
const footer = read('partials/footer-content.html');

// Parse the clean-URL map in 404.html: '/route': '/target.html'
const notFound = read('404.html');
const route = r => { const m = notFound.match(new RegExp("'" + r.replace(/[/-]/g, '\\$&') + "'\\s*:\\s*'([^']+)'")); return m ? m[1] : ''; };

check('/freebies clean route maps to the canonical downloads page', route('/freebies') === '/pages/downloads.html', route('/freebies'));
check('/downloads clean route maps to the canonical downloads page', route('/downloads') === '/pages/downloads.html', route('/downloads'));
check('pages/downloads.html is the canonical downloads page (indexable)', fs.existsSync(path.join(root, 'pages/downloads.html')) && !/noindex/.test((read('pages/downloads.html').match(/name="robots"[^>]*/) || [''])[0]));
check('/my-progress clean route maps to the progress owner /me.html', route('/my-progress') === '/me.html', route('/my-progress'));
check('/leaderboards clean route maps to the progress owner /me.html', route('/leaderboards') === '/me.html', route('/leaderboards'));
check('/me.html exists as the profile/progress owner', fs.existsSync(path.join(root, 'me.html')));

// A1760: one canonical destination per door. The 404 clean-URL map and
// _redirects must agree, and old paths stay as aliases.
check('/games clean route points at the arcade, not the catalogue', route('/games') === '/arcade.html', route('/games'));
check('/arcade clean route points at the arcade page', route('/arcade') === '/arcade.html', route('/arcade'));
check('/games.html legacy path points at the arcade page', route('/games.html') === '/arcade.html', route('/games.html'));
check('/pages/games.html legacy path points at the arcade page', route('/pages/games.html') === '/arcade.html', route('/pages/games.html'));
check('/learn-hub clean route points at the Learn hub', route('/learn-hub') === '/pages/workshop.html', route('/learn-hub'));
check('/workshop clean route points at the Learn hub', route('/workshop') === '/pages/workshop.html', route('/workshop'));
check('/dev-tools clean route points at the Create hub', route('/dev-tools') === '/pages/dev-tools.html', route('/dev-tools'));
check('/books clean route points at the Read hub', route('/books') === '/pages/books.html', route('/books'));
check('/pages/freebies.html legacy path points at Downloads', route('/pages/freebies.html') === '/pages/downloads.html', route('/pages/freebies.html'));

const redirects = read('_redirects');
const redirect = from => {
  const key = from.replace(/[/.]/g, '\\$&');
  const m = redirects.match(new RegExp('^' + key + '\\s+(\\S+)\\s+301$', 'm'));
  return m ? m[1] : '';
};
check('_redirects sends /games to the arcade', redirect('/games') === '/arcade.html', redirect('/games'));
check('_redirects sends /freebies to Downloads', redirect('/freebies') === '/downloads', redirect('/freebies'));
check('_redirects sends /learn-hub to the Learn hub', redirect('/learn-hub') === '/workshop', redirect('/learn-hub'));

const arcade = read('arcade.html');
check('arcade page canonical is /arcade.html', /<link rel="canonical" href="https:\/\/jvdesignstudio\.co\.uk\/arcade\.html"/.test(arcade));

const hasDoor = (html, href, label) => new RegExp('href="' + href + '"[^>]*>\\s*' + label + '(\\s|<)').test(html);
check('nav Learn label points at /workshop', hasDoor(nav, '/workshop', 'Learn'));
check('nav Create label points at /dev-tools', hasDoor(nav, '/dev-tools', 'Create'));
check('nav Play label points at /arcade.html', hasDoor(nav, '/arcade.html', 'Play'));
check('nav Read label points at /books', hasDoor(nav, '/books', 'Read'));
check('footer Learn label points at /workshop', hasDoor(footer, '/workshop', 'Learn'));
check('footer Create label points at /dev-tools', hasDoor(footer, '/dev-tools', 'Create'));
check('footer Play label points at /arcade.html', hasDoor(footer, '/arcade.html', 'Play'));
check('footer Read label points at /books', hasDoor(footer, '/books', 'Read'));
check('nav has no Games or Arcade door label', !/href="[^"]*"[^>]*>\s*(Games|Arcade)\s*</.test(nav));
check('footer has no Workshops, Tools or Freebies door label', !/href="[^"]*"[^>]*>\s*(Workshops|Tools|Freebies)\s*</.test(footer));

// A1755: My Studio must be reachable from the global nav and footer on every
// page type, not only from the parent guide and discovery session.
check('global nav links to My Studio', /id="navProfileChip"/.test(nav) && /href="\/me\.html"/.test(nav));
check('global footer links to My Studio', /href="\/me\.html"/.test(footer));
const samplePages = ['index.html', 'arcade.html', 'me.html', 'games/gem_match.html', 'tools/pixel-studio.html', 'workshops/my-first-scratch-game.html'];
for (const rel of samplePages) {
  if (!fs.existsSync(path.join(root, rel))) { check(rel + ' exists for My Studio check', false); continue; }
  const h = read(rel);
  check(rel + ' has the My Studio nav link', /id="navProfileChip"/.test(h));
  check(rel + ' has the My Studio footer link', /href="\/me\.html"/.test(h));
}
// Immersive games (A1634) skip the site chrome, so their route is the shared
// arcade menu. Build-alongs get a persistent link on the completion panel.
check('shared game menu links to My Studio', /href="\.\.\/me\.html"/.test(read('game-system.js')));
check('immersive highway-dodge loads the shared game menu', /game-system\.js/.test(read('games/highway-dodge.html')));
check('completed build-alongs link to My Studio', /href="\/me\.html"/.test(read('workshop-canvas-engine.js')));

// no public page links straight at a removed route stub file
const stubs = ['pages/freebies.html', 'pages/my-progress.html', 'pages/leaderboards.html'];
const dirs = ['', 'pages', 'games', 'tools', 'workshops', 'books', 'learn'];
let direct = [];
for (const dir of dirs) {
  const d = dir ? path.join(root, dir) : root;
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.html'))) {
    const rel = (dir ? dir + '/' : '') + f;
    if (stubs.includes(rel)) continue;
    const h = read(rel);
    for (const s of stubs) if (h.includes('href="' + s) || h.includes('href="/' + s) || h.includes("'" + s)) direct.push(rel + '->' + s);
  }
}
check('no page links straight at a removed route stub', direct.length === 0, direct.slice(0, 5).join(', '));

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
