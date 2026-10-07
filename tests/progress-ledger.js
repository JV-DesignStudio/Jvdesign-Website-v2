#!/usr/bin/env node
// tests/progress-ledger.js (A791): one authoritative workshops-done ledger.
//
// Structural checks (no browser):
//  1. every SERIES storage key in workshops/my-progress.html is mapped in
//     WORKSHOP_KEY_TO_ID in player-profile.js, so reconciliation covers it.
//  2. me.html holds no second completion scan (profile-only reads).
// Browser checks (puppeteer + local server):
//  3. seed two completions (one SERIES key, one non-SERIES key) with no
//     profile present, then me.html and workshops/my-progress.html report
//     identical totals.
// Exit 0 PASS, 1 FAIL.
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const ok = (m) => console.log('  [OK] ' + m);
const fail = (m) => { fails++; console.log('  [FAIL] ' + m); };

// --- 1. SERIES coverage in the reconciliation map ---
const profileSrc = fs.readFileSync(path.join(ROOT, 'player-profile.js'), 'utf8');
const mapSrc = (profileSrc.match(/var WORKSHOP_KEY_TO_ID = \{([\s\S]*?)\};/) || [])[1] || '';
const mapped = new Set([...mapSrc.matchAll(/'([^']+)':/g)].map((m) => m[1]));
const mpSrc = fs.readFileSync(path.join(ROOT, 'workshops/my-progress.html'), 'utf8');
const seriesKeys = [...mpSrc.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((m) => m[1]);
const unmapped = [...new Set(seriesKeys)].filter((k) => !mapped.has(k));
if (seriesKeys.length > 0 && unmapped.length === 0) ok(seriesKeys.length + ' SERIES keys all mapped in WORKSHOP_KEY_TO_ID');
else fail('SERIES keys missing from map: ' + unmapped.slice(0, 5).join(', '));

// --- 2. no second completion ledger in me.html ---
const meSrc = fs.readFileSync(path.join(ROOT, 'me.html'), 'utf8');
if (/Also scan for workshop progress keys/.test(meSrc)) fail('me.html still has the raw progress-key scan');
else ok('me.html has no raw progress-key scan');
if (/getCompletedWorkshops\(\)\{[^}]*completedWorkshops/.test(meSrc.replace(/\n/g, ''))) ok('me.html reads the profile ledger');
else fail('me.html getCompletedWorkshops does not read the profile ledger');

// --- 3. browser: identical totals on both pages ---
const SEED = {
  'jvds-scratch-catch-v2': { completed: [1, 2, 3, 4, 5, 6], total: 6, xp: 90, bestStreak: 4, totalQuizzes: 6, correctFirst: 6 },
  'jvds-defold-dungeon-v2': { completed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], total: 11, xp: 120, bestStreak: 3, totalQuizzes: 11, correctFirst: 10 }
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { fail('puppeteer not installed'); finish(); return; }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + '/me.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate((seed) => {
      localStorage.clear();
      for (const k of Object.keys(seed)) localStorage.setItem(k, JSON.stringify(seed[k]));
    }, SEED);
    await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => document.getElementById('sWorkshops').textContent.trim() !== '', { timeout: 15000 });
    const meStat = await page.$eval('#sWorkshops', (el) => el.textContent.trim());
    const mePanel = await page.$eval('#wsCount', (el) => el.textContent.trim());
    if (meStat === '2') ok('me.html stat card shows 2 workshops done');
    else fail('me.html stat card shows ' + JSON.stringify(meStat) + ', want "2"');
    if (/^2\b/.test(mePanel)) ok('me.html workshops panel shows 2 (' + mePanel + ')');
    else fail('me.html workshops panel shows ' + JSON.stringify(mePanel) + ', want 2');

    await page.goto(base + '/workshops/my-progress.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.getElementById('completedCount').textContent.trim() !== '', { timeout: 15000 });
    // profile sync happens in the deferred player-profile.js; allow the poll to catch up
    await page.waitForFunction(() => document.getElementById('completedCount').textContent.trim() === '2', { timeout: 15000 }).catch(() => {});
    const mpCount = await page.$eval('#completedCount', (el) => el.textContent.trim());
    if (mpCount === '2') ok('workshops/my-progress.html shows 2 workshops done');
    else fail('workshops/my-progress.html shows ' + JSON.stringify(mpCount) + ', want "2"');
    if (meStat === '2' && mpCount === '2') ok('identical totals on me.html and my-progress.html');
    else fail('totals differ: me=' + meStat + ' my-progress=' + mpCount);
    const realErrs = errs.filter((m) => !/Content Security Policy/i.test(m));
    if (realErrs.length === 0) ok('no uncaught JS errors on either page');
    else fail('page errors: ' + realErrs.slice(0, 2).join(' | '));
    await page.close();
  } catch (e) {
    fail('browser run crashed: ' + String(e.message).slice(0, 160));
  }
  await browser.close();
  finish();
})();

function finish() {
  server.close();
  console.log(fails ? '\nprogress-ledger: FAIL (' + fails + ')' : '\nprogress-ledger: PASS');
  process.exit(fails ? 1 : 0);
}
