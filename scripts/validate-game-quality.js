const fs = require('fs');

const studioPicks = [
  'games/pixel-pet-arena.html',
  'games/creature-rescue-clinic.html',
  'games/backpack-quest.html',
  'games/marble-run-lab.html',
  'games/beat-builder-battle.html',
  'games/garden-defense.html'
];

const polishSignals = {
  'games/pixel-pet-arena.html': [/Build Coach/, /League Mission/, /medals/],
  'games/creature-rescue-clinic.html': [/Triage Coach/, /clinicCoach/, /recommended/],
  'games/backpack-quest.html': [/Pack Coach/, /starter-grid/, /Synergy score/],
  'games/marble-run-lab.html': [/Flow Coach/, /flowCoach/, /leak/],
  'games/beat-builder-battle.html': [/Beat Coach/, /preset-row/, /timing-readout/],
  'games/garden-defense.html': [/waveIntel/, /gd-wave-intel/, /Challenge Bonus/]
};

let failed = false;
for (const file of studioPicks) {
  const html = fs.readFileSync(file, 'utf8');
  const checks = [
    ['quality panel', /quality-panel|gd-quality-panel/],
    ['goal label', /<b>Goal<\/b>/],
    ['skill label', /<b>Skill<\/b>/],
    ['session label', /<b>Session<\/b>/],
    ['build next label', /<b>Build next<\/b>/],
    ['build link', /href="\.\.\/tools\//],
    ['save/progress hook', /addScore|recordGamePlay|saveState|localStorage/]
  ];
  for (const [name, pattern] of checks) {
    if (!pattern.test(html)) {
      console.error(`[FAIL] ${file}: missing ${name}`);
      failed = true;
    }
  }
  const missingSignals = (polishSignals[file] || []).filter(pattern => !pattern.test(html));
  if (missingSignals.length) {
    console.error(`[FAIL] ${file}: missing Studio Pick polish signals (${missingSignals.length})`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Game quality gate passed for ${studioPicks.length} Studio Picks with polish signals.`);
