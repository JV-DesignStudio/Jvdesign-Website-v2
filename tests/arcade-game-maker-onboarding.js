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

  // A2949: the first run is a two-step guided flow, not a wall of genres.
  const wizard = await page.evaluate(() => {
    const shown = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
    const on = document.querySelector('#fgStep2 .fg-level.fg-on');
    return {
      step1: shown(document.getElementById('fgStep1')),
      step2: shown(document.getElementById('fgStep2')),
      ideas: document.querySelectorAll('#fgStep1 .fg-choice').length,
      levels: document.querySelectorAll('#fgStep2 .fg-level').length,
      buildBtn: !!document.querySelector('#fgStep2 .fg-build'),
      defaultLevel: on ? on.getAttribute('data-on-arg') : ''
    };
  });
  check('first step shows three plain ideas', wizard.step1 === true && wizard.ideas === 3, wizard.ideas + ' ideas');
  check('difficulty step is hidden until an idea is picked', wizard.step2 === false);
  check('difficulty offers three levels and defaults to normal',
    wizard.levels === 3 && wizard.defaultLevel === 'normal' && wizard.buildBtn === true,
    wizard.levels + ' levels, default ' + wizard.defaultLevel);

  const overlayFit = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    boxWidth: document.getElementById('welcome-box').getBoundingClientRect().width
  }));
  check('first-run flow fits a 390px screen without sideways scroll',
    overlayFit.scrollWidth <= overlayFit.innerWidth && overlayFit.boxWidth <= overlayFit.innerWidth,
    JSON.stringify(overlayFit));


  const flow = await page.evaluate(async () => {
    document.querySelector('#fgStep1 .fg-choice[data-fg-genre="PLATFORMER"]').click();
    await new Promise(r => setTimeout(r, 80));
    const afterIdea = {
      step1: !document.getElementById('fgStep1').hidden,
      step2: !document.getElementById('fgStep2').hidden,
      summary: (document.getElementById('fgSummary') || {}).textContent || ''
    };
    document.querySelector('#fgStep2 .fg-level[data-on-arg="hard"]').click();
    const hardPressed = document.querySelector('#fgStep2 .fg-level[data-on-arg="hard"]').getAttribute('aria-pressed');
    document.querySelector('#fgStep2 .fg-back').click();
    const backToStep1 = !document.getElementById('fgStep1').hidden && document.getElementById('fgStep2').hidden;
    return { afterIdea, hardPressed, backToStep1 };
  });
  check('picking an idea opens the difficulty step', flow.afterIdea.step2 === true && flow.afterIdea.step1 === false);
  check('picking an idea names the game being built', flow.afterIdea.summary.includes('Forest Jump'), flow.afterIdea.summary);
  check('difficulty choice is announced', flow.hardPressed === 'true');
  check('Back returns to the idea step', flow.backToStep1 === true);

  const built = await page.evaluate(async () => {
    window.__fgLoaded = null;
    const orig = window._loadTemplate;
    window._loadTemplate = function (k) { window.__fgLoaded = k; };
    document.querySelector('#fgStep1 .fg-choice[data-fg-genre="PLATFORMER"]').click();
    await new Promise(r => setTimeout(r, 50));
    document.querySelector('#fgStep2 .fg-level[data-on-arg="hard"]').click();
    document.querySelector('#fgStep2 .fg-build').click();
    await new Promise(r => setTimeout(r, 120));
    const res = {
      loaded: window.__fgLoaded,
      overlayOpen: document.getElementById('welcome-overlay').classList.contains('show'),
      visited: localStorage.getItem('jv_arcade_visited'),
      speed: (document.getElementById('playerSpeed') || {}).value
    };
    window._loadTemplate = orig;
    return res;
  });
  check('Build loads the chosen game', built.loaded === 'forest_platform', String(built.loaded));
  check('Build closes the first-run overlay and remembers the visit',
    built.overlayOpen === false && built.visited === '1');
  check('Build applies the chosen difficulty', String(built.speed) === '280', 'player speed ' + built.speed);


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

  // A2690: a Blueprint slider announces its setting name and value once the drag settles.
  const announce = await page.evaluate(async () => {
    const input = document.querySelector('.bp-card input[type="range"]');
    if (!input) return { has: false };
    const row = input.closest('.tweak-row');
    const name = row ? row.querySelector('.tweak-label').textContent.trim() : '';
    input.value = String(Math.round((Number(input.min) + Number(input.max)) / 2));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    const region = document.getElementById('jvds-announce');
    return {
      has: true,
      live: region ? region.getAttribute('aria-live') : null,
      atomic: region ? region.getAttribute('aria-atomic') : null,
      text: region ? region.textContent : '',
      name,
      value: input.value
    };
  });
  check('Blueprint slider announces setting name and value',
    announce.has && announce.live === 'polite' && announce.atomic === 'true' &&
    announce.text.includes(announce.value) && announce.text.includes(announce.name.split('(')[0].trim()),
    JSON.stringify(announce));

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER ONBOARDING CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
