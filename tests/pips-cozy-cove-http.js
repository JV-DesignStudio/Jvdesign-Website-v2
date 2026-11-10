#!/usr/bin/env node
/* Pip's Cozy Cove: cast, reel fight, conditions, tackle, visitor, daily goals,
   catch card and the phone layout.

   Run: node tests/pips-cozy-cove-http.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.COZY_COVE_PORT || 19319);
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.avif': 'image/avif', '.jpg': 'image/jpeg'
};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

const pagePath = path.join(ROOT, 'games', 'pips-cozy-cove.html');
const html = fs.readFileSync(pagePath, 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', 'games-pips-cozy-cove.js'), 'utf8');
const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

check('page exists with a title', /<title>[^<]+<\/title>/i.test(html));
check('page has a viewport that allows zoom', /<meta[^>]+name=["']viewport["']/i.test(html) && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html));
check('page has a live status region', /aria-live|role=["']status["']/i.test(html));
check('page labels the play field', /aria-label=["'][^"']*play field/i.test(html));
check('page has a pause control', /id="pauseBtn"/.test(html) && /pause/i.test(script));
check('page has a bait choice', /id="baitWorm"/.test(html) && /id="baitCorn"/.test(html) && /id="baitLure"/.test(html));
check('page has a gentle mode toggle', /id="gentleBtn"/.test(html) && /save\.gentle|toggleGentle/.test(script));
check('page has a fish log', /id="bucketList"/.test(html) && /Fish log/i.test(html));
check('page has a tension meter', /id="tensionMeter"/.test(html) && /tension/i.test(script));
check('script supports a reel hold', /holdingReel/.test(script) && /Hold to reel/i.test(script));
check('page has cast hot spots', /id="hotspots"/.test(html) && /spawnHotspots/.test(script));
check('page shows the hooked fish', /id="catchFish"/.test(html) && /catchFish/.test(script));
check('page can show a fish fact', /id="resultNote"/.test(html) && /fact:/.test(script));
check('page has tackle unlocks', /id="tackleStrip"/.test(html) && /var TACKLE/.test(script));
check('page has daily goals', /id="dailyGoals"/.test(html) && /GOAL_TEMPLATES/.test(script));
check('page shows cove areas', /id="areas"/.test(html) && /var AREAS/.test(script));
check('page shows weather and time', /id="conditionLabel"/.test(html) && /WEATHERS/.test(script) && /TIMES/.test(script));
check('page has the rare visitor', /VISITOR/.test(script) && /visitorPending/.test(script));
check('page can save a catch card', /id="cardBtn"/.test(html) && /buildCatchCard/.test(script));
check('page has ambient life', /id="birds"/.test(html) && /id="fireflies"/.test(html) && /dock-cat/.test(html));
check('page has cove tool links', /id="guideBtn"/.test(html) && /id="albumBtn"/.test(html) && /id="decorBtn"/.test(html) && /id="settingsBtn"/.test(html));
check('page has a decorator', /id="decorator"/.test(html) && /id="decorPalette"/.test(html) && /DECOR_SLOTS/.test(script));
check('page has a character request', /id="requestCard"/.test(html) && /REQUEST_TEMPLATES/.test(script));
check('page has a cove panel', /id="panel"/.test(html) && /id="panelBody"/.test(html));
check('page shows shells', /id="shellHud"/.test(html) && /shellReward/.test(script));
check('page has accessibility settings', /High contrast/.test(script) && /Larger text/.test(script) && /applyAccessibility/.test(script));
check('page can export and import saves', /exportSaveJson/.test(script) && /importSaveJson/.test(script) && /pips-cozy-cove-save\.json/.test(script));
check('page has condition-locked fish', /needs: \{ weather/.test(script) && /needs: \{ time/.test(script));
check('page registers the service worker', /sw-register\.js/.test(html));
check('service worker precaches the game', /\/games\/pips-cozy-cove\.html/.test(sw) && /games-pips-cozy-cove\.js/.test(sw) && /style-game-pips-cozy-cove\.css/.test(sw));
check('page has a tide system', /id="tideLabel"/.test(html) && /id="tideCover"/.test(html) && /function tideFactor/.test(script));
check('page has a photo mode', /id="photoBar"/.test(html) && /buildPostcard/.test(script) && /downloadPostcard/.test(script));
check('page has a bait bench', /id="craftedBaits"/.test(html) && /CRAFT_RECIPES/.test(script) && /craftBait/.test(script));
check('page has an aquarium', /id="tankBtnPanel"/.test(html) && /tankHtml/.test(script) && /feedTank/.test(script));
check('page has a trophy shelf', /id="shelfBtn"/.test(html) && /shelfHtml/.test(script));
check('page has a soundscape mixer', /ensureAudio/.test(script) && /data-mix/.test(script) && /setLayerVolume/.test(script));
check('page can share a catch link', /id="shareBtn"/.test(html) && /buildShareUrl/.test(script) && /handleSharedLink/.test(script));
check("page has Stardust's story", /id="storyStar"/.test(html) && /STORY_STEPS/.test(script) && /updateStory/.test(script));
check('page loads the game stylesheet', /style-game-pips-cozy-cove\.css/.test(html));
check('page uses the local Pip art', /assets\/mascots\/pip-hero\.webp/.test(html));
check('registry lists the game', /"id":\s*"pips-cozy-cove"/.test(registry) && /"file":\s*"pips-cozy-cove\.html"/.test(registry));
check('registry gives it a thumbnail', /"thumb":\s*"assets\/game-thumbs\/pips-cozy-cove\.webp"/.test(registry));
check('registry labels it BETA', /"pips-cozy-cove":\s*"BETA"/.test(registry));
check('thumbnail exists', fs.existsSync(path.join(ROOT, 'assets', 'game-thumbs', 'pips-cozy-cove.webp')));

const IGNORE_CONSOLE = /ERR_|Failed to load resource|favicon|googletagmanager|google-analytics|AudioContext|autoplay|navigator\.vibrate|fullscreen/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buttonPoint(page, selector) {
  return page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
}

async function runAt(browser, width, height, isMobile) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORE_CONSOLE.test(text)) return;
    errors.push('console: ' + text);
  });

  await page.setViewport({ width, height, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
  await page.goto(`http://127.0.0.1:${PORT}/games/pips-cozy-cove.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => localStorage.removeItem('jvds_game_pips-cozy-cove'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#actionBtn', { timeout: 15000 });
  await sleep(250);

  const tag = width + 'px';
  const state = () => page.evaluate(() => window.__cozyCove.state());

  check(tag + ': debug hook is present', await page.evaluate(() => !!window.__cozyCove));

  const idleSpots = (await state()).hotspots;
  check(tag + ': the cove shows cast hot spots', Array.isArray(idleSpots) && idleSpots.length >= 1 && idleSpots.length <= 3, JSON.stringify(idleSpots));

  const idleOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(tag + ': no horizontal scroll', idleOverflow <= 2, String(idleOverflow));

  const conditions = await page.evaluate(() => ({
    state: window.__cozyCove.state().conditions,
    time: document.getElementById('cove').getAttribute('data-time'),
    weather: document.getElementById('cove').getAttribute('data-weather'),
    label: document.getElementById('conditionLabel').textContent
  }));
  check(tag + ': time of day is set', /^(dawn|day|dusk|night)$/.test(conditions.time), conditions.time);
  check(tag + ': weather is set', /^(clear|misty|breezy|rainy)$/.test(conditions.weather), conditions.weather);
  check(tag + ': the condition is labelled', conditions.label.length > 0 && conditions.state.label === conditions.label, conditions.label);

  const ambient = await page.evaluate(() => ({
    birds: !!document.getElementById('birds'),
    fireflies: !!document.getElementById('fireflies'),
    cat: !!document.getElementById('dockCat')
  }));
  check(tag + ': ambient life is in the scene', ambient.birds && ambient.fireflies && ambient.cat);

  await page.evaluate(() => window.__cozyCove.setTide(0.1));
  const lowTide = await page.evaluate(() => ({
    phase: window.__cozyCove.state().tidePhase,
    attr: document.getElementById('cove').getAttribute('data-tide'),
    shrimp: window.__cozyCove.tideFactor('shrimp'),
    octopus: window.__cozyCove.tideFactor('octopus')
  }));
  check(tag + ': low tide is tracked', lowTide.phase === 'low' && lowTide.attr === 'low', lowTide.phase);
  check(tag + ': low tide favours the rockpool', lowTide.shrimp > 1 && lowTide.octopus < 1, lowTide.shrimp + ' / ' + lowTide.octopus);
  await page.evaluate(() => window.__cozyCove.setTide(0.9));
  const highTide = await page.evaluate(() => ({
    phase: window.__cozyCove.state().tidePhase,
    attr: document.getElementById('cove').getAttribute('data-tide'),
    octopus: window.__cozyCove.tideFactor('octopus')
  }));
  check(tag + ': high tide favours deep water', highTide.phase === 'high' && highTide.attr === 'high' && highTide.octopus > 1, highTide.phase + ' / ' + highTide.octopus);
  await page.evaluate(() => window.__cozyCove.setTide(0.5));

  const tackle = await page.evaluate(() => ({
    none: window.__cozyCove.tackleAt(0),
    twelve: window.__cozyCove.tackleAt(12),
    areas0: window.__cozyCove.areasAt(0),
    areas6: window.__cozyCove.areasAt(6)
  }));
  check(tag + ': no tackle unlocks at the start', Object.keys(tackle.none).every((k) => tackle.none[k] === false));
  check(tag + ': tackle unlocks by catch count', tackle.twelve.steady === true && tackle.twelve.longline === true && tackle.twelve.kindhook === false);
  check(tag + ': cove areas unlock with the log', tackle.areas0.indexOf('cove') !== -1 && tackle.areas0.indexOf('rockpool') === -1 && tackle.areas6.indexOf('pier') !== -1);

  const daily = (await state()).daily;
  check(tag + ': three daily goals are picked', daily && Array.isArray(daily.goals) && daily.goals.length === 3, daily ? String(daily.goals.length) : 'none');
  check(tag + ': daily goals have a date', !!daily && /^\d{4}-\d{2}-\d{2}$/.test(daily.date), daily ? daily.date : '');

  const request = (await state()).request;
  check(tag + ': a character request is waiting', !!request && Number.isInteger(request.index) && request.done === false, request ? String(request.index) : 'none');

  const conditionFish = await page.evaluate(() => ({
    ids: window.__cozyCove.availableFish(),
    rainfin: window.__cozyCove.fishNeeds('rainfin'),
    dawnkoi: window.__cozyCove.fishNeeds('dawnkoi')
  }));
  check(tag + ': condition fish are filtered by the weather and time', Array.isArray(conditionFish.ids) && conditionFish.ids.length > 0 && !!conditionFish.rainfin.weather && !!conditionFish.dawnkoi.time);

  await page.click('#guideBtn');
  const guide = await page.evaluate(() => ({
    open: !document.getElementById('panel').hidden,
    title: document.getElementById('panelTitle').textContent,
    entries: document.querySelectorAll('#panelBody .guide-entry').length
  }));
  check(tag + ': the field guide opens', guide.open && /field guide/i.test(guide.title), guide.title);
  check(tag + ': the guide lists every fish', guide.entries >= 15, String(guide.entries));
  await page.click('#panelClose');

  await page.click('#settingsBtn');
  await page.click('[data-toggle="contrast"]');
  const contrast = await page.evaluate(() => ({
    attr: document.getElementById('cove').getAttribute('data-theme'),
    theme: window.__cozyCove.state().theme
  }));
  check(tag + ': high contrast can be turned on', contrast.attr === 'contrast' && contrast.theme === 'contrast', contrast.attr);
  await page.click('[data-toggle="contrast"]');
  await page.click('[data-toggle="large"]');
  const large = await page.evaluate(() => ({
    cls: document.getElementById('cove').classList.contains('text-large'),
    on: window.__cozyCove.state().largeText
  }));
  check(tag + ': larger text can be turned on', large.cls === true && large.on === true);
  await page.click('[data-toggle="large"]');
  await page.click('#panelClose');

  await page.click('#gentleBtn');
  check(tag + ': gentle mode can be turned on', (await state()).gentle === true);
  await page.click('#gentleBtn');
  check(tag + ': gentle mode can be turned off', (await state()).gentle === false);

  await page.click('#baitLure');
  check(tag + ': the lure can be chosen', (await state()).bait === 'lure');
  await page.click('#baitWorm');
  check(tag + ': the worm can be chosen', (await state()).bait === 'worm');

  const startBtn = await buttonPoint(page, '#actionBtn');
  await page.mouse.move(startBtn.x, startBtn.y);
  await page.mouse.down();
  await sleep(650);
  const charging = (await state()).phase;
  await page.mouse.up();
  const castState = await state();
  check(tag + ': holding builds cast power', charging === 'charging', charging);
  check(tag + ': letting go casts the line', castState.phase === 'waiting', castState.phase);
  check(tag + ': cast distance reaches deeper water', castState.zone >= 1, String(castState.zone));

  await page.evaluate(() => window.__cozyCove.forceBite());
  const biting = await page.evaluate(() => ({
    phase: window.__cozyCove.state().phase,
    label: document.getElementById('actionBtn').textContent
  }));
  check(tag + ': a bite opens the hook window', biting.phase === 'biting', biting.phase);
  check(tag + ': the button says Set hook', /hook/i.test(biting.label), biting.label);

  await page.click('#actionBtn');
  const fighting = await page.evaluate(() => ({
    phase: window.__cozyCove.state().phase,
    meter: !document.getElementById('tensionMeter').hidden
  }));
  check(tag + ': setting the hook starts the fight', fighting.phase === 'fighting', fighting.phase);
  check(tag + ': the tension meter shows in the fight', fighting.meter === true);

  const hookedFish = await page.evaluate(() => {
    const el = document.getElementById('catchFish');
    return { shown: !el.hidden, icon: el.textContent };
  });
  check(tag + ': the hooked fish is visible in the water', hookedFish.shown && hookedFish.icon.length > 0, hookedFish.icon);

  const reelBtn = await buttonPoint(page, '#actionBtn');
  const beforeReel = (await state()).progress;
  await page.mouse.move(reelBtn.x, reelBtn.y);
  await page.mouse.down();
  await sleep(320);
  const duringReel = (await state()).progress;
  await page.mouse.up();
  check(tag + ': holding the reel winds the line in', duringReel > beforeReel, beforeReel + ' -> ' + duringReel);

  await page.evaluate(() => {
    window.__cozyCove.reel(false);
    window.__cozyCove.setTension(90);
    window.__cozyCove.step(0.05);
  });
  const bands = await state();
  check(tag + ': line tension is tracked for screen readers', bands.tensionBand >= 2, String(bands.tensionBand));

  await page.evaluate(() => {
    window.__cozyCove.reel(true);
    window.__cozyCove.setProgress(99);
    window.__cozyCove.setTension(6);
    window.__cozyCove.step(0.2);
  });
  const afterCatch = await page.evaluate(() => ({
    state: window.__cozyCove.state(),
    bucketItems: document.querySelectorAll('#bucketList .bucket-item').length,
    unknowns: document.querySelectorAll('#bucketList .bucket-item.is-unknown').length,
    result: !document.getElementById('resultCard').hidden,
    resultTitle: document.getElementById('resultTitle').textContent,
    resultNote: document.getElementById('resultNote').hidden ? '' : document.getElementById('resultNote').textContent
  }));
  check(tag + ': landing the fish scores points', afterCatch.state.score > 0, String(afterCatch.state.score));
  check(tag + ': the fish log shows the catch', afterCatch.bucketItems > 0, String(afterCatch.bucketItems));
  check(tag + ': unfound fish stay as mystery slots', afterCatch.unknowns > 0, String(afterCatch.unknowns));
  check(tag + ': a new species is discovered', afterCatch.state.discovered >= 1, String(afterCatch.state.discovered));
  check(tag + ': the result card names the fish', afterCatch.result && afterCatch.resultTitle.length > 0, afterCatch.resultTitle);
  check(tag + ': a new fish shares a Pip fact', /Pip says/i.test(afterCatch.resultNote), afterCatch.resultNote);
  check(tag + ': the phase returns to idle', afterCatch.state.phase === 'idle', afterCatch.state.phase);
  check(tag + ': the catch is added to the album', Array.isArray(afterCatch.state.album) && afterCatch.state.album.length >= 1, String((afterCatch.state.album || []).length));
  check(tag + ': catching earns shells', afterCatch.state.shells > 0, String(afterCatch.state.shells));

  const card = await page.evaluate(() => window.__cozyCove.cardDataUrl().then((url) => url.slice(0, 22)));
  check(tag + ': the catch card renders as a PNG', /^data:image\/png;base64,/.test(card), card);

  await page.click('#albumBtn');
  const albumPanel = await page.evaluate(() => ({
    open: !document.getElementById('panel').hidden,
    cards: document.querySelectorAll('#panelBody .album-card').length
  }));
  check(tag + ': the album shows the catch', albumPanel.open && albumPanel.cards >= 1, String(albumPanel.cards));
  await page.click('#panelClose');

  const spots = (await state()).hotspots;
  await page.evaluate((power) => window.__cozyCove.cast(power), spots[0]);
  const hotCast = await page.evaluate(() => ({
    phase: window.__cozyCove.state().phase,
    hit: window.__cozyCove.state().hotspotHit,
    status: document.getElementById('statusText').textContent
  }));
  check(tag + ': casting onto a ripple lands a hot spot', hotCast.phase === 'waiting' && hotCast.hit === true, hotCast.phase + ' / ' + hotCast.hit);
  check(tag + ': the hot spot is called out', /ripple|hot spot/i.test(hotCast.status), hotCast.status);
  await page.evaluate(() => window.__cozyCove.clearVisitor());
  await page.evaluate(() => window.__cozyCove.forceBite());
  await page.click('#actionBtn');
  await page.evaluate(() => {
    window.__cozyCove.reel(true);
    window.__cozyCove.setProgress(110);
    window.__cozyCove.setTension(10);
    window.__cozyCove.step(0.2);
  });
  const storyTwo = await state();
  check(tag + ': Stardust finds the lantern on a ripple', storyTwo.story.step >= 2, String(storyTwo.story.step));

  await page.click('#gentleBtn');
  await page.evaluate(() => window.__cozyCove.cast(60));
  await page.evaluate(() => window.__cozyCove.forceBite());
  await page.click('#actionBtn');
  await page.click('#actionBtn');
  const gentleReel = (await state()).reeling;
  check(tag + ': gentle mode taps the reel on', gentleReel === true, String(gentleReel));
  await page.evaluate(() => {
    window.__cozyCove.setTension(100);
    window.__cozyCove.setProgress(20);
  });
  await page.evaluate(() => window.__cozyCove.step(0.2));
  const gentleTension = await state();
  check(tag + ': gentle mode does not snap the line', gentleTension.phase === 'fighting', gentleTension.phase);
  await page.click('#actionBtn');
  check(tag + ': gentle mode taps the reel off', (await state()).reeling === false);
  await page.evaluate(() => {
    window.__cozyCove.reel(true);
    window.__cozyCove.setProgress(110);
    window.__cozyCove.setTension(10);
  });
  await page.evaluate(() => window.__cozyCove.step(0.2));
  check(tag + ': gentle mode can still land a fish', (await state()).phase === 'idle', (await state()).phase);
  await page.click('#gentleBtn');
  check(tag + ': gentle mode turns back off', (await state()).gentle === false);

  await page.evaluate(() => window.__cozyCove.cast(90));
  await page.evaluate(() => window.__cozyCove.forceVisitor());
  await page.evaluate(() => window.__cozyCove.forceBite());
  await page.click('#actionBtn');
  const visitorStart = await state();
  check(tag + ': the visitor can take the line', visitorStart.visitor === true && visitorStart.stage === 1, String(visitorStart.stage));
  await page.evaluate(() => {
    window.__cozyCove.reel(true);
    window.__cozyCove.setProgress(110);
  });
  await page.evaluate(() => window.__cozyCove.step(0.05));
  const visitorStage = await state();
  check(tag + ': the visitor has a second stage', visitorStage.phase === 'fighting' && visitorStage.stage === 2, visitorStage.phase + ' / stage ' + visitorStage.stage);
  await page.evaluate(() => {
    window.__cozyCove.reel(true);
    window.__cozyCove.setProgress(110);
    window.__cozyCove.setTension(10);
  });
  await page.evaluate(() => window.__cozyCove.step(0.05));
  const visitorDone = await state();
  check(tag + ': the visitor is logged', visitorDone.visitorCaught === true && visitorDone.phase === 'idle', String(visitorDone.visitorCaught));
  check(tag + ": Stardust's story completes", visitorDone.storyDone === true && visitorDone.story.step === 3, String(visitorDone.story.step));
  check(tag + ': Stardust lights a star in the cove', await page.evaluate(() => !document.getElementById('storyStar').hidden));
  await page.click('#storyBtn');
  const storyPanel = await page.evaluate(() => ({
    open: !document.getElementById('panel').hidden,
    title: document.getElementById('panelTitle').textContent,
    entries: document.querySelectorAll('#panelBody .guide-entry').length
  }));
  check(tag + ': the story panel shows all three treasures', storyPanel.open && /Stardust/i.test(storyPanel.title) && storyPanel.entries === 3, String(storyPanel.entries));
  await page.click('#panelClose');

  await page.evaluate(() => window.__cozyCove.cast(60));
  await page.evaluate(() => window.__cozyCove.forceBite());
  await page.click('#actionBtn');
  await page.evaluate(() => {
    window.__cozyCove.reel(true);
    window.__cozyCove.setTension(100);
  });
  await page.evaluate(() => window.__cozyCove.step(0.2));
  const snapped = await page.evaluate(() => ({
    phase: window.__cozyCove.state().phase,
    status: document.getElementById('statusText').textContent
  }));
  check(tag + ': maxed tension snaps the line', snapped.phase === 'idle' && /snap/i.test(snapped.status), snapped.status);

  await page.evaluate(() => window.__cozyCove.cast(40));
  await page.click('#pauseBtn');
  const paused = await page.evaluate(() => ({
    paused: window.__cozyCove.state().paused,
    status: document.getElementById('statusText').textContent
  }));
  check(tag + ': pause stops the game', paused.paused === true, String(paused.paused));
  check(tag + ': pause tells the player', /paused/i.test(paused.status), paused.status);
  await page.click('#pauseBtn');

  await page.click('#craftBtn');
  const craftPanel = await page.evaluate(() => ({
    open: !document.getElementById('panel').hidden,
    cards: document.querySelectorAll('#panelBody .craft-card').length
  }));
  check(tag + ': the bait bench lists recipes', craftPanel.open && craftPanel.cards === 3, String(craftPanel.cards));
  await page.click('#panelClose');
  const craftedOk = await page.evaluate(() => window.__cozyCove.craftBait('crumb'));
  const afterCraft = await state();
  check(tag + ': a crafted bait can be made', craftedOk === true && afterCraft.crafted.crumb >= 5, String(afterCraft.crafted.crumb));
  await page.evaluate(() => window.__cozyCove.selectBait('crumb'));
  check(tag + ': crafted bait can be selected', (await state()).bait === 'crumb');
  await page.evaluate(() => window.__cozyCove.cast(55));
  const afterUse = await state();
  check(tag + ': casting uses a crafted bait charge', afterUse.crafted.crumb === afterCraft.crafted.crumb - 1, String(afterUse.crafted.crumb));
  await page.evaluate(() => window.__cozyCove.snap());
  await page.evaluate(() => window.__cozyCove.selectBait('worm'));

  const tankAdded = await page.evaluate(() => window.__cozyCove.addTank(0));
  const afterTank = await state();
  check(tag + ': a catch can move to the aquarium', tankAdded === true && afterTank.tank.length === 1, String(afterTank.tank.length));
  await page.click('#tankBtnPanel');
  const tankPanel = await page.evaluate(() => ({
    open: !document.getElementById('panel').hidden,
    fish: document.querySelectorAll('#panelBody .tank-fish').length,
    rows: document.querySelectorAll('#panelBody .tank-row').length
  }));
  check(tag + ': the aquarium shows the kept fish', tankPanel.open && tankPanel.fish >= 1 && tankPanel.rows >= 1, String(tankPanel.fish));
  await page.click('[data-feed="0"]');
  const afterFeed = await state();
  check(tag + ': a tank fish can be fed and grow', afterFeed.tank[0].growth === 1, String(afterFeed.tank[0].growth));
  await page.click('#panelClose');

  await page.click('#shelfBtn');
  const shelf = await page.evaluate(() => ({
    open: !document.getElementById('panel').hidden,
    plaques: document.querySelectorAll('#panelBody .shelf-plaque').length
  }));
  check(tag + ': the trophy shelf lists big catches', shelf.open && shelf.plaques >= 1, String(shelf.plaques));
  await page.click('#panelClose');

  await page.click('#photoBtn');
  const photo = await page.evaluate(() => ({
    cls: document.getElementById('cove').classList.contains('is-photo'),
    bar: !document.getElementById('photoBar').hidden
  }));
  check(tag + ': photo mode hides the game chrome', photo.cls === true && photo.bar === true);
  const postcard = await page.evaluate(() => window.__cozyCove.postcardDataUrl().then((url) => url.slice(0, 22)));
  check(tag + ': the postcard renders as a PNG', /^data:image\/png;base64,/.test(postcard), postcard);
  await page.click('#photoExit');
  check(tag + ': photo mode can be closed', (await state()).photoMode === false);

  const share = await page.evaluate(() => ({ url: window.__cozyCove.shareUrl() }));
  check(tag + ': a catch share link is built', /#catch=/.test(share.url), share.url.slice(0, 60));
  await page.evaluate(() => {
    history.replaceState(null, '', '#catch=' + encodeURIComponent(JSON.stringify({ v: 1, fishId: 'carp', weight: 2.4, points: 20, date: '2026-11-10' })));
  });
  const sharedLoaded = await page.evaluate(() => window.__cozyCove.handleSharedLink());
  const sharedCard = await page.evaluate(() => ({
    hidden: document.getElementById('resultCard').hidden,
    title: document.getElementById('resultTitle').textContent
  }));
  check(tag + ': a shared catch opens the result card', sharedLoaded === true && sharedCard.hidden === false && /carp/i.test(sharedCard.title), sharedCard.title);
  await page.evaluate(() => history.replaceState(null, '', location.pathname));

  await page.click('#settingsBtn');
  await page.$eval('[data-mix="water"]', (el) => {
    el.value = '70';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check(tag + ': the soundscape mixer saves a volume', (await state()).audio.water === 70, String((await state()).audio.water));
  await page.click('#panelClose');

  await page.evaluate(() => window.__cozyCove.enterDecor());
  await page.evaluate(() => window.__cozyCove.chooseDecor('lily'));
  const decorChosen = await state();
  check(tag + ': a decor item can be bought and selected', decorChosen.ownedDecor.indexOf('lily') !== -1 && decorChosen.selectedDecor === 'lily', JSON.stringify(decorChosen.ownedDecor));
  await page.evaluate(() => window.__cozyCove.placeDecor('water-left'));
  const decorPlaced = await page.evaluate(() => ({
    state: window.__cozyCove.state(),
    placed: document.querySelectorAll('#decorLayer .decor-placed').length
  }));
  check(tag + ': decor is placed in the cove', decorPlaced.state.decor['water-left'] === 'lily' && decorPlaced.placed > 0, JSON.stringify(decorPlaced.state.decor));
  await page.evaluate(() => window.__cozyCove.exitDecor());
  check(tag + ': decorating can be closed', (await state()).decorating === false);

  const exported = await page.evaluate(() => window.__cozyCove.exportSave());
  let exportedObj = null;
  try { exportedObj = JSON.parse(exported); } catch (e) {}
  check(tag + ': progress exports as a save file', !!exportedObj && exportedObj.app === 'pips-cozy-cove' && !!exportedObj.data && !!exportedObj.data.log);
  const beforeImport = await state();
  const imported = await page.evaluate((text) => window.__cozyCove.importSave(text), exported);
  const afterImport = await state();
  check(tag + ': progress imports back', imported === true && afterImport.totalCaught === beforeImport.totalCaught, String(imported));
  check(tag + ': decor survives a save import', afterImport.decor['water-left'] === 'lily');

  const saved = await state();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#actionBtn', { timeout: 15000 });
  const restored = await state();
  check(tag + ': the fish log survives a reload', restored.totalCaught >= saved.totalCaught && restored.totalCaught > 0, String(restored.totalCaught));
  check(tag + ': the best score survives a reload', restored.highScore >= saved.score && restored.highScore > 0, String(restored.highScore));
  check(tag + ': the logged species survive a reload', Object.keys(restored.log).length >= 1, String(Object.keys(restored.log).length));
  check(tag + ': the visitor survives a reload', restored.visitorCaught === true, String(restored.visitorCaught));
  check(tag + ': the daily goals survive a reload', !!restored.daily && restored.daily.goals.length === 3, restored.daily ? String(restored.daily.goals.length) : 'none');
  check(tag + ': the album survives a reload', Array.isArray(restored.album) && restored.album.length >= 1, String((restored.album || []).length));
  check(tag + ': shells survive a reload', restored.shells > 0, String(restored.shells));
  check(tag + ': the decor survives a reload', restored.decor['water-left'] === 'lily', JSON.stringify(restored.decor));
  check(tag + ': the request survives a reload', !!restored.request && Number.isInteger(restored.request.index));
  check(tag + ': the tank survives a reload', Array.isArray(restored.tank) && restored.tank.length >= 1, String((restored.tank || []).length));
  check(tag + ": Stardust's story survives a reload", restored.storyDone === true, String(restored.storyDone));
  check(tag + ': crafted bait survives a reload', restored.crafted.crumb >= 1, String(restored.crafted.crumb));
  check(tag + ': the soundscape volumes survive a reload', restored.audio.water === 70, String(restored.audio.water));

  check(tag + ': no runtime errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await new Promise((resolve) => server.listen(PORT, resolve));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    await runAt(browser, 390, 844, true);
    await runAt(browser, 1440, 900, false);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL PIPS COZY COVE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
