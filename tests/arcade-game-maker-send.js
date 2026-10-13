#!/usr/bin/env node
/*
 * tests/arcade-game-maker-send.js , checks the "Send to a Friend" flow on the
 * Arcade Game Maker (tools/arcade-game-maker.html):
 *   - _buildExportHtml() packs a self-contained single-file game (shared with ⬇)
 *   - sendGameToFriend() hands that game to the share sheet as a real .html File
 *   - when the browser cannot share files it saves the game and copies an invite
 * Run: node tests/arcade-game-maker-send.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_SEND_PORT || 8982;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };

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
  const jsErrors=[];
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon/.test(text)) return;
    jsErrors.push(text);
  });
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  await new Promise(r=>setTimeout(r,400));

  const r = await page.evaluate(async ()=>{
    const out = {
      fn: typeof sendGameToFriend === 'function',
      builder: typeof _buildExportHtml === 'function',
      btn: !!document.querySelector('button[onclick="sendGameToFriend()"]'),
    };
    // Seed a finished project so the builder has something to pack.
    _engineData = { title:'Send Test Game', genre:'SHOOTER', speed:200, gravity:600, jump:450, map:null };
    if (document.getElementById('gameTitle')) document.getElementById('gameTitle').value = 'Send Test Game';

    const realShare = navigator.share, realCan = navigator.canShare;
    const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
    const realClick = HTMLAnchorElement.prototype.click;
    let shared = null, downloads = [];
    try {
      // 1) share-sheet path: pretend the browser can share files
      navigator.canShare = () => true;
      navigator.share = async (data) => { shared = data; };
      URL.createObjectURL = () => 'blob:test';
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function(){ downloads.push(this.download); };
      await sendGameToFriend();

      if (shared) {
        const f = shared.files && shared.files[0];
        out.hasFile = !!f;
        out.fileName = f && f.name;
        out.fileType = f && f.type;
        out.hasText = typeof shared.text === 'string' && shared.text.length > 0;
        if (f) {
          const t = await f.text();
          out.fileLen = t.length;
          out.isDoc = /^<!DOCTYPE html>/i.test(t.trim());
          out.hasPhaser = /phaser/i.test(t);
          out.hasExportMode = t.includes('__exportMode');
          out.hasTitle = t.includes('Send Test Game');
        }
      }
      // 2) fallback path: browser cannot share files -> download + copy invite
      shared = null;
      navigator.canShare = () => false;
      await sendGameToFriend();
      out.fallbackShared = shared;
      out.fallbackDownloads = downloads.slice();
      // 3) regression: the ⬇ Download button still saves the packed game
      downloads.length = 0;
      out.exportGameFn = typeof exportGame === 'function';
      await exportGame();
      out.exportDownloads = downloads.slice();
    } catch(e) { out.error = e.message; }
    navigator.share = realShare; navigator.canShare = realCan;
    URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke;
    HTMLAnchorElement.prototype.click = realClick;
    return out;
  });

  check('sendGameToFriend exists', r.fn === true);
  check('_buildExportHtml builder exists', r.builder === true);
  check('Send to a Friend button is in the Save & Share row', r.btn === true);
  check('shared the game as a File', r.hasFile === true, r.error || '');
  check('shared file is named .html', !!r.fileName && /\.html$/.test(r.fileName), r.fileName);
  check('shared file is text/html', r.fileType === 'text/html', r.fileType);
  check('share carries an invite message', r.hasText === true);
  check('shared file is a standalone HTML document', r.isDoc === true, 'len=' + (r.fileLen || 0));
  check('shared file inlines Phaser (works offline)', r.hasPhaser === true);
  check('shared file is an export-mode game', r.hasExportMode === true);
  check('shared file carries the game title', r.hasTitle === true);
  check('fallback downloads the game when files cannot be shared', Array.isArray(r.fallbackDownloads) && r.fallbackDownloads.some(n=>/\.html$/.test(n)), (r.fallbackDownloads||[]).join(','));
  check('fallback does not share a file', r.fallbackShared === null || r.fallbackShared === undefined);
  check('exportGame still downloads the packed .html (refactor regression)', r.exportGameFn === true && (r.exportDownloads||[]).some(n=>/\.html$/.test(n)), (r.exportDownloads||[]).join(','));
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER SEND CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
