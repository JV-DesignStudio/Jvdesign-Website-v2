#!/usr/bin/env node
/*
 * tests/tools-first-run-templates.js
 * A1546: the first-path tools must open with a template picker of three or more
 * starters, and loading one must show a working example. Covers Pixel Studio,
 * Audio Studio (sound-studio), World Builder (level-designer) and the Arcade
 * Game Maker. Run: node tests/tools-first-run-templates.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.TFR_PORT || 8993;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

const TOOLS = [
  { file:'tools/pixel-studio.html', label:'Pixel Studio',
    picker:'#startModal [data-on="applyTemplate"]',
    closed:'!document.getElementById("startModal").classList.contains("open")',
    works:'typeof frames!=="undefined" && frames.length>0' },
  { file:'tools/level-designer.html', label:'World Builder',
    picker:'#start-overlay [data-on="applyTemplate"]',
    closed:'!document.getElementById("start-overlay").classList.contains("show")',
    works:'typeof layers!=="undefined" && layers.some(l=>l.data && Array.from(l.data).some(v=>v))' },
  { file:'tools/sound-studio.html', label:'Audio Studio',
    picker:'#start-modal [data-on="_loadSoundTemplate"]',
    closed:'getComputedStyle(document.getElementById("start-modal")).display==="none"',
    works:'document.querySelectorAll(".step-cell.on").length>0' },
  { file:'tools/arcade-game-maker.html', label:'Arcade Game Maker',
    picker:'#welcome-overlay [data-on="_arcStartFrom"]',
    closed:'!document.getElementById("welcome-overlay").classList.contains("show")',
    works:'!!document.getElementById("genreMode").value' },
];

const VISIBLE = (sel) => {
  const els = [...document.querySelectorAll(sel)];
  return els.filter(e => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
};

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  for (const t of TOOLS) {
    // ── Desktop: picker shows, loading one makes a working scene ──────────────
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + t.file, { waitUntil: 'domcontentloaded' });
    let shown = true;
    await page.waitForSelector(t.picker, { visible: true, timeout: 15000 }).catch(() => { shown = false; });
    const n = shown ? await page.evaluate(VISIBLE, t.picker) : 0;
    check(`${t.label}: first-run picker with 3+ starters`, shown && n >= 3, 'visible starters=' + n);
    if (shown) {
      await page.$eval(t.picker, el => el.click());
      await new Promise(r => setTimeout(r, t.file.includes('arcade') ? 1600 : 600));
      const state = await page.evaluate((closed, works) => ({
        closed: eval(closed), works: eval(works)
      }), t.closed, t.works);
      check(`${t.label}: picker closes after picking`, state.closed === true);
      check(`${t.label}: picking loads a working example`, state.works === true);
    }
    check(`${t.label}: no uncaught JS errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();

    // ── Mobile 390: picker still shows, no horizontal scroll ──────────────────
    const m = await browser.newPage();
    await m.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await m.goto(BASE + t.file, { waitUntil: 'domcontentloaded' });
    const shownM = await m.waitForSelector(t.picker, { visible: true, timeout: 15000 }).then(() => true).catch(() => false);
    const nM = shownM ? await m.evaluate(VISIBLE, t.picker) : 0;
    const scroll = await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    check(`${t.label}: 390px shows the picker (3+)`, shownM && nM >= 3, 'visible starters=' + nM);
    check(`${t.label}: 390px no horizontal scroll`, scroll === true);
    await m.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL FIRST-RUN TEMPLATE CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
