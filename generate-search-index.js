#!/usr/bin/env node
/*
 * generate-search-index.js , crawls every public HTML page and writes
 * search-index.json (url, title, description) for pages/search.html to merge
 * with its curated ALL_PROJECTS list. Noindex pages are excluded, same rule
 * as generate-sitemap.js. Run: npm run build:sitemap (runs both).
 */
const fs = require('fs');
const path = require('path');

const { ROOT, IGNORE_DIRS: SKIP_DIRS, EXCLUDE_FILES: LIB_EXCLUDE, GAME_ORPHANS } = require('./scripts/lib/paths');
const { walk } = require('./scripts/lib/walk');
const SKIP_FILES = new Set([...LIB_EXCLUDE, ...GAME_ORPHANS, 'games/game-template.html', '404.html', 'offline.html', 'search.html']);

const entries = [];
for (const fp of walk(ROOT, { ext: ".html", ignore: SKIP_DIRS })) {
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  if (SKIP_FILES.has(rel) || rel.startsWith('quest-board') || rel.includes('.bak.')) continue;
  const src = fs.readFileSync(fp, 'utf8');
  if (/name="robots"\s+content="[^"]*noindex/i.test(src)) continue;
  const titleM = src.match(/<title>([^<]+)<\/title>/i);
  const descM = src.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const title = titleM ? titleM[1].replace(/\s*\| JVDesignStudio\s*$/i, '').trim() : rel;
  const desc = descM ? descM[1].trim() : '';
  entries.push({ url: rel, title: title || rel, desc: desc.slice(0, 180) });
}
entries.sort((a, b) => a.url.localeCompare(b.url));
fs.writeFileSync(path.join(ROOT, 'search-index.json'), JSON.stringify({ generated: new Date().toISOString(), count: entries.length, pages: entries }, null, 1));
console.log(`✓ generate-search-index: ${entries.length} pages → search-index.json`);
