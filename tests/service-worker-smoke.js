const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

// A real worker on an isolated origin: no production caches or visitor data.
(async () => {
  let revision = 1;
  let offline = false;
  const server = http.createServer((req, res) => {
    if (offline) { req.socket.destroy(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/sw.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(fs.readFileSync(path.join(__dirname, '..', 'sw.js')));
    }
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
      res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(`/* network ${url.pathname}${url.search} revision ${revision} */`);
    }
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    res.end(`<html><body>${url.pathname === '/offline.html' ? 'OFFLINE FALLBACK' : 'NETWORK ' + revision}</body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base);
    await page.evaluate(async () => {
      for (const key of ['jvds-v1', 'questlog-v1', 'jvds-gallery-v1', 'jvds-v18-other']) {
        const cache = await caches.open(key);
        await cache.put('/shared.png', new Response('unrelated saved asset'));
      }
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    const keys = await page.evaluate(() => caches.keys());
    for (const key of ['questlog-v1', 'jvds-gallery-v1', 'jvds-v18-other']) assert.ok(keys.includes(key), 'Updater deleted another cache: ' + key);
    assert.ok(!keys.includes('jvds-v1'), 'Obsolete website cache retained');
    const current = keys.filter(key => /^jvds-v\d+$/.test(key));
    assert.equal(current.length, 1);
    console.log('PASS: removes only obsolete website caches; preserves three unrelated caches');

    await page.evaluate(async key => {
      const cache = await caches.open(key);
      await cache.put('/asset.js?v=1', new Response('old script', { headers: { 'Content-Type': 'text/javascript' } }));
      await cache.put('/asset.css?v=1', new Response('old style', { headers: { 'Content-Type': 'text/css' } }));
    }, current[0]);
    for (const extension of ['js', 'css']) {
      const body = await page.evaluate(async ext => (await fetch('/asset.' + ext + '?v=2')).text(), extension);
      assert.match(body, /v=2 revision 1/, 'Versioned asset served an older cache entry');
    }
    console.log('PASS: new script and stylesheet versions use the requested URL');
    const shared = await page.evaluate(async () => (await fetch('/shared.png')).text());
    assert.match(shared, /NETWORK/, 'Used a response from another app cache');
    console.log('PASS: website fetches do not read another app cache');

    await page.goto(base + '/extensionless');
    assert.match(await page.content(), /NETWORK 1/);
    revision = 2;
    const stale = await page.evaluate(async () => (await fetch('/asset.js?v=2')).text());
    assert.match(stale, /revision 1/, 'Existing version was not served from cache');
    await page.waitForFunction(async key => {
      const response = await (await caches.open(key)).match('/asset.js?v=2');
      return response && (await response.text()).includes('revision 2');
    }, {}, current[0]);
    console.log('PASS: background refresh updates the cached response');
    await page.reload();
    assert.match(await page.content(), /NETWORK 2/, 'Extensionless navigation served stale HTML');
    console.log('PASS: extensionless navigation receives fresh HTML');
    // CDP offline mode alone does not reliably disable worker fetches.
    offline = true;
    await page.setOfflineMode(true);
    await page.reload();
    assert.match(await page.content(), /NETWORK 2/, 'Cached navigation unavailable offline');
    const offlineAsset = await page.evaluate(async () => (await fetch('/asset.js?v=2')).text());
    assert.match(offlineAsset, /v=2 revision 2/);
    const missingAsset = await page.evaluate(async () => { const r = await fetch('/asset.js?v=3'); return { status: r.status, body: await r.text() }; });
    assert.equal(missingAsset.status, 504);
    assert.equal(missingAsset.body, '');
    await page.goto(base + '/never-visited');
    assert.match(await page.content(), /OFFLINE FALLBACK/);
    console.log('PASS: offline navigation, fallback and exact asset versions; no HTML returned as JavaScript');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
