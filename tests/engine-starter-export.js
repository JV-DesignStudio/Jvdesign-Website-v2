const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const JSZip = require('../assets/vendor/jszip/jszip.min.js');

const root = path.join(__dirname, '..');
const port = 19294;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
};
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function zipFiles(b64) {
  const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
  const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  const out = {};
  for (const n of names) out[n] = await zip.files[n].async('text').catch(() => '');
  return { names, out };
}

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  try {
    const lab = await browser.newPage();
    lab.on('pageerror', (e) => errors.push('buildlab pageerror: ' + e.message));
    await lab.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await lab.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await lab.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
    await wait(900);
    await lab.evaluate(() => { try { window.closeModal('welcomeModal'); } catch (e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); });
    await lab.waitForFunction(() => window.JVDSBuildLabStarter && typeof window.quickBuild === 'function', { timeout: 30000 });
    await lab.evaluate(() => window.quickBuild('dinosaur'));
    await wait(500);
    const labPack = await lab.evaluate(async () => {
      const pack = await window.JVDSBuildLabStarter.build();
      if (!pack) return null;
      const buf = await pack.blob.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return { b64: btoa(bin), files: pack.files, button: !!document.querySelector('[data-on="exportGodotStarter"]') };
    });
    check('BuildLab has a Godot starter action', labPack && labPack.button && Array.isArray(labPack.files));
    const labZip = labPack ? await zipFiles(labPack.b64) : { names: [], out: {} };
    check('Godot starter has project, scene, script and model', ['project.godot', 'main.tscn', 'main.gd', 'assets/model.glb', 'README.txt'].every(n => labZip.names.includes(n)), labZip.names.join(', '));
    check('Godot starter uses relative res:// paths', /res:\/\/main\.tscn/.test(labZip.out['project.godot'] || '') && /res:\/\/assets\/model\.glb/.test(labZip.out['main.tscn'] || ''));
    await lab.close();

    const arcade = await browser.newPage();
    arcade.on('pageerror', (e) => errors.push('arcade pageerror: ' + e.message));
    await arcade.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await arcade.goto('http://127.0.0.1:' + port + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await arcade.waitForFunction(() => typeof _buildStarterZip === 'function' && !!document.getElementById('runGameBtn'), { timeout: 25000 });
    await arcade.evaluate(() => { document.getElementById('runGameBtn').click(); });
    const booted = await arcade.waitForFunction(() => typeof _engineData !== 'undefined' && !!_engineData, { timeout: 30000 }).then(() => true).catch(() => false);
    check('Arcade game boots for the starter export', booted);
    const arcadePack = await arcade.evaluate(async () => {
      const pack = await _buildStarterZip();
      if (!pack) return null;
      const buf = await pack.blob.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return { b64: btoa(bin), files: pack.files, button: !!document.querySelector('[data-on="_exportStarterZip"]') };
    });
    check('Arcade has a Phaser starter action', arcadePack && arcadePack.button && Array.isArray(arcadePack.files));
    const arcadeZip = arcadePack ? await zipFiles(arcadePack.b64) : { names: [], out: {} };
    check('Phaser starter has index, config and README', ['index.html', 'game.config.json', 'README.txt'].every(n => arcadeZip.names.includes(n)), arcadeZip.names.join(', '));
    check('Phaser starter index is a full HTML page', /<html/i.test(arcadeZip.out['index.html'] || '') && /<\/html>/i.test(arcadeZip.out['index.html'] || ''));
    check('Phaser starter config names the genre', /"genre"/.test(arcadeZip.out['game.config.json'] || ''));

    await arcade.setViewport({ width: 1440, height: 900 });
    await wait(200);
    const wide = await arcade.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      button: !!document.querySelector('[data-on="_exportStarterZip"]')
    }));
    check('Phaser starter action stays at 1440', wide.button);
    check('no horizontal overflow at 1440', !wide.overflow);
    await arcade.close();

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nENGINE STARTER EXPORT CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
