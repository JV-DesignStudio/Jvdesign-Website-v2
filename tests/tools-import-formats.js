const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const port = 19288;
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

function wavBase64(seconds = 0.1, rate = 8000) {
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return buf.toString('base64');
}

async function dispatchFile(page, selector, files) {
  await page.evaluate((sel, list) => {
    const dt = new DataTransfer();
    for (const f of list) {
      const bin = atob(f.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      dt.items.add(new File([bytes], f.name, { type: f.type }));
    }
    const input = document.querySelector(sel);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, files);
}

(async () => {
  const png = (await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 255, g: 60, b: 60, alpha: 1 } } }).png().toBuffer()).toString('base64');
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const errors = [];
  try {
    const pixel = await browser.newPage();
    pixel.on('pageerror', (e) => errors.push('pixel pageerror: ' + (e.stack || e.message)));
    await pixel.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pixel.goto('http://127.0.0.1:' + port + '/tools/pixel-studio.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pixel.waitForFunction(() => typeof applyProject === 'function' && typeof onionCanvas !== 'undefined' && !!onionCanvas && typeof cursorCanvas !== 'undefined' && !!cursorCanvas && !!document.getElementById('asepriteJsonInput'), { timeout: 25000 });
    const pixelOverflow = await pixel.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('Pixel Studio import controls exist @390', !pixelOverflow);
    await dispatchFile(pixel, '#asepriteJsonInput', [
      { name: 'hero.json', type: 'application/json', b64: Buffer.from(JSON.stringify({ frames: [{ filename: 'hero.png', frame: { x: 0, y: 0, w: 8, h: 8 } }], meta: { image: 'hero.png', size: { w: 8, h: 8 } } })).toString('base64') },
      { name: 'hero.png', type: 'image/png', b64: png }
    ]);
    const pixelOk = await pixel.waitForFunction(() => typeof cW !== 'undefined' && cW === 8 && cH === 8, { timeout: 15000 }).then(() => true).catch(() => false);
    check('Pixel Studio imports Aseprite JSON + PNG', pixelOk);
    await dispatchFile(pixel, '#asepriteJsonInput', [{ name: 'bad.txt', type: 'text/plain', b64: Buffer.from('not json').toString('base64') }]);
    await wait(300);
    const pixelMsg = await pixel.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    check('Pixel Studio rejects a bad Aseprite file', /pick|not|json/i.test(pixelMsg), pixelMsg);
    check('Pixel Studio still renders after a bad import', await pixel.evaluate(() => !!document.getElementById('main-canvas')));
    await pixel.close();

    const level = await browser.newPage();
    level.on('pageerror', (e) => errors.push('level pageerror: ' + (e.stack || e.message)));
    await level.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await level.goto('http://127.0.0.1:' + port + '/tools/level-designer.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await level.waitForFunction(() => typeof importTMX === 'function' && !!document.getElementById('importTmxInput'), { timeout: 25000 });
    const tmx = '<?xml version="1.0"?><map version="1.10" width="3" height="2" tilewidth="32" tileheight="32"><layer name="Ground"><data encoding="csv">1,2,0,0,1,1</data></layer></map>';
    await dispatchFile(level, '#importTmxInput', [{ name: 'test.tmx', type: 'application/xml', b64: Buffer.from(tmx).toString('base64') }]);
    const levelOk = await level.waitForFunction(() => gridW === 3 && gridH === 2 && Array.from(layers[0].data).join(',') === '1,2,0,0,1,1', { timeout: 15000 }).then(() => true).catch(() => false);
    check('World Builder imports a Tiled .tmx map', levelOk);
    await dispatchFile(level, '#importTmxInput', [{ name: 'bad.tmx', type: 'application/xml', b64: Buffer.from('nope').toString('base64') }]);
    await wait(300);
    const levelMsg = await level.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    check('World Builder rejects a bad .tmx', /import failed|not a tiled/i.test(levelMsg), levelMsg);
    check('World Builder still renders after a bad import', await level.evaluate(() => !!document.getElementById('level-canvas')));
    await level.close();

    const sound = await browser.newPage();
    sound.on('pageerror', (e) => errors.push('sound pageerror: ' + (e.stack || e.message)));
    await sound.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sound.goto('http://127.0.0.1:' + port + '/tools/sound-studio.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sound.waitForFunction(() => typeof handleSfxFileInput === 'function' && !!document.getElementById('sfxFileInput'), { timeout: 25000 });
    await dispatchFile(sound, '#sfxFileInput', [{ name: 'coin-test.wav', type: 'audio/wav', b64: wavBase64() }]);
    const soundOk = await sound.waitForFunction(() => typeof mySamples !== 'undefined' && mySamples.length > 0, { timeout: 20000 }).then(() => true).catch(() => false);
    check('Audio Studio imports a WAV into My Sounds', soundOk);
    await dispatchFile(sound, '#sfxFileInput', [{ name: 'bad.txt', type: 'text/plain', b64: Buffer.from('nope').toString('base64') }]);
    await wait(300);
    const soundMsg = await sound.evaluate(() => (document.getElementById('mySfxStatus') || {}).textContent || '');
    check('Audio Studio rejects a non-audio file', /not audio|wav|mp3/i.test(soundMsg), soundMsg);
    await sound.close();

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nIMPORT FORMAT CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
