/* Minecraft Skin Editor (tools/minecraft-skin-editor.html) mobile / parity checks.

   Covers the Tool Parity bar for this page on a 390px touch device:
   - touch painting on the pixel grid (pointer events, not just mouse)
   - undo restores the pixel
   - Save & Export downloads a PNG and writes the local save
   - the saved skin reloads after a refresh
   - labelled controls, Ember touchpoint and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/minecraft-skin-editor-mobile.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // Skip the shared first-run studio tour so it cannot cover the canvas.
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); } catch (e) {}
    });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED|WebGL|net::ERR/.test(text)) return;
      errors.push('console: ' + text.slice(0, 100));
    });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());

    const url = base + '/tools/minecraft-skin-editor.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1300));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.ms-ember') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      labels: document.querySelectorAll('[aria-label]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      api: typeof window.JVDSMinecraftSkin === 'object'
    }));
    check('page title loads', /Minecraft Skin/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('controls carry aria labels', shell.labels >= 10, String(shell.labels));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);
    check('skin editor API is ready', shell.api);

    // Touch-paint one pixel on the 2D grid.
    const painted = await page.evaluate(async () => {
      const api = window.JVDSMinecraftSkin;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      api.setMode('full');
      await sleep(150);
      api.applyTemplate('blank');
      api.setColor('#ff0000');
      api.setTool('pencil');
      api.setBrush(1);
      const overlay = document.getElementById('msOverlay');
      const r = overlay.getBoundingClientRect();
      const pt = (px, py) => ({ clientX: r.left + (px + 0.5) / 64 * r.width, clientY: r.top + (py + 0.5) / 64 * r.height });
      const opts = { bubbles: true, cancelable: true, pointerId: 91, pointerType: 'touch', isPrimary: true, button: 0, ...pt(10, 10) };
      overlay.dispatchEvent(new PointerEvent('pointerdown', opts));
      overlay.dispatchEvent(new PointerEvent('pointerup', opts));
      await sleep(120);
      const d = api.getData();
      const i = (10 * 64 + 10) * 4;
      return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
    });
    check('touch paints the tapped pixel', painted.a > 0 && painted.r > 200 && painted.g < 60, JSON.stringify(painted));

    const undone = await page.evaluate(async () => {
      const api = window.JVDSMinecraftSkin;
      document.getElementById('msStripUndo').click();
      await new Promise(r => setTimeout(r, 160));
      const d = api.getData();
      return d[(10 * 64 + 10) * 4 + 3];
    });
    check('undo removes the painted pixel', undone === 0, 'alpha=' + undone);

    // Paint, then Save & Export: downloads a PNG and writes the local save.
    const exportResult = await page.evaluate(async () => {
      const api = window.JVDSMinecraftSkin;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      api.applyTemplate('blank');
      api.setColor('#1e88e5');
      api.setTool('pencil');
      api.setBrush(1);
      const overlay = document.getElementById('msOverlay');
      const r = overlay.getBoundingClientRect();
      const c = { clientX: r.left + (12 + 0.5) / 64 * r.width, clientY: r.top + (12 + 0.5) / 64 * r.height };
      const opts = { bubbles: true, cancelable: true, pointerId: 92, pointerType: 'touch', isPrimary: true, button: 0, ...c };
      overlay.dispatchEvent(new PointerEvent('pointerdown', opts));
      overlay.dispatchEvent(new PointerEvent('pointerup', opts));
      await sleep(120);
      const got = [];
      window.downloadBlob = (blob, name) => got.push({ name, size: blob && blob.size });
      document.getElementById('msStripExport').click();
      await sleep(500);
      let saved = null;
      try { saved = localStorage.getItem('jvds_minecraft_skin'); } catch (e) {}
      return { download: got[0] || null, savedIsPng: !!saved && saved.indexOf('data:image/png') === 0 };
    });
    check('Save & Export downloads a PNG', !!exportResult.download && /\.png$/i.test(exportResult.download.name), JSON.stringify(exportResult.download));
    check('Save & Export writes the local save', exportResult.savedIsPng);

    // Reload: the painted pixel is restored from the local save.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const restored = await page.evaluate(() => {
      const api = window.JVDSMinecraftSkin;
      if (!api) return null;
      const d = api.getData();
      const i = (12 * 64 + 12) * 4;
      return { a: d[i + 3], b: d[i + 2] };
    });
    check('saved skin reloads after a refresh', !!restored && restored.a > 0 && restored.b > 150, JSON.stringify(restored));

    // Desktop smoke: the same page boots clean at 1440.
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1200));
    const desktop = await page.evaluate(() => ({
      api: typeof window.JVDSMinecraftSkin === 'object',
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 editor boots', desktop.api);
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS minecraft-skin-editor-mobile: touch paint, undo, save/export and reload work at 390');
})().catch(e => { console.error(e); process.exit(1); });
