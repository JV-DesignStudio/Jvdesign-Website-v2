/* A2959: the Godot Lab embeds the real Godot editor with a starter project.
   This checks the cross-origin isolation, the self-hosted editor frame, the
   starter ZIP hand-off and the 390/1440 layout. It stubs the editor's Start
   button so the test does not download the 96 MB wasm. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/godot-lab/index.html';
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
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 25000 });
    await page.waitForFunction(() => {
      const f = document.getElementById('godot-frame');
      return f && f.getAttribute('src');
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
      const f = document.getElementById('godot-frame');
      const d = f && f.contentDocument;
      return d && d.getElementById('zip-file') && d.getElementById('startButton');
    }, { timeout: 15000 });

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

    const preload = await page.evaluate(async () => {
      const f = document.getElementById('godot-frame');
      const d = f.contentDocument;
      let started = false;
      d.getElementById('startButton').onclick = function () { started = true; };
      document.querySelector('[data-gl-load]').click();
      await new Promise(r => setTimeout(r, 1200));
      return {
        started,
        files: d.getElementById('zip-file').files.length,
        status: (document.querySelector('[data-gl-status]') || {}).textContent || ''
      };
    });
    check('starter ZIP is preloaded into the editor', preload.files === 1, 'files ' + preload.files);
    check('Start is triggered after preload', preload.started === true);
    check('status explains the load', /Starting|starter|editor/i.test(preload.status), preload.status);

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    const mobile = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      frame: !!document.getElementById('godot-frame'),
      button: !!document.querySelector('[data-gl-load]')
    }));
    check('390px lab controls visible', mobile.frame && mobile.button);
    check('390px no horizontal overflow', mobile.scrollWidth <= 392, 'scrollWidth ' + mobile.scrollWidth);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
