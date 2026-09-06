const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8981;

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

const pages = [
  '/pages/workshop.html',
  '/workshops/unreal-blueprint-shooter.html',
  '/workshops/unreal-clicker-builder.html',
  '/workshops/unreal-2d-platformer.html',
  '/workshops/racing-blueprint.html',
  '/workshops/unreal-fighter-workshop.html',
  '/workshops/unreal-zombie-survivor.html'
];

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 900 }
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
    for (const pagePath of pages) {
      for (const vp of viewports) {
        console.log(`Checking ${pagePath} at ${vp.name}...`);
        const page = await browser.newPage();
        const consoleErrors = [];
        try {
          page.on('console', msg => {
          if (msg.type() === 'error' && !msg.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
            consoleErrors.push(msg.text());
          }
          });
          page.on('pageerror', err => consoleErrors.push(err.message));
          await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: vp.name === 'phone' });
          await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(350);

          const result = await page.evaluate(() => {
            const doc = document.documentElement;
            const body = document.body;
            const maxScroll = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
            const viewportWidth = window.innerWidth;
            const hasBlueprint = Boolean(document.querySelector('.bp-outer, .bp-canvas-wrap'));
            let widest = null;
            document.querySelectorAll('body *').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (el.classList && el.classList.contains('skip-link')) return;
              if (el.closest('.step-tabs, .steps-tabs')) return;
              const overflow = Math.max(0, rect.right - viewportWidth);
              if (overflow > 4 && (!widest || overflow > widest.overflow)) {
                widest = {
                  tag: el.tagName.toLowerCase(),
                  id: el.id || '',
                  className: String(el.className || '').slice(0, 90),
                  width: Math.round(rect.width),
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                  overflow: Math.round(overflow)
                };
              }
            });
            return {
              overflow: widest ? widest.overflow : Math.max(0, maxScroll - viewportWidth),
              hasLessonMap: Boolean(document.querySelector('.lesson-map')),
              hasBlueprint,
              hasBlueprintCoach: Boolean(document.querySelector('.blueprint-coach')),
              widest
            };
          });

          if (result.overflow > 4) {
            const culprit = result.widest ? ` (${result.widest.tag}#${result.widest.id}.${result.widest.className} width ${result.widest.width}px right ${result.widest.right}px)` : '';
            failures.push(`${pagePath} ${vp.name}: horizontal overflow ${result.overflow}px${culprit}`);
          }
          if (pagePath.includes('/workshops/') && !result.hasLessonMap) {
            failures.push(`${pagePath} ${vp.name}: missing lesson map`);
          }
          if (result.hasBlueprint && !result.hasBlueprintCoach) {
            failures.push(`${pagePath} ${vp.name}: missing Blueprint coach`);
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
    console.error('Workshop responsive smoke failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }

  console.log(`Workshop responsive smoke passed: ${pages.length} pages across ${viewports.length} viewports.`);
})();
