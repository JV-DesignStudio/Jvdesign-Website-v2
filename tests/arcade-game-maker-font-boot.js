#!/usr/bin/env node
/*
 * tests/arcade-game-maker-font-boot.js , A2707
 * Proves the maker holds the Phaser boot until the HUD webfonts are ready, with
 * a cached gate and a timeout fallback, so text is not painted in a fallback
 * font for the whole session.
 * Run: node tests/arcade-game-maker-font-boot.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_FONT_PORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
  await page.setViewport({ width:1280, height:900 });

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window._waitForGameFonts === 'function' && typeof window._launchPhaserGame === 'function', { timeout:15000 });

    // A2707: the gate is cached and holds the first Phaser frame.
    const gate = await page.evaluate(async () => {
      await ensurePhaser();
      _engineData = getPayload();
      window.__fontGate = { resolved:false };
      _gameFontsPromise = new Promise(function(resolve) {
        setTimeout(function() { window.__fontGate.resolved = true; resolve(); }, 700);
      });
      const cached = _waitForGameFonts(50) === _gameFontsPromise;
      _launchPhaserGame();
      return { cached, phaser: !!(window.Phaser && typeof window.Phaser.Game === 'function') };
    });
    check('font gate exists, is cached and Phaser is loaded', gate.cached === true && gate.phaser === true, JSON.stringify(gate));

    await sleep(250);
    const early = await page.evaluate(() => ({ game: !!window._phaserGame, resolved: window.__fontGate.resolved }));
    check('game waits while fonts are unresolved', early.game === false && early.resolved === false, JSON.stringify(early));

    await sleep(2500);
    const late = await page.evaluate(() => ({ game: !!window._phaserGame, resolved: window.__fontGate.resolved }));
    check('game boots after fonts resolve', late.game === true && late.resolved === true, JSON.stringify(late));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker font boot: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
