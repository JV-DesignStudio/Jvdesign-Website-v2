// BuildLab A2728: autosave shows a live "Saved just now" notice, and a build
// from a previous session offers a Restore / Discard prompt on load.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19274;
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
  await pause(1000);
  await dismiss(page);
}

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
      await page.evaluate(() => { try { localStorage.removeItem('buildlab_autosave'); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);

      const built = await page.evaluate(async () => {
        window.quickBuild('house');
        await new Promise(r => setTimeout(r, 1400));
        const d = JSON.parse(localStorage.getItem('buildlab_autosave') || 'null');
        return {
          live: (window.blocks || []).length,
          parts: d && Array.isArray(d.blocks) ? d.blocks.length : 0,
          name: d && d.name,
          notice: (document.getElementById('lastSavedNotice')?.textContent || '').trim(),
          badge: (document.getElementById('autosaveStatus')?.textContent || '').trim(),
          raw: d,
        };
      });
      check(vp.name + ': build autosaved', built.parts > 0, 'parts=' + built.parts);
      check(vp.name + ': live notice says saved just now or minutes', /^Saved (just now|\d+ min ago)$/.test(built.notice), built.notice || '(empty)');
      check(vp.name + ': badge still shows a local time', /^Saved locally at \d\d:\d\d$/.test(built.badge), built.badge || '(empty)');

      // Make the autosave look two days old, as if it came from a previous session.
      await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('buildlab_autosave'));
        d.savedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem('buildlab_autosave', JSON.stringify(d));
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);
      const prompt = await page.evaluate(() => {
        const m = document.getElementById('recoveryModal');
        return {
          open: !!m && m.classList.contains('open'),
          text: document.getElementById('recoverySummary')?.textContent || '',
          restoreBtn: !!document.querySelector('[data-on="restoreRecovery"]'),
          discardBtn: !!document.querySelector('[data-on="discardRecovery"]'),
        };
      });
      check(vp.name + ': old autosave opens the recovery prompt', prompt.open, JSON.stringify(prompt));
      check(vp.name + ': prompt names the build and part count', /house/i.test(prompt.text) && /\d+ parts?/.test(prompt.text), prompt.text);
      check(vp.name + ': prompt says when it was saved', /(days? ago|yesterday)/i.test(prompt.text), prompt.text);
      check(vp.name + ': prompt offers Restore and Discard', prompt.restoreBtn && prompt.discardBtn);

      const restore = await page.evaluate(async () => {
        document.querySelector('[data-on="restoreRecovery"]').click();
        await new Promise(r => setTimeout(r, 300));
        return {
          blocks: (window.blocks || []).length,
          modalOpen: document.getElementById('recoveryModal').classList.contains('open'),
        };
      });
      check(vp.name + ': Restore brings the build back', restore.blocks === built.parts && !restore.modalOpen, 'blocks=' + restore.blocks + ' expected=' + built.parts + ' modalOpen=' + restore.modalOpen);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);
      const discard = await page.evaluate(async () => {
        const m = document.getElementById('recoveryModal');
        if (!m || !m.classList.contains('open')) return { opened: false };
        document.querySelector('[data-on="discardRecovery"]').click();
        await new Promise(r => setTimeout(r, 500));
        return {
          opened: true,
          blocks: (window.blocks || []).length,
          stored: localStorage.getItem('buildlab_autosave'),
          modalOpen: m.classList.contains('open'),
          badge: (document.getElementById('autosaveStatus')?.textContent || '').trim(),
        };
      });
      check(vp.name + ': Discard clears the saved build', discard.opened && discard.blocks === 0 && discard.stored === null && !discard.modalOpen, JSON.stringify(discard));
      check(vp.name + ': Discard resets the badge', /not saved yet/i.test(discard.badge || ''), discard.badge || '(empty)');

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
  console.log('\nALL BUILDLAB RECOVERY CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
