#!/usr/bin/env node
/* Pip's Cozy Cove: arcade canvas build.

   Static contract + a real browser run at 390px and 1440px: modal, level map,
   injected daily/bestiary/bait panels, flick cast, restart and no runtime errors.

   Run: node tests/pips-cozy-cove-http.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.COZY_COVE_PORT || 19319);
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.avif': 'image/avif', '.jpg': 'image/jpeg'
};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

const pagePath = path.join(ROOT, 'games', 'pips-cozy-cove.html');
const html = fs.readFileSync(pagePath, 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', 'games-pips-cozy-cove.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style-game-pips-cozy-cove.css'), 'utf8');
const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

check('page exists with a title', /<title>[^<]+<\/title>/i.test(html));
check('page has a viewport that allows zoom', /<meta[^>]+name=["']viewport["']/i.test(html) && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html));
check('page has a live status region', /id="statusMsg"[^>]*role="status"|role="status"[^>]*id="statusMsg"|aria-live/i.test(html));
check('page labels the play field', /<canvas[^>]*aria-label="[^"]*fishing game/i.test(html));
check('page has the game canvas', /<canvas[^>]*id="game"[^>]*width="900"[^>]*height="1100"/i.test(html));
check('page has the level map', /id="levelMap"/.test(html));
check('page has the HUD', /id="scoreVal"/.test(html) && /id="catchVal"/.test(html) && /id="comboVal"/.test(html) && /id="bestVal"/.test(html));
check('page has a restart control', /id="restartBtn"/.test(html) && /startLevel/.test(script));
check('page has a help control', /id="helpBtn"/.test(html) && /How to Fish/.test(script));
check('page has a start modal', /id="modal"/.test(html) && /id="modalPrimary"/.test(html) && /showModal/.test(script));
check('page has a reel bar', /id="reelWrap"/.test(html) && /id="reelBar"/.test(html) && /handleReel/.test(script));
check('page has the flick cast', /pointerdown/.test(script) && /function doCast/.test(script) && /flick/i.test(script) && /Hold for power/i.test(script));
check('page has cast hot spots', /hotspots:/.test(script) && /drawHotspots/.test(script));
check('page has the fish catalogue', /const FISH=\[/.test(script) && /Golden Carp/.test(script) && /const LEGENDARY/.test(script) && /Dragon Koi/.test(script));
check('page has four fishing spots', /const LEVELS=\[/.test(script) && ["Morning Cove", "Lily Pad Bay", "Rocky Channel", "Golden Pool"].every((n) => script.includes(n)));
check('page has the bait system', /const BAITS=\[/.test(script) && /Worm/.test(script) && /Lure/.test(script) && /Bread/.test(script) && /buildBaitUI/.test(script));
check('page has a daily challenge', /buildDailyUI/.test(script) && /Daily Challenge/.test(script));
check('page has a bestiary', /buildLogUI/.test(script) && /Bestiary/.test(script));
check('page has the chain bonus', /chainTimer/.test(script) && /chain/i.test(script));
check('page has water life and effects', /drawBubbles/.test(script) && /drawFloatTexts/.test(script) && /screenFlash/.test(script));
check('page saves progress', /GameSystem/.test(script) && /loadSv/.test(script) && /(saveState|storeSv)/.test(script));
check('page has responsive game-shell styles', /\.game-shell/.test(css) && /@media\(max-width:560px\)/.test(css) && /@media\(max-width:1040px\)/.test(css));
check('page loads the game stylesheet', /style-game-pips-cozy-cove\.css/.test(html) && /game-system\.css/.test(html));
check('page loads the shared game system', /game-system\.js/.test(html) && /audio-effects\.js/.test(html));
check('page registers the service worker', /sw-register\.js/.test(html));
check('service worker precaches the game', /\/games\/pips-cozy-cove\.html/.test(sw) && /games-pips-cozy-cove\.js/.test(sw) && /style-game-pips-cozy-cove\.css/.test(sw));
check('registry lists the game', /"id":\s*"pips-cozy-cove"/.test(registry) && /"file":\s*"pips-cozy-cove\.html"/.test(registry));
check('registry gives it a thumbnail', /"thumb":\s*"assets\/game-thumbs\/pips-cozy-cove\.webp"/.test(registry));
check('thumbnail exists', fs.existsSync(path.join(ROOT, 'assets', 'game-thumbs', 'pips-cozy-cove.webp')));

const IGNORE_CONSOLE = /ERR_|Failed to load resource|favicon|googletagmanager|google-analytics|AudioContext|autoplay|navigator\.vibrate|fullscreen/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function canvasBox(page) {
  return page.$eval('#game', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

async function runAt(browser, width, height, isMobile) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORE_CONSOLE.test(text)) return;
    errors.push('console: ' + text);
  });

  await page.setViewport({ width, height, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
  await page.goto(`http://127.0.0.1:${PORT}/games/pips-cozy-cove.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => { try { Object.keys(localStorage).forEach((k) => { if (/pips|jvds_game_pips/i.test(k)) localStorage.removeItem(k); }); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#game', { timeout: 15000 });
  await sleep(400);

  const tag = width + 'px';

  const boot = await page.evaluate(() => ({
    modal: document.getElementById('modal').classList.contains('show'),
    canvasW: document.getElementById('game').width,
    canvasH: document.getElementById('game').height,
    status: (document.getElementById('statusMsg') || {}).textContent || ''
  }));
  check(tag + ': the start modal is shown', boot.modal);
  check(tag + ': the canvas is live', boot.canvasW > 0 && boot.canvasH > 0, boot.canvasW + 'x' + boot.canvasH);

  const box = await canvasBox(page);
  check(tag + ': the canvas is visible', box.width > 100 && box.height > 100, Math.round(box.width) + 'x' + Math.round(box.height));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(tag + ': no horizontal scroll', overflow <= 2, String(overflow));

  await page.click('#modalPrimary');
  await sleep(400);

  const afterStart = await page.evaluate(() => ({
    modal: document.getElementById('modal').classList.contains('show'),
    spots: document.querySelectorAll('#levelMap .planet').length,
    bait: !!document.getElementById('baitBar') && document.querySelectorAll('#baitBar button').length,
    daily: !!document.getElementById('dailyCard'),
    log: !!document.getElementById('catchLogCard'),
    status: (document.getElementById('statusMsg') || {}).textContent || ''
  }));
  check(tag + ': Start closes the modal', !afterStart.modal);
  check(tag + ': four fishing spots are listed', afterStart.spots === 4, String(afterStart.spots));
  check(tag + ': the bait bar is built', afterStart.bait === 3, String(afterStart.bait));
  check(tag + ': the daily challenge is built', afterStart.daily);
  check(tag + ': the bestiary is built', afterStart.log);
  check(tag + ': the game invites a cast', /flick|cast/i.test(afterStart.status), afterStart.status);

  const beforeCast = afterStart.status;
  await page.evaluate(() => document.getElementById('game').scrollIntoView({ block: 'center' }));
  await sleep(300);
  const box2 = await canvasBox(page);
  const cx = box2.x + box2.width / 2;
  const yBot = box2.y + box2.height * 0.92;
  const yTop = box2.y + box2.height * 0.55;
  await page.mouse.move(cx, yBot);
  await page.mouse.down();
  await page.mouse.move(cx, yTop, { steps: 12 });
  await page.mouse.up();
  await sleep(1200);
  const castStatus = await page.evaluate(() => (document.getElementById('statusMsg') || {}).textContent || '');
  check(tag + ': a flick starts a cast', castStatus !== beforeCast, castStatus);

  await page.click('#restartBtn');
  await sleep(400);
  const restarted = await page.evaluate(() => ({
    score: (document.getElementById('scoreVal') || {}).textContent,
    spots: document.querySelectorAll('#levelMap .planet').length,
    status: (document.getElementById('statusMsg') || {}).textContent || ''
  }));
  check(tag + ': restart resets the run', restarted.score === '0' && restarted.spots === 4 && /flick|cast/i.test(restarted.status), restarted.status);

  check(tag + ': no runtime errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await new Promise((resolve) => server.listen(PORT, resolve));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    await runAt(browser, 390, 844, true);
    await runAt(browser, 1440, 900, false);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL PIPS COZY COVE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
