/* 3D Builders on mobile (A1630).

   The workshops 3D builders (rocket, robot, ship, castle and the rest) are
   desktop app shells that used to open on phones with the reference-pack
   callout, the Ember tip bar and the injected intro card stacked above the 3D
   preview, and the step list as a full column that pushed the current step
   controls below it. So on a phone the model sat ~540px down the page (barely
   visible on first load) and the controls were a long scroll away.

   This test locks the phone layout: for every builder the live preview is
   fully visible on the first screen and stays pinned while scrolling, the
   steps are a horizontal chip strip, the current-step controls follow it, and
   nothing overflows or throws. It also checks the 1440px desktop shell is
   untouched.

   Run: node tests/3d-builder-mobile.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19261;
const mime = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.png':'image/png', '.webp':'image/webp', '.json':'application/json', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.woff2':'font/woff2', '.zip':'application/zip' };
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
function listen() { return new Promise(r => server.listen(port, r)); }

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

// Every builder that shares the #app shell.
const BUILDERS = [
  { slug: 'rocket' }, { slug: 'robot' }, { slug: 'pirate-ship' },
  { slug: 'steampunk-airship' }, { slug: 'race-car' }, { slug: 'submarine' },
  { slug: 'castle' }, { slug: 'fairy-tale' }, { slug: 'phone-stand' },
  { slug: 'space-station' }, { slug: 'pirate-cannon' }
];

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const b = document.getElementById('builderWelcomeBtn');
    if (b && b.offsetParent !== null) b.click();
    const c = document.getElementById('cookie-decline') || document.getElementById('cookie-accept');
    if (c) { try { c.click(); } catch (e) {} }
    document.querySelectorAll('.starter-banner [class*="close"]').forEach(x => {});
  });
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  try {
    for (const { slug, noControls } of BUILDERS) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message.split('\n')[0].slice(0, 120)));
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await page.goto('http://127.0.0.1:' + port + '/workshops/' + slug + '-builder.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #app', { timeout: 20000 }).catch(() => {});
      await pause(700);
      await dismissOverlays(page);
      await pause(600);

      const m = await page.evaluate((noControls) => {
        const q = sels => { for (const s of sels) { const e = document.querySelector(s); if (e) return e; } return null; };
        const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { y: Math.round(r.y), h: Math.round(r.height), pos: cs.position, top: cs.top, dir: cs.flexDirection }; };
        const de = document.documentElement;
        const stepList = q(['#sidebar .slist', '#sidebar .step-list', '#stepList', '.step-list']);
        const controls = q(['#sidebar .cpan', '#sidebar .cpanel', '#sidebar .controls-panel', '#cpan', '#stepBody', '.cpanel', '.controls-panel']);
        const canvas = q(['#viewport canvas', 'canvas']);
        const disp = el => el ? getComputedStyle(el).display : null;
        const bubble = document.createElement('div');
        bubble.className = 'mascot-companion-bubble';
        document.body.appendChild(bubble);
        const bubbleDisp = getComputedStyle(bubble).display;
        bubble.remove();
        return {
          viewport: box(q(['#viewport'])),
          stepList: box(stepList),
          stepCount: stepList ? stepList.children.length : 0,
          controls: box(controls),
          hasControlsExpected: !noControls,
          gestures: typeof window.BuilderGestures !== 'undefined',
          touchAction: canvas ? getComputedStyle(canvas).touchAction : null,
          companion: disp(document.querySelector('.mascot-companion')),
          feedback: disp(document.getElementById('jvds-feedback-widget')),
          report: disp(document.querySelector('.report-issue-fab')),
          bqChip: disp(document.querySelector('.bq-chip')),
          hasRightbar: !!document.getElementById('rightbar'),
          toggle: disp(document.getElementById('rbDrawerToggle')),
          bubble: bubbleDisp,
          overflow: Math.max(0, de.scrollWidth - window.innerWidth),
          innerH: window.innerHeight
        };
      }, !!noControls);

      const vp = m.viewport;
      check(slug + ': 3D preview is on the first screen', !!vp && vp.y < 340 && (vp.y + vp.h) <= m.innerH + 8, JSON.stringify(vp && { top: vp.y, bottom: vp.y + vp.h, screen: m.innerH }));
      check(slug + ': preview is sticky', !!vp && vp.pos === 'sticky' && vp.top === '68px', vp && (vp.pos + ' top:' + vp.top));
      check(slug + ': steps are a horizontal chip strip', !!m.stepList && m.stepList.dir === 'row' && m.stepCount > 1, m.stepList && (m.stepList.dir + ' n=' + m.stepCount));
      if (m.hasControlsExpected) {
        check(slug + ': current-step controls follow the strip', !!m.controls && m.controls.y >= m.stepList.y, m.controls && ('y=' + m.controls.y + ' stripY=' + m.stepList.y));
      }
      check(slug + ': builder ships touch gestures', m.gestures && m.touchAction === 'none', 'gestures=' + m.gestures + ' touchAction=' + m.touchAction);
      check(slug + ': no horizontal overflow', m.overflow <= 2, String(m.overflow));
      check(slug + ': floating companion is hidden on the builder', m.companion === 'none', String(m.companion));
      check(slug + ': feedback pill is hidden on the builder', m.feedback === 'none', String(m.feedback));
      check(slug + ': companion tip bubble is hidden on the builder', m.bubble === 'none', String(m.bubble));
      check(slug + ': report-issue pill is hidden on the builder', m.report === 'none', String(m.report));
      check(slug + ': build-quiz chip is hidden on the builder', m.bqChip === 'none' || m.bqChip === null, String(m.bqChip));
      // the quick-controls toggle is dead where #rightbar is inline (hide it),
      // but is the only way into the .cpanel bottom sheet, so it must survive
      // there. Builders that never create one report null.
      check(slug + ': quick-controls toggle matches the layout', m.hasRightbar ? (m.toggle === 'none' || m.toggle === null) : m.toggle !== 'none', 'rightbar=' + m.hasRightbar + ' toggle=' + m.toggle);

      // sticky in action: scroll into the builder and confirm the preview holds
      await page.evaluate(() => window.scrollTo(0, 500));
      await pause(350);
      const pinnedY = await page.evaluate(() => Math.round(document.querySelector('#viewport').getBoundingClientRect().y));
      check(slug + ': preview stays pinned while scrolling', pinnedY >= 60 && pinnedY <= 90, 'y=' + pinnedY);

      check(slug + ': zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // ---- desktop shell stays a three-column grid (no mobile rules leak) ----
    const desk = await browser.newPage();
    const dErr = [];
    desk.on('pageerror', e => dErr.push(e.message.split('\n')[0].slice(0, 120)));
    await desk.setViewport({ width: 1440, height: 900 });
    await desk.goto('http://127.0.0.1:' + port + '/workshops/rocket-builder.html', { waitUntil: 'load', timeout: 30000 });
    await dismissOverlays(desk);
    await pause(500);
    const d = await desk.evaluate(() => {
      const app = document.getElementById('app');
      const vp = document.getElementById('viewport');
      const strip = document.querySelector('#sidebar .slist, #stepList, .step-list');
      const disp = el => el ? getComputedStyle(el).display : null;
      return {
        appDisplay: getComputedStyle(app).display,
        vpPos: getComputedStyle(vp).position,
        stripDisplay: strip ? getComputedStyle(strip).display : null,
        companion: disp(document.querySelector('.mascot-companion')),
        feedback: disp(document.getElementById('jvds-feedback-widget')),
        report: disp(document.querySelector('.report-issue-fab')),
        bqChip: disp(document.querySelector('.bq-chip')),
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      };
    });
    check('desktop: shell stays a grid', d.appDisplay === 'grid', d.appDisplay);
    check('desktop: preview is not sticky', d.vpPos !== 'sticky', d.vpPos);
    check('desktop: step list is not a flex strip', d.stripDisplay !== 'flex', String(d.stripDisplay));
    check('desktop: feedback pill is still shown', d.feedback !== null && d.feedback !== 'none', String(d.feedback));
    check('desktop: floating companion is still shown', d.companion !== null && d.companion !== 'none', String(d.companion));
    check('desktop: report-issue pill is still shown', d.report !== null && d.report !== 'none', String(d.report));
    check('desktop: no overflow', d.overflow <= 2, String(d.overflow));
    check('desktop: zero runtime errors', dErr.length === 0, dErr.slice(0, 2).join(' | '));
    await desk.close();
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL 3D BUILDER MOBILE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
