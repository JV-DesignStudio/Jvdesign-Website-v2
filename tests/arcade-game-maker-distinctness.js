#!/usr/bin/env node
/*
 * tests/arcade-game-maker-distinctness.js , A1469
 * Every genre must record the mechanic that makes it distinct (GENRE_HOOKS in
 * src/arcade-maker/genres.js), overlapping genres must be labelled as a
 * variation in the picker, and ARCADE_GENRE_AUDIT.md must cover every genre.
 * Run: node tests/arcade-game-maker-distinctness.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_DISTINCT_PORT || 8988;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };

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
  const jsErrors=[];
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon/.test(t)) return;
    jsErrors.push(t);
  });
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  await page.waitForFunction(() => document.querySelectorAll('.genre-card .gc-quality').length > 0, {timeout:10000});

  const r = await page.evaluate(()=>{
    const list = window.GENRE_LIST || [];
    const hooks = window.GENRE_HOOKS || {};
    const variants = window.GENRE_VARIANT_OF || {};
    const missingHooks = list.filter(g => !hooks[g] || hooks[g].length < 10);
    const badVariant = Object.entries(variants).filter(([g,p]) => !list.includes(p) || p === g).map(([g])=>g);
    const cards = {};
    document.querySelectorAll('.genre-card').forEach(c => {
      cards[c.dataset.genre] = {
        variant: (c.querySelector('.gc-variant') || {}).textContent || '',
        title: c.title || ''
      };
    });
    const variantGenres = Object.keys(variants);
    const variantNotLabelled = variantGenres.filter(g => !/variant of /.test((cards[g]||{}).variant || ''));
    const hookInTooltip = list.filter(g => cards[g] && cards[g].title.indexOf(hooks[g]) === -1);
    return { total: list.length, missingHooks, badVariant, variantGenres, variantNotLabelled, hookInTooltip };
  });

  const audit = fs.readFileSync(path.join(ROOT, 'ARCADE_GENRE_AUDIT.md'), 'utf8');
  const GENRES = await page.evaluate(()=> (window.GENRE_LIST || []).slice());
  const missingInDoc = GENRES.filter(g => audit.indexOf(g) === -1);

  check('GENRE_LIST available', r.total > 0, r.total + ' genres');
  check('every genre records its distinct mechanic', r.missingHooks.length === 0, r.missingHooks.join(','));
  check('variation labels point to a real, different genre', r.badVariant.length === 0, r.badVariant.join(','));
  check('overlapping genres are labelled as variations', r.variantNotLabelled.length === 0, r.variantNotLabelled.join(','));
  check('the mechanic hook shows in the picker tooltip', r.hookInTooltip.length === 0, r.hookInTooltip.join(','));
  check('ARCADE_GENRE_AUDIT.md exists and lists every genre', missingInDoc.length === 0, missingInDoc.join(','));
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER DISTINCTNESS CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
