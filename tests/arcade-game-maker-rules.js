#!/usr/bin/env node
/*
 * tests/arcade-game-maker-rules.js (A2173)
 *
 * Sandbox rule depth: repeat/cooldown, timed start, set-variable and nested
 * ALL/ANY groups. Also proves the new rule data survives save/export.
 *
 * Run: node tests/arcade-game-maker-rules.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_RULES_PORT || 8987;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  await page.waitForFunction(() => window.GENRE_LIST && window.GENRE_LIST.length > 0 &&
    typeof window.compileAndBootEngine === 'function' && typeof window._sbEvalRule === 'function', {timeout:20000});

  // Boot a quiet sandbox and pause it so only our explicit ticks run rules.
  await page.evaluate(()=>{
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    liveConfig.customStarTarget = 0;
    liveConfig.customEnemyCount = 0;
    liveConfig.customEnemySpeed = 0;
    liveConfig.customVars = [{ id: 'v1', name: 'power', value: 0 }];
    liveConfig.customRules = [];
    compileAndBootEngine();
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, {timeout:20000});
  await sleep(700);
  await page.evaluate(()=>{ window._phaserGame.scene.getScenes(true)[0].scene.pause(); });

  // 1. UI exposes repeat/cooldown/start-after, groups and set-variable.
  const ui = await page.evaluate(()=>{
    liveConfig.customRules = [{
      id:'r_ui', enabled:true, match:'all', after:2, repeat:3, cooldown:0.5,
      conds:[{ left:'stars', op:'>=', right:0 }],
      groups:[{ id:'g1', match:'any', conds:[{ left:'time', op:'>=', right:5 }] }],
      actions:[{ type:'setVar', target:'v1', amount:5 }],
    }];
    _sbRender();
    const rule = document.querySelector('#sbRules .sb-rule');
    const repeatSel = rule && rule.querySelector('select[data-on-args*="s:repeat"]');
    const cool = rule && rule.querySelector('input[data-on-args*="s:cooldown"]');
    const after = rule && rule.querySelector('input[data-on-args*="s:after"]');
    const setVar = rule && Array.from(rule.querySelectorAll('select')).some(s =>
      Array.from(s.options).some(o => o.value === 'setVar' && o.selected));
    return {
      groups: document.querySelectorAll('#sbRules .sb-group').length,
      groupMatchSelect: !!document.querySelector('#sbRules .sb-group select[data-on="_sbGroupMatch"]'),
      repeat: repeatSel ? repeatSel.value : null,
      cooldown: cool ? cool.value : null,
      after: after ? after.value : null,
      setVarSelected: setVar,
    };
  });
  check('rule editor shows a nested group', ui.groups === 1 && ui.groupMatchSelect === true, JSON.stringify(ui));
  check('rule editor shows repeat, cooldown and start-after', ui.repeat === '3' && ui.cooldown === '0.5' && ui.after === '2',
    ui.repeat + '/' + ui.cooldown + '/' + ui.after);
  check('rule editor offers set variable', ui.setVarSelected === true);

  // 2. Nested ALL/ANY evaluation.
  const ev = await page.evaluate(()=>{
    const read = key => ({ stars:0, time:0, lives:3 }[key] || 0);
    const base = { match:'all', conds:[{ left:'stars', op:'>=', right:0 }],
      groups:[{ match:'any', conds:[{ left:'time', op:'>=', right:5 }, { left:'lives', op:'<=', right:99 }] }] };
    const outerAnd = _sbEvalRule(base, read);
    const outerAndBlocked = _sbEvalRule({ ...base, groups:[{ match:'any',
      conds:[{ left:'time', op:'>=', right:5 }, { left:'lives', op:'<=', right:0 }] }] }, read);
    const outerOr = _sbEvalRule({ ...base, match:'any',
      conds:[{ left:'stars', op:'>=', right:9 }],
      groups:[{ match:'any', conds:[{ left:'lives', op:'<=', right:99 }] }] }, read);
    return { outerAnd, outerAndBlocked, outerOr };
  });
  check('ALL of leaf + ANY group is true when one group arm matches', ev.outerAnd === true);
  check('ALL of leaf + ANY group is false when no group arm matches', ev.outerAndBlocked === false);
  check('rule-level ANY can combine a false leaf with a true group', ev.outerOr === true);

  // 3. Repeat/cooldown and set-variable (set, not add).
  const rt = await page.evaluate(()=>{
    const sc = window._phaserGame.scene.getScenes(false).find(s => s.scene.key === 'CustomScene') ||
      window._phaserGame.scene.getScenes(false)[0];
    liveConfig.customVars = [{ id:'v1', name:'power', value:0 }];
    liveConfig.customRules = [{ id:'r1', enabled:true, match:'all', after:0, repeat:2, cooldown:0.5,
      conds:[{ left:'stars', op:'>=', right:0 }], groups:[],
      actions:[{ type:'setVar', target:'v1', amount:5 }] }];
    _gameStartTime = Date.now();
    sc._ruleState = {}; sc._ruleFired = new Set();
    _sbRulesTick(sc);
    const a = { v: liveConfig.customVars[0].value, count: sc._ruleState.r1.count };
    _sbRulesTick(sc);
    const b = { v: liveConfig.customVars[0].value, count: sc._ruleState.r1.count };
    sc._ruleState.r1.lastAt -= 600;
    _sbRulesTick(sc);
    const c = { v: liveConfig.customVars[0].value, count: sc._ruleState.r1.count };
    sc._ruleState.r1.lastAt -= 600;
    _sbRulesTick(sc);
    const d = { v: liveConfig.customVars[0].value, count: sc._ruleState.r1.count };
    return { a, b, c, d };
  });
  check('a repeat rule fires the first time', rt.a.v === 5 && rt.a.count === 1, JSON.stringify(rt.a));
  check('cooldown blocks a second fire in the same moment', rt.b.count === 1, JSON.stringify(rt.b));
  check('a repeat rule fires again after its cooldown', rt.c.count === 2 && rt.c.v === 5, JSON.stringify(rt.c));
  check('set variable sets the value instead of adding', rt.c.v === 5);
  check('repeat stops at the requested count', rt.d.count === 2, JSON.stringify(rt.d));

  // 4. Timed trigger: start after N seconds.
  const timed = await page.evaluate(()=>{
    const sc = window._phaserGame.scene.getScenes(false).find(s => s.scene.key === 'CustomScene') ||
      window._phaserGame.scene.getScenes(false)[0];
    liveConfig.customRules = [{ id:'r2', enabled:true, match:'all', after:3, repeat:1, cooldown:0,
      conds:[{ left:'stars', op:'>=', right:0 }], groups:[],
      actions:[{ type:'addScore', target:'', amount:7 }] }];
    _gameStartTime = Date.now();
    sc._ruleState = {}; sc._ruleFired = new Set();
    const before = sc.score;
    _sbRulesTick(sc);
    const early = { score: sc.score, count: sc._ruleState.r2.count };
    _gameStartTime = Date.now() - 4000;
    _sbRulesTick(sc);
    const late = { score: sc.score, count: sc._ruleState.r2.count };
    return { before, early, late };
  });
  check('a timed rule does not fire before its start delay', timed.early.count === 0 && timed.early.score === timed.before,
    JSON.stringify(timed.early));
  check('a timed rule fires after its start delay', timed.late.count === 1 && timed.late.score === timed.before + 7,
    JSON.stringify(timed.late));

  // 5. Save/export fidelity.
  const save = await page.evaluate(()=>{
    liveConfig.customRules = [{ id:'r3', enabled:true, match:'all', after:1.5, repeat:-1, cooldown:0.75,
      conds:[{ left:'stars', op:'>=', right:2 }],
      groups:[{ id:'g', match:'all', conds:[{ left:'time', op:'>=', right:10 }] }],
      actions:[{ type:'setVar', target:'v1', amount:9 }] }];
    const d = _buildSaveData();
    const r = ((d.liveConfig || {}).customRules || [])[0];
    return r ? { after:r.after, repeat:r.repeat, cooldown:r.cooldown,
      groups:(r.groups || []).length, groupMatch:(r.groups[0] || {}).match,
      groupCond:(r.groups[0] && r.groups[0].conds[0] ? r.groups[0].conds[0].right : null),
      action:r.actions[0].type, target:r.actions[0].target } : null;
  });
  check('save keeps timed/repeat/cooldown fields', save && save.after === 1.5 && save.repeat === -1 && save.cooldown === 0.75,
    JSON.stringify(save));
  check('save keeps nested groups and their conditions', save && save.groups === 1 && save.groupMatch === 'all' && save.groupCond === 10,
    JSON.stringify(save));
  check('save keeps the set-variable action', save && save.action === 'setVar' && save.target === 'v1', JSON.stringify(save));

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER RULE CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
