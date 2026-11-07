// BuildLab A2737: a visual action history list (last 20) that restores an
// earlier state on click, on desktop and in the mobile actions drawer.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19278;
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
      await page.evaluate(() => { try { localStorage.removeItem('buildlab_autosave'); localStorage.setItem('buildlab_kidmode', '0'); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);

      const start = await page.evaluate(() => ({
        hasList: !!document.getElementById('historyList'),
        hasMobileList: !!document.getElementById('mobHistoryList'),
        text: document.getElementById('historyList')?.textContent.trim() || '',
        panelDisplay: (() => { const p = document.getElementById('historyPanel'); return p ? getComputedStyle(p).display : null; })(),
      }));
      check(vp.name + ': history list exists', start.hasList && start.hasMobileList);
      check(vp.name + ': history starts empty', /no changes yet/i.test(start.text), start.text);
      if (!vp.m) check('desktop: History panel visible in Pro mode', start.panelDisplay !== 'none', String(start.panelDisplay));

      const built = await page.evaluate(async () => {
        window.quickBuild('robot');
        await new Promise(r => setTimeout(r, 300));
        return { labels: window.getHistoryLabels(), items: document.querySelectorAll('#historyList .history-item').length, blocks: (window.blocks || []).length };
      });
      check(vp.name + ': building adds a history step', built.labels.length >= 1 && built.items >= 1, JSON.stringify({ labels: built.labels, items: built.items }));
      check(vp.name + ': history labels are friendly', built.labels.every(l => typeof l === 'string' && l.length > 3), built.labels.join(' | '));

      const resized = await page.evaluate(async () => {
        if (window.blocks && window.blocks[0] && typeof window.selectBlock === 'function') window.selectBlock(window.blocks[0]);
        await new Promise(r => setTimeout(r, 150));
        if (typeof window.updateProp === 'function') window.updateProp('w', 2);
        await new Promise(r => setTimeout(r, 250));
        return {
          labels: window.getHistoryLabels(),
          items: document.querySelectorAll('#historyList .history-item').length,
          text: document.getElementById('historyList')?.textContent || '',
        };
      });
      check(vp.name + ': resize is labelled in history', resized.labels.includes('Resize block'), resized.labels.join(' | '));
      check(vp.name + ': list shows the labels and a Current row', /Resize block/.test(resized.text) && /Current/.test(resized.text), resized.text.replace(/\s+/g, ' ').slice(0, 140));
      check(vp.name + ': list is capped at 20 visible steps', resized.items <= 20, 'items=' + resized.items);

      const jump = await page.evaluate(async () => {
        const first = document.querySelector('#historyList [data-on="jumpToHistory"]');
        if (!first) return { ok: false };
        first.click();
        await new Promise(r => setTimeout(r, 500));
        return { ok: true, blocks: (window.blocks || []).length };
      });
      check(vp.name + ': clicking an earlier step restores it', jump.ok && jump.blocks === 0, JSON.stringify(jump));
      const redo = await page.evaluate(async () => {
        if (typeof window.redo === 'function') window.redo();
        await new Promise(r => setTimeout(r, 400));
        return (window.blocks || []).length;
      });
      check(vp.name + ': redo still works after a jump', redo > 0, 'blocks=' + redo);

      if (vp.m) {
        await page.evaluate(() => { if (typeof window.mobTab === 'function') window.mobTab('actions'); });
        await pause(350);
        const mob = await page.evaluate(() => ({
          items: document.querySelectorAll('#mobHistoryList .history-item').length,
          text: document.getElementById('mobHistoryList')?.textContent || '',
        }));
        check('mobile: drawer history shows the steps', mob.items >= 1 && /Current/.test(mob.text), JSON.stringify({ items: mob.items }));
      } else {
        const simple = await page.evaluate(async () => {
          document.getElementById('kidModeBtn').click();
          await new Promise(r => setTimeout(r, 200));
          return { display: getComputedStyle(document.getElementById('historyPanel')).display, kid: document.body.classList.contains('kid-mode') };
        });
        check('desktop: History hides in Simple mode', simple.kid === true && simple.display === 'none', JSON.stringify(simple));
        await page.evaluate(async () => { document.getElementById('kidModeBtn').click(); await new Promise(r => setTimeout(r, 150)); });
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
  console.log('\nALL BUILDLAB HISTORY CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
