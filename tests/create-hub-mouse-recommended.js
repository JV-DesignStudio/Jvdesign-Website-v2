#!/usr/bin/env node
/* A2594: the five mouse-heavy Create editors carry a visible "Mouse recommended"
 * badge and a touch hint on their hub card and on the tool page. Touch-friendly
 * tools must not be labelled. Checks the hub at 390 / 1024 and the injected page
 * badge on each heavy editor at both widths. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webmanifest': 'application/manifest+json' };

const MOUSE_TOOLS = ['pixel-studio', 'level-designer', 'arcade-game-maker', 'buildlab', 'minecraft-skin-editor'];
const TOUCH_TOOLS = ['colour-palette', 'sound-studio', 'story-editor'];
const WIDTHS = [390, 1024];

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
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
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }); break; }
      catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 150)); }
    }
    await new Promise(r => setTimeout(r, 350));
  }
  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: true });

      await open(`http://127.0.0.1:${PORT}/pages/dev-tools.html`);
      const hub = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.tool-card'));
        return cards.map(c => ({
          href: (c.getAttribute('href') || '').split('/').pop().replace('.html', ''),
          badge: !!c.querySelector('.tool-input-badge'),
          note: !!c.querySelector('.tool-touch-note')
        }));
      });
      for (const id of MOUSE_TOOLS) {
        const card = hub.find(c => c.href === id);
        pass(`${id} card present @${width}`, !!card);
        if (card) pass(`${id} card has Mouse recommended @${width}`, card.badge && card.note);
      }
      for (const id of TOUCH_TOOLS) {
        const card = hub.find(c => c.href === id);
        if (card && card.badge) fail(`${id} should not be marked mouse-only @${width}`);
        else pass(`${id} not marked mouse-only @${width}`);
      }

      for (const id of MOUSE_TOOLS) {
        await open(`http://127.0.0.1:${PORT}/tools/${id}.html`);
        const r = await page.evaluate(() => {
          const el = document.getElementById('mouse-recommended');
          const style = el ? getComputedStyle(el) : null;
          return {
            exists: !!el,
            visible: !!el && style.display !== 'none' && el.getBoundingClientRect().width > 0,
            text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
            overflow: document.documentElement.scrollWidth - window.innerWidth
          };
        });
        pass(`${id} page shows Mouse recommended @${width}`, r.exists && r.visible);
        pass(`${id} page names a touch alternative @${width}`, /button|toggle|tap|zoom|stylus/i.test(r.text));
        pass(`${id} page no overflow @${width}`, r.overflow <= 1, r.overflow + 'px');
      }

      await open(`http://127.0.0.1:${PORT}/tools/colour-palette.html`);
      const clean = await page.evaluate(() => !document.getElementById('mouse-recommended'));
      pass(`touch-friendly tool has no badge @${width}`, clean);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.log('\n' + failures.length + ' failure(s)');
    process.exit(1);
  }
  console.log('\nPASS create-hub-mouse-recommended: badges accurate at 390 and 1024');
})();
