#!/usr/bin/env node
/* A3168: pages/dev-tools.html is the source of the Create hub. GitHub Pages
 * serves /create from create/index.html, so generate that copy from the source
 * instead of keeping two hand-edited 120KB pages.
 *
 * Run: node scripts/build-create-hub.js          (write create/index.html)
 *      node scripts/build-create-hub.js --check  (fail if it is stale)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'pages/dev-tools.html');
const outputPath = path.join(root, 'create/index.html');

function render(html) {
  let out = html;
  const robots = '<meta name="robots" content="noindex, follow">';
  if (!out.includes(robots)) throw new Error('source robots tag not found in pages/dev-tools.html');
  out = out.replace(robots, '<meta name="robots" content="index, follow">');

  const breadcrumb = '"name":"Create","item":"https://jvdesignstudio.co.uk/dev-tools"';
  if (!out.includes(breadcrumb)) throw new Error('source breadcrumb not found in pages/dev-tools.html');
  out = out.replace(breadcrumb, '"name":"Create","item":"https://jvdesignstudio.co.uk/create"');

  return out;
}

function main() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const generated = render(source);

  if (process.argv.includes('--check')) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (current !== generated) {
      console.error('create/index.html is stale. Run: node scripts/build-create-hub.js');
      process.exit(1);
    }
    console.log('create/index.html is up to date');
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generated);
  console.log('Wrote create/index.html from pages/dev-tools.html');
}

if (require.main === module) main();

module.exports = { render, sourcePath, outputPath };
