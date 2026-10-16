#!/usr/bin/env node
/*
 * tests/gdd-idea-handoff.js
 * A1600: the GDD exports a machine-readable systems block the Arcade Game Maker
 * can prefill from, and the Idea Spinner exports every kept idea as one JSON file.
 * Run: node tests/gdd-idea-handoff.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.GIH_PORT || 9005;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

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

  // ── 1. GDD builds a systems block and sends it ─────────────────────────────
  const gdd = await browser.newPage();
  await gdd.setViewport({ width: 1440, height: 900 });
  await gdd.goto(BASE + 'tools/gdd-builder.html', { waitUntil: 'domcontentloaded' });
  await gdd.waitForFunction(() => typeof sendToGameMaker === 'function' && typeof buildSystems === 'function', { timeout: 20000 });
  const payload = await gdd.evaluate(() => {
    document.getElementById('gameTitle').value = 'Sky Hopper';
    document.getElementById('gameGenre').value = 'Platformer';
    const loop = document.getElementById('coreLoop'); if (loop) loop.value = 'Run, jump and collect stars';
    const sent = buildSystems();
    sendToGameMaker();
    return { sent, stored: JSON.parse(localStorage.getItem('jvds_gdd_last') || 'null') };
  });
  check('GDD builds a systems block', !!payload.sent && payload.sent.title === 'Sky Hopper' && payload.sent.genre === 'Platformer');
  check('GDD systems block is machine-readable', payload.sent && Array.isArray(payload.sent.mechanics) && typeof payload.sent.coreLoop === 'string');
  check('GDD sends the block to the Game Maker', !!payload.stored && !!payload.stored.systems && payload.stored.systems.title === 'Sky Hopper');

  // ── 2. Arcade Game Maker prefills from it ──────────────────────────────────
  const arc = await browser.newPage();
  const errs = [];
  arc.on('pageerror', e => errs.push(e.message));
  await arc.setViewport({ width: 1440, height: 900 });
  await arc.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await arc.waitForSelector('#runGameBtn', { timeout: 20000 });
  const applied = await arc.evaluate(() => {
    importGddFromBuilder();
    return {
      title: document.getElementById('gameTitle').value,
      genre: document.getElementById('genreMode').value,
      hasBtn: !!document.querySelector('[data-on="importGddFromBuilder"]')
    };
  });
  check('Game Maker has an Import GDD button', applied.hasBtn === true);
  check('Game Maker prefills the title', applied.title === 'Sky Hopper', 'title=' + applied.title);
  check('Game Maker maps the genre from the GDD', applied.genre === 'PLATFORMER', 'genre=' + applied.genre);
  check('Game Maker: no JS errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // ── 3. Idea Spinner exports all kept ideas ─────────────────────────────────
  const idea = await browser.newPage();
  await idea.setViewport({ width: 1440, height: 900 });
  await idea.goto(BASE + 'tools/game-idea-generator.html', { waitUntil: 'domcontentloaded' });
  await idea.waitForFunction(() => typeof exportAllIdeas === 'function', { timeout: 20000 });
  const ideaOut = await idea.evaluate(async () => {
    history.unshift({ title: 'Puzzle Fox', genre: 'Puzzle', theme: 'Forest', mechanic: 'Match', twist: 'Mirrors' });
    history.unshift({ title: 'Space Runner', genre: 'Arcade', theme: 'Space', mechanic: 'Dodge', twist: 'Gravity' });
    window.__blob = null;
    URL.createObjectURL = function(b){ window.__blob = b; return 'blob:t'; };
    HTMLAnchorElement.prototype.click = function(){};
    const hasBtn = !!document.getElementById('exportAllIdeas');
    exportAllIdeas();
    return { hasBtn, json: window.__blob ? await window.__blob.text() : '' };
  });
  let ideas = null; try { ideas = JSON.parse(ideaOut.json); } catch(e) {}
  check('Idea Spinner has an Export All button', ideaOut.hasBtn === true);
  check('Idea Spinner exports a collection JSON', !!ideas && ideas.app === 'jvds-idea-collection' && ideas.count === 2, ideas ? ('count=' + ideas.count) : 'parse-fail');
  check('Idea Spinner includes every kept idea', !!ideas && ideas.ideas.some(i => i.title === 'Space Runner') && ideas.ideas.some(i => i.title === 'Puzzle Fox'));

  // ── 4. 390px: the maker import button is present, no horizontal scroll ─────
  await arc.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await arc.evaluate(() => ({
    btn: !!document.querySelector('[data-on="importGddFromBuilder"]'),
    noScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  }));
  check('390px: Import GDD present', m.btn === true);
  check('390px: no horizontal scroll', m.noScroll === true);

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL GDD + IDEA HANDOFF CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
