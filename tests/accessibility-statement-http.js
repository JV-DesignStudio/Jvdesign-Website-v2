const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ w: 390, h: 844, label: '390x844' }, { w: 1440, h: 900, label: '1440x900' }]) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w <= 480, hasTouch: vp.w <= 480, deviceScaleFactor: 1 });
      await page.goto(base + '/pages/accessibility-statement.html', { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 400));
      const m = await page.evaluate(() => {
        const links = [...document.querySelectorAll('main a')].map(a => a.getAttribute('href'));
        const controls = [...document.querySelectorAll('a,button,input,select,textarea')];
        const unnamed = controls.filter(el => {
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return false;
          const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
          return !name;
        }).length;
        const inlineScripts = [...document.querySelectorAll('script')].filter(s => !s.src).length;
        return {
          title: document.title,
          h1: (document.querySelector('h1') || {}).textContent || '',
          canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
          lumo: !!document.querySelector('.a11y-callout strong'),
          hasContact: links.includes('/contact'),
          hasChildSafety: links.includes('/child-safety'),
          hasSettings: links.includes('/tools/accessibility.html'),
          hasStandard: links.some(h => h && h.includes('WCAG22')),
          unnamed,
          inlineScripts,
          overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
        };
      });
      check(`${vp.label}: page loads with the right title`, /Accessibility Statement/.test(m.title), m.title);
      check(`${vp.label}: statement has one clear H1`, m.h1.trim().length > 10, m.h1.trim());
      check(`${vp.label}: canonical points at the statement`, m.canonical.endsWith('/accessibility-statement'), m.canonical);
      check(`${vp.label}: Lumo callout is present`, m.lumo);
      check(`${vp.label}: links to contact, child safety, settings and WCAG`, m.hasContact && m.hasChildSafety && m.hasSettings && m.hasStandard);
      check(`${vp.label}: every control has an accessible name`, m.unnamed === 0, 'unnamed=' + m.unnamed);
      check(`${vp.label}: no inline scripts without a CSP hash`, m.inlineScripts === 0, 'inline=' + m.inlineScripts);
      check(`${vp.label}: no horizontal overflow`, m.overflow <= 1, 'overflow=' + m.overflow);
      if (vp.w === 390) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.keyboard.press('Tab');
        const first = await page.evaluate(() => {
          const el = document.activeElement;
          const r = el.getBoundingClientRect();
          return { cls: typeof el.className === 'string' ? el.className : '', text: el.textContent.trim(), visible: r.width > 1 && r.height > 1 };
        });
        check('390x844: first Tab reaches the skip link', /skip-link/.test(first.cls) && first.visible, first.text);
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 150));
        const after = await page.evaluate(() => ({ hash: location.hash, active: document.activeElement.tagName + '#' + document.activeElement.id }));
        check('390x844: skip link moves focus into main', after.hash === '#main-content' || after.active === 'MAIN#main-content', JSON.stringify(after));
      }
      await page.close();
    }

    for (const rel of ['404.html', 'pages/contact.html', 'pages/privacy-policy.html', 'pages/child-safety.html']) {
      const page = await browser.newPage();
      await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 30000 });
      const linked = await page.evaluate(() => !!document.querySelector('a[href$="accessibility-statement"], a[href$="accessibility-statement.html"]'));
      check(`${rel}: footer links to the accessibility statement`, linked);
      await page.close();
    }

    const partial = fs.readFileSync(path.join(ROOT, 'partials/footer-content.html'), 'utf8');
    check('footer partial includes the accessibility statement link', /href="\/accessibility-statement"/.test(partial));
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nACCESSIBILITY STATEMENT CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
