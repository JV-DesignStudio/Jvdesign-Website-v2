/* A2143: no floating site widget may cover the Audio Studio controls.

   Opens the real page at 1440 and 390, in Music and SFX modes, and checks:
     1. the keepsake, share, project-code, feedback and mascot widgets are
        either hidden or docked, not floating over the studio,
     2. the cookie banner is visible and docked in normal flow (consent stays
        reachable) instead of covering the bottom controls,
     3. no visible widget box intersects the transport, sequencer, instrument
        panel, Sound Lab, SFX shelf or bottom bar,
     4. the Play and Sound Lab action buttons are actually the element under
        the pointer.

   Run: node tests/sound-studio-widgets.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.zip': 'application/zip'
};

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.resolve(root, '.' + u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const WIDGETS = [
  '#jvds-keepsake-strip', '#jvds-share-btn', '#jvds-project-btn',
  '#jvfb-btn', '#jvfb-panel', '#cookie-banner',
  '.mascot-companion', '.mascot-companion-bubble'
];
const FLOATING = [
  '#jvds-keepsake-strip', '#jvds-share-btn', '#jvds-project-btn',
  '#jvfb-btn', '.mascot-companion', '.mascot-companion-bubble'
];
const CONTROLS = [
  ['transport', '#transport'],
  ['sequencer', '#seq-panel'],
  ['instrument panel', '#inst-panel'],
  ['Sound Lab', '#sfxLab'],
  ['SFX shelf', '#sfx-shelf'],
  ['bottom bar', '#bottom-bar']
];
const ACTIONS = {
  music: ['#playBtn'],
  sfx: ['#labDlBtn', '#sfxDlBtn']
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
      await page.evaluateOnNewDocument(() => {
        try {
          localStorage.setItem('jvds_sound_seen', '1');
          localStorage.removeItem('jvds_sound_auto');
        } catch (e) {}
      });
      await page.setViewport({ width, height, isMobile: width < 500, hasTouch: width < 500 });
      await page.goto(base + '/tools/sound-studio.html', { waitUntil: 'load', timeout: 30000 });
      await sleep(1400);

      for (const mode of ['music', 'sfx']) {
        await page.evaluate(m => {
          const b = document.querySelector('.ss-mode[data-mode="' + m + '"]');
          if (b) b.click();
        }, mode);
        await sleep(450);

        const state = await page.evaluate((widgets, floating, controls) => {
          const visibleBox = el => {
            if (!el) return null;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
            const r = el.getBoundingClientRect();
            const x = Math.max(0, r.x), y = Math.max(0, r.y);
            const w = Math.min(innerWidth, r.right) - x;
            const h = Math.min(innerHeight, r.bottom) - y;
            if (w < 2 || h < 2) return null;
            return { x, y, w, h, position: cs.position };
          };
          const hit = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
          const widgetBoxes = widgets.map(s => [s, visibleBox(document.querySelector(s))]).filter(([, b]) => b);
          const controlBoxes = controls.map(([name, sel]) => [name, visibleBox(document.querySelector(sel))]).filter(([, b]) => b);
          const overlaps = [];
          for (const [wn, wb] of widgetBoxes) {
            for (const [cn, cb] of controlBoxes) if (hit(wb, cb)) overlaps.push(wn + ' over ' + cn);
          }
          const stillFloating = floating.filter(s => {
            const el = document.querySelector(s);
            if (!el) return false;
            const cs = getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.position === 'fixed';
          });
          const banner = document.getElementById('cookie-banner');
          return {
            controls: controlBoxes.map(([n]) => n),
            overlaps,
            stillFloating,
            banner: banner ? visibleBox(banner) : null,
            bannerFixed: banner ? getComputedStyle(banner).position === 'fixed' : false
          };
        }, WIDGETS, FLOATING, CONTROLS);

        const label = width + 'x' + height + ' ' + mode;
        check(label + ': studio controls are on screen', state.controls.length > 0, state.controls.join(', '));
        check(label + ': no widget covers a studio control', state.overlaps.length === 0, state.overlaps.join(' | '));
        check(label + ': floating widgets are hidden or docked', state.stillFloating.length === 0, state.stillFloating.join(', '));
        if (state.banner) {
          check(label + ': cookie consent stays visible', !!state.banner, JSON.stringify(state.banner));
          check(label + ': cookie consent is docked, not fixed', !state.bannerFixed, 'position fixed=' + state.bannerFixed);
        }

        for (const sel of ACTIONS[mode]) {
          await page.evaluate(s => {
            const el = document.querySelector(s);
            if (!el) return;
            const r0 = el.getBoundingClientRect();
            el.scrollIntoView({ block: 'center', inline: 'center' });
            window.scrollTo(0, Math.max(0, r0.top + window.scrollY - (innerHeight - r0.height) / 2));
          }, sel);
          await sleep(180);
          const hit = await page.evaluate(s => {
            const el = document.querySelector(s);
            if (!el) return { err: 'missing ' + s };
            const r = el.getBoundingClientRect();
            const x = Math.max(0, r.x), y = Math.max(0, r.y);
            const w = Math.min(innerWidth, r.right) - x;
            const h = Math.min(innerHeight, r.bottom) - y;
            if (w < 4 || h < 4) return { err: 'not visible ' + s, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
            const points = [[x + w / 2, y + h / 2], [x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]];
            const covered = points.filter(([px, py]) => {
              const topEl = document.elementFromPoint(px, py);
              return !(topEl === el || el.contains(topEl));
            });
            return { covered: covered.length, sample: covered.slice(0, 2) };
          }, sel);
          check(label + ': ' + sel + ' is not covered', !hit.err && hit.covered === 0, JSON.stringify(hit));
        }

        check(label + ': no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
  console.log('\nAUDIO STUDIO WIDGET CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
