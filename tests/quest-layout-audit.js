#!/usr/bin/env node
// tests/quest-layout-audit.js (A2574): proves the shared dual-pane quest shell
// works on the flagship pages. At 390px it shows Code/Preview tabs, switches on
// a real touch tap and on arrow keys; resizing to 1440px shows both panes; and
// resizing back restores the tabs. No overflow at any width.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19261;
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

const readLayout = () => {
  const rootEl = document.querySelector('[data-quest-layout]');
  if (!rootEl) return null;
  const panes = Array.from(rootEl.querySelectorAll('[data-quest-pane]'));
  const tabs = Array.from(rootEl.querySelectorAll('[data-quest-tab]'));
  const shown = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
  };
  return {
    active: rootEl.getAttribute('data-active-pane'),
    tabs: tabs.length,
    tabsShown: (() => { const b = rootEl.querySelector('.quest-pane-tabs'); return !!b && getComputedStyle(b).display !== 'none'; })(),
    codeShown: shown(panes.find((p) => p.getAttribute('data-quest-pane') === 'code')),
    previewShown: shown(panes.find((p) => p.getAttribute('data-quest-pane') === 'preview')),
    codeRect: (() => { const p = panes.find((x) => x.getAttribute('data-quest-pane') === 'code'); if (!p) return null; const r = p.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
    previewRect: (() => { const p = panes.find((x) => x.getAttribute('data-quest-pane') === 'preview'); if (!p) return null; const r = p.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
    tabPressed: (() => { const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true'); return t ? t.getAttribute('data-quest-tab') : null; })(),
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
  };
};

const tapSelector = async (page, selector) => {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await new Promise((r) => setTimeout(r, 600));
  const box = await page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, inView: r.top >= 0 && r.bottom <= window.innerHeight };
  });
  if (box.inView) await page.touchscreen.tap(box.x, box.y);
  else await page.click(selector);
  await new Promise((r) => setTimeout(r, 220));
};

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const pageInfo of [
      { name: 'learning-lab', url: '/workshops/learning-lab.html', wait: '#canvas-quest' },
      { name: 'mario-lab', url: '/workshops/jump-jump-mario-workshop.html', wait: '#jumpLab' }
    ]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await page.goto('http://127.0.0.1:' + port + pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector(pageInfo.wait, { timeout: 25000 });
      await new Promise(r => setTimeout(r, 800));

      let l = await page.evaluate(readLayout);
      check(pageInfo.name + ': shared quest layout mounts', !!l && l.tabs === 2, l ? 'tabs=' + l.tabs : 'missing');
      check(pageInfo.name + ': phone shows one pane with tabs', !!l && l.tabsShown && l.codeShown !== l.previewShown && l.active === 'code', JSON.stringify(l));
      check(pageInfo.name + ': initial code pane has real size', !!l && !!l.codeRect && l.codeRect.h > 40, l && l.codeRect ? l.codeRect.w + 'x' + l.codeRect.h : 'missing');
      check(pageInfo.name + ': no overflow at 390px', !!l && l.overflow <= 2, l ? String(l.overflow) : 'missing');

      await tapSelector(page, '[data-quest-tab="preview"]');
      l = await page.evaluate(readLayout);
      check(pageInfo.name + ': touch tap switches to Preview', !!l && l.active === 'preview' && l.previewShown && !l.codeShown && l.tabPressed === 'preview', JSON.stringify(l));
      check(pageInfo.name + ': preview pane has real size after tap', !!l && !!l.previewRect && l.previewRect.h > 40, l && l.previewRect ? l.previewRect.w + 'x' + l.previewRect.h : 'missing');

      // Arrow keys move between tabs.
      await page.evaluate(() => { const t = document.querySelector('[data-quest-tab="preview"]'); if (t) t.focus(); });
      await page.keyboard.press('ArrowLeft');
      await new Promise(r => setTimeout(r, 150));
      l = await page.evaluate(readLayout);
      check(pageInfo.name + ': arrow keys switch panes', !!l && l.active === 'code' && l.tabPressed === 'code', JSON.stringify(l));

      // Grow the window: both panes, tabs hidden (the dual-pane desktop view).
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      await new Promise(r => setTimeout(r, 350));
      l = await page.evaluate(readLayout);
      check(pageInfo.name + ': desktop shows both panes', !!l && !l.tabsShown && l.codeShown && l.previewShown, JSON.stringify(l));
      check(pageInfo.name + ': desktop panes keep real size', !!l && !!l.codeRect && !!l.previewRect && l.codeRect.h > 40 && l.previewRect.h > 40, JSON.stringify(l && { code: l.codeRect, preview: l.previewRect }));
      check(pageInfo.name + ': no overflow at 1440px', !!l && l.overflow <= 2, l ? String(l.overflow) : 'missing');

      // Back to a phone: tabs return and one pane at a time.
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await new Promise(r => setTimeout(r, 350));
      l = await page.evaluate(readLayout);
      check(pageInfo.name + ': resizing back restores tabs', !!l && l.tabsShown && l.codeShown !== l.previewShown, JSON.stringify(l));
      check(pageInfo.name + ': zero runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nQuest layout audit: all checks passed');
})();

