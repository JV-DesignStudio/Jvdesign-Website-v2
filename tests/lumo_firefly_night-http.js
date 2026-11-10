#!/usr/bin/env node
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function watch(page) {
  const errors = [];
  const responses = {};
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(text)) return;
    errors.push('console: ' + text);
  });
  page.on('response', r => { responses[r.url()] = r.status(); });
  return { errors, responses };
}

async function viewport(browser, base, width, height) {
  const page = await browser.newPage();
  const { errors, responses } = watch(page);
  await page.setViewport({ width, height, isMobile: width < 700, hasTouch: width < 700 });
  await page.goto(base + '/games/lumo_firefly_night.html?seed=http', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__lumoFirefly, { timeout: 10000 });
  await sleep(150);

  const info = await page.evaluate(() => ({
    title: document.title,
    start: !!document.getElementById('start'),
    startMain: !!document.getElementById('startMain'),
    canvas: !!document.getElementById('game'),
    diffPills: document.querySelectorAll('#diffPills .pill').length,
    modePills: document.querySelectorAll('#modePills .pill').length,
    live: !!document.getElementById('srStatus'),
    fonts: !!document.querySelector('link[href*="assets/fonts/fonts.css"]'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check(width + 'px: page responds 200', responses[base + '/games/lumo_firefly_night.html?seed=http'] === 200 || Object.entries(responses).some(([u, s]) => /lumo_firefly_night\.html/.test(u) && s === 200), '');
  check(width + 'px: title names Lumo', /Lumo's Firefly Shooter/.test(info.title), info.title);
  check(width + 'px: game canvas and start controls render', info.canvas && info.start && info.startMain, JSON.stringify(info));
  check(width + 'px: pace and run modes are present', info.diffPills === 3 && info.modePills === 2, info.diffPills + '/' + info.modePills);
  check(width + 'px: screen-reader status region exists', info.live);
  check(width + 'px: self-hosted fonts are linked', info.fonts);
  check(width + 'px: no sideways scrolling', info.overflow <= 2, String(info.overflow));

  await page.evaluate(() => document.getElementById('start').click());
  await sleep(250);
  const started = await page.evaluate(() => window.__lumoFirefly.state());
  check(width + 'px: the run starts', started.running && !started.startShown, JSON.stringify({ running: started.running, startShown: started.startShown }));
  check(width + 'px: StoryRun guide is Lumo', await page.evaluate(() => (document.querySelector('.sr-guide') || {}).textContent) === 'Lumo');
  check(width + 'px: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await viewport(browser, base, 390, 844);
    await viewport(browser, base, 844, 390);
    await viewport(browser, base, 1440, 900);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL LUMO FIREFLY HTTP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
