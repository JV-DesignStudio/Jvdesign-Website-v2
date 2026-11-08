#!/usr/bin/env node
/*
 * tests/pixel-studio-share-link.js
 * A2801: the Share action carries the sprite itself.
 *   - pixelShareLink() returns a #art= link for a drawn frame
 *   - opening that link on a fresh device restores the art
 *   - a Showcase banner names the shared creation and gives one Echo line
 *   - the old {N, grid} #art= format still imports
 * Run: node tests/pixel-studio-share-link.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PSSHARE_PORT || 8147;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const base = `http://127.0.0.1:${PORT}`;

  try {
    // --- Draw a known pixel on a clean device ---
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${base}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('jvds_pixel_seen', '1'); } catch (e) {} });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

    const link = await page.evaluate(() => {
      setCanvasSize(8, 8, false);
      frames = [[new ImageData(8, 8)]];
      currentFrame = 0; currentLayer = 0;
      setPixel(getID(), 1, 1, 255, 0, 0, 255);
      setPixel(getID(), 2, 1, 0, 200, 40, 255);
      renderAll();
      var feedback = pixelEchoFeedback();
      return {
        link: pixelShareLink(),
        feedback: feedback,
        emptyLink: (function () { var old = frames; frames = [[new ImageData(8, 8)]]; var l = pixelShareLink(); frames = old; return l; })()
      };
    });

    check('drawn frame produces a share link', !!link.link, link.link ? link.link.slice(0, 48) + '...' : 'empty');
    check('share link carries #art=', /#art=/.test(link.link || ''), '');
    check('share link is a Pixel Studio URL', !!link.link && link.link.indexOf(base + '/tools/pixel-studio.html#art=') === 0, '');
    check('link stays a sensible length', !!link.link && link.link.length < 4000, String((link.link || '').length));
    check('empty canvas does not produce a link', link.emptyLink === '', link.emptyLink ? 'unexpected link' : '');
    check('Echo feedback is specific and kind', /^Echo:/.test(link.feedback || '') && (link.feedback || '').length > 40, link.feedback);
    check('no runtime errors while drawing', errors.length === 0, errors.join(' | '));

    // A2804: a QR modal turns the same link into something a phone can scan.
    const qr = await page.evaluate(() => {
      showPixelQR();
      const modal = document.getElementById('pixel-qr-modal');
      const img = modal ? modal.querySelector('img') : null;
      const out = { open: !!modal, src: img ? img.getAttribute('src') || '' : '' };
      if (modal) modal.remove();
      return out;
    });
    check('QR modal shows a scannable code', qr.open && /^data:image\//.test(qr.src), qr.src.slice(0, 26));

    // --- Open the link on a fresh device (separate storage) ---
    const ctx = browser.createIncognitoBrowserContext
      ? await browser.createIncognitoBrowserContext()
      : await browser.createBrowserContext();
    const fresh = await ctx.newPage();
    const freshErrors = [];
    fresh.on('pageerror', e => freshErrors.push('pageerror: ' + e.message));
    await fresh.setViewport({ width: 390, height: 844, isMobile: true });
    await fresh.goto(link.link, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const arrived = await fresh.evaluate(() => {
      var px = typeof getPixel === 'function' ? getPixel(getID(), 1, 1) : null;
      var banner = document.getElementById('shared-art-banner');
      return {
        size: typeof cW === 'number' ? cW + 'x' + cH : '',
        px: px,
        banner: !!banner,
        bannerText: banner ? banner.textContent : '',
        hasMake: !!(banner && /Make your own/i.test(banner.textContent))
      };
    });

    check('fresh device restores the canvas size', arrived.size === '8x8', arrived.size);
    check('fresh device restores the pixels', Array.isArray(arrived.px) && arrived.px[0] === 255 && arrived.px[1] === 0 && arrived.px[2] === 0 && arrived.px[3] === 255, JSON.stringify(arrived.px));
    check('fresh device shows the Showcase banner', arrived.banner, '');
    check('banner names the shared creation and Echo', /Someone shared this/i.test(arrived.bannerText) && /Echo:/.test(arrived.bannerText), arrived.bannerText.slice(0, 120));
    check('banner offers Make your own', arrived.hasMake, '');
    check('no horizontal scroll on the shared view', await fresh.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '');
    check('no runtime errors on the shared view', freshErrors.length === 0, freshErrors.join(' | '));
    await ctx.close();

    // --- A multi-frame animation carries every frame ---
    const multi = await page.evaluate(() => {
      setCanvasSize(8, 8, false);
      var f0 = new ImageData(8, 8); setPixel(f0, 0, 0, 255, 0, 0, 255);
      var f1 = new ImageData(8, 8); setPixel(f1, 1, 0, 0, 0, 255, 255);
      frames = [[f0], [f1]];
      frameMeta = [{ clip: 'default', hold: 1 }, { clip: 'default', hold: 1 }];
      currentFrame = 0; currentLayer = 0; renderAll();
      var link = pixelShareLink();
      var data = JSON.parse(atob(link.split('#art=')[1]));
      return { link: link, v: data.v, frames: Array.isArray(data.f) ? data.f.length : 0 };
    });
    check('multi-frame art shares every frame', multi.v === 3 && multi.frames === 2, 'v' + multi.v + ', frames ' + multi.frames);

    const ctx2 = browser.createIncognitoBrowserContext
      ? await browser.createIncognitoBrowserContext()
      : await browser.createBrowserContext();
    const anim = await ctx2.newPage();
    await anim.goto(multi.link, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    const animView = await anim.evaluate(() => ({
      frames: frames.length,
      a: getPixel(frames[0][0], 0, 0),
      b: getPixel(frames[1][0], 1, 0)
    }));
    check('multi-frame link restores both frames', animView.frames === 2 && animView.a[0] === 255 && animView.b[2] === 255, JSON.stringify(animView));
    await anim.close();
    await ctx2.close();

    // --- Legacy {N, grid} link still imports (headline promises it) ---
    const legacy = await browser.newPage();
    const legacyB64 = Buffer.from(JSON.stringify({ N: 4, grid: ['#ff0000', null, null, null, ...Array(12).fill(null)] })).toString('base64');
    await legacy.goto(`${base}/tools/pixel-studio.html#art=${legacyB64}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    const legacyPx = await legacy.evaluate(() => (typeof getPixel === 'function' ? getPixel(getID(), 0, 0) : null));
    check('legacy {N,grid} share link still imports', Array.isArray(legacyPx) && legacyPx[0] === 255 && legacyPx[3] === 255, JSON.stringify(legacyPx));

    await page.close();
    await legacy.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? 'FAILURES PRESENT (' + failures + ')' : 'ALL PIXEL STUDIO SHARE-LINK CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
