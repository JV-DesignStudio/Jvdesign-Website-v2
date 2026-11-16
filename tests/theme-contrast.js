const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19298;
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
function lum(hex) {
  const c = hex.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function rgb(str) {
  const m = String(str).match(/\d+/g);
  return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
}

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('home pageerror: ' + e.message));
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-theme', 'contrast'); } catch (e) {} });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('#themeToggle', { timeout: 15000 }).catch(() => {});
    const home = await page.evaluate(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      const fg = getComputedStyle(document.body).color;
      const btn = document.getElementById('themeToggle');
      return { theme: document.documentElement.getAttribute('data-theme'), bg, fg, label: btn ? btn.getAttribute('aria-label') : '', overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 };
    });
    check('contrast theme applies on load', home.theme === 'contrast', home.theme);
    check('contrast body is black on white', ratio(rgb(home.bg), rgb(home.fg)) >= 7, JSON.stringify({ bg: home.bg, fg: home.fg, ratio: ratio(rgb(home.bg), rgb(home.fg)) }));
    check('theme button names the mode', /High contrast/i.test(home.label), home.label);
    check('no overflow at 390', !home.overflow);

    const cycles = await page.evaluate(async () => {
      const b = document.getElementById('themeToggle');
      const out = [];
      for (let i = 0; i < 3; i++) { b.click(); out.push(document.documentElement.getAttribute('data-theme') || 'light'); }
      return { out, saved: localStorage.getItem('jvds-theme') };
    });
    check('toggle cycles light, dark and contrast', cycles.out.join(',') === 'light,dark,contrast' && cycles.saved === 'contrast', JSON.stringify(cycles));

    const tool = await browser.newPage();
    tool.on('pageerror', (e) => errors.push('tool pageerror: ' + e.message));
    await tool.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-theme', 'contrast'); } catch (e) {} });
    await tool.setViewport({ width: 1440, height: 900 });
    await tool.goto('http://127.0.0.1:' + port + '/tools/asset-packs.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 600));
    const toolState = await tool.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 }));
    check('a tool keeps the contrast theme', toolState.theme === 'contrast', String(toolState.theme));
    check('tool has no overflow at 1440', !toolState.overflow);
    await tool.close();

    const quest = await browser.newPage();
    quest.on('pageerror', (e) => errors.push('quest pageerror: ' + e.message));
    await quest.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-theme', 'contrast'); } catch (e) {} });
    await quest.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await quest.goto('http://127.0.0.1:' + port + '/tools/quest-board.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 500));
    const questState = await quest.evaluate(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      return { bg, theme: document.documentElement.getAttribute('data-theme') };
    });
    check('quest board picks up the contrast palette', questState.theme === 'contrast' && rgb(questState.bg).join(',') === '0,0,0', JSON.stringify(questState));
    await quest.close();

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nTHEME CONTRAST CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
