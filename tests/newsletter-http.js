#!/usr/bin/env node
/*
 * tests/newsletter-http.js (A1658): the newsletter page's dev log preview shows a
 * picture per post and links each card to that post's share link (#post-<id>).
 * Run: node tests/newsletter-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.NEWSLETTER_HTTP_PORT || 8992;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

// The signup is the Beehiiv embed. If any host drops from the CSP the form
// silently disappears, and the 80px-gutter clip is what keeps it usable on
// narrow screens.
const newsletterHtml = fs.readFileSync(path.join(ROOT, 'newsletter.html'), 'utf8');
const csp = (newsletterHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/i) || [])[1] || '';
check('CSP allows the Beehiiv loader', /script-src[^;]*subscribe-forms\.beehiiv\.com/.test(csp));
check('CSP allows the Beehiiv form frame', /frame-src[^;]*subscribe-forms\.beehiiv\.com/.test(csp));
check('page embeds the Beehiiv form', /subscribe-forms\.beehiiv\.com\/v3\/loader\.js/.test(newsletterHtml) && /data-beehiiv-form=/.test(newsletterHtml));
check('embed is widened past the Beehiiv gutter', /#beehiiv-embed iframe\{[^}]*calc\(100% \+ 160px\)/.test(newsletterHtml));
check('no Formspree signup form on the newsletter page', !/id="nlForm"/.test(newsletterHtml));
check('page ships a fallback for a blocked embed', /id="nlFallback"/.test(newsletterHtml) && /id="nlFallbackEmail"/.test(newsletterHtml));
check('fallback offers the direct Beehiiv form', /nlFallback[\s\S]*?subscribe-forms\.beehiiv\.com\/v3\/forms\//.test(newsletterHtml));
check('fallback email form posts to Formspree', /id="nlFallbackForm"[^>]*action="https:\/\/formspree\.io\//.test(newsletterHtml));

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
  await page.goto(BASE+'newsletter.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.nl-devlog-card', {timeout:10000});
  await new Promise(r=>setTimeout(r,400));

  const grid = await page.evaluate(()=>({
    cards: document.querySelectorAll('.nl-devlog-card').length,
    thumbs: document.querySelectorAll('.nl-devlog-card img.nl-devlog-thumb[src*="/assets/devlog/"]').length,
    hrefs: Array.from(document.querySelectorAll('.nl-devlog-card')).map(a=>a.getAttribute('href')),
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  check('preview renders 3 cards', grid.cards === 3, String(grid.cards));
  check('preview cards show a screenshot', grid.thumbs >= 1, String(grid.thumbs));
  check('preview cards link to #post-<id>', grid.hrefs.every(h=>/^\/devlog#post-\d+$/.test(h||'')), grid.hrefs.join(','));
  check('no horizontal overflow at 390', grid.sw<=grid.cw+2, grid.sw+'/'+grid.cw);

  await page.waitForSelector('#beehiiv-embed iframe', {timeout:8000}).catch(()=>{});
  const frameInfo = await page.evaluate(()=>{
    const f = document.querySelector('#beehiiv-embed iframe');
    if (!f) return null;
    const r = f.getBoundingClientRect();
    const wrapper = document.getElementById('beehiiv-embed');
    return { w: Math.round(r.width), h: Math.round(r.height), wrapper: wrapper ? wrapper.clientWidth : 0 };
  });
  if (frameInfo && frameInfo.wrapper) {
    check('Beehiiv iframe fills the card', frameInfo.w >= frameInfo.wrapper - 2, frameInfo.w + '/' + frameInfo.wrapper);
    const frame = page.frames().find(f=>/subscribe-forms\.beehiiv\.com\/v3\/forms/.test(f.url()));
    let inputWidth = 0;
    if (frame) {
      try {
        inputWidth = await frame.evaluate(()=>{
          const i = document.querySelector('input[type=email]');
          return i ? Math.round(i.getBoundingClientRect().width) : 0;
        });
      } catch (e) {}
    }
    check('Beehiiv email field usable at 390', inputWidth === 0 || inputWidth > 150, String(inputWidth));
    await new Promise(r=>setTimeout(r,300));
    const fallbackHidden = await page.evaluate(()=>{
      const f = document.getElementById('nlFallback');
      return !f || getComputedStyle(f).display === 'none';
    });
    check('fallback hides once the embed loads', fallbackHidden);
  } else {
    console.log('SKIP Beehiiv iframe checks (offline or blocked)');
  }

  // A3157: block the third-party embed the way an ad-blocker or school filter
  // would, then prove the signup is still possible.
  const blocked = await browser.newPage();
  await blocked.setRequestInterception(true);
  blocked.on('request', req => req.url().includes('subscribe-forms.beehiiv.com') ? req.abort() : req.continue());
  await blocked.setViewport({width:390,height:844,isMobile:true});
  await blocked.goto(BASE+'newsletter.html#signup', {waitUntil:'domcontentloaded', timeout:30000});
  await new Promise(r=>setTimeout(r,900));
  const fallback = await blocked.evaluate(()=>{
    const box = document.getElementById('nlFallback');
    const email = document.getElementById('nlFallbackEmail');
    const link = document.querySelector('#nlFallback a[href*="subscribe-forms.beehiiv.com"]');
    const iframe = document.querySelector('#beehiiv-embed iframe');
    if (!box) return null;
    const style = getComputedStyle(box);
    return {
      visible: style.display !== 'none' && style.visibility !== 'hidden' && box.getBoundingClientRect().height > 20,
      email: !!email && Math.round(email.getBoundingClientRect().width) > 100,
      link: !!link,
      iframe: !!iframe,
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth
    };
  });
  check('blocked embed shows the fallback form', !!fallback && fallback.visible && fallback.email, JSON.stringify(fallback));
  check('blocked embed fallback links to Beehiiv', !!fallback && fallback.link && !fallback.iframe);
  check('blocked embed fallback has no overflow at 390', !!fallback && fallback.sw <= fallback.cw + 2, fallback ? fallback.sw+'/'+fallback.cw : 'missing');
  await blocked.close();

  await page.setViewport({width:1440,height:900});
  await new Promise(r=>setTimeout(r,150));
  const ov = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  check('no horizontal overflow at 1440', ov.sw<=ov.cw+2, ov.sw+'/'+ov.cw);

  check('newsletter: no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL NEWSLETTER CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
