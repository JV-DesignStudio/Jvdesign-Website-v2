#!/usr/bin/env node
// Keep the private Studio reference out of this public repository and Pages output.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const forbidden = ['tools/dev-board.html', 'docs/audits', 'studio-workspace'];
const docs = path.join(root, 'docs');
if (fs.existsSync(docs)) {
  for (const entry of fs.readdirSync(docs)) {
    if (/^STUDIO_AUDIT.*\.md$/i.test(entry)) forbidden.push('docs/' + entry);
  }
}
const found = forbidden.filter(relative => fs.existsSync(path.join(root, relative)));
if (found.length) {
  console.error('Private planning must be moved outside the public site: ' + found.join(', '));
  process.exit(1);
}
console.log('Public boundary checked: internal board and audit artifacts are absent.');
