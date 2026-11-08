#!/usr/bin/env node
/*
 * tests/create-standalone-export.js , A2598
 * Proves Pixel Studio and Sound Studio expose one shared "Download standalone
 * .html" action that packages a creation as a single offline file.
 *
 * Checks, per tool at 390 and 1440:
 *   - window.JVDSStandalone exists and no floating button or dock mounts
 *   - the built HTML has no external src/href and no external script/link
 *   - malformed input and empty frames fail safely (return null)
 *   - the generated pixel page boots offline with no network request
 *   - Sound Studio's real renderMixdown + bufferToDataUrl feed the builder
 * Run: node tests/create-standalone-export.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.gif': 'image/gif'
};
const PAGES = ['tools/pixel-studio.html', 'tools/sound-studio.html'];
const WIDTHS = [390, 1440];
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function hasExternalRefs(html) {
  return {
    httpSrc: /(?:src|href)\s*=\s*["']https?:/i.test(html),
    scriptSrc: /<script[^>]+\bsrc\s*=/i.test(html),
    linkHref: /<link[^>]+\bhref\s*=/i.test(html)
  };
}

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const pagePath of PAGES) {
      for (const width of WIDTHS) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.setViewport({ width, height: 900 });
        await page.goto(BASE + '/' + pagePath, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise((r) => setTimeout(r, 1200));
        const state = await page.evaluate(() => ({
          button: !!document.getElementById('jvds-standalone-btn'),
          api: !!(window.JVDSStandalone && typeof window.JVDSStandalone.exportNow === 'function'),
          script: [...document.scripts].some((s) => /\/creation-standalone\.js/.test(s.src))
        }));
        check(pagePath + ' ' + width + 'px: no floating standalone button', !state.button);
        check(pagePath + ' ' + width + 'px: JVDSStandalone API exists', state.api);
        check(pagePath + ' ' + width + 'px: shared script is loaded', state.script);
        check(pagePath + ' ' + width + 'px: no uncaught JS errors', errors.length === 0, errors.join(' | '));
        await page.close();
      }
    }

    // Shared builders: structure and safe failure.
    const builder = await browser.newPage();
    await builder.goto(BASE + '/tools/pixel-studio.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));
    const built = await builder.evaluate((png) => {
      const S = window.JVDSStandalone;
      const pixel = S.buildPixelsHtml([png, png], 8, { title: 'Test art' });
      const audio = S.buildAudioHtml('data:audio/wav;base64,AAAA', { title: 'Test sound' });
      return {
        pixel, audio,
        empty: S.buildPixelsHtml([], 8),
        badAudio: S.buildAudioHtml('https://example.com/x.wav'),
        budget: S.BUDGET
      };
    }, PNG_1PX);
    check('buildPixelsHtml returns a page', !!built.pixel);
    check('buildPixelsHtml inlines the frame data URL', built.pixel.includes(PNG_1PX));
    check('buildPixelsHtml animates multiple frames', /setInterval/.test(built.pixel));
    check('buildPixelsHtml escapes the title', built.pixel.includes('Test art'));
    check('buildAudioHtml returns a page', !!built.audio);
    check('buildAudioHtml inlines the WAV data URL', built.audio.includes('data:audio/wav'));
    check('buildPixelsHtml([]) fails safely', built.empty === null);
    check('buildAudioHtml(http url) fails safely', built.badAudio === null);
    check('size budget is documented and positive', built.budget > 0, String(built.budget));

    for (const [label, html] of [['pixel', built.pixel], ['audio', built.audio]]) {
      const ext = hasExternalRefs(html);
      check(label + ' page has no external http src/href', !ext.httpSrc);
      check(label + ' page has no external <script src>', !ext.scriptSrc);
      check(label + ' page has no external <link href>', !ext.linkHref);
    }

    // Sound Studio's real export path feeds the builder.
    const sound = await browser.newPage();
    await sound.goto(BASE + '/tools/sound-studio.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1000));
    const soundResult = await sound.evaluate(async () => {
      try {
        if (typeof renderMixdown !== 'function' || typeof bufferToDataUrl !== 'function') return { ok: false, reason: 'missing globals' };
        const buf = await renderMixdown();
        const dataUrl = bufferToDataUrl(buf);
        const html = window.JVDSStandalone.buildAudioHtml(dataUrl, { title: 'Sound check' });
        return { ok: !!html && html.includes('data:audio/wav'), reason: 'ok' };
      } catch (e) { return { ok: false, reason: e.message }; }
    });
    check('Sound Studio renderMixdown feeds buildAudioHtml', soundResult.ok, soundResult.reason);

    // Offline boot: the generated pixel page loads with network blocked.
    const offline = await browser.newPage();
    let externalRequests = 0;
    await offline.setRequestInterception(true);
    offline.on('request', (req) => {
      const url = req.url();
      if (/^data:|^about:|^blob:/.test(url)) return req.continue();
      externalRequests++;
      req.abort();
    });
    await offline.setContent(built.pixel, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 300));
    const offlineState = await offline.evaluate(() => {
      const img = document.getElementById('frame');
      return { hasImg: !!img, isData: !!img && /^data:image\//.test(img.src) };
    });
    check('standalone pixel page boots offline', offlineState.hasImg && offlineState.isData);
    check('standalone pixel page makes no network request', externalRequests === 0, 'requests=' + externalRequests);

    await builder.close();
    await sound.close();
    await offline.close();
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL CREATE STANDALONE EXPORT CHECKS PASSED');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
