const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (error, data) => {
      res.writeHead(error ? 404 : 200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(error ? '' : data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith('http://127.0.0.1:') || request.url().startsWith('data:') ? request.continue() : request.abort());
    await page.evaluateOnNewDocument(() => {
      let seed = 12345;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    });
    const url = `http://127.0.0.1:${server.address().port}/games/bubble-pop-galaxy.html`;
    await page.goto(url, { waitUntil: 'load' });
    assert.deepEqual(errors, [], 'Fresh visit must not throw');
    assert.equal(await page.$eval('#tutorialModal', el => el.classList.contains('show')), true);
    if (await page.$('#cookie-decline')) await page.click('#cookie-decline');
    await page.click('#tutorialModal .btn');
    await page.waitForFunction(() => game.moves > 0 && game.target > 0 && document.querySelectorAll('#board .bubble').length === 56);
    assert.equal(await page.evaluate(() => localStorage.getItem('bp_galaxy_tutorial_seen')), '1');
    console.log('PASS: fresh visitor completes tutorial and receives a playable board');

    const id = await page.evaluate(() => {
      const groups = [];
      for (let r = 1; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
        const size = connectedGroup(r, c).length;
        if (size >= 2) groups.push({ id: cells[r][c].id, size });
      }
      return groups.sort((a, b) => a.size - b.size)[0].id;
    });
    await page.waitForFunction(() => !busy);
    await page.click(`.bubble[data-id="${id}"]`);
    await page.waitForFunction(() => game.score > 0 && !busy);
    const beforeHelp = await page.evaluate(() => ({ score: game.score, moves: game.moves, level: game.level, bubbles: cells.map(row => row.map(b => b && b.id)) }));
    await page.click('#helpBtn');
    await page.waitForSelector('#tutorialModal.show', {timeout:3000});
    await page.click('#tutorialModal .btn');
    assert.deepEqual(await page.evaluate(() => ({ score: game.score, moves: game.moves, level: game.level, bubbles: cells.map(row => row.map(b => b && b.id)) })), beforeHelp, 'Closing help must not restart the run');
    console.log('PASS: real bubble tap scores; reopening help preserves the run');

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => game.moves > 0 && document.querySelectorAll('#board .bubble').length === 56);
    assert.equal(await page.$eval('#tutorialModal', el => el.classList.contains('show')), false);
    console.log('PASS: returning Level 1 player starts without repeating onboarding');

    await page.evaluate(() => localStorage.setItem('bp_galaxy_progress', JSON.stringify({ bestLevel: 3, stars: { 1: 3, 2: 2 } })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#modal.show');
    assert.match(await page.$eval('#modalBtn', el => el.textContent), /Continue.*3/);
    await page.click('#modalBtn');
    await page.waitForFunction(() => game.level === 3 && game.moves > 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bp_galaxy_progress'))), { bestLevel: 3, stars: { 1: 3, 2: 2 } });
    assert.deepEqual(errors, []);
    console.log('PASS: saved level and stars survive reload and Continue');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
