// A1581: the 3D Builders hub (pages/3d-builders.html).
// Checks the cards are well-formed (every anchor closed, no nesting), every
// builder link resolves, the type filter + search narrow the grid, and there is
// no horizontal overflow at 390/1440.
//
// Run: node tests/3d-builders-http.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = '/pages/3d-builders.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(ROOT, clean);
  if (!path.extname(p)) p = path.join(ROOT, 'pages', clean.replace(/^\//, '') + '.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' , ' + extra : '')); if (!ok) failures++; };
const visibleCards = (page) => page.evaluate(() =>
  document.querySelectorAll('.builders-grid > .bcard:not([hidden])').length);

(async () => {
  // raw-markup checks (a nesting bug that the HTML parser would silently fix)
  const raw = fs.readFileSync(path.join(ROOT, 'pages', '3d-builders.html'), 'utf8');
  const opens = (raw.match(/<a[\s>]/g) || []).length;
  const closes = (raw.match(/<\/a>/g) || []).length;
  check('every anchor is closed', opens === closes, opens + ' open vs ' + closes + ' close');
  check('15 builder cards in source', (raw.match(/class="bcard"/g) || []).length === 15);

  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + PAGE, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('.builders-grid > .bcard');

    const total = await page.evaluate(() => document.querySelectorAll('.builders-grid > .bcard').length);
    check('15 cards render', total === 15, 'cards=' + total);
    check('no card nests another card', await page.evaluate(() =>
      document.querySelectorAll('.bcard .bcard, a.bcard a').length) === 0);

    // every builder href resolves to a real file
    const hrefs = await page.evaluate(() => [].slice.call(document.querySelectorAll('a.bcard'))
      .map(a => a.getAttribute('href')));
    const missing = hrefs.filter(h => {
      const rel = h.replace(/^\.\.\//, '').replace(/^\//, '').split(/[?#]/)[0];
      return !fs.existsSync(path.join(ROOT, rel));
    });
    check('every builder link resolves', missing.length === 0, missing.join(', '));

    check('filter shows all by default', await visibleCards(page) === 15);
    await page.click('#bf-chips .bf-chip[data-type="vehicles"]');
    await new Promise(r => setTimeout(r, 60));
    check('Vehicles filter narrows to 5', await visibleCards(page) === 5);
    await page.click('#bf-chips .bf-chip[data-type="all"]');
    await page.type('#bf-q', 'rocket');
    await new Promise(r => setTimeout(r, 60));
    check('search "rocket" narrows to 1', await visibleCards(page) === 1);
    await page.evaluate(() => {
      const q = document.getElementById('bf-q');
      q.value = ''; q.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 60));
    check('clearing search restores all', await visibleCards(page) === 15);
    check('count readout updates', await page.evaluate(() => {
      const q = document.getElementById('bf-q');
      q.value = 'zzz'; q.dispatchEvent(new Event('input'));
      const t = document.getElementById('bf-count').textContent;
      q.value = ''; q.dispatchEvent(new Event('input'));
      return /0 of 15/.test(t);
    }));

    // A1919: every builder carries an age recommendation and a challenge level,
    // and the page defines the three levels in one place.
    const tiers = await page.evaluate(() => {
      const cards = [].slice.call(document.querySelectorAll('.builders-grid > .bcard'));
      const legend = [].slice.call(document.querySelectorAll('.age-levels .age-level')).map((el) => el.dataset.tier);
      const bad = cards.filter((c) => {
        const t = c.querySelector('.bcard-tier');
        return !t || !/^Ages /.test(t.textContent.trim()) || ['guided', 'design', 'advanced'].indexOf(t.dataset.tier) === -1;
      }).length;
      return {
        cards: cards.length,
        withTier: cards.filter((c) => !!c.querySelector('.bcard-tier')).length,
        bad,
        legend,
        hero: ((document.querySelector('.pill') || {}).textContent || '').trim()
      };
    });
    check('every builder card shows an age and level', tiers.withTier === tiers.cards && tiers.bad === 0, tiers.withTier + '/' + tiers.cards + ', bad=' + tiers.bad);
    check('age legend defines all three levels', ['guided', 'design', 'advanced'].every((t) => tiers.legend.indexOf(t) !== -1), tiers.legend.join(', '));
    check('hero names the three challenge levels', /3 challenge levels/.test(tiers.hero), tiers.hero);

    // A1921: the Explore, Improve, Invent pathway and its design note.
    await page.waitForSelector('[data-design-path]');
    await page.waitForFunction(() => !!window.__jvdsDesignPath, { timeout: 5000 });
    const pathway = await page.evaluate(() => {
      const root = document.querySelector('[data-design-path]');
      const levels = [].slice.call(root.querySelectorAll('.dp-level')).map((el) => ({
        level: el.getAttribute('data-level'),
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        hasCheck: !!el.querySelector('[data-path-check]'),
        href: (el.querySelector('.dp-link') || { getAttribute: () => '' }).getAttribute('href')
      }));
      return {
        levels,
        note: !!root.querySelector('[data-design-note]'),
        downloadDisabled: root.querySelector('[data-note-download]').disabled
      };
    });
    const pathNames = pathway.levels.map((l) => l.level).sort();
    check('design path has Explore, Improve and Invent', pathway.levels.length === 3 && pathNames.join(',') === 'explore,improve,invent', pathNames.join(','));
    check('every path level has a finished checkbox and a next link', pathway.levels.every((l) => l.hasCheck && /\.html/.test(l.href)));
    check('Invent asks for a brief, constraints and an exported model', /brief/i.test(pathway.levels[2].text) && /constraint/i.test(pathway.levels[2].text) && /export/i.test(pathway.levels[2].text));
    check('design note starts locked', pathway.note && pathway.downloadDisabled);

    await page.evaluate(() => {
      ['explore', 'improve', 'invent'].forEach((l) => {
        const c = document.querySelector('[data-path-check="' + l + '"]');
        c.checked = true;
        c.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const put = (k, v) => {
        const f = document.querySelector('[data-note="' + k + '"]');
        f.value = v;
        f.dispatchEvent(new Event('input', { bubbles: true }));
      };
      put('name', 'Sam');
      put('title', 'Desk Rocket');
      put('brief', 'A small rocket for a desk.');
      put('constraints', 'Must fit on a shelf and use five parts.');
      put('choices', 'I chose a wide fin so it stands up. I used a short nose so it looks fast. I added a hook for a cable.');
      put('improve', 'Make the fins stronger.');
    });
    await new Promise((r) => setTimeout(r, 120));
    const gate = await page.evaluate(() => {
      const root = document.querySelector('[data-design-path]');
      let stored = false;
      try { stored = !!localStorage.getItem('jvds-3d-design-path-v1'); } catch (e) { /* ignore */ }
      return {
        status: root.querySelector('[data-path-status]').textContent,
        noteStatus: root.querySelector('[data-note-status]').textContent,
        downloadDisabled: root.querySelector('[data-note-download]').disabled,
        copyDisabled: root.querySelector('[data-note-copy]').disabled,
        stored,
        note: window.__jvdsDesignPath.noteText()
      };
    });
    check('design note unlocks after three levels and a written explanation', !gate.downloadDisabled && !gate.copyDisabled, gate.noteStatus);
    check('design note includes the learner brief and choices', /Desk Rocket/.test(gate.note) && /wide fin/.test(gate.note) && /Constraints/.test(gate.note));
    check('design path saves to this device', gate.stored);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-design-path]');
    await page.waitForFunction(() => !!window.__jvdsDesignPath, { timeout: 5000 });
    const restored = await page.evaluate(() => ({
      checked: [].slice.call(document.querySelectorAll('[data-path-check]')).filter((c) => c.checked).length,
      name: document.querySelector('[data-note="name"]').value,
      downloadDisabled: document.querySelector('[data-note-download]').disabled
    }));
    check('design path and note restore after reload', restored.checked === 3 && restored.name === 'Sam' && !restored.downloadDisabled, JSON.stringify(restored));

    for (const w of [390, 1440]) {
      await page.setViewport({ width: w, height: 900, isMobile: w === 390, hasTouch: w === 390 });
      await new Promise(r => setTimeout(r, 150));
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('no horizontal overflow @' + w, ov <= 1, 'overflow=' + ov);
    }
    await page.close();
  } finally { await browser.close(); server.close(); }

  console.log('\n' + (failures ? 'FAILED ' + failures : 'ALL 3D-BUILDERS HUB CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})();

