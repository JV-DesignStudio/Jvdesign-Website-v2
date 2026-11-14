/* Game Planner (tools/quest-board.html) parity checks.

   Covers the Tool Parity bar for this page:
   - undo / redo of a quick-captured quest
   - share link (#b=) round-trips a board to a fresh device
   - pointer drag moves a card between columns (desktop) and the board
     still lays out without overflow at 390px

   Run: node tests/quest-board-mobile.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    // 390px: undo / redo + share link
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(base + '/tools/quest-board.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 500));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('390 no horizontal overflow', overflow <= 2, 'overflow=' + overflow);

    const title = 'Mobile parity ' + Date.now();
    await page.type('#quickTitle', title);
    await page.evaluate(() => document.getElementById('quickForm').requestSubmit());
    await new Promise(r => setTimeout(r, 300));
    const hasAfterAdd = await page.evaluate(t => document.body.innerText.includes(t), title);
    check('quick capture shows the quest', hasAfterAdd);

    await page.click('#undoBtn');
    await new Promise(r => setTimeout(r, 250));
    const hasAfterUndo = await page.evaluate(t => document.body.innerText.includes(t), title);
    check('undo removes the quest', !hasAfterUndo);

    await page.click('#redoBtn');
    await new Promise(r => setTimeout(r, 250));
    const hasAfterRedo = await page.evaluate(t => document.body.innerText.includes(t), title);
    check('redo restores the quest', hasAfterRedo);

    await page.click('#shareBtn');
    await new Promise(r => setTimeout(r, 250));
    const shareHash = await page.evaluate(() => location.hash);
    check('share writes a #b= link', /^#b=/.test(shareHash), shareHash.slice(0, 24) + '...');

    // Fresh device: clear storage, reopen the shared link, quest should load.
    await page.evaluate(() => localStorage.clear());
    await page.goto(base + '/tools/quest-board.html' + shareHash, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 500));
    const sharedLoaded = await page.evaluate(t => document.body.innerText.includes(t), title);
    check('shared link loads the board on a fresh device', sharedLoaded);

    // 1440px: pointer drag from To Do into In Progress
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/tools/quest-board.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => { localStorage.clear(); location.reload(); });
    await new Promise(r => setTimeout(r, 700));
    await page.type('#quickTitle', 'Drag me');
    await page.evaluate(() => document.getElementById('quickForm').requestSubmit());
    await new Promise(r => setTimeout(r, 300));

    const pos = await page.evaluate(() => {
      const card = document.querySelector('#board .quest[data-id]');
      const target = document.querySelector('.column[data-col="doing"]');
      if (!card || !target) return null;
      const a = card.getBoundingClientRect(), b = target.getBoundingClientRect();
      return { id: card.dataset.id, x1: a.x + a.width / 2, y1: a.y + a.height / 2, x2: b.x + b.width / 2, y2: b.y + 60 };
    });
    check('board exposes draggable cards with data-id', !!pos, pos ? pos.id : 'no card');
    if (pos) {
      await page.mouse.move(pos.x1, pos.y1);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(pos.x1 + (pos.x2 - pos.x1) * i / 8, pos.y1 + (pos.y2 - pos.y1) * i / 8);
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 400));
      const colId = await page.evaluate(id => {
        try { const d = JSON.parse(localStorage.getItem('qb-data-v1')); const c = d.cards.find(x => x.id === id); return c ? c.colId : null; } catch { return null; }
      }, pos.id);
      check('drag moves the card to the target column', colId === 'doing', 'colId=' + colId);
    }

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS quest-board-mobile: undo/redo, share link and drag work at 390 and 1440');
})().catch(e => { console.error(e); process.exit(1); });
