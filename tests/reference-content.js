#!/usr/bin/env node
/*
 * tests/reference-content.js
 * A1605: guard the reference/parent page content fixes.
 *  - parent-guide FAQ arrows render as a real arrow (no mojibake), the privacy
 *    link points at /privacy-policy, and the checklist has no duplicate line.
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

  // ── parent-guide.html ──────────────────────────────────────────────────────
  const pg = await browser.newPage();
  const pgerrs = [];
  pg.on('pageerror', e => pgerrs.push(e.message));
  await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(BASE + 'tools/parent-guide.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 500));
  const p = await pg.evaluate(() => {
    const arrows = [...document.querySelectorAll('.arrow')].map(a => a.textContent.trim());
    const text = document.body.innerText;
    const bookmarkCount = (text.match(/Bookmark the Progress page/g) || []).length;
    return {
      arrowCount: arrows.length,
      allArrowsReal: arrows.length > 0 && arrows.every(t => t === '\u2192'),
      privacyOk: !!document.querySelector('#privacy a[href="/privacy-policy"]'),
      noQuestlog: !/questlog-pwa/.test(document.documentElement.innerHTML),
      bookmarkCount
    };
  });
  check('parent-guide: FAQ arrows render as a real arrow', p.allArrowsReal, 'arrows=' + p.arrowCount);
  check('parent-guide: privacy link points at /privacy-policy', p.privacyOk === true);
  check('parent-guide: no questlog-pwa link', p.noQuestlog === true);
  check('parent-guide: no duplicate checklist line', p.bookmarkCount === 1, 'count=' + p.bookmarkCount);
  check('parent-guide: no uncaught JS errors', pgerrs.length === 0, pgerrs.slice(0, 2).join(' | '));
  await pg.close();

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
