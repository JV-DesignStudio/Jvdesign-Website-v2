/**
 * scripts/build/partials.js - Inject partials/nav+footer into every HTML page.
 * Extracted from root build.js, now uses scripts/lib/*.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');
const { walk } = require('../lib/walk');

const PARTIALS_DIR = path.join(ROOT, 'partials');
const MARKETING = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'marketing.json'), 'utf8'));
const STATS = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'stats.json'), 'utf8'));

// One source for visitor-facing catalogue totals. Two forms:
//   <!-- STAT:workshops -->  comment marker for visible HTML
//   {{STAT:workshops}}      token safe inside attributes and JSON-LD strings
//   {{STATX:workshops}}     exact generated count from content/stats.json
function applyStats(src) {
  const display = (key) => MARKETING[key] && MARKETING[key].display;
  const exact = (key) => STATS[key];
  return src
    .replace(/<!--\s*STAT:(\w+)\s*-->/g, (m, key) => display(key) || m)
    .replace(/\{\{\s*STAT:(\w+)\s*\}\}/g, (m, key) => display(key) || m)
    .replace(/\{\{\s*STATX:(\w+)\s*\}\}/g, (m, key) => (exact(key) != null ? String(exact(key)) : m));
}

const makeMarkerRegex = (name) => new RegExp(`<!--\\s*BUILD:${name}\\s*-->[\\s\\S]*?<!--\\s*/BUILD:${name}\\s*-->`, 'g');

// Blocks stamped into a page by other build steps (for example the
// WS-FINISH block from apply-workshop-completion) can sit inside a partial
// region. Reinjecting the partial used to drop them, so keep any
// "<NAME>:START ... <NAME>:END" block that already lives in the region.
const INJECTED_BLOCK_RE = /<!--\s*([A-Za-z0-9_-]+):START\s*-->[\s\S]*?<!--\s*\1:END\s*-->/gi;

function keepInjectedBlocks(region) {
  const found = region.match(INJECTED_BLOCK_RE) || [];
  return found.join('\n');
}

function injectPartial(src, name, content) {
  return src.replace(makeMarkerRegex(name), (region) => {
    const kept = keepInjectedBlocks(region);
    return `<!-- BUILD:${name} -->\n${kept ? kept + '\n' : ''}${content.trim()}\n<!-- /BUILD:${name} -->`;
  });
}

function runPartials({ verbose = true } = {}) {
  const partials = {};
  for (const f of fs.readdirSync(PARTIALS_DIR)) {
    if (!f.endsWith('.html')) continue;
    partials[f.replace('.html', '')] = fs.readFileSync(path.join(PARTIALS_DIR, f), 'utf8');
  }
  if (partials['nav-tools'] && partials['nav-content']) {
    partials['nav-tools'] = partials['nav-content'];
  }

  // cache mtimes - skip write if partials older than file and no marker change
  const partialsMtime = Math.max(...fs.readdirSync(PARTIALS_DIR).filter(f=>f.endsWith('.html')).map(f=>fs.statSync(path.join(PARTIALS_DIR,f)).mtimeMs));

  function dedupeSkipLinks(src) {
    const markerIdx = src.indexOf('<!-- BUILD:nav-content -->');
    if (markerIdx === -1) return src;
    const head = src.slice(0, markerIdx).replace(/[ \t]*<a href="#main-content" class="skip-link">Skip to main content<\/a>[ \t]*\r?\n?/g, '');
    return head + src.slice(markerIdx);
  }

  let changed = 0, unchanged = 0, skippedMtime = 0;
  for (const filePath of walk(ROOT)) {
    // mtime skip - if file newer than partials and no BUILD marker, skip read
    try{
      if(fs.statSync(filePath).mtimeMs > partialsMtime && !fs.readFileSync(filePath,'utf8').includes('<!-- BUILD:')){ skippedMtime++; unchanged++; continue; }
    }catch(e){}
    let src = fs.readFileSync(filePath, 'utf8');
    const original = src;
    for (const [name, content] of Object.entries(partials)) {
      src = injectPartial(src, name, content);
    }
    src = dedupeSkipLinks(src);
    src = applyStats(src);
    // A1503/A1609: keep style-shared.css as a plain stylesheet link. The old
    // preload + inline onload swap needs script-src 'unsafe-inline' and is
    // blocked under the site CSP, leaving the page unstyled. Downgrade any
    // existing preload to the plain form (matches legacy build.js).
    src = src.replace(/<link\s+rel="preload"\s+href="([^"]+)"\s+as="style"\s+onload="[^"]*"><noscript><link\s+rel="stylesheet"\s+href="[^"]*"><\/noscript>/gi,
      (m, href) => `<link rel="stylesheet" href="${href}">`);
    src = src.replace(/<link\s+rel=["']preload["']\s+href=["']([^"']+)["']\s+as=["']style["'][^>]*\sonload=["'][^"']*["'][^>]*>/gi,
      (m, href) => `<link rel="stylesheet" href="${href}">`);
    if (src !== original) {
      fs.writeFileSync(filePath, src, 'utf8');
      if (verbose) console.log('  updated: ' + path.relative(ROOT, filePath));
      changed++;
    } else unchanged++;
  }
  if(verbose && skippedMtime) console.log(`  skipped by mtime: ${skippedMtime} files newer than partials without markers`);
  return { changed, unchanged };
}

if (require.main === module) {
  const r = runPartials();
  console.log(`\nDone. ${r.changed} file(s) updated, ${r.unchanged} unchanged.`);
}

module.exports = { runPartials, injectPartial };
