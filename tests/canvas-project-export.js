// canvas-project-export.js - proves the A1383 Phase 2 export: each text-engine
// canvas bundles the learner's code in that engine's language, plus the passport
// and CONTINUE.md, while C++ keeps its own richer project export.
//
// Run: node tests/canvas-project-export.js
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict'), puppeteer = require('puppeteer');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    fs.readFile(file, (err, d) => { res.writeHead(err ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(err ? '' : d); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const base = 'http://127.0.0.1:' + server.address().port;
  const errors = [];
  async function load(p) {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(p + ': ' + e.message));
    await page.setRequestInterception(true);
    page.on('request', r => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
    await page.goto(base + '/workshops/' + p, { waitUntil: 'load' });
    return page;
  }
  try {
    // Python canvas: main.py with hash comments, passport and CONTINUE.md, plus the button.
    const py = await load('python-platformer-canvas.html');
    const pj = await py.evaluate(() => window.CW.projectFiles());
    const names = pj.map(f => f.name);
    assert.ok(names.some(n => n.endsWith('/main.py')), 'python export names main.py, got ' + names.join(', '));
    assert.ok(names.some(n => n.endsWith('/jvds.project.json')), 'python export has jvds.project.json');
    assert.ok(names.some(n => n.endsWith('/CONTINUE.md')), 'python export has CONTINUE.md');
    const pyMain = pj.find(f => f.name.endsWith('/main.py')).text;
    assert.ok(pyMain.trimStart().startsWith('#'), 'python source uses # comments');
    assert.ok(/Step \d+:/.test(pyMain), 'python source lists the steps');
    assert.ok(await py.$('.cw-project-dl'), 'Python canvas shows Download my project button');
    console.log('PASS Python canvas exports main.py + passport + CONTINUE.md');
    await py.close();

    // PICO-8 canvas: Lua export (-- comments).
    const p8 = await load('pico8-pong-canvas.html');
    const p8j = await p8.evaluate(() => window.CW.projectFiles());
    const p8names = p8j.map(f => f.name);
    assert.ok(p8names.some(n => n.endsWith('/main.lua')), 'pico8 export names main.lua, got ' + p8names.join(', '));
    const p8main = p8j.find(f => f.name.endsWith('/main.lua')).text;
    assert.ok(p8main.trimStart().startsWith('--'), 'lua source uses -- comments');
    console.log('PASS PICO-8 canvas exports main.lua');
    await p8.close();

    // C++ keeps its own richer export and does NOT get the generic button.
    const cpp = await load('cpp-platformer-canvas.html');
    const hasOwn = await cpp.evaluate(() => typeof window.PC_projectFiles === 'function');
    assert.ok(hasOwn, 'C++ still has its own project export');
    assert.equal(await cpp.$('.cw-project-dl'), null, 'C++ does not get the generic button');
    const cppFiles = await cpp.evaluate(() => window.PC_projectFiles().map(f => f.name));
    assert.ok(cppFiles.some(f => f.endsWith('jvds.project.json')), 'C++ export includes the passport');
    console.log('PASS C++ keeps its project export and skips the generic button');
    await cpp.close();

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS canvas-project-export: text engines bundle code + passport + CONTINUE.md');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
