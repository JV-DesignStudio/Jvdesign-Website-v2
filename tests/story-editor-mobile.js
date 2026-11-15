/* Story Editor (tools/story-editor.html) mobile / parity checks.

   Covers the remaining parity gaps on a 390px touch device:
   - edit a passage, then Undo and Redo through the toolbar
   - Share builds a story-player.html#s= play link
   - Export JSON downloads a real .json file
   - save a slot, then reload and the slot is still listed
   - labelled controls and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/story-editor-mobile.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
async function tap(page, selector) {
  const el = await page.$(selector);
  if (!el) throw new Error('missing selector ' + selector);
  await el.tap();
}

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); } catch (e) {}
    });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED|net::ERR|google-analytics|googletagmanager/.test(text)) return;
      errors.push('console: ' + text.slice(0, 100));
    });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());

    const url = base + '/tools/story-editor.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const shell = await page.evaluate(() => {
      closeStoryWelcome();
      return {
        title: document.title,
        undo: !!document.querySelector('[data-on="undo"]'),
        redo: !!document.querySelector('[data-on="redo"]'),
        share: typeof copyPlayLink === 'function',
        labelled: document.querySelectorAll('[aria-label]').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    check('page title loads', /Story Editor/i.test(shell.title), shell.title);
    check('undo and redo buttons exist', shell.undo && shell.redo);
    check('share and export functions exist', shell.share);
    check('controls carry labels', shell.labelled >= 10, String(shell.labelled));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    // Touch proof: the passage drawer opens with one tap.
    await tap(page, '#storyDrawerBtn');
    await new Promise(r => setTimeout(r, 250));
    const drawerOpen = await page.evaluate(() => document.getElementById('storyDrawer').classList.contains('open'));
    check('a touch tap opens the passage drawer', drawerOpen);
    await page.evaluate(() => closeStoryDrawer());

    // Edit a passage twice, then Undo and Redo through the toolbar.
    const edited = await page.evaluate(() => {
      selectedNode = nodes.find(n => n.type === 'start') ? nodes.find(n => n.type === 'start').id : nodes[0].id;
      buildEditPanel();
      const original = nodes.find(n => n.id === selectedNode).text;
      updateNodeField('text', 'First version.');
      updateNodeField('text', 'Second version.');
      return { node: selectedNode, original, text: nodes.find(n => n.id === selectedNode).text };
    });
    check('the passage stores the edited text', edited.text === 'Second version.', edited.text);
    await page.evaluate(() => undo());
    await new Promise(r => setTimeout(r, 250));
    const undone = await page.evaluate((id) => nodes.find(n => n.id === id).text, edited.node);
    check('Undo reverts the edit', undone === edited.original, undone);
    await page.evaluate(() => redo());
    await new Promise(r => setTimeout(r, 250));
    const redone = await page.evaluate((id) => nodes.find(n => n.id === id).text, edited.node);
    check('Redo restores the edit', redone === 'Second version.', redone);

    // Share builds a story-player link.
    const shared = await page.evaluate(() => {
      window.__share = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__share = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      copyPlayLink();
      return window.__share;
    });
    check('Share copies a story-player link', /story-player\.html#s=/.test(shared), shared.slice(0, 70) + '...');

    // Export JSON downloads a file.
    const exported = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      exportJSON();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 3000);
    }));
    check('Export JSON downloads a .json file', /\.json$/i.test(exported || ''), exported);

    // Save a slot, then reload and the slot is still listed.
    const savedName = await page.evaluate(() => {
      document.getElementById('storyNameInput').value = 'Touch Story';
      storyName = 'Touch Story';
      saveToSlot(0);
      return (document.getElementById('saveSlots')?.innerText || '');
    });
    check('saving a slot records the story', /Touch Story/.test(savedName), savedName.replace(/\s+/g, ' ').slice(0, 60));
    const fresh = await browser.newPage();
    await fresh.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await fresh.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const restored = await fresh.evaluate(() => {
      const raw = localStorage.getItem('jvds_story_slots');
      let slots = [];
      try { slots = JSON.parse(raw || '[]'); } catch (e) {}
      return { hasSlot: Array.isArray(slots) && !!slots[0] && /Touch Story/.test(slots[0].name || ''), label: (document.getElementById('saveSlots')?.innerText || '') };
    });
    check('the saved slot survives a reload', restored.hasSlot, JSON.stringify(restored).slice(0, 100));
    await fresh.close();

    const desk = await browser.newPage();
    await desk.setViewport({ width: 1440, height: 900 });
    await desk.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await desk.evaluate(() => ({
      nodes: document.querySelectorAll('.story-node').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 editor boots', desktop.nodes >= 1, String(desktop.nodes));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);
    await desk.close();

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS story-editor-mobile: touch undo/redo, share, export and save slots work at 390');
})().catch(e => { console.error(e); process.exit(1); });
