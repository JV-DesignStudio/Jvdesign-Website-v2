#!/usr/bin/env node
/* A3070: build the Godot Lab project library from the real template and
   workshop ZIPs. The site already ships those ZIPs, but some of them have a
   single top-level folder and some use Windows backslashes, which the browser
   editor does not open cleanly. This script normalises every project so
   project.godot is at the ZIP root, then writes the manifest the Lab picker
   reads.

   Usage: node scripts/build-godot-lab-projects.js
          node scripts/build-godot-lab-projects.js --check
*/
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require(path.join(__dirname, '..', 'assets', 'vendor', 'jszip', 'jszip.min.js'));

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'workshops', 'godot-lab', 'projects');
const MANIFEST = path.join(ROOT, 'workshops', 'godot-lab', 'projects.json');
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');
const SKIP = /(^|\/)(\.godot|\.import|node_modules|__MACOSX)(\/|$)|\.(tmp|DS_Store)$/i;

const SOURCES = [
  // Starters
  { id: 'starter', title: 'First Video Game starter', group: 'starters', level: '2D', download: 'my-first-godot-project.zip', folder: 'workshops/godot-lab/starter', workshop: '/workshops/godot-mod-studio.html', note: 'Player, ground and a coin. The smallest real Godot project.' },
  { id: 'godot-tutorial', title: 'Star Collector', group: 'workshops', level: '2D', download: 'star-collector-godot.zip', folder: 'workshops/godot-lab/godot-tutorial', workshop: '/workshops/godot-tutorial-canvas.html', note: 'The finished first-scene game from the Godot Basics lesson.' },

  // Templates
  { id: 'platformer', title: '2D Platformer', group: 'templates', level: '2D', download: '2d-platformer.zip', zip: 'platformer.zip', workshop: '/workshops/godot_tutorial.html', note: 'CharacterBody2D movement, TileMaps, enemies and levels.' },
  { id: 'asteroids', title: 'Asteroids', group: 'templates', level: '2D', download: 'asteroids.zip', zip: 'asteroids.zip', workshop: '/workshops/godot_templates.html', note: 'RigidBody2D physics, rotation-based movement and screen wrapping.' },
  { id: 'space-invaders', title: 'Space Invaders', group: 'templates', level: '2D', download: 'space-invaders.zip', zip: 'space_invaders.zip', workshop: '/workshops/godot_templates.html', note: 'Enemy formations, shooting, shields and waves.' },
  { id: 'tower-defence', title: 'Tower Defence', group: 'templates', level: '2D', download: 'tower-defence.zip', zip: 'tower_defence.zip', workshop: '/workshops/godot_templates.html', note: 'Path-following enemies, tower placement and waves.' },
  { id: 'zoom-zoom', title: 'Zoom Zoom Racing', group: 'templates', level: '2D', download: 'zoom-zoom-racing.zip', zip: 'zoom-zoom-racing.zip', workshop: '/workshops/godot-racing-workshop.html', note: 'Top-down racing with a lap timer and a finish line.' },
  { id: 'jump-jump', title: 'Jump Jump Platformer', group: 'templates', level: '2D', download: 'jump-jump-platformer.zip', zip: 'jump-jump-platformer.zip', workshop: '/workshops/my-first-video-game.html', note: 'Gravity, jumping, a stompable enemy and a goal flag.' },
  { id: 'bang-bang', title: 'Bang Bang Shooter', group: 'templates', level: '2D', download: 'bang-bang-shooter.zip', zip: 'bang-bang-shooter.zip', workshop: '/workshops/my-first-video-game.html', note: 'Top-down movement, mouse aiming and bullets.' },
  { id: 'fairy-survivors', title: 'Fairy Survivors', group: 'templates', level: '2D', download: 'fairy-survivors.zip', zip: 'fairy-survivors.zip', workshop: '/workshops/my-first-video-game.html', note: 'Automatic attacks and wave survival.' },
  { id: 'barrel-blast', title: 'Barrel Blast', group: 'templates', level: '2D', download: 'barrel-blast.zip', zip: 'barrel-blast.zip', workshop: '/workshops/my-first-video-game.html', note: 'Platforms, rolling barrels and a boss timer.' },
  { id: 'pixel-quest', title: 'Pixel Quest', group: 'templates', level: '2D', download: 'pixel-quest.zip', zip: 'pixel-quest.zip', workshop: '/workshops/my-first-video-game.html', note: 'Top-down dungeon, a sword, enemies, a key and a locked door.' },

  // Workshops
  { id: 'gdscript-essentials', title: 'GDScript Essentials', group: 'workshops', level: 'Code', download: 'gdscript-essentials-starter.zip', zip: 'gdscript-essentials-starter.zip', workshop: '/workshops/godot-gdscript-essentials.html', note: 'The script starter for variables, functions, loops and signals.' },
  { id: 'low-poly-rally', title: 'Low-Poly Rally', group: 'workshops', level: '3D', download: 'low-poly-rally-starter.zip', zip: 'low-poly-rally-starter.zip', workshop: '/workshops/godot-rally-workshop.html', note: 'A 3D rally stage with a car and a finished scene.' },
  { id: 'night-watch', title: 'Night Watch', group: 'workshops', level: '2D', download: 'night-watch.zip', zip: 'night-watch.zip', workshop: '/workshops/night-watch-workshop.html', note: 'A small 2D room with a character and a script.' },
  { id: 'gatekeeper-1', title: 'Who Goes There? Part 1', group: 'workshops', level: '3D', download: 'who-goes-there-part1.zip', folder: 'workshops/godot-lab/projects-src/gatekeeper', workshop: '/workshops/godot-gatekeeper-3d-part1.html', note: 'A 3D checkpoint room: player, gate, guard and a rule.' },
  { id: 'gatekeeper-2', title: 'Who Goes There? Part 2', group: 'workshops', level: '3D', download: 'who-goes-there-part2.zip', folder: 'workshops/godot-lab/projects-src/gatekeeper', workshop: '/workshops/godot-gatekeeper-3d-part2.html', note: 'The same 3D room for the 10-day challenge.' }
];

function readFolder(folder) {
  const base = path.join(ROOT, folder);
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(base, abs).split(path.sep).join('/');
      if (SKIP.test(rel)) continue;
      if (entry.isDirectory()) walk(abs);
      else out.push({ name: rel, data: fs.readFileSync(abs) });
    }
  })(base);
  return out;
}

async function readZip(zipPath) {
  const full = path.join(ROOT, zipPath);
  const zip = await JSZip.loadAsync(fs.readFileSync(full));
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const normal = names.map((n) => ({ raw: n, name: n.replace(/\\/g, '/') }));
  const project = normal.find((n) => n.name === 'project.godot' || n.name.endsWith('/project.godot'));
  if (!project) throw new Error(zipPath + ': no project.godot');
  const prefix = project.name.slice(0, project.name.length - 'project.godot'.length);
  const out = [];
  for (const entry of normal) {
    if (!entry.name.startsWith(prefix)) continue;
    const rel = entry.name.slice(prefix.length);
    if (!rel || SKIP.test(rel)) continue;
    out.push({ name: rel, data: Buffer.from(await zip.file(entry.raw).async('uint8array')) });
  }
  return out;
}

function mainScene(files) {
  const project = files.find((f) => f.name === 'project.godot');
  if (!project) return '';
  const text = project.data.toString('utf8');
  const m = text.match(/run\/main_scene="res:\/\/([^"]+)"/);
  return m ? m[1] : '';
}

/* A deterministic ZIP writer. JSZip adds a shifting DOS timestamp to the local
   headers, so two builds of the same project produced different bytes and the
   --check could never pass. This writer stores the files with a fixed 1980 time
   and no compression, which every unzip tool and the Godot web editor accepts. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function u16(v) { return Buffer.from([v & 0xFF, (v >> 8) & 0xFF]); }
function u32(v) { return Buffer.from([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]); }
function makeZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const file of files.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.from(file.data);
    const crc = crc32(data);
    const lh = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)
    ]);
    local.push(lh, name, data);
    const cd = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x01, 0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0),
      u16(0), u32(0), u32(offset)
    ]);
    central.push(cd, name);
    offset += lh.length + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x05, 0x06]), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralSize), u32(offset), u16(0)
  ]);
  return Buffer.concat([...local, ...central, eocd]);
}

async function buildProject(src) {
  const files = src.folder ? readFolder(src.folder) : await readZip(src.zip);
  if (!files.some((f) => f.name === 'project.godot')) throw new Error(src.id + ': project.godot is not at the ZIP root after normalising');
  const scene = mainScene(files);
  if (scene && !files.some((f) => f.name === scene)) throw new Error(src.id + ': main scene ' + scene + ' is missing');
  const buf = makeZip(files);
  if (buf.slice(0, 4).toString('hex') !== '504b0304') throw new Error(src.id + ': did not produce a zip');
  return { buf, scene, files: files.length };
}

function manifestJson(projects) {
  return JSON.stringify({ projects }, null, 2) + '\n';
}

(async () => {
  const check = process.argv.includes('--check');
  const projects = [];
  const built = [];
  for (const src of SOURCES) {
    const result = await buildProject(src);
    built.push({ src, result });
    projects.push({
      id: src.id,
      title: src.title,
      group: src.group,
      level: src.level,
      zip: 'projects/' + src.id + '.zip',
      download: src.download,
      scene: result.scene,
      workshop: src.workshop,
      note: src.note
    });
  }
  const want = manifestJson(projects);
  const problems = [];
  for (const { src, result } of built) {
    const out = path.join(OUT_DIR, src.id + '.zip');
    if (check) {
      if (!fs.existsSync(out)) problems.push(src.id + '.zip is missing');
      else {
        const have = fs.readFileSync(out);
        const same = have.length === result.buf.length
          && crypto.createHash('sha256').update(have).digest('hex') === crypto.createHash('sha256').update(result.buf).digest('hex');
        if (!same) problems.push(src.id + '.zip is out of date');
      }
    } else {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(out, result.buf);
    }
  }
  if (check) {
    if (!fs.existsSync(MANIFEST)) problems.push('projects.json is missing');
    else if (fs.readFileSync(MANIFEST, 'utf8') !== want) problems.push('projects.json is out of date');
  } else {
    fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
    fs.writeFileSync(MANIFEST, want);
  }
  if (problems.length) {
    console.error('  [FAIL] Godot Lab projects: ' + problems.join(', '));
    console.error('         run node scripts/build-godot-lab-projects.js');
    process.exit(1);
  }
  if (check) console.log('  [PASS] Godot Lab projects: ' + projects.length + ' projects, ZIPs and projects.json match the sources');
  else console.log('  [OK] wrote ' + projects.length + ' Godot Lab projects and workshops/godot-lab/projects.json');
})().catch((err) => { console.error(err.message); process.exit(1); });
