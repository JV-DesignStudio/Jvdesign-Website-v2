// A1924: the phone stand lesson must start from the learner's own measurements,
// test tipping and weak points, and explain that print strength is more than infill.
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

      const response = await page.goto(base + '/workshops/tinkercad-ep5-phonestand.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');
      await page.waitForSelector('#step-1 .step-body', { timeout: 8000 });

      const info = await page.evaluate(() => {
        const text = (id) => {
          const el = document.getElementById(id);
          return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
        };
        return {
          step1: text('step-1'),
          step8: text('step-8'),
          step9: text('step-9'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(/Measure your own phone first/i.test(info.step1), width + 'px step 1 asks for measurements');
      ['Phone width', 'Phone thickness', 'Phone height', 'Charging connector width', 'Charging cable thickness']
        .forEach((field) => assert.ok(info.step1.includes(field), width + 'px measures ' + field));
      assert.ok(/2 mm of clearance/i.test(info.step1), width + 'px step 1 uses measurement clearance');

      assert.ok(/your measured phone/i.test(info.step8), width + 'px step 8 tests with the real phone size');
      assert.ok(/tipping/i.test(info.step8), width + 'px step 8 checks tipping');
      assert.ok(/weak points|thin sections/i.test(info.step8), width + 'px step 8 checks weak points');

      assert.ok(/material/i.test(info.step9) && /wall thickness/i.test(info.step9), width + 'px step 9 explains material and walls');
      assert.ok(/orientation/i.test(info.step9) && /printer settings/i.test(info.step9), width + 'px step 9 explains orientation and settings');

      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }
    console.log('PASS phone stand measurements: own device data, tipping and weak points, print strength at 390/1440');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
