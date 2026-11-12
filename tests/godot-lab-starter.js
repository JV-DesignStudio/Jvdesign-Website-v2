/* A2962: the Godot Lab starter must show something when a learner presses F5.
   The old starter had bodies and scripts but no visible shapes, so the real
   editor opened a grey screen. This checks the readable project files and that
   starter.zip matches them, without booting the 92 MB engine. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STARTER = path.join(ROOT, 'workshops', 'godot-lab', 'starter');
const ZIP = path.join(ROOT, 'workshops', 'godot-lab', 'starter.zip');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
function read(name) {
  return fs.readFileSync(path.join(STARTER, name), 'utf8');
}

const tscn = read('main.tscn');
check('player node is a CharacterBody2D', /\[node name="Player" type="CharacterBody2D"/.test(tscn));
check('player has a visible shape', /\[node name="Body" type="Polygon2D" parent="Player"\]/.test(tscn));
check('player script is attached', /script = ExtResource\("1_player"\)/.test(tscn));
check('coin node is an Area2D', /\[node name="Coin" type="Area2D"/.test(tscn));
check('coin has a visible shape', /\[node name="Visual" type="Polygon2D" parent="Coin"\]/.test(tscn));
check('coin script is attached', /script = ExtResource\("2_coin"\)/.test(tscn));
check('ground has a visible shape', /\[node name="Visual" type="Polygon2D" parent="Ground"\]/.test(tscn));
check('scene has a background fill', /\[node name="Background" type="Polygon2D"/.test(tscn));
check('scene tells the learner the controls', /Arrow keys to move/.test(tscn));

const player = read('player.gd');
check('player moves with the arrow keys', /ui_left/.test(player) && /ui_right/.test(player) && /move_and_slide/.test(player));
const coin = read('coin.gd');
check('coin frees itself when touched', /queue_free\(\)/.test(coin) && /body_entered/.test(coin));

const project = read('project.godot');
check('project opens the main scene', /run\/main_scene="res:\/\/main\.tscn"/.test(project));
check('project uses the compatibility renderer', /gl_compatibility/.test(project));

const zip = fs.readFileSync(ZIP);
check('starter.zip has the PKZIP signature', zip.slice(0, 4).toString('hex') === '504b0304', zip.slice(0, 4).toString('hex'));
check('starter.zip is not empty', zip.length > 800, zip.length + ' bytes');

const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-godot-starter.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
check('starter.zip matches the readable source', built.status === 0, (built.stdout || built.stderr || '').trim().split('\n').pop());

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
