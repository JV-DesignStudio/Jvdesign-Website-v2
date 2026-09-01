#!/usr/bin/env node
/*
 * tests/arcade-audit.js — launch-readiness audit for tools/arcade-game-maker.html
 *
 * Drives the REAL app in headless Chrome:
 *   1. Studio boots clean (fresh visitor path: template auto-load → Run)
 *   2. Built-in 21-genre self-test (?selftest=1) passes end-to-end
 *   3. Share payload compress→decompress round-trip (CompressionStream format)
 *   4. Result-code make→parse round-trip (JV1.… friend scores)
 *   5. A zlib-generated ?game= link boots in player mode with config applied
 *   6. Landing page loads clean
 *
 * Exit 1 if any scenario fails. Run: node tests/arcade-audit.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AUDIT_PORT || 8982;
const BASE = `http://localhost:${PORT}/`;
const MAKER = BASE + 'tools/arcade-game-maker.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
}
async function scenario(name, fn) {
  console.log('\n▸ ' + name);
  try { await fn(); }
  catch (e) { record(name, false, String(e.message || e).slice(0, 160)); }
}

/* Mirror of the site's own wire format: JSON → deflate-raw → base64url.
 * Must stay byte-compatible with _compressPayload / _decompressPayload. */
function encodeShareParam(obj) {
  const deflated = zlib.deflateRawSync(Buffer.from(JSON.stringify(obj), 'utf8'));
  return deflated.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function gameLink(cfg) {
  const { title, genre, speed = 200, gravity = 600, jump = 450, ...lc } = cfg;
  return MAKER + '?game=' + encodeShareParam({
    title, genre, speed, gravity, jump, map: null,
    lc, th: { c: [], n: '' }, bs: 0, bn: '', fk: 0,
  });
}

function watchErrors(page, bucket) {
  page.on('pageerror', e => bucket.push(e.message));
  page.on('console', m => { if (m.type() === 'error') bucket.push(m.text()); });
}
// Ignore third-party noise we can't fix from this repo
function relevantErrors(bucket) {
  return bucket.filter(e =>
    !/fonts\.googleapis|fonts\.gstatic|googletagmanager|google-analytics|ERR_(NAME|INTERNET|CONNECTION|BLOCKED)|Failed to load resource/i.test(e));
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  /* ── 1. Fresh-visitor boot ── */
  await scenario('studio boots clean for a first-time visitor', async () => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    watchErrors(page, errs);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(MAKER, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // First visit auto-loads a template and boots the engine
    await page.waitForSelector('#game-container canvas', { timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500)); // let first frames run
    record('canvas mounted & running', true);
    record('no uncaught JS errors on boot', relevantErrors(errs).length === 0, relevantErrors(errs).slice(0, 3).join(' | '));

    // Result-code codec round-trip while we're on a live page
    // (initials are arcade-style 3-char: JOSH → JOS)
    const codec = await page.evaluate(() => {
      const code = _makeResultCode(1830, 'JOSH');
      const o = _parseResultCode(code);
      return {
        ok: !!o && o.s === 1830 && o.n === 'JOS' && /^[A-Z0-9_]{2,16}$/.test(o.g),
        genre: o && o.g,
        // Regression guard: WAVESURVIVAL (13 chars) once exceeded the parser bound,
        // making scores unshareable for the two flagship templates.
        waveSurvivalOk: (() => {
          const c2 = _makeResultCode(50, 'ABC'); const p2 = _parseResultCode(c2);
          return !!p2 && p2.g === 'WAVESURVIVAL';
        })(),
      };
    });
    record('result-code round-trip', codec.ok && codec.waveSurvivalOk, 'genre=' + codec.genre + ' waveSurvival=' + codec.waveSurvivalOk);

    // Share payload compression round-trip (the exact functions the Share button uses)
    const comp = await page.evaluate(async () => {
      const sample = JSON.stringify({ hello: 'world', n: 42, arr: [1, 2, 3] });
      const enc = await _compressPayload(sample);
      const dec = await _decompressPayload(enc);
      return { ok: dec === sample, len: enc.length };
    });
    record('share-payload compress/decompress round-trip', comp.ok, comp.len + ' chars encoded');
    await ctx.close();
  });

  /* ── 2. Built-in 21-genre self-test ── */
  await scenario('?selftest=1 boots every genre scene without crashing', async () => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(MAKER + '?selftest=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForFunction(
        () => { const el = document.getElementById('selftestPanel'); return el && /genres passed/.test(el.textContent); },
        { timeout: 360000, polling: 1000 }
      );
    } catch (e) {
      const partial = await page.evaluate(() => {
        const el = document.getElementById('selftestPanel'); return el ? el.textContent.slice(0, 400) : '(no panel)';
      });
      throw new Error('self-test timed out. Last state: ' + partial.replace(/\n/g, ' '));
    }
    const summary = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#selftestPanel > div')].map(d => d.textContent.trim());
      const m = document.querySelector('#selftestPanel').textContent.match(/(\d+)\/(\d+) genres passed/);
      return { passed: m ? +m[1] : -1, total: m ? +m[2] : -1, rows };
    });
    record(`self-test ${summary.passed}/${summary.total} genres`, summary.passed === summary.total && summary.total === 21,
      summary.rows.filter(r => r.startsWith('✗')).join(' · ') || 'all green');
    await ctx.close();
  }, );

  /* ── 3. Shared ?game= link boots as a published game ── */
  await scenario('shared ?game= link opens in player mode with creator settings', async () => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    watchErrors(page, errs);
    await page.setViewport({ width: 1280, height: 900 });
    const url = gameLink({
      title: 'Audit Boss Rush', genre: 'SHOOTER', speed: 260,
      lives: 5, bossEnabled: true, bossHpNew: 25, enemyAI: 'chaser',
      storyIntro: 'Audit intro text',
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#game-container canvas', { timeout: 45000 });
    const state = await page.evaluate(() => ({
      playerMode: document.body.classList.contains('player-mode'),
      flag: !!window._playerMode,
      title: document.getElementById('gameTitle').value,
      genre: document.getElementById('genreMode').value,
      speed: liveConfig.speed, lives: liveConfig.lives,
      boss: liveConfig.bossEnabled, ai: liveConfig.enemyAI,
    }));
    record('player mode active (chrome hidden)', state.playerMode && state.flag, JSON.stringify({ playerMode: state.playerMode }));
    record('title carried through link', state.title === 'Audit Boss Rush', state.title);
    record('creator config applied', state.speed === 260 && state.lives === 5 && state.boss === true && state.ai === 'chaser',
      `speed=${state.speed} lives=${state.lives} boss=${state.boss} ai=${state.ai}`);
    record('no uncaught JS errors on shared boot', relevantErrors(errs).length === 0, relevantErrors(errs).slice(0, 3).join(' | '));

    // Friend result-link import (?result=JV1.…)
    const imported = await page.evaluate(() => {
      const code = _makeResultCode(7777, 'FRE');
      const r = _importFriendCode(code);
      const board = JSON.parse(localStorage.getItem('jv_lb_SHOOTER') || '[]');
      return { ok: !!r && !r.dup && board.some(e => e.name === 'FRE' && e.score === 7777) };
    });
    record('?result= friend-code lands on leaderboard', imported.ok);
    await ctx.close();
  });

  /* ── 3b. A generated featured-gallery link really plays ── */
  await scenario('generated featured link (featured-games.json) opens playable game', async () => {
    const listPath = path.join(ROOT, 'tools', 'featured-games.json');
    if (!fs.existsSync(listPath)) throw new Error('run node scripts/make-featured-links.js first');
    const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    const entry = list.find(g => g.key === 'neon_wave');
    if (!entry) throw new Error('neon_wave missing from featured-games.json');
    // Manifest carries the production host; retarget to the local server
    const localUrl = entry.playUrl.replace(/^https:\/\/jvdesignstudio\.co\.uk/, BASE.replace(/\/$/, ''));
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    watchErrors(page, errs);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(localUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#game-container canvas', { timeout: 45000 });
    await new Promise(r => setTimeout(r, 2000));
    const state = await page.evaluate(() => ({
      playerMode: document.body.classList.contains('player-mode'),
      title: document.getElementById('gameTitle').value,
      genre: document.getElementById('genreMode').value,
      scaling: liveConfig.waveScaling,
      introShown: document.getElementById('introOverlay').classList.contains('show'),
    }));
    record('boots into player mode', state.playerMode && !state.introShown, `intro=${state.introShown}`);
    record('correct game loaded', state.title === 'Neon Wave' && state.genre === 'WAVESURVIVAL',
      state.title + ' / ' + state.genre);
    record('creator tuning applied', state.scaling === 3, 'waveScaling=' + state.scaling);
    record('no uncaught JS errors', relevantErrors(errs).length === 0, relevantErrors(errs).slice(0, 2).join(' | '));
    await ctx.close();
  });

  /* ── 4. Remix link keeps the editor ── */
  await scenario('?remix= link loads config but stays editable', async () => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const url = MAKER + '?remix=' + encodeShareParam({
      title: 'Remix Source', genre: 'RUNNER', speed: 300, gravity: 700, jump: 500,
      map: null, lc: { doubleJump: true }, th: { c: [], n: '' }, bs: 0, bn: '', fk: 0,
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));
    const state = await page.evaluate(() => ({
      playerMode: document.body.classList.contains('player-mode'),
      title: document.getElementById('gameTitle').value,
      genre: document.getElementById('genreMode').value,
      dj: liveConfig.doubleJump,
      forked: parseInt(localStorage.getItem('jv_fork_count') || '0'),
    }));
    record('editor stays visible (no player mode)', !state.playerMode);
    record('remix title prefixed', /Remix of Remix Source/i.test(state.title), state.title);
    record('config merged (doubleJump on)', state.dj === true);
    record('fork counted', state.forked >= 1, String(state.forked));
    await ctx.close();
  });

  /* ── 5. Landing page ── */
  await scenario('landing page loads clean', async () => {
    const page = await browser.newPage();
    const errs = [];
    watchErrors(page, errs);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + 'tools/arcade-game-maker-landing.html', { waitUntil: 'domcontentloaded' });
    const h1 = await page.$eval('h1', el => el.textContent.trim());
    record('hero renders', /arcade game/i.test(h1), h1.slice(0, 50));
    record('no uncaught JS errors', relevantErrors(errs).length === 0, relevantErrors(errs).slice(0, 2).join(' | '));
    await page.close();
  });

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n────────────────────────────────────');
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    failed.forEach(f => console.log('  FAILED: ' + f.name));
    process.exit(1);
  }
  console.log('✓ arcade audit: all checks passed');
})().catch(e => { console.error('audit runner crashed:', e); process.exit(1); });
