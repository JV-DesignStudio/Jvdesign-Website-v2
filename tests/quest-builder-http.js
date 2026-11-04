const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19266;
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
    await page.goto('http://127.0.0.1:' + port + '/jvdesignstudio/tools/quest-builder.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.click('#btn-add-test');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const state = await page.evaluate(() => {
      const labelled = (id) => {
        const el = document.getElementById(id);
        const label = el && document.querySelector('label[for="' + id + '"]');
        return !!(el && label);
      };
      const rows = document.querySelectorAll('.test-row');
      return {
        title: document.title,
        ids: ['f-id', 'f-title', 'f-mascot', 'f-xp', 'f-briefing'].map(labelled),
        starter: document.getElementById('f-starter')?.getAttribute('aria-label') || '',
        sandbox: document.getElementById('sandbox-editor')?.getAttribute('aria-label') || '',
        rows: rows.length,
        rowLabels: rows.length > 0 && [...document.querySelectorAll('.tc-desc,.tc-assertion')].every((el) => !!el.getAttribute('aria-label')),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    check(width + 'px: title loads', state.title.includes('Quest'), state.title);
    check(width + 'px: every static field has a label', state.ids.every(Boolean), JSON.stringify(state.ids));
    check(width + 'px: starter has an accessible name', state.starter === 'Initial code', state.starter);
    check(width + 'px: sandbox has an accessible name', state.sandbox === 'Sandbox code editor', state.sandbox);
    check(width + 'px: test rows have accessible names', state.rows > 0 && state.rowLabels, String(state.rows));
    check(width + 'px: no horizontal overflow', state.overflow <= 2, String(state.overflow));
  }
  check('no runtime errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL QUEST BUILDER HTTP CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
