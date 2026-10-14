#!/usr/bin/env node
/*
 * tests/arcade-contract.js
 *
 * The arcade line-up contract. games-registry.js is now the CURATED arcade
 * line-up (the good, playable games); every other game file is held back in
 * GAME_ORPHANS until it is reworked. Every live entry must carry a story hook,
 * the guide character, an objective, a finish state and an honest session
 * label, and arcade.html must render them as cabinet cards that open a real
 * game file.
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
const ARCADE_CSS = path.join(ROOT, 'style-arcade.css');

const CHARACTERS = ['Lumo', 'Ember', 'Echo', 'Pip', 'Stardust'];
const BUCKETS = ['Under 5 min', '3-5 min', '5-10 min'];
const CONTRACT_FIELDS = ['storyHook', 'character', 'objective', 'finishLine', 'arcadeSession'];
const MAX_LINEUP = 14;

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
const games = ctx.window.JVDS_GAMES || [];
const arcade = fs.readFileSync(ARCADE, 'utf8');
const arcadeCss = fs.readFileSync(ARCADE_CSS, 'utf8');

console.log('Arcade contract: ' + games.length + ' live games in the line-up\n');

/* ── 1. the line-up is curated and unique ─────────────────────── */
ok('the arcade line-up is curated (1 to ' + MAX_LINEUP + ' games)', games.length >= 1 && games.length <= MAX_LINEUP, games.length + ' games');
ok('game ids are unique', new Set(games.map(g => g.id)).size === games.length);
ok('every line-up entry points at a different file', new Set(games.map(g => g.file)).size === games.length);

/* ── 2. every entry carries the contract ──────────────────────── */
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

/* ── 3. honest session labels ─────────────────────────────────── */
for (const g of games) {
  ok(g.id + ': session label is one of the three buckets', BUCKETS.includes(g.session), g.session);
  ok(g.id + ': arcade label matches its session label', g.session === g.arcadeSession, g.session + ' vs ' + g.arcadeSession);
}
ok('no game promises more than 10 minutes', !/1[5-9]-\d|\b[2-9]\d\s*min/.test(JSON.stringify(games.map(g => g.session))));

/* ── 4. the arcade app actually renders the line-up ───────────── */
ok('arcade reads the registry line-up', /window\.JVDS_GAMES/.test(arcade));
ok('arcade renders cabinet cards', /class="cab"/.test(arcade) && /arc-grid/.test(arcade));
ok('card shows the title', /cab-title/.test(arcade) && /esc\(g\.title\)/.test(arcade));
ok('card shows the session label', /g\.session/.test(arcade));
ok('card names the guide', /Guide:.*g\.character|g\.character.*Guide:/.test(arcade));
ok('card links straight to the game file', /games\/' \+ encodeURI\(g\.file\)/.test(arcade));
ok('arcade.css styles the cabinet grid', /\.arc-grid\{/.test(arcadeCss) && /\.cab\{/.test(arcadeCss));

console.log('\nArcade contract: ' + passes + ' static checks passed, ' + failures.length + ' failed');

/* ── 5. layout at 390px and 1440px ────────────────────────────── */
if (process.env.SKIP_BROWSER === '1') {
  console.log('  [SKIP] layout checks (SKIP_BROWSER=1)');
  finish();
} else {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { console.log('  [SKIP] puppeteer not installed'); finish(); }

  if (puppeteer) {
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.avif': 'image/avif' };
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
      await new Promise(r => server.listen(8140, r));
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      try {
        for (const vp of [{ name: 'phone 390px', width: 390, height: 844 }, { name: 'desktop 1440px', width: 1440, height: 900 }]) {
          const page = await browser.newPage();
          const errors = [];
          page.on('pageerror', e => errors.push(e.message));
          await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
          await page.goto('http://127.0.0.1:8140/arcade.html', { waitUntil: 'load', timeout: 30000 });
          await page.waitForSelector('.cab', { timeout: 15000 });

          const m = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('.cab')];
            return {
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
              cards: cards.length,
              withTitle: cards.filter(c => (c.querySelector('.cab-title') || {}).textContent).length,
              withTag: cards.filter(c => (c.querySelector('.cab-tag') || {}).textContent).length,
              withGuide: cards.filter(c => /Guide:/.test(c.textContent)).length,
              hrefs: cards.map(c => c.getAttribute('href'))
            };
          });
          ok(vp.name + ': no sideways scrolling', m.scrollWidth <= m.innerWidth + 1, m.scrollWidth + ' > ' + m.innerWidth);
          ok(vp.name + ': all line-up cards render', m.cards === games.length, m.cards + ' cards');
          ok(vp.name + ': every card shows a title', m.withTitle === m.cards, m.withTitle + '/' + m.cards);
          ok(vp.name + ': every card shows a tag', m.withTag === m.cards, m.withTag + '/' + m.cards);
          ok(vp.name + ': every card names its guide', m.withGuide === m.cards, m.withGuide + '/' + m.cards);
          ok(vp.name + ': every card links to an existing game file',
             m.hrefs.every(h => fs.existsSync(path.join(ROOT, h))), m.hrefs.join(', '));
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
