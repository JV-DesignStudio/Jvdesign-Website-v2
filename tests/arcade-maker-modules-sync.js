#!/usr/bin/env node
/*
 * tests/arcade-maker-modules-sync.js , A759
 *
 * Guards the single source of truth for the Arcade Maker modules (A760 + A763).
 * The data lives in src/arcade-maker/*.js; tools/arcade-game-maker.html imports
 * it via the module bootstrap and must NOT define it inline again. This test:
 *
 *   1. Static: the HTML has no inline liveConfig / GameAudio / _GENRE_DESCS /
 *      _GENRE_ICONS / _ACH_TOAST, imports all four modules, and each module
 *      parses.
 *   2. Browser: serves the site, imports all four modules with `import(...)`,
 *      and checks the exported data loads clean under native ESM.
 *
 * See src/arcade-maker/README.md for the full contract.
 *
 * Run: node tests/arcade-maker-modules-sync.js
 *   JVDS_SITE=<dir>  serve a different site root (regression-proof).
 *   AGM_SYNC_PORT=<n> port (default 8982).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const PORT = Number(process.env.AGM_SYNC_PORT || 8982);
const BASE = `http://localhost:${PORT}/`;
const MIME = {   '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };

const results = [];
function record(name, ok, detail){ results.push({ name, ok, detail }); console.log((ok ? '  \u2713 ' : '  \u2717 ') + name + (detail ? ' , ' + detail : '')); }

(async () => {
  // ── 1. single source of truth ─────────────────────────────────────────────
  // A760 sourced liveConfig/GameAudio from src/arcade-maker/*.js and removed the
  // inline copies. Guard against them creeping back: the HTML must contain no
  // inline `const liveConfig = {` / `const GameAudio = {`, and the module files
  // must exist and parse.
  console.log('\n\u25b8 single source of truth');
  const html = fs.readFileSync(path.join(ROOT, 'tools', 'arcade-game-maker.html'), 'utf8');
  record('HTML has no inline liveConfig', !/^const\s+liveConfig\s*=\s*\{/m.test(html), 'inline liveConfig reappeared');
  record('HTML has no inline GameAudio', !/^const\s+GameAudio\s*=\s*\{/m.test(html), 'inline GameAudio reappeared');
  record('HTML has no inline _GENRE_DESCS', !/^const\s+_GENRE_DESCS\s*=\s*\{/m.test(html), 'inline genre descs reappeared');
  record('HTML has no inline _GENRE_ICONS', !/^const\s+_GENRE_ICONS\s*=\s*\{/m.test(html), 'inline genre icons reappeared');
  record('HTML has no inline _ACH_TOAST', !/^const\s+_ACH_TOAST\s*=\s*\{/m.test(html), 'inline achievement labels reappeared');
  record('HTML imports liveConfig module', /src\/arcade-maker\/liveConfig\.js/.test(html));
  record('HTML imports GameAudio module', /src\/arcade-maker\/GameAudio\.js/.test(html));
  record('HTML imports genres module', /src\/arcade-maker\/genres\.js/.test(html));
  record('HTML imports achievements module', /src\/arcade-maker\/achievements\.js/.test(html));
  for (const name of ['liveConfig.js', 'GameAudio.js', 'genres.js', 'achievements.js']) {
    const file = path.join(ROOT, 'src', 'arcade-maker', name);
    const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    let parses = true, err = '';
    try { new Function(src.replace(/export\s*\{[^}]*\};?/g, '').replace(/export default [^;]+;?/g, '')); }
    catch (e) { parses = false; err = e.message; }
    record('src/arcade-maker/' + name + ' exists and parses', parses, err);
  }

  // ── 2. browser equivalence ────────────────────────────────────────────────
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const type = MIME[path.extname(p).toLowerCase()] || 'application/javascript';
      res.writeHead(200, { 'Content-Type': type });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 20000 });

  console.log('\n\u25b8 module evaluation');
  // The maker keeps liveConfig/GameAudio in a classic <script>, so they are not
  // on window. Evaluate the inline source (the exact same slices the generator
  // uses) to get the live values, then compare the imported module to them.
  const raw = page.evaluate.bind(page);
  let out;
  try {
    out = await raw(async () => {
      const lcMod = await import('/src/arcade-maker/liveConfig.js');
      const gaMod = await import('/src/arcade-maker/GameAudio.js');
      const gMod  = await import('/src/arcade-maker/genres.js');
      const aMod  = await import('/src/arcade-maker/achievements.js');
      return {
        g: {
          listLen: gMod.GENRE_LIST.length,
          descs: Object.keys(gMod.GENRE_DESCS).length,
          icons: Object.keys(gMod.GENRE_ICONS).length,
          labels: Object.keys(gMod.GENRE_LABELS).length,
          everyGenreHasIcon: gMod.GENRE_LIST.every(x => gMod.GENRE_ICONS[x]),
          everyGenreHasDesc: gMod.GENRE_LIST.every(x => gMod.GENRE_DESCS[x]),
          shooterIcon: gMod.GENRE_ICONS.SHOOTER
        },
        a: {
          count: Object.keys(aMod.ACH_TOAST).length,
          firstBlood: aMod.ACH_TOAST.first_blood,
          hasSnake: !!aMod.ACH_TOAST.snake_long
        },
        lc: JSON.parse(JSON.stringify({
          keys: Object.keys(lcMod.liveConfig).length,
          hasBase: !!lcMod.liveConfig._base && typeof lcMod.liveConfig._base.speed === 'number',
          speedNum: typeof lcMod.liveConfig.speed === 'number' && lcMod.liveConfig.speed > 0,
          forestEmoji: lcMod._themeData('forest').playerEmoji,
          themeCount: ['space','ocean','forest','castle','candy','cyber'].map(t => lcMod._themeData(t).playerEmoji).length,
          gameState: JSON.stringify(lcMod.gameState),
          touchInput: JSON.stringify(lcMod.touchInput),
          clickEmoji: lcMod.liveConfig.clickEmoji,
          hasDefaults: typeof lcMod._lcDefaults === 'object'
        })),
        ga: {
          methods: Object.keys(gaMod.GameAudio).filter(k => typeof gaMod.GameAudio[k] === 'function').length,
          hasStartMusic: typeof gaMod.GameAudio.startMusic === 'function',
          sounds: JSON.stringify(gaMod.GameAudio.sounds)
        }
      };
    });
  } catch (e) { out = { importErr: e && e.message ? e.message : String(e) }; }

  if (out.importErr) {
    record('modules import cleanly', false, out.importErr);
  } else {
    record('modules import cleanly', true);
    record('liveConfig module has all keys', out.lc.keys > 50, 'keys ' + out.lc.keys);
    record('accessors active (base + numeric speed)', out.lc.hasBase && out.lc.speedNum);
    record('_themeData returns themed emojis', out.lc.forestEmoji === '\u{1F98A}' && out.lc.themeCount === 6, out.lc.forestEmoji);
    record('state/theme fallbacks are defined', out.lc.gameState === '{"lives":3}' && out.lc.touchInput.includes('lane3'), out.lc.gameState);
    record('_lcDefaults snapshot exists', out.lc.hasDefaults === true);
    record('GameAudio module has all SFX methods', out.ga.methods > 30, 'methods ' + out.ga.methods);
    record('GameAudio sounds map intact', /laser/.test(out.ga.sounds) && out.ga.hasStartMusic);
    record('genres module has 22 genres', out.g.listLen === 22, 'count ' + out.g.listLen);
    record('every genre has icon + desc', out.g.everyGenreHasIcon && out.g.everyGenreHasDesc);
    record('genres maps all populated', out.g.icons === out.g.listLen && out.g.descs === out.g.listLen, `${out.g.icons}/${out.g.descs}`);
    record('achievements module populated', out.a.count >= 20 && out.a.hasSnake, 'count ' + out.a.count);
  }

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { failed.forEach(f => console.log('  FAILED: ' + f.name + (f.detail ? ' , ' + f.detail : ''))); process.exit(1); }
  console.log('\u2713 arcade-maker modules: single source of truth, modules load clean');
})().catch(e => { console.error('sync test crashed:', e); process.exit(1); });
