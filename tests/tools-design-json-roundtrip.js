#!/usr/bin/env node
/*
 * tests/tools-design-json-roundtrip.js
 * A1599: Icon Generator, Game Logo Maker, Colour Palette and Screenshot Generator
 * must download a design JSON and reopen it exactly.
 * For each tool: export -> capture the JSON -> import it into a fresh page ->
 * assert the distinctive value came back.
 * Run: node tests/tools-design-json-roundtrip.js
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.DJR_PORT || 9003;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

const TOOLS = [
  { label:'Icon Generator', file:'tools/icon-generator.html', app:'jvds-icon-generator',
    exportFn:'exportDesignJSON', inputId:'designFile',
    setup:`state.symbol='rocket'; state.accent='#123456';`,
    afterImport:`state.symbol`, expect:'rocket' },
  { label:'Game Logo Maker', file:'tools/game-logo-maker.html', app:'jvds-game-logo',
    exportFn:'exportLogoJSON', inputId:'logoDesignFile',
    setup:`document.getElementById('titleText').value='TESTLOGO';`,
    afterImport:`getState().t`, expect:'TESTLOGO' },
  { label:'Colour Palette', file:'tools/colour-palette.html', app:'jvds-colour-palette',
    exportFn:'exportPaletteDesignJSON', inputId:'paletteDesignFile',
    setup:`currentMood=MOODS[0]; palette=[{hex:'#112233',locked:false},{hex:'#445566',locked:false}]; paletteSize=2; harmonyMode='none';`,
    afterImport:`(palette[0]&&palette[0].hex)`, expect:'#112233' },
  { label:'Screenshot Generator', file:'tools/screenshot-generator.html', app:'jvds-screenshot-generator',
    exportFn:'exportDesignJSON', inputId:'designFile',
    setup:`document.getElementById('title').value='SHOT TITLE';`,
    afterImport:`document.getElementById('title').value`, expect:'SHOT TITLE' },
];

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
    // 1. Export and capture the JSON blob.
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + t.file, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(fn => typeof window[fn] === 'function', { timeout: 20000 }, t.exportFn).catch(() => {});
    const json = await page.evaluate(async (t) => {
      window.__blob = null;
      URL.createObjectURL = function(b){ window.__blob = b; return 'blob:test'; };
      HTMLAnchorElement.prototype.click = function(){};
      try { eval(t.setup); } catch(e){ return 'SETUP-ERR:'+e.message; }
      try { window[t.exportFn](); } catch(e){ return 'EXPORT-ERR:'+e.message; }
      return window.__blob ? await window.__blob.text() : 'NO-BLOB';
    }, t);
    if (json.startsWith('SETUP-ERR') || json.startsWith('EXPORT-ERR') || json === 'NO-BLOB') {
      check(`${t.label}: exports a design JSON`, false, json.slice(0, 60));
      await page.close(); continue;
    }
    let parsed = null; try { parsed = JSON.parse(json); } catch(e) {}
    check(`${t.label}: exports a valid design JSON`, !!parsed && parsed.app === t.app && !!parsed.state, parsed ? ('app='+parsed.app) : 'parse-fail');

    // 2. Import that exact JSON into a fresh page.
    const tmp = path.join(os.tmpdir(), 'jvds-design-' + Date.now() + '.json');
    fs.writeFileSync(tmp, json);
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1440, height: 900 });
    await page2.goto(BASE + t.file, { waitUntil: 'domcontentloaded' });
    await page2.waitForSelector('#' + t.inputId, { timeout: 20000 }).catch(() => {});
    const input = await page2.$('#' + t.inputId);
    if (!input) { check(`${t.label}: import input exists`, false); await page.close(); await page2.close(); fs.unlinkSync(tmp); continue; }
    await input.uploadFile(tmp);
    await page2.evaluate(() => { const el = document.querySelector('input[type=file][accept*="json"]'); if (el) el.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 400));
    const got = await page2.evaluate(expr => { try { return eval(expr); } catch(e){ return 'ERR:'+e.message; } }, t.afterImport);
    check(`${t.label}: reimports the exact design`, String(got) === t.expect, 'got=' + got + ' want=' + t.expect);
    check(`${t.label}: no JS errors on export`, errs.length === 0, errs.slice(0, 2).join(' | '));

    fs.unlinkSync(tmp);
    await page.close();
    await page2.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL DESIGN JSON ROUND-TRIP CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
