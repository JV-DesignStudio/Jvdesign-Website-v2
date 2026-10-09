#!/usr/bin/env node
/*
 * validate-stats.js - one source of truth for visitor-facing product counts.
 *
 * - Exact counts come from content/stats.json (generated from the content pipeline).
 * - The rounded strings visitors see come from content/marketing.json (hand-authored).
 * - This gate fails if a display overstates reality, if a headline stat element
 *   disagrees, if the homepage JSON-LD ItemList is stale, or if a page reintroduces
 *   a known-stale count. Run: node validate-stats.js   (and via npm run validate)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/stats.json'), 'utf8'));
const marketing = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/marketing.json'), 'utf8'));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const errors = [];
const add = (m) => errors.push(m);

// 1) A rounded display must never overstate the real count.
for (const [key, m] of Object.entries(marketing)) {
  if (key.startsWith('_')) continue;
  const real = stats[key];
  const num = parseInt(String(m.display).replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(real)) add(`content/stats.json is missing "${key}"`);
  else if (!Number.isFinite(num) || num > real) add(`marketing.${key} "${m.display}" overstates the real count (${real})`);
  else if (m.min && real < m.min) add(`marketing.${key} min ${m.min} > real ${real}`);
}

const entityOf = (label) => {
  const l = label.toLowerCase();
  if (/books?/.test(l)) return 'books';
  if (/workshops?/.test(l)) return 'workshops';
  if (/games?/.test(l)) return 'games';
  if (/tools?/.test(l)) return 'tools';
  return null;
};

// 2) Headline stat elements must show the canonical display string.
const STAT_FILES = ['index.html', 'pages/about.html', 'pages/learn-hub.html', 'pages/parents.html'];
const STAT_RE = /class="[^"]*(?:hero-stat-num|stat-num|stat-val)[^"]*">\s*([^<]+?)\s*<\/div>\s*<div class="[^"]*(?:hero-stat-label|stat-label|stat-lbl)[^"]*">\s*([^<]+?)\s*<\/div>/g;
for (const f of STAT_FILES) {
  const html = read(f);
  let m, seen = 0;
  while ((m = STAT_RE.exec(html))) {
    const value = m[1].trim().replace(/&amp;/g, '&');
    const label = m[2].trim().replace(/&amp;/g, '&');
    const ent = entityOf(label);
    if (!ent) continue;
    seen++;
    if (value !== marketing[ent].display) add(`${f}: "${label}" shows "${value}", expected "${marketing[ent].display}"`);
  }
  if (!seen) add(`${f}: no headline stat elements matched (markup or pattern changed?)`);
}

// 3) Homepage structured data must use the exact workshop count.
const n = read('index.html').match(/"numberOfItems"\s*:\s*(\d+)/);
if (!n) add('index.html: numberOfItems missing from JSON-LD');
else if (Number(n[1]) !== stats.workshops) add(`index.html: numberOfItems ${n[1]} != stats.workshops ${stats.workshops}`);

// 4) Known-stale phrases must never reappear on marketing pages.
const FORBID = [
  [/\b(?:160|170|178|182|187|193)\s+(?:free\s+|interactive\s+|guided\s+)?(?:workshops?|courses?)/i, 'stale workshop/course count'],
  [/\b(?:32|33|38)\s+(?:free\s+|listed\s+|browser\s+)?games?/i, 'stale games count'],
  [/\b(?:30|60)\s+(?:free\s+|creative\s+|focused\s+)?tools?/i, 'stale tools count'],
  [/\b6\s+books?\s/i, 'stale books count (should be 5)'],
];
const MARKET_PAGES = ['index.html', 'pages/about.html', 'pages/learn-hub.html', 'pages/parents.html', 'pages/parent-guide.html', 'pages/press.html', 'pages/teachers.html', 'pages/workshop.html', 'pages/games.html', 'pages/downloads.html', 'tools/parent-guide.html'];
for (const f of MARKET_PAGES) {
  const html = read(f);
  for (const [re, what] of FORBID) {
    const mm = html.match(re);
    if (mm) add(`${f}: ${what} "${mm[0].trim()}"`);
  }
}

// 5) No un-replaced STAT markers should remain after build.
const STAT_MARKER = /<!-- STAT:\w+ -->/g;
for (const f of MARKET_PAGES) {
  const html = read(f);
  const sm = html.match(STAT_MARKER);
  if (sm) add(`${f}: ${sm.length} un-replaced STAT marker(s) - run node build.js first`);
}

// 6) Catalogue pages must state the same count as marketing.json (A947). The games
//    page curates its grid at runtime (standalone apps live elsewhere), so its
//    advertised total is the marketing display; tools page states the tools display.
const gamesHtml = read('pages/games.html');
const gamesResult = (gamesHtml.match(/id="gameResultCount"[^>]*>\s*([^<]+?)\s*</) || [])[1] || '';
const gamesShown = parseInt(gamesResult.replace(/[^0-9]/g, ''), 10);
if (gamesShown !== parseInt(marketing.games.display.replace(/[^0-9]/g, ''), 10))
  add(`pages/games.html: catalogue count "${gamesResult.trim()}" != marketing.games.display "${marketing.games.display}"`);
const toolsHtml = read('pages/dev-tools.html');
if (!toolsHtml.includes(marketing.tools.display))
  add(`pages/dev-tools.html: does not state the tools count "${marketing.tools.display}"`);

if (errors.length) {
  console.error(`\n✗ validate-stats: ${errors.length} issue(s):`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
const keys = Object.keys(marketing).filter((k) => !k.startsWith('_'));
console.log(`✓ validate-stats: counts consistent - ${keys.map((k) => `${k} ${stats[k]} (show "${marketing[k].display}")`).join(', ')}`);
