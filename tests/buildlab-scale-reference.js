// BuildLab A2739: a toggleable 1.8 m human reference and a live size readout
// in metres and studs for the selection and the whole build.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19276;
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
      await pause(700);
      await page.evaluate(() => {
        try { localStorage.removeItem('buildlab_autosave'); } catch (e) {}
        try { localStorage.removeItem('buildlab_human_scale'); } catch (e) {}
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await pause(900);
      await page.evaluate(() => {
        try { window.closeModal('welcomeModal'); } catch (e) {}
        const w = document.getElementById('welcomeModal');
        if (w) w.classList.remove('open');
        document.body.classList.remove('bl-modal-open');
        if (typeof window.setHumanScale === 'function') window.setHumanScale(false, true);
      });
      await pause(200);

      const empty = await page.evaluate(() => ({
        readout: window.getScaleReadout ? window.getScaleReadout() : '',
        hasButton: !!document.getElementById('humanScaleBtn'),
        off: window.getHumanScale ? window.getHumanScale() : null,
      }));
      check(vp.name + ': scale readout exists', empty.hasButton && /Build:/.test(empty.readout), empty.readout.slice(0, 80));
      check(vp.name + ': empty build readout', /no visible parts/i.test(empty.readout) && /nothing selected/i.test(empty.readout), empty.readout);
      check(vp.name + ': human reference starts off', empty.off && empty.off.on === false && empty.off.visible === false, JSON.stringify(empty.off));

      const built = await page.evaluate(async () => {
        window.quickBuild('robot');
        await new Promise(r => setTimeout(r, 400));
        return {
          readout: window.getScaleReadout(),
          blocks: (window.blocks || []).length,
          refInBlocks: (window.blocks || []).some(b => b.name === 'HumanScaleReference'),
        };
      });
      check(vp.name + ': readout shows the build size', /Build:/.test(built.readout) && !/no visible parts/i.test(built.readout) && /m/.test(built.readout) && /studs/.test(built.readout), built.readout.slice(0, 110));
      check(vp.name + ': reference is not a block', built.refInBlocks === false, 'blocks=' + built.blocks);

      const on = await page.evaluate(async () => {
        document.getElementById('humanScaleBtn').click();
        await new Promise(r => setTimeout(r, 300));
        return {
          ref: window.getHumanScale(),
          blocks: (window.blocks || []).length,
          btn: document.getElementById('humanScaleBtn').textContent.trim(),
          pressed: document.getElementById('humanScaleBtn').getAttribute('aria-pressed'),
        };
      });
      check(vp.name + ': button turns the reference on', on.ref.on === true && on.ref.inScene === true && on.ref.visible === true, JSON.stringify(on.ref));
      check(vp.name + ': reference is 1.8 m tall', Math.abs(on.ref.heightM - 1.8) < 0.05, String(on.ref.heightM));
      check(vp.name + ': reference does not add a block', on.blocks === built.blocks, 'before=' + built.blocks + ' after=' + on.blocks);
      check(vp.name + ': button reflects the on state', /on$/i.test(on.btn) && on.pressed === 'true', on.btn + ' pressed=' + on.pressed);
      check(vp.name + ': reference sits beside the build', Array.isArray(on.ref.position) && on.ref.position[0] < 0, JSON.stringify(on.ref.position));

      const selection = await page.evaluate(async () => {
        if (typeof window.selectBlock === 'function' && window.blocks && window.blocks[0]) {
          window.selectBlock(window.blocks[0]);
          await new Promise(r => setTimeout(r, 300));
        }
        return window.getScaleReadout();
      });
      check(vp.name + ': readout shows the selection size', /Selection:/.test(selection) && !/nothing selected/i.test(selection) && /studs/.test(selection), selection.slice(0, 140));

      const off = await page.evaluate(async () => {
        document.getElementById('humanScaleBtn').click();
        await new Promise(r => setTimeout(r, 250));
        return { ref: window.getHumanScale(), readout: window.getScaleReadout(), btn: document.getElementById('humanScaleBtn').textContent.trim() };
      });
      check(vp.name + ': button turns the reference off', off.ref.on === false && off.ref.visible === false, JSON.stringify(off.ref));
      check(vp.name + ': readout records the reference state', /Human reference: 1\.8 m \(off\)/.test(off.readout), off.readout.slice(-60));
      check(vp.name + ': button reflects the off state', /off$/i.test(off.btn), off.btn);

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
  console.log('\nALL BUILDLAB SCALE REFERENCE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
