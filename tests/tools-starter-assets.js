const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19287;
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
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push('asset-packs pageerror: ' + e.message));
      await page.setViewport({ width, height, isMobile: width === 390, hasTouch: width === 390 });
      await page.goto('http://127.0.0.1:' + port + '/tools/asset-packs.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await wait(400);
      const info = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#starterGrid .asset-card')];
        return {
          cards: cards.length,
          licensed: /free to use/i.test((document.getElementById('starter-library')?.nextElementSibling || {}).textContent || ''),
          links: cards.filter(c => /\?starter=|\?preset=/.test((c.querySelector('a') || {}).href || '')).length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
        };
      });
      check('starter library has 20+ assets @' + width, info.cards >= 20, String(info.cards));
      check('starter library says free to use @' + width, info.licensed);
      check('starter cards have one-tap studio links @' + width, info.links >= 16, String(info.links));
      check('asset packs has no horizontal overflow @' + width, !info.overflow);
      await page.close();
    }

    const pixel = await browser.newPage();
    pixel.on('pageerror', (e) => errors.push('pixel pageerror: ' + e.message));
    await pixel.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pixel.goto('http://127.0.0.1:' + port + '/tools/pixel-studio.html?starter=character', { waitUntil: 'domcontentloaded', timeout: 25000 });
    const pixelOk = await pixel.waitForFunction(() => window._starterTemplate === 'character' && window.TEMPLATES && !!TEMPLATES.character, { timeout: 20000 }).then(() => true).catch(() => false);
    const pixelLink = await pixel.evaluate(() => !!document.querySelector('a[href*="asset-packs.html#starter-library"]'));
    check('Pixel Studio loads the character starter from a link', pixelOk);
    check('Pixel Studio links to the starter library', pixelLink);
    await pixel.close();

    const level = await browser.newPage();
    level.on('pageerror', (e) => errors.push('level pageerror: ' + e.message));
    await level.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await level.goto('http://127.0.0.1:' + port + '/tools/level-designer.html?starter=starter', { waitUntil: 'domcontentloaded', timeout: 25000 });
    const levelOk = await level.waitForFunction(() => typeof layers !== 'undefined' && layers.some(l => Array.from(l.data || []).some(v => v)), { timeout: 25000 }).then(() => true).catch(() => false);
    const levelLink = await level.evaluate(() => !!document.querySelector('a[href*="asset-packs.html#starter-library"]'));
    check('World Builder loads the first platformer starter', levelOk);
    check('World Builder links to the starter library', levelLink);
    await level.close();

    const sound = await browser.newPage();
    sound.on('pageerror', (e) => errors.push('sound pageerror: ' + e.message));
    await sound.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sound.goto('http://127.0.0.1:' + port + '/tools/sound-studio.html?starter=groove', { waitUntil: 'domcontentloaded', timeout: 25000 });
    const soundOk = await sound.waitForFunction(() => window._starterLoaded === 'groove', { timeout: 20000 }).then(() => true).catch(() => false);
    const soundLink = await sound.evaluate(() => !!document.querySelector('a[href*="asset-packs.html#starter-library"]'));
    check('Audio Studio loads the groove starter', soundOk);
    check('Audio Studio links to the starter library', soundLink);
    await sound.close();

    const preset = await browser.newPage();
    preset.on('pageerror', (e) => errors.push('preset pageerror: ' + e.message));
    await preset.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await preset.goto('http://127.0.0.1:' + port + '/tools/sound-studio.html?preset=beepy', { waitUntil: 'domcontentloaded', timeout: 25000 });
    const presetOk = await preset.waitForFunction(() => !!document.querySelector('.sound-preset-btn.on[data-sound="beepy"]'), { timeout: 20000 }).then(() => true).catch(() => false);
    check('Audio Studio applies the beepy preset from a link', presetOk);
    await preset.close();

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nSTARTER ASSET LIBRARY CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
