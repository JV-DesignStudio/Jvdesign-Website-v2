#!/usr/bin/env node
/*
 * tests/arcade-game-maker-mobile.js
 * Phone-sized proof for the Arcade Game Maker: at 390px there is no horizontal
 * scroll and nothing overflows the viewport, the touch controls appear on a
 * coarse pointer, and they actually drive the game (fire button + drag joystick).
 * Desktop (1440px) must stay clean and hide the touch layer.
 * Run: node tests/arcade-game-maker-mobile.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_MOBILE_PORT || 8991;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

const OVERFLOW_PROBE = () => {
  const de = document.documentElement, vw = window.innerWidth, off = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1.5 && getComputedStyle(el).overflowX !== 'auto') {
      off.push(el.tagName.toLowerCase() + (el.id ? '#'+el.id : (el.className && el.className.toString ? '.'+el.className.toString().split(' ')[0] : '')));
    }
  });
  return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, vw, off: off.slice(0, 8) };
};

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // ── Desktop 1440: clean, touch layer hidden ─────────────────────────────────
  const desk = await browser.newPage();
  await desk.setViewport({ width: 1440, height: 900 });
  await desk.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await desk.waitForSelector('#runGameBtn', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1200));
  const d = await desk.evaluate(OVERFLOW_PROBE);
  check('desktop 1440 has no horizontal scroll', d.scrollWidth <= d.clientWidth, 'scrollWidth ' + d.scrollWidth);
  check('desktop 1440 has nothing overflowing the viewport', d.off.length === 0, d.off.join(', '));
  const dtc = await desk.evaluate(() => { const t = document.querySelector('.touch-controls'); return t ? getComputedStyle(t).display : 'none'; });
  check('desktop hides the touch controls', dtc === 'none', 'display ' + dtc);
  await desk.close();

  // ── Mobile 390: no overflow + working touch controls ────────────────────────
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  // Treat this as a returning learner so the first-run tutorial does not cover the game.
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
  await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1200));

  const m = await page.evaluate(OVERFLOW_PROBE);
  check('mobile 390 has no horizontal scroll', m.scrollWidth <= m.clientWidth, 'scrollWidth ' + m.scrollWidth + ' client ' + m.clientWidth);
  check('mobile 390 has nothing overflowing the viewport', m.off.length === 0, m.off.join(', '));

  const tc = await page.evaluate(() => {
    const t = document.querySelector('.touch-controls');
    const z = document.getElementById('tc-joy-zone');
    return { tc: t ? getComputedStyle(t).display : 'none', zone: z ? getComputedStyle(z).display : 'none' };
  });
  check('mobile shows the touch controls', tc.tc === 'flex', 'display ' + tc.tc);
  check('mobile enables the joystick touch zone', tc.zone !== 'none', 'display ' + tc.zone);

  // Boot a game and make sure overlays are out of the way.
  await page.evaluate(() => {
    document.getElementById('genreMode').value = 'SHOOTER';
    if (typeof onGenreChange === 'function') onGenreChange();
    if (typeof compileAndBootEngine === 'function') compileAndBootEngine();
  });
  await new Promise(r => setTimeout(r, 1400));
  await page.evaluate(() => {
    const ov = document.getElementById('introOverlay');
    if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
    const tut = document.getElementById('tutOverlay');
    if (tut) { tut.classList.remove('show'); tut.style.display = 'none'; }
    const wel = document.getElementById('welcome-overlay');
    if (wel) { wel.classList.remove('show'); wel.style.display = 'none'; }
  });
  await new Promise(r => setTimeout(r, 400));

  // Fire button: pointerdown sets touchInput.fire, pointerup clears it.
  const fire = await page.evaluate(() => {
    const btn = document.getElementById('tc-fire');
    if (!btn) return { error: 'no #tc-fire' };
    const has = typeof touchInput === 'object' && touchInput !== null;
    if (!has) return { error: 'no global touchInput' };
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    const down = touchInput.fire === true;
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    const up = touchInput.fire === true;
    return { down, up };
  });
  check('fire button registers a press', fire.error ? false : fire.down === true, fire.error || '');
  check('fire button releases on pointer up', fire.error ? false : fire.up === false, fire.error || '');

  // Drag joystick: touchStart then touchMove left should steer left.
  const client = await page.target().createCDPSession();
  const zr = await page.evaluate(() => { const r = document.getElementById('tc-joy-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + Math.min(r.height * 0.5, 320) }; });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: zr.x, y: zr.y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: zr.x - 60, y: zr.y, id: 1 }] });
  await new Promise(r => setTimeout(r, 120));
  const joy = await page.evaluate(() => ({
    active: document.getElementById('tc-joystick').classList.contains('joy-active'),
    left: typeof touchInput === 'object' && touchInput.left === true
  }));
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 120));
  const joyEnd = await page.evaluate(() => ({
    active: document.getElementById('tc-joystick').classList.contains('joy-active'),
    left: typeof touchInput === 'object' && touchInput.left === true
  }));
  check('dragging the joystick steers the game', joy.left === true && joy.active === true, JSON.stringify(joy));
  check('releasing the joystick recentres it', joyEnd.left === false && joyEnd.active === false, JSON.stringify(joyEnd));

  check('no uncaught JS errors on mobile', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER MOBILE CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
