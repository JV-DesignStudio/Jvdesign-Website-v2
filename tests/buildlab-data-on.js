#!/usr/bin/env node
/*
 * tests/buildlab-data-on.js
 * A1682: tools/buildlab.html runs its app inside <script type="module">, so its
 * functions are module-scoped. The site delegate (assets/js/ui-delegate.js)
 * resolves data-on handler names from window, so any handler the module forgets
 * to expose is a dead button. This test loads the page under its real CSP meta,
 * asserts every [data-on] name resolves to a function, and proves the Kid Mode
 * button actually works end to end (body class + localStorage), not just that a
 * function exists.
 * Run: node tests/buildlab-data-on.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
let PORT = 0;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.woff2':'font/woff2', '.map':'application/json', '.gif':'image/gif', '.xml':'application/xml', '.txt':'text/plain' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' -- '+detail:'')); if(!ok) failures++; }

const EXPECTED = ['toggleKidMode','startChallenge','startChallengeTimer','mobCopy','mobPaste','remixTemplate'];

(async()=>{
  const server = http.createServer((req,res)=>{
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err,buf)=>{
      if (err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'});
      res.end(buf);
    });
  });
  await new Promise(res => server.listen(0, res));
  PORT = server.address().port;

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({width:1280, height:900});
  await page.goto(`http://localhost:${PORT}/tools/buildlab.html`, {waitUntil:'load', timeout:40000});
  // Readiness gate: toggleKidMode is exposed in the last Object.assign of the module,
  // so once it exists the whole app script has run. EmberGuide comes from a deferred
  // script, so wait for it too before resolving every data-on name.
  await page.waitForFunction(()=>typeof window.toggleKidMode === 'function', {timeout:20000});
  await page.waitForFunction(()=>!!(window.EmberGuide && typeof window.EmberGuide.show === 'function'), {timeout:20000});
  // The shared click delegate must be live before clicks do anything.
  await page.waitForFunction(()=>window.__jvdsUiDelegateLoaded === true, {timeout:20000});
  // Let the page's own post-load init settle so a stray timer cannot undo a click.
  await new Promise(r=>setTimeout(r,1200));

  // 1. Every data-on name on the page resolves to a function.
  const dead = await page.evaluate(()=>{
    function resolve(p){ return p.split('.').reduce((o,k)=>o?o[k]:undefined, window); }
    const out = [];
    document.querySelectorAll('[data-on]').forEach(el=>{
      const n = el.getAttribute('data-on');
      if (n && typeof resolve(n) !== 'function') out.push(n);
    });
    return out;
  });
  check('every data-on handler resolves to a function', dead.length === 0, dead.join(', '));

  // 2. The six module-scoped handlers (A1682) are exposed.
  const exposed = await page.evaluate((names)=>names.filter(n=>typeof window[n]==='function'), EXPECTED);
  check('all six A1682 handlers are exposed on window', exposed.length === EXPECTED.length,
    'missing=' + EXPECTED.filter(n=>!exposed.includes(n)).join(','));

  // 3. Kid Mode button works end to end: clicking flips the state and saves it.
  // State-agnostic, so the test does not depend on the page's starting mode.
  const before = await page.evaluate(()=>({ cls: document.body.classList.contains('kid-mode'), val: localStorage.getItem('buildlab_kidmode') }));
  await page.evaluate(()=>document.getElementById('kidModeBtn').click());
  await new Promise(r=>setTimeout(r,200));
  const after = await page.evaluate(()=>({ cls: document.body.classList.contains('kid-mode'), val: localStorage.getItem('buildlab_kidmode') }));
  check('clicking Kid Mode flips the kid-mode body class', after.cls === !before.cls, 'before=' + before.cls + ' after=' + after.cls);
  check('clicking Kid Mode saves the new state', after.val === (after.cls ? '1' : '0'), 'val=' + after.val);

  // 4. Clicking again flips it back (proves it is a real toggle, not a no-op).
  await page.evaluate(()=>document.getElementById('kidModeBtn').click());
  await new Promise(r=>setTimeout(r,200));
  const back = await page.evaluate(()=>({ cls: document.body.classList.contains('kid-mode'), val: localStorage.getItem('buildlab_kidmode') }));
  check('clicking Kid Mode again restores the previous state', back.cls === before.cls && back.val === (before.cls ? '1' : '0'), JSON.stringify(back));

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  console.log(failures === 0 ? 'ALL BUILDLAB DATA-ON CHECKS PASSED' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e=>{ console.error(e); process.exit(1); });
