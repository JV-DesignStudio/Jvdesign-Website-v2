#!/usr/bin/env node
/* A2595: every Create path offers one template, one remix and one random
 * entry that opens the linked tool with a working starter, with no download. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webmanifest': 'application/manifest+json' };
const WIDTHS = [390, 1440];
const KINDS = 'random,remix,template';

const failures = [];
function pass(msg) { console.log('PASS ' + msg); }
function fail(msg) { failures.push(msg); console.log('FAIL ' + msg); }
function check(ok, msg, detail) { ok ? pass(msg + (detail ? ' - ' + detail : '')) : fail(msg + (detail ? ' - ' + detail : '')); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

const cfg = JSON.parse(read('content/tools-hub.json'));
const page = read('pages/dev-tools.html');
const catalog = JSON.parse(read('content/tools.json'));
const tools = new Set(catalog.map(t => t.id));
const paths = cfg.intentPaths || [];

check(paths.length === 4, 'four Create paths are defined', 'found ' + paths.length);

let quickCount = 0;
for (const p of paths) {
  const quick = Array.isArray(p.quickStart) ? p.quickStart : [];
  check(quick.length === 3, p.id + ' offers three quick starts', 'found ' + quick.length);
  check(quick.map(o => o.kind).sort().join(',') === KINDS, p.id + ' offers template, remix and random');
  for (const o of quick) {
    quickCount++;
    check(tools.has(o.tool), p.id + ' ' + o.kind + ' points at a real tool', o.tool);
    check(!!(o.query || o.hash), p.id + ' ' + o.kind + ' opens the tool with a starter');
    const href = (catalog.find(t => t.id === o.tool) || {}).url || '';
    const file = href.replace(/^\//, '').replace(/[?#].*$/, '');
    check(file && fs.existsSync(path.join(ROOT, file)), p.id + ' ' + o.kind + ' file exists', file);
  }
}
check(quickCount === 12, 'twelve quick-start entries in the source config', 'found ' + quickCount);
check((page.match(/class="intent-quick /g) || []).length === 12, 'twelve quick-start links rendered on the hub');
check((page.match(/class="intent-quickstart"/g) || []).length === 4, 'one quick-start block per path');

// The remix sprite decodes to the format Pixel Studio already imports.
const character = paths.find(p => p.id === 'character');
const remix = (character.quickStart || []).find(o => o.kind === 'remix') || {};
const art = (remix.hash || '').match(/art=([^&]+)/);
check(!!art, 'character remix carries a pixel-art payload');
if (art) {
  try {
    const data = JSON.parse(decodeURIComponent(Buffer.from(art[1], 'base64').toString('utf8')));
    check(data.N === 8 && Array.isArray(data.grid) && data.grid.length === 64, 'remix payload is a complete 8x8 sprite');
    check(data.grid.some(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)), 'remix payload contains real colours');
  } catch (e) {
    fail('remix payload decodes: ' + e.message);
  }
}

// Each destination accepts the starter parameter the hub sends.
const pixel = read('tools/pixel-studio.html');
check(/params\.get\('starter'\)/.test(pixel) && /_starterTemplate/.test(pixel), 'Pixel Studio reads ?starter=');
check(/starter==='random'/.test(pixel), 'Pixel Studio randomises its template');
const level = read('tools/level-designer.html');
check(/URLSearchParams\(location\.search\)\.get\('starter'\)/.test(level), 'World Builder reads ?starter=');
check(/LD_TEMPLATES\[pick\]/.test(level), 'World Builder applies the named template');
const sound = read('tools/sound-studio.html');
check(/get\('starter'\)/.test(sound) && /_loadSoundTemplate\(pick\)/.test(sound), 'Audio Studio reads ?starter=');
const arcade = read('tools/arcade-game-maker.html');
check(/key === 'random'/.test(arcade), 'Arcade Game Maker randomises ?template=');
const snippet = read('tools/code-snippet-generator.html');
check(/get\('starter'\)==='random'/.test(snippet) && /surpriseMe/.test(snippet), 'Code snippets randomise ?starter=random');

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const PORT = server.address().port;
  const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync(systemChrome) ? systemChrome : undefined);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const t = req.resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return req.abort();
    req.continue();
  });
  async function open(url) {
    for (let i = 0; i < 3; i++) {
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); break; }
      catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 150)); }
    }
    await new Promise(r => setTimeout(r, 150));
  }
  async function waitFor(fn, timeout) {
    try { await page.waitForFunction(fn, { timeout: timeout || 15000 }); return true; } catch (e) { return false; }
  }

  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: true });
      await open(`http://127.0.0.1:${PORT}/pages/dev-tools.html`);
      await waitFor(() => document.querySelectorAll('.intent-quick').length === 12, 10000);
      const hub = await page.evaluate(() => ({
        paths: document.querySelectorAll('.intent-path').length,
        links: document.querySelectorAll('.intent-quick').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        heights: [...document.querySelectorAll('.intent-quick')].map(el => el.getBoundingClientRect().height)
      }));
      check(hub.paths === 4 && hub.links === 12, 'hub renders 4 paths and 12 quick links at ' + width + 'px', JSON.stringify({ paths: hub.paths, links: hub.links }));
      check(hub.overflow <= 1, 'hub has no horizontal scroll at ' + width + 'px', 'overflow ' + hub.overflow);
      check(hub.heights.every(h => h >= 34), 'every quick link is a usable target at ' + width + 'px', 'min ' + Math.min(...hub.heights));
    }

    await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
    await open(`http://127.0.0.1:${PORT}/tools/level-designer.html?starter=starter`);
    const levelLoaded = await waitFor(() => {
      const n = document.getElementById('levelName');
      return n && n.value === 'First Platformer';
    });
    const levelState = await page.evaluate(() => ({
      name: (document.getElementById('levelName') || {}).value,
      modal: (document.getElementById('start-overlay') || {}).className || ''
    }));
    check(levelLoaded, 'World Builder opens with the First Platformer starter', levelState.name);
    check(!/show/.test(levelState.modal), 'World Builder starter dismisses the start overlay');

    await open(`http://127.0.0.1:${PORT}/tools/sound-studio.html?starter=groove`);
    const soundLoaded = await waitFor(() => {
      const t = document.getElementById('toast');
      return t && /Template loaded/.test(t.textContent);
    });
    const soundModal = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return m ? getComputedStyle(m).display : '';
    });
    check(soundLoaded, 'Audio Studio opens with a working loop');
    check(soundModal !== 'flex', 'Audio Studio starter dismisses the start modal');

    await open(`http://127.0.0.1:${PORT}/tools/pixel-studio.html?starter=character`);
    const pixelLoaded = await waitFor(() => window._starterTemplate === 'character' && !document.getElementById('startModal').classList.contains('open'), 15000);
    const pixelState = await page.evaluate(() => ({
      starter: window._starterTemplate,
      modalOpen: document.getElementById('startModal').classList.contains('open'),
      focus: document.body.classList.contains('ps-focus')
    }));
    check(pixelLoaded && pixelState.starter === 'character', 'Pixel Studio opens with the character template');
    check(!pixelState.modalOpen, 'Pixel Studio starter dismisses the start modal');
    check(pixelState.focus, 'Pixel Studio starter lands in the drawing flow');

    if (art) {
      await open(`http://127.0.0.1:${PORT}/tools/pixel-studio.html#first-mission&art=${art[1]}`);
      const remixLoaded = await waitFor(() => {
        const t = document.getElementById('toast');
        return t && /drawing is here/i.test(t.textContent);
      });
      check(remixLoaded, 'Pixel Studio remix loads the finished example sprite');
    }

    await open(`http://127.0.0.1:${PORT}/tools/arcade-game-maker.html?template=forest_platform`);
    const arcadeLoaded = await waitFor(() => {
      const t = document.getElementById('gameTitle');
      const g = document.getElementById('genreMode');
      return t && g && t.value === 'Forest Jump' && g.value === 'PLATFORMER';
    }, 30000);
    check(arcadeLoaded, 'Arcade Game Maker opens with the Forest Jump starter');

    await open(`http://127.0.0.1:${PORT}/tools/code-snippet-generator.html?starter=random`);
    const snippetLoaded = await waitFor(() => !!document.querySelector('.snippet-card.flash'), 12000);
    check(snippetLoaded, 'Code snippets randomise to a working snippet');
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.log('\n' + failures.length + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nPASS create-hub-quickstart: templates, remix and random work on all four paths');
})().catch(err => {
  console.error('FAIL create-hub-quickstart: ' + (err && err.stack || err));
  try { server.close(); } catch (e) {}
  process.exit(1);
});
