#!/usr/bin/env node
/* test-site.js — site-wide regression audit.
 *
 *   node test-site.js           full run (~4-6 min): nav labels, progress keys,
 *                               page-error sweep, workshop engine drive-through
 *   node test-site.js --quick   workshops only (~2 min)
 *
 * Exit code 0 = all pass, 1 = failures (printed).
 *
 * Checks (each one has caught real regressions before):
 *  1. NAV    every main-nav / jvds-nav / nav-strip matches the canonical labels
 *  2. KEYS   every SERIES key in workshops/my-progress.html is written by a page,
 *            page links resolve, WORKSHOP_TOTAL matches data-step count
 *  3. LOAD   every page loads over HTTP with no real JS errors
 *  4. DRIVE  every shared-engine workshop is played to completion: quizzes
 *            answered via decoded data-k (matched by data-idx, options are
 *            shuffled!), blanks filled via decoded data-a, progress saved
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const QUICK = process.argv.includes('--quick');
const SKIP_DIRS = new Set(['node_modules', '.claude', '.git', '.githooks', 'quest-board-deploy', 'og', 'social-posts', 'pitch-assets', 'downloads', 'icons', 'assets']);
const failures = [];
const fail = (check, file, msg) => failures.push({ check, file, msg });

/* ── collect pages ── */
function htmlFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(d, e.name)); }
      else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, path.join(d, e.name)).replace(/\\/g, '/'));
    }
  })(dir);
  return out;
}
const ALL_PAGES = htmlFiles(ROOT);
const WORKSHOP_PAGES = ALL_PAGES.filter(p => p.startsWith('workshops/'));

/* ── 1. NAV LABELS (static) ── */
const CANON_MAIN = ['Home', '🎮 Games', '📚 Books', '🎓 Learn', '🔧 Workshop', '🛠️ Tools', '🎁 Freebies', '📊 Progress'];
const CANON_STRIP = ['🏠 Home', '🎮 Games', '📚 Books', '🎓 Learn', '🔧 Workshop', '🛠️ Tools', '🎁 Freebies'];
function linkLabels(seg) {
  const out = [];
  for (const m of seg.matchAll(/<a\b[^>]*>(.*?)<\/a>/gs)) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (t && t !== 'Skip to main content') out.push(t);
  }
  return out;
}
function navSegment(raw, startRe) {
  const m = raw.match(startRe);
  if (!m) return null;
  const seg = raw.slice(m.index, m.index + 5000);
  const end = seg.match(/<\/nav>|<\/ul>/);
  return end ? seg.slice(0, end.index) : seg;
}
function checkNav() {
  for (const rel of ALL_PAGES) {
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    let seg = navSegment(raw, /<nav[^>]*class="[^"]*main-nav/);
    if (seg && JSON.stringify(linkLabels(seg)) !== JSON.stringify(CANON_MAIN))
      fail('NAV', rel, `main-nav labels: ${linkLabels(seg).join(', ')}`);
    seg = navSegment(raw, /<(?:nav|div)[^>]*class="[^"]*jvds-nav-links/);
    if (seg && JSON.stringify(linkLabels(seg).slice(0, 8)) !== JSON.stringify(CANON_MAIN))
      fail('NAV', rel, `jvds-nav labels: ${linkLabels(seg).slice(0, 8).join(', ')}`);
    seg = navSegment(raw, /<nav[^>]*class="[^"]*nav-strip/);
    if (seg) {
      const labels = linkLabels(seg).filter(l => l !== 'JVDesignStudio');
      if (JSON.stringify(labels.slice(0, 7)) !== JSON.stringify(CANON_STRIP))
        fail('NAV', rel, `nav-strip labels: ${labels.slice(0, 7).join(', ')}`);
    }
  }
}

/* ── 2. PROGRESS KEYS (static) ── */
function checkKeys() {
  const prog = fs.readFileSync(path.join(ROOT, 'workshops/my-progress.html'), 'utf8');
  const writers = new Map();
  for (const rel of WORKSHOP_PAGES) {
    if (/my-progress|learn\.html|learning-lab/.test(rel)) continue;
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of raw.matchAll(/['"](jvds-[a-z0-9-]+-v\d)['"]/g)) {
      if (!writers.has(m[1])) writers.set(m[1], []);
      writers.get(m[1]).push(rel);
    }
    // engine pages: declared total must match step sections
    const mt = raw.match(/WORKSHOP_TOTAL\s*=\s*(\d+)/);
    if (mt) {
      const steps = new Set([...raw.matchAll(/data-step="(\d+)"/g)].map(m => m[1])).size;
      if (steps && Number(mt[1]) !== steps)
        fail('KEYS', rel, `WORKSHOP_TOTAL=${mt[1]} but ${steps} data-step sections`);
    }
  }
  for (const b of prog.matchAll(/\{([^{}]*key:\s*'(jvds-[^']+)'[^{}]*)\}/g)) {
    const key = b[2];
    if (!writers.has(key)) fail('KEYS', 'workshops/my-progress.html', `SERIES key ${key} not written by any workshop page`);
    const pm = b[1].match(/(?:page|href|link|url):\s*'([^']+)'/);
    if (pm && !fs.existsSync(path.join(ROOT, 'workshops', path.basename(pm[1]))))
      fail('KEYS', 'workshops/my-progress.html', `page link missing for ${key}: ${pm[1]}`);
  }
}

/* ── static file server ── */
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', json: 'application/json', wav: 'audio/wav', mp3: 'audio/mpeg' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let fp = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).slice(1)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ── 3+4. LOAD + DRIVE (headless) ── */
// cdn-cgi is Cloudflare-injected (email-decode), only exists when served through CF
const NOISE = /favicon|\.webp|\.png|\.jpe?g|\.wav|\.mp3|googletagmanager|google-analytics|youtube|fonts\.|manifest|ServiceWorker|ERR_BLOCKED_BY_CLIENT|\/cdn-cgi\/|printify/i;
async function checkPages(base) {
  const pages = QUICK ? WORKSHOP_PAGES : ALL_PAGES;
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  let n = 0;
  for (const rel of pages) {
    n++;
    const errors = [];
    const onErr = e => errors.push('pageerror: ' + String(e.message || e).slice(0, 160));
    // generic net-fail console lines carry no URL; the response handler reports 404s with the URL
    const onCon = m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/^Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); };
    const onResp = r => { if (r.status() === 404 && !NOISE.test(r.url())) errors.push('404: ' + r.url().slice(0, 160)); };
    page.on('pageerror', onErr); page.on('console', onCon); page.on('response', onResp);
    try {
      await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 300));
      const drive = await page.evaluate(() => {
        const out = { failures: [] };
        const dec = s => { try { return decodeURIComponent(atob(s)); } catch (e) { return null; } };
        const total = window.WORKSHOP_TOTAL;
        if (!total || typeof window.completeStep !== 'function') return out;
        for (let s = 1; s <= total; s++) {
          const card = document.getElementById('step-' + s) || document.querySelector(`.step-card[data-step="${s}"]`);
          if (!card) { out.failures.push(`step ${s}: card missing`); continue; }
          if (card.classList.contains('locked')) { out.failures.push(`step ${s}: locked when reached`); break; }
          card.querySelectorAll('.cc-blank, .cf-blank').forEach(inp => {
            const raw = inp.dataset.a ? dec(inp.dataset.a) : (inp.dataset.answer || '');
            if (raw == null) { out.failures.push(`step ${s}: undecodable blank`); return; }
            inp.value = raw.split('|')[0];
          });
          card.querySelectorAll('.cc-check-btn, .cf-check-btn').forEach(b => b.click());
          card.querySelectorAll('.cc-feedback, .cf-feedback').forEach(fb => {
            if (fb.textContent && /not quite|try again|incorrect|❌/i.test(fb.textContent))
              out.failures.push(`step ${s}: canonical answer rejected`);
          });
          const gate = card.querySelector('.quiz-gate');
          if (gate) {
            const k = parseInt(gate.dataset.k ? dec(gate.dataset.k) : gate.dataset.correct, 10);
            const opt = gate.querySelector(`.quiz-opt[data-idx="${k}"]`);
            if (!opt) { out.failures.push(`step ${s}: bad quiz key`); }
            else {
              opt.click();
              const submit = gate.querySelector('.quiz-submit'); if (submit) submit.click();
              const next = gate.querySelector('.quiz-next-btn');
              if (!next || getComputedStyle(next).display === 'none')
                out.failures.push(`step ${s}: correct answer did not unlock next`);
            }
          }
          try { window.completeStep(s); } catch (e) { out.failures.push(`step ${s}: completeStep threw`); }
        }
        try {
          const saved = JSON.parse(localStorage.getItem(window.WORKSHOP_KEY) || 'null');
          if (!saved || !Array.isArray(saved.completed) || saved.completed.length < total)
            out.failures.push(`progress not fully saved (${saved && saved.completed ? saved.completed.length : 0}/${total})`);
        } catch (e) { out.failures.push('localStorage read failed'); }
        return out;
      });
      drive.failures.forEach(f => fail('DRIVE', rel, f));
      try { await page.evaluate(() => localStorage.clear()); } catch (e) {}
    } catch (e) {
      errors.push('NAV FAIL: ' + e.message.slice(0, 120));
    }
    page.off('pageerror', onErr); page.off('console', onCon); page.off('response', onResp);
    errors.forEach(e => fail('LOAD', rel, e));
    if (n % 25 === 0) process.stdout.write(`  ${n}/${pages.length}\n`);
  }
  await browser.close();
}

/* ── main ── */
(async () => {
  const t0 = Date.now();
  console.log(`test-site${QUICK ? ' --quick' : ''}: ${ALL_PAGES.length} pages known, driving ${QUICK ? WORKSHOP_PAGES.length : ALL_PAGES.length}\n`);
  checkNav();
  checkKeys();
  console.log(`static checks done (${failures.length} failures so far), starting browser sweep...`);
  const srv = await serve();
  try {
    await checkPages(`http://127.0.0.1:${srv.address().port}`);
  } finally {
    srv.close();
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (failures.length === 0) {
    console.log(`\n✅ ALL PASS (${secs}s)`);
    process.exit(0);
  }
  console.log(`\n❌ ${failures.length} FAILURES (${secs}s):\n`);
  for (const f of failures) console.log(`  [${f.check}] ${f.file}\n      ${f.msg}`);
  process.exit(1);
})();
