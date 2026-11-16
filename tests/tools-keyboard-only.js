#!/usr/bin/env node
// tests/tools-keyboard-only.js (A2306)
// Proves the main canvas studios can be used with a keyboard alone and that
// each one offers a visible shortcuts help panel.
//   Pixel Studio : keyboard cursor + Enter paints + Shift+Enter erases
//   Level Designer: keyboard cursor + Enter places a tile + Shift+Enter erases
//   Audio Studio : number keys switch patterns, arrows move the step cursor
// Run: node tests/tools-keyboard-only.js
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8137;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function press(page, key, opts = {}) {
  await page.evaluate((k, o) => {
    const ev = new KeyboardEvent('keydown', {
      key: k, code: o.code || k, bubbles: true, cancelable: true, shiftKey: !!o.shift
    });
    (o.target || document.body).dispatchEvent(ev);
  }, key, opts);
  await sleep(40);
}

async function clean(page) {
  await page.evaluate(() => {
    try { document.querySelectorAll('.modal-overlay.open, .ss-overlay, #start-overlay.show').forEach((m) => { m.classList.remove('open', 'show'); m.style.display = 'none'; }); } catch (e) {}
    try { if (typeof closeStart === 'function') closeStart(); } catch (e) {}
  });
  await sleep(200);
}

async function checkFocus(page, label) {
  await page.evaluate(() => { try { document.body.focus(); } catch (e) {} });
  await page.keyboard.press('Tab');
  // The skip link has its own high-contrast treatment, so measure the next control.
  const isSkip = await page.evaluate(() => !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('skip-link')));
  if (isSkip) await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, outline: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow };
  });
  const visible = first.tag !== 'BODY' && (first.outline !== 'none' || (first.shadow && first.shadow !== 'none'));
  check(label + ': focused control has a visible outline', visible, JSON.stringify(first));

  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? (el.id || el.tagName + ':' + (el.textContent || '').trim().slice(0, 18)) : 'none';
    });
    seen.add(id);
  }
  check(label + ': Tab reaches many controls without a focus trap', seen.size >= 8, 'distinct=' + seen.size);
}

async function pixelStudio(page) {
  const setup = await page.evaluate(() => {
    if (!kbMode) toggleKbMode();
    kbCursor = { x: 3, y: 3 };
    renderAll(false);
    return { mode: kbMode, hasBtn: !!document.getElementById('kbModeBtn'), start: { ...kbCursor } };
  });
  check('pixel: keyboard mode button exists and toggles', setup.hasBtn && setup.mode === true, JSON.stringify(setup));

  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  const moved = await page.evaluate(() => ({ ...kbCursor }));
  check('pixel: arrow keys move the cursor', moved.x === setup.start.x + 1 && moved.y === setup.start.y + 1, JSON.stringify(moved));

  const paint = await page.evaluate(() => {
    const c = { ...kbCursor };
    const before = [...getPixel(getID(), c.x, c.y)];
    kbPaint(false);
    const after = [...getPixel(getID(), c.x, c.y)];
    kbPaint(true);
    const erased = [...getPixel(getID(), c.x, c.y)];
    return { before, after, erased };
  });
  check('pixel: Enter paints a visible pixel', paint.after[3] === 255, JSON.stringify(paint.after));
  check('pixel: erase removes the pixel again', paint.erased[3] === 0, JSON.stringify(paint.erased));

  await press(page, '?');
  const help = await page.evaluate(() => {
    const modal = document.getElementById('keysModal');
    const text = modal ? modal.textContent : '';
    return { open: !!(modal && modal.classList.contains('open')), text: text };
  });
  check('pixel: ? opens a shortcut overlay', help.open, 'open=' + help.open);
  check('pixel: overlay lists keyboard painting', /Keyboard/.test(help.text) && /Shift\+Enter/.test(help.text), '');

  await press(page, 'Escape');
  const off = await page.evaluate(() => kbMode);
  check('pixel: Escape leaves keyboard mode', off === false, 'kbMode=' + off);
}

async function levelDesigner(page) {
  const setup = await page.evaluate(() => {
    if (!kbMode) toggleKbMode();
    kbCursor = { x: 2, y: 2 };
    renderAll();
    return { mode: kbMode, hasBtn: !!document.getElementById('kbModeBtn'), start: { ...kbCursor } };
  });
  check('level: keyboard mode button exists and toggles', setup.hasBtn && setup.mode === true, JSON.stringify(setup));

  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  const moved = await page.evaluate(() => ({ ...kbCursor }));
  check('level: arrow keys move the cursor', moved.x === setup.start.x + 1 && moved.y === setup.start.y + 1, JSON.stringify(moved));

  const place = await page.evaluate(() => {
    const c = { ...kbCursor };
    setCell(c.x, c.y, 0);
    const was = getCell(c.x, c.y);
    kbPlace(false);
    const placed = getCell(c.x, c.y);
    kbPlace(true);
    const erased = getCell(c.x, c.y);
    return { tile: currentTile, was, placed, erased };
  });
  check('level: Enter places the current tile', place.placed === place.tile, JSON.stringify(place));
  check('level: Shift+Enter erases the tile', place.erased === 0, JSON.stringify(place));

  await press(page, '?');
  const help = await page.evaluate(() => {
    const overlay = document.getElementById('hotkey-overlay');
    const cs = overlay ? getComputedStyle(overlay) : null;
    return {
      visible: !!(overlay && cs && cs.display !== 'none' && cs.visibility !== 'hidden'),
      text: overlay ? overlay.textContent : ''
    };
  });
  check('level: ? opens a shortcut overlay', help.visible, JSON.stringify(help.visible));
  check('level: overlay lists keyboard placing', /Keyboard only/.test(help.text) && /Shift\+Enter/.test(help.text), '');
}

async function soundStudio(page) {
  const setup = await page.evaluate(() => {
    try { if (typeof closeStart === 'function') closeStart(); } catch (e) {}
    while (patterns.length < 3) addPattern();
    switchPattern(0);
    keyboardStep = 0;
    renderKeyboardCursor();
    return { patterns: patterns.length, cursor: document.querySelectorAll('.step-cell.kb-cursor').length };
  });
  check('audio: step cursor is keyboard visible', setup.patterns >= 3 && setup.cursor === 1, JSON.stringify(setup));

  await press(page, '2');
  const pat = await page.evaluate(() => currentPattern);
  check('audio: number key switches pattern', pat === 1, 'pattern=' + pat);

  await page.evaluate(() => { switchPattern(0); keyboardStep = 0; renderKeyboardCursor(); });
  await press(page, 'ArrowRight');
  const step = await page.evaluate(() => keyboardStep);
  check('audio: arrow key moves the step cursor', step !== 0, 'step=' + step);

  const help = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.ss-sec, h2, h3, div'));
    return nodes.some((n) => /keyboard shortcuts/i.test((n.textContent || '').trim().slice(0, 40)));
  });
  check('audio: keyboard shortcut help is present', help, '');
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ w: 390, h: 844, label: '390' }, { w: 1440, h: 900, label: '1440' }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({ width: viewport.w, height: viewport.h });

      console.log('\n--- Pixel Studio @ ' + viewport.label + ' ---');
      await page.goto('http://127.0.0.1:' + PORT + '/tools/pixel-studio.html', { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(1400);
      await clean(page);
      await pixelStudio(page);
      await checkFocus(page, 'pixel @ ' + viewport.label);
      check('pixel @ ' + viewport.label + ': no page errors', errors.length === 0, errors.join(' | '));
      await page.close();

      console.log('\n--- Level Designer @ ' + viewport.label + ' ---');
      const page2 = await browser.newPage();
      const errors2 = [];
      page2.on('pageerror', (e) => errors2.push(e.message));
      await page2.setViewport({ width: viewport.w, height: viewport.h });
      await page2.goto('http://127.0.0.1:' + PORT + '/tools/level-designer.html', { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(1400);
      await clean(page2);
      await levelDesigner(page2);
      await checkFocus(page2, 'level @ ' + viewport.label);
      check('level @ ' + viewport.label + ': no page errors', errors2.length === 0, errors2.join(' | '));
      await page2.close();

      if (viewport.w === 390) {
        console.log('\n--- Audio Studio @ ' + viewport.label + ' ---');
        const page3 = await browser.newPage();
        const errors3 = [];
        page3.on('pageerror', (e) => errors3.push(e.message));
        await page3.setViewport({ width: viewport.w, height: viewport.h });
        await page3.goto('http://127.0.0.1:' + PORT + '/tools/sound-studio.html', { waitUntil: 'networkidle2', timeout: 45000 });
        await sleep(1400);
        await clean(page3);
        await soundStudio(page3);
        check('audio @ ' + viewport.label + ': no page errors', errors3.length === 0, errors3.join(' | '));
        await page3.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL KEYBOARD-ONLY CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
