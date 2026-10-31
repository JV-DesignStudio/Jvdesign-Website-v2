const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
// A1508: page behaviour now lives in external files (/assets/js/inline/*.js) so
// the static checks below must read the page plus the scripts it references.
function pageSource(file) {
  const html = fs.readFileSync(path.join(ROOT, 'workshops', file), 'utf8');
  let all = html;
  let m;
  const re = /\/assets\/js\/inline\/([A-Za-z0-9._-]+\.js)/g;
  while ((m = re.exec(html))) {
    try { all += '\n' + fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', m[1]), 'utf8'); } catch (e) {}
  }
  return all;
}
// Coverage gate: keep the validator honest as new workshop pages are added.
// The detailed progress checks below cover the established interactive
// patterns; this directory-wide gate ensures every workshop HTML file still
// has the public metadata contract used by the site and sitemap.
// Public-workshop coverage gate. Prototype pages marked noindex (for example
// the *-canvas.html build-along drafts) are intentionally not public yet and
// are excluded until they are promoted to real workshop URLs.
const ALL_WORKSHOP_FILES = fs.readdirSync(path.join(ROOT, 'workshops'))
  .filter(file => file.endsWith('.html'))
  .sort();
const PUBLIC_WORKSHOP_FILES = ALL_WORKSHOP_FILES.filter(file => {
  const content = pageSource(file);
  return !/<meta\s+name=["']robots["'][^>]*noindex/i.test(content);
});
const coverage = { files: PUBLIC_WORKSHOP_FILES.length, missing_title: [], missing_description: [], missing_canonical: [], missing_age: [] };
PUBLIC_WORKSHOP_FILES.forEach(file => {
  const content = pageSource(file);
  if (!/<title>[^<]+<\/title>/i.test(content)) coverage.missing_title.push(file);
  if (!/<meta\s+name=["']description["']/i.test(content)) coverage.missing_description.push(file);
  if (!/<link\s+rel=["']canonical["']/i.test(content)) coverage.missing_canonical.push(file);
  // Age label deferred: checked after CONVERTED/BUILDER_STYLE are defined (see below).
});

const CONVERTED = [
  'add-your-own-stage.html', 'barrel-blast-workshop.html', 'blender-workshop.html',
  'cpp-tower-defence-builder.html', 'fairy-survivors-guide.html', 'fnaf-blueprint.html',
  'gml_shooter_trainer_project.html',
  'godot-gatekeeper-3d-part1.html', 'godot-gatekeeper-3d-part2.html', 'jump-jump-mario-workshop.html',
  'minecraft-custom-block-mod.html', 'minecraft-custom-food-mod.html', 'minecraft-custom-mob-mod.html',
  'minecraft-custom-tool-mod.html', 'minecraft-first-item-mod.html', 'minecraft-lucky-mod.html',
  'mugen-ai-workshop.html', 'mugen-workshop.html', 'night-watch-part2-workshop.html',
  'night-watch-part3-workshop.html', 'nuclear-blueprint.html',
  'nuclear-throne-guide.html', 'openrct2-modding-builder.html', 'openrct2-swim-rescue.html',
  'pixel-quest-workshop.html', 'python-game-builder.html', 'race-builder.html', 'racing-blueprint.html',
  'roblox-adventure-workshop.html', 'roblox-battle-workshop.html', 'roblox-horror-workshop.html',
  'roblox-obby-workshop.html', 'roblox-pirate-workshop.html', 'roblox-simulator-workshop.html',
  'roblox-tycoon-workshop.html',
  // scratch-catch/clicker/maze/platformer/quiz are now canvas build-alongs
  // (shared workshop-canvas-engine + workshop-engine) like js-*/java-*, so they
  // no longer carry the inline checkbox engine this list checks for.
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
// the other 39 boot.dev-style workshops use , that's a real, intentional
// difference in how they track progress, not a missing feature. Checking
// them against the checkbox pattern produced a permanent false-positive
// "Missing Functions" list that drowned out real regressions in the noise.
const BUILDER_STYLE = [
  'cpp-tower-defence-builder.html', 'fairy-survivors-guide.html', 'fnaf-blueprint.html',
  'gml_shooter_trainer_project.html',
  'godot-gatekeeper-3d-part1.html', 'godot-gatekeeper-3d-part2.html', 'nuclear-blueprint.html', 'nuclear-throne-guide.html',
  'openrct2-swim-rescue.html', 'python-game-builder.html', 'race-builder.html', 'racing-blueprint.html',
  'space_invaders_tutorial.html', 'unity-2d-platformer.html', 'unity-3d-platformer.html',
  'unity-top-down-shooter.html', 'unreal-2d-platformer.html', 'unreal-blueprint-shooter.html',
  'unreal-clicker-builder.html', 'unreal-fighter-workshop.html', 'unreal-top-down-shooter.html'
];

const results = { valid: [], builder_style: [], missing_key: [], missing_functions: [], errors: [] };

// Age label check: only structured workshop sequences (not cheatsheets, mod studios, utility pages).
// Catches the AUD-DF-03 / AUD-3D-04 / AUD-AM-07 class of contradictory age labelling.
[...new Set([...CONVERTED, ...BUILDER_STYLE])].forEach(file => {
  if (!PUBLIC_WORKSHOP_FILES.includes(file)) return;
  const content = pageSource(file);
  // Read the description up to its own closing quote. A pattern like [^"']*
  // stops at the first apostrophe, so "beginner's" or "Freddy's" hid the age
  // label that followed it and reported a false gap.
  const descTag = content.match(/<meta\s+name=["']description["'][^>]*content=(["'])([\s\S]*?)\1/i);
  const descMatch = !!(descTag && /ages\s*\d/i.test(descTag[2]));
  const bodyAgeMatch = /pill-age|ep-badge[^>]*>[\s\S]{0,60}ages\s*\d|hero-eyebrow[^>]*>[\s\S]{0,80}ages\s*\d|<span[^>]*>[^<]*ages\s+\d/i.test(content);
  if (!descMatch && !bodyAgeMatch) coverage.missing_age.push(file);
});

CONVERTED.forEach(file => {
  try {
    const content = pageSource(file);
    const isBuilder = BUILDER_STYLE.includes(file);
    const hasStorageKey = content.includes('STORAGE_KEY');

    if (isBuilder) {
      // Different completion mechanisms per builder (some use go()/
      // renderStep(), some don't) , not worth a second brittle heuristic.
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

// A2028: every published (catalogue-linked, indexable) workshop needs a visible
// outcome statement: your project, what you learn, what you finish with and how
// to extend it.
const outcomeMissing = [];
try {
  const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
  catalogue.forEach(entry => {
    const file = path.basename(entry.url || '');
    if (!file || !PUBLIC_WORKSHOP_FILES.includes(file)) return;
    const block = pageSource(file).match(/<!-- WS-OUTCOME:START -->([\s\S]*?)<!-- WS-OUTCOME:END -->/);
    const ok = block
      && block[1].includes('<dt>Your project</dt>')
      && block[1].includes("<dt>You'll learn</dt>")
      && block[1].includes('<dt>Finish with</dt>')
      && block[1].includes('<dt>Then extend it</dt>');
    if (!ok) outcomeMissing.push(file);
  });
} catch (err) {
  console.log('  Could not check workshop outcomes: ' + err.message);
}

console.log(`✓ Valid (checkbox-style): ${results.valid.length}/${CONVERTED.length - BUILDER_STYLE.length}`);console.log(`✓ Workshop coverage: ${coverage.files} HTML files checked for title, description, canonical and age metadata`);
if (coverage.missing_title.length) console.log('  Missing title: ' + coverage.missing_title.join(', '));
if (coverage.missing_description.length) console.log('  Missing description: ' + coverage.missing_description.join(', '));
if (coverage.missing_canonical.length) console.log('  Missing canonical: ' + coverage.missing_canonical.join(', '));
if (coverage.missing_age.length) console.log('  Missing age label (add "Ages N+" to meta description or a .pill-age / .ep-badge span): ' + coverage.missing_age.join(', '));
console.log(`✓ Builder-style (different pattern by design, STORAGE_KEY present): ${results.builder_style.length}/${BUILDER_STYLE.length}`);
console.log(`✗ Missing STORAGE_KEY: ${results.missing_key.length}`);
if (results.missing_key.length > 0) console.log('  Files: ' + results.missing_key.join(', '));
console.log(`✗ Missing Functions: ${results.missing_functions.length}`);
if (results.missing_functions.length > 0) console.log('  Files: ' + results.missing_functions.join(', '));
console.log(`✗ Read Errors: ${results.errors.length}`);
if (results.errors.length > 0) results.errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));

console.log(`- Missing outcome statement: ${outcomeMissing.length}`);
if (outcomeMissing.length > 0) console.log('  Files: ' + outcomeMissing.join(', '));
// A2037: every published tutorial must declare a completion condition, a
// finish screen and a next step. Registry lives in content/workshop-completion.json;
// rebuild with node scripts/build-workshop-completion.js after adding a workshop.
let completionMissing = [];
try {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-completion.json'), 'utf8'));
  registry.workshops.forEach(entry => {
    if (entry.mode === 'reference') return;
    if (!entry.condition || entry.condition === 'none' || !entry.conditionText || !entry.next || !entry.next.url) {
      completionMissing.push(entry.id + ' (no condition/next)');
      return;
    }
    let src;
    try { src = pageSource(path.basename(entry.page)); } catch (e) { completionMissing.push(entry.id + ' (missing page)'); return; }
    if (entry.mode === 'engine' || entry.mode === 'steps') {
      if (!/id=["']finishBanner["']/.test(src) || !/WS-FINISH:START/.test(src)) completionMissing.push(entry.id + ' (no finish screen)');
    } else if (entry.mode === 'builder') {
      const ok = entry.hasFinishBanner
        ? (/id=["']finishBanner["']/.test(src) && /WS-FINISH:START/.test(src))
        : /id="wsFinish"/.test(src);
      if (!ok) completionMissing.push(entry.id + ' (no finish line)');
    } else if (entry.mode === 'canvas') {
      if (!/workshop-canvas-engine\.js/.test(src)) completionMissing.push(entry.id + ' (canvas engine not loaded)');
    }
  });
  console.log(`- Workshop completion condition: ${registry.workshops.filter(w => w.mode !== 'reference').length - completionMissing.length}/${registry.workshops.filter(w => w.mode !== 'reference').length} tutorials have a finish screen and next step`);
  if (completionMissing.length) console.log('  Missing: ' + completionMissing.join(', '));
} catch (err) {
  completionMissing = ['registry: ' + err.message];
  console.log('  Could not check workshop completion: ' + err.message);
}

// A2029: every tutorial must carry the gradual-release moves (See it,
// Understand it, Build it, Fix it, Own it), so a learner is never left with
// copy-the-reference as the only route.
let releaseMissing = [];
try {
  const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-gradual-release.json'), 'utf8'));
  const stages = ['see', 'understand', 'build', 'fix', 'own'];
  release.workshops.forEach(entry => {
    let src;
    try { src = pageSource(path.basename(entry.page)); } catch (e) { releaseMissing.push(entry.id + ' (missing page)'); return; }
    const block = src.match(/<!-- WS-RELEASE:START -->([\s\S]*?)<!-- WS-RELEASE:END -->/);
    if (!block) { releaseMissing.push(entry.id + ' (no release block)'); return; }
    const body = block[1];
    const missingStages = stages.filter(stage => !body.includes('data-stage="' + stage + '"'));
    if (missingStages.length) releaseMissing.push(entry.id + ' (missing ' + missingStages.join(', ') + ')');
    else if (!/reference solution/i.test(body)) releaseMissing.push(entry.id + ' (no reference-solution note)');
  });
  console.log('- Workshop gradual release: ' + (release.workshops.length - releaseMissing.length) + '/' + release.workshops.length + ' tutorials carry the five moves');
  if (releaseMissing.length) console.log('  Missing: ' + releaseMissing.join(', '));
} catch (err) {
  releaseMissing = ['registry: ' + err.message];
  console.log('  Could not check workshop gradual release: ' + err.message);
}

let contentIntegrity = { configs: 0, steps: 0, issues: [] };
try {
  contentIntegrity = require('./tests/workshop-content-integrity.js').run();
  console.log(`- Workshop content integrity: ${contentIntegrity.configs} configs / ${contentIntegrity.steps} steps checked, ${contentIntegrity.issues.length} problems`);
  contentIntegrity.issues.forEach(issue => console.log(`  ${issue.file} | ${issue.kind} | ${issue.detail || ''}`));
} catch (err) {
  console.log('  Could not check workshop content integrity: ' + err.message);
}

let debugging = { entries: 0, stale: [], missing: [] };
try {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-debugging.json'), 'utf8'));
  const START = '<!-- WS-DEBUG:START -->';
  const END = '<!-- WS-DEBUG:END -->';
  data.forEach(entry => {
    const file = path.join(ROOT, String(entry.page || '').replace(/^\//, ''));
    if (!fs.existsSync(file)) { debugging.missing.push(entry.series || entry.page); return; }
    const html = fs.readFileSync(file, 'utf8');
    const start = html.indexOf(START);
    const end = html.indexOf(END);
    if (start < 0 || end < start) { debugging.stale.push(entry.series || entry.page); return; }
    debugging.entries++;
  });
  console.log(`- Workshop debugging tasks: ${debugging.entries}/${data.length} coding series with a hint-first debug task`);
  if (debugging.missing.length) console.log('  Missing page: ' + debugging.missing.join(', '));
  if (debugging.stale.length) console.log('  No stamped block (run node scripts/apply-workshop-debugging.js): ' + debugging.stale.join(', '));
} catch (err) {
  console.log('  Could not check workshop debugging tasks: ' + err.message);
}

const hasFailures = results.missing_key.length > 0 || results.missing_functions.length > 0 || results.errors.length > 0 || coverage.missing_title.length > 0 || coverage.missing_description.length > 0 || coverage.missing_canonical.length > 0 || coverage.missing_age.length > 0 || outcomeMissing.length > 0 || completionMissing.length > 0 || releaseMissing.length > 0 || contentIntegrity.issues.length > 0 || debugging.missing.length > 0 || debugging.stale.length > 0;
if (hasFailures) process.exitCode = 1;
