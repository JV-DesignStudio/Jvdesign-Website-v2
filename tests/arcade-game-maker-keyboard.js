#!/usr/bin/env node
/*
 * tests/arcade-game-maker-keyboard.js , A2688
 * Every visible maker control must have an accessible name, focus must be
 * visible, the genre and starter grids must use roving tabindex, arrow keys must
 * move between them, sliders must respond to Arrow/Home/End, and the skip links
 * must land on the canvas or builder.
 * Run: node tests/arcade-game-maker-keyboard.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_KEYS_PORT || 0);
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
  await page.setViewport({ width:1280, height:900 });

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window._initMakerKeyboard === 'function' && document.getElementById('genre-picker'), { timeout:15000 });
    await sleep(300);

    const audit = await page.evaluate(() => {
      const root = document.getElementById('studioRoot') || document;
      const controls = Array.from(root.querySelectorAll('button, input, select, textarea, a[href]')).filter(el => {
        if (el.type === 'hidden') return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        return true;
      });
      const unlabelled = [];
      controls.forEach(el => {
        let name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '').trim();
        if (!name && el.id) { const lab = root.querySelector('label[for="' + el.id + '"]'); if (lab) name = lab.textContent.trim(); }
        if (!name && el.closest('label')) name = el.closest('label').textContent.trim();
        if (!name) name = (el.textContent || '').trim();
        if (!name) name = (el.getAttribute('title') || '').trim();
        if (!name) name = (el.getAttribute('placeholder') || '').trim();
        if (!name) unlabelled.push(el.tagName.toLowerCase() + '#' + (el.id || '') + '.' + String(el.className || '').split(' ')[0]);
      });
      return { total: controls.length, unlabelled };
    });
    check('every visible maker control has an accessible name', audit.unlabelled.length === 0, audit.unlabelled.slice(0, 8).join(', ') + ' of ' + audit.total);

    const skip = await page.evaluate(() => {
      const gameLink = document.querySelector('a[data-on="_skipToGame"]');
      const builderLink = document.querySelector('a[data-on="_skipToBuilder"]');
      if (gameLink) gameLink.click();
      const gameFocus = document.activeElement && (document.activeElement.id || document.activeElement.tagName);
      if (builderLink) builderLink.click();
      const builderFocus = document.activeElement && (document.activeElement.id || document.activeElement.tagName);
      return { game: !!gameLink, builder: !!builderLink, gameFocus, builderFocus };
    });
    check('skip links exist for canvas and builder', skip.game === true && skip.builder === true);
    check('skip to game focuses the game area', skip.gameFocus === 'game-container' || skip.gameFocus === 'CANVAS', skip.gameFocus);
    check('skip to builder focuses the studio panel or first control', skip.builderFocus === 'studioPanel' || (skip.builderFocus && skip.builderFocus !== 'BODY'), skip.builderFocus);

    const ring = await page.evaluate(() => {
      const btn = document.getElementById('runGameBtn');
      btn.focus();
      const cs = getComputedStyle(btn);
      return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, tag: document.activeElement === btn };
    });
    check('focused control has a visible focus ring', ring.tag === true && ring.outlineStyle !== 'none' && parseFloat(ring.outlineWidth) >= 2, JSON.stringify(ring));

    const genreRoving = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#genre-picker .genre-card'));
      const zeros = items.filter(el => el.tabIndex === 0).length;
      return { total: items.length, zeros, negs: items.filter(el => el.tabIndex === -1).length };
    });
    check('genre grid has exactly one tab stop', genreRoving.total > 0 && genreRoving.zeros === 1 && genreRoving.negs === genreRoving.total - 1, JSON.stringify(genreRoving));

    await page.evaluate(() => { const items = Array.from(document.querySelectorAll('#genre-picker .genre-card')); const z = items.find(el => el.tabIndex === 0); if (z) z.focus(); });
    await page.keyboard.press('ArrowRight');
    const genreMoved = await page.evaluate(() => ({
      focused: document.activeElement && document.activeElement.getAttribute('data-genre'),
      zeros: Array.from(document.querySelectorAll('#genre-picker .genre-card')).filter(el => el.tabIndex === 0).map(el => el.getAttribute('data-genre'))
    }));
    check('ArrowRight moves the genre roving focus', genreMoved.zeros.length === 1 && genreMoved.focused === genreMoved.zeros[0], JSON.stringify(genreMoved));

    const starterRoving = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#starterGrid .starter-btn'));
      const zeros = items.filter(el => el.tabIndex === 0).length;
      return { total: items.length, zeros, negs: items.filter(el => el.tabIndex === -1).length };
    });
    check('starter grid has exactly one tab stop', starterRoving.total > 0 && starterRoving.zeros === 1 && starterRoving.negs === starterRoving.total - 1, JSON.stringify(starterRoving));

    const hasSlider = await page.evaluate(() => {
      if (typeof _applyBuildMore === 'function') _applyBuildMore(true);
      const lmg = document.getElementById('levelMapGroup'); if (lmg) lmg.style.display = 'block';
      const panel = document.getElementById('studioPanel'); if (panel) panel.classList.add('panel-open');
      return !!document.getElementById('playerSpeedRange');
    });
    await sleep(250);
    await page.evaluate(() => { const el = document.getElementById('playerSpeedRange'); if (el) el.focus(); });
    const before = await page.evaluate(() => Number(document.getElementById('playerSpeedRange').value));
    await page.keyboard.press('ArrowRight');
    const afterRight = await page.evaluate(() => Number(document.getElementById('playerSpeedRange').value));
    await page.keyboard.press('Home');
    const afterHome = await page.evaluate(() => Number(document.getElementById('playerSpeedRange').value));
    await page.keyboard.press('End');
    const afterEnd = await page.evaluate(() => Number(document.getElementById('playerSpeedRange').value));
    const bounds = await page.evaluate(() => ({ min: Number(document.getElementById('playerSpeedRange').min), max: Number(document.getElementById('playerSpeedRange').max) }));
    check('range slider responds to ArrowRight', hasSlider === true && afterRight > before, before + ' -> ' + afterRight);
    check('range slider responds to Home', afterHome === bounds.min, String(afterHome));
    check('range slider responds to End', afterEnd === bounds.max, String(afterEnd));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker keyboard: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
