#!/usr/bin/env node
/*
 * tests/arcade-game-maker-dead-end.js , A2700
 * The pre-run check must spot a wall the jump cannot clear, a gap wider than a
 * jump and a goal far above every platform, warn in Ember's voice, offer Play
 * anyway, and let the learner turn the hint off. Valid levels must not warn.
 * Run: node tests/arcade-game-maker-dead-end.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_DEADEND_PORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  await page.setViewport({ width:1280, height:900 });

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window._deadEndCheck === 'function' && typeof window._showDeadEndHint === 'function', { timeout:15000 });

    const unit = await page.evaluate(() => {
      const flat = Array(20 * 15).fill(0);
      for (let c = 0; c < 20; c++) flat[14 * 20 + c] = 1;
      const wall = flat.slice();
      for (let r = 4; r <= 14; r++) wall[r * 20 + 8] = 1;
      const gap = flat.slice();
      for (let c = 4; c <= 17; c++) gap[14 * 20 + c] = 0;
      const high = flat.slice();
      const base = { genre:'PLATFORMER', jump:450, gravity:600, speed:200 };
      return {
        valid: _deadEndCheck({ ...base, map:flat, entities:{ spawn:[2,13], goal:[10,13], coins:[], enemies:[] } }),
        wall: _deadEndCheck({ ...base, map:wall, entities:{ spawn:[2,13], goal:[12,13], coins:[], enemies:[] } }),
        gap: _deadEndCheck({ ...base, map:gap, entities:{ spawn:[2,13], goal:[16,13], coins:[], enemies:[] } }),
        high: _deadEndCheck({ ...base, map:high, entities:{ spawn:[2,13], goal:[10,2], coins:[], enemies:[] } }),
        other: _deadEndCheck({ genre:'SHOOTER', map:flat, entities:{ spawn:[2,13], goal:[10,13] } })
      };
    });
    check('valid level has no warning', unit.valid.length === 0, JSON.stringify(unit.valid));
    check('tall wall is flagged', unit.wall.some(t => /wall/i.test(t)), JSON.stringify(unit.wall));
    check('wide gap is flagged', unit.gap.some(t => /gap/i.test(t)), JSON.stringify(unit.gap));
    check('unreachable goal is flagged', unit.high.some(t => /goal/i.test(t)), JSON.stringify(unit.high));
    check('other genres are not checked', unit.other.length === 0, JSON.stringify(unit.other));

    // UI: build the wall level and open the run screen.
    await page.evaluate(() => {
      try { localStorage.removeItem('jv_arcade_deadend_off'); } catch (e) {}
      const wall = Array(20 * 15).fill(0);
      for (let c = 0; c < 20; c++) wall[14 * 20 + c] = 1;
      for (let r = 4; r <= 14; r++) wall[r * 20 + 8] = 1;
      customLevelMap = wall;
      customLevelEntities = { spawn:[2,13], goal:[12,13], coins:[], enemies:[] };
      try { document.getElementById('levelDesignerGrid').value = ''; } catch (e) {}
      document.getElementById('genreMode').value = 'PLATFORMER';
      if (typeof onGenreChange === 'function') onGenreChange();
      compileAndBootEngine._lastRun = 0;
      compileAndBootEngine();
    });
    await page.waitForFunction(() => !!document.getElementById('deadEndHint'), { timeout:10000 });
    const ui = await page.evaluate(() => {
      const hint = document.getElementById('deadEndHint');
      return {
        text: hint ? hint.textContent : '',
        play: !!(hint && hint.querySelector('[data-on="_deadEndPlayAnyway"]')),
        off: !!(hint && document.getElementById('deadEndOff'))
      };
    });
    check('warning shows in Ember voice', /Ember/i.test(ui.text) && /wall/i.test(ui.text), ui.text.slice(0, 100));
    check('warning offers Play anyway', ui.play === true);
    check('warning offers a turn-off checkbox', ui.off === true);

    const disable = await page.evaluate(() => {
      document.getElementById('deadEndOff').click();
      return { flag: localStorage.getItem('jv_arcade_deadend_off'), hint: !!document.getElementById('deadEndHint') };
    });
    check('turn-off checkbox persists and hides the hint', disable.flag === '1' && disable.hint === false, JSON.stringify(disable));

    const suppressed = await page.evaluate(() => {
      _showDeadEndHint({ genre:'PLATFORMER', map:customLevelMap, entities:customLevelEntities, jump:450, gravity:600, speed:200 });
      return !!document.getElementById('deadEndHint');
    });
    check('hint stays off after the checkbox', suppressed === false);

    const playAnyway = await page.evaluate(() => {
      try { localStorage.removeItem('jv_arcade_deadend_off'); } catch (e) {}
      _showDeadEndHint({ genre:'PLATFORMER', map:customLevelMap, entities:customLevelEntities, jump:450, gravity:600, speed:200 });
      const btn = document.querySelector('#deadEndHint [data-on="_deadEndPlayAnyway"]');
      if (btn) btn.click();
      return {
        hint: !!document.getElementById('deadEndHint'),
        intro: document.getElementById('introOverlay').classList.contains('show')
      };
    });
    check('Play anyway removes the warning and starts the game', playAnyway.hint === false && playAnyway.intro === false, JSON.stringify(playAnyway));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker dead end: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
