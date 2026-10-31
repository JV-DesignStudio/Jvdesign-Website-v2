#!/usr/bin/env node
// tests/workshop-gradual-release.js (A2029)
//
// Copying the reference solution proves the code runs, not that the learner
// understands it. Every tutorial must show the five gradual-release moves:
// See it, Understand it, Build it, Fix it, Own it.
//
// Static: registry complete, five stages present and in order, links resolve,
// the "Own it" move asks for a real change, reference solution named as support.
// Browser: the panel is visible on an engine workshop and its first link moves
// the learner to the build.
//
// Run: node tests/workshop-gradual-release.js
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshop-gradual-release.json');
const REGISTRY = path.join(ROOT, 'content', 'workshop-completion.json');
const DEBUGGING = path.join(ROOT, 'content', 'workshop-debugging.json');

let failures = 0;
const check = (msg, cond) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) failures++;
};

if (!fs.existsSync(DATA)) {
  console.log('FAIL content/workshop-gradual-release.json missing (run node scripts/build-workshop-gradual-release.js)');
  console.log('\nworkshop-gradual-release: FAIL (1)');
  process.exit(1);
}

const release = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const completion = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const debugging = JSON.parse(fs.readFileSync(DEBUGGING, 'utf8'));
const tutorials = completion.workshops.filter((w) => w.mode !== 'reference');
const byId = {};
release.workshops.forEach((w) => { byId[w.id] = w; });

const missing = tutorials.filter((t) => !byId[t.id]).map((t) => t.id);
check('release registry covers every tutorial (' + tutorials.length + ')', missing.length === 0);
if (missing.length) console.log('  missing: ' + missing.join(', '));

const STAGES = ['see', 'understand', 'build', 'fix', 'own'];

function pageSource(file) {
  let all = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let m;
  const re = /\/assets\/js\/inline\/([A-Za-z0-9._-]+\.js)/g;
  while ((m = re.exec(all))) {
    try { all += '\n' + fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', m[1]), 'utf8'); } catch (e) {}
  }
  return all;
}

function anchorExists(html, id) {
  return new RegExp('id="' + id + '"').test(html) || new RegExp("id='" + id + "'").test(html);
}

function linkResolves(entry, url, html) {
  if (!url) return true;
  if (url.startsWith('#')) return anchorExists(html, url.slice(1));
  if (/^https?:/i.test(url)) return true;
  const target = path.join(ROOT, path.dirname(entry.page), url.split('#')[0]);
  return fs.existsSync(target);
}

let stageProblems = [];
let blockProblems = [];
let linkProblems = [];
let dashes = [];
let fixProblems = [];

for (const entry of release.workshops) {
  const keys = Object.keys(entry.stages || {});
  if (STAGES.some((s) => !entry.stages || !entry.stages[s])) { stageProblems.push(entry.id + ' (missing stage)'); continue; }
  if (keys.length !== STAGES.length) stageProblems.push(entry.id + ' (extra stage)');
  if (STAGES.some((s) => String(entry.stages[s].text || '').length < 40)) stageProblems.push(entry.id + ' (thin stage text)');
  if (!String(entry.stages.own.text || '').includes(entry.extend)) stageProblems.push(entry.id + ' (own it ignores extension)');

  const html = pageSource(entry.page);
  const start = html.indexOf('<!-- WS-RELEASE:START -->');
  const end = html.indexOf('<!-- WS-RELEASE:END -->');
  const outcomeEnd = html.indexOf('<!-- WS-OUTCOME:END -->');
  if (start < 0 || end < start) { blockProblems.push(entry.id + ' (no block)'); continue; }
  if (!(start > outcomeEnd && outcomeEnd >= 0)) blockProblems.push(entry.id + ' (block not after outcome)');

  const body = html.slice(start, end);
  const order = STAGES.map((s) => body.indexOf('data-stage="' + s + '"'));
  if (order.some((i) => i < 0)) blockProblems.push(entry.id + ' (stage missing in page)');
  else if (order.some((v, i) => i > 0 && v < order[i - 1])) blockProblems.push(entry.id + ' (stages out of order)');
  if (!/reference solution/i.test(body)) blockProblems.push(entry.id + ' (reference solution not framed as support)');
  if (/\u2014/.test(body)) dashes.push(entry.id);

  const hrefs = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  hrefs.forEach((href) => { if (!linkResolves(entry, href, html)) linkProblems.push(entry.id + ' -> ' + href); });

  const fix = entry.stages.fix;
  if (fix.url) {
    const debugPages = debugging.map((d) => d.page);
    if (!debugPages.some((p) => fix.url.startsWith(path.basename(p)))) fixProblems.push(entry.id + ' (fix link is not a Debug It page)');
  }
}

check('every tutorial defines all five moves', stageProblems.length === 0);
if (stageProblems.length) console.log('  ' + stageProblems.slice(0, 10).join(', '));
check('every page carries the block after the outcome statement', blockProblems.length === 0);
if (blockProblems.length) console.log('  ' + blockProblems.slice(0, 10).join(', '));
check('every release link points at a real anchor or page', linkProblems.length === 0);
if (linkProblems.length) console.log('  ' + linkProblems.slice(0, 10).join(', '));
check('Fix It links only to a stamped Debug It task', fixProblems.length === 0);
if (fixProblems.length) console.log('  ' + fixProblems.slice(0, 10).join(', '));
check('no em-dashes in generated copy', dashes.length === 0);
if (dashes.length) console.log('  ' + dashes.slice(0, 10).join(', '));

// ---------- browser: the panel is visible and usable ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/') || p.endsWith(path.sep)) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { check('puppeteer installed', false); return finish(); }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  try {
    const engineEntry = release.workshops.find((w) => w.mode === 'engine' && w.stages.see.url);
    const canvasEntry = release.workshops.find((w) => w.mode === 'canvas');
    for (const entry of [engineEntry, canvasEntry]) {
      if (!entry) { check('found a workshop to render', false); continue; }
      const p = await browser.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(base + '/' + entry.page, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const panel = await p.evaluate(() => {
        const box = document.querySelector('.ws-release');
        if (!box) return null;
        const stages = [...box.querySelectorAll('.ws-release-stage')].map((li) => li.getAttribute('data-stage'));
        const r = box.getBoundingClientRect();
        return { stages, visible: r.width > 0 && r.height > 0, text: box.innerText.length };
      });
      check(entry.id + ': release panel renders with five stages', !!panel && panel.visible && panel.stages.join(',') === STAGES.join(','));
      check(entry.id + ': release copy is readable', !!panel && panel.text > 300);

      if (entry.stages.see.url && entry.stages.see.url.startsWith('#')) {
        await p.evaluate(() => {
          const link = document.querySelector('.ws-release-stage[data-stage="see"] a');
          if (link) link.click();
        });
        const hash = await p.evaluate(() => location.hash);
        check(entry.id + ': See it link moves to the build', hash === entry.stages.see.url);
      }
      const real = errors.filter((m) => !/Content Security Policy|Failed to load resource|net::ERR/i.test(m));
      check(entry.id + ': no uncaught JS errors', real.length === 0);
      await p.close();
    }
  } catch (e) {
    check('browser run completed', false);
    console.log('  ' + String(e.message).slice(0, 180));
  }
  await browser.close();
  finish();
})();

function finish() {
  server.close();
  console.log(failures ? '\nworkshop-gradual-release: FAIL (' + failures + ')' : '\nworkshop-gradual-release: PASS');
  process.exit(failures ? 1 : 0);
}
