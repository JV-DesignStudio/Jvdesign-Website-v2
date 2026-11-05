// tests/learn-http.js (A2552)
// Guards the workshop hub: the Learning Lab card links to the 15-minute page
// and carries the first-3-minutes copy, and the hub fits 390px and 1440px.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = '/workshops/learn.html';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      await page.setViewport({ width, height: 900 });

      let resp = null;
      for (let attempt = 0; attempt < 2 && !(resp && resp.status() === 200); attempt++) {
        resp = await page.goto(base + PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(resp && resp.status() === 200)) await new Promise((r) => setTimeout(r, 400));
      }
      const loaded = await page.evaluate(() => document.readyState === 'complete' || document.readyState === 'interactive').catch(() => false);
      const where = PAGE + ' @' + width;
      check('status 200', (resp && resp.status() === 200) || (!resp && loaded), 'status ' + (resp && resp.status()));

      const info = await page.evaluate(() => {
        const card = [...document.querySelectorAll('a.hub-card')].find((a) => /learning-lab\.html$/.test(new URL(a.href).pathname));
        return {
          hasCard: !!card,
          href: card ? new URL(card.href).pathname : null,
          text: card ? card.textContent.replace(/\s+/g, ' ').trim() : '',
          title: document.title,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      check('Learning Lab hub card exists', info.hasCard);
      check('card links to learning-lab.html', info.href === '/workshops/learning-lab.html', String(info.href));
      check('card mentions the 3-minute start', /3-minute/i.test(info.text), info.text.slice(0, 120));
      check('card uses the quick-start CTA', /Start in 3 minutes/i.test(info.text), info.text.slice(0, 120));
      check('title names the workshop hub', /Learn/i.test(info.title), info.title);
      check('no horizontal overflow', info.overflow <= 2, info.overflow + 'px');
      check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }

  if (failures) { console.log('\n' + failures + ' FAILED for ' + PAGE); process.exit(1); }
  console.log('\nPASS: ' + PAGE + ' workshop hub');
})().catch((e) => { console.error(e); process.exit(1); });
