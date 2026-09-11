/**
 * scripts/build/partials.js - Inject partials/nav+footer into every HTML page.
 * Extracted from root build.js, now uses scripts/lib/*.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');
const { walk } = require('../lib/walk');

const PARTIALS_DIR = path.join(ROOT, 'partials');

function runPartials({ verbose = true } = {}) {
  const partials = {};
  for (const f of fs.readdirSync(PARTIALS_DIR)) {
    if (!f.endsWith('.html')) continue;
    partials[f.replace('.html', '')] = fs.readFileSync(path.join(PARTIALS_DIR, f), 'utf8');
  }
  if (partials['nav-tools'] && partials['nav-content']) {
    partials['nav-tools'] = partials['nav-content'];
  }

  const makeMarkerRegex = (name) => new RegExp(`<!--\\s*BUILD:${name}\\s*-->[\\s\\S]*?<!--\\s*/BUILD:${name}\\s*-->`, 'g');

  function dedupeSkipLinks(src) {
    const markerIdx = src.indexOf('<!-- BUILD:nav-content -->');
    if (markerIdx === -1) return src;
    const head = src.slice(0, markerIdx).replace(/[ \t]*<a href="#main-content" class="skip-link">Skip to main content<\/a>[ \t]*\r?\n?/g, '');
    return head + src.slice(markerIdx);
  }

  let changed = 0, unchanged = 0;
  for (const filePath of walk(ROOT)) {
    let src = fs.readFileSync(filePath, 'utf8');
    const original = src;
    for (const [name, content] of Object.entries(partials)) {
      const re = makeMarkerRegex(name);
      if (re.test(src)) {
        src = src.replace(re, `<!-- BUILD:${name} -->\n${content.trim()}\n<!-- /BUILD:${name} -->`);
      }
    }
    src = dedupeSkipLinks(src);
    src = src.replace(/<link\s+rel="stylesheet"\s+href="([^"]*style-shared\.css[^"]*)"\s*\/?>/gi, (m, href) => {
      if (src.includes(`href="${href}" as="style"`)) return m;
      return `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${href}"></noscript>`;
    });
    if (src !== original) {
      fs.writeFileSync(filePath, src, 'utf8');
      if (verbose) console.log('  updated: ' + path.relative(ROOT, filePath));
      changed++;
    } else unchanged++;
  }
  return { changed, unchanged };
}

if (require.main === module) {
  const r = runPartials();
  console.log(`\nDone. ${r.changed} file(s) updated, ${r.unchanged} unchanged.`);
}

module.exports = { runPartials };
