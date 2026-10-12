#!/usr/bin/env node
/**
 * A1366 - a consistent Previous / All workshops / Next band for the page families
 * that had no clear next step: studios, cheatsheets and blueprint/guide pages.
 *
 * Order is a curated curriculum order per family (documented below); anything
 * not listed is appended alphabetically so nothing is ever left out. The band is
 * self-contained (inline styles) so it renders the same on every page type.
 *
 * Idempotent. Run with --dry-run to preview.
 *   node scripts/add-family-nav.js [--dry-run]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const W = path.join(ROOT, 'workshops');
const DRY = process.argv.includes('--dry-run');
const MARK = 'A1366:family-nav';

const FAMILIES = {
  studio: [
    'scratch-studio', 'python-studio', 'pico8-studio', 'unity-studio', 'unreal-studio',
    'cpp-mod-studio', 'python-mod-studio', 'godot-mod-studio', 'minecraft-mod-studio',
    'roblox-mod-studio', 'mugen-mod-studio', 'openrct2-mod-studio', 'stardew-mod-studio',
    'terraria-mod-studio',
  ],
  cheatsheet: [
    'scratch-cheatsheet', 'python-cheatsheet', 'js-cheatsheet', 'cpp-cheatsheet',
    'gml-cheatsheet', 'gdscript-cheatsheet', 'unity-cheatsheet', 'unreal-cheatsheet',
    'mugen-cheatsheet', 'roblox-studio-cheatsheet', 'minecraft-modding-cheatsheet',
    'blender-cheatsheet', 'tinkercad-cheatsheet', 'stardew-modding-cheatsheet',
    'terraria-modding-cheatsheet', 'openrct2-cheatsheet',
  ],
  blueprint: [
    'racing-blueprint', 'castle-siege-blueprint', 'fnaf-blueprint', 'diablo-blueprint',
    'nuclear-blueprint', 'fairy-survivors-guide', 'nuclear-throne-guide',
  ],
};

const titleCache = {};
const AC = {
  pico8: 'PICO-8', cpp: 'C++', js: 'JavaScript', gml: 'GML', gdscript: 'GDScript',
  openrct2: 'OpenRCT2', fnaf: 'FNAF', roblox: 'Roblox', unity: 'Unity', unreal: 'Unreal',
  python: 'Python', godot: 'Godot', minecraft: 'Minecraft', stardew: 'Stardew',
  terraria: 'Terraria', blender: 'Blender', tinkercad: 'TinkerCAD', mugen: 'MUGEN',
  scratch: 'Scratch', cheatsheet: 'Cheat Sheet', modding: 'Modding', mod: 'Mod',
  blueprint: 'Blueprint', guide: 'Guide', studio: 'Studio',
};
function label(file) {
  if (titleCache[file]) return titleCache[file];
  const out = file.replace(/\.html$/, '').split('-')
    .map((w) => AC[w] || (w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  return (titleCache[file] = out);
}

const BTN = 'text-decoration:none;font-weight:700;font-size:.82rem;border-radius:999px;padding:8px 14px;display:inline-flex;align-items:center;gap:6px;transition:background .2s,transform .2s';
const GHOST = BTN + ';color:#4e7d80;border:1px solid rgba(112,163,167,.35);background:rgba(112,163,167,.08)';
const ALL = BTN + ';color:#fff;background:linear-gradient(135deg,#bc4749,#9b3a3c);box-shadow:0 4px 14px rgba(188,71,73,.3)';

function band(prev, next, self) {
  const parts = [];
  if (prev) parts.push('<a href="/workshops/' + prev + '" style="' + GHOST + '">\u2190 ' + label(prev) + '</a>');
  parts.push('<a href="/workshop" style="' + ALL + '">All workshops</a>');
  if (next) parts.push('<a href="/workshops/' + next + '" style="' + GHOST + '">' + label(next) + ' \u2192</a>');
  return '\n<!-- ' + MARK + ':' + self + ' -->\n' +
    '<nav class="family-nav" aria-label="Workshop navigation" style="max-width:820px;margin:8px auto 40px;padding:0 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">\n' +
    parts.map((p) => '  ' + p).join('\n') + '\n</nav>\n';
}

let patched = 0;
const skipped = [];
for (const [family, order] of Object.entries(FAMILIES)) {
  // append any files of this family that exist on disk but are not in the order
  const all = fs.readdirSync(W);
  const suffix = family === 'studio' ? '-studio.html' : family === 'cheatsheet' ? '-cheatsheet.html' : '-blueprint.html';
  const extra = all.filter((f) => f.endsWith(suffix)).map((f) => f.replace(/\.html$/, '')).filter((b) => !order.includes(b)).sort();
  const seq = order.concat(extra);

  for (let i = 0; i < seq.length; i++) {
    const file = seq[i] + '.html';
    if (!fs.existsSync(path.join(W, file))) { skipped.push(file + ' (missing)'); continue; }
    let html = fs.readFileSync(path.join(W, file), 'utf8');
    // Redirect stubs (e.g. scratch-cheatsheet.html) are not learner-facing pages;
    // never add a band and strip any that an earlier run placed there.
    if (/http-equiv=["']?refresh|location\.replace\(/i.test(html)) {
      if (html.includes(MARK)) {
        html = html.replace(new RegExp('\\n?<!-- ' + MARK + ':[\\s\\S]*?</nav>\\n?'), '\n');
        if (!DRY) fs.writeFileSync(path.join(W, file), html, 'utf8');
      }
      skipped.push(file + ' (redirect stub)');
      continue;
    }
    const block = band(i > 0 ? seq[i - 1] + '.html' : null, i < seq.length - 1 ? seq[i + 1] + '.html' : null, file);
    if (html.includes(MARK)) {
      html = html.replace(new RegExp('\\n?<!-- ' + MARK + ':[\\s\\S]*?</nav>\\n?'), block);
    } else if (html.includes('<!-- BUILD:footer-content -->')) {
      html = html.replace('<!-- BUILD:footer-content -->', block + '<!-- BUILD:footer-content -->');
    } else {
      const at = html.lastIndexOf('</body>');
      if (at === -1) { skipped.push(file + ' (no insert point)'); continue; }
      html = html.slice(0, at) + block + html.slice(at);
    }
    if (!DRY) fs.writeFileSync(path.join(W, file), html, 'utf8');
    patched++;
  }
}

console.log((DRY ? '[dry-run] ' : '') + 'family-nav bands: ' + patched);
if (skipped.length) console.log('skipped: ' + skipped.join(', '));
