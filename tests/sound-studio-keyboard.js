#!/usr/bin/env node
// tests/sound-studio-keyboard.js (A2109)
// Checks the keyboard-first workflow: 1-4 switch patterns, arrow keys move the
// step cursor, letter keys enter notes, Ctrl+H opens the undo history panel, and
// typing inside an input never triggers a shortcut. Run:
// node tests/sound-studio-keyboard.js
const { open, sleep } = require('./lib/sound-studio-harness');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const ctx = await open();
  const { page, errors } = ctx;
  try {
    const setup = await page.evaluate(async () => {
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      if (isPlaying) stopAll();
      while (patterns.length < 3) addPattern();
      switchPattern(0);
      const ti = activeTrack;
      for (let s = 0; s < steps; s++) grid[ti][s] = { on: false, note: 'C', len: 1, vel: 1, oct: tracks[ti].oct };
      buildGrid();
      keyboardStep = 0;
      renderKeyboardCursor();
      return { patterns: patterns.length, cursor: document.querySelectorAll('.step-cell.kb-cursor').length };
    });
    check('three patterns ready and a visible step cursor', setup.patterns >= 3 && setup.cursor === 1, JSON.stringify(setup));

    const press = (key) => page.evaluate((k) => {
      const ev = new KeyboardEvent('keydown', { key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
    }, key);

    await press('2');
    await sleep(120);
    const pat = await page.evaluate(() => ({ currentPattern, label: document.querySelector('#patternTabs .ab-tab.on') ? document.querySelector('#patternTabs .ab-tab.on').textContent : '' }));
    check('key 2 switches to pattern B', pat.currentPattern === 1, JSON.stringify(pat));

    await page.evaluate(() => switchPattern(0));
    await press('a');
    await sleep(80);
    await press('s');
    await sleep(80);
    const entered = await page.evaluate(() => {
      const ti = activeTrack;
      return { s0: { ...grid[ti][0] }, s1: { ...grid[ti][1] }, cursor: keyboardStep };
    });
    check('letter keys place notes and advance the cursor', entered.s0.on && entered.s0.note === 'C' && entered.s1.on && entered.s1.note === 'D' && entered.cursor === 2, JSON.stringify(entered));

    await press('ArrowRight');
    await sleep(80);
    const moved = await page.evaluate(() => keyboardStep);
    check('arrow keys move the step cursor', moved === 3, String(moved));

    await page.evaluate(() => { histUndo = []; histRedo = []; updateUndoRedoBtns(); });
    await page.evaluate(() => { toggleCell(activeTrack, 5, document.querySelector('.step-cell[data-track="' + activeTrack + '"][data-step="5"]'), tracks[activeTrack]); });
    const panel = await page.evaluate(() => {
      toggleUndoPanel();
      return {
        hidden: document.getElementById('undo-panel').hidden,
        rows: document.querySelectorAll('#undo-list .lib-row').length,
        expanded: document.getElementById('historyBtn').getAttribute('aria-expanded')
      };
    });
    check('Ctrl+H style history button shows recent states', !panel.hidden && panel.rows >= 1 && panel.expanded === 'true', JSON.stringify(panel));

    const undoState = await page.evaluate(() => {
      const ti = activeTrack;
      const before = grid[ti][5].on;
      undo();
      return { before, after: grid[ti][5].on, panelRows: document.querySelectorAll('#undo-list .lib-row').length };
    });
    check('undo restores the previous state from the same panel', undoState.before === true && undoState.after === false && undoState.panelRows >= 1, JSON.stringify(undoState));

    const typing = await page.evaluate(() => {
      const ti = activeTrack;
      const before = grid[ti].filter((c) => c.on).length;
      const input = document.getElementById('projName');
      input.focus();
      const ev = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true });
      input.dispatchEvent(ev);
      input.blur();
      return { before, after: grid[ti].filter((c) => c.on).length };
    });
    check('shortcuts are ignored while typing in an input', typing.after === typing.before, JSON.stringify(typing));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO KEYBOARD CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
