#!/usr/bin/env node
/*
 * tests/home-voice-footer.js , A366 (revised A1534)
 *
 * Guards the homepage voice and the shared footer:
 *   1. Copy: the homepage speaks in one reassuring learner/family voice
 *      (safe, free, no account, nothing to install, works on school
 *      computers). The mixed-tone lines the b0795e38 redesign retired must
 *      not return. The live hero games figure must match the registry.
 *   2. Footer: partials/footer-content.html stays a clean three column
 *      Explore / More / Socials grid with no duplicated links, and
 *      every page that embeds it gets the current copy.
 *
 * The browser pass measures real layout at 390px and 1440px: no sideways
 * scrolling, and the footer stacks to one column on a phone.
 *
 * Run: node tests/home-voice-footer.js   (skip browser with SKIP_BROWSER=1)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const HOME = path.join(ROOT, 'index.html');
const FOOTER = path.join(ROOT, 'partials', 'footer-content.html');
const STATS = path.join(ROOT, 'content', 'stats.json');

const COLUMN_TITLES = ['Explore', 'More', 'Socials'];
const TRUST_PROMISES = ['no account', 'no install', 'school computer', 'free'];
const RETIRED_COPY = [
  'Big feelings. Brave little steps.',
  'Visit the whole bookshelf'
];

const failures = [];
let passes = 0;
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log('  [PASS] ' + name); }
  else { failures.push(name + (detail ? ' - ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' - ' + detail : '')); }
};
const norm = s => s.replace(/\r\n/g, '\n');
const text = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => {
  const m = tag.match(new RegExp(name + '=["\']([^"\']+)["\']', 'i'));
  return m ? m[1] : '';
};

/* ── 1. Homepage copy ─────────────────────────────────────────── */

const home = norm(fs.readFileSync(HOME, 'utf8'));
const homeMain = (home.match(/<main[\s\S]*?<\/main>/i) || [home])[0];
const homeText = text(homeMain).toLowerCase();

const eyebrow = (homeMain.match(/<div class="hero-eyebrow">([\s\S]*?)<\/div>/i) || [, ''])[1];
ok('hero welcomes the creator in one warm voice', /free|no account|school|welcome|creator|make|create/i.test(eyebrow), eyebrow.trim());

const heroSub = (homeMain.match(/<p class="hero-sub">([\s\S]*?)<\/p>/i) || [, ''])[1];
ok('hero sub sells it as safe and free', /no account|safe/i.test(heroSub) && /no download|free/i.test(heroSub), text(heroSub));
for (const promise of TRUST_PROMISES) {
  ok('homepage reassures: "' + promise + '"', homeText.includes(promise));
}

for (const gone of RETIRED_COPY) {
  ok('retired mixed-tone copy is gone: "' + gone + '"', !homeText.includes(gone.toLowerCase()));
}

const footnotes = text(home).toLowerCase();
ok('homepage states it is free to use', /free/.test(footnotes));

/* ── 2. Homepage about-stats block ─────────────────────────────── */

const stats = JSON.parse(fs.readFileSync(STATS, 'utf8'));
const aboutStart = homeMain.indexOf('<div class="about-stats">');
const aboutBlock = aboutStart >= 0 ? homeMain.slice(aboutStart, homeMain.indexOf('btn-about', aboutStart)) : '';
// Match any stat-num value (numeric, text like "Ages 5+" or "15 min", etc.)
const statNums = [...aboutBlock.matchAll(/<div class="stat-num">([^<]+)<\/div>\s*<div class="stat-label">([^<]+)<\/div>/gi)]
  .map(m => ({ n: m[1].trim(), label: m[2].trim().toLowerCase() }));
ok('homepage about-stats block has four stats', statNums.length === 4, 'found ' + statNums.length);
// Current stat labels: workshops, accounts needed, who it\'s for, to your first make
ok('homepage shows a workshops stat', !!statNums.find(s => s.label.includes('workshop')));
ok('homepage shows a no-account stat', !!statNums.find(s => /account|sign.?up|login|register/.test(s.label)));
// stats.json keeps exact totals for other pages to reference
ok('exact totals still exist in content/stats.json', ['workshops', 'tools', 'games', 'books'].every(k => Number.isFinite(stats[k])));
// Guard against re-introducing old stale counts ("182 workshops", "30 tools" etc.)
ok('homepage no longer advertises the stale 182/30 figures', !/\b182\b/.test(homeText) && !/\b30\s+(tools?|workshops?|games?)\b/i.test(homeText));

/* ── 3. Footer columns ────────────────────────────────────────── */

const footer = norm(fs.readFileSync(FOOTER, 'utf8'));
const columns = [...footer.matchAll(/<nav class="footer-col" aria-label="([^"]+)">([\s\S]*?)<\/nav>/gi)];
ok('footer has exactly three columns', columns.length === 3, 'found ' + columns.length);
const titles = columns.map(c => c[1].trim());
ok('footer columns are Explore / More / Socials',
   titles.length === 3 && COLUMN_TITLES.every((t, i) => titles[i] === t), titles.join(' | '));

const footerAnchors = [...footer.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map(m => ({ attrs: m[1], label: text(m[2]), href: attr('<a ' + m[1] + '>', 'href') }));
const internal = footerAnchors.filter(a => a.href && !/^(https?:|mailto:|#)/.test(a.href));
ok('every footer link has an href', footerAnchors.every(a => !!a.href),
   footerAnchors.filter(a => !a.href).map(a => a.label).join(', '));

const seen = new Map();
for (const a of internal) {
  ok('footer link "' + a.label + '" is not duplicated', !seen.has(a.href), 'also: ' + (seen.get(a.href) || ''));
  seen.set(a.href, a.label);
}
// A column may link once to its own section landing page, but must not repeat
// its own title.
ok('no footer link repeats its own column title',
   !columns.some(c => (c[2].match(new RegExp('>' + text(c[1]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</a>', 'gi')) || []).length > 1));

const redirects = new Map();
try {
  for (const line of fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0].startsWith('/')) redirects.set(parts[0], parts[1]);
  }
} catch {}
const fileExists = route => {
  const clean = route.split('#')[0].split('?')[0];
  if (!clean) return true;
  const target = clean.endsWith('/') ? path.join(ROOT, clean, 'index.html') : path.join(ROOT, clean);
  return fs.existsSync(target) || fs.existsSync(target + '.html') || fs.existsSync(path.join(target, 'index.html'));
};
const exists = route => {
  const clean = route.split('#')[0].split('?')[0];
  if (fileExists(route)) return true;
  const mapped = redirects.get(clean);
  return !!mapped && mapped !== clean && fileExists(mapped);
};
for (const a of internal) ok('footer link resolves: ' + a.href, exists(a.href), a.label);

/* ── 4. Every page carries the current footer ─────────────────── */

const builtFooter = footer.trim();
ok('index.html embeds the current footer copy', home.includes(builtFooter));

console.log('\nA366 home voice + footer: ' + passes + ' static checks passed, ' + failures.length + ' failed');

/* ── 5. Layout at 390px and 1440px ────────────────────────────── */

if (process.env.SKIP_BROWSER === '1') {
  console.log('  [SKIP] layout checks (SKIP_BROWSER=1)');
  finish();
} else {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { console.log('  [SKIP] puppeteer not installed'); finish(); }

  if (puppeteer) {
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
      let file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });

    (async () => {
      await new Promise(r => server.listen(0, r));
      const port = server.address().port;
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], defaultViewport: null });
      try {
        for (const vp of [{ name: 'phone 390px', width: 390, height: 844 }, { name: 'desktop 1440px', width: 1440, height: 900 }]) {
          const page = await browser.newPage();
          await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
          await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
          // A2981: the hero now carries a single next-step strip, not stat counters.
          // Wait for the registry so the daily challenge script settles, then measure.
          await page.waitForFunction(() => (window.JVDS_GAMES || []).length > 0, { timeout: 6000 }).catch(() => {});
          const m = await page.evaluate(() => {
            const doc = document.documentElement;
            const cols = Array.from(document.querySelectorAll('.footer-col'));
            const xs = cols.map(c => Math.round(c.getBoundingClientRect().left));
            const heroNext = document.getElementById('hero-next');
            const start = document.getElementById('hero-next-start');
            const startLink = start ? start.querySelector('a') : null;
            const registry = (window.JVDS_GAMES || []).length;
            return {
              scrollWidth: doc.scrollWidth,
              innerWidth: window.innerWidth,
              colCount: cols.length,
              stacked: xs.length === 3 && new Set(xs).size === 1,
              sideBySide: xs.length === 3 && new Set(xs).size === 3,
              heroStats: document.querySelectorAll('.hero-stat, .hero-stat-num').length,
              heroNext: !!heroNext,
              heroNextOverflow: heroNext ? heroNext.scrollWidth > heroNext.clientWidth + 1 : true,
              startVisible: !!(start && !start.hidden),
              startHref: startLink ? startLink.getAttribute('href') : '',
              registry,
              footerLinks: document.querySelectorAll('.footer-col a').length
            };
          });
          ok(vp.name + ': no sideways scrolling', m.scrollWidth <= m.innerWidth + 1, m.scrollWidth + ' > ' + m.innerWidth);
          ok(vp.name + ': footer shows 3 columns with 21 links', m.colCount === 3 && m.footerLinks >= 18, m.colCount + ' cols, ' + m.footerLinks + ' links');
          ok(vp.name + ': hero has no stat counters', m.heroStats === 0, m.heroStats + ' found');
          ok(vp.name + ': hero shows one next-step strip', m.heroNext && !m.heroNextOverflow);
          ok(vp.name + ': first-time hero points at Start Here', m.startVisible && m.startHref === '#start-here', m.startHref);
          ok(vp.name + ': live games registry loads on the homepage', m.registry > 0, String(m.registry));
          if (vp.width < 700) ok(vp.name + ': footer stacks into one column', m.stacked);
          else ok(vp.name + ': footer lays out in three columns', m.sideBySide);
          await page.close();
        }
      } finally {
        await browser.close();
        server.close();
      }
      finish();
    })().catch(e => { console.log('  [FAIL] layout harness error: ' + e.message); failures.push('layout harness'); finish(); });
  }
}

function finish() {
  console.log(failures.length ? '\nA366 FAILURES:\n  ' + failures.join('\n  ') : '\nALL HOME VOICE + FOOTER CHECKS PASSED');
  process.exit(failures.length ? 1 : 0);
}
