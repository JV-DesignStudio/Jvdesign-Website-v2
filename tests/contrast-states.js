// contrast-states.js - accessible colour across themes and interactive states.
//
// A2011: validate-contrast.js proves headings are not invisible. This adds the
// rest of the WCAG AA surface: body text at 4.5:1 (3:1 for large text), focus
// rings and control boundaries at 3:1, hover and disabled states, in both the
// light and dark palettes, on one page from each page type.
//
// Run: node tests/contrast-states.js
//      node tests/contrast-states.js --list      (print every failure)
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SITE = path.resolve(__dirname, '..');
const PORT = 8981;
const LIST = process.argv.includes('--list');

const PAGES = [
  'index.html',
  'pages/workshop.html',
  'workshops/start-here.html',
  'workshops/engine-python.html',
  'workshops/scratch-catch-workshop.html',
  'tools/pixel-studio.html',
  'arcade.html',
  'pages/books.html',
  'pages/devlog.html',
  'pages/parents.html',
  'pages/privacy-policy.html',
  'browse.html',
].filter((f) => !process.env.JVDS_CONTRAST_PAGES || process.env.JVDS_CONTRAST_PAGES.split(',').map((s) => s.trim()).some((needle) => f.includes(needle)));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };

function measureText(selector) {
  const parse = (s) => {
    const m = (s || '').match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1] : null;
  };
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);
  const lum = (c) => {
    const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]);
  };
  const ratio = (a, b) => {
    const A = lum(a), B = lum(b);
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
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
  const directText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
  const fails = [];
  let checked = 0, skipped = 0;
  document.querySelectorAll(selector).forEach((el) => {
    if (!directText(el)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    if (!el.offsetParent && cs.position !== 'fixed') return;
    if (el.closest('.sr-only, [aria-hidden="true"]')) return;
    // Off-screen helpers such as the skip link are only visible once focused.
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight * 3) return;
    const fg = parse(cs.color);
    if (!fg || fg[3] === 0) return;
    const { base, gradient } = backdrop(el);
    if (gradient) { skipped++; return; }
    checked++;
    const r = ratio(over(fg, base), base);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    if (r >= need) return;
    fails.push({
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 46),
      el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : ''),
      ratio: +r.toFixed(2), need, fg: cs.color, bg: 'rgb(' + base.map(Math.round).join(',') + ')',
    });
  });
  return { checked, skipped, fails };
}

function measureFocus() {
  const parse = (s) => {
    const m = (s || '').match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1] : null;
  };
  const lum = (c) => {
    const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]);
  };
  const ratio = (a, b) => {
    const A = lum(a), B = lum(b);
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
  };
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);
  function backdrop(el) {
    const layers = [];
    let e = el;
    while (e) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) layers.push(c);
      e = e.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }
  const results = { checked: 0, browserDefault: 0, fails: [] };
  const targets = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
    .filter((el) => !el.disabled && el.offsetParent && !el.closest('.sr-only'))
    .slice(0, 15);
  for (const el of targets) {
    el.focus({ preventScroll: true });
    const cs = getComputedStyle(el);
    if (el !== document.activeElement) continue;
    const width = parseFloat(cs.outlineWidth) || 0;
    const style = cs.outlineStyle;
    if (!width || style === 'none') {
      // A box-shadow ring is also valid.
      if (cs.boxShadow && cs.boxShadow !== 'none') {
        const c = parse(cs.boxShadow);
        const bg = backdrop(el.parentElement || el);
        if (c && c[3] > 0) {
          results.checked++;
          const r = ratio(over(c, bg), bg);
          if (r < 3) results.fails.push({ el: el.tagName.toLowerCase(), kind: 'focus-shadow', ratio: +r.toFixed(2) });
        }
      }
      continue;
    }
    if (style === 'auto') { results.browserDefault++; continue; }
    const c = parse(cs.outlineColor);
    if (!c || c[3] === 0) continue;
    const bg = backdrop(el.parentElement || el);
    results.checked++;
    const ringRatio = ratio(over(c, bg), bg);
    const shadowMatch = String(cs.boxShadow || '').match(/rgba?\(([^)]+)\)/);
    const shadow = shadowMatch ? shadowMatch[1].split(',').map((v) => parseFloat(v)) : null;
    const shadowRatio = shadow && shadow.length >= 3 ? ratio(over([shadow[0], shadow[1], shadow[2], shadow[3] === undefined ? 1 : shadow[3]], bg), bg) : 0;
    const best = Math.max(ringRatio, shadowRatio);
    if (best < 3) results.fails.push({ el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : ''), kind: 'focus-ring', ratio: +best.toFixed(2) });
  }
  return results;
}

function measureDisabled() {
  const parse = (s) => {
    const m = (s || '').match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1] : null;
  };
  const lum = (c) => {
    const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]);
  };
  const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);
  function backdrop(el) {
    const layers = [];
    let e = el;
    while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) layers.push(c); e = e.parentElement; }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }
  const out = { checked: 0, fails: [] };
  document.querySelectorAll('button[disabled], input[disabled], select[disabled], textarea[disabled], [aria-disabled="true"]').forEach((el) => {
    if (!el.offsetParent) return;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg || fg[3] === 0) return;
    const bg = backdrop(el);
    out.checked++;
    const r = ratio(over(fg, bg), bg);
    if (r < 3) out.fails.push({ el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : ''), ratio: +r.toFixed(2), text: (el.innerText || el.value || '').trim().slice(0, 30) });
  });
  return out;
}

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(SITE, url);
    if (!file.startsWith(SITE)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const fails = [];
  let loads = 0, textChecked = 0, focusChecked = 0, disabledChecked = 0;

  const TEXT_SELECTOR = 'p, li, a, button, label, h1, h2, h3, h4, h5, h6, dt, dd, summary, th, td, figcaption, blockquote';

  for (const file of PAGES) {
    if (!fs.existsSync(path.join(SITE, file))) { fails.push({ file, state: '-', kind: 'missing-page' }); continue; }
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await page.evaluateOnNewDocument((s) => { try { localStorage.setItem('jvds-theme', s); } catch (e) {} }, scheme);
      try {
        await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 25000 });
      } catch (e) { await page.close(); continue; }
      // Colour transitions fire on load and on theme switches, so a measurement
      // taken mid-fade reports a colour the page never settles on. Freeze them.
      try { await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' }); } catch (e) {}
      await new Promise((r) => setTimeout(r, 150));
      loads++;
      const text = await page.evaluate(measureText, TEXT_SELECTOR);
      textChecked += text.checked;
      text.fails.forEach((f) => fails.push({ file, state: scheme, kind: 'text', ...f }));
      const focus = await page.evaluate(measureFocus);
      focusChecked += focus.checked;
      focus.fails.forEach((f) => fails.push({ file, state: scheme, ...f }));
      const disabled = await page.evaluate(measureDisabled);
      disabledChecked += disabled.checked;
      disabled.fails.forEach((f) => fails.push({ file, state: scheme, kind: 'disabled', ...f }));
      await page.close();
    }
  }

  await browser.close();
  server.close();

  const summary = `${loads} page loads, ${textChecked} text runs, ${focusChecked} focus rings, ${disabledChecked} disabled controls measured`;
  if (!fails.length) {
    console.log(`PASS contrast-states: ${summary}, no failures in light or dark`);
    return;
  }
  console.log(`FAIL contrast-states: ${summary}, ${fails.length} failure(s)`);
  (LIST ? fails : fails.slice(0, 40)).forEach((f) => {
    const where = `${f.file} [${f.state}]`;
    if (f.kind === 'text') console.log(`  ${String(f.ratio).padStart(5)}:1 (need ${f.need})  ${where}  [${f.el}]  "${f.text}"  ${f.fg} on ${f.bg}`);
    else if (f.kind === 'missing-page') console.log(`  missing page ${f.file}`);
    else console.log(`  ${f.kind} ${String(f.ratio).padStart(5)}:1  ${where}  [${f.el}] ${f.text ? '"' + f.text + '"' : ''}`);
  });
  if (!LIST && fails.length > 40) console.log(`  ... +${fails.length - 40} more, run with --list`);
  process.exitCode = 1;
})().catch((e) => { console.error('contrast-states failed:', e.message); process.exitCode = 1; });
