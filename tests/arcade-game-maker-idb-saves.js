#!/usr/bin/env node
/*
 * tests/arcade-game-maker-idb-saves.js
 * A2675: project saves and autosave live in IndexedDB. A large project is
 * written without a localStorage mirror so the main thread is not blocked,
 * small saves keep the mirror for older readers, and legacy localStorage
 * saves migrate into IndexedDB once on startup.
 * Run: node tests/arcade-game-maker-idb-saves.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_IDB_PORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const idbGet = (page, key) => page.evaluate((k) => new Promise((resolve) => {
  const req = indexedDB.open('jvds_arcade_maker');
  req.onerror = () => resolve(null);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('saves')) return resolve(null);
    const tx = db.transaction('saves', 'readonly');
    const get = tx.objectStore('saves').get(k);
    get.onsuccess = () => resolve(get.result ? get.result.value : null);
    get.onerror = () => resolve(null);
  };
}), key);

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
  await page.setViewport({ width:1280, height:900 });

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout:15000 });
    await page.waitForFunction(() => typeof window._agmSaveSet === 'function', { timeout:15000 });

    // Force a payload above the localStorage mirror ceiling.
    const large = await page.evaluate(async () => {
      window.compileAndBootEngine = function() {};
      customSpriteDataUrl = 'data:image/png;base64,' + 'A'.repeat(320000);
      document.getElementById('gameTitle').value = 'IDB Large Save';
      saveToSlot(0, true);
      await new Promise(r => setTimeout(r, 700));
      return {
        localBytes: (localStorage.getItem('jv_arcade_slot_0') || '').length,
        cache: !!_slotData('jv_arcade_slot_0')
      };
    });
    const idbLarge = await idbGet(page, 'jv_arcade_slot_0');
    check('large save has no localStorage mirror', large.localBytes === 0, String(large.localBytes));
    check('large save is stored in IndexedDB', !!idbLarge && idbLarge.length > 300000, idbLarge ? idbLarge.length + ' bytes' : 'missing');
    check('slot cache keeps the saved title', large.cache === true);

    const loaded = await page.evaluate(async () => {
      document.getElementById('gameTitle').value = 'Changed';
      await loadFromSlot(0);
      return document.getElementById('gameTitle').value;
    });
    check('slot loads back from IndexedDB', loaded === 'IDB Large Save', loaded);

    // Autosave with a large payload uses IDB plus a small marker.
    const auto = await page.evaluate(async () => {
      customSpriteDataUrl = 'data:image/png;base64,' + 'B'.repeat(320000);
      _scheduleAutoSave();
      await new Promise(r => setTimeout(r, 3200));
      return {
        localBytes: (localStorage.getItem('jv_arcade_autosave') || '').length,
        meta: localStorage.getItem('jv_arcade_autosave_meta')
      };
    });
    const idbAuto = await idbGet(page, 'jv_arcade_autosave');
    check('large autosave has no localStorage mirror', auto.localBytes === 0, String(auto.localBytes));
    check('large autosave writes a small marker', !!auto.meta && auto.meta.length < 300, auto.meta || 'missing');
    check('large autosave is stored in IndexedDB', !!idbAuto && idbAuto.length > 300000, idbAuto ? idbAuto.length + ' bytes' : 'missing');

    // Small saves still mirror for older synchronous readers.
    const small = await page.evaluate(async () => {
      customSpriteDataUrl = null;
      document.getElementById('gameTitle').value = 'IDB Small Save';
      saveToSlot(2, true);
      await new Promise(r => setTimeout(r, 500));
      return (localStorage.getItem('jv_arcade_slot_2') || '').length;
    });
    check('small save keeps the localStorage mirror', small > 0, String(small));

    // Legacy localStorage records migrate into IndexedDB on the next load.
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        const req = indexedDB.open('jvds_arcade_maker');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').delete('jv_arcade_slot_3');
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        };
        req.onerror = resolve;
      });
      localStorage.setItem('jv_arcade_slot_3', JSON.stringify({ v:1, title:'Legacy save', genre:'SHOOTER', speed:200, gravity:600, jump:450 }));
    });
    await page.reload({ waitUntil:'load' });
    await page.waitForSelector('#runGameBtn', { timeout:15000 });
    await sleep(1500);
    const idbLegacy = await idbGet(page, 'jv_arcade_slot_3');
    check('legacy localStorage save migrates to IndexedDB', !!idbLegacy && /Legacy save/.test(idbLegacy), idbLegacy ? 'present' : 'missing');

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker IndexedDB saves: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
