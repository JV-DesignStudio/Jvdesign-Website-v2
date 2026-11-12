/* A2961: the Godot Lab embeds the real Godot 4.7.2 editor with a starter
   project. This boots the real engine (not a stub) and checks cross-origin
   isolation, the starter ZIP hand-off, the engine loading then starting, and
   the 390/1440 layout. The 92 MB wasm is served from this repo, so nothing is
   downloaded. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/godot-lab/index.html';
const BOOT_TIMEOUT = 180000;
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.zip': 'application/zip'
};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(root, u);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const benign = /HTTPS proxy|set_https_proxy|Failed to load resource|net::ERR_FAILED|favicon/i;
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
  try {
    // Layout check first, before the engine boots.
    const phone = await browser.newPage();
    await phone.setViewport({ width: 390, height: 844, isMobile: true });
    await phone.setRequestInterception(true);
    phone.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
    await phone.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
    const mobile = await phone.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      frame: !!document.getElementById('godot-frame'),
      button: !!document.querySelector('[data-gl-load]')
    }));
    check('390px lab controls visible', mobile.frame && mobile.button);
    check('390px no horizontal overflow', mobile.scrollWidth <= 392, 'scrollWidth ' + mobile.scrollWidth);
    await phone.close();

    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => { if (!benign.test(e.message)) errors.push(e.message); });
    page.on('console', m => { if (m.type() === 'error' && !benign.test(m.text())) errors.push(m.text()); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 30000 });
    await page.waitForFunction(() => {
      const f = document.getElementById('godot-frame');
      return f && f.getAttribute('src');
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
      const f = document.getElementById('godot-frame');
      const d = f && f.contentDocument;
      return d && d.getElementById('zip-file') && d.getElementById('startButton');
    }, { timeout: 20000 });

    const lab = await page.evaluate(() => ({
      isolated: window.crossOriginIsolated,
      sab: typeof SharedArrayBuffer,
      frameSrc: (document.getElementById('godot-frame') || {}).getAttribute('src'),
      loadButton: !!document.querySelector('[data-gl-load]'),
      download: !!document.querySelector('a[href="starter.zip"]'),
      fallback: !!document.querySelector('a[href="https://editor.godotengine.org/latest/"]')
    }));
    check('lab page is cross-origin isolated', lab.isolated === true);
    check('SharedArrayBuffer is available', lab.sab === 'function', lab.sab);
    check('self-hosted editor frame loads', /editor\/index\.html/.test(lab.frameSrc || ''), lab.frameSrc);
    check('load starter button present', lab.loadButton);
    check('starter download fallback present', lab.download);
    check('official editor fallback present', lab.fallback);

    const editor = await page.evaluate(() => {
      const f = document.getElementById('godot-frame');
      const d = f.contentDocument;
      return {
        isolated: f.contentWindow.crossOriginIsolated,
        title: d.title,
        start: !!d.getElementById('startButton'),
        zip: !!d.getElementById('zip-file')
      };
    });
    check('editor frame is isolated', editor.isolated === true, String(editor.isolated));
    check('editor is the Godot web editor', /Godot/i.test(editor.title), editor.title);
    check('editor has Start and ZIP preload', editor.start && editor.zip, JSON.stringify(editor));

    // Boot the real engine. Load starter project clicks Start with the ZIP.
    const boot = await page.evaluate(async (timeout) => {
      const f = document.getElementById('godot-frame');
      const d = f.contentDocument;
      document.querySelector('[data-gl-load]').click();
      const zipSeen = await new Promise(resolve => {
        const t0 = Date.now();
        (function poll() {
          const z = d.getElementById('zip-file');
          if (z && z.files.length === 1) return resolve(true);
          if (Date.now() - t0 > 10000) return resolve(false);
          setTimeout(poll, 100);
        })();
      });
      let seenLoading = false, last = {};
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const ind = d.getElementById('status-indeterminate');
        const prog = d.getElementById('status-progress');
        const notice = d.getElementById('status-notice');
        const shown = !!((ind && getComputedStyle(ind).display !== 'none') || (prog && getComputedStyle(prog).display !== 'none'));
        const noticeShown = !!(notice && getComputedStyle(notice).display !== 'none');
        const c = d.getElementById('editor-canvas') || d.querySelector('canvas');
        last = { shown, noticeShown, cw: c ? c.clientWidth : 0, ch: c ? c.clientHeight : 0 };
        if (noticeShown) return { ok: false, zipSeen, reason: 'engine notice: ' + notice.innerText.slice(0, 240), last };
        if (shown) seenLoading = true;
        if (seenLoading && !shown && c && c.clientWidth > 10 && c.clientHeight > 10) return { ok: true, zipSeen, last };
        await new Promise(r => setTimeout(r, 250));
      }
      return { ok: false, zipSeen, reason: 'boot timeout', last };
    }, BOOT_TIMEOUT);
    check('starter ZIP is preloaded into the editor', boot.zipSeen === true);
    check('engine shows a loading state then starts', boot.ok === true, boot.reason || JSON.stringify(boot.last));
    check('engine canvas is live after start', boot.last && boot.last.cw > 10 && boot.last.ch > 10, JSON.stringify(boot.last));
    check('no browser errors during boot', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
