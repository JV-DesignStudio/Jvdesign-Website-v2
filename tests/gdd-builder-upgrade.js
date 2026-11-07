// Runtime verification for the GDD Builder upgrade: pitch lab, mechanic cards,
// starter templates, mood board, cross-tool import, IndexedDB, LZ share links,
// poster print and the mobile drawer.
// Run: node tests/gdd-builder-upgrade.js
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.GDD_UPGRADE_PORT || 8151;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  const noisy = t => /ERR_NETWORK|net::ERR|Failed to load resource|googletagmanager|google-analytics|placehold\.co|phaser|favicon/i.test(t);
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() !== 'error' || noisy(m.text())) return; errors.push('console: ' + m.text()); });
  page.on('dialog', async d => { await d.dismiss().catch(() => {}); });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:' + PORT + '/tools/gdd-builder.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof applyTemplate === 'function' && typeof packShare === 'function', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 700));

  // ── UI pieces ────────────────────────────────────────────────────────────
  const ui = await page.evaluate(() => ({
    templates: document.querySelectorAll('.template-btn').length,
    pitch: !!document.getElementById('pitchLab'),
    mechDeck: document.querySelectorAll('#mechDeck .mech-card').length,
    drawer: !!document.getElementById('mechanicsDrawer'),
    canvas: !!document.getElementById('doodleCanvas'),
    vibes: document.querySelectorAll('#vibeGallery .vibe-btn').length,
    qr: !!document.getElementById('gddQrModal'),
    importBtns: document.querySelectorAll('.tool-import-btn').length,
    functions: ['applyTemplate','buildPitch','toggleMechanic','toggleMechanics','importFromPixelStudio','importFromBuildLab','showGddQr','exportPoster','lzwEncode','lzwDecode'].every(n => typeof window[n] === 'function'),
  }));
  check('three starter templates present', ui.templates === 3, 'got ' + ui.templates);
  check('pitch-o-matic present', ui.pitch);
  check('twelve mechanic cards present', ui.mechDeck === 12, 'got ' + ui.mechDeck);
  check('mechanics drawer present', ui.drawer);
  check('doodle canvas present', ui.canvas);
  check('six studio vibes present', ui.vibes === 6, 'got ' + ui.vibes);
  check('QR modal present', ui.qr);
  check('two cross-tool import buttons', ui.importBtns === 2, 'got ' + ui.importBtns);
  check('upgrade API exposed', ui.functions);

  // ── Starter template ────────────────────────────────────────────────────
  const tpl = await page.evaluate(() => {
    applyTemplate('platformer');
    return {
      title: document.getElementById('gameTitle').value,
      genre: document.getElementById('gameGenre').value,
      mech: getData({images:false}).mechanics,
      chars: getData({images:false}).characters.length,
    };
  });
  check('template fills the title', tpl.title === 'Sky Hopper', tpl.title);
  check('template fills the genre', tpl.genre === 'Platformer', tpl.genre);
  check('template adds mechanic cards', Array.isArray(tpl.mech) && tpl.mech.includes('double-jump'));
  check('template adds characters', tpl.chars === 2, 'got ' + tpl.chars);

  // ── Pitch-o-matic ───────────────────────────────────────────────────────
  const pitch = await page.evaluate(() => {
    document.getElementById('pitchHero').value = 'space frog';
    document.getElementById('pitchGoal').value = 'save the moon';
    document.getElementById('pitchThreat').value = 'tidal wave';
    buildPitch();
    return document.getElementById('gamePitch').value;
  });
  check('pitch builder writes the sentence', /^My game is a Platformer where you play as a space frog who must save the moon before the tidal wave gets them!/.test(pitch), pitch);

  // ── Mechanic cards + drawer ─────────────────────────────────────────────
  const mech = await page.evaluate(() => {
    toggleMechanic('timer');
    toggleMechanics();
    const open = document.getElementById('mechanicsDrawer').classList.contains('open');
    const picked = document.querySelectorAll('#mechPicked .mech-chip').length;
    return { has: getData({images:false}).mechanics.includes('timer'), open, picked };
  });
  check('tapping a mechanic adds it', mech.has);
  check('drawer opens', mech.open);
  check('picked list renders chips', mech.picked > 0, 'got ' + mech.picked);
  await page.evaluate(() => toggleMechanics());

  // ── LZ share links ──────────────────────────────────────────────────────
  const share = await page.evaluate(() => {
    const sample = { d: { gameTitle: 'Sky Hopper 🦘', extraNotes: 'The quick brown fox. '.repeat(40) } };
    const code = packShare(sample);
    const back = unpackShare(code);
    const url = buildShareUrl();
    return { roundtrip: JSON.stringify(sample) === JSON.stringify(back), codeLen: code.length, hasHash: url.indexOf('#gdd=') > 0 };
  });
  check('LZ share round-trips unicode', share.roundtrip);
  check('LZ share is shorter than plain JSON', share.codeLen < 1814, 'code=' + share.codeLen);
  check('share URL uses the #gdd hash', share.hasHash);

  // ── Autosave indicator + IndexedDB ──────────────────────────────────────
  const autosave = await page.evaluate(async () => {
    const notes = document.getElementById('extraNotes');
    notes.value = 'Autosave probe ' + Date.now();
    notes.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1900));
    let local = null;
    try { local = JSON.parse(localStorage.getItem('jvds_gdd_auto') || 'null'); } catch (e) {}
    const idb = await gddIdbGet('docs', 'auto');
    return {
      localOk: !!local && !!local.d && String(local.d.extraNotes).indexOf('Autosave probe') === 0,
      idbOk: !!idb && !!idb.d && String(idb.d.extraNotes).indexOf('Autosave probe') === 0,
      pill: (document.querySelector('#gddSaveState .save-txt') || {}).textContent,
    };
  });
  check('autosave writes localStorage', autosave.localOk);
  check('autosave mirrors into IndexedDB', autosave.idbOk);
  check('autosave shows a saved indicator', /Saved/.test(autosave.pill || ''), autosave.pill);

  const idbDoodle = await page.evaluate(async () => {
    const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await drawDoodle(tiny);
    const back = await gddIdbGet('assets', 'doodle');
    return back === tiny;
  });
  check('doodle picture is stored in IndexedDB', idbDoodle);

  // ── Cross-tool import ───────────────────────────────────────────────────
  const pixel = await page.evaluate(() => {
    localStorage.setItem('jvds_pixel_palette', JSON.stringify(['#112233', '#445566', '#778899', '#aabbcc', '#ddeeff']));
    localStorage.setItem('jvds_sprite_player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    importFromPixelStudio();
    const swatches = [...document.querySelectorAll('#artPaletteRow input[type=color]')].map(i => i.value.toLowerCase());
    return { first: swatches[0], count: swatches.length };
  });
  check('Pixel Studio palette imports', pixel.first === '#112233', pixel.first);
  check('imported palette keeps five colours', pixel.count === 5, 'got ' + pixel.count);

  const buildlab = await page.evaluate(() => {
    localStorage.setItem('buildlab_autosave', JSON.stringify({
      name: 'Rocket Base',
      blocks: [{ c: 'ff0000' }, { c: '00ff00' }, { c: 'ff0000' }],
      savedAt: new Date().toISOString(),
    }));
    localStorage.setItem('buildlab_env', 'forest');
    document.getElementById('artNotes').value = '';
    document.getElementById('setting').value = '';
    importFromBuildLab();
    return {
      notes: document.getElementById('artNotes').value,
      setting: document.getElementById('setting').value,
      palette: [...document.querySelectorAll('#artPaletteRow input[type=color]')].map(i => i.value.toLowerCase()),
    };
  });
  check('BuildLab build imports into art notes', /BuildLab import: Rocket Base with 3 blocks/.test(buildlab.notes), buildlab.notes);
  check('BuildLab environment seeds the setting', /forest/.test(buildlab.setting), buildlab.setting);
  check('BuildLab block colours import', buildlab.palette.includes('#ff0000') && buildlab.palette.includes('#00ff00'));

  // ── Studio guide + QR ───────────────────────────────────────────────────
  const guide = await page.evaluate(() => {
    toggleSection('gameplay');
    const box = document.getElementById('gddGuide');
    return {
      shown: box.classList.contains('show'),
      copy: (document.getElementById('gddGuideText') || {}).textContent || '',
      name: (document.getElementById('gddGuideName') || {}).textContent || '',
    };
  });
  check('section click shows a studio guide', guide.shown && /Ember|Echo|Stardust|Pip|Lumo/.test(guide.name), guide.name);
  check('gameplay guide asks about the weakness', /weakness/i.test(guide.copy), guide.copy.slice(0, 60));

  const qr = await page.evaluate(async () => {
    showGddQr();
    await new Promise(r => setTimeout(r, 300));
    return {
      open: document.getElementById('gddQrModal').classList.contains('open'),
      url: document.getElementById('gddQrUrl').value,
      note: document.getElementById('gddQrNote').textContent,
    };
  });
  check('QR modal opens', qr.open);
  check('QR modal fills the share URL', /#gdd=/.test(qr.url));
  check('QR modal explains when a plan is too big', /QR code|code|link/i.test(qr.note), qr.note.slice(0, 60));
  await page.evaluate(() => closeGddQr());

  const qrPage = await browser.newPage();
  await qrPage.goto('http://127.0.0.1:' + PORT + '/tools/gdd-builder.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await qrPage.waitForFunction(() => typeof showGddQr === 'function' && typeof qrcode === 'function', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 300));
  const qrImage = await qrPage.evaluate(async () => {
    showGddQr();
    await new Promise(r => setTimeout(r, 300));
    const img = document.getElementById('gddQrImg');
    return { src: img.getAttribute('src') || '', open: document.getElementById('gddQrModal').classList.contains('open') };
  });
  check('QR image renders for a normal plan', /^data:image\//.test(qrImage.src), qrImage.src.slice(0, 20));
  check('QR modal opens on a fresh plan', qrImage.open);
  await qrPage.close();

  // ── Poster print mode ───────────────────────────────────────────────────
  const poster = await page.evaluate(() => {
    window.print = function () {};
    exportPoster();
    const on = document.body.classList.contains('gdd-poster');
    window.dispatchEvent(new Event('afterprint'));
    return { on, off: !document.body.classList.contains('gdd-poster') };
  });
  check('Pitch Poster adds the poster class', poster.on);
  check('Pitch Poster cleans up after printing', poster.off);

  // ── Shared link opens a copy ────────────────────────────────────────────
  const url = await page.evaluate(() => {
    document.getElementById('gameTitle').value = 'Shared Star Quest';
    document.getElementById('gameTitle').dispatchEvent(new Event('input', { bubbles: true }));
    return buildShareUrl();
  });
  const shared = await browser.newPage();
  await shared.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await shared.waitForFunction(() => typeof getData === 'function', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));
  const sharedTitle = await shared.evaluate(() => document.getElementById('gameTitle').value);
  check('share link opens the plan on a new page', sharedTitle === 'Shared Star Quest', sharedTitle);
  await shared.close();

  // ── Mobile / Chromebook drawer + overflow ───────────────────────────────
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 200));
  const mobile = await page.evaluate(() => {
    const noScroll = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
    toggleMechanics();
    const drawerOpen = document.getElementById('mechanicsDrawer').classList.contains('open');
    const scrim = document.getElementById('mechScrim').classList.contains('open');
    toggleMechanics();
    return { noScroll, drawerOpen, scrim, closed: !document.getElementById('mechanicsDrawer').classList.contains('open') };
  });
  check('390px: no horizontal scroll', mobile.noScroll);
  check('390px: mechanics drawer slides out', mobile.drawerOpen && mobile.scrim);
  check('390px: mechanics drawer closes', mobile.closed);

  if (errors.length) {
    console.log('ERRORS (' + errors.length + '):');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  }

  await browser.close();
  server.close();
  if (failures || errors.length) {
    console.log('\n' + (failures + errors.length) + ' FAILURE(S)');
    process.exit(1);
  }
  console.log('\nALL GDD UPGRADE CHECKS PASSED');
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
