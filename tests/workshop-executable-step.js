// workshop-executable-step.js - A2264 guard: a step must prove behaviour, not
// just contain the right words.
//
// The canvas engine now accepts an optional step.test. When present, matching
// tokens are only a prefilter; the step completes only when the test runs in
// the sandboxed preview and reports pass. This test drives the js-snake
// build-along: a comment containing every token must fail, the reference
// solution must pass, and saved progress must still load. It also checks the
// same hook on checkCodeChallenge() in workshops/workshop-engine.js.
//
// Run: node tests/workshop-executable-step.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (error, data) => {
      res.writeHead(error ? 404 : 200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(error ? '' : data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', req => req.url().startsWith(base) || req.url().startsWith('data:') || req.url().startsWith('blob:')
      ? req.continue() : req.abort());
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/workshops/js-snake-canvas.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await page.evaluate(() => localStorage.clear());

    const tested = await page.evaluate(() => window.CW_CONFIG.steps.filter(s => s.test).map(s => s.num));
    assert.deepEqual(tested, [1, 2, 3, 4], 'js-snake steps 1-4 carry executable tests');

    // A comment can contain every token but does nothing. The old engine passed
    // it; the executable test must reject it.
    await page.evaluate(() => {
      const ta = document.getElementById('editor-1');
      ta.disabled = false; ta.readOnly = false;
      ta.value = '// unshift pop snake[0]\nvar cheat = 1;';
      window.CW.checkStep(1);
    });
    await page.waitForFunction(() => {
      const fb = document.getElementById('feedback-1');
      return fb && fb.classList.contains('error');
    }, { timeout: 8000 });
    const afterCheat = await page.evaluate(() => document.getElementById('progressCount').textContent);
    assert.ok(!/^1 \//.test(afterCheat), 'a token-only answer must not complete the step');
    console.log('PASS token-only answer is rejected by the executable test');

    // The reference solution does the right thing, so it passes and the quiz
    // gate still works.
    await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find(s => s.num === 1);
      const ta = document.getElementById('editor-1');
      ta.disabled = false; ta.readOnly = false;
      ta.value = step.solution;
      window.CW.checkStep(1);
    });
    await page.waitForFunction(() => {
      const fb = document.getElementById('feedback-1');
      return fb && /Code is correct/.test(fb.textContent);
    }, { timeout: 8000 });
    await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find(s => s.num === 1);
      window.CW.selectQuiz(1, step.quiz.correct);
      window.CW.checkQuiz(1);
    });
    await page.waitForFunction(() => /^1 \//.test(document.getElementById('progressCount').textContent), { timeout: 8000 });
    console.log('PASS reference solution passes the executable test and completes step 1');

    // Step 2 proves a reverse keypress is queued and rejected, not fatal.
    await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find(s => s.num === 2);
      const ta = document.getElementById('editor-2');
      ta.disabled = false; ta.readOnly = false;
      ta.value = step.solution;
      window.CW.checkStep(2);
    });
    await page.waitForFunction(() => {
      const fb = document.getElementById('feedback-2');
      return fb && /Code is correct/.test(fb.textContent);
    }, { timeout: 8000 });
    await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find(s => s.num === 2);
      window.CW.selectQuiz(2, step.quiz.correct);
      window.CW.checkQuiz(2);
    });
    await page.waitForFunction(() => /^2 \//.test(document.getElementById('progressCount').textContent), { timeout: 8000 });
    console.log('PASS reverse keypress test accepts the solution');

    // Step 3 proves food spawns off the snake and eating grows it.
    await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find(s => s.num === 3);
      const ta = document.getElementById('editor-3');
      ta.disabled = false; ta.readOnly = false;
      ta.value = step.solution;
      window.CW.checkStep(3);
    });
    await page.waitForFunction(() => {
      const fb = document.getElementById('feedback-3');
      return fb && /Code is correct/.test(fb.textContent);
    }, { timeout: 8000 });
    await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find(s => s.num === 3);
      window.CW.selectQuiz(3, step.quiz.correct);
      window.CW.checkQuiz(3);
    });
    await page.waitForFunction(() => /^3 \//.test(document.getElementById('progressCount').textContent), { timeout: 8000 });
    console.log('PASS food spawn and growth test accepts the solution');

    // Saved progress still loads after a reload.
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(base + '/workshops/js-snake-canvas.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW, { timeout: 8000 });
    const restored = await page.evaluate(() => document.getElementById('progressCount').textContent);
    assert.match(restored, /3 \//, 'saved progress should load at 390px');
    assert.deepEqual(errors, [], 'no browser errors at 390 and 1440');
    console.log('PASS saved progress loads at 390px with no page errors');

    // checkCodeChallenge(): matching blanks are not enough when a test is set.
    await page.goto(base + '/workshops/java-space-workshop.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.checkCodeChallenge === 'function', { timeout: 8000 });
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = '<div class="code-challenge" id="cc-a2264">' +
        '<div class="cc-code-area"><input class="cc-blank" data-answer="1" value="1"></div>' +
        '<button class="cc-check-btn">Check</button><div class="cc-feedback"></div><div class="cc-hint"></div></div>';
      document.body.appendChild(host);
      const challenge = document.getElementById('cc-a2264');
      challenge.setAttribute('data-test-code', 'var value = 0;');
      challenge.setAttribute('data-test', 'done(value===1,"the value did not reach the test");');
      window.checkCodeChallenge(challenge.querySelector('.cc-check-btn'));
    });
    await page.waitForFunction(() => {
      const fb = document.querySelector('#cc-a2264 .cc-feedback');
      return fb && fb.classList.contains('wrong');
    }, { timeout: 8000 });
    const ccFailed = await page.evaluate(() => !document.getElementById('cc-a2264').classList.contains('passed'));
    assert.ok(ccFailed, 'a matching blank with wrong behaviour must not pass');
    console.log('PASS checkCodeChallenge rejects matching blanks with wrong behaviour');

    await page.evaluate(() => {
      const challenge = document.getElementById('cc-a2264');
      challenge.setAttribute('data-test-code', 'var value = __BLANKS__[0];');
      challenge.setAttribute('data-test', 'done(value==="1","the value was not read");');
      window.checkCodeChallenge(challenge.querySelector('.cc-check-btn'));
    });
    await page.waitForFunction(() => document.getElementById('cc-a2264').classList.contains('passed'), { timeout: 8000 });
    console.log('PASS checkCodeChallenge accepts matching blanks with correct behaviour');

    assert.deepEqual(errors, [], 'no browser errors across both checks');
    console.log('\nPASS: executable step tests reject token-only answers and accept real solutions');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
