#!/usr/bin/env node
// tests/gdevelop-age-http.js (A1906)
// Checks every GDevelop episode shows the same recommended age, support,
// experience and difficulty block, and the hub carries the same note.
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

const PAGES = [
  ['gdevelop-pong-workshop.html', 'Beginner'],
  ['gdevelop-snake-workshop.html', 'Intermediate'],
  ['gdevelop-platformer-workshop.html', 'Intermediate'],
  ['gdevelop-shooter-workshop.html', 'Intermediate'],
  ['gdevelop-pointclick-workshop.html', 'Advanced'],
  ['gdevelop-adventure-workshop.html', 'Advanced capstone']
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
      for (const [file, difficulty] of PAGES) {
        const { page, errors } = await open(file, width);
        const info = await page.evaluate(() => {
          const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
          const block = document.querySelector('.ws-skill');
          const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
          return {
            block: !!block,
            href: block ? block.getAttribute('data-workshop-skill') : '',
            heading: text(block && block.querySelector('.ws-skill-title')),
            body: text(block),
            pageText: document.body.innerText.replace(/\s+/g, ' '),
            duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });

        const where = file + ' @' + width;
        assert.ok(info.block, where + ' age and experience block');
        assert.equal(info.href, file.replace('.html', ''), where + ' block id');
        assert.equal(info.heading, 'Age and experience', where + ' block heading');
        assert.ok(/Recommended age/.test(info.body) && /8\+/.test(info.body), where + ' recommended age 8+');
        assert.ok(/Support/.test(info.body) && /Adult guidance recommended/.test(info.body), where + ' support note');
        assert.ok(/Experience/.test(info.body) && /No previous coding required/.test(info.body), where + ' experience note');
        assert.ok(/Difficulty/.test(info.body) && new RegExp(difficulty).test(info.body), where + ' difficulty ' + difficulty);
        assert.ok(!/Ages 9\+/.test(info.pageText), where + ' no Ages 9+ left');
        assert.deepEqual(info.duplicateIds, [], where + ' duplicate ids');
        assert.ok(info.overflow <= 2, where + ' overflow ' + info.overflow);
        assert.deepEqual(errors, [], where + ' errors');
        await page.close();
      }

      {
        const { page, errors } = await open('engine-gdevelop.html', width);
        const info = await page.evaluate(() => {
          const note = document.querySelector('.hub-age-note');
          return {
            note: note ? note.textContent.replace(/\s+/g, ' ').trim() : '',
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });
        assert.ok(/Recommended age: 8\+/.test(info.note), width + 'px hub note names 8+');
        assert.ok(/Adult guidance/.test(info.note), width + 'px hub note names support');
        assert.ok(/no previous coding is needed/i.test(info.note), width + 'px hub note names experience');
        assert.ok(info.overflow <= 2, width + 'px hub overflow ' + info.overflow);
        assert.deepEqual(errors, [], width + 'px hub errors');
        await page.close();
      }
    }
    console.log('PASS gdevelop-age-http: 390/1440, 6 episodes and hub share the same age, support, experience and difficulty format');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL gdevelop-age-http: ' + error.message);
  process.exit(1);
});
