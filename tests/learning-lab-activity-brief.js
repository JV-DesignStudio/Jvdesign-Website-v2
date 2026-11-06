// Proves every Learning Lab activity shows what a teacher needs before launch:
// skill, time, reading or adult support, what counts as progress and a follow-up.
// Computing activities must also point at a game-development workshop.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

async function run() {
  const server = require('http').createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
      });
      res.end(err ? '' : data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 950 });
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

      const response = await page.goto(base + '/workshops/learning-lab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');
      await page.waitForFunction(() => document.querySelectorAll('.subject-card').length >= 16, { timeout: 8000 });

      const info = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.subject-card')];
        return {
          count: cards.length,
          cards: cards.map((card) => {
            const brief = card.querySelector('.card-brief');
            const rows = brief ? [...brief.querySelectorAll('.card-brief-row')] : [];
            const follow = brief ? brief.querySelector('a[href], button[data-arg]') : null;
            return {
              id: card.getAttribute('data-arg'),
              labels: rows.map((r) => (r.querySelector('dt') || {}).textContent || ''),
              values: rows.map((r) => (r.querySelector('dd') || {}).textContent || ''),
              followHref: follow ? (follow.getAttribute('href') || '') : '',
              followGame: follow ? (follow.getAttribute('data-arg') || '') : '',
              followText: brief ? brief.textContent || '' : ''
            };
          }),
          startRoute: !!document.querySelector('.lab-start-route'),
          startGames: document.querySelectorAll('.lab-start-games button').length,
          startText: (document.querySelector('.lab-start-route') || {}).textContent || '',
          tierLabels: [...document.querySelectorAll('.tier-label')].map((e) => e.textContent.trim()),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.equal(info.count, 16, width + 'px has 16 activity cards');
      assert.ok(info.startRoute, width + 'px has a start-here route');
      assert.equal(info.startGames, 3, width + 'px start-here route offers three games');
      assert.ok(/adult/i.test(info.startText), width + 'px start-here route explains adult support');
      assert.ok(/Start here/i.test(info.tierLabels[0] || ''), width + 'px beginner lane is named by readiness');
      assert.ok(/Building confidence/i.test(info.tierLabels[1] || ''), width + 'px intermediate lane is named by readiness');
      assert.ok(/Ready for a challenge/i.test(info.tierLabels[2] || ''), width + 'px advanced lane is named by readiness');
      const wanted = ['Skill', 'Time', 'Reading', 'Typing', 'Prior', 'Adult', 'Progress', 'Follow-up'];
      info.cards.forEach((card) => {
        assert.deepEqual(card.labels, wanted, width + 'px ' + card.id + ' has all five brief rows');
        card.values.forEach((v, i) => {
          assert.ok(v.trim().length > 0, width + 'px ' + card.id + ' ' + wanted[i] + ' is not empty');
        });
        assert.ok(card.followHref || card.followGame, width + 'px ' + card.id + ' has a follow-up activity');
      });

      ['echo', 'logic'].forEach((id) => {
        const card = info.cards.find((c) => c.id === id);
        assert.ok(card, width + 'px computing card ' + id);
        assert.ok(/\.html$/.test(card.followHref), width + 'px ' + id + ' follows up to a workshop page');
        assert.ok(/loop|variable|collision/i.test(card.followText), width + 'px ' + id + ' names loops, variables or collisions');
      });

      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }
    console.log('PASS Learning Lab activity briefs: 16 cards x 8 fields, start-here route and readiness lanes at 390/1440');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
