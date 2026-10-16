// A1550: make-funnel events in tool-analytics.js.
// Checks the four funnel events (open, template_used, export, handoff_click)
// fire only after consent, the readout reports a template-to-export rate, and
// prints a sample event trace at 390px and 1440px.
//
// Run: node tests/tool-analytics-funnel.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(ROOT, clean);
  if (!path.extname(p)) p = path.join(ROOT, 'pages', clean.replace(/^\//, '') + '.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' , ' + extra : '')); if (!ok) failures++; };
const events = (page) => page.evaluate(() => (window.dataLayer || [])
  .filter(a => a && a[0] === 'event').map(a => ({ name: a[1], params: a[2] || {} })));

async function gate(page) {
  await page.setRequestInterception(true);
  page.on('request', r => (/googletagmanager|web-vitals/.test(r.url()) ? r.abort() : r.continue()));
}

async function runFlow(page) {
  await page.evaluate(() => {
    if (window.ToolAnalytics) window.ToolAnalytics.event('template_used', 'fire');
    const a = document.createElement('a');
    a.href = 'data:,'; a.setAttribute('download', 'palette.png');
    document.body.appendChild(a); a.click(); a.remove();
    // hand-off: colour-palette has no tool-handoff.js, so this also exercises the late-assignment path
    window.JVDSHandoff = { sendToGameMaker: function () { return true; } };
    window.JVDSHandoff.sendToGameMaker('player');
  });
  await new Promise(r => setTimeout(r, 120));
  const trace = await events(page);
  const readout = await page.evaluate(() => (window.ToolAnalytics ? window.ToolAnalytics.readout() : {}));
  return { trace, readout };
}

const has = (trace, name) => trace.some(e => e.name === name);

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    // ── declined: nothing leaves the page ────────────────────────────────────
    const p1 = await browser.newPage();
    await gate(p1);
    await p1.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-cookie-consent', 'declined'); } catch (e) {} });
    await p1.setViewport({ width: 1440, height: 900 });
    await p1.goto(base + '/tools/colour-palette.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p1.waitForFunction('window.ToolAnalytics', { timeout: 8000 });
    await runFlow(p1);
    const declined = await events(p1);
    const own = ['tool_open', 'tool_template_used', 'tool_export', 'tool_handoff_click'];
    const leaked = declined.filter(e => own.includes(e.name));
    check('declined: no tool-analytics funnel events sent', leaked.length === 0, 'leaked=' + JSON.stringify(leaked.map(e => e.name)));
    await p1.close();

    // ── accepted: the four funnel steps at two viewports ─────────────────────
    for (const vp of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
      const page = await browser.newPage();
      await gate(page);
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-cookie-consent', 'accepted'); } catch (e) {} });
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(base + '/tools/colour-palette.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForFunction('window.ToolAnalytics', { timeout: 8000 });
      const { trace, readout } = await runFlow(page);
      console.log('  trace @' + vp.w + ': ' + JSON.stringify(trace));
      check('@' + vp.w + ' tool_open with tool_id', trace.some(e => e.name === 'tool_open' && e.params.tool_id === 'colour-palette'));
      check('@' + vp.w + ' template_used', has(trace, 'tool_template_used'));
      check('@' + vp.w + ' export', has(trace, 'tool_export'));
      check('@' + vp.w + ' handoff_click', has(trace, 'tool_handoff_click'));
      check('@' + vp.w + ' readout template_to_export_rate', typeof readout['colour-palette']?.template_to_export_rate === 'number');
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('@' + vp.w + ' no horizontal overflow', ov <= 1, 'overflow=' + ov);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }

  console.log('\n' + (failures ? 'FAILED ' + failures : 'ALL FUNNEL CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})();
