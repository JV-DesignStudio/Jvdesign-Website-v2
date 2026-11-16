#!/usr/bin/env node
/*
 * tests/arcade-game-maker-landing-http.js
 * The public landing page for the Arcade Game Maker. Guards the copy that drifted
 * (it advertised 21 genres after the maker grew to 23) and keeps the primary
 * "start building" link pointing at the real maker.
 *
 * Run: node tests/arcade-game-maker-landing-http.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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

  const resp = await fetch(base + '/tools/arcade-game-maker-landing.html');
  const html = await resp.text();
  check('landing page serves', resp.status === 200, 'status ' + resp.status);
  check('landing page is HTML', /text\/html/.test(resp.headers.get('content-type') || ''), resp.headers.get('content-type') || '');
  check('landing advertises 23 genres', html.includes('23 Game Genres'), '23 Game Genres');
  check('landing no longer says 21 genres', !html.includes('21 Game Genres'));
  check('landing links to the maker', html.includes('arcade-game-maker.html'), 'start link');
  check('landing shows Dino Dash', html.includes('Dino Dash'));
  const previews = [...html.matchAll(/src="\/assets\/arcade-previews\/([^"]+)"/g)].map(m => m[1]);
  check('landing gallery uses starter previews', previews.length >= 8, previews.length + ' previews');
  const missingPreviews = previews.filter(f => !fs.existsSync(path.join(ROOT, 'assets', 'arcade-previews', f)));
  check('every landing preview file exists', missingPreviews.length === 0, missingPreviews.join(','));

  const maker = await fetch(base + '/tools/arcade-game-maker.html');
  const makerHtml = await maker.text();
  check('maker page serves', maker.status === 200, 'status ' + maker.status);
  check('maker has the first-game wizard', makerHtml.includes('Make your first game'));

  await new Promise(r => server.close(r));
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER LANDING CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
