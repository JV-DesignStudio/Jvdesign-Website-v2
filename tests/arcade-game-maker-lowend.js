#!/usr/bin/env node
/*
 * tests/arcade-game-maker-lowend.js , A3065
 *
 * Simulates a slow school laptop: phone viewport, 4x CPU throttling. The maker
 * must still reach Run, boot a game, load a preview and advance the loop.
 *
 * Run: node tests/arcade-game-maker-lowend.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_LOWEND_PORT || 8998);
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
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 40000 });
  const ready = Date.now() - t0;
  check('slow device reaches the maker controls', ready < 40000, ready + 'ms');

  await page.evaluate(() => {
    const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
    document.body.classList.remove('overlay-active');
    document.getElementById('genreMode').value = 'SHOOTER';
    if (typeof onGenreChange === 'function') onGenreChange();
    if (typeof compileAndBootEngine === 'function') compileAndBootEngine();
  });
  await page.waitForFunction(() => {
    const io = document.getElementById('introOverlay');
    return !!(io && io.classList.contains('show'));
  }, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => {
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
  });
  const tBoot = Date.now();
  await page.waitForFunction(() => {
    const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
    return !!(sc && sc.sys && sc.sys.isActive() && document.querySelector('#game-container canvas'));
  }, { timeout: 40000 }).catch(() => {});
  const boot = Date.now() - tBoot;
  check('slow device boots a game', boot < 40000, boot + 'ms');

  const frames = await page.evaluate(async () => {
    const g = window._phaserGame;
    const f = g && g.loop ? g.loop.frame : -1;
    await new Promise(r => setTimeout(r, 900));
    return { before: f, after: g && g.loop ? g.loop.frame : -1 };
  });
  check('slow device keeps the game loop moving', frames.after > frames.before, `${frames.before} -> ${frames.after}`);

  const preview = await page.evaluate(async () => {
    const img = document.getElementById('genrePreviewImg');
    if (!img) return { width: 0 };
    for (let i = 0; i < 50 && !img.naturalWidth; i++) await new Promise(r => setTimeout(r, 100));
    return { width: img.naturalWidth };
  });
  check('slow device loads the starter preview', preview.width > 0, 'naturalWidth ' + preview.width);
  check('no page errors on the slow device', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER LOW-END CHECKS PASSED');
})().catch(e => { console.error('low-end test crashed:', e); process.exit(1); });
