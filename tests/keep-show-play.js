#!/usr/bin/env node
/*
 * tests/keep-show-play.js
 * A2796: My Studio's Keep & play area and the tool-page Take it home pill.
 * Run: node tests/keep-show-play.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PROJECT = {
  v: 3, cW: 2, cH: 2, fps: 8, name: 'Uploaded Sprite',
  layers: [{ name: 'Layer 1', visible: true, opacity: 100 }],
  frames: [[[255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]],
  frameMeta: [{ clip: 'idle', hold: 1 }],
  animLoop: true, exportOrigin: 0
};

// Static wiring
const me = fs.readFileSync(path.join(ROOT, 'me.html'), 'utf8');
assert.ok(me.includes('id="panel-keep"'), 'me.html has the Keep panel');
assert.ok(me.includes('id="reportCard"'), 'me.html has the report card');
assert.ok(me.includes('id="arcadeGrid"'), 'me.html has the arcade grid');
assert.ok(me.includes('id="arcadeCanvas"'), 'me.html has the sprite player');
assert.ok(me.includes('/assets/js/my-studio-keep.js'), 'me.html loads the keep script');
const toolXp = fs.readFileSync(path.join(ROOT, 'tool-xp.js'), 'utf8');
assert.ok(toolXp.includes('jvds-take-home'), 'tool-xp.js has the take-home pill');

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  async function open(url) {
    const page = await browser.newPage();
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) r.continue();
      else r.abort();
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
    return { page, errors };
  }

  const spritePath = path.join(os.tmpdir(), 'jvds-sprite-upload.json');
  const gamePath = path.join(os.tmpdir(), 'jvds-game-project.json');
  fs.writeFileSync(spritePath, JSON.stringify(PROJECT));
  fs.writeFileSync(gamePath, JSON.stringify({
    app: 'jvds-tool-bundle', v: 1, tool: 'arcade-game-maker', name: 'My Game',
    project: { title: 'My Game' }, sprite: null, preview: null
  }));

  try {
    const { page, errors } = await open('/me.html');
    await page.evaluate(({ png, project }) => {
      localStorage.clear();
      localStorage.setItem('jvds-player-name', 'Ada');
      localStorage.setItem('jvds_pixel_keepsake', JSON.stringify([
        { id: 1700000000000, title: 'Pixel Dragon', date: '2026-11-07', thumb: png, project: JSON.stringify(project) }
      ]));
      localStorage.setItem('jvds_echo_improve', JSON.stringify({
        stage: 'done', prompt: 'clearer', badge: true, v1: { thumb: png }, v2: { thumb: png }
      }));
      localStorage.removeItem('jvds_my_arcade');
      localStorage.removeItem('jvds_report_notes');
      localStorage.removeItem('jvds_take_home_seen');
    }, { png: PNG, project: PROJECT });
    await page.reload({ waitUntil: 'load' });

    // 1. Keep tab + report
    await page.click('.tab[data-tab="keep"]');
    await page.waitForFunction(() => document.getElementById('panel-keep').classList.contains('active'));
    const report = await page.evaluate(() => ({
      art: !!document.querySelector('#reportArt img'),
      meta: document.getElementById('reportMeta').textContent,
      learned: document.getElementById('reportLearned').value,
      date: document.getElementById('reportDate').textContent
    }));
    assert.ok(report.art, 'report shows the newest creation');
    assert.ok(/Ada/.test(report.meta) && /Pixel Dragon/.test(report.meta), 'report names the creator and creation');
    assert.ok(/clearer/i.test(report.learned), 'report pre-fills the Echo improvement');
    assert.equal(report.date, '2026-11-07', 'report shows the creation date');

    await page.click('#reportMade');
    await page.evaluate(() => { document.getElementById('reportMade').value = ''; });
    await page.type('#reportMade', 'I made a pixel dragon with a tail.');
    const savedNotes = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds_report_notes') || '{}'));
    assert.ok(JSON.stringify(savedNotes).includes('pixel dragon'), 'report lines save on this device');

    await page.evaluate(() => { window.__printed = 0; window.print = function () { window.__printed++; }; });
    await page.$eval('#reportSection [data-on="printReport"]', (el) => el.click());
    await page.waitForFunction(() => window.__printed === 1);
    const printing = await page.evaluate(() => document.body.classList.contains('report-printing'));
    assert.ok(printing, 'print mode hides everything except the report');

    // 2. My Arcade: keepsake sprite plays in-page
    const savedCards = await page.$$eval('.arcade-card', (cards) => cards.map((c) => c.textContent));
    assert.equal(savedCards.length, 1, 'the newest creation appears in My Arcade');
    assert.ok(/Play animation/.test(savedCards[0]), 'saved sprites offer Play animation');

    await page.$eval('.arcade-card .keep-primary', (el) => el.click());
    await page.waitForFunction(() => !document.getElementById('arcadeModal').hidden);
    const sprite = await page.evaluate(() => {
      const canvas = document.getElementById('arcadeCanvas');
      const frame = document.getElementById('arcadeFrame');
      const ctx = canvas.getContext('2d');
      const px = ctx.getImageData(10, 10, 1, 1).data;
      return { canvasHidden: canvas.hidden, frameHidden: frame.hidden, r: px[0], a: px[3] };
    });
    assert.equal(sprite.canvasHidden, false, 'sprite player is visible');
    assert.equal(sprite.frameHidden, true, 'game iframe stays hidden for a sprite');
    assert.ok(sprite.r === 255 && sprite.a === 255, 'sprite pixels draw on the canvas');
    await page.$eval('[data-on="closeArcade"]', (el) => el.click());
    await page.waitForFunction(() => document.getElementById('arcadeModal').hidden);

    // 3. Add a project file, persist, then remove it
    await (await page.$('#arcadeFile')).uploadFile(spritePath);
    await page.waitForFunction(() => document.querySelectorAll('.arcade-card').length === 2);
    const added = await page.evaluate(() => ({
      cards: document.querySelectorAll('.arcade-card').length,
      stored: (JSON.parse(localStorage.getItem('jvds_my_arcade') || '[]') || []).length,
      names: [...document.querySelectorAll('.arcade-card strong')].map((e) => e.textContent)
    }));
    assert.equal(added.cards, 2, 'uploaded project adds a card');
    assert.equal(added.stored, 1, 'uploaded project is saved locally');
    assert.ok(added.names.includes('Uploaded Sprite'), 'uploaded project keeps its name');

    await (await page.$('#arcadeFile')).uploadFile(gamePath);
    await page.waitForFunction(() => document.querySelectorAll('.arcade-card').length === 3);
    const gameButton = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.arcade-card')].find((c) => /My Game/.test(c.textContent));
      return card ? card.querySelector('.keep-primary').textContent : '';
    });
    assert.ok(/Play in Game Maker/.test(gameButton), 'game bundles open in the maker');

    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.arcade-card')].find((c) => /My Game/.test(c.textContent));
      const remove = [...card.querySelectorAll('button')].find((b) => /Remove/.test(b.textContent));
      remove.click();
    });
    await page.waitForFunction(() => document.querySelectorAll('.arcade-card').length === 2);
    assert.equal(await page.evaluate(() => (JSON.parse(localStorage.getItem('jvds_my_arcade') || '[]') || []).length), 1, 'remove clears one saved project');

    await page.reload({ waitUntil: 'load' });
    await page.click('.tab[data-tab="keep"]');
    await page.waitForSelector('.arcade-card');
    assert.equal(await page.$$eval('.arcade-card', (n) => n.length), 2, 'creations persist after reload');

    // 4. 390px no sideways scroll
    await page.setViewport({ width: 390, height: 900 });
    await new Promise((r) => setTimeout(r, 250));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, 'Keep panel fits 390px (' + overflow + ')');
    assert.deepEqual(errors, [], 'no errors on My Studio');
    await page.close();

    // 5. Take it home pill after an export on a tool page
    const tool = await open('/tools/pixel-studio.html');
    await tool.page.evaluate(() => {
      const a = document.createElement('a');
      a.download = 'sprite.png';
      a.href = 'data:image/png;base64,iVBORw0KGgo=';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    await tool.page.waitForSelector('#jvds-take-home', { timeout: 8000 });
    const pill = await tool.page.evaluate(() => ({
      href: document.querySelector('#jvds-take-home a').getAttribute('href'),
      armed: !!window.JVDS_TAKE_HOME_ARMED
    }));
    assert.equal(pill.href, '/me.html#keep', 'pill links to the keep panel');
    assert.ok(pill.armed, 'close nudge is armed for real browsers');
    assert.deepEqual(tool.errors, [], 'no errors on the tool page');
    await tool.page.close();

    console.log('\nPASS keep-show-play: take it home, printable report, safe sprite/game arcade and tool pill (1440/390)');
  } finally {
    try { fs.unlinkSync(spritePath); } catch (e) {}
    try { fs.unlinkSync(gamePath); } catch (e) {}
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL keep-show-play: ' + error.message);
  process.exit(1);
});
