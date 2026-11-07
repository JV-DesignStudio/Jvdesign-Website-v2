#!/usr/bin/env node
/*
 * tests/pixel-studio-echo.js
 * A2788: the Improve step. Saving v1 opens Echo's prompt, one prompt re-opens
 * the same project, the second save shows a before/after card and an Echo
 * badge, and the result survives a reload.
 * Run: node tests/pixel-studio-echo.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PSECHO_PORT || 8131;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};

let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
};

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('jvds_pixel_seen','1'); } catch(e){} });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 900));

  // 1. First save becomes v1 and asks one Echo question.
  const v1 = await page.evaluate(() => {
    setCanvasSize(8, 8, false);
    frames = [[new ImageData(8, 8)]];
    frameMeta = [{ clip: 'idle', hold: 1 }];
    currentFrame = 0; currentLayer = 0;
    paintPx(getID(), 3, 4, '#ff0000', false);
    const saved = saveProject();
    const st = JSON.parse(localStorage.getItem('jvds_echo_improve') || '{}');
    const keep = JSON.parse(localStorage.getItem('jvds_pixel_keepsake') || '[]');
    const box = document.getElementById('echo-improve');
    return {
      saved,
      stage: st.stage,
      hasV1Project: !!(st.v1 && st.v1.project),
      keepTag: keep[0] && keep[0].echo,
      visible: !!box && getComputedStyle(box).display !== 'none',
      title: (document.getElementById('echo-title') || {}).textContent || '',
      prompts: (document.getElementById('echo-prompts') || {}).style.display
    };
  });
  check('first save stores v1', v1.saved === true && v1.stage === 'v1_saved' && v1.hasV1Project, JSON.stringify(v1));
  check('Echo strip appears with the question and three prompts', v1.visible && /one thing/i.test(v1.title) && v1.prompts === 'flex', JSON.stringify(v1));
  check('v1 is tagged in the keepsake', v1.keepTag === 'v1', String(v1.keepTag));

  // 2. One prompt re-opens the same project and marks v2 in progress.
  const improving = await page.evaluate(() => {
    echoStartImprove('clearer');
    const st = JSON.parse(localStorage.getItem('jvds_echo_improve') || '{}');
    return {
      stage: st.stage,
      prompt: st.prompt,
      sub: (document.getElementById('echo-sub') || {}).textContent || '',
      promptsHidden: (document.getElementById('echo-prompts') || {}).style.display === 'none'
    };
  });
  check('a prompt starts the v2 edit', improving.stage === 'improving' && improving.prompt === 'clearer' && improving.promptsHidden, JSON.stringify(improving));

  // 3. The second save is v2: before/after card plus the Echo badge.
  const v2 = await page.evaluate(() => {
    paintPx(getID(), 4, 4, '#00ff00', false);
    const saved = saveProject();
    const st = JSON.parse(localStorage.getItem('jvds_echo_improve') || '{}');
    const keep = JSON.parse(localStorage.getItem('jvds_pixel_keepsake') || '[]');
    const cmp = document.getElementById('echo-compare');
    return {
      saved,
      stage: st.stage,
      badge: !!st.badge,
      hasV2Thumb: !!(st.v2 && st.v2.thumb),
      keepTag: keep[0] && keep[0].echo,
      title: (document.getElementById('echo-title') || {}).textContent || '',
      compareShown: !!cmp && getComputedStyle(cmp).display !== 'none',
      compareImages: cmp ? cmp.querySelectorAll('img').length : 0,
      badgeText: cmp ? /Echo badge/i.test(cmp.textContent || '') : false,
      againVisible: (document.getElementById('echo-again') || {}).style.display === 'inline-flex'
    };
  });
  check('second save completes v2', v2.saved === true && v2.stage === 'done' && v2.badge && v2.hasV2Thumb && v2.keepTag === 'v2', JSON.stringify(v2));
  check('before/after card and Echo badge are shown', v2.compareShown && v2.compareImages === 2 && v2.badgeText && v2.againVisible, JSON.stringify(v2));

  // 4. The result survives a reload.
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 900));
  const restored = await page.evaluate(() => {
    const cmp = document.getElementById('echo-compare');
    return {
      title: (document.getElementById('echo-title') || {}).textContent || '',
      images: cmp ? cmp.querySelectorAll('img').length : 0,
      visible: !!cmp && getComputedStyle(cmp).display !== 'none'
    };
  });
  check('the v2 card restores after reload', /v2/i.test(restored.title) && restored.images === 2 && restored.visible, JSON.stringify(restored));

  // 5. The strip fits a phone without sideways scrolling.
  await page.setViewport({ width: 390, height: 780 });
  await new Promise(r => setTimeout(r, 250));
  const mobile = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  check('no horizontal scroll at 390px', mobile.scrollWidth <= mobile.innerWidth + 1, JSON.stringify(mobile));

  check('no uncaught JS errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PIXEL STUDIO ECHO CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
