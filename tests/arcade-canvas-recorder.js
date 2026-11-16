const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19299;
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
  const html = fs.readFileSync(path.join(root, 'tools', 'arcade-game-maker.html'), 'utf8');
  check('HTML imports the CanvasRecorder module', /src\/arcade-maker\/CanvasRecorder\.js/.test(html));
  check('HTML has GIF and spritesheet actions', /data-on="_recordGif"/.test(html) && /data-on="_exportSpritesheet"/.test(html));

  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + port + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.CanvasRecorder, { timeout: 25000 });
    const out = await page.evaluate(async () => {
      const mod = await import('/src/arcade-maker/CanvasRecorder.js');
      const src = document.createElement('canvas');
      src.width = 32; src.height = 32;
      const ctx = src.getContext('2d');
      const frames = await mod.record(src, { seconds: 0.4, fps: 5 });
      ctx.fillStyle = '#22c55e'; ctx.fillRect(0, 0, 32, 32);
      const sheet = mod.spritesheet(frames, { cols: 2, pad: 2 });
      const png = await mod.canvasBlob(sheet);
      const gif = await mod.gif(frames, { delay: 100 });
      const pngBytes = new Uint8Array(await png.arrayBuffer());
      const gifBytes = new Uint8Array(await gif.arrayBuffer());
      const sig = (arr, text) => String.fromCharCode.apply(null, arr.slice(0, text.length)) === text;
      return {
        frames: frames.length,
        frameSize: frames[0].width + 'x' + frames[0].height,
        sheet: sheet.width + 'x' + sheet.height,
        png: sig(pngBytes, '\x89PNG'),
        gif: sig(gifBytes, 'GIF8'),
        exported: typeof window.CanvasRecorder.record === 'function',
        buttons: !!document.querySelector('[data-on="_recordGif"]') && !!document.querySelector('[data-on="_exportSpritesheet"]')
      };
    });
    check('recorder captures several frames', out.frames >= 2 && out.frameSize === '32x32', JSON.stringify(out));
    check('spritesheet lays frames out', out.sheet === '66x32', out.sheet);
    check('recorder exports a PNG and a GIF', out.png && out.gif, JSON.stringify({ png: out.png, gif: out.gif }));
    check('actions and module are published', out.exported && out.buttons);
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE CANVAS RECORDER CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
