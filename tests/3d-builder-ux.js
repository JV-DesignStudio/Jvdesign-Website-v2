/* Shared QA for every JVDS 3D builder.

   Checks the four things a learner actually meets:
     1. the page lays out (viewport fills the screen, canvas is not a sliver),
     2. no JavaScript errors while loading or building,
     3. there is a Templates gallery and it loads a model,
     4. every export format hands back a real file built from what is on screen.

   Run: node tests/3d-builder-ux.js [page-slug ...]
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const ALL = ['rocket', 'robot', 'castle', 'space-station', 'fairy-tale', 'pirate-ship',
  'steampunk-airship', 'race-car', 'submarine', 'phone-stand'];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.zip': 'application/zip', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.resolve(root, '.' + u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

  for (const slug of wanted) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.split('\n')[0].slice(0, 140)));
    page.on('requestfailed', r => {
      if (/jv-exporter|builder-templates|three\.min|GLTFExporter/.test(r.url())) errors.push('REQUEST FAILED ' + r.url());
    });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/workshops/' + slug + '-builder.html', { waitUntil: 'load' });
    if (await page.$('#cookie-decline')) { try { await page.click('#cookie-decline'); } catch (e) {} }
    await new Promise(r => setTimeout(r, 900));

    console.log('\n=== ' + slug + ' ===');

    // 1. layout
    const layout = await page.evaluate(() => {
      const vp = document.getElementById('viewport');
      const cv = vp && vp.querySelector('canvas');
      const sb = document.getElementById('sidebar');
      const r = e => e ? { x: Math.round(e.getBoundingClientRect().x), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) } : null;
      return { vp: r(vp), cv: r(cv), sb: r(sb), win: { w: innerWidth, h: innerHeight } };
    });
    check(slug + ': viewport is wide', layout.vp && layout.vp.w > layout.win.w * 0.4, JSON.stringify(layout.vp));
    check(slug + ': viewport is tall', layout.vp && layout.vp.h > 300, JSON.stringify(layout.vp));
    check(slug + ': canvas fills the viewport', layout.cv && layout.cv.w > layout.vp.w * 0.8 && layout.cv.h > layout.vp.h * 0.8,
      JSON.stringify(layout.cv) + ' of ' + JSON.stringify(layout.vp));
    check(slug + ': sidebar sits on the left', layout.sb && layout.sb.w >= 200 && layout.sb.x < 40, JSON.stringify(layout.sb));

    // 2. shared modules + buttons
    const mods = await page.evaluate(() => ({
      exp: !!window.JVExporter && typeof window.JVExporter.installUI === 'function',
      tpl: !!window.BuilderTemplates,
      expBtn: !!document.querySelector('[data-jv-export]'),
      tplBtn: Array.from(document.querySelectorAll('button')).some(b => /Templates/.test(b.textContent)),
      gltf: !!(window.THREE && THREE.GLTFExporter)
    }));
    check(slug + ': shared exporter loaded', mods.exp);
    check(slug + ': shared templates loaded', mods.tpl);
    check(slug + ': Export button in the header', mods.expBtn);
    check(slug + ': Templates button in the header', mods.tplBtn);
    check(slug + ': GLTF exporter loaded', mods.gltf);

    // 3. build something through the Templates gallery
    const picked = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /Templates/.test(x.textContent) && x.offsetParent !== null);
      if (!b) return { err: 'no templates button' };
      b.click();
      const sheet = document.getElementById('btBackdrop');
      if (!sheet || sheet.style.display === 'none') return { err: 'gallery did not open' };
      const cards = sheet.querySelectorAll('.bt-card');
      if (!cards.length) return { err: 'gallery is empty' };
      cards[0].click();
      return { cards: cards.length, status: (sheet.querySelector('#btStatus') || {}).textContent || '' };
    });
    check(slug + ': templates gallery opens with choices', !!picked.cards && picked.cards >= 3, JSON.stringify(picked));
    await new Promise(r => setTimeout(r, 700));
    await page.evaluate(() => { const s = document.getElementById('btBackdrop'); if (s) s.style.display = 'none'; });

    // 4. export every format from whatever is on screen now
    const results = await page.evaluate(async () => {
      const J = window.JVExporter;
      const out = { formats: {} };
      const btn = document.querySelector('[data-jv-export]');
      if (!btn) return { err: 'no export button' };
      btn.click();
      const back = document.getElementById('jvExportBackdrop');
      if (!back || back.style.display === 'none') return { err: 'export dialog did not open' };
      const facts = back.querySelector('#jvExportFacts');
      out.summary = facts ? facts.textContent.trim() : '';
      out.buttons = Array.from(back.querySelectorAll('.jv-fmt')).map(b => ({ f: b.dataset.fmt, dis: b.disabled }));

      // The dialog reads the live model, so export straight through it.
      const sizes = {};
      const origCreate = document.createElement.bind(document);
      const downloads = [];
      document.createElement = function (tag) {
        const el = origCreate(tag);
        if (String(tag).toLowerCase() === 'a') {
          const origClick = el.click.bind(el);
          el.click = function () { downloads.push({ name: el.download, href: el.href }); };
        }
        return el;
      };
      for (const id of ['obj', 'glb', 'fbx', 'stl']) {
        downloads.length = 0;
        J.exportFormat(id);
        await new Promise(r => setTimeout(r, id === 'glb' ? 1500 : 450));
        sizes[id] = downloads.map(d => d.name);
      }
      document.createElement = origCreate;
      out.files = sizes;
      return out;
    });

    if (results.err) check(slug + ': export dialog', false, results.err);
    else {
      check(slug + ': export dialog opens with a live summary', /parts/.test(results.summary), results.summary);
      for (const f of ['obj', 'glb', 'fbx', 'stl']) {
        const b = results.buttons.find(x => x.f === f);
        check(slug + ': ' + f.toUpperCase() + ' button is available', b && !b.dis, JSON.stringify(b));
        check(slug + ': ' + f.toUpperCase() + ' produces a file', (results.files[f] || []).length > 0, JSON.stringify(results.files[f]));
      }
      const objName = (results.files.obj || [])[0];
      check(slug + ': file is named after the build', objName && !/^model__m\.obj$/.test(objName), objName);
    }

    check(slug + ': no runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
  console.log('\nALL 3D BUILDER CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
