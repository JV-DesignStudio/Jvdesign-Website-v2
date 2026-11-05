// tests/learning-lab-quickstart.js (A2552)
// Proves the Learning Lab first-3-minutes path: the quick-start panel is above
// the long guidance, Quest 01 runs through the shared quest runtime, the pixel
// readout matches the chosen colour, XP lands once in the player profile, and
// the page stays within the viewport at 390px and 1440px.
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = '/workshops/learning-lab.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

async function main() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      await page.setViewport({ width, height: 900 });

      let resp = null;
      for (let attempt = 0; attempt < 2 && !(resp && resp.status() === 200); attempt++) {
        resp = await page.goto(base + PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(resp && resp.status() === 200)) await new Promise((r) => setTimeout(r, 400));
      }
      let loaded = await page.evaluate(() => document.readyState === 'complete' || document.readyState === 'interactive').catch(() => false);
      check('status 200', (resp && resp.status() === 200) || (!resp && loaded), 'status ' + (resp && resp.status()));

      await page.evaluate(() => localStorage.clear());
      resp = null;
      for (let attempt = 0; attempt < 2 && !(resp && resp.status() === 200); attempt++) {
        resp = await page.goto(base + PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(resp && resp.status() === 200)) await new Promise((r) => setTimeout(r, 400));
      }
      loaded = await page.evaluate(() => document.readyState === 'complete' || document.readyState === 'interactive').catch(() => false);
      check('status 200 after fresh profile', (resp && resp.status() === 200) || (!resp && loaded), 'status ' + (resp && resp.status()));

      await page.waitForFunction(() => {
        const root = document.getElementById('canvas-quest');
        return !!window.QuestRuntime && !!root && root.dataset.questReady === '1';
      }, { timeout: 15000 });

      const layout = await page.evaluate(() => {
        const visible = (el) => !!el && el.getBoundingClientRect().height > 0;
        const start = document.getElementById('start-here');
        const quest = document.getElementById('canvas-quest');
        const hero = document.querySelector('.hero-start-btn');
        const bar = document.querySelector('.quest-pane-tabs');
        const save = document.getElementById('cqSave');
        const top = (sel) => {
          const el = document.querySelector(sel);
          return el ? el.getBoundingClientRect().top + window.scrollY : null;
        };
        return {
          startVisible: visible(start),
          questVisible: visible(quest),
          heroHref: hero ? hero.getAttribute('href') : null,
          steps: document.querySelectorAll('.quickstart-step').length,
          download: !!document.getElementById('cqDownload'),
          tabs: document.querySelectorAll('[data-quest-tab]').length,
          tabsShown: bar ? getComputedStyle(bar).display !== 'none' : false,
          saveInActionBar: !!(save && save.closest('.quest-actions')),
          active: document.querySelector('.quest-pane-layout')
            ? document.querySelector('.quest-pane-layout').getAttribute('data-active-pane') : null,
          startTop: top('#start-here'),
          outcomeTop: top('.ws-outcome'),
          infoTop: top('.ws-info'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      check('quick-start panel visible', layout.startVisible);
      check('canvas quest visible', layout.questVisible);
      check('hero points at the 3-minute start', layout.heroHref === '#start-here', String(layout.heroHref));
      check('quick start has three steps', layout.steps === 3, 'steps ' + layout.steps);
      check('download button exists', layout.download);
      check('Save sits in the always-visible action bar', layout.saveInActionBar);
      check('quick start comes before the long guidance',
        layout.startTop < layout.outcomeTop && layout.startTop < layout.infoTop,
        'start ' + layout.startTop + ', outcome ' + layout.outcomeTop + ', info ' + layout.infoTop);
      if (width <= 720) {
        check('mobile panes have Code and Preview tabs', layout.tabs === 2 && layout.tabsShown, 'tabs ' + layout.tabs + ', shown ' + layout.tabsShown);
        check('mobile starts on the code pane', layout.active === 'code', String(layout.active));
      } else {
        check('desktop shows both panes without tabs', layout.tabs === 2 && !layout.tabsShown, 'tabs ' + layout.tabs + ', shown ' + layout.tabsShown);
      }
      check('no horizontal overflow', layout.overflow <= 2, layout.overflow + 'px');

      await page.click('#cqTeal');
      await page.click('#cqRun');
      const run = await page.evaluate(() => {
        const c = document.getElementById('cqCanvas');
        const px = c.getContext('2d').getImageData(160, 100, 1, 1).data;
        const preview = document.querySelector('[data-quest-pane="preview"]');
        const code = document.querySelector('[data-quest-pane="code"]');
        return {
          readout: document.getElementById('cqPixel').textContent.trim(),
          pixel: [px[0], px[1], px[2]],
          status: document.getElementById('cqStatus').textContent,
          active: document.querySelector('.quest-pane-layout').getAttribute('data-active-pane'),
          previewVisible: preview.getBoundingClientRect().height > 0,
          codeVisible: code.getBoundingClientRect().height > 0
        };
      });
      check('pixel readout shows the swapped colour', run.readout === '#70A3A7', run.readout);
      check('canvas pixel matches #70A3A7', run.pixel.join(',') === '112,163,167', run.pixel.join(','));
      check('status confirms the quest', /Quest complete/.test(run.status), run.status);
      if (width <= 720) {
        check('Run switches mobile to the preview pane', run.active === 'preview' && run.previewVisible && !run.codeVisible,
          'active ' + run.active + ', preview ' + run.previewVisible + ', code ' + run.codeVisible);
      } else {
        check('desktop keeps both panes visible after Run', run.previewVisible && run.codeVisible,
          'preview ' + run.previewVisible + ', code ' + run.codeVisible);
      }

      await page.click('#cqSave');
      const saved = await page.evaluate(() => {
        let quest = {};
        let lab = {};
        try { quest = JSON.parse(localStorage.getItem('jvds_lab_quest01') || '{}'); } catch (e) {}
        try { lab = JSON.parse(localStorage.getItem('jvds_lab_v5') || '{}'); } catch (e) {}
        const p = window.playerProfile;
        return {
          colour: quest.colour,
          hasSavedAt: !!quest.savedAt,
          profileBonusXP: p ? p.state.bonusXP : null,
          profileGlobalXP: p ? p.state.globalXP : null,
          labXP: lab._xp,
          message: document.getElementById('cqSaved').textContent,
          hidden: document.getElementById('cqSaved').hidden,
          profileQuest: p && p.getQuestProgress
            ? p.getQuestProgress('quest-01-canvas-colour-swap')
            : null
        };
      });
      check('saved colour persisted', saved.colour === '#70A3A7', String(saved.colour));
      check('saved timestamp stored', saved.hasSavedAt);
      check('first save adds 20 XP to the Studio profile', saved.profileBonusXP === 20, 'bonusXP ' + saved.profileBonusXP);
      check('profile total includes the quest XP', saved.profileGlobalXP >= 20, 'globalXP ' + saved.profileGlobalXP);
      check('quest XP is not duplicated in the lab ledger', !saved.labXP, 'lab xp ' + saved.labXP);
      check('saved message is visible', !saved.hidden && /Saved/.test(saved.message), saved.message);
      check('quest recorded on the player profile', !!(saved.profileQuest && saved.profileQuest.completed));

      await page.click('#cqSave');
      const again = await page.evaluate(() => {
        const p = window.playerProfile;
        return { bonusXP: p ? p.state.bonusXP : null, message: document.getElementById('cqSaved').textContent };
      });
      check('second save does not add XP again', again.bonusXP === 20, 'bonusXP ' + again.bonusXP);
      check('second save explains the XP was already earned', /already earned/.test(again.message), again.message);

      check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }

  if (failures) { console.log('\n' + failures + ' FAILED for ' + PAGE); process.exit(1); }
  console.log('\nPASS: ' + PAGE + ' first-3-minutes quick start');
}

main().catch((e) => { console.error(e); process.exit(1); });
