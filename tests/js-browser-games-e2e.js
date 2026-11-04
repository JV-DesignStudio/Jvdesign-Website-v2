#!/usr/bin/env node
// tests/js-browser-games-e2e.js (A1914)
// End-to-end checks for the two JavaScript browser game workshops:
//   workshops/race-builder.html
//   workshops/sci-fi-runner-builder.html
// Covers step gating, wrong and right answers, keyboard and touch controls,
// saved tuning, and quiz progress after a refresh.
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
  '.ico': 'image/x-icon', '.zip': 'application/zip'
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function openPage(browser, base, width) {
  return browser.createBrowserContext().then(async (context) => {
    const page = await context.newPage();
    await page.setViewport({ width, height: 900, isMobile: width === 390, hasTouch: width === 390 });
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
  });
}

async function raceFlow(browser, base) {
  const { context, page, errors } = await openPage(browser, base, 390);
  try {
    await page.goto(base + '/workshops/race-builder.html', { waitUntil: 'load', timeout: 30000 });
    if (await page.$('#cookie-decline')) await page.click('#cookie-decline');
    await page.waitForSelector('#stepTabs .tb');
    assert.equal(await page.$$eval('#stepTabs .tb', (els) => els.length), 10, 'race has 10 steps');
    assert.equal(await page.$eval('.step-nav .btn-n', (b) => b.disabled), true, 'race next locked before apply');

    await page.click('#stepTabs .tb:nth-child(2)');
    await wait(80);
    assert.ok(/^01/.test(await page.$eval('#stepTabs .tb.active', (el) => el.textContent)), 'race blocks a forward tab jump');
    assert.ok(/Apply Step 1/.test(await page.$eval('#obar', (el) => el.textContent)), 'race explains the lock');

    await page.type('#inp_carName', 'TESTER');
    await page.click('.swatch[data-arg="#38bdf8"]');
    await page.click('.run-btn[data-action="applyStep"]');
    await wait(120);
    assert.equal(await page.$eval('#hc-name', (el) => el.textContent), 'TESTER', 'race applies the car name');
    assert.equal(await page.$eval('.step-nav .btn-n', (b) => b.disabled), false, 'race next unlocks after apply');
    const saved1 = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds-race-builder-v2')));
    assert.equal(saved1.config.carName, 'TESTER', 'race saves the car name');

    await page.click('.step-nav .btn-n');
    await page.waitForFunction(() => /Set Top Speed/.test(document.getElementById('stepBody').textContent));

    await page.click('#quiz-2 .quiz-opt[data-idx="0"]');
    await page.click('#quiz-2 .quiz-submit');
    assert.ok(/Not quite/.test(await page.$eval('#quiz-2 .quiz-feedback', (el) => el.textContent)), 'race rejects a wrong quiz answer');
    await page.click('#quiz-2 .quiz-opt[data-idx="2"]');
    await page.click('#quiz-2 .quiz-submit');
    assert.ok(/Correct/.test(await page.$eval('#quiz-2 .quiz-feedback', (el) => el.textContent)), 'race accepts the right quiz answer');
    assert.notEqual(await page.$eval('#quiz-2 .quiz-next-btn', (el) => getComputedStyle(el).display), 'none', 'race shows the quiz continue');

    await page.type('#cc-2 .cc-blank', 'wrong');
    await page.click('#cc-2 .cc-check-btn');
    assert.ok(/Check the highlighted blanks/.test(await page.$eval('#cc-2 .cc-feedback', (el) => el.textContent)), 'race rejects wrong code');
    await page.$eval('#cc-2 .cc-blank', (el) => { el.value = ''; });
    await page.type('#cc-2 .cc-blank', 'topSpeed');
    await page.click('#cc-2 .cc-check-btn');
    assert.ok(/Perfect code/.test(await page.$eval('#cc-2 .cc-feedback', (el) => el.textContent)), 'race accepts the right code');

    await page.$eval('#inp_topSpeed', (el) => {
      el.value = '6';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('.run-btn[data-action="applyStep"]');
    await wait(120);
    assert.equal(await page.$eval('#hc-spd', (el) => el.textContent), '6x', 'race applies the top speed');
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds-race-builder-v2')));
    assert.equal(saved2.config.topSpeed, 6, 'race saves the top speed');

    await page.keyboard.down('ArrowUp');
    await wait(700);
    await page.keyboard.up('ArrowUp');
    const speed = parseInt(await page.$eval('#hudSpeed', (el) => el.textContent), 10) || 0;
    assert.ok(speed > 0, 'race keyboard drives the car');

    await page.evaluate(() => {
      const b = document.querySelector('.dpad-btn[data-key="ArrowLeft"]');
      b.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    });
    assert.ok(await page.$eval('.dpad-btn[data-key="ArrowLeft"]', (el) => el.classList.contains('pressed')), 'race touch press');
    await page.evaluate(() => {
      const b = document.querySelector('.dpad-btn[data-key="ArrowLeft"]');
      b.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
    });
    assert.ok(!(await page.$eval('.dpad-btn[data-key="ArrowLeft"]', (el) => el.classList.contains('pressed'))), 'race touch release');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#stepTabs .tb');
    assert.equal(await page.$eval('#inp_carName', (el) => el.value), 'TESTER', 'race restores the car name');
    assert.equal(await page.$eval('#hc-spd', (el) => el.textContent), '6x', 'race restores the top speed');
    assert.ok(await page.$$eval('.pd.done', (els) => els.length) >= 2, 'race restores completed steps');
    assert.ok(await page.$('a[href$="race-builder-reference.zip"]'), 'race keeps a downloadable reference');
    assert.ok(await page.$('a[href$="my-progress.html"]'), 'race links to saved progress');

    assert.deepEqual(errors, [], 'race has no page errors: ' + errors.slice(0, 2).join(' | '));
  } finally {
    await context.close();
  }
}

async function sciFiFlow(browser, base) {
  const { context, page, errors } = await openPage(browser, base, 390);
  try {
    await page.goto(base + '/workshops/sci-fi-runner-builder.html', { waitUntil: 'load', timeout: 30000 });
    if (await page.$('#cookie-decline')) await page.click('#cookie-decline');
    await page.waitForSelector('#stepsTabs .tab-btn');
    assert.equal(await page.$$eval('#stepsTabs .tab-btn', (els) => els.length), 10, 'sci-fi has 10 steps');
    assert.equal(await page.$eval('.step-nav .btn-next', (b) => b.disabled), true, 'sci-fi next locked before run');

    await page.click('#stepsTabs .tab-btn:nth-child(2)');
    await wait(80);
    assert.ok(/^1/.test(await page.$eval('#stepsTabs .tab-btn.active', (el) => el.textContent)), 'sci-fi blocks a forward tab jump');
    assert.ok(/finish Step 1/.test(await page.$eval('#liveStatus', (el) => el.textContent)), 'sci-fi explains the lock');

    const before = await page.$eval('#gc', (c) => c.toDataURL());
    await page.click('#runBtn');
    await wait(450);
    const after = await page.$eval('#gc', (c) => c.toDataURL());
    assert.notEqual(before, after, 'sci-fi canvas animates');
    assert.equal(await page.$eval('.step-nav .btn-next', (b) => b.disabled), false, 'sci-fi next unlocks after run');
    assert.ok(/Game running/.test(await page.$eval('#liveStatus', (el) => el.textContent)), 'sci-fi starts the game');

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await page.evaluate(() => {
      const b = document.querySelector('.mob-dpad-btn[data-key="ArrowLeft"]');
      b.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    });
    assert.ok(await page.$eval('.mob-dpad-btn[data-key="ArrowLeft"]', (el) => el.classList.contains('pressed')), 'sci-fi touch press');
    await page.evaluate(() => {
      const b = document.querySelector('.mob-dpad-btn[data-key="ArrowLeft"]');
      b.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
    });

    for (let i = 0; i < 9; i++) {
      await page.click('#runBtn');
      await wait(80);
      await page.click('.step-nav .btn-next');
      await wait(80);
    }
    assert.ok(/Your Finished Runner/.test(await page.$eval('#stepBody', (el) => el.textContent)), 'sci-fi reaches the final step');
    await page.click('.run-btn[data-action="onRun"]');
    await wait(120);
    assert.equal(await page.$$eval('#sumGrid > div', (els) => els.length), 8, 'sci-fi lists all eight final settings');

    await page.waitForSelector('#bq-q-0');
    const correct = await page.evaluate(() => window.BQ.quiz[0].a);
    const wrong = (correct + 1) % 4;
    await page.click('#bq-q-0 .bq-opt[data-i="' + wrong + '"]');
    await page.click('#bq-q-0 .bq-check');
    assert.ok(/Not quite/.test(await page.$eval('#bq-q-0 .bq-fb', (el) => el.textContent)), 'sci-fi rejects a wrong quiz answer');
    await page.click('#bq-q-0 .bq-opt[data-i="' + correct + '"]');
    await page.click('#bq-q-0 .bq-check');
    assert.ok(/Correct/.test(await page.$eval('#bq-q-0 .bq-fb', (el) => el.textContent)), 'sci-fi accepts the right quiz answer');
    assert.ok(await page.$eval('#bq-q-0', (el) => el.classList.contains('passed')), 'sci-fi marks the quiz passed');
    const xp = parseInt(await page.$eval('#bqChipXp', (el) => el.textContent), 10) || 0;
    assert.ok(xp > 0, 'sci-fi awards XP');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#bq-q-0');
    assert.ok(await page.$eval('#bq-q-0', (el) => el.classList.contains('passed')), 'sci-fi restores the quiz after reload');
    assert.ok((parseInt(await page.$eval('#bqChipXp', (el) => el.textContent), 10) || 0) >= xp, 'sci-fi restores XP');
    assert.ok(/Write them down|screenshot/i.test(await page.$eval('body', (el) => el.textContent)), 'sci-fi explains how to keep the game');

    assert.deepEqual(errors, [], 'sci-fi has no page errors: ' + errors.slice(0, 2).join(' | '));
  } finally {
    await context.close();
  }
}

async function lightCheck(browser, base, url) {
  const { context, page, errors } = await openPage(browser, base, 1440);
  try {
    const res = await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
    assert.equal(res && res.status(), 200, url + ' returns 200');
    assert.ok(await page.$eval('body', (el) => el.textContent.length > 500), url + ' renders content');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, url + ' has no horizontal overflow, got ' + overflow);
    assert.deepEqual(errors, [], url + ' has no page errors: ' + errors.slice(0, 2).join(' | '));
  } finally {
    await context.close();
  }
}

(async () => {
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, clean);
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
    await raceFlow(browser, base);
    await sciFiFlow(browser, base);
    await lightCheck(browser, base, '/workshops/race-builder.html');
    await lightCheck(browser, base, '/workshops/sci-fi-runner-builder.html');
    console.log('PASS js-browser-games-e2e: both workshops run, gate skipping, grade answers, play, save and restore');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL js-browser-games-e2e: ' + error.message + '\n' + (error.stack || ''));
  process.exit(1);
});
