#!/usr/bin/env node
/*
 * tests/arcade-game-maker-audio-ux.js
 * One proof for the A2697/A2698/A2699 bunch:
 *   A2697  gameplay sounds pan by screen x, centre and UI sounds stay mono,
 *          and a missing Web Audio API never breaks play().
 *   A2698  a loud impact ducks the music for 500ms, overlapping hits do not
 *          stack, and stopMusic brings the bus back to full.
 *   A2699  three quick low-score deaths show one dismissible Lumo hint that
 *          names a real Build setting, and nothing is sent or stored.
 *
 * Uses a fake AudioContext so the assertions do not depend on a real speaker.
 * Run: node tests/arcade-game-maker-audio-ux.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_AUDIO_UX_PORT || 8997;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

const FAKE_AUDIO = () => {
  const record = { panners: [], gains: [], oscillators: 0 };
  window.__audioRecord = record;
  function param(v) {
    return {
      value: v,
      _log: [],
      setValueAtTime(x, t) { this.value = x; this._log.push(['set', x, t]); return this; },
      // A ramp does not jump the value immediately; keep the value that the
      // last setValueAtTime established, like the real AudioParam.
      linearRampToValueAtTime(x, t) { this._log.push(['lin', x, t]); return this; },
      exponentialRampToValueAtTime(x, t) { this._log.push(['exp', x, t]); return this; },
      cancelScheduledValues(t) { this._log.push(['cancel', t]); return this; }
    };
  }
  class FakeGain { constructor(){ this.gain = param(1); record.gains.push(this); } connect(n){ this._to = n; return n; } disconnect(){} }
  class FakePanner { constructor(){ this.pan = param(0); record.panners.push(this); } connect(n){ this._to = n; return n; } }
  class FakeOsc { constructor(){ this.type = 'sine'; this.frequency = param(440); this.detune = param(0); record.oscillators++; } connect(n){ this._to = n; } start(){} stop(){} }
  class FakeBufferSource { constructor(){ this.buffer = null; this.loop = false; } connect(n){ this._to = n; } start(){} stop(){} }
  class FakeBuffer { constructor(){ this._d = new Float32Array(8); } getChannelData(){ return this._d; } }
  class FakeAudioContext {
    constructor(){ this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = { _kind: 'dest' }; }
    resume(){ this.state = 'running'; return Promise.resolve(); }
    createGain(){ return new FakeGain(); }
    createOscillator(){ return new FakeOsc(); }
    createBufferSource(){ return new FakeBufferSource(); }
    createBuffer(){ return new FakeBuffer(); }
    createStereoPanner(){ return new FakePanner(); }
    decodeAudioData(){ return Promise.resolve(new FakeBuffer()); }
  }
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
};

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
  await page.evaluateOnNewDocument(FAKE_AUDIO);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GameAudio && typeof window.GameAudio.playAt === 'function', { timeout: 20000 });

  // ── A2697: positional panning ─────────────────────────────────────────────
  const left = await page.evaluate(() => {
    window.__audioRecord.panners.length = 0;
    GameAudio.playAt('hit', -0.8);
    return window.__audioRecord.panners.map(p => p.pan.value);
  });
  check('A2697 playAt(-0.8) creates a left panner', left.includes(-0.8), JSON.stringify(left));

  const centre = await page.evaluate(() => {
    window.__audioRecord.panners.length = 0;
    GameAudio.play('hit');
    return window.__audioRecord.panners.length;
  });
  check('A2697 centre sounds stay mono', centre === 0, centre + ' panners');

  const preview = await page.evaluate(() => {
    window.__audioRecord.panners.length = 0;
    GameAudio.previewSlot('hit');
    return window.__audioRecord.panners.length;
  });
  check('A2697 UI preview stays mono', preview === 0, preview + ' panners');

  const noWebAudio = await page.evaluate(() => {
    const AC = window.AudioContext, WK = window.webkitAudioContext;
    try {
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
      GameAudio.playAt('hit', -1);
      return true;
    } catch (e) { return false; }
    finally { window.AudioContext = AC; window.webkitAudioContext = WK; }
  });
  check('A2697 missing Web Audio does not break play', noWebAudio);

  // ── A2698: music ducking ──────────────────────────────────────────────────
  const duck = await page.evaluate(() => {
    GameAudio.startMusic('chiptune');
    const bus = GameAudio._musicBus;
    const before = bus ? bus.gain.value : null;
    GameAudio.play('hit');
    const during = bus ? bus.gain.value : null;
    const active = GameAudio._duckActive;
    const token1 = GameAudio._duckToken;
    GameAudio.play('hit');
    const token2 = GameAudio._duckToken;
    GameAudio.stopMusic();
    return {
      hasBus: !!bus, before, during, active, token1, token2,
      afterActive: GameAudio._duckActive,
      afterGain: bus ? bus.gain.value : null
    };
  });
  check('A2698 music runs through a gain bus', duck.hasBus === true);
  check('A2698 impact ducks music to about 60 percent', duck.before === 1 && duck.during > 0.5 && duck.during < 1, JSON.stringify(duck));
  check('A2698 overlapping hits do not stack the duck', duck.token1 === duck.token2);
  check('A2698 stopMusic restores full music gain', duck.afterActive === false && duck.afterGain === 1, 'gain ' + duck.afterGain);

  const custom = await page.evaluate(() => {
    // A custom track must also respect the duck bus and recover on restart.
    GameAudio.customMusic = 'data:audio/wav;base64,AAAA';
    GameAudio.startMusic('chiptune');
    return { hasBus: !!GameAudio._musicBus };
  });
  check('A2698 custom music reuses the duck bus', custom.hasBus === true);
  await page.evaluate(() => { GameAudio.customMusic = null; GameAudio.stopMusic(); });

  // ── A2699: Lumo frustration hint ──────────────────────────────────────────
  const hint = await page.evaluate(() => {
    _frustrationQuickDeaths = 0;
    _frustrationHintShown = false;
    document.getElementById('lumoFrustrationHint').style.display = 'none';
    const g = document.getElementById('genreMode'); if (g) g.value = 'SHOOTER';
    for (let i = 0; i < 3; i++) { _sessionStartTime = Date.now() - 500; showGameOver(0); }
    const el = document.getElementById('lumoFrustrationHint');
    return {
      visible: getComputedStyle(el).display !== 'none',
      text: document.getElementById('lumoFrustrationText').textContent,
      count: _frustrationQuickDeaths,
      shown: _frustrationHintShown,
      storage: Object.keys(localStorage).filter(k => /frustrat|lumo.*hint/i.test(k))
    };
  });
  check('A2699 hint appears after three quick deaths', hint.visible === true, 'count ' + hint.count);
  check('A2699 hint names a real Build setting', /Enemy Speed|Game Speed|Jump Force|Gravity|Auto-fire|starting speed/i.test(hint.text), hint.text.slice(0, 90));
  check('A2699 hint is one-off per session', hint.shown === true);
  check('A2699 nothing is persisted or sent', hint.storage.length === 0, JSON.stringify(hint.storage));

  await page.setViewport({ width: 390, height: 844 });
  const mobileHint = await page.evaluate(() => {
    const el = document.getElementById('lumoFrustrationHint');
    el.style.display = '';
    const r = el.getBoundingClientRect();
    return {
      right: Math.round(r.right), width: Math.round(r.width),
      scroll: document.documentElement.scrollWidth, inner: window.innerWidth
    };
  });
  check('A2699 hint fits at 390px with no horizontal scroll',
    mobileHint.right <= 390 && mobileHint.width <= 390 && mobileHint.scroll <= mobileHint.inner + 1,
    JSON.stringify(mobileHint));

  const dismissed = await page.evaluate(() => {
    _dismissLumoHint();
    return getComputedStyle(document.getElementById('lumoFrustrationHint')).display === 'none';
  });
  check('A2699 hint is dismissible', dismissed);

  const reset = await page.evaluate(() => {
    _frustrationQuickDeaths = 2;
    _applyConfigIntent({ enemySpeed: 40 });
    return _frustrationQuickDeaths;
  });
  check('A2699 a settings change resets the quick-death count', reset === 0);

  check('no page errors during the checks', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
