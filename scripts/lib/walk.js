/**
 * scripts/lib/walk.js - One walk() to replace the 6 copies.
 *
 * Usage:
 *   const { walk } = require('./lib/walk');
 *   const htmlFiles = walk(ROOT, { ext: '.html' });
 *   const allFiles  = walk(ROOT);
 */
const fs = require('fs');
const path = require('path');
const { IGNORE_DIRS } = require('./paths');

function walk(dir, opts = {}) {
  const { ext = '.html', ignore = IGNORE_DIRS, skipHidden = true } = opts;
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (skipHidden && e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (ignore.has(e.name)) continue;
      out = out.concat(walk(full, opts));
    } else if (e.isFile()) {
      if (ext && !e.name.endsWith(ext)) continue;
      out.push(full);
    }
  }
  return out;
}

module.exports = { walk };
