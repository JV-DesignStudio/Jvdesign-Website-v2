#!/usr/bin/env node
/*
 * tests/arcade-game-maker-balance.js , A1477
 * Every starter template must have real easy/normal/hard variants (monotonic),
 * a balance-pass record must exist for every genre, and the Quick Preset UI must
 * drive the template difficulty. Run:
 *   node tests/arcade-game-maker-balance.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_BALANCE_PORT || 8987;
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
    const hasDifficulty = ['easy','normal','hard'].every(l => !!_DIFFICULTY[l]);
    // variants for every starter template, monotonic in speed + difficultyScale
    const variantIssues = [];
    list.forEach(g=>{
      const key = _STARTERS[g]; if (!key) return;
      const e = _templateDifficulty(key,'easy'), n = _templateDifficulty(key,'normal'), h = _templateDifficulty(key,'hard');
      if (!e || !n || !h) { variantIssues.push(g + ':missing'); return; }
      if (!(e.speed <= n.speed && n.speed <= h.speed)) variantIssues.push(g + ':speed ' + e.speed + '/' + n.speed + '/' + h.speed);
      if (!(e.difficultyScale <= n.difficultyScale && n.difficultyScale <= h.difficultyScale)) variantIssues.push(g + ':diff ' + e.difficultyScale + '/' + n.difficultyScale + '/' + h.difficultyScale);
    });
    // normal must equal the raw template's speed + difficultyScale
    const normalMismatch = Object.keys(_TEMPLATES).filter(k=>{
      const b = _TEMPLATES[k], n = _templateDifficulty(k,'normal');
      return n.speed !== (b.speed||200) || n.difficultyScale !== +((b.difficultyScale != null ? b.difficultyScale : 1)).toFixed(2);
    });
    // balance record coverage + sane lives/difficulty in templates
    const unbcovered = list.filter(g => !_BALANCE[g]);
    const wildLives = Object.entries(_TEMPLATES).filter(([k,t]) => { const l = (t.lives == null) ? 3 : t.lives; return !(l >= 1 && l <= 99); }).map(([k])=>k);
    const wildDiff  = Object.entries(_TEMPLATES).filter(([k,t]) => (t.difficultyScale != null) && !(t.difficultyScale >= 0 && t.difficultyScale <= 3)).map(([k])=>k);
    return {
      total: list.length, hasDifficulty, variantIssues, normalMismatch,
      unbcovered, wildLives, wildDiff,
      presetPills: document.querySelectorAll('.preset-pill.easy, .preset-pill.normal, .preset-pill.hard').length
    };
  });

  check('easy/normal/hard difficulty model present', r.hasDifficulty === true);
  check('every starter template has monotonic variants', r.variantIssues.length === 0, r.variantIssues.slice(0,4).join(', '));
  check('normal variant equals the base template tuning', r.normalMismatch.length === 0, r.normalMismatch.join(','));
  check('a balance record exists for every genre', r.unbcovered.length === 0, r.unbcovered.join(','));
  check('template lives are sane (1-99)', r.wildLives.length === 0, r.wildLives.join(','));
  check('template difficultyScale is sane (0-3)', r.wildDiff.length === 0, r.wildDiff.join(','));
  check('Quick Preset easy/normal/hard pills exist in the UI', r.presetPills >= 3, r.presetPills + ' pills');

  // Wiring: the chosen Quick Preset drives the loaded template's difficulty.
  const wiring = await page.evaluate(()=>{
    applyPreset('hard'); _loadTemplate('ocean_shooter');
    const hard = { speed: liveConfig.speed, diff: liveConfig.difficultyScale, preset: _currentPreset };
    applyPreset('easy'); _loadTemplate('ocean_shooter');
    const easy = { speed: liveConfig.speed, diff: liveConfig.difficultyScale, preset: _currentPreset };
    return { hard, easy, base: _TEMPLATES['ocean_shooter'].speed, baseDiff: _TEMPLATES['ocean_shooter'].difficultyScale };
  });
  check('preset easy loads a slower, easier template', wiring.easy.speed < wiring.hard.speed && wiring.easy.diff < wiring.hard.diff, JSON.stringify(wiring.easy) + ' vs ' + JSON.stringify(wiring.hard));

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER BALANCE CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
