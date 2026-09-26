#!/usr/bin/env node
/*
 * tests/candy-kingdom-smoke.js , A590
 *
 * Candy Kingdom is one complete first adventure now: read the GM scene, pick
 * the hero whose stat fits the clue, roll the d6, get a visible ending and a
 * Play Again path. This drives all of that in a real browser from a cleared
 * profile, because the failure mode this card had was a promise ("15-30 min")
 * that the page could not keep.
 *
 * Run: node tests/candy-kingdom-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.CK_PORT || 8141);
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.pdf': 'application/pdf' };

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

// the hero whose stat matches the clue, and one that does not
const RIGHT = 'choc';   // Fizzyness
const WRONG = 'gummy';  // Chewiness

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    // one clean origin, kept open so every viewport can start from a real
    // first visit: the game reads its save while the page loads
    const warm = await browser.newPage();
    await warm.goto(BASE + '/index.html', { waitUntil: 'load' });

    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      // clear before every viewport, or the second run resumes the first run's save
      await warm.evaluate(() => localStorage.clear());
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/candy_kingdom.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#choices .choice', { timeout: 15000 });

      const fresh = await page.evaluate(() => ({
        chapter: document.getElementById('chapter').textContent,
        roll: document.getElementById('hearts').textContent,
        rollLabel: document.querySelector('#hearts').closest('.stat').querySelector('span').textContent,
        rollDisabled: document.getElementById('rollBtn').disabled,
        choices: document.querySelectorAll('#choices .choice').length,
        party: document.querySelectorAll('#party .hero-card').length,
        goals: document.querySelectorAll('#goals .goal').length,
        resultShown: /show/.test(document.getElementById('result').className),
        scenes: (document.body.textContent.match(/\bScene \d|\d\/5\b/g) || []).length,
        scrolls: document.documentElement.scrollWidth > window.innerWidth + 1
      }));
      ok(vp.name + ': one adventure, not a scene count', fresh.chapter === '1/1' && fresh.scenes === 0, fresh.chapter);
      ok(vp.name + ': no result screen before playing', !fresh.resultShown);
      ok(vp.name + ': roll button starts disabled', fresh.rollDisabled);
      ok(vp.name + ': 3 heroes and a 3 hero party sheet', fresh.choices === 3 && fresh.party === 3, fresh.choices + '/' + fresh.party);
      ok(vp.name + ': 3 short goals', fresh.goals === 3, String(fresh.goals));
      ok(vp.name + ': roll readout starts empty and is labelled', fresh.roll === '?' && /roll/i.test(fresh.rollLabel), fresh.roll + ' / ' + fresh.rollLabel);
      ok(vp.name + ': no sideways scrolling', !fresh.scrolls);

      // a hero that does not fit the clue still gets a roll, just without +1
      await page.evaluate(sel => document.querySelector(sel).click(), `#choices .choice[data-id="${WRONG}"]`);
      const wrongPick = await page.evaluate(() => ({
        odds: document.getElementById('odds').textContent,
        enabled: !document.getElementById('rollBtn').disabled,
        label: document.getElementById('rollBtn').textContent
      }));
      ok(vp.name + ': a mismatched hero still unlocks the roll', wrongPick.enabled);
      ok(vp.name + ': mismatched hero is told the odds are lower', wrongPick.odds === '50%', wrongPick.odds);

      // the right hero earns the +1 and the higher chance
      await page.evaluate(sel => document.querySelector(sel).click(), `#choices .choice[data-id="${RIGHT}"]`);
      const rightPick = await page.evaluate(() => ({
        odds: document.getElementById('odds').textContent,
        lesson: document.getElementById('lesson').textContent
      }));
      ok(vp.name + ': matching the clue raises the chance and explains why',
         rightPick.odds === '75%' && /\+1/.test(rightPick.lesson), rightPick.odds);

      // roll it and read the ending
      await page.evaluate(sel => document.querySelector(sel).click(), '#rollBtn');
      await page.waitForFunction(() => /show/.test(document.getElementById('result').className), { timeout: 10000 });
      const played = await page.evaluate(() => ({
        result: document.getElementById('result').textContent.replace(/\s+/g, ' ').trim(),
        score: document.getElementById('score').textContent,
        stars: document.getElementById('stars').textContent,
        roll: document.getElementById('hearts').textContent,
        die: document.getElementById('die').textContent,
        button: document.getElementById('rollBtn').textContent,
        disabled: document.getElementById('rollBtn').disabled,
        goalsDone: document.querySelectorAll('#goals .goal.done').length,
        logLines: document.querySelectorAll('#log p').length,
        ending: document.querySelector('#result').innerHTML.includes('cross') || document.querySelector('#result').innerHTML.includes('caramel')
      }));
      ok(vp.name + ': a score and stars are shown', Number(played.score) > 0 && /★/.test(played.stars), played.score + ' ' + played.stars);
      ok(vp.name + ': the roll is reported back', /^\d\+?1?$|^\d/.test(played.roll) && played.roll !== '?', played.roll + ' (die ' + played.die + ')');
      ok(vp.name + ': the story ending is visible, not just a number', played.ending, played.result.slice(0, 70));
      ok(vp.name + ': the finishing goal is ticked', played.goalsDone >= 1, played.goalsDone + ' done');
      ok(vp.name + ': the roll button becomes a finished state', played.disabled && /finished/i.test(played.button), played.button);
      ok(vp.name + ': the GM log records the story', played.logLines >= 2, played.logLines + ' lines');

      // replay: the whole thing resets and can be finished again
      await page.evaluate(sel => document.querySelector(sel).click(), '#result button.secondary');
      const replay = await page.evaluate(() => ({
        chapter: document.getElementById('chapter').textContent,
        score: document.getElementById('score').textContent,
        stars: document.getElementById('stars').textContent,
        roll: document.getElementById('hearts').textContent,
        shown: /show/.test(document.getElementById('result').className),
        enabled: !document.getElementById('rollBtn').disabled,
        goalsDone: document.querySelectorAll('#goals .goal.done').length
      }));
      ok(vp.name + ': Play Again resets the run', replay.score === '0' && replay.stars === '☆☆☆' && replay.roll === '?' && !replay.shown && replay.goalsDone === 0,
         JSON.stringify(replay));
      await page.evaluate(sel => document.querySelector(sel).click(), `#choices .choice[data-id="${RIGHT}"]`);
      await page.evaluate(sel => document.querySelector(sel).click(), '#rollBtn');
      const second = await page.evaluate(() => ({
        shown: /show/.test(document.getElementById('result').className),
        best: document.getElementById('best').textContent
      }));
      ok(vp.name + ': a second run finishes too', second.shown);
      ok(vp.name + ': best score survives the replay', Number(second.best) > 0, second.best);

      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    await warm.close();

    // the page must not still advertise a five scene session
    const html = fs.readFileSync(path.join(ROOT, 'games', 'candy_kingdom.html'), 'utf8');
    ok('page has no five scene promise left', !/\b5 scenes\b|\/5\b|Scene \d of 5/.test(html));
    ok('page says the adventure is short', /few minutes|under five minutes/i.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nCandy Kingdom adventure: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
