#!/usr/bin/env node
/*
 * tests/arcade-game-maker-inline-fallbacks.js , A2705
 * Blocks every mascot/logo file image and proves the inline SVG fallbacks engage,
 * no external placeholder is requested, the visible Ember images keep their size,
 * the page still fits at 390px, and a game still boots.
 * Each measurement uses a fresh browser so the second run cannot reuse the first
 * run's image cache.
 * Run: node tests/arcade-game-maker-inline-fallbacks.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_FALLBACK_PORT || 8999;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

function serve(){
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);
}

const BLOCK = /(\/logo\.png|\/assets\/mascots\/)/i;

async function measure(block, keepOpen){
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const requests = [];
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', req => {
    requests.push(req.url());
    if (block && BLOCK.test(req.url())) return req.abort();
    req.continue();
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.compileAndBootEngine === 'function', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1800));
  const data = await page.evaluate(() => {
    const pick = sel => document.querySelector(sel);
    const logo = pick('.logo-link img');
    const map = window.__arcadeInlineFallbacks || {};
    const ember = Array.from(document.images).filter(img => {
      const src = img.getAttribute('src') || '';
      if (!/ember-(hero|badge)\.webp/.test(src) && img.getAttribute('data-inline-fallback') !== 'ember') return false;
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(img => {
      const r = img.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), src: img.getAttribute('src') };
    });
    return {
      logo: { src: logo && logo.getAttribute('src'), fallbackAttr: !!(logo && logo.hasAttribute('data-fallback')), inlineKey: logo && logo.getAttribute('data-inline-fallback') },
      map: { pip: map.pip, echo: map.echo, ember: map.ember, stardust: map.stardust, lumo: map.lumo },
      ember
    };
  });
  if (!keepOpen) await browser.close();
  return { browser, page, data, requests };
}

(async () => {
  const server = serve();
  const normal = await measure(false, false);
  const blocked = await measure(true, true);

  const isInline = s => typeof s === 'string' && s.startsWith('data:image/svg+xml');
  check('A2705 failed logo swaps to an inline SVG', isInline(blocked.data.logo.src));
  check('A2705 logo no longer carries the external fallback attribute', blocked.data.logo.fallbackAttr === false);
  check('A2705 every character has an inline fallback', ['stardust','lumo','ember','pip','echo'].every(k => isInline(blocked.data.map[k])), Object.keys(blocked.data.map).join(','));
  check('A2705 visible Ember images swap to inline SVGs', blocked.data.ember.length > 0 && blocked.data.ember.every(e => isInline(e.src)), JSON.stringify(blocked.data.ember));

  const placehold = blocked.requests.filter(u => /placehold\.co/i.test(u));
  check('A2705 no external placeholder request', placehold.length === 0, placehold.slice(0, 2).join(' | '));

  const sizes = list => list.map(e => e.w + 'x' + e.h).sort().join(',');
  check('A2705 visible Ember images keep their size', sizes(normal.data.ember) === sizes(blocked.data.ember), `${sizes(normal.data.ember)} -> ${sizes(blocked.data.ember)}`);

  // The page still fits a phone, and a game still boots with the images blocked.
  await blocked.page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 150));
  const overflow = await blocked.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('A2705 fits at 390px with fallbacks', overflow <= 1, overflow + 'px');

  await blocked.page.evaluate(() => {
    const g = document.getElementById('genreMode');
    if (g) { g.value = 'SHOOTER'; if (typeof onGenreChange === 'function') onGenreChange(); }
    compileAndBootEngine();
  });
  await new Promise(r => setTimeout(r, 900));
  await blocked.page.evaluate(() => {
    const el = document.getElementById('introOverlay');
    if (el && el.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else el.classList.remove('show'); }
  });
  await new Promise(r => setTimeout(r, 1800));
  const boot = await blocked.page.evaluate(() => ({
    canvas: !!document.querySelector('#game-container canvas'),
    scene: !!(window._phaserGame && window._phaserGame.scene && window._phaserGame.scene.scenes && window._phaserGame.scene.scenes.length)
  }));
  check('A2705 a game still boots with the mascot images blocked', boot.canvas && boot.scene, JSON.stringify(boot));

  await blocked.browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
