// cpp-platformer-export.js - guards the "Continue in C++" export on the C++ Platformer canvas.
//
// A1353: the canvas build-along now writes a real SFML project (main.cpp + CMakeLists.txt
// + README.txt) so a learner can carry their browser build into a desktop engine.
// This test loads the page, calls the export builder and checks the files are the real
// thing, then confirms the page still accepts every step solution.
//
// Run: node tests/cpp-platformer-export.js
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const pagePath = '/workshops/cpp-platformer-canvas.html';

let failures = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.goto(base + pagePath, { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.PC_projectFiles, { timeout: 8000 });

    const hasButton = await page.evaluate(() => !!Array.from(document.querySelectorAll('.cw-canvas-panel .cw-btn-dl')).find((b) => /Continue in C\+\+/.test(b.textContent)));
    check('has a "Continue in C++" button', hasButton);

    const files = await page.evaluate(() => window.PC_projectFiles().map((f) => ({ name: f.name, text: f.text })));
    const byName = {};
    files.forEach((f) => { byName[f.name.split('/').pop()] = f.text; });

    check('export contains main.cpp', !!byName['main.cpp']);
    check('export contains CMakeLists.txt', !!byName['CMakeLists.txt']);
    check('export contains README.txt', !!byName['README.txt']);

    const main = byName['main.cpp'] || '';
    const mainTokens = ['#include <SFML/Graphics.hpp>', 'sf::RenderWindow', 'GRAVITY', 'JUMP_VEL', 'MOVE_SPEED', 'sf::Keyboard::Space', 'coins', 'YOU WIN!', 'return 0;'];
    const missingMain = mainTokens.filter((t) => main.indexOf(t) === -1);
    check('main.cpp looks like a real SFML platformer', missingMain.length === 0, missingMain.join(', '));
    check('main.cpp bakes in the canvas platform coordinates', /120, 300, 100, 14/.test(main) && /155, 274, 14/.test(main));

    const cmake = byName['CMakeLists.txt'] || '';
    check('CMakeLists links SFML', /find_package\(SFML/.test(cmake) && /target_link_libraries\([^)]*sfml-graphics/.test(cmake));
    check('CMakeLists builds an executable', /add_executable\(/.test(cmake));

    const readme = byName['README.txt'] || '';
    check('README explains the build and controls', /cmake --build/.test(readme) && /Space/.test(readme));

    // The zip writer must actually run without throwing.
    const zipLen = await page.evaluate(() => {
      try {
        const enc = new TextEncoder();
        const files = window.PC_projectFiles().map((f) => ({ name: f.name, data: enc.encode(f.text) }));
        return window.pcMakeZip(files).length;
      } catch (e) { return -1; }
    });
    check('zip writer produces bytes', zipLen > 500, 'bytes ' + zipLen);

    // The page still accepts every step solution (the A1350 gate must keep working).
    const gate = await page.evaluate(() => {
      const bad = [];
      window.CW_CONFIG.steps.forEach((step) => {
        const ta = document.getElementById('editor-' + step.num);
        ta.disabled = false; ta.readOnly = false; ta.value = step.solution;
        window.CW.checkStep(step.num);
        const fb = document.getElementById('feedback-' + step.num);
        if (fb && /Almost!/.test(fb.textContent)) bad.push(step.num);
      });
      return bad;
    });
    check('every step solution still accepted', gate.length === 0, gate.join(', '));
    check('no runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: cpp-platformer-canvas Continue in C++ export');
})().catch((e) => { console.error(e); process.exit(1); });
