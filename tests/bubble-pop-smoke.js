#!/usr/bin/env node
/*
 * tests/bubble-pop-smoke.js , A591
 *
 * Bubble Pop Galaxy is one mission now: light the Lantern Nebula by popping
 * the matching colours inside the move limit, then play it again to beat it.
 *
 * This drives that in a real browser. The previous version of this file looked
 * for a #tutorialModal that the page no longer has, so it had been failing
 * rather than guarding anything.
 *
 * Run: node tests/bubble-pop-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.BP_PORT || 8142);
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

// read the live board the way the page describes it, then pop the biggest
// cluster of a colour the mission still needs. Returns false when no move is
// left or the board is busy.
const playBiggestNeeded = () => {
  const cells = [...document.querySelectorAll('#board .bubble')].map(el => ({
    id: Number(el.dataset.id),
    type: [...el.classList].find(c => ['red', 'teal', 'gold', 'violet', 'blue', 'green'].includes(c)),
    size: Number((el.getAttribute('aria-label').match(/cluster size (\d+)/) || [0, 0])[1])
  })).filter(c => c.type && c.size >= 2);
  if (!cells.length) return false;
  // prefer red and teal, the two the mission asks for, then the biggest cluster
  cells.sort((a, b) => {
    const need = t => (t === 'red' || t === 'teal') ? 1 : 0;
    return (need(b.type) - need(a.type)) || (b.size - a.size);
  });
  document.querySelector('#board .bubble[data-id="' + cells[0].id + '"]').click();
  return true;
};

const snapFn = () => ({
  score: Number(document.getElementById('scoreVal').textContent),
  moves: Number(document.getElementById('movesVal').textContent),
  mission: document.getElementById('missionTitle').textContent,
  sector: document.getElementById('sectorName').textContent,
  missionCount: document.getElementById('levelVal').textContent,
  planets: document.querySelectorAll('#levelStrip .planet').length,
  goals: [...document.querySelectorAll('#missionGoals .goal')].map(g => ({
    label: g.querySelector('span').textContent.trim(),
    done: g.classList.contains('done')
  })),
  modal: document.getElementById('modal').classList.contains('show'),
  modalTitle: document.getElementById('modalTitle').textContent,
  modalButton: document.getElementById('modalPrimary').textContent,
  cells: document.querySelectorAll('#board .bubble').length
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
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
      await page.goto(BASE + '/games/bubble-pop-galaxy.html', { waitUntil: 'load', timeout: 30000 });

      // the opening card invites one mission, not a sector run
      await page.waitForSelector('#modal.show', { timeout: 10000 });
      const intro = await page.evaluate(snapFn);
      ok(vp.name + ': opens on one mission card', intro.modal && /mission/i.test(intro.modalButton), intro.modalButton);
      const introText = await page.evaluate(() => document.getElementById('modalSub').textContent);
      ok(vp.name + ': intro does not promise five sectors', !/five|sector|unlock/i.test(introText), introText.slice(0, 60));

      await page.evaluate(() => document.getElementById('modalPrimary').click());
      await page.waitForSelector('#board .bubble', { timeout: 10000 });
      const start = await page.evaluate(snapFn);
      ok(vp.name + ': one mission is loaded', start.missionCount === '1/1' && start.planets === 1, start.missionCount + ' / ' + start.planets + ' planets');
      ok(vp.name + ': the mission is the lantern run', /lantern/i.test(start.mission) && /lantern/i.test(start.sector), start.mission);
      ok(vp.name + ': the board is dealt', start.cells === 64, String(start.cells));
      ok(vp.name + ': the move limit is a short one', start.moves > 0 && start.moves <= 14, String(start.moves));
      ok(vp.name + ': three goals are shown', start.goals.length === 3, start.goals.map(g => g.label).join(' | '));

      // play it: tap the biggest cluster the mission still needs, and wait for
      // the board to actually consume the move before the next tap
      let taps = 0;
      let state = start;
      while (taps < 30) {
        const before = await page.evaluate(() => Number(document.getElementById('movesVal').textContent));
        const snap = await page.evaluate(snapFn);
        if (snap.modal) { state = snap; break; }
        const tapped = await page.evaluate(playBiggestNeeded);
        if (!tapped) break;
        taps++;
        for (let w = 0; w < 30; w++) {
          await new Promise(r => setTimeout(r, 100));
          const now = await page.evaluate(() => Number(document.getElementById('movesVal').textContent));
          if (now < before) break;
        }
        state = await page.evaluate(snapFn);
        if (state.modal) break;
      }
      const movesUsed = start.moves - state.moves;
      ok(vp.name + ': the mission reaches an ending', state.modal, 'after ' + movesUsed + ' moves');
      ok(vp.name + ': the ending is a clear result, not a dead end',
         /complete|moves/i.test(state.modalTitle), state.modalTitle);
      ok(vp.name + ': the ending offers a replay',
         /again|retry|replay/i.test(state.modalButton), state.modalButton);
      ok(vp.name + ': no unlock or next mission is offered',
         !/next|unlock|continue/i.test(state.modalButton + state.modalTitle), state.modalButton);
      const won = /complete/i.test(state.modalTitle);
      ok(vp.name + ': the score and goals were tracked to the end', state.score > 0 && state.goals.some(g => g.done),
         'score ' + state.score + ', goals done ' + state.goals.filter(g => g.done).length);
      ok(vp.name + ': the finishing move is inside the budget', movesUsed <= start.moves, movesUsed + '/' + start.moves);
      const endingText = await page.evaluate(() => document.getElementById('modalSub').textContent);
      ok(vp.name + ': the ending explains how the stars were earned',
         /finishing/.test(endingText) && /chain of 4/.test(endingText), endingText.slice(0, 80));

      // replay resets the board for another run
      await page.evaluate(() => document.getElementById('modalPrimary').click());
      await new Promise(r => setTimeout(r, 400));
      const replay = await page.evaluate(snapFn);
      ok(vp.name + ': replay deals a fresh board', !replay.modal && replay.cells === 64 && replay.moves > 0,
         'moves ' + replay.moves + ', cells ' + replay.cells);
      ok(vp.name + ': replay starts the same mission again', replay.mission === start.mission, replay.mission);
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      if (!won) console.log('  [INFO] ' + vp.name + ': this run ran out of moves, the ending copy is still the fail ending');
      await page.close();
    }
    await warm.close();

    const html = fs.readFileSync(path.join(ROOT, 'games', 'bubble-pop-galaxy.html'), 'utf8');
    ok('no sector ladder left in the page', !/sectors\s*=|levelIndex|bestLevel/.test(html));
    ok('the page promises one short mission', /one mission/i.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nBubble Pop Galaxy mission: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
