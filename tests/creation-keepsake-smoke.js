#!/usr/bin/env node
/* A676: rendered check that the shared keepsake strip appears on curated create
   tools at 390 and 1440, sits inside the viewport, and wires the export action. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8999;
const TOOLS = ['level-designer', 'sound-studio', 'sprite-animator', 'trading-card-designer'];
const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true },
  { name: 'desktop', width: 1440, height: 900, isMobile: false }
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
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
    for (const tool of TOOLS) {
      for (const vp of viewports) {
        const label = `${tool} @ ${vp.name}`;
        const page = await browser.newPage();
        try {
          const pageErrors = [];
          page.on('pageerror', err => pageErrors.push(err.message));
          await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: vp.isMobile });
          await page.goto(`http://127.0.0.1:${port}/tools/${tool}.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(900);

          const result = await page.evaluate(() => {
            const strip = document.getElementById('jvds-keepsake-strip');
            const btn = document.getElementById('jk-keep-export');
            const cert = document.getElementById('jk-keep-cert');
            const rect = strip ? strip.getBoundingClientRect() : null;
            return {
              hasStrip: Boolean(strip),
              hasBtn: Boolean(btn),
              btnText: btn ? btn.textContent.trim() : '',
              certHref: cert ? cert.getAttribute('href') : '',
              position: strip ? getComputedStyle(strip).position : '',
              inside: rect ? (rect.left >= -1 && rect.right <= window.innerWidth + 1) : false,
              overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
            };
          });

          if (!result.hasStrip) failures.push(`${label}: keepsake strip missing`);
          if (!result.hasBtn) failures.push(`${label}: export button missing`);
          if (result.btnText !== 'Export to keep') failures.push(`${label}: export label "${result.btnText}"`);
          if (!/certificate\.html/.test(result.certHref)) failures.push(`${label}: certificate link missing`);
          if (result.position !== 'fixed') failures.push(`${label}: strip not fixed (${result.position})`);
          if (!result.inside) failures.push(`${label}: strip outside viewport`);
          if (result.overflow > 4) failures.push(`${label}: horizontal overflow ${result.overflow}px`);
          if (pageErrors.length) failures.push(`${label}: page errors: ${pageErrors.slice(0, 2).join(' | ')}`);

          if (result.hasBtn) {
            const wired = await page.evaluate(async () => {
              window.__kept = false;
              window.__called = false;
              window.addEventListener('jvds:keepsake-export', () => { window.__kept = true; });
              window.JVDSKeepsakeExport = function () { window.__called = true; };
              document.getElementById('jk-keep-export').click();
              await new Promise(r => setTimeout(r, 120));
              return { kept: window.__kept, called: window.__called };
            });
            if (!wired.kept) failures.push(`${label}: export did not fire jvds:keepsake-export`);
            if (!wired.called) failures.push(`${label}: export did not invoke the tool export hook`);
          }
        } catch (err) {
          failures.push(`${label}: ${err.message}`);
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
    console.error('creation-keepsake smoke failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log(`creation-keepsake smoke passed: ${TOOLS.length} tools x ${viewports.length} viewports.`);
})();
