#!/usr/bin/env node
/*
 * tests/ember-guide-data-on.js
 * A1683: several tool pages ship a header "Help" button wired to
 * data-on="EmberGuide.show", but EmberGuide.show is a no-op unless the page loads
 * the /ember-guide.js provider AND calls EmberGuide.init (which sets the steps).
 * Missing either makes the Help button dead. This test loads each affected page
 * under its real CSP meta, asserts the provider is present and initialised, and
 * proves the header Help button actually opens the tour overlay with content.
 * Run: node tests/ember-guide-data-on.js
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

// The pages that actually own the markup (drum-pad, map-generator, music-maker,
// sfx-generator and tileset-builder are redirect stubs into these).
const PAGES = ['level-designer', 'pixel-studio', 'sound-studio', 'sprite-animator'];

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' -- '+detail:'')); if(!ok) failures++; }

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
  await new Promise(r=>server.listen(0, r));
  PORT = server.address().port;

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});

  for (const name of PAGES){
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({width:1280, height:900});
    await page.goto(`http://localhost:${PORT}/tools/${name}.html`, {waitUntil:'load', timeout:40000});
    await page.waitForFunction(()=>window.__jvdsUiDelegateLoaded === true, {timeout:20000}).catch(()=>{});
    await page.waitForFunction(()=>!!(window.EmberGuide && typeof window.EmberGuide.show === 'function'), {timeout:20000}).catch(()=>{});
    await new Promise(r=>setTimeout(r,600));

    const provider = await page.evaluate(()=>!!(window.EmberGuide && typeof window.EmberGuide.show === 'function'));
    check(`${name}: EmberGuide provider is loaded`, provider);

    const hasBtn = await page.evaluate(()=>document.querySelectorAll('[data-on="EmberGuide.show"]').length > 0);
    check(`${name}: header Help button present`, hasBtn);

    const init = await page.evaluate(()=>!!document.getElementById('emberGuideOverlay'));
    check(`${name}: EmberGuide.init ran (overlay built)`, init);

    // Clicking the header Help must open the tour with real content.
    const view = await page.evaluate(async ()=>{
      if (window.EmberGuide && window.EmberGuide.close) window.EmberGuide.close();
      const btn = document.querySelector('[data-on="EmberGuide.show"]');
      if (btn) btn.click();
      await new Promise(r=>setTimeout(r,150));
      const o = document.getElementById('emberGuideOverlay');
      const t = document.getElementById('emberGuideTitle');
      return { open: !!(o && o.classList.contains('open')), title: t ? t.textContent.trim() : '', floating: !!document.querySelector('[data-ember-floating]') };
    });
    check(`${name}: Help click opens the tour overlay`, view.open === true);
    check(`${name}: tour has step content`, view.title.length > 0, 'title="' + view.title + '"');
    check(`${name}: no duplicate floating Help chip`, view.floating === false);
    check(`${name}: no uncaught page errors`, errors.length === 0, errors.join(' | '));

    await page.close();
  }

  await browser.close();
  server.close();
  console.log(failures === 0 ? 'ALL EMBER-GUIDE DATA-ON CHECKS PASSED' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e=>{ console.error(e); process.exit(1); });
