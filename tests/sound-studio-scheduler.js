#!/usr/bin/env node
// tests/sound-studio-scheduler.js (A2715)
// Proves the sequencer runs on the audio clock with a look-ahead queue:
//   1. it only queues notes inside the look-ahead window,
//   2. 64 steps stay exactly one 16th apart (no drift),
//   3. a stalled scheduler resyncs instead of firing past-due notes in a burst,
//   4. scheduling reads audioContext.currentTime,
//   5. play and stop still work at 390px and 1440px.
// Run: node tests/sound-studio-scheduler.js
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
    const normal = await page.evaluate(() => {
      const realGetCtx = getCtx, realSchedule = scheduleStepAt;
      const times = [];
      const clock = 10;
      getCtx = () => ({ currentTime: clock });
      scheduleStepAt = (t) => times.push(t);
      bpm = 120; lookahead = 0.1;
      isPlaying = true;
      nextStepTime = 10;
      scheduler();
      const out = { times: times.slice(), next: nextStepTime };
      isPlaying = false; stepQueue = [];
      getCtx = realGetCtx; scheduleStepAt = realSchedule;
      return out;
    });
    check('scheduler queues only the look-ahead window', normal.times.length === 1 && Math.abs(normal.times[0] - 10) < 1e-9, JSON.stringify(normal));
    check('scheduler advances one exact 16th', Math.abs(normal.next - 10.125) < 1e-9, String(normal.next));

    const drift = await page.evaluate(() => {
      const realGetCtx = getCtx, realSchedule = scheduleStepAt;
      const times = [];
      let clock = 0;
      getCtx = () => ({ currentTime: clock });
      scheduleStepAt = (t) => times.push(t);
      bpm = 120; lookahead = 0.1;
      isPlaying = true;
      nextStepTime = 0;
      scheduler();
      while (times.length < 64) { clock += 0.025; scheduler(); }
      const secPerStep = (60 / bpm) / 4;
      let maxErr = 0;
      times.forEach((t, i) => { maxErr = Math.max(maxErr, Math.abs(t - i * secPerStep)); });
      isPlaying = false; stepQueue = [];
      getCtx = realGetCtx; scheduleStepAt = realSchedule;
      return { count: times.length, maxErr };
    });
    check('64 steps stay exactly one 16th apart', drift.count >= 64 && drift.maxErr < 1e-9, JSON.stringify(drift));

    const stalled = await page.evaluate(() => {
      const realGetCtx = getCtx, realSchedule = scheduleStepAt;
      const times = [];
      const clock = 60;
      getCtx = () => ({ currentTime: clock });
      scheduleStepAt = (t) => times.push(t);
      bpm = 120; lookahead = 0.1;
      isPlaying = true;
      nextStepTime = 45;
      scheduler();
      const out = { times: times.slice(), next: nextStepTime, clock };
      isPlaying = false; stepQueue = [];
      getCtx = realGetCtx; scheduleStepAt = realSchedule;
      return out;
    });
    const past = stalled.times.filter((t) => t < stalled.clock - 0.001);
    check('a stalled scheduler fires no past-due notes', past.length === 0, JSON.stringify(stalled.times));
    check('a stalled scheduler queues one step just after now', stalled.times.length === 1 && stalled.times[0] >= stalled.clock, JSON.stringify(stalled.times));
    check('a stalled scheduler resyncs nextStepTime to the audio clock', stalled.next > stalled.clock, String(stalled.next));

    const wired = await page.evaluate(() => ({
      scheduler: typeof scheduler,
      lookahead: typeof lookahead,
      interval: typeof schedInterval,
      usesCtx: /currentTime/.test(scheduler.toString()),
      guardsStall: /nextStepTime < now - 0\.02/.test(scheduler.toString())
    }));
    check('scheduler reads audioContext.currentTime', wired.scheduler === 'function' && wired.usesCtx === true, JSON.stringify(wired));
    check('scheduler has the stall resync guard', wired.guardsStall === true, JSON.stringify(wired));

    async function playStop(width, height, label) {
      await page.setViewport({ width, height });
      await sleep(150);
      const started = await page.evaluate(() => {
        if (isPlaying) stopAll();
        togglePlay();
        const btn = document.getElementById('playBtn');
        return { playing: isPlaying, text: btn ? btn.textContent : '', hasTimer: !!schedTimer };
      });
      await sleep(350);
      const stopped = await page.evaluate(() => {
        stopAll();
        const btn = document.getElementById('playBtn');
        return { playing: isPlaying, text: btn ? btn.textContent : '', hasTimer: !!schedTimer };
      });
      check(label + ': play starts the scheduler', started.playing && started.hasTimer && /Stop/.test(started.text), JSON.stringify(started));
      check(label + ': stop clears the scheduler', !stopped.playing && !stopped.hasTimer && /Play/.test(stopped.text), JSON.stringify(stopped));
    }

    await playStop(390, 844, '390px');
    await playStop(1440, 900, '1440px');

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO SCHEDULER CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
