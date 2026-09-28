#!/usr/bin/env node
/*
 * tests/home-voice-footer.js , A366
 *
 * Guards two things the audit flagged on the homepage:
 *   1. Copy: the homepage speaks in one reassuring parents/carers voice
 *      (safety, no account, no ads, nothing to install) and the retired
 *      mixed-tone lines cannot come back. Homepage counts must match
 *      content/stats.json so the copy never advertises a stale number.
 *   2. Footer: partials/footer-content.html stays a clean three column
 *      Explore / For Parents / Socials grid with no duplicated links, and
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
const PARENTS = path.join(ROOT, 'pages', 'parents.html');
const FOOTER = path.join(ROOT, 'partials', 'footer-content.html');
const STATS = path.join(ROOT, 'content', 'stats.json');

const COLUMN_TITLES = ['Explore', 'For Parents', 'Socials'];
const TRUST_PROMISES = ['no account', 'no ads', 'download', 'school computer'];
const RETIRED_COPY = [
  'Welcome, creator',
  'What shall we make today?',
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
ok('hero names its audience for adults', /parent|carer|teacher/i.test(eyebrow), eyebrow.trim());

const trustItems = [...homeMain.matchAll(/<div class="hero-trust-item">([\s\S]*?)<\/div>/gi)].map(m => text(m[1]).toLowerCase());
ok('hero carries a 4 item reassurance strip', trustItems.length === 4, 'found ' + trustItems.length);
for (const promise of TRUST_PROMISES) {
  ok('reassurance strip mentions "' + promise + '"', trustItems.some(t => t.includes(promise)));
}

for (const gone of RETIRED_COPY) {
  ok('retired mixed-tone copy is gone: "' + gone + '"', !homeText.includes(gone.toLowerCase()));
}

const footnotes = text(home).toLowerCase();
ok('homepage states it is free to use', /free/.test(footnotes));
ok('homepage links adults to the parent guide', /href=["']\/parents["']/.test(home) && /parent and carer|15-minute/.test(homeText));

/* ── 2. Homepage counts match the generated stats ─────────────── */

const stats = JSON.parse(fs.readFileSync(STATS, 'utf8'));
const aboutStart = homeMain.indexOf('<div class="about-stats">');
const aboutBlock = aboutStart >= 0 ? homeMain.slice(aboutStart, homeMain.indexOf('btn-about', aboutStart)) : '';
const statNums = [...aboutBlock.matchAll(/<div class="stat-num">(\d+)<\/div>\s*<div class="stat-label">([^<]+)<\/div>/gi)]
  .map(m => ({ n: +m[1], label: m[2].trim().toLowerCase() }));
ok('homepage shows the four content counts', statNums.length === 4, 'found ' + statNums.length);
for (const [label, key] of [['workshops', 'workshops'], ['free tools', 'tools'], ['games', 'games'], ['books', 'books']]) {
  const row = statNums.find(s => s.label.includes(label));
  ok('homepage ' + label + ' count matches content/stats.json', !!row && row.n === stats[key],
     row ? row.n + ' vs ' + stats[key] : 'row missing');
}
ok('homepage no longer advertises the stale 182/30/32 figures', !/\b(182|30)\b/.test(homeText));

/* ── 3. Footer columns ────────────────────────────────────────── */

const footer = norm(fs.readFileSync(FOOTER, 'utf8'));
const columns = [...footer.matchAll(/<nav class="footer-col" aria-label="([^"]+)">([\s\S]*?)<\/nav>/gi)];
ok('footer has exactly three columns', columns.length === 3, 'found ' + columns.length);
const titles = columns.map(c => c[1].trim());
ok('footer columns are Explore / For Parents / Socials',
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
ok('no footer link repeats its own column title',
   !columns.some(c => c[2].includes('>' + text(c[1]) + '</a>')));

const exists = route => {
  const clean = route.split('#')[0].split('?')[0];
  if (!clean) return true;
  const target = clean.endsWith('/') ? path.join(ROOT, clean, 'index.html') : path.join(ROOT, clean);
  return fs.existsSync(target) || fs.existsSync(target + '.html') || fs.existsSync(path.join(target, 'index.html'));
};
for (const a of internal) ok('footer link resolves: ' + a.href, exists(a.href), a.label);

/* ── 4. Every page carries the current footer ─────────────────── */

const builtFooter = footer.trim();
ok('index.html embeds the current footer copy', home.includes(builtFooter));
ok('pages/parents.html embeds the current footer copy',
   norm(fs.readFileSync(PARENTS, 'utf8')).includes(builtFooter));

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
      await new Promise(r => server.listen(8129, r));
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], defaultViewport: null });
      try {
        for (const vp of [{ name: 'phone 390px', width: 390, height: 844 }, { name: 'desktop 1440px', width: 1440, height: 900 }]) {
          const page = await browser.newPage();
          await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
          await page.goto('http://127.0.0.1:8129/index.html', { waitUntil: 'load', timeout: 30000 });
          const m = await page.evaluate(() => {
            const doc = document.documentElement;
            const cols = Array.from(document.querySelectorAll('.footer-col'));
            const xs = cols.map(c => Math.round(c.getBoundingClientRect().left));
            const trust = document.querySelector('.hero-trust');
            return {
              scrollWidth: doc.scrollWidth,
              innerWidth: window.innerWidth,
              colCount: cols.length,
              stacked: xs.length === 3 && new Set(xs).size === 1,
              sideBySide: xs.length === 3 && new Set(xs).size === 3,
              trustOverflow: trust ? trust.scrollWidth > trust.clientWidth + 1 : true,
              trustItems: document.querySelectorAll('.hero-trust-item').length,
              footerLinks: document.querySelectorAll('.footer-col a').length
            };
          });
          ok(vp.name + ': no sideways scrolling', m.scrollWidth <= m.innerWidth + 1, m.scrollWidth + ' > ' + m.innerWidth);
          ok(vp.name + ': footer shows 3 columns with 21 links', m.colCount === 3 && m.footerLinks >= 18, m.colCount + ' cols, ' + m.footerLinks + ' links');
          ok(vp.name + ': reassurance strip fits', m.trustItems === 4 && !m.trustOverflow, m.trustItems + ' items');
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
