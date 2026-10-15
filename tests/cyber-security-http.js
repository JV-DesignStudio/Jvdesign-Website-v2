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

    const extra = await page.evaluate(() => ({
      delegates: [...document.querySelectorAll('script[src]')].filter(s => /ui-delegate\.js/.test(s.getAttribute('src'))).map(s => s.getAttribute('src')),
      keyPoints: [...document.querySelectorAll('.step-card')].filter(c => /Key point:/.test(c.textContent)).length
    }));
    check('has a relative ui-delegate fallback (works when opened as a file)', extra.delegates.some(s => s.startsWith('..')), extra.delegates.join(', '));
    check('every step has a key-point note', extra.keyPoints === STEPS, 'key points ' + extra.keyPoints);

    const notes = await page.evaluate(() => {
      const btn = document.querySelector('.cyber-notes-btn');
      const panel = document.querySelector('.cyber-notes-panel');
      const stepBtns = document.querySelectorAll('.cyber-step-note-btn').length;
      if (!btn || !panel) return { hasBtn: !!btn, hasPanel: !!panel, stepBtns };
      btn.click();
      const opened = panel.classList.contains('open');
      const ta = document.getElementById('cyber-note-1');
      ta.value = 'Phishing is the most common way in.';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem('jvds-cyber-security-v2_notes') || '{}'); } catch (e) {}
      const count = document.querySelector('.cyber-notes-count').textContent;
      panel.querySelector('.cyber-notes-close').click();
      return { hasBtn: true, hasPanel: true, opened, stepBtns, stored1: stored['1'], count };
    });
    check('notebook opens and saves per-step notes', notes.opened && notes.stored1 === 'Phishing is the most common way in.' && notes.count === '1', JSON.stringify(notes));
    check('every step header has a notes button', notes.stepBtns === STEPS, 'step note buttons ' + notes.stepBtns);

    const phish = await page.evaluate(() => {
      const game = document.getElementById('phish-game');
      if (!game) return { exists: false };
      game.querySelectorAll('.phish-line[data-flag="1"]').forEach(l => l.click());
      game.querySelector('.phish-check').click();
      return { exists: true, good: game.querySelector('.phish-feedback').classList.contains('good') };
    });
    check('spot the phish accepts the correct red flags', phish.exists && phish.good, JSON.stringify(phish));

    const widgets = await page.evaluate(() => {
      const out = {};
      const flip = document.querySelector('.cyber-flip');
      out.flips = document.querySelectorAll('.cyber-flip').length;
      if (flip) { flip.click(); out.flipFlipped = flip.classList.contains('flipped'); }
      const picks = Array.prototype.slice.call(document.querySelectorAll('.cyber-pick'));
      out.picks = picks.length;
      out.picksGood = picks.every(function (g) {
        var correct = (g.dataset.correct || '').split(',').map(Number);
        Array.prototype.forEach.call(g.querySelectorAll('.cyber-pick-item'), function (it, i) { if (correct.indexOf(i) !== -1) it.click(); });
        g.querySelector('.cyber-check').click();
        return g.querySelector('.cyber-feedback').classList.contains('good');
      });
      const tfs = Array.prototype.slice.call(document.querySelectorAll('.cyber-tf'));
      out.tfs = tfs.length;
      out.tfsGood = tfs.every(function (g) {
        Array.prototype.forEach.call(g.querySelectorAll('.cyber-tf-item'), function (item) {
          var ans = item.getAttribute('data-answer');
          item.querySelector('.cyber-tf-btns button[data-val="' + ans + '"]').click();
        });
        g.querySelector('.cyber-check').click();
        return g.querySelector('.cyber-feedback').classList.contains('good');
      });
      return out;
    });
    check('flip cards toggle', widgets.flips >= 2 && widgets.flipFlipped, JSON.stringify(widgets));
    check('tap-all-that-apply widgets accept the right picks', widgets.picks >= 2 && widgets.picksGood, 'picks ' + widgets.picks);
    check('true/false widget accepts the right answers', widgets.tfs >= 1 && widgets.tfsGood, 'tf ' + widgets.tfs);

    // Regression: two wrong attempts trigger the enhancements "cross out an option"
    // hint, which reads data-k. With only data-correct the correct index parsed as
    // NaN and the hint could disable the CORRECT option, locking the question.
    await page.evaluate(() => {
      const gate = document.getElementById('quiz-1');
      const correct = parseInt(gate.dataset.correct, 10);
      const opts = [...gate.querySelectorAll('.quiz-opt')];
      const wrongIdx = opts.map(o => +o.dataset.idx).find(i => i !== correct);
      for (let i = 0; i < 2; i++) {
        opts.find(o => +o.dataset.idx === wrongIdx).click();
        gate.querySelector('.quiz-submit').click();
      }
    });
    await new Promise(r => setTimeout(r, 200));
    const locked = await page.evaluate(() => {
      const gate = document.getElementById('quiz-1');
      const correct = parseInt(gate.dataset.correct, 10);
      const correctOpt = [...gate.querySelectorAll('.quiz-opt')].find(o => +o.dataset.idx === correct);
      return { correctDisabled: correctOpt.classList.contains('disabled'), passed: gate.classList.contains('passed') };
    });
    check('two wrong tries do not disable the correct option', !locked.correctDisabled && !locked.passed, JSON.stringify(locked));

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
