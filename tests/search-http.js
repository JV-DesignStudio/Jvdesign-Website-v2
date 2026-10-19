// search-http.js , A1680
// /pages/search.html must handle multi-word queries (AND across terms) and rank
// title hits above description hits, while single-term search, the empty state
// and the filters keep working. Run: node tests/search-http.js
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => { const u = r.url(); (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort(); });
    await page.setViewport({ width: 1440, height: 1000 });

    await page.goto(base + '/pages/search.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.SITE_INDEX && window.SITE_INDEX.length > 0, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));

    const titles = () => page.evaluate(() => Array.from(document.querySelectorAll('#resultsGrid .result-card .rc-title')).map(e => e.textContent));
    const setQuery = q => page.evaluate(q => { const i = document.getElementById('searchInput'); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); }, q);

    const def = await titles();
    check('default load shows results', def.length > 0, def.length + ' cards');

    await setQuery('godot platformer');
    await new Promise(r => setTimeout(r, 250));
    const multi = await titles();
    check('multi-word "godot platformer" returns matches', multi.length > 0, multi.length + ' results');
    const multiCount = await page.evaluate(() => (document.getElementById('resultsCount') || {}).textContent || '');
    check('multi-word result count text names the query', /godot platformer/i.test(multiCount), multiCount);
    check('multi-word match includes a Godot page', multi.some(t => /godot/i.test(t)), multi.slice(0, 3).join(' | '));

    await setQuery('pixel character');
    await new Promise(r => setTimeout(r, 250));
    const ranked = await titles();
    check('"pixel character" ranks the Pixel Character page first', ranked.length > 0 && /pixel/i.test(ranked[0]), ranked[0] || '(none)');

    await setQuery('scratch');
    await new Promise(r => setTimeout(r, 250));
    const single = await titles();
    check('single-term "scratch" still returns matches', single.length > 0, single.length + ' results');

    // A1769: plain-language intent queries should land on the thing a child
    // means, not require the exact page title.
    const intentCases = [
      ['make a game', /game maker|arcade game maker|workshop|game/i],
      ['draw a character', /pixel|sprite|character/i],
      ['music', /sound|music|sfx|drum/i],
      ['sound', /sound|audio|music/i],
      ['3d model', /3d|buildlab|model|blender/i],
      ['no install', /school|chromebook|offline|workshop|tool/i],
      ['school chromebook', /school|chromebook|learn/i],
      ['roblox', /roblox/i],
      ['minecraft', /minecraft/i],
      ['python', /python/i],
      ['unity', /unity/i],
      ['unreal', /unreal/i],
      ['pixel art', /pixel|sprite|art/i],
      ['game design', /game|gdd|design/i],
      ['quiz', /quiz|millionaire/i],
      ['story', /story/i],
      ['map', /map|level|world/i],
      ['beginner', /beginner|first|start/i],
      ['free', /free|no account/i]
    ];
    for (const [q, re] of intentCases) {
      await setQuery(q);
      await new Promise(r => setTimeout(r, 180));
      const rows = await titles();
      check('intent "' + q + '" returns a relevant top result', rows.length > 0 && re.test(rows[0]), rows.slice(0, 3).join(' | '));
    }

    await setQuery('zzzznomatchzzz');
    await new Promise(r => setTimeout(r, 250));
    const miss = await page.evaluate(() => ({ empty: document.getElementById('emptyState').classList.contains('show'), cards: document.querySelectorAll('#resultsGrid .result-card').length }));
    check('nonsense query shows the empty state', miss.empty && miss.cards === 0, 'cards ' + miss.cards);
    const suggestions = await page.evaluate(() => Array.from(document.querySelectorAll('#emptyState .tag-chip')).map(e => e.textContent.trim()));
    check('empty state offers real next searches', ['Make a game', 'Pixel art', 'Roblox'].every(s => suggestions.includes(s)), suggestions.join(' | '));

    await setQuery('');
    await new Promise(r => setTimeout(r, 250));
    const reset = await titles();
    check('clearing the query restores all results', reset.length > 0, reset.length + ' cards');

    check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await new Promise(r => setTimeout(r, 200));
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check('search has no overflow at 390px', sw <= 392, 'scrollWidth ' + sw);
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL SEARCH CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
