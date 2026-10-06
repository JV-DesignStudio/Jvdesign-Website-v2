#!/usr/bin/env node
// A673: the shared tool-handoff.js must expose the workshop panel control and the
// Send-to-Game-Maker slot hand-off, and arcade-game-maker.html must use it.
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, b) => { res.writeHead(e ? 404 : 200); res.end(e ? '' : b); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  let failures = 0;
  const check = (n, c, d) => { console.log(`${c ? '✓' : '✗'} ${n}${d ? ' - ' + d : ''}`); if (!c) failures++; };
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      if (u.startsWith('http://127.0.0.1:') || u.startsWith('data:') || u === 'about:blank') r.continue();
      else r.abort();
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.JVDSHandoff, { timeout: 15000 });

    const api = await page.evaluate(() => ({
      api: typeof window.JVDSHandoff,
      open: typeof window.openWorkshop,
      sw: typeof window.switchWorkshopTool,
      route: typeof window.JVDSHandoff.routeImportedSprite,
      send: typeof window.JVDSHandoff.sendToGameMaker,
      tabs: document.querySelectorAll('.wk-tab').length,
      localDef: /function\s+openWorkshop\s*\(/.test(document.documentElement.innerHTML)
    }));
    check('JVDSHandoff present', api.api === 'object');
    check('window.openWorkshop / switchWorkshopTool come from the shared script', api.open === 'function' && api.sw === 'function');
    check('routeImportedSprite + sendToGameMaker exposed', api.route === 'function' && api.send === 'function');
    check('workshop tabs exist', api.tabs > 0, 'tabs=' + api.tabs);
    check('page no longer defines openWorkshop locally', api.localDef === false);

    const sw = await page.evaluate(() => {
      const btn = document.querySelector('.wk-tab');
      window.switchWorkshopTool(btn);
      return { on: btn.classList.contains('on'), src: document.getElementById('wkIframe').src, ds: btn.dataset.src };
    });
    check('switchWorkshopTool sets the iframe src', sw.src.includes(sw.ds), sw.src);
    check('switchWorkshopTool marks the tab active', sw.on);

    const ov = await page.evaluate(() => { window.openWorkshop('pixel-studio.html'); return document.getElementById('wkOverlay').classList.contains('open'); });
    check('openWorkshop opens the overlay', ov);

    const route = await page.evaluate(() => {
      window.__hit = null;
      window.JVDSHandoff.register({ enemy: (url, label) => { window.__hit = { url, label }; } });
      window.JVDSHandoff.sendToGameMaker('enemy');
      const marked = localStorage.getItem('jvds_import_slot');
      const name = window.JVDSHandoff.routeImportedSprite('DATA', 'art');
      const cleared = localStorage.getItem('jvds_import_slot');
      return { marked, name, cleared, hit: window.__hit };
    });
    check('sendToGameMaker marks the slot', route.marked === 'enemy');
    check('routeImportedSprite dispatches to the slot applier', !!route.hit && route.hit.url === 'DATA' && route.hit.label === 'art', JSON.stringify(route.hit));
    check('routeImportedSprite returns the slot label', route.name === 'Enemy', route.name);
    check('routeImportedSprite clears the slot marker', route.cleared === null);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n✗ arcade hand-off: ${failures} check(s) failed` : '\n✓ arcade hand-off: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('✗ arcade hand-off: ' + e.message); process.exit(1); });
