#!/usr/bin/env node
/*
 * tests/pixel-studio-workflow.js
 * A1966: Pixel Studio must explain the character concept -> sprite -> animation
 * -> sheet sequence, document export details, and point at the next game project.
 * Run: node tests/pixel-studio-workflow.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PSWORKFLOW_PORT || 8131;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};

let failures = 0;
const check = (name, ok, detail) => { console.log((ok?'PASS ':'FAIL ')+name+(detail?' ['+detail+']':'')); if(!ok) failures++; };

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('jvds_pixel_seen','1'); } catch(e){} });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  const modal = await page.evaluate(() => {
    openStart();
    const el = document.getElementById('startModal');
    const txt = el.textContent;
    return {
      open: el.classList.contains('open'),
      workflow: txt.includes('Game-art workflow'),
      stages: ['1  Imagine','2  Refine','3  Animate','4  Export'].every(s => txt.includes(s)),
      specs: ['What the export gives you','Size','Transparency','Formats','Next step'].every(s => txt.includes(s)),
      gameLink: !!el.querySelector('a[href="arcade-game-maker.html"]'),
      godotLink: !!el.querySelector('a[href="../workshops/godot_tutorial.html"]'),
      buttons: el.querySelectorAll('[data-on="workflowStep"]').length
    };
  });
  check('start modal explains the game-art workflow', modal.open && modal.workflow && modal.stages, JSON.stringify(modal));
  check('start modal documents size, transparency, formats and next step', modal.specs && modal.gameLink && modal.godotLink);
  check('start modal has four workflow buttons', modal.buttons===4, String(modal.buttons));

  const modes = await page.evaluate(() => {
    const out = {};
    workflowStep('character'); out.character = studioMode;
    workflowStep('animate'); out.animate = studioMode;
    workflowStep('draw'); out.draw = studioMode;
    out.closed = !document.getElementById('startModal').classList.contains('open');
    return out;
  });
  check('workflow buttons switch modes', modes.character==='character' && modes.animate==='animate' && modes.draw==='draw' && modes.closed, JSON.stringify(modes));

  const next = await page.evaluate(() => {
    nextActionsShow();
    const bar = document.getElementById('next-actions');
    return {
      visible: getComputedStyle(bar).display !== 'none',
      play: !!bar.querySelector('[data-on="nextActionPlay"]'),
      text: bar.textContent
    };
  });
  check('export next step points at a game project', next.visible && next.play && /Use in Game Maker/.test(next.text), JSON.stringify({visible:next.visible,play:next.play}));

  check('no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PIXEL STUDIO WORKFLOW CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
