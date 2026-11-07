// home-paths-http.js (A946, revised A2798)
// The homepage routes today: four Start Here intents, one four-path hub and
// the guided first-make. Checks 390 and 1440 with no overflow or runtime errors.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
      const page = await browser.newPage();
      await page.setViewport(vp);
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 700));
      const data = await page.evaluate(() => {
        const entries = [...document.querySelectorAll('.home-entry-card')].map(c => c.getAttribute('href'));
        const hubs = [...document.querySelectorAll('.hub-card')].map(c => ({ name: (c.querySelector('.hub-name') || {}).textContent || '', href: c.getAttribute('href') }));
        const firstMake = document.getElementById('first-make');
        const hub = document.querySelector('.hub-section');
        return {
          entries, hubs,
          entryCount: document.querySelectorAll('.home-entry-card').length,
          hubCount: document.querySelectorAll('.hub-card').length,
          firstMake: !!firstMake,
          firstMakeBeforeHub: !!(firstMake && hub && (firstMake.compareDocumentPosition(hub) & Node.DOCUMENT_POSITION_FOLLOWING)),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      check(vp.name + ': four Start Here intents', data.entryCount === 4 && data.entries.length === 4, String(data.entryCount));
      check(vp.name + ': the intents are the four real routes',
        data.entries.join(',') === ['/workshops/start-here.html', '/browse.html', '/me.html', '/create'].join(','), data.entries.join(','));
      check(vp.name + ': four hub cards', data.hubCount === 4, String(data.hubCount));
      const hrefs = data.hubs.map(h => h.href).join(',');
      check(vp.name + ': hub links are Learn/Play/Create/Read',
        ['/workshop', '/arcade.html', '/create', '/books'].every(h => hrefs.includes(h)), hrefs);
      check(vp.name + ': guided first-make present', data.firstMake);
      check(vp.name + ': first-make sits before the hub', data.firstMakeBeforeHub);
      check(vp.name + ': no horizontal overflow', data.overflow <= 2, String(data.overflow));
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL HOME PATHS CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
