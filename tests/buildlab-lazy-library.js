#!/usr/bin/env node
/*
 * tests/buildlab-lazy-library.js
 * A2746: verifies the on-demand template and asset library.
 *
 * Covers the empty first paint, the placeholder before the asset panel opens,
 * asset rows rendering on open, template previews drawing on demand and being
 * cached, and templates building offline.
 *
 * Run: node tests/buildlab-lazy-library.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19417;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2'};
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
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.clear();
        localStorage.setItem('buildlab_kidmode', '0');
        localStorage.setItem('assetLibrary', JSON.stringify([{
          name: 'Saved Part',
          blocks: [{x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, colour: '#e94560', shape: 'box', rot: 0, rotX: 0, rotZ: 0}],
          timestamp: Date.now()
        }]));
      } catch (e) {}
    });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
    await page.waitForFunction(() => typeof window.setupLazyLibrary === 'function', {timeout: 20000});
    await page.waitForFunction(() => !!document.querySelector('#viewport canvas'), {timeout: 25000});
    await pause(500);
    await page.evaluate(() => {
      try { closeModal('welcomeModal'); } catch (e) {}
      const w = document.getElementById('welcomeModal');
      if (w) w.classList.remove('open');
      document.body.classList.remove('bl-modal-open');
    });

    const boot = await page.evaluate(() => ({
      state: window.lazyLibraryState(),
      placeholder: (document.getElementById('assetLibrary') || {}).textContent || '',
      namesInBody: document.body.textContent.includes('Saved Part'),
      previews: document.querySelectorAll('.tmpl-prev').length,
      blocks: window.blocks.length,
      status: (document.getElementById('engineStatus') || {}).textContent,
      cards: document.querySelectorAll('.tmpl-btn').length
    }));
    check('the default scene still loads empty', boot.blocks === 0 && /ready/i.test(boot.status), JSON.stringify({blocks: boot.blocks, status: boot.status}));
    check('the asset library is not read at first paint', boot.state.assetLoaded === false && !boot.namesInBody, JSON.stringify({loaded: boot.state.assetLoaded, names: boot.namesInBody}));
    check('the asset panel shows a lazy placeholder', /Open the library/i.test(boot.placeholder), boot.placeholder.trim());
    check('no template previews load at first paint', boot.previews === 0, String(boot.previews));
    check('all 15 templates are still wired', boot.cards === 15, String(boot.cards));

    const assetOpen = await page.evaluate(async () => {
      const details = document.getElementById('assetLibraryDetails');
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
      await new Promise(r => setTimeout(r, 120));
      return {
        state: window.lazyLibraryState(),
        namesInBody: document.body.textContent.includes('Saved Part'),
        rows: document.querySelectorAll('#assetLibrary > div').length,
        text: (document.getElementById('assetLibrary') || {}).textContent
      };
    });
    check('opening the asset library loads the saved parts', assetOpen.state.assetLoaded && assetOpen.namesInBody && assetOpen.rows >= 1, JSON.stringify({loaded: assetOpen.state.assetLoaded, rows: assetOpen.rows}));

    const previews = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('.tmpl-btn'));
      buttons[0].dispatchEvent(new MouseEvent('mouseenter'));
      await new Promise(r => setTimeout(r, 60));
      const one = Array.from(document.querySelectorAll('.tmpl-prev')).map(i => i.src);
      buttons.forEach(b => b.dispatchEvent(new MouseEvent('mouseenter')));
      await new Promise(r => setTimeout(r, 120));
      const all = Array.from(document.querySelectorAll('.tmpl-prev'));
      return {
        oneCount: one.length,
        oneIsImage: one[0] ? one[0].startsWith('data:image/png') : false,
        allCount: all.length,
        allImages: all.every(i => i.src.startsWith('data:image/png')),
        state: window.lazyLibraryState()
      };
    });
    check('a template preview draws when the template is used', previews.oneCount === 1 && previews.oneIsImage, JSON.stringify({count: previews.oneCount, image: previews.oneIsImage}));
    check('every template preview draws on demand', previews.allCount === 15 && previews.allImages, String(previews.allCount));
    check('template previews are cached locally', previews.state.cachedPreviews === true);

    const offline = await page.evaluate(() => {
      try { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); } catch (e) {}
      window.quickBuild('robot');
      return {blocks: window.blocks.length};
    });
    check('templates build offline once cached', offline.blocks > 5, JSON.stringify(offline));

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
  console.log('\nALL BUILDLAB LAZY LIBRARY CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
