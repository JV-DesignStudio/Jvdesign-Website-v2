#!/usr/bin/env node
/*
 * tests/sitemap-http.js
 * Guards the public sitemap page and the generated sitemap.xml: the Arcade Game
 * Maker entry must be present and its genre count must not drift back to 21.
 *
 * Run: node tests/sitemap-http.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.xml': 'application/xml', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const resp = await fetch(base + '/pages/sitemap.html');
  const html = await resp.text();
  check('sitemap page serves', resp.status === 200, 'status ' + resp.status);
  check('sitemap lists the Arcade Game Maker', html.includes('Arcade Game Maker'));
  check('sitemap says 23 game types', html.includes('23 game types'));
  check('sitemap no longer says 21 game types', !html.includes('21 game types'));

  const xml = await fetch(base + '/sitemap.xml');
  const xmlText = await xml.text();
  check('sitemap.xml serves', xml.status === 200, 'status ' + xml.status);
  check('sitemap.xml includes the maker', xmlText.includes('arcade-game-maker'));

  await new Promise(r => server.close(r));
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nSITEMAP CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
