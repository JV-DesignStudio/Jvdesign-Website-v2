/* Dev Tools hub page check (A1821).

   pages/dev-tools.html is one of the representative performance pages. This
   keeps the hub usable after the layout was moved into <head> so the tools
   grid no longer jumps into place after first paint.

   Run: node tests/dev-tools-http.js
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
    for (const vp of [{ width: 1440, height: 900, isMobile: false, hasTouch: false }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
      const page = await browser.newPage(), errors = [];
      if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport(vp);
      const res = await page.goto(base + '/pages/dev-tools.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Start every viewport from a clean first-visit state.
      await page.evaluate(() => { try { localStorage.removeItem('jvds_last_activity'); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 700));
      const d = await page.evaluate(() => {
        const q = sel => document.querySelector(sel);
        const tools = q('#tools'), handoff = q('.hub-handoff--create');
        const audioBtn = q('.filter-btn[data-filter="audio pipeline"]');
        if (audioBtn) audioBtn.click();
        const visibleCats = [...document.querySelectorAll('.tool-category')].filter(c => c.style.display !== 'none');
        const visibleCards = visibleCats.reduce((n, c) => n + c.querySelectorAll('[data-tool-card]').length, 0);
        const visibleCatCount = visibleCats.length;
        const allBtn = q('.filter-btn[data-filter="all"]');
        if (allBtn) allBtn.click();
        return {
          visibleCats: visibleCatCount,
          visibleCards,
          title: document.title,
          tools: !!tools,
          cards: document.querySelectorAll('#tools [data-tool-card]').length,
          start: !!q('.hub-start'),
          path: !!q('#toolPathTitle'),
          handoff: !!handoff,
          intents: document.querySelectorAll('.hub-intents .intent-path').length,
          bodyDisplay: getComputedStyle(document.body).display,
          toolsY: tools ? Math.round(tools.getBoundingClientRect().top) : -1,
          intentsY: q('.hub-intents') ? Math.round(q('.hub-intents').getBoundingClientRect().top) : -1,
          handoffY: handoff ? Math.round(handoff.getBoundingClientRect().top) : -1,
          resumeExists: !!q('#resumeLast'),
          resumeHidden: q('#resumeLast') ? q('#resumeLast').hidden : null,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      check(vp.width + ' page returns 200', res && res.status() === 200, res ? String(res.status()) : 'no response');
      check(vp.width + ' has a title', /Toolbox/i.test(d.title), d.title);
      check(vp.width + ' tools grid exists', d.tools);
      check(vp.width + ' tool cards present', d.cards >= 10, 'cards=' + d.cards);
      check(vp.width + ' start and guided path present', d.start && d.path);
      check(vp.width + ' next-step handoff present', d.handoff);
      check(vp.width + ' has four intent paths', d.intents === 4, 'intents=' + d.intents);
      check(vp.width + ' pipeline filter still works', d.visibleCats === 1 && d.visibleCards === 1, 'cats=' + d.visibleCats + ' cards=' + d.visibleCards);
      check(vp.width + ' reorder CSS is applied before paint', d.bodyDisplay === 'flex', d.bodyDisplay);
      check(vp.width + ' intent paths sit above the tool grid', d.intentsY >= 0 && d.toolsY > d.intentsY, 'intents=' + d.intentsY + ' tools=' + d.toolsY);
      check(vp.width + ' tools grid sits above the handoff', d.toolsY >= 0 && d.handoffY > d.toolsY, 'tools=' + d.toolsY + ' handoff=' + d.handoffY);
      check(vp.width + ' resume card is hidden for a first visit', d.resumeExists && d.resumeHidden === true, 'exists=' + d.resumeExists + ' hidden=' + d.resumeHidden);
      check(vp.width + ' no horizontal overflow', d.overflow <= 2, 'overflow=' + d.overflow);
      check(vp.width + ' no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));

      // A2297: a returning learner sees one resume card for the last tool.
      await page.evaluate(() => {
        localStorage.setItem('jvds_last_activity', JSON.stringify({ type: 'tool', url: '/tools/pixel-studio.html', title: 'Pixel Studio', ts: Date.now() }));
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 400));
      const r = await page.evaluate(() => {
        const el = document.getElementById('resumeLast');
        const go = el && el.querySelector('[data-resume-go]');
        const name = el && el.querySelector('[data-resume-name]');
        const fresh = el && el.querySelector('.resume-last__new');
        return {
          hidden: el ? el.hidden : null,
          href: go ? go.getAttribute('href') : null,
          name: name ? name.textContent.trim() : '',
          fresh: fresh ? fresh.getAttribute('href') : null,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      check(vp.width + ' resume card appears after a tool visit', r.hidden === false);
      check(vp.width + ' resume link reopens the last tool', r.href === '/tools/pixel-studio.html', r.href || 'no href');
      check(vp.width + ' resume card names the last tool', r.name === 'Pixel Studio', r.name);
      check(vp.width + ' resume card offers a start-new route', r.fresh === '#tools', r.fresh || 'none');
      check(vp.width + ' resume card no horizontal overflow', r.overflow <= 2, 'overflow=' + r.overflow);
      await page.close();
    }

    // A2297: the homepage card uses the same last-activity record.
    const home = await browser.newPage();
    if (home.setBypassServiceWorker) await home.setBypassServiceWorker(true);
    await home.setRequestInterception(true);
    home.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await home.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await home.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await home.evaluate(() => { try { localStorage.removeItem('jvds_last_activity'); } catch (e) {} });
    await home.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));
    const first = await home.evaluate(() => {
      const card = document.getElementById('continue-card');
      return { exists: !!card, hidden: card ? card.hidden : null };
    });
    check('homepage resume card is hidden for a first visit', first.exists && first.hidden === true, 'exists=' + first.exists + ' hidden=' + first.hidden);
    await home.evaluate(() => {
      localStorage.setItem('jvds_last_activity', JSON.stringify({ type: 'tool', url: '/tools/pixel-studio.html', title: 'Pixel Studio', ts: Date.now() }));
    });
    await home.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));
    const again = await home.evaluate(() => {
      const card = document.getElementById('continue-card');
      const link = document.getElementById('continue-card-link');
      const title = document.getElementById('continue-card-title');
      const fresh = document.querySelector('.continue-card__new');
      return {
        hidden: card ? card.hidden : null,
        href: link ? link.getAttribute('href') : null,
        title: title ? title.textContent.trim() : '',
        fresh: fresh ? fresh.getAttribute('href') : null,
      };
    });
    check('homepage resume card appears after a tool visit', again.hidden === false && again.href === '/tools/pixel-studio.html', 'hidden=' + again.hidden + ' href=' + again.href);
    check('homepage resume card names the tool and offers start-new', /Pixel Studio/.test(again.title) && again.fresh === '#start-here', 'title=' + again.title + ' fresh=' + again.fresh);
    await home.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS dev-tools-http: hub at 390 and 1440, reorder in head, no errors');
})().catch(e => { console.error(e); process.exit(1); });
