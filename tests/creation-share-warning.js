#!/usr/bin/env node
/* A1998: a learner must see who can open a share link before the link is
   created. This loads a real creator tool, stubs the clipboard, and checks:
     - pressing Share opens a warning dialog and does not share yet,
     - the dialog names the audience and the save / download / share difference,
     - Cancel and Escape create no link,
     - confirming creates the link exactly once. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const TOOL_PATH = '/tools/colour-palette.html';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function resolveFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (clean === '' || clean.endsWith('/')) clean += 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}

(async () => {
  const server = http.createServer((req, res) => {
    const file = resolveFile(req.url || '/');
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const failures = [];
  let browser;
  try {
    assert.ok(fs.existsSync(path.join(root, 'creation-share.js')), 'creation-share.js is missing');
    const source = fs.readFileSync(path.join(root, 'creation-share.js'), 'utf8');
    assert.match(source, /Anyone with this link may be able to see what you made/, 'warning copy is missing');
    assert.match(source, /full name, school, address or photos/, 'personal-details guidance is missing');
    assert.match(source, /Save on this device/, 'warning does not explain saving');
    assert.match(source, /Download/, 'warning does not explain downloading');
    assert.match(source, /Share by link/, 'warning does not explain share-by-link');
    assert.match(source, /JVDSShareWarning/, 'no warning hook for tools with their own share flow');
    assert.match(source, /guardClipboard/, 'toolbar copy links are not guarded');
    const maker = fs.readFileSync(path.join(root, 'tools', 'arcade-game-maker.html'), 'utf8');
    assert.equal((maker.match(/JVDSShareWarning\.confirm/g) || []).length >= 2, true, 'Arcade Game Maker share and remix links are not guarded');

    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 30000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      window.__sharedEvents = 0;
      window.__clipboard = [];
      window.addEventListener('jvds:shared', () => { window.__sharedEvents++; });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: text => { window.__clipboard.push(text); return Promise.resolve(); } }
      });
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    });
    await page.goto(base + TOOL_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#jvds-share-btn', { timeout: 15000 });

    // 1. Share opens the warning and creates nothing yet.
    await page.click('#jvds-share-btn');
    await page.waitForSelector('#jvds-share-warn', { timeout: 5000 });
    let state = await page.evaluate(() => ({
      text: document.getElementById('jvds-share-warn').innerText,
      role: document.getElementById('jvds-share-warn').getAttribute('role'),
      modal: document.getElementById('jvds-share-warn').getAttribute('aria-modal'),
      focus: (document.activeElement || {}).className,
      clip: window.__clipboard.length,
      events: window.__sharedEvents
    }));
    assert.equal(state.role, 'dialog', 'warning is not a dialog');
    assert.equal(state.modal, 'true', 'warning is not announced as modal');
    assert.match(state.text, /Anyone with this link may be able to see what you made/i);
    assert.match(state.text, /full name, school, address or photos/i);
    assert.match(state.text, /Save on this device[\s\S]*Download[\s\S]*Share by link/i);
    assert.equal(state.clip, 0, 'a share link was copied before the warning was answered');
    assert.equal(state.events, 0, 'the share event fired before the warning was answered');
    assert.match(String(state.focus), /jvds-share-warn-go/, 'the warning did not move focus to its action');
    console.log('PASS: Share opens a warning before any link is created');

    // 2. Cancel creates nothing.
    await page.click('.jvds-share-warn-cancel');
    await page.waitForFunction(() => !document.getElementById('jvds-share-warn'), { timeout: 5000 });
    state = await page.evaluate(() => ({ clip: window.__clipboard.length, events: window.__sharedEvents }));
    assert.equal(state.clip, 0, 'Cancel still copied a share link');
    assert.equal(state.events, 0, 'Cancel still counted a share');
    console.log('PASS: Cancel creates no link');

    // 3. Escape creates nothing.
    await page.click('#jvds-share-btn');
    await page.waitForSelector('#jvds-share-warn', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('jvds-share-warn'), { timeout: 5000 });
    state = await page.evaluate(() => ({ clip: window.__clipboard.length, events: window.__sharedEvents }));
    assert.equal(state.clip, 0, 'Escape still copied a share link');
    assert.equal(state.events, 0, 'Escape still counted a share');
    console.log('PASS: Escape creates no link');

    // 4. Confirming creates the link once.
    await page.click('#jvds-share-btn');
    await page.waitForSelector('#jvds-share-warn', { timeout: 5000 });
    await page.click('.jvds-share-warn-go');
    await page.waitForFunction(() => window.__clipboard.length === 1, { timeout: 5000 });
    state = await page.evaluate(() => ({
      clip: window.__clipboard,
      events: window.__sharedEvents,
      dialogGone: !document.getElementById('jvds-share-warn')
    }));
    assert.equal(state.clip.length, 1, 'confirming did not create exactly one share link');
    assert.match(state.clip[0], /jvdesignstudio\.co\.uk/, 'the share link is not a JVDS link');
    assert.equal(state.events, 1, 'confirming did not count exactly one share');
    assert.equal(state.dialogGone, true, 'the warning stayed open after confirming');
    console.log('PASS: confirming creates the link exactly once');

    // 5. A tool's own toolbar share button goes through the same warning: the
    // guard wraps clipboard copies of links that carry creation data.
    await page.goto(base + '/tools/sprite-animator.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.JVDSShareWarning && window.JVDSShareWarning.confirm), { timeout: 20000 });
    const payloadLink = base + '/tools/sprite-animator.html#sprite=' + 'AbC'.repeat(20);
    await page.evaluate(link => { window.__clipboard.length = 0; navigator.clipboard.writeText(link); }, payloadLink);
    await page.waitForSelector('#jvds-share-warn', { timeout: 5000 });
    let toolbar = await page.evaluate(() => ({ clip: window.__clipboard.length }));
    assert.equal(toolbar.clip, 0, 'toolbar share copied a link before the warning was answered');
    await page.evaluate(() => document.querySelector('.jvds-share-warn-cancel').click());
    await page.waitForFunction(() => !document.getElementById('jvds-share-warn'), { timeout: 5000 });
    toolbar = await page.evaluate(() => ({ clip: window.__clipboard.length }));
    assert.equal(toolbar.clip, 0, 'cancel still copied a toolbar share link');

    await page.evaluate(link => { navigator.clipboard.writeText(link); }, payloadLink);
    await page.waitForSelector('#jvds-share-warn', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('.jvds-share-warn-go').click());
    await page.waitForFunction(() => window.__clipboard.length === 1, { timeout: 5000 });
    toolbar = await page.evaluate(() => ({ clip: window.__clipboard }));
    assert.equal(toolbar.clip[0], payloadLink, 'confirming a toolbar share did not copy the creation link');

    // A non-link copy (a colour, a code) must not be interrupted.
    await page.evaluate(() => { window.__clipboard.length = 0; navigator.clipboard.writeText('#70A3A7'); });
    await page.waitForFunction(() => window.__clipboard.length === 1, { timeout: 5000 });
    assert.equal(await page.evaluate(() => !!document.getElementById('jvds-share-warn')), false, 'a plain colour copy was blocked');
    console.log('PASS: a toolbar share link is blocked until the warning is confirmed, plain copies pass');
  } catch (err) {
    failures.push(err.stack || err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('creation share warning test failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log('creation share warning test passed.');
})();
