// tools/error-guide.html (Bug Hunter's Guide) HTTP runtime verification.
// Covers the regression-prone areas fixed in A826: the search/tab state bug
// (searching used to leave every engine section visible and break tab
// switching), the Copy fix buttons and click-to-copy code snippets, the
// DOM-derived engine badge counts, the no-results state, the accessibility
// pass (tab roles, aria-live count, aria-hidden arrows) and mobile fit.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail !== undefined ? ' , ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try { await browser.defaultBrowserContext().overridePermissions(origin, ['clipboard-read','clipboard-write']); } catch (e) {}

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Keep external CDN/font requests from hanging the run.
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('about:') || u.startsWith('blob:')) req.continue();
    else req.abort();
  });

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${origin}/tools/error-guide.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.error-card');

  /* ── structure + a11y ── */
  const struct = await page.evaluate(() => ({
    cards: document.querySelectorAll('.error-card').length,
    tabs: document.querySelectorAll('.engine-tab').length,
    visibleSections: document.querySelectorAll('.engine-section.visible').length,
    copyButtons: document.querySelectorAll('.card-copy').length,
    tourTarget: !!document.querySelector('#searchInput'),
    tabsRole: [...document.querySelectorAll('.engine-tab')].every(t => t.getAttribute('role') === 'tab' && t.hasAttribute('aria-selected')),
    liveCount: document.querySelector('#searchCount').getAttribute('aria-live') === 'polite',
    svgHidden: [...document.querySelectorAll('.arrow-down')].every(a => a.getAttribute('aria-hidden') === 'true'),
    badgeCounts: [...document.querySelectorAll('.engine-section')].every(s => {
      const n = s.querySelectorAll('.error-card').length;
      return s.querySelector('.engine-badge').textContent.trim() === (n + ' Error' + (n === 1 ? '' : 's'));
    })
  }));
  check('24 error cards render', struct.cards === 24, String(struct.cards));
  check('6 engine tabs', struct.tabs === 6, String(struct.tabs));
  check('exactly one engine visible on load', struct.visibleSections === 1, String(struct.visibleSections));
  check('every card has a Copy fix button', struct.copyButtons === 24, String(struct.copyButtons));
  check('Ember tour target (#searchInput) exists', struct.tourTarget);
  check('tabs carry role=tab + aria-selected', struct.tabsRole);
  check('search count is aria-live', struct.liveCount);
  check('decorative arrows are aria-hidden', struct.svgHidden);
  check('engine badges derive from the DOM', struct.badgeCounts);

  /* ── tab switching (click + keyboard) ── */
  await page.evaluate(() => document.getElementById('tab-roblox').click());
  let vis = await page.evaluate(() => [...document.querySelectorAll('.engine-section.visible')].map(s => s.id));
  check('clicking a tab shows only that engine', vis.length === 1 && vis[0] === 'engine-roblox', JSON.stringify(vis));

  await page.focus('#tab-roblox');
  await page.keyboard.press('ArrowRight');
  vis = await page.evaluate(() => [...document.querySelectorAll('.engine-section.visible')].map(s => s.id));
  check('arrow key moves to the next engine', vis.length === 1 && vis[0] === 'engine-godot', JSON.stringify(vis));

  /* ── search filters ── */
  await page.click('#searchInput');
  await page.type('#searchInput', 'null reference');
  await new Promise(r => setTimeout(r, 100));
  const search = await page.evaluate(() => ({
    sections: document.querySelectorAll('.engine-section.visible').length,
    cards: document.querySelectorAll('.error-card:not(.hidden)').length,
    count: document.querySelector('#searchCount').textContent,
    noResultsHidden: document.getElementById('noResults').hidden
  }));
  check('search shows all engines', search.sections === 6, String(search.sections));
  check('search keeps only matching cards', search.cards > 0 && search.cards < 24, String(search.cards));
  check('search count reports matches', /error(s)? found/.test(search.count), search.count);
  check('no-results hidden while there are matches', search.noResultsHidden === true, String(search.noResultsHidden));

  /* ── no-results state ── */
  await page.evaluate(() => { const i = document.getElementById('searchInput'); i.value = 'zzzznomatch'; i.dispatchEvent(new Event('input', {bubbles:true})); });
  await new Promise(r => setTimeout(r, 100));
  const empty = await page.evaluate(() => ({
    cards: document.querySelectorAll('.error-card:not(.hidden)').length,
    shown: !document.getElementById('noResults').hidden,
    term: document.getElementById('noResultsTerm').textContent
  }));
  check('no match shows the empty state', empty.shown && empty.cards === 0, JSON.stringify(empty));
  check('empty state echoes the search term', empty.term === 'zzzznomatch', empty.term);

  /* ── clear search + the tab regression ── */
  await page.evaluate(() => document.getElementById('noResultsClear').click());
  await new Promise(r => setTimeout(r, 100));
  vis = await page.evaluate(() => [...document.querySelectorAll('.engine-section.visible')].map(s => s.id));
  check('clearing search restores exactly one engine', vis.length === 1, JSON.stringify(vis));
  await page.evaluate(() => document.getElementById('tab-python').click());
  vis = await page.evaluate(() => [...document.querySelectorAll('.engine-section.visible')].map(s => s.id));
  check('tab switching still works after a search', vis.length === 1 && vis[0] === 'engine-python', JSON.stringify(vis));

  /* ── copy to clipboard ── */
  await page.evaluate(() => document.querySelector('#engine-python .error-card .card-copy').click());
  await page.waitForFunction(() => /Copied/.test(document.querySelector('#engine-python .error-card .card-copy').textContent), { timeout: 3000 }).catch(() => {});
  const copyLabel = await page.$eval('#engine-python .error-card .card-copy', el => el.textContent);
  check('Copy fix gives feedback', /Copied/.test(copyLabel), copyLabel);

  let clip = '';
  try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) {}
  if (clip) check('clipboard holds the copied fix', /\b1\./.test(clip), clip.slice(0, 40));

  await page.evaluate(() => document.querySelector('#engine-python .error-card code.copyable').click());
  const codeCopied = await page.$eval('#engine-python .error-card code.copyable', el => el.classList.contains('copied'));
  check('clicking a code snippet copies it', codeCopied);

  /* ── mobile fit ── */
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.error-card');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal overflow at 390px', overflow <= 1, overflow + 'px');

  check('zero uncaught JS errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nERROR GUIDE HTTP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
