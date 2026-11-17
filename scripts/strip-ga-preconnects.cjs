/**
 * strip-ga-preconnects.cjs
 * Removes static GA preconnect hints from all HTML files.
 * analytics-loader.js now adds them dynamically after consent (A2621).
 * Run: node scripts/strip-ga-preconnects.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Get all tracked HTML files
const files = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean);

const PATTERNS = [
  '<link rel="preconnect" href="https://www.googletagmanager.com">',
  '<link rel="preconnect" href="https://www.google-analytics.com">',
];

let changed = 0;
for (const rel of files) {
  const filePath = path.join(ROOT, rel);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  for (const pat of PATTERNS) {
    // Remove the line including its newline
    modified = modified.split('\n').filter(l => l.trim() !== pat).join('\n');
  }
  if (modified !== content) {
    fs.writeFileSync(filePath, modified, 'utf8');
    changed++;
  }
}

console.log(`Done. Removed preconnect hints from ${changed} files.`);
