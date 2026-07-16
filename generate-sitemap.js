#!/usr/bin/env node
/*
 * generate-sitemap.js — regenerate sitemap.xml from the actual pages on disk.
 *
 * Rules:
 *  - Walks every .html file (same ignore list as build.js).
 *  - A page is included ONLY if its <meta name="robots"> does not say "noindex".
 *    (So mobile-games, pitch, 404, etc. are excluded automatically — no manual list.)
 *  - Plus an explicit EXCLUDE set for dev templates that carry no robots meta.
 *  - <lastmod> comes from each file's last git commit date (accurate + automatic),
 *    falling back to filesystem mtime for files not yet committed.
 *  - index.html gets priority 1.0 / weekly; everything else 0.5 / monthly.
 *
 * Output is sorted by URL for stable, reviewable diffs.
 * Run: node generate-sitemap.js   (or: npm run build:sitemap)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const BASE = 'https://jvdesignstudio.co.uk';
const IGNORE_DIRS = new Set(['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy', '.github', '.continue', 'scripts', 'docs']);
const EXCLUDE_FILES = new Set(['games/game-template.html']); // dev templates w/o robots meta

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) out = out.concat(walk(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

// Build a { relPath -> YYYY-MM-DD } map of last commit dates in one git call.
function gitLastModMap() {
  const map = {};
  try {
    const log = execFileSync('git', ['log', '--format=C:%cs', '--name-only'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let cur = null;
    for (const line of log.split('\n')) {
      if (line.startsWith('C:')) cur = line.slice(2).trim();
      else if (line.trim() && cur && !(line in map)) map[line.trim()] = cur; // first (newest) wins
    }
  } catch (e) { /* not a git repo / git missing — fall back to mtime */ }
  return map;
}

const lastMod = gitLastModMap();

function robotsNoindex(html) {
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  return m ? /noindex/i.test(m[1]) : false;
}

const rows = [];
for (const fp of walk(ROOT)) {
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  if (EXCLUDE_FILES.has(rel)) continue;
  const html = fs.readFileSync(fp, 'utf8');
  if (robotsNoindex(html)) continue;

  const date = lastMod[rel] || new Date(fs.statSync(fp).mtime).toISOString().slice(0, 10);
  const isHome = rel === 'index.html';
  rows.push({
    loc: `${BASE}/${rel}`,
    lastmod: date,
    changefreq: isHome ? 'weekly' : 'monthly',
    priority: isHome ? '1.0' : '0.5',
  });
}

rows.sort((a, b) => a.loc.localeCompare(b.loc));

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  rows.map(r =>
    `  <url>\n` +
    `    <loc>${r.loc}</loc>\n` +
    `    <lastmod>${r.lastmod}</lastmod>\n` +
    `    <changefreq>${r.changefreq}</changefreq>\n` +
    `    <priority>${r.priority}</priority>\n` +
    `  </url>`
  ).join('\n') + '\n' +
  `</urlset>\n`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log(`✓ generate-sitemap: wrote ${rows.length} URLs to sitemap.xml`);
