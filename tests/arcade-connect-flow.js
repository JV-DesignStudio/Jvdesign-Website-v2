const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19293;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
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
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:' + port + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof switchTab === 'function' && document.querySelectorAll('.tab-btn').length === 6, { timeout: 25000 });
    await page.evaluate(() => { try { document.querySelectorAll('.modal-overlay.open, .ss-overlay.open').forEach(m => m.classList.remove('open')); } catch (e) {} });

    const tabs = ['build', 'blueprints', 'assets', 'sounds', 'custom', 'code'];
    const panels = await page.evaluate((names) => {
      const out = {};
      const order = ['build', 'blueprints', 'assets', 'sounds', 'custom', 'code'];
      names.forEach((name, i) => {
        switchTab(name, document.querySelectorAll('.tab-btn')[i]);
        const panel = document.getElementById('arcNext-' + name);
        out[name] = { exists: !!panel, button: !!(panel && panel.querySelector('.arc-next-btn')), active: document.getElementById('tab-' + name).classList.contains('on') };
      });
      return out;
    }, tabs);
    tabs.forEach(name => {
      check(name + ' tab shows a next step', panels[name].exists && panels[name].button && panels[name].active, JSON.stringify(panels[name]));
    });

    const quick = await page.evaluate(() => {
      switchTab('build', document.querySelectorAll('.tab-btn')[0]);
      const box = document.getElementById('arcNext-build');
      const buttons = box ? [...box.querySelectorAll('.arc-quick-btn')] : [];
      if (buttons[0]) buttons[0].click();
      return {
        count: buttons.length,
        labels: buttons.map(b => b.textContent),
        active: document.getElementById('tab-blueprints').classList.contains('on')
      };
    });
    check('Build tab has three quick changes', quick.count === 3, quick.labels.join(' | '));
    check('a quick change jumps to the right tab', quick.active, String(quick.active));

    await page.keyboard.press('2');
    await wait(150);
    const keyTab = await page.evaluate(() => document.getElementById('tab-blueprints').classList.contains('on'));
    check('keyboard shortcut still switches tabs', keyTab);

    const postRun = await page.evaluate(() => ({
      makeYours: !!document.getElementById('goMakeYours'),
      playAgain: !![...document.querySelectorAll('button')].find(b => /Play Again/i.test(b.textContent))
    }));
    check('post-run keeps Make it yours and Play Again', postRun.makeYours && postRun.playAgain, JSON.stringify(postRun));

    await page.evaluate(() => switchTab('build', document.querySelectorAll('.tab-btn')[0]));
    const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('no horizontal overflow at 390', !overflow390);

    await page.setViewport({ width: 1440, height: 900 });
    await wait(200);
    const wide = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      panel: !!document.getElementById('arcNext-build')
    }));
    check('next step is present at 1440', wide.panel);
    check('no horizontal overflow at 1440', !wide.overflow);

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE CONNECTED FLOW CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
