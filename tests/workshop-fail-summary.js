#!/usr/bin/env node
/**
 * tests/workshop-fail-summary.js
 * A2301: failed tries are counted per step, My Progress shows the worst steps,
 * and scripts/stuck-summary.js aggregates an exported file.
 *
 * Run: node tests/workshop-fail-summary.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function staticChecks() {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'stuck-summary.js')), 'stuck-summary script exists');
  const progress = fs.readFileSync(path.join(ROOT, 'workshops', 'my-progress.html'), 'utf8');
  assert.ok(/id="failSummary"/.test(progress), 'my-progress has the fail summary section');
  assert.ok(/id="stuckExport"/.test(progress), 'my-progress has the export button');
  const report = fs.readFileSync(path.join(ROOT, 'workshops', 'stuck-report.js'), 'utf8');
  assert.ok(/jvds_step_fails/.test(report), 'stuck-report reads the fail counts');
  console.log('PASS static: fail summary markup, tracker key and dev script are present');
}

function scriptCheck() {
  const tmp = path.join(os.tmpdir(), 'jvds-stuck-summary-' + process.pid + '.json');
  fs.writeFileSync(tmp, JSON.stringify({
    exportedAt: '2026-11-06T00:00:00.000Z',
    reports: [{ workshop: 'js-flappy-workshop.html', step: 1, note: 'Canvas stays blank' }],
    fails: [
      { workshop: 'js-flappy-workshop.html', step: 1, title: 'Draw the bird', source: 'apply', count: 3 },
      { workshop: 'python-catch-workshop.html', step: 2, title: 'Move the basket', source: 'quiz', count: 1 },
    ],
  }));
  try {
    const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'stuck-summary.js'), tmp], { encoding: 'utf8' });
    assert.equal(run.status, 0, 'stuck-summary should exit 0');
    assert.ok(/failed tries: 4/.test(run.stdout), 'summary counts every failed try: ' + run.stdout);
    assert.ok(/js flappy workshop step 1 \(Draw the bird\)/.test(run.stdout), 'summary names the worst step');
    assert.ok(/Reported broken steps/.test(run.stdout), 'summary includes learner reports');
    console.log('PASS script: stuck-summary aggregates counts and reports');
  } finally {
    fs.unlinkSync(tmp);
  }
}

async function browserChecks() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());

    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'x' + vp.height;
      await page.setViewport(vp);
      await page.goto(base + '/workshops/js-flappy-workshop.html', { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });

      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          const editor = document.getElementById('editor-1');
          if (editor) editor.value = '';
          const btn = document.querySelector('#card-1 [data-cw="checkStep"]');
          if (btn) btn.click();
        });
      }
      const fails = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('jvds_step_fails') || '[]'); } catch (e) { return []; }
      });
      const row = fails.find((f) => f.workshop === 'js-flappy-workshop.html' && String(f.step) === '1');
      assert.ok(row, 'fail count recorded for step 1');
      assert.equal(row.count, 3, 'three failed tries recorded, got ' + (row && row.count));

      await page.goto(base + '/workshops/my-progress.html', { waitUntil: 'load' });
      await page.waitForFunction(() => {
        const s = document.getElementById('failSummary');
        return s && s.style.display !== 'none';
      }, { timeout: 8000 });
      const panel = await page.evaluate(() => {
        const s = document.getElementById('failSummary');
        return { visible: s && s.style.display !== 'none', text: s ? s.textContent : '' };
      });
      assert.ok(panel.visible, tag + ' fail summary is visible');
      assert.ok(/js flappy workshop/.test(panel.text), tag + ' panel names the workshop');
      assert.ok(/3 tries/.test(panel.text), tag + ' panel shows the try count');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      assert.ok(overflow, tag + ' my-progress has no horizontal overflow');
    }
    console.log('PASS browser: 3 failed tries recorded, My Progress lists the worst step, 1440/390 clean');

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/workshops/minecraft-world-ep1-setup.html', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#quiz-1 .quiz-opt');
    await page.click('#quiz-1 .quiz-opt[data-idx="1"]');
    await page.click('#quiz-1 .quiz-submit');
    await new Promise((r) => setTimeout(r, 120));
    const engineFails = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('jvds_step_fails') || '[]'); } catch (e) { return []; }
    });
    const engineRow = engineFails.find((f) => f.workshop === 'minecraft-world-ep1-setup.html' && f.step === 'quiz-1');
    assert.ok(engineRow, 'engine quiz records a failed try');
    assert.equal(engineRow.count, 1, 'engine quiz count is 1');
    console.log('PASS engine: a wrong knowledge check is counted as a failed try');
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  staticChecks();
  scriptCheck();
  await browserChecks();
})().catch((e) => {
  console.error('FAIL tests/workshop-fail-summary.js');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
