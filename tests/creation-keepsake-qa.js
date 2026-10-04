#!/usr/bin/env node
/* A676: static contract for the shared keepsake/save strip on curated create tools. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }

const keepsake = fs.readFileSync(path.join(ROOT, 'creation-keepsake.js'), 'utf8');
const share = fs.readFileSync(path.join(ROOT, 'creation-share.js'), 'utf8');
const xp = fs.readFileSync(path.join(ROOT, 'tool-xp.js'), 'utf8');

check(/jvds-keepsake-strip/.test(keepsake), 'creation-keepsake.js missing strip id');
check(/Export to keep/.test(keepsake), 'creation-keepsake.js missing export button label');
check(/jvds:keepsake-export/.test(keepsake), 'creation-keepsake.js missing jvds:keepsake-export event');
check(/window\.ToolXP/.test(keepsake), 'creation-keepsake.js does not award ToolXP on export');
check(/jk-keep-cert/.test(keepsake), 'creation-keepsake.js missing certificate link');
check(/creation-keepsake\.js/.test(share), 'creation-share.js does not load creation-keepsake.js');
check(/jvds_tool_export_/.test(xp), 'tool-xp.js missing jvds_tool_export tracking');

const KEEP = [
  'level-designer', 'trading-card-designer', 'colour-palette', 'particle-designer',
  'bitmap-font-maker', 'sprite-animator', 'arcade-game-maker', 'icon-generator',
  'sound-studio', 'gdd-builder', 'story-editor', 'code-snippet-generator'
];
for (const t of KEEP) {
  const p = path.join(ROOT, 'tools', t + '.html');
  if (!fs.existsSync(p)) { fails.push('missing tool page ' + t); continue; }
  const html = fs.readFileSync(p, 'utf8');
  check(/creation-share\.js/.test(html), t + ' does not include creation-share.js (keepsake loader)');
}

const ps = fs.readFileSync(path.join(ROOT, 'tools', 'pixel-studio.html'), 'utf8');
check(/id="keepsake-strip"/.test(ps), 'pixel-studio keepsake strip missing');

if (fails.length) {
  fails.forEach(f => console.log('  [FAIL] ' + f));
  process.exitCode = 1;
} else {
  console.log('creation-keepsake-qa: PASS (' + (KEEP.length + 1) + ' curated create tools covered)');
}
