// A1954: the workshop hub starts with a goal-based "What do you need help with?"
// panel. Each goal must reach the right resource in one click, at 390 and 1440.
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

      const response = await page.goto(base + '/pages/workshop.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');
      await page.waitForSelector('#what-do-you-need-help-with .ws-help-card', { timeout: 8000 });

      const info = await page.evaluate(() => {
        const panel = document.getElementById('what-do-you-need-help-with');
        const cards = [...panel.querySelectorAll('.ws-help-card')];
        return {
          heading: (panel.querySelector('h2') || {}).textContent || '',
          cards: cards.map((a) => ({
            title: (a.querySelector('.ws-help-title') || {}).textContent || '',
            href: a.getAttribute('href') || ''
          })),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(/What do you need help with/i.test(info.heading), width + 'px panel heading');
      assert.equal(info.cards.length, 4, width + 'px has four goal cards');
      const titles = info.cards.map((c) => c.title);
      assert.ok(titles.some((t) => /broken/i.test(t)), width + 'px broken-project goal');
      assert.ok(titles.some((t) => /project to start/i.test(t)), width + 'px starter-project goal');
      assert.ok(titles.some((t) => /learn a concept/i.test(t)), width + 'px learn-a-concept goal');
      assert.ok(titles.some((t) => /make something/i.test(t)), width + 'px make-something goal');

      info.cards.forEach((card) => {
        assert.ok(card.href, width + 'px ' + card.title + ' has a href');
        if (card.href.startsWith('#')) return;
        const target = path.resolve(ROOT, 'pages', card.href);
        assert.ok(fs.existsSync(target), width + 'px ' + card.title + ' target exists: ' + card.href);
      });

      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }
    console.log('PASS workshop help entry: four goal cards reach real resources at 390/1440');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
