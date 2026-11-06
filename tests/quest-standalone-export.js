#!/usr/bin/env node
// tests/quest-standalone-export.js (A2579)
// Proves the Quest Builder exports one self-contained .html file:
//   - the button produces a real Blob under the documented size budget
//   - the file has no external src/href, stylesheet, import or image
//   - the file opens offline from disk and runs its test cases
//   - malformed input and unsafe briefing HTML fail safe
// Run: node tests/quest-standalone-export.js
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19274;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

function externalRefs(html) {
  const bad = [];
  if (/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i.test(html)) bad.push('absolute or protocol-relative src/href');
  if (/(?:src|href)\s*=\s*["']\/(?!\/)/i.test(html)) bad.push('root-relative src/href');
  if (/<link\b[^>]*rel=["']stylesheet/i.test(html)) bad.push('external stylesheet');
  if (/<script\b[^>]+\bsrc\s*=/i.test(html)) bad.push('external script');
  if (/<img\b[^>]+\bsrc\s*=/i.test(html)) bad.push('image src');
  if (/@import/i.test(html)) bad.push('css @import');
  if (/url\(\s*['"]?(?:https?:)?\/\//i.test(html)) bad.push('remote css url');
  return bad;
}

(async () => {
  await new Promise((r) => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  let tempFile = '';
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 900 });

    for (const vp of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.name === 'mobile', hasTouch: vp.name === 'mobile' });
      await page.goto('http://127.0.0.1:' + port + '/jvdesignstudio/tools/quest-builder.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 500));

      const wired = await page.evaluate(() => ({
        exporter: typeof window.QuestHtmlExport,
        button: !!document.getElementById('btn-export-standalone'),
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      }));
      check(vp.name + ': exporter module loads', wired.exporter === 'object', wired.exporter);
      check(vp.name + ': standalone export button is present', wired.button);
      check(vp.name + ': no horizontal overflow', wired.overflow <= 2, String(wired.overflow));
    }

    // Fill the builder and click the real button.
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:' + port + '/jvdesignstudio/tools/quest-builder.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => {
      const set = (id, value) => { document.getElementById(id).value = value; };
      set('f-id', 'node-601');
      set('f-title', 'The Variable Crystal');
      set('f-mascot', 'Lumo');
      set('f-xp', '75');
      set('f-prereqs', 'node-101');
      set('f-briefing', 'Lumo needs <code>add(a, b)</code> to return the sum.');
      set('f-starter', 'function add(a, b) { return a + b; }');
      const row = document.querySelector('.test-row');
      row.querySelector('.tc-desc').value = 'add(1, 2) returns 3';
      row.querySelector('.tc-assertion').value = 'add(1, 2) === 3';
      window.__exportBlob = null;
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function (blob) { window.__exportBlob = blob; return orig(blob); };
    });
    await page.click('#btn-export-standalone');
    const exported = await page.evaluate(async () => {
      const blob = window.__exportBlob;
      const html = blob ? await blob.text() : '';
      const status = document.getElementById('export-status');
      return { hasBlob: !!blob, bytes: blob ? blob.size : 0, html, status: status ? status.textContent : '', hidden: status ? status.hidden : null };
    });

    check('downloading creates a Blob', exported.hasBlob, exported.bytes + ' bytes');
    check('file stays under the size budget', exported.bytes > 0 && exported.bytes <= 120 * 1024, exported.bytes + ' bytes');
    check('status confirms the offline download', !exported.hidden && /\.html/.test(exported.status) && /offline/i.test(exported.status), exported.status);

    const html = exported.html;
    check('export carries the quest id', html.includes('node-601'));
    check('export carries the quest title', html.includes('The Variable Crystal'));
    check('export carries the mascot and XP', html.includes('Lumo') && html.includes('75 XP'));
    check('export carries the briefing with allowed code tags', html.includes('add(a, b)') && /<code>add\(a, b\)<\/code>/.test(html));
    check('export carries the test case', html.includes('add(1, 2) returns 3'));
    const badRefs = externalRefs(html);
    check('export has no external src, href, script, stylesheet or image', badRefs.length === 0, badRefs.join(', '));

    // Unsafe briefing markup must not survive.
    const unsafe = await page.evaluate(() => window.QuestHtmlExport.build({
      id: 'node-x', title: 'Unsafe <b>test</b>', briefing: 'hi <script>alert(1)<\/script>', initialCode: '', testCases: []
    }));
    check('unsafe briefing script is escaped', !/<script>alert\(1\)<\/script>/.test(unsafe));
    check('unsafe title is escaped', !/<b>test<\/b>/.test(unsafe.split('<body>')[0]));

    // Malformed input fails safe.
    const malformed = await page.evaluate(() => ({
      empty: window.QuestHtmlExport.build(null),
      noAssert: window.QuestHtmlExport.build({ testCases: [{ description: 'x', assertion: '' }] }),
      name: window.QuestHtmlExport.safeName({ id: '../../bad name!' })
    }));
    check('null node still builds a titled page', /Untitled Quest/.test(malformed.empty));
    check('incomplete test case is dropped', !malformed.noAssert.includes('>x<'));
    check('unsafe filename is normalised', /^quest-[a-z0-9_-]+\.html$/.test(malformed.name), malformed.name);

    // Open the exported file from disk with the network blocked.
    tempFile = path.join(os.tmpdir(), 'jvds-quest-export-' + process.pid + '.html');
    fs.writeFileSync(tempFile, html, 'utf8');
    const offline = await browser.newPage();
    const offlineErrors = [];
    offline.on('pageerror', (e) => offlineErrors.push(e.message));
    offline.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/ERR_FILE_NOT_FOUND|Failed to load resource|ERR_NETWORK_ACCESS_DENIED|ERR_ABORTED|favicon/i.test(t)) return;
      offlineErrors.push(t);
    });
    await offline.setRequestInterception(true);
    offline.on('request', (req) => {
      if (req.url().startsWith('file:')) req.continue();
      else req.abort();
    });
    for (const vp of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
      await offline.setViewport({ width: vp.w, height: vp.h, isMobile: vp.name === 'mobile', hasTouch: vp.name === 'mobile' });
      await offline.goto('file:///' + tempFile.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 30000 });
      await offline.click('#run');
      const state = await offline.evaluate(() => ({
        title: document.querySelector('h1') ? document.querySelector('h1').textContent : '',
        results: Array.from(document.querySelectorAll('#results li')).map((li) => li.textContent),
        passed: document.querySelectorAll('#results .pass').length,
        failed: document.querySelectorAll('#results .fail').length,
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      }));
      check(vp.name + ': exported page shows the quest title', /Variable Crystal/.test(state.title), state.title);
      check(vp.name + ': exported runner passes the bundled test', state.passed === 1 && state.failed === 0, state.results.join(' | '));
      check(vp.name + ': exported page has no overflow', state.overflow <= 2, String(state.overflow));
    }
    check('exported page runs with zero console errors', offlineErrors.length === 0, offlineErrors.slice(0, 2).join(' | '));
    check('builder page had zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    await offline.close();
  } finally {
    await browser.close();
    server.close();
    if (tempFile) { try { fs.unlinkSync(tempFile); } catch (e) {} }
  }

  if (failures) { console.log('\n' + failures + ' FAILED for quest standalone export'); process.exit(1); }
  console.log('\nPASS: quest standalone export');
})().catch((e) => { console.error(e); process.exit(1); });
