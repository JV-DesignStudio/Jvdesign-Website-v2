// BuildLab: binary STL export for 3D printing plus the mascot guidance from
// the audit (Echo warnings, Ember export cheers, Lumo starter tip).
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19281;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

async function dismiss(page) {
  await page.evaluate(() => {
    try { window.closeModal && window.closeModal('welcomeModal'); } catch (e) {}
    const w = document.getElementById('welcomeModal');
    if (w) w.classList.remove('open');
    document.body.classList.remove('bl-modal-open');
    const c = document.getElementById('cookie-accept');
    if (c) c.click();
  });
  await pause(200);
}

(async () => {
  await new Promise(resolve => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'desktop', w: 1440, h: 900, m: false }, { name: 'mobile', w: 390, h: 844, m: true }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('console', m => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
        errors.push('console: ' + text);
      });
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await pause(900);
      await dismiss(page);
      await page.evaluate(() => {
        try {
          localStorage.removeItem('buildlab_autosave');
          localStorage.setItem('buildlab_kidmode', '0');
        } catch (e) {}
      });

      const stl = await page.evaluate(() => {
        window.clearAll(true);
        window.addBlock(0, 0, 0, 1, 1, 1, '#e94560');
        window.addBlock(2, 0, 0, 1, 1, 1, '#5bc0f8');
        const result = window.buildSTLBinary();
        if (!result) return { ok: false };
        const dv = new DataView(result.buffer);
        const count = dv.getUint32(80, true);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        let offset = 84;
        for (let i = 0; i < count; i++) {
          offset += 12;
          for (let v = 0; v < 3; v++) {
            const x = dv.getFloat32(offset, true); offset += 4;
            const y = dv.getFloat32(offset, true); offset += 4;
            const z = dv.getFloat32(offset, true); offset += 4;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          }
          offset += 2;
        }
        return {
          ok: true,
          triangles: result.triangles,
          headerCount: count,
          bytes: result.buffer.byteLength,
          expectedBytes: 84 + result.triangles * 50,
          scale: result.scale,
          bounds: { minX, maxX, minY, maxY, minZ, maxZ },
          buttons: document.querySelectorAll('[data-on="exportSTL"]').length
        };
      });
      check(vp.name + ': STL builder returns two boxes', stl.ok && stl.triangles === 24, JSON.stringify(stl));
      check(vp.name + ': STL header matches triangle count', stl.ok && stl.headerCount === stl.triangles, JSON.stringify(stl));
      check(vp.name + ': STL buffer size is binary STL', stl.ok && stl.bytes === stl.expectedBytes, JSON.stringify(stl));
      check(vp.name + ': STL uses millimetre scale', stl.ok && stl.scale === 1000, String(stl.scale));
      check(vp.name + ': STL sits on the bed (min Y is 0)', stl.ok && Math.abs(stl.bounds.minY) < 0.001, JSON.stringify(stl.bounds));
      check(vp.name + ': STL is centred on X', stl.ok && Math.abs(stl.bounds.minX + stl.bounds.maxX) < 0.01, JSON.stringify(stl.bounds));
      check(vp.name + ': STL is centred on Z', stl.ok && Math.abs(stl.bounds.minZ + stl.bounds.maxZ) < 0.01, JSON.stringify(stl.bounds));
      check(vp.name + ': STL model size is 3 x 1 x 1 m', stl.ok && Math.abs((stl.bounds.maxX - stl.bounds.minX) - 3000) < 0.01 && Math.abs((stl.bounds.maxY - stl.bounds.minY) - 1000) < 0.01, JSON.stringify(stl.bounds));
      check(vp.name + ': export buttons exist on desktop and mobile', stl.buttons >= 2, 'buttons=' + stl.buttons);

      const ember = await page.evaluate(() => {
        window.clearAll(true);
        window.addBlock(0, 0, 0, 1, 1, 1, '#e94560');
        window.exportOBJWithMTL();
        return document.getElementById('toast')?.textContent || '';
      });
      check(vp.name + ': Ember celebrates a finished export', /Ember says/.test(ember), ember);

      const lumo = await page.evaluate(async () => {
        window.clearAll(true);
        await new Promise(r => setTimeout(r, 250));
        return document.getElementById('outlinerEmpty')?.textContent || '';
      });
      check(vp.name + ': Lumo guides the empty outliner', /Lumo says/.test(lumo), lumo);

      if (!vp.m) {
        const echo = await page.evaluate(() => {
          window.clearAll(true);
          for (let i = 0; i < 501; i++) window.addBlock(i, 0, 0, 1, 1, 1, '#e94560');
          return document.getElementById('toast')?.textContent || '';
        });
        check('desktop: Echo warns about very large builds', /Echo says/.test(echo), echo);
      }

      check(vp.name + ': no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nBuildLab STL and mascot guidance: all checks passed');
})();
