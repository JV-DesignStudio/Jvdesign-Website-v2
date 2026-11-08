/* Critter Whack fullscreen contract (A2836).

   Proves the rebuilt game behaves like Nova Siege: one fixed-viewport page, the
   board fully visible without scrolling on phone portrait, phone landscape and
   desktop, an in-game start overlay, and the shared fullscreen shell.

   Run: node tests/critter-whack-game.js
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
  // The Arcade card (registry) must launch the game, not a landing page.
  global.window = {};
  require(path.join(root, 'games-registry.js'));
  const entry = (global.window.JVDS_GAMES || []).find((g) => g.id === 'critter-whack');
  check('registry card exists', !!entry);
  check('registry card targets critter-whack.html', entry && entry.file === 'critter-whack.html', entry && entry.file);

  const html = fs.readFileSync(path.join(root, 'games/critter-whack.html'), 'utf8');
  check('viewport meta does not disable zoom', /<meta[^>]+name=["']viewport["']/i.test(html) && !/user-scalable\s*=\s*no|maxim(?:um)?-scale\s*=\s*1/i.test(html));
  check('game page has no iframe', !/<iframe\b/i.test(html));

  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport(vp);
      await page.goto(base + '/games/critter-whack.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 450));

      const before = await page.evaluate(() => ({
        scrollH: document.documentElement.scrollHeight,
        vh: window.innerHeight,
        vw: window.innerWidth,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check(vp.name + ': title screen fits without vertical scroll', before.scrollH <= before.vh + 2, 'scrollH=' + before.scrollH + ' vh=' + before.vh);
      check(vp.name + ': no horizontal overflow', before.overflowX <= 2, 'overflow=' + before.overflowX);

      await page.evaluate(() => { const b = document.getElementById('startBtn'); if (b) b.click(); });
      await new Promise(r => setTimeout(r, 450));

      const after = await page.evaluate(() => {
        const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height }; };
        const run = window.__storyRun;
        return {
          overlayHidden: document.getElementById('overlay').classList.contains('hidden'),
          scrollH: document.documentElement.scrollHeight,
          vh: window.innerHeight,
          vw: window.innerWidth,
          board: rect(document.querySelector('.board')),
          hole: rect(document.querySelector('.hole')),
          run: run ? { id: run.id, character: run.character, cap: run.cap, running: run.running } : null
        };
      });

      check(vp.name + ': start overlay hides on play', after.overlayHidden);
      check(vp.name + ': play field fits without vertical scroll', after.scrollH <= after.vh + 2, 'scrollH=' + after.scrollH + ' vh=' + after.vh);
      check(vp.name + ': board is fully inside the viewport',
        !!after.board && after.board.top >= -1 && after.board.left >= -1 &&
        after.board.bottom <= after.vh + 1 && after.board.right <= after.vw + 1,
        after.board ? JSON.stringify({ top: Math.round(after.board.top), bottom: Math.round(after.board.bottom), left: Math.round(after.board.left), right: Math.round(after.board.right) }) : 'no board');
      check(vp.name + ': holes are usable tap targets', !!after.hole && after.hole.width >= 24 && after.hole.height >= 24,
        after.hole ? Math.round(after.hole.width) + 'x' + Math.round(after.hole.height) : 'no hole');
      check(vp.name + ': shared run layer is active', !!after.run && after.run.id === 'critter-whack' && after.run.character === 'Echo' && after.run.cap === 300, JSON.stringify(after.run));
      check(vp.name + ': no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // Fullscreen shell: entering immersive fills the viewport and offers an exit.
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/games/critter-whack.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 400));
    const entered = await page.evaluate(() => {
      window.JVDSGameShell.enter();
      return {
        immersive: document.documentElement.classList.contains('jvds-immersive'),
        root: !!document.querySelector('.jvds-root'),
        exit: !!document.getElementById('jvds-exit')
      };
    });
    check('fullscreen shell enters immersive mode', entered.immersive);
    check('fullscreen shell fills a game root', entered.root);
    check('fullscreen shell offers an exit control', entered.exit);
    const exited = await page.evaluate(() => {
      window.JVDSGameShell.exit();
      return !document.documentElement.classList.contains('jvds-immersive');
    });
    check('fullscreen shell exits cleanly', exited);
    check('fullscreen shell no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }

  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
