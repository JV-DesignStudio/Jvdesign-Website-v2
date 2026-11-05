#!/usr/bin/env node
// tests/low-poly-rally-starter.js
// Checks that the rally workshop ships a real, self-contained Godot starter
// project and that the page links to it. The zip is read over HTTP and the
// important files are inflated, so a missing file, a broken link, an empty
// archive or a scene that lost its VehicleBody3D fails the gate.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'workshops/godot-rally-workshop.html';
const ZIP = '/low-poly-rally-starter.zip';
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.zip': 'application/zip', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain'
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('no end of central directory');
  const count = buf.readUInt16LE(eocd + 10);
  const start = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  let p = start;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, entry) {
  const p = entry.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('bad local header');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const dataStart = p + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) return data.toString('utf8');
  if (entry.method === 8) return zlib.inflateRawSync(data).toString('utf8');
  throw new Error('unsupported compression method ' + entry.method);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('missing ' + url);
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  const links = [...html.matchAll(/<a[^>]*href="\.\.\/low-poly-rally-starter\.zip"[^>]*>/g)].map((m) => m[0]);
  check('page links to the starter zip at least three times', links.length >= 3, 'links ' + links.length);
  check('every starter zip link carries the download attribute', links.every((l) => /\bdownload\b/.test(l)));

  const res = await fetch(base + ZIP);
  check('starter zip returns 200', res.status === 200, 'status ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  check('starter zip is a real zip', buf.length > 5000 && buf[0] === 0x50 && buf[1] === 0x4b, 'bytes ' + buf.length);

  const entries = readZip(buf);
  const required = [
    'LowPolyRally/project.godot',
    'LowPolyRally/README.txt',
    'LowPolyRally/icon.svg',
    'LowPolyRally/scenes/rally_stage.tscn',
    'LowPolyRally/scenes/car.tscn',
    'LowPolyRally/scenes/camera_rig.tscn',
    'LowPolyRally/scripts/car.gd',
    'LowPolyRally/scripts/camera_rig.gd',
    'LowPolyRally/scripts/stage_timer.gd',
    'LowPolyRally/scripts/hud.gd'
  ];
  for (const name of required) check('zip contains ' + name, entries.has(name));

  if (entries.has('LowPolyRally/project.godot')) {
    const s = readEntry(buf, entries.get('LowPolyRally/project.godot'));
    check('project.godot opens the rally stage', s.includes('run/main_scene="res://scenes/rally_stage.tscn"'));
    check('project.godot maps the eight rally actions', ['accelerate', 'brake', 'steer_left', 'steer_right', 'handbrake', 'reset', 'camera_next', 'camera_prev'].every((a) => s.includes(a + '={')));
  }
  if (entries.has('LowPolyRally/scenes/car.tscn')) {
    const s = readEntry(buf, entries.get('LowPolyRally/scenes/car.tscn'));
    check('car scene is a VehicleBody3D with four wheels', s.includes('type="VehicleBody3D"') && (s.match(/type="VehicleWheel3D"/g) || []).length === 4);
  }
  if (entries.has('LowPolyRally/scenes/rally_stage.tscn')) {
    const s = readEntry(buf, entries.get('LowPolyRally/scenes/rally_stage.tscn'));
    check('stage marks an A start and a B finish', s.includes('text = "START  A"') && s.includes('text = "FINISH  B"'));
    check('stage has a countdown and a result label', s.includes('name="CountdownLabel"') && s.includes('name="ResultLabel"'));
    check('stage keeps three sector gates', (s.match(/name="Sector[123]"/g) || []).length === 3);
  }
  if (entries.has('LowPolyRally/scenes/camera_rig.tscn')) {
    const s = readEntry(buf, entries.get('LowPolyRally/scenes/camera_rig.tscn'));
    check('camera scene has a SpringArm3D and Camera3D', s.includes('type="SpringArm3D"') && s.includes('type="Camera3D"'));
  }
  if (entries.has('LowPolyRally/scripts/camera_rig.gd')) {
    const s = readEntry(buf, entries.get('LowPolyRally/scripts/camera_rig.gd'));
    check('camera script has chase, bonnet and cockpit views', /enum View \{ CHASE, BONNET, COCKPIT \}/.test(s));
    check('camera script exposes add_trauma', s.includes('func add_trauma'));
  }
  if (entries.has('LowPolyRally/scripts/car.gd')) {
    const s = readEntry(buf, entries.get('LowPolyRally/scripts/car.gd'));
    check('car script reads the rally actions', ['accelerate', 'brake', 'handbrake', 'steer_right'].every((a) => s.includes(a)));
    check('car script freezes on the start line', s.includes('var frozen := true') && s.includes('if frozen:'));
  }
  if (entries.has('LowPolyRally/scripts/stage_timer.gd')) {
    const s = readEntry(buf, entries.get('LowPolyRally/scripts/stage_timer.gd'));
    check('timer script emits splits and a finish', s.includes('signal split_taken') && s.includes('signal stage_finished'));
    check('timer script runs a countdown before the clock', s.includes('signal countdown_updated') && s.includes('State.COUNTDOWN'));
    check('timer script saves a best time', s.includes('BEST_PATH') && s.includes('func save_best'));
    check('timer script restarts from A', s.includes('func restart_race') && s.includes('car.reset_to_start()'));
  }
  if (entries.has('LowPolyRally/scripts/hud.gd')) {
    const s = readEntry(buf, entries.get('LowPolyRally/scripts/hud.gd'));
    check('HUD shows the countdown and a new best', s.includes('_on_countdown') && s.includes('NEW BEST!'));
  }
  if (entries.has('LowPolyRally/README.txt')) {
    const s = readEntry(buf, entries.get('LowPolyRally/README.txt'));
    check('README tells the learner to press F5', s.includes('Press F5'));
    check('README explains the A-to-B sprint and best time', s.includes('A-to-B rally sprint') && /best time/i.test(s));
  }

  server.close();
  if (failures) {
    console.log('\n' + failures + ' FAILURE(S)');
    process.exit(1);
  }
  console.log('\nPASS low-poly-rally-starter: real zip, full Godot project, page links');
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
