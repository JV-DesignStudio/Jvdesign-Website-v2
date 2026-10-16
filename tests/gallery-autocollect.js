// A1598: the Gallery auto-collects the saves the tools already produce, with no
// manual upload, and Export/Import still round-trips.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

const seed = {
  jvds_pixel: JSON.stringify({ v: 2, cW: 4, cH: 4, fps: 8, layers: [{ name: 'L1', visible: true }], frames: [[Array.from({ length: 64 }, (_, i) => (i % 4 === 3 ? 255 : 120))]] }),
  jvds_sprite_player: PNG1,
  jv_arcade_slot_0: JSON.stringify({ title: 'Neon Wave', genre: 'SHOOTER', thumbnail: PNG1 })
};

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const errors = [];
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.evaluateOnNewDocument((s) => { try { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) {} }, seed);
    await page.goto(base + '/tools/gallery.html', { waitUntil: 'load' });
    await page.waitForFunction('document.querySelectorAll("#grid article.card").length >= 3', { timeout: 12000 });

    const auto = await page.evaluate(() => ({
      cards: document.querySelectorAll('#grid article.card').length,
      hasImage: !!document.querySelector('#grid .thumb img'),
      text: document.getElementById('grid').innerText,
      hasSyncBtn: !!document.getElementById('btnSync'),
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
    }));
    check('auto-collected the tool saves with no upload', auto.cards === 3, 'cards ' + auto.cards);
    check('collected items render thumbnails', auto.hasImage);
    check('collected Pixel Studio + arcade work', auto.text.indexOf('Pixel Studio art') >= 0 && auto.text.indexOf('Neon Wave') >= 0, auto.text.replace(/\s+/g, ' ').slice(0, 90));
    check('Import from my tools button exists', auto.hasSyncBtn);
    check('no overflow at 390', auto.sw <= auto.cw + 2, auto.sw + '/' + auto.cw);

    // Export round-trip
    const exported = await page.evaluate(async () => {
      const oldCreate = URL.createObjectURL, oldClick = HTMLAnchorElement.prototype.click;
      let blob = null;
      URL.createObjectURL = (b) => { blob = b; return 'blob:jvds-test'; };
      HTMLAnchorElement.prototype.click = function () {};
      document.getElementById('btnExport').click();
      await new Promise((r) => setTimeout(r, 300));
      URL.createObjectURL = oldCreate; HTMLAnchorElement.prototype.click = oldClick;
      return blob ? await blob.text() : null;
    });
    let parsed = [];
    try { parsed = JSON.parse(exported); } catch (e) {}
    check('Export all writes the collected items', Array.isArray(parsed) && parsed.length === 3, Array.isArray(parsed) ? 'len ' + parsed.length : 'no json');

    // Clear then Import back
    await page.click('#btnClear');
    await page.waitForFunction('document.querySelectorAll("#grid article.card").length === 0', { timeout: 8000 });
    const tmp = path.join(os.tmpdir(), 'jvds-gallery-' + Date.now() + '.json');
    fs.writeFileSync(tmp, exported);
    (await page.$('#importFile')).uploadFile(tmp);
    await page.waitForFunction('document.querySelectorAll("#grid article.card").length >= 3', { timeout: 8000 });
    const after = await page.evaluate(() => document.querySelectorAll('#grid article.card').length);
    check('Import JSON round-trips the gallery', after === 3, 'cards ' + after);
    fs.unlinkSync(tmp);

    // Reload: auto-collect must not duplicate what is already collected
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction('document.querySelectorAll("#grid article.card").length >= 3', { timeout: 12000 });
    const reloaded = await page.evaluate(() => document.querySelectorAll('#grid article.card').length);
    check('re-opening does not duplicate collected items', reloaded === 3, 'cards ' + reloaded);

    check('zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL GALLERY AUTO-COLLECT CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
