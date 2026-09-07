const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
// Reviewed against the lesson examples. These expected answers are independent
// of the encoded page keys; reading keys to solve a quiz would miss wrong keys.
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
    let steps = 0, blanks = 0;
    for (const [name, answers] of Object.entries(fixtures)) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width: 390, height: 844 });
      await page.setRequestInterception(true);
      page.on('request', req => req.url().startsWith(base) || req.url().startsWith('data:') ? req.continue() : req.abort());
      await page.goto(base + '/workshops/' + name + '-workshop.html', { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      const result = await page.evaluate(answers => {
        const check = (value, message) => { if (!value) throw Error(message); };
        const click = el => {
          check(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden', 'Control is not visible');
          check(!el.disabled, 'Control is disabled'); el.click();
        };
        let b = 0;
        const cards = [...document.querySelectorAll('.step-card')];
        check(cards.length === answers.quiz.length, 'Unexpected step count');
        for (const [i, card] of cards.entries()) {
          check(!card.classList.contains('locked'), `Step ${i + 1} still locked`);
          for (const wrap of card.querySelectorAll('.code-challenge,.concept-fill')) {
            const inputs = [...wrap.querySelectorAll('.cc-blank,.cf-blank')];
            const button = wrap.querySelector('.cc-check-btn,.cf-check-btn');
            for (const input of inputs) input.value = '__incorrect_answer__';
            click(button);
            check(!wrap.classList.contains('passed'), 'Wrong blank accepted');
            for (const input of inputs) input.value = answers.blanks[b++];
            click(button);
            check(wrap.classList.contains('passed'), `Step ${i+1}: reviewed blanks rejected`);
          }
          const gate = card.querySelector('.quiz-gate');
          const correct = answers.quiz[i];
          click(gate.querySelector(`.quiz-opt[data-idx="${(correct + 1) % 3}"]`));
          click(gate.querySelector('.quiz-submit'));
          check(!gate.classList.contains('passed'), `Step ${i+1}: wrong choice accepted`);
          click(gate.querySelector(`.quiz-opt[data-idx="${correct}"]`));
          click(gate.querySelector('.quiz-submit'));
          check(gate.classList.contains('passed'), `Step ${i+1}: reviewed quiz answer rejected`);
          click(gate.querySelector('.quiz-next-btn'));
          check(card.classList.contains('completed'), `Step ${i+1}: next button did not complete step`);
        }
        check(b === answers.blanks.length, 'Unexpected blank count');
        check(document.getElementById('finishBanner').classList.contains('show'), 'Finish banner missing');
        const key = window.WORKSHOP_KEY || (typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : null);
        check(key, 'Storage key missing');
        const saved = JSON.parse(localStorage.getItem(key));
        check(saved.completed.length === cards.length, 'Completion not saved');
        return { key, saved, blanks: b, steps: cards.length };
      }, answers);
      await page.reload({ waitUntil: 'load' });
      const restored = await page.evaluate(key => ({ saved: JSON.parse(localStorage.getItem(key)), completed: document.querySelectorAll('.step-card.completed').length, finished: document.getElementById('finishBanner').classList.contains('show') }), result.key);
      assert.deepEqual(restored.saved.completed, result.saved.completed, name + ': saved steps changed');
      assert.equal(restored.saved.xp, result.saved.xp, name + ': XP changed on reload');
      assert.equal(restored.completed, result.steps, name + ': steps not restored');
      assert.ok(restored.finished, name + ': finish banner not restored');
      assert.deepEqual(errors, [], name + ': browser errors');
      steps += result.steps; blanks += result.blanks;
      console.log(`PASS ${name}: ${result.steps} steps, correct/wrong answers, completion and reload`);
      await page.close();
    }
    console.log(`PASS: 12 workshops, ${steps} quizzes and ${blanks} blanks`);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
