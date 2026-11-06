#!/usr/bin/env node
/* A2590: hash size watchdog. Small payloads show length, near-limit warms up,
 * over-limit offers a JSON fallback, and existing hash shares still round-trip. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webmanifest': 'application/manifest+json' };
const WIDTHS = [390, 1440];
const LIMIT = 2000;

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
  pass('watchdog script exists', fs.existsSync(path.join(ROOT, 'assets', 'js', 'hash-size-watchdog.js')));
  const pages = ['pages/dev-tools.html', 'tools/gdd-builder.html', 'tools/pixel-studio.html', 'tools/sound-studio.html', 'tools/story-player.html'];
  for (const p of pages) pass(p + ' loads the watchdog', /hash-size-watchdog\.js/.test(fs.readFileSync(path.join(ROOT, p), 'utf8')));

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
    await page.waitForFunction('window.HashWatchdog', { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 120));
  }
  async function setHash(h) {
    await page.evaluate((hash) => { location.hash = hash; try { window.HashWatchdog.check(); } catch (e) {} }, h);
    await new Promise(r => setTimeout(r, 150));
  }
  function chip() {
    return page.evaluate(() => {
      const el = document.getElementById('hash-watchdog');
      if (!el) return { exists: false };
      const cs = getComputedStyle(el);
      return {
        exists: true,
        open: el.classList.contains('is-open') && cs.display !== 'none',
        near: el.classList.contains('is-near'),
        over: el.classList.contains('is-over'),
        text: (el.querySelector('.hash-watchdog-value') || {}).textContent || '',
        fallback: cs.display !== 'none' && !!el.querySelector('.hash-watchdog-fallback') && getComputedStyle(el.querySelector('.hash-watchdog-fallback')).display !== 'none',
        position: cs.position,
        width: el.getBoundingClientRect().width,
        hash: location.hash,
        downloaded: (window.__hashWatchdog || {}).downloaded || null
      };
    });
  }

  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: true });
      await open(`http://127.0.0.1:${PORT}/pages/dev-tools.html`);
      await setHash('');
      let s = await chip();
      pass(`no hash hides the indicator @${width}`, !s.open);

      // Small payload.
      await setHash('#payload=hello');
      s = await chip();
      pass(`small hash shows length @${width}`, s.open && /Link 13 \/ 2,000 chars/.test(s.text), s.text);
      pass(`small hash does not warn @${width}`, !s.near && !s.over);

      // Near limit (80%).
      await setHash('#payload=' + 'a'.repeat(1700));
      s = await chip();
      pass(`near-limit hash marks near @${width}`, s.open && s.near && !s.over, s.text);

      // Over limit.
      await setHash('#payload=' + 'a'.repeat(2100));
      s = await chip();
      pass(`over-limit hash warns @${width}`, s.open && s.over && /too long/.test(s.text), s.text);
      pass(`over-limit offers JSON fallback @${width}`, s.fallback);

      // Download the fallback.
      await page.click('.hash-watchdog-fallback');
      await new Promise(r => setTimeout(r, 150));
      s = await chip();
      pass(`fallback records a JSON download @${width}`, !!s.downloaded && s.downloaded.length >= LIMIT, s.downloaded ? String(s.downloaded.length) : 'none');

      // Existing hash round-trips through a reload.
      const before = s.hash;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction('window.HashWatchdog', { timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 200));
      const after = await chip();
      pass(`hash survives a refresh @${width}`, after.hash === before && after.open && after.over);

      // Stays out of the way.
      pass(`indicator is fixed and small @${width}`, after.position === 'fixed' && after.width <= width - 20, Math.round(after.width) + 'px');

      // A sharing tool also shows it.
      await open(`http://127.0.0.1:${PORT}/tools/gdd-builder.html`);
      await setHash('#payload=' + 'a'.repeat(2100));
      const tool = await chip();
      pass(`sharing tool shows the watchdog @${width}`, tool.open && tool.over && tool.fallback);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.log('\n' + failures.length + ' failure(s)');
    process.exit(1);
  }
  console.log('\nPASS create-hub-hash-watchdog: small, near-limit, over-limit and fallback at 390 and 1440');
})();
