#!/usr/bin/env node
/*
 * tests/arcade-game-maker-win.js , A1470
 * Every genre must default to a winnable/finishable goal (or be explicitly
 * intrinsic-endless), so a learner's first game can actually be won. Run:
 *   node tests/arcade-game-maker-win.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_WIN_PORT || 8985;
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
  await page.waitForFunction(() => window.GENRE_LIST && window.GENRE_LIST.length > 0, {timeout:10000});

  const r = await page.evaluate(()=>{
    const list = window.GENRE_LIST || [];
    const gaps = list.filter(g => !_GENRE_WIN[g]);
    const bad  = list.filter(g => {
      const d = _GENRE_WIN[g]; if (!d) return false;
      const isConcrete = d.c === 'score' || d.c === 'time';
      return !(isConcrete ? (d.target > 0) : d.c === 'intrinsic');
    });
    const rows = [];
    list.forEach(g=>{
      document.getElementById('genreMode').value = g;
      onGenreChange();
      const d = _GENRE_WIN[g] || {};
      const concrete = d.c === 'score' || d.c === 'time';
      const row = document.getElementById('winTargetRow');
      rows.push({
        g, cond: liveConfig.winCondition, target: liveConfig.winTarget,
        expectCond: concrete ? d.c : 'none', expectTarget: concrete ? d.target : null,
        rowVisible: !!(row && row.style.display !== 'none')
      });
    });
    document.getElementById('genreMode').value = 'SHOOTER';
    onGenreChange();
    return { total: list.length, gaps, bad, rows, shooterCond: liveConfig.winCondition };
  });

  check('GENRE_LIST available', r.total > 0, r.total + ' genres');
  check('every genre has a default win entry', r.gaps.length === 0, r.gaps.join(','));
  check('every entry is a valid score/time/intrinsic goal', r.bad.length === 0, r.bad.join(','));
  check('a default game (SHOOTER) can be won', r.shooterCond !== 'none', r.shooterCond);

  const condWrong = r.rows.filter(x => x.cond !== x.expectCond).map(x => x.g + ':' + x.cond + '/' + x.expectCond);
  check('applying a genre sets the right win condition', condWrong.length === 0, condWrong.join(', '));

  const targetWrong = r.rows.filter(x => x.expectTarget !== null && x.target !== x.expectTarget).map(x => x.g + ':' + x.target + '/' + x.expectTarget);
  check('applying a genre sets the right win target', targetWrong.length === 0, targetWrong.join(', '));

  const rowWrong = r.rows.filter(x => x.rowVisible !== (x.expectCond !== 'none')).map(x => x.g);
  check('win-target row shows exactly for win-able genres', rowWrong.length === 0, rowWrong.join(', '));

  const winnable = r.rows.filter(x => x.expectCond !== 'none').length;
  check('most genres are directly winnable (rest are intrinsic)', winnable >= 14, winnable + ' direct goals');
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER WIN CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
