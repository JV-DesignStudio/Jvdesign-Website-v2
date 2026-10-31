#!/usr/bin/env node
// tests/mobile-access-audit.js (A1990)
// A small, repeatable mobile audit for the things a layout check misses:
// zoom is not disabled, scrolling is not trapped, the mobile menu opens, a form
// input stays visible after focus, and a workshop/game is usable with touch.
// Run: node tests/mobile-access-audit.js
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.avif': 'image/avif' };
const DIRS = ['.', 'tools', 'games', 'workshops', 'pages', 'books', 'learn'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function zoomIssues() {
  const bad = [];
  for (const dir of DIRS) {
    const abs = path.join(ROOT, dir);
    for (const file of fs.readdirSync(abs)) {
      if (!file.endsWith('.html')) continue;
      const rel = path.join(dir, file).replace(/\\/g, '/');
      const html = fs.readFileSync(path.join(abs, file), 'utf8');
      if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) continue;
      const m = html.match(/<meta[^>]+name=["']viewport["'][^>]*content=["']([^"']*)["']/i);
      if (!m) { bad.push(rel + ' (no viewport)'); continue; }
      if (/user-scalable\s*=\s*(no|0)/i.test(m[1])) bad.push(rel + ' (user-scalable blocked)');
      if (/maximum-scale\s*=\s*([0-4](\.\d+)?)/i.test(m[1])) bad.push(rel + ' (maximum-scale ' + m[1] + ')');
    }
  }
  return bad;
}

(async () => {
  const zoom = zoomIssues();
  assert.deepEqual(zoom, [], 'pages that block browser zoom: ' + zoom.slice(0, 3).join(', '));

  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  const open = async (url, width, height) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR_|Failed to load resource|ERR_ABORTED/i.test(m.text())) errors.push(m.text()); });
    await page.setViewport({ width, height, isMobile: width < 700, hasTouch: true, deviceScaleFactor: width < 700 ? 2 : 1 });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()));
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('jvds-cookie-consent', 'declined'); } catch (e) {}
    });
    const resp = await page.goto(base + url, { waitUntil: 'load', timeout: 40000 });
    assert.equal(resp && resp.status(), 200, url + ' status');
    return { page, errors };
  };

  try {
    for (const [url, width, height] of [
      ['/meet-the-crew.html', 844, 390],
      ['/meet-the-crew.html', 390, 844],
      ['/meet-the-crew.html', 1440, 900],
      ['/pages/contact.html', 390, 844],
      ['/pages/contact.html', 1440, 900],
      ['/newsletter.html', 375, 812],
      ['/workshops/defold-pong-workshop.html', 320, 568],
      ['/games/echos-flight.html?debug=1', 390, 844]
    ]) {
      const { page, errors } = await open(url, width, height);
      const where = url + ' @' + width;
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        htmlOverflow: getComputedStyle(document.documentElement).overflowY
      }));
      assert.ok(metrics.overflow <= 2, where + ' horizontal overflow ' + metrics.overflow + 'px');
      if (!/echos-flight/.test(url)) {
        assert.notEqual(metrics.bodyOverflow, 'hidden', where + ' body scroll trapped');
        assert.notEqual(metrics.htmlOverflow, 'hidden', where + ' html scroll trapped');
      }
      assert.deepEqual(errors, [], where + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // Mobile menu opens and its links stay tappable.
    {
      const { page } = await open('/meet-the-crew.html', 390, 844);
      await page.click('#navToggle');
      await sleep(150);
      const menu = await page.evaluate(() => {
        const nav = document.querySelector('#mainNav');
        const toggle = document.querySelector('#navToggle');
        const link = nav && nav.querySelector('a');
        const r = link ? link.getBoundingClientRect() : null;
        return {
          expanded: toggle && toggle.getAttribute('aria-expanded'),
          navVisible: !!nav && nav.getBoundingClientRect().height > 20,
          linkHeight: r ? Math.round(r.height) : 0,
          linkVisible: !!r && r.width > 0 && r.height > 0
        };
      });
      assert.equal(menu.expanded, 'true', 'mobile menu did not open');
      assert.ok(menu.navVisible, 'mobile menu not visible');
      assert.ok(menu.linkVisible && menu.linkHeight >= 24, 'mobile menu link is not tappable');
      await page.close();
    }

    // Focusing a form field keeps it on screen and keeps the submit button reachable.
    for (const [url, input, submit] of [['/pages/contact.html', '#email', '#contactBtn'], ['/newsletter.html', '#nlEmail', '.nl-submit']]) {
      const { page } = await open(url, 390, 844);
      await page.click(input);
      await sleep(150);
      const state = await page.evaluate((inputSel, submitSel) => {
        const el = document.querySelector(inputSel);
        const btn = document.querySelector(submitSel);
        const r = el.getBoundingClientRect();
        const b = btn ? btn.getBoundingClientRect() : null;
        return {
          active: document.activeElement === el,
          onScreen: r.top >= 0 && r.bottom <= window.innerHeight + 1,
          submitVisible: !!b && b.width > 0 && b.height >= 24
        };
      }, input, submit);
      assert.ok(state.active, url + ' input did not focus');
      assert.ok(state.onScreen, url + ' focused input is off screen');
      assert.ok(state.submitVisible, url + ' submit button is not reachable');
      await page.close();
    }

    // A workshop still exposes a tappable control at 320px.
    {
      const { page } = await open('/workshops/defold-pong-workshop.html', 320, 568);
      const control = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role="button"], a.btn, .quiz-opt')];
        return btns.some((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height >= 24 && r.top < window.innerHeight;
        });
      });
      assert.ok(control, 'workshop has no tappable control at 320px');
      await page.close();
    }

    console.log('PASS mobile-access-audit: zoom allowed, scroll not trapped, menu/form/workshop usable at 320-844 with touch');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAIL mobile-access-audit: ' + e.message); process.exit(1); });
