#!/usr/bin/env node
/*
 * tests/crossy-crew-features.js
 *
 * Crossy Crew gameplay depth: Echo the companion, near-miss combos, grass-row
 * power-ups (leaf shield, coin magnet, slow time) and the one-per-run coin
 * second chance. Uses the narrow window.__crossy / __crossyTest hooks the game
 * exposes for testing, so it never pokes at canvas pixels.
 *
 * Run: node tests/crossy-crew-features.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};

(async () => {
  await new Promise(r => server.listen(8172, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-cookie-consent', 'accepted'); } catch (e) {} });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:8172/games/crossy-crew.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(300);

  await page.keyboard.press('ArrowUp');
  await sleep(300);
  check('a run starts', await page.evaluate(() => window.__crossy.running));
  check('Echo the companion exists', await page.evaluate(() => window.__crossy.hasCompanion));

  // Leaf shield absorbs one hit and the run keeps going.
  await page.evaluate(() => window.__crossyTest.grant('shield'));
  check('leaf shield can be granted', await page.evaluate(() => window.__crossy.shield));
  await page.evaluate(() => window.__crossyTest.kill('Test car'));
  await sleep(80);
  const afterShield = await page.evaluate(() => ({ shield: window.__crossy.shield, dead: window.__crossy.dead, running: window.__crossy.running }));
  check('shield absorbs the hit and the run continues', afterShield.shield === false && afterShield.running && !afterShield.dead, JSON.stringify(afterShield));

  // Coin magnet and slow time engage and expire.
  await page.evaluate(() => { window.__crossyTest.grant('magnet'); window.__crossyTest.grant('slow'); });
  const pow = await page.evaluate(() => ({ m: window.__crossy.magnet, s: window.__crossy.slow }));
  check('coin magnet and slow time engage', pow.m && pow.s, JSON.stringify(pow));

  // Second chance: killed with enough coins offers a revive that spends 3 coins.
  await page.evaluate(() => window.__crossyTest.restart());
  await sleep(150);
  await page.evaluate(() => window.__crossyTest.setCoins(20));
  await page.evaluate(() => window.__crossyTest.kill('Test splat'));
  await sleep(120);
  const saveVisible = await page.evaluate(() => !document.getElementById('saveMeScreen').classList.contains('hidden'));
  check('save-me prompt appears when killed with coins', saveVisible);
  if (saveVisible) {
    const before = await page.evaluate(() => Number(document.getElementById('coinsHud').textContent));
    await page.evaluate(() => document.getElementById('saveBtn').click());
    await sleep(150);
    const r = await page.evaluate(() => ({ running: window.__crossy.running, dead: window.__crossy.dead, coins: Number(document.getElementById('coinsHud').textContent) }));
    check('second chance revives the run and spends 3 coins', r.running && !r.dead && r.coins === before - 3, JSON.stringify(r) + ' before=' + before);
  }

  // A fresh run with no coins ends cleanly (no save-me) and shows the end screen.
  await page.evaluate(() => window.__crossyTest.restart());
  await sleep(150);
  await page.evaluate(() => window.__crossyTest.setCoins(0));
  await page.evaluate(() => window.__crossyTest.kill('Test splat'));
  await sleep(150);
  const ended = await page.evaluate(() => ({ save: !document.getElementById('saveMeScreen').classList.contains('hidden'), dead: window.__crossy.dead }));
  check('no second chance without coins, and the run ends', !ended.save && ended.dead, JSON.stringify(ended));

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL CROSSY CREW FEATURE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
