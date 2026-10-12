// canvas-project-passport.js - proves the A1382 port workflow round-trip:
// a learner's code is captured in a jvds.project passport, the export carries it,
// and the next lesson can bring it forward instead of starting blank.
//
// Run: node tests/canvas-project-passport.js
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
  const MARK = 'float carriedMarker = 12345;';
  try {
    const errors = [];
    // 1. Lesson 1: passport is built from the learner's code and the export carries it.
    const p1 = await browser.newPage();
    p1.on('pageerror', e => errors.push('p1: ' + e.message));
    await p1.setRequestInterception(true);
    p1.on('request', r => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
    await p1.goto(base + '/workshops/cpp-platformer-canvas.html', { waitUntil: 'load' });
    if (await p1.$('#cookie-decline')) await p1.click('#cookie-decline');
    await p1.evaluate((mark) => { const t = document.getElementById('editor-1'); t.value = mark; t.dispatchEvent(new Event('input', { bubbles: true })); }, MARK);
    const pass = await p1.evaluate(() => window.CW.getPassport());
    assert.equal(pass.format, 'jvds.project', 'passport format');
    assert.equal(pass.series, 'cpp-platformer', 'passport series, got ' + pass.series);
    assert.equal(pass.lesson, 1, 'passport lesson');
    assert.ok((pass.code['1'] || '').includes('carriedMarker'), 'passport captured the code');
    const files = await p1.evaluate(() => window.PC_projectFiles().map(f => f.name));
    assert.ok(files.some(f => f.endsWith('jvds.project.json')), 'export includes jvds.project.json, got ' + files.join(', '));
    assert.ok(files.some(f => f.endsWith('CONTINUE.md')), 'export includes CONTINUE.md');
    console.log('PASS passport built from learner code and embedded in the C++ export');

    // 2. Lesson 2: a stored passport offers Continue and brings the code forward.
    const p2 = await browser.newPage();
    p2.on('pageerror', e => errors.push('p2: ' + e.message));
    await p2.setRequestInterception(true);
    p2.on('request', r => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
    await p2.goto(base + '/workshops/cpp-platformer-part2-canvas.html', { waitUntil: 'load' });
    await p2.evaluate((s) => {
      const pass = JSON.parse(s);
      pass.completed = ['1']; // the learner finished at least one step in lesson 1
      localStorage.clear();
      localStorage.setItem('jvds.project.cpp-platformer.l1', JSON.stringify(pass));
    }, JSON.stringify(pass));
    await p2.reload({ waitUntil: 'load' });
    assert.ok(await p2.$('.cw-continue'), 'Continue banner appears on the next lesson');
    await p2.click('.cw-continue-take');
    const val = await p2.$eval('#editor-1', e => e.value);
    assert.ok(val.includes('carriedMarker'), 'previous code brought forward, got: ' + val.slice(0, 60));
    console.log('PASS next lesson offers Continue and brings the code forward');

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS canvas-project-passport: passport write -> export -> read -> bring forward');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
