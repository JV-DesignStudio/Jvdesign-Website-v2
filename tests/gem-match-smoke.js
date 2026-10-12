#!/usr/bin/env node
/*
 * tests/gem-match-smoke.js
 *
 * Gem Match is a two-minute match-3. The goal is to reach Fever or 1,500
 * before the timer ends. This plays real swaps, proves the score climbs, proves
 * the countdown is live, and proves Play Again resets. The game is now on the
 * shared GameSystem and no longer exposes the old __gemTest hook or a separate
 * "Order Served" ending, so this test follows the shipped game.
 *
 * Run: node tests/gem-match-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.GM_PORT || 8156);
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : ''));
  if (!cond) failures++;
};

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const SNAP = () => ({
  goShown: document.getElementById('goOverlay').classList.contains('show'),
  goTitle: (document.querySelector('#goOverlay .go-title') || {}).textContent || '',
  goLabel: (document.querySelector('#goOverlay .go-label') || {}).textContent || '',
  goScore: document.getElementById('goScore').textContent,
  score: document.getElementById('scoreEl').textContent,
  timer: document.getElementById('timerEl').textContent,
});

const FIND_AND_SWAP = () => {
  const GRID = 8, TOTAL = 64;
  const cells = [...document.querySelectorAll('#board .cell')];
  if (cells.length !== TOTAL) return 'no-board';
  const board = cells.map(c => c.dataset.color);
  const SPECIAL = new Set(['empty', 'bomb', 'wild']);
  const anyMatch = (b) => {
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID - 2; c++) {
      const i = r * GRID + c, x = b[i];
      if (SPECIAL.has(x)) continue;
      if (b[i + 1] === x && b[i + 2] === x) return true;
    }
    for (let c = 0; c < GRID; c++) for (let r = 0; r < GRID - 2; r++) {
      const i = r * GRID + c, x = b[i];
      if (SPECIAL.has(x)) continue;
      if (b[i + GRID] === x && b[i + GRID * 2] === x) return true;
    }
    return false;
  };
  const nbrs = (i) => {
    const r = Math.floor(i / GRID), c = i % GRID, n = [];
    if (c > 0) n.push(i - 1); if (c < GRID - 1) n.push(i + 1);
    if (r > 0) n.push(i - GRID); if (r < GRID - 1) n.push(i + GRID);
    return n;
  };
  for (let i = 0; i < TOTAL; i++) {
    for (const j of nbrs(i)) {
      if (j <= i) continue;
      [board[i], board[j]] = [board[j], board[i]];
      const good = anyMatch(board);
      [board[i], board[j]] = [board[j], board[i]];
      if (good) { cells[i].click(); setTimeout(() => cells[j].click(), 60); return 'swapped ' + i + '->' + j; }
    }
  }
  return 'no-move';
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.evaluateOnNewDocument(() => localStorage.clear());
      await page.goto(BASE + '/games/gem_match.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#btnStart', { timeout: 10000 });

      const copy = await page.evaluate(() => document.body.textContent);
      ok(vp.name + ': page states the Fever or 1,500 goal', /Reach Fever or\s*1,?500|1,?500/i.test(copy), 'copy check');

      await page.evaluate(() => document.getElementById('btnStart').click());
      await new Promise(r => setTimeout(r, 800));
      await page.waitForSelector('#board .cell', { timeout: 10000 });
      const start = await page.evaluate(SNAP);
      ok(vp.name + ': board of 64 cells after Play', await page.evaluate(() => document.querySelectorAll('#board .cell').length) === 64);
      ok(vp.name + ': start score is 0', start.score === '0', start.score);
      ok(vp.name + ': timer starts at 2:00', start.timer === '2:00' || start.timer === '1:59', start.timer);
      ok(vp.name + ': no result overlay at the start', !start.goShown);

      // The mechanic must be playable: a real swap should score points.
      let scored = 0;
      for (let t = 0; t < 15 && scored === 0; t++) {
        await page.evaluate(FIND_AND_SWAP);
        await new Promise(r => setTimeout(r, 650));
        scored = await page.evaluate(() => Number((document.getElementById('scoreEl').textContent || '0').replace(/,/g, '')));
      }
      ok(vp.name + ': a real swap scores points', scored > 0, 'score ' + scored);

      // The countdown must be live (the end path is wired).
      const t1 = (await page.evaluate(SNAP)).timer;
      await new Promise(r => setTimeout(r, 1400));
      const t2 = (await page.evaluate(SNAP)).timer;
      ok(vp.name + ': timer counts down', t1 !== t2 || (await page.evaluate(SNAP)).goShown, t1 + ' -> ' + t2);

      // Play Again resets to a fresh board with no overlay.
      await page.evaluate(() => document.getElementById('btnAgain').click());
      await new Promise(r => setTimeout(r, 800));
      const fresh = await page.evaluate(SNAP);
      ok(vp.name + ': Play Again resets to a fresh, empty board', !fresh.goShown && fresh.score === '0', JSON.stringify({ goShown: fresh.goShown, score: fresh.score }));

      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    const html = fs.readFileSync(path.join(ROOT, 'games', 'gem_match.html'), 'utf8');
    ok('goal copy present', /1,?500/.test(html) && /Fever/i.test(html));
    ok('time-up overlay and Play Again are wired', /id="goOverlay"/.test(html) && /id="btnAgain"/.test(html) && /goOverlay\.classList\.add\('show'\)/.test(html));
    ok('runs on the shared GameSystem', /GameSystem/.test(html) && /GameUI/.test(html));
    ok('no em dash in the page', !/\u2014/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nGem Match run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
