#!/usr/bin/env node
/*
 * validate-links.js — internal link integrity check for the whole site.
 * Walks every .html file (same ignore list as build.js), extracts href/src
 * references, and verifies each local target actually exists on disk.
 *
 *  - Resolves relative refs against each file's own directory.
 *  - Resolves root-absolute refs ("/foo") against the repo root.
 *  - Skips external (http/mailto/tel/data/js), anchors, and query-only refs.
 *  - Strips script bodies but preserves their opening tags, so external script
 *    sources are checked while JS-built paths (e.g. '../badge-'+id+'.png')
 *    are never flagged.
 *
 * Exit code 1 if any broken links are found, so it can gate a build / hook / CI.
 * Run: node validate-links.js   (or: npm run validate:links)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const IGNORE_DIRS = new Set(['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy', '.github', '.continue', 'arcade-app']);

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      out = out.concat(walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const broken = {};   // "target" -> [files]
let refCount = 0;

for (const filePath of walk(ROOT)) {
  let c = fs.readFileSync(filePath, 'utf8');
  c = c.replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1'); // keep script src, ignore JS-built paths
  const dir = path.dirname(filePath);
  for (const m of c.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let ref = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|about:|#|\/\/)/i.test(ref)) continue;
    if (ref.includes('${') || ref.includes('{{') || ref.includes('{') || ref.includes('}')) continue; // template-literal / mustache paths, not static
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;                 // pure anchor / query
    // Extensionless site routes like /games or /workshop are clean URLs — check .html + /index.html variants
    if (!path.extname(clean)) {
      const tryPaths = [clean + '.html', path.join(clean, 'index.html'), path.join(clean, clean.split('/').pop() + '.html')];
      // special case: pages/ style — /games maps to pages/games.html
      const pagesVariant = path.join(ROOT, 'pages', clean.replace(/^\//,'') + '.html');
      const candidates = tryPaths.map(p => p.startsWith('/') ? path.join(ROOT, p) : path.resolve(dir, p)).concat(pagesVariant);
      if (candidates.some(p => fs.existsSync(p))) { refCount++; continue; }
      // also allow clean "/" root
      if (clean === '/' || clean === '') { refCount++; continue; }
      // if none exist, fall through to broken handling via first candidate
    }
    refCount++;
    // Percent-decoding: browsers resolve "muguen-cover.webp" to the file
    // "muguen-cover.webp" on disk, so decode before checking existence.
    let decoded = clean;
    try { decoded = decodeURIComponent(clean); } catch (e) { /* malformed escape — check as-is */ }
    const target = decoded.startsWith('/') ? path.join(ROOT, decoded) : path.resolve(dir, decoded);
    if (!fs.existsSync(target)) {
      const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
      (broken[ref] = broken[ref] || []).push(rel);
    }
  }
}

const targets = Object.keys(broken);
if (!targets.length) {
  console.log(`✓ validate-links: ${refCount} internal refs checked, 0 broken.`);
  process.exit(0);
}

console.log(`✗ validate-links: ${targets.length} broken target(s) across the site:\n`);
targets
  .sort((a, b) => broken[b].length - broken[a].length)
  .forEach(t => {
    const files = broken[t];
    const shown = files.length <= 5 ? files.join(', ') : files.slice(0, 5).join(', ') + ` +${files.length - 5} more`;
    console.log(`  ${String(files.length).padStart(3)}×  ${t}\n        [${shown}]`);
  });
process.exit(1);
