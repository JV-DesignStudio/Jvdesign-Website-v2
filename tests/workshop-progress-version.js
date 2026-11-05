#!/usr/bin/env node
// tests/workshop-progress-version.js (A2304)
// Saved code and completed steps are keyed by step number. If a course inserts
// or renumbers a step, a returning learner's work must not land on the wrong
// step. Both workshop engines now record a version and either migrate the save
// (CFG.migrations / window.WORKSHOP_MIGRATIONS) or reset it with a clear note.
// This test drives a canvas workshop and a non-canvas workshop through:
//   - same version: saved work is kept
//   - version bump with no migration: old work is not applied, a note is shown
//   - version bump with a migration: work is remapped on purpose
//
// Run: node tests/workshop-progress-version.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

const CANVAS_CONFIG = '/assets/js/inline/workshops-js-snake-workshop-2.js';
let canvasVersion = null;
let canvasMigration = null;
let cyberVersion = null;

function patchCanvasConfig(src) {
  if (canvasVersion == null && !canvasMigration) return src;
  let extra = '';
  if (canvasVersion != null) extra += 'version: ' + canvasVersion + ',';
  if (canvasMigration) extra += 'migrations: { 1: ' + canvasMigration + ' },';
  if (!/storageKey:/.test(src)) return src;
  return src.replace(/(storageKey:\s*'[^']*',)/, '$1\n  ' + extra);
}

function patchCyberHtml(src) {
  if (cyberVersion == null) return src;
  return src.replace('<body data-workshop-key=', '<body data-workshop-version="' + cyberVersion + '" data-workshop-key=');
}

(async () => {
  let failures = 0;
  const check = (name, ok, detail = '') => {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' -- ' + detail : ''));
    if (!ok) failures++;
  };

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.resolve(ROOT, '.' + url);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); return res.end(); }
      let body = data;
      const type = MIME[path.extname(file)] || 'application/octet-stream';
      if (url === CANVAS_CONFIG) body = Buffer.from(patchCanvasConfig(data.toString('utf8')));
      else if (url === '/workshops/cyber-security.html') body = Buffer.from(patchCyberHtml(data.toString('utf8')));
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    });
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    /* ---------- canvas engine ---------- */
    await page.goto(base + '/workshops/js-snake-workshop.html', { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));

    const key = await page.evaluate(() => window.CW_CONFIG.storageKey);

    // Same version: a returning learner keeps their completed code.
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
      version: 1,
      currentStep: 0,
      completed: { 1: "var savedMarker = 'SAME';" },
      codes: { 1: "var savedMarker = 'SAME';" }
    })), key);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));
    const kept = await page.evaluate(() => ({
      code: (document.getElementById('editor-1') || {}).value || '',
      note: !!document.querySelector('.cw-version-note')
    }));
    check('same version keeps saved code', /SAME/.test(kept.code), JSON.stringify(kept.code));
    check('same version shows no reset note', !kept.note);

    // Version bump with no migration: old code must not be applied anywhere.
    canvasVersion = 2;
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
      version: 1,
      currentStep: 0,
      completed: { 1: "var savedMarker = 'OLD';" },
      codes: { 1: "var savedMarker = 'OLD';" }
    })), key);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));
    const bumped = await page.evaluate(() => {
      const values = Array.from(document.querySelectorAll('.cw-editor')).map((e) => e.value);
      return {
        anyOld: values.some((v) => /OLD/.test(v)),
        note: (document.querySelector('.cw-version-note') || {}).textContent || '',
        stored: localStorage.getItem(window.CW_CONFIG.storageKey) || ''
      };
    });
    check('version bump without migration drops old code', !bumped.anyOld, JSON.stringify(bumped.anyOld));
    check('version bump shows a clear reset note', /updated since your last visit/i.test(bumped.note), bumped.note);
    check('reset save no longer holds the old code', !/OLD/.test(bumped.stored));

    // The reset note must read at phone width without sideways scroll.
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
      version: 1, currentStep: 0, completed: {}, codes: {}
    })), key);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));
    const mobile = await page.evaluate(() => ({
      note: !!document.querySelector('.cw-version-note'),
      overflow: document.documentElement.scrollWidth <= window.innerWidth + 1
    }));
    check('reset note fits at 390px', mobile.note && mobile.overflow, JSON.stringify(mobile));

    // Version bump with a migration: the old save is remapped on purpose.
    canvasMigration = "function(s){ s.version = 2; s.currentStep = 0; s.completed = {}; s.codes = { 2: \"var savedMarker = 'MOVED';\" }; return s; }";
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
      version: 1,
      currentStep: 0,
      completed: { 1: "var savedMarker = 'OLD';" },
      codes: { 1: "var savedMarker = 'OLD';" }
    })), key);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));
    const migrated = await page.evaluate(() => ({
      stepTwo: (document.getElementById('editor-2') || {}).value || '',
      note: !!document.querySelector('.cw-version-note')
    }));
    check('migration moves saved code to the mapped step', /MOVED/.test(migrated.stepTwo), JSON.stringify(migrated.stepTwo));
    check('migration does not show a reset note', !migrated.note);

    /* ---------- non-canvas engine ---------- */
    canvasVersion = null;
    canvasMigration = null;
    await page.goto(base + '/workshops/cyber-security.html', { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 500));
    const cyberKey = await page.evaluate(() => (document.body.dataset.workshopKey) || 'jvds-cyber-security-v2');

    cyberVersion = 2;
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
      version: 1, completed: [1, 2], xp: 40
    })), cyberKey);
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 500));
    const cyberReset = await page.evaluate((k) => ({
      cleared: localStorage.getItem(k) == null,
      note: (document.querySelector('.ws-version-note') || {}).textContent || ''
    }), cyberKey);
    check('non-canvas version bump clears misaligned progress', cyberReset.cleared);
    check('non-canvas version bump shows a clear reset note', /updated since your last visit/i.test(cyberReset.note), cyberReset.note);

    // Non-canvas migration is read from window.WORKSHOP_MIGRATIONS.
    await page.evaluateOnNewDocument(() => {
      window.WORKSHOP_MIGRATIONS = {
        1: function (data) { data.version = 2; data.completed = [1]; data.xp = 20; return data; }
      };
    });
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
      version: 1, completed: [1, 2], xp: 40
    })), cyberKey);
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 500));
    const cyberMigrated = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return { raw: raw || '', note: !!document.querySelector('.ws-version-note') };
    }, cyberKey);
    let state = {};
    try { state = JSON.parse(cyberMigrated.raw); } catch (e) {}
    check('non-canvas migration keeps the remapped save', state.version === 2 && Array.isArray(state.completed) && state.completed.length === 1,
      JSON.stringify(state.completed));
    check('non-canvas migration does not show a reset note', !cyberMigrated.note);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: workshop progress keeps, resets and migrates by course version');
})().catch((e) => { console.error(e); process.exit(1); });
