// A2296: the .jvds project file keeps art, sound, level and game data in one
// named file. Proves a Game Maker project round-trips those parts, that a
// Pixel Studio file reopens with its frames, and that old v1 files still open.
// Run: node tests/project-file-roundtrip.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_ROUNDTRIP_PORT || 19290);
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

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

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

  // ---- Pixel Studio: build, download, reopen the art at 390 -------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0', { timeout: 15000 });

    const out = await page.evaluate(async (PNG) => {
      const px = new Array(8 * 8 * 4).fill(0);
      for (let i = 0; i < px.length; i += 4) { px[i] = 200; px[i + 1] = 80; px[i + 2] = 120; px[i + 3] = 255; }
      applyProject({ v: 2, cW: 8, cH: 8, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[px.slice()], [px.slice()]] });
      const bundle = buildProjectBundle();
      const names = [];
      const orig = window.downloadBlob;
      window.downloadBlob = (blob, name) => { names.push(name); window.__blob = blob; };
      downloadProjectBundle();
      window.downloadBlob = orig;
      const text = window.__blob ? await window.__blob.text() : null;
      const parsed = text ? window.JVDSProjectBundle.parse(text) : null;
      const before = frames.length;
      frames = [];
      applyBundleToPixelStudio(parsed);
      return {
        version: parsed && parsed.v,
        tool: parsed && parsed.tool,
        fileName: names[0] || '',
        hasSprite: !!(parsed && parsed.sprite && /^data:image\/png/.test(parsed.sprite.dataUrl)),
        framesBefore: before,
        framesAfter: frames.length,
        pngOk: /^data:image\/png/.test(PNG),
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      };
    }, PNG);

    check('pixel-studio: exports a v2 .jvds file', out.version === 2 && out.tool === 'pixel-studio' && /\.jvds$/.test(out.fileName), out.fileName);
    check('pixel-studio: file carries the sprite sheet', out.hasSprite);
    check('pixel-studio: reopens with both frames', out.framesBefore === 2 && out.framesAfter === 2, `${out.framesBefore}/${out.framesAfter}`);
    check('pixel-studio: 390 no overflow', out.scroll <= out.client + 2, `${out.scroll}/${out.client}`);
    check('pixel-studio: zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- Game Maker: art + sound + level + game data at 1440 --------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof customSpriteDataUrl!=="undefined") && !!window.GameAudio && !!window.JVDSProjectBundle', { timeout: 25000 });

    const out = await page.evaluate(async ({ PNG, WAV }) => {
      customSpriteDataUrl = PNG;
      customSpriteFrameCount = 1;
      customSpriteFrameW = 1;
      GameAudio.customMusic = WAV;
      GameAudio.customBuffers = { jump: WAV };
      customLevelMap = Array.from({ length: 300 }, (_, i) => (i % 20 === 0 ? 1 : 0));
      customLevelEntities = { coins: [[2, 2]], enemies: [[3, 3]], spawn: [1, 1], goal: [10, 10] };

      const bundle = buildProjectBundle();
      const names = [];
      const orig = window.downloadBlob;
      window.downloadBlob = (blob, name) => { names.push(name); window.__blob = blob; };
      downloadProjectBundle();
      window.downloadBlob = orig;
      const text = window.__blob ? await window.__blob.text() : null;
      const parsed = text ? window.JVDSProjectBundle.parse(text) : null;

      const built = {
        version: bundle && bundle.v,
        hasSound: !!(bundle && bundle.sound && bundle.sound.music === WAV),
        soundName: bundle && bundle.sound && bundle.sound.name,
        levelLength: bundle && bundle.level && bundle.level.map && bundle.level.map.length,
        fileName: names[0] || '',
        parsedOk: !!parsed
      };

      customSpriteDataUrl = null;
      customLevelMap = null;
      customLevelEntities = null;
      GameAudio.customMusic = null;
      GameAudio.customBuffers = {};
      applyBundleToGameMaker(parsed);

      return {
        built,
        restored: {
          sprite: customSpriteDataUrl === PNG,
          music: GameAudio.customMusic === WAV,
          jumpBuffer: GameAudio.customBuffers && GameAudio.customBuffers.jump === WAV,
          mapLength: customLevelMap ? customLevelMap.length : 0,
          coins: customLevelEntities && customLevelEntities.coins ? customLevelEntities.coins.length : 0,
          spawn: customLevelEntities && customLevelEntities.spawn ? customLevelEntities.spawn.join(',') : ''
        },
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      };
    }, { PNG, WAV });

    check('game-maker: exports a v2 .jvds file', out.built.version === 2 && /\.jvds$/.test(out.built.fileName), out.built.fileName);
    check('game-maker: file carries the music track', out.built.hasSound, out.built.soundName);
    check('game-maker: file carries the 20x15 level', out.built.levelLength === 300, String(out.built.levelLength));
    check('game-maker: reopens with its sprite', out.restored.sprite);
    check('game-maker: reopens with its music and SFX', out.restored.music && out.restored.jumpBuffer);
    check('game-maker: reopens with its level and entities', out.restored.mapLength === 300 && out.restored.coins === 1 && out.restored.spawn === '1,1', JSON.stringify(out.restored));
    check('game-maker: 1440 no overflow', out.scroll <= out.client + 2, `${out.scroll}/${out.client}`);
    check('game-maker: zero runtime errors', errors.length === 0, errors.join(' | '));

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await new Promise((r) => setTimeout(r, 300));
    const narrow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    check('game-maker: 390 no overflow', narrow.scroll <= narrow.client + 2, `${narrow.scroll}/${narrow.client}`);
    await page.close();
  }

  // ---- Compatibility and corrupt input ----------------------------------
  {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('!!window.JVDSProjectBundle', { timeout: 15000 });
    const out = await page.evaluate(() => {
      const v1 = window.JVDSProjectBundle.parse(JSON.stringify({ app: 'jvds-tool-bundle', v: 1, tool: 'pixel-studio', name: 'old', project: { a: 1 }, sprite: null }));
      const junk = window.JVDSProjectBundle.parse('{not json');
      const wrong = window.JVDSProjectBundle.parse(JSON.stringify({ app: 'other', v: 2 }));
      return {
        v1: v1 ? { v: v1.v, sound: v1.sound, level: v1.level, project: v1.project.a } : null,
        junk: junk === null,
        wrong: wrong === null
      };
    });
    check('compat: a v1 file opens as v2 with empty sound and level', !!out.v1 && out.v1.v === 2 && out.v1.sound === null && out.v1.level === null && out.v1.project === 1, JSON.stringify(out.v1));
    check('compat: broken JSON fails safely', out.junk);
    check('compat: a foreign file is rejected', out.wrong);
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL .JVDS ROUNDTRIP CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
