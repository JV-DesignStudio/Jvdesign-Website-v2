// workshop-canvas-hints.js - A2271 regression guard.
//
// Canvas build-alongs can declare three hint tiers per step (nudge, concept,
// next line). They unlock one at a time, reset per step, and a step with fewer
// than three tiers never shows an empty button. Legacy flat-string hints keep
// rendering as they always did.
//
// Run: node tests/workshop-canvas-hints.js
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

(async () => {
  let failures = 0;
  const check = (name, ok, detail = '') => {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
    if (!ok) failures++;
  };

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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    const hintState = () => page.evaluate(() => {
      const box = document.getElementById('canvasHint');
      const btn = box && box.querySelector('[data-cw="revealHint"]');
      return {
        lines: box ? Array.from(box.querySelectorAll('.cw-hint-tier')).map((n) => n.textContent) : [],
        button: btn ? btn.textContent : null
      };
    });
    // The build panel is display:none until the design step, so fire the
    // button's click directly instead of waiting for a pointer hit test.
    const reveal = () => page.evaluate(() => {
      const btn = document.querySelector('#canvasHint [data-cw="revealHint"]');
      if (btn) btn.click();
    });

    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'x' + vp.height;
      await page.setViewport(vp);
      await page.goto(base + '/workshops/js-snake-canvas.html', { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });

      const expected = await page.evaluate(() => window.CW_CONFIG.hints[0]);
      const start = await hintState();
      check(tag + ' step 1 starts collapsed with a nudge button',
        start.lines.length === 0 && /nudge/i.test(start.button || ''), JSON.stringify(start));

      await reveal();
      const first = await hintState();
      check(tag + ' first tier reveals the nudge',
        first.lines.length === 1 && first.lines[0] === expected.nudge && /idea/i.test(first.button || ''),
        JSON.stringify(first));

      await reveal();
      const second = await hintState();
      check(tag + ' second tier reveals the concept',
        second.lines.length === 2 && second.lines[1] === expected.concept && /next line/i.test(second.button || ''),
        JSON.stringify(second));

      await reveal();
      const third = await hintState();
      check(tag + ' third tier reveals the next line and hides the button',
        third.lines.length === 3 && third.lines[2] === expected.next && third.button === null,
        JSON.stringify(third));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' hint box does not overflow', overflow);
    }

    // Returning to a step starts its hints collapsed again, and the next step
    // uses its own tiers rather than carrying the revealed count.
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluate(() => localStorage.setItem('jvds-js-snake-canvas', JSON.stringify({ currentStep: 1 })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG, { timeout: 8000 });
    const stepTwo = await hintState();
    check('moving to step 2 resets the hints', stepTwo.lines.length === 0 && /nudge/i.test(stepTwo.button || ''),
      JSON.stringify(stepTwo));

    // A step with only two tiers must not show an empty third button.
    await page.goto(base + '/workshops/js-memory-canvas.html', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('jvds-js-memory-canvas', JSON.stringify({ currentStep: 2 })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    const memStart = await hintState();
    check('two-tier step starts collapsed', memStart.lines.length === 0 && !!memStart.button, JSON.stringify(memStart));
    await reveal();
    await reveal();
    const memDone = await hintState();
    const memExpected = await page.evaluate(() => window.CW_CONFIG.hints[2]);
    check('two-tier step ends with no empty third button',
      memDone.lines.length === 2 && memDone.lines[0] === memExpected.nudge &&
      memDone.lines[1] === memExpected.next && memDone.button === null, JSON.stringify(memDone));

    // Unconverted flat-string configs still render their single hint.
    await page.goto(base + '/workshops/cpp-pong-canvas.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG, { timeout: 8000 });
    const legacy = await page.evaluate(() => ({
      text: (document.getElementById('canvasHint') || {}).textContent || '',
      button: !!document.querySelector('#canvasHint [data-cw="revealHint"]'),
      expected: window.CW_CONFIG.hints[0]
    }));
    check('legacy string hint still renders with no button',
      legacy.text === legacy.expected && !legacy.button, JSON.stringify(legacy));

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: three-tier hints unlock in order, reset per step, and keep legacy hints');
})().catch((e) => { console.error(e); process.exit(1); });
