#!/usr/bin/env node
/* A2015: the Arcade offline banner and the per-game "Ready offline" pill must
   describe what is actually cached, not promise that every game plays offline.
   This runs the real service worker on an isolated origin, plays one game while
   online, then disconnects and proves:
   1. the banner is hidden online and the copy never claims every game plays,
   2. only games actually stored in the cache get the "Ready offline" pill,
   3. the offline banner counts the games that really are ready,
   4. the labelled game loads and starts from cache with the network down. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const GAME_PATH = '/games/echos-flight.html';
const UNPLAYED_PATH = '/games/tower-defence.html';

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
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const failures = [];
  let browser;
  try {
    const arcade = fs.readFileSync(path.join(root, 'arcade.html'), 'utf8');
    const bannerCopy = (arcade.match(/id="offlineBanner"[^>]*>([^<]*)</) || [])[1] || '';
    if (/every game/i.test(bannerCopy)) failures.push('banner still claims every game plays offline: ' + bannerCopy);
    if (!/Games you have already opened still play/i.test(bannerCopy)) failures.push('banner copy is not the cache-honest version: ' + bannerCopy);
    if (!/sw-register\.js/.test(arcade)) failures.push('arcade.html does not register the service worker, so nothing is ever cached');
    if (!fs.existsSync(path.join(root, 'games', 'echos-flight.html'))) failures.push('missing labelled game games/echos-flight.html');

    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 30000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();

    // 1. Online: the banner must stay hidden.
    await page.goto(base + '/arcade.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    const onlineBanner = await page.evaluate(() => {
      const b = document.getElementById('offlineBanner');
      return b ? { hidden: b.hidden, text: b.textContent } : null;
    });
    assert.ok(onlineBanner, 'no offline banner on the arcade');
    assert.equal(onlineBanner.hidden, true, 'offline banner visible while online');
    console.log('PASS: banner hidden while online');

    // 2. Open one game online so the service worker stores its page.
    await page.goto(base + GAME_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(async () => {
      const key = (await caches.keys()).find(x => /^jvds-v\d+$/.test(x));
      if (!key) return false;
      return !!(await (await caches.open(key)).match('/games/echos-flight.html'));
    }, { timeout: 30000 });
    console.log('PASS: ' + GAME_PATH + ' cached by the real service worker after one online visit');

    // 3. Back online on the arcade: only the cached game is labelled.
    await page.goto(base + '/arcade.html', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      const cab = document.querySelector('.cab[data-game="echo-flight"]');
      return !!(cab && cab.querySelector('.cab-offline'));
    }, { timeout: 15000 });
    const labels = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('.cab[data-game]').forEach(cab => {
        out[cab.getAttribute('data-game')] = !!cab.querySelector('.cab-offline');
      });
      return out;
    });
    assert.equal(labels['echo-flight'], true, 'cached game not labelled Ready offline');
    assert.equal(labels['tower-defence'], false, 'game that was never opened was labelled Ready offline');
    console.log('PASS: only games actually in the cache show the Ready offline pill');

    // 4. Offline: banner reflects state and counts the ready games.
    // Headless Chrome keeps navigator.onLine true under CDP network emulation, so
    // expose the state the browser really shows a learner on a dropped connection.
    offline = true;
    await page.setOfflineMode(true);
    await page.evaluateOnNewDocument(() => {
      try { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const b = document.getElementById('offlineBanner');
      return b && !b.hidden && /games you have opened are ready to play/i.test(b.textContent);
    }, { timeout: 15000 });
    const offlineBanner = await page.evaluate(() => {
      const b = document.getElementById('offlineBanner');
      return { hidden: b.hidden, text: b.textContent, online: navigator.onLine };
    });
    assert.equal(offlineBanner.online, false, 'page did not read the browser offline state');
    assert.equal(offlineBanner.hidden, false, 'offline banner stayed hidden while disconnected');
    assert.match(offlineBanner.text, /1 of \d+ games you have opened are ready to play/i, 'offline banner did not report the real cached count: ' + offlineBanner.text);
    assert.doesNotMatch(offlineBanner.text, /every game/i);
    console.log('PASS: offline banner is shown and states "1 of N games you have opened are ready to play"');

    // 5. The labelled game itself opens and starts from cache with no network.
    await page.goto(base + GAME_PATH, { waitUntil: 'domcontentloaded' });
    const gameState = await page.evaluate(() => ({
      title: document.title,
      hasCanvas: !!document.getElementById('game'),
      hud: (document.getElementById('scoreHud') || {}).textContent,
      startVisible: !!document.getElementById('startScreen') && getComputedStyle(document.getElementById('startScreen')).display !== 'none',
      system: typeof window.GameSystem,
      fallback: /offline/i.test(document.body.textContent.slice(0, 80))
    }));
    assert.match(gameState.title, /Echo'?s Swim/i, 'offline game served the wrong page');
    assert.equal(gameState.hasCanvas, true, 'offline game page has no canvas');
    assert.equal(gameState.startVisible, true, 'offline game did not reach its start screen');
    assert.equal(gameState.fallback, false, 'offline game served the offline fallback page');
    assert.equal(gameState.system, 'function', 'shared GameSystem script did not load offline');
    console.log('PASS: ' + GAME_PATH + ' loads and starts from cache with the network down');
  } catch (err) {
    failures.push(err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('arcade offline banner test failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log('arcade offline banner test passed.');
})();
