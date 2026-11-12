#!/usr/bin/env node
/* Storage quota guard (A2320).
 *
 * Proves the shared Studio Core notices a real QuotaExceededError instead of
 * letting a save fail silently, that it opens the recovery drawer, and that
 * snapshots can still be written before the browser is full.
 *
 * Run: node tests/storage-quota-guard.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2'
};

let failures = 0;
function check(name, ok, detail) {
  console.log('  ' + (ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port + '/tools/code-snippet-generator.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#jvsStudioFab', { timeout: 10000 });

    const hooked = await page.evaluate(() => !!(window.Storage && window.Storage.prototype.__jvsQuotaHooked));
    check('storage writes are wrapped', hooked);

    const snapshot = await page.evaluate(async () => {
      localStorage.setItem('jvds_test_snapshot_key', 'keep me');
      await window.JVDSStudio.storage.saveSnapshot({ label: 'Before full', tool: 'test', saves: { jvds_test_snapshot_key: 'keep me' }, keep: 3 });
      const rows = await window.JVDSStudio.storage.list();
      return rows.length;
    });
    check('snapshots save before the browser is full', snapshot >= 1, String(snapshot));

    const quota = await page.evaluate(async () => {
      const chunk = 'x'.repeat(1024 * 1024);
      let i = 0;
      let failed = false;
      for (; i < 20; i++) {
        try { localStorage.setItem('__jvds_fill_' + i, chunk); }
        catch (e) { failed = true; break; }
      }
      let toast = null;
      let sheet = null;
      for (let wait = 0; wait < 25; wait++) {
        toast = document.querySelector('.jvs-toast[data-tone="danger"]');
        sheet = document.querySelector('.jvs-sheet');
        if (toast && sheet && sheet.getAttribute('data-open') === 'true') break;
        await new Promise((r) => setTimeout(r, 100));
      }
      const result = {
        failed,
        filled: i,
        toast: toast ? toast.textContent : '',
        drawer: sheet ? sheet.getAttribute('data-open') : ''
      };
      for (let j = 0; j <= i; j++) { try { localStorage.removeItem('__jvds_fill_' + j); } catch (e) {} }
      if (sheet) {
        const close = sheet.querySelector('.jvs-sheet-close');
        if (close) close.click();
      }
      return result;
    });
    check('a real quota error was produced', quota.failed, 'filled ' + quota.filled + ' MB');
    check('the learner sees a clear warning', /Storage is nearly full/i.test(quota.toast), quota.toast.slice(0, 80));
    check('the recovery drawer opens', quota.drawer === 'true');

    const stillThere = await page.evaluate(async () => {
      const value = localStorage.getItem('jvds_test_snapshot_key');
      const rows = await window.JVDSStudio.storage.list();
      await window.JVDSStudio.storage.clear();
      return { value, rows: rows.length };
    });
    check('the failure does not delete existing work', stillThere.value === 'keep me');
    check('snapshots survive the failure', stillThere.rows >= 1, String(stillThere.rows));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\nStorage quota guard: ' + failures + ' failure(s).');
    process.exit(1);
  }
  console.log('\nStorage quota guard: all checks passed.');
})().catch((err) => {
  console.error('Harness error:', err);
  try { server.close(); } catch (e) {}
  process.exit(1);
});
