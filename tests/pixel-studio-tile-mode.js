// A2999: tile mode. Draws one tile, repeats it 3x3 for a seam check, exports it
// at the chosen size and leaves the artwork alone when the mode is switched off.
// Run: node tests/pixel-studio-tile-mode.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_TILE_PORT || 19293);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
const listen = () => new Promise((resolve) => server.listen(port, resolve));

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function makePage(browser, errors) {
  return browser.newPage().then(async (page) => {
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const t = m.text();
        if (!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ServiceWorker|sw\.js|is\.gd|The operation was aborted/i.test(t)) errors.push('console: ' + t);
      }
    });
    return page;
  });
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ---- 390: tile mode, 16px preset, seam preview, export ----------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0', { timeout: 20000 });

    await page.evaluate(() => {
      applyProject({ v: 3, cW: 32, cH: 32, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[new Uint8ClampedArray(32 * 32 * 4)]] });
    });
    await page.evaluate(() => toggleTileMode());
    const opened = await page.evaluate(() => ({
      visible: (() => { const p = document.getElementById('tilePanel'); return p && !p.hidden && getComputedStyle(p).display !== 'none'; })(),
      selected: document.getElementById('tileModeBtn').getAttribute('aria-selected'),
      size: tileSize,
      canvas: [cW, cH]
    }));
    check('390: Tiles opens the tile panel', opened.visible && opened.selected === 'true', JSON.stringify(opened));
    check('390: an existing 32px canvas keeps its size', opened.size === 32 && opened.canvas[0] === 32, JSON.stringify(opened.canvas));

    await page.evaluate(() => setTileSize(16));
    await page.waitForFunction('cW===16 && cH===16', { timeout: 5000 });
    const resized = await page.evaluate(() => ({ size: tileSize, canvas: [cW, cH] }));
    check('390: the 16 preset resizes the canvas', resized.size === 16 && resized.canvas[0] === 16 && resized.canvas[1] === 16, JSON.stringify(resized));

    const preview = await page.evaluate(() => {
      const id = getID();
      const i = (1 * 16 + 1) * 4;
      id.data[i] = 255; id.data[i + 1] = 40; id.data[i + 2] = 90; id.data[i + 3] = 255;
      renderAll();
      const c = document.getElementById('tilePreview');
      const g = c.getContext('2d');
      const cell = Math.floor(c.width / 3);
      function px(x, y) { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2], d[3]]; }
      const a = px(5, 5), b = px(5 + cell, 5), c2 = px(5 + cell * 2, 5);
      return { cell, a, b, c2, same: JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) === JSON.stringify(c2), alpha: a[3] };
    });
    check('390: the preview repeats the drawn pixel 3x3', preview.same && preview.alpha > 0, JSON.stringify(preview));

    const snap = await page.evaluate(() => {
      const box = document.getElementById('tileSnap');
      box.checked = false; onTileSnap(false);
      const off = showGrid;
      box.checked = true; onTileSnap(true);
      return { off, on: showGrid };
    });
    check('390: the snap checkbox controls the tile grid', snap.off === false && snap.on === true, JSON.stringify(snap));

    const exported = await page.evaluate(() => {
      let name = '';
      const orig = window.JVDS_DOWNLOAD;
      window.JVDS_DOWNLOAD = (canvas, n) => { name = n; window.__tileSize = [canvas.width, canvas.height]; };
      const ok = exportTile();
      window.JVDS_DOWNLOAD = orig;
      return { ok, name, size: window.__tileSize };
    });
    check('390: Export tile writes a named 16x16 PNG', exported.ok && /jvds-tile-16x16-\d.*\.png$/i.test(exported.name) && exported.size[0] === 16, exported.name);

    const kept = await page.evaluate(() => {
      toggleTileMode();
      const id = frames[currentFrame][currentLayer];
      const i = (1 * 16 + 1) * 4;
      return {
        hidden: document.getElementById('tilePanel').hidden,
        canvas: [cW, cH],
        pixel: id ? [id.data[i], id.data[i + 1], id.data[i + 2], id.data[i + 3]] : null
      };
    });
    check('390: leaving tile mode keeps the artwork', kept.hidden && kept.canvas[0] === 16 && kept.pixel && kept.pixel[0] === 255 && kept.pixel[3] === 255, JSON.stringify(kept));

    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('390 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 390', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- 1440: 32px tile and a clean preview ------------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0', { timeout: 20000 });
    await page.evaluate(() => toggleTileMode());
    await page.evaluate(() => setTileSize(32));
    await page.waitForFunction('cW===32 && cH===32', { timeout: 5000 });
    const out = await page.evaluate(() => {
      const id = getID();
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        if ((x + y) % 8 === 0) { const i = (y * 32 + x) * 4; id.data[i] = 20; id.data[i + 1] = 200; id.data[i + 2] = 160; id.data[i + 3] = 255; }
      }
      renderAll();
      const c = document.getElementById('tilePreview');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let painted = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) painted++;
      return { size: tileSize, painted, visible: !document.getElementById('tilePanel').hidden };
    });
    check('1440: 32px tile mode paints the preview', out.visible && out.size === 32 && out.painted > 0, JSON.stringify(out));
    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('1440 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 1440', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PIXEL STUDIO TILE MODE CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });

