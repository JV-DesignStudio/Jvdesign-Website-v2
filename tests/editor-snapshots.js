const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19286;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
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
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ERR_BLOCKED/.test(text)) return;
      errors.push('console: ' + text);
    });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => window.JVDSStudio && JVDSStudio.panel, { timeout: 15000 });
    await wait(600);

    const ready = await page.evaluate(async () => {
      localStorage.setItem('tabletop_test_state', JSON.stringify({ coins: 1 }));
      JVDSStudio.settings.set('keepRevisions', 10);
      await JVDSStudio.storage.clear();
      JVDSStudio.panel.toggle();
      return !!document.getElementById('jvsSnapshotName') && !!document.getElementById('jvsSnapshotSave');
    });
    check('snapshot name and save controls exist', ready);

    async function save(name, coins) {
      await page.evaluate((n, c) => {
        localStorage.setItem('tabletop_test_state', JSON.stringify({ coins: c }));
        document.getElementById('jvsSnapshotName').value = n;
        document.getElementById('jvsSnapshotSave').click();
      }, name, coins);
      await page.waitForFunction((n) => [...document.querySelectorAll('.jvs-list strong')].some(el => el.textContent === n), { timeout: 8000 }, name).catch(() => {});
    }
    await save('Snapshot A', 1);
    await save('Snapshot B', 2);
    await save('Snapshot C', 3);

    const listed = await page.evaluate(() => [...document.querySelectorAll('.jvs-list strong')].map(el => el.textContent));
    check('three named snapshots are listed', ['Snapshot A', 'Snapshot B', 'Snapshot C'].every(n => listed.includes(n)), listed.join(' | '));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.JVDSStudio && JVDSStudio.panel, { timeout: 15000 });
    await wait(500);
    await page.evaluate(() => JVDSStudio.panel.toggle());
    await page.waitForFunction(() => [...document.querySelectorAll('.jvs-list strong')].some(el => el.textContent === 'Snapshot A'), { timeout: 8000 }).catch(() => {});
    const afterReload = await page.evaluate(() => [...document.querySelectorAll('.jvs-list strong')].map(el => el.textContent));
    check('snapshots survive a reload', ['Snapshot A', 'Snapshot B', 'Snapshot C'].every(n => afterReload.includes(n)), afterReload.join(' | '));

    await page.evaluate(() => localStorage.setItem('tabletop_test_state', JSON.stringify({ coins: 99 })));
    const clicked = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.jvs-list li')].find(li => /Snapshot A/.test(li.textContent));
      if (!row) return false;
      const btn = [...row.querySelectorAll('button')].find(b => /Restore/i.test(b.textContent));
      if (!btn) return false;
      btn.click();
      return true;
    });
    check('a snapshot can be restored', clicked);

    const warned = await page.waitForFunction(() => [...document.querySelectorAll('button.jvs-btn-primary')].some(b => /Restore/i.test(b.textContent)), { timeout: 5000 }).then(() => true).catch(() => false);
    check('restore asks before replacing work', warned);
    const beforeConfirm = await page.evaluate(() => localStorage.getItem('tabletop_test_state'));
    check('current work is kept until confirm', /99/.test(beforeConfirm || ''), beforeConfirm);

    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button.jvs-btn-primary')].find(x => /Restore/i.test(x.textContent));
      if (b) b.click();
    });
    await wait(2000);
    const restored = await page.evaluate(() => localStorage.getItem('tabletop_test_state'));
    check('restore brings the snapshot back', /"coins":1/.test(restored || ''), restored);

    await page.setViewport({ width: 1440, height: 900 });
    await page.waitForFunction(() => window.JVDSStudio && JVDSStudio.panel, { timeout: 15000 });
    await wait(400);
    await page.evaluate(() => { if (!document.getElementById('jvsSnapshotName')) JVDSStudio.panel.toggle(); });
    await page.waitForFunction(() => document.querySelectorAll('.jvs-list strong').length > 0, { timeout: 8000 }).catch(() => {});
    const wide = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
      names: [...document.querySelectorAll('.jvs-list strong')].map(el => el.textContent)
    }));
    check('1440 snapshot list is intact', ['Snapshot A', 'Snapshot B', 'Snapshot C'].every(n => wide.names.includes(n)), wide.names.join(' | '));
    check('1440 has no horizontal overflow', wide.overflow);

    for (const slug of ['pixel-studio', 'sound-studio', 'buildlab']) {
      const studio = await browser.newPage();
      studio.on('pageerror', (e) => errors.push(slug + ' pageerror: ' + e.message));
      await studio.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await studio.goto('http://127.0.0.1:' + port + '/tools/' + slug + '.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
      const present = await studio.waitForFunction(() => window.JVDSStudio && JVDSStudio.panel, { timeout: 20000 }).then(() => studio.evaluate(() => {
        if (!document.getElementById('jvsSnapshotName')) JVDSStudio.panel.toggle();
        return !!document.getElementById('jvsSnapshotName') && !!document.getElementById('jvsSnapshotSave');
      })).catch(() => false);
      check(slug + ' exposes named snapshots', present);
      await studio.close();
    }

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nEDITOR SNAPSHOTS CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
