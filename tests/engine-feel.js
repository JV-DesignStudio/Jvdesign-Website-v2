/* A2958: the Godot Engine Feel replica renders on the Godot hub, lets the
   learner select nodes, edit the Inspector, add a node, move the player and
   export a real Godot project. Checks 1440 and 390. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/my-first-video-game.html';
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EngineFeel && document.querySelector('.ef'), { timeout: 15000 });

    const initial = await page.evaluate(() => {
      const s = window.EngineFeel.state();
      return {
        title: (document.querySelector('.ef-title') || {}).textContent || '',
        rows: document.querySelectorAll('.ef-node').length,
        nodes: s.nodes.map(n => n.name + ':' + n.type),
        speed: (s.nodes.find(n => n.id === 'player') || {}).speed,
        hasControls: !!document.querySelector('.ef-download') && !!document.querySelector('.ef-copy') && !!document.querySelector('.ef-run'),
        canvasW: document.querySelector('.ef-canvas').width
      };
    });
    check('Godot panel renders', /Godot/i.test(initial.title), initial.title);
    check('scene tree starts with World, Player, Ground, Coin', initial.rows === 4, 'rows ' + initial.rows);
    check('real node types are used', initial.nodes.indexOf('Player:CharacterBody2D') !== -1 && initial.nodes.indexOf('Coin:Area2D') !== -1, initial.nodes.join(', '));
    check('player has a speed', initial.speed === 180, String(initial.speed));
    check('download, copy and run controls exist', initial.hasControls);
    check('viewport is 640 wide', initial.canvasW === 640, String(initial.canvasW));

    const inspector = await page.evaluate(() => {
      window.EngineFeel.selectNode('player');
      const speed = document.querySelector('.ef-fields input[data-key="speed"]');
      if (!speed) return { ok: false };
      speed.value = '240';
      speed.dispatchEvent(new Event('input', { bubbles: true }));
      const s = window.EngineFeel.state();
      return { ok: true, speed: s.nodes.find(n => n.id === 'player').speed };
    });
    check('Inspector edits the node', inspector.ok && inspector.speed === 240, JSON.stringify(inspector));

    const added = await page.evaluate(() => {
      const id = window.EngineFeel.addNode('Timer');
      const s = window.EngineFeel.state();
      return { id, count: s.nodes.length, rows: document.querySelectorAll('.ef-node').length };
    });
    check('Add node creates a Timer', !!added.id && added.count === 5, JSON.stringify(added));
    check('scene tree updates', added.rows === 5, 'rows ' + added.rows);

    const move = await page.evaluate(async () => {
      const canvas = document.querySelector('.ef-canvas');
      const before = window.EngineFeel.state().nodes.find(n => n.id === 'player').x;
      canvas.focus();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      window.EngineFeel.step();
      canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
      const after = window.EngineFeel.state().nodes.find(n => n.id === 'player').x;
      return { before, after };
    });
    check('arrow key moves the player', move.after > move.before, move.before + ' -> ' + move.after);

    const painted = await page.evaluate(() => {
      const c = document.querySelector('.ef-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    check('viewport paints pixels', painted > 10000, 'pixels ' + painted);

    const project = await page.evaluate(() => {
      const files = window.EngineFeel.projectFiles();
      const tscn = (files.find(f => f.name === 'main.tscn') || {}).text || '';
      const gd = (files.find(f => f.name === 'player.gd') || {}).text || '';
      return {
        names: files.map(f => f.name),
        hasPlayer: /CharacterBody2D/.test(tscn) && /name="Player"/.test(tscn),
        hasGround: /StaticBody2D/.test(tscn) && /name="Ground"/.test(tscn),
        speed: /speed := 240\.0/.test(gd),
        readme: files.some(f => f.name === 'README.md')
      };
    });
    check('project exports five files', project.names.length === 5, project.names.join(', '));
    check('main.tscn names the learner nodes', project.hasPlayer && project.hasGround, JSON.stringify(project));
    check('player.gd carries the edited speed', project.speed, project.speed + '');
    check('README is included', project.readme);

    const run = await page.evaluate(() => {
      const btn = document.querySelector('.ef-run');
      btn.click();
      return { running: window.EngineFeel.state().running, label: btn.textContent.trim() };
    });
    check('Run starts the replica', run.running === true, run.label);

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EngineFeel && document.querySelector('.ef'), { timeout: 15000 });
    const mobile = await page.evaluate(() => {
      const el = document.querySelector('.ef');
      const r = el.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        left: r.left,
        right: r.right,
        innerWidth: window.innerWidth,
        visible: r.width > 200
      };
    });
    check('390px panel visible', mobile.visible);
    check('390px no horizontal overflow', mobile.scrollWidth <= 392, 'scrollWidth ' + mobile.scrollWidth);
    check('390px panel fits viewport', mobile.left >= 0 && mobile.right <= mobile.innerWidth + 1, mobile.left + '..' + mobile.right + ' of ' + mobile.innerWidth);

    const racing = await browser.newPage();
    const racingErrors = [];
    racing.on('pageerror', e => racingErrors.push(e.message));
    racing.on('console', m => { if (m.type() === 'error') racingErrors.push(m.text()); });
    await racing.setRequestInterception(true);
    racing.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await racing.setViewport({ width: 1440, height: 900 });
    await racing.goto(base + '/workshops/godot-racing-workshop.html', { waitUntil: 'load', timeout: 30000 });
    await racing.waitForFunction(() => window.EngineFeel && document.querySelector('.ef'), { timeout: 15000 });
    const preset = await racing.evaluate(() => {
      const s = window.EngineFeel.state();
      const files = window.EngineFeel.projectFiles();
      const tscn = (files.find(f => f.name === 'main.tscn') || {}).text || '';
      return {
        preset: window.EngineFeel.preset,
        title: (document.querySelector('.ef-title') || {}).textContent || '',
        nodes: s.nodes.map(n => n.name + ':' + n.type),
        files: files.map(f => f.name),
        scene: /name="RaceTrack"/.test(tscn),
        car: /name="Car"/.test(tscn) && /CharacterBody2D/.test(tscn)
      };
    });
    check('episode page loads its preset', preset.preset === 'racing', preset.preset);
    check('episode title changes', /Zoom Zoom/i.test(preset.title), preset.title);
    check('episode scene names the car and checkpoint', preset.nodes.indexOf('Car:CharacterBody2D') !== -1 && preset.nodes.indexOf('Checkpoint:Area2D') !== -1, preset.nodes.join(', '));
    check('episode exports its own scripts', preset.files.indexOf('car.gd') !== -1 && preset.files.indexOf('checkpoint.gd') !== -1, preset.files.join(', '));
    check('episode scene is RaceTrack with a Car', preset.scene && preset.car, JSON.stringify({ scene: preset.scene, car: preset.car }));
    check('episode page has no browser errors', racingErrors.length === 0, racingErrors.slice(0, 2).join(' | '));
    await racing.close();

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
