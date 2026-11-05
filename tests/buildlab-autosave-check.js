#!/usr/bin/env node
// tests/buildlab-autosave-check.js (A2535): proves BuildLab saves the workspace to
// localStorage automatically, shows a visible "Saved locally at HH:MM" badge, and
// restores the same build after an intentional refresh at 390px and 1440px.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19254;
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

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

const badgeText = () => (document.getElementById('autosaveStatus')?.textContent || '').trim();
const badgeVisible = () => {
  const el = document.getElementById('autosaveStatus');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
};

async function dismiss(page) {
  await page.evaluate(() => {
    try { window.closeModal && window.closeModal('welcomeModal'); } catch (e) {}
    const w = document.getElementById('welcomeModal');
    if (w) w.classList.remove('open');
    document.body.classList.remove('bl-modal-open');
    const c = document.getElementById('cookie-accept');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 250));
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'mobile', w: 390, h: 844, m: true }, { name: 'desktop', w: 1440, h: 900, m: false }]) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 600));
      await dismiss(page);

      await page.evaluate(() => { try { localStorage.removeItem('buildlab_autosave'); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 900));
      await dismiss(page);
      const before = await page.evaluate(() => (document.getElementById('autosaveStatus')?.textContent || '').trim());
      check(vp.name + ': badge starts as Not saved yet', /not saved yet/i.test(before), before || '(empty)');
      check(vp.name + ': badge is visible', await page.evaluate(badgeVisible));

      const built = await page.evaluate(async () => {
        if (typeof window.quickBuild !== 'function') return { ok: false, reason: 'quickBuild missing' };
        window.quickBuild('house');
        await new Promise(r => setTimeout(r, 1200));
        const d = JSON.parse(localStorage.getItem('buildlab_autosave') || 'null');
        return {
          ok: true,
          blocks: (window.blocks || []).length,
          savedBlocks: d && Array.isArray(d.blocks) ? d.blocks.length : 0,
          savedAt: d && d.savedAt,
          badge: document.getElementById('autosaveStatus')?.textContent.trim() || '',
          visible: (() => {
            const el = document.getElementById('autosaveStatus');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })()
        };
      });
      if (!built.ok) { check(vp.name + ': workspace autosaves', false, built.reason); continue; }
      check(vp.name + ': autosave wrote blocks to localStorage', built.savedBlocks > 0, 'saved=' + built.savedBlocks + ' live=' + built.blocks);
      check(vp.name + ': autosave records a timestamp', !!built.savedAt && !isNaN(Date.parse(built.savedAt)), String(built.savedAt));
      check(vp.name + ': badge says Saved locally at HH:MM', /^Saved locally at \d\d:\d\d$/.test(built.badge), built.badge || '(empty)');
      check(vp.name + ': badge stays visible while building', built.visible);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 900));
      const restored = await page.evaluate(() => ({
        blocks: (window.blocks || []).length,
        badge: document.getElementById('autosaveStatus')?.textContent.trim() || ''
      }));
      check(vp.name + ': refresh restores the same number of blocks', restored.blocks === built.savedBlocks, 'after=' + restored.blocks + ' expected=' + built.savedBlocks);
      check(vp.name + ': badge survives the refresh', /^Saved locally at \d\d:\d\d$/.test(restored.badge), restored.badge || '(empty)');
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
      check(vp.name + ': no horizontal overflow with the badge', overflow <= 2, String(overflow));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nBuildLab autosave: all checks passed');
})();
