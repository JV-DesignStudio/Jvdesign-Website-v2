#!/usr/bin/env node
// tests/my-achievements-http.js (A2507): the achievements page must load cleanly
// at 390px and 1440px, keep its heading and back link, and show no overflow or
// runtime errors after the workshop stylesheet trim.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19265;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
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
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'mobile', w: 390, h: 844, m: true }, { name: 'desktop', w: 1440, h: 900, m: false }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m });
      await page.goto('http://127.0.0.1:' + port + '/workshops/my-achievements.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 600));
      const s = await page.evaluate(() => ({
        title: document.title,
        heading: (document.querySelector('h1') || {}).textContent || '',
        back: !!document.querySelector('a[href="my-progress.html"]'),
        sections: document.querySelectorAll('.ach-section').length,
        main: !!document.getElementById('main-content'),
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        hubCss: [...document.styleSheets].some(sheet => (sheet.href || '').includes('style-workshop-hub.css'))
      }));
      check(vp.name + ': title is My Achievements', /My Achievements/i.test(s.title), s.title);
      check(vp.name + ': heading renders', /Achievements/i.test(s.heading), s.heading.trim());
      check(vp.name + ': back link to My Progress', s.back);
      check(vp.name + ': achievement sections render', s.main && s.sections > 0, 'sections=' + s.sections);
      check(vp.name + ': hub stylesheet is loaded', s.hubCss);
      check(vp.name + ': no horizontal overflow', s.overflow <= 2, String(s.overflow));
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nMy Achievements: all checks passed');
})();
