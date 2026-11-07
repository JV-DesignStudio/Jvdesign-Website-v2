// BuildLab A2732: on-screen view cube for quick camera angles, plus touch
// gesture help in the welcome dialog.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19275;
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
const VIEWS = { top: { phi: 0.1 }, bottom: { phi: Math.PI * 0.9 }, front: { theta: 0, phi: Math.PI / 2 }, back: { theta: Math.PI, phi: Math.PI / 2 }, right: { theta: -Math.PI / 2, phi: Math.PI / 2 }, left: { theta: Math.PI / 2, phi: Math.PI / 2 }, perspective: { theta: 0.6, phi: 0.8 } };

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
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await pause(800);
      await page.evaluate(() => {
        try { window.closeModal('welcomeModal'); } catch (e) {}
        const w = document.getElementById('welcomeModal');
        if (w) w.classList.remove('open');
        document.body.classList.remove('bl-modal-open');
      });
      await pause(200);

      const base = await page.evaluate(() => {
        const cube = document.getElementById('viewCube');
        const btns = cube ? Array.from(cube.querySelectorAll('button')) : [];
        const r = cube ? cube.getBoundingClientRect() : null;
        const welcome = document.getElementById('welcomeModal')?.textContent || '';
        return {
          hasCube: !!cube,
          labels: btns.map(b => (b.textContent || '').trim()),
          aria: btns.map(b => b.getAttribute('aria-label') || ''),
          visible: !!r && r.width > 0 && r.height > 0,
          inViewport: !!r && r.left >= -2 && r.top >= -2 && r.right <= window.innerWidth + 2 && r.bottom <= window.innerHeight + 2,
          welcome,
          overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        };
      });
      check(vp.name + ': view cube exists', base.hasCube && base.labels.length === 9, base.labels.join(','));
      check(vp.name + ': view cube is visible', base.visible);
      check(vp.name + ': view cube sits inside the viewport', base.inViewport);
      check(vp.name + ': view cube has the quick angles', ['Top', 'Home', 'Persp', 'Left', 'Front', 'Right', 'Btm', 'Back', 'Fit'].every(l => base.labels.includes(l)), base.labels.join(','));
      check(vp.name + ': view cube buttons are labelled', base.aria.every(a => a && a.length > 2), base.aria.join(' | '));
      check(vp.name + ': welcome explains touch gestures', /touch:/i.test(base.welcome) && /1-finger drag/i.test(base.welcome) && /pinch/i.test(base.welcome), base.welcome.replace(/\s+/g, ' ').slice(0, 160));

      const angles = {};
      for (const view of Object.keys(VIEWS)) {
        angles[view] = await page.evaluate(async (v) => {
          const btn = document.querySelector('#viewCube button[data-on-arg="' + v + '"]');
          if (!btn) return { missing: true };
          btn.click();
          await new Promise(r => setTimeout(r, 80));
          return window.getCameraAngles ? window.getCameraAngles() : null;
        }, view);
        if (!angles[view] || angles[view].missing) { check(vp.name + ': ' + view + ' view button works', false, 'missing'); continue; }
        const expected = VIEWS[view];
        const thetaOk = expected.theta === undefined || Math.abs(angles[view].theta - expected.theta) < 0.01;
        const phiOk = expected.phi === undefined || Math.abs(angles[view].phi - expected.phi) < 0.01;
        check(vp.name + ': ' + view + ' view sets the camera', thetaOk && phiOk, JSON.stringify(angles[view]));
      }

      // Home and Fit frame the build.
      const home = await page.evaluate(async () => {
        window.quickBuild('robot');
        await new Promise(r => setTimeout(r, 150));
        document.querySelector('#viewCube .vc-home').click();
        await new Promise(r => setTimeout(r, 120));
        return { toast: (document.getElementById('toast')?.textContent || '').trim(), angles: window.getCameraAngles() };
      });
      check(vp.name + ': Home frames the build', /framed all blocks/i.test(home.toast), home.toast);
      const fit = await page.evaluate(async () => {
        document.querySelector('#viewCube button[aria-label="Frame all"]').click();
        await new Promise(r => setTimeout(r, 120));
        return (document.getElementById('toast')?.textContent || '').trim();
      });
      check(vp.name + ': Fit frames the build', /framed all blocks/i.test(fit), fit);

      check(vp.name + ': no horizontal overflow', base.overflow <= 2, String(base.overflow));
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL BUILDLAB VIEW CUBE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
