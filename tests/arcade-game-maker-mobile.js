#!/usr/bin/env node
/*
 * tests/arcade-game-maker-mobile.js
 * Phone-sized proof for the Arcade Game Maker: at 390px there is no horizontal
 * scroll and nothing overflows the viewport, the touch controls appear on a
 * coarse pointer, and they actually drive the game (fire button + drag joystick).
 * Desktop (1440px) must stay clean and hide the touch layer.
 * Run: node tests/arcade-game-maker-mobile.js
 *
 * A1615: hardened against parallel-load flakiness - the browser launch retries,
 * the server uses an ephemeral port (no collisions), and init waits on
 * conditions with waitForFunction instead of fixed sleeps.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const FIXED_PORT = process.env.AGM_MOBILE_PORT ? Number(process.env.AGM_MOBILE_PORT) : 0;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

async function launchBrowser(attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

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

// Wait until no element pokes past the right edge, so transient slide-in chips
// have settled before we measure. Replaces a fixed sleep with a real condition.
async function waitStable(page) {
  await page.waitForFunction(() => {
    const vw = window.innerWidth; let n = 0;
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1.5 && getComputedStyle(el).overflowX !== 'auto') n++;
    });
    return n === 0;
  }, { timeout: 15000 }).catch(() => {});
}

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(FIXED_PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await launchBrowser();
  try {
    // ── Desktop 1440: clean, touch layer hidden ───────────────────────────────
    const desk = await browser.newPage();
    await desk.setViewport({ width: 1440, height: 900 });
    await desk.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await desk.waitForSelector('#runGameBtn', { timeout: 30000 });
    await desk.waitForFunction(() => document.readyState === 'complete' && typeof window.compileAndBootEngine === 'function', { timeout: 30000 });
    await desk.waitForFunction(() => {
      const t = document.querySelector('.touch-controls');
      return !!t && getComputedStyle(t).display === 'none';
    }, { timeout: 20000 });
    await waitStable(desk);
    const d = await desk.evaluate(OVERFLOW_PROBE);
    check('desktop 1440 has no horizontal scroll', d.scrollWidth <= d.clientWidth, 'scrollWidth ' + d.scrollWidth);
    check('desktop 1440 has nothing overflowing the viewport', d.off.length === 0, d.off.join(', '));
    const dtc = await desk.evaluate(() => { const t = document.querySelector('.touch-controls'); return t ? getComputedStyle(t).display : 'none'; });
    check('desktop hides the touch controls', dtc === 'none', 'display ' + dtc);
    await desk.close();

    // ── Mobile 390: no overflow + working touch controls ──────────────────────
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    // Treat this as a returning learner so the first-run tutorial does not cover the game.
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#runGameBtn', { timeout: 30000 });
    // Touch controls are shown by JS once the viewport is detected as coarse.
    await page.waitForFunction(() => {
      const t = document.querySelector('.touch-controls');
      return !!t && getComputedStyle(t).display === 'flex';
    }, { timeout: 25000 });

    await waitStable(page);
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
    await page.waitForFunction(() => !!window._phaserGame, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => {
      const ov = document.getElementById('introOverlay');
      if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
      const tut = document.getElementById('tutOverlay');
      if (tut) { tut.classList.remove('show'); tut.style.display = 'none'; }
      const wel = document.getElementById('welcome-overlay');
      if (wel) { wel.classList.remove('show'); wel.style.display = 'none'; }
    });
    await page.waitForFunction(() => {
      const ov = document.getElementById('introOverlay');
      return !ov || !ov.classList.contains('show');
    }, { timeout: 10000 }).catch(() => {});

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
    await page.waitForFunction(() => {
      const z = document.getElementById('tc-joy-zone');
      return !!z && z.getBoundingClientRect().width > 0;
    }, { timeout: 10000 });
    const zr = await page.evaluate(() => { const r = document.getElementById('tc-joy-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + Math.min(r.height * 0.5, 320) }; });
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: zr.x, y: zr.y, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: zr.x - 60, y: zr.y, id: 1 }] });
    await page.waitForFunction(() => {
      const j = document.getElementById('tc-joystick');
      return !!j && j.classList.contains('joy-active') && typeof touchInput === 'object' && touchInput.left === true;
    }, { timeout: 8000 }).catch(() => {});
    const joy = await page.evaluate(() => ({
      active: document.getElementById('tc-joystick').classList.contains('joy-active'),
      left: typeof touchInput === 'object' && touchInput.left === true
    }));
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => {
      const j = document.getElementById('tc-joystick');
      return !!j && !j.classList.contains('joy-active');
    }, { timeout: 8000 }).catch(() => {});
    const joyEnd = await page.evaluate(() => ({
      active: document.getElementById('tc-joystick').classList.contains('joy-active'),
      left: typeof touchInput === 'object' && touchInput.left === true
    }));
    check('dragging the joystick steers the game', joy.left === true && joy.active === true, JSON.stringify(joy));
    check('releasing the joystick recentres it', joyEnd.left === false && joyEnd.active === false, JSON.stringify(joyEnd));

    check('no uncaught JS errors on mobile', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER MOBILE CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
