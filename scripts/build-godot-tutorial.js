#!/usr/bin/env node
/* A3070: build the Star Collector ZIP from the readable Godot project files.
   The Godot Basics lesson offers the same scene as a real Godot project, and the
   Godot Lab can load it with ?project=godot-tutorial. The readable files live in
   workshops/godot-lab/godot-tutorial/ so they can be reviewed and edited. The
   output is deterministic (fixed file dates) so --check can prove the committed
   ZIP matches the source.

   Usage: node scripts/build-godot-tutorial.js
          node scripts/build-godot-tutorial.js --check
*/
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'workshops', 'godot-lab', 'godot-tutorial');
const ZIP = path.join(ROOT, 'workshops', 'godot-lab', 'godot-tutorial.zip');
const JSZip = require(path.join(ROOT, 'assets', 'vendor', 'jszip', 'jszip.min.js'));

const FILES = ['project.godot', 'main.tscn', 'player.gd', 'coin.gd', 'README.md'];
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

async function build() {
  const zip = new JSZip();
  for (const name of FILES) {
    const file = path.join(SRC, name);
    if (!fs.existsSync(file)) throw new Error('missing workshops/godot-lab/godot-tutorial/' + name);
    zip.file(name, fs.readFileSync(file), { date: FIXED_DATE, unixPermissions: 0o644 });
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
    streamFiles: false
  });
}

(async () => {
  const check = process.argv.includes('--check');
  const buf = await build();
  if (buf.slice(0, 4).toString('hex') !== '504b0304') throw new Error('JSZip did not produce a zip');
  if (check) {
    if (!fs.existsSync(ZIP)) {
      console.error('  [FAIL] godot-tutorial.zip missing; run node scripts/build-godot-tutorial.js');
      process.exit(1);
    }
    const current = fs.readFileSync(ZIP);
    const same = current.length === buf.length
      && crypto.createHash('sha256').update(current).digest('hex') === crypto.createHash('sha256').update(buf).digest('hex');
    if (!same) {
      console.error('  [FAIL] godot-tutorial.zip is out of date; run node scripts/build-godot-tutorial.js');
      process.exit(1);
    }
    console.log('  [PASS] godot-tutorial.zip matches workshops/godot-lab/godot-tutorial/ (' + buf.length + ' bytes)');
    return;
  }
  fs.writeFileSync(ZIP, buf);
  console.log('  [OK] wrote workshops/godot-lab/godot-tutorial.zip (' + buf.length + ' bytes, ' + FILES.length + ' files)');
})().catch((err) => { console.error(err.message); process.exit(1); });
