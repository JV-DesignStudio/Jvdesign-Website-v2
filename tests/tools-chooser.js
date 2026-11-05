/* Which-tool chooser check (A2315).

   pages/dev-tools.html carries a skippable three-question chooser that
   recommends one tool with a first step and a start link. It must work with a
   keyboard only, offline, and must not cover the normal tool grid.

   Run: node tests/tools-chooser.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

function targetFile(href) {
  return path.resolve(path.join(root, 'pages'), href.split('#')[0]);
}

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const vp of [{ width: 1440, height: 900, isMobile: false, hasTouch: false }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
      const page = await browser.newPage(), errors = [];
      if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setRequestInterception(true);
      // Abort every request that is not served locally: the chooser must be offline-safe.
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport(vp);
      await page.goto(base + '/pages/dev-tools.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 600));

      const initial = await page.evaluate(() => {
        const q = s => document.querySelector(s);
        const panel = q('#chooserPanel');
        const tools = q('#tools');
        return {
          section: !!q('#tool-chooser'),
          toggle: !!q('#chooserToggle'),
          panelHidden: panel ? panel.hidden : null,
          expanded: q('#chooserToggle') ? q('#chooserToggle').getAttribute('aria-expanded') : null,
          panelPosition: panel ? getComputedStyle(panel).position : '',
          cards: document.querySelectorAll('#tools [data-tool-card]').length,
          toolsY: tools ? Math.round(tools.getBoundingClientRect().top) : -1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      check(vp.width + ' chooser section exists', initial.section);
      check(vp.width + ' chooser starts collapsed', initial.toggle && initial.panelHidden === true, 'hidden=' + initial.panelHidden);
      check(vp.width + ' toggle says aria-expanded=false', initial.expanded === 'false', initial.expanded);
      check(vp.width + ' chooser sits above the tool grid', initial.toolsY > 0 && initial.cards >= 10, 'cards=' + initial.cards);
      check(vp.width + ' chooser panel is in flow, not an overlay', initial.panelPosition === 'static' || initial.panelPosition === 'relative', initial.panelPosition);
      check(vp.width + ' no horizontal overflow before opening', initial.overflow <= 2, 'overflow=' + initial.overflow);

      // Keyboard: focus the toggle, open with Enter.
      await page.evaluate(() => document.getElementById('chooserToggle').focus());
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 150));
      const opened = await page.evaluate(() => ({
        hidden: document.getElementById('chooserPanel').hidden,
        expanded: document.getElementById('chooserToggle').getAttribute('aria-expanded'),
        focused: document.activeElement && document.activeElement.name,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check(vp.width + ' Enter opens the chooser', opened.hidden === false);
      check(vp.width + ' open chooser announces aria-expanded=true', opened.expanded === 'true', opened.expanded);
      check(vp.width + ' opening moves focus to the first question', opened.focused === 'making', opened.focused || 'none');
      check(vp.width + ' no horizontal overflow while open', opened.overflow <= 2, 'overflow=' + opened.overflow);

      // Keyboard only: art (already focused), quick, brand new, submit.
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 150));
      const first = await page.evaluate(() => {
        const result = document.getElementById('chooserResult');
        const link = result && result.querySelector('.chooser-result-link');
        return {
          hidden: result ? result.hidden : null,
          title: result && result.querySelector('.chooser-result-title') ? result.querySelector('.chooser-result-title').textContent.trim() : '',
          step: result && result.querySelector('.chooser-result-step') ? result.querySelector('.chooser-result-step').textContent.trim() : '',
          href: link ? link.getAttribute('href') : '',
          formHidden: document.getElementById('chooserForm').hidden,
          focusedClass: document.activeElement ? document.activeElement.className : '',
        };
      });
      check(vp.width + ' keyboard submission shows a result', first.hidden === false);
      check(vp.width + ' result names one tool', first.title === 'Pixel Studio', first.title || 'empty');
      check(vp.width + ' result gives a first step', /^First step: /.test(first.step) && first.step.length > 20, first.step);
      check(vp.width + ' result has a start link', /tools\/pixel-studio\.html/.test(first.href), first.href);
      check(vp.width + ' start link resolves on disk', fs.existsSync(targetFile(first.href)), targetFile(first.href));
      check(vp.width + ' question form gives way to the result', first.formHidden === true);
      check(vp.width + ' focus lands on the start link', /chooser-result-link/.test(first.focusedClass), first.focusedClass);

      // Keyboard: Tab to "Choose again", reset, then close with Escape.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 120));
      const reset = await page.evaluate(() => ({
        formHidden: document.getElementById('chooserForm').hidden,
        resultHidden: document.getElementById('chooserResult').hidden,
        focused: document.activeElement && document.activeElement.name,
      }));
      check(vp.width + ' Choose again restores the questions', reset.formHidden === false && reset.resultHidden === true);
      check(vp.width + ' reset returns focus to the first question', reset.focused === 'making', reset.focused || 'none');

      await page.evaluate(() => document.getElementById('chooserToggle').focus());
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 120));
      const closed = await page.evaluate(() => ({
        hidden: document.getElementById('chooserPanel').hidden,
        expanded: document.getElementById('chooserToggle').getAttribute('aria-expanded'),
        focusedId: document.activeElement ? document.activeElement.id : '',
      }));
      check(vp.width + ' Escape closes the chooser', closed.hidden === true);
      check(vp.width + ' close resets aria-expanded', closed.expanded === 'false', closed.expanded);
      check(vp.width + ' close returns focus to the toggle', closed.focusedId === 'chooserToggle', closed.focusedId || 'none');

      // Keyboard: a second path must recommend a different tool.
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 150));
      const second = await page.evaluate(() => {
        const result = document.getElementById('chooserResult');
        const link = result && result.querySelector('.chooser-result-link');
        return {
          title: result && result.querySelector('.chooser-result-title') ? result.querySelector('.chooser-result-title').textContent.trim() : '',
          href: link ? link.getAttribute('href') : '',
        };
      });
      check(vp.width + ' a sound answer recommends Audio Studio', second.title === 'Audio Studio', second.title || 'empty');
      check(vp.width + ' sound start link points at the SFX step', /sound-studio\.html#sfx/.test(second.href), second.href);
      check(vp.width + ' sound start link resolves on disk', fs.existsSync(targetFile(second.href)), targetFile(second.href));

      check(vp.width + ' no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const count = fs.readFileSync(path.join(root, 'pages', 'dev-tools.html'), 'utf8').match(/name="(?:making|time|confidence)"/g) || [];
  check('chooser asks at most three questions', new Set(count.map(s => s.split('"')[1])).size === 3, 'found ' + [...new Set(count.map(s => s.split('"')[1]))].join(', '));
  console.log(failures === 0 ? '\nAll chooser checks passed.' : '\n' + failures + ' chooser check(s) failed.');
  process.exitCode = failures === 0 ? 0 : 1;
})().catch(e => { console.error(e); server.close(); process.exit(1); });
