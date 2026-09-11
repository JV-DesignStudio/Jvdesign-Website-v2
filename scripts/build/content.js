/**
 * scripts/build/content.js - Unified content pipeline.
 * Was two separate scripts: generate-content-data.js + build-content-data.js
 * Now one step: scan HTML -> content/*.json -> content-data.js
 * Uses lib/paths + lib/walk to kill drift.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/paths');
const { walk } = require('../lib/walk');

const OUT_DIR = path.join(ROOT, 'content');

function runContent({ verbose = true } = {}) {
  // Inline the generate-content-data logic by requiring the original script as a module
  // We delegate to the existing generators to avoid duplicating 500 lines, but ensure
  // they run in the right order and share the same ROOT.
  const genPath = path.join(ROOT, 'scripts', 'generate-content-data.js');
  const buildPath = path.join(ROOT, 'scripts', 'build-content-data.js');

  // Clear require cache so re-runs pick up changes
  delete require.cache[require.resolve(genPath)];
  delete require.cache[require.resolve(buildPath)];

  // The scripts are self-executing on require - they run main() at import time.
  // Instead we spawn them as child processes for clean stdout.
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [genPath], { stdio: verbose ? 'inherit' : 'pipe' });
  execFileSync(process.execPath, [buildPath], { stdio: verbose ? 'inherit' : 'pipe' });

  // Verify output
  const outFile = path.join(ROOT, 'content-data.js');
  if (!fs.existsSync(outFile)) throw new Error('content pipeline failed: content-data.js not written');
  const stats = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'stats.json'), 'utf8'));
  return stats;
}

if (require.main === module) {
  const stats = runContent();
  console.log(`✓ content: ${stats.workshops} workshops, ${stats.games} games, ${stats.tools} tools`);
}

module.exports = { runContent };
