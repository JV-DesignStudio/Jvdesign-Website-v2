// my-progress-projects.js - proves the A1397 My projects list: passports saved
// on the device show up on My Progress with a working Resume link.
//
// Run: node tests/my-progress-projects.js
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
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
    await page.goto(base + '/workshops/my-progress.html', { waitUntil: 'load' });

    // Empty state
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 200));
    assert.ok((await page.$eval('#myProjectsList', e => e.textContent)).includes('No projects yet'), 'empty state shows');

    // Two passports
    await page.evaluate(() => {
      localStorage.setItem('jvds.project.cpp-platformer.l2', JSON.stringify({ format: 'jvds.project', version: 1, engine: 'C++', series: 'cpp-platformer', lesson: 2, title: 'C++ Platformer Part 2', page: '/workshops/cpp-platformer-part2-canvas.html', updated: '2026-10-12T10:00:00Z', completed: ['1', '2'], steps: [{ num: 1, title: 'A' }, { num: 2, title: 'B' }, { num: 3, title: 'C' }, { num: 4, title: 'D' }] }));
      localStorage.setItem('jvds.project.python-platformer.l1', JSON.stringify({ format: 'jvds.project', version: 1, engine: 'Python', series: 'python-platformer', lesson: 1, title: 'Python Platformer', page: '/workshops/python-platformer-canvas.html', updated: '2026-10-12T11:00:00Z', completed: ['1'], steps: [{ num: 1, title: 'A' }, { num: 2, title: 'B' }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#myProjectsList .mp-card').length === 2, { timeout: 5000 });
    const cards = await page.$$eval('#myProjectsList .mp-card', els => els.map(e => ({ href: e.getAttribute('href'), text: e.textContent })));
    assert.equal(cards.length, 2, 'two project cards');
    const py = cards.find(c => /Python Platformer/.test(c.text));
    assert.ok(py, 'python project listed');
    assert.equal(py.href, '/workshops/python-platformer-canvas.html', 'resume links to the canvas');
    assert.ok(/1\/2 steps/.test(py.text), 'progress shown, got ' + py.text);
    // newest first
    assert.ok(/Python Platformer/.test(cards[0].text), 'newest project first');
    console.log('PASS My projects lists saved passports with resume links and progress');

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS my-progress-projects: saved projects surface on My Progress');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
