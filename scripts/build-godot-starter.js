#!/usr/bin/env node
/* A2962: build the Godot Lab starter ZIP from the readable project files.
   The lab serves starter.zip, but the files it holds also live in
   workshops/godot-lab/starter/ so they can be edited and reviewed. This keeps
   the two in sync. Output is deterministic (fixed file dates) so --check can
   prove the committed ZIP matches the source.

   Usage: node scripts/build-godot-starter.js
          node scripts/build-godot-starter.js --check
*/
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'workshops', 'godot-lab', 'starter');
const ZIP = path.join(ROOT, 'workshops', 'godot-lab', 'starter.zip');
const JSZip = require(path.join(ROOT, 'assets', 'vendor', 'jszip', 'jszip.min.js'));

const FILES = ['project.godot', 'main.tscn', 'player.gd', 'coin.gd', 'README.md'];
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

async function build() {
  const zip = new JSZip();
  for (const name of FILES) {
    const file = path.join(SRC, name);
    if (!fs.existsSync(file)) throw new Error('missing workshops/godot-lab/starter/' + name);
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
      console.error('  [FAIL] starter.zip missing; run node scripts/build-godot-starter.js');
      process.exit(1);
    }
    const current = fs.readFileSync(ZIP);
    const same = current.length === buf.length
      && crypto.createHash('sha256').update(current).digest('hex') === crypto.createHash('sha256').update(buf).digest('hex');
    if (!same) {
      console.error('  [FAIL] starter.zip is out of date; run node scripts/build-godot-starter.js');
      process.exit(1);
    }
    console.log('  [PASS] starter.zip matches workshops/godot-lab/starter/ (' + buf.length + ' bytes)');
    return;
  }
  fs.writeFileSync(ZIP, buf);
  console.log('  [OK] wrote workshops/godot-lab/starter.zip (' + buf.length + ' bytes, ' + FILES.length + ' files)');
})().catch((err) => { console.error(err.message); process.exit(1); });
