const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8983;
const pagePath = '/tools/bitmap-font-maker.html';

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

const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true },
  { name: 'desktop', width: 1366, height: 900, isMobile: false }
];

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
    if (!file) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

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
    protocolTimeout: 10000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const failures = [];

  try {
    for (const vp of viewports) {
      console.log(`Checking Bitmap Font Maker at ${vp.name}...`);
      const page = await browser.newPage();
      const consoleErrors = [];
      try {
        page.on('console', msg => {
          const text = msg.text();
          if (msg.type() !== 'error') return;
          if (text.includes('ERR_NETWORK_ACCESS_DENIED')) return;
          if (text.includes('Failed to load resource')) return;
          consoleErrors.push(text);
        });
        page.on('pageerror', err => consoleErrors.push(err.message));

        await page.setViewport({
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          isMobile: vp.isMobile
        });
        await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(500);

        const result = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const viewportWidth = window.innerWidth;
          let widest = null;
          document.querySelectorAll('body *').forEach(el => {
            if (el.classList && el.classList.contains('skip-link')) return;
            const rect = el.getBoundingClientRect();
            const overflow = Math.max(0, rect.right - viewportWidth);
            if (overflow > 4 && (!widest || overflow > widest.overflow)) {
              widest = {
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                className: String(el.className || '').slice(0, 90),
                width: Math.round(rect.width),
                right: Math.round(rect.right),
                overflow: Math.round(overflow)
              };
            }
          });

          return {
            headers: document.querySelectorAll('header.site-header').length,
            localHeaders: document.querySelectorAll('header.hdr').length,
            skipLinks: document.querySelectorAll('.skip-link').length,
            footers: document.querySelectorAll('.jvds-tools-footer').length,
            hasBrief: Boolean(document.querySelector('.bitmap-brief')),
            hasCanvas: Boolean(document.getElementById('grid-canvas')),
            hasPreview: Boolean(document.getElementById('pv-canvas')),
            overflow: widest ? widest.overflow : Math.max(0, doc.scrollWidth - viewportWidth, body ? body.scrollWidth - viewportWidth : 0),
            widest
          };
        });

        if (result.headers !== 1) failures.push(`${vp.name}: expected 1 shared header, found ${result.headers}`);
        if (result.localHeaders !== 0) failures.push(`${vp.name}: expected no local .hdr header, found ${result.localHeaders}`);
        if (result.skipLinks !== 1) failures.push(`${vp.name}: expected 1 skip link, found ${result.skipLinks}`);
        if (result.footers !== 1) failures.push(`${vp.name}: expected 1 tools footer, found ${result.footers}`);
        if (!result.hasBrief) failures.push(`${vp.name}: missing workflow brief`);
        if (!result.hasCanvas || !result.hasPreview) failures.push(`${vp.name}: missing editor or preview canvas`);
        if (result.overflow > 4) {
          const culprit = result.widest ? ` (${result.widest.tag}#${result.widest.id}.${result.widest.className} width ${result.widest.width}px right ${result.widest.right}px)` : '';
          failures.push(`${vp.name}: horizontal overflow ${result.overflow}px${culprit}`);
        }
        if (consoleErrors.length) {
          failures.push(`${vp.name}: console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);
        }
      } catch (err) {
        failures.push(`${vp.name}: ${err.message}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('Bitmap Font Maker smoke failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }

  console.log(`Bitmap Font Maker smoke passed across ${viewports.length} viewports.`);
})();
