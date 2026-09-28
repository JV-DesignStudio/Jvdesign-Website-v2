#!/usr/bin/env node
/*
 * tests/pastry-match-smoke.js , A596
 *
 * Pastry Match serves one order now. The page used to be a 90 second shift with
 * a queue of customers and patience bars running down, ending in "Shift
 * complete", so it asked for survival rather than one finished thing. It now
 * fills one box at your own pace, shows a served result, and offers the next
 * order.
 *
 * The player is a real solver, not a random clicker: it reads the dealt board
 * out of the DOM and only swaps a pair that lines up three of something the
 * order still wants. It runs inside the page, because the board bot kills this
 * file after 240 seconds and one CDP round trip per move was not going to make
 * it. Earlier versions flaked for two real reasons, both fixed here and in the
 * game: feedOrders returned undefined when the box filled, and the match
 * cascade kept running after the order was served.
 *
 * Run: node tests/pastry-match-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
// Ask the OS for a free port. A fixed one collides whenever two runs overlap,
// which happened when the board bot ran this alongside another agent, and the
// server then threw an unhandled error and failed the whole run.
const WANTED_PORT = Number(process.env.PM_PORT || 0);
let BASE = '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

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
  order: (document.getElementById('timeHud') || {}).textContent,
  score: (document.getElementById('scoreHud') || {}).textContent,
  combo: (document.getElementById('comboHud') || {}).textContent,
  stars: (document.getElementById('starsHud') || {}).textContent,
  target: (document.getElementById('targetHud') || {}).textContent,
  orderName: (document.getElementById('orderName') || {}).textContent,
  slots: [...document.querySelectorAll('#orderSlots .slot')].map(s => s.textContent.trim()),
  slotsDone: document.querySelectorAll('#orderSlots .slot.done').length,
  customers: document.querySelectorAll('#customers .customer').length,
  fill: (document.getElementById('patienceBar') || {}).style ? document.getElementById('patienceBar').style.width : '',
  board: document.querySelectorAll('#board .tile').length,
  endShown: (document.getElementById('endModal') || {}).classList ? /show/.test(document.getElementById('endModal').className) : null,
  endTitle: (document.getElementById('endTitle') || {}).textContent,
  endCopy: ((document.getElementById('endCopy') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  endOrders: (document.getElementById('finalOrders') || {}).textContent,
  endScore: (document.getElementById('finalScore') || {}).textContent,
  scrolls: document.documentElement.scrollWidth > window.innerWidth + 1
});

/* ------------------------------------------------------------------ *
 * Everything below runs inside the page.                                  *
 * ------------------------------------------------------------------ */
const IN_PAGE = `
window.__pm = (function () {
  const idle = () => !busy && state === 'playing' && document.querySelectorAll('#board .tile.matched').length === 0;
  const endShown = () => /show/.test(document.getElementById('endModal').className);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // wait until the game will actually take a tap. Waiting only for the
  // .matched class to clear is not enough: dropTiles re-renders without it
  // while busy is still true, and every click in that window is dropped.
  async function settle(limit) {
    for (let i = 0; i < limit; i++) {
      if (idle()) return true;
      await sleep(30);
    }
    return idle();
  }

  function read() {
    const tiles = [...document.querySelectorAll('#board .tile')];
    let w = 0, h = 0;
    // tile classes look like "tile pastry-donut selected", so ids are words
    const idOf = (t) => { const m = /pastry-([a-z0-9_-]+)/i.exec(t.className); return m ? m[1] : ''; };
    for (const t of tiles) { w = Math.max(w, +t.dataset.c + 1); h = Math.max(h, +t.dataset.r + 1); }
    const grid = [];
    for (let r = 0; r < h; r++) grid[r] = [];
    for (const t of tiles) grid[+t.dataset.r][+t.dataset.c] = idOf(t);
    const emojiToId = {};
    for (const t of tiles) emojiToId[(t.textContent || '').trim()] = idOf(t);
    const wanted = new Set();
    for (const slot of document.querySelectorAll('#orderSlots .slot')) {
      if (slot.classList.contains('done')) continue;
      const emoji = (slot.textContent || '').trim().replace(/[0-9]/g, '');
      const id = emojiToId[emoji];
      if (id) wanted.add(id);
    }
    return { tiles, grid, w, h, wanted };
  }

  // how many cells of id a swap would clear
  function score(id) {
    const { grid, w, h } = ctx;
    let n = 0;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (grid[r][c] !== id) continue;
      let run = 1; while (c + run < w && grid[r][c + run] === id) run++;
      if (run >= 3) n += run;
      run = 1; while (r + run < h && grid[r + run] && grid[r + run][c] === id) run++;
      if (run >= 3) n += run;
    }
    return n;
  }

  let ctx = null;

  function choose(step, stall) {
    ctx = read();
    const { grid, w, h, wanted } = ctx;
    const best = () => {
      let b = { size: 0, id: '' };
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const id = grid[r][c];
        if (!id) continue;
        const n = score(id);
        if (n > b.size || (n === b.size && wanted.has(id) && !wanted.has(b.id))) b = { size: n, id };
      }
      return b;
    };
    const options = [];
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= h || c2 >= w) continue;
          const a = grid[r][c], b = grid[r2][c2];
          grid[r][c] = b; grid[r2][c2] = a;
          const after = best();
          grid[r][c] = a; grid[r2][c2] = b;   // put it back exactly
          options.push({ r, c, r2, c2, size: after.size, id: after.id, feeds: after.size > 0 && wanted.has(after.id) });
        }
      }
    }
    // clear a line for something the order wants first, then the biggest line
    const pool = options.slice().sort((a, b) => (a.feeds !== b.feeds ? (a.feeds ? -1 : 1) : b.size - a.size));
    // vary between the good options so a bad deal does not replay one dead
    // path. When the box stops filling, still insist on a swap that makes a
    // match, or the game swaps straight back and the board never changes.
    const n = step || 0;
    const matching = pool.filter(o => o.size > 0);
    const pick = stall
      ? (matching.length ? matching[(n * 7 + 3) % matching.length] : pool[(n * 7 + 3) % pool.length])
      : pool[n % Math.min(3, pool.length)];
    if (!pick) return null;
    const A = document.querySelector('#board .tile[data-r="' + pick.r + '"][data-c="' + pick.c + '"]');
    const B = document.querySelector('#board .tile[data-r="' + pick.r2 + '"][data-c="' + pick.c2 + '"]');
    if (!A || !B) return null;
    A.click(); B.click();
    return pick;
  }

  // Fill the box. Returns what happened so the assertions can be honest.
  return async function play(maxMoves) {
    let moves = 0, since = 0, last = 0, stall = false, fed = 0;
    while (moves < maxMoves) {
      if (endShown()) break;
      await settle(200);
      if (endShown()) break;
      const pick = choose(moves, stall);
      if (!pick) break;
      moves++;
      await settle(200);
      const done = document.querySelectorAll('#orderSlots .slot.done').length;
      if (done > last) fed++;
      since = done > last ? 0 : since + 1;
      last = done;
      stall = since > 10;
    }
    return { moves, fed, served: endShown() };
  };
})();
true;`;

const PLAY = (page, max) => page.evaluate(n => window.__pm(n), max);

(async () => {
  await new Promise(r => server.listen(WANTED_PORT, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const warm = await browser.newPage();
    await warm.goto(BASE + '/index.html', { waitUntil: 'load' });

    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      await warm.evaluate(() => localStorage.clear());
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/pastry-match.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#playBtn', { timeout: 10000 });

      const menu = await page.evaluate(() => ({
        copy: document.body.textContent.replace(/\s+/g, ' '),
        modes: document.querySelectorAll('#modeRow button').length
      }));
      ok(vp.name + ': the page no longer promises a shift or a running clock',
         !/shift target|patience runs out|keep the queue/i.test(menu.copy),
         (menu.copy.match(/[^.]{0,40}(shift target|patience runs out)[^.]{0,40}/i) || [''])[0]);
      ok(vp.name + ': the three bakeries are still a choice', menu.modes === 3, String(menu.modes));

      await page.evaluate(() => document.getElementById('playBtn').click());
      await new Promise(r => setTimeout(r, 400));
      await page.evaluate(IN_PAGE);
      const start = await page.evaluate(SNAP);
      ok(vp.name + ': the order counter reads one order', start.order === '1/1', start.order);
      ok(vp.name + ': one customer is waiting', start.customers === 1, String(start.customers));
      ok(vp.name + ': the order has pastries to fill', start.slots.length >= 3, start.slots.join(' '));
      ok(vp.name + ': the box starts empty', start.slotsDone === 0, String(start.slotsDone));
      ok(vp.name + ': the board is dealt', start.board > 30, String(start.board));
      ok(vp.name + ': the fill meter starts empty', /^0(\.0+)?%$/.test(start.fill) || start.fill === '', JSON.stringify(start.fill));
      ok(vp.name + ': no result screen yet', start.endShown === false);
      ok(vp.name + ': no sideways scrolling', !start.scrolls);

      // no clock: nothing may count down while the player thinks
      await new Promise(r => setTimeout(r, 3000));
      const idle = await page.evaluate(SNAP);
      ok(vp.name + ': nothing counts down while you think', idle.order === '1/1' && idle.slotsDone === 0, idle.order + ' / ' + idle.slotsDone);

      // fill the box
      const played = await PLAY(page, 250);
      const served = await page.evaluate(SNAP);
      ok(vp.name + ': matching fills the box', played.fed > 0, played.moves + ' swaps, fed ' + played.fed + ' times, slots ' + served.slotsDone + '/' + served.slots.length);
      ok(vp.name + ': filling the box ends the order', played.served && served.endShown, 'after ' + played.moves + ' swaps, slots ' + served.slotsDone + '/' + served.slots.length);
      ok(vp.name + ': the result says the order was served', /order served|gold star/i.test(served.endTitle), served.endTitle);
      ok(vp.name + ': the result invites the next order', /next order/i.test(served.endCopy), served.endCopy.slice(0, 80));
      ok(vp.name + ': the box is recorded as filled', served.endOrders === '1', served.endOrders);
      ok(vp.name + ': a score is banked', Number(served.score) > 0 && Number.isFinite(Number(served.score)), served.score);
      ok(vp.name + ': the fill meter filled as the order went', parseFloat(served.fill) >= 99, served.fill);
      ok(vp.name + ': the order counter reads served', /served/i.test(served.order), served.order);
      ok(vp.name + ': stars were awarded', Number(served.stars) >= 1, served.stars);
      // The result screen used to close before the match score was banked, so
      // it reported a stale score and "earned 0 stars" while the HUD disagreed.
      ok(vp.name + ': the result score matches the score on screen',
         served.endScore === served.score, 'result ' + served.endScore + ' vs hud ' + served.score);
      const claimed = (served.endCopy.match(/earned (\d+) star/) || [])[1];
      ok(vp.name + ': the stars in the result copy match the stars awarded',
         claimed != null && Number(claimed) === Number(served.stars),
         'copy says ' + claimed + ', hud says ' + served.stars);

      // Replay with no pause at all. The order ends from inside the match
      // cascade, so a match still falling when the next order starts would
      // quietly fill the fresh box.
      await page.evaluate(() => document.getElementById('endModal').querySelector('button').click());
      let raced = null;
      for (let i = 0; i < 50; i++) {
        raced = await page.evaluate(SNAP);
        if (!raced.endShown && raced.board > 30) break;
        await new Promise(r => setTimeout(r, 100));
      }
      ok(vp.name + ': replaying straight away still starts an empty box',
         !raced.endShown && raced.slotsDone === 0 && raced.customers === 1,
         JSON.stringify({ end: raced.endShown, done: raced.slotsDone, customers: raced.customers }));

      // and again twice more, so a box that starts half filled gets caught
      let clean = true, detail = '';
      for (let round = 2; round <= 3; round++) {
        const r = await PLAY(page, 250);
        const s = await page.evaluate(SNAP);
        if (!r.served) { clean = false; detail = 'round ' + round + ' never served after ' + r.moves + ' swaps, slots ' + s.slotsDone + '/' + s.slots.length; break; }
        if (round < 3) {
          const before = s.slotsDone;
          await page.evaluate(() => document.getElementById('endModal').querySelector('button').click());
          let nxt = null;
          for (let i = 0; i < 50; i++) {
            nxt = await page.evaluate(SNAP);
            if (!nxt.endShown && nxt.board > 30) break;
            await new Promise(r2 => setTimeout(r2, 100));
          }
          const bad = nxt.endShown || nxt.slotsDone !== 0 || nxt.customers !== 1 || nxt.order !== '1/1';
          if (bad) { clean = false; detail = 'round ' + round + ' ' + JSON.stringify({ end: nxt.endShown, done: nxt.slotsDone, customers: nxt.customers, order: nxt.order }); break; }
        }
      }
      ok(vp.name + ': three orders in a row each start clean and can be served', clean, detail);
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
    await warm.close();

    const html = fs.readFileSync(path.join(ROOT, 'games', 'pastry-match.html'), 'utf8');
    ok('no shift timer left in the page', !/setInterval\(gameTick|timeLeft--|mode\(\)\.time|patience - |missCustomer/.test(html));
    ok('no queue length left in the page', !/mode\(\)\.queue/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nPastry Match: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
