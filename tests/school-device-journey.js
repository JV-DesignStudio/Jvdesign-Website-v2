#!/usr/bin/env node
/*
 * tests/school-device-journey.js
 * A2644: the arrive -> first make -> save -> export journey on an emulated
 * locked-down school device:
 *   - 1366x768 Chromebook-class viewport
 *   - 4x CPU slowdown and a 1 Mbps / 300 ms network
 *   - third-party requests blocked (school filter)
 *   - clean storage, no extensions
 *   - a second pass with the network cut after one warm visit (offline)
 * Screenshots and timings are written to reports/school-device-journey/.
 *
 * Run: node tests/school-device-journey.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SCHOOL_PORT || 19261);
const OUT = path.join(ROOT, 'reports', 'school-device-journey');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json'
};

let browser;
const checks = [];
const findings = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(''); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

async function shoot(page, name) {
  try { await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 62 }); } catch (e) {}
}

async function dismissQuiz(page) {
  await page.evaluate(() => {
    const bd = document.querySelector('.mascot-quiz-backdrop');
    if (!bd) return;
    const skip = bd.querySelector('#quizSkip');
    if (skip) skip.click(); else bd.remove();
  });
}

async function pixelAt(page) {
  return page.evaluate(() => {
    const c = document.getElementById('fmCanvas');
    if (!c) return '';
    const d = c.getContext('2d').getImageData(16, 16, 1, 1).data;
    return [d[0], d[1], d[2], d[3]].join(',');
  });
}

async function paintDoodle(page) {
  await page.waitForSelector('#fmCanvas', { timeout: 90000 });
  await sleep(1800);
  await page.evaluate(() => document.querySelectorAll('#fmPalette .fm-swatch')[1].click());
  const canvas = await page.$('#fmCanvas');
  await canvas.scrollIntoView();
  await sleep(600);
  const before = await pixelAt(page);
  for (let attempt = 0; attempt < 4; attempt++) {
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width / 16, box.y + box.height / 16);
    await sleep(400);
    if ((await pixelAt(page)) !== before) break;
  }
  return page.evaluate(() => document.getElementById('fmStart').getAttribute('href'));
}

async function drawInStudio(page) {
  await page.waitForFunction(() => typeof window.saveProject === 'function' && typeof flattenFrame === 'function', { timeout: 90000 });
  await sleep(2500);
  const canvas = await page.$('#main-canvas');
  await canvas.scrollIntoView();
  await sleep(600);
  for (let attempt = 0; attempt < 5; attempt++) {
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * (0.35 + attempt * 0.08), box.y + box.height * (0.35 + attempt * 0.08));
    await sleep(700);
    const blank = await page.evaluate(() => {
      try { return _frameIsBlank(flattenFrame(currentFrame)); } catch (e) { return null; }
    });
    if (blank === false) return true;
  }
  return false;
}

async function waitForPng(dir, timeout) {
  const end = Date.now() + (timeout || 30000);
  while (Date.now() < end) {
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f) && !/\.crdownload$/i.test(f)); } catch (e) {}
    if (files.length) {
      const file = path.join(dir, files[0]);
      try {
        const size = fs.statSync(file).size;
        const head = fs.readFileSync(file).subarray(0, 8);
        const isPng = head.length === 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
        if (isPng && size > 80) return { file, size };
      } catch (e) {}
    }
    await sleep(400);
  }
  return null;
}

async function runJourney(page, label, base, downloadDir) {
  const t0 = Date.now();
  const timings = {};

  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await dismissQuiz(page);
  const arrive = await page.evaluate(() => !!document.getElementById('fmCanvas'));
  check(label + ': home shows the first-make canvas', arrive);
  timings.arrive = Date.now() - t0;
  await shoot(page, label + '-01-arrive');

  const startHref = await paintDoodle(page);
  check(label + ': the doodle is carried into Pixel Studio', /#first-mission&art=/.test(startHref || ''), (startHref || '').slice(0, 48));
  const painted = await page.evaluate((h) => {
    const m = (h || '').match(/#first-mission&art=([^&]+)/);
    if (!m) return 0;
    try { return JSON.parse(decodeURIComponent(atob(m[1]))).grid.filter(Boolean).length; } catch (e) { return 0; }
  }, startHref);
  check(label + ': the doodle really contains a painted pixel', painted >= 1, 'painted=' + painted);
  timings.firstMake = Date.now() - t0;
  await shoot(page, label + '-02-first-make');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }),
    page.evaluate(() => document.getElementById('fmStart').click())
  ]);
  await page.waitForFunction(() => window._firstMission === true && !!document.getElementById('main-canvas'), { timeout: 120000 });
  check(label + ': Pixel Studio opens in the first mission', true);
  timings.pixelStudio = Date.now() - t0;
  await shoot(page, label + '-03-pixel-studio');

  const drew = await drawInStudio(page);
  check(label + ': drawing marks the pixel canvas', drew);
  await shoot(page, label + '-04-drawing');

  const saved = await page.evaluate(() => {
    let ret;
    try { ret = window.saveProject(); } catch (e) { ret = 'threw ' + (e.name || e.message); }
    let stored = false, keep = 0;
    try { stored = !!localStorage.getItem('jvds_pixel'); keep = JSON.parse(localStorage.getItem('jvds_pixel_keepsake') || '[]').length; } catch (e) {}
    return { ret, stored, keep, flag: window._projectSaved === true };
  });
  check(label + ': Save writes the project', saved.ret === true && saved.stored && saved.flag, JSON.stringify(saved));
  check(label + ': Save adds a keepsake', saved.keep >= 1, 'keepsakes=' + saved.keep);
  timings.saved = Date.now() - t0;
  await shoot(page, label + '-05-saved');

  const exportProbe = await page.evaluate(() => {
    let blank = null;
    try { blank = _frameIsBlank(flattenFrame(currentFrame)); } catch (e) {}
    let ret;
    try { ret = window.exportPNG(); } catch (e) { ret = 'threw ' + (e.name || e.message); }
    return { blank, ret, toast: (document.getElementById('toast') || {}).textContent || '' };
  });
  check(label + ': the Export action reports success', exportProbe.ret === true, String(exportProbe.ret));
  const png = await waitForPng(downloadDir, 40000);
  const exportErr = await page.evaluate(() => window.__exportErr || '');
  check(label + ': Export produces a real PNG', !!png, png ? png.size + ' bytes' : exportErr || 'no file');
  timings.exported = Date.now() - t0;
  await shoot(page, label + '-06-exported');

  const finish = await page.evaluate(() => ({
    heading: (document.getElementById('fm-heading') || {}).textContent || '',
    nextShown: (() => { const n = document.getElementById('next-actions'); if (!n) return false; const cs = getComputedStyle(n); return cs.display !== 'none' && n.getBoundingClientRect().height > 0; })()
  }));
  check(label + ': the journey ends on a clear next step', /done/i.test(finish.heading) && /play/i.test(finish.heading), finish.heading);
  if (!finish.nextShown) findings.push('Pixel Studio hides the Play/Improve "What next?" bar inside the collapsed Saves & quests drawer on desktop.');

  const authWall = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[role="dialog"], dialog[open], [class*="login"], [id*="login"], [class*="signup"], [id*="signup"]')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0;
      });
    return nodes.map((n) => n.textContent).join(' ').slice(0, 200);
  });
  check(label + ': no account wall blocks the journey', !/sign in|log in|create account|sign up/i.test(authWall), authWall);

  const totalMin = (Date.now() - t0) / 60000;
  check(label + ': the whole journey fits inside 15 minutes', totalMin < 15, totalMin.toFixed(1) + ' min');

  return timings;
}

async function runOffline(base, downloadDir) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort();
  });
  try {
    await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 60000))])).catch(() => {});
    await page.reload({ waitUntil: 'load', timeout: 90000 });
    const controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
    check('offline: the service worker controls the home page', controlled);

    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissQuiz(page);
    const home = await page.evaluate(() => !!document.getElementById('fmCanvas'));
    check('offline: home still loads from cache', home);
    await shoot(page, 'offline-01-home');

    const startHref = await paintDoodle(page);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      page.evaluate(() => document.getElementById('fmStart').click())
    ]).catch(() => {});
    await page.waitForFunction(() => window._firstMission === true && !!document.getElementById('main-canvas'), { timeout: 60000 });
    check('offline: Pixel Studio still opens', true);
    await shoot(page, 'offline-02-pixel-studio');

    const drew = await drawInStudio(page);
    check('offline: drawing still marks the canvas', drew);
    const saved = await page.evaluate(() => {
      let ret;
      try { ret = window.saveProject(); } catch (e) { ret = 'threw'; }
      let stored = false;
      try { stored = !!localStorage.getItem('jvds_pixel'); } catch (e) {}
      return { ret, stored };
    });
    check('offline: Save still works', saved.ret === true && saved.stored, JSON.stringify(saved));

    await page.evaluate(() => { try { window.exportPNG(); } catch (e) {} });
    const png = await waitForPng(downloadDir, 30000);
    check('offline: Export still writes a PNG', !!png, png ? png.size + ' bytes' : 'no file');
    await shoot(page, 'offline-03-exported');
    check('offline: no unexpected runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await page.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => server.listen(PORT, r));
  const base = 'http://127.0.0.1:' + PORT;
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const report = { card: 'A2644', generatedAt: new Date().toISOString(), viewport: '1366x768', cpu: '4x', network: '1 Mbps / 300 ms', profiles: [] };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    const errors = [];
    page.on('request', (r) => {
      const u = r.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort();
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED_BY_CLIENT|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });

    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 300,
      downloadThroughput: 1024 * 1024 / 8, uploadThroughput: 512 * 1024 / 8
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jvds-school-'));
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

    const timings = await runJourney(page, 'throttled', base, downloadDir);
    check('throttled: no unexpected runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    report.profiles.push({ name: 'throttled-chromebook', timings });
    await page.close();

    await runOffline(base, fs.mkdtempSync(path.join(os.tmpdir(), 'jvds-school-offline-')));
    report.profiles.push({ name: 'offline', timings: {} });
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
    report.checks = checks;
    report.findings = findings;
    report.failures = checks.filter((c) => !c.ok).length;
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.log('\n' + failed.length + ' FAILURE(S)');
    process.exit(1);
  }
  console.log('\nALL SCHOOL-DEVICE JOURNEY CHECKS PASSED');
})().catch((e) => {
  console.error('Harness error:', e);
  try { server.close(); } catch (_) {}
  process.exit(1);
});
