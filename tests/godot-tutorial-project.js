/* A3070: the finished Star Collector project must be a real, openable Godot
   project, not a screenshot or a browser-only build. This checks the readable
   files and that godot-tutorial.zip matches them. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'workshops', 'godot-lab', 'godot-tutorial');
const ZIP = path.join(ROOT, 'workshops', 'godot-lab', 'godot-tutorial.zip');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
function read(name) {
  return fs.readFileSync(path.join(SRC, name), 'utf8');
}

const project = read('project.godot');
check('project opens the main scene', /run\/main_scene="res:\/\/main\.tscn"/.test(project));
check('project is 400 by 400', /viewport_width=400/.test(project) && /viewport_height=400/.test(project));
check('project uses the compatibility renderer', /gl_compatibility/.test(project));

const scene = read('main.tscn');
check('scene has a Player body', /\[node name="Player" type="CharacterBody2D" parent="\."\]/.test(scene));
check('player has a visible arrow', /\[node name="Body" type="Polygon2D" parent="Player"\]/.test(scene));
check('player has a motion trail', /\[node name="Trail" type="Line2D" parent="Player"\]/.test(scene));
check('scene has a Coins group', /\[node name="Coins" type="Node2D" parent="\."\]/.test(scene));
const coinNodes = (scene.match(/\[node name="Coin\d" type="Area2D" parent="Coins"\]/g) || []).length;
check('scene has eight coins', coinNodes === 8, 'coins ' + coinNodes);
check('coins use the coin script', /script = ExtResource\("2_coin"\)/.test(scene));
check('scene has a HUD score label', /\[node name="Score" type="Label" parent="UI"\]/.test(scene));
check('scene has a win label', /\[node name="Win" type="Label" parent="UI"\]/.test(scene));
check('scene tells the learner the controls', /Arrow keys to move/.test(scene));

const player = read('player.gd');
check('player reads the arrow keys', /Input\.get_vector/.test(player) && /ui_left/.test(player) && /ui_right/.test(player));
check('player moves with collisions', /move_and_slide\(\)/.test(player));
check('player rotates to face movement', /rotation = direction\.angle\(\)/.test(player));
check('player keeps a trail', /trail_points/.test(player) && /trail\.points/.test(player));
check('player scores a coin', /func add_coin/.test(player) && /score \+= 1/.test(player));
check('player shows the win label', /win_label\.visible = true/.test(player));

const coin = read('coin.gd');
check('coin connects body_entered', /body_entered\.connect/.test(coin));
check('coin calls add_coin', /add_coin\(\)/.test(coin));
check('coin removes itself', /queue_free\(\)/.test(coin));

const zip = fs.readFileSync(ZIP);
check('godot-tutorial.zip has the PKZIP signature', zip.slice(0, 4).toString('hex') === '504b0304', zip.slice(0, 4).toString('hex'));
check('godot-tutorial.zip is not empty', zip.length > 800, zip.length + ' bytes');

const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-godot-tutorial.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
check('godot-tutorial.zip matches the readable source', built.status === 0, (built.stdout || built.stderr || '').trim().split('\n').pop());

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
