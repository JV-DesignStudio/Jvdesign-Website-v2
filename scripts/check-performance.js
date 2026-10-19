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
//
// Budgets are deliberately generous. The point is to catch a page doubling in
// weight or a layout that starts jumping, not to chase a lab score.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'performance-budget.json');
const REPORT_ONLY = process.argv.includes('--report');
const jsonArg = process.argv.indexOf('--json');
const JSON_OUT = jsonArg > -1 ? process.argv[jsonArg + 1] : null;
const PORT = 19270;

const MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};

function serve() {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

// Runs before any page script. Buffered observers catch entries emitted before
// this script would otherwise get a chance to subscribe.
function installObservers() {
  window.__jvdsPerf = { lcp: 0, cls: 0, tbt: 0 };
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__jvdsPerf.lcp = Math.max(window.__jvdsPerf.lcp, e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__jvdsPerf.cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__jvdsPerf.tbt += Math.max(0, e.duration - 50);
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
}

async function measure(browser, url, viewport, profile) {
  const page = await browser.newPage();
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

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    let transfer = nav.transferSize || 0;
    for (const r of performance.getEntriesByType('resource')) transfer += r.transferSize || 0;
    const perf = window.__jvdsPerf || { lcp: 0, cls: 0, tbt: 0 };
    return {
      lcp: Math.round(perf.lcp || 0),
      cls: Number((perf.cls || 0).toFixed(3)),
      tbt: Math.round(perf.tbt || 0),
      transferKB: Math.round(transfer / 1024),
      wallMs: 0,
    };
  });
  metrics.wallMs = Date.now() - started;
  await page.close();
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
  try {
    for (const url of budget.pages_list) {
      for (const vp of budget.viewports) {
        const m = await measure(browser, url, { width: vp.width, height: vp.height, isMobile: vp.width < 800, hasTouch: vp.width < 800 }, budget.profile);
        const row = { url, viewport: vp.name, ...m };
        results.push(row);
        const parts = [];
        for (const [metric, label] of [['lcp', 'LCP'], ['cls', 'CLS'], ['tbt', 'TBT'], ['transferKB', 'transfer']]) {
          const limit = limitFor(budget, url, metric);
          const value = m[metric];
          const over = value > limit;
          if (over) breaches++;
          parts.push(`${label} ${value}${metric === 'cls' ? '' : metric === 'transferKB' ? 'KB' : 'ms'}/${limit}${over ? ' OVER' : ''}`);
        }
        console.log(`${over(parts) ? 'FAIL' : 'PASS'} ${url} ${vp.name}  ${parts.join('  ')}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }

  function over(parts) { return parts.some(p => p.includes(' OVER')); }

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), profile: budget.profile, results }, null, 2));
    console.log(`\nWrote ${JSON_OUT}`);
  }
  console.log(`\n${results.length} measurements, ${breaches} over budget.`);
  if (REPORT_ONLY) { console.log('Report only: budgets not enforced.'); process.exit(0); }
  if (breaches) { console.log('PERFORMANCE BUDGET FAILED'); process.exit(1); }
  console.log('PERFORMANCE BUDGET PASSED');
})().catch(e => { console.error('Performance check error:', e); process.exit(1); });
