#!/usr/bin/env node
// tests/pico8-lua-practice-http.js (A1878)
// Every PICO-8 workshop gets the same four-stage Lua practice panel. This test
// loads all six pages, checks the panel exists, grades a wrong and a right
// answer for Predict, Type and Debug, then completes Create with real code and
// an explanation. It also checks that the finished practice survives a reload.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const PAGES = [
  {
    path: '/workshops/pico8-pong-workshop.html', id: 'pico8-pong',
    type: 'bx += bvx', debug: 'bvx = -bvx',
    code: 'bvx = -bvx * 1.05',
    why: 'I want the ball to speed up on every paddle hit so long rallies feel exciting.'
  },
  {
    path: '/workshops/pico8-snake-workshop.html', id: 'pico8-snake',
    type: 'add(snake, {x=8, y=8})', debug: 'score += 1',
    code: 'for i=1,2 do add(snake, {x=head.x, y=head.y}) end',
    why: 'Eating one food should add two segments so the snake grows faster.'
  },
  {
    path: '/workshops/pico8-shooter-workshop.html', id: 'pico8-shooter',
    type: 'spawnTimer += 1', debug: 'enemies[e].hp -= 1',
    code: 'enemies[e].hp = 2',
    why: 'Two hits makes each enemy feel tougher without making the game too hard.'
  },
  {
    path: '/workshops/pico8-match3-workshop.html', id: 'pico8-match3',
    type: 'local temp = grid[curY][curX]', debug: 'grid[r][c] == grid[r][c+2]',
    code: 'if grid[r][c] == grid[r][c+3] then score += 5 end',
    why: 'A match of four is harder to find, so it should reward more points.'
  },
  {
    path: '/workshops/pico8-dungeon-workshop.html', id: 'pico8-dungeon',
    type: 'if btn(0) then mx = -1.5 end', debug: 'if hp <= 0 then',
    code: 'hp = hp + 1',
    why: 'A potion should give the player one more chance when health is low.'
  },
  {
    path: '/workshops/pico8-platformer-workshop.html', id: 'pico8-platformer',
    type: 'pvy += 0.15', debug: 'pvy += 0.15',
    code: 'if jumps < 2 then jumps += 1; pvy = -3 end',
    why: 'A double jump gives the player a second chance to reach a high platform.'
  }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, base) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 900, isMobile: true, hasTouch: true });
  await page.setRequestInterception(true);
  page.on('request', (r) => (
    r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:')
      ? r.continue()
      : r.abort()
  ));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) {
      errors.push(m.text());
    }
  });
  return { context, page, errors };
}

async function runPage(browser, base, item) {
  const { context, page, errors } = await open(browser, base);
  try {
    await page.goto(base + item.path, { waitUntil: 'load', timeout: 30000 });
    if (await page.$('#cookie-decline')) await page.click('#cookie-decline');
    await page.waitForSelector('[data-lua-practice]');
    assert.equal(await page.$$eval('[data-lua-practice] .lp-stage', (els) => els.length), 4, item.id + ' has four stages');
    assert.ok(/0 of 4/.test(await page.$eval('[data-lp-count]', (el) => el.textContent)), item.id + ' starts at 0 of 4');

    const options = await page.$$('[data-lua-practice] [data-opt]');
    for (const option of options) {
      await option.click();
      await page.click('[data-act="predict"]');
      await wait(40);
      const done = await page.$eval('[data-stage="predict"]', (el) => el.getAttribute('data-done') === 'true');
      if (done) break;
    }
    assert.equal(await page.$eval('[data-stage="predict"]', (el) => el.getAttribute('data-done')), 'true', item.id + ' accepts the right prediction');

    await page.type('[data-input="type"]', 'not lua');
    await page.click('[data-act="type"]');
    await wait(40);
    assert.equal(await page.$eval('[data-stage="type"]', (el) => el.getAttribute('data-done')), 'false', item.id + ' rejects a wrong typed line');
    await page.$eval('[data-input="type"]', (el) => { el.value = ''; });
    await page.type('[data-input="type"]', item.type);
    await page.click('[data-act="type"]');
    await wait(40);
    assert.equal(await page.$eval('[data-stage="type"]', (el) => el.getAttribute('data-done')), 'true', item.id + ' accepts the typed line');

    await page.type('[data-input="debug"]', 'not the fix');
    await page.click('[data-act="debug"]');
    await wait(40);
    assert.equal(await page.$eval('[data-stage="debug"]', (el) => el.getAttribute('data-done')), 'false', item.id + ' rejects a wrong fix');
    await page.$eval('[data-input="debug"]', (el) => { el.value = ''; });
    await page.type('[data-input="debug"]', item.debug);
    await page.click('[data-act="debug"]');
    await wait(40);
    assert.equal(await page.$eval('[data-stage="debug"]', (el) => el.getAttribute('data-done')), 'true', item.id + ' accepts the fix');

    await page.type('[data-input="code"]', item.code);
    await page.type('[data-input="why"]', item.why);
    await page.click('[data-act="create"]');
    await wait(40);
    assert.equal(await page.$eval('[data-stage="create"]', (el) => el.getAttribute('data-done')), 'true', item.id + ' completes Create');
    assert.ok(/4 of 4/.test(await page.$eval('[data-lp-count]', (el) => el.textContent)), item.id + ' reaches 4 of 4');
    assert.equal(await page.$eval('[data-lp-done]', (el) => el.hidden), false, item.id + ' shows the finished message');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-lua-practice]');
    assert.ok(/4 of 4/.test(await page.$eval('[data-lp-count]', (el) => el.textContent)), item.id + ' restores the practice');
    assert.ok((await page.$eval('[data-input="code"]', (el) => el.value)).length > 5, item.id + ' restores the created code');

    assert.deepEqual(errors, [], item.id + ' has no page errors: ' + errors.slice(0, 2).join(' | '));
  } finally {
    await context.close();
  }
}

(async () => {
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, clean);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const item of PAGES) await runPage(browser, base, item);
    console.log('PASS pico8-lua-practice-http: Predict, Type, Debug and Create work on all six workshops, and progress restores');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL pico8-lua-practice-http: ' + error.message + '\n' + (error.stack || ''));
  process.exit(1);
});
