// Shared check for tool pages that became redirect stubs (A133 merges, A202).
// Loads the old page over HTTP and asserts it lands on the merged tool, keeps the
// query string and hash, and that the merged tool actually renders without errors.
// The merged tool's features are covered by its own test (test:sound, test:level).
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

module.exports = async function checkRedirectStub({ from, to, title, selector }) {
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(e ? '' : d); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: true });
  let failures = 0;
  const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' , ' + detail : ''}`); if (!ok) failures++; };
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-cookie-consent', 'declined'); } catch (e) {} });
    await page.goto(`${base}${from}?from=test#top`, { waitUntil: 'load' });
    await page.waitForFunction(t => location.pathname === t, { timeout: 5000 }, to).catch(() => {});
    await page.waitForSelector(selector, { timeout: 8000 }).catch(() => {});
    const u = new URL(page.url());
    check(`${from} lands on ${to}`, u.pathname === to, u.pathname);
    check('query string and hash kept', u.search === '?from=test' && u.hash === '#top', u.search + u.hash);
    check(`merged tool title contains "${title}"`, (await page.title()).includes(title), await page.title());
    check(`merged tool renders ${selector}`, !!(await page.$(selector)));
    check('zero runtime errors on the merged tool', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nREDIRECT STUB CHECKS PASSED');
  process.exit(failures ? 1 : 0);
};
