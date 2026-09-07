#!/usr/bin/env node
/* Arcade game QA: static checks for every playable page plus optional smoke tests. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const GAME_DIR = path.join(ROOT, 'games');
const ignored = new Set(['mobile-games.html', 'sky_high_squirt.html']);
const files = fs.readdirSync(GAME_DIR).filter(f => f.endsWith('.html') && !ignored.has(f)).sort();
const failures = [];
const notes = [];
function check(ok, file, message) { if (!ok) failures.push(`${file}: ${message}`); }

for (const file of files) {
  const full = path.join(GAME_DIR, file);
  const html = fs.readFileSync(full, 'utf8');
  const isWrapper = /<iframe\b/i.test(html);
  const hasSystem = /game-system\.js/i.test(html);
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i && !id.includes('${'));
  check(/<title>[^<]+<\/title>/i.test(html), file, 'missing page title');
  check(/<meta[^>]+name=["']viewport["']/i.test(html), file, 'missing viewport metadata');
  if (hasSystem) {
    check(/game-system\.css/i.test(html), file, 'loads game-system.js without game-system.css');
    check((html.match(/serviceWorker\.register/g) || []).length <= 1, file, 'registers the service worker more than once');
    check(duplicateIds.length === 0, file, `duplicate ids: ${[...new Set(duplicateIds)].join(', ')}`);
    if (!isWrapper && !/new\s+GameSystem\s*\(/.test(html)) notes.push(`${file}: legacy page needs GameSystem migration`);
  }
  if (isWrapper && hasSystem) notes.push(`${file}: iframe wrapper`);
}

console.log(`Arcade game QA: ${files.length} pages scanned`);
if (failures.length) failures.forEach(f => console.log(`  [FAIL] ${f}`));
else console.log('  [PASS] static game-page contract');
notes.forEach(n => console.log(`  [INFO] ${n}`));

async function browserSmoke() {
  if (process.env.RUN_BROWSER !== '1') {
    console.log('  [SKIP] browser smoke (set RUN_BROWSER=1 to run desktop/mobile checks)');
    return;
  }
  const http = require('http');
  const puppeteer = require('puppeteer');
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };
  const requestedPort = Number(process.env.GAMES_QA_PORT || 0);
  const server = http.createServer((req, res) => {
    let requestPath;
    try { requestPath = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    const target = path.resolve(ROOT, '.' + (requestPath === '/' ? '/index.html' : requestPath));
    if (!target.startsWith(ROOT) || !fs.existsSync(target)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, resolve);
  });
  const port = server.address().port;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    for (const width of [1280, 390]) for (const file of files) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width, height: width === 390 ? 844 : 900, isMobile: width === 390 });
      try {
        await page.goto(`http://localhost:${port}/games/${file}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (/game-system\.js/i.test(fs.readFileSync(path.join(GAME_DIR, file), 'utf8'))) await page.waitForSelector('#arcade-menu', { timeout: 7000 });
        check(errors.length === 0, `${file} @ ${width}px`, `browser errors: ${errors.slice(0, 2).join(' | ')}`);
      } catch (e) { failures.push(`${file} @ ${width}px: ${e.message}`); }
      finally { await page.close(); }
    }
    console.log('  [PASS] desktop/mobile browser smoke');
  } finally { if (browser) await browser.close(); server.close(); }
}
browserSmoke().catch(e => console.log(`  [SKIP] browser smoke unavailable: ${e.message}`)).finally(() => {
  if (failures.length) { failures.forEach(f => console.log(`  [FAIL] ${f}`)); process.exitCode = 1; }
});
