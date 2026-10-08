// Shared harness for the character quote pages: pages/quotes.html and the five
// character pages. Verifies the quote cards render from the JVDS_QUOTES library,
// the right character appears, canonical/viewport are present, filters work and
// there are no uncaught JS errors over HTTP.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png',
  '.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.avif':'image/avif','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'
};

function serve(){
  return http.createServer((req,res)=>{
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if(!path.extname(p)) p = path.join(p,'index.html');
    fs.readFile(p,(e,d)=>{
      if(e){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});
      res.end(d);
    });
  });
}

async function run({page: pagePath, character, expectCanonical, expectFilter}){
  const PORT = 8200 + Math.floor(Math.random()*400);
  const server = serve();
  await new Promise(r=>server.listen(PORT,r));
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });

  let failures = 0;
  const check=(name,ok,detail)=>{ console.log((ok?'  \u2713 ':'  \u2717 ')+name+(detail!==undefined?' , '+detail:'')); if(!ok) failures++; };

  try{
    await page.goto(`http://127.0.0.1:${PORT}${pagePath}`, {waitUntil:'networkidle2', timeout:30000});
    await page.waitForSelector('.jvds-quote-card', {timeout:10000}).catch(()=>{});

    const s = await page.evaluate(()=>({
      cards: document.querySelectorAll('.jvds-quote-card').length,
      names: [...new Set([...document.querySelectorAll('.jvds-quote-name')].map(e=>e.textContent))],
      canonical: (document.querySelector('link[rel=canonical]')||{}).href||'',
      viewport: !!document.querySelector('meta[name=viewport]'),
      filters: document.querySelectorAll('[data-quote-filter]').length,
      strip: !!document.getElementById('jvds-quote-strip'),
      stripText: (document.querySelector('.jvds-quote-strip-quote')||{}).textContent||''
    }));

    check('quote cards render', s.cards >= 8, String(s.cards));
    check('character name present', s.names.some(n=>n.toLowerCase().includes(character.toLowerCase())), s.names.join(', '));
    check('viewport meta present', s.viewport);
    check('site-wide quote strip present', s.strip && s.stripText.trim().length>0, s.stripText.slice(0,50));
    if(expectCanonical) check('canonical points to '+expectCanonical, s.canonical.includes(expectCanonical), s.canonical);

    if(expectFilter){
      check('filter chips render', s.filters >= 6, String(s.filters));
      await page.$$eval('[data-quote-filter]', els=>{
        const b=[...els].find(e=>e.dataset.quoteFilter==='ember'); if(b) b.click();
      });
      await new Promise(r=>setTimeout(r,150));
      const chars = await page.$$eval('.jvds-quote-card', els=>[...new Set(els.map(e=>e.dataset.character))]);
      check('Ember filter shows only Ember cards', chars.length===1 && chars[0]==='ember', chars.join(','));
    }

    check('zero uncaught JS errors', errors.length===0, errors.slice(0,3).join(' | '));
  } finally {
    await browser.close(); server.close();
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nQUOTES CHECKS PASSED');
  process.exit(failures?1:0);
}

async function runStrip({ page: pagePath, expectStrip }){
  const PORT = 8200 + Math.floor(Math.random()*400);
  const server = serve();
  await new Promise(r=>server.listen(PORT,r));
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });

  let failures = 0;
  const check=(name,ok,detail)=>{ console.log((ok?'  \u2713 ':'  \u2717 ')+name+(detail!==undefined?' , '+detail:'')); if(!ok) failures++; };

  try{
    await page.goto(`http://127.0.0.1:${PORT}${pagePath}`, {waitUntil:'networkidle2', timeout:30000});
    await new Promise(r=>setTimeout(r,300));
    const s = await page.evaluate(()=>({
      strip: !!document.getElementById('jvds-quote-strip'),
      text: (document.querySelector('.jvds-quote-strip-quote')||{}).textContent||'',
      name: (document.querySelector('.jvds-quote-strip-name')||{}).textContent||'',
      avatar: (document.querySelector('.jvds-quote-strip-avatar')||{}).getAttribute?document.querySelector('.jvds-quote-strip-avatar').getAttribute('src'):''
    }));
    if(expectStrip){
      check('quote strip injected', s.strip);
      check('strip shows a crew line', s.text.trim().length > 0, s.text.slice(0,60));
      check('strip names the character', s.name.trim().length > 0, s.name);
      check('strip shows a mascot avatar', /assets\/mascots\//.test(s.avatar), s.avatar);
    } else {
      check('quote strip absent on creator workspace', !s.strip);
    }
    check('zero uncaught JS errors', errors.length===0, errors.slice(0,3).join(' | '));
  } finally {
    await browser.close(); server.close();
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nQUOTE STRIP CHECKS PASSED');
  process.exit(failures?1:0);
}

module.exports = { run, runStrip };
