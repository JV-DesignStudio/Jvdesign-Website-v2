// A1587: one project bundle shared by Pixel Studio, Sprite Animator and the
// Arcade Game Maker. Proves download + "Open in..." round trips between all
// three, and that opening a downloaded file works, at 390 and 1440.
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19289;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.map': 'application/json', '.txt': 'text/plain', '.tres': 'text/plain' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
const listen = () => new Promise((resolve) => server.listen(port, resolve));

let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

function makePage(browser, errors) {
  return browser.newPage().then(async (page) => {
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const t = m.text();
        if (!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ServiceWorker|sw\.js|is\.gd|The operation was aborted/i.test(t)) errors.push('console: ' + t);
      }
    });
    return page;
  });
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ---- Pixel Studio (390): build + download one bundle ------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0', { timeout: 15000 });

    const out = await page.evaluate(async () => {
      // deterministic 2-frame 8x8 project
      const px = new Array(8 * 8 * 4).fill(0);
      for (let i = 0; i < px.length; i += 4) { px[i] = 200; px[i + 1] = 80; px[i + 2] = 120; px[i + 3] = 255; }
      applyProject({ v: 2, cW: 8, cH: 8, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[px.slice()], [px.slice()]] });
      const bundle = buildProjectBundle();
      // download path (stub the shared downloader)
      const names = [];
      const orig = window.downloadBlob;
      window.downloadBlob = (blob, name) => { names.push(name); window.__blob = blob; };
      downloadProjectBundle();
      window.downloadBlob = orig;
      const text = window.__blob ? await window.__blob.text() : null;
      // "Open in..." wiring
      const calls = [];
      const origOpen = window.JVDSProjectBundle.openIn;
      window.JVDSProjectBundle.openIn = (t) => { calls.push(t); return true; };
      openInSpriteAnimator(); openInGameMaker();
      window.JVDSProjectBundle.openIn = origOpen;
      return {
        title: document.title,
        hasBundle: !!(bundle && bundle.app === 'jvds-tool-bundle'),
        tool: bundle && bundle.tool,
        spriteData: !!(bundle && bundle.sprite && /^data:image\/png/.test(bundle.sprite.dataUrl)),
        frameCount: bundle && bundle.project && bundle.project.frames && bundle.project.frames.length,
        fileName: names[0] || '',
        parsed: !!(text && window.JVDSProjectBundle.parse(text)),
        openCalls: calls,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    });
    check('pixel-studio: builds a valid bundle', out.hasBundle && out.tool === 'pixel-studio', JSON.stringify({ tool: out.tool, frameCount: out.frameCount }));
    check('pixel-studio: bundle carries a PNG sprite', out.spriteData);
    check('pixel-studio: download writes a *-jvds-project.json', /-jvds-project\.json$/.test(out.fileName) && out.parsed, out.fileName);
    check('pixel-studio: Open in... targets Sprite Animator + Game Maker', out.openCalls.join(',') === 'sprite-animator,arcade-game-maker', out.openCalls.join(','));
    check('pixel-studio: 390 no overflow', out.scrollWidth <= out.clientWidth + 2, `${out.scrollWidth}/${out.clientWidth}`);
    check('pixel-studio: zero runtime errors', errors.length === 0, errors.join(' | '));

    // hand the bundle to Sprite Animator the way "Open in..." does
    await page.evaluate((b) => {
      localStorage.setItem('jvds_tool_bundle', JSON.stringify(b));
      localStorage.setItem('jvds_tool_bundle_to', 'sprite-animator');
    }, await page.evaluate(() => buildProjectBundle()));
    await page.close();
  }

  // ---- Sprite Animator (1440): consume the bundle, download, file-open ----
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/sprite-animator.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('(typeof activeFrames!=="undefined") && activeFrames.length>0', { timeout: 15000 });

    const out = await page.evaluate(async () => {
      const cut = { framesLoaded: activeFrames.length, promptHidden: document.getElementById('uploadPrompt').classList.contains('hidden'), sheetW: sheetW };
      const bundle = buildProjectBundle();
      const names = [];
      const orig = window.downloadBlob;
      window.downloadBlob = (blob, name) => { names.push(name); window.__blob = blob; };
      downloadProjectBundle();
      window.downloadBlob = orig;
      const text = window.__blob ? await window.__blob.text() : null;
      const calls = [];
      const origOpen = window.JVDSProjectBundle.openIn;
      window.JVDSProjectBundle.openIn = (t) => { calls.push(t); return true; };
      openInPixelStudio(); openInGameMaker();
      window.JVDSProjectBundle.openIn = origOpen;
      return {
        cut, tool: bundle && bundle.tool,
        fileName: names[0] || '', parsed: !!(text && window.JVDSProjectBundle.parse(text)),
        openCalls: calls,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    });
    check('sprite-animator: opens the Pixel Studio bundle', out.cut.framesLoaded >= 1 && out.cut.promptHidden, JSON.stringify(out.cut));
    check('sprite-animator: downloads its own bundle', out.tool === 'sprite-animator' && /-jvds-project\.json$/.test(out.fileName) && out.parsed, out.fileName);
    check('sprite-animator: Open in... targets Pixel Studio + Game Maker', out.openCalls.join(',') === 'pixel-studio,arcade-game-maker', out.openCalls.join(','));
    check('sprite-animator: 1440 no overflow', out.scrollWidth <= out.clientWidth + 2, `${out.scrollWidth}/${out.clientWidth}`);
    check('sprite-animator: zero runtime errors', errors.length === 0, errors.join(' | '));

    // prove the file-open path: write a bundle to disk and upload it to the hidden input
    const bundleJson = await page.evaluate(async () => {
      const b = buildProjectBundle();
      // tweak name so we can see the state change
      return JSON.stringify(b);
    });
    const tmpFile = path.join(os.tmpdir(), 'jvds-test-bundle-' + Date.now() + '.json');
    fs.writeFileSync(tmpFile, bundleJson);
    await page.evaluate(() => { sheetImg = null; frames = []; activeFrames = []; document.getElementById('uploadPrompt').classList.remove('hidden'); });
    const input = await page.$('#bundleFileInput');
    await input.uploadFile(tmpFile);
    await page.waitForFunction('(typeof activeFrames!=="undefined") && activeFrames.length>0', { timeout: 10000 });
    const fileOpen = await page.evaluate(() => ({ framesLoaded: activeFrames.length, promptHidden: document.getElementById('uploadPrompt').classList.contains('hidden') }));
    check('sprite-animator: opens a downloaded bundle file', fileOpen.framesLoaded >= 1 && fileOpen.promptHidden, JSON.stringify(fileOpen));
    fs.unlinkSync(tmpFile);

    // hand to the Game Maker
    await page.evaluate((b) => {
      localStorage.setItem('jvds_tool_bundle', JSON.stringify(b));
      localStorage.setItem('jvds_tool_bundle_to', 'arcade-game-maker');
    }, JSON.parse(bundleJson));
    await page.close();
  }

  // ---- Game Maker (390): consume the bundle -----------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof customSpriteDataUrl!=="undefined")', { timeout: 20000 });
    await page.waitForFunction('customSpriteDataUrl !== null', { timeout: 10000 }).catch(() => {});

    const out = await page.evaluate(async () => {
      const spriteSet = !!customSpriteDataUrl;
      const bundle = buildProjectBundle();
      const native = (() => {
        try { applyBundleToGameMaker(bundle); return true; } catch (e) { return false; }
      })();
      const names = [];
      const orig = window.downloadBlob;
      window.downloadBlob = (blob, name) => { names.push(name); };
      downloadProjectBundle();
      window.downloadBlob = orig;
      const calls = [];
      const origOpen = window.JVDSProjectBundle.openIn;
      window.JVDSProjectBundle.openIn = (t) => { calls.push(t); return true; };
      openInPixelStudio(); openInSpriteAnimator();
      window.JVDSProjectBundle.openIn = origOpen;
      return {
        spriteSet, native, tool: bundle && bundle.tool,
        fileName: names[0] || '', openCalls: calls,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    });
    check('game-maker: opens the Sprite Animator bundle as art', out.spriteSet);
    check('game-maker: builds + downloads its own bundle', out.tool === 'arcade-game-maker' && /-jvds-project\.json$/.test(out.fileName), out.fileName);
    check('game-maker: opening its own bundle round-trips', out.native);
    check('game-maker: Open in... targets Pixel Studio + Sprite Animator', out.openCalls.join(',') === 'pixel-studio,sprite-animator', out.openCalls.join(','));
    check('game-maker: 390 no overflow', out.scrollWidth <= out.clientWidth + 2, `${out.scrollWidth}/${out.clientWidth}`);
    check('game-maker: zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PROJECT BUNDLE CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
