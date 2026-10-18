/* Regression guard for the 3D builder step controls.

   The CSP migration (fd8e7a67) rewrote inline onclick/oninput handlers inside
   builder templates into data-action / data-action-input / data-param
   attributes, but no runtime handled them. Every step looked interactive and
   changed nothing. This test drives the real pages:

     1. an option button in step 2 updates the builder state and selection,
     2. a data-param slider changes state and its readout,
     3. Apply marks the step done,
     4. the 3D Builder shell uses the same delegation,
     5. no rendered control still carries a function-expression data-action.

   Run: node tests/3d-builder-controls.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.zip': 'application/zip', '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.resolve(root, '.' + u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function load(browser, base, url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.split('\n')[0].slice(0, 160)));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + url, { waitUntil: 'load' });
  if (await page.$('#cookie-decline')) { try { await page.click('#cookie-decline'); } catch (e) {} }
  await page.waitForSelector('#stepList .si', { timeout: 15000 });
  await sleep(500);
  return { page, errors };
}

async function openStep(page, index) {
  await page.evaluate(i => {
    const items = document.querySelectorAll('#stepList .si');
    if (items[i]) items[i].click();
  }, index);
  await sleep(250);
}

async function optionCheck(page, stateName, prop, label) {
  const before = await page.evaluate((s, p) => window[s] ? String(window[s][p]) : null, stateName, prop);
  const result = await page.evaluate((s, p) => {
    const cur = window[s] ? String(window[s][p]) : '';
    const buttons = Array.from(document.querySelectorAll('#stepBody .opt-btn'));
    const btn = buttons.find(b => b.getAttribute('data-arg') !== cur) || buttons[0];
    if (!btn) return { err: 'no option button' };
    const value = btn.getAttribute('data-arg');
    btn.click();
    const clicked = document.querySelector('#stepBody .opt-btn.sel');
    return { value, selected: !!(clicked && clicked.getAttribute('data-arg') === value) };
  }, stateName, prop);
  await sleep(200);
  const after = await page.evaluate((s, p) => window[s] ? String(window[s][p]) : null, stateName, prop);
  check(label + ': option click updates state', !result.err && after !== null && after !== before, before + ' -> ' + after);
  check(label + ': option click marks selection', !!result.selected, JSON.stringify(result));
}

async function sliderCheck(page, stateName, prop, label) {
  const before = await page.evaluate((s, p) => window[s] ? String(window[s][p]) : null, stateName, prop);
  const result = await page.evaluate(() => {
    const r = document.querySelector('#stepBody input[type="range"][data-param]');
    if (!r) return { err: 'no range slider' };
    const id = r.getAttribute('data-display');
    const first = r.min || '0', second = String(Number(r.min || 0) + Number(r.step || 1));
    r.value = second;
    r.dispatchEvent(new Event('input', { bubbles: true }));
    const out = id ? document.getElementById(id) : null;
    return { next: second, readout: out ? out.textContent : null };
  });
  await sleep(200);
  const after = await page.evaluate((s, p) => window[s] ? String(window[s][p]) : null, stateName, prop);
  check(label + ': slider updates state', !result.err && after !== null && after !== before, before + ' -> ' + after);
  check(label + ': slider updates readout', !result.err && result.readout !== null && result.readout !== '', JSON.stringify(result));
}

async function applyCheck(page, label) {
  const result = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#stepBody .run-btn')).find(b => /Apply/i.test(b.textContent));
    if (!btn) return { err: 'no Apply button' };
    btn.click();
    return {
      done: document.querySelectorAll('#stepBody .task-item.done').length,
      progress: (document.getElementById('progCt') || {}).textContent || ''
    };
  });
  await sleep(200);
  check(label + ': Apply marks the step done', !result.err && (result.done > 0 || /^\s*[1-9]/.test(result.progress)), JSON.stringify(result));
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

  try {
    // Rocket: expression-driven options + data-param slider + Apply.
    {
      const { page, errors } = await load(browser, base, '/workshops/rocket-builder.html');
      await openStep(page, 1);
      await optionCheck(page, 'R', 'nosecone', 'rocket');
      await applyCheck(page, 'rocket');
      await openStep(page, 9);
      await sliderCheck(page, 'R', 'boosterSize', 'rocket');
      const expressionActions = await page.evaluate(() => Array.from(document.querySelectorAll('[data-action]'))
        .filter(el => /\(function\s*\(/.test(el.getAttribute('data-action') || '')).length);
      check('rocket: no function-expression data-action left', expressionActions === 0, expressionActions + ' found');
      check('rocket: no runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }

    // Castle: named option handler + data-param slider + Apply.
    {
      const { page, errors } = await load(browser, base, '/workshops/castle-builder.html');
      await openStep(page, 1);
      await sliderCheck(page, 'P', 'wallHeight', 'castle');
      await applyCheck(page, 'castle');
      await openStep(page, 3);
      const swatch = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('#stepBody .swatch'));
        const cur = window.P.wallColor;
        const s = all.find(x => x.getAttribute('data-arg') !== cur) || all[0];
        if (!s) return { err: 'no swatch' };
        const before = window.P.wallColor;
        s.click();
        return { before, after: window.P.wallColor, arg: s.getAttribute('data-arg') };
      });
      await sleep(150);
      check('castle: swatch click updates state', !swatch.err && swatch.after === swatch.arg && swatch.after !== swatch.before, JSON.stringify(swatch));
      check('castle: no runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }

    // Every remaining step builder: it loads, its step controls change state,
    // and Apply marks the step done.
    {
      const pages = [
        ['robot-builder.html', 'R'],
        ['space-station-builder.html', 'P'],
        ['fairy-tale-builder.html', 'P'],
        ['phone-stand-builder.html', 'P'],
        ['race-car-builder.html', 'P'],
        ['submarine-builder.html', 'P']
      ];
      for (const [file, stateName] of pages) {
        const { page, errors } = await load(browser, base, '/workshops/' + file);
        const stepIndex = await page.evaluate(() => {
          const items = document.querySelectorAll('#stepList .si');
          for (let i = 0; i < items.length; i++) {
            items[i].click();
            if (document.querySelector('#stepBody .opt-btn')) return i;
          }
          return -1;
        });
        check(file + ': has an option step', stepIndex >= 0, 'step ' + stepIndex);
        if (stepIndex >= 0) {
          await sleep(150);
          const before = await page.evaluate(s => JSON.stringify(window[s] || null), stateName);
          const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('#stepBody .opt-btn'));
            const btn = buttons.find(b => !b.classList.contains('sel')) || buttons[0];
            if (!btn) return null;
            btn.click();
            return btn.getAttribute('data-arg');
          });
          await sleep(200);
          const after = await page.evaluate(s => JSON.stringify(window[s] || null), stateName);
          check(file + ': option changes state', !!clicked && before !== after, before + ' -> ' + after);
          await applyCheck(page, file);
        }
        check(file + ': no runtime errors', errors.length === 0, errors.join(' | '));
        await page.close();
      }
    }

    // Pages that use named data-action-input handlers instead of opts().
    {
      for (const file of ['pirate-ship-builder.html', 'steampunk-airship-builder.html']) {
        const { page, errors } = await load(browser, base, '/workshops/' + file);
        const result = await page.evaluate(() => {
          const count = document.querySelectorAll('#stepList .si').length;
          for (let i = 0; i < count; i++) {
            // renderSteps() replaces the list, so re-query each time.
            document.querySelectorAll('#stepList .si')[i].click();
            const input = document.querySelector('#stepBody input[type="range"][data-action-input], #cpanel input[type="range"][data-action-input], #cpan input[type="range"][data-action-input]');
            if (!input) continue;
            const key = input.getAttribute('data-arg');
            const out = document.getElementById('v_' + key);
            const before = out ? out.textContent : null;
            const min = Number(input.min || 0), step = Number(input.step || 1);
            input.value = String(Number(input.value) === min ? min + step : min);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return { key, before, after: out ? out.textContent : null };
          }
          return { err: 'no named range control' };
        });
        await sleep(200);
        check(file + ': named input handler updates readout', !result.err && result.after !== null && result.before !== result.after, JSON.stringify(result));
        check(file + ': no runtime errors', errors.length === 0, errors.join(' | '));
        await page.close();
      }
    }

    // Shell: the same controls inside workshops/3d-builder.html.
    {
      const { page, errors } = await load(browser, base, '/workshops/3d-builder.html?preset=rocket');
      await openStep(page, 1);
      await optionCheck(page, 'R', 'nosecone', 'shell');
      await applyCheck(page, 'shell');
      check('shell: no runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
  console.log('\n3D BUILDER CONTROLS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
