// BuildLab A2730: export downloads are named before the click and the panel
// shows a local visual import guide for Roblox Studio, Blender and Unreal.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19271;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
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
function listen() { return new Promise(resolve => server.listen(port, resolve)); }
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const GUIDE_IMAGES = [
  'tools/assets/buildlab-import-roblox.svg',
  'tools/assets/buildlab-import-blender.svg',
  'tools/assets/buildlab-import-unreal.svg',
];
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await listen();
  for (const rel of GUIDE_IMAGES) {
    check('guide image exists on disk: ' + path.basename(rel), fs.existsSync(path.join(root, rel)), rel);
  }
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'mobile', w: 390, h: 844, m: true }, { name: 'desktop', w: 1440, h: 900, m: false }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('console', m => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
        errors.push('console: ' + text);
      });
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await pause(600);
      await page.evaluate(() => {
        try { window.closeModal('welcomeModal'); } catch (e) {}
        const w = document.getElementById('welcomeModal');
        if (w) w.classList.remove('open');
        document.body.classList.remove('bl-modal-open');
      });
      await pause(200);
      const beforeOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
      const guideId = vp.m ? 'mobImportGuide' : 'importGuide';
      await page.evaluate((isMobile, id) => {
        if (isMobile && typeof window.mobTab === 'function') window.mobTab('actions');
        const g = document.getElementById(id);
        if (g) g.open = true;
      }, vp.m, guideId);
      await pause(500);

      const base = await page.evaluate((id) => {
        const names = Array.from(document.querySelectorAll('[data-export-file]')).map(e => e.textContent).join(' | ');
        const guide = document.getElementById(id);
        const imgs = guide ? Array.from(guide.querySelectorAll('img')) : [];
        return {
          hasFileNames: document.querySelectorAll('[data-export-file]').length >= 3,
          names,
          hasGuide: !!guide,
          summary: guide ? (guide.querySelector('summary')?.textContent || '') : '',
          guideText: guide ? (guide.textContent || '') : '',
          imgs: imgs.map(i => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt') || '', loaded: i.complete && i.naturalWidth > 0, width: i.naturalWidth })),
          overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        };
      }, guideId);
      check(vp.name + ': export panel shows download filenames', base.hasFileNames && /\.rbxm/.test(base.names) && /\.glb/.test(base.names) && /\.obj/.test(base.names) && /\.mtl/.test(base.names), base.names.replace(/\s+/g, ' ').trim());
      check(vp.name + ': import guide is present', base.hasGuide && /how to open/i.test(base.summary), base.summary);
      check(vp.name + ': guide has 3 local images', base.imgs.length === 3 && base.imgs.every(i => /^\/tools\/assets\/buildlab-import-/.test(i.src)), JSON.stringify(base.imgs.map(i => i.src)));
      check(vp.name + ': every guide image loads', base.imgs.length === 3 && base.imgs.every(i => i.loaded && i.width > 0), JSON.stringify(base.imgs));
      check(vp.name + ': guide names Roblox, Blender and Unreal', /Roblox Studio/.test(base.guideText) && /Blender/.test(base.guideText) && /Unreal Engine/.test(base.guideText), base.guideText.replace(/\s+/g, ' ').slice(0, 120));
      check(vp.name + ': no horizontal overflow', beforeOverflow <= 2, String(beforeOverflow));

      // Filenames follow the build name.
      const named = await page.evaluate(async () => {
        if (typeof window.quickBuild !== 'function') return { ok: false, reason: 'quickBuild missing' };
        window.quickBuild('robot');
        await new Promise(r => setTimeout(r, 120));
        return {
          ok: true,
          names: document.getElementById('exportFileNames')?.textContent || '',
          rbxm: window.exportFileLabel('rbxm'),
          gltf: window.exportFileLabel('gltf'),
          objmtl: window.exportFileLabel('objmtl'),
        };
      });
      check(vp.name + ': filenames follow the build name', named.ok && named.rbxm === 'Robot.rbxm' && named.gltf === 'Robot.glb' && named.objmtl === 'Robot.obj + Robot.mtl', JSON.stringify(named));

      // The preview modal names the exact file for each format.
      for (const [action, expected] of [['exportPreviewRBXM', 'Robot.rbxm'], ['exportPreviewGLTF', 'Robot.glb'], ['exportPreviewOBJMTL', 'Robot.obj + Robot.mtl']]) {
        const preview = await page.evaluate(async (fn) => {
          window[fn]();
          await new Promise(r => setTimeout(r, 120));
          const modal = document.getElementById('exportPreviewModal');
          const text = document.getElementById('exportPreviewContent')?.textContent || '';
          const open = !!modal && modal.classList.contains('open');
          try { window.closeModal('exportPreviewModal'); } catch (e) {}
          return { open, text };
        }, action);
        check(vp.name + ': ' + action + ' preview names ' + expected, preview.open && /Downloads as/.test(preview.text) && preview.text.includes(expected), preview.text.replace(/\s+/g, ' ').slice(0, 120));
        await pause(80);
      }

      check(vp.name + ': zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL BUILD LAB EXPORT GUIDE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
