#!/usr/bin/env node
/*
 * tests/arcade-game-maker-genre-data.js , A2140
 * One roster, one set of labels. Every genre in GENRE_LIST must have a
 * description, icon, label, quality and hook; the picker's hidden select and
 * visible cards must agree with it; and the maker must not keep private copies
 * of the label list (Paper Toss used to fall through as a raw ID).
 * Run: node tests/arcade-game-maker-genre-data.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_GENREDATA_PORT || 8992;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const mod = await import(pathToFileURL(path.join(ROOT, 'src/arcade-maker/genres.js')).href);
  const { GENRE_LIST, GENRE_DESCS, GENRE_ICONS, GENRE_LABELS, GENRE_QUALITY, GENRE_HOOKS, GENRE_RECOMMENDED } = mod;
  const src = fs.readFileSync(path.join(ROOT, 'tools/arcade-game-maker.html'), 'utf8');

  const TOTAL = (GENRE_LIST || []).length;
  check('GENRE_LIST is populated', Array.isArray(GENRE_LIST) && TOTAL >= 22, TOTAL + ' genres');
  const missing = GENRE_LIST.filter(g => !GENRE_DESCS[g] || !GENRE_ICONS[g] || !GENRE_LABELS[g] || !GENRE_QUALITY[g] || !GENRE_HOOKS[g]);
  check('every genre has desc, icon, label, quality and hook', missing.length === 0, missing.join(','));
  check('Paper Toss has a display label', GENRE_LABELS.PAPERTOSS === 'Paper Toss', String(GENRE_LABELS.PAPERTOSS));

  check('six recommended genres are defined', Array.isArray(GENRE_RECOMMENDED) && GENRE_RECOMMENDED.length === 6, String(GENRE_RECOMMENDED));
  check('recommended genres are unique and real', new Set(GENRE_RECOMMENDED).size === GENRE_RECOMMENDED.length &&
    GENRE_RECOMMENDED.every(g => GENRE_LIST.indexOf(g) !== -1), String(GENRE_RECOMMENDED));
  const notReady = GENRE_RECOMMENDED.filter(g => GENRE_QUALITY[g] !== 'READY');
  check('recommended genres are all READY', notReady.length === 0, notReady.join(','));

  // The maker must not keep a private label map in the idle placeholder.
  const idleFn = (src.match(/function _updateIdlePlaceholder\([\s\S]*?\n\}/) || [''])[0];
  check('idle placeholder reads GENRE_LABELS (no private NAMES map)',
    /GENRE_LABELS/.test(idleFn) && !/const NAMES/.test(idleFn), idleFn.slice(0,40));

  // High scores must cover the shared roster, not an older 11-genre copy.
  const scoresFn = (src.match(/function showAllScores\([\s\S]*?\n\}/) || [''])[0];
  check('showAllScores reads GENRE_LIST', /GENRE_LIST/.test(scoresFn));
  check('showAllScores no longer hardcodes 11 genres', /const genres = \[/.test(scoresFn) === false);

  // DOM: one card per genre and the select agrees.
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
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window._updateIdlePlaceholder === 'function' &&
    document.querySelectorAll('.genre-card.is-rec').length > 0, {timeout:20000});

  const r = await page.evaluate(() => {
    const list = window.GENRE_LIST || [];
    const rec = window.GENRE_RECOMMENDED || [];
    const options = Array.from(document.querySelectorAll('#genreMode option')).map(o => o.value).filter(Boolean);
    const cards = Array.from(document.querySelectorAll('.genre-card')).map(c => c.dataset.genre);
    const grid = document.getElementById('genre-picker');
    const beforeHidden = Array.from(document.querySelectorAll('.genre-card'))
      .filter(c => getComputedStyle(c).display === 'none').length;
    const compactBefore = !!(grid && grid.classList.contains('genre-grid--compact'));
    const labelBefore = (document.getElementById('showAllGenresBtn') || {}).textContent || '';
    document.getElementById('showAllGenresBtn').click();
    const afterHidden = Array.from(document.querySelectorAll('.genre-card'))
      .filter(c => getComputedStyle(c).display === 'none').length;
    const afterAll = Array.from(document.querySelectorAll('.genre-card'))
      .filter(c => getComputedStyle(c).display !== 'none').length;
    const labelAfter = (document.getElementById('showAllGenresBtn') || {}).textContent || '';
    _updateIdlePlaceholder('PAPERTOSS');
    return {
      options, cards, rec,
      optionMatch: options.length === list.length && list.every(g => options.indexOf(g) !== -1),
      cardMatch: cards.length === list.length && list.every(g => cards.indexOf(g) !== -1),
      recCards: document.querySelectorAll('.genre-card.is-rec').length,
      compactBefore, beforeHidden, afterHidden, afterAll,
      labelBefore, labelAfter,
      idleSub: (document.getElementById('idleSub') || {}).textContent || ''
    };
  });

  check('#genreMode options match GENRE_LIST', r.optionMatch, r.options.length + ' options / ' + GENRE_LIST.length + ' genres');
  check('picker has one card per genre', r.cardMatch, r.cards.length + ' cards / ' + GENRE_LIST.length + ' genres');
  check('six recommended cards are marked', r.recCards === GENRE_RECOMMENDED.length, r.recCards + ' marked');
  check('picker starts compact', r.compactBefore === true && r.beforeHidden === TOTAL - GENRE_RECOMMENDED.length, r.beforeHidden + ' hidden');
  check('Show all reveals every card', r.afterAll === TOTAL && r.afterHidden === 0, r.afterAll + ' shown');
  check('Show-all button names the total before and after', r.labelBefore.includes(String(TOTAL)) && /6/.test(r.labelAfter),
    r.labelBefore.trim() + ' -> ' + r.labelAfter.trim());
  check('Paper Toss idle label uses the shared name', /Paper Toss/.test(r.idleSub), r.idleSub.trim());
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER GENRE-DATA CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
