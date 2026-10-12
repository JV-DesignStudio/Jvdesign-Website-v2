#!/usr/bin/env node
/*
 * mobile-pass.cjs - A1355 mobile responsive sweep for the primary hubs.
 *
 * Loads each hub page at phone widths (390 and 320) and fails if the document
 * scrolls horizontally or if any element pokes past the viewport without being
 * clipped by an intended horizontal scroll container.
 *
 * Run: node scripts/mobile-pass.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8993;

const pages = [
  '/index.html',
  '/arcade.html',
  '/pages/workshop.html',
  '/pages/games.html',
  '/pages/dev-tools.html',
  '/pages/books.html',
  '/pages/parents.html',
  '/pages/teachers.html',
  '/workshops/learn.html',
  '/pages/downloads.html',
  '/pages/about.html',
  '/pages/contact.html',
  '/pages/faq.html'
];

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'small', width: 320, height: 720 }
];

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, clean);
  if (!file.startsWith(root)) return null;
  return file;
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

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(port, resolve));

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 15000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const failures = [];

  try {
    for (const pagePath of pages) {
      for (const vp of viewports) {
        const page = await browser.newPage();
        const consoleErrors = [];
        try {
          page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('ERR_NETWORK_ACCESS_DENIED')) consoleErrors.push(msg.text());
          });
          page.on('pageerror', err => consoleErrors.push(err.message));
          await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: true });
          await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(350);

          const result = await page.evaluate(() => {
            const vw = window.innerWidth;
            const isClipped = el => {
              let a = el.parentElement;
              while (a && a !== document.body && a !== document.documentElement) {
                const ox = getComputedStyle(a).overflowX;
                if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
                a = a.parentElement;
              }
              return false;
            };
            const hits = [];
            document.querySelectorAll('body *').forEach(el => {
              if (el.classList && el.classList.contains('skip-link')) return;
              if (el.closest('.step-tabs, .steps-tabs')) return;
              if (isClipped(el)) return;
              const r = el.getBoundingClientRect();
              if (r.right - vw > 4 && r.width > 0) {
                hits.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || '',
                  className: String(el.className || '').slice(0, 70),
                  right: Math.round(r.right),
                  text: (el.textContent || '').trim().slice(0, 40)
                });
              }
            });
            hits.sort((a, b) => b.right - a.right);
            return { docW: document.documentElement.scrollWidth, vw, hits: hits.slice(0, 5) };
          });

          const scrolls = result.docW > result.vw + 1;
          if (scrolls || result.hits.length) {
            const culprits = result.hits.map(h => `${h.tag}${h.id ? '#' + h.id : ''}.${h.className} right ${h.right} "${h.text}"`).join(' | ');
            failures.push(`${pagePath} ${vp.name}(${vp.width}): docW ${result.docW} vs ${result.vw}${culprits ? ' :: ' + culprits : ''}`);
          }
          if (consoleErrors.length) {
            failures.push(`${pagePath} ${vp.name}: console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);
          }
        } catch (err) {
          failures.push(`${pagePath} ${vp.name}: ${err.message}`);
        } finally {
          await page.close().catch(() => {});
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('Mobile pass failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }

  console.log(`Mobile pass passed: ${pages.length} hubs across ${viewports.length} phone widths (390 and 320).`);
})();
