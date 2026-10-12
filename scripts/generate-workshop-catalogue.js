#!/usr/bin/env node
/*
 * scripts/generate-workshop-catalogue.js (A799, A1340)
 *
 * Renders the data-driven blocks of pages/workshop.html from
 * content/workshops.json so every workshop is linked from the hub:
 *   1. Browse by engine  (BROWSE:START / BROWSE:END)
 *   2. Complete catalogue (CATALOGUE:START / CATALOGUE:END)
 * Cards carry data-engine / data-difficulty / data-age for the hub filters.
 * Run: node scripts/generate-workshop-catalogue.js
 * Check only (CI): node scripts/generate-workshop-catalogue.js --check
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshops.json');
const HUB = path.join(ROOT, 'pages', 'workshop.html');
const START = '<!-- CATALOGUE:START -->';
const END = '<!-- CATALOGUE:END -->';
const BROWSE_START = '<!-- BROWSE:START -->';
const BROWSE_END = '<!-- BROWSE:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const ENGINE_META = {
  'Scratch': { emoji: '🐱', color: '#FF7700' },
  'Roblox': { emoji: '🟦', color: '#00A2FF' },
  'Minecraft': { emoji: '⛏️', color: '#62b847' },
  'Godot': { emoji: '🤖', color: '#478cbf' },
  'Unity': { emoji: '🎲', color: '#5bc0f8' },
  'Unreal': { emoji: '🔵', color: '#313131' },
  'JavaScript': { emoji: '⚡', color: '#f7df1e' },
  'Python': { emoji: '🐍', color: '#3776ab' },
  'C++': { emoji: '🔧', color: '#00599c' },
  'Java': { emoji: '☕', color: '#f89820' },
  'GML/GameMaker': { emoji: '🕹️', color: '#a1c42a' },
  'GDevelop': { emoji: '🎯', color: '#00bfa5' },
  'Defold': { emoji: '⚙️', color: '#2196F3' },
  'PICO-8': { emoji: '🎮', color: '#ff004d' },
  'Blender': { emoji: '🎨', color: '#e8833a' },
  'TinkerCAD': { emoji: '🖨️', color: '#f2637a' },
  'MUGEN': { emoji: '🥊', color: '#BC4749' },
  'OpenRCT2': { emoji: '🎢', color: '#c98a2e' },
  'Stardew Valley': { emoji: '🌾', color: '#8bc34a' },
  'Terraria': { emoji: '🌳', color: '#7cb342' },
  'General': { emoji: '🧭', color: '#70A3A7' }
};

function card(e) {
  const href = '../' + String(e.url).replace(/^\//, '');
  const isStudio = /-(?:mod-)?studio$/.test(e.id || '');
  const badge = (isStudio ? '🛠 Browser studio · ' : '') + [e.engine, cap(e.difficulty), 'Ages ' + e.ageRange].filter(Boolean).join(' · ');
  const desc = e.desc || ('Interactive build-along for ' + e.title + '.');
  return '    <a href="' + esc(href) + '" class="course-card"'
    + ' data-engine="' + esc(e.engine) + '"'
    + ' data-difficulty="' + esc(e.difficulty) + '"'
    + ' data-age="' + esc(e.ageRange) + '"'
    + (isStudio ? ' data-studio="true"' : '')
    + ' data-cat="tutorial">\n'
    + '      <div class="course-body">\n'
    + '        <div class="course-tag">' + esc(badge) + '</div>\n'
    + '        <div class="course-title">' + esc(e.title) + '</div>\n'
    + '        <div class="course-desc">' + esc(desc) + '</div>\n'
    + '      </div>\n'
    + '    </a>';
}

function section(entries) {
  return '<section class="courses-section" id="catalogue" data-format="courses">\n'
    + '  <div class="ws-section-head reveal">\n'
    + '    <span class="ws-section-icon">📖</span>\n'
    + '    <div>\n'
    + '      <div class="ws-section-label">Complete Catalogue</div>\n'
    + '      <div class="ws-section-sub">Every workshop A to Z, generated from the content data so nothing is missed. Use the finder above to filter by tool, level or age.</div>\n'
    + '    </div>\n'
    + '    <span class="ws-section-count">' + entries.length + ' Workshops</span>\n'
    + '  </div>\n'
    + '  <div class="courses-grid" id="catalogueGrid">\n'
    + entries.map(card).join('\n')
    + '\n  </div>\n'
    + '</section>';
}

function browse(entries) {
  const counts = new Map();
  for (const e of entries) counts.set(e.engine, (counts.get(e.engine) || 0) + 1);
  const engines = [...counts.keys()].sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return counts.get(b) - counts.get(a) || a.localeCompare(b);
  });
  const tiles = engines.map((eng) => {
    const meta = ENGINE_META[eng] || { emoji: '🎮', color: '#70A3A7' };
    const n = counts.get(eng);
    return '      <button type="button" class="ws-engine-tile" data-engine="' + esc(eng) + '"'
      + ' style="--eng-color:' + meta.color + '"'
      + ' aria-label="Show ' + esc(eng) + ' workshops">\n'
      + '        <span class="ws-engine-emoji" aria-hidden="true">' + meta.emoji + '</span>\n'
      + '        <span class="ws-engine-name">' + esc(eng) + '</span>\n'
      + '        <span class="ws-engine-count">' + n + (n === 1 ? ' workshop' : ' workshops') + '</span>\n'
      + '      </button>';
  }).join('\n');
  return '<section class="ws-browse" id="browse-engines" aria-labelledby="ws-browse-title">\n'
    + '  <div class="ws-browse-inner">\n'
    + '    <div class="ws-browse-head">\n'
    + '      <img src="/assets/mascots/lumo-badge.webp" alt="Lumo" width="40" height="40" loading="lazy" style="border-radius:50%;margin-bottom:6px">\n'
    + '      <span class="ws-browse-tag">Browse with Lumo</span>\n'
    + '      <h2 id="ws-browse-title">Pick the tool you want to learn</h2>\n'
    + '      <p>Tap a tool to jump straight to its workshops in the catalogue below.</p>\n'
    + '    </div>\n'
    + '    <div class="ws-engine-grid">\n'
    + tiles + '\n'
    + '    </div>\n'
    + '  </div>\n'
    + '</section>';
}

function splice(html, startMarker, endMarker, want) {
  if (!html.includes(startMarker) || !html.includes(endMarker)) return null;
  const have = html.slice(html.indexOf(startMarker), html.indexOf(endMarker) + endMarker.length);
  return { have, want, html: html.slice(0, html.indexOf(startMarker)) + want + html.slice(html.indexOf(endMarker) + endMarker.length) };
}

function generate({ checkOnly = false } = {}) {
  const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  let html = fs.readFileSync(HUB, 'utf8');
  let changed = false;

  const blocks = [
    [BROWSE_START, BROWSE_END, BROWSE_START + '\n' + browse(entries) + '\n' + BROWSE_END],
    [START, END, START + '\n' + section(entries) + '\n' + END]
  ];

  for (const [s, e, want] of blocks) {
    const res = splice(html, s, e, want);
    if (!res) throw new Error('markers missing in pages/workshop.html: ' + s);
    if (res.have !== want) {
      changed = true;
      if (!checkOnly) html = res.html;
    }
  }

  if (changed && !checkOnly) fs.writeFileSync(HUB, html);
  return { changed, count: entries.length };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { changed, count } = generate({ checkOnly });
  if (checkOnly) {
    if (changed) {
      console.log('  [FAIL] catalogue/browse drift: regenerate with node scripts/generate-workshop-catalogue.js');
      process.exit(1);
    }
    console.log('  [PASS] catalogue + browse in sync (' + count + ' cards)');
    return;
  }
  console.log(changed
    ? '  [OK] wrote catalogue + browse blocks for ' + count + ' workshops into pages/workshop.html'
    : '  [PASS] catalogue + browse already in sync (' + count + ' cards)');
}

if (require.main === module) main();
module.exports = { generate };
