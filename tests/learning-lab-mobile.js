#!/usr/bin/env node
// tests/learning-lab-mobile.js (A2574): the flagship Learning Lab quest at 390px
// and 1440px. Editing the code and pressing Run repaints the canvas within a
// frame, the assertion passes, mobile switches to Preview, and the XP lands once.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19262;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
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

const readState = () => {
  const canvas = document.getElementById('cqCanvas');
  const px = canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
  const p = window.playerProfile;
  const q = p && p.getQuestProgress ? p.getQuestProgress('quest-01-canvas-colour-swap') : null;
  const layout = document.querySelector('[data-quest-layout]');
  const pane = (name) => {
    const el = document.querySelector('[data-quest-pane="' + name + '"]');
    if (!el) return { shown: false, h: 0 };
    const r = el.getBoundingClientRect();
    return { shown: r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none', h: Math.round(r.height) };
  };
  return {
    pixel: [px[0], px[1], px[2]].join(','),
    readout: (document.getElementById('cqPixel') || {}).textContent || '',
    status: (document.getElementById('cqStatus') || {}).textContent || '',
    active: layout ? layout.getAttribute('data-active-pane') : null,
    tabsShown: (() => { const b = document.querySelector('.quest-pane-tabs'); return !!b && getComputedStyle(b).display !== 'none'; })(),
    code: pane('code'),
    preview: pane('preview'),
    xp: p && p.state ? p.state.globalXP : null,
    bonus: p && p.state ? p.state.bonusXP : null,
    completed: !!(q && q.completed),
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
      await page.goto('http://127.0.0.1:' + port + '/workshops/learning-lab.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => {
        const r = document.getElementById('canvas-quest');
        return !!window.QuestRuntime && !!r && r.dataset.questReady === '1';
      }, { timeout: 25000 });
      await new Promise(r => setTimeout(r, 500));

      let s = await page.evaluate(readState);
      check(vp.name + ': quest canvas and readout render', s.readout.length > 0 && s.pixel !== '', s.readout);
      if (vp.name === 'mobile') {
        check('mobile: tabs show one pane at a time', s.tabsShown && s.code.shown !== s.preview.shown, JSON.stringify({ tabs: s.tabsShown, code: s.code.shown, preview: s.preview.shown }));
      } else {
        check('desktop: both panes visible without tabs', !s.tabsShown && s.code.shown && s.preview.shown, JSON.stringify({ tabs: s.tabsShown, code: s.code.shown, preview: s.preview.shown }));
      }
      check(vp.name + ': no horizontal overflow', s.overflow <= 2, String(s.overflow));

      const run = await page.evaluate(async () => {
        const ta = document.getElementById('cqCode');
        ta.value = ta.value.replace(/#[0-9a-f]{3,6}/i, '#70A3A7');
        document.getElementById('cqRun').click();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const c = document.getElementById('cqCanvas');
        const px = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data;
        const layout = document.querySelector('[data-quest-layout]');
        return {
          pixel: [px[0], px[1], px[2]].join(','),
          readout: document.getElementById('cqPixel').textContent.trim(),
          status: document.getElementById('cqStatus').textContent,
          active: layout.getAttribute('data-active-pane')
        };
      });
      check(vp.name + ': canvas repaints within a frame', run.pixel === '112,163,167' && run.readout === '#70A3A7', run.pixel + ' / ' + run.readout);
      check(vp.name + ': assertion passes', /Quest complete/.test(run.status), run.status);
      if (vp.name === 'mobile') check('mobile: Run switches to Preview', run.active === 'preview', String(run.active));

      await page.evaluate(() => document.getElementById('cqSave').click());
      await new Promise(r => setTimeout(r, 250));
      s = await page.evaluate(readState);
      check(vp.name + ': Save adds 20 XP', s.bonus === 20 && s.xp >= 20, 'bonus=' + s.bonus + ' total=' + s.xp);
      check(vp.name + ': quest recorded on the profile', s.completed);
      const xp = s.xp;

      await page.evaluate(() => document.getElementById('cqSave').click());
      await new Promise(r => setTimeout(r, 200));
      s = await page.evaluate(readState);
      check(vp.name + ': saving again does not award XP twice', s.xp === xp, xp + ' -> ' + s.xp);
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nLearning Lab mobile: all checks passed');
})();
