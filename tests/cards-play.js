#!/usr/bin/env node
/*
 * tests/cards-play.js
 *
 * Plays Call of the Cards for real at phone, desktop and landscape sizes:
 * start a duel, play a card, pass the turn to the Rival, then storm the
 * Fortress through the actual button. Also checks the board does not push
 * the page sideways on any of those viewports.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.CC_PLAY_PORT || 8162);
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

async function waitFor(page, fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [
      { name: '390px', width: 390, height: 844 },
      { name: '1440px', width: 1440, height: 900 },
      { name: 'landscape 740x390', width: 740, height: 390 }
    ]) {
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/call_of_the_cards.html', { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 400));

      const showcase = await page.evaluate(() => document.querySelectorAll('#cards-grid .game-card').length);
      ok(vp.name + ': card showcase renders the new deck', showcase >= 20, String(showcase));

      await page.click('#btnPlayNow');
      const boardShown = await waitFor(page, () => {
        const b = document.getElementById('gameBoard');
        return b && getComputedStyle(b).display !== 'none';
      }, 5000);
      ok(vp.name + ': Play Now opens the board', boardShown);

      await page.click('#modeOverlay .mode-btn.mode-ai');
      const started = await waitFor(page, () => document.querySelectorAll('#playerHand .coc-card').length > 0, 5000);
      ok(vp.name + ': vs AI deals a hand', started);

      const dealt = await page.evaluate(() => ({
        hand: document.querySelectorAll('#playerHand .coc-card').length,
        gold: (document.getElementById('goldPips') || {}).textContent || '',
        fortress: !!document.getElementById('btnStorm')
      }));
      ok(vp.name + ': hand has cards', dealt.hand >= 5, String(dealt.hand));
      ok(vp.name + ': gold is shown', /3 Gold/.test(dealt.gold), dealt.gold.trim());
      ok(vp.name + ': fortress and storm button exist', dealt.fortress);

      // Select the first affordable card and play it.
      const picked = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#playerHand .coc-card')];
        const idx = cards.findIndex(c => !c.classList.contains('is-unaffordable'));
        if (idx < 0) return false;
        cards[idx].click();
        return true;
      });
      ok(vp.name + ': an affordable card is selectable', picked);
      const barShown = await page.evaluate(() => !document.getElementById('actionPanel').hidden);
      ok(vp.name + ': play bar opens', barShown);

      const before = await page.evaluate(() => ({
        hand: document.querySelectorAll('#playerHand .coc-card').length,
        field: document.querySelectorAll('#playerFieldCards .coc-field-card').length,
        gold: game.state.p1.gold
      }));
      await page.evaluate(() => document.querySelector('#actionPanel .action-play').click());
      await new Promise(r => setTimeout(r, 400));
      const after = await page.evaluate(() => ({
        hand: document.querySelectorAll('#playerHand .coc-card').length,
        field: document.querySelectorAll('#playerFieldCards .coc-field-card').length,
        gold: game.state.p1.gold,
        log: (document.getElementById('logEntries') || {}).textContent || ''
      }));
      ok(vp.name + ': playing a card spends Gold', after.gold < before.gold, before.gold + ' -> ' + after.gold);
      ok(vp.name + ': the play changes the board', after.hand !== before.hand || after.field !== before.field, before.hand + '/' + before.field + ' -> ' + after.hand + '/' + after.field);
      ok(vp.name + ': the play is logged', after.log.length > 0, after.log.slice(0, 70));

      // Pass the turn and let the Rival act.
      await page.click('#btnEndTurn');
      const back = await waitFor(page, () => /Your Turn|Duel over/.test((document.getElementById('turnIndicator') || {}).textContent || ''), 20000);
      ok(vp.name + ': Rival takes a turn and hands back', back);

      // Make the Fortress reachable and storm it through the button.
      const stormed = await page.evaluate(() => {
        if (typeof game === 'undefined' || !game) return false;
        // The Rival can win on its first turn, so reset to a clean, winnable
        // position before testing the Storm button itself.
        game.gameOver = false;
        game.turnPhase = 'main';
        game.state.activePlayer = 'p1';
        game.state.p1.stormed = false;
        game.state.p1.stormReady = true;
        game.state.p1.vp = 0;
        game.state.p1.tempPower = 0;
        game.state.p1.field = [
          { ...CARD_DB.companions.find(c => c.id === 'knight'), power: 5, basePower: 5, uid: 't1' },
          { ...CARD_DB.companions.find(c => c.id === 'rogue'), power: 2, basePower: 2, uid: 't2' },
          { ...CARD_DB.companions.find(c => c.id === 'squire'), power: 1, basePower: 1, uid: 't3' }
        ];
        game.state.p2.field = [];
        game.state.p1.artifacts = [];
        game.state.p2.artifacts = [];
        document.getElementById('gameOverOverlay').style.display = 'none';
        game.emit();
        renderBoard(game.state);
        const btn = document.getElementById('btnStorm');
        if (btn.disabled) return false;
        btn.click();
        return true;
      });
      ok(vp.name + ': Storm button enabled at 8 Power', stormed);
      await new Promise(r => setTimeout(r, 400));
      const over = await page.evaluate(() => {
        const ov = document.getElementById('gameOverOverlay');
        return {
          shown: ov && getComputedStyle(ov).display !== 'none',
          title: (document.getElementById('gameOverTitle') || {}).textContent || ''
        };
      });
      ok(vp.name + ': storming shows the victory screen', over.shown && /Victory/.test(over.title), over.title);

      ok(vp.name + ': no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nCards play: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
