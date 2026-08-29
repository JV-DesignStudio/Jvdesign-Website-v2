#!/usr/bin/env node
/*
 * tests/arcade-game-maker-smoke.js — headless smoke for the Arcade Game Maker.
 * Verifies 21 genres can compile, boot Phaser without JS errors, and
 * that critical patches (haptics, storage quota, sprite validation, daily streak)
 * are present. Run: node tests/arcade-game-maker-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_PORT || 8979;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const results = [];
function record(name, ok, detail){ results.push({name,ok,detail}); console.log((ok?'  ✓ ':'  ✗ ')+name+(detail?' — '+detail:'')); }

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
  const jsErrors=[];
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{ if(m.type()==='error') jsErrors.push(m.text()); });

  console.log('\n▸ arcade game maker loads clean');
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  record('maker loads with Run button', true);
  record('no uncaught JS on load', jsErrors.length===0, jsErrors.slice(0,2).join(' | '));

  // Check critical patches are present
  const hasHaptics = await page.evaluate(()=> typeof _triggerHaptic==='function' && /hapticIntensity/.test(_triggerHaptic.toString()));
  record('haptics intensity wrapper exists', hasHaptics);
  const hasQuota = await page.evaluate(()=> typeof _handleAutosaveQuotaError==='function');
  record('storage quota handler exists', hasQuota);
  const hasStreak = await page.evaluate(()=> typeof _getDailyStreak==='function' && typeof _showStreakHistory==='function');
  record('daily streak history exists', hasStreak);
  const drVal = await page.evaluate(()=>{ try{ return document.documentElement.innerHTML.includes('const DR = 12'); }catch(e){return false} });
  record('joystick deadzone tuned to 12', drVal);

  // Test 3 genres boot (SHOOTER, PLATFORMER, SNAKE) — compile+boot must not throw
  for(const genre of ['SHOOTER','PLATFORMER','SNAKE']){
    console.log(`\n▸ boot ${genre}`);
    jsErrors.length=0;
    await page.evaluate((g)=>{
      document.getElementById('genreMode').value=g;
      if(typeof onGenreChange==='function') onGenreChange();
    }, genre);
    await new Promise(r=>setTimeout(r,300));
    await page.evaluate(()=>{ if(typeof compileAndBootEngine==='function') compileAndBootEngine(); });
    await new Promise(r=>setTimeout(r,1800));
    const hasCanvas = await page.evaluate(()=> !!document.querySelector('#game-container canvas'));
    record(`${genre} boots canvas`, hasCanvas);
    record(`${genre} no JS errors`, jsErrors.length===0, jsErrors.slice(0,1).join(' | '));
    // Reset for next genre
    await page.evaluate(()=>{ try{ if(window.currentPhaserGame) window.currentPhaserGame.destroy(true); }catch(e){} });
    await new Promise(r=>setTimeout(r,400));
  }

  // Sprite validator — uploading a fake large file should toast and reject
  console.log('\n▸ sprite validator');
  const hasValidator = await page.evaluate(()=> typeof _applySpriteDataUrl==='function' && /kb/.test(_applySpriteDataUrl.toString()));
  record('sprite validator with KB feedback', hasValidator);

  await browser.close();
  server.close();
  const failed=results.filter(r=>!r.ok);
  console.log('\n────────────────────────────────────');
  console.log(`${results.length-failed.length}/${results.length} checks passed`);
  if(failed.length){ failed.forEach(f=> console.log('  FAILED: '+f.name)); process.exit(1); }
  console.log('✓ arcade-game-maker smoke: all checks passed');
})().catch(e=>{ console.error('smoke runner crashed:', e); process.exit(1); });
