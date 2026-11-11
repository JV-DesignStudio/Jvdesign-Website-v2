#!/usr/bin/env node
// tests/sound-studio-visuals.js (A2948)
// Covers Pip's beat reaction and the reduced-motion switch.
// Run: node tests/sound-studio-visuals.js
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
    const vis = await page.evaluate(() => {
      const el = document.getElementById('beat-pip');
      document.body.classList.remove('reduce-motion');
      el.classList.remove('bounce');
      pipBeat(true);
      const bounced = el.classList.contains('bounce');
      document.body.classList.add('reduce-motion');
      el.classList.remove('bounce');
      pipBeat(true);
      const reduced = el.classList.contains('bounce');
      document.body.classList.remove('reduce-motion');
      return { has: !!el, src: el ? el.getAttribute('src') : '', bounced, reduced };
    });
    check('Pip is on the page with a local image', vis.has && /^\/assets\//.test(vis.src), JSON.stringify(vis));
    check('Pip bounces on the beat', vis.bounced === true, String(vis.bounced));
    check('reduced motion stops the bounce', vis.reduced === false, String(vis.reduced));

    const motion = await page.evaluate(() => {
      localStorage.removeItem('jvds_sound_motion');
      document.body.classList.remove('reduce-motion');
      toggleMotion();
      const off = document.body.classList.contains('reduce-motion');
      const stored = localStorage.getItem('jvds_sound_motion');
      toggleMotion();
      return { off, stored, on: !document.body.classList.contains('reduce-motion'), storedOn: localStorage.getItem('jvds_sound_motion') };
    });
    check('motion toggle switches and persists', motion.off && motion.stored === 'off' && motion.on && motion.storedOn === 'on', JSON.stringify(motion));

    const img = await page.evaluate(() => {
      const el = document.getElementById('beat-pip');
      return { width: el.getAttribute('width'), height: el.getAttribute('height'), alt: el.getAttribute('alt') };
    });
    check('Pip stays small and decorative', img.width === '28' && img.height === '28' && img.alt === '', JSON.stringify(img));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO VISUAL CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
