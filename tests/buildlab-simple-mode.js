// BuildLab A2727: a Simple / Pro mode toggle. First-time visitors start in
// Simple mode, which hides exact coordinates, materials, lighting, outliner,
// groups, mirror, array and advanced export while keeping colour, shape,
// templates and basic export. The choice persists. Works on desktop and mobile.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19277;
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
async function state(page) {
  return page.evaluate(() => {
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'; };
    const section = (title) => {
      const t = [...document.querySelectorAll('#right-panel .panel-title')].find(el => (el.textContent || '').trim().toLowerCase().startsWith(title.toLowerCase()));
      const sec = t && t.closest('.panel-section');
      return sec ? { exists: true, pro: sec.hasAttribute('data-pro-only'), display: getComputedStyle(sec).display } : { exists: false };
    };
    const btn = document.getElementById('kidModeBtn');
    const mob = document.getElementById('kidModeBtnMobile');
    return {
      kid: document.body.classList.contains('kid-mode'),
      desktopPressed: btn ? btn.getAttribute('aria-pressed') : null,
      mobilePressed: mob ? mob.getAttribute('aria-pressed') : null,
      stored: (() => { try { return localStorage.getItem('buildlab_kidmode'); } catch (e) { return null; } })(),
      stats: section('Stats'),
      outliner: section('Outliner'),
      lighting: section('Lighting & Rendering'),
      assetLibrary: section('Asset Library'),
      groups: section('Groups'),
      mirror: section('Mirror'),
      array: section('Array / Repeat'),
      colour: vis(document.getElementById('colourGrid')),
      shape: vis(document.getElementById('shapeGrid')),
      templates: vis(document.querySelector('.template-grid')),
      quickExport: vis(document.getElementById('quickExportPanel')),
      overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });
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
      await page.evaluate(() => { try { localStorage.removeItem('buildlab_kidmode'); localStorage.removeItem('buildlab_autosave'); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);

      const first = await state(page);
      check(vp.name + ': first visit starts in Simple mode', first.kid === true && first.stored === '1', 'kid=' + first.kid + ' stored=' + first.stored);
      if (!vp.m) {
        check('desktop: Simple toggle reports pressed', first.desktopPressed === 'true', String(first.desktopPressed));
        check('desktop: advanced sections are tagged pro-only', first.stats.pro && first.outliner.pro && first.lighting.pro && first.assetLibrary.pro && first.groups.pro && first.mirror.pro && first.array.pro, JSON.stringify(first.stats) + JSON.stringify(first.array));
        check('desktop: advanced sections are hidden in Simple', first.stats.display === 'none' && first.outliner.display === 'none' && first.lighting.display === 'none', 'stats=' + first.stats.display + ' outliner=' + first.outliner.display + ' lighting=' + first.lighting.display);
        check('desktop: colour stays visible', first.colour);
        check('desktop: shape stays visible', first.shape);
        check('desktop: templates stay visible', first.templates);
        check('desktop: basic export stays visible', first.quickExport);
      } else {
        check('mobile: Simple toggle exists', first.mobilePressed === 'true', String(first.mobilePressed));
      }

      if (!vp.m) {
        const pro = await page.evaluate(async () => {
          document.getElementById('kidModeBtn').click();
          await new Promise(r => setTimeout(r, 250));
          return { kid: document.body.classList.contains('kid-mode'), stored: localStorage.getItem('buildlab_kidmode'), pressed: document.getElementById('kidModeBtn').getAttribute('aria-pressed') };
        });
        check('desktop: toggle switches to Pro', pro.kid === false && pro.stored === '0' && pro.pressed === 'false', JSON.stringify(pro));
        const proState = await state(page);
        check('desktop: Pro shows the advanced sections', proState.stats.display !== 'none' && proState.outliner.display !== 'none' && proState.lighting.display !== 'none', 'stats=' + proState.stats.display + ' outliner=' + proState.outliner.display);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await load(page);
        const persisted = await state(page);
        check('desktop: Pro choice persists after reload', persisted.kid === false && persisted.stored === '0', 'kid=' + persisted.kid + ' stored=' + persisted.stored);
        const back = await page.evaluate(async () => {
          document.getElementById('kidModeBtn').click();
          await new Promise(r => setTimeout(r, 250));
          return { kid: document.body.classList.contains('kid-mode'), stored: localStorage.getItem('buildlab_kidmode'), pressed: document.getElementById('kidModeBtn').getAttribute('aria-pressed') };
        });
        check('desktop: toggle returns to Simple', back.kid === true && back.stored === '1' && back.pressed === 'true', JSON.stringify(back));
      } else {
        await page.evaluate(() => { if (typeof window.mobTab === 'function') window.mobTab('actions'); });
        await pause(350);
        const mob = await page.evaluate(async () => {
          const btn = document.getElementById('kidModeBtnMobile');
          const before = { visible: !!btn && btn.getBoundingClientRect().width > 0, pressed: btn && btn.getAttribute('aria-pressed') };
          if (btn) btn.click();
          await new Promise(r => setTimeout(r, 250));
          return { before, kid: document.body.classList.contains('kid-mode'), stored: localStorage.getItem('buildlab_kidmode'), pressed: btn && btn.getAttribute('aria-pressed') };
        });
        check('mobile: toggle is visible in the drawer', mob.before.visible && mob.before.pressed === 'true', JSON.stringify(mob.before));
        check('mobile: toggle switches to Pro', mob.kid === false && mob.stored === '0' && mob.pressed === 'false', JSON.stringify(mob));
        const mobBack = await page.evaluate(async () => {
          document.getElementById('kidModeBtnMobile').click();
          await new Promise(r => setTimeout(r, 200));
          return { kid: document.body.classList.contains('kid-mode'), stored: localStorage.getItem('buildlab_kidmode') };
        });
        check('mobile: toggle returns to Simple', mobBack.kid === true && mobBack.stored === '1', JSON.stringify(mobBack));
      }

      check(vp.name + ': no horizontal overflow', first.overflow <= 2, String(first.overflow));
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL BUILDLAB SIMPLE MODE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
