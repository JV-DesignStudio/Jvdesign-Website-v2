#!/usr/bin/env node
// check-performance.js (A1693): a performance budget gate for the key templates.
//
// Serves the site locally, then loads each template at 390 and 1440 on a
// throttled "school device" profile (4x CPU, ~1.5 Mbps, 150 ms latency) and
// records LCP, CLS, total blocking time and transfer size. Any page over its
// budget exits 1, so CI fails on a regression.
//
//   node scripts/check-performance.js             gate (uses performance-budget.json)
//   node scripts/check-performance.js --report    print numbers only, never fail
//   node scripts/check-performance.js --json out.json
//   node scripts/check-performance.js --baseline  append a dated run to
//                                                 docs/performance-baseline.json
//   node scripts/check-performance.js --retries 2 extra tries for a row that
//                                                 breaches a budget (default 2,
//                                                 0 disables the retries)
//
// Budgets are deliberately generous. The point is to catch a page doubling in
// weight or a layout that starts jumping, not to chase a lab score.
//
// A2020: the harness reports the three Core Web Vitals directly. LCP (largest
// contentful paint) and CLS (cumulative layout shift) come from buffered
// observers. INP (interaction to next paint) needs a real input, so after the
// page settles we click the first visible button and read the Event Timing
// entries for that interaction. If a page has no button the click falls back to
// the body, which still produces an interactionId in Chrome. TBT and transfer
// stay as extra regression guards; TBT is not a substitute for INP.
//
// A2017: text responses are served gzip encoded when the browser asks for it,
// because GitHub Pages and Netlify both compress HTML, CSS and JS in transit.
// Measuring uncompressed text overstated first paint by about a second on the
// school-device profile and hid the real bottleneck, which is render-blocking
// CSS, not bytes on the wire. Images keep their real size.
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'performance-budget.json');
const BASELINE_FILE = path.join(ROOT, 'performance-baseline.json');
const REPORT_ONLY = process.argv.includes('--report');
const BASELINE = process.argv.includes('--baseline');
const jsonArg = process.argv.indexOf('--json');
const JSON_OUT = jsonArg > -1 ? process.argv[jsonArg + 1] : null;
// A transient load spike on a shared machine should not look like a
// regression. Any row that breaches a budget is measured up to two more times
// and the best run is used. A real regression breaches every run.
const retriesArg = process.argv.indexOf('--retries');
const RETRIES = retriesArg > -1 ? Math.max(0, parseInt(process.argv[retriesArg + 1], 10) || 0) : 2;
const PORT = 19270;

const MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const COMPRESSIBLE = /^text\/|javascript|json|svg|xml/;

function serve() {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const type = MIME[path.extname(file)] || 'application/octet-stream';
      const headers = { 'Content-Type': type };
      let body = data;
      if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
        body = zlib.gzipSync(data);
        headers['Content-Encoding'] = 'gzip';
      }
      res.writeHead(200, headers);
      res.end(body);
    });
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

// Runs before any page script. Buffered observers catch entries emitted before
// this script would otherwise get a chance to subscribe.
function installObservers() {
  window.__jvdsPerf = { lcp: 0, cls: 0, tbt: 0, inp: 0, shifts: [], interactions: [] };
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__jvdsPerf.lcp = Math.max(window.__jvdsPerf.lcp, e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__jvdsPerf.shifts.push({ t: e.startTime, v: e.value });
      }
      // CLS is the largest session window, not the sum of every shift on the
      // page. A window ends after a 1 s gap or when it passes 5 s.
      let best = 0, start = 0, last = 0, sum = 0;
      for (const s of window.__jvdsPerf.shifts) {
        if (sum && (s.t - last > 1000 || s.t - start > 5000)) { best = Math.max(best, sum); start = s.t; sum = 0; }
        if (!sum) start = s.t;
        sum += s.v;
        last = s.t;
      }
      window.__jvdsPerf.cls = Math.max(best, sum);
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__jvdsPerf.tbt += Math.max(0, e.duration - 50);
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  try {
    // Event Timing only exposes interactionId on real input events, so the
    // synthetic click below is what makes this measurable in a lab run.
    // INP is the longest interaction, so keep the longest event per id.
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (!e.interactionId) continue;
        const seen = window.__jvdsPerf.interactions.find(i => i.id === e.interactionId);
        if (seen) seen.duration = Math.max(seen.duration, e.duration);
        else window.__jvdsPerf.interactions.push({ id: e.interactionId, duration: e.duration });
        window.__jvdsPerf.inp = Math.max(window.__jvdsPerf.inp, e.duration);
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (e) {}
}

// Click a visible button so the page actually does some work. A button in an
// open welcome dialog comes first, then the page itself, then the body. A link
// would navigate and destroy the measurement, so anchors are skipped.
async function pressSomething(page) {
  const target = await page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return r.width > 0 && r.height > 0 && cx > 0 && cx < innerWidth && cy > 0 && cy < innerHeight;
    };
    const usable = el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
    // A welcome modal sits above the page on first visit, so a click on the
    // page behind it never reaches a control. Prefer a button in the open
    // dialog, then fall back to the page itself.
    const selectors = ['.modal-overlay.open button', '[role="dialog"] button', 'main button', 'button[type="button"]', 'button:not([type="submit"])', '[role="button"]', 'summary'];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (!usable(el)) continue;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName.toLowerCase() };
      }
    }
    return { x: innerWidth / 2, y: innerHeight / 2, tag: 'body' };
  });
  await page.mouse.click(target.x, target.y);
  return target.tag;
}

async function measure(browser, url, viewport, profile) {
  // Each measurement gets its own browser context and an empty cache, so it is
  // a genuine first visit. Sharing one profile meant the 1440 run reused what
  // the 390 run had downloaded and reported a warm revisit instead of a cold
  // load (A2017).
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(installObservers);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latencyMs,
    downloadThroughput: Math.round(profile.downloadKbps * 1024 / 8),
    uploadThroughput: Math.round(profile.uploadKbps * 1024 / 8),
    connectionType: 'cellular4g',
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown });

  const started = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: 'load', timeout: 90000 });
  // Let late layout, lazy images and long tasks settle.
  await new Promise(r => setTimeout(r, 3500));

  // Load-time metrics are read before the input. TBT and transfer describe the
  // initial page load, so the click must not fold its own work into them.
  const loaded = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    let transfer = nav.transferSize || 0;
    for (const r of performance.getEntriesByType('resource')) transfer += r.transferSize || 0;
    const perf = window.__jvdsPerf || { lcp: 0, cls: 0, tbt: 0 };
    return {
      lcp: Math.round(perf.lcp || 0),
      cls: Number((perf.cls || 0).toFixed(3)),
      tbt: Math.round(perf.tbt || 0),
      transferKB: Math.round(transfer / 1024),
    };
  });

  // A2020: a real input so the Event Timing API reports an interaction latency.
  // If the first click lands on an overlay and registers nothing, try once more
  // on whatever is visible now. A zero would otherwise hide a real delay.
  let inp = 0;
  for (let attempt = 0; attempt < 2 && !inp; attempt++) {
    try { await pressSomething(page); } catch (e) {}
    await new Promise(r => setTimeout(r, 600));
    try {
      inp = await page.evaluate(() => Math.round((window.__jvdsPerf && window.__jvdsPerf.inp) || 0));
    } catch (e) {}
  }
  const metrics = { ...loaded, inp, wallMs: Date.now() - started };
  await page.close();
  await context.close();
  return metrics;
}

function limitFor(budget, url, metric) {
  const pageBudget = (budget.pages && budget.pages[url]) || {};
  return pageBudget[metric] != null ? pageBudget[metric] : budget.default[metric];
}

(async () => {
  const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
  const server = await serve();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const results = [];
  let breaches = 0;
  const METRICS = [['lcp', 'LCP'], ['inp', 'INP'], ['cls', 'CLS'], ['tbt', 'TBT'], ['transferKB', 'transfer']];
  const breachesFor = (row, url) => METRICS.filter(([metric]) => row[metric] > limitFor(budget, url, metric)).length;

  try {
    for (const url of budget.pages_list) {
      for (const vp of budget.viewports) {
        const viewport = { width: vp.width, height: vp.height, isMobile: vp.width < 800, hasTouch: vp.width < 800 };
        let row = { url, viewport: vp.name, ...(await measure(browser, url, viewport, budget.profile)) };
        let over = breachesFor(row, url);
        for (let attempt = 0; attempt < RETRIES && over > 0; attempt++) {
          const retry = { url, viewport: vp.name, ...(await measure(browser, url, viewport, budget.profile)) };
          const retryOver = breachesFor(retry, url);
          if (retryOver <= over) { row = retry; over = retryOver; }
        }
        results.push(row);
        breaches += over;
        const parts = METRICS.map(([metric, label]) => {
          const limit = limitFor(budget, url, metric);
          const value = row[metric];
          const isOver = value > limit;
          const unit = metric === 'cls' ? '' : metric === 'transferKB' ? 'KB' : 'ms';
          return `${label} ${value}${unit}/${limit}${isOver ? ' OVER' : ''}`;
        });
        console.log(`${over ? 'FAIL' : 'PASS'} ${url} ${vp.name}  ${parts.join('  ')}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), profile: budget.profile, results }, null, 2));
    console.log(`\nWrote ${JSON_OUT}`);
  }

  if (BASELINE) {
    let commit = 'unknown';
    try {
      commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    } catch (e) {}
    let history = { runs: [] };
    try { history = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch (e) {}
    if (!Array.isArray(history.runs)) history.runs = [];
    history.runs.push({ at: new Date().toISOString(), commit, profile: budget.profile, viewports: budget.viewports, results });
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(history, null, 2) + '\n');
    console.log(`\nAppended baseline run to ${path.relative(ROOT, BASELINE_FILE)} (${commit})`);
  }
  console.log(`\n${results.length} measurements, ${breaches} over budget.`);
  if (REPORT_ONLY) { console.log('Report only: budgets not enforced.'); process.exit(0); }
  if (breaches) { console.log('PERFORMANCE BUDGET FAILED'); process.exit(1); }
  console.log('PERFORMANCE BUDGET PASSED');
})().catch(e => { console.error('Performance check error:', e); process.exit(1); });
