/* A2959: the Godot engine hub opens the real browser editor with a starter
   project. This checks the launch page, the download hand-off, the three steps
   and the no-iframe decision at 390 and 1440. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/engine-godot.html';
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EngineFeel && document.querySelector('.godot-lab-steps'), { timeout: 15000 });

    const info = await page.evaluate(() => {
      const link = document.querySelector('a[href="https://editor.godotengine.org/latest/"]');
      return {
        heading: (document.getElementById('godot-lab-title') || {}).textContent || '',
        steps: document.querySelectorAll('.godot-lab-step').length,
        download: !!document.querySelector('[data-godot-lab-download]'),
        editorHref: link ? link.getAttribute('href') : '',
        editorTarget: link ? link.getAttribute('target') : '',
        editorRel: link ? link.getAttribute('rel') : '',
        editorIframes: document.querySelectorAll('iframe[src*="editor.godotengine.org"]').length,
        preset: window.EngineFeel.preset,
        files: window.EngineFeel.projectFiles().map(f => f.name)
      };
    });
    check('lab heading present', /Godot Lab/i.test(info.heading), info.heading);
    check('three build steps', info.steps === 3, 'steps ' + info.steps);
    check('starter download button present', info.download);
    check('editor opens in a new tab', info.editorHref === 'https://editor.godotengine.org/latest/' && info.editorTarget === '_blank' && /noopener/.test(info.editorRel), info.editorHref + ' / ' + info.editorTarget + ' / ' + info.editorRel);
    check('editor is not embedded', info.editorIframes === 0, 'iframes ' + info.editorIframes);
    check('starter preset mounted', info.preset === 'starter', info.preset);
    check('starter project has five files', info.files.length === 5, info.files.join(', '));

    const download = await page.evaluate(() => {
      let called = false;
      const original = window.EngineFeel.download;
      window.EngineFeel.download = function () { called = true; };
      document.querySelector('[data-godot-lab-download]').click();
      window.EngineFeel.download = original;
      return {
        called,
        status: (document.querySelector('[data-godot-lab-status]') || {}).textContent || ''
      };
    });
    check('download button calls the starter export', download.called);
    check('status explains the next step', /Preload project ZIP/i.test(download.status), download.status);

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EngineFeel && document.querySelector('.godot-lab-steps'), { timeout: 15000 });
    const mobile = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      steps: document.querySelectorAll('.godot-lab-step').length,
      visible: !!document.querySelector('.godot-lab-steps')
    }));
    check('390px steps visible', mobile.visible && mobile.steps === 3, 'steps ' + mobile.steps);
    check('390px no horizontal overflow', mobile.scrollWidth <= 392, 'scrollWidth ' + mobile.scrollWidth);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
