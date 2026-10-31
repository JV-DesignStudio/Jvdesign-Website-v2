#!/usr/bin/env node
/*
 * tests/arcade-game-maker-export-fidelity.js , A2154
 * A downloaded game must keep everything the creator made. This builds an
 * export from a project with custom code, a custom achievement, a cutscene,
 * boss phases and placed level entities, then opens the packed file as its own
 * page with the network blocked and checks they all survived and the code ran.
 * It also checks the export only allows eval when custom code exists.
 * Run: node tests/arcade-game-maker-export-fidelity.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_FIDELITY_PORT || 8994;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

let exportWithCode = '';
let exportNoCode = '';

const server = http.createServer((req,res)=>{
  const clean = decodeURIComponent(req.url.split('?')[0]);
  if (clean === '/__fidelity-code.html') { res.writeHead(200,{'Content-Type':'text/html'}); res.end(exportWithCode); return; }
  if (clean === '/__fidelity-nocode.html') { res.writeHead(200,{'Content-Type':'text/html'}); res.end(exportNoCode); return; }
  let p = clean;
  if(p.endsWith('/')) p+='index.html';
  fs.readFile(path.join(ROOT,p),(err,buf)=>{
    if(err){ res.writeHead(404); res.end(); return; }
    res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
    res.end(buf);
  });
});

(async()=>{
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});

  // 1. Build two exports: one with creator-only data + code, one plain.
  const maker = await browser.newPage();
  await maker.setViewport({width:1280,height:900});
  await maker.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await maker.waitForFunction(() => typeof window._buildExportHtml === 'function', {timeout:20000});
  const built = await maker.evaluate(async () => {
    _engineData = { title:'Fidelity Test', genre:'PLATFORMER', speed:200, gravity:600, jump:450, map:null };
    // Creator-only data that lives outside liveConfig.
    customLevelEntities = { coins:[[3,2]], enemies:[], spawn:[1,1], goal:[5,5] };
    _customAchs = [{ id:'a1', label:'Fidelity achievement', trigger:'score', target:1, unlocked:false }];
    _cutSlides = [{ char:'X', text:'Fidelity cutscene', bg:'#000000' }];
    liveConfig.cutsceneWhen = 'after';
    _bossPhases = [{ hpPct:50, speed:1.5, attack:'spread', label:'Fidelity phase' }];
    _compileUserCode("function onCreate(scene){ window.__exportCodeRan = true; }");
    const a = await _buildExportHtml();

    // Project JSON round-trip: the same data must survive save then load.
    const save = _buildSaveData();
    _customAchs = []; _cutSlides = []; _bossPhases = []; customLevelEntities = null;
    _applyLoadData(save, { skipBoot: true });
    const roundTrip = {
      ach: _customAchs.length,
      cut: _cutSlides.length,
      cutWhen: liveConfig.cutsceneWhen,
      boss: _bossPhases.length,
      entities: !!customLevelEntities,
      userCode: (document.getElementById('customCodeEditor') || {}).value || ''
    };

    // Now a plain project, to prove eval is only allowed when code exists.
    _compileUserCode('');
    customLevelEntities = null;
    _customAchs = [];
    _cutSlides = [];
    liveConfig.cutsceneSlides = [];
    _bossPhases = [];
    const b = await _buildExportHtml();
    return { a: a && a.html, b: b && b.html, roundTrip };
  });
  exportWithCode = built.a || '';
  exportNoCode = built.b || '';
  const rt = built.roundTrip || {};
  await maker.close();

  check('export with creator data produced HTML', exportWithCode.length > 1000, exportWithCode.length + ' bytes');
  check('safe export produced HTML', exportNoCode.length > 1000, exportNoCode.length + ' bytes');
  check('custom code is embedded in the export', /Fidelity Test/.test(exportWithCode) && /__exportCodeRan/.test(exportWithCode));
  check('project JSON keeps custom code', /__exportCodeRan/.test(rt.userCode));
  check('project JSON keeps custom achievement', rt.ach === 1, String(rt.ach));
  check('project JSON keeps cutscene and timing', rt.cut === 1 && rt.cutWhen === 'after', rt.cut + '/' + rt.cutWhen);
  check('project JSON keeps boss phases', rt.boss === 1, String(rt.boss));
  check('project JSON keeps placed entities', rt.entities === true);
  // Check the CSP meta tag itself, not the whole file: the maker source also
  // contains the string 'unsafe-eval' in the code that builds the policy.
  const cspTag = (html) => (html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i) || [''])[0];
  check('export allows eval only when custom code exists',
    /'unsafe-eval'/.test(cspTag(exportWithCode)) && !/'unsafe-eval'/.test(cspTag(exportNoCode)));

  // 2. Open the packed game offline and check the creator data survived.
  const game = await browser.newPage();
  const cspErrors = [], jsErrors = [], remote = [];
  await game.setRequestInterception(true);
  game.on('request', r=>{
    const u = r.url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') { r.continue(); return; }
    remote.push(u); r.abort();
  });
  game.on('pageerror', e=> jsErrors.push(e.message));
  game.on('console', m=>{
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Content Security Policy|Refused to (execute|load|apply)/i.test(t)) { cspErrors.push(t); return; }
    if (/ERR_|Failed to load resource|Aborted|net::/.test(t)) return;
    jsErrors.push(t);
  });
  await game.setViewport({width:1280,height:900});
  await game.goto(BASE+'__fidelity-code.html', {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r, 900));
  await game.evaluate(()=>{ const el=document.getElementById('introOverlay'); if(el && el.classList.contains('show')){ if(typeof closeIntro==='function') closeIntro(); else el.classList.remove('show'); } });
  await new Promise(r=>setTimeout(r, 2200));

  const r = await game.evaluate(() => ({
    codeRan: window.__exportCodeRan === true,
    codeCompiled: !!(typeof _userCodeFns !== 'undefined' && _userCodeFns && typeof _userCodeFns.onCreate === 'function'),
    achs: (typeof _customAchs !== 'undefined' && _customAchs.length) ? _customAchs.map(a => a.label) : [],
    cuts: (liveConfig.cutsceneSlides || []).map(s => s.text),
    cutWhen: liveConfig.cutsceneWhen || '',
    boss: (liveConfig.bossPhases || []).map(p => p.label),
    entities: customLevelEntities ? (customLevelEntities.coins || []).length : -1,
    canvas: !!document.querySelector('#game-container canvas'),
    sceneCount: (window._phaserGame && window._phaserGame.scene) ? window._phaserGame.scene.scenes.length : 0
  }));

  check('custom onCreate code ran in the downloaded game', r.codeRan === true);
  check('custom code compiled in the player', r.codeCompiled === true);
  check('custom achievement survived', r.achs.length === 1 && r.achs[0] === 'Fidelity achievement', r.achs.join(','));
  check('cutscene survived with its timing', r.cuts.length === 1 && r.cuts[0] === 'Fidelity cutscene' && r.cutWhen === 'after', r.cuts.join(','));
  check('boss phases survived', r.boss.length === 1 && r.boss[0] === 'Fidelity phase', r.boss.join(','));
  check('placed level entities survived', r.entities === 1, String(r.entities));
  check('exported game still boots a scene', r.canvas === true && r.sceneCount > 0, 'scenes=' + r.sceneCount);
  check('no CSP console errors', cspErrors.length === 0, cspErrors.slice(0,2).join(' | '));
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));
  check('no remote request attempted', remote.length === 0, remote.slice(0,3).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER EXPORT-FIDELITY CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });

