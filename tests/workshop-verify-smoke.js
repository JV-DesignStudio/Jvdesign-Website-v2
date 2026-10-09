#!/usr/bin/env node
// Workshop Verify smoke (A833-A934): the "Verify:" cards ask a human to open an
// engine (Blender, Godot, Defold, C++, Unity, etc.) and follow a lesson. An agent
// cannot run those engines, but it can prove the lesson page itself is sound, so
// the human only has to check the engine steps. This checks every workshop named
// by a Verify card: the page exists, has a title + viewport, real step content,
// a starter/download link, and names its engine.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'workshops/add-your-own-stage.html','workshops/barrel-blast-workshop.html','workshops/blender-animation-workshop.html','workshops/blender-character-workshop.html','workshops/blender-cube-workshop.html','workshops/blender-lighting-workshop.html','workshops/blender-materials-workshop.html','workshops/blender-rigging-workshop.html','workshops/blender-scene-workshop.html','workshops/blender-workshop.html','workshops/cpp-breakout-workshop.html','workshops/cpp-platformer-part2-workshop.html','workshops/cpp-platformer-workshop.html','workshops/cpp-pong-workshop.html','workshops/cpp-snake-workshop.html','workshops/cpp-tower-part1-workshop.html','workshops/cpp-tower-part2-workshop.html','workshops/defold-dungeon-workshop.html','workshops/defold-platformer-workshop.html','workshops/defold-pong-workshop.html','workshops/defold-puzzle-workshop.html','workshops/defold-shooter-workshop.html','workshops/defold-snake-workshop.html','workshops/gdevelop-adventure-workshop.html','workshops/gdevelop-platformer-workshop.html','workshops/gdevelop-pointclick-workshop.html','workshops/gdevelop-pong-workshop.html','workshops/gdevelop-shooter-workshop.html','workshops/gdevelop-snake-workshop.html','workshops/gml-breakout-workshop.html','workshops/gml-platformer-workshop.html','workshops/gml-pong-workshop.html','workshops/gml-rpg-workshop.html','workshops/godot-gdscript-essentials.html','workshops/godot-racing-workshop-2.html','workshops/godot-racing-workshop.html','workshops/godot_tutorial.html','workshops/java-breakout-workshop.html','workshops/java-rpg-part2-workshop.html','workshops/java-rpg-part3-workshop.html','workshops/java-space-workshop.html','workshops/jump-jump-mario-workshop.html','workshops/minecraft-custom-block-mod.html','workshops/minecraft-custom-food-mod.html','workshops/minecraft-custom-mob-mod.html','workshops/minecraft-custom-tool-mod.html','workshops/minecraft-first-item-mod.html','workshops/minecraft-lucky-mod.html','workshops/mugen-ai-workshop.html','workshops/mugen-basics-workshop.html','workshops/mugen-game-setup-workshop.html','workshops/mugen-workshop.html','workshops/night-watch-part2-workshop.html','workshops/night-watch-part3-workshop.html','workshops/night-watch-workshop.html','workshops/openrct2-modding-builder.html','workshops/pico8-dungeon-workshop.html','workshops/pico8-match3-workshop.html','workshops/pico8-platformer-workshop.html','workshops/pico8-pong-workshop.html','workshops/pico8-shooter-workshop.html','workshops/pico8-snake-workshop.html','workshops/pixel-quest-workshop.html','workshops/python-breakout-part2-workshop.html','workshops/python-breakout-workshop.html','workshops/python-catch-workshop.html','workshops/python-dodge-workshop.html','workshops/python-maze-workshop.html','workshops/python-platformer-part2-workshop.html','workshops/python-platformer-workshop.html','workshops/roblox-adventure-workshop.html','workshops/roblox-battle-workshop.html','workshops/roblox-collapse-obby-workshop.html','workshops/roblox-corruption-obby-workshop.html','workshops/roblox-creator-journey.html','workshops/roblox-horror-workshop.html','workshops/roblox-obby-workshop.html','workshops/roblox-pirate-workshop.html','workshops/roblox-simulator-workshop.html','workshops/roblox-tycoon-workshop.html','workshops/scratch-catch-workshop.html','workshops/scratch-clicker-workshop.html','workshops/scratch-maze-workshop.html','workshops/scratch-platformer-workshop.html','workshops/scratch-quiz-workshop.html','workshops/scratch-story-workshop.html','workshops/tinkercad-ep1-spinner.html','workshops/tinkercad-ep2-popit.html','workshops/tinkercad-ep3-blocks.html','workshops/tinkercad-ep4-pattern.html','workshops/tinkercad-ep5-phonestand.html','workshops/tinkercad-ep6-marblerun.html','workshops/tinkercad-ep7-keychain.html','workshops/tinkercad-ep8-shapes.html','workshops/unity-action-rpg-workshop.html','workshops/unity-breakout-workshop.html','workshops/unity-multiplayer-workshop.html','workshops/unity-pong-workshop.html','workshops/unity-ui-workshop.html','workshops/unreal-advanced-workshop.html','workshops/unreal-basics-workshop.html','workshops/unreal-multiplayer-workshop.html'
];

let failures = 0;
const fails = [];
const check = (file, name, cond) => { if (!cond) { failures++; fails.push(file + ': ' + name); } };

const STEP_RE = /Step\s*\d|class="[a-z-]*step|step-title|section-title|data-step|step-num/gi;
const ENGINE_RE = /godot|unity|unreal|blender|defold|gamemaker|gdevelop|pico-?8|c\+\+|sfml|\bjava\b|python|roblox|minecraft|scratch|tinkercad|mugen|openrct2/i;

for (const file of FILES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { check(file, 'page exists', false); continue; }
  const html = fs.readFileSync(full, 'utf8');
  check(file, 'has a <title>', /<title>[^<]{3,}<\/title>/i.test(html));
  check(file, 'has a viewport meta', /name=["']viewport["']/i.test(html));
  const steps = (html.match(STEP_RE) || []).length;
  check(file, 'has real step content (>=3 markers, found ' + steps + ')', steps >= 3);
  check(file, 'links a starter/download or the engine', /\/downloads\//i.test(html) || /href="[^"]*tools\//i.test(html));
  check(file, 'names its engine', ENGINE_RE.test(html));
}

console.log(`Workshop verify smoke: ${FILES.length} lesson pages checked`);
if (fails.length) { fails.slice(0, 25).forEach((f) => console.log('  [FAIL] ' + f)); if (fails.length > 25) console.log(`  ...and ${fails.length - 25} more`); }
console.log(failures === 0 ? 'ALL WORKSHOP VERIFY SMOKE CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
