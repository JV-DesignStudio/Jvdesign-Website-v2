const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const CONVERTED = [
  'add-your-own-stage.html', 'barrel-blast-workshop.html', 'blender-workshop.html',
  'cpp-tower-defence-builder.html', 'fairy-survivors-guide.html', 'fnaf-blueprint.html',
  'gml_shooter_trainer_project.html', 'godot-racing-workshop-2.html', 'godot-racing-workshop.html',
  'godot_tutorial.html', 'js-platformer-builder.html', 'jump-jump-mario-workshop.html',
  'minecraft-custom-block-mod.html', 'minecraft-custom-food-mod.html', 'minecraft-custom-mob-mod.html',
  'minecraft-custom-tool-mod.html', 'minecraft-first-item-mod.html', 'minecraft-lucky-mod.html',
  'mugen-ai-workshop.html', 'mugen-workshop.html', 'night-watch-part2-workshop.html',
  'night-watch-part3-workshop.html', 'night-watch-workshop.html', 'nuclear-blueprint.html',
  'nuclear-throne-guide.html', 'openrct2-modding-builder.html', 'openrct2-swim-rescue.html',
  'pixel-quest-workshop.html', 'python-game-builder.html', 'race-builder.html', 'racing-blueprint.html',
  'roblox-adventure-workshop.html', 'roblox-battle-workshop.html', 'roblox-horror-workshop.html',
  'roblox-obby-workshop.html', 'roblox-pirate-workshop.html', 'roblox-simulator-workshop.html',
  'roblox-tycoon-workshop.html', 'scratch-catch-workshop.html', 'scratch-clicker-workshop.html',
  'scratch-maze-workshop.html', 'scratch-platformer-workshop.html', 'scratch-quiz-workshop.html',
  'scratch-story-workshop.html', 'space_invaders_tutorial.html', 'tinkercad-ep1-spinner.html',
  'tinkercad-ep2-popit.html', 'tinkercad-ep3-blocks.html', 'tinkercad-ep4-pattern.html',
  'tinkercad-ep5-phonestand.html', 'tinkercad-ep6-marblerun.html', 'tinkercad-ep7-keychain.html',
  'tinkercad-ep8-shapes.html', 'unity-2d-platformer.html', 'unity-3d-platformer.html',
  'unity-top-down-shooter.html', 'unreal-2d-platformer.html', 'unreal-blueprint-shooter.html',
  'unreal-clicker-builder.html', 'unreal-fighter-workshop.html', 'unreal-top-down-shooter.html'
];

// These are "design it live" builder/blueprint workshops (castles, ships,
// rockets, racing games, Unity/Unreal/GML/C++/Python/OpenRCT2 builders).
// They're single continuous step-by-step designers navigated with go(i)/
// renderStep(), not the checkbox-driven toggleStep()/completeStep() pattern
// the other 39 boot.dev-style workshops use — that's a real, intentional
// difference in how they track progress, not a missing feature. Checking
// them against the checkbox pattern produced a permanent false-positive
// "Missing Functions" list that drowned out real regressions in the noise.
const BUILDER_STYLE = [
  'cpp-tower-defence-builder.html', 'fairy-survivors-guide.html', 'fnaf-blueprint.html',
  'gml_shooter_trainer_project.html', 'godot-racing-workshop-2.html', 'godot-racing-workshop.html',
  'js-platformer-builder.html', 'nuclear-blueprint.html', 'nuclear-throne-guide.html',
  'openrct2-swim-rescue.html', 'python-game-builder.html', 'race-builder.html', 'racing-blueprint.html',
  'space_invaders_tutorial.html', 'unity-2d-platformer.html', 'unity-3d-platformer.html',
  'unity-top-down-shooter.html', 'unreal-2d-platformer.html', 'unreal-blueprint-shooter.html',
  'unreal-clicker-builder.html', 'unreal-fighter-workshop.html', 'unreal-top-down-shooter.html'
];

const results = { valid: [], builder_style: [], missing_key: [], missing_functions: [], errors: [] };

CONVERTED.forEach(file => {
  try {
    const content = fs.readFileSync(path.join(ROOT, 'workshops', file), 'utf8');
    const isBuilder = BUILDER_STYLE.includes(file);
    const hasStorageKey = content.includes('STORAGE_KEY');

    if (isBuilder) {
      // Different completion mechanisms per builder (some use go()/
      // renderStep(), some don't) — not worth a second brittle heuristic.
      // The one thing every workshop on this site needs regardless of
      // style is somewhere to persist progress; still flag a builder
      // that's missing even that.
      if (hasStorageKey) results.builder_style.push(file);
      else results.missing_key.push(file);
      return;
    }

    const checks = {
      hasStorageKey,
      hasToggleStep: content.includes('toggleStep'),
      hasCompleteStep: content.includes('completeStep'),
      hasProgress: content.includes('progress'),
      hasStyleWorkshop: content.includes('style-workshop.css'),
      hasStepCard: content.includes('step-card')
    };

    const allValid = Object.values(checks).every(v => v);
    if (allValid) {
      results.valid.push(file);
    } else {
      if (!checks.hasStorageKey) results.missing_key.push(file);
      if (!checks.hasToggleStep || !checks.hasCompleteStep) results.missing_functions.push(file);
    }
  } catch (err) {
    results.errors.push({ file, error: err.message });
  }
});

console.log(`✓ Valid (checkbox-style): ${results.valid.length}/${CONVERTED.length - BUILDER_STYLE.length}`);
console.log(`✓ Builder-style (different pattern by design, STORAGE_KEY present): ${results.builder_style.length}/${BUILDER_STYLE.length}`);
console.log(`✗ Missing STORAGE_KEY: ${results.missing_key.length}`);
if (results.missing_key.length > 0) console.log('  Files: ' + results.missing_key.join(', '));
console.log(`✗ Missing Functions: ${results.missing_functions.length}`);
if (results.missing_functions.length > 0) console.log('  Files: ' + results.missing_functions.join(', '));
console.log(`✗ Read Errors: ${results.errors.length}`);
if (results.errors.length > 0) results.errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));

const hasFailures = results.missing_key.length > 0 || results.missing_functions.length > 0 || results.errors.length > 0;
if (hasFailures) process.exitCode = 1;
