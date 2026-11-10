// BuildLab A2740: delta/command undo history. Proves per-action diffs replace
// full-scene snapshots, that a 1,000-block scene can undo/redo deep history,
// and that groups, materials and imported meshes still restore correctly.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19279;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
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
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

async function dismiss(page) {
  await page.evaluate(() => {
    try { window.closeModal && window.closeModal('welcomeModal'); } catch (e) {}
    const w = document.getElementById('welcomeModal');
    if (w) w.classList.remove('open');
    document.body.classList.remove('bl-modal-open');
    const c = document.getElementById('cookie-accept');
    if (c) c.click();
  });
  await pause(200);
}

async function load(page) {
  await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
  await pause(900);
  await dismiss(page);
}

(async () => {
  await new Promise(resolve => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'desktop', w: 1440, h: 900, m: false, blocks: 1000, moves: 120 }, { name: 'mobile', w: 390, h: 844, m: true, blocks: 40, moves: 6 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('console', m => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
        errors.push('console: ' + text);
      });
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);
      await page.evaluate(async () => {
        try {
          localStorage.removeItem('buildlab_autosave');
          localStorage.removeItem('buildlab_autosave_idb');
          localStorage.setItem('buildlab_kidmode', '0');
        } catch (e) {}
        await new Promise(resolve => {
          try {
            const req = indexedDB.open('jvds-buildlab', 1);
            req.onsuccess = () => {
              try {
                const db = req.result;
                const tx = db.transaction('kv', 'readwrite');
                tx.objectStore('kv').delete('autosave');
                tx.objectStore('kv').delete('slots');
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); resolve(); };
              } catch (e) { resolve(); }
            };
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          } catch (e) { resolve(); }
        });
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await load(page);

      const deep = await page.evaluate(async (cfg) => {
        const t0 = performance.now();
        window.clearAll(true);
        for (let i = 0; i < cfg.blocks; i++) {
          window.addBlock((i % 25) * 1.1 - 12, Math.floor(i / 25) * 1.1, Math.floor(i / 500) * 1.1, 1, 1, 1, '#e94560');
        }
        const target = window.blocks[0];
        const startX = target.position.x;
        for (let i = 0; i < cfg.moves; i++) {
          window.pushHistory('move-step-' + i);
          target.position.x += 0.01;
        }
        const stats = window.getHistoryStats();
        const builtAt = performance.now();
        return { blocks: window.blocks.length, startX, endX: target.position.x, stats, buildMs: builtAt - t0 };
      }, vp);

      check(vp.name + ': scene created', deep.blocks === vp.blocks, 'blocks=' + deep.blocks);
      check(vp.name + ': history is capped at 30 steps', deep.stats.steps === Math.min(30, vp.moves), 'steps=' + deep.stats.steps);
      check(vp.name + ': deltas are smaller than one full snapshot', deep.stats.entryBytes < deep.stats.baseBytes,
        'deltas=' + deep.stats.entryBytes + 'B base=' + deep.stats.baseBytes + 'B');
      check(vp.name + ': deep edits stay under 10 seconds', deep.buildMs < 10000, Math.round(deep.buildMs) + 'ms');

      const step = await page.evaluate(() => {
        const before = window.blocks[0].position.x;
        window.undo();
        const afterUndo = window.blocks[0].position.x;
        window.redo();
        const afterRedo = window.blocks[0].position.x;
        return { before, afterUndo, afterRedo };
      });
      check(vp.name + ': undo steps one action back', Math.abs(step.afterUndo - (step.before - 0.01)) < 0.0001,
        'before=' + step.before + ' after=' + step.afterUndo);
      check(vp.name + ': redo restores the action', Math.abs(step.afterRedo - step.before) < 0.0001,
        'redo=' + step.afterRedo + ' expected=' + step.before);

      const deepUndo = await page.evaluate((moves) => {
        const end = window.blocks[0].position.x;
        const t0 = performance.now();
        for (let i = 0; i < 30; i++) window.undo();
        const afterUndo = window.blocks[0].position.x;
        for (let i = 0; i < 30; i++) window.redo();
        const afterRedo = window.blocks[0].position.x;
        return { end, afterUndo, afterRedo, ms: performance.now() - t0, moves };
      }, vp.moves);
      const walkBack = 0.01 * Math.min(30, vp.moves);
      check(vp.name + ': undos walk back the retained deltas', Math.abs(deepUndo.afterUndo - (deepUndo.end - walkBack)) < 0.0001,
        'end=' + deepUndo.end + ' after=' + deepUndo.afterUndo);
      check(vp.name + ': redos return to the end', Math.abs(deepUndo.afterRedo - deepUndo.end) < 0.0001,
        'redo=' + deepUndo.afterRedo + ' end=' + deepUndo.end);
      check(vp.name + ': undo/redo history stays responsive', deepUndo.ms < 6000, Math.round(deepUndo.ms) + 'ms');

      const group = await page.evaluate(() => {
        window.clearAll(true);
        window.addBlock(0, 0, 0);
        window.addBlock(1, 0, 0);
        const originalPrompt = window.prompt;
        window.prompt = () => 'Test group';
        window.selectBlock(window.blocks[0]);
        window.toggleMultiSelect(window.blocks[1]);
        window.groupSelectedBlocks();
        window.prompt = originalPrompt;
        const grouped = window.groups.length;
        window.undo();
        const afterUndo = window.groups.length;
        window.redo();
        const afterRedo = window.groups.length;
        return { grouped, afterUndo, afterRedo };
      });
      check(vp.name + ': group change is recorded', group.grouped === 1, JSON.stringify(group));
      check(vp.name + ': undo removes the group', group.afterUndo === 0, JSON.stringify(group));
      check(vp.name + ': redo restores the group', group.afterRedo === 1, JSON.stringify(group));

      const material = await page.evaluate(() => {
        window.clearAll(true);
        window.addBlock(0, 0, 0);
        window.selectBlock(window.blocks[0]);
        window.updateMaterial('roughness', 0.9);
        const changed = window.blocks[0].userData.roughness;
        window.undo();
        const afterUndo = window.blocks[0].userData.roughness;
        window.redo();
        const afterRedo = window.blocks[0].userData.roughness;
        return { changed, afterUndo, afterRedo };
      });
      check(vp.name + ': material change is recorded', material.changed === 0.9, JSON.stringify(material));
      check(vp.name + ': undo restores the material', material.afterUndo === 0.55, JSON.stringify(material));
      check(vp.name + ': redo reapplies the material', material.afterRedo === 0.9, JSON.stringify(material));

      const imported = await page.evaluate(() => {
        window.clearAll(true);
        const floats = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        let binary = '';
        new Uint8Array(floats.buffer).forEach(b => { binary += String.fromCharCode(b); });
        const mesh = window.addImportedPartFromData({ p: btoa(binary), colour: '#00d4aa', w: 1, h: 1, d: 1 });
        if (!mesh) return { ok: false };
        const startX = mesh.position.x;
        window.pushHistory('import-move');
        mesh.position.x += 5;
        window.undo();
        const afterUndo = mesh.position.x;
        window.redo();
        const afterRedo = mesh.position.x;
        window.pushHistory('import-delete');
        window.deleteBlock(mesh);
        const afterDelete = window.blocks.length;
        window.undo();
        const afterRestore = window.blocks.length;
        return { ok: true, startX, afterUndo, afterRedo, afterDelete, afterRestore };
      });
      check(vp.name + ': imported mesh moves undo', imported.ok && Math.abs(imported.afterUndo - imported.startX) < 0.0001, JSON.stringify(imported));
      check(vp.name + ': imported mesh moves redo', imported.ok && Math.abs(imported.afterRedo - (imported.startX + 5)) < 0.0001, JSON.stringify(imported));
      check(vp.name + ': deleting an imported mesh is undoable', imported.ok && imported.afterDelete === 0 && imported.afterRestore === 1, JSON.stringify(imported));

      check(vp.name + ': no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nBuildLab command undo: all checks passed');
})();
