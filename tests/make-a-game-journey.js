#!/usr/bin/env node
/*
 * tests/make-a-game-journey.js , A1718
 * The visible three-step path must carry art from Pixel Studio to Sprite
 * Animator to the Arcade Game Maker, so a learner can draw a character once
 * and reach a playable game. Run:
 *   node tests/make-a-game-journey.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.MJ_PORT || 8996;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.woff2':'font/woff2',
  '.svg':'image/svg+xml', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon/.test(t)) return;
    errors.push(t);
  });

  const openSheetOn = async (tool) => {
    await page.waitForFunction(
      (t) => location.pathname.includes(t) && !!document.querySelector('#mj-sheet.open'),
      { timeout: 20000 }, tool);
  };
  const activeStep = () => page.evaluate(() => {
    const li = document.querySelector('#mj-steps .mj-step.on');
    return li ? parseInt((li.querySelector('.mj-step-txt b') || {}).textContent, 10) : 0;
  });
  const clickNext = () => page.evaluate(() => document.getElementById('mj-next').click());

  // ── 1. Pixel Studio: the path sheet opens from the #make-a-game entry ──────
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + 'tools/pixel-studio.html#make-a-game', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mj-sheet.open', { timeout: 20000 });

  check('entry link opens the make-a-game sheet', true);
  check('sheet lists three steps', await page.evaluate(() => document.querySelectorAll('#mj-steps .mj-step').length) === 3);
  check('step 1 is the current step', await activeStep() === 1);
  check('a Make a game pill is available', await page.evaluate(() => !!document.getElementById('mj-pill')));
  check('next button offers to animate', await page.evaluate(() => /animate/i.test(document.getElementById('mj-next').textContent)));

  // Wait for Pixel Studio to finish initialising (the sheet opens at
  // DOMContentLoaded, before the tool's own rAF-based init runs).
  await page.waitForFunction(
    () => typeof onionCanvas !== 'undefined' && !!onionCanvas &&
          typeof mainCanvas !== 'undefined' && !!mainCanvas,
    { timeout: 20000 });

  // Draw a small character so step 1 has real art to carry.
  await page.evaluate(() => new Promise(resolve => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = '#7C6CF0'; x.fillRect(0, 0, 8, 8);
    x.fillStyle = '#FFD23C'; x.fillRect(2, 2, 4, 4);
    x.fillStyle = '#1a1208'; x.fillRect(2, 2, 1, 1); x.fillRect(5, 2, 1, 1);
    loadSheetDataUrlAsProject(c.toDataURL('image/png'), 8, 8);
    setTimeout(resolve, 300);
  }));

  // ── 2. Tap Next: art arrives in Sprite Animator, sheet continues ───────────
  await clickNext();
  await openSheetOn('sprite-animator');
  check('tap 1 lands in Sprite Animator', true);
  check('step 2 is the current step', await activeStep() === 2);
  const carried = await page.waitForFunction(
    () => typeof sheetImg !== 'undefined' && !!sheetImg && sheetImg.naturalWidth > 0,
    { timeout: 10000 }).then(() => true).catch(() => false);
  check('the drawn art arrives in Sprite Animator', carried);

  // ── 3. Tap Next: art arrives in the Arcade Game Maker ─────────────────────
  await clickNext();
  await openSheetOn('arcade-game-maker');
  check('tap 2 lands in the Game Maker', true);
  check('step 3 is the current step', await activeStep() === 3);
  const imported = await page.waitForFunction(
    () => typeof customSpriteDataUrl !== 'undefined' && !!customSpriteDataUrl,
    { timeout: 10000 }).then(() => true).catch(() => false);
  check('the art arrives as the game sprite', imported);

  // ── 4. Tap Play: the game boots ───────────────────────────────────────────
  await clickNext();
  await page.waitForFunction(() => !!document.querySelector('#game-container canvas'), { timeout: 20000 })
    .then(() => true).catch(() => false);
  await page.evaluate(() => {
    const ov = document.getElementById('introOverlay');
    if (ov && ov.classList.contains('show')) {
      if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show');
    }
  });
  const booted = await page.waitForFunction(() => !!document.querySelector('#game-container canvas'), { timeout: 10000 })
    .then(() => true).catch(() => false);
  check('tap 3 plays the game', booted);

  // ── 5. Phone width on the entry page has no horizontal scroll ─────────────
  await page.goto(BASE + 'tools/pixel-studio.html#make-a-game', { waitUntil: 'domcontentloaded' });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.waitForSelector('#mj-pill', { timeout: 20000 });
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check('390px: no horizontal scroll', noScroll === true);

  check('no uncaught JS errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL MAKE-A-GAME JOURNEY CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
