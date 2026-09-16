// First-mission flow tests for Pixel Studio (A258).
// Verifies #first-mission shows the Ember coaching bar, auto-applies character template,
// hides clutter strips, and step indicators update after draw/save/export.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; };

async function runAt(page, viewport) {
  await page.setViewport(viewport);
  // clear localStorage and navigate fresh
  await page.evaluate(() => {
    ['jvds_pixel_seen','jvds_mission_dismiss','ember-guide-pixel-studio-seen',
     'jvds_pixel_auto','jvds_mascot_coach_dismissed'].forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
  });
  await page.goto('http://127.0.0.1:8126/', { waitUntil: 'networkidle2', timeout: 15000 });
  await page.goto('http://127.0.0.1:8126/tools/pixel-studio.html#first-mission', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
}

(async () => {
  await new Promise(r => server.listen(8126, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], defaultViewport: null });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes("Content Security Policy directive 'media-src'"))
      errors.push('console: ' + m.text());
  });

  // === 390px mobile ===
  await runAt(page, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await page.evaluate(() => ({
    firstMissionSet: window._firstMission === true,
    fmBarVisible: (getComputedStyle(document.getElementById('first-mission-bar')).display !== 'none'),
    heading: (document.getElementById('fm-heading') || {}).textContent || '',
    dot1: (document.getElementById('fm-dot-1') || {}).textContent || '',
    keepsakeHidden: getComputedStyle(document.getElementById('keepsake-strip')).display === 'none',
    pipQuestHidden: getComputedStyle(document.getElementById('pip-quest-strip')).display === 'none',
    missionBannerHidden: getComputedStyle(document.getElementById('mission-banner')).display === 'none',
    classicBridgeHidden: getComputedStyle(document.querySelector('.classic-bridge')).display === 'none',
    startModalClosed: !document.getElementById('startModal').classList.contains('open'),
    restoreModalClosed: !document.getElementById('restoreModal').classList.contains('open'),
    characterTemplate: (typeof cW !== 'undefined' ? cW : window.cW) === 16,
    hasGuideLayer: Array.isArray(typeof frames !== 'undefined' ? frames : window.frames) && (typeof frames !== 'undefined' ? frames : [])[0] && (typeof frames !== 'undefined' ? frames : [])[0].length >= 2,
  }));
  ok('390px: _firstMission flag set', m.firstMissionSet);
  ok('390px: first-mission-bar visible', m.fmBarVisible);
  ok('390px: heading says Step 1', m.heading.includes('Step 1'));
  ok('390px: dot-1 says "1 Draw"', m.dot1.includes('Draw'));
  ok('390px: keepsake-strip hidden', m.keepsakeHidden);
  ok('390px: pip-quest-strip hidden', m.pipQuestHidden);
  ok('390px: old mission-banner hidden', m.missionBannerHidden);
  ok('390px: classic-bridge hidden', m.classicBridgeHidden);
  ok('390px: start modal not open', m.startModalClosed);
  ok('390px: restore modal not open', m.restoreModalClosed);
  ok('390px: 16x16 character template applied', m.characterTemplate);

  // step progression
  const s1 = await page.evaluate(() => {
    missionTick('draw');
    return { h: document.getElementById('fm-heading').textContent, d1: document.getElementById('fm-dot-1').textContent };
  });
  ok('step 1→2: heading updates after draw', s1.h.includes('Step 2'));
  ok('step 1→2: dot-1 shows tick', s1.d1.includes('✓'));

  const s2 = await page.evaluate(() => {
    missionTick('save');
    return { h: document.getElementById('fm-heading').textContent, d2: document.getElementById('fm-dot-2').textContent };
  });
  ok('step 2→3: heading updates after save', s2.h.includes('Step 3'));
  ok('step 2→3: dot-2 shows tick', s2.d2.includes('✓'));

  const s3 = await page.evaluate(() => {
    missionTick('export');
    nextActionsShow();
    return {
      h: document.getElementById('fm-heading').textContent,
      d3: document.getElementById('fm-dot-3').textContent,
      nextActionsVisible: getComputedStyle(document.getElementById('next-actions')).display !== 'none',
      playBtn: !!document.querySelector('#next-actions button')
    };
  });
  ok('step 3 done: heading says done', s3.h.includes('Done'));
  ok('step 3 done: dot-3 shows tick', s3.d3.includes('✓'));
  ok('step 3 done: next-actions bar appears', s3.nextActionsVisible);
  ok('step 3 done: Play button in next-actions', s3.playBtn);

  // === 1440px desktop ===
  await runAt(page, { width: 1440, height: 900, deviceScaleFactor: 1 });
  const d = await page.evaluate(() => ({
    firstMissionSet: window._firstMission === true,
    fmBarVisible: getComputedStyle(document.getElementById('first-mission-bar')).display !== 'none',
    missionBannerHidden: getComputedStyle(document.getElementById('mission-banner')).display === 'none',
    characterTemplate: (typeof cW !== 'undefined' ? cW : window.cW) === 16,
  }));
  ok('1440px: first-mission-bar visible', d.fmBarVisible);
  ok('1440px: old mission-banner hidden', d.missionBannerHidden);
  ok('1440px: 16x16 character template applied', d.characterTemplate);

  if (errors.length) {
    console.log('\nRUNTIME ERRORS:');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  } else {
    console.log('\nNo runtime errors.');
  }
  const allPass = failures === 0 && errors.length === 0;
  console.log(allPass ? '\nALL FIRST-MISSION CHECKS PASSED' : '\n' + failures + ' FAILURES, ' + errors.length + ' errors');
  await browser.close();
  server.close();
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
