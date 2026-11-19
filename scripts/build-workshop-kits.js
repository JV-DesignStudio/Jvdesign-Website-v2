#!/usr/bin/env node
/**
 * build-workshop-kits.js (A2622)
 *
 * Builds content/workshop-kits.json: one record per workshop that tells the
 * shared workshop-kit.js what the two tracks are and what three "make it yours"
 * prompts to offer.
 *
 * - Browser track: browser-native workshops point at themselves. Engine
 *   workshops point at the browser studio in content/workshop-needs.json.
 * - Engine track: the workshop's own page (the existing steps).
 * - Remix prompts: two from the workshop's category plus the outcome's
 *   `extend` line, so the third is specific to the thing being built.
 *
 * Run: node scripts/build-workshop-kits.js [--check]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKSHOPS = path.join(ROOT, 'content', 'workshops.json');
const NEEDS = path.join(ROOT, 'content', 'workshop-needs.json');
const OUTCOMES = path.join(ROOT, 'content', 'workshop-outcomes.json');
const OUT = path.join(ROOT, 'content', 'workshop-kits.json');
const CHECK = process.argv.includes('--check');

const GAME_ENGINES = new Set(['Scratch', 'Godot', 'Unity', 'Unreal', 'Roblox', 'GDevelop', 'Defold', 'PICO-8', 'JavaScript', 'Python', 'C++', 'Java', 'GML/GameMaker', 'MUGEN', 'OpenRCT2']);
const MOD_ENGINES = new Set(['Minecraft', 'Stardew Valley', 'Terraria', 'MUGEN', 'Roblox', 'OpenRCT2']);

function categoryOf(e) {
  const tags = (e.tags || []).map((t) => String(t).toLowerCase());
  const blob = [e.title, e.desc, e.engine, tags.join(' ')].join(' ').toLowerCase();
  if (tags.includes('3d') || /blender|tinkercad|3d print/.test(blob)) return '3d';
  if (MOD_ENGINES.has(e.engine) || /\bmod\b|modding/.test(blob)) return 'mod';
  if (GAME_ENGINES.has(e.engine) || /game|platformer|racing|pong|shooter|rpg/.test(blob)) return 'game';
  return 'general';
}

const REMIX = {
  game: [
    { title: 'Change the speed', body: 'Make it faster or slower. What changes about how it feels?' },
    { title: 'Change the look', body: 'Swap the colours, characters or background for your own style.' }
  ],
  '3d': [
    { title: 'Change the shape', body: 'Add one more piece, or change a part you already built.' },
    { title: 'Change the colour', body: 'Give it your own palette and a name that fits your version.' }
  ],
  mod: [
    { title: 'Change one thing', body: 'Rename it, recolour it, or change what it does.' },
    { title: 'Add something new', body: 'Add one more item, block, recipe or rule that was not in the guide.' }
  ],
  general: [
    { title: 'Change the look', body: 'Make it look like yours: colours, names and layout.' },
    { title: 'Change one rule', body: 'Pick one thing to break or improve, then see what happens.' }
  ]
};

function remixFor(e, outcome) {
  const pool = REMIX[categoryOf(e)] || REMIX.general;
  const picks = pool.slice(0, 2);
  if (outcome && outcome.extend) {
    picks.push({ title: 'Make it yours', body: 'Try this: ' + outcome.extend + '.' });
  } else {
    picks.push({ title: 'Add your own twist', body: 'Change one thing the guide does not mention, then share what happened.' });
  }
  return picks.slice(0, 3);
}

// A3101: finished games that are a fair "same kind of thing" preview when the
// workshop itself has no runnable code (Blender, Unity, Unreal, Roblox, etc.).
const GAME_DEMOS = [
  { re: /flappy/i, url: '/games/echos-flight.html', label: "Echo's Swim" },
  { re: /snake/i, url: '/games/stardust-snake.html', label: 'Stardust Snake' },
  { re: /breakout|brick/i, url: '/games/ember-smash.html', label: 'Ember Smash' },
  { re: /match.?3|gem.?match/i, url: '/games/gem_match.html', label: 'Gem Match' },
  { re: /tower.?defen/i, url: '/games/tower-defence.html', label: 'Tower Defence' },
  { re: /dodge|highway/i, url: '/games/highway-dodge.html', label: 'Highway Dodge' },
  { re: /shoot|firefly/i, url: '/games/lumo_firefly_night.html', label: "Lumo's Firefly Shooter" },
  { re: /\bcard\b/i, url: '/games/call_of_the_cards.html', label: 'Call of the Cards' },
  { re: /platform|obby|jump/i, url: '/games/crossy-crew.html', label: 'Crossy Crew' },
  { re: /hive|bee/i, url: '/games/lumo-hive.html', label: "Lumo's Hive Strike" },
  { re: /cozy|cafe|farm/i, url: '/games/pips-cozy-cove.html', label: "Pip's Cozy Cove" },
  { re: /rpg|quest|adventure|rogue/i, url: '/games/nova-siege.html', label: 'Nova Siege' },
  { re: /castle|siege|citadel/i, url: '/games/arcane_citadel.html', label: 'Arcane Citadel' },
  { re: /whack/i, url: '/games/critter-whack.html', label: 'Critter Whack' },
  { re: /sky|fly|flight/i, url: '/games/sky_high_with_friends.html', label: 'Sky High With Friends' }
];

// A3101: an engine workshop can show a finished browser build of the same
// project (Pong, Snake, platformer) even when the engine itself cannot run here.
const PROJECT_DEMOS = [
  { re: /pong/i, demoRe: /pong/i, name: 'Pong' },
  { re: /breakout|brick/i, demoRe: /breakout/i, name: 'Breakout' },
  { re: /snake/i, demoRe: /snake/i, name: 'Snake' },
  { re: /platformer|mario|jump/i, demoRe: /(platformer|mario|jump)/i, name: 'platformer' },
  { re: /shooter|space[-_ ]?invader/i, demoRe: /(shooter|space)/i, name: 'shooter' },
  { re: /rpg|adventure|quest/i, demoRe: /(rpg|adventure)/i, name: 'adventure game' },
  { re: /match[-_ ]?3|puzzle/i, demoRe: /(match3|puzzle|dungeon)/i, name: 'puzzle game' },
  { re: /tower.?defen/i, demoRe: /tower/i, name: 'tower defence' },
  { re: /maze/i, demoRe: /maze/i, name: 'maze' },
  { re: /clicker|tycoon/i, demoRe: /clicker/i, name: 'clicker' },
  { re: /quiz/i, demoRe: /quiz/i, name: 'quiz' },
  { re: /catch/i, demoRe: /catch/i, name: 'catch game' },
  { re: /dodge/i, demoRe: /dodge/i, name: 'dodge game' },
  { re: /flappy/i, demoRe: /flappy/i, name: 'flappy game' },
  { re: /memory/i, demoRe: /memory/i, name: 'memory game' },
  { re: /dungeon/i, demoRe: /dungeon/i, name: 'dungeon game' },
  { re: /racing|rally/i, demoRe: /racing/i, name: 'racing game' },
  { re: /night[-_ ]?watch/i, demoRe: /night-watch/i, name: 'Night Watch' },
  { re: /obby/i, demoRe: /(obby|platformer)/i, name: 'obby' }
];

let demoIdCache = null;
function demoIds() {
  if (demoIdCache) return demoIdCache;
  try {
    demoIdCache = fs.readdirSync(path.join(ROOT, 'workshops', 'demos'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => f.replace(/\.html$/, ''));
  } catch { demoIdCache = []; }
  return demoIdCache;
}

function siblingDemo(e) {
  if (!/-workshop$/.test(e.id || '')) return null;
  const base = e.id.replace(/-workshop$/, '');
  const ids = demoIds();
  for (const cand of [base + '-canvas', base + '-game', base]) {
    if (ids.includes(cand)) {
      return { url: '/workshops/demos/' + cand + '.html', label: 'Play the finished build', kind: 'demo' };
    }
  }
  return null;
}

function crossEngineDemo(e) {
  if (e.type && e.type !== 'workshop') return null;
  if (/-(?:mod-)?studio$|-cheatsheet$|setup-check$|-run-sheet$/.test(e.id || '')) return null;
  const hay = [e.id, e.title, (e.tags || []).join(' ')].join(' ');
  const ids = demoIds();
  for (const p of PROJECT_DEMOS) {
    if (!p.re.test(hay)) continue;
    const hit = ids.find((id) => p.demoRe.test(id) && id !== e.id);
    if (!hit) continue;
    return { url: '/workshops/demos/' + hit + '.html', label: 'Play a finished ' + p.name + ' example', kind: 'demo', crossEngine: true };
  }
  return null;
}

function genreDemo(e) {
  if (e.type && e.type !== 'workshop') return null;
  if (/-(?:mod-)?studio$|-cheatsheet$|setup-check$|-run-sheet$/.test(e.id || '')) return null;
  const hay = [e.id, e.title, (e.tags || []).join(' ')].join(' ');
  for (const g of GAME_DEMOS) {
    if (!g.re.test(hay)) continue;
    if (!fs.existsSync(path.join(ROOT, g.url.replace(/^\//, '')))) continue;
    return { url: g.url, label: 'Play a finished example: ' + g.label, kind: 'game' };
  }
  return null;
}

// A2623/A3101: the best available "see it" target for this workshop.
// 1. A generated finished build from the canvas config (scripts/build-workshop-demos.js)
// 2. A real Scratch project
// 3. A canvas page that renders the learner's code
// 4. A finished arcade game in the same genre
function demoFor(e) {
  const generated = path.join(ROOT, 'workshops', 'demos', e.id + '.html');
  if (fs.existsSync(generated)) {
    return { url: '/workshops/demos/' + e.id + '.html', label: 'Play the finished build', kind: 'demo' };
  }
  let html = '';
  try { html = fs.readFileSync(path.join(ROOT, String(e.url).replace(/^\//, '')), 'utf8'); } catch { return siblingDemo(e) || crossEngineDemo(e) || genreDemo(e); }
  const scratch = html.match(/https:\/\/scratch\.mit\.edu\/projects\/\d+/);
  if (scratch) return { url: scratch[0], label: 'Play it on Scratch', kind: 'external' };
  if (/cw-canvas-panel|workshop-canvas-engine/.test(html)) {
    const selector = /id="ws-release-title"/.test(html) ? '#ws-release-title' : '.cw-canvas-panel';
    return { url: e.url, label: 'See the finished build', kind: 'self', selector };
  }
  return siblingDemo(e) || crossEngineDemo(e) || genreDemo(e);
}

function demoReasonFor(e) {
  if (/-(?:mod-)?studio$/.test(e.id || '')) return 'This is a tool, not a project. Open it in Do it here.';
  if (/cheatsheet|run-sheet|setup-check|-guide$/.test(e.id || '')) return 'Reference page: there is no finished project to play.';
  const engine = e.engine || '';
  if (['Minecraft', 'Terraria', 'Stardew Valley', 'OpenRCT2', 'MUGEN', 'Blender', 'TinkerCAD'].includes(engine)) {
    return 'This one is built in ' + engine + '. There is no browser build to play yet, but the browser studio is in Do it here.';
  }
  return 'No finished browser build for this one yet. Follow the steps in ' + (engine || 'the engine') + '.';
}

function browserFor(e, need) {
  if (need && need.needs === 'install') {
    const alt = need.alternative;
    if (alt && alt.url) {
      return { url: alt.url, title: alt.title || 'the browser studio', self: false };
    }
    return null;
  }
  return { url: e.url, title: 'this page', self: true };
}

function build() {
  const workshops = JSON.parse(fs.readFileSync(WORKSHOPS, 'utf8'));
  const needs = new Map(JSON.parse(fs.readFileSync(NEEDS, 'utf8')).map((n) => [n.id, n]));
  const outcomes = new Map(JSON.parse(fs.readFileSync(OUTCOMES, 'utf8')).map((o) => [o.id, o]));

  const kits = workshops.map((e) => {
    const need = needs.get(e.id) || null;
    const outcome = outcomes.get(e.id) || null;
    const browser = browserFor(e, need);
    const engine = (need && need.needs === 'install')
      ? { label: 'In ' + (e.engine || 'the engine'), url: e.url }
      : null;
    const demo = demoFor(e);
    return {
      id: e.id,
      title: e.title,
      engine: e.engine || '',
      needs: need ? need.needs : 'browser',
      browser,
      engineTrack: engine,
      cover: e.cover || null,
      demo,
      demoReason: demo ? null : demoReasonFor(e),
      remix: remixFor(e, outcome)
    };
  });

  return {
    generatedBy: 'scripts/build-workshop-kits.js',
    counts: {
      kits: kits.length,
      engineWithBrowser: kits.filter((k) => k.engineTrack && k.browser && !k.browser.self).length,
      browserNative: kits.filter((k) => k.browser && k.browser.self).length
    },
    kits
  };
}

function write() {
  const data = build();
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  return data;
}

function main() {
  const data = build();
  const json = JSON.stringify(data, null, 2) + '\n';
  let have = '';
  try { have = fs.readFileSync(OUT, 'utf8'); } catch {}
  if (CHECK) {
    if (have !== json) {
      console.log('  [FAIL] workshop kits drift: run node scripts/build-workshop-kits.js');
      process.exit(1);
    }
    console.log('  [PASS] workshop kits in sync (' + data.counts.kits + ' kits)');
    return;
  }
  if (have !== json) fs.writeFileSync(OUT, json);
  console.log((have === json ? '  [PASS] workshop kits already in sync' : '  [OK] wrote workshop kits') + ' (' + data.counts.kits + ' kits, ' + data.counts.engineWithBrowser + ' engine + browser, ' + data.counts.browserNative + ' browser-native)');
}

if (require.main === module) main();
module.exports = { build, write };


