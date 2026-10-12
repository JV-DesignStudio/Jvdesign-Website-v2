// canvas-project-import.js - proves the A1386 Phase 3 import: a learner can open
// an exported jvds.project.json or the exported .zip on any canvas and their code
// comes back into the matching steps.
//
// Run: node tests/canvas-project-import.js
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), assert = require('assert/strict'), puppeteer = require('puppeteer');

// Minimal STORE zip writer, matching the entries the canvas engine emits.
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const u16 = v => Buffer.from([v & 0xFF, (v >> 8) & 0xFF]);
const u32 = v => Buffer.from([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]);
function zip(files) {
  const chunks = [], central = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), data = Buffer.from(f.text, 'utf8'), crc = crc32(data);
    const loc = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)]);
    chunks.push(loc, name, data);
    const cd = Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off)]);
    central.push(cd, name);
    off += loc.length + name.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdBuf.length), u32(off), u16(0)]);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}

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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jvds-import-'));
  const MARK = 'print("carriedMarker")';
  const passport = { format: 'jvds.project', version: 1, engine: 'Python', series: 'python-platformer', lesson: 1, title: 'Python Platformer Part 1', completed: ['1'], code: { '1': MARK }, steps: [{ num: 1, title: 'Player' }], next: 'python-platformer-part2-canvas.html' };
  const jsonPath = path.join(tmp, 'jvds.project.json');
  fs.writeFileSync(jsonPath, JSON.stringify(passport));
  const zipPath = path.join(tmp, 'my-project.zip');
  fs.writeFileSync(zipPath, zip([{ name: 'python-platformer/main.py', text: '# my code\n' }, { name: 'python-platformer/jvds.project.json', text: JSON.stringify(passport) }, { name: 'python-platformer/CONTINUE.md', text: 'continue' }]));
  const errors = [];
  async function loadPart2() {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', r => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
    await p.goto(base + '/workshops/python-platformer-part2-canvas.html', { waitUntil: 'load' });
    await p.evaluate(() => localStorage.clear());
    return p;
  }
  try {
    assert.ok(fs.existsSync(path.join(root, 'workshops/python-platformer-part2-canvas.html')), 'part 2 canvas exists');

    // JSON import
    let p = await loadPart2();
    assert.ok(await p.$('.cw-import-btn'), 'Open a saved project button present');
    await (await p.$('.cw-import-input')).uploadFile(jsonPath);
    await p.waitForFunction(() => /Brought/.test((document.querySelector('.cw-import-note') || {}).textContent || ''), { timeout: 5000 });
    assert.ok((await p.$eval('#editor-1', e => e.value)).includes('carriedMarker'), 'json import filled the editor');
    console.log('PASS import from jvds.project.json restores the code');
    await p.close();

    // ZIP import
    p = await loadPart2();
    await (await p.$('.cw-import-input')).uploadFile(zipPath);
    await p.waitForFunction(() => /Brought/.test((document.querySelector('.cw-import-note') || {}).textContent || ''), { timeout: 5000 });
    assert.ok((await p.$eval('#editor-1', e => e.value)).includes('carriedMarker'), 'zip import filled the editor');
    console.log('PASS import from my-project.zip restores the code');
    await p.close();

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS canvas-project-import: json and zip import bring the learner\'s work forward');
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
