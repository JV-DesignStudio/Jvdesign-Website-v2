#!/usr/bin/env node
/*
 * tests/game-thumbs.js
 *
 * The arcade cabinet cards show a real thumbnail for every game, so a player
 * sees the game before tapping. This checks the WHOLE catalogue, not a sample:
 *   - every registry game has a thumbnail file that exists and is a valid image
 *   - it is large enough to be a real picture, never a flat placeholder
 *   - no two games share the same image file (no lazy reuse)
 *   - arcade.html prefers g.thumb in its card art and renders every card at
 *     390 and 1440 with no errors or overflow
 *
 * Run: node tests/game-thumbs.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withServer } = require('./story-run-harness.cjs');

const ROOT = path.resolve(__dirname, '..');

// A real thumbnail is at least this big on disk. A flat or near-solid image
// (a placeholder) compresses far below this, which is how the empty
// arcane-citadel.webp slipped through before.
const MIN_BYTES = 4000;
const MIN_WIDTH = 600;

function registry() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8'))(w);
  return w.JVDS_GAMES || [];
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticChecks(games) {
  const registrySrc = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
  const arcade = fs.readFileSync(path.join(ROOT, 'arcade.html'), 'utf8');
  check('catalogue is not empty', games.length > 0, games.length + ' games');
  check('arcade card art prefers the gameplay thumb', /g\.thumb/.test(arcade));
  check('arcade renders cabinet cards', /class="cab"/.test(arcade) && /arc-grid/.test(arcade));
  for (const g of games) {
    const file = path.join(ROOT, g.thumb);
    check(g.id + ': thumbnail file exists', !!g.thumb && fs.existsSync(file), g.thumb || 'no thumb');
    check(g.id + ': registry lists the thumbnail', registrySrc.includes('"' + g.thumb + '"'));
  }
}

async function imageChecks(games) {
  const sharp = require('sharp');
  const seen = new Map();
  for (const g of games) {
    const file = path.join(ROOT, g.thumb);
    try {
      const size = fs.statSync(file).size;
      const m = await sharp(file).metadata();
      check(g.id + ': thumbnail is a valid webp', m.format === 'webp', m.format);
      check(g.id + ': thumbnail has a card-sized width', m.width >= MIN_WIDTH, m.width + 'x' + m.height);
      check(g.id + ': thumbnail is not a flat placeholder', size >= MIN_BYTES, size + ' bytes');
      const hash = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
      const other = seen.get(hash);
      check(g.id + ': thumbnail image is unique', !other, other ? 'same file as ' + other : '');
      if (!other) seen.set(hash, g.id);
    } catch (e) {
      check(g.id + ': thumbnail is a valid webp', false, e.message);
    }
  }
}

async function galleryChecks() {
  const sharp = require('sharp');
  let entries = [];
  try { entries = require(path.join(ROOT, 'gallery-games.json')); } catch (e) { entries = []; }
  entries = Array.isArray(entries) ? entries : (entries.games || []);
  check('gallery list loads', entries.length > 0, entries.length + ' entries');
  for (const g of entries) {
    if (!g.thumb) { check(g.id + ': gallery entry has a thumbnail', false, 'no thumb'); continue; }
    const file = path.join(ROOT, g.thumb);
    try {
      const size = fs.statSync(file).size;
      const m = await sharp(file).metadata();
      check(g.id + ': gallery thumbnail is valid', m.format === 'webp' && m.width >= MIN_WIDTH, m.width + 'x' + m.height);
      check(g.id + ': gallery thumbnail is not a placeholder', size >= MIN_BYTES, size + ' bytes');
    } catch (e) {
      check(g.id + ': gallery thumbnail is valid', false, e.message);
    }
  }
}

async function browserChecks(browser, base, width, games) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(t)) return;
    errors.push('console: ' + t);
  });
  await page.setViewport({ width, height: 900 });
  await page.goto(base + '/arcade.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('.cab', { timeout: 15000 });
  await sleep(400);
  const wanted = games.map(g => ({ id: g.id, file: g.file, thumb: g.thumb }));
  for (const g of wanted) {
    const info = await page.evaluate(file => {
      const card = document.querySelector('.cab[href="games/' + file + '"]');
      if (!card) return { card: false };
      const img = card.querySelector('.cab-art img');
      const pills = [...card.querySelectorAll('.cab-pill')].map(p => p.textContent);
      return { card: true, src: img ? img.getAttribute('src') : null, pills };
    }, g.file);
    check(width + ' ' + g.id + ': card renders', info.card);
    check(width + ' ' + g.id + ': card art uses its thumbnail',
      !!info.src && info.src.indexOf(g.thumb) >= 0, String(info.src));
    check(width + ' ' + g.id + ': card shows a meta pill', info.card && info.pills.length > 0, (info.pills || []).join('|'));
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(width + ' arcade: no horizontal overflow', overflow <= 2, String(overflow));
  check(width + ' arcade: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  const games = registry();
  staticChecks(games);
  await imageChecks(games);
  await galleryChecks();
  await withServer(async ({ base, browser }) => {
    await browserChecks(browser, base, 390, games);
    await browserChecks(browser, base, 1440, games);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL GAME THUMB CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
