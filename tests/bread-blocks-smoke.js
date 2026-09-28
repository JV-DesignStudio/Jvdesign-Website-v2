#!/usr/bin/env node
/*
 * tests/bread-blocks-smoke.js , A586
 *
 * Bread Blocks is one order now: serve the Morning Basket, see the served
 * ending, or get kindly stuck with the pattern still showing. The 5-order
 * cycle is gone. This plays pieces through the real UI until an ending
 * appears (win or stuck both count, both are visible endings), then serves
 * again for a clean replay.
 *
 * Run: node tests/bread-blocks-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.BB_PORT || 8152);
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
  orders: document.getElementById('ordersDone').textContent,
  score: document.getElementById('score').textContent,
  orderName: document.getElementById('orderName').textContent,
  serveShown: document.getElementById('serve').classList.contains('show'),
  serveTitle: document.getElementById('serveTitle').textContent,
  serveText: document.getElementById('serveText').textContent,
});

// one placement attempt: select first counter piece, aim at the glowing order
// squares first like a real player, then try anywhere that fits. If nothing
// fits, spend the New counter tool for fresh pieces like a real player would.
const PLACE_ONE = () => {
  if (document.getElementById('serve').classList.contains('show')) return 'ended';
  const pieces = document.querySelectorAll('#pieces .piece');
  if (!pieces.length) return 'no-pieces';
  pieces[0].click();
  const before = Number(document.getElementById('score').textContent);
  const cells = [...document.querySelectorAll('#tray .cell')];
  const ordered = [...cells.filter(c => c.classList.contains('target')), ...cells];
  for (const cell of ordered) {
    cell.click();
    if (Number(document.getElementById('score').textContent) > before) return 'placed';
    if (document.getElementById('serve').classList.contains('show')) return 'ended';
  }
  // try rotated, then fresh pieces, like a real player would
  document.getElementById('roll').click();
  const cells2 = [...document.querySelectorAll('#tray .cell')];
  const ordered2 = [...cells2.filter(c => c.classList.contains('target')), ...cells2];
  for (const cell of ordered2) {
    cell.click();
    if (Number(document.getElementById('score').textContent) > before) return 'placed';
    if (document.getElementById('serve').classList.contains('show')) return 'ended';
  }
  document.getElementById('shuffle').click();
  return 'shuffled';
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
      await page.goto(BASE + '/games/bread-blocks.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#tray .cell', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': the only order is the Morning Basket', start.orderName === 'Morning Basket', start.orderName);
      ok(vp.name + ': the counter reads 0/1, not an open count', start.orders === '0/1', start.orders);
      ok(vp.name + ': the page states one order, not a mission queue', /serve one morning basket/i.test(await page.evaluate(() => document.body.textContent)));

      // play through the real UI until a visible ending
      let ending = null;
      for (let t = 0; t < 250; t++) {
        const s = await page.evaluate(SNAP);
        if (s.serveShown) { ending = s; break; }
        await page.evaluate(PLACE_ONE);
      }
      ending = ending || await page.evaluate(SNAP);
      ok(vp.name + ': the run reaches a visible ending', ending.serveShown, ending.serveTitle);
      ok(vp.name + ': the ending is served or kindly stuck with the pattern',
        /served|stuck/i.test(ending.serveTitle) && ending.serveText.length > 40, ending.serveTitle);
      if (/served/i.test(ending.serveTitle)) {
        ok(vp.name + ': the served order reads Served', ending.orders === 'Served', ending.orders);
      }

      // serve again is a clean single order again
      await page.evaluate(() => document.getElementById('againBtn').click());
      await new Promise(r => setTimeout(r, 300));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': serving again resets to a fresh Morning Basket',
        !replay.serveShown && replay.orders === '0/1' && Number(replay.score) === 0,
        JSON.stringify({ orders: replay.orders, score: replay.score }));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    const html = fs.readFileSync(path.join(ROOT, 'games', 'bread-blocks.html'), 'utf8');
    ok('no order queue left in the page', !/Lunch Sandwich Run|Croissant Window|Party Platter|Star Baker Tray/.test(html));
    ok('no cycling newOrder logic left', !/done%orders\.length/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nBread Blocks run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
