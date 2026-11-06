#!/usr/bin/env node
// tests/quest-badges.js (A2548)
// Proves the local quest milestone badge engine:
//   - four badges render locked on the achievements finish panel
//   - awarding a badge persists in localStorage and unlocks a cross-tool extra
//   - badges survive a reload
//   - one Reset control clears every quest badge and unlock
//   - works at 390px and 1440px with no overflow and no console errors
// Run: node tests/quest-badges.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19275;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

async function panel(page) {
  return page.evaluate(() => {
    const host = document.querySelector('[data-quest-badges]');
    const cards = host ? Array.from(host.querySelectorAll('[data-badge-id]')) : [];
    return {
      api: typeof window.QuestBadges,
      cards: cards.length,
      unlocked: cards.filter((c) => c.classList.contains('unlocked')).map((c) => c.getAttribute('data-badge-id')),
      locked: cards.filter((c) => c.classList.contains('locked')).length,
      checks: host ? host.querySelectorAll('.ach-check').length : 0,
      reset: !!(host && host.querySelector('[data-quest-badges-reset]')),
      overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
    };
  });
}

async function storage(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('jvds_quest_badges_v1');
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (e) {}
    return { raw: !!raw, data: data };
  });
}

(async () => {
  await new Promise((r) => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon|googletagmanager|google-analytics/i.test(t)) return;
      errors.push('console: ' + t);
    });

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:' + port + '/workshops/my-achievements.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => { try { localStorage.removeItem('jvds_quest_badges_v1'); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.QuestBadges, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));

    let state = await panel(page);
    check('badge module loads on the achievements page', state.api === 'object', state.api);
    check('four milestone badges render', state.cards === 4, String(state.cards));
    check('all badges start locked', state.locked === 4 && state.unlocked.length === 0, state.unlocked.join(','));
    check('a single Reset control is present', state.reset);
    check('no horizontal overflow at 1440px', state.overflow <= 2, String(state.overflow));

    const awarded = await page.evaluate(() => window.QuestBadges.award('physics-master'));
    state = await panel(page);
    check('award() reports the first win', awarded === true);
    check('awarded badge becomes unlocked', state.unlocked.indexOf('physics-master') !== -1, state.unlocked.join(','));
    check('one check mark shows on the card', state.checks === 1, String(state.checks));
    let saved = await storage(page);
    check('badge persists in localStorage', !!(saved.data && saved.data.badges && saved.data.badges['physics-master']));
    check('cross-tool unlock is recorded', !!(saved.data && saved.data.unlocks && saved.data.unlocks['palette-neon']), JSON.stringify(saved.data && saved.data.unlocks));

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.QuestBadges, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 300));
    state = await panel(page);
    check('badge survives a reload', state.unlocked.indexOf('physics-master') !== -1, state.unlocked.join(','));

    const rest = await page.evaluate(() => window.QuestBadges.evaluate({ export3d: true, sprite: true, codePass: true }));
    state = await panel(page);
    check('evaluate() awards the remaining milestones', rest.length === 3 && state.unlocked.length === 4, JSON.stringify(rest));
    check('every cross-tool unlock is available', await page.evaluate(() => ['palette-neon', 'buildlab-parts', 'pixel-palette-sunset', 'skin-circuit'].every((k) => window.QuestBadges.hasUnlock(k))));

    // Reset through the visible control, not the API.
    await page.evaluate(() => {
      const btn = document.querySelector('[data-quest-badges-reset]');
      if (btn) btn.click();
    });
    state = await panel(page);
    saved = await storage(page);
    check('Reset clears every badge', state.unlocked.length === 0 && state.locked === 4, state.unlocked.join(','));
    check('Reset removes the stored key', !saved.raw && !(saved.data && saved.data.badges && Object.keys(saved.data.badges).length));
    check('Reset clears cross-tool unlocks', await page.evaluate(() => window.QuestBadges.hasUnlock('palette-neon') === false));

    // Mobile layout.
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 300));
    state = await panel(page);
    check('panel still renders at 390px', state.cards === 4, String(state.cards));
    check('no horizontal overflow at 390px', state.overflow <= 2, String(state.overflow));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILED for quest badges'); process.exit(1); }
  console.log('\nPASS: quest milestone badges');
})().catch((e) => { console.error(e); process.exit(1); });
