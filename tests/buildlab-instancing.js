// BuildLab A2736: repeated identical blocks draw through InstancedMesh while
// selection, export and the logical block list still target every part.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19280;
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
    for (const vp of [{ name: 'desktop', w: 1440, h: 900, m: false, count: 500 }, { name: 'mobile', w: 390, h: 844, m: true, count: 200 }]) {
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

      const built = await page.evaluate(async (cfg) => {
        window.clearAll(true);
        for (let i = 0; i < cfg.count; i++) {
          window.addBlock((i % 25) * 1.1 - 12, Math.floor(i / 25) * 1.1, 0, 1, 1, 1, '#e94560');
        }
        await new Promise(r => setTimeout(r, 350));
        window.renderer.render(window.scene, window.camera);
        const stats = window._instanceStats;
        return {
          blocks: window.blocks.length,
          stats,
          calls: window.renderer.info.render.calls,
          hiddenMeshes: window.blocks.filter(b => b.visible === false).length,
          visibleMeshes: window.blocks.filter(b => b.visible !== false).length,
          exported: window.collectExportParts().length
        };
      }, vp);

      check(vp.name + ': all blocks exist', built.blocks === vp.count, 'blocks=' + built.blocks);
      check(vp.name + ': repeated blocks collapse into batches', built.stats.batches >= 1 && built.stats.batches <= 3, JSON.stringify(built.stats));
      check(vp.name + ': most logical meshes are hidden by instancing', built.hiddenMeshes >= vp.count - 10, 'hidden=' + built.hiddenMeshes);
      check(vp.name + ': draw calls stay small', built.calls < 80, 'calls=' + built.calls);
      check(vp.name + ': export still sees every block', built.exported === vp.count, 'exported=' + built.exported);

      const selected = await page.evaluate(async () => {
        const target = window.blocks[Math.floor(window.blocks.length / 2)];
        window.selectBlock(target);
        await new Promise(r => setTimeout(r, 250));
        window.renderer.render(window.scene, window.camera);
        return {
          selected: window.selectedBlock === target,
          highlight: !!window.highlight.visible,
          visible: target.visible !== false,
          hidden: window._instanceStats.hidden,
          calls: window.renderer.info.render.calls
        };
      });
      check(vp.name + ': the selected block is unhidden', selected.visible, JSON.stringify(selected));
      check(vp.name + ': selection and highlight still work', selected.selected && selected.highlight, JSON.stringify(selected));
      check(vp.name + ': one block leaves the instanced batch', selected.hidden <= vp.count - 1, 'hidden=' + selected.hidden);

      const moved = await page.evaluate(async () => {
        window.pushHistory('instancing-move');
        window.selectedBlock.position.x += 3;
        window.bakeGizmoTransform();
        window.deselectBlock();
        await new Promise(r => setTimeout(r, 250));
        window.renderer.render(window.scene, window.camera);
        return { blocks: window.blocks.length, hidden: window._instanceStats.hidden, batches: window._instanceStats.batches };
      });
      check(vp.name + ': moving a block keeps the batch consistent', moved.hidden >= vp.count - 1, JSON.stringify(moved));

      const toggled = await page.evaluate(async () => {
        window.setInstancingEnabled(false);
        await new Promise(r => setTimeout(r, 50));
        const off = { hidden: window._instanceStats.hidden, visible: window.blocks.filter(b => b.visible !== false).length };
        window.setInstancingEnabled(true);
        await new Promise(r => setTimeout(r, 250));
        return { off, on: window._instanceStats };
      });
      check(vp.name + ': the fallback shows normal meshes again', toggled.off.hidden === 0 && toggled.off.visible === vp.count, JSON.stringify(toggled.off));
      check(vp.name + ': instancing can be re-enabled', toggled.on.batches >= 1 && toggled.on.hidden >= vp.count - 1, JSON.stringify(toggled.on));

      check(vp.name + ': no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nBuildLab instancing: all checks passed');
})();
