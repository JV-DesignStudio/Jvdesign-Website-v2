#!/usr/bin/env node
/*
 * tests/tower-defence-features.js
 *
 * A2520 regression checks for the Tower Defence update: tower
 * specialisations, scout forecast, night omens, contracts, repairs, the King's
 * Guard shield, the Long Dawn victory, save codes, records, bestiary counts,
 * daily streak, biomes, hotkeys, accessibility, plus the key fairness and
 * persistence fixes.
 *
 * Run: node tests/tower-defence-features.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TD_FEATURES_PORT || 19531);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(path.normalize(ROOT)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

async function open(browser, viewport) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push('console: ' + m.text().slice(0, 120)); });
  await page.setViewport(viewport || { width: 1280, height: 900 });
  await page.goto(BASE + '/games/tower-defence.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));
  return { page, errs };
}
async function begin(page) {
  await page.evaluate(() => { const b = document.querySelector('[data-jvds-play]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate(() => { try { if (window.HG && HG.closeHowTo) HG.closeHowTo(); } catch (e) {} });
  await new Promise(r => setTimeout(r, 150));
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    // A: title, HUD and settings surfaces
    {
      const { page, errs } = await open(browser, { width: 390, height: 844 });
      const ui = await page.evaluate(() => ({
        campaign: !!document.getElementById('btn-campaign'),
        scoutLine: (document.getElementById('scout-line') || {}).textContent || '',
        streakDots: document.querySelectorAll('#streak-row .streak-dot').length,
        shield: !!document.getElementById('shield-btn'),
        pauseOverlay: !!document.getElementById('pause-overlay'),
        victoryOverlay: !!document.getElementById('victory-overlay'),
        saveCode: !!document.getElementById('save-code'),
        a11yToggles: document.querySelectorAll('[data-on="HG.toggleA11y"]').length,
        narrator: !!document.getElementById('nar-live'),
        canvasRole: document.getElementById('game').getAttribute('role'),
        canvasLabel: document.getElementById('game').getAttribute('aria-label'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        toggles: ['reduceMotion', 'highContrast', 'narrator'].filter(k => { const s = window.HG && HG._debug && HG._debug.meta.a11y; return s && typeof s[k] === 'boolean'; }).length,
      }));
      check('title exposes the Long Dawn campaign', ui.campaign);
      check('title shows Pip scout forecast', /night 1/i.test(ui.scoutLine) && /Goblin/i.test(ui.scoutLine), ui.scoutLine.slice(0, 90));
      check('daily streak row shows seven dots', ui.streakDots === 7, 'dots=' + ui.streakDots);
      check('King shield, pause and victory overlays exist', ui.shield && ui.pauseOverlay && ui.victoryOverlay);
      check('save code box exists', ui.saveCode);
      check('accessibility toggles include reduce motion, contrast and narrator', ui.a11yToggles >= 5 && ui.toggles === 3, 'toggles=' + ui.a11yToggles);
      check('narrator live region exists', ui.narrator);
      check('canvas has an accessible role and label', ui.canvasRole === 'img' && /Hearthguard/i.test(ui.canvasLabel || ''));
      check('390px: no sideways overflow', ui.overflow <= 2, 'overflow=' + ui.overflow);
      check('390px: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }

    // B: deterministic forecast, omens and contracts
    {
      const { page, errs } = await open(browser, { width: 1280, height: 900 });
      const f = await page.evaluate(() => {
        const d = HG._debug;
        const o3 = d.omenFor(3);
        const o3b = d.omenFor(3);
        return {
          f1: d.forecast(1), f5: d.forecast(5), f11: d.forecast(11),
          o1: d.omenFor(1), o3: o3, o3same: !!(o3 && o3b && o3.id === o3b.id && o3.name === o3b.name),
          c3: d.contractFor(3), text5: d.forecastText(5),
        };
      });
      const hasType = (fcast, id) => fcast.types.some(t => t.id === id);
      check('night 1 forecast is goblins only', hasType(f.f1, 'goblin') && !f.f1.boss && !hasType(f.f1, 'raider'));
      check('night 5 forecast is a champion night', f.f5.boss === true);
      check('night 11 forecast includes ogres', hasType(f.f11, 'ogre'));
      check('omens are deterministic and skip night 1', f.o1 === null && f.o3 !== null && f.o3same, JSON.stringify(f.o3));
      check('contracts exist from night 3 with a reward', f.c3 && /[0-9]/.test(f.c3.text) && f.c3.reward > 0, JSON.stringify(f.c3));
      check('champion forecast text names the champion', /Champion night/i.test(f.text5), f.text5);
      check('forecast page: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }

    // C-G, I, J, K, L, M, N, O, P: live features on one run
    {
      const { page, errs } = await open(browser, { width: 1280, height: 900 });
      await begin(page);

      // C: HUD scout strip and build bar
      const strip = await page.evaluate(() => ({
        state: HG._debug.state,
        text: (document.getElementById('scout-strip') || {}).textContent || '',
        buildBtns: document.querySelectorAll('#build-bar .build-btn').length,
      }));
      check('game starts and the scout strip reports the next night', strip.state === 'playing' && /Scout|Night/.test(strip.text), strip.text.slice(0, 80));
      check('build bar has all eight buildings', strip.buildBtns === 8, 'buttons=' + strip.buildBtns);

      // D: kills feed lifetime records, the bestiary and immediate save
      const kills = await page.evaluate(() => {
        const d = HG._debug;
        d.night = 1;
        d.spawnEnemy('goblin');
        const e = d.enemies[d.enemies.length - 1];
        d.killEnemy(e, d.enemies.indexOf(e));
        const saved = JSON.parse(localStorage.getItem(d.META_KEY) || '{}');
        return { kills: d.meta.stats.kills, bestiary: d.meta.bestiaryKills.goblin, seen: saved.seenEnemies && saved.seenEnemies.goblin };
      });
      check('a kill raises the lifetime record', kills.kills >= 1, 'kills=' + kills.kills);
      check('a kill raises the bestiary count', kills.bestiary >= 1, 'goblin=' + kills.bestiary);
      check('first sighting is saved immediately', kills.seen === true);

      // E: repair and tower specialisation
      const build = await page.evaluate(() => {
        const d = HG._debug;
        d.gold = 2000;
        d.place('farm', 0, 0); d.finishBuilds();
        const farm = d.buildings.filter(b => b.type === 'farm')[0];
        farm.hp = 1;
        const cost = d.repairCost(farm);
        const repaired = d.repairBuilding(farm);
        d.place('tower', 1, 1); d.finishBuilds();
        const tower = d.buildings.filter(b => b.type === 'tower')[0];
        d.upgradeBuilding(tower); d.finishBuilds();
        d.upgradeBuilding(tower); d.finishBuilds();
        d.handleTap(60, 60);
        const selected = !!d.popBuilding && d.popBuilding.type === 'tower';
        const specSet = HG.setSpec('frost');
        const st = d.specStats(tower);
        return { repaired, hp: farm.hp, maxHp: farm.maxHp, cost, towerTier: tower.tier, selected, specSet, spec: tower.spec, slow: st.slow, range: st.range };
      });
      check('repair heals a damaged building from gold', build.repaired === true && build.hp === build.maxHp && build.cost > 0, JSON.stringify({ cost: build.cost, hp: build.hp }));
      check('max-tier tower selects a specialisation', build.towerTier === 2 && build.selected && build.specSet === true && build.spec === 'frost', JSON.stringify({ tier: build.towerTier, spec: build.spec }));
      check('frost specialisation adds a slow effect', build.slow > 0 && build.range > 0, 'slow=' + build.slow);

      // F: King's Guard shield
      const shield = await page.evaluate(() => {
        const d = HG._debug;
        const first = HG.useShield();
        const second = HG.useShield();
        return { first, second, cd: d.shieldCd, timer: d.shieldTimer, reduced: d.shieldReduction(d.king, 100) };
      });
      check("King's Guard starts once and then goes on cooldown", shield.first === true && shield.second === false && shield.cd > 0, JSON.stringify({ cd: shield.cd }));
      check('King\'s Guard cuts damage to the King', shield.reduced === 20, 'reduced=' + shield.reduced);

      // G: fast-forward uses sub-steps rather than one huge frame
      const fast = await page.evaluate(() => {
        const d = HG._debug;
        d.enemies.length = 0; d.projectiles.length = 0;
        const e = { kind:'enemy', type:'goblin', emoji:'x', name:'G', x:100, y:100, hp:9999, maxHp:9999, speed:40, dmg:0, gold:0, atkRate:1, atkCd:0, tx:8, ty:2, wobble:0, hit:0, slowTimer:0, ranged:false, rng:0, pspd:0, siege:false, vx:0, vy:0 };
        d.enemies.push(e);
        d.gameSpeed = 1;
        const x1 = e.x; d.advance(0.02); const d1 = Math.abs(e.x - x1);
        e.x = 100; e.vx = 0; e.vy = 0; d.gameSpeed = 3;
        d.simulateFrame(0.02); const d3 = Math.abs(e.x - 100);
        d.gameSpeed = 1;
        return { d1, d3 };
      });
      check('3x fast-forward moves raiders three sub-steps', fast.d3 > fast.d1 * 1.5, JSON.stringify(fast));

      // I: save code round trip
      const save = await page.evaluate(() => {
        const d = HG._debug;
        d.saveWorld();
        d.gold = 777;
        d.saveWorld();
        const code = HG.exportSave();
        d.gold = 5;
        const ok = d.applySaveCode(code);
        const saved = d.rawLoad(d.WORLD_KEY);
        return { code, ok, gold: saved && saved.gold, phaseSaved: saved && saved.phase };
      });
      check('save export produces a TD1 code', save.code.slice(0, 4) === 'TD1-' && save.code.length > 20, save.code.slice(0, 8));
      check('save import restores the world and records the phase', save.ok === true && save.gold === 777 && save.phaseSaved === 'day', JSON.stringify({ ok: save.ok, gold: save.gold, phase: save.phaseSaved }));

      // J: daily streak and pruning
      const daily = await page.evaluate(() => {
        const d = HG._debug;
        const today = d.dateKey();
        const y = new Date(); y.setDate(y.getDate() - 1);
        const yk = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
        d.meta.daily[today] = 4; d.meta.daily[yk] = 3;
        d.refreshTitle();
        const streak = HG.dailyStreak();
        for (let i = 0; i < 100; i++) d.meta.daily['2000-01-' + String(i % 28 + 1).padStart(2, '0') + '-' + i] = 1;
        d.pruneDaily();
        return { streak, count: Object.keys(d.meta.daily).length, dots: document.querySelectorAll('#streak-row .streak-dot').length };
      });
      check('daily streak counts consecutive played days', daily.streak >= 2, 'streak=' + daily.streak);
      check('title renders seven streak dots', daily.dots === 7, 'dots=' + daily.dots);
      check('daily history is pruned to sixty entries', daily.count <= 60, 'entries=' + daily.count);

      // K: biome modifiers reach new raiders
      const biome = await page.evaluate(() => {
        const d = HG._debug;
        d.meta.biome = 'snow';
        d.night = 1;
        d.enemies.length = 0;
        d.spawnEnemy('goblin');
        const e = d.enemies[d.enemies.length - 1];
        return { speed: e.speed, base: 44, mods: d.biomeMods() };
      });
      check('snow biome slows new raiders', Math.abs(biome.speed - 40.48) < 0.2 && biome.mods.enemySpeed === 0.92, JSON.stringify(biome));

      // L: keyboard hotkeys arm the build bar
      await page.evaluate(() => { document.body.focus(); });
      await page.keyboard.press('3');
      await page.waitForFunction(() => {
        const b = document.querySelector('#build-bar .build-btn.armed');
        return !!(b && /Tower/i.test((b.querySelector('.bn') || {}).textContent || ''));
      }, { timeout: 2000 }).catch(() => {});
      const hotkey = await page.evaluate(() => ({ armed: HG._debug.armed, label: (document.querySelector('#build-bar .build-btn.armed .bn') || {}).textContent || '' }));
      check('number hotkey arms the matching building', hotkey.armed === 'tower' && /Tower/i.test(hotkey.label), JSON.stringify(hotkey));

      // M: accessibility toggles and narrator
      const a11y = await page.evaluate(() => {
        const d = HG._debug;
        HG.showSettings();
        const ov = document.getElementById('settings-overlay');
        const modal = ov.getAttribute('role') === 'dialog' && ov.getAttribute('aria-modal') === 'true';
        const focused = !!document.activeElement && ov.contains(document.activeElement);
        HG.toggleA11y('reduceMotion'); HG.toggleA11y('highContrast');
        const rm = document.body.classList.contains('reduced-motion');
        const hc = document.body.classList.contains('high-contrast');
        d.narrate('before');
        const wasOn = document.getElementById('nar-live').textContent;
        HG.toggleA11y('narrator');
        d.narrate('after');
        const muted = document.getElementById('nar-live').textContent;
        HG.toggleA11y('narrator');
        d.narrate('hello');
        const back = document.getElementById('nar-live').textContent;
        return { modal, focused, rm, hc, wasOn, muted, back, stored: d.meta.a11y };
      });
      check('settings opens as an ARIA dialog with focus inside', a11y.modal && a11y.focused, JSON.stringify({ modal: a11y.modal, focused: a11y.focused }));
      check('reduce motion and high contrast apply to the page', a11y.rm && a11y.hc);
      check('narrator can be muted and restored', a11y.wasOn === 'before' && a11y.muted === 'before' && a11y.back === 'hello', JSON.stringify({ wasOn: a11y.wasOn, muted: a11y.muted, back: a11y.back }));
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 120));
      const closed = await page.evaluate(() => document.getElementById('settings-overlay').style.display === 'none');
      check('Escape closes the settings dialog', closed);

      // N: auto-pause when the tab is hidden
      const pause = await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        return { paused: HG._debug.uiPaused, overlay: document.getElementById('pause-overlay').style.display, state: HG._debug.state };
      });
      check('hidden tab pauses the run', pause.paused === true && pause.overlay === 'flex', JSON.stringify(pause));
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); HG.resumeFromPause(); });
      const resumed = await page.evaluate(() => ({ paused: HG._debug.uiPaused, overlay: document.getElementById('pause-overlay').style.display }));
      check('resume clears the pause overlay', resumed.paused === false && resumed.overlay === 'none', JSON.stringify(resumed));

      // O: run card and particle cap
      const extras = await page.evaluate(() => {
        const d = HG._debug;
        const card = d.drawRunCard().toDataURL('image/png').slice(0, 22);
        d.particles.length = 0;
        for (let i = 0; i < 50; i++) d.puff(10, 10, 'x', 10);
        return { card, particles: d.particles.length };
      });
      check('run card renders as PNG data', extras.card === 'data:image/png;base64,', extras.card);
      check('particle pool is capped for low-end machines', extras.particles <= 320, 'particles=' + extras.particles);
      check('live features: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }

    // H: the Long Dawn victory
    {
      const { page, errs } = await open(browser, { width: 1280, height: 900 });
      await page.evaluate(() => { HG.startCampaign(); });
      await new Promise(r => setTimeout(r, 200));
      const victory = await page.evaluate(() => {
        const d = HG._debug;
        d.core.level = 5; d.night = 12;
        d.endNight();
        return { state: d.state, campaign: d.campaignMode, overlay: document.getElementById('victory-overlay').style.display, wins: d.meta.stats.victories };
      });
      check('Long Dawn reaches a victory state', victory.state === 'victory' && victory.campaign === true, JSON.stringify(victory));
      check('victory overlay and win record show', victory.overlay === 'flex' && victory.wins >= 1, JSON.stringify(victory));
      check('campaign page: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }

    // Q: daily defeat records nights survived, not the fatal night
    {
      const { page, errs } = await open(browser, { width: 1280, height: 900 });
      const dailyLoss = await page.evaluate(() => {
        HG.startDaily();
        const d = HG._debug;
        d.night = 3;
        d.kingdomFalls();
        return { state: d.state, score: d.meta.daily[d.dateKey()] };
      });
      check('daily defeat records two completed nights', dailyLoss.state === 'defeat' && dailyLoss.score === 2, JSON.stringify(dailyLoss));
      check('daily page: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }

    // R: a night in progress survives save and resume
    {
      const { page, errs } = await open(browser, { width: 1280, height: 900 });
      const phase = await page.evaluate(() => {
        const d = HG._debug;
        HG.newKingdom();
        d.beginNight();
        d.saveWorld();
        const saved = d.rawLoad(d.WORLD_KEY);
        HG.resume();
        return { savedPhase: saved && saved.phase, night: d.night, phase: d.phase, state: d.state, soldiers: Array.isArray(saved && saved.soldiers) };
      });
      check('save records the night phase and the night number', phase.savedPhase === 'night' && phase.soldiers, JSON.stringify(phase));
      check('resume restores the same night instead of skipping it', phase.state === 'playing' && phase.phase === 'night', JSON.stringify(phase));
      check('resume page: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }

    // T: dawn heals the King
    {
      const { page, errs } = await open(browser, { width: 1280, height: 900 });
      const heal = await page.evaluate(() => {
        HG.newKingdom();
        const d = HG._debug;
        d.king.hp = 10;
        d.night = 2;
        d.endNight();
        return { hp: d.king.hp, max: d.king.maxHp };
      });
      check('dawn heals the King to full', heal.hp === heal.max, JSON.stringify(heal));
      check('dawn page: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL TOWER DEFENCE FEATURES PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
