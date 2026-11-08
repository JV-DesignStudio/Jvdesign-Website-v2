#!/usr/bin/env node
/*
 * tests/echo-feedback.js
 * A2803: Echo's Improve beat reaches the other creator tools.
 *   - echo-feedback.js loads on a creator tool
 *   - it returns one specific, kind line for that tool
 *   - the keepsake strip shows the line
 *   - unknown tools get a safe fallback
 * Run: node tests/echo-feedback.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.ECHOFB_PORT || 8149;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/tools/colour-palette.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      try {
        localStorage.clear();
        localStorage.setItem('jvds_palettes', JSON.stringify([{ name: 'Sunset', cols: ['#ff0000', '#ff8800'], date: '2026-11-08' }]));
        localStorage.setItem('jvds_palette_current', JSON.stringify({ mood: 'warm', cols: ['#ff0000', '#ff8800', '#ffcc00', '#aa2200', '#ffffff'], paletteSize: 5 }));
      } catch (e) {}
      document.querySelectorAll('.modal-overlay.open, .modal.open').forEach(m => m.classList.remove('open'));
    });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1200));

    const result = await page.evaluate(() => {
      var line = window.EchoFeedback ? window.EchoFeedback.line('colour-palette') : '';
      var fallback = window.EchoFeedback ? window.EchoFeedback.line('not-a-tool') : '';
      var strip = document.getElementById('jk-echo-line');
      return {
        has: !!(window.EchoFeedback && window.EchoFeedback.has('colour-palette')),
        line: line,
        fallback: fallback,
        strip: strip ? strip.textContent : '',
        stripPresent: !!strip
      };
    });

    check('EchoFeedback loads on a creator tool', result.has, '');
    check('colour-palette gets a specific line', /^Echo:/.test(result.line) && /colour|palette|shade|tint|accent/i.test(result.line), result.line);
    check('the keepsake strip shows the line', result.stripPresent && result.strip === result.line, result.strip);
    check('unknown tools get a safe fallback', /^Echo:/.test(result.fallback) && result.fallback.length > 20, result.fallback);
    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? 'FAILURES PRESENT (' + failures + ')' : 'ALL ECHO FEEDBACK CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
