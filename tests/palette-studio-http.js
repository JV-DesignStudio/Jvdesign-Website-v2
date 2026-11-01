#!/usr/bin/env node
/**
 * tests/palette-studio-http.js - Palette Studio consolidation contract.
 *
 * tools/palette-studio.html was a second "Palette Studio" page. It is now a
 * noindex redirect to the single canonical Palette Studio at
 * tools/colour-palette.html. This test proves the retirement stayed in place
 * instead of the old duplicate quietly coming back.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = 19255;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

function get(url) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:' + PORT + url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise((resolve) => server.listen(PORT, resolve));

  const stub = await get('/tools/palette-studio.html');
  check('redirect stub is served', stub.status === 200, String(stub.status));
  check('stub is noindex', /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(stub.body));
  check('stub canonical points at colour-palette', /<link[^>]+rel=["']canonical["'][^>]*href=["']https:\/\/jvdesignstudio\.co\.uk\/tools\/colour-palette\.html["']/i.test(stub.body));
  check('stub refreshes to colour-palette', /<meta[^>]+http-equiv=["']refresh["'][^>]*url=colour-palette\.html/i.test(stub.body));
  check('stub has a real fallback link', /<a[^>]+href=["']colour-palette\.html["']/i.test(stub.body));

  const canonical = await get('/tools/colour-palette.html');
  check('canonical Palette Studio is served', canonical.status === 200, String(canonical.status));
  check('canonical Palette Studio is indexable', !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(canonical.body));
  check('canonical Palette Studio keeps its own URL', /<link[^>]+rel=["']canonical["'][^>]*href=["']https:\/\/jvdesignstudio\.co\.uk\/tools\/colour-palette\.html["']/i.test(canonical.body));
  check('canonical Palette Studio still draws a palette', /palette/i.test(canonical.body) && /export/i.test(canonical.body));

  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PALETTE STUDIO REDIRECT CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
