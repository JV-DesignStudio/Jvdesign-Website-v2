#!/usr/bin/env node
/*
 * tests/arcade-game-maker-onboarding.js , A2140
 * First run must open exactly ONE onboarding flow. The starter picker
 * (#welcome-overlay) is that flow; the 4-step tour is opt-in from its button.
 * Regression guard: a previous build auto-started the tour at 1200ms, so it
 * stacked behind the welcome modal (z 800 under z 9999) and read as broken.
 * Run: node tests/arcade-game-maker-onboarding.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_ONBOARD_PORT || 8991;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const server = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p.endsWith('/')) p+='index.html';
    fs.readFile(path.join(ROOT,p),(err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  await page.setViewport({width:390,height:844});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window._showWelcomeOverlay === 'function', {timeout:20000});
  await new Promise(r=>setTimeout(r,2500));

  const first = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && el.classList.contains('show');
    };
    const welcome = document.getElementById('welcome-overlay');
    const tour = document.getElementById('tutOverlay');
    return {
      welcome: vis(welcome),
      tour: vis(tour),
      welcomeShowClass: !!(welcome && welcome.classList.contains('show')),
      tourShowClass: !!(tour && tour.classList.contains('show')),
      starters: document.querySelectorAll('#welcome-overlay .welcome-tpl').length,
      tourBtn: !!document.querySelector('#welcome-overlay [data-on="startTutorial"]'),
      visited: localStorage.getItem('jv_arcade_visited'),
      tutorialDone: localStorage.getItem('jv_tutorial_done')
    };
  });

  check('welcome picker is shown on first run', first.welcome === true);
  check('welcome offers four finished starters', first.starters === 4, first.starters + ' starters');
  check('welcome offers the opt-in 30-second tour', first.tourBtn === true);
  check('tour does NOT auto-start behind the welcome', first.tour === false && first.tourShowClass === false);
  check('exactly one onboarding modal is visible', (first.welcome ? 1 : 0) + (first.tour ? 1 : 0) === 1);

  // Second visit: no modal at all.
  await page.evaluate(() => { localStorage.setItem('jv_arcade_visited', '1'); });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window._showWelcomeOverlay === 'function', {timeout:20000});
  await new Promise(r=>setTimeout(r,2500));
  const second = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && el.classList.contains('show');
    };
    return {
      welcome: vis(document.getElementById('welcome-overlay')),
      tour: vis(document.getElementById('tutOverlay'))
    };
  });
  check('returning visit opens no onboarding modal', second.welcome === false && second.tour === false);

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER ONBOARDING CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
