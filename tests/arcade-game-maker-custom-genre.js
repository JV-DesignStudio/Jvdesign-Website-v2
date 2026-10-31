#!/usr/bin/env node
/*
 * tests/arcade-game-maker-custom-genre.js , A2157
 * The Custom Sandbox is the maker's first make-your-own-mechanic genre:
 *  - its settings appear only when CUSTOM is selected,
 *  - the sliders write into liveConfig and survive a project save,
 *  - a single star can be collected to win,
 *  - a chaser costs a life on contact.
 * Run: node tests/arcade-game-maker-custom-genre.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_CUSTOM_PORT || 8995;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

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
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window.compileAndBootEngine === 'function' &&
    typeof window._arcCustomSync === 'function', {timeout:20000});

  // 1. Settings appear only for CUSTOM and write into liveConfig.
  const ui = await page.evaluate(() => {
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    const group = document.getElementById('customSandboxGroup');
    const label = document.getElementById('customSandboxLabel');
    const range = document.getElementById('customStarTargetRange');
    range.value = 5;
    range.dispatchEvent(new Event('input', { bubbles: true }));
    const shown = { group: getComputedStyle(group).display, label: getComputedStyle(label).display,
      value: liveConfig.customStarTarget };
    document.getElementById('genreMode').value = 'SHOOTER';
    onGenreChange();
    return { shown, hidden: getComputedStyle(group).display };
  });
  check('sandbox settings show only for CUSTOM', ui.shown.group === 'flex' && ui.hidden === 'none',
    ui.shown.group + ' / ' + ui.hidden);
  check('sandbox settings label shows only for CUSTOM', ui.shown.label !== 'none');
  check('star slider writes into liveConfig', ui.shown.value === 5, String(ui.shown.value));

  // 2. Project save keeps the sandbox values.
  const save = await page.evaluate(() => {
    liveConfig.customStarTarget = 7;
    liveConfig.customEnemyCount = 2;
    liveConfig.customVars = [{ id: 'vsave', name: 'saved', value: 3 }];
    liveConfig.customRules = [{ id: 'rsave', enabled: true, match: 'all',
      conds: [{ left: 'stars', op: '>=', right: 1 }],
      actions: [{ type: 'addScore', target: '', amount: 25 }] }];
    const d = _buildSaveData();
    return { star: d.liveConfig.customStarTarget, enemy: d.liveConfig.customEnemyCount,
      vars: (d.liveConfig.customVars || []).length, rules: (d.liveConfig.customRules || []).length };
  });
  check('sandbox values survive project save', save.star === 7 && save.enemy === 2, save.star + '/' + save.enemy);
  check('sandbox variables and rules survive project save', save.vars === 1 && save.rules === 1,
    save.vars + '/' + save.rules);

  // 3. Boot a one-star sandbox, collect it, win.
  await page.evaluate(() => {
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    liveConfig.customStarTarget = 1;
    liveConfig.customEnemyCount = 0;
    liveConfig.customEnemySpeed = 0;
    compileAndBootEngine();
    // The title screen gates the scene; dismiss it to start.
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, {timeout:20000});
  await sleep(600);
  const start = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const star = sc.stars.getChildren().find(c => c.active);
    if (star) sc.actor.setPosition(star.x, star.y);
    return { stars: sc.stars.countActive(true), target: sc._target };
  });
  check('sandbox spawns the chosen number of stars', start.stars === 1 && start.target === 1, start.stars + '/' + start.target);
  await sleep(600);
  const win = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { collected: sc._collected, done: sc._done,
      overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('collecting every star wins the run', win.collected === 1 && win.done === true && win.overlay === true,
    JSON.stringify(win));

  // 4. Boot a sandbox with one chaser and let it catch the player.
  await sleep(800); // compileAndBootEngine has a 700ms re-entry guard
  await page.evaluate(() => {
    liveConfig.customStarTarget = 3;
    liveConfig.customEnemyCount = 1;
    liveConfig.customEnemySpeed = 0;
    compileAndBootEngine();
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, {timeout:20000});
  await sleep(600);
  const hit = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const before = gameState.lives;
    const enemy = sc.enemies.getChildren().find(c => c.active);
    if (enemy) sc.actor.setPosition(enemy.x, enemy.y);
    return { before, enemies: sc.enemies.countActive(true) };
  });
  await sleep(500);
  const after = await page.evaluate(() => ({ lives: gameState.lives, hearts: document.getElementById('heartsDisplay').textContent }));
  check('sandbox spawns the chosen number of chasers', hit.enemies === 1, String(hit.enemies));
  check('a chaser costs a life on contact', after.lives === hit.before - 1, hit.before + ' -> ' + after.lives);
  check('hearts HUD updates', after.hearts.length > 0, after.hearts);

  // 5. Variables and ALL/ANY rules.
  const bootCustom = async (overrides) => {
    await sleep(800); // compileAndBootEngine has a 700ms re-entry guard
    await page.evaluate((o) => {
      Object.assign(liveConfig, o);
      document.getElementById('genreMode').value = 'CUSTOM';
      onGenreChange();
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, overrides);
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout: 20000 });
    await sleep(600);
  };

  const sbUi = await page.evaluate(() => {
    liveConfig.customVars = [{ id: 'vtest', name: 'power', value: 0 }];
    liveConfig.customRules = [
      { id: 'rall', enabled: true, match: 'all',
        conds: [{ left: 'stars', op: '>=', right: 1 }, { left: 'lives', op: '>=', right: 1 }],
        actions: [{ type: 'addVar', target: 'vtest', amount: 2 }] },
      { id: 'rany', enabled: true, match: 'any',
        conds: [{ left: 'stars', op: '>=', right: 99 }, { left: 'time', op: '>=', right: 0 }],
        actions: [{ type: 'addScore', target: '', amount: 50 }] }
    ];
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    _sbRender();
    return {
      vars: document.querySelectorAll('#sbVars .sb-row').length,
      rules: document.querySelectorAll('#sbRules .sb-rule').length,
      condRows: document.querySelectorAll('#sbRules .sb-rule .sb-row').length,
      winModes: document.querySelectorAll('#sbWinMode option').length
    };
  });
  check('sandbox UI renders variables and rules', sbUi.vars === 1 && sbUi.rules === 2 && sbUi.condRows >= 4,
    JSON.stringify(sbUi));
  check('sandbox offers four win modes', sbUi.winModes === 4, String(sbUi.winModes));

  await bootCustom({ customStarTarget: 3, customEnemyCount: 0, customEnemySpeed: 0,
    customWinMode: 'score', customWinValue: 9999, customGoldStars: false, customFastEnemies: false });
  const ruleStart = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { score: sc.score };
  });
  check('an ANY rule fires on the first tick', ruleStart.score >= 50, String(ruleStart.score));
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const s = sc.stars.getChildren().find(c => c.active);
    if (s) sc.actor.setPosition(s.x, s.y);
  });
  await sleep(700);
  const ruleAfter = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { power: liveConfig.customVars[0].value, score: sc.score };
  });
  check('an ALL rule runs after one star', ruleAfter.power === 2, JSON.stringify(ruleAfter));

  // 6. Score win.
  await bootCustom({ customWinMode: 'score', customWinValue: 100, customStarTarget: 3,
    customEnemyCount: 0, customEnemySpeed: 0, customGoldStars: false, customFastEnemies: false });
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const s = sc.stars.getChildren().find(c => c.active);
    if (s) sc.actor.setPosition(s.x, s.y);
  });
  await sleep(700);
  const scoreWin = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { done: sc._done, overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('reaching the score wins the run', scoreWin.done === true && scoreWin.overlay === true, JSON.stringify(scoreWin));

  // 7. Time win.
  await bootCustom({ customWinMode: 'time', customWinValue: 1, customStarTarget: 5,
    customEnemyCount: 0, customEnemySpeed: 0, customGoldStars: false, customFastEnemies: false });
  await sleep(1500);
  const timeWin = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { done: sc._done, overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('surviving the time wins the run', timeWin.done === true && timeWin.overlay === true, JSON.stringify(timeWin));

  // 8. Gold stars and fast chasers every third.
  await bootCustom({ customWinMode: 'collect', customWinValue: 0, customStarTarget: 3,
    customEnemyCount: 3, customEnemySpeed: 70, customGoldStars: true, customFastEnemies: true });
  const types = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const stars = sc.stars.getChildren().filter(c => c.active);
    const enemies = sc.enemies.getChildren().filter(c => c.active);
    const gold = stars.find(s => s.getData('gold'));
    if (gold) sc.actor.setPosition(gold.x, gold.y);
    return {
      stars: stars.length,
      goldCount: stars.filter(s => s.getData('gold')).length,
      goldTex: !!gold && gold.texture.key === '_custom_star_gold',
      enemies: enemies.length,
      fast: enemies.some(e => Math.round(e.getData('speed')) === 112)
    };
  });
  check('a gold star appears every third', types.goldCount === 1 && types.goldTex, JSON.stringify(types));
  check('a fast chaser appears every third', types.fast === true);
  await sleep(700);
  const goldScore = await page.evaluate(() => window._phaserGame.scene.getScenes(true)[0].score);
  check('the gold star is worth 300', goldScore >= 300, String(goldScore));

  // 9. In-maker entity placement, spawn start and goal win.
  const placed = await page.evaluate(() => {
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    customLevelEntities = null;
    tmSetEntity('star');  _paintEntity(3 * 20 + 2);
    tmSetEntity('enemy'); _paintEntity(4 * 20 + 5);
    tmSetEntity('spawn'); _paintEntity(1 * 20 + 1);
    tmSetEntity('goal');  _paintEntity(10 * 20 + 10);
    return JSON.parse(JSON.stringify(customLevelEntities));
  });
  check('editor places stars and chasers', placed.coins.length === 1 && placed.coins[0].join(',') === '2,3' &&
    placed.enemies.length === 1 && placed.enemies[0].join(',') === '5,4', JSON.stringify(placed));
  check('editor places a spawn and a goal', placed.spawn.join(',') === '1,1' && placed.goal.join(',') === '10,10',
    JSON.stringify({ spawn: placed.spawn, goal: placed.goal }));

  await bootCustom({ customWinMode: 'goal', customWinValue: 0, customStarTarget: 1,
    customEnemyCount: 0, customEnemySpeed: 0, customGoldStars: false, customFastEnemies: false });
  const goalStart = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { x: Math.round(sc.actor.x), y: Math.round(sc.actor.y), mode: sc._winMode, hasGoal: !!sc._goal };
  });
  check('the sandbox starts the player at the spawn', Math.abs(goalStart.x - 48) <= 8 && Math.abs(goalStart.y - 40) <= 8,
    JSON.stringify(goalStart));
  check('the goal win mode creates a goal marker', goalStart.mode === 'goal' && goalStart.hasGoal === true);
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    if (sc._goal) sc.actor.setPosition(sc._goal.x, sc._goal.y);
  });
  await sleep(700);
  const goalWin = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { done: sc._done, overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('reaching the goal wins the run', goalWin.done === true && goalWin.overlay === true, JSON.stringify(goalWin));

  // 10. Checkpoint save, normal boot, and continue.
  const cpUi = await page.evaluate(() => {
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    const shown = getComputedStyle(document.getElementById('pauseCheckpointBtn')).display;
    document.getElementById('genreMode').value = 'SHOOTER';
    onGenreChange();
    return { shown, hidden: getComputedStyle(document.getElementById('pauseCheckpointBtn')).display };
  });
  check('checkpoint button shows only for CUSTOM', cpUi.shown !== 'none' && cpUi.hidden === 'none', JSON.stringify(cpUi));

  await bootCustom({ customWinMode: 'collect', customWinValue: 0, customStarTarget: 3,
    customEnemyCount: 1, customEnemySpeed: 0, customGoldStars: false, customFastEnemies: false,
    customRules: [], customVars: [] });
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const s = sc.stars.getChildren().find(c => c.active);
    if (s) sc.actor.setPosition(s.x, s.y);
  });
  await sleep(500);
  // Move to a corner away from the stationary chaser so the save position is stable.
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const e = sc.enemies.getChildren().find(c => c.active);
    if (e) sc.actor.setPosition(e.x < 320 ? 600 : 40, e.y < 200 ? 360 : 40);
    else sc.actor.setPosition(100, 100);
  });
  await sleep(200);
  const saved = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    sc._sbCheckpoint();
    const cp = JSON.parse(localStorage.getItem('jv_sandbox_checkpoint'));
    return { collected: cp.collected, stars: cp.stars.length, enemies: cp.enemies.length, score: cp.score, x: cp.player.x };
  });
  check('checkpoint saves the run state', saved.collected === 1 && saved.stars === 2 && saved.enemies === 1 && saved.score >= 100,
    JSON.stringify(saved));

  await bootCustom({ customWinMode: 'collect', customWinValue: 0, customStarTarget: 3,
    customEnemyCount: 1, customEnemySpeed: 0, customGoldStars: false, customFastEnemies: false,
    customRules: [], customVars: [] });
  const normal = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { collected: sc._collected, score: sc.score };
  });
  check('a normal boot does not auto-resume', normal.collected === 0 && normal.score === 0, JSON.stringify(normal));

  await page.evaluate(() => { window.__sbResume = true; });
  await bootCustom({ customWinMode: 'collect', customWinValue: 0, customStarTarget: 3,
    customEnemyCount: 1, customEnemySpeed: 0, customGoldStars: false, customFastEnemies: false,
    customRules: [], customVars: [] });
  const resumed = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { collected: sc._collected, score: sc.score, stars: sc.stars.countActive(true),
      enemies: sc.enemies.countActive(true), lives: gameState.lives, x: Math.round(sc.actor.x) };
  });
  check('continue restores the checkpoint', resumed.collected === 1 && resumed.score >= 100 &&
    resumed.stars === 2 && resumed.enemies === 1, JSON.stringify(resumed));
  check('continue restores the player position', Math.abs(resumed.x - saved.x) <= 6, saved.x + ' -> ' + resumed.x);

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER CUSTOM-GENRE CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
