#!/usr/bin/env node
/*
 * tests/buildlab-boot-budget.js
 * A3027: first paint must not pay for optional BuildLab modules.
 *
 * Asserts the QR encoder and WebGPU bundle are never requested before the
 * learner asks for them, no template previews or saved-part rows paint at boot,
 * and the QR module is fetched only after Show QR.
 *
 * Run: node tests/buildlab-boot-budget.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19429;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
});
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({width: 1440, height: 900});
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('buildlab_kidmode', '0'); } catch (e) {} });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
    await page.waitForFunction(() => typeof window.qrState === 'function', {timeout: 20000});
    await page.waitForFunction(() => !!document.querySelector('#viewport canvas'), {timeout: 25000});
    await pause(800);

    const boot = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource').map(r => r.name);
      const scripts = Array.from(document.scripts).map(s => s.src || '').filter(Boolean);
      return {
        qrFetched: resources.some(u => /qrcode\.mjs/.test(u)) || scripts.some(u => /qrcode/.test(u)),
        gpuFetched: resources.some(u => /three\.webgpu\.bundle\.js/.test(u)) || scripts.some(u => /three\.webgpu/.test(u)),
        preloads: Array.from(document.querySelectorAll('link[rel="modulepreload"],link[rel="preload"]')).map(l => l.href),
        previews: document.querySelectorAll('.tmpl-prev').length,
        lazy: window.lazyLibraryState(),
        blocks: window.blocks.length,
        status: (document.getElementById('engineStatus') || {}).textContent
      };
    });
    check('the scene still boots empty', boot.blocks === 0 && /ready/i.test(boot.status), JSON.stringify({blocks: boot.blocks}));
    check('the QR encoder is not fetched at first paint', boot.qrFetched === false);
    check('the WebGPU bundle is not fetched at first paint', boot.gpuFetched === false);
    check('nothing preloads the optional modules', !boot.preloads.some(u => /qrcode|webgpu/.test(u)), JSON.stringify(boot.preloads.filter(u => /qrcode|webgpu/.test(u))));
    check('no template previews load at first paint', boot.previews === 0, String(boot.previews));
    check('the saved-parts library stays lazy', boot.lazy.assetLoaded === false, JSON.stringify(boot.lazy));

    const asked = await page.evaluate(async () => {
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      await window.showShareQR();
      const started = Date.now();
      while (Date.now() - started < 10000 && !(window.qrState().last && window.qrState().last.ready)) await new Promise(r => setTimeout(r, 100));
      const resources = performance.getEntriesByType('resource').map(r => r.name);
      return {
        ready: !!(window.qrState().last && window.qrState().last.ready),
        qrFetchedNow: resources.some(u => /qrcode\.mjs/.test(u)),
        gpuStillLazy: !resources.some(u => /three\.webgpu\.bundle\.js/.test(u))
      };
    });
    check('the QR module loads only after Show QR', asked.ready && asked.qrFetchedNow, JSON.stringify(asked));
    check('opening a QR does not fetch the WebGPU bundle', asked.gpuStillLazy === true);

    check('zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB BOOT BUDGET CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
