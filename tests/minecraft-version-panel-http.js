#!/usr/bin/env node
// tests/minecraft-version-panel-http.js (A1932)
// Checks the setup page publishes one version-compatibility panel and every
// mod lesson agrees on Minecraft 1.21.1. Runs at 390px and 1440px.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const PILL_PAGES = [
  'minecraft-first-item-mod.html',
  'minecraft-custom-block-mod.html',
  'minecraft-custom-food-mod.html',
  'minecraft-custom-mob-mod.html',
  'minecraft-custom-tool-mod.html',
  'minecraft-lucky-mod.html'
];

(async () => {
  const server = http.createServer((req, res) => {
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

  async function open(file, width) {
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
      response = await page.goto(base + '/workshops/' + file, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
      if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
    }
    assert.equal(response && response.status(), 200, file + ' @' + width + ' status');
    return { page, errors };
  }

  try {
    for (const width of [390, 1440]) {
      {
        const { page, errors } = await open('minecraft-setup-check.html', width);
        const info = await page.evaluate(() => {
          const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
          return {
            panel: !!document.querySelector('#versions .mc-versions'),
            body: text(document.querySelector('#versions')),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });
        assert.ok(info.panel, width + 'px version panel');
        assert.ok(/Minecraft Java Edition/.test(info.body), width + 'px names Minecraft');
        assert.ok(/1\.21\.1/.test(info.body), width + 'px names 1.21.1');
        assert.ok(/Java JDK/.test(info.body) && /21/.test(info.body), width + 'px names Java 21');
        assert.ok(/Fabric Loader/.test(info.body), width + 'px names Fabric Loader');
        assert.ok(/Fabric API/.test(info.body), width + 'px names Fabric API');
        assert.ok(/IntelliJ IDEA/.test(info.body), width + 'px names IntelliJ');
        assert.ok(/Gradle/.test(info.body), width + 'px names Gradle');
        assert.ok(/Last tested/.test(info.body), width + 'px names test date');
        assert.ok(/Fresh project check/.test(info.body), width + 'px names fresh project check');
        assert.ok(info.overflow <= 2, width + 'px setup-check overflow ' + info.overflow);
        assert.deepEqual(errors, [], width + 'px setup-check errors');
        await page.close();
      }

      for (const file of PILL_PAGES) {
        const { page, errors } = await open(file, width);
        const info = await page.evaluate(() => ({
          pill: [...document.querySelectorAll('.pill')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }));
        assert.ok(/Fabric 1\.21\.1/.test(info.pill), file + ' @' + width + ' pill shows Fabric 1.21.1');
        assert.ok(!/Fabric 1\.21(?!\.1)/.test(info.pill), file + ' @' + width + ' no old Fabric 1.21 pill');
        assert.ok(info.overflow <= 2, file + ' @' + width + ' overflow ' + info.overflow);
        assert.deepEqual(errors, [], file + ' @' + width + ' errors');
        await page.close();
      }

      {
        const { page, errors } = await open('my-first-minecraft-mod.html', width);
        const info = await page.evaluate(() => ({
          body: document.body.innerText.replace(/\s+/g, ' '),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }));
        assert.ok(/Minecraft Java Edition 1\.21\.1/.test(info.body), width + 'px series FAQ names 1.21.1');
        assert.ok(info.overflow <= 2, width + 'px series overflow ' + info.overflow);
        assert.deepEqual(errors, [], width + 'px series errors');
        await page.close();
      }
    }
    console.log('PASS minecraft-version-panel-http: 390/1440, one version panel, all lessons agree on Fabric 1.21.1, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL minecraft-version-panel-http: ' + error.message);
  process.exit(1);
});
