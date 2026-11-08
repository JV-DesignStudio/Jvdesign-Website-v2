/* Arcane Citadel fullscreen contract (A2837).

   The arcade card used to point at games/arcane_citadel_page.html, an iframe
   landing wrapper. A2837 points it at the real game (games/arcane_citadel.html),
   which is already a fixed-viewport canvas with its own start screen, and turns
   the wrapper into a redirect.

   Proves: registry target, no iframe, indexable self-canonical game page,
   flagship quality markers, and that the arena fills the viewport without
   scrolling at phone portrait, phone landscape and desktop.

   Run: node tests/arcane_citadel-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const VIEWPORTS = [
  { name: 'phone portrait 390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'phone landscape 844x390', width: 844, height: 390, isMobile: true, hasTouch: true },
  { name: 'desktop 1440x900', width: 1440, height: 900, isMobile: false }
];

(async () => {
  global.window = {};
  require(path.join(root, 'games-registry.js'));
  const entry = (global.window.JVDS_GAMES || []).find((g) => g.id === 'arcane-citadel');
  check('registry card exists', !!entry);
  check('registry card targets arcane_citadel.html', entry && entry.file === 'arcane_citadel.html', entry && entry.file);

  const gameHtml = fs.readFileSync(path.join(root, 'games/arcane_citadel.html'), 'utf8');
  check('game page has no iframe', !/<iframe\b/i.test(gameHtml));
  check('game page is indexable', /name=["']robots["'][^>]*index/i.test(gameHtml));
  check('game canonical is self', /rel=["']canonical["'][^>]*games\/arcane_citadel\.html/i.test(gameHtml));
  check('flagship quality panel present', /quality-panel/.test(gameHtml) && /<b>Goal<\/b>/.test(gameHtml) && /<b>Skill<\/b>/.test(gameHtml) && /<b>Session<\/b>/.test(gameHtml) && /<b>Build next<\/b>/.test(gameHtml));
  check('build-next tools link present', /href="\.\.\/tools\//.test(gameHtml));
  check('Echo field guide present', /class="citadel-guide"/.test(gameHtml) && /Echo's field guide/.test(gameHtml));

  const pageHtml = fs.readFileSync(path.join(root, 'games/arcane_citadel_page.html'), 'utf8');
  check('old wrapper redirects to the game', /http-equiv=["']refresh["'][^>]*url=arcane_citadel\.html/i.test(pageHtml));
  check('old wrapper canonical points at the game', /rel=["']canonical["'][^>]*games\/arcane_citadel\.html/i.test(pageHtml));
  check('old wrapper no longer embeds an iframe', !/<iframe\b/i.test(pageHtml));

  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 90)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport(vp);
      await page.goto(base + '/games/arcane_citadel.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await new Promise(r => setTimeout(r, 800));

      const info = await page.evaluate(() => {
        const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, left: b.left, width: b.width, height: b.height, bottom: b.bottom, right: b.right }; };
        const start = document.getElementById('screen-start');
        const visible = start ? getComputedStyle(start).display !== 'none' && start.offsetParent !== null : false;
        return {
          title: document.title,
          scrollH: document.documentElement.scrollHeight,
          scrollW: document.documentElement.scrollWidth,
          vh: window.innerHeight,
          vw: window.innerWidth,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          startVisible: visible,
          guide: !!document.querySelector('.citadel-guide'),
          canvas: rect(document.getElementById('gameCanvas')),
          hasFullscreen: !!(document.querySelector('.gs-fullscreen-btn') || document.getElementById('btn-fullscreen'))
        };
      });

      check(vp.name + ': title names Arcane Citadel', /Arcane Citadel/i.test(info.title), info.title);
      check(vp.name + ': start screen is visible', info.startVisible);
      check(vp.name + ': Echo field guide is available', info.guide);
      check(vp.name + ': arena has no vertical page scroll', info.scrollH <= info.vh + 2, 'scrollH=' + info.scrollH + ' vh=' + info.vh);
      check(vp.name + ': no horizontal overflow', info.overflowX <= 2, 'overflow=' + info.overflowX);
      check(vp.name + ': canvas fills the viewport',
        !!info.canvas && info.canvas.width >= info.vw - 2 && info.canvas.height >= info.vh - 2,
        info.canvas ? Math.round(info.canvas.width) + 'x' + Math.round(info.canvas.height) : 'no canvas');
      check(vp.name + ': fullscreen control is available', info.hasFullscreen);
      check(vp.name + ': no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }

  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
