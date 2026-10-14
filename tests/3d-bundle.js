/* A1491: the shared 3D exporter can hand a learner one asset bundle.
   Loads a real builder page, builds a model, asks for the bundle, then unzips
   it in Node and checks the model, the README (units + import steps) and the
   preview picture are all really inside and valid.

   Run: node tests/3d-bundle.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('F:/Website/Jvdesign-Website-v2/node_modules/puppeteer');
const JSZip = require(path.join(__dirname, '..', 'assets', 'vendor', 'jszip', 'jszip.min.js'));
const root = path.resolve(__dirname, '..');

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.zip': 'application/zip' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.resolve(root, '.' + u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let fails = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!cond) fails++;
};

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0].slice(0, 100)));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/workshops/rocket-builder.html', { waitUntil: 'load' });
  if (await page.$('#cookie-decline')) { try { await page.click('#cookie-decline'); } catch (e) {} }
  await new Promise(r => setTimeout(r, 1300));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button'))
      .find(x => /^(Let's Build!|Accept|Got it)$/i.test(x.textContent.trim()) && x.offsetParent !== null);
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(async () => {
    const hit = re => {
      const b = Array.from(document.querySelectorAll('button'))
        .find(x => re.test(x.textContent) && x.offsetParent !== null && !x.disabled);
      if (b) { b.click(); return true; } return false;
    };
    if (!hit(/quick build/i)) for (let i = 0; i < 35 && hit(/^\s*(Next|Continue)\b/i); i++) {}
    await new Promise(r => setTimeout(r, 900));
  });
  await new Promise(r => setTimeout(r, 1000));

  const api = await page.evaluate(() => ({
    ver: window.JVExporter && window.JVExporter.version,
    keys: window.JVExporter ? Object.keys(window.JVExporter) : []
  }));
  ok('shared exporter loaded (1.3+)', !!api.ver && api.ver >= '1.3.0', api.ver);
  ok('bundle API exposed', ['makeBundle', 'zip', 'shareCode', 'readmeText'].every(k => api.keys.indexOf(k) >= 0));

  const zsig = await page.evaluate(() => {
    const z = window.JVExporter.zip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]);
    return [z[0], z[1], z[2], z[3]];
  });
  ok('zip writer emits the PKZIP signature', zsig.join(',') === '80,75,3,4', zsig.join(','));

  const r = await page.evaluate(async () => {
    const J = window.JVExporter;
    let model; try { model = J.currentModel(false); } catch (e) { return { err: String(e) }; }
    const code = J.shareCode(model, 'Rocket Builder');
    const b = await J.makeBundle(model, 'Rocket Builder');
    const bytes = new Uint8Array(await b.blob.arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return { name: b.name, entries: b.entries, size: bytes.length, b64: btoa(s), codeLen: code.length, codeHead: code.slice(0, 7) };
  });
  ok('bundle built without error', !r.err, r.err || '');
  if (!r.err) {
    ok('bundle names a zip', /\.zip$/.test(r.name), r.name);
    ok('bundle lists a model entry', (r.entries || []).some(n => /\.(glb|obj)$/.test(n)), (r.entries || []).join(' '));
    ok('bundle lists README.md', (r.entries || []).indexOf('README.md') >= 0);
    ok('bundle lists preview.png', (r.entries || []).indexOf('preview.png') >= 0);
    ok('share code produced', r.codeLen > 40, 'len ' + r.codeLen);
    ok('share code is self-describing', /^JVDS1/.test(r.codeHead || ''), r.codeHead);
    ok('share code is compact when the builder has a state', r.codeHead !== 'JVDS1S' || r.codeLen < 4000, 'len ' + r.codeLen);

    const zip = await JSZip.loadAsync(Buffer.from(r.b64, 'base64'));
    const names = Object.keys(zip.files);
    ok('node unzip sees the entries', names.length >= 3, names.join(' '));
    const readme = await zip.file('README.md').async('string');
    ok('README names the units', /Units in the file/i.test(readme) && /1 unit = 1 m/.test(readme));
    ok('README says how to open it', /How to open it/i.test(readme));
    const pv = zip.file('preview.png') ? await zip.file('preview.png').async('uint8array') : null;
    ok('preview.png is a real PNG', !!pv && pv[0] === 0x89 && pv[1] === 0x50 && pv[2] === 0x4E && pv[3] === 0x47, pv ? pv[0] + ',' + pv[1] : 'missing');
    const glbName = names.find(n => /\.glb$/.test(n));
    if (glbName) {
      const gb = await zip.file(glbName).async('uint8array');
      ok('model entry is a valid glTF', gb[0] === 0x67 && gb[1] === 0x6C && gb[2] === 0x54 && gb[3] === 0x46, glbName);
    } else {
      const oe = names.find(n => /\.obj$/.test(n));
      const ob = oe ? await zip.file(oe).async('string') : '';
      ok('model entry is an OBJ', /v /.test(ob), oe || 'none');
    }
  }

  const dl = await page.evaluate(async () => {
    const btn = document.querySelector('[data-jv-export]'); if (!btn) return { err: 'no export button' };
    btn.click(); await new Promise(x => setTimeout(x, 600));
    const sheet = document.getElementById('jvExportBackdrop');
    const tile = sheet && sheet.querySelector('.jv-fmt[data-fmt="bundle"]');
    if (!tile) return { err: 'no bundle tile' };
    const oc = URL.createObjectURL.bind(URL); let blob = null;
    URL.createObjectURL = function (x) { blob = x; return oc(x); };
    const okk = HTMLAnchorElement.prototype.click; const files = [];
    HTMLAnchorElement.prototype.click = function () { if (this.download) { files.push(this.download); return; } return okk.apply(this, arguments); };
    tile.click(); await new Promise(x => setTimeout(x, 3000));
    HTMLAnchorElement.prototype.click = okk; URL.createObjectURL = oc;
    let sig = null;
    if (blob) { const bb = new Uint8Array(await blob.arrayBuffer()); sig = [bb[0], bb[1], bb[2], bb[3]]; }
    return { files, sig, share: !!(sheet && sheet.querySelector('#jvShareCode')) };
  });
  ok('dialog bundle tile downloads a zip', (dl.files || []).some(f => /\.zip$/.test(f)), JSON.stringify(dl.files || dl.err));
  ok('downloaded bundle is a real zip', !!dl.sig && dl.sig.join(',') === '80,75,3,4', (dl.sig || []).join(','));
  ok('share-code control present', dl.share === true);

  ok('no page errors', errs.length === 0, errs[0] || '');

  await browser.close();
  server.close();
  console.log('\n' + (fails ? fails + ' bundle check(s) failed' : 'ALL BUNDLE CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
