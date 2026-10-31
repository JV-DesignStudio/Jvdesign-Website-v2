#!/usr/bin/env node
// tests/workshop-completion.js (A2037)
//
// Every published workshop needs three things a learner can rely on:
//   1. a defined completion condition,
//   2. a finish screen that appears only when that condition is met,
//   3. a working next-step link.
// and progress has to survive a reload.
//
// Static checks read content/workshop-completion.json and the pages.
// Browser checks load one engine workshop and one canvas workshop, seed
// partial and complete progress, reload and confirm the state is restored.
//
// Run: node tests/workshop-completion.js
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'content', 'workshop-completion.json');
const OUTCOMES = path.join(ROOT, 'content', 'workshop-outcomes.json');

let failures = 0;
const ok = (msg) => console.log('PASS ' + msg);
const fail = (msg) => { failures++; console.log('FAIL ' + msg); };
const check = (msg, cond) => (cond ? ok(msg) : fail(msg));

const page = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------- static contract ----------
if (!fs.existsSync(REGISTRY)) {
  fail('content/workshop-completion.json is missing (run node scripts/build-workshop-completion.js)');
  console.log('\nworkshop-completion: FAIL (' + failures + ')');
  process.exit(1);
}
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const outcomes = JSON.parse(fs.readFileSync(OUTCOMES, 'utf8'));
const byId = {};
registry.workshops.forEach((w) => { byId[w.id] = w; });

const wanted = outcomes.filter((e) => ['workshop', 'builder', 'series', 'series-hub'].includes(e.kind));
const missing = wanted.filter((e) => !byId[e.id]).map((e) => e.id);
check('registry covers every published workshop (' + wanted.length + ')', missing.length === 0);
if (missing.length) console.log('  missing: ' + missing.slice(0, 12).join(', '));

const MODES = new Set(['engine', 'canvas', 'steps', 'builder', 'reference']);
const badMode = registry.workshops.filter((w) => !MODES.has(w.mode));
check('every registry entry has a known mode', badMode.length === 0);

const tracked = registry.workshops.filter((w) => w.mode !== 'reference');
check('every tutorial declares a completion condition (' + tracked.length + ')', tracked.every((w) => w.condition && w.condition !== 'none' && String(w.conditionText || '').length >= 20));
check('every tutorial declares a finish screen selector', tracked.every((w) => w.finishSelector));
check('every tutorial declares a next step', tracked.every((w) => w.next && w.next.url && w.next.label));

const keys = {};
const trackedNoKey = [];
tracked.forEach((w) => {
  if (w.mode === 'builder') return;
  if (!w.storageKey) trackedNoKey.push(w.id);
  else (keys[w.storageKey] = keys[w.storageKey] || []).push(w.id);
});
check('every step-tracked workshop declares a storage key', trackedNoKey.length === 0);
if (trackedNoKey.length) console.log('  no key: ' + trackedNoKey.join(', '));
const shared = Object.keys(keys).filter((k) => keys[k].length > 1);
check('no two workshops share a storage key', shared.length === 0);
if (shared.length) shared.forEach((k) => console.log('  ' + k + ': ' + keys[k].join(', ')));

function nextTargetExists(entry) {
  const url = entry.next.url.split('#')[0].split('?')[0];
  if (/^https?:/i.test(url)) return true;
  const candidates = [];
  if (url.startsWith('/workshops/')) candidates.push(path.join(ROOT, url.replace(/^\//, '')));
  else if (url.startsWith('../')) candidates.push(path.join(ROOT, path.dirname(entry.page), url));
  else if (url.startsWith('/')) candidates.push(path.join(ROOT, url.replace(/^\//, '')));
  else candidates.push(path.join(ROOT, 'workshops', url));
  /* GitHub Pages serves /workshop from workshop.html and /foo/ from
     foo/index.html, so accept both pretty forms too. */
  const first = candidates[0];
  candidates.push(first + '.html', path.join(first, 'index.html'));
  return candidates.some((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}

const dotted = [];
for (const w of tracked) {
  const html = page(w.page);
  if (w.mode === 'engine' || w.mode === 'steps') {
    const banner = html.match(/<div[^>]*id=["']finishBanner["'][^>]*>/i);
    if (!banner) { fail(w.id + ': no #finishBanner'); continue; }
    const start = html.indexOf('<!-- WS-FINISH:START -->');
    const open = banner.index;
    const bannerEnd = html.indexOf('</div>', open);
    check(w.id + ': finish condition sits inside the finish banner', start > open);
    const block = html.slice(start, html.indexOf('<!-- WS-FINISH:END -->'));
    if (!/class="ws-finish-next"[^>]*href="([^"]+)"/.test(block)) fail(w.id + ': finish block has no next link');
    else if (!block.includes('Finished when:')) fail(w.id + ': finish block has no condition sentence');
    if (!nextTargetExists(w)) dotted.push(w.id + ' -> ' + w.next.url);
    void bannerEnd;
  } else if (w.mode === 'builder') {
    const where = w.hasFinishBanner ? 'finish banner' : 'closing finish line';
    if (w.hasFinishBanner) {
      if (!/id=["']finishBanner["']/.test(html)) fail(w.id + ': no #finishBanner');
      else if (!/WS-FINISH:START/.test(html)) fail(w.id + ': no finish condition in the banner');
    } else if (!/id="wsFinish"/.test(html)) fail(w.id + ': no #wsFinish closing finish line');
    if (!/class="ws-finish-next"[^>]*href="([^"]+)"/.test(html)) fail(w.id + ': ' + where + ' has no next link');
    if (!nextTargetExists(w)) dotted.push(w.id + ' -> ' + w.next.url);
  } else if (w.mode === 'canvas') {
    check(w.id + ': canvas page loads the canvas engine', /workshop-canvas-engine\.js/.test(html));
  }
}
check('every finish link points at a real page', dotted.length === 0);
if (dotted.length) console.log('  broken: ' + dotted.join(', '));

check('canvas engine ships a finish box with a next link', /cw-remix/.test(page('workshop-canvas-engine.js')) && /See this in My Studio|Next:/.test(page('workshop-canvas-engine.js')));
check('engine finish banner does not double up the next link', /ws-finish-next/.test(page('workshops/workshop-engine.js')));

// ---------- browser: progress saves and restores ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith(path.sep) || p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { fail('puppeteer not installed'); return finish(); }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const engine = registry.workshops.find((w) => w.mode === 'engine' && w.storageKey);
  const steps = registry.workshops.find((w) => w.mode === 'steps' && w.storageKey);
  const canvas = registry.workshops.find((w) => w.mode === 'canvas' && w.storageKey);

  try {
    if (engine) {
      const url = base + '/' + engine.page;
      const p = await browser.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const total = await p.evaluate(() => window.WORKSHOP_TOTAL);
      check(engine.id + ': declares a step total', Number.isInteger(total) && total > 0);

      await p.evaluate((key, t) => {
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify({ completed: [1], total: t, xp: 0 }));
      }, engine.storageKey, total);
      await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });
      const partial = await p.evaluate(() => ({
        done: document.querySelectorAll('#step-1.completed').length,
        rest: document.querySelectorAll('.step-card.completed').length,
        banner: document.getElementById('finishBanner').classList.contains('show')
      }));
      check(engine.id + ': one saved step restores as completed', partial.done === 1 && partial.rest === 1);
      check(engine.id + ': finish banner stays hidden while steps remain', partial.banner === false);

      await p.evaluate((key, t) => {
        const all = Array.from({ length: t }, (_, i) => i + 1);
        localStorage.setItem(key, JSON.stringify({ completed: all, total: t, xp: t * 20 }));
      }, engine.storageKey, total);
      await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });
      const full = await p.evaluate(() => {
        const banner = document.getElementById('finishBanner');
        const link = banner && banner.querySelector('.ws-finish-next');
        const shown = !!(banner && banner.classList.contains('show'));
        const visible = !!(link && link.getBoundingClientRect().width > 0 && link.getBoundingClientRect().height > 0);
        return { shown, visible, href: link ? link.getAttribute('href') : null };
      });
      check(engine.id + ': all steps completed shows the finish screen', full.shown);
      check(engine.id + ': finish screen offers a visible next step', full.visible && !!full.href);

      const realErrs = errors.filter((m) => !/Content Security Policy|Failed to load resource|net::ERR/i.test(m));
      check(engine.id + ': no uncaught JS errors', realErrs.length === 0);
      if (realErrs.length) console.log('  ' + realErrs.slice(0, 2).join(' | '));
      await p.close();
    } else {
      fail('no engine workshop with a storage key to test');
    }

    if (steps) {
      const url = base + '/' + steps.page;
      const p = await browser.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const total = await p.evaluate(() => document.querySelectorAll('.step-card').length);
      check(steps.id + ': declares step cards', total > 1);

      await p.evaluate((key, t) => {
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify({ completed: [1], total: t, xp: 0 }));
      }, steps.storageKey, total);
      await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });
      const partial = await p.evaluate(() => ({
        done: document.querySelectorAll('#step-1.completed').length,
        rest: document.querySelectorAll('.step-card.completed').length,
        banner: document.getElementById('finishBanner').classList.contains('show')
      }));
      check(steps.id + ': one saved step restores as completed', partial.done === 1 && partial.rest === 1);
      check(steps.id + ': finish banner stays hidden while steps remain', partial.banner === false);

      await p.evaluate((key, t) => {
        const all = Array.from({ length: t }, (_, i) => i + 1);
        localStorage.setItem(key, JSON.stringify({ completed: all, total: t, xp: t * 20 }));
      }, steps.storageKey, total);
      await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });
      const full = await p.evaluate(() => {
        const banner = document.getElementById('finishBanner');
        const link = banner && banner.querySelector('.ws-finish-next');
        return {
          shown: !!(banner && banner.classList.contains('show')),
          visible: !!(link && link.getBoundingClientRect().height > 0),
          href: link ? link.getAttribute('href') : null
        };
      });
      check(steps.id + ': all steps completed shows the finish screen', full.shown);
      check(steps.id + ': finish screen offers a visible next step', full.visible && !!full.href);
      await p.close();
    } else {
      fail('no step workshop with a storage key to test');
    }

    if (canvas) {
      const url = base + '/' + canvas.page;
      const p = await browser.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const nums = await p.evaluate(() => (window.CW_CONFIG && window.CW_CONFIG.steps || []).map((s) => s.num));
      check(canvas.id + ': canvas config declares build steps', Array.isArray(nums) && nums.length > 1);
      if (Array.isArray(nums) && nums.length) {
        const saved = nums.slice(1, 3);
        await p.evaluate((key, list) => {
          localStorage.clear();
          const completed = {};
          const codes = {};
          list.forEach((n) => { completed[n] = 'saved code'; codes[n] = 'saved code'; });
          localStorage.setItem(key, JSON.stringify({ currentStep: 0, completed: completed, codes: codes }));
        }, canvas.storageKey, saved);
        await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });
        const restored = await p.evaluate(() => document.querySelectorAll('.cw-step.completed').length);
        check(canvas.id + ': saved build steps restore after reload', restored === saved.length);

        await p.evaluate((key, list) => {
          const completed = {};
          const codes = {};
          list.forEach((n) => { completed[n] = 'saved code'; codes[n] = 'saved code'; });
          localStorage.setItem(key, JSON.stringify({ currentStep: 0, completed: completed, codes: codes }));
        }, canvas.storageKey, nums);
        await p.reload({ waitUntil: 'networkidle0', timeout: 30000 });
        const remix = await p.evaluate(() => {
          const box = document.querySelector('.cw-remix');
          return box ? { exists: true, link: !!box.querySelector('a') } : { exists: false, link: false };
        });
        check(canvas.id + ': completing every build step offers the finish box', remix.exists);
        check(canvas.id + ': finish box has a working next link', remix.link);
      }
      await p.close();
    } else {
      fail('no canvas workshop with a storage key to test');
    }
  } catch (e) {
    fail('browser run crashed: ' + String(e.message).slice(0, 180));
  }
  await browser.close();
  finish();
})();

function finish() {
  server.close();
  console.log(failures ? '\nworkshop-completion: FAIL (' + failures + ')' : '\nworkshop-completion: PASS');
  process.exit(failures ? 1 : 0);
}
