/* A3069 page test for the Godot Basics build canvas.
   The three design choices must be real: Skip uses the defaults, Start uses the
   learner's colour, name and difficulty, the preview carries them, and the final
   Mod Card is prefilled instead of asking the same questions twice. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/godot-tutorial-canvas.html';
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function readState(page) {
  return page.evaluate(() => {
    const step7 = (window.CW_CONFIG.steps || []).find((s) => s.num === 7) || {};
    let preview = '';
    try {
      const out = window.CW_CONFIG.templates[1]('var start_x = 200\nvar start_y = 200\nvar coin_count = 8');
      preview = JSON.stringify(out && out.cwParts ? out.cwParts : out);
    } catch (e) { preview = 'ERROR ' + e.message; }
    return {
      design: window.CW_DESIGN || {},
      starter: step7.starter || '',
      solution: step7.solution || '',
      preview,
      buildShown: (document.getElementById('buildCanvas') || {}).style.display !== 'none',
      formShown: (document.getElementById('designForm') || {}).style.display !== 'none'
    };
  });
}

(async () => {
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      await page.setViewport({ width, height: 900 });
      await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 });

      const shell = await page.evaluate(() => ({
        skip: !!document.getElementById('designSkipBtn'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check('skip control @' + width, shell.skip);
      check('no horizontal overflow @' + width, shell.overflow <= 2, shell.overflow + 'px');

      await page.click('#designSkipBtn');
      await page.waitForFunction(() => window.CW_DESIGN && (document.getElementById('buildCanvas') || {}).style.display !== 'none', { timeout: 5000 });
      const defaults = await readState(page);
      check('skip starts the build @' + width, defaults.buildShown && !defaults.formShown);
      check('skip uses the default name @' + width, defaults.design.designName === 'Star Collector', JSON.stringify(defaults.design));
      check('default colour reaches the preview @' + width, defaults.preview.includes('#60a5fa'), defaults.preview.slice(0, 120));
      check('default name reaches the HUD @' + width, defaults.preview.includes('Star Collector'));
      check('default speed reaches the player @' + width, defaults.preview.includes('speed=3'));
      check('rainy day challenge is prefilled @' + width, defaults.starter.includes('Game name: Star Collector') && defaults.starter.includes('Player colour: blue'), defaults.starter.slice(0, 80));
      const preview = await page.evaluate(() => ({
        what: (document.getElementById('cwWhat') || {}).textContent || '',
        frame: (document.getElementById('gameFrame') || {}).getAttribute('src') || ''
      }));
      check('game preview appears before the code @' + width, /Preview:/i.test(preview.what) && /canvas-preview/.test(preview.frame), JSON.stringify(preview));

      await page.reload({ waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 });
      await page.evaluate(() => {
        const purple = document.querySelector('.cw-swatch[data-colour="purple"]');
        if (purple) purple.click();
        const hard = document.querySelector('.cw-speed-btn[data-speed="hard"]');
        if (hard) hard.click();
        const input = document.getElementById('designName');
        if (input) input.value = 'Purple Comet';
        document.getElementById('designStartBtn').click();
      });
      await page.waitForFunction(() => window.CW_DESIGN && window.CW_DESIGN.designName === 'Purple Comet', { timeout: 5000 });
      const custom = await readState(page);
      check('custom name is saved @' + width, custom.design.designName === 'Purple Comet', JSON.stringify(custom.design));
      check('custom colour reaches the preview @' + width, custom.preview.includes('#a78bfa'));
      check('custom name reaches the HUD @' + width, custom.preview.includes('Purple Comet'));
      check('custom difficulty reaches the player @' + width, custom.preview.includes('speed=5'));
      check('rainy day challenge uses the custom name @' + width, custom.starter.includes('Game name: Purple Comet') && custom.starter.includes('Player colour: purple'), custom.starter.slice(0, 90));

      const v2 = await page.evaluate(() => {
        const active = document.querySelector('.cw-step.active');
        const others = Array.from(document.querySelectorAll('.cw-step:not(.active)'));
        const bodyOf = (card) => Array.from(card.children).find((c) => !c.classList.contains('cw-step-head'));
        const collapsed = others.every((card) => {
          const body = bodyOf(card);
          return !body || getComputedStyle(body).display === 'none';
        });
        const activeBody = active ? bodyOf(active) : null;
        return {
          tools: !!document.querySelector('.cw-stage-tools'),
          run: !!document.querySelector('[data-cw="runStage"]'),
          expand: !!document.querySelector('[data-cw="expandStage"]'),
          sound: !!document.querySelector('[data-cw="toggleSound"]'),
          takeHome: !!document.querySelector('[data-cw="takeHome"]'),
          activeOpen: !!activeBody && getComputedStyle(activeBody).display !== 'none',
          collapsed,
          engine: !!document.querySelector('.cw-step.active .cw-engine'),
          engineCode: (document.querySelector('.cw-step.active .cw-engine-code') || {}).textContent || '',
          predict: !!document.querySelector('.cw-step.active .cw-predict'),
          previewStep: typeof window.CW.previewStep === 'function'
        };
      });
      check('stage tools @' + width, v2.tools && v2.run && v2.expand && v2.sound && v2.takeHome, JSON.stringify(v2));
      check('focus mode collapses other steps @' + width, v2.activeOpen && v2.collapsed, JSON.stringify({ active: v2.activeOpen, collapsed: v2.collapsed }));
      check('real Godot lane on the step @' + width, v2.engine && v2.engineCode.trim().length > 20, v2.engineCode.slice(0, 80));
      check('predict prompt on the step @' + width, v2.predict);
      check('preview API @' + width, v2.previewStep);
      const labLink = await page.evaluate(() => {
        const a = document.querySelector('.cw-engine-project');
        return a ? a.getAttribute('href') : '';
      });
      check('Lab project link @' + width, /godot-lab\/index\.html\?project=godot-tutorial/.test(labLink), labLink);

      // Complete step 1 so step 2's drag-to-order task renders.
      await page.evaluate(() => window.CW.showSolution(1));
      await page.click('.cw-step.active [data-cw="checkStep"]');
      await page.waitForFunction(() => document.querySelector('.cw-step.active [data-cw="checkQuiz"]'), { timeout: 10000 });
      await page.evaluate(() => {
        const option = document.querySelector('.cw-step.active [data-cw="selectQuiz"][data-cw-arg2="1"]');
        if (option) option.click();
      });
      await page.click('.cw-step.active [data-cw="checkQuiz"]');
      await page.waitForFunction(() => document.querySelector('.cw-parsons'), { timeout: 10000 });
      const interactive = await page.evaluate(() => {
        const first = document.querySelector('[data-cw-parsons-bank] .cw-parsons-line');
        if (first) first.click();
        return {
          lines: document.querySelectorAll('.cw-parsons-line').length,
          check: !!document.querySelector('[data-cw="checkParsons"]'),
          grownup: !!document.querySelector('.cw-grownup'),
          moved: document.querySelectorAll('[data-cw-parsons-bank] .cw-parsons-line').length === 2
        };
      });
      check('drag-to-order task @' + width, interactive.lines === 3 && interactive.check && interactive.moved, JSON.stringify(interactive));
      check('grown-up helper @' + width, interactive.grownup);

      await page.click('#tab-home');
      await new Promise((r) => setTimeout(r, 120));
      const home = await page.evaluate(() => {
        const lab = document.querySelector('#homePanel a[href*="godot-lab/index.html"]');
        const zip = document.querySelector('#homePanel a[href$="godot-tutorial.zip"]');
        return {
          shown: !document.getElementById('homePanel').hidden,
          schoolHidden: document.getElementById('schoolPanel').hidden,
          steps: document.querySelectorAll('.cw-step').length,
          homeSteps: document.querySelectorAll('#homeSteps li').length,
          lab: lab ? lab.getAttribute('href') : '',
          zip: zip ? zip.getAttribute('href') : '',
          note: (document.getElementById('modeNote') || {}).textContent || ''
        };
      });
      check('home mode keeps the lesson steps @' + width, home.shown && home.schoolHidden && home.steps === 7, JSON.stringify({ shown: home.shown, steps: home.steps }));
      check('home mode lists the same seven steps @' + width, home.homeSteps === 7, 'home steps ' + home.homeSteps);
      check('home mode opens the exact Lab project @' + width, /godot-lab\/index\.html\?project=godot-tutorial/.test(home.lab), home.lab);
      check('home mode downloads the exact project @' + width, /godot-tutorial\.zip$/.test(home.zip), home.zip);
      check('home mode explains the split screen @' + width, /real Godot editor/i.test(home.note), home.note);

      await page.click('#tab-school');
      await new Promise((r) => setTimeout(r, 120));
      const back = await page.evaluate(() => ({
        school: !document.getElementById('schoolPanel').hidden,
        home: document.getElementById('homePanel').hidden,
        steps: document.querySelectorAll('.cw-step').length
      }));
      check('school mode returns to the preview @' + width, back.school && back.home && back.steps === 7, JSON.stringify(back));
      check('no page errors @' + width, errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise((r) => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nPASS: godot-tutorial canvas personalisation');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
