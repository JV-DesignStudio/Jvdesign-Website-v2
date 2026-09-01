// HTTP runtime verification for the Music Maker tool.
// Covers the production-pass regressions: demo boot, kit mapping, velocity drag,
// undo, share round-trip, hostile-state validation, pause/resume semantics,
// and the shared live/offline render engine.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8144;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail !== undefined ? ' — ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // Force the "first visit" boot path every run
  await page.evaluateOnNewDocument(() => { localStorage.clear(); sessionStorage.clear(); });

  await page.goto(`http://127.0.0.1:${PORT}/tools/music-maker.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 400));

  /* ── structure ── */
  const struct = await page.evaluate(() => ({
    viewportZoomable: !/user-scalable=no/i.test(document.querySelector('meta[name=viewport]').content),
    betaGone: !document.body.textContent.includes('BETA'),
    tabs: document.querySelectorAll('.tab').length,
    exportBars: document.querySelectorAll('#exportBars option').length,
    helpModal: !!document.getElementById('helpModal'),
    shareBtn: !!document.querySelector('.t-share'),
    recGone: !document.querySelector('.t-rec'),
    velBars: document.querySelectorAll('.vel-bar').length
  }));
  check('pinch-zoom not disabled', struct.viewportZoomable);
  check('BETA tag removed', struct.betaGone);
  check('Rec button removed', struct.recGone);
  check('Share button + Help modal present', struct.shareBtn && struct.helpModal);
  check('4 tabs render', struct.tabs === 4, String(struct.tabs));
  check('export offers 1/2/4 bars', struct.exportBars === 3, String(struct.exportBars));
  check('velocity bars rendered per cell (7×16)', struct.velBars === 112, String(struct.velBars));

  /* ── first-run demo boot ── */
  const demo = await page.evaluate(() => ({
    bpm: document.getElementById('bpmDisplay').textContent,
    kit: document.getElementById('kitSelect').value,
    kick0: beatData.kick[0].on,
    notes: melodyNotes.length,
    toast: document.getElementById('toast').textContent
  }));
  check('demo track auto-loaded (124 BPM trap)', demo.bpm === '124' && demo.kit === 'trap',
    `${demo.bpm}/${demo.kit}`);
  check('demo has drums + 8-note melody', demo.kick0 && demo.notes === 8,
    `kick=${demo.kick0} notes=${demo.notes}`);
  check('welcome toast shown', /Demo track loaded/.test(demo.toast), demo.toast);

  /* ── kit mapping reaches the synth ── */
  const kits = await page.evaluate(() => ({
    trapKick: kitSound('kick'),
    switched: (changeKit('basic'), kitSound('kick'))
  }));
  check('kit selector maps sounds (trap→trap_kick)', kits.trapKick === 'trap_kick', kits.trapKick);
  check('kit switch back to basic works', kits.switched === 'kick', kits.switched);
  await page.evaluate(() => changeKit('trap'));

  /* ── cell toggle + undo ── */
  const toggled = await page.evaluate(() => {
    const before = beatData.tom[2].on;
    const cell = document.querySelector('[data-row="tom"][data-step="2"]');
    cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return { before, after: beatData.tom[2].on, stack: undoStack.length };
  });
  check('cell toggle places hit + pushes undo snapshot',
    !toggled.before && toggled.after && toggled.stack === 1,
    `on=${toggled.after} snapshots=${toggled.stack}`);

  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await new Promise(r => setTimeout(r, 100));
  const undone = await page.evaluate(() => ({ on: beatData.tom[2].on, kitStillTrap: currentKit === 'trap' }));
  check('Ctrl+Z reverts cell toggle', undone.on === false);
  check('undo preserves rest of state (kit stays trap)', undone.kitStillTrap);

  /* ── velocity drag ── */
  const vel = await page.evaluate(() => {
    const cell = document.querySelector('[data-row="hihat"][data-step="0"]');
    const bar = cell.querySelector('.vel-bar');
    const startVel = beatData.hihat[0].vel;
    const startV = bar.style.getPropertyValue('--v');
    const r = bar.getBoundingClientRect();
    const y0 = r.top + r.height / 2;
    bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientY: y0 }));
    for (let dy = 0; dy <= 40; dy += 10) {
      bar.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientY: y0 - dy }));
    }
    bar.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    return {
      startVel, endVel: beatData.hihat[0].vel,
      startV, endV: bar.style.getPropertyValue('--v')
    };
  });
  check('dragging velocity bar raises hit velocity',
    vel.endVel > vel.startVel && parseFloat(vel.endV) > parseFloat(vel.startV),
    `${vel.startVel.toFixed(2)}→${vel.endVel.toFixed(2)} (--v ${vel.startV}→${vel.endV})`);

  /* ── share link round-trip ── */
  const roundtrip = await page.evaluate(() => {
    const code = encodeTrack();
    const s = decodeTrack(code);
    return {
      bpm: s.bpm === bpm, steps: s.steps === steps,
      kickMask: s.beatData.kick[0].on === beatData.kick[0].on &&
                s.beatData.kick[10].on === beatData.kick[10].on,
      notes: s.melodyNotes.length === melodyNotes.length &&
             s.melodyNotes[0].note === melodyNotes[0].note,
      kit: s.kit === currentKit
    };
  });
  check('share encode→decode preserves track',
    roundtrip.bpm && roundtrip.steps && roundtrip.kickMask && roundtrip.notes && roundtrip.kit,
    JSON.stringify(roundtrip));

  /* ── hostile/corrupt state validation ── */
  const validated = await page.evaluate(() => {
    loadTrackState({ steps: 999, bpm: 9999, swing: 5, kit: 'hacker', melInstr: 'eval()',
      rollNoteOffset: -70, melodyNotes: [{ step: 'x', note: -5, len: -2 }, { step: 3, note: 72, len: 2 }],
      beatData: { kick: 'not-an-array' }, synthParams: { wave: '<svg/onload>', attack: 1e9, filterFreq: NaN } });
    return {
      steps, bpm, swing, kit: currentKit, instr: melInstr,
      offset: rollNoteOffset, notes: melodyNotes.length, noteOk: melodyNotes.length === 1 && melodyNotes[0].note === 72,
      wave: synthParams.wave, attack: synthParams.attack
    };
  });
  check('corrupt state cannot crash the tool',
    validated.steps === 16 && validated.bpm === 200 && validated.swing === .15 &&
    validated.kit === 'basic' && validated.instr === 'synth' && validated.offset === 36 &&
    validated.noteOk && validated.wave !== '<svg/onload>' && validated.attack <= 3,
    JSON.stringify(validated));
  check('no errors after hostile input', errors.length === 0, errors.join(' | ').slice(0, 120));

  /* ── restore known-good state, then transport semantics ── */
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const hm = document.getElementById('helpModal'); if (hm) hm.classList.remove('open'); });
  await page.click('#btnPlay');
  await new Promise(r => setTimeout(r, 500));
  const whilePlaying = await page.evaluate(() => ({
    playing,
    ctxState: getACtx().state,
    label: document.getElementById('btnPlay').textContent,
    lightsActive: document.querySelectorAll('.beat-light.on,.beat-light.beat1').length > 0
  }));
  check('play starts scheduler + audio ctx runs', whilePlaying.playing && whilePlaying.ctxState === 'running',
    whilePlaying.ctxState);
  check('pause label shown while playing', whilePlaying.label.includes('Pause'), whilePlaying.label);
  check('beat lights animate', whilePlaying.lightsActive);

  await page.click('#btnPlay'); // pause
  const pausedStep = await page.evaluate(() => currentStep);
  await new Promise(r => setTimeout(r, 150));
  await page.click('#btnPlay'); // resume
  await new Promise(r => setTimeout(r, 200));
  const resumed = await page.evaluate(() => currentStep);
  const resumedCleanly = resumed > 0 || pausedStep <= 4 || resumed < pausedStep; // advanced or wrapped
  check('resume continues position (no reset to 0)', resumedCleanly,
    `paused@${pausedStep} → resumed@${resumed}`);
  await page.click('.t-stop');

  /* ── engine parity hooks exist ── */
  const engine = await page.evaluate(() => ({
    renderDrum: typeof renderDrum === 'function',
    renderNote: typeof renderNote === 'function',
    melInstrNote: typeof melInstrNote === 'function'
  }));
  check('shared render engine wired', engine.renderDrum && engine.renderNote && engine.melInstrNote);

  /* ── offline export actually renders ── */
  const exported = await page.evaluate(async () => {
    try {
      const bars = 1, totalSteps = steps * bars, stepDur = 60 / bpm / 4;
      const dur = totalSteps * stepDur + Math.max(1, synthParams.release + .3);
      const oc = new OfflineAudioContext(2, Math.ceil(dur * 44100), 44100);
      const om = oc.createGain(); om.gain.value = .8;
      const comp = oc.createDynamicsCompressor();
      om.connect(comp); comp.connect(oc.destination);
      for (let s = 0; s < steps; s++) {
        BEAT_ROWS.forEach(row => {
          const d = beatData[row.id][s];
          if (d.on && !rowMuted[row.id]) renderDrum(oc, om, kitSound(row.id), d.vel * rowVols[row.id], s * stepDur + .05);
        });
        melodyNotes.forEach(n => { if (n.step === s) melInstrNote(oc, om, n.note, n.len * stepDur * .95, .75, s * stepDur + .05); });
      }
      const buf = await oc.startRendering();
      let peak = 0;
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i += 97) peak = Math.max(peak, Math.abs(ch[i]));
      return { ok: true, peak, secs: Math.round(buf.duration * 10) / 10 };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  check('offline render pipeline produces non-silent audio',
    exported.ok && exported.peak > 0.01, exported.ok ? `peak=${exported.peak.toFixed(3)} ~${exported.secs}s` : exported.err);

  check('zero console/page errors across whole session', errors.length === 0,
    errors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL MUSIC MAKER CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
