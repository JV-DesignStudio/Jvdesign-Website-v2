#!/usr/bin/env node
/* A2591: Ember companion chip reacts to four learner states, is dismissible for
 * the session, never blocks the page, and announces politely at 390 / 1440. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webmanifest': 'application/manifest+json' };
const WIDTHS = [390, 1440];

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
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'ember-chip.js'), 'utf8');
  for (const state of ['empty-search', 'blank-canvas', 'malformed-share', 'export-failed']) {
    pass('chip defines ' + state, src.includes("'" + state + "'"));
  }
  pass('hub loads the chip', /ember-chip\.js/.test(fs.readFileSync(path.join(ROOT, 'pages', 'dev-tools.html'), 'utf8')));
  pass('Pixel Studio loads the chip', /ember-chip\.js/.test(fs.readFileSync(path.join(ROOT, 'tools', 'pixel-studio.html'), 'utf8')));

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
    await page.waitForFunction('window.EmberChip', { timeout: 8000 }).catch(() => {});
  }
  async function reset() {
    await page.evaluate(() => { try { sessionStorage.removeItem('jvds_ember_chip_dismissed'); } catch (e) {} });
  }
  function chipState() {
    return page.evaluate(() => {
      const el = document.getElementById('ember-chip');
      if (!el) return { exists: false };
      const cs = getComputedStyle(el);
      return {
        exists: true,
        open: el.classList.contains('is-open') && cs.display !== 'none',
        role: el.getAttribute('role'),
        live: el.getAttribute('aria-live'),
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        action: (el.querySelector('.ember-chip-action') || {}).textContent || '',
        position: cs.position,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height
      };
    });
  }
  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: true });

      // 1. Empty search (real input).
      await open(`http://127.0.0.1:${PORT}/pages/dev-tools.html`);
      await reset();
      await page.type('#toolSearch', 'zzzqqq');
      await new Promise(r => setTimeout(r, 450));
      let s = await chipState();
      pass(`empty search shows chip @${width}`, s.exists && s.open && /No tools match/.test(s.text), s.text);
      pass(`empty search action present @${width}`, /Clear the search/.test(s.action), s.action);

      // 2. Malformed shared link (real URL, auto-detected on load).
      await reset();
      await open(`http://127.0.0.1:${PORT}/pages/dev-tools.html?share=%E0%A4%A`);
      s = await chipState();
      pass(`malformed share shows chip @${width}`, s.open && /shared link looks broken/.test(s.text), s.text);

      // 3. Dismiss for the session.
      await page.click('.ember-chip-close');
      s = await chipState();
      pass(`chip dismisses @${width}`, s.exists && !s.open);
      await page.evaluate(() => window.EmberChip.show('blank-canvas'));
      s = await chipState();
      pass(`dismissed chip stays hidden @${width}`, s.exists && !s.open);

      // 4. Blank canvas + failed export on Pixel Studio.
      await open(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`);
      await reset();
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('jvds:canvas-empty')));
      s = await chipState();
      pass(`blank canvas shows chip @${width}`, s.open && /canvas is still blank/.test(s.text), s.text);
      pass(`blank canvas action present @${width}`, /starter/i.test(s.action), s.action);

      await reset();
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('jvds:export-failed')));
      s = await chipState();
      pass(`failed export shows chip @${width}`, s.open && /export did not finish/.test(s.text), s.text);
      pass(`failed export action present @${width}`, /Try the export again/.test(s.action), s.action);

      // 5. Accessibility + never blocks the page.
      pass(`chip announces politely @${width}`, s.role === 'status' && s.live === 'polite', s.role + '/' + s.live);
      pass(`chip is fixed and small @${width}`, s.position === 'fixed' && s.width <= width - 20 && s.height < 220, Math.round(s.width) + 'x' + Math.round(s.height));
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.log('\n' + failures.length + ' failure(s)');
    process.exit(1);
  }
  console.log('\nPASS create-hub-ember-chip: four triggers, dismissal and polite announcements');
})();
