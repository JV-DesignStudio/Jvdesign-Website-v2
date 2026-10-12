#!/usr/bin/env node
/*
 * tests/game-thumbs.js
 *
 * The arcade cabinet cards show a real gameplay thumbnail for the games that
 * have one (highway-dodge, nova-siege), so a player sees real gameplay before
 * tapping. Proves:
 *   - each thumbnail file exists and is a valid image
 *   - the registry carries thumb + controlType for those games
 *   - arcade.html prefers g.thumb in its card art and renders the cabinet cards
 *     at 390 and 1440 with no errors or overflow
 *
 * Run: node tests/game-thumbs.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const FLAGSHIPS = [
  { id: 'highway-dodge', file: 'highway-dodge.html', controls: 'Swipe / keys' },
  { id: 'nova-siege', file: 'nova-siege.html', controls: 'Drag to fly' }
];

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticChecks() {
  const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
  const arcade = fs.readFileSync(path.join(ROOT, 'arcade.html'), 'utf8');
  check('arcade card art prefers the gameplay thumb', /g\.thumb/.test(arcade));
  check('arcade renders cabinet cards', /class="cab"/.test(arcade) && /arc-grid/.test(arcade));
  for (const g of FLAGSHIPS) {
    const thumb = 'assets/game-thumbs/' + g.id + '.webp';
    const file = path.join(ROOT, thumb);
    check(g.id + ': thumbnail file exists', fs.existsSync(file), thumb);
    check(g.id + ': registry has thumb + controlType',
      registry.includes('"' + thumb + '"') && registry.includes('"controlType": "' + g.controls + '"'));
  }
}

async function imageChecks() {
  const sharp = require('sharp');
  for (const g of FLAGSHIPS) {
    try {
      const m = await sharp(path.join(ROOT, 'assets/game-thumbs/' + g.id + '.webp')).metadata();
      check(g.id + ': thumbnail is a valid image', m.format === 'webp' && m.width > 100 && m.height > 100, m.width + 'x' + m.height);
    } catch (e) {
      check(g.id + ': thumbnail is a valid image', false, e.message);
    }
  }
}

async function browserChecks(browser, base, width) {
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
  for (const g of FLAGSHIPS) {
    const info = await page.evaluate(file => {
      const card = document.querySelector('.cab[href="games/' + file + '"]');
      if (!card) return { card: false };
      const img = card.querySelector('.cab-art img');
      const pills = [...card.querySelectorAll('.cab-pill')].map(p => p.textContent);
      return { card: true, src: img ? img.getAttribute('src') : null, pills };
    }, g.file);
    check(width + ' ' + g.id + ': card renders', info.card);
    check(width + ' ' + g.id + ': card art uses the gameplay thumbnail',
      !!info.src && info.src.indexOf('game-thumbs/' + g.id + '.webp') >= 0, String(info.src));
    check(width + ' ' + g.id + ': card shows a meta pill', info.card && info.pills.length > 0, (info.pills || []).join('|'));
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(width + ' arcade: no horizontal overflow', overflow <= 2, String(overflow));
  check(width + ' arcade: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  staticChecks();
  await imageChecks();
  await withServer(async ({ base, browser }) => {
    await browserChecks(browser, base, 390);
    await browserChecks(browser, base, 1440);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL GAME THUMB CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
