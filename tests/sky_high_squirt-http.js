#!/usr/bin/env node
/*
 * tests/sky_high_squirt-http.js , the moved-game redirect stub (games/sky_high_squirt.html).
 *
 * sky_high_squirt.html is an old game URL kept as a redirect stub. It must stay
 * out of the index but still pass link equity to the live game, matching the
 * site-wide redirect-stub convention (robots "noindex, follow" plus a canonical).
 *
 * Proves:
 *   - the stub sets robots "noindex, follow" (not bare noindex)
 *   - it canonicalises and meta-refreshes to games/sky_high_with_friends.html
 *   - the live target exists, is indexable and is in the sitemap
 *   - the stub renders its fallback link with no page errors
 *
 * Run: node tests/sky_high_squirt-http.js
 */
const fs = require('fs');
const path = require('path');
const { withServer, ROOT } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const STUB = 'games/sky_high_squirt.html';
const TARGET = 'games/sky_high_with_friends.html';
const TARGET_URL = 'https://jvdesignstudio.co.uk/' + TARGET;

function staticChecks() {
  const stub = fs.readFileSync(path.join(ROOT, STUB), 'utf8');

  const robots = ((stub.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || [])[1] || '').trim();
  check('stub robots is "noindex, follow"', /^noindex,\s*follow$/i.test(robots), robots || 'missing');

  const canonical = (stub.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] || '';
  check('stub canonicalises to the live game', canonical === TARGET_URL, canonical || 'missing');

  const refresh = (stub.match(/http-equiv=["']refresh["']\s+content=["'][^"']*url=([^"'>\s]+)/i) || [])[1] || '';
  check('stub meta-refreshes to the live game', refresh === TARGET_URL, refresh || 'missing');

  check('stub shows a fallback link to the live game', /href="[^"]*sky_high_with_friends\.html"/.test(stub));

  const targetPath = path.join(ROOT, TARGET);
  check('live target exists', fs.existsSync(targetPath));
  if (fs.existsSync(targetPath)) {
    const target = fs.readFileSync(targetPath, 'utf8');
    const tr = ((target.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || [])[1] || '').trim();
    check('live target is indexable', !/noindex/i.test(tr), tr || 'default (indexable)');
  }

  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  check('live target is in the sitemap', sitemap.includes(TARGET_URL));
}

async function browserChecks(browser, base) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    // The stub redirects to production (meta refresh plus a JS location.replace).
    // Answer that one navigation locally so the redirect can be observed offline.
    if (req.url().startsWith(TARGET_URL)) {
      req.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>LANDED</title><p id="landed">ok</p>' });
    } else {
      req.continue();
    }
  });
  await page.goto(base + '/' + STUB, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => /sky_high_with_friends\.html$/.test(location.pathname), { timeout: 8000 }).catch(() => {});
  const landed = await page.evaluate(() => ({
    path: location.pathname,
    marker: !!document.getElementById('landed')
  }));
  check('browser: stub redirects to the live game', landed.path === '/' + TARGET, landed.path);
  check('browser: redirect lands (no page errors)', landed.marker && errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => { await browserChecks(browser, base); });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL SKY HIGH SQUIRT STUB CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
