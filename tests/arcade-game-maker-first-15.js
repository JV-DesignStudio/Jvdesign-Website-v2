#!/usr/bin/env node
/*
 * tests/arcade-game-maker-first-15.js , A3065
 *
 * Walks the first-session path a new learner actually takes, at phone and
 * desktop width, and prints the timings: welcome -> pick a starter -> play ->
 * change one thing -> play again -> keep. Fails if a step cannot be reached or
 * takes unreasonably long.
 *
 * Run: node tests/arcade-game-maker-first-15.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_FIRST15_PORT || 8996);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  for (const [w, h, label] of [[390, 844, 'phone'], [1440, 900, 'desktop']]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1 });
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });

    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 25000 });
    const tReady = Date.now() - t0;

    await page.waitForFunction(() => {
      const w = document.getElementById('welcome-overlay');
      return !!(w && w.classList.contains('show'));
    }, { timeout: 15000 }).catch(() => {});
    const tWelcome = Date.now() - t0;

    // Pick Run and jump -> Just right -> Build and play.
    const picked = await page.evaluate(() => {
      const idea = document.querySelector('.fg-choice[data-fg-genre="RUNNER"]');
      if (idea) idea.click();
      const level = document.querySelector('.fg-level[data-on-arg="normal"]');
      if (level) level.click();
      const build = document.querySelector('.fg-build');
      if (build) build.click();
      return { idea: !!idea, build: !!build, genre: (document.getElementById('genreMode') || {}).value || '' };
    });
    await page.waitForFunction(() => {
      const io = document.getElementById('introOverlay');
      return !!(io && io.classList.contains('show'));
    }, { timeout: 15000 }).catch(() => {});
    const tIntro = Date.now() - t0;
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
    });
    await page.waitForFunction(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 }).catch(() => {});
    const tPlay = Date.now() - t0;
    await sleep(800);

    // Finish the run and take one ownership step.
    await page.evaluate(() => { try { showGameOver(42); } catch (e) {} const ov = document.getElementById('goOverlay'); if (ov) ov.classList.add('show'); });
    await sleep(250);
    const tweak = await page.evaluate(() => {
      const before = liveConfig.speed;
      const b = document.querySelector('#goMakeYours [data-on-arg="speed"]');
      if (b) b.click();
      return { visible: !!document.getElementById('goMakeYours') && getComputedStyle(document.getElementById('goMakeYours')).display !== 'none', before, after: liveConfig.speed };
    });
    const tTweak = Date.now() - t0;

    await page.evaluate(() => { const b = document.querySelector('#goOverlay [data-on="closeGameOver"]'); if (b) b.click(); });
    await sleep(900);
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
    });
    await page.waitForFunction(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 }).catch(() => {});
    const tAgain = Date.now() - t0;

    const report = { label, width: w, tReady, tWelcome, tIntro, tPlay, tTweak, tAgain, picked, tweak, errors };
    console.log(`\n▸ ${label} (${w}px): ${JSON.stringify(report)}`);
    check(label + ': welcome appears', tWelcome < 12000, tWelcome + 'ms');
    check(label + ': starter picked and built', picked.idea && /RUNNER/.test(picked.genre), picked.genre || 'no genre');
    check(label + ': playable inside 20s', tPlay < 20000, tPlay + 'ms');
    check(label + ': one tweak is offered and works', tweak.visible === true && tweak.after > tweak.before, `${tweak.before} -> ${tweak.after}`);
    check(label + ': play again is runnable', tAgain < 30000, tAgain + 'ms');
    check(label + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER FIRST-15 CHECKS PASSED');
})().catch(e => { console.error('first-15 test crashed:', e); process.exit(1); });
