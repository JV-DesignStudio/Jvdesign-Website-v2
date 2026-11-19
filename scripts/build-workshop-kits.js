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

// A2623: the best available "see it" target for this workshop.
// - A Scratch project link is a real playable demo.
// - A canvas build-along already contains the finished build; point at it.
// Returns null when there is nothing honest to show yet.
function demoFor(e) {
  let html = '';
  try { html = fs.readFileSync(path.join(ROOT, String(e.url).replace(/^\//, '')), 'utf8'); } catch { return null; }
  const scratch = html.match(/https:\/\/scratch\.mit\.edu\/projects\/\d+/);
  if (scratch) return { url: scratch[0], label: 'Play it on Scratch', kind: 'external' };
  if (/cw-canvas-panel|workshop-canvas-engine/.test(html)) {
    const selector = /id="ws-release-title"/.test(html) ? '#ws-release-title' : '.cw-canvas-panel';
    return { url: e.url, label: 'See the finished build', kind: 'self', selector };
  }
  return null;
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
    return {
      id: e.id,
      title: e.title,
      engine: e.engine || '',
      needs: need ? need.needs : 'browser',
      browser,
      engineTrack: engine,
      cover: e.cover || null,
      demo: demoFor(e),
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
