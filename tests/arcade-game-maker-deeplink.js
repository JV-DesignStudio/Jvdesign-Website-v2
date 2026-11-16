#!/usr/bin/env node
/*
 * tests/arcade-game-maker-deeplink.js , A3065
 *
 * The public gallery has "Play now" and "Remix". Play must actually boot the
 * starter, and Remix must land in the editor with the starter loaded.
 *
 * Run: node tests/arcade-game-maker-deeplink.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_DEEPLINK_PORT || 9001);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  function newPage() {
    return browser.newPage().then(async page => {
      await page.setViewport({ width: 1280, height: 900 });
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
      return page;
    });
  }

  // Play now: boot the starter without a manual Run.
  {
    const page = await newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html?template=dino_runner&play=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 20000 });
    const booted = await page.waitForFunction(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 25000 }).then(() => true).catch(() => false);
    const state = await page.evaluate(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return {
        scene: sc ? sc.sys.settings.key : '',
        genre: (document.getElementById('genreMode') || {}).value || '',
        engineGenre: typeof _engineData !== 'undefined' && _engineData ? _engineData.genre : '',
        welcome: !!document.getElementById('welcome-overlay') && document.getElementById('welcome-overlay').classList.contains('show'),
        intro: !!document.getElementById('introOverlay') && document.getElementById('introOverlay').classList.contains('show')
      };
    });
    check('Play now boots the requested starter', booted && state.scene === 'RunnerScene' && state.engineGenre === 'RUNNER', JSON.stringify(state));
    check('Play now clears the welcome and title card', state.welcome === false && state.intro === false, JSON.stringify(state));
    check('Play now has no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // Remix: land in the editor with the starter loaded and a remix note.
  {
    const page = await newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html?template=ocean_shooter&remix=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 20000 });
    await page.waitForFunction(() => {
      const t = document.getElementById('gameTitle');
      return !!(t && /Ocean Defender/.test(t.value));
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => /Remix:/.test(document.body.innerText || ''), { timeout: 8000 }).catch(() => {});
    await sleep(300);
    const state = await page.evaluate(() => ({
      genre: (document.getElementById('genreMode') || {}).value || '',
      title: (document.getElementById('gameTitle') || {}).value || '',
      welcome: !!document.getElementById('welcome-overlay') && document.getElementById('welcome-overlay').classList.contains('show'),
      body: document.body.innerText || ''
    }));
    check('Remix loads the starter in the editor', state.genre === 'SHOOTER' && /Ocean Defender/.test(state.title), JSON.stringify({ genre: state.genre, title: state.title }));
    check('Remix tells the learner it is a remix', /Remix:/.test(state.body), state.body.slice(0, 120));
    check('Remix clears the welcome overlay', state.welcome === false);
    check('Remix has no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER DEEPLINK CHECKS PASSED');
})().catch(e => { console.error('deeplink test crashed:', e); process.exit(1); });
