// Shared check for engine hubs that carry a readiness guide (A1939):
// the guide must list the expected projects, with a guided route and an
// independent challenge for each, and the page must render cleanly.
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

async function run(pagePath, expected) {
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
      await page.setBypassServiceWorker(true);
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

      let response = null;
      for (let attempt = 0; attempt < 2 && !(response && response.status() === 200); attempt++) {
        response = await page.goto(base + pagePath, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const guide = document.querySelector('.hub-readiness');
        return {
          h1: document.querySelectorAll('h1').length,
          readiness: !!guide,
          heading: guide ? (guide.querySelector('h2') || {}).textContent || '' : '',
          projects: guide ? [...guide.querySelectorAll('.hp-project h3')].map((e) => e.textContent.trim()) : [],
          guided: guide ? guide.querySelectorAll('.hp-route--guided').length : 0,
          independent: guide ? guide.querySelectorAll('.hp-route--independent').length : 0,
          links: guide ? [...guide.querySelectorAll('.hp-route')].map((a) => a.getAttribute('href')) : [],
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(info.h1 >= 1, width + 'px has an h1');
      assert.ok(info.readiness, width + 'px readiness guide');
      assert.ok(info.heading.trim().length > 10, width + 'px readiness heading names the check');
      assert.deepEqual(info.projects, expected.projects, width + 'px readiness projects');
      assert.equal(info.guided, expected.projects.length, width + 'px guided route per project');
      assert.equal(info.independent, expected.projects.length, width + 'px independent challenge per project');
      info.links.forEach((href) => {
        assert.ok(/^[a-z0-9-]+\.html$/.test(href || ''), width + 'px route is a local workshop page: ' + href);
        assert.ok(fs.existsSync(path.join(ROOT, 'workshops', href)), width + 'px route target exists: ' + href);
      });
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS ' + pagePath + ': 390/1440, readiness projects and routes, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

module.exports = { run };
