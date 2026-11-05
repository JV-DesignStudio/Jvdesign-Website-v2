#!/usr/bin/env node
// tests/scratch-catch-canvas-http.js (A2338)
// Verifies the canvas redirect stub sends visitors to the workshop page.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
      });
      res.end(err ? '' : data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 950 });

    const stub = fs.readFileSync(path.join(ROOT, 'workshops', 'scratch-catch-canvas.html'), 'utf8');
    assert.ok(/http-equiv="refresh"/.test(stub), 'stub has meta refresh');
    assert.ok(/scratch-catch-workshop\.html/.test(stub), 'stub points to workshop page');
    assert.ok(/noindex/.test(stub), 'stub is noindex');

    await page.goto(base + '/workshops/scratch-catch-canvas.html', { waitUntil: 'networkidle0', timeout: 30000 });
    const finalUrl = page.url();
    assert.ok(finalUrl.includes('scratch-catch-workshop.html'), 'redirects to workshop page: ' + finalUrl);

    await page.close();
    console.log('PASS scratch-catch-canvas-http: redirect stub sends to workshop page');
  } finally {
    await browser.close();
    server.close();
  }
})();
