const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19295;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'arcade-game-maker.html'), 'utf8');
  check('HTML imports the SaveState module', /src\/arcade-maker\/SaveState\.js/.test(html));
  check('HTML imports the LevelData module', /src\/arcade-maker\/LevelData\.js/.test(html));
  check('HTML imports the UIController module', /src\/arcade-maker\/UIController\.js/.test(html));
  check('HTML imports the Engine module', /src\/arcade-maker\/Engine\.js/.test(html));
  check('GENRE_DIMS is no longer defined inline', !/^const\s+GENRE_DIMS\s*=/m.test(html));
  check('ARC_NEXT is no longer defined inline', !/^const\s+ARC_NEXT\s*=/m.test(html));
  check('exportCurrentJson uses SaveState.toJSON', /SaveState\.toJSON\(/.test(html));
  check('import uses SaveState.fromFileText', /SaveState\.fromFileText\(/.test(html));

  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + port + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.SaveState && window.LevelData && window.UIController && window.Engine && typeof _buildSaveData === 'function', { timeout: 25000 });
    const out = await page.evaluate(async () => {
      const mod = await import('/src/arcade-maker/SaveState.js');
      const level = await import('/src/arcade-maker/LevelData.js');
      const ui = await import('/src/arcade-maker/UIController.js');
      const engine = await import('/src/arcade-maker/Engine.js');
      const grid = level.blankMap(3, 2);
      grid[level.index(2, 1, 3)] = 2;
      const modules = {
        grid: grid.join(','),
        normalised: level.normaliseMap([0, 1, 2, 9]).join(','),
        rows: level.toRows([1, 2, 3, 4], 2).length,
        tabs: ui.TAB_ORDER.length,
        tabIndex: ui.tabIndex('custom'),
        nextBuild: ui.nextStep('build').target,
        dims: engine.dimsFor('FLAPPY'),
        defaultDims: engine.dimsFor('SHOOTER'),
        aliases: !!window.GENRE_DIMS && !!window.ARC_NEXT
      };
      const data = _buildSaveData();
      const json = mod.toJSON(data);
      const back = mod.fromJSON(json);
      const html = '<script>window.__exportMode=true;var _c=' + JSON.stringify({ title: 'HTML Game', liveConfig: { speed: 9 } }) + ';</script>';
      const fromHtml = mod.fromHTML(html);
      return {
        exported: /"liveConfig"/.test(json),
        roundTrip: back.liveConfig && Object.keys(back.liveConfig).length === Object.keys(data.liveConfig || {}).length,
        htmlTitle: fromHtml.title,
        htmlSpeed: fromHtml.liveConfig.speed,
        name: mod.downloadName('My Game!', 'json'),
        api: ['normalise', 'toJSON', 'fromJSON', 'fromHTML', 'fromFileText', 'downloadName'].every(k => typeof mod[k] === 'function'),
        windowApi: !!window.SaveState && typeof window.SaveState.toJSON === 'function',
        modules
      };
    });
    check('SaveState exposes the save API', out.api && out.windowApi);
    check('project serialises and round-trips', out.exported && out.roundTrip);
    check('exported HTML config imports', out.htmlTitle === 'HTML Game' && out.htmlSpeed === 9);
    check('download name is a safe slug', out.name === 'my-game-.json' || out.name === 'my-game.json', out.name);
    check('LevelData builds and normalises grids', out.modules.grid === '0,0,0,0,0,2' && out.modules.normalised === '0,1,2,2' && out.modules.rows === 2, JSON.stringify(out.modules));
    check('UIController owns tab order and next steps', out.modules.tabs === 6 && out.modules.tabIndex === 4 && out.modules.nextBuild === 'blueprints', JSON.stringify(out.modules));
    check('Engine owns genre dimensions', out.modules.dims.w === 400 && out.modules.dims.h === 640 && out.modules.defaultDims.w === 640, JSON.stringify(out.modules));
    check('legacy aliases are published for the classic script', out.modules.aliases);
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nSAVE STATE MODULE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
