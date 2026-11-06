// Shared harness for the Audio Studio feature tests (A2069, A2108, A2109, A2110).
// Serves the real page over HTTP so the page CSP and relative assets behave the
// same as production, and opens it in headless Chrome.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..', '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.zip': 'application/zip'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function open(opts = {}) {
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/Failed to load resource|net::ERR_FAILED|ERR_NETWORK_ACCESS_DENIED/.test(text)) return;
    errors.push('console: ' + text);
  });
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('jvds_sound_seen', '1');
      localStorage.removeItem('jvds_sound_auto');
    } catch (e) {}
  });
  await page.setViewport({ width: opts.width || 1200, height: opts.height || 900 });
  const response = await page.goto(base + '/tools/sound-studio.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(opts.settle || 1200);
  await page.evaluate(() => {
    try { closeStart && closeStart(); } catch (e) {}
    document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
  });
  return {
    page, browser, server, base, errors, sleep,
    async close() {
      try { await browser.close(); } catch (e) {}
      try { server.close(); } catch (e) {}
    }
  };
}

module.exports = { open, sleep, ROOT };
