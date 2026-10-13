#!/usr/bin/env node
/*
 * tests/arcade-game-maker-quality.js , A1473
 * The picker and starter grid must surface a READY/BETA/EXPERIMENT signal
 * sourced from GENRE_QUALITY in src/arcade-maker/genres.js, so a learner can
 * tell a finished genre from an experiment. Run:
 *   node tests/arcade-game-maker-quality.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_QUALITY_PORT || 8986;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };
const ALLOWED = ['READY', 'BETA', 'EXPERIMENT'];

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
  await page.waitForFunction(() => document.querySelectorAll('.genre-card .gc-quality').length > 0 && document.querySelectorAll('#starterGrid .q-pill').length > 0, {timeout:10000});

  const r = await page.evaluate(()=>{
    const list = window.GENRE_LIST || [];
    const q = window.GENRE_QUALITY || {};
    const gaps = list.filter(g => !q[g]);
    const badValues = list.filter(g => q[g] && !['READY','BETA','EXPERIMENT'].includes(q[g])).map(g => g + ':' + q[g]);
    const usedLabels = new Set(Object.values(q));
    const cardPills = Array.from(document.querySelectorAll('.genre-card')).map(c => ({
      genre: c.dataset.genre, pill: (c.querySelector('.gc-quality') || {}).textContent || ''
    }));
    const cardMismatch = cardPills.filter(c => c.pill !== q[c.genre]).map(c => c.genre + ':' + c.pill + '/' + q[c.genre]);
    const starterPills = Array.from(document.querySelectorAll('#starterGrid button')).map(b => {
      const key = (b.getAttribute('onclick')||'').match(/_loadTemplate\('([^']+)'\)/)?.[1];
      const pill = (b.querySelector('.q-pill') || {}).textContent || '';
      return { key, pill };
    });
    const starterMissing = starterPills.filter(s => !s.pill).length;
    return {
      total: list.length,
      gaps, badValues,
      labelsPresent: ['READY','BETA','EXPERIMENT'].every(l => usedLabels.has(l)),
      usedLabels: Array.from(usedLabels),
      cards: cardPills.length, cardMismatch,
      starters: starterPills.length, starterMissing
    };
  });

  check('GENRE_QUALITY available via module', r.total > 0, r.total + ' genres');
  check('every genre has a quality label', r.gaps.length === 0, r.gaps.join(','));
  check('labels are only READY/BETA/EXPERIMENT', r.badValues.length === 0, r.badValues.join(','));
  check('all three labels are used', r.labelsPresent === true, r.usedLabels.join(','));
  check('picker cards show the quality pill', r.cards === r.total, r.cards + '/' + r.total);
  check('picker pills match the source map', r.cardMismatch.length === 0, r.cardMismatch.join(','));
  check('starter buttons show the quality pill', r.starters > 0 && r.starterMissing === 0, r.starterMissing + ' missing');
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER QUALITY CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
