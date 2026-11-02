// workshop-http.js - page check for pages/workshop.html (A2005).
// Verifies the finder's filters combine, the count stays accurate, chips
// remove one filter at a time, Clear all filters resets, and the empty state
// gives a recovery path at 1440 and 390.
const fs = require('fs');
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

function countText(text) {
  const m = String(text).match(/Showing (\d+)/);
  return m ? parseInt(m[1], 10) : -1;
}

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

  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 950 });
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()));

      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push(m.text());
      });

      const response = await page.goto(base + '/pages/workshop.html', { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px page status');

      const initial = await page.evaluate(() => ({
        cards: document.querySelectorAll('#catalogueGrid .course-card').length,
        controls: ['workshopTool', 'workshopExperience', 'workshopDifficulty', 'workshopSearch', 'ageBar', 'noInstallFilter']
          .every((id) => !!document.getElementById(id)),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      assert.ok(initial.cards > 0, width + 'px catalogue cards');
      assert.ok(initial.controls, width + 'px filter controls');
      assert.ok(initial.overflow <= 2, width + 'px initial overflow ' + initial.overflow);

      await page.select('#workshopTool', 'Scratch');
      await page.select('#workshopDifficulty', 'beginner');
      await page.click('#noInstallFilter');
      await page.waitForFunction(() => document.querySelectorAll('.ws-active-chip').length === 3);

      const combo = await page.evaluate(() => {
        const chips = [...document.querySelectorAll('.ws-active-chip')];
        return {
          visible: [...document.querySelectorAll('#catalogueGrid .course-card')].filter((c) => c.style.display !== 'none').length,
          result: document.getElementById('filterResult').textContent,
          chips: chips.map((c) => c.textContent),
          chipTag: chips[0] ? chips[0].tagName : '',
          chipHeight: chips[0] ? chips[0].getBoundingClientRect().height : 0,
          activeHidden: document.getElementById('activeFilters').hidden,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      assert.ok(combo.visible > 0, width + 'px combined filters have results');
      assert.equal(countText(combo.result), combo.visible, width + 'px count matches visible cards');
      assert.equal(combo.chips.length, 3, width + 'px three chips');
      assert.ok(combo.chips.some((c) => /Scratch/.test(c)), width + 'px Scratch chip');
      assert.ok(combo.chips.some((c) => /Beginner/.test(c)), width + 'px Beginner chip');
      assert.ok(combo.chips.some((c) => /No install/.test(c)), width + 'px No install chip');
      assert.equal(combo.chipTag, 'BUTTON', width + 'px chips are buttons');
      assert.ok(combo.chipHeight >= 44, width + 'px chips are touch sized');
      assert.equal(combo.activeHidden, false, width + 'px chip row visible');
      assert.ok(combo.overflow <= 2, width + 'px combo overflow ' + combo.overflow);

      await page.click('.ws-active-chip[aria-label="Remove filter: Level: Beginner"]');
      await page.waitForFunction(() => document.querySelectorAll('.ws-active-chip').length === 2);
      const removed = await page.evaluate(() => ({
        visible: [...document.querySelectorAll('#catalogueGrid .course-card')].filter((c) => c.style.display !== 'none').length,
        result: document.getElementById('filterResult').textContent,
        level: document.getElementById('workshopDifficulty').value,
        chips: document.querySelectorAll('.ws-active-chip').length
      }));
      assert.equal(removed.level, '', width + 'px level cleared');
      assert.equal(removed.chips, 2, width + 'px chip removed');
      assert.equal(countText(removed.result), removed.visible, width + 'px count updates after chip removal');
      assert.ok(removed.visible >= combo.visible, width + 'px removing a filter cannot hide more');

      await page.click('#activeFilterClear');
      const cleared = await page.evaluate(() => ({
        tool: document.getElementById('workshopTool').value,
        difficulty: document.getElementById('workshopDifficulty').value,
        noInstall: document.getElementById('noInstallFilter').getAttribute('aria-pressed'),
        hidden: document.getElementById('activeFilters').hidden,
        chips: document.querySelectorAll('.ws-active-chip').length,
        visible: [...document.querySelectorAll('#catalogueGrid .course-card')].filter((c) => c.style.display !== 'none').length
      }));
      assert.equal(cleared.tool, '', width + 'px tool reset');
      assert.equal(cleared.difficulty, '', width + 'px difficulty reset');
      assert.equal(cleared.noInstall, 'false', width + 'px no-install reset');
      assert.equal(cleared.hidden, true, width + 'px chip row hidden');
      assert.equal(cleared.chips, 0, width + 'px no chips left');
      assert.ok(cleared.visible > combo.visible, width + 'px clear all restores cards');

      await page.type('#workshopSearch', 'zzzz-no-such-project');
      await page.waitForFunction(() => document.getElementById('workshopNoResults').classList.contains('show'));
      const empty = await page.evaluate(() => ({
        visible: [...document.querySelectorAll('#catalogueGrid .course-card')].filter((c) => c.style.display !== 'none').length,
        hint: document.getElementById('workshopNoResultsHint').textContent,
        reset: !!document.getElementById('workshopNoResultsReset'),
        searchChip: [...document.querySelectorAll('.ws-active-chip')].some((c) => /Search/.test(c.textContent))
      }));
      assert.equal(empty.visible, 0, width + 'px empty result count');
      assert.ok(/shorten the search/i.test(empty.hint), width + 'px empty state hint');
      assert.ok(empty.reset, width + 'px empty state recovery link');
      assert.ok(empty.searchChip, width + 'px search chip');

      assert.deepEqual(errors, [], width + 'px console or page errors');
      await page.close();
    }
    console.log('PASS workshop-http: combined filters, accurate count, chip removal, clear all, empty hint, 1440/390 no overflow, no errors');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL workshop-http: ' + error.message);
  process.exit(1);
});
