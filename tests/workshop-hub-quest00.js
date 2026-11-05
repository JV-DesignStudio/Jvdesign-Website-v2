#!/usr/bin/env node
// tests/workshop-hub-quest00.js (A2554): first-run Studio Ignition on the workshop
// hub. A new profile picks a companion, edits one line, runs it, earns 50 XP once,
// unlocks the Studio Pioneer badge, and can skip it once and for all. Runs at
// 390px and 1440px.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19260;
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

const snapshot = () => {
  const r = document.getElementById('quest00');
  const p = window.playerProfile;
  const q = p && p.getQuestProgress ? p.getQuestProgress('quest-00-studio-ignition') : null;
  return {
    visible: !!r && !r.hidden && r.getBoundingClientRect().height > 0,
    companions: document.querySelectorAll('#quest00 .quest00-comp').length,
    selected: (document.querySelector('#quest00 .quest00-comp[aria-pressed="true"]') || {}).getAttribute
      ? document.querySelector('#quest00 .quest00-comp[aria-pressed="true"]').getAttribute('data-id') : null,
    xp: p && p.state ? p.state.globalXP : null,
    completed: !!(q && q.completed),
    achievement: !!(p && p.hasAchievement && p.hasAchievement('studio-pioneer')),
    skipped: (() => { try { return localStorage.getItem('jvds_quest00_skipped'); } catch (e) { return null; } })(),
    companion: (() => { try { return localStorage.getItem('jvds_quest00_companion'); } catch (e) { return null; } })(),
    quest: window.__quest00 || null,
    status: (document.getElementById('quest00Status') || {}).textContent || '',
    statusGood: !!(document.getElementById('quest00Status') || {}).classList && document.getElementById('quest00Status').classList.contains('is-good'),
    badgeShown: !!(document.getElementById('quest00Badge') && !document.getElementById('quest00Badge').hidden),
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
  };
};

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'mobile', w: 390, h: 844, m: true }, { name: 'desktop', w: 1440, h: 900, m: false }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m });
      await page.goto('http://127.0.0.1:' + port + '/pages/workshop.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#quest00:not([hidden])', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 600));

      let s = await page.evaluate(snapshot);
      check(vp.name + ': Quest 00 shows for a new profile', s.visible, JSON.stringify({ visible: s.visible, xp: s.xp }));
      check(vp.name + ': all five companions are offered', s.companions === 5, String(s.companions));
      check(vp.name + ': hub content still renders below it', await page.evaluate(() => !!document.querySelector('#workshop-finder')));
      check(vp.name + ': no horizontal overflow', s.overflow <= 2, String(s.overflow));

      const layout = await page.evaluate(() => ({
        tabs: (() => { const t = document.querySelector('#quest00 .quest-pane-tabs'); return !!t && getComputedStyle(t).display !== 'none'; })(),
        code: (() => { const p = document.querySelector('#quest00 [data-quest-pane="code"]'); return !!p && getComputedStyle(p).display !== 'none'; })(),
        preview: (() => { const p = document.querySelector('#quest00 [data-quest-pane="preview"]'); return !!p && getComputedStyle(p).display !== 'none'; })()
      }));
      if (vp.name === 'mobile') {
        check('mobile: Code/Preview tabs show one pane', layout.tabs && (layout.code !== layout.preview), JSON.stringify(layout));
        await page.evaluate(() => document.querySelector('#quest00 [data-quest-tab="preview"]').click());
        await new Promise(r => setTimeout(r, 120));
        check('mobile: Preview tab reveals the card canvas', await page.evaluate(() => { const c = document.getElementById('quest00Canvas'); const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0; }));
        await page.evaluate(() => document.querySelector('#quest00 [data-quest-tab="code"]').click());
      } else {
        check('desktop: both panes show together', !layout.tabs && layout.code && layout.preview, JSON.stringify(layout));
      }

      await page.evaluate(() => document.querySelector('#quest00 .quest00-comp[data-id="ember"]').click());
      s = await page.evaluate(snapshot);
      check(vp.name + ': companion choice is stored', s.companion === 'ember' && s.selected === 'ember', s.selected + '/' + s.companion);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#quest00:not([hidden])', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
      s = await page.evaluate(snapshot);
      check(vp.name + ': companion survives a reload', s.visible && s.selected === 'ember', s.selected);

      await page.evaluate(() => {
        const ta = document.getElementById('quest00Code');
        ta.value = 'headline = "Pixel Pioneer Pirate"';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('quest00Run').click();
      });
      await new Promise(r => setTimeout(r, 250));
      s = await page.evaluate(snapshot);
      check(vp.name + ': editing the line passes the run check', s.quest && s.quest.pass === true && s.statusGood, s.status);
      check(vp.name + ': preview redraws with the new headline', s.quest && s.quest.headline === 'Pixel Pioneer Pirate', s.quest ? s.quest.headline : 'none');

      await page.evaluate(() => document.getElementById('quest00Save').click());
      await new Promise(r => setTimeout(r, 250));
      s = await page.evaluate(snapshot);
      check(vp.name + ': Finish awards 50 XP', s.xp >= 50, 'xp=' + s.xp);
      check(vp.name + ': Finish completes the quest', s.completed);
      check(vp.name + ': Finish unlocks the Studio Pioneer badge', s.achievement && s.badgeShown);
      const xpAfterFirst = s.xp;

      await page.evaluate(() => document.getElementById('quest00Save').click());
      await new Promise(r => setTimeout(r, 200));
      s = await page.evaluate(snapshot);
      check(vp.name + ': finishing again does not award XP twice', s.xp === xpAfterFirst, xpAfterFirst + ' -> ' + s.xp);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 900));
      s = await page.evaluate(snapshot);
      check(vp.name + ': Quest 00 is not shown again after completion', !s.visible);
      check(vp.name + ': completion and companion persist', s.completed && s.companion === 'ember');

      // Skip path on a fresh profile.
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#quest00:not([hidden])', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 400));
      await page.evaluate(() => document.getElementById('quest00Skip').click());
      s = await page.evaluate(snapshot);
      check(vp.name + ': Skip hides the quest', !s.visible && s.skipped === '1');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 700));
      s = await page.evaluate(snapshot);
      check(vp.name + ': Skip is remembered after reload', !s.visible && s.skipped === '1');
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nQuest 00 Studio Ignition: all checks passed');
})();
