'use strict';
/**
 * build-workshop-gradual-release.js (A2029)
 *
 * Writes content/workshop-gradual-release.json: the five gradual-release moves
 * (See it, Understand it, Build it, Fix it, Own it) for every published
 * tutorial, with the real links that exist on that page.
 *
 * Why a registry: the point is to stop a learner reproducing a result without
 * understanding it. Every workshop must offer a route from watching, to
 * explaining, to building, to debugging, to changing the thing on their own.
 *
 * Usage:
 *   node scripts/build-workshop-gradual-release.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'workshop-gradual-release.json');

const CATALOGUE = path.join(ROOT, 'content', 'workshops.json');
const OUTCOMES = path.join(ROOT, 'content', 'workshop-outcomes.json');
const COMPLETION = path.join(ROOT, 'content', 'workshop-completion.json');
const DEBUGGING = path.join(ROOT, 'content', 'workshop-debugging.json');

const ENGINE_HUBS = {
  'Blender': 'engine-blender.html',
  'C++': 'engine-cpp.html',
  'Defold': 'engine-defold.html',
  'GDevelop': 'engine-gdevelop.html',
  'General': 'engine-general.html',
  'GML/GameMaker': 'engine-gml-gamemaker.html',
  'Godot': 'engine-godot.html',
  'Java': 'engine-java.html',
  'JavaScript': 'engine-javascript.html',
  'Minecraft': 'engine-minecraft.html',
  'MUGEN': 'engine-mugen.html',
  'OpenRCT2': 'engine-openrct2.html',
  'PICO-8': 'engine-pico-8.html',
  'Python': 'engine-python.html',
  'Roblox': 'engine-roblox.html',
  'Scratch': 'engine-scratch.html',
  'Stardew Valley': 'engine-stardew-valley.html',
  'Terraria': 'engine-terraria.html',
  'TinkerCAD': 'engine-tinkercad.html',
  'Unity': 'engine-unity.html',
  'Unreal': 'engine-unreal.html'
};

/* Cheat sheets sit beside the workshops, so the "understand it" move can open
   the short reference for the lines that matter. Missing ones are skipped. */
const CHEAT_SHEETS = {
  'Blender': 'blender-cheatsheet.html',
  'C++': 'cpp-cheatsheet.html',
  'GML/GameMaker': 'gml-cheatsheet.html',
  'Godot': 'gdscript-cheatsheet.html',
  'JavaScript': 'js-cheatsheet.html',
  'Minecraft': 'minecraft-modding-cheatsheet.html',
  'MUGEN': 'mugen-cheatsheet.html',
  'OpenRCT2': 'openrct2-cheatsheet.html',
  'Python': 'python-cheatsheet.html',
  'Roblox': 'roblox-studio-cheatsheet.html',
  'Scratch': 'scratch-cheatsheet.html',
  'Stardew Valley': 'stardew-modding-cheatsheet.html',
  'Terraria': 'terraria-modding-cheatsheet.html',
  'TinkerCAD': 'tinkercad-cheatsheet.html',
  'Unity': 'unity-cheatsheet.html',
  'Unreal': 'unreal-cheatsheet.html'
};

/* The debugging data names GML by its short name. */
const DEBUG_SERIES = { 'GML/GameMaker': 'GML' };

const STAGES = [
  { key: 'see', label: 'See it', character: 'Pip' },
  { key: 'understand', label: 'Understand it', character: 'Lumo' },
  { key: 'build', label: 'Build it', character: 'Ember' },
  { key: 'fix', label: 'Fix it', character: 'Echo' },
  { key: 'own', label: 'Own it', character: 'Stardust' }
];

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function hasAnchor(html, id) {
  return new RegExp('id="' + id + '"').test(html);
}

function firstStepAnchor(mode, html) {
  if (mode === 'canvas') {
    if (hasAnchor(html, 'stepsPanel')) return '#stepsPanel';
    if (hasAnchor(html, 'main-content')) return '#main-content';
    return '';
  }
  if (mode === 'builder') {
    if (hasAnchor(html, 'wsFinish')) return '#wsFinish';
    if (hasAnchor(html, 'finishBanner')) return '#finishBanner';
    if (hasAnchor(html, 'main-content')) return '#main-content';
    return '';
  }
  if (hasAnchor(html, 'step-1')) return '#step-1';
  if (hasAnchor(html, 'main-content')) return '#main-content';
  return '';
}

function build() {
  const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
  const outcomes = JSON.parse(fs.readFileSync(OUTCOMES, 'utf8'));
  const completion = JSON.parse(fs.readFileSync(COMPLETION, 'utf8'));
  const debugging = JSON.parse(fs.readFileSync(DEBUGGING, 'utf8'));

  const engineById = {};
  catalogue.forEach((c) => { engineById[c.id] = c.engine; });

  const debugBySeries = {};
  debugging.forEach((d) => { debugBySeries[d.series] = d; });

  const outcomeById = {};
  outcomes.forEach((o) => { outcomeById[o.id] = o; });

  const workshops = [];
  const skipped = [];

  for (const entry of completion.workshops) {
    if (entry.mode === 'reference') continue;
    const html = fs.readFileSync(path.join(ROOT, entry.page), 'utf8');
    const outcome = outcomeById[entry.id];
    if (!outcome) { skipped.push(entry.id + ' (no outcome)'); continue; }

    const engine = engineById[entry.id] || '';
    const buildAnchor = firstStepAnchor(entry.mode, html);

    const cheat = CHEAT_SHEETS[engine];
    const cheatUrl = cheat && exists('workshops/' + cheat) ? cheat : '';

    const debugSeries = DEBUG_SERIES[engine] || engine;
    const debug = debugBySeries[debugSeries];
    const hub = ENGINE_HUBS[engine];
    let fixUrl = '';
    if (debug && hub && exists('workshops/' + hub)) fixUrl = hub + '#ws-debug-title';

    workshops.push({
      id: entry.id,
      page: entry.page,
      mode: entry.mode,
      engine,
      project: outcome.project,
      extend: outcome.extend,
      stages: {
        see: { text: 'Watch the finished build work before you type anything. Notice one thing it does that you want to keep.', url: buildAnchor },
        understand: { text: 'Read why the important lines are there before you copy them. If you can say what a line does in your own words, you understand it.', url: cheatUrl || buildAnchor },
        build: { text: 'Type or assemble the guided version yourself. Keep the reference solution closed unless a step stops you.', url: buildAnchor },
        fix: debug && fixUrl
          ? { text: "Try Echo's Debug It challenge. Find the bug from the clues before you open the answer.", url: fixUrl }
          : { text: 'Break one line on purpose, run it again, and use the error message or preview to find what changed.', url: '' },
        own: { text: 'Change one thing the guide never asked for: ' + outcome.extend + '. If your version runs, it is yours.', url: '#ws-outcome-title' }
      }
    });
  }

  workshops.sort((a, b) => a.id.localeCompare(b.id));
  return { workshops, skipped, stages: STAGES };
}

if (require.main === module) {
  const result = build();
  fs.writeFileSync(OUT, JSON.stringify({
    generatedBy: 'scripts/build-workshop-gradual-release.js',
    stages: result.stages,
    workshops: result.workshops
  }, null, 2) + '\n');

  const withFix = result.workshops.filter((w) => w.stages.fix.url).length;
  console.log('Workshop gradual release: ' + result.workshops.length + ' tutorials -> content/workshop-gradual-release.json');
  console.log('  ' + withFix + ' link to a Debug It task, ' + (result.workshops.length - withFix) + ' use the self-debug prompt');
  if (result.skipped.length) {
    console.log('  skipped: ' + result.skipped.join(', '));
    process.exitCode = 1;
  }
}

module.exports = { build, STAGES, ENGINE_HUBS, CHEAT_SHEETS };
