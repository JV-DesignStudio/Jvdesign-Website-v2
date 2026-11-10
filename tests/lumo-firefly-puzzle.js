#!/usr/bin/env node
/* Lumo's Firefly Shooter puzzle test (A2919).

   The game is now a cosy hex match puzzle, not a wave shooter. This test
   drives the real match, rescue, bomb, drop and shadow-row logic, plus one
   live launch, so the depth is proven rather than just the page loading.

   Run: node tests/lumo-firefly-puzzle.js
*/
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function staticChecks() {
  const html = fs.readFileSync(path.join(ROOT, 'games/lumo_firefly_night.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'assets/js/inline/games-lumo-firefly-night-1.js'), 'utf8');
  ok('page keeps the canvas and start controls', /id="game"/.test(html) && /id="start"/.test(html) && /id="startMain"/.test(html));
  ok('page keeps pace and run pills', /id="diffPills"/.test(html) && /id="modePills"/.test(html));
  ok('game builds a hex grid', /const COLS/.test(js) && /function neighbourList/.test(js));
  ok('game matches three or more', /function findGroup/.test(js) && /canMatch/.test(js));
  ok('game drops floating clusters', /function dropFloating/.test(js));
  ok('game rescues fireflies', /function rescueFirefly/.test(js));
  ok('game pushes shadow rows', /function pushShadowRow/.test(js));
  ok('game has the Grumble-Grit boss', /type === 'boss'/.test(js));
  ok('game gives every colour a shape cue', /const GLYPHS/.test(js) && /function glyphFor/.test(js));
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
    await page.goto(base + '/games/lumo_firefly_night.html?seed=puzzle', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.__lumoFirefly && !!window.__lumoFirefly.debug, { timeout: 10000 });
    await sleep(150);
    const snap = () => page.evaluate(() => window.__lumoFirefly.state());
    const dbg = (fn, ...args) => page.evaluate((name, a) => window.__lumoFirefly.debug[name](...a), fn, args);
    const colours = await dbg('colours');
    const red = colours[0];
    const glyphs = await dbg('glyphs');
    const perColour = [];
    for (const c of colours) perColour.push(await page.evaluate((col) => window.__lumoFirefly.debug.glyphFor(col), c));
    ok('phone: every colour maps to a distinct shape', glyphs.length === colours.length && new Set(glyphs).size === glyphs.length && new Set(perColour).size === colours.length, JSON.stringify({ colours: colours.length, glyphs, perColour }));

    await page.evaluate(() => window.__lumoFirefly.debug.setMetaRescued(30));
    const lanterns = await page.evaluate(() => window.__lumoFirefly.debug.lanterns());
    const picked = await page.evaluate(() => window.__lumoFirefly.debug.pickLantern('sky'));
    const lanternState = await snap();
    ok('phone: lanterns unlock from lifetime rescues and persist', lanterns.every(l => l.unlocked) && picked === true && lanternState.lantern === 'sky' && lanternState.lanternColour === '#7dd3fc', JSON.stringify({ lanterns, picked, lantern: lanternState.lantern }));
    const runCard = await page.evaluate(() => window.__lumoFirefly.makeRunCard());
    ok('phone: the Firefly run card renders a PNG', typeof runCard === 'string' && runCard.startsWith('data:image/png') && runCard.length > 1000, 'len=' + (runCard ? runCard.length : 0));

    ok('phone: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    // 1. A plain three-in-a-row match clears and scores.
    await dbg('clear');
    await dbg('place', 5, 3, 'normal', red);
    await dbg('place', 5, 4, 'normal', red);
    await dbg('place', 5, 5, 'normal', red);
    const groupSize = await dbg('groupAt', 5, 4);
    const beforeMatch = await snap();
    const cleared = await dbg('resolveAt', 5, 4);
    const afterMatch = await snap();
    ok('phone: three in a row is a match', groupSize === 3 && cleared === 3, 'group=' + groupSize + ' cleared=' + cleared);
    ok('phone: a match scores and empties the cells', afterMatch.board === 0 && afterMatch.score > beforeMatch.score, JSON.stringify({ board: afterMatch.board, score: afterMatch.score }));

    // 2. A firefly next to the match is rescued.
    await dbg('clear');
    await dbg('place', 5, 3, 'normal', red);
    await dbg('place', 5, 4, 'normal', red);
    await dbg('place', 5, 5, 'normal', red);
    await dbg('place', 4, 3, 'firefly');
    const beforeFly = await snap();
    await dbg('resolveAt', 5, 4);
    const afterFly = await snap();
    ok('phone: a neighbouring firefly is rescued', afterFly.fireflies === beforeFly.fireflies + 1, beforeFly.fireflies + ' -> ' + afterFly.fireflies);

    // 3. A shadow bug beside the match counts as a threat cleared.
    await dbg('clear');
    await dbg('place', 5, 3, 'normal', red);
    await dbg('place', 5, 4, 'normal', red);
    await dbg('place', 5, 5, 'normal', red);
    await dbg('place', 4, 3, 'shadow');
    const beforeShadow = await snap();
    await dbg('resolveAt', 5, 4);
    const afterShadow = await snap();
    ok('phone: clearing a shadow counts as a threat', afterShadow.threats === beforeShadow.threats + 1, beforeShadow.threats + ' -> ' + afterShadow.threats);

    // 4. A bomb beside the match chains its blast.
    await dbg('clear');
    await dbg('place', 5, 3, 'normal', red);
    await dbg('place', 5, 4, 'normal', red);
    await dbg('place', 5, 5, 'normal', red);
    await dbg('place', 4, 4, 'bomb', red);
    await dbg('resolveAt', 5, 4);
    const afterBomb = await snap();
    ok('phone: an adjacent bomb is pulled into the blast', afterBomb.board === 0, 'board=' + afterBomb.board);

    // 5. A rainbow bubble joins any colour group.
    await dbg('clear');
    await dbg('place', 5, 3, 'normal', red);
    await dbg('place', 5, 4, 'rainbow');
    await dbg('place', 5, 5, 'normal', red);
    const rainbowGroup = await dbg('groupAt', 5, 4);
    ok('phone: a rainbow bubble completes a group', rainbowGroup === 3, 'group=' + rainbowGroup);

    // 6. An unanchored bubble falls.
    await dbg('clear');
    await dbg('place', 5, 5, 'normal', red);
    const beforeDrop = await snap();
    const dropped = await dbg('dropFloating');
    const afterDrop = await snap();
    ok('phone: an unanchored bubble drops', dropped === 1 && afterDrop.board === 0 && afterDrop.score > beforeDrop.score, JSON.stringify({ dropped, board: afterDrop.board }));

    // 7. A shadow row pushes the board down.
    await dbg('clear');
    await dbg('place', 0, 0, 'normal', red);
    const afterRow = await dbg('pushRow');
    const rowBoard = await page.evaluate(() => window.__lumoFirefly.debug.board());
    ok('phone: a shadow row descends', afterRow >= 13 && rowBoard.some(b => b.r === 1) && rowBoard.filter(b => b.r === 0).length >= 10, 'count=' + afterRow);

    // 8. Wave three seeds the Grumble-Grit boss.
    await page.evaluate(() => window.__lumoFirefly.setWave(3));
    const bossWave = await snap();
    const hurtBoss = await dbg('bossDamage', 5);
    ok('phone: the boss board starts with a boss', bossWave.wave === 3 && bossWave.bossHp === 12 && bossWave.target >= 10, JSON.stringify({ wave: bossWave.wave, bossHp: bossWave.bossHp, target: bossWave.target }));
    ok('phone: the boss takes damage', hurtBoss === 7, 'hp=' + hurtBoss);

    // 9. A real launch snaps a bubble onto the board.
    await page.evaluate(() => { const g = window.__lumoFirefly; g.reset(); g.start(); });
    await sleep(200);
    const coachState = await snap();
    ok('phone: the first run shows the coach', coachState.coachActive === true, JSON.stringify({ active: coachState.coachActive, done: coachState.coachDone }));
    await page.evaluate(() => window.__lumoFirefly.debug.endCoach());
    const beforeShot = await snap();
    await page.evaluate(() => { window.__lumoFirefly.aim(450, 120); window.__lumoFirefly.shoot(); });
    await sleep(1200);
    const afterShot = await snap();
    ok('phone: a launched bubble lands on the grid', afterShot.shotsHit > beforeShot.shotsHit && afterShot.shotsFired > beforeShot.shotsFired, JSON.stringify({ fired: afterShot.shotsFired, hit: afterShot.shotsHit }));

    ok('phone: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();

    const desktop = await browser.newPage();
    const derrs = [];
    desktop.on('pageerror', (e) => derrs.push(e.message));
    await desktop.setViewport({ width: 1440, height: 900 });
    await desktop.goto(base + '/games/lumo_firefly_night.html?seed=desk', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await desktop.waitForFunction(() => !!window.__lumoFirefly, { timeout: 10000 });
    await desktop.evaluate(() => window.__lumoFirefly.start());
    await sleep(200);
    ok('desktop 1440: the puzzle starts', await desktop.evaluate(() => window.__lumoFirefly.state().running));
    ok('desktop 1440: no horizontal overflow', await desktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    ok('desktop 1440: no page errors', derrs.length === 0, derrs.slice(0, 2).join(' | '));
    await desktop.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL FIREFLY PUZZLE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
