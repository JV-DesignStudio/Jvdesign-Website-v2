/* A1440: keep-rule playtest for flagship candidates.

   Pixel Pet Arena, Creature Rescue Clinic and Backpack Quest are stronger-hook
   games held out of the Arcade line-up as candidate showcases. Before any can
   be promoted they must pass the same keep-rule the catalogue uses (A1420):
     loads with no page errors, no horizontal overflow on phone or desktop,
     has something to interact with, survives touch input, and offers a way to
     restart or pause (or runs on the shared GameSystem).

   Run: node tests/flagship-candidates-keep-rule.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const PORT = Number(process.env.FC_PORT || 8174);
const CANDIDATES = [
  { id: 'pixel-pet-arena', file: 'pixel-pet-arena.html' },
  { id: 'creature-rescue-clinic', file: 'creature-rescue-clinic.html' },
  { id: 'backpack-quest', file: 'backpack-quest.html' },
];

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(path.normalize(root)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

function wireErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.split('\n')[0].slice(0, 90)));
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE/.test(m.text())) errors.push('console: ' + m.text().slice(0, 80));
  });
  return errors;
}

const SURFACE = () => {
  const cv = [...document.querySelectorAll('canvas')].some(c => c.width > 100 && c.height > 80);
  const board = document.querySelectorAll('#board .cell, .cell, .tile, .gem').length > 8;
  const btn = [...document.querySelectorAll('button,a[role="button"],.btn-play,#btnStart,[data-start]')]
    .some(b => /play|start|go|begin|tap/i.test((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')));
  return { cv, board, btn, any: cv || board || btn };
};
const RESTART = () => {
  const text = [...document.querySelectorAll('button,a[role="button"]')]
    .map(b => ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.id || '') + ' ' + (b.className || '')))
    .join(' | ').toLowerCase();
  const overlay = !!document.querySelector('.overlay button, .go-overlay button, #goOverlay button, #title-overlay button, #defeat-overlay button');
  const sys = !!(window.GameSystem || window.GameUI || window.EngineRuntime || window.gameSystem || window.HG);
  return { text: /restart|replay|play again|new game|reset|pause|menu|again|title|continue/.test(text), overlay, sys };
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  check('candidates to playtest', CANDIDATES.length === 3, CANDIDATES.length + ' games');

  for (const g of CANDIDATES) {
    check(g.id + ': file exists', fs.existsSync(path.join(root, 'games', g.file)), g.file);
    for (const vp of [{ name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }, { name: 'desktop', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = wireErrors(page);
      await page.setViewport(vp);
      try {
        await page.goto(`http://127.0.0.1:${PORT}/games/${g.file}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 900));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const surface = await page.evaluate(SURFACE);
        const before = errors.length;
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button,a')].find(x => /^(play|start|go|begin)/i.test(((x.textContent || '') + ' ' + (x.getAttribute('aria-label') || '')).trim()));
          if (b) b.click();
        });
        await new Promise(r => setTimeout(r, 600));
        try { await page.touchscreen.tap(195, 440); } catch (e) { }
        await page.evaluate(() => { for (const t of ['pointerdown', 'pointermove', 'pointerup']) document.dispatchEvent(new PointerEvent(t, { clientX: 195, clientY: 440, bubbles: true })); });
        await new Promise(r => setTimeout(r, 300));
        const restart = await page.evaluate(RESTART);
        const tag = `${g.id} @ ${vp.name}`;
        check(tag + ': loads with no page errors', errors.length === 0, errors.slice(0, 1).join(''));
        check(tag + ': no horizontal overflow', overflow <= 2, 'overflow=' + overflow);
        check(tag + ': has something to interact with', surface.any, JSON.stringify(surface));
        check(tag + ': survives touch input', errors.length === before, errors.slice(before, before + 1).join(''));
        check(tag + ': can restart or pause', restart.text || restart.overlay || restart.sys, JSON.stringify(restart));
      } catch (e) {
        check(`${g.id} @ ${vp.name}: loads`, false, 'nav: ' + e.message.slice(0, 50));
      }
      await page.close();
    }
  }

  await browser.close(); server.close();
  if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
  console.log('\nALL FLAGSHIP CANDIDATE KEEP-RULE CHECKS PASSED (' + CANDIDATES.length + ' games x 2 viewports)');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
