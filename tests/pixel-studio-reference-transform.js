// A3000: reference layer + selection transforms. Proves the brush never paints
// on the reference, the reference can be faded/locked/removed, and a selection
// can be flipped, rotated and scaled with undo.
// Run: node tests/pixel-studio-reference-transform.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_REF_PORT || 19301);
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

  // ---- 390 -------------------------------------------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof setReferenceImage==="function"', { timeout: 20000 });

    const ref = await page.evaluate(async () => {
      applyProject({ v: 3, cW: 8, cH: 8, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[new Uint8ClampedArray(8 * 8 * 4)]] });
      const pc = document.createElement('canvas'); pc.width = 4; pc.height = 4;
      const pg = pc.getContext('2d'); pg.fillStyle = '#00ff00'; pg.fillRect(0, 0, 4, 4);
      const ok = await setReferenceImage(pc.toDataURL('image/png'), 'test-ref.png');
      const c = document.getElementById('reference-canvas');
      const count = () => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
      const painted = count();
      const loadedName = (document.getElementById('refName') || {}).textContent;
      setReferenceOpacity(85);
      const beforeDraw = painted;
      paintPx(getID(), 0, 0, '#ff0000', false);
      renderAll();
      const afterDraw = count();
      toggleReferenceLock();
      const lockedClear = clearReference();
      toggleReferenceLock();
      const unlockedClear = clearReference();
      const afterClear = count();
      return { ok, painted: beforeDraw, opacity: referenceOpacity, afterDraw, lockedClear, unlockedClear, afterClear, name: loadedName };
    });

    check('390: a reference image loads and draws', ref.ok === true && ref.painted > 0 && ref.name === 'test-ref.png', JSON.stringify({ painted: ref.painted, name: ref.name }));
    check('390: opacity can be faded', ref.opacity === 85, String(ref.opacity));
    check('390: drawing does not change the reference', ref.afterDraw === ref.painted, `${ref.painted}/${ref.afterDraw}`);
    check('390: a locked reference cannot be removed', ref.lockedClear === false && ref.unlockedClear === true && ref.afterClear === 0, JSON.stringify({ locked: ref.lockedClear, unlocked: ref.unlockedClear, after: ref.afterClear }));

    const transforms = await page.evaluate(() => {
      applyProject({ v: 3, cW: 8, cH: 8, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[new Uint8ClampedArray(8 * 8 * 4)]] });
      function put(x, y, r, g, b) { const id = getID(); const i = (y * 8 + x) * 4; id.data[i] = r; id.data[i + 1] = g; id.data[i + 2] = b; id.data[i + 3] = 255; }
      function px(x, y) { const id = getID(); const i = (y * 8 + x) * 4; return [id.data[i], id.data[i + 1], id.data[i + 2], id.data[i + 3]]; }
      put(1, 1, 255, 0, 0); put(2, 1, 0, 0, 255); put(1, 2, 0, 255, 0); put(2, 2, 255, 255, 0);
      selection = { x0: 1, y0: 1, x1: 2, y1: 2 };
      flipSelection('x');
      const flipX = { a: px(1, 1), b: px(2, 1) };
      undo();
      selection = { x0: 1, y0: 1, x1: 2, y1: 2 };
      rotateSelection();
      const rot = { w: selection.x1 - selection.x0 + 1, h: selection.y1 - selection.y0 + 1, top: px(1, 1) };
      undo();
      selection = { x0: 1, y0: 1, x1: 2, y1: 2 };
      scaleSelection(2);
      const scaled = { w: selection.x1 - selection.x0 + 1, h: selection.y1 - selection.y0 + 1, a: px(1, 1) };
      cancelSelectionTransform();
      const back = px(1, 1);
      return { flipX, rot, scaled, back };
    });

    check('390: flip X swaps the selected pixels', transforms.flipX.a[2] === 255 && transforms.flipX.b[0] === 255, JSON.stringify(transforms.flipX));
    check('390: rotate keeps a 2x2 selection and moves pixels', transforms.rot.w === 2 && transforms.rot.h === 2 && transforms.rot.top[3] === 255, JSON.stringify(transforms.rot));
    check('390: scale 2x grows the selection to 4x4', transforms.scaled.w === 4 && transforms.scaled.h === 4 && transforms.scaled.a[3] === 255, JSON.stringify(transforms.scaled));
    check('390: cancel restores the pre-transform pixels', transforms.back[0] === 255 && transforms.back[1] === 0 && transforms.back[3] === 255, JSON.stringify(transforms.back));

    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('390 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 390', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- 1440 ------------------------------------------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof setReferenceImage==="function"', { timeout: 20000 });
    const out = await page.evaluate(async () => {
      applyProject({ v: 3, cW: 8, cH: 8, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[new Uint8ClampedArray(8 * 8 * 4)]] });
      const pc = document.createElement('canvas'); pc.width = 4; pc.height = 4;
      const pg = pc.getContext('2d'); pg.fillStyle = '#00ff00'; pg.fillRect(0, 0, 4, 4);
      const ok = await setReferenceImage(pc.toDataURL('image/png'), 'desktop-ref.png');
      const c = document.getElementById('reference-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let painted = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) painted++;
      selection = { x0: 1, y0: 1, x1: 2, y1: 2 };
      const id = getID();
      id.data[(1 * 8 + 1) * 4 + 3] = 255;
      const flipped = flipSelection('x');
      return { ok, painted, flipped };
    });
    check('1440: reference + transform work', out.ok && out.painted > 0 && out.flipped === true, JSON.stringify(out));
    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('1440 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 1440', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PIXEL STUDIO REFERENCE/TRANSFORM CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
