/* Navigation consolidation guard (A791/A792/A1437).
   - Downloads has one canonical page; /freebies is a redirect to it.
   - Progress/leaderboards have one owner (/me.html); the old pages redirect.
   - No public page links straight at a redirect stub.
   Keeps the routes from drifting back into duplicates. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
let failures = 0;
const check = (n, ok, d = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' , ' + d : '')); if (!ok) failures++; };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const target = rel => { const m = read(rel).match(/(?:http-equiv="refresh"\s+content="0;url=([^"]+)|window\.location\.replace\('([^']+)')/); return m ? (m[1] || m[2]) : ''; };

check('pages/freebies.html redirects to the canonical downloads page', /pages\/downloads\.html/.test(target('pages/freebies.html')), target('pages/freebies.html'));
check('pages/downloads.html is the canonical downloads page (indexable)', !/noindex/.test((read('pages/downloads.html').match(/name="robots"[^>]*/) || [''])[0]) && fs.existsSync(path.join(root, 'pages/downloads.html')));
check('pages/my-progress.html redirects to the progress owner /me.html', /\/me\.html/.test(target('pages/my-progress.html')), target('pages/my-progress.html'));
check('pages/leaderboards.html redirects to the progress owner /me.html', /\/me\.html/.test(target('pages/leaderboards.html')), target('pages/leaderboards.html'));
check('/me.html exists as the profile/progress owner', fs.existsSync(path.join(root, 'me.html')));

// no public page links straight at a redirect stub
const stubs = ['pages/freebies.html', 'pages/my-progress.html', 'pages/leaderboards.html'];
const dirs = ['', 'pages', 'games', 'tools', 'workshops', 'books', 'learn'];
let direct = [];
for (const dir of dirs) {
  const d = dir ? path.join(root, dir) : root;
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.html'))) {
    const rel = (dir ? dir + '/' : '') + f;
    if (stubs.includes(rel)) continue;
    const h = read(rel);
    for (const s of stubs) if (h.includes('href="' + s) || h.includes('href="/' + s) || h.includes("'" + s)) direct.push(rel + '->' + s);
  }
}
check('no page links straight at a redirect stub', direct.length === 0, direct.slice(0, 5).join(', '));

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
