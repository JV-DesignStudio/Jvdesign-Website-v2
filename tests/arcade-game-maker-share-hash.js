#!/usr/bin/env node
/*
 * tests/arcade-game-maker-share-hash.js , A2578
 * Proves the Arcade Game Maker's compressed share payload round-trips the
 * creator's game state and that a malformed share link fails safely.
 *
 * Checks:
 *   - encode -> decode returns the same sprite/physics/level state
 *   - a packed share link (?game=) reloads the title, genre, speed, gravity,
 *     jump and level grid in a fresh browser profile
 *   - malformed payloads do not throw and the studio still boots
 *   - packing makes no backend/upload request
 * Run: node tests/arcade-game-maker-share-hash.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const MAKER = 'tools/arcade-game-maker.html';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon'
};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
function isIgnorable(text) {
  return /ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR_|ERR_ABORTED|ERR_FAILED/i.test(text)
    || /googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic|gstatic\.com/i.test(text);
}

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const file = path.join(ROOT, clean);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const GRID = [[0, 1, 0], [1, 0, 1], [0, 1, 0]];
const EXPECTED = { title: 'Share Round Trip', genre: 'SHOOTER', speed: 260, gravity: 700, jump: 500 };

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let posts = 0;
    page.on('request', (req) => { if (req.method() === 'POST') posts++; });
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + '/' + MAKER, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#runGameBtn', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));

    const packed = await page.evaluate(async (expected, grid) => {
      document.getElementById('gameTitle').value = expected.title;
      document.getElementById('genreMode').value = expected.genre;
      document.getElementById('playerSpeed').value = String(expected.speed);
      document.getElementById('gravityY').value = String(expected.gravity);
      document.getElementById('jumpForce').value = String(expected.jump);
      document.getElementById('levelDesignerGrid').value = JSON.stringify(grid);
      const d = getPayload();
      const payload = _buildSharePayload(d);
      const enc = await _compressPayload(JSON.stringify(payload));
      const rt = JSON.parse(await _decompressPayload(enc));
      const link = await _packShareGame(d, 'game');
      return { rt, longUrl: link.longUrl };
    }, EXPECTED, GRID);

    const rt = packed.rt || {};
    check('encode/decode keeps the title', rt.title === EXPECTED.title, String(rt.title));
    check('encode/decode keeps the genre', rt.genre === EXPECTED.genre, String(rt.genre));
    check('encode/decode keeps speed', rt.speed === EXPECTED.speed, String(rt.speed));
    check('encode/decode keeps gravity', rt.gravity === EXPECTED.gravity, String(rt.gravity));
    check('encode/decode keeps jump', rt.jump === EXPECTED.jump, String(rt.jump));
    check('encode/decode keeps the level grid', JSON.stringify(rt.map) === JSON.stringify(GRID), JSON.stringify(rt.map));
    check('packed share link carries a ?game= payload', /\?game=/.test(packed.longUrl), packed.longUrl.slice(0, 60) + '...');
    check('packing makes no backend/upload request', posts === 0, 'POSTs=' + posts);
    check('studio had no uncaught JS errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // Fresh profile opens the real share link and restores the state.
    const search = new URL(packed.longUrl).search;
    const fresh = await browser.newPage();
    const freshErrors = [];
    fresh.on('pageerror', (e) => { if (!isIgnorable(e.message)) freshErrors.push(e.message); });
    await fresh.setViewport({ width: 1280, height: 900 });
    await fresh.goto(BASE + '/' + MAKER + search, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await fresh.waitForSelector('#runGameBtn', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    const loaded = await fresh.evaluate(() => {
      const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
      let map = null;
      try { map = JSON.parse(document.getElementById('levelDesignerGrid').value); } catch (e) {}
      return { title: v('gameTitle'), genre: v('genreMode'), speed: +v('playerSpeed'), gravity: +v('gravityY'), jump: +v('jumpForce'), map };
    });
    check('shared link restores the title', loaded.title === EXPECTED.title, String(loaded.title));
    check('shared link restores the genre', loaded.genre === EXPECTED.genre, String(loaded.genre));
    check('shared link restores speed', loaded.speed === EXPECTED.speed, String(loaded.speed));
    check('shared link restores gravity', loaded.gravity === EXPECTED.gravity, String(loaded.gravity));
    check('shared link restores jump', loaded.jump === EXPECTED.jump, String(loaded.jump));
    check('shared link restores the level grid', JSON.stringify(loaded.map) === JSON.stringify(GRID), JSON.stringify(loaded.map));
    check('shared link loads with no uncaught JS errors', freshErrors.length === 0, freshErrors.join(' | '));
    await fresh.close();

    // Malformed payloads must not throw, and the studio must still be usable.
    for (const bad of ['%%%%not-valid%%%%', 'abc', 'eJyrVkrLz1eyUqJJTk8tKk4tKk7MBwA', 'null', 'v1.!!!']) {
      const broken = await browser.newPage();
      const brokenErrors = [];
      broken.on('pageerror', (e) => { if (!isIgnorable(e.message)) brokenErrors.push(e.message); });
      await broken.goto(BASE + '/' + MAKER + '?game=' + encodeURIComponent(bad), { waitUntil: 'domcontentloaded', timeout: 30000 });
      const usable = await broken.waitForSelector('#runGameBtn', { timeout: 15000 }).then(() => true).catch(() => false);
      await new Promise((r) => setTimeout(r, 500));
      check('malformed payload "' + bad.slice(0, 12) + '" still boots the studio', usable && brokenErrors.length === 0, brokenErrors.join(' | '));
      await broken.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL ARCADE SHARE-HASH CHECKS PASSED');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
