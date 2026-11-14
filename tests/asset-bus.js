// A2589: the in-browser studio asset bus. Proves the last sprite, sound and
// level made in one studio can be used in Arcade Game Maker without a download
// or upload, that it survives a refresh, and that empty/corrupt storage is safe.
// Run: node tests/asset-bus.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_BUS_PORT || 19291);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.map': 'application/json', '.txt': 'text/plain' };

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

  // ---- Pixel Studio publishes a sprite at 390 ---------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && !!window.JVDSAssetBus', { timeout: 15000 });

    const out = await page.evaluate(() => {
      const px = new Array(8 * 8 * 4).fill(0);
      for (let i = 0; i < px.length; i += 4) { px[i] = 80; px[i + 1] = 200; px[i + 2] = 120; px[i + 3] = 255; }
      applyProject({ v: 2, cW: 8, cH: 8, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[px.slice()], [px.slice()]] });
      publishSpriteToBus();
      const items = window.JVDSAssetBus.list('sprite');
      return {
        count: items.length,
        png: !!(items[0] && /^data:image\/png/.test(items[0].payload.dataUrl)),
        frames: items[0] && items[0].payload.frameCount,
        tool: items[0] && items[0].tool,
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      };
    });
    check('pixel-studio: publishes its sprite to the bus', out.count === 1 && out.png && out.tool === 'pixel-studio', JSON.stringify({ count: out.count, tool: out.tool }));
    check('pixel-studio: bus keeps the frame count', out.frames === 2, String(out.frames));
    check('pixel-studio: 390 no overflow', out.scroll <= out.client + 2, `${out.scroll}/${out.client}`);
    check('pixel-studio: zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- Sound Studio publishes a sound at 1440 ---------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/sound-studio.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('typeof publishSoundToBus==="function" && !!window.JVDSAssetBus', { timeout: 15000 });

    const out = await page.evaluate((WAV) => {
      publishSoundToBus(WAV, 'Bus tune', 'music');
      const items = window.JVDSAssetBus.list('sound');
      return {
        count: items.length,
        name: items[0] && items[0].name,
        slot: items[0] && items[0].payload.slot,
        same: !!(items[0] && items[0].payload.dataUrl === WAV),
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      };
    }, WAV);
    check('sound-studio: publishes its sound to the bus', out.count === 1 && out.same && out.slot === 'music', out.name);
    check('sound-studio: 1440 no overflow', out.scroll <= out.client + 2, `${out.scroll}/${out.client}`);
    check('sound-studio: zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- Level Designer publishes a level at 1440 -------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/level-designer.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction('!!window.JVDSAssetBus', { timeout: 15000 });

    const out = await page.evaluate(() => {
      const data = {
        name: 'Bus level', gridW: 20, gridH: 15,
        layers: [{ name: 'Platforms', visible: true, data: Array.from({ length: 300 }, (_, i) => (i % 20 === 0 ? 1 : 0)) }],
        entities: { coins: [[2, 2]], enemies: [], spawn: [1, 1], goal: [10, 10] },
        ts: Date.now()
      };
      window.JVDSAssetBus.publishLevel({ name: data.name, tool: 'level-designer', data });
      const items = window.JVDSAssetBus.list('level');
      return {
        count: items.length,
        name: items[0] && items[0].name,
        tiles: items[0] && items[0].payload.layers && items[0].payload.layers[0].data.length,
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      };
    });
    check('level-designer: publishes its level to the bus', out.count === 1 && out.name === 'Bus level' && out.tiles === 300, out.name);
    check('level-designer: 1440 no overflow', out.scroll <= out.client + 2, `${out.scroll}/${out.client}`);
    check('level-designer: zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- Game Maker uses all three at 390, then survives a refresh --------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof customSpriteDataUrl!=="undefined") && !!window.GameAudio && !!window.JVDSAssetBus', { timeout: 25000 });

    const out = await page.evaluate((WAV) => {
      const before = { sprite: window.JVDSAssetBus.list('sprite').length, sound: window.JVDSAssetBus.list('sound').length, level: window.JVDSAssetBus.list('level').length };
      importSpriteFromBus();
      importSoundFromBus();
      importLevelFromBus();
      return {
        before,
        sprite: /^data:image\/png/.test(customSpriteDataUrl || ''),
        music: GameAudio.customMusic === WAV,
        level: customLevelMap ? customLevelMap.length : 0,
        coins: customLevelEntities && customLevelEntities.coins ? customLevelEntities.coins.length : 0,
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      };
    }, WAV);

    check('game-maker: sees all three pieces from the bus', out.before.sprite === 1 && out.before.sound === 1 && out.before.level === 1, JSON.stringify(out.before));
    check('game-maker: uses the sprite with no download', out.sprite);
    check('game-maker: uses the sound with no download', out.music);
    check('game-maker: uses the level with no download', out.level === 300 && out.coins === 1, `${out.level}/${out.coins}`);
    check('game-maker: 390 no overflow', out.scroll <= out.client + 2, `${out.scroll}/${out.client}`);
    check('game-maker: zero runtime errors', errors.length === 0, errors.join(' | '));

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('!!window.JVDSAssetBus', { timeout: 15000 });
    const after = await page.evaluate(() => ({
      sprite: window.JVDSAssetBus.list('sprite').length,
      sound: window.JVDSAssetBus.list('sound').length,
      level: window.JVDSAssetBus.list('level').length
    }));
    check('bus: pieces survive a refresh', after.sprite === 1 && after.sound === 1 && after.level === 1, JSON.stringify(after));

    const safe = await page.evaluate(() => {
      try { localStorage.setItem('jvds_asset_bus_v1', '{not json'); } catch (e) {}
      const corrupt = window.JVDSAssetBus.list();
      const corruptLatest = window.JVDSAssetBus.latest('sprite');
      window.JVDSAssetBus.clear();
      const empty = window.JVDSAssetBus.list();
      return { corrupt: Array.isArray(corrupt) && corrupt.length === 0, latest: corruptLatest === null, empty: Array.isArray(empty) && empty.length === 0 };
    });
    check('bus: corrupt storage reads as empty', safe.corrupt && safe.latest);
    check('bus: clearing leaves an empty list', safe.empty);
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL ASSET BUS CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
