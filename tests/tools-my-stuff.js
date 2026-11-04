// A2274: My Stuff shelf - proves the shelf shows items from Pixel Studio,
// Sound Studio and Arcade Game Maker, with Open and Export buttons, at 390
// and 1440.  No network, no account.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19291;
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
const listen = () => new Promise(resolve => server.listen(port, resolve));

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function makePage(browser, errors) {
  return browser.newPage().then(async page => {
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() === 'error') {
        const t = m.text();
        if (!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ServiceWorker|sw\.js|is\.gd|The operation was aborted/i.test(t))
          errors.push('console: ' + t);
      }
    });
    return page;
  });
}

const PIXEL_DATA = JSON.stringify({
  v:3, cW:8, cH:8, fps:8,
  layers:[{name:'Layer 1',visible:true,opacity:1}],
  frames:[[new Array(8*8*4).fill(128)]],
  frameMeta:[{clip:'',hold:1}], animLoop:true, exportOrigin:'top-left'
});

const SOUND_DATA = JSON.stringify({
  bpm:140, steps:16, swing:0,
  tracks:[{name:'Kick',inst:'kick',vol:0.8}],
  grid:[[{on:true},{on:false}]],
  ts:Date.now()
});

const ARCADE_DATA = JSON.stringify({
  v:1, title:'My Game', genre:'platformer',
  speed:3, gravity:1, jump:8,
  map:null, sprite:null, enemySprite:null,
  bulletSprite:null, blockSprite:null, bgImage:null,
  liveConfig:{speed:3,fireCooldown:300,_base:{speed:3,fireCooldown:300}},
  theme:{cols:['#222','#fff'],name:'dark'}, story:null,
  sounds:{}, customBuffers:{}, customMusic:null,
  musicOn:true, musicStyle:'chip', volume:70,
  entities:null, customAchs:[], cuts:[], cutWhen:'before',
  bossPhases:[], savedAt:'4 Nov, 14:00', userCode:''
});

async function seedStorage(page) {
  await page.evaluate((px, snd, arc) => {
    localStorage.setItem('jvds_pixel', px);
    localStorage.setItem('jvds_sound_auto', snd);
    localStorage.setItem('jv_arcade_autosave', arc);
  }, PIXEL_DATA, SOUND_DATA, ARCADE_DATA);
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ── Desktop (1440) ──
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/pages/dev-tools.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await seedStorage(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const shelf = await page.evaluate(() => {
      const s = document.getElementById('my-stuff');
      if (!s) return null;
      return {
        visible: !s.hidden,
        cards: s.querySelectorAll('.my-stuff-card').length,
        openBtns: s.querySelectorAll('.my-stuff-btn--open').length,
        exportBtns: s.querySelectorAll('.my-stuff-btn--export').length,
        pixelCard: !!s.querySelector('[data-type="sprite"]'),
        soundCard: !!s.querySelector('[data-type="sound"]'),
        gameCard: !!s.querySelector('[data-type="game"]'),
        exportAllBtn: !!s.querySelector('#myStuffExportAll'),
        importInput: !!s.querySelector('#myStuffImportFile'),
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    check('desktop: my-stuff section present', shelf !== null);
    check('desktop: shelf visible with data', shelf && shelf.visible);
    check('desktop: shows 3 cards', shelf && shelf.cards === 3, 'found ' + (shelf && shelf.cards));
    check('desktop: Pixel Studio card', shelf && shelf.pixelCard);
    check('desktop: Sound Studio card', shelf && shelf.soundCard);
    check('desktop: Arcade Game Maker card', shelf && shelf.gameCard);
    check('desktop: Open buttons on all cards', shelf && shelf.openBtns === 3, 'found ' + (shelf && shelf.openBtns));
    check('desktop: Export buttons on all cards', shelf && shelf.exportBtns === 3, 'found ' + (shelf && shelf.exportBtns));
    check('desktop: Export All button', shelf && shelf.exportAllBtn);
    check('desktop: Import input', shelf && shelf.importInput);
    check('desktop: no overflow at 1440', shelf && shelf.scrollWidth <= 1440, shelf && shelf.scrollWidth);
    check('desktop: no browser errors', errors.length === 0, errors.join('; '));
    await page.close();
  }

  // ── Mobile (390) ──
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/pages/dev-tools.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await seedStorage(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const shelf = await page.evaluate(() => {
      const s = document.getElementById('my-stuff');
      if (!s) return null;
      return {
        visible: !s.hidden,
        cards: s.querySelectorAll('.my-stuff-card').length,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    check('mobile: shelf visible', shelf && shelf.visible);
    check('mobile: shows 3 cards', shelf && shelf.cards === 3, 'found ' + (shelf && shelf.cards));
    check('mobile: no overflow at 390', shelf && shelf.scrollWidth <= 390, shelf && shelf.scrollWidth);
    check('mobile: no browser errors', errors.length === 0, errors.join('; '));
    await page.close();
  }

  // ── Hidden when empty ──
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/pages/dev-tools.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(() => {
      localStorage.removeItem('jvds_pixel');
      localStorage.removeItem('jvds_sound_auto');
      localStorage.removeItem('jv_arcade_autosave');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const hidden = await page.evaluate(() => {
      const s = document.getElementById('my-stuff');
      return s && s.hidden;
    });
    check('empty: shelf hidden when no items', hidden);
    await page.close();
  }

  // ── Open links point to correct tools ──
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/pages/dev-tools.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await seedStorage(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const hrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.my-stuff-btn--open')).map(a => a.getAttribute('href'));
    });
    check('links: Pixel Studio link', hrefs.some(h => h && h.includes('pixel-studio')));
    check('links: Sound Studio link', hrefs.some(h => h && h.includes('sound-studio')));
    check('links: Arcade Game Maker link', hrefs.some(h => h && h.includes('arcade-game-maker')));
    await page.close();
  }

  await browser.close();
  server.close();

  console.log('\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'));
  process.exit(failures === 0 ? 0 : 1);
})();
