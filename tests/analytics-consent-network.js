#!/usr/bin/env node
/* A1997 analytics consent network check.

   Static checks (tests/privacy-accuracy.js) prove the policy text and that no
   page hardcodes gtag.js. This file proves the runtime behaviour: it drives a
   real Chromium, serves the site over http, records every outbound request and
   fails if a Google Analytics request is attempted when consent is missing,
   declined, declined on a later page load, or withdrawn after being accepted.

   Covered:
     1. fresh visit, no choice made       -> no analytics request, banner shown
     2. Decline                           -> no analytics request
     3. reload after Decline              -> no analytics request, banner stays away
     4. game page and tool page after Decline -> no analytics request
     5. Accept                            -> analytics request fires (gate is not always off)
     6. withdraw via Cookie settings      -> no analytics request after reload
     7. declining on one page still blocks on a subsequent page

   Run: node tests/analytics-consent-network.js
*/
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const ANALYTICS_HOST = /(^|\.)googletagmanager\.com$|(^|\.)google-analytics\.com$/;
const PAGES = { home: 'index.html', game: 'games/gem_match.html', tool: 'tools/palette-studio.html' };

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log('  ' + (ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? '  ' + detail : ''));
  if (!ok) fails++;
};

function makeServer() {
  return http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const abs = path.resolve(ROOT, rel);
    if (!abs.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      const type = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
      }[path.extname(abs)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(buf);
    });
  });
}

async function newTrackedPage(browser, origin) {
  const page = await browser.newPage();
  const hits = [];
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    let host = '';
    try { host = new URL(url).hostname; } catch (e) {}
    if (ANALYTICS_HOST.test(host)) hits.push(url);
    if (host === new URL(origin).hostname || url.startsWith('data:') || url.startsWith('blob:')) return req.continue();
    return req.abort();
  });
  return { page, hits };
}

const settle = (page) => page.waitForNetworkIdle({ idleTime: 400, timeout: 8000 }).catch(() => {});

async function visit(page, origin, rel) {
  await page.goto(origin + '/' + rel, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await settle(page);
  await new Promise((r) => setTimeout(r, 600));
}

const bannerVisible = (page) => page.evaluate(() => !!document.getElementById('cookie-banner'));

(async () => {
  const server = makeServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    /* 1 to 4: one visitor who declines */
    {
      const ctx = await browser.createBrowserContext();
      const { page, hits } = await newTrackedPage(ctx, origin);

      await visit(page, origin, PAGES.home);
      check('fresh visit fires no analytics request', hits.length === 0, hits.join(', '));
      check('fresh visit shows the consent banner', await bannerVisible(page));

      await page.click('#cookie-decline').catch(() => {});
      await new Promise((r) => setTimeout(r, 400));
      check('Decline fires no analytics request', hits.length === 0, hits.join(', '));
      check('Decline stores the decision', await page.evaluate(() => /jvds-cookie-consent=declined/.test(document.cookie)));

      await visit(page, origin, PAGES.home);
      check('reload after Decline fires no analytics request', hits.length === 0, hits.join(', '));
      check('reload after Decline keeps the banner away', !(await bannerVisible(page)));

      await visit(page, origin, PAGES.game);
      check('game page after Decline fires no analytics request', hits.length === 0, hits.join(', '));

      await visit(page, origin, PAGES.tool);
      check('tool page after Decline fires no analytics request', hits.length === 0, hits.join(', '));

      await ctx.close();
    }

    /* 5 and 6: one visitor who accepts, then withdraws */
    {
      const ctx = await browser.createBrowserContext();
      const { page, hits } = await newTrackedPage(ctx, origin);

      await visit(page, origin, PAGES.home);
      const beforeAccept = hits.length;
      await page.click('#cookie-accept').catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
      await settle(page);
      check('Accept loads the analytics library', hits.length > beforeAccept, hits.length + ' request(s)');

      await page.evaluate(() => window.JVDSCookies && window.JVDSCookies.reopen());
      await new Promise((r) => setTimeout(r, 1200));
      await settle(page);
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 400));
      hits.length = 0;

      await visit(page, origin, PAGES.home);
      check('withdrawing consent blocks analytics on the next load', hits.length === 0, hits.join(', '));
      check('withdrawing consent brings the banner back', await bannerVisible(page));

      await ctx.close();
    }

    /* 7: a decline on one page still blocks a different page in the same session */
    {
      const ctx = await browser.createBrowserContext();
      const { page, hits } = await newTrackedPage(ctx, origin);
      await visit(page, origin, PAGES.game);
      await page.click('#cookie-decline').catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
      hits.length = 0;
      await visit(page, origin, PAGES.home);
      check('Decline on a game page still blocks the home page', hits.length === 0, hits.join(', '));
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(fails ? '\nanalytics-consent-network: FAIL (' + fails + ')' : '\nanalytics-consent-network: PASS');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => {
  console.error('analytics-consent-network: ERROR ' + (e && e.message));
  process.exitCode = 1;
});
