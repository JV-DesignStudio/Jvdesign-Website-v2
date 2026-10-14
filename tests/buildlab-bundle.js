const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19254;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  let url = decodeURIComponent(req.url.split('?')[0]);
  if(url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if(!file.startsWith(path.normalize(root))){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
});
function listen(){return new Promise(resolve=>server.listen(port, resolve));}
let failures = 0;
function check(name, ok, detail=''){
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if(!ok) failures++;
}
const sleep = ms => new Promise(r=>setTimeout(r, ms));
const JSZip = require(path.join(root, 'assets', 'vendor', 'jszip', 'jszip.min.js'));

function zipsIn(dir){
  try {
    return fs.readdirSync(dir).filter(f=>f.endsWith('.zip') && !f.endsWith('.crdownload'));
  } catch(e) { return []; }
}
async function waitForZip(dir, before, timeout=25000){
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const fresh = zipsIn(dir).filter(f=>!before.includes(f));
    const done = fresh.filter(f=>{
      try { return !fs.existsSync(path.join(dir, f + '.crdownload')); } catch(e) { return true; }
    });
    // Chrome writes file.crdownload alongside; only accept settled files.
    const settled = done.filter(f=>!fs.readdirSync(dir).includes(f + '.crdownload'));
    if (settled.length) return path.join(dir, settled[0]);
    await sleep(400);
  }
  return null;
}

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-bundle-'));
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    page.on('console', m=>{
      if(m.type() !== 'error') return;
      const text = m.text();
      if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
      errors.push('console: '+text);
    });
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:false});
    await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
    await sleep(600);
    await page.evaluate(() => { try { window.closeModal('welcomeModal'); } catch(e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); });
    await sleep(200);

    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {behavior:'allow', downloadPath:dlDir});

    const ui = await page.evaluate(()=>({
      bundle: !!document.querySelector('[data-on="exportBundle"]'),
      copyCode: !!document.querySelector('[data-on="copyShareCode"]'),
      importCode: !!document.querySelector('[data-on="importShareCode"]'),
      mobBundle: !!document.querySelector('[data-on="mobExportBundle"]'),
      mobCopy: !!document.querySelector('[data-on="mobCopyShareCode"]'),
      mobImport: !!document.querySelector('[data-on="mobImportShareCode"]')
    }));
    check('desktop: asset bundle button present', ui.bundle);
    check('desktop: copy-code button present', ui.copyCode);
    check('desktop: import-code button present', ui.importCode);
    check('mobile: bundle button present', ui.mobBundle);
    check('mobile: copy/import code buttons present', ui.mobCopy && ui.mobImport);

    const built = await page.evaluate(()=>{
      if (typeof window.quickBuild !== 'function') return {ok:false};
      window.quickBuild('robot');
      return {ok:true, blocks:(window.blocks||[]).length, name:(document.getElementById('buildNameInput')||{}).value||''};
    });
    check('robot template builds blocks', built.ok && built.blocks > 0, 'blocks='+built.blocks+' name='+built.name);
    const safe = (built.name || 'buildlab').replace(/\s+/g, '_');

    // Share-code path first (no download needed): code out, clear, code back in.
    const code = await page.evaluate(()=> (typeof window.getShareCode === 'function') ? window.getShareCode() : '');
    check('share code is a short pasteable string', typeof code === 'string' && code.length > 20 && code.length < 8000, 'len='+code.length);
    const roundTrip = await page.evaluate((c)=>{
      const before = (window.blocks||[]).length;
      window.clearAll(true);
      const empty = (window.blocks||[]).length;
      const n = window.importShareCodeData(window.decodeShareCode(c));
      return {before, empty, n, after:(window.blocks||[]).length, name:(document.getElementById('buildNameInput')||{}).value||''};
    }, code);
    check('share code round-trips the build', roundTrip.before > 0 && roundTrip.empty === 0 && roundTrip.n === roundTrip.before && roundTrip.after === roundTrip.before,
      JSON.stringify(roundTrip));
    check('a bad code loads nothing', await page.evaluate(()=> window.importShareCodeData(window.decodeShareCode('!!!not-a-code!!!')) === 0));

    // Import-code button with a stubbed prompt (headless has no one to type).
    await page.evaluate(()=>window.clearAll(true));
    await page.evaluate((c)=>{ window.prompt = () => c; }, code);
    await page.evaluate(()=>document.querySelector('[data-on="importShareCode"]').click());
    await sleep(400);
    const viaButton = await page.evaluate(()=>((window.blocks||[]).length));
    check('import-code button loads from pasted code', viaButton > 0, 'blocks='+viaButton);

    // README names units/profile for the picked engine (no download needed).
    const readmeGeneric = await page.evaluate(()=>window.buildBundleReadme());
    check('README names the model and generic units', readmeGeneric.includes(safe + '.obj') && /1 unit = 1 m/.test(readmeGeneric) && /How to import/.test(readmeGeneric), readmeGeneric.split('\n')[0]);
    await page.evaluate(()=>window.setEngineContext('unreal'));
    const readmeUnreal = await page.evaluate(()=>window.buildBundleReadme());
    check('README follows the engine profile (cm, Z-up)', /1 unit = 1 cm/.test(readmeUnreal) && /Z-up/.test(readmeUnreal) && /Unreal/.test(readmeUnreal), readmeUnreal.split('\n').find(l=>/Model profile/.test(l)) || '');
    await page.evaluate(()=>window.setEngineContext(''));

    // One-click bundle: click the real button, catch the real download.
    const before = zipsIn(dlDir);
    await page.evaluate(()=>document.querySelector('[data-on="exportBundle"]').click());
    const zipPath = await waitForZip(dlDir, before);
    check('bundle button downloads a zip', !!zipPath, zipPath || 'no zip arrived');
    if (zipPath) {
      const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
      const names = Object.keys(zip.files);
      check('zip holds the model file', names.includes(safe + '.obj'), names.join(','));
      check('zip holds the README', names.includes('README.txt'));
      check('zip holds the preview PNG', names.includes('preview.png'));
      const obj = await zip.file(safe + '.obj').async('string');
      check('model is the BuildLab OBJ', obj.startsWith('# JVDesignStudio BuildLab') && /^v /m.test(obj), obj.slice(0, 60).replace(/\n/g, ' | '));
      const readme = await zip.file('README.txt').async('string');
      check('packed README names units and import steps', /1 unit = 1 m/.test(readme) && /How to import/.test(readme));
      const png = await zip.file('preview.png').async('nodebuffer');
      check('preview PNG is a real photo', png.length > 2000 && png[0] === 0x89 && png[1] === 0x50, 'bytes='+png.length);
    }

    // Empty scene: no zip, clean null, kind toast path.
    await page.evaluate(()=>window.clearAll(true));
    const beforeEmpty = zipsIn(dlDir);
    const emptyRes = await page.evaluate(()=>window.exportBundle().then(p => p ? p.files : null));
    await sleep(1500);
    check('empty scene exports nothing', emptyRes === null && zipsIn(dlDir).length === beforeEmpty.length);

    // Refactored paths still behave exactly as before (same downloads, same links).
    await page.evaluate(()=>window.quickBuild('house'));
    await page.evaluate(()=>window.exportOBJFallback());
    await sleep(1200);
    const objDl = fs.readdirSync(dlDir).filter(f=>f.endsWith('.obj'));
    check('single OBJ export still downloads', objDl.length > 0, objDl.join(','));
    if (objDl.length) {
      const head = fs.readFileSync(path.join(dlDir, objDl[0]), 'utf8').slice(0, 40);
      check('downloaded OBJ keeps its header', head.startsWith('# JVDesignStudio BuildLab'), head.split('\n')[0]);
    }
    await page.evaluate(()=>window.exportScreenshot());
    await sleep(1500);
    const pngDl = fs.readdirSync(dlDir).filter(f=>f.endsWith('.png') && !f.endsWith('.crdownload'));
    check('photo export still downloads a PNG', pngDl.length > 0, pngDl.join(','));
    const linkOk = await page.evaluate(()=>{
      window.clearAll(true);
      window.quickBuild('tower');
      const before = (window.blocks||[]).length;
      try { window.shareBuild(); } catch(e) { return {err:String(e)}; }
      const code = window.getShareCode();
      window.clearAll(true);
      location.hash = '#b=' + code;
      const loaded = window.loadFromHash();
      return {before, loaded, after:(window.blocks||[]).length};
    });
    check('share link and hash loading still work', !linkOk.err && linkOk.loaded === true && linkOk.after === linkOk.before && linkOk.before > 0, JSON.stringify(linkOk));

    const cspViolation = errors.some(e=>/Content Security Policy|violates/i.test(e));
    check('no CSP violations', !cspViolation, errors.filter(e=>/Content Security Policy|violates/i.test(e))[0] || '');
    check('zero runtime errors', errors.length === 0, errors.slice(0,2).join(' | '));
    await page.close();
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB BUNDLE CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
