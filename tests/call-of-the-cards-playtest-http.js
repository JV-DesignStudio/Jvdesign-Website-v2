#!/usr/bin/env node
/*
 * tests/call-of-the-cards-playtest-http.js
 *
 * Regression: the playtest page used to hide #gameBoard twice (inline
 * style + a `#gameBoard { display:none; }` stylesheet rule). startGame()
 * cleared the inline style, so the stylesheet rule kept the board hidden
 * and clicking "vs AI" showed nothing. A canvas-sized play area that never
 * appears is the same thing as no game at all.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.COC_PT_PORT || 8161);
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
let failures = 0;
const ok = (name, cond, detail) => { console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : '')); if (!cond) failures++; };

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const SNAP = () => {
  const board = document.getElementById('gameBoard');
  return {
    display: board ? getComputedStyle(board).display : null,
    height: board ? Math.round(board.getBoundingClientRect().height) : 0,
    hand: document.getElementById('playerHand') ? document.getElementById('playerHand').children.length : 0,
    log: document.getElementById('logEntries') ? document.getElementById('logEntries').textContent.trim() : '',
  };
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/call-of-the-cards-playtest.html', { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 600));

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': board hidden before play', start.display === 'none', start.display);

      const started = await page.evaluate(() => {
        const btn = document.querySelector('#modeOverlay .mode-btn.mode-ai');
        if (!btn) return false;
        btn.click();
        return true;
      });
      ok(vp.name + ': vs AI button present', started);
      await new Promise(r => setTimeout(r, 1000));

      const after = await page.evaluate(SNAP);
      ok(vp.name + ': board is visible after starting a game', after.display !== 'none' && after.height > 200, after.display + ' h=' + after.height);
      ok(vp.name + ': hand dealt onto the board', after.hand > 0, String(after.hand));
      ok(vp.name + ': battle log has an entry', after.log.length > 0, after.log.slice(0, 60));

      const handBefore = await page.evaluate(() => game.state.p1.hand.length);
      const goldBefore = await page.evaluate(() => game.state.p1.gold);
      const logBefore = await page.evaluate(() => game.state.log[0] || '');
      const opened = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#playerHand [data-on="selectCard"]')];
        const hit = cards.find(c => {
          const idx = Number(c.getAttribute('data-on-arg'));
          const card = game.state.p1.hand[idx];
          return card && card.cost <= game.state.p1.gold;
        });
        if (!hit) return false;
        hit.click();
        return !document.getElementById('actionPanel').style.display;
      });
      ok(vp.name + ': tapping a card opens its play panel', opened);
      const acted = await page.evaluate(() => {
        const btn = document.querySelector('#actionButtons [data-on="doRecruit"], #actionButtons [data-on="doArtifact"], #actionButtons [data-on="doDiscard"]');
        if (!btn) return false;
        btn.click();
        return true;
      });
      ok(vp.name + ': a card action runs', acted);
      await new Promise(r => setTimeout(r, 250));
      const handAfter = await page.evaluate(() => game.state.p1.hand.length);
      const goldAfter = await page.evaluate(() => game.state.p1.gold);
      const logAfter = await page.evaluate(() => game.state.log[0] || '');
      ok(vp.name + ': the action changed the game state', handAfter !== handBefore || goldAfter !== goldBefore || logAfter !== logBefore, handBefore + '/' + goldBefore + ' -> ' + handAfter + '/' + goldAfter + ' | ' + logAfter.slice(0, 50));

      ok(vp.name + ': no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nCards playtest: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
