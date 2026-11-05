#!/usr/bin/env node
// tests/pixel-studio-quest-transfer.js (A2576): Pixel Studio hands the current
// frame to the Mario Jump Lab with no download and no account. Proves the button
// stores a real PNG in localStorage, the payload carries the sprite size, and the
// lab picks it up and draws it as the player at 390px and 1440px.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19258;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
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

function pngSize(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:' + port + '/tools/pixel-studio.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => {
      try { localStorage.clear(); localStorage.setItem('jvds_pixel_seen', '1'); } catch (e) {}
    });
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 800));

    const button = await page.evaluate(() => {
      const b = document.getElementById('sendSpriteToQuestBtn');
      if (!b) return { present: false };
      const r = b.getBoundingClientRect();
      return { present: true, visible: r.width > 0 && r.height > 0, text: b.textContent.trim() };
    });
    check('Pixel Studio shows the Load Sprite into Quest Game button', button.present && button.visible, button.text);
    check('button names the quest transfer in plain words', /Load Sprite into Quest Game/i.test(button.text || ''));

    const sent = await page.evaluate(() => {
      window.open = function () { return { focus: function () {} }; };
      const b = document.getElementById('sendSpriteToQuestBtn');
      if (b) b.click();
      const raw = localStorage.getItem('jvds_quest_sprite');
      const d = raw ? JSON.parse(raw) : null;
      return { raw: !!raw, payload: d };
    });
    check('clicking the button stores the sprite locally', sent.raw && !!sent.payload);
    check('the payload is a PNG data URL', !!sent.payload && /^data:image\/png;base64,/.test(sent.payload.dataUrl));
    const size = pngSize(sent.payload ? sent.payload.dataUrl : '');
    check('the payload carries a real sprite size', !!sent.payload && sent.payload.w > 0 && sent.payload.h > 0 && !!size && size.w === sent.payload.w && size.h === sent.payload.h,
      sent.payload ? sent.payload.w + 'x' + sent.payload.h + ' png=' + (size ? size.w + 'x' + size.h : 'bad') : 'no payload');
    check('no download is needed to transfer', !!sent.payload && !/\.png$/i.test(String(sent.payload.name || '')));

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 300));
    const mobile = await page.evaluate(async () => {
      const tab = Array.from(document.querySelectorAll('.bb-tab')).find((b) => /save/i.test(b.textContent));
      if (tab) tab.click();
      await new Promise((r) => setTimeout(r, 120));
      const buttons = Array.from(document.querySelectorAll('[data-on="sendSpriteToQuest"]'));
      const visible = buttons.some((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return {
        visible: visible,
        count: buttons.length,
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      };
    });
    check('button stays reachable at 390px in the Save panel', mobile.visible, 'buttons=' + mobile.count);
    check('no horizontal overflow at 390px', mobile.overflow <= 2, String(mobile.overflow));

    // The lab reads the same key and draws the sprite as the player.
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:' + port + '/workshops/jump-jump-mario-workshop.html#jumpLab', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#jumpLabCanvas', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 900));
    const lab = await page.evaluate(() => ({
      sprite: window.__jumpLabSprite,
      noteHidden: document.getElementById('jumpLabSpriteNote') ? document.getElementById('jumpLabSpriteNote').hidden : null,
      stored: !!localStorage.getItem('jvds_quest_sprite'),
      overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
    }));
    check('the lab sees the stored sprite', lab.stored && !!lab.sprite);
    check('the lab loads the sprite image', !!lab.sprite && lab.sprite.loaded === true, JSON.stringify(lab.sprite));
    check('the lab names the sprite as the player', lab.noteHidden === false);
    check('lab has no horizontal overflow', lab.overflow <= 2, String(lab.overflow));
    check('zero runtime errors', errors.length === 0, errors.join(' | '));

    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nPixel Studio quest transfer: all checks passed');
})();
