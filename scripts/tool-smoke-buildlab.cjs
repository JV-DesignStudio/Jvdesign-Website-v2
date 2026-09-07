const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8982;
const pagePath = '/tools/buildlab.html';

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
      console.log(`Checking BuildLab at ${vp.name}...`);
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
        await sleep(650);

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

          const viewport = document.getElementById('viewport');
          const statusText = document.getElementById('engineStatus')?.textContent || '';
          return {
            headers: document.querySelectorAll('header.site-header').length,
            skipLinks: document.querySelectorAll('.skip-link').length,
            footers: document.querySelectorAll('.jvds-tools-footer').length,
            hasStatus: Boolean(document.getElementById('buildlabStatus')),
            hasCanvas: Boolean(document.querySelector('#viewport canvas')),
            hasEngineError: Boolean(viewport && viewport.classList.contains('engine-error')),
            statusText,
            overflow: widest ? widest.overflow : Math.max(0, doc.scrollWidth - viewportWidth, body ? body.scrollWidth - viewportWidth : 0),
            widest
          };
        });

        if (result.headers !== 1) failures.push(`${vp.name}: expected 1 shared header, found ${result.headers}`);
        if (result.skipLinks !== 1) failures.push(`${vp.name}: expected 1 skip link, found ${result.skipLinks}`);
        if (result.footers !== 1) failures.push(`${vp.name}: expected 1 tools footer, found ${result.footers}`);
        if (!result.hasStatus) failures.push(`${vp.name}: missing BuildLab engine status badge`);
        if (!result.hasCanvas && !result.hasEngineError) {
          failures.push(`${vp.name}: engine produced neither a canvas nor a helpful error state (${result.statusText})`);
        }
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
    console.error('BuildLab smoke failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }

  console.log(`BuildLab smoke passed across ${viewports.length} viewports.`);
})();
