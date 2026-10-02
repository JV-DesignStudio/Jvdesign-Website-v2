#!/usr/bin/env node
/*
 * tests/arcade-contract.js , A584
 *
 * One contract for every arcade card: a story hook, the guide character, the
 * objective, the finish state, and a session label that never promises more
 * than the game can deliver. The audit found 31 of 40 games labelled 5-10 min
 * or longer with no objective anywhere, and Candy Kingdom promising 15-30 min.
 *
 * Static pass: every games-registry.js entry carries the full contract, the
 * labels are honest, the files exist, and arcade.html renders the objective.
 * Browser pass: cards and the detail sheet really show it at 390px and 1440px,
 * with no sideways scrolling.
 *
 * Run: node tests/arcade-contract.js   (skip browser with SKIP_BROWSER=1)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GAME_DIR = path.join(ROOT, 'games');
const REGISTRY = path.join(ROOT, 'games-registry.js');
const ARCADE = path.join(ROOT, 'arcade.html');

const CHARACTERS = ['Lumo', 'Ember', 'Echo', 'Pip', 'Stardust'];
// honest upper bounds only. Candy Kingdom was 15-30 min; a measured 5-scene
// run is 10 clicks and under 2 seconds of machine time, so 5-10 min is real.
const BUCKETS = ['Under 5 min', '3-5 min', '5-10 min'];
const CONTRACT_FIELDS = ['storyHook', 'character', 'objective', 'finishLine', 'arcadeSession'];

const failures = [];
let passes = 0;
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log('  [PASS] ' + name); }
  else { failures.push(name + (detail ? ' - ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' - ' + detail : '')); }
};
const sentence = s => typeof s === 'string' && s.length > 20 && s.length < 200 && /[.!]$/.test(s.trim());

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(REGISTRY, 'utf8'), ctx);
const games = ctx.window.JVDS_GAMES;
const ARCADE_CARD_COUNT = games.length;
const arcade = fs.readFileSync(ARCADE, 'utf8');

console.log('Arcade contract: ' + games.length + ' registered games\n');

/* ── 1. every entry carries the contract ──────────────────────── */

ok('registry has all games', games.length === ARCADE_CARD_COUNT, 'found ' + games.length);
ok('game ids are unique', new Set(games.map(g => g.id)).size === games.length);

for (const g of games) {
  const missing = CONTRACT_FIELDS.filter(k => !g[k]);
  ok(g.id + ': full card contract', missing.length === 0, 'missing ' + missing.join(', '));
  ok(g.id + ': story hook is one sentence', sentence(g.storyHook), JSON.stringify(g.storyHook));
  ok(g.id + ': objective is one short instruction', sentence(g.objective) && g.objective.length <= 96,
     g.objective ? g.objective.length + ' chars' : 'missing');
  ok(g.id + ': finish state is one sentence', sentence(g.finishLine), JSON.stringify(g.finishLine));
  ok(g.id + ': guide is a known character', CHARACTERS.includes(g.character), g.character);
  ok(g.id + ': page exists', fs.existsSync(path.join(GAME_DIR, g.file)), g.file);
}

/* ── 2. honest session labels ─────────────────────────────────── */

for (const g of games) {
  ok(g.id + ': session label is one of the three buckets', BUCKETS.includes(g.session), g.session);
  ok(g.id + ': arcade label matches its session label', g.session === g.arcadeSession,
     g.session + ' vs ' + g.arcadeSession);
}
ok('no game promises more than 10 minutes', !/1[5-9]-\d|\b[2-9]\d\s*min/.test(JSON.stringify(games.map(g => g.session))));
ok('Candy Kingdom is no longer a 15-30 min session', games.find(g => g.id === 'candy-kingdom').session !== '15-30 min',
   games.find(g => g.id === 'candy-kingdom').session);
ok('at least one game sits in each bucket',
   BUCKETS.every(b => games.some(g => g.session === b)),
   JSON.stringify(games.reduce((a, g) => { a[g.session] = (a[g.session] || 0) + 1; return a; }, {})));

// the two games already reworked under A588/A589 keep their 3-5 min promise
for (const id of ['pixel-pet-arena', 'marble-run-lab']) {
  const g = games.find(x => x.id === id);
  ok(id + ': reworked game still promises 3-5 min', g.session === '3-5 min', g.session);
}

/* ── 3. the hub actually shows it ──────────────────────────────── */

ok('arcade.html has an objective accessor', /function arcadeObjective\(g\)/.test(arcade));
ok('card markup renders the objective', /<div class="objective">' \+ esc\(arcadeObjective\(g\)\)/.test(arcade));
ok('detail sheet has a Goal row', /dRow\('Goal', esc\(arcadeObjective\(g\)\)\)/.test(arcade));
ok('detail sheet still shows story and finish', /<b>Story:<\/b>/.test(arcade) && /<b>Finish:<\/b>/.test(arcade));
ok('search text includes the new fields', /g\.character, g\.storyHook, g\.objective, g\.finishLine/.test(arcade));
ok('session label falls back to the factual field', /g\.arcadeSession \|\| g\.session/.test(arcade));
ok('arcade.css styles the objective line', /\.card \.objective\{/.test(fs.readFileSync(path.join(ROOT, 'style-arcade.css'), 'utf8')));

console.log('\nArcade contract: ' + passes + ' static checks passed, ' + failures.length + ' failed');

/* ── 4. layout at 390px and 1440px ────────────────────────────── */

if (process.env.SKIP_BROWSER === '1') {
  console.log('  [SKIP] layout checks (SKIP_BROWSER=1)');
  finish();
} else {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { console.log('  [SKIP] puppeteer not installed'); finish(); }

  if (puppeteer) {
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
      let file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });

    (async () => {
      await new Promise(r => server.listen(8138, r));
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      try {
        for (const vp of [{ name: 'phone 390px', width: 390, height: 844 }, { name: 'desktop 1440px', width: 1440, height: 900 }]) {
          const page = await browser.newPage();
          const errors = [];
          page.on('pageerror', e => errors.push(e.message));
          await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
          await page.goto('http://127.0.0.1:8138/arcade.html', { waitUntil: 'load', timeout: 30000 });
          // the hub opens on Home; the card grid is the Play tab. Clicked in
          // page because the tab strip is a fixed bar that puppeteer's
          // coordinate click can miss.
          await page.evaluate(() => document.querySelector('button[data-tab="play"]').click());
          await page.waitForSelector('.card', { timeout: 15000 });

          const m = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('.card')];
            const text = el => (el.textContent || '').trim();
            return {
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
              cards: cards.length,
              withHook: cards.filter(c => text(c.querySelector('.finish'))).length,
              withObjective: cards.filter(c => text(c.querySelector('.objective'))).length,
              withSession: cards.filter(c => text(c.querySelector('.mini-badge.session'))).length,
              withGuide: cards.filter(c => text(c.querySelector('.mini-badge.guide'))).length,
              objectivesOverflow: cards.some(c => c.querySelector('.objective').scrollWidth > c.querySelector('.objective').clientWidth + 1)
            };
          });
          ok(vp.name + ': no sideways scrolling', m.scrollWidth <= m.innerWidth + 1, m.scrollWidth + ' > ' + m.innerWidth);
          ok(vp.name + ': all cards render', m.cards === ARCADE_CARD_COUNT, m.cards + ' cards');
          ok(vp.name + ': every card shows a finish state', m.withHook === m.cards, m.withHook + '/' + m.cards);
          ok(vp.name + ': every card shows an objective', m.withObjective === m.cards, m.withObjective + '/' + m.cards);
          ok(vp.name + ': every card shows a session label', m.withSession === m.cards, m.withSession + '/' + m.cards);
          ok(vp.name + ': every card names its guide', m.withGuide === m.cards, m.withGuide + '/' + m.cards);
          ok(vp.name + ': objective lines do not overflow', !m.objectivesOverflow);

          // open one detail sheet and confirm the Goal row is really there
          await page.evaluate(() => document.querySelector('.card .info-chip[data-info="candy-kingdom"]').click());
          await page.waitForFunction(() => !document.getElementById('detailSheet').hidden, { timeout: 10000 });
          const d = await page.evaluate(() => {
            const body = document.getElementById('detailBody');
            const rows = [...body.querySelectorAll('.d-row')].map(r => r.textContent.trim());
            return { goal: rows.find(r => r.startsWith('Goal')) || '', story: !!body.querySelector('.d-desc') };
          });
          ok(vp.name + ': detail sheet shows the Candy Kingdom goal', d.goal.length > 20, d.goal);
          ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
          await page.close();
        }
      } finally {
        await browser.close();
        server.close();
      }
      finish();
    })().catch(e => { console.log('  [FAIL] layout harness error: ' + e.message); failures.push('layout harness'); finish(); });
  }
}

function finish() {
  console.log(failures.length ? '\nARCADE CONTRACT FAILURES (' + failures.length + '):\n  ' + failures.slice(0, 12).join('\n  ') : '\nALL ARCADE CONTRACT CHECKS PASSED');
  process.exit(failures.length ? 1 : 0);
}
