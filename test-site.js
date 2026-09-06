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
const CANON_MAIN = ['🎮 Play', '🎓 Learn ▾', '🌟 Tiny Learners Ages 4-6', '🧪 Learning Lab Ages 7-12', '🚀 Teen Learn Ages 13+', '📊 My Progress', '🛠️ Create', '📚 Read', '📦 Downloads', '🏛️ Studio', '👨‍👩‍👧 Parents', '🔍'];
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
    if (seg && JSON.stringify(linkLabels(seg).slice(0, 9)) !== JSON.stringify(CANON_MAIN))
      fail('NAV', rel, `jvds-nav labels: ${linkLabels(seg).slice(0, 9).join(', ')}`);
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
    // shared engine sets window.WORKSHOP_TOTAL; inline engines declare a script-scope `const TOTAL`
    const mt = raw.match(/WORKSHOP_TOTAL\s*=\s*(\d+)/) || raw.match(/\bconst\s+TOTAL\s*=\s*(\d+)/);
    if (mt) {
      // count step cards by id; `data-step` is also used by unrelated tab widgets on some pages
      let steps = new Set([...raw.matchAll(/id="step-(\d+)"/g)].map(m => m[1])).size;
      if (!steps) steps = new Set([...raw.matchAll(/class="[^"]*step-card[^"]*"[^>]*data-step="(\d+)"/g)].map(m => m[1])).size;
      if (steps && Number(mt[1]) !== steps)
        fail('KEYS', rel, `declared total=${mt[1]} but ${steps} data-step sections`);
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
  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 30000 });
  let page = await browser.newPage();
  let n = 0, driven = 0;
  const skips = [];

  // shared by both drive paths: fill every code blank and answer any statically-keyed quiz in a container
  const SOLVE = `(root, label, out) => {
    const dec = s => { try { return decodeURIComponent(atob(s)); } catch (e) { return null; } };
    root.querySelectorAll('.cc-blank, .cf-blank').forEach(inp => {
      const raw = inp.dataset.a ? dec(inp.dataset.a) : (inp.dataset.answer || '');
      if (raw == null) { out.failures.push(label + ': undecodable blank'); return; }
      inp.value = raw.split('|')[0];
    });
    root.querySelectorAll('.cc-check-btn, .cf-check-btn').forEach(b => b.click());
    root.querySelectorAll('.cc-feedback, .cf-feedback').forEach(fb => {
      if (fb.textContent && /not quite|try again|incorrect|❌/i.test(fb.textContent))
        out.failures.push(label + ': canonical answer rejected');
    });
    root.querySelectorAll('.quiz-gate').forEach(gate => {
      // gates with no static key are rendered from a STEPS[] entry and are handled by the caller
      if (!gate.dataset.k && !gate.dataset.correct) return;
      const k = parseInt(gate.dataset.k ? dec(gate.dataset.k) : gate.dataset.correct, 10);
      const opt = gate.querySelector('.quiz-opt[data-idx="' + k + '"]');
      if (!opt) { out.failures.push(label + ': bad quiz key'); return; }
      opt.click();
      const submit = gate.querySelector('.quiz-submit'); if (submit) submit.click();
      const next = gate.querySelector('.quiz-next-btn');
      if (!next || getComputedStyle(next).display === 'none')
        out.failures.push(label + ': correct answer did not unlock next');
    });
  }`;

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

      // three engines ship on this site: the shared workshop-engine, an inline copy of it,
      // and the builder/blueprint pages that render one step at a time out of a STEPS[] array
      const shape = await page.evaluate(() => {
        let steps = null;
        try { steps = STEPS; } catch (e) {}
        if (Array.isArray(steps) && steps.length && document.getElementById('stepBody')) {
          const hasGo = typeof goStep === 'function';
          const hasRender = typeof renderStep === 'function';
          let idxVar = null;
          if (typeof cur !== 'undefined') idxVar = 'cur';
          else if (typeof currentStep !== 'undefined') idxVar = 'currentStep';
          if (!hasGo && !(hasRender && idxVar)) return { kind: 'skip', why: 'STEPS page: render index not reachable from page scope' };
          return { kind: 'steps', total: steps.length, hasGo, idxVar };
        }
        let total = window.WORKSHOP_TOTAL;
        // inline engines keep the total in a script-scope `const TOTAL`, reachable as a bare identifier here
        if (!total) { try { total = TOTAL; } catch (e) {} }
        if (total && typeof window.completeStep === 'function') return { kind: 'cards', total };
        return { kind: 'none' };
      });

      if (shape.kind === 'skip') skips.push(`${rel}: ${shape.why}`);

      if (shape.kind === 'cards') {
        driven++;
        const drive = await page.evaluate((solveSrc, total) => {
          const out = { failures: [] };
          // test harness only — SOLVE is a trusted template string defined above, not user input
          const solve = Function('"use strict"; return (' + solveSrc + ')')();
          for (let s = 1; s <= total; s++) {
            const card = document.getElementById('step-' + s) || document.querySelector(`.step-card[data-step="${s}"]`);
            if (!card) { out.failures.push(`step ${s}: card missing`); continue; }
            if (card.classList.contains('locked')) { out.failures.push(`step ${s}: locked when reached`); break; }
            solve(card, `step ${s}`, out);
            try { window.completeStep(s); } catch (e) { out.failures.push(`step ${s}: completeStep threw`); }
          }
          try {
            let key = window.WORKSHOP_KEY;
            if (!key) { try { key = STORAGE_KEY; } catch (e) {} }
            const saved = JSON.parse(localStorage.getItem(key) || 'null');
            if (!saved || !Array.isArray(saved.completed) || saved.completed.length < total)
              out.failures.push(`progress not fully saved (${saved && saved.completed ? saved.completed.length : 0}/${total})`);
          } catch (e) { out.failures.push('localStorage read failed'); }
          return out;
        }, SOLVE, shape.total);
        drive.failures.forEach(f => fail('DRIVE', rel, f));
      }

      if (shape.kind === 'steps') {
        driven++;
        // one step per round trip: these pages finish rendering inside requestAnimationFrame,
        // so racing through them in a single evaluate tears the DOM out from under their own init code
        for (let i = 0; i < shape.total; i++) {
          const res = await page.evaluate((solveSrc, i, hasGo, idxVar) => {
            const out = { failures: [] };
            // test harness only — SOLVE is trusted
            const solve = Function('"use strict"; return (' + solveSrc + ')')();
            try {
              if (hasGo) goStep(i);
              else { if (idxVar === 'cur') cur = i; else currentStep = i; renderStep(); }
            } catch (e) { out.failures.push(`step ${i}: render threw (${String(e.message).slice(0, 60)})`); return out; }
            const body = document.getElementById('stepBody');
            if (!body || !body.innerHTML.trim()) { out.failures.push(`step ${i}: rendered empty`); return out; }
            solve(body, `step ${i}`, out);
            // these pages keep one shared gate, keyed off the STEPS entry rather than a data attribute
            const qz = STEPS[i] && STEPS[i].quiz;
            const gate = document.getElementById('quizGate');
            if (gate && qz && typeof qz.correct === 'number') {
              if (Array.isArray(qz.opts) && (qz.correct < 0 || qz.correct >= qz.opts.length))
                out.failures.push(`step ${i}: quiz key ${qz.correct} out of range for ${qz.opts.length} options`);
              const opt = gate.querySelector(`.quiz-opt[data-idx="${qz.correct}"]`);
              if (opt) {
                opt.click();
                if (typeof checkQuiz === 'function') { try { checkQuiz(); } catch (e) { out.failures.push(`step ${i}: checkQuiz threw`); } }
                if (!opt.classList.contains('correct')) out.failures.push(`step ${i}: declared answer not marked correct`);
              }
            }
            return out;
          }, SOLVE, i, shape.hasGo, shape.idxVar);
          res.failures.forEach(f => fail('DRIVE', rel, f));
          await new Promise(r => setTimeout(r, 60));
        }
      }

      try { await page.evaluate(() => localStorage.clear()); } catch (e) {}
    } catch (e) {
      errors.push('NAV FAIL: ' + e.message.slice(0, 120));
      // a hung page poisons every page after it, so start the next one on a fresh tab
      try { await page.close(); } catch (e2) {}
      page = await browser.newPage();
    }
    page.off('pageerror', onErr); page.off('console', onCon); page.off('response', onResp);
    errors.forEach(e => fail('LOAD', rel, e));
    if (n % 25 === 0) process.stdout.write(`  ${n}/${pages.length}\n`);
  }
  await browser.close();
  console.log(`  driven end-to-end: ${driven}/${pages.length}`);
  if (skips.length) {
    console.log(`  not drivable by this harness (${skips.length}):`);
    skips.forEach(s => console.log(`    ${s}`));
  }
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
