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

// Parse the clean-URL map in 404.html: '/route': '/target.html'
const notFound = read('404.html');
const route = r => { const m = notFound.match(new RegExp("'" + r.replace(/[/-]/g, '\\$&') + "'\\s*:\\s*'([^']+)'")); return m ? m[1] : ''; };

check('/freebies clean route maps to the canonical downloads page', route('/freebies') === '/pages/downloads.html', route('/freebies'));
check('/downloads clean route maps to the canonical downloads page', route('/downloads') === '/pages/downloads.html', route('/downloads'));
check('pages/downloads.html is the canonical downloads page (indexable)', fs.existsSync(path.join(root, 'pages/downloads.html')) && !/noindex/.test((read('pages/downloads.html').match(/name="robots"[^>]*/) || [''])[0]));
check('/my-progress clean route maps to the progress owner /me.html', route('/my-progress') === '/me.html', route('/my-progress'));
check('/leaderboards clean route maps to the progress owner /me.html', route('/leaderboards') === '/me.html', route('/leaderboards'));
check('/me.html exists as the profile/progress owner', fs.existsSync(path.join(root, 'me.html')));

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
