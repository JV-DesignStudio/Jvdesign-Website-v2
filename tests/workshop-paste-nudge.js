#!/usr/bin/env node
// tests/workshop-paste-nudge.js (A2292)
// Proves a big paste asks one short question, without blocking the editor:
//   1. a large paste shows the what-does-this-line-do question,
//   2. the pasted code is kept and the step is not marked done,
//   3. a too-short answer keeps the nudge gently,
//   4. answering lets the normal check continue,
//   5. small pastes and typing never trigger it,
//   6. Reset clears a pending question.
// Run: node tests/workshop-paste-nudge.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const PAGE = 'workshops/gdevelop-platformer-canvas.html';
const BIG_PASTE = [
  '// pasted example',
  'function demo() {',
  '  var value = 42;',
  '  var label = "hello world";',
  '  var items = [1, 2, 3, 4, 5];',
  '  items.forEach(function (item) { console.log(item); });',
  '  return value + label;',
  '}',
  'demo();'
].join('\n');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(base + '/' + PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 10000 });

    const num = await page.evaluate(() => {
      const ta = document.querySelector('.cw-editor:not([disabled]):not([readonly])') || document.querySelector('.cw-editor');
      return ta ? Number(ta.id.replace('editor-', '')) : null;
    });
    check('the first step editor is active', Number.isFinite(num), 'step ' + num);

    const pasted = await page.evaluate(({ n, text }) => {
      const ta = document.getElementById('editor-' + n);
      const ev = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
      ta.dispatchEvent(ev);
      ta.value = text;
      window.CW.checkStep(n);
      const fb = document.getElementById('feedback-' + n);
      return {
        nudge: !!document.getElementById('paste-answer-' + n),
        valueLength: ta.value.length,
        feedback: fb ? fb.textContent : ''
      };
    }, { n: num, text: BIG_PASTE });
    check('a large paste shows the question', pasted.nudge, JSON.stringify(pasted));
    check('the pasted code is kept', pasted.valueLength === BIG_PASTE.length, String(pasted.valueLength));
    check('the step is not marked done before the question', !/complete:/i.test(pasted.feedback), pasted.feedback);

    const shortAnswer = await page.evaluate((n) => {
      document.getElementById('paste-answer-' + n).value = 'idk';
      window.CW.answerPaste(n);
      const fb = document.getElementById('paste-fb-' + n);
      return { nudge: !!document.getElementById('paste-answer-' + n), message: fb ? fb.textContent : '' };
    }, num);
    check('a too-short answer keeps the nudge', shortAnswer.nudge && /few words/i.test(shortAnswer.message), JSON.stringify(shortAnswer));

    const answered = await page.evaluate((n) => {
      document.getElementById('paste-answer-' + n).value = 'It prints each item in the list.';
      window.CW.answerPaste(n);
      const fb = document.getElementById('feedback-' + n);
      return { nudge: !!document.getElementById('paste-answer-' + n), cls: fb ? fb.className : '', text: fb ? fb.textContent : '' };
    }, num);
    check('answering lets the normal check continue', !answered.nudge && !/cw-paste-nudge/.test(answered.cls), JSON.stringify(answered));

    const small = await page.evaluate((n) => {
      window.CW.resetStep(n);
      const ta = document.getElementById('editor-' + n);
      const ev = new Event('paste', { bubbles: true });
      Object.defineProperty(ev, 'clipboardData', { value: { getData: () => 'let x = 1;' } });
      ta.dispatchEvent(ev);
      ta.value = 'let x = 1;';
      window.CW.checkStep(n);
      return { nudge: !!document.getElementById('paste-answer-' + n) };
    }, num);
    check('a small paste never triggers the question', !small.nudge, JSON.stringify(small));

    const typing = await page.evaluate((n) => {
      window.CW.resetStep(n);
      const ta = document.getElementById('editor-' + n);
      ta.value = 'let y = 2;';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      window.CW.checkStep(n);
      return { nudge: !!document.getElementById('paste-answer-' + n) };
    }, num);
    check('typing never triggers the question', !typing.nudge, JSON.stringify(typing));

    const resetClears = await page.evaluate(({ n, text }) => {
      window.CW.resetStep(n);
      const ta = document.getElementById('editor-' + n);
      const ev = new Event('paste', { bubbles: true });
      Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
      ta.dispatchEvent(ev);
      ta.value = text;
      window.CW.checkStep(n);
      const before = !!document.getElementById('paste-answer-' + n);
      window.CW.resetStep(n);
      window.CW.checkStep(n);
      return { before, after: !!document.getElementById('paste-answer-' + n) };
    }, { n: num, text: BIG_PASTE });
    check('Reset clears a pending question', resetClears.before && !resetClears.after, JSON.stringify(resetClears));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nWORKSHOP PASTE NUDGE CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
