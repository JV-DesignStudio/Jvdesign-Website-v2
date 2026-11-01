#!/usr/bin/env node
/* A1981 learner journey accessibility walk.

   A page can pass a per-page audit and still break the journey. This test drives
   a real browser with nothing but Tab, Shift+Tab and Enter from the landing page
   to a saved/exported workshop, then re-checks the same journey at 200% zoom and
   at 390px wide.

   Covered:
     1. Landing page -> start-here hub -> workshop, all by keyboard, with the
        skip link first and focus visible on every stop.
     2. A whole canvas workshop completed with the keyboard, ending on a finish
        screen that is announced and whose export button can be reached.
     3. 200% zoom (720 CSS px wide) and 390px wide: no sideways scrolling and
        the journey controls stay keyboard reachable.
     4. Touch targets on the journey controls are at least 24x24 CSS px (2.5.8).

   Run: node tests/a11y-learner-journey.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

const PAGES = {
  landing: '/index.html',
  hub: '/workshops/start-here.html',
  workshop: '/workshops/scratch-catch-workshop.html',
};
const TAB_CAP = 160;
const LANDING_CTA = '/workshops/start-here.html';
const HUB_WORKSHOP = 'scratch-catch-workshop.html';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const focusInfo = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { none: true };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    id: el.id,
    cls: (el.className || '').toString().split(' ').slice(0, 2).join('.'),
    text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    href: el.getAttribute && el.getAttribute('href'),
    visible: r.width > 0 && r.height > 0,
    inMain: !!el.closest('#main-content, main'),
    skip: el.classList.contains('skip-link'),
    focusVisible: el.matches(':focus-visible'),
    ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none',
  };
});

const activeMatches = (page, selector) => page.evaluate((sel) => {
  const el = document.activeElement;
  return !!(el && el.matches && el.matches(sel));
}, selector);

async function tabUntil(page, selector, cap = TAB_CAP) {
  for (let i = 0; i < cap; i++) {
    if (await activeMatches(page, selector)) return { ok: true, tabs: i };
    await page.keyboard.press('Tab');
  }
  return { ok: await activeMatches(page, selector), tabs: cap };
}

const isCw = (page, action, arg, arg2) => page.evaluate(({ action, arg, arg2 }) => {
  const el = document.activeElement;
  if (!el || !el.dataset || el.dataset.cw !== action) return false;
  if (arg != null && el.dataset.cwArg !== String(arg)) return false;
  if (arg2 != null && el.dataset.cwArg2 !== String(arg2)) return false;
  return true;
}, { action, arg, arg2 });

async function tabToCw(page, action, arg, arg2, cap = TAB_CAP) {
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

async function openPage(browser, origin, url, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport(viewport);
  await page.goto(origin + url, { waitUntil: 'load', timeout: 60000 });
  await sleep(400);
  return { page, errors };
}

async function skipLink(page, label) {
  await page.keyboard.press('Tab');
  const first = await focusInfo(page);
  check(label + ': first Tab reaches Skip to main content', !!first.skip, first.tag + ' ' + first.text);
  await page.keyboard.press('Enter');
  await sleep(250);
  await page.keyboard.press('Tab');
  const after = await focusInfo(page);
  check(label + ': skip link moves focus into the main landmark', after.inMain === true, after.tag + ' ' + after.text);
}

async function followKeyboardLink(page, selector, expectPath, label) {
  const hit = await tabUntil(page, selector);
  if (!hit.ok) { check(label + ': link is keyboard reachable', false, 'not reached in ' + hit.tabs + ' tabs'); return false; }
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await sleep(300);
  const pathname = await page.evaluate(() => location.pathname);
  check(label + ': Enter follows the link', pathname === expectPath, pathname);
  return pathname === expectPath;
}

async function landingJourney(browser, origin) {
  console.log('\nlanding -> hub');
  const { page, errors } = await openPage(browser, origin, PAGES.landing);
  await skipLink(page, 'landing');
  await followKeyboardLink(page, 'a[href="' + LANDING_CTA + '"]', PAGES.hub, 'landing');
  check('landing: one h1', (await page.evaluate(() => document.querySelectorAll('h1').length)) === 1);
  check('landing: no mouse-only controls', (await mouseOnlyControls(page)).length === 0);
  await auditFocusRing(page, 'landing', 70);
  check('landing: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function hubJourney(browser, origin) {
  console.log('\nhub -> workshop');
  const { page, errors } = await openPage(browser, origin, PAGES.hub);
  await skipLink(page, 'hub');
  await followKeyboardLink(page, 'a[href="' + HUB_WORKSHOP + '"]', PAGES.workshop, 'hub');
  check('hub: one h1', (await page.evaluate(() => document.querySelectorAll('h1').length)) === 1);
  check('hub: no mouse-only controls', (await mouseOnlyControls(page)).length === 0);
  await auditFocusRing(page, 'hub', 70);
  check('hub: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function downloadIntercept(page) {
  await page.evaluate(() => {
    window.__a11yDownloads = [];
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      try { window.__a11yDownloads.push(blob && blob.type); } catch (e) {}
      return realCreate.call(URL, blob);
    };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__a11yDownloads.push('file:' + this.download);
      return realClick.call(this);
    };
  });
}

async function workshopJourney(browser, origin) {
  console.log('\nworkshop: complete, finish, save');
  const { page, errors } = await openPage(browser, origin, PAGES.workshop);
  await page.waitForFunction(() => window.CW && window.CW_CONFIG && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.CW && window.CW_CONFIG && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 });
  await sleep(250);

  const steps = await page.evaluate(() => window.CW_CONFIG.steps.map((s) => ({ num: s.num, quiz: s.quiz ? s.quiz.correct : null })));
  const storageKey = await page.evaluate(() => window.CW_CONFIG.storageKey);
  // #progressCount is a completed-step count ("3 / 6"); #cwProgressText shows
  // the current step ("Step 4 / 6"), so it must not be read as a count.
  const progress = () => page.evaluate(() => (document.getElementById('progressCount') || document.getElementById('cwProgressText') || {}).textContent || '');

  await skipLink(page, 'workshop');

  const ax = await page.evaluate(() => ({
    feedbackLive: [...document.querySelectorAll('.cw-feedback, .cw-quiz-fb')].every((e) =>
      e.getAttribute('role') === 'status' && /polite/.test(e.getAttribute('aria-live') || '')),
    quizPressed: [...document.querySelectorAll('#quiz-opts-1 .cw-quiz-opt')].every((e) => e.hasAttribute('aria-pressed')),
  }));
  check('workshop: step and quiz feedback is a live region', ax.feedbackLive);
  check('workshop: quiz options expose a pressed state', ax.quizPressed);

  let completed = 0;
  const stuck = [];
  for (const step of steps) {
    const show = await tabToCw(page, 'showSolution', step.num);
    if (!show.ok) { stuck.push('step ' + step.num + ': Show Solution unreachable'); continue; }
    await page.keyboard.press('Enter');

    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    if (!(await isCw(page, 'checkStep', step.num))) {
      const apply = await tabToCw(page, 'checkStep', step.num);
      if (!apply.ok) { stuck.push('step ' + step.num + ': Apply to Canvas unreachable'); continue; }
    }
    await page.keyboard.press('Enter');

    if (step.quiz !== null) {
      const opt = await tabToCw(page, 'selectQuiz', step.num, step.quiz);
      if (!opt.ok) { stuck.push('step ' + step.num + ': quiz answer unreachable'); continue; }
      await page.keyboard.press('Enter');
      const pressed = await page.evaluate(({ n, i }) => {
        const el = document.querySelectorAll('#quiz-opts-' + n + ' .cw-quiz-opt')[i];
        return el && el.getAttribute('aria-pressed');
      }, { n: step.num, i: step.quiz });
      if (pressed !== 'true') stuck.push('step ' + step.num + ': chosen quiz answer is not announced as pressed');
      const submit = await tabToCw(page, 'checkQuiz', step.num);
      if (!submit.ok) { stuck.push('step ' + step.num + ': Check Answer unreachable'); continue; }
      await page.keyboard.press('Enter');
    }

    await sleep(400);
    const text = await progress();
    const match = text.match(/(\d+)\s*\/\s*\d+/);
    const done = match ? Number(match[1]) : (/complete/i.test(text) ? steps.length : 0);
    if (done <= completed) stuck.push('step ' + step.num + ': progress stayed at ' + text.trim());
    completed = Math.max(completed, done);
  }

  check('workshop: every control reachable with the keyboard', stuck.length === 0, stuck.slice(0, 4).join(' | '));
  check('workshop: all steps completed', completed === steps.length, completed + '/' + steps.length);

  const finish = await page.evaluate(() => {
    const banner = document.getElementById('finishBanner');
    const remix = document.querySelector('.cw-remix');
    const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const announced = (el) => !!el && (el.getAttribute('role') === 'status' || el.getAttribute('role') === 'alert' ||
      /\bpolite\b|\bassertive\b/.test(el.getAttribute('aria-live') || ''));
    const target = banner && banner.classList.contains('show') ? banner : remix;
    return {
      bannerShown: !!banner && banner.classList.contains('show'),
      remixShown: visible(remix),
      shown: visible(target),
      announced: announced(target),
      focusedInside: !!target && !!document.activeElement && target.contains(document.activeElement),
      text: target ? (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) : '',
    };
  });
  check('workshop: finish screen appears after the last step', finish.shown, finish.bannerShown ? '#finishBanner.show' : (finish.remixShown ? '.cw-remix' : 'no finish screen'));
  check('workshop: finish screen is announced or takes focus', finish.announced || finish.focusedInside,
    finish.announced ? 'aria-live/role present' : (finish.focusedInside ? 'focus inside' : 'silent: ' + finish.text));
  check('workshop: finish screen is readable content', finish.text.length > 20, finish.text);

  await downloadIntercept(page);
  const dlBtn = await tabUntil(page, '[data-on="CW.downloadGame"]');
  if (!dlBtn.ok) {
    check('workshop: Download My Game is keyboard reachable', false, 'not reached in ' + dlBtn.tabs + ' tabs');
  } else {
    await page.keyboard.press('Enter');
    await sleep(600);
    const downloads = await page.evaluate(() => window.__a11yDownloads || []);
    check('workshop: Download My Game is keyboard reachable', true, 'after ' + dlBtn.tabs + ' tabs');
    check('workshop: Enter on Download My Game saves a file', downloads.some((d) => String(d).indexOf('file:') === 0), downloads.join(', '));
  }

  const ledger = await page.evaluate((key) => JSON.parse(localStorage.getItem(key + ':ledger') || 'null'), storageKey);
  check('workshop: completion saved to the ledger', !!(ledger && Array.isArray(ledger.completed) && ledger.completed.length === steps.length), ledger ? ledger.completed.length + ' steps' : 'no ledger');

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.CW, { timeout: 15000 });
  await sleep(300);
  const restored = await page.evaluate((key) => {
    const l = JSON.parse(localStorage.getItem(key + ':ledger') || 'null');
    const banner = document.getElementById('finishBanner');
    return {
      ledger: l && l.completed ? l.completed.length : 0,
      finish: (!!banner && banner.classList.contains('show')) || !!document.querySelector('.cw-remix'),
      text: ((document.getElementById('cwProgressText') || {}).textContent || '').trim(),
    };
  }, storageKey);
  check('workshop: progress is restored on reload', restored.ledger === steps.length, restored.text);
  check('workshop: finish screen returns after reload', restored.finish, restored.text);

  await auditFocusRing(page, 'workshop', 60);
  check('workshop: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

async function zoomJourney(browser, origin) {
  console.log('\n200% zoom (720 CSS px)');
  for (const url of [PAGES.landing, PAGES.hub, PAGES.workshop]) {
    const { page } = await openPage(browser, origin, url, { width: 720, height: 450, deviceScaleFactor: 2 });
    if (url === PAGES.workshop) {
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(250);
    }
    const scroll = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
    check('zoom 200% ' + url + ': no sideways scrolling', scroll.width <= scroll.view + 2, scroll.width + ' > ' + scroll.view);
    await skipLink(page, 'zoom 200% ' + url);
    if (url === PAGES.workshop) {
      const show = await tabToCw(page, 'showSolution', 1, null, 120);
      check('zoom 200% workshop: first step controls reachable', show.ok, show.ok ? 'after ' + show.tabs + ' tabs' : 'not reached');
    }
    await auditFocusRing(page, 'zoom 200% ' + url, 25);
    await page.close();
  }
}

async function narrowJourney(browser, origin) {
  console.log('\n390px wide');
  for (const url of [PAGES.landing, PAGES.hub, PAGES.workshop]) {
    const { page } = await openPage(browser, origin, url, { width: 390, height: 844 });
    if (url === PAGES.workshop) {
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(250);
    }
    const scroll = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
    check('390px ' + url + ': no sideways scrolling', scroll.width <= scroll.view + 2, scroll.width + ' > ' + scroll.view);

    const small = await page.evaluate(() => {
      const sel = 'a[href="/workshops/start-here.html"], a[href="scratch-catch-workshop.html"], .start-route, [data-cw], [data-on="CW.downloadGame"]';
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.width < 24 || r.height < 24) {
          out.push(Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + el.tagName + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26) + '"');
        }
      }
      return out;
    });
    check('390px ' + url + ': journey touch targets >= 24px', small.length === 0, small.slice(0, 4).join(' | '));
    await auditFocusRing(page, '390px ' + url, 25);
    await page.close();
  }
}

(async () => {
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    await landingJourney(browser, origin);
    await hubJourney(browser, origin);
    await workshopJourney(browser, origin);
    await zoomJourney(browser, origin);
    await narrowJourney(browser, origin);
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
  console.log(fails ? '\na11y-learner-journey: FAIL (' + fails + ')' : '\na11y-learner-journey: PASS');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => {
  console.error('a11y-learner-journey: ERROR ' + (e && e.message));
  process.exitCode = 1;
});
