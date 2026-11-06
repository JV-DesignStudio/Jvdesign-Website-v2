'use strict';

// Builds content/courses.json from the "Up next in the series" blocks that
// already sit at the bottom of the workshop pages (WS-NEXT:START/END).
//
// The pages know their own order. This script reads that order, drops the
// hub and engine links, and writes one ordered course per series so the
// shared course nav can show "Step 3 of 8" with a real Back and Next link.
//
// Run: node scripts/build-course-map.js [--check]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WS_DIR = path.join(ROOT, 'workshops');
const OUT = path.join(ROOT, 'content', 'courses.json');
const CHECK = process.argv.includes('--check');

// Pages that point into a series but are not part of it. They stay as the
// course hub link instead of becoming step 1.
const ENTRY = new Set([
  'my-first-browser-game',
  'build-a-game-15-min',
  'blender-cheatsheet',
  'blender-workshop',
  'blender-world-workshop',
  'my-first-scratch-game',
  'tinkercad-cheatsheet',
  'python-studio',
  'python-mod-studio',
  'python-world-workshop',
  'stardew-mod-studio',
  'godot-world-workshop',
  'learning-lab',
  'minecraft-setup-check',
  'minecraft-mod-starter-files',
  'minecraft-mod-studio',
  'minecraft-world-workshop',
  'mugen-world-workshop',
  'openrct2-world-workshop',
  'stardew-world-workshop',
  'terraria-world-workshop',
  'my-first-minecraft-mod',
  'my-first-python-game',
  'my-first-roblox-studio-game',
  'my-first-unity-game',
  'my-first-unreal-game',
  'my-first-3d-prints-fidget-toy',
]);

// Human course names keyed by the first step.
const NAMES = {
  'js-flappy-workshop': 'My First Browser Game',
  'blender-cube-workshop': 'Blender and 3D Modelling',
  'defold-pong-workshop': 'My First Defold Game',
  'gdevelop-pong-workshop': 'My First GDevelop Game',
  'gml-pong-workshop': 'My First GameMaker Game',
  'godot-gdscript-essentials': 'Godot 4 Foundations',
  'java-rpg-part1-workshop': 'My First Java RPG',
  'minecraft-first-item-mod': 'My First Minecraft Mod',
  'minecraft-world-ep1-setup': 'Minecraft World Workshop',
  'mugen-world-ep1-setup': 'MUGEN World Workshop',
  'night-watch-workshop': 'Night Watch',
  'openrct2-world-ep1-setup': 'OpenRCT2 World Workshop',
  'pico8-pong-workshop': 'My First PICO-8 Game',
  'python-catch-workshop': 'Python Game Dev',
  'roblox-obby-workshop': 'My First Roblox Game',
  'roblox-sim-lockdown-1-workshop': 'Roblox Simulator Lockdown',
  'scratch-catch-workshop': 'My First Scratch Game',
  'stardew-world-ep1-setup': 'Stardew World Workshop',
  'terraria-world-ep1-setup': 'Terraria World Workshop',
  'tinkercad-ep1-spinner': 'My First 3D Prints',
  'unity-pong-workshop': 'My First Unity Game',
  'unreal-basics-workshop': 'My First Unreal Game',
  'cpp-platformer-workshop': 'C++ Platformer',
  'cpp-tower-part1-workshop': 'C++ Tower Defence',
};

const HUBS = {
  'js-flappy-workshop': 'my-first-browser-game',
  'blender-cube-workshop': 'blender-workshop',
  'defold-pong-workshop': 'engine-defold',
  'gdevelop-pong-workshop': 'engine-gdevelop',
  'gml-pong-workshop': 'engine-gml-gamemaker',
  'godot-gdscript-essentials': 'engine-godot',
  'java-rpg-part1-workshop': 'engine-java',
  'minecraft-first-item-mod': 'my-first-minecraft-mod',
  'minecraft-world-ep1-setup': 'minecraft-world-workshop',
  'mugen-world-ep1-setup': 'mugen-world-workshop',
  'night-watch-workshop': 'engine-javascript',
  'openrct2-world-ep1-setup': 'openrct2-world-workshop',
  'pico8-pong-workshop': 'engine-pico-8',
  'python-catch-workshop': 'my-first-python-game',
  'roblox-obby-workshop': 'my-first-roblox-studio-game',
  'roblox-sim-lockdown-1-workshop': 'engine-roblox',
  'scratch-catch-workshop': 'my-first-scratch-game',
  'stardew-world-ep1-setup': 'stardew-world-workshop',
  'terraria-world-ep1-setup': 'terraria-world-workshop',
  'tinkercad-ep1-spinner': 'my-first-3d-prints-fidget-toy',
  'unity-pong-workshop': 'my-first-unity-game',
  'unreal-basics-workshop': 'my-first-unreal-game',
  'cpp-platformer-workshop': 'engine-cpp',
  'cpp-tower-part1-workshop': 'engine-cpp',
};

function pageTitle(slug) {
  try {
    const html = fs.readFileSync(path.join(WS_DIR, slug + '.html'), 'utf8');
    const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || slug;
    return title
      .replace(/\s*\|\s*JVDesignStudio\s*$/i, '')
      .replace(/\s*-\s*JVDesignStudio\s*$/i, '')
      .trim();
  } catch (e) {
    return slug;
  }
}

function readEdges() {
  const files = fs.readdirSync(WS_DIR).filter((f) => f.endsWith('.html'));
  const edges = [];
  files.forEach((file) => {
    const html = fs.readFileSync(path.join(WS_DIR, file), 'utf8');
    const block = html.match(/<!-- WS-NEXT:START -->([\s\S]*?)<!-- WS-NEXT:END -->/);
    if (!block) return;
    const href = (block[1].match(/<a href="([^"]+)" class="next-route-inner"/) || [])[1];
    if (!href) return;
    const title = (block[1].match(/next-route-title">([^<]+)</) || [])[1] || '';
    edges.push({
      from: file.replace(/\.html$/i, ''),
      to: href.replace(/\.html$/i, '').replace(/^.*\//, ''),
      title: title.trim(),
    });
  });
  return edges;
}

function buildCourses() {
  const all = readEdges();
  const filtered = all.filter(
    (e) => !ENTRY.has(e.from) && !ENTRY.has(e.to) && !/^engine-/.test(e.to)
  );

  const byFrom = new Map();
  filtered.forEach((e) => {
    if (!byFrom.has(e.from)) byFrom.set(e.from, []);
    byFrom.get(e.from).push(e);
  });

  const incoming = new Map();
  filtered.forEach((e) => {
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to).push(e);
  });

  const starts = [...byFrom.keys()]
    .filter((from) => !incoming.has(from))
    .sort();

  const seen = new Set();
  const courses = [];
  starts.forEach((start) => {
    if (seen.has(start)) return;
    const steps = [];
    let current = start;
    const guard = new Set();
    while (current && !guard.has(current)) {
      guard.add(current);
      seen.add(current);
      const next = (byFrom.get(current) || [])[0];
      const prevEdge = (incoming.get(current) || [])[0];
      const entryEdge = all.filter((e) => e.to === current && ENTRY.has(e.from))[0];
      const stepTitle = (prevEdge && prevEdge.title) || (entryEdge && entryEdge.title) || pageTitle(current);
      steps.push({ slug: current, title: stepTitle });
      current = next ? next.to : null;
    }
    if (steps.length < 2) return;

    const hubSlug = HUBS[start] || null;
    const finalEdge = all.filter((e) => e.from === steps[steps.length - 1].slug)[0];
    courses.push({
      id: start,
      name: NAMES[start] || pageTitle(start),
      hub: hubSlug ? '/workshops/' + hubSlug + '.html' : '/workshop',
      steps: steps.map((s) => ({ slug: s.slug, title: s.title })),
      lastStepNext: finalEdge && !/^engine-/.test(finalEdge.to) ? finalEdge.to : null,
    });
  });

  return courses.sort((a, b) => a.name.localeCompare(b.name));
}

const courses = buildCourses();
const payload = {
  generatedBy: 'scripts/build-course-map.js',
  counts: { courses: courses.length, steps: courses.reduce((n, c) => n + c.steps.length, 0) },
  courses,
};
const text = JSON.stringify(payload, null, 2) + '\n';

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== text) {
    console.error('FAIL content/courses.json is out of date. Run node scripts/build-course-map.js');
    process.exit(1);
  }
  console.log(
    'PASS content/courses.json is up to date (' +
      payload.counts.courses +
      ' courses, ' +
      payload.counts.steps +
      ' steps)'
  );
} else {
  fs.writeFileSync(OUT, text);
  console.log(
    'Wrote content/courses.json (' +
      payload.counts.courses +
      ' courses, ' +
      payload.counts.steps +
      ' steps)'
  );
}
