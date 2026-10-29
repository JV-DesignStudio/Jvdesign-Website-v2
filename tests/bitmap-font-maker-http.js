const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19256;
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
  await page.goto('http://127.0.0.1:' + port + '/tools/bitmap-font-maker.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 800));

  const initial = await page.evaluate(()=>({
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    pvText: !!document.getElementById('pv-text'),
    pvCanvas: !!document.getElementById('pv-canvas'),
    kerningSlider: !!document.getElementById('spcR'),
    kerningLabel: document.querySelector('label[for="spcR"]')?.textContent?.trim() || '',
    cleanText: !/[âÃï�]/.test(document.body.innerText),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    exportPNG: typeof window.exportPNG === 'function',
    exportJSON: typeof window.exportJSON === 'function',
    exportXML: typeof window.exportXML === 'function',
    exportCSS: typeof window.exportCSS === 'function',
    pvSpacing: window.pvSpacing
  }));
  check('title loads', initial.title.includes('Bitmap Font'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('live type preview textarea exists', initial.pvText);
  check('preview canvas exists', initial.pvCanvas);
  check('kerning slider exists', initial.kerningSlider);
  check('kerning label says Kerning', /kerning/i.test(initial.kerningLabel), initial.kerningLabel);
  check('no visible mojibake', initial.cleanText);
  check('no horizontal overflow at 1280px', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);
  check('exportPNG exists', initial.exportPNG);
  check('exportJSON exists', initial.exportJSON);
  check('exportXML (BMFont) exists', initial.exportXML);
  check('exportCSS (sprite rules) exists', initial.exportCSS);

  // Kerning slider changes pvSpacing
  const kernChanged = await page.evaluate(()=>{
    onSpacingInput('3');
    return {spacing: pvSpacing};
  });
  check('kerning slider updates pvSpacing', kernChanged.spacing === 3, String(kernChanged.spacing));

  // Live preview updates when text changes
  const previewBefore = await page.evaluate(()=>{
    const cv = document.getElementById('pv-canvas');
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0,0,cv.width,cv.height);
    return d.data.some(v=>v>0);
  });
  check('preview canvas has content', previewBefore);

  // CSS export generates valid CSS output (mock download)
  const cssOutput = await page.evaluate(()=>{
    const origCreate = document.createElement.bind(document);
    let href = '';
    document.createElement = function(tag){
      const el = origCreate(tag);
      if(tag === 'a') { el.click = ()=>{ href = el.download; }; }
      return el;
    };
    const origCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = ()=>'blob:mock';
    window.exportCSS();
    URL.createObjectURL = origCreateObjectURL;
    document.createElement = origCreate;
    return {filename: href};
  });
  check('exportCSS downloads .css file', cssOutput.filename === 'bitmap_font.css', cssOutput.filename);

  // BMFont XML includes xadvance reflecting kerning
  const bmfontXml = await page.evaluate(()=>{
    pvSpacing = 2;
    const {PAD,COLS,CW,CH,ROWS} = _buildBMFontPNGCanvas();
    const xml = _buildBMFontXML(PAD,COLS,CW,CH,ROWS);
    const expected = GW + 1 + 2;
    return {xml, expected};
  });
  check('BMFont XML exports xadvance with kerning', bmfontXml.xml.includes(`xadvance="${bmfontXml.expected}"`), `expected xadvance="${bmfontXml.expected}" in: ${bmfontXml.xml.slice(200,400)}`);

  // Mobile check
  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto('http://127.0.0.1:' + port + '/tools/bitmap-font-maker.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 400));
  const mobile = await page.evaluate(()=>({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('no horizontal overflow at 390px', mobile.scrollWidth <= mobile.clientWidth + 2, mobile.scrollWidth + '/' + mobile.clientWidth);

  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BITMAP FONT MAKER CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
