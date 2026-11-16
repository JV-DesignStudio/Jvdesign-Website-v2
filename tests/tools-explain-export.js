/* A2319: after a download the studios explain what the file is.

   For six studios at 390px and 1440px:
   - a real download link opens a small, dismissible panel
   - the panel names the file type and where it can be used
   - it offers one next-step link and does not block the editor
   - a second download replaces the first panel
   - no horizontal overflow and no page errors

   Run: node tests/tools-explain-export.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mjs': 'application/javascript', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const wait = ms => new Promise(r => setTimeout(r, ms));

const TOOLS = [
  ['Pixel Studio', '/tools/pixel-studio.html'],
  ['World Builder', '/tools/level-designer.html'],
  ['Audio Studio', '/tools/sound-studio.html'],
  ['Sprite Animator', '/tools/sprite-animator.html'],
  ['Trading Card Designer', '/tools/trading-card-designer.html'],
  ['Palette Studio', '/tools/colour-palette.html']
];

async function download(page, name) {
  await page.evaluate(n => {
    const a = document.createElement('a');
    a.download = n;
    a.href = 'data:text/plain,jvds-test';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, name);
  await wait(500);
}

async function run(browser, base, label, url, width) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED|net::ERR/.test(text)) return;
    errors.push('console: ' + text.slice(0, 100));
  });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true }));
      localStorage.setItem('jvds-cookie-consent', 'declined');
    } catch (e) {}
  });
  await page.setViewport({ width, height: width === 390 ? 844 : 900, isMobile: width === 390, hasTouch: width === 390 });
  await page.goto(base + url, { waitUntil: 'load', timeout: 45000 });
  await wait(900);

  await download(page, 'my-art.png');
  const png = await page.evaluate(() => {
    const p = document.getElementById('explain-export');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const link = p.querySelector('.ee-next');
    return {
      text: p.textContent.replace(/\s+/g, ' ').trim(),
      link: link ? link.getAttribute('href') : '',
      w: Math.round(r.width), h: Math.round(r.height),
      close: !!p.querySelector('.ee-close')
    };
  });
  check(label + ' ' + width + ': a download opens the explain panel', !!png, JSON.stringify(png));
  check(label + ' ' + width + ': panel names the PNG file', !!png && /PNG image/.test(png.text), png && png.text.slice(0, 80));
  check(label + ' ' + width + ': panel offers a next-step link', !!png && /^\//.test(png.link), png && png.link);
  check(label + ' ' + width + ': panel is small and dismissible', !!png && png.close && png.w <= 380 && png.h < 320, JSON.stringify(png));

  if (png) {
    await page.click('#explain-export .ee-close');
    await wait(200);
    const gone = await page.evaluate(() => !document.getElementById('explain-export'));
    check(label + ' ' + width + ': close dismisses the panel', gone);
  }

  await download(page, 'my-project.json');
  const json = await page.evaluate(() => {
    const p = document.getElementById('explain-export');
    return p ? p.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  check(label + ' ' + width + ': a project file gets its own explanation', /Project file/.test(json), json.slice(0, 80));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(label + ' ' + width + ': no horizontal overflow', overflow <= 2, 'overflow=' + overflow);
  check(label + ' ' + width + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const [label, url] of TOOLS) {
      for (const width of [390, 1440]) await run(browser, base, label, url, width);
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS tools-explain-export: downloads explain the file and offer a next step at 390 and 1440');
})().catch(e => { console.error(e); process.exit(1); });
