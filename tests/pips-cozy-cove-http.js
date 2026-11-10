#!/usr/bin/env node
/* Pip's Cozy Cove: the fishing loop, the saved bucket and the phone layout.

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
const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');

check('page exists with a title', /<title>[^<]+<\/title>/i.test(html));
check('page has a viewport that allows zoom', /<meta[^>]+name=["']viewport["']/i.test(html) && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html));
check('page has a live status region', /aria-live|role=["']status["']/i.test(html));
check('page labels the play field', /aria-label=["'][^"']*play field/i.test(html));
check('page has a pause control', /id="pauseBtn"/.test(html) && /pause/i.test(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', 'games-pips-cozy-cove.js'), 'utf8')));
check('page loads the game stylesheet', /style-game-pips-cozy-cove\.css/.test(html));
check('page uses the local Pip art', /assets\/mascots\/pip-hero\.webp/.test(html));
check('registry lists the game', /"id":\s*"pips-cozy-cove"/.test(registry) && /"file":\s*"pips-cozy-cove\.html"/.test(registry));
check('registry gives it a thumbnail', /"thumb":\s*"assets\/game-thumbs\/pips-cozy-cove\.webp"/.test(registry));
check('registry labels it BETA', /"pips-cozy-cove":\s*"BETA"/.test(registry));
check('thumbnail exists', fs.existsSync(path.join(ROOT, 'assets', 'game-thumbs', 'pips-cozy-cove.webp')));

const IGNORE_CONSOLE = /ERR_|Failed to load resource|favicon|googletagmanager|google-analytics|AudioContext|autoplay|navigator\.vibrate|fullscreen/i;

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
  await page.waitForSelector('#actionBtn', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 250));

  const tag = width + 'px';
  const hook = await page.evaluate(() => !!window.__cozyCove);
  check(tag + ': debug hook is present', hook);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(tag + ': no horizontal scroll', overflow <= 2, String(overflow));

  await page.click('#actionBtn');
  const waiting = await page.evaluate(() => window.__cozyCove.state().phase);
  check(tag + ': cast starts the wait', waiting === 'waiting', waiting);

  await page.evaluate(() => window.__cozyCove.forceBite());
  const biting = await page.evaluate(() => ({
    phase: window.__cozyCove.state().phase,
    label: document.getElementById('actionBtn').textContent
  }));
  check(tag + ': a bite opens the pull window', biting.phase === 'biting', biting.phase);
  check(tag + ': the button says Pull', /pull/i.test(biting.label), biting.label);

  await page.click('#actionBtn');
  const afterCatch = await page.evaluate(() => ({
    state: window.__cozyCove.state(),
    bucketItems: document.querySelectorAll('#bucketList .bucket-item').length
  }));
  check(tag + ': catching a fish scores points', afterCatch.state.score > 0, String(afterCatch.state.score));
  check(tag + ': the bucket shows the catch', afterCatch.bucketItems > 0, String(afterCatch.bucketItems));
  check(tag + ': the phase returns to idle', afterCatch.state.phase === 'idle', afterCatch.state.phase);

  await page.click('#pauseBtn');
  const paused = await page.evaluate(() => ({
    paused: window.__cozyCove.state().paused,
    status: document.getElementById('statusText').textContent
  }));
  check(tag + ': pause stops the game', paused.paused === true, String(paused.paused));
  check(tag + ': pause tells the player', /paused/i.test(paused.status), paused.status);
  await page.click('#pauseBtn');

  const saved = await page.evaluate(() => window.__cozyCove.state());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#actionBtn', { timeout: 15000 });
  const restored = await page.evaluate(() => window.__cozyCove.state());
  check(tag + ': the bucket survives a reload', restored.totalCaught >= saved.totalCaught && restored.totalCaught > 0, String(restored.totalCaught));
  check(tag + ': the best score survives a reload', restored.highScore >= saved.score && restored.highScore > 0, String(restored.highScore));

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
