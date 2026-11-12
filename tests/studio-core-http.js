#!/usr/bin/env node
/* Studio Core live smoke.
 *
 * Loads a real tool page with Puppeteer and exercises the shared layer:
 * the launcher, the drawer, share encode/decode, the quota estimate,
 * IndexedDB snapshots and the sandboxed preview.
 *
 * Run: node tests/studio-core-http.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

let failures = 0;
function check(name, ok, detail) {
  console.log('  ' + (ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|ERR_NETWORK_ACCESS_DENIED/.test(m.text())) {
        errors.push('console: ' + m.text());
      }
    });
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto('http://127.0.0.1:' + port + '/tools/code-snippet-generator.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#jvsStudioFab', { timeout: 8000 }).catch(() => {});

    const boot = await page.evaluate(() => ({
      core: !!(window.JVDSStudio && window.JVDSStudio.core),
      version: window.JVDSStudio ? window.JVDSStudio.version : '',
      tool: window.JVDSStudio ? window.JVDSStudio.tool : '',
      fab: !!document.getElementById('jvsStudioFab'),
      fabName: document.getElementById('jvsStudioFab') ? document.getElementById('jvsStudioFab').getAttribute('aria-label') : ''
    }));
    check('Studio Core boots', boot.core, boot.version);
    check('core knows the tool id', boot.tool === 'code-snippet-generator', boot.tool);
    check('launcher is present', boot.fab);
    check('launcher has an accessible name', boot.fabName === 'Open Studio tools', boot.fabName);

    const css = await page.evaluate(() => {
      const sheet = Array.prototype.slice.call(document.styleSheets).find((s) => s.href && s.href.indexOf('studio-core.css') !== -1);
      const fab = document.getElementById('jvsStudioFab');
      const style = fab ? getComputedStyle(fab) : null;
      return { found: !!sheet, rules: sheet ? sheet.cssRules.length : 0, position: style ? style.position : '' };
    });
    check('Studio Core stylesheet loads', css.found && css.rules > 40, css.rules + ' rules');
    check('launcher is fixed on screen', css.position === 'fixed', css.position);

    const roundtrip = await page.evaluate(async () => {
      const payload = { kind: 'jvds-studio-share', v: 1, saves: { jvds_test: 'hello studio' } };
      const encoded = await window.JVDSStudio.share.encode(payload);
      const decoded = await window.JVDSStudio.share.decode(encoded);
      return { encoded, decoded };
    });
    check('share state round-trips', roundtrip.decoded && roundtrip.decoded.saves.jvds_test === 'hello studio', roundtrip.encoded.slice(0, 12));

    const codeStyle = await page.evaluate(() => {
      const restyled = window.JVDSStudio.code.restyle('if (ok) {\n    go();\n}', { indent: '2' });
      const wrapped = window.JVDSStudio.code.wrap('go();', { wrapper: 'iife' });
      return { restyled: restyled, wrapped: wrapped };
    });
    check('code restyle converts indentation', codeStyle.restyled === 'if (ok) {\n  go();\n}', JSON.stringify(codeStyle.restyled));
    check('code wrapper adds a strict IIFE', /^\(function \(\) \{\n\s*'use strict';/.test(codeStyle.wrapped));

    const quota = await page.evaluate(async () => window.JVDSStudio.quota.estimate());
    check('quota estimate has a ratio', typeof quota.ratio === 'number', JSON.stringify({ usage: quota.usage, ratio: quota.ratio }));

    const drawer = await page.evaluate(async () => {
      window.JVDSStudio.panel.open();
      await new Promise((r) => setTimeout(r, 700));
      const sheet = document.querySelector('.jvs-sheet');
      return {
        open: sheet ? sheet.getAttribute('data-open') : '',
        title: sheet ? sheet.querySelector('.jvs-sheet-title').textContent : '',
        hasStorage: sheet ? /Keep your work/.test(sheet.textContent) : false,
        hasSettings: sheet ? /Settings/.test(sheet.textContent) : false
      };
    });
    check('drawer opens', drawer.open === 'true', drawer.title);
    check('drawer offers keep-your-work actions', drawer.hasStorage);
    check('drawer offers settings', drawer.hasSettings);

    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    check('drawer does not add sideways scrolling at 390', overflow.scroll <= overflow.client + 1, overflow.scroll + '/' + overflow.client);

    const snapshots = await page.evaluate(async () => {
      document.querySelector('.jvs-sheet .jvs-sheet-close').click();
      await new Promise((r) => setTimeout(r, 400));
      await window.JVDSStudio.storage.saveSnapshot({ label: 'Test snapshot', tool: 'test', saves: { jvds_test_snapshot: 'hello' }, keep: 3 });
      const rows = await window.JVDSStudio.storage.list();
      const first = rows[0] ? await window.JVDSStudio.storage.get(rows[0].id) : null;
      await window.JVDSStudio.storage.clear();
      return { rows: rows.length, label: first && first.label, value: first && first.saves ? first.saves.jvds_test_snapshot : '' };
    });
    check('IndexedDB snapshot saves and reads', snapshots.rows >= 1 && snapshots.value === 'hello', JSON.stringify(snapshots));

    const assets = await page.evaluate(async () => {
      await window.JVDSStudio.storage.putAsset('test.bin', new Blob(['hello asset'], { type: 'text/plain' }), { label: 'Test' });
      const one = await window.JVDSStudio.storage.getAsset('test.bin');
      const text = one && one.blob ? await one.blob.text() : '';
      const rows = await window.JVDSStudio.storage.listAssets();
      await window.JVDSStudio.storage.deleteAsset('test.bin');
      return { text: text, rows: rows.length };
    });
    check('IndexedDB asset store round-trips a blob', assets.text === 'hello asset' && assets.rows >= 1, JSON.stringify(assets));

    const bundle = await page.evaluate(async () => {
      localStorage.setItem('jvds_bundle_test', 'hello bundle');
      const name = await window.JVDSStudio.bundle.export();
      localStorage.removeItem('jvds_bundle_test');
      return name;
    });
    check('bundle export builds a .jvzip', /\.jvzip$/.test(bundle), bundle);

    const templates = await page.evaluate(async () => {
      const rows = await window.JVDSStudio.templates.list();
      return rows.length;
    });
    check('template catalogue loads', templates >= 6, String(templates));

    const worker = await page.evaluate(async () => window.JVDSStudio.worker.run('crunch', { text: '  hello   worker  ' }));
    check('worker helper runs off the main thread', worker === 'hello worker', worker);

    const inspector = await page.evaluate(async () => {
      const result = await window.JVDSStudio.inspector.run();
      const close = document.querySelector('.jvs-sheet .jvs-sheet-close');
      if (close) close.click();
      return { issues: result.issues.length, summary: result.summary };
    });
    check('accessibility inspector returns a report', typeof inspector.issues === 'number', inspector.summary);

    const snippetPreview = await page.evaluate(async () => {
      const btn = document.querySelector('.preview-btn');
      if (!btn) return { found: false };
      btn.click();
      await new Promise((r) => setTimeout(r, 700));
      const frame = document.querySelector('.jvs-modal iframe');
      const ok = !!frame;
      const status = document.querySelector('.jvs-modal .jvs-hint[role="status"]');
      const statusText = status ? status.textContent : '';
      const close = document.querySelector('.jvs-modal-head button');
      if (close) close.click();
      return { found: true, ok: ok, status: statusText };
    });
    check('Code Snippet Generator Preview button opens the sandbox', !snippetPreview.found || snippetPreview.ok, JSON.stringify(snippetPreview));
    check('preview sandbox starts and acknowledges the code', !snippetPreview.found || !/^Loading the sandbox/.test(snippetPreview.status), snippetPreview.status);

    const preview = await page.evaluate(async () => {
      const modal = await window.JVDSStudio.preview.open('document.body.dataset.ran="yes";', { type: 'js' });
      const frame = document.querySelector('.jvs-modal iframe');
      const ok = !!frame && frame.getAttribute('sandbox') === 'allow-scripts' && /preview-host\.html/.test(frame.getAttribute('src') || '');
      modal.close();
      return ok;
    });
    check('sandboxed preview iframe is created', preview);

    const realErrors = errors.filter((e) => !/content.security.policy/i.test(e));
    check('no page errors from the core', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\nStudio Core smoke: ' + failures + ' failure(s).');
    process.exit(1);
  }
  console.log('\nStudio Core smoke: all checks passed.');
})().catch((err) => {
  console.error('Harness error:', err);
  try { server.close(); } catch (e) {}
  process.exit(1);
});
