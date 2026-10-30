#!/usr/bin/env node
/* A2016: the service worker must survive a complete update cycle.

   This drives a real worker on an isolated origin and walks the exact learner
   sequence from the card:
     1. visit online and let the worker install,
     2. open a game and build up progress,
     3. disconnect and reopen the game,
     4. reconnect after publishing an update (new sw.js bytes + new assets),
     5. confirm the new version is served and the learner's progress is intact,
     6. confirm a recovery route exists when a page was never cached.

   Headless Chromium only: the mobile Safari pass is a manual step recorded on
   the card rather than pretended here. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const GAME_PATH = '/games/echos-flight.html';
const PROBE_PATH = '/update-probe.js';
const SAVE_KEY = 'jvds_game_echo-flight';
const BEST_KEY = 'echo_swim_flappy_v1';
const SAVE_VALUE = JSON.stringify({ best: 7, xp: 123, gamesPlayed: 1 });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function safePath(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (clean === '' || clean.endsWith('/')) clean += 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}

(async () => {
  let revision = 1;
  let offline = false;
  const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const cacheMatch = swSource.match(/const CACHE\s*=\s*'(jvds-v(\d+))'/);
  if (!cacheMatch) throw new Error('sw.js has no numbered jvds cache name');
  const cacheFor = rev => rev === 1 ? cacheMatch[1] : 'jvds-v' + (Number(cacheMatch[2]) + 1);

  const server = http.createServer((req, res) => {
    if (offline) { req.socket.destroy(); return; }
    const urlPath = req.url.split('?')[0];
    if (urlPath === '/sw.js') {
      const body = revision === 1
        ? swSource
        : swSource.replace(cacheMatch[1], cacheFor(2)) + '\n// published update ' + revision + '\n';
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(body);
    }
    if (urlPath === PROBE_PATH) {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      return res.end('window.JVDS_UPDATE_PROBE="revision ' + revision + '";');
    }
    const file = safePath(req.url || '/');
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const failures = [];
  let browser;
  try {
    assert.ok(fs.existsSync(path.join(root, 'offline.html')), 'offline.html recovery page is missing');

    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 60000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();

    // 1. Visit online and install the worker.
    await page.goto(base + '/arcade.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    await page.waitForFunction(async key => (await caches.keys()).includes(key), { timeout: 30000 }, cacheFor(1));
    console.log('PASS: revision 1 worker installed into ' + cacheFor(1));

    // 2. Open a game and build up progress, and cache the probe asset.
    await page.goto(base + GAME_PATH, { waitUntil: 'domcontentloaded' });
    await page.evaluate((saveKey, bestKey, saveValue) => {
      localStorage.setItem(saveKey, saveValue);
      localStorage.setItem(bestKey, JSON.stringify({ best: 7, streak: 2 }));
      return fetch('/update-probe.js').then(r => r.text());
    }, SAVE_KEY, BEST_KEY, SAVE_VALUE);
    await page.waitForFunction(async key => {
      const cache = await caches.open(key);
      const hit = await cache.match('/update-probe.js');
      return !!(hit && (await hit.text()).includes('revision 1'));
    }, { timeout: 30000 }, cacheFor(1));
    console.log('PASS: game progress saved and the revision 1 asset cached');

    // 3. Disconnect and reopen the game from cache.
    offline = true;
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const offlineGame = await page.evaluate((saveKey, bestKey) => ({
      title: document.title,
      canvas: !!document.getElementById('game'),
      saved: localStorage.getItem(saveKey),
      best: localStorage.getItem(bestKey),
      fallback: /offline/i.test(document.body.textContent.slice(0, 80))
    }), SAVE_KEY, BEST_KEY);
    assert.match(offlineGame.title, /Echo'?s Swim/i, 'offline reload did not reopen the game');
    assert.equal(offlineGame.canvas, true, 'offline game page lost its canvas');
    assert.equal(offlineGame.fallback, false, 'offline game served the fallback page');
    assert.match(offlineGame.best, /"best":7/, 'the learner best score was lost while offline');
    const progressBeforeUpdate = { saved: offlineGame.saved, best: offlineGame.best };
    console.log('PASS: the game reopens offline and keeps the learner progress');

    // 4. Reconnect and publish an update (new sw.js bytes).
    offline = false;
    await page.setOfflineMode(false);
    revision = 2;
    await page.goto(base + '/arcade.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}));
    await page.waitForFunction(async (oldKey, newKey) => {
      const names = await caches.keys();
      return names.includes(newKey) && !names.includes(oldKey);
    }, { timeout: 60000 }, cacheFor(1), cacheFor(2));
    console.log('PASS: the published worker replaces ' + cacheFor(1) + ' with ' + cacheFor(2) + ' without a manual cache clear');

    // 5. The new version is served and progress is intact.
    const afterUpdate = await page.evaluate((saveKey, bestKey) => ({
      saved: localStorage.getItem(saveKey),
      best: localStorage.getItem(bestKey),
      controller: !!navigator.serviceWorker.controller
    }), SAVE_KEY, BEST_KEY);
    assert.equal(afterUpdate.saved, progressBeforeUpdate.saved, 'game progress was lost during the worker update');
    assert.equal(afterUpdate.best, progressBeforeUpdate.best, 'game best score was lost during the worker update');
    assert.equal(afterUpdate.controller, true, 'no worker controls the page after the update');

    const probe = await page.evaluate(async () => (await fetch('/update-probe.js')).text());
    let served = probe;
    for (let i = 0; i < 20 && !served.includes('revision 2'); i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      served = await page.evaluate(async () => (await fetch('/update-probe.js')).text());
    }
    assert.match(served, /revision 2/, 'new asset version was never served after the update');
    console.log('PASS: the new version is served and both progress keys survived the update');

    // 6. Recovery route for anything that was never cached.
    offline = true;
    await page.setOfflineMode(true);
    await page.goto(base + '/never-visited-' + Date.now(), { waitUntil: 'domcontentloaded' });
    const fallback = await page.content();
    assert.match(fallback, /offline/i, 'uncached navigation did not show the recovery page');
    console.log('PASS: an uncached page falls back to the offline recovery route');
  } catch (err) {
    failures.push(err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('service worker update cycle test failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log('service worker update cycle test passed (headless Chromium).');
})();
