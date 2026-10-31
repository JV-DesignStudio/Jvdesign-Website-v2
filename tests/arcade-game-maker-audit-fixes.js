#!/usr/bin/env node
/*
 * tests/arcade-game-maker-audit-fixes.js , A2140
 * Guards the UX fixes from the Arcade Game Maker audit:
 *  - Build tab starts at title + six genres + Run, deeper controls behind
 *    "More options" (collapsed by default, remembered).
 *  - Genre cards are real buttons with aria-pressed.
 *  - The describe box no longer claims to be AI.
 *  - The code reference is labelled as a simplified example, and the snippets
 *    use the scene argument.
 *  - Echo's prototype checklist opens, saves ticks, and reopens with them.
 * Run: node tests/arcade-game-maker-audit-fixes.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_AUDITFIX_PORT || 8993;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const src = fs.readFileSync(path.join(ROOT, 'tools/arcade-game-maker.html'), 'utf8');
  check('onUpdate runtime errors are surfaced', /onUpdate:[\s\S]{0,400}_setCodeStatus\('✗ ' \+ msg/.test(src));
  check('code reference is labelled as a simplified example', /simplified Phaser 3 example/.test(src) && !/Real Phaser 3 source powering/.test(src));
  check('timer snippet uses the scene argument', /timer:\s*'\/\/ Countdown timer, paste into onCreate\\nscene\./.test(src));
  check('spawn snippet uses the scene argument', /spawn:\s*'\/\/ Spawn a moving object, paste into onCreate\\nconst obj=scene\./.test(src));

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
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window.openProtoChecklist === 'function' &&
    document.querySelectorAll('.genre-card.is-rec').length > 0, {timeout:20000});

  const r = await page.evaluate(() => {
    const shown = (el) => !!el && el.getClientRects().length > 0;
    const tab = document.getElementById('tab-build');
    const more = document.getElementById('buildMoreWrap');
    const moreBtn = document.getElementById('buildMoreBtn');
    const speed = document.getElementById('playerSpeed');
    const before = {
      advancedClass: tab.classList.contains('advanced-on'),
      moreShown: shown(more),
      speedShown: shown(speed),
      aria: moreBtn.getAttribute('aria-expanded')
    };
    moreBtn.click();
    const after = {
      advancedClass: tab.classList.contains('advanced-on'),
      moreShown: shown(more),
      speedShown: shown(speed),
      aria: moreBtn.getAttribute('aria-expanded'),
      stored: localStorage.getItem('jv_arcade_more')
    };

    const cards = Array.from(document.querySelectorAll('.genre-card'));
    const cardsAreButtons = cards.every(c => c.tagName === 'BUTTON');
    const active = document.querySelector('.genre-card.on');
    const pressed = cards.filter(c => c.getAttribute('aria-pressed') === 'true').length;

    const describe = document.getElementById('aiPromptInput').closest('div').textContent;
    const codeTab = document.getElementById('tab-code') ? document.getElementById('tab-code').textContent : '';

    openProtoChecklist();
    const modal = document.getElementById('protoModal');
    const boxes = Array.from(document.querySelectorAll('#protoList input[type="checkbox"]'));
    const open = { display: getComputedStyle(modal).display, boxes: boxes.length,
      progress: (document.getElementById('protoProgress') || {}).textContent || '' };
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('jv_proto_check') || '{}');
    closeProtoChecklist();
    openProtoChecklist();
    const reopenedChecked = Array.from(document.querySelectorAll('#protoList input[type="checkbox"]'))
      .filter(b => b.checked).length;
    closeProtoChecklist();

    return {
      before, after,
      cardsAreButtons, activePressed: active ? active.getAttribute('aria-pressed') : null, pressed,
      describeHasAi: /AI fills settings|🤖/.test(describe), describeHasQuick: /quick setup/.test(describe),
      codeHasRealLabel: /Real Phaser 3 source/.test(codeTab), codeHasSimplified: /simplified Phaser 3 example/i.test(codeTab),
      proto: open,
      savedName: saved.name === true,
      reopenedChecked,
      modalClosed: getComputedStyle(modal).display === 'none'
    };
  });

  check('More options is collapsed by default', r.before.advancedClass === false && r.before.moreShown === false &&
    r.before.speedShown === false && r.before.aria === 'false');
  check('More options opens the deeper controls', r.after.advancedClass === true && r.after.moreShown === true &&
    r.after.speedShown === true && r.after.aria === 'true');
  check('More options choice is remembered', r.after.stored === '1');
  check('every genre card is a real button', r.cardsAreButtons === true);
  check('the active genre exposes aria-pressed', r.activePressed === 'true' && r.pressed === 1, 'pressed=' + r.pressed);
  check('describe box no longer claims to be AI', r.describeHasAi === false && r.describeHasQuick === true);
  check('code reference is a simplified example in the DOM', r.codeHasRealLabel === false && r.codeHasSimplified === true);
  check('prototype checklist opens with five items', r.proto.display === 'flex' && r.proto.boxes === 5, r.proto.boxes + ' items');
  check('prototype checklist saves a tick', r.savedName === true);
  check('prototype checklist reopens with saved ticks', r.reopenedChecked === 1, r.reopenedChecked + ' checked');
  check('prototype checklist closes', r.modalClosed === true);
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER AUDIT-FIX CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
