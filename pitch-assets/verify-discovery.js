const puppeteer = require('puppeteer');
const { pathToFileURL } = require('url');
const path = require('path');

(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1240, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await p.goto(pathToFileURL(path.resolve(__dirname, '..', 'pages', 'discovery_session.html')).href, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  const base = await p.evaluate(() => ({
    revealsTotal: document.querySelectorAll('.reveal').length,
    revealsVisible: document.querySelectorAll('.reveal.visible').length,
    stats: [...document.querySelectorAll('.stat-n')].map(e => e.textContent),
    dotActive: document.querySelectorAll('.ds-dotnav a.active').length,
    gameCards: document.querySelectorAll('#gameGrid .game-card').length,
    new2026: document.querySelectorAll('#new2026 .new-card').length
  }));
  console.log('BASE:', JSON.stringify(base));

  // Test the "cozy" filter
  await p.evaluate(() => {
    const c = [...document.querySelectorAll('#gameFilters .filter-chip')].find(b => b.dataset.filter === 'cozy');
    c.click();
  });
  await new Promise(r => setTimeout(r, 200));
  const filtered = await p.evaluate(() => ({
    visible: [...document.querySelectorAll('#gameGrid .game-card')].filter(c => !c.classList.contains('filtered-out')).length,
    activeChip: document.querySelector('#gameFilters .filter-chip.active').textContent.trim()
  }));
  console.log('FILTER cozy:', JSON.stringify(filtered));
  console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');

  // reset filter to all for the screenshot
  await p.evaluate(() => { [...document.querySelectorAll('#gameFilters .filter-chip')].find(b => b.dataset.filter === 'all').click(); });
  await p.screenshot({ path: path.resolve(__dirname, 'discovery-new-full.png'), fullPage: true });
  // focused shot of the New 2026 section
  const el = await p.$('#new2026');
  await el.screenshot({ path: path.resolve(__dirname, 'discovery-new2026.png') });
  await b.close();
  console.log('screenshots written');
})().catch(e => { console.error(e); process.exit(1); });
