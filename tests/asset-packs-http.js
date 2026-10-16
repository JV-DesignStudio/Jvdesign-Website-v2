#!/usr/bin/env node
/*
 * tests/asset-packs-http.js (A1597): "Send to Game Maker" on tools/asset-packs.html
 * rasterises the chosen pack sprite and writes it to jvds_sprite_player, which the
 * Arcade Game Maker imports as the player sprite. Run: node tests/asset-packs-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.ASSET_PORT || 8989;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const server = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p.endsWith('/')) p+='index.html';
    fs.readFile(path.join(ROOT,p),(err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=> errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_|Failed to load resource|Aborted|net::|Content Security Policy|violates/i.test(t)) return;
    errors.push('console: '+t);
  });

  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto(BASE+'tools/asset-packs.html', {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,400));

  const init = await page.evaluate(()=>({
    sends: document.querySelectorAll('[data-on="sendAssetToMaker"]').length,
    downloads: document.querySelectorAll('[data-on="dlAssetPNG"]').length,
    fn: typeof sendAssetToMaker === 'function',
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  check('Send to Game Maker buttons render (7 sprites)', init.sends===7, String(init.sends));
  check('Download PNG still present (7 sprites + tileset)', init.downloads===8, String(init.downloads));
  check('sendAssetToMaker exists', init.fn===true);
  check('no horizontal overflow at 390', init.sw<=init.cw+2, init.sw+'/'+init.cw);

  const sent = await page.evaluate(async()=>{
    try{ localStorage.removeItem('jvds_sprite_player'); localStorage.removeItem('jvds_import_slot'); }catch(e){}
    const btn=document.querySelector('[data-on="sendAssetToMaker"][data-png="player-character"]');
    btn.click();
    await new Promise(r=>setTimeout(r,700));
    const v=localStorage.getItem('jvds_sprite_player');
    return { isPng: !!v && /^data:image\/png;base64,/.test(v), slot: localStorage.getItem('jvds_import_slot'), len: v?v.length:0 };
  });
  check('send writes a PNG data URL to jvds_sprite_player', sent.isPng===true, 'len '+sent.len);
  check('send records the player slot (jvds_import_slot)', sent.slot==='player', sent.slot);

  // End-to-end: the Arcade Game Maker imports that key as the player sprite
  const maker = await browser.newPage();
  const makerErrors=[];
  maker.on('pageerror', e=> makerErrors.push(e.message));
  maker.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_|Failed to load resource|Aborted|net::|Content Security Policy|violates/i.test(t)) return;
    makerErrors.push(t);
  });
  await maker.setViewport({width:1280,height:900});
  await maker.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded', timeout:30000});
  await maker.waitForSelector('#runGameBtn', {timeout:20000});
  await new Promise(r=>setTimeout(r,600));
  const applied = await maker.evaluate(()=>{
    const stored = localStorage.getItem('jvds_sprite_player');
    importSpriteFromPixelStudio();
    return { stored: !!stored, isPlayer: customSpriteDataUrl === stored };
  });
  check('maker imports the sent sprite as the player sprite', applied.stored && applied.isPlayer===true, JSON.stringify(applied));
  check('maker: no uncaught JS errors', makerErrors.length===0, makerErrors.slice(0,2).join(' | '));

  await page.setViewport({width:1440,height:900});
  await new Promise(r=>setTimeout(r,150));
  const ov = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  check('no horizontal overflow at 1440', ov.sw<=ov.cw+2, ov.sw+'/'+ov.cw);

  check('asset-packs: no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ASSET PACKS CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
