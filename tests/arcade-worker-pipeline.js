const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19296;
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
  ['WorkerSandbox', 'AssetPipeline', 'SingleFileExporter'].forEach(name => {
    check('HTML imports ' + name, new RegExp('src/arcade-maker/' + name + '\\.js').test(html));
  });

  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + port + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.WorkerSandbox && window.AssetPipeline && window.SingleFileExporter, { timeout: 25000 });
    const out = await page.evaluate(async () => {
      const sandbox = await import('/src/arcade-maker/WorkerSandbox.js');
      const pipeline = await import('/src/arcade-maker/AssetPipeline.js');
      const exporter = await import('/src/arcade-maker/SingleFileExporter.js');
      const sum = await sandbox.run('return input.a + input.b;', { a: 2, b: 3 });
      let failed = '';
      try { await sandbox.run('throw new Error("nope");', {}); } catch (e) { failed = e.message; }
      const manifest = pipeline.buildManifest({
        sprites: [{ name: 'hero', w: 999, h: 16, frames: 2 }],
        sounds: [{ name: 'coin', volume: 2 }],
        levels: [{ map: [0, 1, 5], w: 3, h: 1 }]
      });
      const doc = exporter.standaloneDocument({ title: 'Test <Game>', script: '1', config: { genre: 'PLATFORMER' } });
      return {
        sum,
        failed,
        manifest,
        doc,
        fileName: exporter.fileName('My Game!', 'zip'),
        aliases: !!window.WorkerSandbox && !!window.AssetPipeline && !!window.SingleFileExporter
      };
    });
    check('worker sandbox returns a result', out.sum === 5, String(out.sum));
    check('worker sandbox stops a thrown error', /nope/.test(out.failed), out.failed);
    check('asset pipeline normalises sprites, sounds and levels', out.manifest.sprites[0].w === 512 && out.manifest.sounds[0].volume === 1 && out.manifest.levels[0].map.join(',') === '0,1,2', JSON.stringify(out.manifest));
    check('single-file exporter writes a full document', /^<!DOCTYPE html>/.test(out.doc) && /Test &lt;Game&gt;/.test(out.doc) && /__exportMode=true/.test(out.doc));
    check('single-file exporter slugs the filename', out.fileName === 'my-game.zip', out.fileName);
    check('modules are published to the bootstrap', out.aliases);
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE WORKER AND PIPELINE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
