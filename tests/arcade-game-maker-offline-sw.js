#!/usr/bin/env node
/*
 * tests/arcade-game-maker-offline-sw.js , A1475
 * Registers the real service worker, opens the maker once online (which asks
 * the SW to precache it), then goes fully offline and checks the engine still
 * opens: HTML, Phaser and its ES modules all come from cache and the page
 * loads for real. Run: node tests/arcade-game-maker-offline-sw.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = process.env.AGM_SW_PORT ? Number(process.env.AGM_SW_PORT) : 8991;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8', '.mjs':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.png':'image/png', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff',
  '.ttf':'font/ttf', '.mp3':'audio/mpeg', '.wav':'audio/wav' };

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}

const DEPS = ['/tools/arcade-game-maker.html', '/phaser-arcade-physics.min.js', '/src/arcade-maker/genres.js'];

(async () => {
  let offline = false;
  const server = http.createServer((req, res) => {
    if (offline) { req.socket.destroy(); return; }
    if (req.url.split('?')[0] === '/sw.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(fs.readFileSync(path.join(root, 'sw.js')));
    }
    const file = safePath(req.url || '/');
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));

  const failures = [];
  let browser;
  const check = (name, ok, detail) => { console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures.push(name); };
  try {
    // sw.js must offer the on-demand maker precache.
    const swText = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    check('sw.js defines the on-demand maker precache', /precache-maker/.test(swText) && /MAKER_DEPS/.test(swText));

    browser = await puppeteer.launch({ headless: true, protocolTimeout: 40000, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${port}`;

    // Register + control on a light page.
    await page.goto(base + '/tools/code-snippet-generator.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    const cacheKey = await page.evaluate(() => caches.keys().then(k => k.find(x => /^jvds-v\d+$/.test(x))));
    assert.ok(cacheKey, 'no jvds cache created');

    // Open the maker online; it posts precache-maker to the SW. We then post it
    // again and wait for the reply inside the SAME page context (a pending
    // evaluate would be destroyed by the navigation).
    await page.goto(base + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
    const cachedAll = await page.evaluate(async (deps) => {
      const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (sw) {
        await new Promise(resolve => {
          const h = e => { if (e.data && e.data.type === 'precache-maker-done') { navigator.serviceWorker.removeEventListener('message', h); resolve(true); } };
          navigator.serviceWorker.addEventListener('message', h);
          sw.postMessage({ type: 'precache-maker' });
          setTimeout(resolve, 15000);
        });
      }
      const key = (await caches.keys()).find(x => /^jvds-v\d+$/.test(x));
      const cache = await caches.open(key);
      const out = {};
      for (const d of deps) out[d] = !!(await cache.match(d));
      return out;
    }, DEPS);
    check('maker HTML + Phaser + modules precached on first visit', Object.values(cachedAll).every(Boolean), JSON.stringify(cachedAll));

    // Go fully offline and prove the engine still opens.
    offline = true;
    await page.setOfflineMode(true);

    for (const dep of DEPS) {
      const r = await page.evaluate(async p => { const res = await fetch(p); return { ok: res.ok, status: res.status, len: (await res.text()).length }; }, dep);
      check(`offline fetch ${dep}`, r.ok && r.len > 0, 'status ' + r.status + ', ' + r.len + ' bytes');
    }

    await page.goto(base + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 20000 });
    const title = await page.title();
    check('maker fully loads with the network down', !!title && !/OFFLINE|503/i.test(await page.content().then(c => c.slice(0, 2000))), title);
  } catch (err) {
    failures.push(err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) { console.error('arcade offline-sw failed:'); failures.forEach(f => console.error('- ' + f)); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER OFFLINE-SW CHECKS PASSED');
})();
