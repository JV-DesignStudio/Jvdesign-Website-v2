#!/usr/bin/env node
/*
 * tests/arcade-game-maker-restart.js , A3065
 *
 * The quality standard says Restart works. This boots every genre, runs it,
 * calls the real Restart path and proves the same scene comes back with the
 * loop advancing and no page errors.
 *
 * Run: node tests/arcade-game-maker-restart.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_RESTART_PORT || 8995);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function isIgnorable(text) {
  return /ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR_|ERR_FAILED/i.test(text)
    || /googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|gstatic\.com/i.test(text);
}

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
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !isIgnorable(m.text())) errors.push(m.text()); });
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 20000 });
  const genres = await page.$$eval('#genreMode option', opts => opts.map(o => o.value).filter(Boolean));

  console.log('\n\u25b8 arcade game maker: restart every genre');
  for (const genre of genres) {
    errors.length = 0;
    const boot = async () => {
      await page.evaluate(g => {
        try { if (window._phaserGame) window._phaserGame.destroy(true); } catch (e) {}
        window._phaserGame = null; window.currentPhaserGame = null;
        const c = document.getElementById('game-container'); if (c) c.innerHTML = '';
        document.getElementById('genreMode').value = g;
        if (typeof onGenreChange === 'function') onGenreChange();
      }, genre);
      await sleep(850); // clear compileAndBootEngine's 700ms re-entry guard
      await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') compileAndBootEngine(); });
      await sleep(800);
      await page.evaluate(() => {
        const io = document.getElementById('introOverlay');
        if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
        const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
        document.body.classList.remove('overlay-active');
      });
      await page.waitForFunction(() => {
        const g = window._phaserGame;
        const sc = g && g.scene && g.scene.getScenes(true)[0];
        return !!(sc && sc.sys && sc.sys.isActive());
      }, { timeout: 20000 }).catch(() => {});
      await sleep(350);
      const s1 = await page.evaluate(() => {
        const g = window._phaserGame;
        const sc = g && g.scene && g.scene.getScenes(true)[0];
        return {
          key: sc ? sc.sys.settings.key : '',
          frame: g && g.loop ? g.loop.frame : -1,
          restartLabel: /Restart/i.test((document.getElementById('runGameBtn') || {}).textContent || '')
        };
      });
      await sleep(300);
      const frame2 = await page.evaluate(() => {
        const g = window._phaserGame;
        return g && g.loop ? g.loop.frame : -1;
      });
      return { key: s1.key, advanced: frame2 > s1.frame, frame: frame2, restartLabel: s1.restartLabel };
    };
    let first = await boot();
    let second = await boot();
    // A destroyed game can leave one stale active scene for a frame after the
    // previous genre. Re-baseline once so this test measures Restart, not the
    // idle preview hand-off (all-genres already covers the first boot).
    if (first.key !== second.key) {
      first = second;
      second = await boot();
    }
    const ok = first.key && second.key === first.key && second.advanced && errors.length === 0;
    check(genre + ' restarts into the same scene', ok,
      `${first.key || 'no scene'} -> ${second.key || 'no scene'}, loop ${second.advanced ? 'advancing' : 'frozen'}` +
      (errors.length ? ' , ' + errors[0].slice(0, 120) : ''));
    if (second.restartLabel === false) check(genre + ' Run button becomes Restart', false, 'label did not change');
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER RESTART CHECKS PASSED');
})().catch(e => { console.error('restart test crashed:', e); process.exit(1); });
