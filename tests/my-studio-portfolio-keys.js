#!/usr/bin/env node
/*
 * tests/my-studio-portfolio-keys.js
 * A2804: the portfolio names the saves the tools really write.
 *   - Sound Studio uses jvds_sound_auto (not the old jvds_sound_library)
 *   - Game Logo Maker uses jvds_gamelogo_saved (not the old jvds_game_logo)
 *   - Particle Designer and Game Idea Generator appear
 * Run: node tests/my-studio-portfolio-keys.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.MEK_PORT || 8150;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/me.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('jvds_profile', JSON.stringify({ globalXP: 40, xpSchema: 2, completedWorkshops: [], dailyStreak: 0 }));
      localStorage.setItem('jvds_sound_auto', JSON.stringify({ bpm: 120, steps: 16 }));
      localStorage.setItem('jvds_gamelogo_saved', JSON.stringify({ title: 'Star Run' }));
      localStorage.setItem('jvds_pd_saves_v1', JSON.stringify([{ name: 'Spark' }, { name: 'Smoke' }]));
      localStorage.setItem('jvds_gameidea_history', JSON.stringify([{ idea: 'A tower of biscuits' }]));
    });
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-pf="creations"]'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 400));

    const view = await page.evaluate(() => {
      const el = document.querySelector('[data-pf="creations"]');
      return {
        text: el ? el.textContent : '',
        count: el ? (el.querySelector('.count') || {}).textContent : '',
        cards: el ? el.querySelectorAll('a.pf-card').length : 0,
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    check('Sound Studio now appears', /Sound Studio/.test(view.text), view.text.slice(0, 160));
    check('Game Logo Maker now appears', /Game Logo Maker/.test(view.text));
    check('Particle Designer now appears', /Particle Designer/.test(view.text));
    check('Game Idea Generator now appears', /Game Idea Generator/.test(view.text));
    check('counts the four fixed saves', /4|5|6/.test(String(view.count)) && view.cards >= 4, 'count ' + view.count + ', cards ' + view.cards);
    check('no horizontal scroll at 390', !view.overflow, '');
    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? 'FAILURES PRESENT (' + failures + ')' : 'ALL PORTFOLIO KEY CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
