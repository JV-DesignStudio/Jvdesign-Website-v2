#!/usr/bin/env node
/* A1991: save, reload, close and reopen must restore a learner's work, and a
   failed save must be visible rather than silently swallowed. Runs the real
   shared save code in Chromium on an isolated origin:

   - JVDSEngine.save round-trips, rejects corrupt data and reports a full quota,
   - every READY arcade game uses the shared save module,
   - GameSystem saves survive reload and a fresh tab, and a blocked save shows
     the visible "not saving" alert,
   - Pixel Studio's own save survives reload and reports a full storage box. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const GAME_PATH = '/games/echos-flight.html';
const GAME_KEY = 'jvds_game_echo-flight';
const TOOL_PATH = '/tools/pixel-studio.html';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function resolveFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (clean === '' || clean.endsWith('/')) clean += 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}

(async () => {
  const server = http.createServer((req, res) => {
    const file = resolveFile(req.url || '/');
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const failures = [];
  let browser;
  try {
    // 1. Every READY arcade game must use the shared save module (A1991 gate).
    const registry = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'games-registry.js'), 'utf8'), registry);
    const readyGames = (registry.window.JVDS_GAMES || []).filter(g =>
      !g.classroom && String(g.quality || '').toUpperCase() === 'READY');
    assert.ok(readyGames.length >= 8, 'expected the shipped arcade line-up, found ' + readyGames.length);
    for (const game of readyGames) {
      const html = fs.readFileSync(path.join(root, 'games', game.file), 'utf8');
      assert.match(html, /game-system\.js/, game.id + ' is labelled READY but does not load the shared save module');
      assert.match(html, /game-system-save\.js/, game.id + ' is labelled READY but does not load game-system-save.js');
    }
    console.log('PASS: all ' + readyGames.length + ' READY games use the shared save module');

    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 60000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const makePage = async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.evaluateOnNewDocument(() => {
        window.__storageFail = false;
        const real = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (window.__storageFail) throw new DOMException('Storage is full', 'QuotaExceededError');
          return real.call(this, key, value);
        };
      });
      return { page, errors };
    };

    // 2. Shared save module contract.
    const { page, errors } = await makePage();
    await page.goto(base + GAME_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.JVDSEngine && window.JVDSEngine.save && window.GameSystem), { timeout: 20000 });
    let contract = await page.evaluate(() => {
      const save = window.JVDSEngine.save;
      const available = save.available();
      const wrote = save.persist('jvds_probe_save', { xp: 5, highScore: 3 });
      const loaded = save.load('jvds_probe_save');
      localStorage.setItem('jvds_probe_corrupt', 'not json');
      const corrupt = save.load('jvds_probe_corrupt');
      window.__storageFail = true;
      const blockedWrite = save.persist('jvds_probe_save', { xp: 6 });
      const blockedAvailable = save.available();
      window.__storageFail = false;
      return { available, wrote, loaded, corrupt, blockedWrite, blockedAvailable };
    });
    assert.equal(contract.available, true, 'storage probe claims storage is unavailable before anything failed');
    assert.equal(contract.wrote, true, 'a normal save did not report success');
    assert.equal(contract.loaded.xp, 5, 'a saved value did not load back');
    assert.equal(contract.corrupt, null, 'corrupt save data was not rejected');
    assert.equal(contract.blockedWrite, false, 'a full quota save still reported success');
    assert.equal(contract.blockedAvailable, false, 'available() did not notice a blocked storage box');
    console.log('PASS: shared save round-trip, corrupt data and full-quota reporting');

    // 3. GameSystem save survives reload and a fresh tab.
    await page.evaluate(() => {
      const game = window.GameSystem.lastInstance;
      game.state.xp = 42;
      game.state.highScore = 7;
      game.state.achievements = ['first'];
      window.__saveOk = game.saveState();
    });
    assert.equal(await page.evaluate(() => window.__saveOk), true, 'GameSystem did not report a successful save');
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), GAME_KEY);
    assert.equal(stored.xp, 42, 'the game save was not written to localStorage');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.GameSystem && window.GameSystem.lastInstance), { timeout: 20000 });
    const afterReload = await page.evaluate(() => window.GameSystem.lastInstance.state);
    assert.equal(afterReload.xp, 42, 'game progress was lost on reload');
    assert.equal(afterReload.highScore, 7, 'game best score was lost on reload');

    const second = await makePage();
    await second.page.goto(base + GAME_PATH, { waitUntil: 'domcontentloaded' });
    await second.page.waitForFunction(() => !!(window.GameSystem && window.GameSystem.lastInstance), { timeout: 20000 });
    const afterReopen = await second.page.evaluate(() => window.GameSystem.lastInstance.state);
    assert.equal(afterReopen.xp, 42, 'game progress was lost in a new tab');
    await second.page.close();
    console.log('PASS: game progress survives reload and a freshly opened tab');

    // 4. A blocked game save is visible, not silent.
    const blocked = await page.evaluate(() => {
      window.__storageFail = true;
      const game = window.GameSystem.lastInstance;
      game.state.xp = 99;
      const ok = game.saveState();
      const notice = document.getElementById('jvds-save-failed');
      const out = {
        ok,
        flag: !!game.saveFailed,
        notice: !!notice,
        role: notice && notice.getAttribute('role'),
        text: notice ? notice.textContent : '',
        link: notice ? notice.querySelector('a[href="/me.html"]') != null : false
      };
      window.__storageFail = false;
      return out;
    });
    assert.equal(blocked.ok, false, 'a blocked save still reported success');
    assert.equal(blocked.flag, true, 'the game instance did not record the failed save');
    assert.equal(blocked.notice, true, 'no visible notice appeared for a blocked save');
    assert.equal(blocked.role, 'alert', 'the save notice is not announced to assistive tech');
    assert.match(blocked.text, /not saving your game progress/i, 'the notice does not say progress is not saving');
    assert.match(blocked.text, /lost when you close/i, 'the notice does not explain what happens to the work');
    assert.equal(blocked.link, true, 'the save notice does not link to the backpack');
    assert.equal(errors.length, 0, 'page errors while saving: ' + errors.slice(0, 2).join(' | '));
    console.log('PASS: a blocked game save shows a visible alert with a backpack link');

    // 5. Pixel Studio: save survives reload, and a full box is reported.
    await page.goto(base + TOOL_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.saveProject === 'function', { timeout: 30000 });
    const toolSave = await page.evaluate(() => {
      const ok = window.saveProject();
      return { ok, saved: window._projectSaved, has: !!localStorage.getItem('jvds_pixel') };
    });
    assert.equal(toolSave.ok, true, 'Pixel Studio did not report a successful save');
    assert.equal(toolSave.saved, true, 'Pixel Studio did not mark the project saved');
    assert.equal(toolSave.has, true, 'Pixel Studio did not write its project');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.loadProject === 'function', { timeout: 30000 });
    assert.equal(await page.evaluate(() => !!localStorage.getItem('jvds_pixel')), true, 'Pixel Studio project was lost on reload');
    await page.evaluate(() => window.loadProject());
    assert.equal(await page.evaluate(() => window._projectSaved !== false), true, 'Pixel Studio failed to load its saved project');

    const toolFail = await page.evaluate(() => {
      window.__storageFail = true;
      const ok = window.saveProject();
      const out = {
        ok,
        saved: window._projectSaved,
        toast: (document.getElementById('toast') || {}).textContent || ''
      };
      window.__storageFail = false;
      return out;
    });
    assert.equal(toolFail.ok, false, 'Pixel Studio reported success when storage was full');
    assert.equal(toolFail.saved, false, 'Pixel Studio still marked the project saved when storage was full');
    assert.match(toolFail.toast, /storage|export png|blocks browser saving/i, 'Pixel Studio gave no clear save-failure message');
    console.log('PASS: Pixel Studio save survives reload and reports a full storage box');
  } catch (err) {
    failures.push(err.stack || err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('save/restore test failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log('save/restore test passed.');
})();
