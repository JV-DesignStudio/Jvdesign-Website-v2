#!/usr/bin/env node
/*
 * validate-a11y.js , accessibility report across every built page.
 *
 * There was no automated accessibility check in the pipeline (A679). Colour
 * contrast is covered by validate-contrast.js; nothing looked at names, labels,
 * landmarks or heading structure. This does, in a real browser, and reports.
 *
 * It is REPORT-ONLY by default (exit 0) because it surfaces a standing backlog
 * and must not block unrelated pushes. Add --strict (or A11Y_STRICT=1) to fail
 * the run when any issue is found - that is the mode to flip on once the
 * backlog is clear (or to gate a single directory with --area=tools).
 *
 * Rules (high signal, low false positives):
 *   html     : <html lang> present
 *   head     : non-empty <title>, <meta name=viewport> present
 *   img      : every <img> has an alt attribute
 *   control  : buttons/links/role=button have an accessible name
 *   form     : inputs/selects/textareas have a label, aria-label or title
 *   id       : no duplicate element ids
 *   headings : exactly one <h1>, no skipped heading levels  (advisory only)
 *   tabindex : no positive tabindex values
 *   iframe   : every <iframe> has a title
 *
 * Heading-order findings are reported but do not fail --strict: they are a
 * best-practice, and changing heading levels risks restyling every tool panel.
 * Name/label/alt/id issues are the hard failures and gate --strict.
 *
 * Hidden, decorative and bot-trap fields (Cloudflare .cf-blank / .cf-turnstile,
 * Netlify _gotcha) are ignored - they are not part of the accessible UI.
 *
 * Usage: node validate-a11y.js [--strict] [--all] [--area=tools]
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { ROOT, IGNORE_DIRS, EXCLUDE_FILES } = require('./scripts/lib/paths');

const STRICT = process.argv.includes('--strict') || process.env.A11Y_STRICT === '1';
const ALL = process.argv.includes('--all');
const AREA = (process.argv.find(a => a.startsWith('--area=')) || '').split('=')[1] || null;
const CONCURRENCY = 6;

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) out = out.concat(walk(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

const CHECKS = `(() => {
  const issues = [];
  const visible = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false; return el.getClientRects().length > 0; };
  const bot = el => el.classList.contains('cf-blank') || el.name === '_gotcha' || !!el.closest('.cf-turnstile') || /gotcha|cf-blank/i.test(el.className || '');
  const accName = el => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\\s+/).map(id => { const n = document.getElementById(id); return n ? n.textContent : ''; }).join(' ').trim();
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) { const t = l.textContent.replace(/\\s+/g, ' ').trim(); if (t) return t; } }
    const wrap = el.closest('label');
    if (wrap) { const t = wrap.textContent.replace(/\\s+/g, ' ').trim(); if (t) return t; }
    if (el.getAttribute('title')) return el.getAttribute('title').trim();
    const txt = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (txt) return txt;
    const img = el.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();
    if (el.tagName === 'INPUT' && /submit|button|reset/i.test(el.type) && el.value) return el.value;
    return '';
  };
  if (!document.documentElement.getAttribute('lang')) issues.push('html: missing lang');
  if (!document.title.trim()) issues.push('head: missing title');
  if (!document.querySelector('meta[name="viewport"]')) issues.push('head: missing viewport meta');
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) issues.push('img: missing alt (' + (img.getAttribute('src') || '').slice(0, 50) + ')');
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, textarea')) {
    if (el.closest('[aria-hidden="true"]')) continue;
    if (el.tagName === 'INPUT' && /hidden/i.test(el.type)) continue;
    if (bot(el) || !visible(el)) continue;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') { if (!accName(el)) issues.push('control: empty # link'); continue; }
    if (!accName(el)) issues.push('control: no accessible name on ' + el.tagName.toLowerCase() + (el.id ? ' #' + el.id : el.className ? '.' + String(el.className).split(/\\s+/)[0] : ''));
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
    if (bot(el) || !visible(el)) continue;
    const id = el.id;
    const labelled = (id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) || el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.getAttribute('placeholder');
    if (!labelled) issues.push('form: unlabeled ' + el.tagName.toLowerCase() + (el.id ? ' #' + el.id : el.name ? ' [' + el.name + ']' : ''));
  }
  const ids = {}; for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
  for (const id in ids) if (ids[id] > 1) issues.push('id: duplicate "' + id + '" x' + ids[id]);
  const h1 = document.querySelectorAll('h1').length;
  if (h1 !== 1) issues.push('headings: ' + h1 + ' x h1');
  let prev = 0;
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) { const l = +h.tagName[1]; if (prev && l > prev + 1) issues.push('headings: skip h' + prev + '->h' + l); prev = l; }
  for (const el of document.querySelectorAll('[tabindex]')) if (+el.getAttribute('tabindex') > 0) issues.push('tabindex: positive value on ' + el.tagName.toLowerCase());
  for (const f of document.querySelectorAll('iframe')) if (!f.getAttribute('title')) issues.push('iframe: missing title');
  return issues;
})()`;

(async () => {
  let files = walk(ROOT)
    .map(f => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter(f => !EXCLUDE_FILES.has(f) && f !== 'tools/quest-board.html');
  if (AREA) files = files.filter(f => f.startsWith(AREA + '/'));

  let browser;
  try { browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] }); }
  catch (e) { console.error('✗ validate-a11y: puppeteer launch failed:', e.message); process.exit(2); }

  const counts = {}; const offenders = {}; let withIssues = 0; let loaded = 0;
  const queue = files.slice();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    const page = await browser.newPage();
    for (;;) {
      const rel = queue.pop(); if (!rel) break;
      try {
        await page.goto('file:///' + path.join(ROOT, rel).split(path.sep).join('/'), { waitUntil: 'load', timeout: 20000 });
        const issues = await page.evaluate(CHECKS);
        loaded++;
        if (issues.length) {
          withIssues++;
          for (const it of issues) {
            const k = it.split(':')[0];
            counts[k] = (counts[k] || 0) + 1;
            (offenders[k] = offenders[k] || []).push(rel + ' -> ' + it);
          }
        }
      } catch (e) {
        const msg = String(e.message || e);
        if (!/Execution context was destroyed|ERR_ABORTED|Target closed|Navigating frame/i.test(msg)) {
          counts.NAV = (counts.NAV || 0) + 1;
          (offenders.NAV = offenders.NAV || []).push(rel + ' -> ' + msg.split('\n')[0].slice(0, 60));
        }
      }
    }
    await page.close();
  });
  await Promise.all(workers);
  try { await browser.close(); } catch {}

  const ADVISORY = new Set(['headings']); // heading order is best-practice, not a failed name/label
  const errKeys = Object.keys(counts).filter(k => !ADVISORY.has(k)).sort((a, b) => counts[b] - counts[a]);
  const advKeys = Object.keys(counts).filter(k => ADVISORY.has(k));
  const errTotal = errKeys.reduce((a, k) => a + counts[k], 0);
  const advTotal = advKeys.reduce((a, k) => a + counts[k], 0);
  const scope = AREA ? `${AREA}/ pages` : 'all pages';
  if (!errTotal && !advTotal) {
    console.log(`✓ validate-a11y: ${loaded} ${scope}, no accessibility issues found.`);
    process.exit(0);
  }
  if (errTotal) {
    console.log(`✗ validate-a11y: ${errTotal} accessibility issue(s) across ${withIssues}/${loaded} ${scope}:\n`);
    for (const k of errKeys) {
      console.log('  ' + k.padEnd(10) + ' ' + counts[k]);
      (ALL ? offenders[k] : offenders[k].slice(0, 3)).forEach(o => console.log('      ' + o));
    }
    if (!ALL) console.log('\n  (re-run with --all to list every issue, or --area=tools to scope one area)');
  } else {
    console.log(`✓ validate-a11y: no blocking issues across ${loaded} ${scope}.`);
  }
  if (advTotal) {
    console.log(`\n  ${advTotal} advisory heading issue(s) (reported, not failing):`);
    for (const k of advKeys) {
      console.log('  ' + k.padEnd(10) + ' ' + counts[k]);
      (ALL ? offenders[k] : offenders[k].slice(0, 3)).forEach(o => console.log('      ' + o));
    }
  }
  if (STRICT && errTotal) { console.log('\n  --strict: failing the run.'); process.exit(1); }
  console.log('\n  report-only (exit 0). Use --strict to fail on name/label issues, or --area=<dir> to scope.');
  process.exit(0);
})();
