const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.SFX_PORT || 8127;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.webp':'image/webp'};
const results = [];
function record(name, ok, detail='') { results.push({name, ok, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); }

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('ERR_NETWORK_ACCESS_DENIED')) return;
    errors.push('console: ' + text);
  });
  await page.goto(`http://127.0.0.1:${PORT}/tools/sfx-generator.html`, {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.waitForSelector('#catGrid', {timeout: 15000});
  await new Promise(r => setTimeout(r, 600));

  const checks = await page.evaluate(() => ({
    title: document.title,
    categories: document.querySelectorAll('.cat-card').length,
    heroBadge: document.querySelector('.hero-badge')?.textContent.trim(),
    playText: document.getElementById('playBtn')?.textContent.trim(),
    hasSend: typeof sendToGameMaker === 'function',
    hasEscape: typeof escapeHtml === 'function',
    duplicateSkipLinks: document.querySelectorAll('.skip-link').length,
  }));
  record('page title loads', /SFX Generator/.test(checks.title));
  record('category grid renders', checks.categories >= 12, String(checks.categories));
  record('hero badge is clean', checks.heroBadge === 'Game Dev Toolbox', checks.heroBadge);
  record('preview button is clean', checks.playText === '▶ Preview Sound', checks.playText);
  record('Game Maker handoff function exists', checks.hasSend);
  record('escape helper exists', checks.hasEscape);
  record('single skip link remains', checks.duplicateSkipLinks === 1, String(checks.duplicateSkipLinks));

  const historySafe = await page.evaluate(() => {
    sfxSaves = [{name:'<img src=x onerror=alert(1)>', date:'<b>today</b>', cat:'jump', variant:0, tweaks:{vol:80, pitch:0, speed:1, rev:0, dist:0, crush:0}}];
    renderSfxSaves();
    return !document.querySelector('#savedList img') && document.querySelector('#savedList span')?.textContent.includes('<img');
  });
  record('saved sound names render as text', historySafe);
  record('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok);
  if (failed.length) process.exit(1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
