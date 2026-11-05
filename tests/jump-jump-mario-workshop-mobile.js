#!/usr/bin/env node
// tests/jump-jump-mario-workshop-mobile.js (A2585): the Jump Lab must work at
// 390px (Code/Preview tabs) and 1440px (both panes), redraw the arc when a
// slider moves, pass only when the arc clears the ledge, and award the XP once.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19257;
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

const visible = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
};

const setSliders = (g, j) => {
  const gi = document.getElementById('jumpGravity');
  const ji = document.getElementById('jumpForce');
  gi.value = String(g);
  ji.value = String(j);
  gi.dispatchEvent(new Event('input', { bubbles: true }));
  ji.dispatchEvent(new Event('input', { bubbles: true }));
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
      await page.goto('http://127.0.0.1:' + port + '/workshops/jump-jump-mario-workshop.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#jumpLabCanvas', { timeout: 20000 });
      await new Promise(r => setTimeout(r, 700));

      const shell = await page.evaluate(() => ({
        lab: !!document.getElementById('jumpLab'),
        canvas: !!document.getElementById('jumpLabCanvas'),
        gravity: !!document.getElementById('jumpGravity'),
        jump: !!document.getElementById('jumpForce'),
        save: !!document.getElementById('jumpLabSave'),
        tabs: document.querySelectorAll('#jumpLab [data-quest-tab]').length,
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      }));
      check(vp.name + ': Jump Lab present with both sliders and Save', shell.lab && shell.canvas && shell.gravity && shell.jump && shell.save);
      check(vp.name + ': no horizontal overflow', shell.overflow <= 2, String(shell.overflow));

      const layout = await page.evaluate(() => ({
        tabsShown: (() => { const t = document.querySelector('#jumpLab .quest-pane-tabs'); return !!t && getComputedStyle(t).display !== 'none'; })(),
        codeShown: (() => { const p = document.querySelector('#jumpLab [data-quest-pane="code"]'); return !!p && getComputedStyle(p).display !== 'none'; })(),
        previewShown: (() => { const p = document.querySelector('#jumpLab [data-quest-pane="preview"]'); return !!p && getComputedStyle(p).display !== 'none'; })()
      }));
      if (vp.name === 'mobile') {
        check('mobile: Code/Preview tabs are visible', shell.tabs === 2 && layout.tabsShown);
        check('mobile: one pane shows at a time', layout.codeShown !== layout.previewShown, 'code=' + layout.codeShown + ' preview=' + layout.previewShown);
        await page.evaluate(() => document.querySelector('#jumpLab [data-quest-tab="preview"]').click());
        await new Promise(r => setTimeout(r, 120));
        const afterPreview = await page.evaluate(() => ({
          preview: (() => { const p = document.querySelector('#jumpLab [data-quest-pane="preview"]'); return !!p && getComputedStyle(p).display !== 'none'; })(),
          canvasVisible: (() => { const c = document.getElementById('jumpLabCanvas'); const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()
        }));
        check('mobile: tapping Preview shows the canvas', afterPreview.preview && afterPreview.canvasVisible);
        await page.evaluate(() => document.querySelector('#jumpLab [data-quest-tab="code"]').click());
      } else {
        check('desktop: tabs are hidden', !layout.tabsShown);
        check('desktop: both panes show together', layout.codeShown && layout.previewShown, 'code=' + layout.codeShown + ' preview=' + layout.previewShown);
      }

      await page.evaluate(setSliders, 1200, 200);
      await new Promise(r => setTimeout(r, 200));
      const low = await page.evaluate(() => ({
        state: window.__jumpLab,
        status: document.getElementById('jumpLabStatus').textContent,
        good: document.getElementById('jumpLabStatus').classList.contains('is-good')
      }));
      check(vp.name + ': low jump does not pass', !!low.state && low.state.pass === false && !low.good, low.status);
      check(vp.name + ': arc height reflects gravity and jump force', !!low.state && Math.abs(low.state.height - (200 * 200) / (2 * 1200)) < 1, low.state ? low.state.height.toFixed(1) : 'missing');

      await page.evaluate(setSliders, 1200, 700);
      await new Promise(r => setTimeout(r, 200));
      const high = await page.evaluate(() => ({
        state: window.__jumpLab,
        status: document.getElementById('jumpLabStatus').textContent,
        good: document.getElementById('jumpLabStatus').classList.contains('is-good')
      }));
      check(vp.name + ': higher jump clears the ledge and passes', !!high.state && high.state.pass === true && high.good, high.status);

      const save1 = await page.evaluate(() => {
        document.getElementById('jumpLabSave').click();
        const p = window.playerProfile;
        return {
          completed: !!(p && p.getQuestProgress && p.getQuestProgress('quest-mario-jump-arc') && p.getQuestProgress('quest-mario-jump-arc').completed),
          xp: p && p.state ? p.state.globalXP : null,
          text: document.getElementById('jumpLabSaved').textContent
        };
      });
      check(vp.name + ': Save awards the quest', save1.completed, save1.text);
      check(vp.name + ': Save awards 30 XP', save1.xp >= 30, 'xp=' + save1.xp);

      const save2 = await page.evaluate(() => {
        document.getElementById('jumpLabSave').click();
        const p = window.playerProfile;
        return {
          xp: p && p.state ? p.state.globalXP : null,
          text: document.getElementById('jumpLabSaved').textContent
        };
      });
      check(vp.name + ': saving again does not award XP twice', save2.xp === save1.xp, save1.xp + ' -> ' + save2.xp);
      check(vp.name + ': second save says the XP was already earned', /already earned/i.test(save2.text), save2.text);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#jumpLabCanvas', { timeout: 20000 });
      await new Promise(r => setTimeout(r, 700));
      const restored = await page.evaluate(() => ({
        gravity: document.getElementById('jumpGravity').value,
        jump: document.getElementById('jumpForce').value,
        pass: window.__jumpLab ? window.__jumpLab.pass : null,
        completed: (() => { const p = window.playerProfile; const q = p && p.getQuestProgress ? p.getQuestProgress('quest-mario-jump-arc') : null; return !!(q && q.completed); })()
      }));
      check(vp.name + ': sliders are remembered after refresh', restored.gravity === '1200' && restored.jump === '700', restored.gravity + '/' + restored.jump);
      check(vp.name + ': saved quest stays complete after refresh', restored.completed && restored.pass === true);
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nJump Lab: all checks passed');
})();
