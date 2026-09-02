/**
 * add-defer.js
 * Adds `defer` attribute to all external <script src="..."> tags
 * that don't already have `defer` or `async`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = ['.html'];
const SKIP_DIRS = ['node_modules', '.git', '.claude', 'quest-board-deploy', 'scripts'];

let totalFiles = 0;
let totalFixed = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      walk(full);
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  let count = 0;

  // Match external script tags without defer or async
  // Handles: <script src="..."></script>
  // Also handles: <script src="..." type="..."></script>
  // Does NOT match: <script>...</script> (inline)
  // Does NOT match: <script defer ...> or <script async ...>
  const regex = /<script\b(?![^>]*\b(?:defer|async)\b)([^>]*\bsrc=["'][^"']+["'][^>]*)>/gi;

  const newContent = content.replace(regex, (match, attrs) => {
    count++;
    return `<script defer${attrs}>`;
  });

  if (count > 0) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalFiles++;
    totalFixed += count;
    console.log(`  + ${path.relative(ROOT, filePath)} (${count} tags)`);
  }
}

console.log('Adding defer to external script tags...\n');
walk(ROOT);
console.log(`\nDone. ${totalFixed} script tags updated across ${totalFiles} files.`);
