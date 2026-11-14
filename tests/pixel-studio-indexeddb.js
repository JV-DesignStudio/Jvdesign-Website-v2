// A2998: Pixel Studio keeps large projects in IndexedDB and falls back honestly
// when storage is blocked. Run: node tests/pixel-studio-indexeddb.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_IDB_PORT || 19292);
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

function makeProjectInPage(count) {
  const size = 128;
  const layer = () => {
    const d = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < d.length; i += 4) {
      const v = (i * 37) % 256;
      d[i] = v; d[i + 1] = (v + 80) % 256; d[i + 2] = (v + 160) % 256; d[i + 3] = 255;
    }
    return d;
  };
  applyProject({
    v: 3, cW: size, cH: size, fps: 8,
    layers: [{ name: 'Layer 1', visible: true }],
    frames: Array.from({ length: count }, () => [layer()])
  });
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ---- 390: save a >4 MB project when localStorage is full --------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof idbPut==="function"', { timeout: 20000 });

    const saved = await page.evaluate(async (count) => {
      const size = 128;
      const layer = () => {
        const d = new Uint8ClampedArray(size * size * 4);
        for (let i = 0; i < d.length; i += 4) {
          const v = (i * 37) % 256;
          d[i] = v; d[i + 1] = (v + 80) % 256; d[i + 2] = (v + 160) % 256; d[i + 3] = 255;
        }
        return d;
      };
      applyProject({ v: 3, cW: size, cH: size, fps: 8, layers: [{ name: 'Layer 1', visible: true }],
        frames: Array.from({ length: count }, () => [layer()]) });
      const json = serializeProject();
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
      let ok;
      try { ok = await saveProject(); } catch (e) { ok = 'threw ' + e.name; }
      Storage.prototype.setItem = real;
      const inIdb = await idbGet('current');
      return {
        ok,
        saved: window._projectSaved === true,
        toast: (document.getElementById('toast') || {}).textContent || '',
        bytes: json.length,
        inIdb: !!inIdb,
        local: (() => { try { return !!localStorage.getItem('jvds_pixel'); } catch (e) { return false; } })()
      };
    }, 28);

    check('large project is over the localStorage box', saved.bytes > 4000000, saved.bytes + ' chars');
    check('save falls back to IndexedDB when localStorage is full', saved.ok === true && saved.saved && saved.inIdb, JSON.stringify({ ok: saved.ok, inIdb: saved.inIdb }));
    check('the fallback says the large project was kept', /large project|saved on this device/i.test(saved.toast), saved.toast);
    check('the oversized project is not claimed as a localStorage save', saved.local === false);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof loadProject==="function") && (typeof idbGet==="function")', { timeout: 20000 });
    const reopened = await page.evaluate(async () => {
      const ok = await loadProject();
      return { ok, w: cW, h: cH, frames: frames.length };
    });
    check('the large project reopens from IndexedDB after refresh', reopened.ok === true && reopened.w === 128 && reopened.h === 128 && reopened.frames === 28, JSON.stringify(reopened));

    const blocked = await page.evaluate(async () => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { const e = new Error('blocked'); e.name = 'SecurityError'; throw e; };
      let ok;
      try { ok = await saveProject(); } catch (e) { ok = 'threw'; }
      const out = { ok, flag: window._projectSaved === true };
      Storage.prototype.setItem = real;
      return out;
    });
    check('blocked storage still reports a failed save', blocked.ok === false && blocked.flag === false, JSON.stringify(blocked));

    const noIdb = await page.evaluate(async () => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
      window.JVDS_IDB_FORCE_FAIL = true;
      let called = false;
      const orig = exportProjectFile;
      exportProjectFile = function () { called = true; };
      let ok;
      try { ok = await saveProject(); } catch (e) { ok = 'threw'; }
      const out = { ok, called, saved: window._projectSaved === true };
      exportProjectFile = orig;
      window.JVDS_IDB_FORCE_FAIL = false;
      Storage.prototype.setItem = real;
      return out;
    });
    check('no IndexedDB means a visible backup path, not a false save', noIdb.ok === false && noIdb.called && !noIdb.saved, JSON.stringify(noIdb));

    const auto = await page.evaluate(async () => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
      dirty = true;
      autoSave();
      await new Promise((r) => setTimeout(r, 800));
      const inIdb = await idbGet('auto');
      Storage.prototype.setItem = real;
      return { inIdb: !!inIdb };
    });
    check('autosave also uses IndexedDB when localStorage is full', auto.inIdb, JSON.stringify(auto));

    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('390 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 390', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- 1440: a medium project round-trips too ---------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof idbPut==="function"', { timeout: 20000 });

    const out = await page.evaluate(async (count) => {
      const size = 128;
      const layer = () => {
        const d = new Uint8ClampedArray(size * size * 4);
        for (let i = 0; i < d.length; i += 4) {
          const v = (i * 37) % 256;
          d[i] = v; d[i + 1] = (v + 80) % 256; d[i + 2] = (v + 160) % 256; d[i + 3] = 255;
        }
        return d;
      };
      applyProject({ v: 3, cW: size, cH: size, fps: 8, layers: [{ name: 'Layer 1', visible: true }],
        frames: Array.from({ length: count }, () => [layer()]) });
      const json = serializeProject();
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
      const ok = await saveProject();
      Storage.prototype.setItem = real;
      return { ok, bytes: json.length, saved: window._projectSaved === true };
    }, 12);
    check('1440: medium project saves to IndexedDB', out.ok === true && out.saved && out.bytes > 1000000, out.bytes + ' chars');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('typeof loadProject==="function" && typeof idbGet==="function"', { timeout: 20000 });
    const reopened = await page.evaluate(async () => {
      const ok = await loadProject();
      return { ok, w: cW, h: cH, frames: frames.length };
    });
    check('1440: project reopens from IndexedDB', reopened.ok === true && reopened.w === 128 && reopened.frames === 12, JSON.stringify(reopened));

    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('1440 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 1440', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PIXEL STUDIO INDEXEDDB CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
