#!/usr/bin/env node
/**
 * tests/workshop-course-nav.js
 * A2268: every workshop in an ordered course shows a real Back and Next link,
 * and the learn hub shows Continue plus the full course map.
 *
 * Run: node tests/workshop-course-nav.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const COURSES_FILE = path.join(ROOT, 'content', 'courses.json');

function staticChecks() {
  const data = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
  assert.ok(Array.isArray(data.courses) && data.courses.length >= 20, 'courses.json has courses');
  const seen = new Set();
  let steps = 0;
  data.courses.forEach((course) => {
    assert.ok(course.name && course.steps && course.steps.length >= 2, 'course has a name and steps');
    course.steps.forEach((step) => {
      steps++;
      assert.ok(!seen.has(step.slug), 'duplicate step ' + step.slug);
      seen.add(step.slug);
      assert.ok(
        fs.existsSync(path.join(ROOT, 'workshops', step.slug + '.html')),
        'step page missing: workshops/' + step.slug + '.html'
      );
    });
  });
  assert.ok(steps >= 100, 'expected at least 100 ordered steps, found ' + steps);
  console.log('PASS static: ' + data.courses.length + ' courses, ' + steps + ' steps, every page exists');
}

async function browserChecks() {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, new URL(req.url, 'http://localhost').pathname);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync(systemChrome) ? systemChrome : undefined);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push('console: ' + m.text());
    });
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.url().startsWith(base) || r.url().startsWith('data:')) r.continue();
      else r.abort();
    });

    const open = async (file) => {
      errors.length = 0;
      await page.goto(base + file, { waitUntil: 'load' });
      if (await page.$('#cookie-decline')) await page.click('#cookie-decline');
    };

    const nav = async () => {
      await page.waitForSelector('[data-course-nav]', { timeout: 8000 });
      return page.evaluate(() => {
        const root = document.querySelector('[data-course-nav]');
        const prev = root.querySelector('.ws-course-nav-prev');
        const next = root.querySelector('.ws-course-nav-next');
        return {
          count: (root.querySelector('.ws-course-nav-count') || {}).textContent,
          course: (root.querySelector('.ws-course-nav-course') || {}).textContent,
          prev: prev ? prev.getAttribute('href') : null,
          next: next ? next.getAttribute('href') : null,
        };
      });
    };

    const assertNoOverflow = async (label) => {
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 900 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(overflow <= width, label + ' overflow at ' + width + ': ' + overflow);
      }
    };

    await open('/workshops/js-memory-workshop.html');
    const middle = await nav();
    assert.equal(middle.course, 'My First Browser Game');
    assert.equal(middle.count, 'Step 2 of 6');
    assert.equal(middle.prev, '/workshops/js-flappy-workshop.html');
    assert.equal(middle.next, '/workshops/js-breakout-workshop.html');
    await assertNoOverflow('step page');
    assert.deepEqual(errors, []);

    await open('/workshops/js-flappy-workshop.html');
    const first = await nav();
    assert.equal(first.count, 'Step 1 of 6');
    assert.equal(first.prev, '/workshops/my-first-browser-game.html', 'first step Back goes to the course hub');
    assert.equal(first.next, '/workshops/js-memory-workshop.html');

    await open('/workshops/js-platformer-part2-workshop.html');
    const last = await nav();
    assert.equal(last.count, 'Step 6 of 6');
    assert.equal(last.next, '/workshops/my-first-browser-game.html', 'last step Next goes to the course hub');

    await open('/workshops/js-breakout-workshop.html');
    await nav();
    await open('/workshops/learn.html');
    await page.waitForSelector('.learn-resume-card', { timeout: 8000 });
    const hub = await page.evaluate(() => ({
      resume: document.querySelector('.learn-resume-card').getAttribute('href'),
      cards: document.querySelectorAll('.learn-course-card').length,
      sub: (document.querySelector('.learn-resume-sub') || {}).textContent,
    }));
    assert.equal(hub.resume, '/workshops/js-breakout-workshop.html');
    assert.ok(hub.cards >= 20, 'course map should list at least 20 courses, found ' + hub.cards);
    assert.ok(/Episode 3/.test(hub.sub || ''), 'resume card names the saved step, got ' + hub.sub);
    await assertNoOverflow('learn hub');

    console.log('PASS browser: middle/first/last step links, learn resume, course map, 1440/390 clean');
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  staticChecks();
  await browserChecks();
})().catch((e) => {
  console.error('FAIL tests/workshop-course-nav.js');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
