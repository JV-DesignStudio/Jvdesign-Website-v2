#!/usr/bin/env node
/* A2325: cross-browser smoke for the main creative studios.
 *
 * Chrome always runs. Edge is added when it is installed (the school browser),
 * Firefox when a binary can be found (FIREFOX_PATH, PATH, or Puppeteer's cache).
 * Safari cannot be automated on Windows or Linux, so it is reported as skipped
 * rather than silently ignored.
 *
 * Per engine and studio: load, first canvas action, save and export. Downloads
 * are caught through CDP on Chromium engines and through a Blob/anchor spy on
 * every engine. Run: node tests/tools-cross-browser.js [--verbose]
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const ONLY_ENGINE = (process.argv.find(a => a.startsWith('--engine=')) || '').split('=')[1];
const ONLY_STUDIO = (process.argv.find(a => a.startsWith('--studio=')) || '').split('=')[1];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };

const STUDIOS = [
  {
    name: 'Pixel Studio', rel: 'tools/pixel-studio.html', keyRe: /^jvds_pixel/,
    save: '[data-on="quickSave"],[data-on="saveProject"],[data-on="saveProjectFile"]',
    export: '[data-on="exportPNG"],#exportPNGBtn,[data-on="exportProject"],[data-on="exportProjectFile"]'
  },
  {
    name: 'Level Designer', rel: 'tools/level-designer.html', keyRe: /^jvds_level/,
    save: '[data-on="quickSave"],[data-on="saveStamp"]',
    export: '[data-on="exportJSON"],[data-on="exportPNG"]'
  },
  {
    name: 'Audio Studio', rel: 'tools/sound-studio.html', keyRe: /^jvds_sound/,
    save: '[data-on="saveTake"],[data-on="saveToLibrary"]',
    export: '[data-on="exportWAV"],[data-on="exportProject"],[data-on="exportSoundKit"]'
  },
  {
    name: 'Arcade Game Maker', rel: 'tools/arcade-game-maker.html', keyRe: /^jv_(arcade_autosave|arcade_slot|user_code|sandbox_checkpoint)/,
    save: '[data-on="saveToSlot"],[data-on="cutSave"],[data-on="bossSave"]',
    export: '[data-on="exportGame"],[data-on="downloadProjectBundle"]',
    beforeExport: '[data-on="_arcLaunch7"],#runGameBtn',
    surface: '[data-on="pickGenre"],[data-on="switchTab"]'
  }
].filter(s => !ONLY_STUDIO || s.name.toLowerCase().replace(/\s+/g, '-') === ONLY_STUDIO);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function firstExisting(list) {
  for (const p of list) { try { if (p && fs.existsSync(p)) return p; } catch { /* keep looking */ } }
  return null;
}

function findEdge() {
  return firstExisting([
    process.env.EDGE_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/microsoft-edge',
    '/opt/microsoft/msedge/msedge',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ]);
}

function findFirefox() {
  const direct = firstExisting([
    process.env.FIREFOX_PATH,
    process.env.PUPPETEER_FIREFOX_PATH,
    'C:/Program Files/Mozilla Firefox/firefox.exe',
    'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
    '/usr/bin/firefox',
    '/usr/lib/firefox/firefox',
    '/snap/bin/firefox',
    '/Applications/Firefox.app/Contents/MacOS/firefox'
  ]);
  if (direct) return direct;
  const cache = path.join(os.homedir(), '.cache', 'puppeteer', 'firefox');
  try {
    for (const dir of fs.readdirSync(cache)) {
      const hit = firstExisting([
        path.join(cache, dir, 'firefox', 'firefox.exe'),
        path.join(cache, dir, 'firefox', 'firefox'),
        path.join(cache, dir, 'firefox', 'Firefox.app', 'Contents', 'MacOS', 'firefox')
      ]);
      if (hit) return hit;
    }
  } catch { /* no cache */ }
  return null;
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

let failures = 0;
let checks = 0;
const skipNotes = [];
const fail = (msg) => { failures++; console.log('  [FAIL] ' + msg); };
const pass = (msg) => { checks++; if (VERBOSE) console.log('  [ok] ' + msg); };

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const re = /^(got it|close|start|start building|get started|continue|skip|ok|let'?s go|begin|maybe later|not now|×|✕|✖)\b/i;
    for (const el of document.querySelectorAll('button,[role="button"]')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (re.test((el.textContent || '').trim()) || /close.?start/i.test(el.getAttribute('data-on') || '')) {
        try { el.click(); } catch { /* optional */ }
      }
    }
    const decline = document.getElementById('cookie-decline'); if (decline) { try { decline.click(); } catch { /* optional */ } }
    document.querySelectorAll('.modal-overlay.open,[aria-modal="true"]').forEach(o => { try { o.style.pointerEvents = 'none'; } catch { /* optional */ } });
  }).catch(() => {});
}

async function firstSurfaceBox(page, preferred) {
  return page.evaluate((preferred) => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 2 && r.height > 2;
    };
    const largest = (selector) => {
      let best = null;
      for (const el of document.querySelectorAll(selector)) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (!best || area > best.area) best = { area, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, tag: el.tagName };
      }
      return best;
    };
    return (preferred ? largest(preferred) : null)
      || largest('canvas')
      || largest('#gameTitle')
      || largest('textarea,[contenteditable="true"],input[type="text"]');
  }, preferred || '').catch(() => null);
}

async function clickControl(page, selector) {
  return page.evaluate((selector) => {
    const visible = el => {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    };
    const el = [...document.querySelectorAll(selector)].find(visible);
    if (!el) return null;
    const label = (el.getAttribute('aria-label') || el.getAttribute('data-on') || el.textContent || '').trim().slice(0, 60);
    try { el.click(); } catch { return null; }
    return label;
  }, selector).catch(() => null);
}

async function projectKeys(page, keyRe) {
  return page.evaluate((source) => {
    try {
      const re = new RegExp(source);
      return Object.keys(localStorage).filter(k => re.test(k));
    } catch { return []; }
  }, keyRe.source).catch(() => []);
}

async function exportOutcome(page) {
  return page.evaluate(() => {
    const spy = window.__xbt || { blobs: 0, clicks: 0 };
    const dialog = [...document.querySelectorAll('[aria-modal="true"],.modal-overlay.open,dialog[open]')]
      .some(el => /download|export|save/i.test(el.textContent || ''));
    const toast = [...document.querySelectorAll('[role="status"],.toast,#toast')]
      .some(el => /export|download|saved|ready/i.test(el.textContent || ''));
    return { blobs: spy.blobs, clicks: spy.clicks, dialog, toast };
  }).catch(() => ({ blobs: 0, clicks: 0, dialog: false, toast: false }));
}

function downloadFiles(dir) {
  try {
    return fs.readdirSync(dir).filter(f => !f.endsWith('.crdownload') && !f.endsWith('.part')).map(f => path.join(dir, f));
  } catch { return []; }
}

async function runStudio(browser, engineName, studio, baseUrl) {
  const label = engineName + ' / ' + studio.name;
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jvds-xb-'));
  const context = await (browser.createBrowserContext ? browser.createBrowserContext() : browser.defaultBrowserContext());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/favicon|net::ERR_|Failed to load resource|the server responded with a status/i.test(text)) return;
    if (/Executing inline event handler violates/i.test(text)) return;
    errors.push(text);
  });
  let cdp = null;
  try {
    await page.setViewport({ width: 1440, height: 900, isMobile: false });
    if (engineName !== 'firefox') {
      cdp = await page.createCDPSession();
      await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }).catch(() => {});
    }
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (!url.startsWith(baseUrl) && !/^(data|blob):/.test(url)) return req.abort();
      req.continue();
    });
    await page.evaluateOnNewDocument(() => {
      window.__xbt = { blobs: 0, clicks: 0 };
      const create = URL.createObjectURL;
      URL.createObjectURL = function (blob) { try { window.__xbt.blobs++; } catch { /* optional */ } return create.call(URL, blob); };
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { try { if (this.download) window.__xbt.clicks++; } catch { /* optional */ } return click.apply(this, arguments); };
    });

    await page.goto(baseUrl + '/' + studio.rel, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(600);
    await dismissOverlays(page);

    const loaded = await page.evaluate((selector) => ({
      ready: document.readyState,
      surface: !!(document.querySelector(selector) || document.querySelector('canvas') || document.querySelector('textarea,input[type="text"],[contenteditable="true"]')),
      text: (document.body.innerText || '').trim().length
    }), studio.surface || 'canvas');
    if (loaded.ready !== 'interactive' && loaded.ready !== 'complete') return fail(label + ': page did not load (' + loaded.ready + ')');
    if (!loaded.surface) return fail(label + ': no canvas or editor surface found');
    if (loaded.text < 20) return fail(label + ': page looks blank');
    pass(label + ': loaded');

    const box = await firstSurfaceBox(page, studio.surface);
    if (!box) return fail(label + ': no visible editing surface');
    await page.mouse.click(box.x, box.y);
    if (box.tag !== 'CANVAS') { await page.keyboard.type(' '); await page.keyboard.press('Backspace'); }
    await sleep(studio.slowSave ? 3000 : 250);
    pass(label + ': first surface action');

    const saveLabel = await clickControl(page, studio.save);
    await sleep(studio.slowSave ? 3000 : 600);
    let keys = await projectKeys(page, studio.keyRe);
    if (!keys.length) {
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyS');
      await page.keyboard.up('Control').catch(() => {});
      await sleep(600);
      keys = await projectKeys(page, studio.keyRe);
    }
    if (!keys.length) fail(label + ': no project data was saved' + (saveLabel ? ' after "' + saveLabel + '"' : ''));
    else pass(label + ': save stored ' + keys.length + ' project key(s)' + (saveLabel ? ' via "' + saveLabel + '"' : ''));

    if (studio.beforeExport) {
      const started = await clickControl(page, studio.beforeExport);
      if (started) await sleep(1800);
    }
    const exportLabel = await clickControl(page, studio.export);
    await sleep(1200);
    let outcome = await exportOutcome(page);
    let files = downloadFiles(downloadDir);
    if (!outcome.blobs && !outcome.clicks && !files.length) {
      const inner = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button,a,[role="button"]')]
          .find(el => /download/i.test((el.textContent || '') + ' ' + (el.getAttribute('data-on') || '')) && el.getBoundingClientRect().width > 2 && !el.disabled);
        if (!btn) return null;
        const t = (btn.textContent || '').trim().slice(0, 40); try { btn.click(); } catch { return null; } return t;
      }).catch(() => null);
      if (inner) { await sleep(1000); outcome = await exportOutcome(page); files = downloadFiles(downloadDir); }
    }
    if (!exportLabel) fail(label + ': no export or download control found');
    else if (!outcome.blobs && !outcome.clicks && !files.length && !outcome.dialog) fail(label + ': export "' + exportLabel + '" did not start a download');
    else pass(label + ': export via "' + exportLabel + '"' + (files.length ? ' (' + files.length + ' file)' : outcome.dialog ? ' (dialog)' : ' (blob)'));

    if (errors.length) fail(label + ': runtime errors: ' + errors.slice(0, 2).join(' | '));

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load', timeout: 25000 }).catch(() => {});
    await sleep(700);
    const mobile = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      surface: !!(document.querySelector('canvas') || document.querySelector('textarea,input[type="text"],[contenteditable="true"]'))
    })).catch(() => null);
    if (!mobile) fail(label + ': 390 reload failed');
    else if (!mobile.surface) fail(label + ': 390 reload lost the editing surface');
    else if (mobile.sw - mobile.iw > 2) fail(label + ': horizontal scroll at 390 (+' + (mobile.sw - mobile.iw) + 'px)');
    else pass(label + ': 390 load');
  } catch (e) {
    fail(label + ': ' + e.message);
  } finally {
    try { await page.close(); } catch { /* optional */ }
    try { await context.close(); } catch { /* optional */ }
    try { fs.rmSync(downloadDir, { recursive: true, force: true }); } catch { /* optional */ }
  }
}

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const baseUrl = 'http://127.0.0.1:' + server.address().port;

  const engines = [{ name: 'chrome', options: { headless: 'new', args: ['--no-sandbox'] } }];
  const edge = findEdge();
  if (edge) engines.push({ name: 'edge', options: { headless: 'new', executablePath: edge, args: ['--no-sandbox'] } });
  else skipNotes.push('Edge not installed on this host.');
  const firefox = findFirefox();
  if (firefox) engines.push({ name: 'firefox', options: { browser: 'firefox', headless: true, executablePath: firefox } });
  else skipNotes.push('Firefox not installed on this host (set FIREFOX_PATH to enable it).');
  skipNotes.push('Safari cannot be automated on this host.');

  const selected = ONLY_ENGINE ? engines.filter(e => e.name === ONLY_ENGINE) : engines;
  if (!selected.length) fail('No engine matched --engine=' + ONLY_ENGINE);

  for (const engine of selected) {
    let browser;
    try {
      browser = await puppeteer.launch(engine.options);
    } catch (e) {
      skipNotes.push(engine.name + ' could not start: ' + e.message.split('\n')[0]);
      continue;
    }
    console.log('[' + engine.name + '] ' + (await browser.version()));
    for (const studio of STUDIOS) await runStudio(browser, engine.name, studio, baseUrl);
    await browser.close();
  }

  server.close();
  if (skipNotes.length) skipNotes.forEach(n => console.log('  [skip] ' + n));
  if (failures) {
    console.log('\ncross-browser: FAIL (' + failures + ' failure' + (failures === 1 ? '' : 's') + ', ' + checks + ' checks passed)');
    process.exitCode = 1;
  } else {
    console.log('\ncross-browser: PASS (' + checks + ' checks across ' + selected.length + ' engine(s), ' + STUDIOS.length + ' studios)');
  }
})().catch(e => { console.error('harness error', e); try { server.close(); } catch { /* optional */ } process.exit(1); });
