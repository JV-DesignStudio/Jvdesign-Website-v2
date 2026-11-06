#!/usr/bin/env node
/*
 * tests/reference-content.js
 * A1605: guard the reference/parent page content fixes.
 *  - keyboard-shortcuts Godot tab: Ctrl+A means Add child node, and the bogus
 *    "Attach script" rows are gone, so Ctrl+A is unambiguous.
 * Run: node tests/reference-content.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.REF_PORT || 8999;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });


  // ── keyboard-shortcuts.html (Godot tab) ────────────────────────────────────
  const kb = await browser.newPage();
  await kb.setViewport({ width: 1440, height: 900 });
  await kb.goto(BASE + 'tools/keyboard-shortcuts.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 400));
  const k = await kb.evaluate(() => {
    const html = document.documentElement.innerHTML;
    return {
      hasAddChild: /Ctrl\+A<\/td><td>Add child node/.test(html),
      hasInstantiate: /Ctrl\+Shift\+A<\/td><td>Instantiate child scene/.test(html),
      hasCopyPath: /Ctrl\+Shift\+C<\/td><td>Copy node path/.test(html),
      noAttach: !/Attach script/.test(html)
    };
  });
  check('keyboard-shortcuts: Ctrl+A means Add child node', k.hasAddChild === true);
  check('keyboard-shortcuts: Ctrl+Shift+A means Instantiate child scene', k.hasInstantiate === true);
  check('keyboard-shortcuts: Ctrl+Shift+C means Copy node path', k.hasCopyPath === true);
  check('keyboard-shortcuts: bogus "Attach script" rows removed', k.noAttach === true);
  await kb.close();

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL REFERENCE CONTENT CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
