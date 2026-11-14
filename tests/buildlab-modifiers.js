#!/usr/bin/env node
/*
 * tests/buildlab-modifiers.js
 * A2735: verifies non-destructive Mirror and Array modifiers.
 *
 * Covers turning each modifier on and off, changing axis/count/step while the
 * modifier stays attached, the source moving and the generated parts following,
 * the outliner hiding generated parts, deleting the source removing them, undo
 * restoring them, and export flattening the generated parts.
 *
 * Run: node tests/buildlab-modifiers.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19401;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
});
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const pause = ms => new Promise(r => setTimeout(r, ms));
const round = v => +Number(v).toFixed(2);

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({width: 1440, height: 900});
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
    await page.waitForFunction(() => typeof window.addBlock === 'function', {timeout: 20000});
    await pause(900);
    await page.evaluate(() => {
      try { closeModal('welcomeModal'); } catch (e) {}
      const w = document.getElementById('welcomeModal');
      if (w) w.classList.remove('open');
      document.body.classList.remove('bl-modal-open');
      const cb = document.getElementById('cookie-banner');
      if (cb) { const b = cb.querySelector('button'); if (b) b.click(); }
      window.clearAll(true);
    });

    const mirror = await page.evaluate(() => {
      const round = v => +Number(v).toFixed(2);
      window.clearAll(true);
      const src = window.addBlock(2, 0, 3, 1, 1, 1, '#e94560', 'box');
      window.selectBlock(src);
      window.setLiveMirror(true);
      const ids = window.blocks.map(b => b.userData.blockId);
      const clone = window.blocks.find(b => b.userData.modOwner === src.userData.blockId);
      window.setMirrorAxis('z');
      const xClone = window.blocks.find(b => b.userData.modOwner === src.userData.blockId);
      return {
        count: window.blocks.length,
        ids,
        cloneX: clone ? round(clone.position.x) : null,
        cloneZ: clone ? round(clone.position.z) : null,
        zAxisX: xClone ? round(xClone.position.x) : null,
        zAxisZ: xClone ? round(xClone.position.z) : null,
        mirror: src.userData.mods && src.userData.mods.mirror
      };
    });
    check('live mirror adds one adjustable part', mirror.count === 2, String(mirror.count));
    check('mirrored part lands across the X axis', mirror.cloneX === -2 && mirror.cloneZ === 3, JSON.stringify([mirror.cloneX, mirror.cloneZ]));
    check('changing the mirror axis moves the same modifier', mirror.zAxisX === 2 && mirror.zAxisZ === -3, JSON.stringify([mirror.zAxisX, mirror.zAxisZ]));
    check('mirror is stored on the source, not baked', !!mirror.mirror && mirror.mirror.on === true && mirror.mirror.axis === 'z', JSON.stringify(mirror.mirror));

    const array = await page.evaluate(() => {
      const round = v => +Number(v).toFixed(2);
      window.clearAll(true);
      const src = window.addBlock(0, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      window.selectBlock(src);
      document.getElementById('arrayCount').value = '3';
      document.getElementById('arrayStep').value = '2';
      window.setArrayAxis('x');
      window.setLiveArray(true);
      const xs = () => window.blocks
        .filter(b => b.userData.modOwner === src.userData.blockId)
        .map(b => round(b.position.x)).sort((a, b) => a - b);
      const first = {count: window.blocks.length, xs: xs()};
      document.getElementById('arrayCount').value = '5';
      window.updateArrayPreview();
      const wider = {count: window.blocks.length, xs: xs()};
      window.setArrayAxis('z');
      const zs = window.blocks
        .filter(b => b.userData.modOwner === src.userData.blockId)
        .map(b => round(b.position.z)).sort((a, b) => a - b);
      src.position.x += 4;
      window.updateStats();
      return {first, wider, zs, moved: xs().map(v => round(v + 4)), count: window.blocks.length};
    });
    check('live array starts with the copy count', array.first.count === 4, String(array.first.count));
    check('live array copies sit at the step spacing', JSON.stringify(array.first.xs) === JSON.stringify([2, 4, 6]), JSON.stringify(array.first.xs));
    check('raising the copy count adjusts the modifier', array.wider.count === 6, String(array.wider.count));
    check('the array axis can change after it is added', JSON.stringify(array.zs) === JSON.stringify([2, 4, 6, 8, 10]), JSON.stringify(array.zs));

    await pause(80);
    const moved = await page.evaluate(() => window.blocks
      .filter(b => b.userData.modOwner)
      .map(b => +Number(b.position.x).toFixed(2)).sort((a, b) => a - b));
    check('moving the source drags its live copies with it', JSON.stringify(moved) === JSON.stringify([4, 4, 4, 4, 4]), JSON.stringify(moved));

    const cleanup = await page.evaluate(() => {
      window.clearAll(true);
      const src = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.selectAllBlocks();
      document.getElementById('arrayCount').value = '3';
      document.getElementById('arrayStep').value = '1';
      window.setArrayAxis('x');
      window.setLiveArray(true);
      window.renderOutliner();
      const outlinerRows = document.querySelectorAll('#outlinerList [data-block-id]').length;
      window.setLiveArray(false);
      const afterOff = window.blocks.length;
      window.setLiveArray(true);
      const afterOn = window.blocks.length;
      window.deleteSelectedBlocks();
      const afterSourceDelete = window.blocks.length;
      window.undo();
      const afterUndo = window.blocks.length;
      window.undo();
      const afterUndoOff = window.blocks.length;
      return {outlinerRows, afterOff, afterOn, afterSourceDelete, afterUndo, afterUndoOff};
    });
    check('the outliner lists the source, not the generated parts', cleanup.outlinerRows === 1, String(cleanup.outlinerRows));
    check('switching the modifier off removes its parts', cleanup.afterOff === 1, String(cleanup.afterOff));
    check('switching it back on rebuilds them', cleanup.afterOn === 4, String(cleanup.afterOn));
    check('deleting the source removes its copies', cleanup.afterSourceDelete === 0, String(cleanup.afterSourceDelete));
    check('undo restores the source and its copies', cleanup.afterUndo === 4, String(cleanup.afterUndo));
    check('undo restores the modifier switched off', cleanup.afterUndoOff === 1, String(cleanup.afterUndoOff));

    const exported = await page.evaluate(() => {
      window.clearAll(true);
      const src = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.selectBlock(src);
      document.getElementById('arrayCount').value = '3';
      document.getElementById('arrayStep').value = '1';
      window.setArrayAxis('x');
      window.setLiveArray(true);
      return {parts: window.blocks.length, exported: window.buildProjectData().blocks.length};
    });
    check('export flattens live modifier parts', exported.exported === exported.parts && exported.parts === 4, JSON.stringify(exported));

    const roundTrip = await page.evaluate(() => {
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.selectAllBlocks();
      document.getElementById('arrayCount').value = '3';
      document.getElementById('arrayStep').value = '1';
      window.setArrayAxis('x');
      window.setLiveArray(true);
      const project = window.buildProjectData();
      const code = window.getShareCode();
      window.clearAll(true);
      window.loadProjectData(project);
      const byProject = {
        count: window.blocks.length,
        mods: !!(window.blocks[0].userData.mods && window.blocks[0].userData.mods.array.on),
        clones: window.blocks.filter(b => b.userData.modOwner).length
      };
      window.clearAll(true);
      window.importShareCodeData(window.decodeShareCode(code));
      const byShare = {
        count: window.blocks.length,
        mods: !!(window.blocks[0].userData.mods && window.blocks[0].userData.mods.array.on),
        clones: window.blocks.filter(b => b.userData.modOwner).length
      };
      const source = window.blocks.find(b => !b.userData.modOwner);
      window.selectBlock(source);
      document.getElementById('arrayCount').value = '5';
      window.updateArrayPreview();
      const edited = window.blocks.length;
      window.setLiveArray(false);
      return {projectParts: project.blocks.length, byProject, byShare, edited, off: window.blocks.length};
    });
    check('project data still contains every live part', roundTrip.projectParts === 4, String(roundTrip.projectParts));
    check('a project file restores the live modifier', roundTrip.byProject.count === 4 && roundTrip.byProject.mods && roundTrip.byProject.clones === 3, JSON.stringify(roundTrip.byProject));
    check('a share code restores the live modifier', roundTrip.byShare.count === 4 && roundTrip.byShare.mods && roundTrip.byShare.clones === 3, JSON.stringify(roundTrip.byShare));
    check('a restored modifier stays editable', roundTrip.edited === 6, String(roundTrip.edited));
    check('a restored modifier can be switched off', roundTrip.off === 1, String(roundTrip.off));

    check('zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB MODIFIER CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
