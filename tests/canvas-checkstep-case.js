// canvas-checkstep-case.js - regression guard for the canvas workshop "Apply to Canvas" gate.
//
// Learner-facing bug (A1350): workshop-canvas-engine.js checkStep() lowercased the
// editor code but compared it against the raw checks, so any check containing an
// uppercase letter (KeyPressed, onGround, ShowDialog, ...) could never match. On the
// gdevelop canvas pages, Show Solution filled the code yet Apply to Canvas always
// answered "Almost!". A few steps also listed a check keyword that was not in the
// step solution at all (isboss, gameover, bomb).
//
// This test loads every workshops/*-canvas.html page, drops each step's own solution
// into its editor and runs CW.checkStep(). A correct engine never answers "Almost!".
//
// Run: node tests/canvas-checkstep-case.js
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

(async () => {
  const files = fs.readdirSync(path.join(root, 'workshops')).filter((f) => /-canvas\.html$/.test(f)).sort();
  let failures = 0;
  const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };

  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    for (const file of files) {
      await page.goto(base + '/workshops/' + file, { waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
      const bad = await page.evaluate(() => {
        const out = [];
        window.CW_CONFIG.steps.forEach((step) => {
          const ta = document.getElementById('editor-' + step.num);
          if (!ta) { out.push(step.num + ':no-editor'); return; }
          ta.disabled = false;
          ta.readOnly = false;
          ta.value = step.solution;
          window.CW.checkStep(step.num);
          const fb = document.getElementById('feedback-' + step.num);
          const text = fb ? fb.textContent : '';
          if (/Almost!/.test(text)) out.push(step.num + ':' + text.replace('Almost! ', ''));
        });
        return out;
      });
      check(file + ' accepts its own solution', bad.length === 0, bad.join(' | '));
    }

    // The original report was gdevelop step 2 (KeyPressed, Left, Right) and the
    // mixed-case steps. Guard case-insensitivity directly with a typo case: a learner
    // who types the token in the wrong case must still pass.
    await page.goto(base + '/workshops/gdevelop-platformer-canvas.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG, { timeout: 8000 });
    const lowerOK = await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find((s) => s.num === 2);
      const ta = document.getElementById('editor-2');
      ta.disabled = false; ta.readOnly = false;
      ta.value = step.solution.toLowerCase();
      window.CW.checkStep(2);
      const fb = document.getElementById('feedback-2');
      return fb && !/Almost!/.test(fb.textContent);
    });
    check('mixed-case checks match whatever case the learner types', lowerOK);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: canvas Apply gate accepts every step solution (' + files.length + ' pages)');
})().catch((e) => { console.error(e); process.exit(1); });
