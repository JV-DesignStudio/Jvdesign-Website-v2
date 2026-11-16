const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19290;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff'
};
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('jvds-player-name', 'Test Player'); } catch (e) {}
    });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:' + port + '/me.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector('#badgePreview svg'), { timeout: 25000 });

    const info = await page.evaluate(() => {
      const svg = document.querySelector('#badgePreview svg');
      const host = document.getElementById('badgePreview');
      const text = svg ? svg.outerHTML : '';
      return {
        hasSvg: !!svg,
        text,
        name: /Test Player/.test(text),
        title: /JVDS CREATOR BADGE/.test(text),
        labels: ['LEVEL', 'TOTAL XP', 'DAY STREAK', 'WORKSHOPS', 'GAMES', 'ACHIEVEMENTS'].every(l => text.includes(l)),
        standalone: !/(?:href|src)\s*=\s*"(?:https?:|\/)/i.test(text),
        viewBox: svg ? svg.getAttribute('viewBox') : '',
        fits: svg ? svg.getBoundingClientRect().width <= host.clientWidth + 2 : false,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      };
    });
    check('badge card renders', info.hasSvg);
    check('badge card shows the player name', info.name, info.text.slice(0, 120));
    check('badge card has a title and all stats', info.title && info.labels);
    check('badge SVG is standalone', info.standalone);
    check('badge SVG has a 640x400 viewBox', info.viewBox === '0 0 640 400', info.viewBox);
    check('badge preview fits the card at 390', info.fits);
    check('profile has no horizontal overflow at 390', !info.overflow);

    const download = await page.evaluate(async () => {
      const orig = HTMLAnchorElement.prototype.click;
      let anchor = null;
      HTMLAnchorElement.prototype.click = function () { anchor = this; };
      document.querySelector('[data-on="downloadBadge"]').click();
      HTMLAnchorElement.prototype.click = orig;
      if (!anchor) return { ok: false };
      const res = await fetch(anchor.href);
      return { ok: true, name: anchor.download, text: await res.text() };
    });
    check('badge downloads as a standalone SVG', download.ok && /-jvds-badge\.svg$/.test(download.name || ''), download.name);
    check('downloaded badge matches the preview', /JVDS CREATOR BADGE/.test(download.text || '') && /Test Player/.test(download.text || ''));

    const printed = await page.evaluate(() => {
      const orig = window.open;
      let written = '';
      window.open = () => ({
        document: { open() {}, write(h) { written = h; }, close() {} },
        focus() {}, print() {}
      });
      window.printBadge();
      window.open = orig;
      return written;
    });
    check('print badge writes a self-contained page', /<svg/.test(printed) && /@page/.test(printed) && !/https?:\/\//.test(printed.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')));

    await page.setViewport({ width: 1440, height: 900 });
    await wait(200);
    const wide = await page.evaluate(() => {
      const svg = document.querySelector('#badgePreview svg');
      const host = document.getElementById('badgePreview');
      return {
        fits: svg ? svg.getBoundingClientRect().width <= host.clientWidth + 2 : false,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      };
    });
    check('badge preview fits at 1440', wide.fits);
    check('profile has no horizontal overflow at 1440', !wide.overflow);

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPROFILE BADGE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
