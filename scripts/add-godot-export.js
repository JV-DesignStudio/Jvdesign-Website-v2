#!/usr/bin/env node
/**
 * add-godot-export.js (A1873)
 *
 * The Godot build-along pages end in a browser canvas preview. Without a
 * finish step, a learner never finds out how to take that project into Godot
 * and export a game they can keep. This stamps one consistent
 * "Finish in Godot and export" block before the next-step route.
 *
 * Safe to re-run: the block is wrapped in WS-EXPORT markers and replaced.
 * Usage: node scripts/add-godot-export.js [--check]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const START = '<!-- WS-EXPORT:START -->';
const END = '<!-- WS-EXPORT:END -->';

const PAGES = {
  'godot_tutorial': { href: '../platformer.zip', label: 'platformer.zip' },
  'godot-gdscript-essentials': { href: '../gdscript-essentials-starter.zip', label: 'gdscript-essentials-starter.zip' },
  'godot-racing-workshop': { href: '../zoom-zoom-racing.zip', label: 'zoom-zoom-racing.zip' },
  'godot-racing-workshop-2': { href: '../zoom-zoom-racing.zip', label: 'zoom-zoom-racing.zip' },
  'godot-gatekeeper-3d-part1': { href: '/downloads/godot-gatekeeper-3d-part1-reference.zip', label: 'the Part 1 reference project' },
  'godot-gatekeeper-3d-part2': { href: '/downloads/godot-gatekeeper-3d-part2-reference.zip', label: 'the Part 2 reference project' }
};

function block(page, entry) {
  return [
    START,
    '<section class="ws-export" aria-labelledby="ws-export-title" style="max-width:860px;margin:0 auto 32px;padding:0 20px;">',
    '  <div style="background:rgba(71,140,191,.1);border:1px solid rgba(71,140,191,.32);border-radius:14px;padding:20px 22px;">',
    '    <p style="margin:0 0 6px;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7fb2d6">Finish in Godot</p>',
    '    <h2 id="ws-export-title" style="font-family:\'Fredoka\',cursive;font-size:1.3rem;margin:0 0 8px;color:#F0EAD6">Turn your preview into a game you can export</h2>',
    '    <p style="font-size:.9rem;line-height:1.65;margin:0 0 12px;color:rgba(240,234,214,.8)">The canvas is a live preview. To keep the game and play it on another computer, open the same project in Godot 4 and export it.</p>',
    '    <ol style="font-size:.88rem;line-height:1.75;margin:0;padding-left:20px;color:rgba(240,234,214,.8)">',
    `      <li>Download the starter project: <a href="${entry.href}" download style="color:#9CCFD2;font-weight:700">${entry.label}</a>.</li>`,
    '      <li>Unzip it, open Godot 4 from <strong>godotengine.org</strong>, choose <strong>Import</strong> and pick <code>project.godot</code>.</li>',
    '      <li>Copy each step\'s GDScript from the canvas into the script named in that step, then press <strong>F5</strong> to play.</li>',
    '      <li>Check the start, the win and the game over before you export.</li>',
    '      <li>Open <strong>Project &gt; Export</strong>, click <strong>Download Export Templates</strong> if asked, add a <strong>Windows Desktop</strong> or <strong>Web</strong> preset, then choose <strong>Export Project</strong>.</li>',
    '      <li>Keep the whole export folder, not just the .exe, so the game still runs when you copy it.</li>',
    '    </ol>',
    '  </div>',
    '</section>',
    END
  ].join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  let changed = 0;
  for (const [id, entry] of Object.entries(PAGES)) {
    const file = path.join(ROOT, 'workshops', id + '.html');
    if (!fs.existsSync(file)) { console.log('SKIP missing ' + file); continue; }
    let html = fs.readFileSync(file, 'utf8');
    const existing = html.indexOf(START);
    if (existing >= 0) {
      const end = html.indexOf(END, existing);
      if (end >= 0) html = html.slice(0, existing) + html.slice(end + END.length) + '\n';
    }
    const next = html.indexOf('<!-- WS-NEXT:START -->');
    const mainClose = html.lastIndexOf('</main>');
    const at = next >= 0 ? next : mainClose;
    if (at < 0) { console.log('SKIP no insert point ' + id); continue; }
    const insert = block(id, entry) + '\n\n';
    html = html.slice(0, at) + insert + html.slice(at);
    if (!check) fs.writeFileSync(file, html);
    changed++;
    console.log((check ? 'WOULD ADD ' : 'ADDED ') + 'workshops/' + id + '.html');
  }
  console.log(changed + ' page(s) ' + (check ? 'need the block' : 'updated'));
}

main();
