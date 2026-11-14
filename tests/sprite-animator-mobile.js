/* Sprite Animator (tools/sprite-animator.html) mobile / parity checks.

   Covers the Tool Parity bar for this page on a 390px touch device:
   - touch play/pause, frame thumb, zoom and timeline scrubber
   - touch pixel drawing on the preview canvas
   - autosave offers to restore the session after a refresh
   - a frame exports as PNG and Share Link builds a #sprite= URL
   - Ember touchpoint and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/sprite-animator-mobile.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mjs': 'application/javascript', '.mp3': 'audio/mpeg' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
async function tap(page, selector) {
  const el = await page.$(selector);
  if (!el) throw new Error('missing selector ' + selector);
  await el.tap();
}

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // Skip the start modal and the shared first-run studio tour.
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jvds_spriteanim_seen', '1');
        localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true }));
      } catch (e) {}
    });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED|net::ERR/.test(text)) return;
      errors.push('console: ' + text.slice(0, 100));
    });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());

    const url = base + '/tools/sprite-animator.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    await page.evaluate(() => { try { closeStart(); } catch (e) {} });

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.brief-ember') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      canvas: !!document.getElementById('preview-canvas'),
      scrubber: !!document.getElementById('scrubber'),
      labels: document.querySelectorAll('[aria-label]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('page title loads', /Sprite Animator/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('preview canvas and timeline exist', shell.canvas && shell.scrubber);
    check('controls carry aria labels', shell.labels >= 20, String(shell.labels));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    // Load a generated two-frame sheet.
    const loaded = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ff4f8b'; ctx.fillRect(4, 4, 16, 16);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(36, 4, 16, 16);
      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'two-frame.png', { type: 'image/png' });
      await window.loadSheet({ files: [file] });
      await new Promise(resolve => setTimeout(resolve, 400));
      return {
        total: document.getElementById('totalFrameNum').textContent.trim(),
        thumbs: document.querySelectorAll('.frame-thumb').length
      };
    });
    check('two-frame sheet loads', loaded.total === '2' && loaded.thumbs === 2, JSON.stringify(loaded));

    // Touch play / pause.
    await tap(page, '#playBtn');
    await new Promise(r => setTimeout(r, 300));
    const playing = await page.evaluate(() => document.getElementById('playBtn').textContent.trim());
    check('a touch tap plays', playing === '⏸', playing);
    await tap(page, '#playBtn');
    await new Promise(r => setTimeout(r, 250));
    const paused = await page.evaluate(() => document.getElementById('playBtn').textContent.trim());
    check('a touch tap pauses', paused === '▶', paused);

    // Touch frame thumbnail (paused, so the timer cannot override the pick).
    // Scroll the sidebar so the strip sits near its top, then tap low-left of
    // the thumb, clear of the hide badge and the sticky bar below.
    const thumb = await page.evaluate(() => {
      const el = document.getElementById('ft-1');
      const sb = document.getElementById('sidebar');
      const offset = el.getBoundingClientRect().top - sb.getBoundingClientRect().top + sb.scrollTop;
      sb.scrollTop = Math.max(0, offset - 20);
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width * 0.3, y: r.y + r.height * 0.7 };
    });
    await new Promise(r => setTimeout(r, 150));
    await page.touchscreen.tap(thumb.x, thumb.y);
    await new Promise(r => setTimeout(r, 300));
    const frameNo = await page.evaluate(() => document.getElementById('currentFrameNum').textContent.trim());
    check('a touch tap picks frame 2', frameNo === '2', frameNo);

    // Touch zoom.
    const zoomBefore = await page.evaluate(() => document.getElementById('zoomVal').textContent.trim());
    await tap(page, '[aria-label="Zoom in"]');
    await new Promise(r => setTimeout(r, 200));
    const zoomAfter = await page.evaluate(() => document.getElementById('zoomVal').textContent.trim());
    check('a touch tap zooms in', zoomAfter !== zoomBefore, zoomBefore + ' -> ' + zoomAfter);

    // Touch draw: switch draw mode on, pick black, tap the canvas centre.
    const draw = await page.evaluate(async () => {
      document.getElementById('drawBtn').click();
      const colour = document.getElementById('drawColor');
      colour.value = '#000000';
      colour.dispatchEvent(new Event('input', { bubbles: true }));
      const before = sheetCanvas.toDataURL();
      return { before, drawMode: drawMode };
    });
    const box = await page.evaluate(() => {
      const c = document.getElementById('preview-canvas');
      c.scrollIntoView({ block: 'center' });
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.touchscreen.tap(box.x, box.y);
    await new Promise(r => setTimeout(r, 350));
    const drawAfter = await page.evaluate(() => sheetCanvas.toDataURL());
    check('draw mode is on', draw.drawMode === true);
    check('a touch tap paints the frame', drawAfter !== draw.before);

    // Autosave (1.5s) then reload: the restore banner offers the session back.
    await new Promise(r => setTimeout(r, 1900));
    const autoSaved = await page.evaluate(() => { try { return !!localStorage.getItem('jvds_sprite_anim_auto'); } catch (e) { return false; } });
    check('drawing autosaves the session', autoSaved);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    const banner = await page.evaluate(() => {
      const b = document.getElementById('restoreBanner');
      return { shown: !!b && !b.classList.contains('hidden') };
    });
    check('reload offers the autosaved session', banner.shown);
    if (banner.shown) {
      await tap(page, '[data-on="restoreAutosave"]');
      await new Promise(r => setTimeout(r, 700));
    }
    const restored = await page.evaluate(() => ({ frames: (typeof activeFrames !== 'undefined' && activeFrames) ? activeFrames.length : 0, sheet: !!sheetImg }));
    check('restoring brings the frames back', restored.frames === 2 && restored.sheet, JSON.stringify(restored));

    // Frame exports as a PNG.
    const exported = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      exportPNG();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 3000);
    }));
    check('a frame exports as PNG', /\.png$/i.test(exported || ''), exported);

    // Share Link builds a #sprite= URL.
    const share = await page.evaluate(() => window.copySpriteShareLink());
    check('Share Link builds a #sprite= URL', typeof share === 'string' && /#sprite=/.test(share), String(share).slice(0, 56) + '...');

    // Desktop smoke: the same page boots clean at 1440.
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await page.evaluate(() => ({
      canvas: !!document.getElementById('preview-canvas'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 editor boots', desktop.canvas);
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS sprite-animator-mobile: touch play, frames, zoom, draw, autosave, export and share work at 390');
})().catch(e => { console.error(e); process.exit(1); });
