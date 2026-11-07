#!/usr/bin/env node
/*
 * tests/workshop-needs.js
 * A2793: "works here" mode. Every catalogue card says whether it runs in the
 * browser or needs an install, the No install filter is accurate (browser
 * studios stay visible), the choice persists, and an install-only workshop
 * page shows a banner with a browser alternative.
 * Run: node tests/workshop-needs.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

const entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const needs = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-needs.json'), 'utf8'));
const hub = fs.readFileSync(path.join(ROOT, 'pages', 'workshop.html'), 'utf8');
const needsByUrl = new Map(needs.map((n) => [n.url, n]));

// 1. the generated manifest covers every workshop
assert.equal(needs.length, entries.length, 'needs manifest covers every workshop');
const urlSet = new Set(entries.map((e) => e.url));
assert.ok(needs.every((n) => urlSet.has(n.url)), 'every needs url is a real workshop');

// 2. every catalogue card carries data-needs that matches the manifest
const catHtml = hub.slice(hub.indexOf('<!-- CATALOGUE:START -->'), hub.indexOf('<!-- CATALOGUE:END -->'));
const cardTags = [...catHtml.matchAll(/<a href="([^"]+)" class="course-card"([^>]*)>/g)];
assert.equal(cardTags.length, entries.length, 'catalogue has one card per workshop');
let badCards = [];
for (const m of cardTags) {
  const url = m[1].replace(/^\.\./, '');
  const attr = /data-needs="([^"]+)"/.exec(m[2]);
  const want = needsByUrl.get(url);
  if (!attr || !want || attr[1] !== want.needs) badCards.push(url);
}
assert.deepEqual(badCards, [], 'every card has the generated data-needs');

// 3. browser studios are browser, and install cards point at a real alternative
const studios = needs.filter((n) => /-(?:mod-)?studio$/.test(n.id));
assert.ok(studios.length > 0 && studios.every((n) => n.needs === 'browser'), 'browser studios need no install');
const withAlt = needs.filter((n) => n.needs === 'install' && n.alternative);
assert.ok(withAlt.length > 0, 'install workshops offer a browser alternative');
assert.ok(withAlt.every((n) => urlSet.has(n.alternative.url)), 'alternatives are real workshops');

// 4. the committed generated files are in sync with the data
execFileSync(process.execPath, ['scripts/generate-workshop-catalogue.js', '--check'], { cwd: ROOT, stdio: 'pipe' });

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  async function open(url) {
    const page = await browser.newPage();
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
    return { page, errors };
  }

  try {
    // 5. works-here mode hides every install card and labels every card
    for (const width of [1440, 390]) {
      const { page, errors } = await open('/pages/workshop.html?works-here=1');
      await page.setViewport({ width, height: 950 });
      await new Promise((r) => setTimeout(r, 200));
      await page.waitForFunction(() => document.getElementById('noInstallFilter').getAttribute('aria-pressed') === 'true');
      const state = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#catalogueGrid .course-card')];
        const visible = cards.filter((c) => c.style.display !== 'none');
        return {
          pressed: document.getElementById('noInstallFilter').getAttribute('aria-pressed'),
          visible: visible.length,
          visibleInstall: visible.filter((c) => c.getAttribute('data-needs') === 'install').length,
          visibleBrowser: visible.filter((c) => c.getAttribute('data-needs') === 'browser').length,
          badges: cards.every((c) => {
            const b = c.querySelector('.ws-needs-badge');
            return !!b && b.textContent.trim().length > 0;
          }),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      assert.equal(state.pressed, 'true', width + 'px works-here pressed');
      assert.ok(state.visible > 0, width + 'px works-here has results');
      assert.equal(state.visibleInstall, 0, width + 'px no install cards visible');
      assert.ok(state.visibleBrowser > 0, width + 'px browser cards visible');
      assert.ok(state.badges, width + 'px every card has a needs badge');
      assert.ok(state.overflow <= 2, width + 'px no overflow (' + state.overflow + ')');
      assert.deepEqual(errors, [], width + 'px no errors');
      await page.close();
    }

    // 6. the choice persists, and Reset clears it
    {
      const { page, errors } = await open('/pages/workshop.html');
      await page.evaluate(() => { try { localStorage.removeItem('jvds_works_here'); } catch (e) {} });
      await page.reload({ waitUntil: 'load' });
      const before = await page.evaluate(() => ({
        pressed: document.getElementById('noInstallFilter').getAttribute('aria-pressed'),
        installVisible: [...document.querySelectorAll('#catalogueGrid .course-card')]
          .filter((c) => c.style.display !== 'none' && c.getAttribute('data-needs') === 'install').length
      }));
      assert.equal(before.pressed, 'false', 'filter starts off');
      assert.ok(before.installVisible > 0, 'install cards start visible');

      await page.click('#noInstallFilter');
      await page.waitForFunction(() => document.getElementById('noInstallFilter').getAttribute('aria-pressed') === 'true');
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.getElementById('noInstallFilter').getAttribute('aria-pressed') === 'true');
      const persisted = await page.evaluate(() => ({
        saved: localStorage.getItem('jvds_works_here'),
        installVisible: [...document.querySelectorAll('#catalogueGrid .course-card')]
          .filter((c) => c.style.display !== 'none' && c.getAttribute('data-needs') === 'install').length
      }));
      assert.equal(persisted.saved, '1', 'choice is saved');
      assert.equal(persisted.installVisible, 0, 'choice still hides install cards after reload');

      await page.click('#workshopReset');
      await page.reload({ waitUntil: 'load' });
      assert.equal(await page.$eval('#noInstallFilter', (e) => e.getAttribute('aria-pressed')), 'false', 'Reset clears the saved choice');
      assert.deepEqual(errors, [], 'no errors during persistence');
      await page.close();
    }

    // 7. install-only pages show the banner; browser studios do not
    {
      const { page, errors } = await open('/workshops/blender-cube-workshop.html');
      await page.setViewport({ width: 390, height: 900 });
      await new Promise((r) => setTimeout(r, 200));
      await page.waitForSelector('#jvds-needs-banner', { timeout: 10000 });
      const banner = await page.evaluate(() => {
        const el = document.getElementById('jvds-needs-banner');
        const a = el.querySelector('a');
        return {
          text: el.textContent,
          href: a ? a.getAttribute('href') : '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      assert.ok(/Blender/i.test(banner.text), 'banner names the install');
      assert.ok(/\/workshops\/blender-mod-studio\.html$/.test(banner.href), 'banner links to the browser studio');
      assert.ok(banner.overflow <= 2, 'banner fits 390px (' + banner.overflow + ')');
      assert.deepEqual(errors, [], 'no errors on the install page');
      await page.close();
    }

    {
      const { page, errors } = await open('/workshops/blender-mod-studio.html');
      await new Promise((r) => setTimeout(r, 1200));
      assert.equal(await page.$('#jvds-needs-banner'), null, 'browser studio has no install banner');
      assert.deepEqual(errors, [], 'no errors on the browser studio page');
      await page.close();
    }

    console.log('\nPASS workshop-needs: data-needs on every card, accurate works-here filter, persistent choice, install banner, 1440/390 no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL workshop-needs: ' + error.message);
  process.exit(1);
});
