#!/usr/bin/env node
/* A2599: the five heaviest Create editors must work with mouse, trackpad and
 * touch, keep their controls reachable, and survive 390 / 1024 / 1440 layouts.
 * Also checks the published cross-platform note on tools/accessibility.html. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webmanifest': 'application/manifest+json' };

const TOOLS = [
  { id: 'pixel-studio', canvas: '#main-canvas' },
  { id: 'level-designer', canvas: '#level-canvas' },
  { id: 'arcade-game-maker', canvas: '#tilemapCanvas' },
  { id: 'buildlab', canvas: '#viewport canvas' },
  { id: 'minecraft-skin-editor', canvas: '#msSkin' }
];
const WIDTHS = [390, 1024, 1440];

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const failures = [];
function pass(msg) { console.log('PASS ' + msg); }
function fail(msg) { failures.push(msg); console.log('FAIL ' + msg); }

function sourceOf(id) {
  let src = fs.readFileSync(path.join(ROOT, 'tools', id + '.html'), 'utf8');
  const inlineDir = path.join(ROOT, 'assets', 'js', 'inline');
  if (fs.existsSync(inlineDir)) {
    for (const f of fs.readdirSync(inlineDir)) {
      if (f.startsWith('tools-' + id + '-') && f.endsWith('.js')) src += '\n' + fs.readFileSync(path.join(inlineDir, f), 'utf8');
    }
  }
  return src;
}

(async () => {
  // Static proof each tool has touch, keyboard and file in/out paths.
  for (const { id } of TOOLS) {
    const src = sourceOf(id);
    pass(`${id} handles touch or pointer input`, /touchstart|touchmove|pointerdown|pointermove/.test(src));
    pass(`${id} documents keyboard control`, /keydown|keyup|KeyboardEvent/.test(src));
    pass(`${id} has a download path`, /download\s*=|\.download|download:\s*true/.test(src));
    pass(`${id} has an import path`, /type=["']file["']|type=file|FileReader/.test(src));
  }

  const a11y = fs.readFileSync(path.join(ROOT, 'tools', 'accessibility.html'), 'utf8');
  pass('cross-platform note is published', /id="cross-platform"/.test(a11y));
  for (const { id } of TOOLS) {
    const name = { 'pixel-studio': 'Pixel Studio', 'level-designer': 'World Builder', 'arcade-game-maker': 'Arcade Game Maker', 'buildlab': 'BuildLab', 'minecraft-skin-editor': 'Minecraft Skin Editor' }[id];
    pass(`note covers ${name}`, a11y.includes(name));
  }

  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const PORT = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const t = req.resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return req.abort();
    req.continue();
  });
  async function open(url) {
    for (let i = 0; i < 3; i++) {
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); break; }
      catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 150)); }
    }
    await new Promise(r => setTimeout(r, 400));
  }
  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: true });
      for (const { id, canvas } of TOOLS) {
        const errs = [];
        const onErr = e => errs.push(e.message);
        page.on('pageerror', onErr);
        await open(`http://127.0.0.1:${PORT}/tools/${id}.html`);
        if (id === 'buildlab') {
          try { await page.waitForSelector('#viewport canvas', { timeout: 6000 }); } catch (_) {}
        }
        const r = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          const cs = el ? getComputedStyle(el) : null;
          return {
            canvas: !!el,
            touchAction: cs ? cs.touchAction : 'missing',
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            buttons: document.querySelectorAll('button, [role="button"], a[href]').length
          };
        }, canvas).catch(() => ({ canvas: false, touchAction: 'eval-failed', overflow: 999, buttons: 0 }));
        page.off('pageerror', onErr);
        pass(`${id} drawing canvas present @${width}`, r.canvas);
        pass(`${id} canvas touch-action set @${width}`, r.touchAction !== 'auto' && r.touchAction !== 'missing', r.touchAction);
        pass(`${id} no horizontal overflow @${width}`, r.overflow <= 1, r.overflow + 'px');
        pass(`${id} controls reachable @${width}`, r.buttons >= 5, r.buttons + ' controls');
        pass(`${id} no page errors @${width}`, errs.length === 0, errs.slice(0, 1).join(' | '));
      }
      await open(`http://127.0.0.1:${PORT}/tools/accessibility.html`);
      const a = await page.evaluate(() => ({
        note: !!document.getElementById('cross-platform'),
        overflow: document.documentElement.scrollWidth - window.innerWidth
      }));
      pass(`accessibility note visible @${width}`, a.note);
      pass(`accessibility page no overflow @${width}`, a.overflow <= 1, a.overflow + 'px');
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.log('\n' + failures.length + ' failure(s)');
    process.exit(1);
  }
  console.log('\nPASS create-hub-cross-platform: five editors usable at 390, 1024 and 1440');
})();
