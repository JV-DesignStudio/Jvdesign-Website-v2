#!/usr/bin/env node
/*
 * tests/tower-drop-smoke.js , A2099
 *
 * Drives games/tower-drop.html in a real browser: start, perfect drop (no
 * shrink), a normal drop that shrinks, a miss that ends the game, and best
 * score persistence across a reload. Also checks the page stays inside the
 * viewport at phone and desktop sizes and that the CSP hash lets the game run.
 *
 * Run: node tests/tower-drop-smoke.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TD_PORT || 8147);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
};
const wait = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'games', 'tower-drop.html'), 'utf8');
  check('single file has CSP hash for the inline game script', /script-src 'self' 'sha256-/.test(html));
  check('page is noindex', /<meta name="robots" content="noindex">/.test(html));
  check('canonical points at the game', /<link rel="canonical" href="https:\/\/jvdesignstudio\.co.uk\/games\/tower-drop\.html">/.test(html));
  check('no em-dashes in the file', !html.includes('\u2014'));

  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-service-workers'] });

  const open = async (viewport) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
      errors.push('console: ' + text);
    });
    await page.setViewport(viewport);
    await page.goto(BASE + '/games/tower-drop.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => !!window.__towerDrop, { timeout: 5000 });
    await wait(250);
    return { page, errors };
  };

  try {
    // phone portrait: full gameplay
    const phone = await open({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const page = phone.page;

    const layout = await page.evaluate(() => {
      const canvas = document.getElementById('game');
      const stage = document.getElementById('stage');
      const c = canvas.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      return {
        back: document.querySelector('header a')?.getAttribute('href'),
        overlayVisible: !document.getElementById('overlay').classList.contains('hidden'),
        pipLoaded: (() => { const i = document.querySelector('.pip-start'); return !!i && i.complete && i.naturalWidth > 0; })(),
        canvasInside: c.width <= s.width + 1 && c.height <= s.height + 1 && c.width > 100,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        title: document.title
      };
    });
    check('title is Tower Drop', /Tower Drop/.test(layout.title), layout.title);
    check('back link points at the arcade', layout.back === '../arcade.html', layout.back);
    check('start overlay is showing', layout.overlayVisible);
    check('Pip portrait loads on the start screen', layout.pipLoaded);
    check('canvas fits inside the stage at 390px', layout.canvasInside);
    check('no horizontal page overflow at 390px', layout.scrollWidth <= layout.clientWidth + 2, layout.scrollWidth + '/' + layout.clientWidth);
    check('no page or CSP errors at 390px', phone.errors.length === 0, phone.errors.slice(0, 2).join(' | '));

    await page.click('#startBtn');
    await wait(200);
    let snap = await page.evaluate(() => window.__towerDrop.snapshot());
    check('Play starts the game', snap.state === 'swing' && snap.score === 0, JSON.stringify(snap));

    // perfect drop: aim at the top floor centre, then drop
    await page.evaluate(() => {
      const s = window.__towerDrop.snapshot();
      window.__towerDrop.aim(s.topCx);
      window.__towerDrop.drop();
    });
    await page.waitForFunction(() => window.__towerDrop.snapshot().score === 1, { timeout: 8000 });
    snap = await page.evaluate(() => window.__towerDrop.snapshot());
    check('perfect drop scores a floor', snap.score === 1, JSON.stringify(snap));
    check('perfect drop keeps the platform width', snap.width === 150, String(snap.width));

    // normal drop, 30px off centre, should shrink by 30
    await page.evaluate(() => {
      const s = window.__towerDrop.snapshot();
      window.__towerDrop.aim(s.topCx + 30);
      window.__towerDrop.drop();
    });
    await page.waitForFunction(() => window.__towerDrop.snapshot().score === 2, { timeout: 8000 });
    snap = await page.evaluate(() => window.__towerDrop.snapshot());
    check('off-centre drop adds a floor', snap.score === 2, JSON.stringify(snap));
    check('overlap becomes the new width', snap.width === 120, String(snap.width));

    // miss completely: game over and best score saved
    await page.evaluate(() => {
      const s = window.__towerDrop.snapshot();
      window.__towerDrop.aim(s.topCx + s.width + 40);
      window.__towerDrop.drop();
    });
    await page.waitForFunction(() => window.__towerDrop.snapshot().state === 'over', { timeout: 8000 });
    await wait(150);
    const over = await page.evaluate(() => ({
      snap: window.__towerDrop.snapshot(),
      endVisible: !document.getElementById('end').classList.contains('hidden'),
      finalScore: document.getElementById('finalScore').textContent,
      bestLine: document.getElementById('bestLine').textContent,
      stored: localStorage.getItem('jvds-tower-drop-best')
    }));
    check('a full miss ends the game', over.snap.state === 'over', over.snap.state);
    check('game over shows the final score', over.finalScore === '2', over.finalScore);
    check('game over screen is visible', over.endVisible);
    check('best score is saved to localStorage', over.stored === '2', String(over.stored));

    // reload: best score persists and a fresh run starts at zero
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__towerDrop, { timeout: 5000 });
    await wait(200);
    const persisted = await page.evaluate(() => ({
      best: document.getElementById('best').textContent,
      snap: window.__towerDrop.snapshot(),
      overlayVisible: !document.getElementById('overlay').classList.contains('hidden')
    }));
    check('best score survives a reload', persisted.best === '2', persisted.best);
    check('reload returns to the start screen at zero', persisted.overlayVisible && persisted.snap.score === 0);

    await page.close();

    // desktop: layout + no errors
    const desktop = await open({ width: 1280, height: 900, isMobile: false });
    const wide = await desktop.page.evaluate(() => {
      const canvas = document.getElementById('game').getBoundingClientRect();
      const stage = document.getElementById('stage').getBoundingClientRect();
      return {
        canvasInside: canvas.width <= stage.width + 1 && canvas.height <= stage.height + 1,
        ratio: canvas.width / canvas.height,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    });
    check('canvas fits at 1280x900', wide.canvasInside, JSON.stringify(wide));
    check('canvas keeps the 400:680 ratio', Math.abs(wide.ratio - 400 / 680) < 0.01, wide.ratio.toFixed(3));
    check('no horizontal overflow at 1280px', wide.scrollWidth <= wide.clientWidth + 2);
    check('no page or CSP errors at 1280px', desktop.errors.length === 0, desktop.errors.slice(0, 2).join(' | '));
    await desktop.page.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? '  ' + failures + ' check(s) failed' : '  all tower-drop checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => {
  console.error('[FAIL] tower-drop smoke crashed:', e.message);
  server.close();
  process.exit(1);
});
