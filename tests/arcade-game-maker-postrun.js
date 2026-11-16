#!/usr/bin/env node
/*
 * tests/arcade-game-maker-postrun.js , A3065
 *
 * The game-over screen is where a learner takes ownership. This proves the
 * "Make it yours" strip appears, the three tweaks change the next run, the
 * first_tweak and postrun_tweak events fire, and Keep it starts an export.
 *
 * Run: node tests/arcade-game-maker-postrun.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_POSTRUN_PORT || 8994);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
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
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 20000 });
  await page.evaluate(() => {
    document.getElementById('genreMode').value = 'SHOOTER';
    if (typeof onGenreChange === 'function') onGenreChange();
    if (typeof compileAndBootEngine === 'function') compileAndBootEngine();
  });
  await sleep(900);
  await page.evaluate(() => {
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
    const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
    document.body.classList.remove('overlay-active');
  });
  await page.waitForFunction(() => !!window._phaserGame, { timeout: 20000 }).catch(() => {});
  await sleep(600);

  // Force the normal game-over screen, then inspect the strip.
  await page.evaluate(() => {
    try { showGameOver(123); } catch (e) {}
    const ov = document.getElementById('goOverlay'); if (ov) ov.classList.add('show');
    const gmy = document.getElementById('goMakeYours'); if (gmy) gmy.style.display = '';
  });
  await sleep(300);
  const strip = await page.evaluate(() => {
    const box = document.getElementById('goMakeYours');
    return {
      visible: !!box && getComputedStyle(box).display !== 'none',
      buttons: box ? box.querySelectorAll('.gmy-btn').length : 0,
      labels: box ? Array.from(box.querySelectorAll('.gmy-btn')).map(b => b.textContent.trim()) : []
    };
  });
  check('game over shows the Make it yours strip', strip.visible === true, JSON.stringify(strip));
  check('the strip offers speed, lives, size and keep', strip.buttons === 4, strip.labels.join(' | '));

  const tweaks = await page.evaluate(async () => {
    window.__evts = [];
    const orig = window._trackEvent;
    window._trackEvent = (n, d) => { window.__evts.push(n); };
    try { localStorage.removeItem('jv_arcade_first_tweak'); } catch (e) {}
    const before = { speed: liveConfig.speed, lives: liveConfig.lives, scale: liveConfig.playerScale || 1 };
    const click = sel => { const b = document.querySelector(sel); if (b) b.click(); };
    click('#goMakeYours [data-on-arg="speed"]');
    click('#goMakeYours [data-on-arg="lives"]');
    click('#goMakeYours [data-on-arg="size"]');
    await new Promise(r => setTimeout(r, 250));
    const after = { speed: liveConfig.speed, lives: liveConfig.lives, scale: liveConfig.playerScale || 1 };
    window._trackEvent = orig;
    return { before, after, evts: Array.from(new Set(window.__evts)), hint: (document.getElementById('goMakeYoursHint') || {}).textContent || '' };
  });
  check('Speed raises the next run speed', tweaks.after.speed > tweaks.before.speed, `${tweaks.before.speed} -> ${tweaks.after.speed}`);
  check('Lives adds a life', tweaks.after.lives === tweaks.before.lives + 1, `${tweaks.before.lives} -> ${tweaks.after.lives}`);
  check('Size changes the player scale', tweaks.after.scale !== tweaks.before.scale, `${tweaks.before.scale} -> ${tweaks.after.scale}`);
  check('tweaks fire postrun_tweak and first_tweak', tweaks.evts.includes('postrun_tweak') && tweaks.evts.includes('first_tweak'), tweaks.evts.join(','));
  check('the strip confirms what changed', /Play Again/.test(tweaks.hint), tweaks.hint);

  const keep = await page.evaluate(async () => {
    window.__exported = 0; window.__evts = [];
    const origExport = window.exportGame;
    const origTrack = window._trackEvent;
    window.exportGame = () => { window.__exported++; };
    window._trackEvent = (n) => { window.__evts.push(n); };
    const b = document.querySelector('#goMakeYours [data-on="_postRunKeep"]');
    if (b) b.click();
    await new Promise(r => setTimeout(r, 150));
    window.exportGame = origExport;
    window._trackEvent = origTrack;
    return { exported: window.__exported, evts: window.__evts };
  });
  check('Keep it starts an export', keep.exported >= 1, JSON.stringify(keep));
  check('Keep it fires the export event', keep.evts.includes('export'), keep.evts.join(','));

  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  // Mobile: the strip must wrap inside the dialog.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const ov = document.getElementById('goOverlay'); if (ov) ov.classList.add('show');
    const gmy = document.getElementById('goMakeYours'); if (gmy) gmy.style.display = '';
  });
  await sleep(300);
  const mobile = await page.evaluate(() => {
    const box = document.getElementById('goMakeYours');
    const de = document.documentElement;
    const r = box ? box.getBoundingClientRect() : null;
    return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, width: r ? Math.round(r.width) : 0, buttons: box ? box.querySelectorAll('.gmy-btn').length : 0 };
  });
  check('mobile strip stays inside the screen', mobile.scrollWidth <= mobile.clientWidth + 1 && mobile.width > 0 && mobile.buttons === 4, JSON.stringify(mobile));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER POST-RUN CHECKS PASSED');
})().catch(e => { console.error('post-run test crashed:', e); process.exit(1); });
