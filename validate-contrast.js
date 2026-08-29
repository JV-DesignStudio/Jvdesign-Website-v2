#!/usr/bin/env node
/*
 * validate-contrast.js — catches headings that render invisible.
 *
 * The bug this exists to prevent: `.section-title` defaults to beige because
 * most sections sit on the dark charcoal ground. Put one on a white background
 * without `.section-title--on-light` and the heading renders beige-on-white at
 * about 1.2:1 — present in the DOM, readable by Google, invisible to a human.
 * That shipped on 37 headings across 13 pages before anyone noticed, including
 * "The Books" on the Books page.
 *
 * A static check cannot catch it: the colour comes from a shared stylesheet,
 * the background from an ancestor several levels up, and either may be a CSS
 * variable that is undefined on that page (which is how the whole "Support the
 * Studio" section on Freebies lost its background). So this renders every page
 * in a headless browser and measures what a person would actually see.
 *
 * Two bands:
 *   FAIL  below 3:1  — nobody can read this. Exit 1.
 *   WARN  3:1 up to the WCAG AA threshold (4.5:1, or 3:1 for large text).
 *         Reported, but does not fail the build. Use --strict to fail on these.
 *
 * Three theme states are checked, because a heading can be fine in one and
 * invisible in another:
 *   1. fresh visitor, OS prefers light
 *   2. fresh visitor, OS prefers dark
 *   3. visitor who has explicitly chosen dark (localStorage jvds-theme=dark)
 *
 * Elements sitting on a background-image or gradient are skipped and counted:
 * there is no single background colour to measure against, so any verdict
 * would be a guess. The skip count is printed so it stays visible.
 *
 * Run: node validate-contrast.js            (npm run validate:contrast)
 *      node validate-contrast.js --strict   (also fail on WARN)
 *      node validate-contrast.js --list     (print every WARN, not just a count)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const PORT = 8978;
const CONCURRENCY = 4;
const STRICT = process.argv.includes('--strict');
const LIST = process.argv.includes('--list');

const IGNORE = new Set(['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy',
  '.github', '.continue', 'og', 'social-posts', 'questlog-pwa']);

/* Structural text only. These are the elements where being invisible is fatal
   rather than merely poor: if a section heading disappears, the page loses its
   shape. Body copy is deliberately out of scope — it would drown the signal in
   hundreds of pre-existing muted-text findings. Widen this when those are fixed. */
const SELECTOR = 'h1, h2, h3, .section-title, .section-tag, .hero-title, .feat-card-title, .game-title';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.pdf': 'application/pdf', '.xml': 'application/xml' };

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE.has(e.name)) out = out.concat(walk(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

/* Runs in the page. Composites every ancestor background (respecting alpha) down
   onto white, then measures WCAG contrast against the element's own colour. */
function measure(SELECTOR) {
  const parse = s => {
    const m = (s || '').match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1] : null;
  };
  const over = (fg, bg) => [0, 1, 2].map(i => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);
  const lum = c => {
    const g = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]);
  };
  function backdrop(el) {
    const layers = [];
    let e = el, gradient = false;
    while (e) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') gradient = true;
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) layers.push(c);
      e = e.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { base, gradient };
  }

  const out = { fails: [], warns: [], checked: 0, skipped: 0 };
  document.querySelectorAll(SELECTOR).forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;  // not rendered
    const text = (el.innerText || '').trim();
    if (!text) return;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg || fg[3] === 0) return;
    const { base, gradient } = backdrop(el);
    if (gradient) { out.skipped++; return; }

    out.checked++;
    const composited = over(fg, base);
    const a = lum(composited), b = lum(base);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio >= need) return;

    const hit = {
      text: text.replace(/\s+/g, ' ').slice(0, 44),
      ratio: +ratio.toFixed(2), need,
      fg: cs.color, bg: 'rgb(' + base.map(Math.round).join(',') + ')',
      el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 3).join('.') : '')
    };
    (ratio < 3 ? out.fails : out.warns).push(hit);
  });
  return out;
}

const STATES = [
  { name: 'OS light',   scheme: 'light', saved: null },
  { name: 'OS dark',    scheme: 'dark',  saved: null },
  { name: 'chose dark', scheme: 'dark',  saved: 'dark' }
];

(async () => {
  const files = walk(ROOT).map(f => path.relative(ROOT, f).split(path.sep).join('/'));

  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(PORT, r));

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const fails = [];      // key -> hit, deduplicated across theme states
  const warns = new Map();
  let checked = 0, skipped = 0, loaded = 0;

  for (const state of STATES) {
    const queue = files.slice();
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: state.scheme }]);
      if (state.saved) {
        await page.evaluateOnNewDocument(v => { try { localStorage.setItem('jvds-theme', v); } catch (e) {} }, state.saved);
      }
      for (;;) {
        const file = queue.pop();
        if (!file) break;
        try {
          // 'load', not 'domcontentloaded': the theme script that sets data-theme
          // sits at the end of <body>. Measuring before it runs reports the light
          // palette against a dark background and invents failures that do not exist.
          await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'load', timeout: 20000 });
        } catch (e) { continue; }
        try {
          await page.evaluate(() => new Promise(resolve => {
            const settle = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
            if (document.readyState === 'complete') settle();
            else window.addEventListener('load', settle, { once: true });
          }));
        } catch (e) { /* page navigated away; measure what is there */ }
        await new Promise(r => setTimeout(r, 150));   // reveal observer / late style injection
        let res;
        try { res = await page.evaluate(measure, SELECTOR); } catch (e) { continue; }
        loaded++; checked += res.checked; skipped += res.skipped;
        res.fails.forEach(h => fails.push({ file, state: state.name, ...h }));
        res.warns.forEach(h => {
          const key = file + '|' + h.el + '|' + h.text;
          if (!warns.has(key)) warns.set(key, { file, state: state.name, ...h });
        });
      }
      await page.close();
    });
    await Promise.all(workers);
  }

  await browser.close();
  server.close();

  const warnList = [...warns.values()].sort((a, b) => a.ratio - b.ratio);
  const summary = `${loaded} page loads across ${STATES.length} theme states, ${checked} headings measured, ${skipped} skipped (gradient background)`;

  if (warnList.length) {
    console.log(`  ${warnList.length} heading(s) below WCAG AA but still readable (3:1 or better):`);
    (LIST ? warnList : warnList.slice(0, 8)).forEach(w =>
      console.log(`    ${String(w.ratio).padStart(5)}:1 (need ${w.need})  ${w.file}  [${w.el}]  "${w.text}"`));
    if (!LIST && warnList.length > 8) console.log(`    ... +${warnList.length - 8} more, run with --list to see them all`);
    console.log('');
  }

  if (!fails.length && (!STRICT || !warnList.length)) {
    console.log(`✓ validate-contrast: ${summary}, 0 invisible.`);
    process.exit(0);
  }

  if (fails.length) {
    console.log(`✗ validate-contrast: ${fails.length} heading(s) render below 3:1 and are effectively invisible:\n`);
    const byFile = {};
    fails.forEach(f => (byFile[f.file] = byFile[f.file] || []).push(f));
    Object.keys(byFile).sort().forEach(file => {
      console.log(`  ${file}`);
      byFile[file].forEach(f =>
        console.log(`    ${String(f.ratio).padStart(5)}:1  ${f.fg} on ${f.bg}  [${f.el}]  "${f.text}"   (${f.state})`));
    });
    console.log('\n  Fix: a heading on a light background needs .section-title--on-light (or an');
    console.log('  explicit colour). A heading on a dark background needs the beige default.');
    console.log('  If the background vanished entirely, check for an undefined CSS variable.');
  } else {
    console.log(`✗ validate-contrast: --strict, and ${warnList.length} heading(s) are below WCAG AA.`);
  }
  process.exit(1);
})();
