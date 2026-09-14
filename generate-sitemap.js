#!/usr/bin/env node
/*
 * generate-sitemap.js , regenerate sitemap.xml from the actual pages on disk.
 *
 * Rules:
 *  - Walks every .html file (same ignore list as build.js).
 *  - A page is included ONLY if its <meta name="robots"> does not say "noindex".
 *    (So mobile-games, pitch, 404, etc. are excluded automatically , no manual list.)
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

const { ROOT: LIB_ROOT, IGNORE_DIRS: LIB_IGNORE, EXCLUDE_FILES: LIB_EXCLUDE } = require('./scripts/lib/paths');
const ROOT = __dirname;
const BASE = 'https://jvdesignstudio.co.uk';
const IGNORE_DIRS = LIB_IGNORE;
// Unified with lib/paths EXCLUDE_FILES plus 8 game orphans not in registry (32 curated)
const GAME_ORPHANS = ['games/arcane_citadel.html','games/critter-whack.html','games/lumo-dash.html','games/nibble-quest.html','games/stack-attack.html','games/mobile-games.html','games/sky_high_squirt.html','games/call-of-the-cards-playtest.html'];
const EXCLUDE_FILES = new Set([...LIB_EXCLUDE, ...GAME_ORPHANS, 'games/game-template.html', 'games/cozy-biscuit-clicker.pre-app.bak.html']);
const PRIORITY_MAP = {
  // Hub pages , higher crawl priority
  '/': 1.0,
  '/workshop': 0.9, '/games': 0.9, '/books': 0.9, '/dev-tools': 0.8, '/freebies': 0.8, '/downloads': 0.8,
  '/about': 0.7, '/parents': 0.6, '/contact': 0.5, '/arcade': 0.7
};
const LOW_PRIORITY_SUFFIX = ['privacy-policy', 'terms-of-service', 'arcade-privacy', 'biscuit-tin-privacy', 'cozy-cafe-privacy', 'game-maker-privacy', 'pocket-crew-privacy', 'questlog-privacy', 'sky-high-squirt-privacy'];

// Map filesystem path to clean canonical URL
function toCleanUrl(rel) {
  if (rel === 'index.html') return '/';
  if (rel === 'pages/') return '/'; // safety
  if (rel.startsWith('pages/')) {
    const base = rel.replace(/^pages\//, '').replace(/\.html$/, '');
    return '/' + base;
  }
  // Exclude any .bak.html that slipped through
  if (rel.endsWith('.bak.html')) return null;
  return '/' + rel;
}

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) out = out.concat(walk(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

// Build a { relPath -> YYYY-MM-DD } map - memoized on HEAD SHA to avoid 64MB log on every build
function gitLastModMap() {
  const cachePath=path.join(ROOT,'.git','lastmod-cache.json');
  try{
    const head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
    if(fs.existsSync(cachePath)){
      const cached=JSON.parse(fs.readFileSync(cachePath,'utf8'));
      if(cached.head===head && cached.map) return cached.map;
    }
    const map={};
    const log = execFileSync('git', ['log', '--format=C:%cs', '--name-only'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let cur = null;
    for (const line of log.split('\n')) {
      if (line.startsWith('C:')) cur = line.slice(2).trim();
      else if (line.trim() && cur && !(line in map)) map[line.trim()] = cur;
    }
    try{ fs.writeFileSync(cachePath, JSON.stringify({head, map})); }catch(e){}
    return map;
  }catch(e){
    try{
      const head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
      const cachePath2=path.join(ROOT,'.git','lastmod-cache.json');
      if(fs.existsSync(cachePath2)){
        const cached=JSON.parse(fs.readFileSync(cachePath2,'utf8'));
        if(cached.map) return cached.map;
      }
    }catch(e2){}
    return {};
  }
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
  const clean = toCleanUrl(rel);
  if (!clean) continue; // excluded (e.g. .bak.html)
  const isHome = clean === '/';
  let priority = PRIORITY_MAP[clean] || (clean.startsWith('/workshops/') || clean.startsWith('/tools/') || clean.startsWith('/games/') ? '0.5' : '0.5');
  if (LOW_PRIORITY_SUFFIX.some(s => clean.includes(s))) priority = '0.3';
  if (isHome) priority = '1.0';
  // Extract og:image for image sitemap , prefer .webp variant if exists on disk to save payload
  const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  let image = ogMatch ? ogMatch[1].trim() : null;
  if(image && image.startsWith(BASE)){
    const relImg = image.slice(BASE.length).replace(/^\//,'');
    const ext = path.extname(relImg).toLowerCase();
    if(ext==='.jpg' || ext==='.jpeg' || ext==='.png'){
      const webpRel = relImg.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      if(fs.existsSync(path.join(ROOT, webpRel))) image = BASE + '/' + webpRel.replace(/\\/g,'/');
      else {
        // also try .avif before falling back
        const avifRel = relImg.replace(/\.(jpg|jpeg|png)$/i, '.avif');
        if(fs.existsSync(path.join(ROOT, avifRel))) image = BASE + '/' + avifRel.replace(/\\/g,'/');
      }
    }
  }
  // Fallback for tools without og:image , prevents blank social unfurl
  if(!image && clean.startsWith('/tools/')){
    const fallback = fs.existsSync(path.join(ROOT,'og/hub-devtools.png')) ? BASE+'/og/hub-devtools.png' : null;
    if(fallback) image = fallback;
  }
  rows.push({
    loc: `${BASE}${clean}`,
    lastmod: date,
    changefreq: isHome ? 'weekly' : 'monthly',
    priority: String(priority),
    image: image && image.startsWith('http') ? image : null,
  });
}

rows.sort((a, b) => a.loc.localeCompare(b.loc));

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
  rows.map(r =>
    `  <url>\n` +
    `    <loc>${r.loc}</loc>\n` +
    `    <lastmod>${r.lastmod}</lastmod>\n` +
    `    <changefreq>${r.changefreq}</changefreq>\n` +
    `    <priority>${r.priority}</priority>\n` +
    (r.image ? `    <image:image><image:loc>${r.image}</image:loc></image:image>\n` : '') +
    `  </url>`
  ).join('\n') + '\n' +
  `</urlset>\n`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log(`✓ generate-sitemap: wrote ${rows.length} URLs to sitemap.xml`);
