// BuildLab A2729: first-person Walk mode with movement, look, gravity, jump
// and block collision, plus on-screen controls for phones.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19279;
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
const walk = page => page.evaluate(() => window.getWalkState());

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

      const ui = await page.evaluate(() => ({
        button: !!document.getElementById('walkToggleBtn'),
        hud: !!document.getElementById('walkHud'),
        noBuild: window.getWalkState ? window.getWalkState().on : null,
      }));
      check(vp.name + ': walk toggle exists', ui.button && ui.hud, JSON.stringify(ui));

      const noBuild = await page.evaluate(async () => {
        window.enterWalkMode();
        await new Promise(r => setTimeout(r, 200));
        return { on: window.getWalkState().on, toast: document.getElementById('toast')?.textContent || '' };
      });
      check(vp.name + ': walking needs a build first', noBuild.on === false && /build something first/i.test(noBuild.toast), JSON.stringify(noBuild));

      await page.evaluate(async () => { window.quickBuild('house'); await new Promise(r => setTimeout(r, 400)); });
      const entered = await page.evaluate(async () => {
        window.enterWalkMode();
        await new Promise(r => setTimeout(r, 500));
        return {
          state: window.getWalkState(),
          body: document.body.classList.contains('walk-mode'),
          hud: getComputedStyle(document.getElementById('walkHud')).display,
          banner: (document.querySelector('.walk-banner')?.textContent || '').trim(),
          pressed: document.getElementById('walkToggleBtn')?.getAttribute('aria-pressed'),
        };
      });
      check(vp.name + ': entering walk mode starts first person', entered.state.on === true && entered.body === true, JSON.stringify(entered.state));
      check(vp.name + ': walk HUD is shown', entered.hud === 'block' && /walk mode/i.test(entered.banner), entered.hud + ' | ' + entered.banner);
      check(vp.name + ': player starts outside the build', entered.state.inside === false && entered.state.onGround === true, JSON.stringify(entered.state));
      check(vp.name + ': toggle reports walking', entered.pressed === 'true', String(entered.pressed));

      const start = entered.state;
      await page.keyboard.down('w');
      await pause(700);
      await page.keyboard.up('w');
      await pause(150);
      const afterMove = await walk(page);
      check(vp.name + ': W walks forward', afterMove.z < start.z - 0.05, 'z ' + start.z.toFixed(2) + ' -> ' + afterMove.z.toFixed(2));
      check(vp.name + ': movement never puts the player inside a block', afterMove.inside === false, JSON.stringify(afterMove));

      // Keep walking into the house to prove collision stops the player.
      await page.keyboard.down('w');
      await pause(1600);
      await page.keyboard.up('w');
      await pause(150);
      const blocked = await walk(page);
      check(vp.name + ': collision stops the player at the wall', blocked.inside === false, JSON.stringify(blocked));

      const jumpStart = blocked.y;
      await page.keyboard.down('Space');
      await pause(120);
      await page.keyboard.up('Space');
      const jump = await walk(page);
      check(vp.name + ': Space jumps', jump.y > jumpStart + 0.05 || jump.onGround === false, 'y ' + jumpStart.toFixed(2) + ' -> ' + jump.y.toFixed(2) + ' onGround=' + jump.onGround);

      // Drag to look.
      const beforeLook = (await walk(page)).yaw;
      const rect = await page.evaluate(() => { const c = document.querySelector('#viewport canvas'); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.mouse.move(rect.x, rect.y);
      await page.mouse.down();
      await page.mouse.move(rect.x + 120, rect.y, { steps: 4 });
      await page.mouse.up();
      await pause(150);
      const afterLook = await walk(page);
      check(vp.name + ': drag looks around', Math.abs(afterLook.yaw - beforeLook) > 0.05, 'yaw ' + beforeLook.toFixed(3) + ' -> ' + afterLook.yaw.toFixed(3));

      if (vp.m) {
        const dpad = await page.evaluate(() => {
          const d = document.querySelector('.walk-dpad');
          const j = document.querySelector('.walk-jump');
          return { dpad: d ? getComputedStyle(d).display : 'missing', jump: j ? getComputedStyle(j).display : 'missing' };
        });
        check('mobile: on-screen D-pad and jump show', dpad.dpad === 'grid' && dpad.jump === 'block', JSON.stringify(dpad));
        await page.evaluate(async () => {
          window.exitWalkMode();
          window.enterWalkMode();
          await new Promise(r => setTimeout(r, 400));
        });
        const z0 = (await walk(page)).z;
        await page.evaluate(() => {
          const b = document.querySelector('[data-walk-key="KeyW"]');
          b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        });
        await pause(600);
        await page.evaluate(() => {
          const b = document.querySelector('[data-walk-key="KeyW"]');
          b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        });
        await pause(150);
        const z1 = (await walk(page)).z;
        check('mobile: D-pad forward moves the player', z1 < z0 - 0.05, 'z ' + z0.toFixed(2) + ' -> ' + z1.toFixed(2));
      }

      const exited = await page.evaluate(async () => {
        document.querySelector('.walk-exit').click();
        await new Promise(r => setTimeout(r, 300));
        return { on: window.getWalkState().on, body: document.body.classList.contains('walk-mode'), hud: getComputedStyle(document.getElementById('walkHud')).display };
      });
      check(vp.name + ': Exit walk returns to building', exited.on === false && exited.body === false && exited.hud === 'none', JSON.stringify(exited));

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
  console.log('\nALL BUILDLAB PLAY MODE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
