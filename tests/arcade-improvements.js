#!/usr/bin/env node
/*
 * tests/arcade-improvements.js , A2802
 *
 * Covers the five Play hub follow-ups:
 *   1. a random "Pick one for me" button that opens a real game,
 *   2. a Continue playing band for the last game, with best score,
 *   3. a rotating Studio Pick that badges the matching shelf card,
 *   4. a consistent guide-coloured cover frame on every card,
 *   5. calm card pills (age and difficulty moved into Quick look) and
 *      stats hidden until the first play.
 *
 * Run: node tests/arcade-improvements.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.avif': 'image/avif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(base + '/arcade.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('#grid .cab', { timeout: 15000 });

    /* 5a. fresh profile: no stats, a friendly nudge instead */
    const fresh = await page.evaluate(() => ({
      statsHidden: document.getElementById('profileStats').hidden,
      nudgeHidden: document.getElementById('arcFirstNudge').hidden,
      continueHidden: document.getElementById('arcContinue').hidden
    }));
    check('fresh visit hides the zero stats', fresh.statsHidden, JSON.stringify(fresh));
    check('fresh visit shows the first-play nudge', !fresh.nudgeHidden, JSON.stringify(fresh));
    check('fresh visit hides the continue band', fresh.continueHidden, JSON.stringify(fresh));

    /* 2. seed a last-played game and a save, then reload */
    await page.evaluate(() => {
      localStorage.setItem('jvds_arc_last', 'gem-match');
      localStorage.setItem('jvds_game_gem-match', JSON.stringify({
        highScore: 120, gamesPlayed: 3, lastPlayed: new Date().toISOString()
      }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#grid .cab', { timeout: 15000 });
    const cont = await page.evaluate(() => {
      const sec = document.getElementById('arcContinue');
      return {
        hidden: sec.hidden,
        title: document.getElementById('arcContinueTitle').textContent,
        meta: document.getElementById('arcContinueMeta').textContent,
        href: document.getElementById('arcContinuePlay').getAttribute('href'),
        startHidden: document.querySelector('.hub-start').hidden
      };
    });
    check('continue band appears after a game', !cont.hidden, JSON.stringify(cont));
    check('continue band names the last game', /Gem Match/i.test(cont.title), cont.title);
    check('continue band shows the best score', /120/.test(cont.meta), cont.meta);
    check('continue band links to that game', /games\/gem_match\.html$/.test(cont.href), cont.href);
    check('continue band replaces the start band when present', cont.startHidden, String(cont.startHidden));

    /* 5b. card face is calm, details live in Quick look */
    const pills = await page.evaluate(() => {
      const cell = document.querySelector('.cab-cell[data-guide]');
      return {
        meta: (cell.querySelector('.cab-meta') || {}).textContent || '',
        peek: (cell.querySelector('.cab-peek-body') || {}).textContent || ''
      };
    });
    check('card face has no age or difficulty pill', !/Ages?\s|Easy to learn|Challenging|Medium/i.test(pills.meta), pills.meta.trim());
    check('Quick look still carries age and difficulty', /Age/i.test(pills.peek) && /Difficulty/i.test(pills.peek), pills.peek.trim());

    /* 3. the Studio Pick badge follows the spotlight, not a fixed game */
    const spot = await page.evaluate(() => {
      const card = document.querySelector('.arc-spotlight-card');
      if (!card) return null;
      const href = card.getAttribute('href');
      const shelf = document.querySelector('.cab[href="' + href + '"]');
      return {
        guide: card.getAttribute('data-guide'),
        href,
        shelfExists: !!shelf,
        badgeOnShelf: !!(shelf && shelf.querySelector('.cab-badge'))
      };
    });
    check('spotlight card names its guide', !!spot && !!spot.guide, spot && spot.guide);
    check('Studio Pick badge sits on the matching shelf card', !!spot && spot.shelfExists && spot.badgeOnShelf, JSON.stringify(spot));

    /* 4. guide-coloured card frames are applied */
    const guides = await page.evaluate(() => Array.from(document.querySelectorAll('.cab-cell[data-guide]'))
      .map(c => c.getAttribute('data-guide')).filter(Boolean));
    check('cards carry their guide colour', new Set(guides).size >= 2, guides.join(','));

    /* mobile layout */
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await new Promise(r => setTimeout(r, 300));
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    check('arcade hub does not overflow at 390px', scrollWidth <= 392, 'scrollWidth ' + scrollWidth);

    check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    /* 1. random button opens a real game (checked last: it navigates away) */
    const nav = new Promise(resolve => {
      page.once('framenavigated', frame => {
        if (frame === page.mainFrame()) resolve(frame.url());
      });
    });
    await page.click('#arcSurprise');
    const navUrl = await Promise.race([nav, new Promise(r => setTimeout(() => r(null), 5000))]);
    check('random button opens a game page', !!navUrl && /\/games\/[^/?#]+\.html/.test(navUrl), navUrl || 'no navigation');
    if (navUrl) {
      const rel = navUrl.slice(base.length);
      check('random game file exists', fs.existsSync(path.join(ROOT, decodeURIComponent(rel))), rel);
    }
  } catch (err) {
    failures++;
    console.error('arcade improvements test error: ' + err.message);
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL ARCADE IMPROVEMENT CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
