#!/usr/bin/env node
// tests/workshop-evidence.js (A2341)
//
// External-engine courses (Blender, Unity, Unreal, Roblox, Minecraft) cannot
// run in the browser, so finishing their steps is not proof that a learner made
// anything. Each course asks for one saved piece of evidence, keeps the tick in
// localStorage and shows it on the finish screen. No account, no upload.
//
// Run: node tests/workshop-evidence.js
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'content', 'workshop-completion.json');
const EXTERNAL = new Set(['Blender', 'Unity', 'Unreal', 'Roblox', 'Minecraft']);

let failures = 0;
const ok = (msg) => console.log('PASS ' + msg);
const fail = (msg) => { failures++; console.log('FAIL ' + msg); };
const check = (msg, cond) => (cond ? ok(msg) : fail(msg));
const page = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

if (!fs.existsSync(REGISTRY)) {
  fail('content/workshop-completion.json is missing (run node scripts/build-workshop-completion.js)');
  console.log('\nworkshop-evidence: FAIL (' + failures + ')');
  process.exit(1);
}
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

const external = registry.workshops.filter((w) => w.evidence && w.mode !== 'reference');
const wrongEngine = external.filter((w) => !EXTERNAL.has(w.evidence.engine));
check('every evidence course belongs to a known external engine (' + external.length + ')', wrongEngine.length === 0);
if (wrongEngine.length) console.log('  wrong: ' + wrongEngine.map((w) => w.id).join(', '));

const missingPrompt = external.filter((w) => !w.evidence.prompt || w.evidence.prompt.length < 30);
check('every evidence course names one concrete piece of evidence', missingPrompt.length === 0);

const externalModes = new Set(['engine', 'steps', 'builder']);
check('evidence courses are step or builder courses', external.every((w) => externalModes.has(w.mode)));

const missing = [];
const leaks = [];
for (const w of registry.workshops) {
  const html = page(w.page);
  if (w.evidence) {
    if (!html.includes('data-workshop-evidence="' + w.id + '"')) missing.push(w.id + ' (block)');
    else if (!html.includes(w.evidence.prompt)) missing.push(w.id + ' (prompt)');
    else if (!/workshop-evidence\.js/.test(html)) missing.push(w.id + ' (script)');
    else if (!/class="ws-evidence-check"/.test(html)) missing.push(w.id + ' (confirm control)');
  } else if (/data-workshop-evidence="/.test(html)) {
    leaks.push(w.id);
  }
}
check('every external-engine course carries the evidence step', missing.length === 0);
if (missing.length) console.log('  missing: ' + missing.join(', '));
check('no browser-runnable course grew an evidence step', leaks.length === 0);
if (leaks.length) console.log('  unexpected: ' + leaks.join(', '));

const engine = external.find((w) => w.mode === 'engine' && w.storageKey);
const builder = external.find((w) => w.mode === 'builder' && w.storageKey);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(err ? '' : data);
  });
});

(async () => {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { fail('puppeteer not installed'); return finish(); }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  try {
    if (!engine) throw new Error('no engine evidence course to test');
    const p = await browser.newPage();
    await p.goto(base + '/' + engine.page, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const total = await p.evaluate(() => window.WORKSHOP_TOTAL);
    await p.evaluate((key, t) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify({ completed: Array.from({ length: t }, (_, i) => i + 1), total: t }));
    }, engine.storageKey, total);
    await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });

    const state = await p.evaluate((id) => {
      const box = document.querySelector('[data-workshop-evidence="' + id + '"]');
      return {
        banner: document.getElementById('finishBanner').classList.contains('show'),
        box: !!box,
        visible: !!(box && box.getBoundingClientRect().height > 0),
        checked: !!(box && box.querySelector('[data-ws-evidence-check]').checked),
        upload: !!(box && box.querySelector('input[type="file"]')),
        stored: localStorage.getItem('jvds_workshop_evidence')
      };
    }, engine.id);
    check(engine.id + ': finish screen appears after every step', state.banner);
    check(engine.id + ': finish screen shows the evidence step', state.box && state.visible);
    check(engine.id + ': evidence starts unchecked and nothing is stored', !state.checked && !state.stored);
    check(engine.id + ': evidence asks for no upload', !state.upload);

    await p.click('[data-workshop-evidence="' + engine.id + '"] [data-ws-evidence-check]');
    const saved = await p.evaluate((id) => {
      const box = document.querySelector('[data-workshop-evidence="' + id + '"]');
      const raw = localStorage.getItem('jvds_workshop_evidence');
      const data = raw ? JSON.parse(raw) : {};
      return {
        checked: box.querySelector('[data-ws-evidence-check]').checked,
        record: data[id] || null,
        status: box.querySelector('[data-ws-evidence-status]').textContent,
        marked: box.classList.contains('is-saved')
      };
    }, engine.id);
    check(engine.id + ': confirming records the evidence locally', !!(saved.record && saved.record.confirmedAt));
    check(engine.id + ': finish screen reflects the saved evidence', /Evidence saved on/.test(saved.status) && saved.marked);

    await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });
    const restored = await p.evaluate((id) => {
      const box = document.querySelector('[data-workshop-evidence="' + id + '"]');
      return {
        checked: box.querySelector('[data-ws-evidence-check]').checked,
        status: box.querySelector('[data-ws-evidence-status]').textContent
      };
    }, engine.id);
    check(engine.id + ': saved evidence survives a reload', restored.checked && /Evidence saved on/.test(restored.status));

    await p.click('[data-workshop-evidence="' + engine.id + '"] [data-ws-evidence-check]');
    const cleared = await p.evaluate((id) => {
      const raw = localStorage.getItem('jvds_workshop_evidence');
      const data = raw ? JSON.parse(raw) : {};
      return { record: data[id] || null, status: document.querySelector('[data-workshop-evidence="' + id + '"] [data-ws-evidence-status]').textContent };
    }, engine.id);
    check(engine.id + ': unchecking removes the local record', !cleared.record && !/Evidence saved on/.test(cleared.status));
    await p.close();

    if (builder) {
      const b = await browser.newPage();
      const errors = [];
      b.on('pageerror', (e) => errors.push(e.message));
      await b.goto(base + '/' + builder.page, { waitUntil: 'load', timeout: 30000 });
      const info = await b.evaluate((id) => {
        const box = document.querySelector('[data-workshop-evidence="' + id + '"]');
        return { box: !!box, script: !!document.querySelector('script[src$="workshop-evidence.js"]'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, builder.id);
      check(builder.id + ': builder course carries the evidence step', info.box && info.script);
      check(builder.id + ': evidence step does not force horizontal scroll', info.overflow <= 2);
      const realErrs = errors.filter((m) => !/Content Security Policy|Failed to load resource|net::ERR/i.test(m));
      check(builder.id + ': no uncaught JS errors', realErrs.length === 0);
      await b.close();
    }
  } catch (e) {
    fail('browser run crashed: ' + String(e.message).slice(0, 200));
  }
  await browser.close();
  finish();
})();

function finish() {
  if (server && server.close) server.close();
  console.log(failures ? '\nworkshop-evidence: FAIL (' + failures + ')' : '\nworkshop-evidence: PASS');
  process.exit(failures ? 1 : 0);
}
