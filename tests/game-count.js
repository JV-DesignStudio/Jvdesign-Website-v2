/* Game-count single source of truth.
   The public "N games" total must come from games-registry.js (the live arcade
   line-up). Prototypes/noindex games on disk are NOT counted. This guard keeps
   the registry, the true public game set, the homepage stat and the marketing
   stat lines from drifting apart. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
let failures = 0;
const check = (n, ok, d = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' , ' + d : '')); if (!ok) failures++; };

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'games-registry.js'), 'utf8'), ctx);
const registry = (ctx.window.JVDS_GAMES || []).length;
check('games-registry.js loads and lists games', registry > 0, 'registry=' + registry);

const gdir = path.join(root, 'games');
const indexable = fs.readdirSync(gdir).filter(f => f.endsWith('.html'))
  .filter(f => !/name="robots"[^>]*noindex/i.test(fs.readFileSync(path.join(gdir, f), 'utf8')));
check('registry count equals indexable games on disk', registry === indexable.length, 'registry=' + registry + ' disk=' + indexable.length);

const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = idx.match(/id="heroGameCount"[^>]*>(\d+)/);
check('homepage hero game stat derives from the registry id', !!m && +m[1] === registry, m ? ('fallback ' + m[1]) : 'missing id');
check('homepage loads games-registry.js', /games-registry\.js/.test(idx));

const statFiles = ['pages/press.html', 'pages/parent-guide.html', 'tools/parent-guide.html', 'pages/discovery_session.html', 'pages/about.html'];
const re = /(\d+)\s+(?:free\s+|listed\s+|playable\s+|browser\s+)*games/gi;
for (const rel of statFiles) {
  const h = fs.readFileSync(path.join(root, rel), 'utf8');
  let mm; const nums = [];
  while ((mm = re.exec(h))) nums.push(+mm[1]);
  const bad = nums.filter(n => n !== registry);
  check(rel + ' game totals match the registry', bad.length === 0, bad.length ? ('found ' + [...new Set(bad)].join('/')) : ('numbers ' + ([...new Set(nums)].join('/') || 'none')));
}

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
