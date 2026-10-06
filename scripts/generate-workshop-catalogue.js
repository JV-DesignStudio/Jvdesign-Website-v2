#!/usr/bin/env node
/*
 * scripts/generate-workshop-catalogue.js (A799)
 *
 * Renders the Complete Catalogue section of pages/workshop.html from
 * content/workshops.json so every workshop is linked from the hub.
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

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function card(e) {
  const href = '../' + String(e.url).replace(/^\//, '');
  const badge = [e.engine, cap(e.difficulty), 'Ages ' + e.ageRange].filter(Boolean).join(' · ');
  const desc = e.desc || ('Interactive build-along for ' + e.title + '.');
  return '    <a href="' + esc(href) + '" class="course-card"'
    + ' data-engine="' + esc(e.engine) + '"'
    + ' data-difficulty="' + esc(e.difficulty) + '"'
    + ' data-age="' + esc(e.ageRange) + '"'
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

function main() {
  const checkOnly = process.argv.includes('--check');
  const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const want = START + '\n' + section(entries) + '\n' + END;
  let html = fs.readFileSync(HUB, 'utf8');
  if (!html.includes(START) || !html.includes(END)) {
    console.log('  [FAIL] catalogue markers missing in pages/workshop.html');
    process.exit(1);
  }
  const have = html.slice(html.indexOf(START), html.indexOf(END) + END.length);
  if (have === want) {
    console.log('  [PASS] catalogue in sync (' + entries.length + ' cards)');
    return;
  }
  if (checkOnly) {
    console.log('  [FAIL] catalogue drift: regenerate with node scripts/generate-workshop-catalogue.js');
    process.exit(1);
  }
  html = html.slice(0, html.indexOf(START)) + want + html.slice(html.indexOf(END) + END.length);
  fs.writeFileSync(HUB, html);
  console.log('  [OK] catalogue wrote ' + entries.length + ' cards into pages/workshop.html');
}

main();
