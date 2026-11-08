// A1547/A2902: copy/paste project code on tool pages (tool-project-code.js).
// Verifies the API exists on a tool page, a code round-trips a saved key,
// secrets/per-device keys are excluded, no floating control or dock mounts,
// and there is no horizontal overflow at 390/1440.
//
// Run: node tests/tool-project-code.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(ROOT, clean);
  if (!path.extname(p)) p = path.join(ROOT, 'pages', clean.replace(/^\//, '') + '.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' , ' + extra : '')); if (!ok) failures++; };

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/tools/colour-palette.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForFunction('window.JVDSToolProject', { timeout: 8000 });
    await new Promise(r => setTimeout(r, 200));

    const mounted = await page.evaluate(() => ({
      button: !!document.getElementById('jvds-project-btn'),
      dock: !!document.getElementById('jvds-action-dock')
    }));
    check('no floating project control on a tool page', !mounted.button);
    check('no action dock on a tool page', !mounted.dock);

    const roundtrip = await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
      localStorage.setItem('jvds_pc_test', JSON.stringify({ n: 7 }));
      localStorage.setItem('gh_pat', 'SECRET');
      localStorage.setItem('jvds-theme', 'dark');
      const code = window.JVDSToolProject.toCode();
      const parsed = window.JVDSToolProject.parse(code);
      const hasTest = code.indexOf('JVPROJ1:') === 0 && !!parsed.jvds_pc_test;
      const excluded = !('gh_pat' in parsed) && !('jvds-theme' in parsed);
      // wipe, then load back from the code
      try { localStorage.clear(); } catch (e) {}
      const n = window.JVDSToolProject.load(code);
      const restored = localStorage.getItem('jvds_pc_test');
      return { hasTest, excluded, n, restored };
    });
    check('code carries the saved project key', roundtrip.hasTest);
    check('code excludes secrets and per-device keys', roundtrip.excluded);
    check('load code restores the key', roundtrip.n >= 1 && /"n":7/.test(roundtrip.restored || ''), 'restored=' + roundtrip.restored);

    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('no horizontal overflow @1440', ov <= 1, 'overflow=' + ov);

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 300));
    const ov390 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('no horizontal overflow @390', ov390 <= 1, 'overflow=' + ov390);
    await page.close();

    /* The old *-landing wrappers now meta-refresh to their real tool, so use a
       page outside /tools/ for the negative case. */
    const outside = await browser.newPage();
    await outside.goto(base + '/index.html', { waitUntil: 'load', timeout: 25000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 700));
    check('control is not injected outside /tools/', await outside.evaluate(() => !document.getElementById('jvds-project-btn')));
    await outside.close();
  } finally { await browser.close(); server.close(); }

  console.log('\n' + (failures ? 'FAILED ' + failures : 'ALL PROJECT-CODE CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})();
