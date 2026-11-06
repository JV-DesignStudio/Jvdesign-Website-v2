// A2639: the child-safety and safeguarding page exists, is linked from the
// shared footer, the gallery and the privacy policy, explains moderation and
// reporting, and lays out without overflow at 390 and 1440.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19268;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const pagePath = path.join(root, 'pages', 'child-safety.html');
const pageHtml = fs.readFileSync(pagePath, 'utf8');
const footer = fs.readFileSync(path.join(root, 'partials', 'footer-content.html'), 'utf8');
const gallery = fs.readFileSync(path.join(root, 'pages', 'gallery.html'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'pages', 'privacy-policy.html'), 'utf8');

check('child-safety page exists', fs.existsSync(pagePath));
check('footer links to child-safety', /href="\/child-safety"/.test(footer));
check('gallery links to child-safety', /href="\/child-safety"/.test(gallery));
check('privacy policy links to child-safety', /href="\/child-safety"/.test(privacy));
check('page names moderation', /moderat/i.test(pageHtml));
check('page explains reporting a concern', /report/i.test(pageHtml));
check('page explains what is stored', /localStorage|browser/i.test(pageHtml));
check('page is plain English (no em or en dashes)', !/[\u2013\u2014]/.test(pageHtml));

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon|googletagmanager|google-analytics/.test(text)) return;
    errors.push('console: ' + text);
  });

  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    await page.goto('http://127.0.0.1:' + port + '/pages/child-safety.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const state = await page.evaluate(() => ({
      title: document.title,
      body: document.body.textContent.replace(/\s+/g, ' '),
      hasFooterLink: [...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/child-safety'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check(width + 'px: title loads', /Child Safety/i.test(state.title), state.title);
    check(width + 'px: explains gallery moderation', /reads the submission before it can appear|checked before it can appear|moderated/i.test(state.body), 'moderation present');
    check(width + 'px: tells a grown-up how to raise a concern', /parent|guardian|teacher/i.test(state.body), 'grown-up path present');
    check(width + 'px: links back to child safety in the footer', state.hasFooterLink, String(state.hasFooterLink));
    check(width + 'px: no horizontal overflow', state.overflow <= 2, String(state.overflow));
  }
  check('no runtime errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL CHILD SAFETY CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
