// Pixel Studio modal coordinator regression test (A3173).
// Proves that only one dialog is open at a time, that a queued popup waits
// for the current one to close, and that notifications wait until the
// workspace is reachable again.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!cond) failures++;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('jvds-cookie-consent', 'declined');
      localStorage.setItem('jvds_pixel_mode', 'draw');
      // A restorable autosave makes setupAutosave ask for the restore dialog.
      localStorage.setItem('jvds_pixel_auto', JSON.stringify({ frames: [[1]], cols: 16, rows: 16 }));
      localStorage.removeItem('jvds_pixel_seen');
    } catch (e) {}
  });

  await page.goto('http://127.0.0.1:' + port + '/tools/pixel-studio.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);
  await page.evaluate(() => {
    const cb = document.getElementById('cookie-banner');
    if (cb) cb.remove();
  });

  const initial = await page.evaluate(() => {
    const open = Array.from(document.querySelectorAll('.modal-overlay.open')).map(o => o.id);
    const overlay = window.JVDSStudio && window.JVDSStudio.overlay;
    return {
      open,
      hasOverlay: !!overlay,
      blocking: overlay ? overlay.blocking() : null,
      count: overlay ? overlay.count() : null
    };
  });
  ok('shared coordinator is available', initial.hasOverlay);
  ok('exactly one dialog opens on load', initial.open.length === 1, JSON.stringify(initial.open));
  ok('the restore dialog is the one shown', initial.open[0] === 'restoreModal', JSON.stringify(initial.open));
  ok('coordinator reports one blocking overlay', initial.count === 1 && initial.blocking === true, 'count=' + initial.count);

  const queued = await page.evaluate(() => {
    window.__coordRan = 0;
    window.JVDSStudio.overlay.queue(function () { window.__coordRan++; });
    return { ran: window.__coordRan, pending: window.JVDSStudio.overlay.pending() };
  });
  ok('a queued popup waits while a dialog is open', queued.ran === 0 && queued.pending === 1, JSON.stringify(queued));

  await page.evaluate(() => { window.JVDSStudio.toast('COORD_TOAST'); });
  await sleep(120);
  const toastHidden = await page.evaluate(() => {
    const stack = document.querySelector('.jvs-toast-stack');
    return !stack || !Array.from(stack.querySelectorAll('.jvs-toast')).some(t => t.textContent.indexOf('COORD_TOAST') !== -1);
  });
  ok('notifications wait while a dialog is open', toastHidden);

  await page.evaluate(() => { window.discardAutosave(); });
  await sleep(400);

  const afterClose = await page.evaluate(() => {
    const open = Array.from(document.querySelectorAll('.modal-overlay.open')).map(o => o.id);
    const c = document.getElementById('main-canvas');
    const r = c ? c.getBoundingClientRect() : null;
    let top = null;
    if (r) top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      open,
      ran: window.__coordRan,
      pending: window.JVDSStudio.overlay.pending(),
      blocking: window.JVDSStudio.overlay.blocking(),
      modalBody: document.body.classList.contains('ps-modal-open'),
      toast: (function () {
        const s = document.querySelector('.jvs-toast-stack');
        if (!s) return '';
        return Array.from(s.querySelectorAll('.jvs-toast')).map(t => t.textContent).join(' ');
      })(),
      canvasOnTop: !!(c && top && (top === c || c.contains(top) || (top.contains && top.contains(c))))
    };
  });
  ok('no dialog remains after the first dismiss', afterClose.open.length === 0, JSON.stringify(afterClose.open));
  ok('the queued popup runs after the dismiss', afterClose.ran === 1 && afterClose.pending === 0, 'ran=' + afterClose.ran + ' pending=' + afterClose.pending);
  ok('the workspace is reachable again', afterClose.blocking === false && afterClose.modalBody === false);
  ok('the canvas is interactive after the first dismiss', afterClose.canvasOnTop);
  ok('the deferred notification appears after the dismiss', afterClose.toast === 'COORD_TOAST', JSON.stringify(afterClose.toast));

  const stacked = await page.evaluate(() => {
    window.openModal('keysModal');
    window.openModal('gifModal');
    return Array.from(document.querySelectorAll('.modal-overlay.open')).map(o => o.id);
  });
  ok('a second popup cannot stack on the first', stacked.length === 1 && stacked[0] === 'keysModal', JSON.stringify(stacked));

  await page.evaluate(() => { window.closeModal('keysModal'); });
  await sleep(300);
  const nextOpen = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay.open')).map(o => o.id));
  ok('the second popup opens when the first closes', nextOpen.length === 1 && nextOpen[0] === 'gifModal', JSON.stringify(nextOpen));

  await page.evaluate(() => { window.closeModal('gifModal'); });

  ok('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log('');
  if (failures) {
    console.log(failures + ' FAILURES');
    process.exit(1);
  }
  console.log('ALL MODAL COORDINATOR CHECKS PASSED');
})();
