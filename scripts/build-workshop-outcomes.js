#!/usr/bin/env node
/**
 * build-workshop-outcomes.js (A2028)
 *
 * Gives every published (indexable, catalogue-linked) workshop a concrete
 * outcome statement: what you build, what you learn, what you finish with and
 * how you extend it. The statement is derived from the page's own title,
 * hero copy and description so it always matches the lesson that ships.
 *
 * Output: content/workshop-outcomes.json
 * Apply:  node scripts/apply-workshop-outcomes.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOGUE = path.join(ROOT, 'content', 'workshops.json');
const OUT = path.join(ROOT, 'content', 'workshop-outcomes.json');

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, ' - ').replace(/&ndash;/g, ' - ')
  .replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"');

const strip = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' '))
  .replace(/\s+([,.;:!?])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

// Pages that are published in the catalogue but are not a single game build.
// Their outcome is still concrete, it just is not "a playable game".
const OVERRIDES = {
  'cyber-security': {
    finish: 'a clear plan for staying safe online',
    extend: 'checking one account or habit you use every day'
  },
  'learn': {
    finish: 'a shortlist of workshops that fit what you want to make',
    extend: 'starting the first workshop on your list today'
  },
  'my-achievements': {
    finish: 'a record of what you have finished and what to try next',
    extend: 'picking the next badge on your list'
  },
  'start-here': {
    finish: 'a first engine and a first workshop that fits you',
    extend: 'trying a second engine to compare how it feels'
  },
  'tiny-learners': {
    finish: 'a set of early counting, colour and shape games to play',
    extend: 'drawing your own character in the studio'
  },
  'learning-lab': {
    finish: 'a set of quick subject games you can play and learn from',
    extend: 'beating your best score in one of the games'
  },
  'world-builder-3d': {
    finish: 'a 3D level blockout you can export as an OBJ mesh',
    extend: 'blocking out a second room or route in your level'
  },
  'godot_templates': {
    finish: 'a starter project you can open and edit in Godot',
    extend: 'changing one scene or script to make it your own'
  },
  'godot_tutorial': {
    finish: 'a complete 2D platformer in Godot',
    extend: 'adding one enemy, level or power-up of your own'
  },
  'godot-gdscript-essentials': {
    finish: 'a working set of GDScript scripts you understand',
    extend: 'writing one small script without copying the example'
  },
  'build-a-game-15-min': {
    finish: 'a playable Dot Smash game you can show someone',
    extend: 'changing the speed, target or score rule'
  },
  'minecraft-mod-starter-files': {
    finish: 'the starter files for your own Minecraft mod',
    extend: 'changing one recipe or item in the starter pack'
  },
  'add-your-own-stage': {
    finish: 'your own MUGEN stage with a scrolling background',
    extend: 'changing the background, torch animation or stage music'
  }
};

function grab(html, re) {
  const m = html.match(re);
  return m ? strip(m[1]) : '';
}

function pagePath(url) {
  return path.join(ROOT, String(url || '').replace(/^\//, ''));
}

function isPublic(url) {
  const file = pagePath(url);
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) return null;
  return html;
}

function kindOf(id) {
  if (/cheatsheet/.test(id)) return 'cheatsheet';
  if (/-mod-studio$/.test(id)) return 'mod-studio';
  if (/-studio$/.test(id)) return 'studio';
  if (/^my-first-/.test(id)) return 'series';
  if (/world-workshop$/.test(id)) return 'series-hub';
  if (/-builder$/.test(id) || /blueprint|guide|project/.test(id)) return 'builder';
  if (/-canvas$/.test(id)) return 'canvas';
  return 'workshop';
}

function cleanTitle(title, id) {
  let t = decode(String(title || '').split('|')[0]).trim();
  t = t.replace(/^Free\s+/i, '');
  t = t.replace(/\s*\((?:My First|World Workshop|Episode)[^)]*\)\s*$/i, '').trim();
  if (!t) t = id.replace(/-/g, ' ');
  return t;
}

const EDITOR = {
  'C++': 'a C++ editor with SFML',
  'Python': 'Python with Pygame',
  'PICO-8': 'PICO-8',
  'GameMaker (GML)': 'GameMaker',
  'Blender': 'Blender',
  'Roblox': 'Roblox Studio',
  'MUGEN': 'MUGEN',
  'OpenRCT2': 'OpenRCT2'
};

function cleanLearn(text, kind) {
  let t = String(text || '').trim();
  if (kind === 'cheatsheet') {
    t = t.replace(/^Free printable\b[^.]*?\bcheat sheet\s*/i, '');
  }
  t = t.replace(/\s*(Free|No sign-up needed|No sign up needed)[^.]*\.\s*$/i, '').trim();
  t = t.replace(/\s*(Free (step-by-step |beginner )?tutorial\.?)\s*$/i, '').trim();
  return t;
}

function finishFor(entry, kind) {
  const id = entry.id;
  const engine = entry.engine || '';
  if (OVERRIDES[id] && OVERRIDES[id].finish) return OVERRIDES[id].finish;
  if (/setup|starter-files|starter/.test(id)) return 'a working setup you can build on';
  if (/debug|troubleshoot|fix-it|check/.test(id)) return 'a project that runs without errors';
  if (/design|share/.test(id)) return 'a finished project you can share';
  if (kind === 'cheatsheet') return 'a printable cheat sheet you can keep on your desk';
  if (kind === 'mod-studio' || kind === 'studio') return 'a real project file you can open in ' + (EDITOR[engine] || engine || 'your game engine');
  if (kind === 'series') {
    const ref = (id + ' ' + (entry.title || '')).toLowerCase();
    if (/3d print|tinkercad|fidget/.test(ref)) return 'a 3D model that is ready to print';
    if (/blender|3d model/.test(ref)) return 'a rendered 3D scene you can keep or share';
    return 'a finished game you can play and share';
  }
  if (kind === 'series-hub') {
    if (engine === 'Minecraft') return 'a working datapack or mod you can use in your world';
    if (engine === 'MUGEN') return 'a playable fighter or stage you can use in MUGEN';
    if (engine === 'OpenRCT2') return 'a working park plugin you can use in OpenRCT2';
    if (engine === 'Stardew Valley') return 'a working mod you can load in Stardew Valley';
    if (engine === 'Terraria') return 'a working world mod you can load in Terraria';
    if (engine === 'Blender') return 'a rendered 3D scene you can keep or share';
    return 'a finished game you can play and share';
  }
  if (kind === 'builder') return 'a playable game built from your own design choices';
  if (kind === 'canvas') return 'a working game running live in the browser';
  switch (engine) {
    case 'Blender': return 'a rendered 3D scene you can keep or share';
    case 'TinkerCAD': return 'a 3D model that is ready to print';
    case 'Minecraft': return 'a working mod or datapack you can use in your world';
    case 'Stardew Valley': return 'a working mod you can load in Stardew Valley';
    case 'Terraria': return 'a working world mod you can load in Terraria';
    case 'MUGEN': return 'a playable fighter or stage you can use in MUGEN';
    case 'OpenRCT2': return 'a working park plugin you can use in OpenRCT2';
    default: return 'a playable game you can show someone';
  }
}

function extendFor(id, kind, entry) {
  if (OVERRIDES[id] && OVERRIDES[id].extend) return OVERRIDES[id].extend;
  if (/setup|starter-files|starter/.test(id)) return 'using it as the starting point for your own project';
  if (/debug|troubleshoot|fix-it|check/.test(id)) return 'breaking it on purpose and fixing it again';
  if (kind === 'cheatsheet') return 'adding your own shortcuts or snippets for the parts you use most';
  if (kind === 'mod-studio' || kind === 'studio') return 'adding one feature of your own before you download';
  if (kind === 'series') {
    const ref = (id + ' ' + ((entry && entry.title) || '')).toLowerCase();
    if (/3d print|tinkercad|fidget/.test(ref)) return 'adding one more shape or detail to your print';
    if (/blender|3d model/.test(ref)) return 'changing one shape, material or light in your scene';
    return 'adding one feature of your own to the finished game';
  }
  if (kind === 'series-hub') return 'building your own version after the last episode';
  if (kind === 'builder') return 'changing one rule, level or value and testing what happens';
  if (kind === 'canvas') return 'adding one feature to the code and testing it';
  return 'adding one feature or level of your own';
}

function build() {
  const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
  const entries = [];
  const skipped = [];

  for (const entry of catalogue) {
    const html = isPublic(entry.url);
    if (html === null) { skipped.push(entry.id); continue; }

    const id = entry.id;
    const kind = kindOf(id);
    const title = cleanTitle(entry.title, id);
    const hero = grab(html, /<p[^>]*class=["'][^"']*hero-sub[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
      || grab(html, /<p[^>]*class=["'][^"']*\blead\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const desc = entry.desc || '';
    const learn = cleanLearn(hero || desc, kind);

    entries.push({
      id,
      url: entry.url,
      kind,
      project: title,
      learn,
      finish: finishFor(entry, kind),
      extend: extendFor(id, kind, entry)
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(OUT, JSON.stringify(entries, null, 2) + '\n');
  console.log(`workshop-outcomes.json: ${entries.length} published workshops (${skipped.length} noindex/skipped)`);
  const missing = entries.filter((e) => !e.project || !e.learn || !e.finish || !e.extend);
  if (missing.length) {
    console.log('Outcomes with an empty field:', missing.map((e) => e.id).join(', '));
  }
  return entries;
}

if (require.main === module) build();
module.exports = { build };
