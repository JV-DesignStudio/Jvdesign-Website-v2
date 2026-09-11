/**
 * scripts/build/sitemap.js - Sitemap + search index in one step.
 * Was: generate-sitemap.js + generate-search-index.js (two separate ignores, two walks)
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/paths');

function runSitemap({ verbose = true } = {}) {
  execFileSync(process.execPath, [path.join(ROOT, 'generate-sitemap.js')], { stdio: verbose ? 'inherit' : 'pipe' });
  execFileSync(process.execPath, [path.join(ROOT, 'generate-search-index.js')], { stdio: verbose ? 'inherit' : 'pipe' });
}

if (require.main === module) runSitemap();
module.exports = { runSitemap };
