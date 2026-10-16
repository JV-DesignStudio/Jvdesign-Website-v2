// A1588: a backup must include all three JVDS key families (jvds_*, jv_*, qb-*)
// and restore them on a clean profile; storage-migrate must be reversible.
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19293;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };

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
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

const SEED = {
  'jvds_pixel': JSON.stringify({ v: 2, cW: 8, cH: 8, frames: [[null]] }),
  'jv_arcade_slot_0': JSON.stringify({ title: 'Neon Wave', genre: 'SHOOTER' }),
  'qb-cards': JSON.stringify([{ id: 'q1', title: 'A quest' }]),
  'unrelated-key': 'do-not-touch'
};

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ---- Backup & Restore (390) -------------------------------------------
  {
    const errors = [];
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ServiceWorker|sw\.js/i.test(t)) errors.push('console: ' + t); } });
    page.on('dialog', (d) => d.accept());
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/tools/backup-restore.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('typeof collectLS === "function"');
    await page.evaluate((seed) => { Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, v)); }, SEED);

    const out = await page.evaluate(async () => {
      const keys = Object.keys(collectLS()).sort();
      // download path: capture the blob the anchor export builds
      const blobs = [];
      const origCreate = URL.createObjectURL;
      const origClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:jvds-test'; };
      HTMLAnchorElement.prototype.click = function () {};
      await exportJSON();
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
      const text = blobs[0] ? await blobs[0].text() : null;
      const parsed = text ? JSON.parse(text) : null;
      return {
        keys,
        excludesUnrelated: !keys.includes('unrelated-key'),
        familyCount: keys.filter((k) => k === 'jvds_pixel' || k === 'jv_arcade_slot_0' || k === 'qb-cards').length,
        exportedKeys: parsed && parsed.data ? Object.keys(parsed.data).sort() : [],
        backupText: text,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    });
    check('backup: collects jvds_*, jv_* and qb-* saves', out.familyCount === 3, out.keys.join(', '));
    check('backup: ignores unrelated keys', out.excludesUnrelated, out.keys.join(', '));
    check('backup: JSON export contains all three families', out.exportedKeys.join(',') === 'jv_arcade_slot_0,jvds_pixel,qb-cards', out.exportedKeys.join(','));
    check('backup: 390 no overflow', out.scrollWidth <= out.clientWidth + 2, `${out.scrollWidth}/${out.clientWidth}`);

    // clean profile, then restore from the file
    await page.evaluate(() => { ['jvds_pixel', 'jv_arcade_slot_0', 'qb-cards'].forEach((k) => localStorage.removeItem(k)); });
    const tmpFile = path.join(os.tmpdir(), 'jvds-backup-test-' + Date.now() + '.json');
    fs.writeFileSync(tmpFile, out.backupText);
    const input = await page.$('#fileIn');
    await input.uploadFile(tmpFile);
    await page.click('#btnImport');
    await page.waitForFunction('localStorage.getItem("jv_arcade_slot_0") !== null', { timeout: 10000 });
    const restored = await page.evaluate(() => ({
      pixel: localStorage.getItem('jvds_pixel') !== null,
      arcade: localStorage.getItem('jv_arcade_slot_0') !== null,
      planner: localStorage.getItem('qb-cards') !== null,
      unrelatedKept: localStorage.getItem('unrelated-key') === 'do-not-touch'
    }));
    check('backup: restores all three families on a clean profile', restored.pixel && restored.arcade && restored.planner, JSON.stringify(restored));
    check('backup: leaves unrelated keys alone', restored.unrelatedKept);
    check('backup: zero runtime errors', errors.length === 0, errors.join(' | '));
    fs.unlinkSync(tmpFile);
    await page.close();
  }

  // ---- Storage Migrate (1440) -------------------------------------------
  {
    const errors = [];
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ServiceWorker|sw\.js/i.test(t)) errors.push('console: ' + t); } });
    page.on('dialog', (d) => d.accept());
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/storage-migrate.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('typeof isJVDSKey === "function"');
    await page.evaluate((seed) => { Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, v)); }, SEED);

    const keyFam = await page.evaluate(() => ({ arcade: isJVDSKey('jv_arcade_slot_0'), pixel: isJVDSKey('jvds_pixel'), planner: isJVDSKey('qb-cards'), other: isJVDSKey('unrelated-key') }));
    check('migrate: recognises jvds_*, jv_* and qb-* keys', keyFam.arcade && keyFam.pixel && keyFam.planner && !keyFam.other, JSON.stringify(keyFam));

    await page.click('#btnMigrate');
    await page.waitForFunction('document.getElementById("status").textContent.indexOf("Migrated") === 0 || document.getElementById("status").textContent.indexOf("Migrated") >= 0', { timeout: 15000 });
    await page.evaluate(() => { ['jvds_pixel', 'jv_arcade_slot_0', 'qb-cards'].forEach((k) => localStorage.removeItem(k)); });
    await page.click('#btnRestoreIDB');
    await page.waitForFunction('localStorage.getItem("jv_arcade_slot_0") !== null', { timeout: 15000 });
    const back = await page.evaluate(() => ({
      pixel: localStorage.getItem('jvds_pixel') !== null,
      arcade: localStorage.getItem('jv_arcade_slot_0') !== null,
      planner: localStorage.getItem('qb-cards') !== null,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    check('migrate: is reversible (restores all three families to localStorage)', back.pixel && back.arcade && back.planner, JSON.stringify(back));
    check('migrate: 1440 no overflow', back.scrollWidth <= back.clientWidth + 2, `${back.scrollWidth}/${back.clientWidth}`);
    check('migrate: zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL BACKUP & STORAGE CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
