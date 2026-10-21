// my-studio-portfolio.js (A1775): My Studio is a portfolio, not just a scoreboard.
//
// Seeds the same local data real tools write, then checks me.html shows:
//   - recent creations (workshop passports, Pixel Studio keepsake, tool saves)
//   - certificates from the completed-workshop ledger
//   - favourite games from existing best scores
//   - one next-step card, with a resume link from jvds_last_activity
//   - a backup reminder that clears once a backpack is downloaded
//   - an honest empty state on a wiped school profile
// Runs at 390x844 and 1440x900.
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
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
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let failures = 0;
function check(name, ok, detail='') {
  console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));
  if(!ok) failures++;
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const VIEWPORTS = [
  {name:'Phone 390x844', width:390, height:844, mobile:true},
  {name:'Desktop 1440x900', width:1440, height:900, mobile:false},
];

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
  page.on('dialog', d => d.accept());

  const seed = async () => page.evaluate((png)=>{
    localStorage.clear();
    localStorage.setItem('jvds_profile', JSON.stringify({
      globalXP: 215, workshopXP: 150, gameXP: 40, bonusXP: 25, xpSchema: 2,
      completedWorkshops: ['scratch-catch-workshop','mugen-workshop'],
      dailyStreak: 2, lastPlayedDate: new Date().toISOString()
    }));
    localStorage.setItem('jvds.project.python-platformer.l1', JSON.stringify({
      format:'jvds.project', version:1, engine:'Python', series:'python-platformer', lesson:1,
      title:'Python Platformer', page:'/workshops/python-platformer-canvas.html',
      storageKey:'jvds-python-platformer-canvas', updated:new Date().toISOString(),
      completed:['1'], steps:[{num:1},{num:2},{num:3}]
    }));
    localStorage.setItem('jvds_pixel_keepsake', JSON.stringify([
      {id:Date.now(), title:'Ember test sprite', date:new Date().toISOString().slice(0,10), thumb:png, project:'{}'}
    ]));
    localStorage.setItem('jvds_palettes', JSON.stringify([{name:'Sunset'},{name:'Mint'}]));
    localStorage.setItem('echo-fruit-catch_best', JSON.stringify({highScore:420}));
    localStorage.setItem('jvds_last_activity', JSON.stringify({
      type:'tool', url:'/tools/sprite-animator.html', title:'Sprite Animator', ts:Date.now()
    }));
  }, PNG);

  try {
    for (const vp of VIEWPORTS) {
      await page.setViewport({width:vp.width,height:vp.height,isMobile:vp.mobile,hasTouch:vp.mobile,deviceScaleFactor:1});
      await page.goto(base + '/me.html', {waitUntil:'networkidle2', timeout:60000});
      await seed();
      await page.reload({waitUntil:'networkidle2'});
      await page.waitForFunction(()=>document.querySelector('[data-pf="creations"]'), {timeout:8000});
      await sleep(300);

      const view = await page.evaluate(()=>({
        creations: document.querySelector('[data-pf="creations"]')?.textContent || '',
        certs: document.querySelector('[data-pf="certificates"]')?.textContent || '',
        certHrefs: Array.from(document.querySelectorAll('[data-pf="certificates"] a')).map(a=>a.getAttribute('href')),
        games: document.querySelector('[data-pf="games"]')?.textContent || '',
        gameHref: document.querySelector('[data-pf="games"] a')?.getAttribute('href') || '',
        next: document.querySelector('[data-pf="next"]')?.textContent || '',
        nextHref: document.querySelector('[data-pf="next"] a')?.getAttribute('href') || '',
        backup: !!document.querySelector('[data-pf="backup"]'),
        invite: getComputedStyle(document.getElementById('emptyInvite')).display !== 'none',
        overflow: document.documentElement.scrollWidth > window.innerWidth
      }));

      check(vp.name + ': shows the workshop project', /Python Platformer/.test(view.creations), view.creations.slice(0,140));
      check(vp.name + ': shows the pixel keepsake', /Ember test sprite/.test(view.creations));
      check(vp.name + ': shows the tool save', /Colour Palette/.test(view.creations) && /2 saves/.test(view.creations));
      check(vp.name + ': counts the creations', /Recent creations\s*3/.test(view.creations), view.creations.slice(0,60));
      check(vp.name + ': lists certificates from the ledger', /Scratch Fruit Catch/.test(view.certs), view.certs.slice(0,120));
      check(vp.name + ': certificate links to My Progress', view.certHrefs.length>0 && view.certHrefs.every(h=>h==='/workshops/my-progress.html'), view.certHrefs.join(','));
      check(vp.name + ': favourite games come from best scores', /Echo's Fruit Catch/.test(view.games) && /420/.test(view.games), view.games.slice(0,120));
      check(vp.name + ': favourite game links to the Arcade', /^\/arcade\.html\?q=/.test(view.gameHref), view.gameHref);
      check(vp.name + ': next step resumes the last activity', /Continue: Sprite Animator/.test(view.next) && view.nextHref==='/tools/sprite-animator.html', view.next.slice(0,120));
      check(vp.name + ': backup reminder is present', view.backup);
      check(vp.name + ': empty invite is hidden once work exists', !view.invite);
      check(vp.name + ': no horizontal scroll', !view.overflow);
      if (vp.width === 390) await page.screenshot({path:path.join(require('os').tmpdir(),'jvds-my-studio-390.png')});
    }

    // Backup reminder clears after a real download and records the date.
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await page.click('[data-pf="backup"] button');
    await sleep(600);
    const afterBackup = await page.evaluate(()=>({
      stamp: localStorage.getItem('jvds_backpack_last'),
      reminder: !!document.querySelector('[data-pf="backup"]'),
      msg: document.getElementById('backupMsg')?.textContent || ''
    }));
    check('download sets the backpack date', !!afterBackup.stamp, String(afterBackup.stamp));
    check('reminder disappears after download', !afterBackup.reminder);
    check('download message names the saves', /Backpack downloaded/.test(afterBackup.msg), afterBackup.msg);

    // A wiped school profile gets an honest empty state with three ways to start.
    await page.evaluate(()=>localStorage.clear());
    await page.reload({waitUntil:'networkidle2'});
    await page.waitForFunction(()=>document.querySelector('[data-pf="creations"]'), {timeout:8000});
    await sleep(300);
    const empty = await page.evaluate(()=>({
      text: document.querySelector('[data-pf="creations"]')?.textContent || '',
      starts: Array.from(document.querySelectorAll('.pf-start a')).map(a=>({href:a.getAttribute('href'),text:a.textContent})),
      nextHref: document.querySelector('[data-pf="next"] a')?.getAttribute('href') || '',
      nextText: document.querySelector('[data-pf="next"]')?.textContent || '',
      backup: !!document.querySelector('[data-pf="backup"]'),
      invite: getComputedStyle(document.getElementById('emptyInvite')).display !== 'none',
      overflow: document.documentElement.scrollWidth > window.innerWidth
    }));
    check('empty state explains what to do', /Nothing here yet/.test(empty.text), empty.text.slice(0,120));
    check('empty state offers three starting points', empty.starts.length===3, JSON.stringify(empty.starts));
    check('empty state points at Pixel Studio', empty.starts.some(s=>s.href==='/tools/pixel-studio.html'));
    check('first-time next step opens Pixel Studio', empty.nextHref==='/tools/pixel-studio.html' && /Make your first character/.test(empty.nextText), empty.nextHref);
    check('no backup nag with nothing saved', !empty.backup);
    check('empty invite is shown on a clean profile', empty.invite);
    check('empty state has no horizontal scroll', !empty.overflow);

    check('no uncaught page errors', errors.length===0, errors.join(' | '));
  } catch (e) {
    check('test ran without throwing', false, e && e.message);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures === 0 ? 'ALL MY STUDIO PORTFOLIO CHECKS PASSED' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})();
