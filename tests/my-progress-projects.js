// my-progress-projects.js - proves the A1397/A1399 My projects list: passports
// saved on the device show up on My Progress with a Resume link, a last-worked
// date, and a Delete that clears both the passport and the canvas save.
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

    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 200));
    assert.ok((await page.$eval('#myProjectsList', e => e.textContent)).includes('No projects yet'), 'empty state shows');

    await page.evaluate(() => {
      localStorage.setItem('jvds.project.cpp-platformer.l2', JSON.stringify({ format: 'jvds.project', version: 1, engine: 'C++', series: 'cpp-platformer', lesson: 2, title: 'C++ Platformer Part 2', page: '/workshops/cpp-platformer-part2-canvas.html', storageKey: 'jvds-cpp-platformer-p2-canvas', updated: '2026-10-10T10:00:00Z', completed: ['1', '2'], steps: [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }] }));
      localStorage.setItem('jvds.project.python-platformer.l1', JSON.stringify({ format: 'jvds.project', version: 1, engine: 'Python', series: 'python-platformer', lesson: 1, title: 'Python Platformer', page: '/workshops/python-platformer-canvas.html', storageKey: 'jvds-python-platformer-canvas', updated: '2026-10-12T11:00:00Z', completed: ['1'], steps: [{ num: 1 }, { num: 2 }] }));
      localStorage.setItem('jvds-cpp-platformer-p2-canvas', JSON.stringify({ codes: { 1: 'x' } }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#myProjectsList .mp-card').length === 2, { timeout: 5000 });

    const cards = await page.$$eval('#myProjectsList .mp-open', els => els.map(e => ({ href: e.getAttribute('href'), text: e.textContent })));
    assert.equal(cards.length, 2, 'two project cards');
    const py = cards.find(c => /Python Platformer/.test(c.text));
    assert.ok(py, 'python project listed');
    assert.equal(py.href, '/workshops/python-platformer-canvas.html', 'resume links to the canvas');
    assert.ok(/1\/2 steps/.test(py.text), 'progress shown, got ' + py.text);
    assert.ok(/2026/.test(py.text), 'last-worked date shown, got ' + py.text);
    assert.ok(/Python Platformer/.test(cards[0].text), 'newest project first (this is the date ordering check string)');
    console.log('PASS My projects shows resume link, progress and date');

    // Delete the older (C++) project and confirm both keys clear.
    page.on('dialog', d => d.accept());
    await page.click('#myProjectsList .mp-card:nth-child(2) .mp-del');
    await page.waitForFunction(() => document.querySelectorAll('#myProjectsList .mp-card').length === 1, { timeout: 5000 });
    const after = await page.evaluate(() => ({ passport: localStorage.getItem('jvds.project.cpp-platformer.l2'), state: localStorage.getItem('jvds-cpp-platformer-p2-canvas') }));
    assert.equal(after.passport, null, 'deleted passport removed');
    assert.equal(after.state, null, 'deleted canvas save removed');
    console.log('PASS Delete clears the passport and the canvas save');

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS my-progress-projects: saved projects surface on My Progress');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
