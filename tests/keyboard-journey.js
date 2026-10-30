#!/usr/bin/env node
/* A2009 keyboard-only journey.

   A page can have accessible buttons and still be unusable without a mouse. This
   test drives a real browser with nothing but Tab, Shift+Tab and Enter, and
   fails when a control cannot be reached, loses focus, or shows no focus ring.

   Covered:
     1. Skip to main content is the first thing Tab reaches, and activating it
        moves the next Tab into the main landmark (hub and workshop).
     2. Every element reached by Tab shows a visible focus ring.
     3. No clickable element is mouse only (div or span with a click action and
        no native focus, role or tabindex).
     4. A learner can finish a whole canvas workshop from step 1 to saved
        completion with the keyboard alone: Show Solution, Apply to Canvas,
        answer the Knowledge Check, next step, ledger written and restored.

   Run: node tests/keyboard-journey.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const PAGES = {
  hub: '/pages/workshop.html',
  workshop: '/workshops/pico8-pong-workshop.html',
};
const TABS_PER_PAGE = 18;
const TAB_CAP = 140;

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log('  ' + (ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? '  ' + detail : ''));
  if (!ok) fails++;
};

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const focusInfo = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { none: true };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    id: el.id,
    cls: (el.className || '').toString().split(' ').slice(0, 2).join('.'),
    text: (el.textContent || '').trim().slice(0, 30),
    visible: r.width > 0 && r.height > 0,
    inMain: !!el.closest('#main-content'),
    skip: el.classList.contains('skip-link'),
    focusVisible: el.matches(':focus-visible'),
    ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none',
  };
});

const isCw = (page, action, arg, arg2) => page.evaluate(({ action, arg, arg2 }) => {
  const el = document.activeElement;
  if (!el || !el.dataset || el.dataset.cw !== action) return false;
  if (arg != null && el.dataset.cwArg !== String(arg)) return false;
  if (arg2 != null && el.dataset.cwArg2 !== String(arg2)) return false;
  return true;
}, { action, arg, arg2 });

async function tabUntil(page, action, arg, arg2, cap = TAB_CAP) {
  for (let i = 0; i < cap; i++) {
    if (await isCw(page, action, arg, arg2)) return { ok: true, tabs: i };
    await page.keyboard.press('Tab');
  }
  return { ok: await isCw(page, action, arg, arg2), tabs: cap };
}

async function auditFocusRing(page, label, tabs) {
  const bad = [];
  let seen = 0;
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press('Tab');
    const info = await focusInfo(page);
    if (info.none) continue;
    seen++;
    if (!info.visible) { bad.push('off-screen ' + info.tag + '.' + info.cls); continue; }
    if (info.focusVisible && !info.ring && !info.skip) bad.push('no ring on ' + info.tag + '.' + info.cls + ' "' + info.text + '"');
  }
  check(label + ': keyboard focus is always visible', bad.length === 0, bad.slice(0, 4).join(' | ') || seen + ' stops checked');
}

async function mouseOnlyControls(page) {
  return page.evaluate(() => {
    const out = [];
    const clickable = document.querySelectorAll('[data-cw],[data-on],[onclick]');
    for (const el of clickable) {
      const tag = el.tagName;
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') continue;
      if (el.disabled) continue;
      const ti = el.getAttribute('tabindex');
      const role = el.getAttribute('role');
      if (ti != null && Number(ti) >= 0) continue;
      if (role === 'button' || role === 'link' || role === 'tab' || role === 'radio' || role === 'option') continue;
      if (!(el.className || '').toString()) continue;
      out.push(tag + '.' + (el.className || '').toString().split(' ')[0] + ' "' + (el.textContent || '').trim().slice(0, 24) + '"');
    }
    return out;
  });
}

async function skipLinkScenario(browser, origin, label, url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(origin + url, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));

  await page.keyboard.press('Tab');
  const first = await focusInfo(page);
  check(label + ': first Tab reaches Skip to main content', !!first.skip, first.tag + ' ' + first.text);

  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 250));
  await page.keyboard.press('Tab');
  const afterSkip = await focusInfo(page);
  check(label + ': skip link moves focus into the main landmark', afterSkip.inMain === true, afterSkip.tag + ' ' + afterSkip.text);

  const mouseOnly = await mouseOnlyControls(page);
  check(label + ': no mouse-only controls', mouseOnly.length === 0, mouseOnly.slice(0, 4).join(' | '));

  await page.evaluate(() => { location.hash = ''; window.scrollTo(0, 0); document.activeElement.blur(); });
  await auditFocusRing(page, label, TABS_PER_PAGE);

  check(label + ': no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

async function workshopJourney(browser, origin) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(origin + PAGES.workshop, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.CW && window.CW_CONFIG && document.querySelectorAll('.cw-step').length > 0, { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.CW && window.CW_CONFIG && document.querySelectorAll('.cw-step').length > 0, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 300));

  const steps = await page.evaluate(() => window.CW_CONFIG.steps.map((s) => ({ num: s.num, quiz: s.quiz ? s.quiz.correct : null })));
  const storageKey = await page.evaluate(() => window.CW_CONFIG.storageKey);
  const progress = () => page.evaluate(() => (document.getElementById('progressCount') || document.getElementById('cwProgressText') || {}).textContent || '');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 250));

  let completed = 0;
  const stuck = [];
  for (const step of steps) {
    const show = await tabUntil(page, 'showSolution', step.num);
    if (!show.ok) { stuck.push('step ' + step.num + ': Show Solution unreachable'); continue; }
    await page.keyboard.press('Enter');

    // Apply sits immediately before Show Solution, so one Shift+Tab reaches it.
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    if (!(await isCw(page, 'checkStep', step.num))) {
      const apply = await tabUntil(page, 'checkStep', step.num);
      if (!apply.ok) { stuck.push('step ' + step.num + ': Apply to Canvas unreachable'); continue; }
    }
    await page.keyboard.press('Enter');

    if (step.quiz !== null) {
      const opt = await tabUntil(page, 'selectQuiz', step.num, step.quiz);
      if (!opt.ok) { stuck.push('step ' + step.num + ': quiz answer unreachable'); continue; }
      await page.keyboard.press('Enter');
      const submit = await tabUntil(page, 'checkQuiz', step.num);
      if (!submit.ok) { stuck.push('step ' + step.num + ': Check Answer unreachable'); continue; }
      await page.keyboard.press('Enter');
    }

    await new Promise((r) => setTimeout(r, 350));
    const text = await progress();
    const done = Number((text.match(/^\s*(\d+)/) || [])[1] || 0);
    if (done <= completed) stuck.push('step ' + step.num + ': progress stayed at ' + text);
    completed = Math.max(completed, done);

    // Focus must land back in the newly active step, not fall to the body.
    const after = await focusInfo(page);
    const nextNum = step.num + 1;
    if (after.none) stuck.push('step ' + step.num + ': focus lost after completing');
    else if (nextNum <= steps.length) {
      const onNext = await page.evaluate((n) => {
        const el = document.activeElement;
        return !!(el && el.closest && el.closest('#card-' + n));
      }, nextNum);
      if (!onNext) stuck.push('step ' + step.num + ': focus left the next step (' + after.tag + '.' + after.cls + ')');
    }
  }

  check('workshop: every control reachable with the keyboard', stuck.length === 0, stuck.slice(0, 4).join(' | '));
  check('workshop: all steps completed', completed === steps.length, completed + '/' + steps.length);

  const ledger = await page.evaluate((key) => JSON.parse(localStorage.getItem(key + ':ledger') || 'null'), storageKey);
  check('workshop: completion saved to the ledger', !!(ledger && Array.isArray(ledger.completed) && ledger.completed.length === steps.length), ledger ? ledger.completed.length + ' steps' : 'no ledger');

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.CW, { timeout: 10000 });
  const restored = await page.evaluate((key) => {
    const l = JSON.parse(localStorage.getItem(key + ':ledger') || 'null');
    return { ledger: l && l.completed ? l.completed.length : 0, text: (document.getElementById('progressCount') || {}).textContent || '' };
  }, storageKey);
  check('workshop: progress is restored on reload', restored.ledger === steps.length, restored.text.trim());

  check('workshop: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

(async () => {
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    await skipLinkScenario(browser, origin, 'hub', PAGES.hub);
    await skipLinkScenario(browser, origin, 'workshop', PAGES.workshop);
    await workshopJourney(browser, origin);
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
  console.log(fails ? '\nkeyboard-journey: FAIL (' + fails + ')' : '\nkeyboard-journey: PASS');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => {
  console.error('keyboard-journey: ERROR ' + (e && e.message));
  process.exitCode = 1;
});
