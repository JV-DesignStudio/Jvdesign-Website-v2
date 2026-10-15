#!/usr/bin/env node
// tests/cyber-security-http.js
// Smoke test for the Cyber Defender workshop (workshops/cyber-security.html):
// the page renders 11 steps with one active step, every step has a quiz gate,
// answering every quiz correctly completes the workshop and saves progress that
// survives a reload, and the layout holds at 1440, 390 and 320px with no runtime
// errors.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = '/workshops/cyber-security.html';
const STEPS = 11;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.resolve(ROOT, '.' + u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  let failures = 0;
  const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + PAGE, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.completeStep === 'function', { timeout: 8000 });

    const info = await page.evaluate(() => ({
      steps: document.querySelectorAll('.step-card').length,
      active: document.querySelectorAll('.step-card.active-step').length,
      quizzes: document.querySelectorAll('.quiz-gate').length,
      nextBtns: document.querySelectorAll('.quiz-gate .quiz-next-btn').length,
      key: window.WORKSHOP_KEY,
      total: window.WORKSHOP_TOTAL,
      progress: (document.getElementById('progressCount') || {}).textContent || '',
      scrollWidth: document.documentElement.scrollWidth
    }));
    check('renders ' + STEPS + ' steps', info.steps === STEPS, 'steps ' + info.steps);
    check('one active step', info.active === 1, 'active ' + info.active);
    check('every step has a quiz gate', info.quizzes === STEPS, 'quizzes ' + info.quizzes);
    check('every quiz has a next button', info.nextBtns === STEPS, 'buttons ' + info.nextBtns);
    check('workshop key + total come from the body attributes', info.key === 'jvds-cyber-security-v2' && info.total === STEPS, info.key + ' / ' + info.total);
    check('progress starts at 0 / ' + STEPS, new RegExp('^0 / ' + STEPS).test(info.progress), info.progress);
    check('desktop no overflow', info.scrollWidth <= 1442, info.scrollWidth + '');

    for (let n = 1; n <= STEPS; n++) {
      const ok = await page.evaluate((step) => {
        const card = document.getElementById('step-' + step);
        if (!card || card.classList.contains('locked')) return false;
        const gate = card.querySelector('.quiz-gate');
        const correct = parseInt(gate.dataset.correct, 10);
        gate.querySelector('.quiz-opt[data-idx="' + correct + '"]').click();
        gate.querySelector('.quiz-submit').click();
        if (!gate.classList.contains('passed')) return false;
        gate.querySelector('.quiz-next-btn').click();
        return true;
      }, n);
      check('step ' + n + ' answered and completed', ok);
      await new Promise(r => setTimeout(r, 120));
    }

    const after = await page.evaluate(() => ({
      progress: document.getElementById('progressCount').textContent,
      finished: document.getElementById('finishBanner').classList.contains('show'),
      saved: JSON.parse(localStorage.getItem('jvds-cyber-security-v2') || 'null')
    }));
    check('progress reads ' + STEPS + ' / ' + STEPS, new RegExp('^' + STEPS + ' / ' + STEPS).test(after.progress), after.progress);
    check('finish banner shown', after.finished);
    check('completion saved to localStorage', !!(after.saved && after.saved.completed && after.saved.completed.length === STEPS), after.saved ? 'completed ' + after.saved.completed.length : 'no data');

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.completeStep === 'function', { timeout: 8000 });
    const restored = await page.evaluate(() => ({
      completed: document.querySelectorAll('.step-card.completed').length,
      finished: document.getElementById('finishBanner').classList.contains('show')
    }));
    check('progress restored on reload', restored.completed === STEPS && restored.finished, restored.completed + ' steps');

    for (const width of [390, 320]) {
      await page.setViewport({ width, height: 844, isMobile: true });
      await page.goto(base + PAGE, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof window.completeStep === 'function', { timeout: 8000 });
      const over = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }));
      check('no overflow at ' + width + 'px', over.scrollWidth <= over.innerWidth + 2, over.scrollWidth + ' vs viewport ' + over.innerWidth);
    }

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: ' + PAGE + ' (11 steps, quizzes, completion, reload, responsive)');
})().catch(e => { console.error(e); process.exit(1); });
