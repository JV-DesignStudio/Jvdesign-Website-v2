#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
function check(ok, label, detail) {
  if (ok) {
    console.log('PASS ' + label + (detail ? ' - ' + detail : ''));
  } else {
    failed++;
    console.log('FAIL ' + label + (detail ? ' - ' + detail : ''));
  }
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const page = read('pages/dev-tools.html');

const stepLimits = (page.match(/class="intent-limit"/g) || []).length;
const cardLimits = (page.match(/class="tool-limits"/g) || []).length;
check(stepLimits === 9, 'nine path steps state an asset limit', 'found ' + stepLimits);
check(cardLimits === 6, 'six Create tool cards state a limit', 'found ' + cardLimits);
check(/class="intent-limits-note"/.test(page), 'hub explains what happens to oversized assets');

// Every hand-off step names a real format and a size figure.
const limitText = (page.match(/<span class="intent-limit">([^<]+)<\/span>/g) || []).join(' ');
check(/PNG/.test(limitText) && /GIF/.test(limitText), 'art steps name PNG or GIF');
check(/512x512/.test(limitText), 'sprite limits name 512x512');
check(/WAV/.test(limitText), 'audio steps name WAV');
check(/MP3/.test(limitText), 'arcade audio names MP3');

// Cross-check the published numbers against what each destination tool enforces.
const pixel = read('tools/pixel-studio.html');
check(/Math\.min\(256/.test(pixel), 'Pixel Studio clamps art to 256px', 'Math.min(256');
check(/toDataURL\('image\/png'\)/.test(pixel), 'Pixel Studio exports PNG');

const sprite = read('tools/sprite-animator.html');
check(/max="512"/.test(sprite), 'Sprite Animator frame inputs stop at 512');

const arcade = read('tools/arcade-game-maker.html');
check(/2_800_000/.test(arcade), 'Arcade rejects sprites over 2.8 MB', '2_800_000');
check(/3_500_000/.test(arcade), 'Arcade rejects backgrounds over 3.5 MB', '3_500_000');
check(/512/.test(arcade) && /1024/.test(arcade), 'Arcade documents 512px guide and 1024px downscale');
check(/800/.test(arcade) && /1280/.test(arcade), 'Arcade documents 800px background guide and 1280px downscale');
check(/8x8/.test(page) && /256x256/.test(page), 'hub repeats Pixel Studio canvas range');

const sound = read('tools/sound-studio.html');
check(/exportWAV/.test(sound), 'Audio Studio exports WAV');
check(/\.mid/.test(sound), 'Audio Studio imports MIDI');

const level = read('tools/level-designer.html');
check(/id="tilesetInput"[^>]*accept="image\/\*"/.test(level), 'World Builder imports image tilesets');
check(/toDataURL\('image\/png'\)/.test(level), 'World Builder exports PNG');

const card = read('tools/trading-card-designer.html');
check(/exportHD/.test(card) && /300 DPI/.test(card), 'Trading Card Designer offers 300 DPI print export');

if (failed) {
  console.log('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS create-hub-asset-limits: published limits match the tools');
