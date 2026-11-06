#!/usr/bin/env node
/*
 * tests/publish-http.js , A1502
 * The Publish to Gallery flow: the maker has a Publish button + function, and
 * pages/publish.html carries a working Formspree form (name, email, title,
 * genre, files, consent), prefills title/genre from the query and lays out at
 * 390 and 1440. Run: node tests/publish-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PUBLISH_PORT || 8997;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const server = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err,buf)=>{
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
    const t = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon|net::/.test(t)) return;
    jsErrors.push(t);
  });
  await page.setViewport({width:1280,height:900});

  // Prefill title + genre from the query the maker opens.
  await page.goto(BASE+'pages/publish.html?title=Test%20Rocket&genre=Space%20Shooter', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#publishForm', {timeout:15000});

  const r = await page.evaluate(()=>{
    const f = document.getElementById('publishForm');
    const req = ['name','email','title','game','consent'];
    const fields = {};
    req.forEach(n=>{ const el = f.querySelector('[name="'+n+'"]'); fields[n] = !!(el && el.required); });
    return {
      title: document.title,
      action: f.getAttribute('action'),
      method: (f.getAttribute('method')||'').toUpperCase(),
      enctype: f.getAttribute('enctype') || f.enctype,
      hasFileInputs: f.querySelectorAll('input[type="file"]').length,
      required: fields,
      note: (document.querySelector('.gl-note')||{}).textContent || '',
      titleVal: (document.getElementById('pubTitle')||{}).value || '',
      genreVal: (document.getElementById('pubGenre')||{}).value || '',
      submit: !!f.querySelector('button[type="submit"]')
    };
  });

  check('publish page loads with a title', /Gallery/i.test(r.title), r.title);
  check('form posts to the Formspree endpoint', r.action === 'https://formspree.io/f/xvkowqqw', r.action);
  check('form uses POST + multipart (file uploads)', r.method === 'POST' && /multipart\/form-data/.test(r.enctype), r.method + ' ' + r.enctype);
  check('form has the required fields', Object.values(r.required).every(Boolean), JSON.stringify(r.required));
  check('form accepts a game file and a cover', r.hasFileInputs >= 2, r.hasFileInputs + ' file inputs');
  check('form has a submit button', r.submit === true);
  check('moderation step is explained', /check|review|before it appears|before it goes/i.test(r.note), r.note.slice(0,80));
  check('title prefills from the maker', r.titleVal === 'Test Rocket', r.titleVal);
  check('genre prefills from the maker', r.genreVal === 'Space Shooter', r.genreVal);

  // A2640: under-13 submissions need a parent or guardian to agree.
  const age = await page.evaluate(()=>{
    const f = document.getElementById('publishForm');
    const radios = Array.from(f.querySelectorAll('input[name="age"]'));
    const block = document.getElementById('guardianBlock');
    const gname = document.getElementById('guardianName');
    return {
      radios: radios.map(x=>x.value),
      hiddenAtStart: block.hidden,
      nameRequiredAtStart: !!(gname && gname.required),
      makerConsentRequired: !!(f.querySelector('[name="consent"]') || {}).required,
      hasGuardianName: !!f.querySelector('[name="guardian_name"]'),
      hasGuardianConsent: !!f.querySelector('[name="guardian_consent"]')
    };
  });
  check('age question offers 13+ and under 13', age.radios.includes('13+') && age.radios.includes('under13'), age.radios.join(','));
  check('guardian fields are wired for the form response', age.hasGuardianName && age.hasGuardianConsent);
  check('guardian block is hidden and optional until under 13 is chosen', age.hiddenAtStart === true && age.nameRequiredAtStart === false);
  check('maker consent is still required', age.makerConsentRequired === true);

  const under = await page.evaluate(()=>{
    const f = document.getElementById('publishForm');
    const radio = f.querySelector('input[name="age"][value="under13"]');
    radio.checked = true; radio.dispatchEvent(new Event('change', {bubbles:true}));
    const gname = document.getElementById('guardianName');
    const gconsent = document.getElementById('guardianConsent');
    return {
      hidden: document.getElementById('guardianBlock').hidden,
      nameRequired: gname.required,
      consentRequired: gconsent.required,
      valid: f.checkValidity()
    };
  });
  check('choosing under 13 reveals the guardian block', under.hidden === false);
  check('under 13 makes guardian name and consent required', under.nameRequired === true && under.consentRequired === true);
  check('under 13 is invalid until the guardian agrees', under.valid === false);

  const blocked = await page.evaluate(()=>{
    const f = document.getElementById('publishForm');
    const ev = new Event('submit', {bubbles:true, cancelable:true});
    f.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  check('submit is blocked until guardian consent is ticked', blocked === true);

  const agreed = await page.evaluate(()=>{
    const f = document.getElementById('publishForm');
    const g = document.getElementById('guardianConsent');
    g.checked = true; g.dispatchEvent(new Event('change', {bubbles:true}));
    return { required: g.required, checked: g.checked };
  });
  check('guardian consent can be ticked and is recorded in the form', agreed.required === true && agreed.checked === true);

  const over = await page.evaluate(()=>{
    const f = document.getElementById('publishForm');
    const radio = f.querySelector('input[name="age"][value="13+"]');
    radio.checked = true; radio.dispatchEvent(new Event('change', {bubbles:true}));
    const gname = document.getElementById('guardianName');
    const gconsent = document.getElementById('guardianConsent');
    return {
      hidden: document.getElementById('guardianBlock').hidden,
      nameRequired: gname.required,
      consentRequired: gconsent.required,
      consentChecked: gconsent.checked
    };
  });
  check('choosing 13+ hides the guardian block', over.hidden === true);
  check('13+ does not require guardian details', over.nameRequired === false && over.consentRequired === false);
  check('guardian consent is cleared when not needed', over.consentChecked === false);

  // The real path is an emailed submission plus a human check, not auto-publish.
  const publishSrc = fs.readFileSync(path.join(ROOT, 'pages/publish.html'), 'utf8');
  const privacySrc = fs.readFileSync(path.join(ROOT, 'pages/privacy-policy.html'), 'utf8');
  const safetySrc = fs.readFileSync(path.join(ROOT, 'pages/child-safety.html'), 'utf8');
  check('publish page never writes the gallery directly', !/gallery-games/.test(publishSrc));
  check('publish page states nothing goes live automatically', /nothing goes live automatically/i.test(publishSrc));
  check('privacy policy describes gallery submissions and guardian consent', /Community Gallery, the form asks for/.test(privacySrc) && /a parent or guardian has to add their name and agree/.test(privacySrc));
  check('child safety page describes under-13 guardian consent', /under 13/i.test(safetySrc) && /a parent or guardian must add their name/i.test(safetySrc));
  check('child safety page states a person checks every game', /a person reads the submission before it can appear/i.test(safetySrc));

  // Layout at phone + desktop.
  for (const w of [390, 1440]) {
    await page.setViewport({width:w, height:880});
    await new Promise(res=>setTimeout(res,150));
    const ov = await page.evaluate(()=>document.documentElement.scrollWidth - window.innerWidth);
    check('no horizontal scroll at ' + w + 'px', ov <= 1, 'overflow ' + ov + 'px');
  }

  // The maker exposes the Publish action.
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  const maker = await page.evaluate(()=>({
    fn: typeof publishToGallery === 'function',
    btn: !!document.querySelector('[data-on="publishToGallery"]') || !!document.querySelector('button[onclick="publishToGallery()"]')
  }));
  check('maker has a publishToGallery function', maker.fn === true);
  check('maker has a Publish to Gallery button', maker.btn === true);

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PUBLISH CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
