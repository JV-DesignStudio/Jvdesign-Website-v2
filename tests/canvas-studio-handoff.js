// canvas-studio-handoff.js - every canvas build-along with a browser studio must
// hand off to it from the shared "Keep going" box, so a learner who built on the
// canvas can carry the project into the full export studio (build as you go).
//
// Run: node tests/canvas-studio-handoff.js
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const WORKSHOPS = path.join(root, 'workshops');
const ENGINE = fs.readFileSync(path.join(root, 'workshop-canvas-engine.js'), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

// --- Parse CANVAS_STUDIO_MAP out of the shared engine (pure JSON-ish literal) ---
const m = ENGINE.match(/CANVAS_STUDIO_MAP\s*=\s*(\{[\s\S]*?\n\});/);
if (!m) { check('CANVAS_STUDIO_MAP exists in workshop-canvas-engine.js', false); process.exit(1); }
let STUDIO;
try { STUDIO = JSON.parse(m[1]); } catch (e) { check('CANVAS_STUDIO_MAP parses as JSON', false, e.message); process.exit(1); }
const keys = Object.keys(STUDIO);
check('CANVAS_STUDIO_MAP parses', true, keys.length + ' entries');
check('covers at least 64 canvases', keys.length >= 64, 'count ' + keys.length);

const STUDIOS = new Set();
const missingCanvas = [], missingStudio = [];
for (const k of keys) {
  const v = STUDIO[k];
  if (!fs.existsSync(path.join(WORKSHOPS, k))) missingCanvas.push(k);
  if (!v || !v.href || !v.label) missingStudio.push(k);
  else STUDIOS.add(v.href);
  if (v && v.href && !fs.existsSync(path.join(WORKSHOPS, v.href))) missingStudio.push(k + '->' + v.href);
}
check('every mapped canvas file exists', missingCanvas.length === 0, missingCanvas.join(', '));
check('every mapped studio file exists', missingStudio.length === 0, missingStudio.join(', '));
check('covers C++, Godot, Python, Scratch, PICO-8, Defold, Java, GameMaker and GDevelop studios',
  ['cpp-mod-studio.html', 'godot-mod-studio.html', 'python-mod-studio.html', 'scratch-studio.html', 'pico8-studio.html', 'defold-mod-studio.html', 'java-mod-studio.html', 'gml-mod-studio.html', 'gdevelop-mod-studio.html'].every((s) => STUDIOS.has(s)),
  [...STUDIOS].join(', '));

// --- Runtime: the hand-off actually renders on the page ---
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const WITH_STUDIO = [
  ['cpp-pong-canvas.html', 'cpp-mod-studio.html'],
  ['godot-racing-canvas.html', 'godot-mod-studio.html'],
  ['python-catch-canvas.html', 'python-mod-studio.html'],
  ['scratch-pong-canvas.html', 'scratch-studio.html'],
  ['pico8-snake-canvas.html', 'pico8-studio.html'],
  ['my-first-scratch-game-canvas.html', 'scratch-studio.html'],
  ['defold-snake-canvas.html', 'defold-mod-studio.html'],
  ['java-pong-canvas.html', 'java-mod-studio.html'],
  ['gml-pong-canvas.html', 'gml-mod-studio.html'],
  ['gdevelop-pong-canvas.html', 'gdevelop-mod-studio.html']
];
const NO_STUDIO = [];

(async () => {
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    for (const [file, studio] of WITH_STUDIO) {
      errors.length = 0;
      await page.goto(base + '/workshops/' + file, { waitUntil: 'load' });
      const el = await page.$('.cw-next-btn--studio');
      const href = el ? await el.evaluate((n) => n.getAttribute('href')) : '';
      const text = el ? await el.evaluate((n) => n.textContent) : '';
      check(file + ': shows the studio hand-off', !!el, 'no .cw-next-btn--studio');
      check(file + ': points at ' + studio, (href || '').includes(studio), href || '');
      check(file + ': label reads Open the full', /Open the full/.test(text), text);
      check(file + ': no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    }

    for (const file of NO_STUDIO) {
      errors.length = 0;
      await page.goto(base + '/workshops/' + file, { waitUntil: 'load' });
      const el = await page.$('.cw-next-btn--studio');
      check(file + ': no studio button (engine has no studio)', !el);
      check(file + ': no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    }

    // Layout on a studio canvas at both breakpoints
    await page.goto(base + '/workshops/cpp-pong-canvas.html', { waitUntil: 'load' });
    const desk = await page.evaluate(() => document.documentElement.scrollWidth);
    check('1440px no overflow', desk <= 1442, desk + '');
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load' });
    const box = await page.evaluate(() => {
      const b = document.querySelector('.cw-next');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { right: Math.round(r.right), vw: window.innerWidth };
    });
    check('390px hand-off box fits the viewport', !!box && box.right <= box.vw + 1, box ? 'right ' + box.right + ' vw ' + box.vw : 'no box');
    const mobBtn = await page.$('.cw-next-btn--studio');
    check('390px still shows the studio button', !!mobBtn);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
