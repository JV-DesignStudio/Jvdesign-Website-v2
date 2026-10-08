// HTTP runtime verification for the Game Design Studio / GDD builder (tools/gdd-builder.html).
// Covers the gamified-completion layer added in A824: per-section completion stamps,
// confetti on first completion, achievement toasts, and the milestone tick bounce.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.webp':'image/webp','.ico':'image/x-icon','.svg':'image/svg+xml'};

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
  await new Promise(r => server.listen(8147, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  const noisy = t => /ERR_NETWORK|net::ERR|Failed to load resource|googletagmanager|google-analytics|placehold\.co|phaser|favicon/i.test(t);
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() !== 'error') return; if (noisy(m.text())) return; errors.push('console: ' + m.text()); });
  page.on('dialog', async d => { await d.dismiss().catch(()=>{}); });

  await page.goto('http://127.0.0.1:8147/tools/gdd-builder.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 800)); // let the debounced baseline settle

  const results = await page.evaluate(() => {
    const out = [];
    const ok = (name, cond) => out.push((cond ? 'PASS ' : 'FAIL ') + name);

    ok('rewards API exposed', typeof updateSectionStamps === 'function' && typeof fireConfetti === 'function');
    ok('confetti canvas present', !!document.getElementById('gddConfetti'));
    ok('9 section stamps injected', document.querySelectorAll('.section-stamp').length === 9);
    ok('baseline: seeded sections stamped', document.querySelectorAll('.gdd-section.stamped').length >= 2);
    ok('baseline: cover not stamped', !document.getElementById('sec-cover').classList.contains('stamped'));
    ok('baseline: no achievements yet', !(JSON.parse(localStorage.getItem('jvds_gdd_achievements')||'[]')).includes('first_stamp'));

    const coverEmojis = [...document.querySelectorAll('.emoji-opt')].map(e => e.textContent);
    ok('cover emoji picker glyphs intact', coverEmojis.length === 20 && coverEmojis.every(t => t.trim() && !/\?/.test(t)));
    const charSel = document.querySelector('select[aria-label="Character emoji"]');
    const charEmojis = charSel ? [...charSel.options].map(o => o.value) : [];
    ok('character emoji list is unique', charEmojis.length > 0 && new Set(charEmojis).size === charEmojis.length);

    // complete the Game Identity section
    const setv = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); };
    setv('gameTitle', 'Test Quest');
    const g = document.getElementById('gameGenre'); g.value = 'Platformer'; g.dispatchEvent(new Event('change', {bubbles:true}));
    const pf = document.getElementById('gamePlatform'); pf.value = 'Browser / Web'; pf.dispatchEvent(new Event('change', {bubbles:true}));
    updateSectionStamps();

    ok('sectionComplete detects a finished section', sectionComplete('cover'));
    ok('cover section now stamped', document.getElementById('sec-cover').classList.contains('stamped'));
    ok('confetti fired on first completion', _confettiParts.length > 0 && getComputedStyle(document.getElementById('gddConfetti')).display !== 'none');
    ok('achievement unlocked (first_stamp)', (JSON.parse(localStorage.getItem('jvds_gdd_achievements')||'[]')).includes('first_stamp'));
    ok('achievement toast shown', /section stamped/i.test(document.getElementById('toast').textContent));

    // milestone tick bounce
    const box = document.querySelector('.milestone-check:not(.done)');
    box.click();
    const after = document.querySelector('.milestone-item .milestone-check.done.tick');
    ok('milestone tick adds bounce class', !!after);
    ok('milestone reads aria-checked true', !!after && after.getAttribute('aria-checked') === 'true');
    ok('milestone shows a real tick glyph', !!after && after.textContent.trim() === '\u2713');

    return out;
  });

  await page.setViewport({ width: 390, height: 780 });
  await new Promise(r => setTimeout(r, 150));
  const noOverflow390 = await page.evaluate(() => document.documentElement.scrollWidth <= 391);
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navOpened = await page.evaluate(() => document.getElementById('mainNav').classList.contains('open'));
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navClosed = await page.evaluate(() => !document.getElementById('mainNav').classList.contains('open'));

  console.log('no horizontal overflow at 390:', noOverflow390);

  results.forEach(l => console.log(l));
  console.log('hamburger opens:', navOpened, '| closes:', navClosed);
  if (errors.length) {
    console.log('ERRORS (' + errors.length + '):');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  } else {
    console.log('NO RUNTIME ERRORS over HTTP');
  }
  const fails = results.filter(l => l.startsWith('FAIL')).length;
  const pass = fails === 0 && navOpened && navClosed && noOverflow390 && errors.length === 0;
  console.log(pass ? 'GDD REWARDS CHECKS PASSED' : 'FAILURES PRESENT');
  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
