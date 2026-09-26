#!/usr/bin/env node
/*
 * tests/backpack-quest-smoke.js , A592
 *
 * Backpack Quest is one run now: choose a hero, pack shaped loot into the
 * backpack, open the door and fight the Ancient Golem to an ending you can
 * replay. This drives that in a real browser, because the regression this card
 * was about is a promise (a six room run, relics, upgrades) the page can no
 * longer keep.
 *
 * Run: node tests/backpack-quest-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.BQ_PORT || 8145);
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
  hp: document.getElementById('hp').textContent,
  fight: document.getElementById('floor').textContent,
  packed: document.getElementById('gold').textContent,
  combo: document.getElementById('power').textContent,
  score: document.getElementById('score').textContent,
  best: document.getElementById('best').textContent,
  enemy: document.getElementById('enemyName').textContent,
  intent: document.getElementById('intent').textContent,
  door: (document.getElementById('fightBtn') || {}).textContent,
  roomNodes: document.querySelectorAll('.room-node').length,
  route: !!document.getElementById('route'),
  relics: !!document.getElementById('relics'),
  sell: !!document.getElementById('sellBtn'),
  heroes: document.querySelectorAll('[data-hero]').length,
  filled: document.querySelectorAll('#bag .slot.filled').length,
  goals: document.querySelectorAll('#goals .goal').length,
  goalsDone: document.querySelectorAll('#goals .goal.done').length,
  result: document.getElementById('result').textContent.replace(/\s+/g, ' ').trim(),
  resultShown: /show/.test(document.getElementById('result').className),
  log: document.querySelectorAll('#log p').length,
  comboText: document.getElementById('comboText').textContent
});

// pack whatever the page says will fit, until the door is worth opening
const PACK = () => {
  const fit = document.querySelector('#bag .slot.fit');
  if (!fit) return false;
  fit.click();
  return true;
};

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
      await page.goto(BASE + '/games/backpack-quest.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('[data-hero]', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': three heroes to choose from', start.heroes === 3, String(start.heroes));
      ok(vp.name + ': one fight on the board, not a floor ladder', start.fight === '1/1' && start.roomNodes === 1, start.fight + ' / ' + start.roomNodes + ' nodes');
      ok(vp.name + ': the room chooser, relics and the sell economy are gone', !start.route && !start.relics && !start.sell);
      ok(vp.name + ': the boss is already named', /Golem/.test(start.enemy), start.enemy);
      ok(vp.name + ': the intent is readable before you commit', /damage/.test(start.intent), start.intent);
      ok(vp.name + ': the door is the only action', /door/i.test(start.door), start.door);
      ok(vp.name + ': goals are listed for this run', start.goals === 5, String(start.goals));
      const quality = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
      ok(vp.name + ': the page no longer promises six rooms or relics',
         !/six-room|six room|relic reward/i.test(quality), (quality.match(/six[- ]room[^.]*/i) || [''])[0]);
      ok(vp.name + ': the page states a 3-5 min session', /3-5 min/.test(quality));

      // choose a hero, then pack what fits
      await page.evaluate(() => document.querySelector('[data-hero="knight"]').click());
      const hero = await page.evaluate(SNAP);
      ok(vp.name + ': the chosen hero sets the health budget', /^4\d\/4\d$/.test(hero.hp), hero.hp);
      let packs = 0;
      for (let i = 0; i < 12; i++) {
        const more = await page.evaluate(PACK);
        if (!more) break;
        packs++;
        await new Promise(r => setTimeout(r, 60));
      }
      const packed = await page.evaluate(SNAP);
      ok(vp.name + ': loot actually goes in the pack', packed.filled > 0, packed.filled + ' slots, ' + packs + ' placements');
      ok(vp.name + ': the packed count is shown', /items/.test(packed.packed), packed.packed);
      ok(vp.name + ': the pack stats are explained', /attack/.test(packed.comboText), packed.comboText.slice(0, 60));

      // open the door and fight it out
      let rounds = 0;
      let state = packed;
      while (rounds < 12) {
        await page.evaluate(() => document.getElementById('fightBtn').click());
        await new Promise(r => setTimeout(r, 120));
        state = await page.evaluate(SNAP);
        rounds++;
        if (state.resultShown) break;
      }
      ok(vp.name + ': the fight reaches an ending', state.resultShown, 'after ' + rounds + ' rounds');
      ok(vp.name + ': the fight counter is finished, not on another floor', state.fight === 'Done', state.fight);
      ok(vp.name + ': the ending tells the story, not just a score',
         /Golem|pack/i.test(state.result) && state.result.length > 60, state.result.slice(0, 70));
      ok(vp.name + ': the ending offers a replay', /play again/i.test(state.result), state.result.slice(-24));
      ok(vp.name + ': the run log recorded the fight', state.log >= 3, state.log + ' lines');
      ok(vp.name + ': a final score is banked', Number(state.score) > 0, state.score);

      // replay is a clean single run again
      await page.evaluate(() => { const b = document.querySelector('#result button'); if (b) b.click(); });
      await new Promise(r => setTimeout(r, 300));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': replay resets to an empty pack and a fresh door',
         replay.filled === 0 && !/Done/.test(replay.fight) && /door/i.test(replay.door),
         JSON.stringify({ filled: replay.filled, fight: replay.fight }));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
    await warm.close();

    const html = fs.readFileSync(path.join(ROOT, 'games', 'backpack-quest.html'), 'utf8');
    ok('no room ladder left in the page', !/const enemies|s\.room|s\.gold|s\.relics|function visit|function sell/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nBackpack Quest run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
