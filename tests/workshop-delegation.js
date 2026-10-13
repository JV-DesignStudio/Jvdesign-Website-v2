#!/usr/bin/env node
// tests/workshop-delegation.js (A1506): proves the delegated data-on dispatcher
// drives the quiz/step widgets identically to the old inline onclick handlers.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const PAGE = process.env.WP_PAGE || '/workshops/defold-snake-workshop.html';

let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + PAGE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('.quiz-gate .quiz-opt', { timeout: 10000 });

    const quiz = await page.evaluate(() => {
      const gate = document.querySelector('.quiz-gate');
      const opt = gate.querySelector('.quiz-opt');
      opt.click();
      const submit = gate.querySelector('.quiz-submit');
      const submitShown = Boolean(submit && submit.classList.contains('show'));
      if (submit) submit.click();
      const fb = gate.querySelector('.quiz-feedback');
      return { submitShown, fb: fb ? fb.className : '', passed: gate.classList.contains('passed') };
    });
    ok('option select runs selectQuizOpt (submit shows)', quiz.submitShown, JSON.stringify(quiz));
    ok('submit runs checkQuiz (feedback shown)', /correct|wrong/.test(quiz.fb) || quiz.passed, JSON.stringify(quiz));

    const step = await page.evaluate(() => {
      const hd = document.querySelector('.step-card:not(.locked) .step-header') || document.querySelector('.step-header');
      const card = hd.closest('.step-card');
      const before = card.classList.contains('open');
      hd.click();
      const after = card.classList.contains('open');
      return { before, after };
    });
    ok('step header toggles through the delegated handler', step.before !== step.after, JSON.stringify(step));

    ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nworkshop delegation: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
