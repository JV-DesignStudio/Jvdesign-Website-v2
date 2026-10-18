#!/usr/bin/env node
/* A675: per-tool offline smoke. Registers the real service worker, lets it
   precache CORE, then goes offline and checks every precached create tool (and
   its stylesheet) is served from cache, plus one full offline page load. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8990;
const TOOLS = [
  'pixel-studio', 'sound-studio', 'level-designer', 'trading-card-designer',
  'colour-palette', 'particle-designer', 'bitmap-font-maker', 'sprite-animator',
  'icon-generator', 'gdd-builder', 'story-editor', 'code-snippet-generator', 'buildlab'
];
// A1691: core entry and hub pages that must open offline, plus a page-specific
// stylesheet each one needs. The clean nav URLs are checked through their aliases.
const HUBS = [
  { path: '/pages/workshop.html', css: '/style-workshop-bundle.css' },
  { path: '/pages/learn-hub.html', css: null },
  { path: '/pages/dev-tools.html', css: '/style-dev-tools.css' },
  { path: '/arcade.html', css: '/style-arcade.css' },
  { path: '/learn/index.html', css: '/style-shared.css' },
  { path: '/pick-your-path.html', css: '/style-shared.css' },
  { path: '/workshops/start-here.html', css: '/style-workshop.css' }
];
const CLEAN_URLS = { '/workshop': '/pages/workshop.html', '/dev-tools': '/pages/dev-tools.html', '/learn/': '/learn/index.html', '/games': '/arcade.html' };

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
  '.wav': 'audio/wav',
  '.rtttl': 'text/plain'
};

function safePath(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  // Mirror GitHub Pages: a directory request serves its index.html.
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
    // A1691 resilience probe: one broken CORE asset must not abort the precache.
    if (req.url.split('?')[0] === '/logo.png') { res.writeHead(404); return res.end('missing'); }
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
  try {
    const swText = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    for (const tool of TOOLS) {
      if (!swText.includes(`'/tools/${tool}.html'`)) failures.push(`sw.js CORE missing /tools/${tool}.html`);
      if (!fs.existsSync(path.join(root, 'tools', tool + '.html'))) failures.push('missing tool file ' + tool);
    }
    for (const hub of HUBS) {
      if (!swText.includes(`'${hub.path}'`)) failures.push(`sw.js CORE missing ${hub.path}`);
      if (!fs.existsSync(path.join(root, hub.path.replace(/^\//, '')))) failures.push('missing hub file ' + hub.path);
      if (hub.css) {
        if (!swText.includes(`'${hub.css}'`)) failures.push(`sw.js CORE missing ${hub.css}`);
        if (!fs.existsSync(path.join(root, hub.css.replace(/^\//, '')))) failures.push('missing hub css ' + hub.css);
      }
    }

    browser = await puppeteer.launch({ headless: true, protocolTimeout: 30000, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${port}`;
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
    await page.waitForFunction(async key => {
      const cache = await caches.open(key);
      return !!(await cache.match('/tools/buildlab.html'));
    }, { timeout: 30000 }, cacheKey).catch(() => {});
    console.log(`PASS: service worker precached CORE into ${cacheKey}`);

    offline = true;
    await page.setOfflineMode(true);

    for (const tool of TOOLS) {
      const html = await page.evaluate(async p => {
        const r = await fetch(p);
        return { ok: r.ok, status: r.status, body: await r.text() };
      }, `/tools/${tool}.html`);
      if (!html.ok || !html.body.includes('/tools/' + tool + '.html')) {
        failures.push(`${tool}: offline HTML not served from cache (status ${html.status})`);
      }
      const css = await page.evaluate(async p => {
        const r = await fetch(p);
        return { ok: r.ok, status: r.status };
      }, `/style-tool-${tool}.css`);
      if (!css.ok) failures.push(`${tool}: offline CSS not served from cache (status ${css.status})`);
    }
    if (!failures.length) console.log(`PASS: ${TOOLS.length} create tools + CSS served offline from cache`);

    const beforeHubs = failures.length;
    for (const hub of HUBS) {
      const html = await page.evaluate(async p => {
        const r = await fetch(p);
        return { ok: r.ok, status: r.status, body: await r.text() };
      }, hub.path);
      if (!html.ok || !html.body.length || /OFFLINE FALLBACK/.test(html.body)) {
        failures.push(`${hub.path}: offline HTML not served from cache (status ${html.status})`);
      }
      if (hub.css) {
        const css = await page.evaluate(async p => {
          const r = await fetch(p);
          return { ok: r.ok, status: r.status };
        }, hub.css);
        if (!css.ok) failures.push(`${hub.css}: offline CSS not served from cache (status ${css.status})`);
      }
    }
    // A1691: the clean nav URLs must resolve to the precached page with the network down.
    for (const [clean, target] of Object.entries(CLEAN_URLS)) {
      const r = await page.evaluate(async p => {
        const res = await fetch(p);
        return { ok: res.ok, status: res.status, body: await res.text() };
      }, clean);
      if (!r.ok || !r.body.length || /OFFLINE FALLBACK/.test(r.body)) {
        failures.push(`clean URL ${clean} did not resolve to ${target} offline (status ${r.status})`);
      }
    }
    if (failures.length === beforeHubs) console.log(`PASS: ${HUBS.length} core hubs and clean nav URLs served offline from cache`);

    await page.goto(base + '/tools/code-snippet-generator.html', { waitUntil: 'domcontentloaded' });
    const content = await page.content();
    assert.match(content, /<title>[^<]+<\/title>/, 'offline page load had no title');
    assert.ok(!/OFFLINE FALLBACK/.test(content), 'offline tool fell back to offline page');
    console.log('PASS: a precached tool fully loads with the network down');

    // A1691: a real navigation to a clean hub URL opens the hub offline.
    await page.goto(base + '/workshop', { waitUntil: 'domcontentloaded' });
    const cleanContent = await page.content();
    assert.match(cleanContent, /<title>[^<]+<\/title>/, 'offline /workshop had no title');
    assert.ok(!/OFFLINE FALLBACK/.test(cleanContent), 'offline clean URL /workshop fell back to the offline page');
    console.log('PASS: the clean URL /workshop opens the real workshop hub offline');
  } catch (err) {
    failures.push(err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('offline-tools smoke failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log('offline-tools smoke passed.');
})();
