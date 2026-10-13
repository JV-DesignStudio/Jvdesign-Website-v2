#!/usr/bin/env node
// tests/story-player-xss.js (A1482): the #s= share link carries untrusted data.
// Regression proof for the fixed DOM XSS: a character image with an attribute
// breakout, and a node id that would inject JS into the old inline onclick,
// must NOT execute. Fails on the pre-fix code, passes after escaping.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8993;

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}
function createServer() {
  return http.createServer((req, res) => {
    const file = safePath(req.url || '/');
    if (!file) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

const payload = {
  meta: { name: 'XSS Probe' },
  characters: [{ name: 'X', emoji: 'x', img: 'x" onerror="window.__xss=1' }],
  nodes: [
    { id: 'a', type: 'dialogue', char: 'X', text: 'hello', to: "e');window.__xss2=1;//" },
    { id: "e');window.__xss2=1;//", type: 'end', char: 'X', text: 'bye' }
  ]
};
const b64url = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const server = createServer();
  await new Promise((r) => server.listen(port, r));
  const browser = await puppeteer.launch({
    headless: true, protocolTimeout: 30000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const failures = [];

  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('console', (msg) => { if (msg.type() === 'error' && !/Failed to load resource|ERR_NETWORK_ACCESS_DENIED/i.test(msg.text())) errs.push(msg.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

    await page.goto(`http://127.0.0.1:${port}/tools/story-player.html#s=${b64url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#scene .sc-head, #scene .sc-end', { timeout: 8000 }).catch(() => {});
    await sleep(700);

    const imgXss = await page.evaluate(() => window.__xss);
    if (imgXss) failures.push('attribute-breakout XSS fired via ch.img (window.__xss set)');

    // The continue button: old code had onclick="go('...')", which injected on click.
    const hasContinue = await page.$('#scene .sc-choice, #scene [data-continue]');
    if (hasContinue) { await hasContinue.click().catch(() => {}); await sleep(400); }
    const clickXss = await page.evaluate(() => window.__xss2);
    if (clickXss) failures.push('JS-injection XSS fired via n.to onclick (window.__xss2 set)');

    const rendered = await page.evaluate(() => {
      const el = document.querySelector('#scene');
      return { text: el ? el.textContent.trim() : '', hasImg: Boolean(document.querySelector('#scene img')) };
    });
    console.log('  scene:', JSON.stringify({ ...rendered, sawContinue: Boolean(hasContinue) }));

    if (errs.length) failures.push('console/page errors: ' + errs.join(' | '));
    if (!rendered.text) failures.push('scene did not render the story');
  } catch (e) {
    failures.push('exception: ' + e.message);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    failures.forEach((f) => console.log('  [FAIL] ' + f));
    console.log('\nSTORY PLAYER XSS CHECKS FAILED');
    process.exit(1);
  }
  console.log('  [PASS] share-link ch.img and n.to payloads did not execute; scene rendered safely');
  console.log('\nSTORY PLAYER XSS CHECKS PASSED');
})();
