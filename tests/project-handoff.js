#!/usr/bin/env node
// tests/project-handoff.js (A2321)
// Proves a project can leave one device as a code or a file and arrive intact on
// another device, with no account and no server. Uses a fresh browser context as
// the "other device" so the two localStorage stores are genuinely separate.
// Run: node tests/project-handoff.js
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8138;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

const URL_TOOL = 'http://127.0.0.1:' + PORT + '/tools/level-designer.html';

async function openTool(browser, viewport) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport(viewport);
  await page.goto(URL_TOOL, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForFunction('window.JVDSToolProject && window.JVDSToolProject.open', { timeout: 20000 });
  await sleep(400);
  return { page, errors };
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ width: 390, height: 844, label: '390' }, { width: 1440, height: 900, label: '1440' }]) {
      const ctxA = await browser.createBrowserContext();
      const a = await openTool(ctxA, vp);

      const seeded = await a.page.evaluate(() => {
        localStorage.setItem('jvds_level_autosave', JSON.stringify({ gridW: 20, gridH: 15, paint: [1, 2, 3] }));
        localStorage.setItem('jvds_palette_last', JSON.stringify(['#e94560', '#f5a623']));
        return { has: window.JVDSToolProject.hasSaved(), tool: window.JVDSToolProject.tool };
      });
      check('handoff @ ' + vp.label + ': toolkit is present', seeded.tool === 'level-designer', JSON.stringify(seeded));

      const code = await a.page.evaluate(() => window.JVDSToolProject.toCode());
      check('handoff @ ' + vp.label + ': code encodes the saved work', /^JVPROJ1:/.test(code) && code.length > 40, 'len=' + code.length);

      await a.page.evaluate(() => {
        window.__dl = {};
        HTMLAnchorElement.prototype.click = function () {
          if (this.download) { window.__dl.download = this.download; window.__dl.href = this.href; }
        };
      });
      const file = await a.page.evaluate(() => {
        const r = window.JVDSToolProject.download();
        return { name: r.name, bytes: r.bytes, download: window.__dl.download, href: window.__dl.href };
      });
      check('handoff @ ' + vp.label + ': Save to a file names a .jvproj.txt', /^jvds-level-designer-\d{8}\.jvproj\.txt$/.test(file.name) && file.download === file.name, JSON.stringify(file));
      const downloaded = await a.page.evaluate(async () => (await fetch(window.__dl.href)).text());
      check('handoff @ ' + vp.label + ': downloaded file holds the code', downloaded === code, 'bytes=' + downloaded.length);

      const entry = await a.page.evaluate(() => {
        window.JVDSStudio.panel.open();
        const btn = Array.from(document.querySelectorAll('button, a'))
          .find((b) => /Move to another device/i.test(b.textContent || ''));
        if (!btn) return { found: false };
        btn.click();
        return { found: true };
      });
      await sleep(250);
      const modal = await a.page.evaluate(() => {
        const m = document.getElementById('jvds-project-modal');
        return {
          open: !!(m && getComputedStyle(m).display !== 'none'),
          text: m ? m.textContent : '',
          download: !!document.getElementById('jvds-project-download'),
          file: !!document.getElementById('jvds-project-file')
        };
      });
      check('handoff @ ' + vp.label + ': Studio tools offers the handoff', entry.found && modal.open, JSON.stringify({ found: entry.found, open: modal.open }));
      check('handoff @ ' + vp.label + ': modal offers code and file, and says nothing uploads', modal.download && modal.file && /Nothing is sent anywhere/.test(modal.text), '');

      // The "other device": a fresh browser context with its own localStorage.
      const ctxB = await browser.createBrowserContext();
      const b = await openTool(ctxB, vp);
      const restored = await b.page.evaluate(async (c) => {
        const f = new File([c], 'handoff.jvproj.txt', { type: 'text/plain' });
        const n = await window.JVDSToolProject.openFile(f);
        return { n, level: localStorage.getItem('jvds_level_autosave'), palette: localStorage.getItem('jvds_palette_last') };
      }, code);
      let levelOk = false;
      try { levelOk = JSON.parse(restored.level).paint.join(',') === '1,2,3'; } catch (e) {}
      check('handoff @ ' + vp.label + ': file restores the project on another device', restored.n >= 2 && levelOk, JSON.stringify(restored));

      const bad = await b.page.evaluate(async () => {
        try {
          await window.JVDSToolProject.openFile(new File(['not a project'], 'wrong.txt', { type: 'text/plain' }));
          return 'no-error';
        } catch (e) { return e.message; }
      });
      check('handoff @ ' + vp.label + ': a bad file is rejected with a clear message', /not a JVDS project code/i.test(bad), bad);

      check('handoff @ ' + vp.label + ': no page errors', a.errors.length === 0 && b.errors.length === 0, a.errors.concat(b.errors).join(' | '));

      await ctxA.close();
      await ctxB.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PROJECT HANDOFF CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
