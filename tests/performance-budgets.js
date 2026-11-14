#!/usr/bin/env node
/* tests/performance-budgets.js , A2326
 *
 * A checked-in payload and first-interaction budget for every tool page, so a
 * studio that grows too heavy fails CI with a clear message.
 *
 *   node tests/performance-budgets.js            gate (payload + interaction)
 *   node tests/performance-budgets.js --report   print numbers, never fail
 *   node tests/performance-budgets.js --payload  payload only (fast)
 *
 * Payload is the gzipped HTML plus every local CSS/JS it loads (deduplicated),
 * which is close to what a school laptop actually parses. First interaction is
 * the time from navigation start until the first visible button answers a click
 * (two animation frames), measured at 390px on a throttled profile.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'tools-performance-budget.json');
const REPORT = process.argv.includes('--report');
const PAYLOAD_ONLY = process.argv.includes('--payload');
const UPDATE = process.argv.includes('--update');

const MIME_EXT = /\.(?:css|js|mjs)$/;
const DEFAULT_BUDGET = { maxPayloadKB: 1000, maxFirstInteractionMs: 9000 };

function readTools() {
  const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/tools.json'), 'utf8'));
  const seen = new Set();
  const out = [];
  for (const t of tools) {
    if (!t.url) continue;
    const pathOnly = t.url.split('?')[0].split('#')[0];
    if (!/^\/[^/][^?#]*\.html$/.test(pathOnly)) continue;
    if (seen.has(pathOnly)) continue;
    seen.add(pathOnly);
    out.push({ id: t.id, url: pathOnly, file: path.join(ROOT, pathOnly.replace(/^\//, '')) });
  }
  return out;
}

function localAsset(pageFile, ref) {
  if (!ref || /^(?:https?:)?\/\//.test(ref) || /^data:/.test(ref)) return null;
  const clean = ref.split('?')[0].split('#')[0];
  if (!MIME_EXT.test(clean)) return null;
  const p = clean.startsWith('/') ? path.join(ROOT, clean) : path.join(path.dirname(pageFile), clean);
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
}

function payloadFor(tool) {
  if (!fs.existsSync(tool.file)) return { kb: 0, missing: true, assets: [] };
  const html = fs.readFileSync(tool.file, 'utf8');
  const total = new Map();
  const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
  total.set(tool.file, gz(Buffer.from(html)));
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:css|js|mjs)(?:\?[^"']*)?)["']/g)].map((m) => m[1]);
  for (const ref of refs) {
    const p = localAsset(tool.file, ref);
    if (!p || total.has(p)) continue;
    try { total.set(p, gz(fs.readFileSync(p))); } catch (e) { /* ignore */ }
  }
  let bytes = 0;
  for (const v of total.values()) bytes += v;
  return { kb: Math.round(bytes / 1024), missing: false, assets: total.size - 1 };
}

function budgetFor(budgets, url) {
  return { ...DEFAULT_BUDGET, ...(budgets.default || {}), ...((budgets.tools && budgets.tools[url]) || {}) };
}

async function measureInteraction(puppeteer, base, tool) {
  // One browser per run, one fresh page per tool.
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const client = await page.createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(base + tool.url, { waitUntil: 'load', timeout: 45000 });
    // Clicking a control must not navigate. The time returned is from
    // navigation start until the control has answered the click.
    return await page.evaluate(() => new Promise((resolve) => {
      document.addEventListener('click', (e) => e.preventDefault(), true);
      const candidates = [...document.querySelectorAll('button, [role="button"], summary')];
      const target = candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
      }) || document.body;
      try { target.click(); } catch (e) {}
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(performance.now()))));
    }));
  } finally {
    await browser.close().catch(() => {});
  }
}

(async () => {
  const tools = readTools();
  const budgets = fs.existsSync(BUDGET_FILE) ? JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')) : { tools: {} };
  const rows = [];
  let failures = 0;

  for (const tool of tools) {
    const payload = payloadFor(tool);
    const budget = budgetFor(budgets, tool.url);
    const over = payload.kb > budget.maxPayloadKB;
    rows.push({ tool, payload, budget, over });
    if (over && !REPORT) failures++;
  }

  // First interaction needs a browser; --payload and --report skip it unless asked.
  let interactions = null;
  if (!PAYLOAD_ONLY) {
    const puppeteer = require('puppeteer');
    const http = require('http');
    const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };
    const server = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') u = '/index.html';
      const f = path.normalize(path.join(ROOT, u));
      if (!f.startsWith(path.normalize(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    await new Promise((r) => server.listen(0, r));
    const base = 'http://127.0.0.1:' + server.address().port;
    interactions = new Map();
    try {
      for (const row of rows) {
        try {
          const ms = await measureInteraction(puppeteer, base, row.tool);
          interactions.set(row.tool.url, ms);
          if (ms > row.budget.maxFirstInteractionMs && !REPORT) failures++;
        } catch (e) {
          interactions.set(row.tool.url, Infinity);
          if (!REPORT) failures++;
        }
      }
    } finally {
      await new Promise((r) => server.close(r));
    }
  }

  const label = (n) => String(n).padStart(5);
  console.log('tool'.padEnd(42) + 'payload    budget   interaction');
  for (const row of rows) {
    const ms = interactions ? interactions.get(row.tool.url) : '-';
    console.log(
      row.tool.url.replace('/tools/', '').padEnd(42) +
      label(row.payload.kb + 'KB') + '  ' + label(row.budget.maxPayloadKB + 'KB') + '  ' +
      (interactions ? label(ms === Infinity ? 'ERR' : ms + 'ms') + ' / ' + row.budget.maxFirstInteractionMs + 'ms' : '-')
    );
  }
  if (UPDATE) {
    const next = { _comment: budgets._comment || 'A2326 per-tool payload and first-interaction budgets. Payload is gzipped HTML plus local CSS/JS. Update with node tests/performance-budgets.js --update.', default: budgets.default || DEFAULT_BUDGET, tools: {} };
    for (const row of rows) {
      const measured = row.payload.kb;
      const existing = (budgets.tools && budgets.tools[row.tool.url]) || {};
      next.tools[row.tool.url] = { ...existing, maxPayloadKB: existing.maxPayloadKB || Math.max(200, Math.ceil(measured * 1.25 / 50) * 50) };
    }
    fs.writeFileSync(BUDGET_FILE, JSON.stringify(next, null, 2) + '\n');
    console.log('\nWrote ' + path.relative(ROOT, BUDGET_FILE));
    process.exit(0);
  }
  if (REPORT) { console.log('\nReport only: budgets not enforced.'); process.exit(0); }
  if (failures) { console.log('\n' + failures + ' tool budget failure(s)'); process.exit(1); }
  console.log('\nPERFORMANCE TOOL BUDGETS PASSED (' + rows.length + ' tools)');
})().catch((e) => { console.error('Harness error:', e); process.exit(1); });
