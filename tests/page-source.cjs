// tests/page-source.cjs
// Build-time extraction moves a page's inline <script> into assets/js/inline/*.js
// (kept for the CSP hash strategy). Static checks that read the HTML file alone
// then miss game logic that actually ships. pageSource() returns the page HTML
// plus the contents of every local assets/js/inline/ script it references, so a
// static assertion sees the same code the browser runs.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function pageSource(rel) {
  const abs = path.join(ROOT, rel);
  let src = fs.readFileSync(abs, 'utf8');
  for (const m of src.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
    if (!m[1].includes('assets/js/inline/')) continue;
    const p = path.resolve(path.dirname(abs), m[1]);
    if (p.startsWith(ROOT) && fs.existsSync(p)) src += '\n' + fs.readFileSync(p, 'utf8');
  }
  return src;
}

module.exports = { pageSource };
