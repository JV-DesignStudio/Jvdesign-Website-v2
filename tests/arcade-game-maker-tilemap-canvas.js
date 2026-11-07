#!/usr/bin/env node
/*
 * tests/arcade-game-maker-tilemap-canvas.js , A2712
 * The inline level editor must keep its true 322:242 ratio at every width, fill
 * dead space with the charcoal background, scale for devicePixelRatio and keep
 * pointer mapping on the painted cell. The Phaser game canvas must keep
 * Scale.FIT + CENTER_BOTH.
 * Run: node tests/arcade-game-maker-tilemap-canvas.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_TILEPORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    for (const cfg of [{ width:390, height:844, dpr:1 }, { width:1440, height:900, dpr:1 }, { width:2560, height:1080, dpr:2 }]) {
      const page = await browser.newPage();
      const jsErrors = [];
      page.on('pageerror', e => jsErrors.push(e.message));
      await page.setViewport({ width:cfg.width, height:cfg.height, deviceScaleFactor:cfg.dpr });
      await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
      await page.waitForFunction(() => typeof window._tmCoord === 'function' && typeof window._tmScaleCanvas === 'function', { timeout:15000 });
      await page.evaluate(() => {
        const g = document.getElementById('genreMode');
        g.value = 'PLATFORMER';
        if (typeof onGenreChange === 'function') onGenreChange();
        const panel = document.getElementById('studioPanel');
        if (panel) panel.classList.add('panel-open');
        const buildTab = document.querySelector('[data-tab="build"]');
        if (buildTab && typeof switchTab === 'function') switchTab('build', buildTab);
        if (typeof _applyBuildMore === 'function') _applyBuildMore(true);
        const lmg = document.getElementById('levelMapGroup');
        if (lmg) lmg.style.display = 'block';
        _tmScaleCanvas();
      });
      await sleep(250);

      const m = await page.evaluate(() => {
        const cvs = document.getElementById('tilemapCanvas');
        const frame = document.getElementById('tmCanvasFrame');
        const r = cvs.getBoundingClientRect();
        const cells = [[0,0],[10,7],[19,14]];
        const mapping = cells.map(([col,row]) => {
          const padX = (col + 0.5) / 20, padY = (row + 0.5) / 15;
          const idx = _tmCoord({ clientX: r.left + r.width * padX, clientY: r.top + r.height * padY });
          return { col, row, idx, want: row * 20 + col };
        });
        return {
          rect: { w: r.width, h: r.height },
          ratio: r.height ? r.width / r.height : 0,
          hiddenBy: (() => {
            let el = cvs;
            const chain = [];
            while (el && el !== document.body) {
              const cs = getComputedStyle(el);
              chain.push((el.id || el.className || el.tagName) + ':' + cs.display + '/' + cs.visibility + '/' + Math.round(el.getBoundingClientRect().width));
              el = el.parentElement;
            }
            return chain.join(' > ');
          })(),
          parentDisplay: getComputedStyle(cvs.parentElement).display,
          wrap: (() => { const w = document.getElementById('buildMoreWrap'); return w ? { style: w.getAttribute('style'), hidden: w.hidden, cls: w.className, disp: getComputedStyle(w).display } : null; })(),
          backing: { w: cvs.width, h: cvs.height },
          frameBg: frame ? getComputedStyle(frame).backgroundColor : '',
          cssRatio: getComputedStyle(cvs).aspectRatio,
          mapping
        };
      });

      const label = cfg.width + 'px' + (cfg.dpr > 1 ? ' @' + cfg.dpr + 'x' : '');
      check('[' + label + '] canvas has a positive size', m.rect.w > 0 && m.rect.h > 0, JSON.stringify(m.rect) + ' hiddenBy=' + m.hiddenBy + ' parent=' + m.parentDisplay);
      check('[' + label + '] 322:242 ratio is kept', Math.abs(m.ratio - (322 / 242)) < 0.02, m.ratio.toFixed(4));
      check('[' + label + '] backing store scales for DPR', m.backing.w === Math.round(322 * cfg.dpr) && m.backing.h === Math.round(242 * cfg.dpr), JSON.stringify(m.backing));
      check('[' + label + '] charcoal letterbox frame', /rgb\(26, 18, 8\)/.test(m.frameBg), m.frameBg);
      check('[' + label + '] pointer mapping lands on the cell', m.mapping.every(x => x.idx === x.want), JSON.stringify(m.mapping));
      check('[' + label + '] no page errors', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
      await page.close();
    }

    const page = await browser.newPage();
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window._buildPhaserConfig === 'function', { timeout:15000 });
    const phaserScale = await page.evaluate(async () => {
      await ensurePhaser();
      const c = _buildPhaserConfig({ genre:'PLATFORMER', title:'Ratio', speed:200, gravity:600, jump:450, map:null });
      return { mode: c.scale.mode, center: c.scale.autoCenter, fit: Phaser.Scale.FIT, centreBoth: Phaser.Scale.CENTER_BOTH };
    });
    check('Phaser game canvas keeps Scale.FIT', phaserScale.mode === phaserScale.fit, String(phaserScale.mode));
    check('Phaser game canvas keeps CENTER_BOTH', phaserScale.center === phaserScale.centreBoth, String(phaserScale.center));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker tilemap canvas: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
