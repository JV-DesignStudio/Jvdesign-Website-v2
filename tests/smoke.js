#!/usr/bin/env node
/*
 * tests/smoke.js — behavioral smoke tests (headless Chrome via Puppeteer).
 *
 * Catches regressions that static validators can't see, e.g. double-bound
 * event handlers (the dead mobile-nav bug) or progress writes silently
 * breaking. Serves the repo over localhost HTTP and drives five scenarios:
 *
 *   1. Homepage loads + mobile nav toggle opens/closes cleanly
 *   2. Workshop quiz answers correctly → XP awarded → saved to localStorage
 *   3. Progress dashboard reflects that earned XP
 *   4. Backup round-trip: export → wipe storage → import restores XP
 *      (plus rejecting a corrupt backup code)
 *   5. A game page loads with zero uncaught exceptions
 *
 * Exit 1 if any scenario fails. Run: npm run test:smoke
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.SMOKE_PORT || 8978;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
}
async function scenario(name, fn) {
  console.log('\n▸ ' + name);
  try { await fn(); }
  catch (e) { record(name, false, String(e.message || e).slice(0, 140)); }
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  /* ── 1. Homepage + mobile nav ── */
  await scenario('homepage loads & mobile nav toggles once per tap', async () => {
    const page = await browser.newPage();
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    await page.setViewport({ width: 390, height: 780 }); // phone width → hamburger visible
    await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });

    const title = await page.title();
    record('homepage has a title', /JVDesignStudio/.test(title), title);

    await page.waitForSelector('#navToggle', { visible: true });
    const expandedBefore = await page.$eval('#navToggle', el => el.getAttribute('aria-expanded'));
    await page.click('#navToggle');
    await page.waitForFunction(() => document.getElementById('mobileNav').classList.contains('open'));
    const expandedOpen = await page.$eval('#navToggle', el => el.getAttribute('aria-expanded'));

    // A second tap must CLOSE it (catches double-bound handlers: open→instantly shut)
    await page.click('#navToggle');
    await page.waitForFunction(() => !document.getElementById('mobileNav').classList.contains('open'));
    const expandedAfter = await page.$eval('#navToggle', el => el.getAttribute('aria-expanded'));

    record('nav opens on tap', expandedBefore === 'false' && expandedOpen === 'true',
      `aria-expanded ${expandedBefore}→${expandedOpen}`);
    record('nav closes on second tap', expandedAfter === 'false');

    // Escape key also closes
    await page.click('#navToggle');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('mobileNav').classList.contains('open'));
    record('nav closes on Escape', true);

    record('no uncaught JS errors on homepage', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
    await page.close();
  });

  /* Shared context for the progress flow (workshop → dashboard → backup) */
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept()); // accept confirm() during restore

  /* ── 2. Workshop quiz awards XP and persists ── */
  await scenario('workshop quiz answer → XP → persisted to localStorage', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + 'workshops/scratch-catch-workshop.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#quiz-1 .quiz-opt', { visible: true });

    // Options are shuffled at runtime, so derive the correct index from the gate.
    const correctIdx = await page.$eval('#quiz-1', el => parseInt(atob(el.dataset.k), 10));
    await page.click(`#quiz-1 .quiz-opt[data-idx="${correctIdx}"]`);
    await page.waitForSelector('#quiz-1 .quiz-submit.show', { visible: true });
    await page.click('#quiz-1 .quiz-submit');
    await page.waitForSelector('#quiz-1.passed');

    // Engine saves synchronously on every answer; poll for the write.
    await page.waitForFunction(() => {
      const d = JSON.parse(localStorage.getItem('jvds-scratch-catch-v2') || 'null');
      return d && d.totalQuizzes >= 1;
    });
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds-scratch-catch-v2')));
    record('quiz passed recorded', prog.quizzesPassed.includes('quiz-1'), JSON.stringify(prog.quizzesPassed));
    record('XP awarded (≥15)', prog.xp >= 15, 'xp=' + prog.xp);
    record('quiz counted', prog.totalQuizzes === 1, 'totalQuizzes=' + prog.totalQuizzes);
  });

  /* ── 3. Dashboard reflects earned XP ── */
  await scenario('progress dashboard reflects earned XP', async () => {
    await page.goto(BASE + 'workshops/my-progress.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      parseInt(document.getElementById('totalXpDisplay').textContent.replace(/,/g, ''), 10) >= 15);
    record('dashboard total XP ≥ 15', true);

    const badges = await page.$eval('#badgesGrid', el => el.children.length);
    record('badges rendered', badges > 0, badges + ' badges');
    const namePersisted = await page.evaluate(() => localStorage.getItem('jvds-player-name') !== null || true);
    record('name field section present', namePersisted && !!(await page.$('#playerName')));
  });

  /* ── 4. Backup round-trip ── */
  await scenario('backup export → wipe → import restores progress', async () => {
    // Export
    await page.click('#bkExportBtn');
    await page.waitForFunction(() => document.getElementById('bkTextarea').value.length > 100);
    const backupJson = await page.$eval('#bkTextarea', el => el.value);
    const parsed = JSON.parse(backupJson);
    record('export envelope is valid', parsed.app === 'jvdesignstudio-progress' && parsed.keys > 0,
      'app=' + parsed.app + ', keys=' + parsed.keys);

    // Wipe everything, verify dashboard resets to zero
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('totalXpDisplay').textContent.trim() === '0');
    record('storage wiped → dashboard at 0 XP', true);

    // Corrupt code must be rejected without touching storage
    await page.$eval('#bkTextarea', el => { el.value = '{not-json'; });
    await page.click('#bkRestoreBtn');
    await new Promise(r => setTimeout(r, 300));
    const statusAfterBad = await page.$eval('#bkStatus', el => el.textContent);
    const stillZero = await page.$eval('#totalXpDisplay', el => el.textContent.trim());
    record('corrupt backup rejected', statusAfterBad.indexOf('not look like') !== -1 && stillZero === '0',
      statusAfterBad.slice(0, 60));

    // Real restore
    await page.$eval('#bkTextarea', (el, v) => { el.value = v; }, backupJson);
    await page.click('#bkRestoreBtn');
    await page.waitForFunction(() =>
      parseInt(document.getElementById('totalXpDisplay').textContent.replace(/,/g, ''), 10) >= 15);
    const statusText = await page.$eval('#bkStatus', el => el.textContent);
    record('restore brings XP back', statusText.indexOf('✓ Restored') === 0, statusText.slice(0, 60));

    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds-scratch-catch-v2') || 'null'));
    record('workshop key survived round-trip', !!restored && restored.totalQuizzes === 1);
  });

  /* ── 4b. Unified XP: legacy migration + game XP feed ONE level ── */
  await scenario('unified XP: legacy profile migrates, game XP counts', async () => {
    // Legacy (pre-schema) profile: globalXP 300 from challenges/tools, no
    // xpSchema field. Plus workshop progress (210 XP) and a game state (150 XP).
    await page.evaluate(() => {
      localStorage.setItem('jvds-scratch-maze-v2', JSON.stringify({
        completed: [1, 2], total: 8, xp: 210, level: 3, streak: 1, bestStreak: 2,
        totalQuizzes: 5, correctFirst: 4, quizzesPassed: [], challengesPassed: []
      }));
      localStorage.setItem('jvds_game_gem_match', JSON.stringify({
        xp: 150, level: 1, score: 0, highScore: 0, coins: 0, gamesPlayed: 1,
        achievements: [], settings: {}
      }));
      localStorage.setItem('jvds_profile', JSON.stringify({
        playerId: 'smoke-legacy', globalXP: 300, level: 1, completedWorkshops: [],
        unlockedGameModes: [], unlockedGames: [], achievements: [], dailyStreak: 0,
        lastPlayedDate: null, createdAt: new Date().toISOString(), questProgress: {},
        dailyActivity: { date: null, games: [], runs: 0, workshops: 0, xp: 0, claimed: null },
        weeklyActivity: { key: null, games: [], runs: 0, workshops: 0, xp: 0, claimed: null },
        shareCode: null
      }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // 300 legacy bonus + (15 scratch + 210 maze) workshop + 150 game = 675
    // (the scratch key from the earlier quiz scenario is still in storage)
    await page.waitForFunction(() =>
      document.getElementById('totalXpDisplay').textContent.replace(/,/g, '') === '675', { timeout: 8000 });
    record('migration math: 300 + 225 + 150 = 675 XP', true);
    const lvl = await page.$eval('#globalLevel', el => el.textContent.trim());
    record('one level curve (100 XP/level) → level 7', lvl === '7', 'level=' + lvl);
    const note = await page.$eval('#xpSourceNote', el => el.textContent);
    record('source note shows non-workshop XP', /450 XP from games/.test(note), note);
  });

  /* ── 5. Game page boots clean ── */
  await scenario('game page loads without uncaught errors', async () => {
    const g = await ctx.newPage();
    const jsErrors = [];
    g.on('pageerror', e => jsErrors.push(e.message));
    await g.setViewport({ width: 800, height: 700 });
    await g.goto(BASE + 'games/gem_match.html', { waitUntil: 'domcontentloaded' });
    await g.waitForSelector('#startScreen', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200)); // let init code run
    record('gem_match boots clean', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
    await g.close();
  });

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n────────────────────────────────────');
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    failed.forEach(f => console.log('  FAILED: ' + f.name));
    process.exit(1);
  }
  console.log('✓ smoke: all checks passed');
})().catch(e => { console.error('smoke runner crashed:', e); process.exit(1); });
