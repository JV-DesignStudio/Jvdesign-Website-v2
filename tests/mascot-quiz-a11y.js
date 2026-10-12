// mascot-quiz-a11y.js: the "Find your creative guide" dialog auto-opens on the
// home page, so keyboard and screen-reader learners must be able to use it:
// it is a real modal, focus moves inside, Tab is trapped, Escape closes it and
// the options/skip buttons work. Run: node tests/mascot-quiz-a11y.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 19310;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.avif': 'image/avif' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
function listen() { return new Promise(r => server.listen(port, r)); }
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('jvds_guide'); localStorage.clear(); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1600));

  const initial = await page.evaluate(() => {
    const bd = document.querySelector('.mascot-quiz-backdrop');
    const dlg = bd && bd.querySelector('[role="dialog"]');
    const active = document.activeElement;
    return {
      opened: !!bd,
      isDialog: !!dlg,
      ariaModal: dlg && dlg.getAttribute('aria-modal') === 'true',
      labelled: !!(dlg && dlg.getAttribute('aria-labelledby')),
      focusInside: !!(bd && active && bd.contains(active)),
      focusIsOption: !!(active && active.classList && active.classList.contains('mascot-quiz-opt')),
      progress: (document.querySelector('.mascot-quiz-progress') || {}).textContent || ''
    };
  });
  check('quiz dialog auto-opens on the home page', initial.opened);
  check('dialog exposes role=dialog + aria-modal', initial.isDialog && initial.ariaModal && initial.labelled);
  check('focus moves into the dialog on open', initial.focusInside, String(initial.focusInside));
  check('first option receives focus', initial.focusIsOption);
  check('progress is announced', /Question\s*1\s*of\s*3/i.test(initial.progress), initial.progress.trim());

  // Tab must stay inside the dialog (trap).
  let trapped = true, seen = new Set();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const bd = document.querySelector('.mascot-quiz-backdrop');
      return !!(bd && bd.contains(document.activeElement)) ? (document.activeElement.textContent || '').trim().slice(0, 24) : '__OUTSIDE__';
    });
    if (inside === '__OUTSIDE__') { trapped = false; break; }
    seen.add(inside);
  }
  check('Tab focus is trapped inside the dialog', trapped, [...seen].join(' | '));

  // Choosing an option advances the quiz.
  await page.click('.mascot-quiz-opt');
  const step2 = await page.evaluate(() => (document.getElementById('quizStep') || {}).textContent || '');
  check('choosing an option advances to question 2', step2 === '2', 'step=' + step2);

  // Escape closes it.
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 150));
  const afterEscape = await page.evaluate(() => !!document.querySelector('.mascot-quiz-backdrop'));
  check('Escape closes the dialog', !afterEscape);

  // Re-open and skip with the button.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} if (window.showGuideQuiz) window.showGuideQuiz(); });
  await new Promise(r => setTimeout(r, 150));
  const reopened = await page.evaluate(() => !!document.querySelector('.mascot-quiz-backdrop'));
  check('dialog can be reopened', reopened);
  await page.click('#quizSkip');
  await new Promise(r => setTimeout(r, 150));
  const afterSkip = await page.evaluate(() => !!document.querySelector('.mascot-quiz-backdrop'));
  check('Skip closes the dialog', !afterSkip);

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILED`); process.exit(1); }
  console.log('\nmascot-quiz-a11y: all checks passed');
})().catch(e => { console.error('harness error', e); process.exit(1); });
