const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19297;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push(width + ' pageerror: ' + e.message));
      await page.setViewport({ width, height, isMobile: width === 390, hasTouch: width === 390 });
      await page.goto('http://127.0.0.1:' + port + '/tools/quest-card.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('#qcGrid circle', { timeout: 8000 }).catch(() => {});
      const info = await page.evaluate(() => ({
        title: document.title,
        picks: document.querySelectorAll('#qcPicker .qc-pick').length,
        heading: (document.getElementById('qcTitle') || {}).textContent || '',
        code: (document.getElementById('qcCode') || {}).textContent || '',
        circles: document.querySelectorAll('#qcGrid circle').length,
        nodes: document.querySelectorAll('#qcNodes rect').length,
        print: !!document.getElementById('qcPrint'),
        printCss: /@page/.test(document.documentElement.outerHTML),
        external: /(?:src|href)\s*=\s*"https?:/i.test(document.getElementById('qcCard').outerHTML),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      }));
      check('quest card loads @' + width, /Quest Card/i.test(info.title));
      check('six quests are offered @' + width, info.picks === 6, String(info.picks));
      check('jump card shows a snippet and grid @' + width, /Jump arc/.test(info.heading) && /setVelocityY/.test(info.code) && info.circles >= 5 && info.nodes >= 4, JSON.stringify({ circles: info.circles, nodes: info.nodes }));
      check('print action and A4 print CSS exist @' + width, info.print && info.printCss);
      check('quest card is self-contained @' + width, !info.external);
      check('no horizontal overflow @' + width, !info.overflow);
      if (width === 390) {
        await page.evaluate(() => document.querySelectorAll('#qcPicker .qc-pick')[1].click());
        const coin = await page.evaluate(() => ({
          heading: document.getElementById('qcTitle').textContent,
          code: document.getElementById('qcCode').textContent,
          circles: document.querySelectorAll('#qcGrid circle').length
        }));
        check('picking another quest redraws the card', /Coin pickup/.test(coin.heading) && /score/.test(coin.code) && coin.circles >= 3, JSON.stringify(coin));
        const printed = await page.evaluate(() => {
          let called = false;
          const orig = window.print;
          window.print = () => { called = true; };
          document.getElementById('qcPrint').click();
          window.print = orig;
          return called;
        });
        check('print button calls the print dialog', printed);
      }
      await page.close();
    }
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nQUEST CARD CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
