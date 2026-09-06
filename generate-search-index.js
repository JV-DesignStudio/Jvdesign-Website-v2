#!/usr/bin/env node
/*
 * generate-search-index.js — crawls every public HTML page and writes
 * search-index.json (url, title, description) for pages/search.html to merge
 * with its curated ALL_PROJECTS list. Noindex pages are excluded, same rule
 * as generate-sitemap.js. Run: npm run build:sitemap (runs both).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy', '.github', 'og', 'icons', 'downloads', 'pitch-assets', 'social-posts', 'docs', 'scripts', 'StardustbookPreview', 'Session and Notes Part 2', 'Session Notes and Documents', 'chars', 'chars-orig', 'models', 'covers', 'arcade-app', 'questlog-pwa']);
const SKIP_FILES = new Set(['404.html', 'offline.html', 'search.html']);

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out = out.concat(walk(path.join(dir, e.name)));
    } else if (e.isFile() && e.name.endsWith('.html')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

const entries = [];
for (const fp of walk(ROOT)) {
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
