#!/usr/bin/env node
/*
 * tests/pixel-studio-device-limits.js
 * School-computer reality (A2805): the flagship creation flow must not crash and
 * must still let a learner keep the work when the browser blocks storage, the
 * storage box is full, or a download is refused.
 *
 * Run: node tests/pixel-studio-device-limits.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PSLIMITS_PORT || 8148;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
}

const HOSTILE_STORAGE = () => {
  const realSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (window.__blockStorage) throw new DOMException('blocked by policy', 'SecurityError');
    if (window.__quotaStorage) throw new DOMException('box is full', 'QuotaExceededError');
    return realSet.call(this, k, v);
  };
};

function draw(page) {
  return page.evaluate(() => {
    setCanvasSize(8, 8, false);
    frames = [[new ImageData(8, 8)]];
    frameMeta = [{ clip: 'idle', hold: 1 }];
    currentFrame = 0; currentLayer = 0;
    setPixel(getID(), 1, 1, 255, 0, 0, 255);
    renderAll();
    window.__downloads = [];
    window.JVDS_DOWNLOAD = function (canvas, name) { window.__downloads.push({ w: canvas.width, h: canvas.height, name: name }); };
    return { px: getPixel(getID(), 1, 1) };
  });
}

function toastText(page) {
  return page.evaluate(() => {
    const t = document.getElementById('toast');
    return t ? t.textContent.trim() : '';
  });
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const errors = [];

  async function freshPage() {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.evaluateOnNewDocument(HOSTILE_STORAGE);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay.open, .modal.open').forEach(m => m.classList.remove('open'));
      document.body.classList.remove('ps-modal-open', 'ps-focus');
      if (window.closeStart) { try { closeStart(); } catch (e) {} }
    });
    return page;
  }

  try {
    // 1. Storage blocked outright (SecurityError). Save must fail loudly and
    //    Export PNG must still keep the work.
    const page = await freshPage();
    const drawn = await draw(page);
    check('draws while storage is blocked', Array.isArray(drawn.px) && drawn.px[0] === 255, JSON.stringify(drawn.px));

    const blocked = await page.evaluate(() => {
      window.__blockStorage = true;
      const ok = saveProject();
      return {
        ok: ok,
        saved: !!window._projectSaved,
        storageBlocked: !!window._storageBlocked,
        keep: (document.querySelector('[data-keep-state]') || {}).getAttribute ? document.querySelector('[data-keep-state]').getAttribute('data-state') : '',
        toast: (document.getElementById('toast') || {}).textContent || ''
      };
    });
    check('blocked save does not claim success', blocked.ok === false && blocked.saved === false, JSON.stringify(blocked));
    check('blocked save explains export', blocked.storageBlocked === true && /block|export png/i.test(blocked.toast), blocked.toast);
    check('keep state shows blocked', blocked.keep === 'blocked', blocked.keep);

    const kept = await page.evaluate(() => {
      window.__blockStorage = false;
      exportPNG();
      return window.__downloads && window.__downloads[0];
    });
    check('Export PNG still works when saving is blocked', !!kept && kept.w === 8 && kept.h === 8, JSON.stringify(kept));

    // 2. Storage box full (QuotaExceededError). Save fails, offers a backup,
    //    and Export PNG still works.
    const quota = await page.evaluate(() => {
      window.__quotaStorage = true;
      window.__backupCalled = false;
      const orig = window.exportProjectFile;
      window.exportProjectFile = function () { window.__backupCalled = true; };
      const ok = saveProject();
      window.__quotaStorage = false;
      window.exportProjectFile = orig;
      return {
        ok: ok,
        saved: !!window._projectSaved,
        backup: !!window.__backupCalled,
        toast: (document.getElementById('toast') || {}).textContent || '',
        downloads: (window.__downloads || []).length
      };
    });
    check('full storage fails visibly and offers a backup', quota.ok === false && quota.saved === false && quota.backup === true, JSON.stringify(quota));
    check('full storage names a way to keep the work', /storage full|export png|backup/i.test(quota.toast), quota.toast);

    const keptFull = await page.evaluate(() => {
      const before = (window.__downloads || []).length;
      exportPNG();
      return (window.__downloads || []).length - before;
    });
    check('Export PNG still works when storage is full', keptFull === 1, String(keptFull));

    // 3. A refused download must be caught, not thrown at the learner.
    const refused = await page.evaluate(() => {
      window.JVDS_DOWNLOAD = function () { throw new Error('download blocked'); };
      let threw = false;
      try { exportPNG(); } catch (e) { threw = true; }
      return { threw: threw, toast: (document.getElementById('toast') || {}).textContent || '' };
    });
    check('a refused download is caught', refused.threw === false, JSON.stringify(refused));
    check('a refused download tells the learner', /export failed|try again|smaller/i.test(refused.toast), refused.toast);

    check('no uncaught errors on a locked-down profile', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();

    // 4. A normal profile still saves and exports, so the guard above did not
    //    break the happy path.
    const normal = await freshPage();
    await normal.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await draw(normal);
    const happy = await normal.evaluate(() => {
      const ok = saveProject();
      const before = (window.__downloads || []).length;
      exportPNG();
      return { ok: ok, saved: !!window._projectSaved, downloads: (window.__downloads || []).length - before };
    });
    check('normal profile still saves', happy.ok === true && happy.saved === true, JSON.stringify(happy));
    check('normal profile still exports', happy.downloads === 1, String(happy.downloads));
    await normal.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? '\nFAILURES PRESENT (' + failures + ')' : '\nALL SCHOOL-DEVICE LIMIT CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
