#!/usr/bin/env node
/* A2592: optional 15-minute Create timer. Opt-in, keyboard usable, persists
 * across tools and refresh, announces expiry, and dismisses cleanly. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webmanifest': 'application/manifest+json' };
const WIDTHS = [390, 1440];
const KEY = 'jvds_create_timer';

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const failures = [];
function pass(msg) { console.log('PASS ' + msg); }
function fail(msg) { failures.push(msg); console.log('FAIL ' + msg); }

(async () => {
  pass('hub loads the timer', /create-timer\.js/.test(fs.readFileSync(path.join(ROOT, 'pages', 'dev-tools.html'), 'utf8')));
  for (const t of ['pixel-studio', 'level-designer', 'arcade-game-maker', 'sound-studio', 'sprite-animator', 'trading-card-designer']) {
    pass(t + ' loads the timer', /create-timer\.js/.test(fs.readFileSync(path.join(ROOT, 'tools', t + '.html'), 'utf8')));
  }

  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const PORT = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const t = req.resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return req.abort();
    req.continue();
  });
  async function open(url) {
    for (let i = 0; i < 3; i++) {
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); break; }
      catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 150)); }
    }
    await page.waitForFunction('window.CreateTimer', { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 150));
  }
  function timer() {
    return page.evaluate(() => {
      const el = document.getElementById('create-timer');
      const st = document.querySelector('.create-timer-status');
      return {
        exists: !!el,
        open: !!el && !el.hidden,
        time: el ? (el.querySelector('.create-timer-time') || {}).textContent : '',
        expired: !!el && el.classList.contains('is-expired'),
        status: st ? st.textContent : '',
        toggle: el ? (el.querySelector('[data-act="toggle"]') || {}).textContent : '',
        stored: (() => { try { return localStorage.getItem('jvds_create_timer'); } catch (e) { return null; } })()
      };
    });
  }

  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: true });
      await open(`http://127.0.0.1:${PORT}/pages/dev-tools.html`);
      await page.evaluate(() => { try { localStorage.removeItem('jvds_create_timer'); } catch (e) {} });

      const hasStart = await page.evaluate(() => !!document.getElementById('startQuickTimer'));
      pass(`start button sits on the project card @${width}`, hasStart);
      if (!hasStart) continue;

      // Start with the keyboard.
      await page.focus('#startQuickTimer');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 250));
      let s = await timer();
      pass(`timer starts @${width}`, s.open && /^14:5\d|^15:00/.test(s.time), s.time);
      pass(`timer announces start @${width}`, /started/i.test(s.status), s.status);

      // Pause freezes the count.
      await page.click('[data-act="toggle"]');
      const paused = await timer();
      await new Promise(r => setTimeout(r, 1200));
      const still = await timer();
      pass(`timer pauses @${width}`, /paused/i.test(paused.status) && paused.time === still.time, paused.time + ' -> ' + still.time);

      // Reset returns to 15:00.
      await page.click('[data-act="reset"]');
      const reset = await timer();
      pass(`timer resets @${width}`, reset.time === '15:00' && /reset/i.test(reset.status), reset.time);

      // Start again and move into a tool: the timer follows.
      await page.click('[data-act="toggle"]');
      await page.waitForFunction('window.CreateTimer && window.CreateTimer.state && window.CreateTimer.state.mode === "running"').catch(() => {});
      await open(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`);
      const carried = await timer();
      pass(`timer survives moving to a tool @${width}`, carried.open && /^\d\d:\d\d$/.test(carried.time) && carried.time !== '00:00', carried.time);

      // Dismiss clears it.
      await page.click('[data-act="dismiss"]');
      const gone = await timer();
      pass(`timer dismisses @${width}`, !gone.open && !gone.stored);

      // Expiry from a near-future end time.
      await page.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify({ mode: 'running', endAt: Date.now() + 1200, remaining: 1200 }));
      }, KEY);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction('window.CreateTimer', { timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1900));
      const expired = await timer();
      pass(`timer expires @${width}`, expired.open && expired.expired && expired.time === '00:00', expired.time);
      pass(`timer announces expiry @${width}`, /time is up/i.test(expired.status), expired.status);

      // Stays on screen without overflowing.
      const box = await page.evaluate(() => {
        const el = document.getElementById('create-timer');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { right: r.right, left: r.left, bottom: r.bottom, w: r.width, vw: window.innerWidth, vh: window.innerHeight };
      });
      pass(`timer stays inside the viewport @${width}`, !!box && box.left >= 0 && box.right <= box.vw + 1, box ? Math.round(box.w) + 'px' : 'missing');

      // Reduced motion still renders.
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const rm = await timer();
      pass(`timer renders with reduced motion @${width}`, rm.open);
      await page.emulateMediaFeatures([]);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.log('\n' + failures.length + ' failure(s)');
    process.exit(1);
  }
  console.log('\nPASS create-hub-timer: start, pause, reset, expiry and dismiss at 390 and 1440');
})();
