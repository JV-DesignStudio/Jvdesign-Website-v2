#!/usr/bin/env node
/* Lumo's Hive Strike deep feature test (A2919).

   The Hive is now a tactical formation defence: linked formations, a honey
   economy, boon drafting, buildable turrets, a three-phase queen and four
   modes. This page proves those systems work in a real browser, not just
   that the page loads.

   Run: node tests/lumo-hive-features.js
*/
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function staticChecks() {
  const html = fs.readFileSync(path.join(ROOT, 'games/lumo-hive.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'assets/js/inline/games-lumo-hive-1.js'), 'utf8');
  ok('page has a honey HUD', /id="honeyHud"/.test(html));
  ok('page has four run modes', /data-mode="campaign"/.test(html) && /data-mode="endless"/.test(html) && /data-mode="daily"/.test(html) && /data-mode="bossrush"/.test(html));
  ok('page has the Garden Forge', /id="forge"/.test(html) && /id="boonRow"/.test(html) && /id="turretShop"/.test(html));
  ok('page has the Hive Ledger', /id="ledger"/.test(html) && /id="relicList"/.test(html));
  ok('game defines hive links', /function assignLinks/.test(js) && /function breakLinks/.test(js));
  ok('game defines honey and turrets', /function addHoney/.test(js) && /function buildTurret/.test(js));
  ok('game defines boons and evolutions', /const BOONS/.test(js) && /function applyBoon/.test(js) && /const EVOLUTIONS/.test(js));
  ok('game defines boss phases', /function phaseShift/.test(js) && /boss\.phase/.test(js));
}

(async () => {
  staticChecks();
  const server = http.createServer((req, res) => {
    let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) { } });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(base + '/games/lumo-hive.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.__lumoHive, { timeout: 10000 });
    await sleep(150);
    const snap = () => page.evaluate(() => window.__lumoHive.state());
    const call = (fn, ...args) => page.evaluate((name, a) => window.__lumoHive[name](...a), fn, args);

    const boot = await snap();
    ok('phone: starts on the menu', boot.gameState === 'idle' && boot.mode === 'campaign', JSON.stringify({ gameState: boot.gameState, mode: boot.mode }));
    ok('phone: four modes are rendered', await page.evaluate(() => document.querySelectorAll('#modeRow .mode-pill').length === 4));
    ok('phone: the hive bank line is shown', /Hive bank/.test(await page.evaluate(() => document.getElementById('bankLine').textContent)));
    ok('phone: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    await call('setMode', 'daily');
    const dailyHint = await page.evaluate(() => document.getElementById('dailyHint').textContent);
    ok('phone: daily mode surfaces the streak', /streak/i.test(dailyHint), dailyHint);
    await call('setMode', 'campaign');

    await call('setBank', 500);
    await page.evaluate(() => document.getElementById('ledgerBtn').click());
    ok('phone: the Hive Ledger opens', await page.evaluate(() => !document.getElementById('ledger').classList.contains('hidden')));
    const beforeRelic = await snap();
    const bought = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#relicList .relic button')].find((b) => !b.disabled);
      if (!btn) return false;
      btn.click(); return true;
    });
    const afterRelic = await snap();
    ok('phone: a relic can be bought with banked honey', bought && afterRelic.bankedHoney < beforeRelic.bankedHoney && Object.values(afterRelic.relics).some((n) => n > 0), JSON.stringify({ before: beforeRelic.bankedHoney, after: afterRelic.bankedHoney, relics: afterRelic.relics }));
    await page.evaluate(() => document.getElementById('ledgerClose').click());

    await call('start');
    await sleep(200);
    const started = await snap();
    ok('phone: campaign starts with enemies and hive links', started.gameState === 'playing' && started.enemies > 0 && started.anchors >= 1 && started.linked >= 1, JSON.stringify({ enemies: started.enemies, anchors: started.anchors, linked: started.linked }));
    ok('phone: shields start at the relic-adjusted maximum', started.lives >= 3, 'lives=' + started.lives);
    ok('phone: the first run shows the coach', started.coachActive === true && started.coachDone === false, JSON.stringify({ active: started.coachActive, done: started.coachDone }));
    await call('endCoach');
    ok('phone: the coach can be dismissed and stays dismissed', (await snap()).coachDone === true);

    const beforeAnchor = await snap();
    await call('killAnchor');
    await sleep(80);
    const afterAnchor = await snap();
    ok('phone: killing the anchor breaks every hive link', beforeAnchor.linked > 0 && afterAnchor.linked === 0, JSON.stringify({ before: beforeAnchor.linked, after: afterAnchor.linked }));
    ok('phone: breaking a link pays honey', afterAnchor.honey > beforeAnchor.honey, beforeAnchor.honey + ' -> ' + afterAnchor.honey);

    await call('addHoney', 80);
    const built = await call('buildTurret', 0);
    const upgraded = await call('upgradeTurret', 0);
    const turretState = await snap();
    ok('phone: a honey turret can be built', built === true && turretState.turrets.length === 1 && turretState.turrets[0].level === 2, JSON.stringify(turretState.turrets));
    ok('phone: upgrading a turret costs honey', upgraded === true);
    await sleep(900);
    const firing = await snap();
    ok('phone: turrets auto-fire at the swarm', firing.turretShots > 0, 'shots=' + firing.turretShots);

    await call('clearWave');
    await sleep(1600);
    const naturalForge = await snap();
    ok('phone: clearing a wave opens the Garden Forge by itself', naturalForge.forgeOpen === true && naturalForge.gameState === 'forge', JSON.stringify({ open: naturalForge.forgeOpen, state: naturalForge.gameState }));
    await call('continueForge');
    await sleep(150);

    await call('forceForge');
    await sleep(80);
    const forge = await snap();
    ok('phone: the Garden Forge offers three boons', forge.forgeOpen === true && forge.gameState === 'forge' && forge.forgeChoices.length === 3, JSON.stringify({ open: forge.forgeOpen, choices: forge.forgeChoices }));
    const firstBoon = forge.forgeChoices[0];
    await call('chooseBoon', firstBoon);
    const drafted = await snap();
    ok('phone: drafting a boon records it', drafted.boons[firstBoon] >= 1 && drafted.forgePicked === true, JSON.stringify(drafted.boons));
    const waveBefore = drafted.wave;
    await call('continueForge');
    await sleep(120);
    const advanced = await snap();
    ok('phone: leaving the forge starts the next wave', advanced.wave === waveBefore + 1 && advanced.gameState === 'playing', waveBefore + ' -> ' + advanced.wave);

    await call('spawnBoss');
    await sleep(100);
    const boss = await snap();
    ok('phone: a queen boss spawns with three phases', boss.bossAlive && boss.bossPhase === 1 && boss.bossMax > 0, JSON.stringify({ hp: boss.bossHp, max: boss.bossMax, phase: boss.bossPhase }));
    await call('damageBoss', Math.max(1, Math.round(boss.bossMax * 0.4)));
    await sleep(120);
    const p2 = await snap();
    ok('phone: the queen shifts to phase 2', p2.bossPhase === 2, 'phase=' + p2.bossPhase + ' hp=' + p2.bossHp);
    await call('damageBoss', Math.max(1, Math.round(boss.bossMax * 0.3)));
    await sleep(120);
    const p3 = await snap();
    ok('phone: the queen shifts to phase 3', p3.bossPhase === 3, 'phase=' + p3.bossPhase + ' hp=' + p3.bossHp);

    await call('lose');
    await sleep(100);
    await call('setMode', 'endless');
    await call('start');
    await sleep(120);
    const endless = await snap();
    ok('phone: endless mode starts', endless.mode === 'endless' && endless.gameState === 'playing');
    await call('lose');

    await call('setMode', 'daily');
    await call('start');
    await sleep(120);
    const daily = await snap();
    ok('phone: daily mode uses a dated seed', daily.mode === 'daily' && /^lumo-hive-\d{4}-\d{2}-\d{2}$/.test(daily.seed), daily.seed);
    await call('lose');

    await call('setMode', 'bossrush');
    await call('start');
    await sleep(120);
    const rush = await snap();
    ok('phone: boss rush opens on a queen', rush.mode === 'bossrush' && rush.bossAlive === true);

    const runCard = await call('makeRunCard');
    ok('phone: the Hive run card renders a PNG', typeof runCard === 'string' && runCard.startsWith('data:image/png') && runCard.length > 1000, 'len=' + (runCard ? runCard.length : 0));
    ok('phone: the end screen offers the run card', await page.evaluate(() => !!document.getElementById('runCardBtn')));

    ok('phone: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();

    const desktop = await browser.newPage();
    const derrs = [];
    desktop.on('pageerror', (e) => derrs.push(e.message));
    await desktop.setViewport({ width: 1440, height: 900 });
    await desktop.goto(base + '/games/lumo-hive.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await desktop.waitForFunction(() => !!window.__lumoHive, { timeout: 10000 });
    await desktop.evaluate(() => window.__lumoHive.start());
    await sleep(150);
    ok('desktop 1440: the run starts', await desktop.evaluate(() => window.__lumoHive.state().gameState === 'playing'));
    ok('desktop 1440: no horizontal overflow', await desktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    ok('desktop 1440: no page errors', derrs.length === 0, derrs.slice(0, 2).join(' | '));
    await desktop.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL HIVE FEATURE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
