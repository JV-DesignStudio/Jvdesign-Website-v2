// workshop-answers-smoke.js - guards reviewed answers and saved completion on
// the canvas build-along workshops (A1707).
//
// These pages were migrated from the old .step-card / .quiz-gate markup to the
// shared canvas engine (CW_CONFIG + CW.checkStep / checkQuiz / checkFills). The
// fixtures here were re-baselined to the engine and freeze the reviewed answers
// (step count, quiz correct index per step, fill answers per step) so an answer
// can never silently change. For every page we also prove wrong answers are
// rejected, right answers are accepted, and completion is written to the ledger
// and restored on reload.
//
// Run: node tests/workshop-answers-smoke.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const fixtures = require('./workshop-answer-fixtures.json');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    fs.readFile(file, (error, data) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? '' : data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const base = `http://127.0.0.1:${server.address().port}`;
    let steps = 0, quizzes = 0, fills = 0;
    for (const [name, expected] of Object.entries(fixtures)) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width: 390, height: 844 });
      await page.setRequestInterception(true);
      page.on('request', req => req.url().startsWith(base) || req.url().startsWith('data:') ? req.continue() : req.abort());
      await page.goto(base + '/workshops/' + name + '-workshop.html', { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 8000 });

      const count = () => page.evaluate(() => (document.getElementById('progressCount') || {}).textContent || '');
      const storageKey = await page.evaluate(() => window.CW_CONFIG.storageKey);

      const config = await page.evaluate(() => window.CW_CONFIG.steps.map(s => ({
        num: s.num,
        quiz: s.quiz ? s.quiz.correct : null,
        quizOptions: s.quiz ? s.quiz.options.length : 0,
        fills: (s.fills && s.fills.answers) ? s.fills.answers.slice() : []
      })));
      assert.equal(config.length, expected.steps, name + ': frozen step count');
      assert.deepEqual(config.map(s => s.quiz), expected.quiz, name + ': frozen quiz answers');
      assert.deepEqual(config.map(s => s.fills), expected.fills, name + ': frozen fill answers');

      for (const step of config) {
        // Fills: a wrong value must be rejected, the reviewed value accepted.
        if (step.fills.length) {
          const wrongFills = await page.evaluate(({ num, n }) => {
            for (let i = 0; i < n; i++) document.getElementById('fill-' + num + '-' + i).value = '__wrong__';
            window.CW.checkFills(num);
            let bad = 0;
            for (let i = 0; i < n; i++) if (document.getElementById('fill-' + num + '-' + i).classList.contains('wrong')) bad++;
            return bad;
          }, { num: step.num, n: step.fills.length });
          assert.equal(wrongFills, step.fills.length, `${name} step ${step.num}: wrong fills accepted`);
          const goodFills = await page.evaluate(({ num, answers }) => {
            answers.forEach((a, i) => { document.getElementById('fill-' + num + '-' + i).value = a; });
            window.CW.checkFills(num);
            let good = 0;
            answers.forEach((a, i) => { if (document.getElementById('fill-' + num + '-' + i).classList.contains('correct')) good++; });
            return good;
          }, { num: step.num, answers: step.fills });
          assert.equal(goodFills, step.fills.length, `${name} step ${step.num}: reviewed fills rejected`);
          fills += step.fills.length;
        }

        const before = await count();
        // Wrong code must not complete the step.
        const wrongRejected = await page.evaluate((num) => {
          const ta = document.getElementById('editor-' + num);
          ta.disabled = false; ta.readOnly = false;
          ta.value = 'zzz_not_the_solution_zzz';
          window.CW.checkStep(num);
          const fb = document.getElementById('feedback-' + num);
          return fb && fb.classList.contains('error');
        }, step.num);
        assert.ok(wrongRejected, `${name} step ${step.num}: wrong code accepted`);
        assert.equal(await count(), before, `${name} step ${step.num}: wrong code completed the step`);

        // Reviewed question: wrong option rejected, correct option accepted.
        if (step.quiz !== null) {
          const wrongQuiz = await page.evaluate((num) => {
            const o = document.getElementById('quiz-opts-' + num);
            const els = o.querySelectorAll('.cw-quiz-opt');
            const wrong = (window.CW_CONFIG.steps.find(s => s.num === num).quiz.correct + 1) % els.length;
            els[wrong].click();
            window.CW.checkQuiz(num);
            const fb = document.getElementById('quiz-fb-' + num);
            return fb && fb.classList.contains('fail');
          }, step.num);
          assert.ok(wrongQuiz, `${name} step ${step.num}: wrong quiz option accepted`);
        }

        // Correct code (and correct quiz) completes the step and advances.
        const completed = await page.evaluate((num) => {
          const step = window.CW_CONFIG.steps.find(s => s.num === num);
          const ta = document.getElementById('editor-' + num);
          ta.disabled = false; ta.readOnly = false;
          ta.value = step.solution;
          window.CW.checkStep(num);
          if (step.quiz) {
            const o = document.getElementById('quiz-opts-' + num);
            o.querySelectorAll('.cw-quiz-opt')[step.quiz.correct].click();
            window.CW.checkQuiz(num);
          }
          return true;
        }, step.num);
        assert.ok(completed);
        assert.equal(await count(), String(Number(before.split(' ')[0]) + 1) + ' / ' + config.length + ' steps',
          `${name} step ${step.num}: step did not advance`);
        if (step.quiz !== null) quizzes++;
      }

      // Completion ledger is written and survives a reload.
      const ledger = await page.evaluate((key) => JSON.parse(localStorage.getItem(key + ':ledger') || 'null'), storageKey);
      assert.ok(ledger && Array.isArray(ledger.completed) && ledger.completed.length === config.length,
        name + ': completion not saved');
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW, { timeout: 8000 });
      const restored = await page.evaluate((key) => {
        const l = JSON.parse(localStorage.getItem(key + ':ledger') || 'null');
        return {
          completed: document.querySelectorAll('.cw-step.cw-done, .cw-step.done').length,
          ledger: l && l.completed ? l.completed.length : 0,
          text: (document.getElementById('cwProgressText') || {}).textContent || (document.getElementById('progressCount') || {}).textContent || ''
        };
      }, storageKey);
      assert.equal(restored.ledger, config.length, name + ': ledger not restored on reload');
      assert.match(restored.text, /Complete|complete|\/ *\d+ *steps/, name + ': progress not restored');
      assert.deepEqual(errors, [], name + ': browser errors');
      steps += config.length;
      console.log(`PASS ${name}: ${config.length} steps, wrong/right code, quiz and fills, completion saved`);
      await page.close();
    }
    console.log(`PASS: ${Object.keys(fixtures).length} workshops, ${steps} steps and ${quizzes} quizzes and ${fills} fills`);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
