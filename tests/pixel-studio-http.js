// HTTP runtime verification for Pixel Studio (server + puppeteer in one process).
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.webp':'image/webp'};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

(async () => {
  await new Promise(r => server.listen(8124, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://127.0.0.1:8124/tools/pixel-studio.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const checks = await page.evaluate(() => ({
    manifestLinked: !!document.querySelector('link[rel="manifest"]'),
    manifestIsDedicated: (document.querySelector('link[rel="manifest"]')||{}).href?.includes('pixel-studio.webmanifest'),
    framesReady: Array.isArray(frames) && frames.length === 1,
    installBtns: document.querySelectorAll('.js-install').length,
    hamburgerSingleBound: true
  }));
  // hamburger toggle works (the old double-bind bug)
  await page.setViewport({ width: 390, height: 780 });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navOpened = await page.evaluate(() => {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('navToggle');
    return nav.classList.contains('open') && btn.getAttribute('aria-expanded') === 'true';
  });
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navClosed = await page.evaluate(() => {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('navToggle');
    return !nav.classList.contains('open') && btn.getAttribute('aria-expanded') === 'false';
  });

  // A198: exporting completes the Pip quest once, even when today's export XP is capped.
  const QID = 'quest-24-pip-pixel-character';
  const exportOnce = () => page.evaluate(() => {
    const a = document.createElement('a'); a.download = 'pip.png'; a.href = 'data:image/png;base64,iVBORw0KGgo=';
    document.body.appendChild(a); a.click(); a.remove();
  });
  const questState = () => page.evaluate(q => ({
    completed: !!(playerProfile.getQuestProgress(q) || {}).completed,
    bonusXP: playerProfile.state.bonusXP,
    exports: localStorage.getItem('jvds_tool_export_pixel-studio'),
    cosmetic: playerProfile.hasCosmeticUnlocked('pixel-studio', 'pip-badge'),
    strip: document.getElementById('pipQuestStatus').textContent
  }), QID);
  await page.evaluate(() => {
    localStorage.setItem('jvds_toolxp_' + new Date().toDateString(), JSON.stringify({ 'pixel-studio:export': 3 }));
  });
  const q0 = await questState();
  await exportOnce();
  await new Promise(r => setTimeout(r, 1200));
  const q1 = await questState();
  await new Promise(r => setTimeout(r, 1600)); // past the 1.5s double-fire cooldown
  await exportOnce();
  await new Promise(r => setTimeout(r, 400));
  const q2 = await questState();
  const quest = {
    notDoneAtStart: !q0.completed,
    countsWhileCapped: q1.exports === '1',
    completesOnExport: q1.completed,
    grants75xp: q1.bonusXP - q0.bonusXP === 75,
    cosmeticUnlocked: q1.cosmetic,
    stripSaysUnlocked: /unlocked/i.test(q1.strip),
    noRegrant: q2.bonusXP === q1.bonusXP && q2.exports === '2'
  };
  const questOk = Object.values(quest).every(Boolean);

  console.log('checks:', JSON.stringify(checks));
  console.log('hamburger opens:', navOpened, '| closes:', navClosed);
  console.log('pip quest:', JSON.stringify(quest), questOk ? 'PASS' : 'FAIL');
  if (errors.length) {
    console.log('ERRORS (' + errors.length + '):');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  } else {
    console.log('NO RUNTIME ERRORS over HTTP');
  }
  const pass = checks.framesReady && checks.manifestIsDedicated && navOpened && navClosed && questOk && errors.length === 0;
  console.log(pass ? 'HTTP RUNTIME CHECKS PASSED' : 'FAILURES PRESENT');
  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
