// workshop-kit-http.js - A2622 runtime check
// Loads an engine workshop and a browser workshop, then checks the track
// switcher, the browser panel and the three remix prompts.
// Run: node tests/workshop-kit-http.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};
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

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const clickTab = (track) => page.evaluate((t) => document.querySelector('.ws-kit-tab[data-track="' + t + '"]').click(), track);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.url().startsWith(base) || /^data:|^blob:/.test(r.url())) return r.continue();
      return r.abort();
    });

    await page.goto(base + '/workshops/blender-animation-workshop.html', { waitUntil: 'load' });
    await page.waitForSelector('.ws-kit', { timeout: 8000 }).catch(() => {});
    const tabs = await page.$$eval('.ws-kit-tab', (els) => els.map((b) => ({ text: b.textContent.trim(), track: b.dataset.track })));
    check('engine workshop shows four tracks', tabs.length === 4, JSON.stringify(tabs));
    check('tracks are see, browser, engine and remix',
      tabs.some((t) => t.track === 'see') && tabs.some((t) => t.track === 'browser') &&
      tabs.some((t) => t.track === 'engine') && tabs.some((t) => t.track === 'remix'));
    const inlineCover = await page.$('.ws-outcome-inner .ws-kit-cover img');
    check('project image is added to the outcome panel', !!inlineCover);

    await clickTab('see');
    const seeImage = await page.$eval('.ws-kit-panel .ws-kit-cover img', (img) => img.getAttribute('src')).catch(() => '');
    check('see-it panel shows the project image', /\.webp|\.png|\.jpg/.test(seeImage), seeImage);

    await clickTab('remix');
    const cards = await page.$$eval('.ws-kit-remix .ws-kit-card', (els) => els.map((e) => e.textContent.trim()));
    check('make-it-yours shows three prompts', cards.length === 3, cards.join(' | '));

    check('finish card offers the remix entry', await page.$('#finishBanner .ws-kit-finish-remix, .ws-finish .ws-kit-finish-remix') !== null);
    await page.evaluate(() => document.querySelector('.ws-kit-finish-remix').click());
    const finishRemix = await page.evaluate(() => {
      const panel = document.querySelector('.ws-kit-remix');
      const tab = document.querySelector('.ws-kit-tab[data-track="remix"]');
      return { panel: !!panel && getComputedStyle(panel).display !== 'none', selected: tab && tab.getAttribute('aria-selected') === 'true' };
    });
    check('finish remix opens the three changes', finishRemix.panel && finishRemix.selected, JSON.stringify(finishRemix));

    await clickTab('browser');
    const frame = await page.$eval('.ws-kit-frame iframe', (f) => f.getAttribute('src')).catch(() => '');
    check('browser track mounts the studio', /blender-mod-studio\.html/.test(frame) && /kit=embed/.test(frame), frame);
    check('browser track hides the engine steps', await page.$eval('body', (b) => b.classList.contains('ws-kit-hide-engine')));

    await clickTab('engine');
    check('engine track returns to the steps', !(await page.$eval('body', (b) => b.classList.contains('ws-kit-hide-engine'))));

    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 900 });
      await new Promise((r) => setTimeout(r, 150));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
      check('no horizontal overflow at ' + width + 'px', overflow <= width, 'scrollWidth ' + overflow);
    }
    check('no page errors on the engine workshop', errors.length === 0, errors.slice(0, 3).join(' | '));

    check('guide mode button sits in the kit bar', await page.$('.ws-kit-bar .ws-kit-guide') !== null);
    await page.evaluate(() => document.querySelector('.ws-kit-guide').click());
    check('guide mode toggles on', await page.evaluate(() => document.body.classList.contains('ws-guide-mode')));
    const chromeHidden = await page.evaluate(() => {
      const hidden = (sel) => {
        const node = document.querySelector(sel);
        return !node || getComputedStyle(node).display === 'none';
      };
      return hidden('.site-header') && hidden('.site-footer') && hidden('.hero');
    });
    check('guide mode hides the header, hero and footer', chromeHidden);
    const stepsVisible = await page.evaluate(() => {
      const step = document.querySelector('.step-card');
      return !!step && getComputedStyle(step).display !== 'none';
    });
    check('guide mode keeps the steps visible', stepsVisible);
    const guideWidth = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().width);
    check('guide mode keeps a readable column', guideWidth > 320 && guideWidth <= 1121, 'width ' + Math.round(guideWidth));
    check('guide mode is saved per device', (await page.evaluate(() => localStorage.getItem('jvds_guide_mode'))) === '1');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.ws-kit', { timeout: 8000 }).catch(() => {});
    check('guide mode persists after reload', await page.evaluate(() => document.body.classList.contains('ws-guide-mode')));
    await page.evaluate(() => document.querySelector('.ws-kit-guide').click());
    check('guide mode can be turned off', !(await page.evaluate(() => document.body.classList.contains('ws-guide-mode'))));

    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(base + '/workshops/js-snake-workshop.html', { waitUntil: 'load' });
    await page.waitForSelector('.ws-kit', { timeout: 8000 }).catch(() => {});
    const snakeTabs = await page.$$eval('.ws-kit-tab', (els) => els.map((b) => b.dataset.track));
    check('browser workshop does not show an engine track', !snakeTabs.includes('engine'), JSON.stringify(snakeTabs));
    check('browser workshop offers see and remix', snakeTabs.includes('see') && snakeTabs.includes('remix'), JSON.stringify(snakeTabs));
    await clickTab('see');
    const demoFrame = await page.$eval('.ws-kit-frame iframe', (f) => f.getAttribute('src')).catch(() => '');
    check('canvas workshop embeds the finished build', /\/workshops\/demos\/js-snake-workshop\.html/.test(demoFrame), demoFrame);
    await clickTab('remix');
    const snakeCards = await page.$$eval('.ws-kit-remix .ws-kit-card', (els) => els.length);
    check('browser workshop still gets three remix prompts', snakeCards === 3, 'got ' + snakeCards);

    await page.evaluate(() => document.querySelector('.ws-kit-remix .ws-kit-card button').click());
    await new Promise((r) => setTimeout(r, 900));
    const remixStep = await page.evaluate(() => {
      const opened = document.querySelector('.cw-step.cw-open');
      const active = document.activeElement;
      return {
        openCount: document.querySelectorAll('.cw-step.cw-open').length,
        focused: !!(opened && active && opened.contains(active))
      };
    });
    check('remix prompt jumps to a step', remixStep.openCount >= 1, 'open steps ' + remixStep.openCount);
    check('remix prompt focuses the step editor', remixStep.focused);
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\nFAIL workshop-kit-http: ' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nPASS workshop-kit-http: the two-track switcher works on engine and browser workshops');
})().catch((e) => { console.error(e); process.exitCode = 1; });
