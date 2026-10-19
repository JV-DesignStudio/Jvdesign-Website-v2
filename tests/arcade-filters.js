// arcade-filters.js , A1761
// The Arcade must let a player narrow 12 cabinets by age, genre, session,
// difficulty and free text, keep the choice in the URL, and show a clear
// empty state. Run: node tests/arcade-filters.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.avif': 'image/avif'
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('missing ' + u); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Failed to load resource|ERR_|favicon|net::/.test(t)) return;
      errors.push(t);
    });
    await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(base + '/arcade.html', { waitUntil: 'load' });
    await page.waitForSelector('#grid .cab', { timeout: 15000 });

    const registry = await page.evaluate(() => window.JVDS_GAMES || []);
    const sessionOf = g => g.session || g.arcadeSession || '';
    const titles = () => page.evaluate(() => Array.from(document.querySelectorAll('#grid .cab-title')).map(e => e.textContent));
    const count = async () => (await titles()).length;
    const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));

    check('registry loaded', registry.length === 12, registry.length + ' games');
    check('default view shows every game', await count() === registry.length, (await count()) + ' cards');

    // Age
    const age = registry[0] && registry.map(g => g.age).filter(Boolean).sort()[0];
    if (age) {
      const expected = registry.filter(g => g.age === age).map(g => g.title).sort();
      await page.select('#arcAge', age); await wait();
      const got = (await titles()).sort();
      check('age filter "' + age + '" narrows the grid', got.length === expected.length && got.every((t, i) => t === expected[i]), got.join(' | '));
    }

    // Genre
    const genre = 'Puzzle';
    const genreExpected = registry.filter(g => g.cat === genre).map(g => g.title).sort();
    await page.select('#arcAge', '');
    await page.select('#arcGenre', genre); await wait();
    const genreGot = (await titles()).sort();
    check('genre filter "' + genre + '" shows only puzzle games', genreGot.length === genreExpected.length && genreGot.every((t, i) => t === genreExpected[i]), genreGot.join(' | '));

    // Session
    const session = registry.map(sessionOf).filter(Boolean).sort()[0];
    if (session) {
      const expected = registry.filter(g => sessionOf(g) === session).map(g => g.title).sort();
      await page.select('#arcGenre', '');
      await page.select('#arcSession', session); await wait();
      const got = (await titles()).sort();
      check('session filter "' + session + '" narrows the grid', got.length === expected.length && got.every((t, i) => t === expected[i]), got.join(' | '));
    }

    // Difficulty
    const difficulty = 'Challenging';
    const diffExpected = registry.filter(g => g.difficulty === difficulty).map(g => g.title).sort();
    await page.select('#arcSession', '');
    await page.select('#arcDifficulty', difficulty); await wait();
    const diffGot = (await titles()).sort();
    check('difficulty filter "' + difficulty + '" narrows the grid', diffGot.length === diffExpected.length && diffGot.every((t, i) => t === diffExpected[i]), diffGot.join(' | '));

    // Search
    await page.select('#arcDifficulty', '');
    await page.evaluate(() => {
      const i = document.getElementById('arcSearch');
      i.value = 'snake';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await wait();
    const snake = await titles();
    check('search finds Stardust Snake', snake.length === 1 && /snake/i.test(snake[0]), snake.join(' | '));

    // URL state survives a reload
    await page.evaluate(() => {
      const i = document.getElementById('arcSearch');
      i.value = '';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.select('#arcAge', 'Ages 8-14');
    await page.select('#arcGenre', 'Action');
    await wait();
    const before = await count();
    const shareUrl = page.url();
    await page.goto(shareUrl, { waitUntil: 'load' });
    await page.waitForSelector('#grid .cab', { timeout: 15000 });
    const after = await count();
    const selected = await page.evaluate(() => ({
      age: document.getElementById('arcAge').value,
      genre: document.getElementById('arcGenre').value
    }));
    check('filters survive a shared URL reload', before === after && selected.age === 'Ages 8-14' && selected.genre === 'Action', before + ' then ' + after + ' | ' + selected.age + ' / ' + selected.genre);

    // Empty state
    await page.select('#arcAge', 'Ages 5-9');
    await page.select('#arcGenre', 'Strategy');
    await wait();
    const empty = await page.evaluate(() => ({
      visible: !document.getElementById('arcEmpty').hidden,
      cards: document.querySelectorAll('#grid .cab').length,
      gridDisplay: getComputedStyle(document.getElementById('grid')).display,
      text: document.getElementById('arcFilterCount').textContent
    }));
    check('an impossible combination shows the empty state', empty.visible && empty.cards === 0 && empty.gridDisplay === 'none', JSON.stringify(empty));

    // Clear
    await page.click('#arcClear');
    await wait();
    const cleared = await page.evaluate(() => ({
      cards: document.querySelectorAll('#grid .cab').length,
      search: location.search,
      emptyHidden: document.getElementById('arcEmpty').hidden
    }));
    check('clear filters restores every game', cleared.cards === registry.length && cleared.search === '' && cleared.emptyHidden, JSON.stringify(cleared));

    // Mobile
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await wait(250);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    check('arcade filters do not overflow at 390px', scrollWidth <= 392, 'scrollWidth ' + scrollWidth);

    check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL ARCADE FILTER CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
