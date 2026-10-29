const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19255;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.mjs':'application/javascript'};
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
function check(name, ok, detail=''){
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if(!ok) failures++;
}
let failures = 0;
(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
    errors.push('console: '+text);
  });
  await page.setViewport({width:1280,height:800});
  await page.goto('http://127.0.0.1:' + port + '/tools/palette-studio.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 800));

  const initial = await page.evaluate(()=>({
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    picker: !!document.getElementById('baseColorPicker'),
    hexInput: !!document.getElementById('baseHexInput'),
    grid: !!document.getElementById('paletteGrid'),
    dropZone: !!document.getElementById('dropZone'),
    cleanText: !/[âÃï�]/.test(document.body.innerText),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    exportCSS: typeof window.exportCSS === 'function',
    exportHEX: typeof window.exportHEX === 'function',
    exportPNG: typeof window.exportPNG === 'function',
    exportJSON: typeof window.exportJSON === 'function',
    generateHarmony: typeof window.generateHarmony === 'function',
    paletteLength: (window.palette||[]).length
  }));
  check('title loads', initial.title.includes('Palette Studio'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('colour picker exists', initial.picker);
  check('hex input exists', initial.hexInput);
  check('palette grid exists', initial.grid);
  check('drop zone exists', initial.dropZone);
  check('no visible mojibake', initial.cleanText);
  check('no horizontal overflow at 1280px', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);
  check('export functions exist', initial.exportCSS && initial.exportHEX && initial.exportPNG && initial.exportJSON);
  check('harmony function exists', initial.generateHarmony);
  check('initial palette populated', initial.paletteLength >= 5, String(initial.paletteLength));

  // Test mono harmony generates distinct colours
  const mono = await page.evaluate(()=>{
    window.setHarmony('mono');
    return {len: window.palette.length, first: window.palette[0], last: window.palette[window.palette.length-1]};
  });
  check('mono harmony has 7 swatches', mono.len === 7, String(mono.len));
  check('mono harmony first != last', mono.first !== mono.last);

  // Test analogous harmony
  const anal = await page.evaluate(()=>{
    window.setHarmony('analogous');
    return {len: window.palette.length};
  });
  check('analogous has 5 swatches', anal.len === 5, String(anal.len));

  // Test complementary harmony
  const comp = await page.evaluate(()=>{
    window.setHarmony('complementary');
    return {len: window.palette.length};
  });
  check('complementary has 6 swatches', comp.len === 6, String(comp.len));

  // Test triadic harmony
  const tri = await page.evaluate(()=>{
    window.setHarmony('triadic');
    return {len: window.palette.length};
  });
  check('triadic has 6 swatches', tri.len === 6, String(tri.len));

  // Test hex input update
  const hexChange = await page.evaluate(()=>{
    window.onBaseHexInput('#22c55e');
    return {base: window.baseHex, paletteLen: window.palette.length};
  });
  check('hex input updates base colour', hexChange.base === '#22c55e');
  check('palette regenerates after hex change', hexChange.paletteLen >= 5, String(hexChange.paletteLen));

  // Test image extraction
  const extracted = await page.evaluate(async ()=>{
    const c = document.createElement('canvas');
    c.width = 8; c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle='#ff4f8b';ctx.fillRect(0,0,4,4);
    ctx.fillStyle='#22c55e';ctx.fillRect(4,0,4,4);
    const img = new Image();
    await new Promise(res=>{img.onload=res;img.src=c.toDataURL();});
    const colors = window.extractColorsFromImage(img, 8);
    return {len: colors.length, allHex: colors.every(h=>/^#[0-9a-f]{6}$/i.test(h))};
  });
  check('image extraction returns colours', extracted.len > 0, String(extracted.len));
  check('extracted colours are valid hex', extracted.allHex);

  // Mobile viewport check
  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto('http://127.0.0.1:' + port + '/tools/palette-studio.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 600));
  const mobile = await page.evaluate(()=>({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('no horizontal overflow at 390px', mobile.scrollWidth <= mobile.clientWidth + 2, mobile.scrollWidth + '/' + mobile.clientWidth);

  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL PALETTE STUDIO CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
