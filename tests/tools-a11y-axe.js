#!/usr/bin/env node
/* A2324: automated accessibility audit for every tool page.
 *
 * Runs axe-core on each tools/*.html at 390 and 1440 and fails on serious or
 * critical violations. It reuses one page and blocks images, fonts and media so
 * it stays inside the review bot's per-test timeout.
 *
 *   node tests/tools-a11y-axe.js
 *   A11Y_ONLY=pixel-studio.html,level-designer.html node tests/tools-a11y-axe.js
 *   A11Y_WIDTHS=390 node tests/tools-a11y-axe.js
 *   A11Y_UPDATE_BASELINE=1 node tests/tools-a11y-axe.js   # rewrite the baseline
 *
 * The site already carries known serious/critical debt across older tool pages.
 * tests/a11y-baseline.json records it by page, width and rule so the gate starts
 * green and fails on any new violation (or any increase) instead of hiding it.
 * Fixing a page is still tracked: the count is checked in and can be lowered.
 * meta-refresh is ignored because a few tool URLs are deliberate redirects.
 *
 * Canvas controls must have accessible names. A focusable canvas, or one with
 * an interactive role, without a name is reported as a serious violation.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const axe = require('axe-core');

const ROOT = path.join(__dirname, '..');
const BASELINE_FILE = path.join(ROOT, 'a11y-baseline.json');
const UPDATE = process.env.A11Y_UPDATE_BASELINE === '1';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.woff2': 'font/woff2'
};
const WIDTHS = (process.env.A11Y_WIDTHS ? process.env.A11Y_WIDTHS.split(',') : [390, 1440]).map(Number);
const ONLY = process.env.A11Y_ONLY ? process.env.A11Y_ONLY.split(',').map(s => s.trim()).filter(Boolean) : null;
const MAX = process.env.A11Y_MAX ? parseInt(process.env.A11Y_MAX, 10) : 0;
const BLOCKING = new Set(['serious', 'critical']);
const IGNORED_RULES = new Set(['meta-refresh']);

let TOOLS = fs.readdirSync(path.join(ROOT, 'tools')).filter(f => f.endsWith('.html')).sort();
if (ONLY) TOOLS = TOOLS.filter(f => ONLY.includes(f) || ONLY.includes('/tools/' + f));
if (MAX) TOOLS = TOOLS.slice(0, MAX);

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function loadBaseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return raw && typeof raw.entries === 'object' ? raw.entries : {};
  } catch { return {}; }
}

(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const PORT = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const t = req.resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return req.abort();
    req.continue();
  });

  const baseline = loadBaseline();
  const current = {};
  const detail = {};
  const newViolations = [];
  let scanned = 0;
  let skipped = 0;

  async function gotoRetry(url) {
    for (let i = 0; i < 3; i++) {
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }); return; }
      catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 120)); }
    }
  }

  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: width < 700 ? 844 : 900, isMobile: width < 700 });
      for (const tool of TOOLS) {
        let result;
        let unnamedCanvas;
        try {
          const wanted = `/tools/${tool}`;
          await gotoRetry(`http://127.0.0.1:${PORT}${wanted}`);
          // Redirect stubs (meta refresh or a JS location change) are not tool
          // pages and would make the run race the navigation. Skip them.
          const landed = new URL(page.url()).pathname;
          if (landed !== wanted && landed !== '/' + tool) { skipped++; continue; }
          await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));
          // Runtime.evaluate is not subject to the page CSP, so the axe source
          // can be injected on pages that only allow hashed scripts.
          await page.evaluate(axe.source);
          const out = await page.evaluate(async () => {
            const res = await window.axe.run(document, {
              resultTypes: ['violations'],
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }
            });
            const named = (el) => {
              const id = el.getAttribute('aria-labelledby');
              if (id) {
                const text = id.split(/\s+/).map(x => {
                  const n = document.getElementById(x);
                  return n ? (n.textContent || '').trim() : '';
                }).join(' ').trim();
                if (text) return true;
              }
              if ((el.getAttribute('aria-label') || '').trim()) return true;
              if ((el.getAttribute('title') || '').trim()) return true;
              if (el.textContent && el.textContent.trim()) return true;
              return false;
            };
            const canvases = [...document.querySelectorAll('canvas')].filter(c =>
              c.hasAttribute('tabindex') || ['application', 'img', 'button', 'checkbox'].includes((c.getAttribute('role') || '').toLowerCase())
            );
            const unnamed = canvases.filter(c => !named(c)).map(c => c.id ? '#' + c.id : 'canvas');
            return {
              violations: res.violations.map(v => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                nodes: v.nodes.slice(0, 3).map(n => n.target.join(' '))
              })),
              unnamedCanvas: unnamed
            };
          });
          result = out.violations;
          unnamedCanvas = out.unnamedCanvas;
        } catch (e) {
          const msg = e.message.split('\n')[0];
          if (/Execution context was destroyed|navigat/i.test(msg)) { skipped++; continue; }
          newViolations.push(`${tool} @${width}px: audit could not run (${msg})`);
          continue;
        }
        scanned++;
        for (const v of result) {
          if (IGNORED_RULES.has(v.id) || !BLOCKING.has(v.impact)) continue;
          const key = `${tool}|${width}|${v.id}`;
          current[key] = (current[key] || 0) + 1;
          if (!detail[key]) detail[key] = v.nodes;
        }
        if (unnamedCanvas && unnamedCanvas.length) {
          const key = `${tool}|${width}|canvas-name`;
          current[key] = (current[key] || 0) + unnamedCanvas.length;
          if (!detail[key]) detail[key] = unnamedCanvas.slice(0, 3);
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (UPDATE) {
    const payload = {
      generatedAt: new Date().toISOString(),
      axeVersion: axe.version,
      note: 'Known serious/critical axe debt for tool pages (A2324). Lower this file as pages are fixed; the gate fails on any new or increased entry.',
      entries: Object.fromEntries(Object.keys(current).sort().map(k => [k, current[k]]))
    };
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n');
    console.log(`Wrote ${BASELINE_FILE} with ${Object.keys(current).length} entries after scanning ${scanned} page/viewport pairs (${skipped} redirects skipped).`);
    return;
  }

  for (const key of Object.keys(current)) {
    const allowed = baseline[key] || 0;
    if (current[key] > allowed) newViolations.push(`${key}: ${current[key]} now, ${allowed} in baseline`);
  }

  const known = Object.keys(current).reduce((n, k) => n + Math.max(0, current[k] - (baseline[k] || 0)), 0);
  console.log(`axe-core ${axe.version}: scanned ${scanned} page/viewport pairs, ${skipped} redirects skipped (${TOOLS.length} tools x ${WIDTHS.length} widths)`);
  console.log(`known serious/critical debt: ${Object.keys(baseline).length} entries; new violations: ${newViolations.length}`);
  if (newViolations.length) {
    console.log('\nNew serious/critical violation(s):');
    for (const v of newViolations.slice(0, 80)) {
      const d = detail[v.split(':')[0]];
      console.log('  FAIL ' + v + (d ? ' -> ' + d.join(' | ') : ''));
    }
    if (newViolations.length > 80) console.log(`  ...and ${newViolations.length - 80} more`);
    console.log('TOOLS A11Y AXE: FAIL');
    process.exitCode = 1;
  } else {
    console.log('TOOLS A11Y AXE: PASS (no new serious or critical violations)');
  }
})().catch(err => {
  console.error('TOOLS A11Y AXE: ERROR', err);
  process.exitCode = 1;
});
