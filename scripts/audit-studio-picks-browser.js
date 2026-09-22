const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PICKS = [
  'pixel-pet-arena.html',
  'creature-rescue-clinic.html',
  'backpack-quest.html',
  'marble-run-lab.html',
  'echo-casebook.html',
  'beat-builder-battle.html',
  'stardust-ruins.html',
  'garden-defense.html'
];
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 900, isMobile: false, hasTouch: false }
];
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };
const failures = [];
const notes = [];

function fail(label, msg) { failures.push(`${label}: ${msg}`); }
function serve() {
  return http.createServer((req, res) => {
    let reqPath;
    try { reqPath = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    const target = path.resolve(ROOT, '.' + (reqPath === '/' ? '/index.html' : reqPath));
    if (!target.startsWith(ROOT) || !fs.existsSync(target)) { res.writeHead(404); return res.end(''); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });
}

(async () => {
  const server = serve();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    for (const viewport of VIEWPORTS) {
      for (const file of PICKS) {
        const label = `${file} @ ${viewport.name}`;
        const page = await browser.newPage();
        const pageErrors = [];
        const consoleErrors = [];
        page.on('pageerror', e => pageErrors.push(e.message));
        page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
        await page.setViewport(viewport);
        try {
          await page.goto(`http://127.0.0.1:${port}/games/${file}`, { waitUntil: 'networkidle0', timeout: 30000 });
          const metrics = await page.evaluate(() => {
            const q = document.querySelector('.quality-panel,.gd-quality-panel');
            const build = [...document.querySelectorAll('a[href*="/tools/"],a[href^="../tools/"]')].length;
            const buttons = [...document.querySelectorAll('button,a')].filter(el => {
              const r = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
            }).length;
            const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
            const headings = [...document.querySelectorAll('h1,h2,h3')].map(h => h.textContent.trim()).filter(Boolean).slice(0, 8);
            return { hasQualityPanel: !!q, buildLinks: build, visibleActions: buttons, overflow, headings };
          });
          if (!metrics.hasQualityPanel) fail(label, 'missing Studio Pick quality panel');
          if (metrics.buildLinks < 1) fail(label, 'missing build-next link');
          if (metrics.visibleActions < 3) fail(label, 'too few visible first-screen actions');
          if (metrics.overflow > 8) fail(label, `horizontal overflow ${metrics.overflow}px`);
          if (pageErrors.length) fail(label, `page errors: ${pageErrors.slice(0, 2).join(' | ')}`);
          if (consoleErrors.length) notes.push(`${label}: console errors observed: ${consoleErrors.slice(0, 2).join(' | ')}`);
        } catch (e) {
          fail(label, e.message);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  notes.forEach(n => console.log(`[INFO] ${n}`));
  if (failures.length) {
    failures.forEach(f => console.log(`[FAIL] ${f}`));
    process.exit(1);
  }
  console.log(`Studio Pick browser audit passed for ${PICKS.length} games across ${VIEWPORTS.length} viewports.`);
})().catch(e => { console.error(e); process.exit(1); });
