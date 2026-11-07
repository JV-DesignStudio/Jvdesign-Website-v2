// BuildLab A2748: camera bookmarks save and restore viewing angles by click or
// Alt + number, persist locally, and travel with save slots.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19280;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
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
function listen() { return new Promise(resolve => server.listen(port, resolve)); }
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
async function load(page) {
  await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
  await pause(900);
  await dismiss(page);
}
const state = page => page.evaluate(() => window.getCameraBookmarkState());
const names = page => page.evaluate(() => window.getCameraBookmarks().map(b => b.name));

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'mobile', w: 390, h: 844, m: true }, { name: 'desktop', w: 1440, h: 900, m: false }]) {
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
      await load(page);
      await page.evaluate(() => {
        try { localStorage.removeItem('buildlab_autosave'); localStorage.removeItem('buildlab_camera_bookmarks'); localStorage.setItem('buildlab_kidmode', '0'); } catch (e) {}
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);

      const defaults = await page.evaluate(() => ({
        list: window.getCameraBookmarks().map(b => b.name),
        desktopItems: document.querySelectorAll('#bookmarkList .history-item').length,
        mobileItems: document.querySelectorAll('#mobBookmarkList .history-item').length,
        hasPanel: !!document.getElementById('bookmarkList'),
        hasMobile: !!document.getElementById('mobBookmarkList'),
      }));
      check(vp.name + ': bookmark lists exist', defaults.hasPanel && defaults.hasMobile);
      check(vp.name + ': default camera views seeded', defaults.list.length >= 3 && ['Overview', 'Front', 'Top'].every(n => defaults.list.includes(n)), defaults.list.join(', '));
      if (!vp.m) check('desktop: default views render in the panel', defaults.desktopItems >= 3, String(defaults.desktopItems));

      // Save a custom view from the right camera angle.
      const saved = await page.evaluate(async () => {
        window.setCameraView('right');
        await new Promise(r => setTimeout(r, 120));
        const input = document.getElementById('bookmarkName');
        input.value = 'Right side';
        document.querySelector('#bookmarkPanel [data-on="saveCameraBookmark"]').click();
        await new Promise(r => setTimeout(r, 200));
        return {
          names: window.getCameraBookmarks().map(b => b.name),
          stored: localStorage.getItem('buildlab_camera_bookmarks') || '',
          state: window.getCameraBookmarkState(),
        };
      });
      check(vp.name + ': save adds a named view', saved.names.includes('Right side') && /Right side/.test(saved.stored), saved.names.join(', '));
      check(vp.name + ': saved view captured the camera', Math.abs(saved.state.theta - (-Math.PI / 2)) < 0.01 && Math.abs(saved.state.phi - Math.PI / 2) < 0.01, JSON.stringify(saved.state));

      // Restore by clicking the row.
      const restored = await page.evaluate(async () => {
        window.setCameraView('top');
        await new Promise(r => setTimeout(r, 100));
        const rows = Array.from(document.querySelectorAll('#bookmarkList .history-item'));
        const row = rows.find(el => /Right side/.test(el.textContent || ''));
        if (!row) return { clicked: false };
        row.click();
        await new Promise(r => setTimeout(r, 200));
        return { clicked: true, state: window.getCameraBookmarkState() };
      });
      check(vp.name + ': clicking a view restores the angle', restored.clicked && Math.abs(restored.state.theta - (-Math.PI / 2)) < 0.01 && Math.abs(restored.state.phi - Math.PI / 2) < 0.01, JSON.stringify(restored));

      // Alt + number.
      const hotkey = await page.evaluate(async () => {
        window.setCameraView('top');
        await new Promise(r => setTimeout(r, 100));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 200));
        return window.getCameraBookmarkState();
      });
      check(vp.name + ': Alt+1 restores bookmark 1', Math.abs(hotkey.theta - 0.7) < 0.01 && Math.abs(hotkey.phi - 0.75) < 0.01, JSON.stringify(hotkey));

      // Persists across reload.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);
      const persisted = await names(page);
      check(vp.name + ': bookmarks persist after reload', persisted.includes('Right side'), persisted.join(', '));

      // Save slots carry the bookmarks.
      const slot = await page.evaluate(async () => {
        window.quickBuild('house');
        await new Promise(r => setTimeout(r, 250));
        const before = window.getCameraBookmarks().map(b => b.name);
        window.saveToSlot(0);
        const idx = window.getCameraBookmarks().findIndex(b => b.name === 'Right side');
        if (idx >= 0) window.deleteCameraBookmark(idx);
        const afterDelete = window.getCameraBookmarks().map(b => b.name);
        window.loadSlot(0);
        await new Promise(r => setTimeout(r, 400));
        return { before, afterDelete, afterLoad: window.getCameraBookmarks().map(b => b.name) };
      });
      check(vp.name + ': save slots carry camera bookmarks', slot.afterDelete.includes('Right side') === false && slot.afterLoad.includes('Right side'), JSON.stringify(slot));

      if (vp.m) {
        await page.evaluate(() => { if (typeof window.mobTab === 'function') window.mobTab('actions'); });
        await pause(350);
        const mob = await page.evaluate(async () => {
          const items = document.querySelectorAll('#mobBookmarkList .history-item').length;
          const input = document.getElementById('mobBookmarkName');
          input.value = 'Mobile view';
          const btn = document.querySelector('#mobBookmarkList')?.closest('#mob-panel-actions')?.querySelector('[data-on="saveCameraBookmark"]');
          if (btn) btn.click();
          await new Promise(r => setTimeout(r, 200));
          return { items, names: window.getCameraBookmarks().map(b => b.name) };
        });
        check('mobile: drawer lists bookmarks', mob.items >= 3, String(mob.items));
        check('mobile: mobile save works', mob.names.includes('Mobile view'), mob.names.join(', '));
      } else {
        const deleted = await page.evaluate(async () => {
          const rows = Array.from(document.querySelectorAll('#bookmarkList .bookmark-row'));
          const row = rows.find(el => /Right side/.test(el.textContent || ''));
          const del = row && row.querySelector('[data-on="deleteCameraBookmark"]');
          if (del) del.click();
          await new Promise(r => setTimeout(r, 200));
          return window.getCameraBookmarks().map(b => b.name);
        });
        check('desktop: deleting a view removes it', deleted.includes('Right side') === false, deleted.join(', '));
      }

      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
      check(vp.name + ': no horizontal overflow', overflow <= 2, String(overflow));
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL BUILDLAB CAMERA BOOKMARK CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
