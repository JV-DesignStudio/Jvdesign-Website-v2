#!/usr/bin/env node
/**
 * fix-og-tags.js
 * Scans all HTML files in the site and injects missing OG / Twitter Card
 * meta tags based on each page's existing <title> and <meta name="description">.
 *
 * Usage:
 *   node fix-og-tags.js [--dry-run]   # preview only
 *   node fix-og-tags.js               # apply changes
 *
 * Rules:
 *  - Skips files that already have og:title.
 *  - Skips files with no <title> or no <meta name="description">.
 *  - Derives the canonical URL from the file path.
 *  - Uses a per-page OG image if one exists in /og/<slug>.png,
 *    otherwise falls back to /og/home.png.
 *  - Inserts the block just before </head>.
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = __dirname;                       // site root
const BASE_URL  = 'https://jvdesignstudio.co.uk';
const FB_IMAGE  = BASE_URL + '/og/home.png';       // fallback OG image
const DRY_RUN   = process.argv.includes('--dry-run');

// ── helpers ──────────────────────────────────────────────────────────────────

function getAllHtml(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip node_modules and hidden dirs
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        getAllHtml(full, results);
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

function extract(html, pattern) {
  const m = html.match(pattern);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Convert a file path to a canonical URL
function toUrl(filePath) {
  let rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  // root index
  if (rel === 'index.html') return BASE_URL + '/';
  // pages in root , strip .html for clean URLs
  if (!rel.includes('/')) return BASE_URL + '/' + rel.replace(/\.html$/, '');
  // nested pages , keep path, strip .html
  return BASE_URL + '/' + rel.replace(/\.html$/, '');
}

// Guess the OG image slug from the file path
function toOgImage(filePath) {
  const name = path.basename(filePath, '.html');
  // if a specific OG image file exists, use it
  const ogPath = path.join(ROOT, 'og', name + '.png');
  if (fs.existsSync(ogPath)) return BASE_URL + '/og/' + name + '.png';
  return FB_IMAGE;
}

// ── main ─────────────────────────────────────────────────────────────────────

const files   = getAllHtml(ROOT);
let   changed = 0;
let   skipped = 0;
let   noData  = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');

  // Already has OG tags → skip
  if (/og:title/i.test(html)) { skipped++; continue; }

  const title = extract(html, /<title[^>]*>([^<]+)<\/title>/i);
  const desc  = extract(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
             || extract(html, /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);

  if (!title || !desc) { noData++; continue; }

  const url     = toUrl(file);
  const image   = toOgImage(file);
  const safeT   = escAttr(title);
  const safeD   = escAttr(desc);

  const block = `    <!-- Open Graph -->
    <meta property="og:type"        content="website">
    <meta property="og:url"         content="${url}">
    <meta property="og:title"       content="${safeT}">
    <meta property="og:description" content="${safeD}">
    <meta property="og:image"       content="${image}">
    <meta property="og:site_name"   content="JVDesignStudio">
    <!-- Twitter Card -->
    <meta name="twitter:card"        content="summary_large_image">
    <meta name="twitter:title"       content="${safeT}">
    <meta name="twitter:description" content="${safeD}">
    <meta name="twitter:image"       content="${image}">`;

  const updated = html.replace(/<\/head>/i, block + '\n</head>');

  if (updated === html) { noData++; continue; } // no </head> found

  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (DRY_RUN) {
    console.log('[DRY-RUN] Would patch:', rel);
  } else {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('[PATCHED]', rel);
  }
  changed++;
}

console.log('');
console.log('──────────────────────────────────────');
if (DRY_RUN) {
  console.log(`Would patch : ${changed} files`);
} else {
  console.log(`Patched     : ${changed} files`);
}
console.log(`Already OK  : ${skipped} files`);
console.log(`No data     : ${noData} files (no title/description or no </head>)`);
console.log('──────────────────────────────────────');
if (DRY_RUN) console.log('Re-run without --dry-run to apply changes.');
