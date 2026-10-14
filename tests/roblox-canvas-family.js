// roblox-canvas-family.js - A1526. Duck-typed suite over the four canvas
// pages whose inline scripts were missing (corruption-obby, sim-lockdown
// 1/2/3): each must boot with no page errors at desktop and mobile widths,
// render 6 steps with editors, run every template clean, and show XP and
// progress through the shared engine.
//
// Run: node tests/roblox-canvas-family.js
const { run } = require('./canvas-workshop-suite.js');

const PAGES = [
  '/workshops/roblox-corruption-obby-canvas.html',
  '/workshops/roblox-sim-lockdown-1-canvas.html',
  '/workshops/roblox-sim-lockdown-2-canvas.html',
  '/workshops/roblox-sim-lockdown-3-canvas.html'
];

(async () => {
  for (const page of PAGES) {
    console.log('\n### ' + page);
    await run(page, { steps: 6 });
  }
  console.log('\nROBLOX CANVAS FAMILY: all 4 build-alongs passed');
})().catch((e) => { console.error(e); process.exit(1); });
